# MongoDB 库表结构（从代码推断）

> 说明：以下从代码中推断，未直接连库导出。若实际库里有额外字段或类型不一致，以实际为准。你可对照 `db.collection('xxx').findOne()` 或 `mongosh` 的 `listCollections` / 采样文档做校对。

---

## 一、数据库与集合一览

| 数据库 | 集合 | 用途 |
|--------|------|------|
| **hera** | jobs | 职位主表（30 万+ 量级；当前有 tagging 写入 + 推荐查询） |
| **hera** | feedback_events | MCP 反馈、推荐展示记录（推荐去重等） |
| **hera** | agentkit_plans | AgentKit 计划 |
| **hera** | agentkit_memory | AgentKit 会话记忆（如 shown_job_ids） |
| **hera_profiles** | profiles | 用户档案（简历、applications 等） |

说明：`jobDatabaseService` 和 MCP 推荐用 **hera.jobs**；`getDb()` 默认连 **hera**（feedback_events、agentkit）；profiles 用 **hera_profiles**（独立连接配置）。

---

## 二、hera.jobs 结构（推荐与查询用）

从 `jobDatabaseService.transformMongoDBJobToFrontendFormat` 和 `queryJobsWithFilters` 推断，读写会用到以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| **_id** | ObjectId | 默认主键 |
| **id** | string | 业务主键，与 jobIdentifier 二选一或同存 |
| **jobIdentifier** | string | 跨 pipeline 去重用 |
| **title** | string | 职位标题，查询用 regex |
| **company** | string | 公司（或 organisation） |
| **location** | string / array / object | 原始地点；展示用 |
| **locationRaw** | string | 原始地点字符串 |
| **locations** | string | 主站/MCP 城市筛选用（regex），建议有索引 |
| **description** | string | 描述，查询用 regex |
| **summary** | string | 摘要，查询用 regex |
| **postedDate** / **postedDateRaw** | string | 发布日期 |
| **salary** | string | 薪资 |
| **employmentType** / **jobType** | string | 雇佣类型 |
| **experience** | string | 经验要求 |
| **requirements** | array | 要求列表 |
| **benefits** | array | 福利 |
| **skills** | array | 技能 |
| **skillsMustHave** / **skillsMust** | array | tagging/结构化 |
| **skillsNiceToHave** / **skillsNice** | array | tagging/结构化 |
| **highlights** | array | tagging/结构化 |
| **keyRequirements** | array | tagging/结构化 |
| **workRights** | any | 工作权利 |
| **workMode** | string | 远程/混合等 |
| **industry** | string | 行业 |
| **source** / **sourceType** / **platform** | string / array | 来源 |
| **jobUrl** / **url** | string | 申请链接 |
| **tags** | array | 标签（含 seniority 等） |
| **experienceTag** / **experience_label** / **seniority** | string | 经验档位 |
| **is_active** | boolean | 是否有效，查询必用 `{ is_active: { $ne: false } }` |
| **createdAt** | Date | 创建时间，排序用 |
| **updatedAt** | Date | 更新时间，排序用 |
| **hotjob** | boolean | 是否热门 |
| **functionality** | any | 职能等 |

**查询习惯**：  
- 条件：`is_active`、`title/summary/description`（regex）、`locations`（regex）、`company`（regex）、`excludeIds`（$nor）。  
- 排序：`updatedAt: -1, createdAt: -1`。  
- 推荐接口一次取 40/80/180 条，依赖 `locations` + 时间排序，对 **locations、updatedAt、is_active** 建索引最有用。

---

## 三、当前索引（代码里可见）

- **dbsearchqueryBuilder.createIndexes**（针对 jobs）：  
  `title+location`, `location+title`, `locationRaw+title`, `title(text)+location`, `is_active+updatedAt`。  
- **注意**：MCP/主站查询用的是 **locations**（复数），而这里建的是 **location**（单数），若集合里只有 `locations`，需要补 `locations` 相关索引。

---

## 四、其他集合（简要）

- **feedback_events**：含 `event_id`、`session_id`、`tool`、`feedback.shown_jobs`、`output`、`timestamp` 等，用于推荐去重与反馈。  
- **agentkit_memory**：`sessionId`（唯一）、`context.jobContext.shown_job_ids`、`updatedAt`。  
- **profiles**（hera_profiles）：见 `profileDatabaseService` 的 `UserProfile` 类型（email、applications、resumes 等）。

---

## 五、tagging + 推荐对稳定性的影响（判断与建议）

- **现象**：30 万+ 时还好，现在 tagging 写入量大 + 推荐读多，出现 MongoDB API / 超时。  
- **可能原因**：  
  1. **读写争用**：同一批数据上既有大量 tagging 更新（写），又有推荐的大范围 scan/排序（读），锁或 IO 争用。  
  2. **索引不匹配**：推荐查询用 `locations`、`updatedAt`，若缺合适复合索引，会扫大量文档并排序，放大会写时的压力。  
  3. **连接/资源**：连接池或 maxTimeMS 不足，在负载高时易超时或排队。

**建议方向**（你可按需给 Codex/GPT 细化）：  
1. **索引**：至少保证 `{ is_active: 1, updatedAt: -1 }`、`{ locations: 1, updatedAt: -1 }`（或你们实际用的城市字段）存在且被查询用到；若 tagging 按 id 更新多，保留 `_id`/`id`/`jobIdentifier` 索引。  
2. **读写分离**：若有副本集，推荐读走 secondary，减轻主库压力。  
3. **写入节奏**：tagging 批量更新可考虑限流、错峰或队列，避免和推荐高峰重叠。  
4. **监控**：看 MongoDB 的 slow query、lock、connection 数，确认是读慢、写慢还是连接满。

---

## 六、你可以补充给我的信息（便于再细化）

- 实际 `hera.jobs` 一条文档的样例（脱敏后一两份即可），或 `listIndexes` 输出。  
- tagging 写入方式：按条 update、bulkWrite、还是替换整文档；频率和批量大小。  
- 是否用副本集、当前 MONGODB_URI 是否直连主节点。  

有这些后可以进一步写出「推荐专用索引」和「tagging 与推荐隔离」的落地方案（含具体索引名和查询示例）。
