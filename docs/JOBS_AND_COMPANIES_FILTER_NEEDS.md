# Jobs / Companies 集合逻辑与「更多筛选」所需信息

> 目的：说清当前代码里 jobs/companies 的用法，以及要加「更多 filter」时你需要提供什么（无需你先改代码）。

---

## 一、当前代码里的逻辑（已核对）

### 1. 只用到了 **jobs** 集合

- **位置**：`src/services/jobDatabaseService.ts`
- **集合名**：`COLLECTION_NAME = 'jobs'`，数据库 `hera`
- **companies**：在代码里**没有**单独的 `companies` 集合；**公司** 是 jobs 文档上的一个字段：
  - `job.company` 或 `job.organisation`
  - 筛选时用：`query.company = { $regex: options.company, $options: 'i' }`（即按公司名字符串模糊匹配）

所以：  
- 当前**没有**「companies 子集」的独立集合在参与查询。  
- 若你库里实际有一个 **companies** 集合（例如存公司详情、行业、规模等），目前代码**还没用**它；要按「公司维度」做更多筛选，就需要知道这个集合的结构和与 jobs 的关联方式。

### 2. jobs 上已有的筛选（queryJobsWithFilters）

| 入参 | 实现方式 | 说明 |
|------|----------|------|
| `jobTitle` | `$or`: title / summary / description 的 **regex** | 职位关键词 |
| `city` | `locations` 的 **regex** | 城市 |
| `company` | `company` 的 **regex** | 公司名 |
| `platforms` | source / platform / sourceType 的 **regex** | 渠道 |
| `postedWithinDays` | postedDate / createdAt / updatedAt ≥ 某日期 | 发布时间 |
| `excludeIds` | `$nor` id / jobIdentifier / _id | 排除已展示 |
| （隐式） | `is_active: { $ne: false }` | 有效职位 |

排序固定：`updatedAt: -1, createdAt: -1`。

### 3. 调用 queryJobsWithFilters 的入口

- **recommend_jobs**：只传了 jobTitle、city、page、pageSize、excludeIds（**没传 company/platforms/postedWithinDays**）
- **search_jobs_by_company / jobs_at_company**：传了 company、jobTitle、city、page、pageSize

也就是说：推荐接口目前**没有**把「公司、渠道、发布时间」等暴露为可选的更多筛选条件；要加「更多 filter」，就要在入参和 query 里把这些（以及你想加的新维度）接上。

---

## 二、jobs 文档里已有、可做筛选的字段（按文档推断）

下面这些在 `transformMongoDBJobToFrontendFormat` 或文档说明里已经出现，**理论上都可以做成 filter**，但实际字段名/存法要以你库里为准：

| 字段（文档/代码中） | 类型/说明 | 可做的筛选方式示例 |
|--------------------|-----------|---------------------|
| salary | string | 区间（需约定格式或解析）或「有/无」 |
| employmentType / jobType | string | 等值或 regex：Full-time, Part-time, Contract… |
| workMode | string | Remote / Hybrid / On-site 等 |
| industry | string | 等值或 regex |
| experience / experienceTag / seniority | string | Junior / Mid / Senior 等 |
| workRights | any | 按你业务约定（如数组包含某值） |
| is_active | bool | 已用（只查有效） |
| postedDate / createdAt / updatedAt | 日期 | 已支持 postedWithinDays |

要安全地加这些 filter，需要确认两件事：  
1）库里**真实字段名**（例如是 `employmentType` 还是 `jobType`，是否同时存在）；  
2）取值的**真实写法**（例如 "Full-time" 还是 "Full time"），以便用等值或简单 regex。

---

## 三、要支持「更多 filter」你需要提供什么

### A. 若你有 **companies** 集合，且想按「公司维度」筛

请提供（可贴到 workspace 或发我）：

1. **companies 集合的用途**  
   - 例如：存公司名、行业、规模、是否 sponsor 等。

2. **一条 companies 文档样例**（脱敏）  
   - 例如：`{ _id, name, industry?, size?, ... }`  
   - 这样我可以按真实字段名设计 filter。

3. **和 jobs 的关联方式**  
   - 方式一：jobs 上有 `companyId`（或类似）指向 `companies._id` → 可以做 `$lookup` 或先查 company 再筛 job。  
   - 方式二：只有名字关联（jobs.company 存字符串，companies 也有 name）→ 只能通过名字匹配或维护一份 id 映射。  
   - 你当前是哪种（或两种都有），说一下即可。

4. **你希望按公司做哪些筛选**  
   - 例如：按公司行业、公司规模、是否 sponsor、公司名称列表 等。  
   - 列出来我就可以在查询层设计对应参数和索引建议。

### B. 若你要的是「jobs 上更多筛选维度」（不依赖 companies 集合）

请任选一种方式提供即可：

**方式 1（推荐）**  
- 在 Atlas 里对 **jobs** 集合执行：  
  `db.jobs.findOne()`（或 `find().limit(1)`），把一条**真实文档**（可脱敏：公司名、title、描述等）复制到 workspace 的一个文件里（如 `docs/sample_job_doc.json`）。  
- 这样我可以按**真实字段名和取值**加 filter，避免猜错。

**方式 2**  
- 若不方便给文档，就给我一份**字段清单**（可来自 Atlas 的 Schema 或你自己列的），例如：  
  - 薪资：字段名 `salary`，存法 "100k-120k" 或 "Negotiable"  
  - 工作方式：字段名 `workMode`，取值 "Remote" / "Hybrid" / "On-site"  
  - 职位类型：字段名 `employmentType`，取值 …  
- 并说明你**希望支持的筛选**：  
  - 例如：薪资范围、远程/混合、职位类型、行业、经验级别、工作权利 等。

### C. 若你要把「database 的代码」加到 workspace

- 若你说的「database 的代码」是指：**建表/建索引脚本、ETL、或访问 DB 的其它服务代码**，可以放到 workspace（例如 `scripts/` 或 `docs/`）。  
- 我会重点看：  
  - 集合名、库名；  
  - jobs 与 companies 的字段和关联方式；  
  - 是否已有按 company_id、industry、salary 等的查询或索引。  
- **不是必须**：只要你有「一条 job 文档样例 + 想要的 filter 列表」或「companies 文档样例 + 与 jobs 的关联」，我也可以直接在当前 `jobDatabaseService` + MCP 里设计扩展方案，不一定要先看 DB 脚本。

---

## 四、小结：你需要给我的（按你的目标选）

| 目标 | 建议提供 |
|------|-----------|
| 只加 **jobs 上的更多筛选**（薪资、远程、类型、行业、经验等） | 一条 `jobs` 文档样例（或字段清单 + 取值示例）+ 你希望支持的 filter 列表 |
| 要用 **companies 集合** 做筛选（行业、规模等） | companies 文档样例 + 与 jobs 的关联方式 + 希望按公司做的筛选列表 |
| 两者都要 | 上面两份都给 |

你只要把上述内容贴到 workspace（或告诉我文件路径），我就可以基于现有 `queryJobsWithFilters` 和 MCP 入参，给出一版「最小改动」的扩展方案（新增哪些参数、query 怎么拼、recommend_jobs / search_jobs_by_company 是否要透传这些参数），并尽量兼顾你现有的索引（如需要会注明建议索引）。
