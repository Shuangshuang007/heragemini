# 推荐稳定与提速方案（可落地）

---

## 目标

1. **先稳**：推荐请求不再因 MongoDB 超时拿不到数据（0 条）。
2. **再快**：搜索 → 结果在可接受时间内出来（如 10 条 &lt; 15s，50 条可放宽或分批）。

---

## 方案一：数据库侧（优先做）

### 1.1 索引对齐并补全（hera.jobs）

- 推荐查询实际用：`is_active`、`locations`（regex）、`title/summary/description`（regex）、`updatedAt`/`createdAt` 排序、`id`/`jobIdentifier`（excludeIds）。
- **建议索引**（与 `queryJobsWithFilters` 一致）：
  - `{ is_active: 1, updatedAt: -1 }` — 必选，覆盖默认条件 + 排序。
  - `{ is_active: 1, locations: 1, updatedAt: -1 }` — 按城市 + 时间查时用。
  - 若按 jobTitle 查很多：`{ is_active: 1, title: 1, updatedAt: -1 }` 或 text index（按你们实际查询选一种）。
- **确认**：当前若只有 `location` 没有 `locations`，要么加 `locations` 索引，要么把查询改成用已有索引的字段，避免全表扫描。

### 1.2 连接与超时（不改变业务逻辑，只快速失败）

- 在 `jobDatabaseService.connectToMongoDB` 里：`serverSelectionTimeoutMS` / `connectTimeoutMS` 保持或略降（如 10–15s），避免一次请求挂 2 分钟才报错。
- 查询可加 `maxTimeMS`（如 15s），超时返回空或明确错误，前端/调用方可提示「稍后重试」而不是长时间无响应。

### 1.3 读写分离（有副本集时）

- 推荐只读：若 MongoDB 是副本集，把推荐用的连接改为 `readPreference: 'secondary'`，减轻主库压力，tagging 写主库、推荐读从库。
- 需在应用里区分「推荐用连接」和「写入用连接」（或同一连接池配置 readPreference）。

---

## 方案二：应用侧（推荐流程）

### 2.1 推荐查询本身

- 已分层 10/50/100，searchLimit 40/80/180；逻辑不动，只依赖 DB 稳定后自然变快。
- 若 50 条仍慢：可先「首屏 10 条快返」，再异步或第二次请求补 40 条（或保留当前一次 50，视体验再定）。

### 2.2 打分（GPT）耗时

- 现状：N 条候选 → N 次 jobMatch。
- 可选优化（按需选做）：
  - **只对前 M 条打分**：例如只对前 20 条调 GPT，其余按关键词/规则粗排后截断，保证首屏快。
  - **缓存**：同一 jobId + 同一 userProfile 的 hash 在短时间（如 5 分钟）内复用上次 matchScore，减少重复调用。
  - **批量/并发**：在不超过下游限流前提下，对多条并发调 jobMatch（注意并发上限和超时）。

### 2.3 Tagging 与推荐错峰（若同库）

- Tagging 批量更新尽量避开推荐高峰（例如凌晨或低峰期跑大批量）。
- 或 tagging 用队列 + 限流，控制同时写库的 QPS，避免和推荐读同时打满同一批文档。

---

## 方案三：多维度搜索（下一步）

- 在 `queryJobsWithFilters` 增加可选参数：company、postedWithinDays、workMode（远程）等，拼进 query。
- 为这些条件建对应复合索引（如 `is_active + locations + updatedAt + company`），保证「多维度 + 快」。
- 先保证 job title + city 稳定且快，再逐步加维度。

---

## 落地顺序建议

| 顺序 | 动作 | 预期 |
|------|------|------|
| 1 | 在 hera.jobs 上建/补索引（尤其 `is_active`、`locations`、`updatedAt`），并确认查询用到的字段与索引一致 | 推荐查询变快、少扫表，超时减少 |
| 2 | 连接/查询超时设上限（如 10–15s），超时快速失败并返回明确错误 | 不再长时间挂起，体验可预期 |
| 3 | 若有副本集，推荐读走 secondary | 减轻主库压力，tagging 写与推荐读分离 |
| 4 | 视情况做「首屏 10 条快返」或打分缓存/限流 | 首屏更快或 50 条更稳 |
| 5 | 多维度筛选 + 对应索引 | 功能扩展且保持「快」 |

---

## 总结

- **本质**：推荐逻辑没问题，瓶颈在 DB 的**索引不足 + 读写争用（tagging 写 + 推荐读）**。
- **方案**：**索引对齐与补全** 优先；**超时可控**；有副本集则 **读从库**；再按需做 **打分策略**（少调几次或缓存）和 **tagging 错峰/限流**；多维度搜索作为下一步，配合索引一起上。
- 需要的话，我可以按你们当前 `queryJobsWithFilters` 的精确写法，给出一份「可直接在 MongoDB 里执行的 createIndex 语句」清单。
