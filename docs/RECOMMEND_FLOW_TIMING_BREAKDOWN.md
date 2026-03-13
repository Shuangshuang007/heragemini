# recommend_jobs 流程拆解与耗时观测

> 用于精确定位「哪一步慢」。代码已加入分步计时，跑一次推荐看日志即可看到各阶段耗时。

---

## 一、流程步骤拆解

| 步骤 | 说明 | 计时键 | 可能瓶颈 |
|------|------|--------|----------|
| **1** | 连接 MongoDB（`connectToMongoDB()`） | `connect_mongo_ms` | 冷启动、网络、连接池满 |
| **2** | Layer 2：AgentKit Memory 读（`getContext(session_id)`） | `layer2_memory_read_ms` | 外部 Memory 服务/DB |
| **3** | Layer 3：feedback_events 读（`getSessionFeedback`，最多等 500ms） | `layer3_feedback_read_ms` | MongoDB feedback_events 查询 |
| **4** | DB 查询职位（`queryJobsWithFilters`） | `db_query_ms` | 见下表子步骤 |
| **4a** | 子步骤：MongoDB 连接（同上，通常复用） | 见 jobDatabaseService 日志 | - |
| **4b** | 子步骤：`countDocuments(query)` | `[TIMING] queryJobsWithFilters countDocuments` | 无索引时全表扫描 |
| **4c** | 子步骤：`find().sort().skip().limit().toArray()` | `[TIMING] queryJobsWithFilters find+...` | 排序/skip 慢、regex 不走索引 |
| **4d** | 子步骤：内存里 `transformMongoDBJobToFrontendFormat` | `[TIMING] queryJobsWithFilters transform` | 一般很快 |
| **5** | GPT 打分：对每个候选调一次 `/api/gpt-services/jobMatch`（`Promise.all` 并发） | `gpt_scoring_ms`、`gpt_calls_count` | **主要耗时**：N 次 HTTP + GPT，40/80 条时明显 |
| **6** | 排序 + 截断（`sort` by matchScore，`slice(0, effectiveLimit)`） | `sort_slice_ms` | 纯内存，通常 <50ms |
| **7** | 写 feedback_events（`updateOne` upsert） | `feedback_write_ms` | MongoDB 写入 |
| **8** | 写 AgentKit Memory（`storeContext`） | `memory_write_ms` | 外部 Memory 服务 |
| - | **整段** | `total_ms` | - |

- 候选数量：`candidates_count` = 从 DB 拿到的条数（40/80/180 等）；`gpt_calls_count` 与之相同（对每条都打分）。

---

## 二、如何看耗时

### 1. 服务端日志（推荐）

跑一次 `recommend_jobs`（例如用 `scripts/test_recommend_50.js` 或 GPT 调 MCP），在 **Next 服务日志** 里搜：

- **`[TIMING] recommend_jobs breakdown:`**  
  一行 JSON，包含上面所有键（单位毫秒），例如：
  ```json
  {
    "connect_mongo_ms": 12,
    "layer2_memory_read_ms": 0,
    "layer3_feedback_read_ms": 45,
    "db_query_ms": 2300,
    "candidates_count": 80,
    "gpt_scoring_ms": 42000,
    "gpt_calls_count": 80,
    "sort_slice_ms": 2,
    "feedback_write_ms": 80,
    "memory_write_ms": 120,
    "total_ms": 44659
  }
  ```
  可直接看出 **db_query_ms** 与 **gpt_scoring_ms** 谁占大头。

- **`[TIMING] queryJobsWithFilters ...`**  
  在 `jobDatabaseService` 里打印的 DB 子步骤：
  - `connectToMongoDB`（仅当 >100ms 时打印）
  - `countDocuments`（仅当 >200ms 时打印）
  - `find+sort+skip+limit+toArray`（仅当 >300ms 时打印）
  - `transform`（仅当 >100ms 时打印）
  - 最后一行：`queryJobsWithFilters TOTAL: Xms (connect=Y count=Z find=W transform=V)`

### 2. 如何判断「哪一步慢」

- **total_ms 大部分在 gpt_scoring_ms**  
  → 瓶颈在 GPT 打分；优化方向：减少打分条数、缓存、先返回一页再异步补打等（见 RECOMMEND_OPTIMIZATION_PLAN.md）。
- **total_ms 大部分在 db_query_ms**  
  → 瓶颈在 MongoDB；看 `[TIMING] queryJobsWithFilters` 里是 `countDocuments` 慢还是 `find+...` 慢，再对索引/查询条件做优化（见 MONGODB_STRUCTURE.md、RECOMMEND_JOBS_OPTIMIZATION_SUMMARY.md）。
- **connect_mongo_ms 很大**  
  → 连接建立慢或连接池问题。
- **layer2_memory_read_ms / layer3_feedback_read_ms 较大**  
  → 去重数据源（Memory / feedback_events）慢，可考虑超时或降级。

---

## 三、代码位置（方便改阈值或加字段）

- **recommend_jobs 各步计时**：`src/app/api/mcp/route.ts`，`name === "recommend_jobs"` 分支内，变量 `timing`，最后 `console.log('[TIMING] recommend_jobs breakdown:', ...)`。
- **queryJobsWithFilters 子步骤计时**：`src/services/jobDatabaseService.ts`，`queryJobsWithFilters` 内，带 `[TIMING]` 的 `console.log`（含阈值 100/200/300ms）。

---

## 四、和优化文档的关系

- **RECOMMEND_JOBS_OPTIMIZATION_SUMMARY.md**：整体流程与优化思路。
- **RECOMMEND_OPTIMIZATION_PLAN.md**：具体优化项（索引、超时、打分上限/缓存等）。
- **MONGODB_STRUCTURE.md**：集合与索引结构。

先看本拆解文档的计时结果，确定是 DB 慢还是 GPT 慢，再按上述文档做针对性优化。
