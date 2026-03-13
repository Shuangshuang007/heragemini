# 推荐职位（recommend_jobs）现状与优化思路总结

> 用途：给 Codex/GPT 的上下文，便于讨论「怎么快」和「多维度搜索」。

---

## 一、本质能不能做？

**能。** 逻辑已实现：

- 搜索条件：job title + city（必填）
- 分层：recommendable(10) / enhanced(50) / auto_apply_ready(100)，按 profile 阶段返回不同数量
- 流程：DB 查候选 → 对每条调 GPT jobMatch 打分 → 按分数排序取前 N 条返回（不足 N 则全返回）
- 多轮：exclude_ids + AgentKit Memory 支持「再看一批」不重复

当前卡点不在「能不能做」，而在**慢**和**不稳定**。

---

## 二、现状简述

| 项目 | 现状 |
|------|------|
| **DB 查询** | `jobDatabaseService.queryJobsWithFilters`：按 jobTitle（title/summary/description regex）、city（locations regex）、excludeIds 查，sort `updatedAt -1, createdAt -1`，limit=40/80/180 等 |
| **索引** | `dbsearchqueryBuilder` 里有 `createIndexes`：title+location, location+title, locationRaw+title, text(title)+location, is_active+updatedAt。**注意**：MCP 实际用字段是 `locations`（复数），和现有索引的 `location` 可能不一致 |
| **连接** | 远程 MongoDB（如 159.143.113.127:27017）经常 **MongoNetworkTimeoutError**，导致 0 条、请求等很久才失败 |
| **打分** | 每条候选调一次 `/api/gpt-services/jobMatch`（GPT），10 条约 30–40s，50 条要几分钟，是主要耗时 |
| **结果** | DB 正常时 10 条能稳定返回；50 条要么因 DB 超时拿不到，要么要等很久 |

---

## 三、优化维度

### 1. 现有逻辑的优化空间

- **索引**
  - 确认并统一字段：MCP 查询用 `locations`、`title`、`is_active`、`updatedAt`/`createdAt`、`id`/`jobIdentifier`；若当前索引是 `location`（单数），需补 `locations` 或改查询与索引一致。
  - 建议复合索引至少覆盖：`{ is_active: 1, updatedAt: -1 }`、`{ locations: 1, updatedAt: -1 }`（或与查询一致的 city 字段）、必要时 `title` 或 text 索引，避免全表扫描。
- **连接与超时**
  - 连接池、serverSelectionTimeoutMS/connectTimeoutMS 已存在；可考虑在超时后快速失败并返回明确错误，避免长时间挂起。
- **打分阶段**
  - 当前：N 条候选 → N 次 GPT 调用 → 再排序截断。可考虑：只对「前 M 条」（M<N）打分后即返回（流式或分页）、或对部分维度做缓存/规则预筛，减少 GPT 调用次数，加快首屏。

### 2. 数据库「多维度搜索」

- **目标**：除 job title + city 外，支持按公司、薪资、远程、发布时间等维度筛选，且要**快**。
- **实现思路**：
  - 在 `queryJobsWithFilters`（或等价查询层）增加可选参数：company、salaryRange、remote、postedWithinDays 等，并拼进 query。
  - 为这些筛选条件设计合适索引（单列或复合，例如 is_active + updatedAt + locations + company），保证带 filter 的查询走索引、不扫全表。
  - 若后续有全文或复杂条件，再考虑 text index 或聚合管道优化。

### 3. 本质目标：怎么快

- **DB 层**：索引对齐查询字段（尤其是 locations/updatedAt/is_active），减少扫描与排序成本；连接稳定或快速失败。
- **应用层**：减少不必要的 GPT 调用（少打分条数 / 缓存 / 预筛），或先返回一页再异步补打分。
- **体验**：先保证「搜索 → 有结果、稳定」，再优化到「搜索 → 快速出结果」；可接受 10 条快、50 条稍慢的分级策略。

---

## 四、可给 Codex/GPT 的问题示例

1. 我们推荐流程是：MongoDB 按 job title + city 查一批 → 每条调 GPT 打分 → 按分数取前 N。DB 经常超时，50 条打分又慢。从**索引设计**和**查询写法**上，怎么让这次查询尽量快、且和现有 `locations`/`updatedAt` 排序一致？
2. 我们想支持**多维度搜索**（公司、薪资、远程、发布时间等），在 MongoDB 里应该如何加字段、建索引、改查询，才能既灵活又快？
3. 在**不改变“按匹配度排序”**的前提下，如何减少 GPT 调用次数或延迟，让用户更快看到第一批结果（例如先返回 10 条再后台补 50）？

---

## 五、相关代码位置

- 推荐入口与分层逻辑：`src/app/api/mcp/route.ts`，`recommend_jobs` 分支（约 2768 行起）
- DB 查询：`src/services/jobDatabaseService.ts`，`queryJobsWithFilters`（约 311 行起）
- 索引创建：`src/lib/dbsearchqueryBuilder.ts`，`createIndexes`（约 147 行起）；MCP 未直接调用，jobs 集合的索引是否与 `jobDatabaseService` 查询一致需核对
