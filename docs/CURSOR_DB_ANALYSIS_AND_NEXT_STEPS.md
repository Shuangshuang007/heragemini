# Cursor 对照结论与下一步建议（不改动代码）

> 基于 GPT 的 Hera Job Database 性能分析、你提供的 Atlas 监控/索引截图，以及本仓库代码的交叉核对。**目标：最小化修改、能提速。** 本文档仅做结论与建议，不包含代码改动。

---

## 一、GPT 分析对照结论（已核实）

### 1. 查询层（Query Layer）— 代码已核对

**实际 Mongo 查询形状**（`jobDatabaseService.queryJobsWithFilters`）：

| 条件 | 代码实现 | 对索引的影响 |
|------|----------|--------------|
| 基础过滤 | `is_active: { $ne: false }` | 无专用索引时无法单独利用 |
| jobTitle | `$or: [ { title: regex }, { summary: regex }, { description: regex } ]`，**均为 regex** | **B-tree 索引无法高效支持**；Mongo 易退化为多字段扫描或全表扫描 |
| city | `locations: { $regex: city, $options: 'i' }` | `locations_1` 可被部分利用（前缀 regex 略好），非前缀 substring 仍贵 |
| 排除已展示 | `$nor: [ id $in, jobIdentifier $in, _id $in ]` | 大 excludeIds 时过滤成本高 |
| 排序 | `sort({ updatedAt: -1, createdAt: -1 })` | 依赖 `updatedAt`/`createdAt` 相关索引 |

**打分（Scoring）**：在**应用层**完成（对每条候选调一次 `/api/gpt-services/jobMatch`），不在 Mongo 聚合里。与 GPT 结论一致。

**结论**：  
- **title 用 regex 且跨 title/summary/description 三字段** → 即使用 `title_1` 或做 `(title, locations)` 复合索引，对当前查询形状帮助有限，GPT 说的 “regex 导致复合索引难用” 成立。  
- **city 用 locations + regex** → 有 `locations_1`（你截图里有 61.4MB），但无 `(locations, updatedAt)` 或 `(is_active, locations, updatedAt)` 这类与排序一致的复合索引，查询仍可能重排、费时。

---

### 2. 索引使用情况（Index Usage）

- **Atlas 截图**：21 个索引，2.7M 文档，**Usage 列为 “Usage data unavailable”**，与 GPT 建议一致，需在库里用 `$indexStats` / `explain("executionStats")` 才能确认实际命中。  
- **与推荐查询的匹配度**：  
  - 存在 `title_1`、`locations_1`、`updatedAt_jobIdentifier_idx` 等，但**没有** `(is_active, locations, updatedAt)` 或 `(is_active, title, updatedAt)` 这类与当前「过滤 + 排序」完全一致的复合索引。  
  - GPT 提到的 “没有清晰的 jobTitle + city 复合索引” 在代码与截图中都成立：我们查的是 **regex(title/summary/description) + regex(locations)**，不是等值，现有单列/复合索引对这类查询帮助有限。

---

### 3. 集群负载（你提供的 Atlas 监控截图）

- **现象**：一个节点（shard-00-02）opcounters 与 CPU 明显高于另外两节点（opcounters 常 >100/s，CPU 长时间 100%+ 甚至 150%+），另两个节点较空闲。  
- **含义**：  
  - 要么读/写请求大部分落在同一分片（例如分片键导致数据倾斜），  
  - 要么该节点是 primary，写 + 读都在其上，导致单点过载。  
- 与 GPT 的 “One node significantly higher opcounter + CPU” 结论一致，说明**单点资源不足或负载不均**是超时/慢查的重要成因之一。

---

### 4. 内存与索引体量（RAM vs Index Size）

- GPT 估算：索引总占用约 3–4GB，M20 约 4GB RAM，文档将增至 4.7–5.3M → 工作集难以全部常驻内存。  
- 你截图中的大索引（如 jobIdentifier_title_idx 404MB、idx_sourceId 390MB、updatedAt 相关 354MB/201MB 等）加总与 GPT 量级一致。  
- **结论**：在 M20 上，索引 + 热数据接近或超过 RAM，容易产生磁盘读、延迟尖刺和超时，与当前 `MongoNetworkTimeoutError` + 120s 级延迟现象相符。

---

### 5. Tagging 与搜索同库

- 代码与文档均显示：tagging 更新与推荐查询共用 **hera.jobs**、同一集群。  
- GPT 建议“先不拆库、先看 tagging 并发与批次”与现有架构一致；若 tagging 有大批量更新，会与推荐读争用 IO/锁，加剧单节点压力。

---

## 二、对 GPT “Questions for Cursor” 的逐条回答

| 问题 | 结论（基于代码 + 截图） |
|------|--------------------------|
| **Exact Mongo query for job search?** | 见上：`is_active` + `$or`(title/summary/description regex) + `locations` regex + `$nor`(excludeIds)，`sort(updatedAt, createdAt)`。 |
| **Regex / text / equality?** | **Title：regex**（三字段）。**City：regex**（locations）。无 text index 参与当前推荐查询。 |
| **Scoring in Mongo or app?** | **应用层**：每条候选调一次 jobMatch API。 |
| **Which indexes used?** | UI 无 usage；需在库里跑 `explain("executionStats")` 和 `$indexStats` 确认。 |
| **Cache pressure (cache ratio, page faults, disk IOPS)?** | 需在 Atlas 的 Hardware/MongoDB 指标里查；GPT 的 RAM 不足推断与截图和 M20 规格一致。 |
| **Tagging write frequency / batch / pattern?** | 代码库未暴露具体频率与批次大小；需在运维/日志侧确认，或之后在 tagging 写入处加简单日志。 |

---

## 三、下一步建议（最小改动、能提速）

在**不改动业务逻辑、尽量少动代码**的前提下，按优先级建议如下。

### 第一步：升级集群 M20 → M40（优先做）

- **原因**：  
  - 单节点 CPU 长时间 100%+、索引+数据体量接近或超过 M20 RAM，是当前超时和 120s 延迟的最合理解释。  
  - 升级到 M40（约 8GB RAM）可缓解工作集与索引无法常驻内存的问题，减少磁盘读与延迟尖刺。  
- **预期**：同一查询形状下，超时率下降、P99 延迟明显缩短。  
- **操作**：Atlas 控制台改 tier，无需改代码。

---

### 第二步：在库里做一次“查询 + 索引”验证（不改代码，只观察）

1. **看当前推荐查询实际执行计划**  
   - 在 mongosh 连上 Atlas，对 **jobs** 集合用与 `queryJobsWithFilters` 等价的 filter + sort，执行：  
     `db.jobs.find({ ... }).sort({ updatedAt: -1, createdAt: -1 }).limit(80).explain("executionStats")`  
   - 看：`winningPlan` 用的哪个 index、是否有 COLLSCAN、executionTimeMillis`、docsExamined vs nReturned`。  
2. **看索引使用统计**  
   - `db.jobs.aggregate([{ $indexStats: {} }])`  
   - 对照 21 个索引，找出 accesses.ops 长期为 0 或极低的，作为“可考虑后续精简”的候选（不要求立刻删）。  
3. **看 Atlas 缓存与 IO**  
   - 在 Atlas 的 **Cache Ratio**、**Page Faults**、**Disk IOPS** 看是否在推荐请求时出现明显劣化，与 GPT 的“内存不足→磁盘读”互相印证。

以上都是**只读、诊断**，不改变应用行为。

---

### 第三步：索引优化（在确认 M40 仍慢或想进一步提速时再做）

- **原则**：当前查询以 **regex + sort(updatedAt)** 为主，单纯加 `(title, locations)` 复合索引对 regex 帮助有限。  
- **更稳妥、且与现有查询和排序一致的做法**：  
  - 增加/确认存在：`{ is_active: 1, updatedAt: -1 }`（便于“有效职位 + 按时间排序”的通用路径）。  
  - 若有“经常只按城市筛”的请求，可考虑：`{ is_active: 1, locations: 1, updatedAt: -1 }`，对 **locations 前缀 regex** 有一定帮助（需用 explain 验证是否被选用）。  
- **精简索引**：在第二步确认长期未使用的索引后，再考虑删除 1–2 个明显与搜索无关的（如 GPT 提到的 jobUrl/oldJobUrl/atsSource 等），降低内存与写放大；**先 $indexStats，再决定删谁**。

---

### 第四步：应用侧“可选项”（仅在 DB 侧做完仍不够时考虑）

- **超时与快速失败**：为 Mongo 连接/查询设置 `serverSelectionTimeoutMS`、`maxTimeMS`（例如 15–30s），避免单次请求挂到 120s；超时后返回明确错误或“稍后重试”，不改推荐逻辑本身。  
- **限制单次候选量**：你已按 10/50/100 分层，searchLimit 40/80/180；若 50 条仍经常超时，可临时把 enhanced 的 searchLimit 从 80 降到 50，减少单次查询与后续打分量，属于“最小改动”的保守策略。  
- **Tagging**：若第二步/Atlas 显示 tagging 写与推荐读时间重叠且写量很大，再考虑错峰或限流；当前建议仍是“先升级 + 验证”，再动 tagging。

---

## 四、总结表（方便你按顺序执行）

| 顺序 | 动作 | 是否改代码 | 预期 |
|------|------|------------|------|
| 1 | **M20 → M40 升级** | 否 | 降低超时率、缩短 P99，缓解单节点 CPU 与内存压力 |
| 2 | **explain + $indexStats + Atlas 缓存/IO 观察** | 否 | 确认慢查原因、索引是否被用、是否磁盘压力大 |
| 3 | **按需补/建索引（is_active+updatedAt；可选 locations+updatedAt）、删未用索引** | 否（仅 DB） | 查询更贴索引、减少无效索引占内存 |
| 4 | **可选：maxTimeMS/连接超时、或略降 searchLimit** | 是（少量） | 快速失败、或单次负载略降 |

整体上，**先做第一步（升级 M40）+ 第二步（explain + $indexStats + 监控）**，就能在不改或极少改代码的前提下，验证“是不是主要瓶颈在资源与索引”，并据此决定是否做第三步、第四步。若你愿意，我可以再根据你当前的 `query` 结构写一份可直接在 mongosh 里粘贴的 `find(...).explain("executionStats")` 示例，方便你跑第二步。
