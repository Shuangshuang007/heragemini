# 多维职位搜索方案（JDS companies/jobs + hera_one 查询）

> 基于当前 workspace 内 **JobDirectSearchAPI (JDS)** 的 companies/jobs 集合与 **hera_one** 的 `jobDatabaseService` + hera.jobs 逻辑整理；目标：支持「按公司、行业+职位+地点、技能、仅 H1B」等多种搜索场景，并考虑与 JDS 的衔接。

---

## 一、当前维度梳理

### 1. JDS 侧（JobDirectSearchAPI）

**companies 集合**（`src/types/company.ts` + ingest 用法）：

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 公司名称，**唯一键**（findOne/updateOne 用） |
| alternativeName | string | 别称/全称 |
| linkedin_url | string | LinkedIn 公司页 |
| recruitment_url / website | string | 招聘页/官网 |
| **industry** | string | **行业** |
| **size** | string | 公司规模 |
| founded_year | number | 成立年份 |
| **location** | string | 总部位置 |
| description | string | 公司描述 |
| parentCompany | string | 母公司/品牌 |
| ats.jobSnapshot | object | 当前职位快照（jobIds, jobIdToUrl, snapshotHash 等） |
| careers.careersPageUrl | string | 招聘主页 |
| status | 'active' \| 'inactive' | 状态 |

**jobs 集合**（JDS ingest 写入，`src/types/job.ts`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 平台内唯一 ID（如 title+company+location+jobUrl hash） |
| jobIdentifier | string | 跨平台去重 ID |
| company | string | 公司名（展示） |
| **company_name** | string | 冗余公司名，**与 companies.name 对应** |
| **company_id** | ObjectId? | 可选，关联 companies._id |
| title | string | 职位标题 |
| jobUrl | string | 申请链接 |
| **location** | string | 标准化位置（多地点分号分隔） |
| salary | string | 薪资 |
| **employmentType** | string | Full-time / Part-time 等 |
| **workMode** | string | On-site / Hybrid / Remote |
| postedDateRaw / postedDateISO | string | 发布日期 |
| description / summary | string | 描述/摘要 |
| source / sourceType | array/string | 来源、类型（CorporateDirect 等） |
| parentCompany | string | 母公司/品牌 |
| expired | boolean? | 是否过期 |

说明：JDS 的 jobs 以 **company_name** 与 companies 关联；若同一库内同时有 **company_id**，可按 id 做 `$lookup`。

---

### 2. hera_one 侧（hera.jobs + jobDatabaseService）

**当前 queryJobsWithFilters 已支持**：

- jobTitle → title/summary/description **regex**
- city → **locations** regex（注意：字段名是 `locations`，与 JDS 的 `location` 可能需映射）
- company → **company** regex
- platforms → source/platform/sourceType regex
- postedWithinDays → 日期过滤
- excludeIds → $nor 排除

**hera.jobs 文档中已有、可做筛选的字段**（见 MONGODB_STRUCTURE + transform 输出）：

- **industry**（string）
- **workMode**（string）
- employmentType / jobType（string）
- **skillsMustHave / skillsMust**（array）
- **skillsNiceToHave / skillsNice**（array）
- **skills**（array）
- **workRights**（object：country, requiresStatus, **sponsorship**: 'required'|'available'|'not_available'|'unknown'）
- experienceTag / seniority（string）
- is_active（已有）

注意：若 **hera.jobs 与 JDS 的 jobs 是同一套数据**（例如 JDS 写入后由 pipeline 同步到 hera，或反之），则需统一字段名（如 location vs locations、company_name vs company）。若 **两套数据**（JDS 一套、hera 一套），则需约定「搜索入口」用哪一套，或做聚合/双写。

---

## 二、目标搜索场景与实现方式

### 场景 1：按公司搜职位（与公司相关）

- **需求**：搜某公司下的所有职位。
- **现状**：hera_one 已支持 `company` regex；MCP 有 `search_jobs_by_company` / `jobs_at_company`，传 `company` + 可选 jobTitle、city。
- **增强**：
  - 若数据源是 **hera.jobs**：保持 `query.company = { $regex: options.company }` 即可；可同时支持 `company_name`（若存在）与 `company` 的 $or，提高命中率。
  - 若数据源包含 **JDS companies + jobs**：可按 `companies.name` 先查 company，再 `jobs.company_name` 或 `jobs.company_id` 过滤；或若 jobs 在 same DB 且仅有 company_name，直接 `jobs.company_name: regex(company)` 与现有一致。
- **建议**：在 `queryJobsWithFilters` 中对 `company` 同时匹配 `company` 与 `company_name`（$or），兼容两种字段。

---

### 场景 2：行业 + 职位 + 地点（特定行业 + job title + location）

- **需求**：例如「Technology 行业 + Software Engineer + Sydney」。
- **实现**：
  - **方式 A（仅 hera.jobs）**：  
    - jobTitle、city 已有；  
    - 新增 **industry** 参数：`query.industry = { $regex: options.industry, $options: 'i' }`（或等值，视存储格式）。
  - **方式 B（用 JDS companies 的 industry）**：  
    - 若 jobs 有 **company_id**：`$lookup` companies，再 `$match: { 'companyDoc.industry': regex }`；  
    - 若只有 company_name：先 `companies.find({ industry: regex })` 取 name 列表，再 `jobs.company_name: { $in: names }`。
- **建议**：  
  1）在 **hera.jobs** 上增加 **industry** 筛选（job 文档若有 industry 字段）；  
  2）若 hera.jobs 的 industry 来自 JDS companies，需在写入/同步时把 companies.industry 带到 job（冗余），避免每次 $lookup；  
  3）索引：`{ is_active: 1, industry: 1, updatedAt: -1 }` 或 `{ is_active: 1, locations: 1, industry: 1, updatedAt: -1 }`（按查询组合选建）。

---

### 场景 3：按技能搜（特定技能的职位）

- **需求**：例如「会 React、TypeScript 的职位」。
- **实现**：  
  - 新增参数 **skills**（string[] 或 string，多个技能可传数组）。  
  - 查询：在 **skillsMustHave / skillsNiceToHave / skills** 中至少一个数组包含任意一个技能（大小写不敏感）。  
  - Mongo：`$or: [ { skillsMustHave: { $in: regexArray } }, { skillsNiceToHave: { $in: regexArray } }, { skills: { $in: regexArray } } ]`，或对每个技能做 `$elemMatch` + regex；若技能是精确词，可用 `$in`。  
  - 注意：数组字段用 regex 时用 `{ $elemMatch: { $regex: ... } }`。
- **建议**：  
  - 入参：`skills?: string[]`（如 `['React','TypeScript']`）。  
  - 构建：对每个 skill 生成 `{ $or: [ { skillsMustHave: { $elemMatch: { $regex: skill, $options: 'i' } } }, ... ] }`，再 $and 组合（表示「包含任一技能」）或按需改为「包含全部技能」。  
  - 索引：若以技能为主筛，可考虑 `skillsMustHave: 1` 或 multikey index；若与 title/location 组合，再考虑复合索引。

---

### 场景 4：仅 H1B / 仅支持 sponsorship 的职位

- **需求**：只搜「支持 H1B」或「提供 sponsorship」的职位。
- **实现**：  
  - hera.jobs 的 **workRights** 结构：`{ country?, requiresStatus?, sponsorship?: 'required'|'available'|'not_available'|'unknown' }`。  
  - 「仅 H1B」可理解为：  
    - 要么职位明确写 H1B / sponsorship；  
    - 要么 `workRights.sponsorship === 'available'` 或 `'required'`（视业务含义：available = 可提供担保）。  
  - 新增参数：**sponsorshipOnly?: boolean** 或 **workRightsFilter?: { sponsorship?: 'available' | 'required' }**。  
  - 查询：  
    - `workRights.sponsorship: { $in: ['available', 'required'] }`；  
    - 或同时匹配 `workRights.requiresStatus` 含 "H1B"（若库里有存）；  
    - 若 workRights 在部分文档缺失，需明确是「必须有 workRights 且 sponsorship 匹配」还是「无 workRights 的也显示」——通常取前者。
- **建议**：  
  - 入参：`sponsorshipOnly?: boolean`（true 时只返回 sponsorship 为 available/required 的职位）。  
  - 查询：`query['workRights.sponsorship'] = { $in: ['available', 'required'] }`；若需兼容 H1B 文案，可再加 `$or` 对 description/summary 做一次 regex（如 /H1B|sponsorship/i），与 workRights 二选一或同时用。  
  - 索引：`'workRights.sponsorship': 1` 或复合 `{ is_active: 1, 'workRights.sponsorship': 1, updatedAt: -1 }`。

---

## 三、统一查询层设计（queryJobsWithFilters 扩展）

在 **不破坏现有 MCP/推荐逻辑** 的前提下，扩展 `queryJobsWithFilters` 的 options，并保持向后兼容：

```ts
// 建议新增的 options（与现有并存）
export async function queryJobsWithFilters(options: {
  // ========== 已有 ==========
  jobTitle?: string;
  city?: string;
  company?: string;
  postedWithinDays?: number;
  platforms?: string[];
  page?: number;
  pageSize?: number;
  excludeIds?: string[];

  // ========== 新增（多维度） ==========
  industry?: string;              // 行业（job.industry 或来自 companies）
  skills?: string[];              // 技能关键词，命中 skillsMustHave/skillsNiceToHave/skills 任一即可
  skillsMatchAll?: boolean;       // 默认 false：命中任一技能即可；true：需命中全部
  workMode?: string;              // Remote | Hybrid | On-site（等值或 regex）
  employmentType?: string;        // Full-time | Part-time | Contract 等
  sponsorshipOnly?: boolean;      // true：仅 workRights.sponsorship in ['available','required']
  companyIds?: string[];          // 可选：按 companies._id 筛（若 job 有 company_id）
}) { ... }
```

**Query 构建要点**（与现有 query 用 $and 组合）：

1. **industry**：若存在则 `query.$and.push({ industry: { $regex: options.industry, $options: 'i' } })`（或等值）。
2. **skills**：对 options.skills 建子条件（每个技能在 skillsMustHave/skillsNiceToHave/skills 中 $elemMatch regex），用 $or 包起来；若 skillsMatchAll 为 true，则每个技能一个 $or 子句，整体用 $and 连接。
3. **workMode / employmentType**：`query.workMode = { $regex: options.workMode, $options: 'i' }`，employmentType 同理（注意字段名 job 里可能是 employmentType 或 jobType）。
4. **sponsorshipOnly**：`query['workRights.sponsorship'] = { $in: ['available', 'required'] }`。
5. **company**：保持现有；可选同时支持 `company_name`（$or company + company_name）。
6. **companyIds**：若 job 有 company_id，`query.company_id = { $in: options.companyIds.map(id => new ObjectId(id)) }`。

**JDS 与 hera 数据统一**：

- 若 **JDS 与 hera 共用同一 MongoDB** 且 jobs 同时被 JDS 和 pipeline 写入：需统一 schema（例如 locations vs location、company_name 与 company 并存），查询时用 $or 兼容。
- 若 **JDS 是独立库**：当前 hera_one 只连 hera 库；要「搜 JDS 的 jobs」需在 hera_one 内加一套连接/读 JDS 的逻辑，或通过单独服务聚合，再在 MCP 层选择数据源。建议先以 **hera.jobs 为主**，在 hera.jobs 上实现上述维度；若后续要接 JDS，再抽象一层「搜索数据源」。

---

## 四、MCP / 推荐入口如何透传

- **recommend_jobs**：目前只传 jobTitle、city、page、pageSize、excludeIds。若希望推荐也支持「行业、技能、仅 H1B」：  
  - 在 MCP 的 recommend_jobs 的 arguments 中增加可选字段：industry、skills、sponsorshipOnly 等；  
  - 在调用 `queryJobsWithFilters` 时传入这些字段。
- **search_jobs_by_company / jobs_at_company**：已传 company、jobTitle、city；可增加 industry、skills、sponsorshipOnly 等，与上面一致。
- **list_jobs**（若有）：同样透传上述可选参数。

这样既保留「简单推荐」的现有行为，又支持「多维筛选」的进阶用法。

---

## 五、索引建议（简要）

在 **hera.jobs** 上，按使用频率可考虑：

| 用途 | 建议索引 |
|------|----------|
| 行业 + 时间 | `{ is_active: 1, industry: 1, updatedAt: -1 }` |
| 技能（多关键词） | `{ skillsMustHave: 1 }` 或 multikey（Mongo 自动） |
| sponsorship | `{ is_active: 1, 'workRights.sponsorship': 1 }` 或含 updatedAt |
| 公司 + 时间 | `{ is_active: 1, company: 1, updatedAt: -1 }`（若按公司名查多） |

与现有 `locations`、`updatedAt`、`is_active` 组合时，按实际查询形状再微调（避免过多索引影响写性能）。

---

## 六、实施顺序建议

| 顺序 | 内容 | 说明 |
|------|------|------|
| 1 | 在 queryJobsWithFilters 中增加 **industry**、**skills**、**sponsorshipOnly**、**workMode**、**employmentType** | 最小改动，只扩 options 和 query 构建 |
| 2 | 公司筛同时支持 **company** 与 **company_name** | 兼容 JDS 与 hera 两种字段 |
| 3 | MCP recommend_jobs / search_jobs_by_company 透传上述新参数 | 前端/GPT 可传 industry、skills、sponsorshipOnly 等 |
| 4 | 在 Atlas 上为 industry、workRights.sponsorship、skills 等建合适索引 | 根据 1–3 的查询形状建 |
| 5 | 若需「按 companies 表 industry 筛」且 job 无 industry 字段 | 写同步脚本把 companies.industry 冗余到 job，或做 $lookup 查询（并评估性能） |

---

## 七、小结

- **JDS**：companies（name, industry, size, location 等）+ jobs（company_name, company_id, title, location, employmentType, workMode 等）；关联键为 **company_name** 或 **company_id**。
- **hera_one**：当前已支持 jobTitle、city、company、platforms、postedWithinDays；可扩展 **industry、skills、sponsorshipOnly、workMode、employmentType**，并兼容 **company_name**。
- **四种场景**：  
  1）按公司 → 已有，可加强 company_name；  
  2）行业+职位+地点 → 加 industry；  
  3）按技能 → 加 skills（数组 + $elemMatch/regex）；  
  4）仅 H1B/sponsorship → 加 sponsorshipOnly，用 workRights.sponsorship。

按上述顺序在 hera_one 的 `jobDatabaseService.queryJobsWithFilters` 和 MCP 中落地即可覆盖「尽可能多搜索维度」的目标；若你提供 JDS 与 hera 是否同库、job 是否同时有两套写入，可以再细化「companies 行业」是写进 job 还是用 $lookup」的取舍。
