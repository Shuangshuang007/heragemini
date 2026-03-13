# Manus 轻量投递事件方案（自然收集，非编排）

> 目标：不造重的 application_intent / 编排中心，而是**在自然流程里收集**——谁搜了什么、准备投什么、最终是否投成、通过谁投成。Manus 在关键节点回传，Hera 用最少接口承接。

---

## 一、要记录哪些事件（三类）

| 事件 | 含义 | 数据落点（沿用现有） |
|------|------|----------------------|
| **Search** | 用户发起了职位搜索（搜了什么） | `profile.jobSearches[]`（已有 `addJobSearchToProfile`） |
| **Preparation** | 用户选定职位、准备投递（准备投什么） | `profile.applications[]` 一条记录，含 `jobSave`（title, company），可选 `applicationStatus: 'preparing'` |
| **Result** | 最终投递结果：成功 / 失败（有没有投成 + 通过谁） | 更新同一条 `profile.applications[]`：`applicationStatus: 'submitted'|'failed'`，新增字段 `appliedVia: 'manus'|'hera_web'` |

不做单独的「申请编排表」或 application_id 中心；全部落在现有 **profile.jobSearches** 和 **profile.applications** 上，只补一个字段 `appliedVia` 表示渠道。

---

## 二、Manus 在哪些节点回传

- **Search**  
  - **不要求 Manus 多调一个接口**。  
  - 当 Manus 调我们的 **recommend_jobs** 时，若带了 `user_email` 且带了搜索条件（如 `job_title` 或 `city`），**Hera 在 recommend_jobs 内部**顺带调用 `addJobSearchToProfile`，记一条 search。  
  - 这样「用户通过 Manus 搜了什么」自然被记录，无需 Manus 改流程。

- **Preparation**  
  - 当用户在 Manus 里**选定某个职位、表示要投递**（或 Manus 创建 apply task 之前/之时），Manus 调我们一个**轻量接口**：例如「记录准备投递」：`user_email` + `job_id` + 职位摘要（title, company）。  
  - Hera 只做：`upsertJobApplication(email, jobId, { jobSave: { title, company }, applicationStatus: 'preparing' })`（或仅 jobSave，不强制 status）。  
  - 不创建 application_id，不建新表，不排队。

- **Result**  
  - 当 Manus 端**完成一次投递任务**（成功提交或明确失败）时，Manus 调我们一个**轻量接口**：例如「上报投递结果」：`user_email` + `job_id` + `status: 'submitted'|'failed'` + `channel: 'manus'`。  
  - Hera 只做：`upsertJobApplication(email, jobId, { applicationStatus, appliedVia: 'manus' })`。  
  - 这样「有没有投成、通过谁投成」都落在同一套 profile 数据里，主站 ATS 和 `get_user_applications` 直接可见。

---

## 三、Hera 最少需要哪些接口来接回传

| 能力 | 现状 | 需要做的 |
|------|------|----------|
| **Search 记录** | 已有 `addJobSearchToProfile`；主站搜索通过 `record-job-search` 已写 jobSearches | 在 **MCP recommend_jobs** 内部：若请求带 `user_email` 且带 `job_title` 或 `city`，顺带调 `addJobSearchToProfile`，写入一条 jobSearches。无需新接口。 |
| **Preparation 记录** | 已有 `upsertJobApplication`，可写 jobSave / applicationStatus | 新增一个**极简**接口（HTTP 或 MCP 工具二选一或都支持）：例如 `record_application_preparation`：入参 `user_email`, `job_id`, `job_snapshot: { title, company }`；内部只调 `upsertJobApplication(email, jobId, { jobSave })`。 |
| **Result 记录** | 已有 `upsertJobApplication`，可写 applicationStatus；暂无 appliedVia | 1）在 profile.applications 的 schema 和 `upsertJobApplication` 里增加 `appliedVia?: 'manus'|'hera_web'`；2）新增一个**极简**接口：例如 `record_apply_result`：入参 `user_email`, `job_id`, `status: 'submitted'|'failed'`, `channel: 'manus'`, 可选 `note`；内部只调 `upsertJobApplication(..., { applicationStatus, appliedVia })`。 |

即：  
- **0 个新接口** 给 Search（在 recommend_jobs 里顺带写）。  
- **1 个新接口** 给 Preparation：`record_application_preparation`。  
- **1 个新接口** 给 Result：`record_apply_result`。  

若希望 Manus 用 MCP 统一调用，可把这两个做成 MCP tools；若 Manus 更习惯 HTTP，可再包一层 POST（如 `/api/manus/record-preparation`, `/api/manus/record-apply-result`），内部调同一套 service。

---

## 四、如何让这套记录最终能反映你要的四个问题

- **用户搜了什么**  
  - 来自 `profile.jobSearches`。  
  - Manus 调 recommend_jobs 时我们顺带写；主站搜索继续走现有 record-job-search。  

- **用户准备投什么**  
  - 来自 `profile.applications` 里带 jobSave（且可选 applicationStatus 为 preparing 或未设）。  
  - Manus 在用户选职位/创建 apply 任务时调 `record_application_preparation` 即可。  

- **用户最终有没有投成**  
  - 来自同一条 application 的 `applicationStatus`：`submitted` | `failed` 等。  
  - Manus 在任务结束时调 `record_apply_result` 更新。  

- **通过谁投成**  
  - 来自同一条 application 的 `appliedVia`：`'manus'` | `'hera_web'`。  
  - 同上，由 `record_apply_result` 写入 `channel`/`appliedVia`。

主站 ATS（applications 页）和现有 **get_user_applications** 都读同一份 `profile.applications`（加 jobSearches 可选），因此无需两套数据，也不做「编排层」。

---

## 五、Manus「什么时候回传」怎么实现、以及你提到的「我们做成接口让 Manus 有意愿回传」

- **时间点**  
  - **Preparation**：在 Manus 侧「用户选定这个职位要投」或「创建 Apply Task 时」调我们一次 `record_application_preparation`。  
  - **Result**：在 Manus 侧「Apply Task 结束（成功提交 or 明确失败）」时调我们一次 `record_apply_result`。  
  - 实现方式只有一种：**Manus 在各自节点主动调我们**。Manus 官方 Webhook 是「他们发事件给外部」，若他们支持在 task 完成时触发 webhook，也可以由 Manus 后端在收到 webhook 后再调我们 `record_apply_result`，本质仍是「Manus 在合适时机调 Hera 接口」。

- **让 Manus 有意愿回传**  
  - 主站已有「用户搜了什么、投了什么、状态如何」的 ATS 能力（jobSearches + applications）。  
  - 若把这份能力**以接口形式对 Manus 开放**（例如现有/扩展的 **get_user_applications** 或单独 **get_user_activity**），返回：`jobSearches` + `applications`（含 applicationStatus、appliedVia），则：  
    - Manus 可以在其产品里展示「用户在 Hera 的搜索与投递历史」；  
    - 用户会期望在 Hera 主站或 Manus 里看到「我刚通过 Manus 投的，状态也是 submitted」。  
  - 这样 **Manus 有动机在投递结束时回传 result**：否则用户看到的数据不同步，体验差。  
  - 建议：  
    1. **get_user_applications**（或等价 MCP tool）返回里**带上 jobSearches**（以及 applications 的 appliedVia），让 Manus 能完整展示「搜了什么 + 投了什么 + 状态 + 渠道」。  
    2. 文档里写清楚：若 Manus 在用户完成投递后调用 `record_apply_result`，同一用户再次拉取时会看到最新状态，这样 Manus 端展示与 Hera 主站一致。  

这样「回传时机」= Manus 在自然流程的两个节点（准备投、投完）各调我们一次；「有意愿」= 我们提供「可随时打开看」的查询接口 + 说明回传后数据一致，由 Manus 产品需求驱动他们调用。

---

## 六、与现有 MCP / 主站的关系（不打架）

- **create_application_intent / prepare_application_context**  
  - 若暂时保留：可仅用于「Manus 需要拿单次投递上下文（prompt_snippet、job_snapshot、resume_url）」的场景，**不再作为「记录」的来源**。  
  - 记录只走：recommend_jobs 顺带 search、`record_application_preparation`、`record_apply_result`。  
  - 若后续希望彻底轻量化，也可以让 Manus 只调「拿上下文」的接口（例如保留 prepare_application_context 的**只读**能力），而**不再要求**先 create_application_intent；准备/结果记录一律走上述两个轻量接口。

- **主站 ATS**  
  - 继续用 `profile.applications` + `profile.jobSearches`；主站「记录投递」可写 `appliedVia: 'hera_web'`。  
  - 无需新表、无需编排表。

---

## 七、小结（可直接落地的清单）

1. **事件**：只做三类——Search（顺带）、Preparation、Result；都落在 profile 现有结构上，仅 applications 增加 `appliedVia`。  
2. **Manus 回传节点**：搜推荐时我们内部记 search；用户选职位/创建 apply 时 Manus 调 preparation；任务结束时 Manus 调 result。  
3. **Hera 最少接口**：recommend_jobs 内写 jobSearches；新增 `record_application_preparation`、`record_apply_result`（MCP 或 HTTP 或两者）；扩展 `get_user_applications`（或等价）返回 jobSearches + appliedVia，便于 Manus 展示并激励回传。  
4. **「何时回传」**：由 Manus 在准备投、投完两个时间点主动调我们；我们通过「可随时查的接口」+ 文档说明，让 Manus 有动力在完成后调用 result 接口，保证数据一致。

这样即可在不做重编排的前提下，自然收集「搜了什么、准备投什么、有没有投成、通过谁投成」，并与主站 ATS 共用同一套数据。
