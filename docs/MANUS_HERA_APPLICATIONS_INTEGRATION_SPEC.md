# Manus–Hera Applications 集成说明（供 Manus 对齐与确认）

本文档说明 Hera 侧已做的改动、与 Manus 的对接方式、以及需要 Manus 回传或确认的项。**请 Manus 阅读后对「待确认」项给出反馈，以便推进实现。**

---

## 一、Hera 本轮整体改动摘要

### 1. 数据模型（profile.applications）

每条申请记录包含：

| 字段 | 含义 | 来源 |
|------|------|------|
| `jobId` | 职位 ID | 必填，唯一标识 |
| `jobSave` | `{ title, company }` 职位摘要 | 主站 / Manus 回传 |
| `resumeTailor` | 定制简历（gridfsId, downloadUrl） | Hera tailor_resume 或主站生成 |
| `coverLetter` | 定制 cover letter | 主站生成或后续扩展 |
| `applicationStatus` | 申请状态 | 见下 |
| `appliedVia` | 完成渠道 | **Manus 回传** 或主站 |
| `hiringStatus` | 招聘阶段 | 主站或后续 Manus |
| `applicationStartedBy` | 谁发起「开始申请」 | **Manus 回传** 或主站 |
| `createdAt` / `updatedAt` | 时间戳 | 服务端 |

- **applicationStatus** 现简化为两项：`Application Submitted` | `Application Failed`。
- **appliedVia**：`'manus'` \| `'hera_web'`，表示最终提交是通过 Manus 还是主站。
- **applicationStartedBy**：`'manus'` \| `'hera_web'`，表示是谁发起的「开始申请」；主站用此显示绿色「Application Started」。
- **hiringStatus**：如 Pending、Interviewing – Round 1/2/Final、Offer Received、Rejected、Accepted 等，用于 Offer/面试阶段。

### 2. 主站 Applications 页面（/applications）

- **用途**：用户查看自己的申请列表（ATS），每条记录对应一个职位。
- **数据**：列表行来自用户「已保存职位」（主站）+ 与 `profile.applications` 按 `jobId` 合并；每条行的状态/渠道等来自 MongoDB。
- **七列**：
  1. **Job Title + Company**：职位标题与公司（含平台标签 Corporate Direct / Public Sector）。
  2. **Job Details**：打开职位详情弹窗。
  3. **Apply Link**：跳转外部申请链接。
  4. **Start Application**：  
     - 若 `applicationStartedBy === 'manus'` → 绿色「Application Started」；  
     - 否则 → 橙色「Start Application」。
  5. **Tailor Application**：有定制简历/cover letter 则绿色「View Tailored Application」，否则橙色「Tailor Application」。
  6. **Application Status**：下拉，仅两项——Application Submitted / Application Failed。
  7. **Hiring Status**：下拉，面试/Offer 阶段（Pending、Interviewing – Round 1/2/Final、Offer Received、Rejected、Accepted 等）。
- **右侧**：My Resume（profile 中的简历列表）、Historical Search（jobSearches 历史搜索）。

**说明**：当前列表行依赖主站「已保存职位」。若未来 Manus 侧产生的申请（仅写入 profile.applications）也要在页面上显示，需要约定：要么 Manus 回传时同时写入/同步「保存职位」，要么 Hera 改为「列表以 profile.applications 为主、再合并 saved jobs」。这部分可后续与 Manus 对齐。

### 3. 后端与 MCP

- **upsertJobApplication**：支持上述所有字段（含 `appliedVia`、`hiringStatus`、`applicationStartedBy`）。
- **GET /api/profile/upsert-application**：主站用，Body 支持 `applicationStatus`、`appliedVia`、`hiringStatus`、`applicationStartedBy`。
- **MCP**：  
  - `get_user_applications`：返回该用户的 `profile.applications`（含上述新字段）。  
  - `prepare_application_context`：按 `user_email` + `job_id`（或 application_id）返回职位与用户上下文、resume_url 等，供 Manus 发起申请；**当前未**在 prepare 时写入 `applicationStartedBy`，可后续增加。  
  - `record_apply_result`：**仅在 tools 列表中有名称与描述，handler 尚未实现**；计划由 Manus 在投递结束时调用，写入 `applicationStatus` + `appliedVia: 'manus'`。

---

## 二、需要 Manus 回传的内容（与 application 的对应关系）

以下行为会写入或更新 `profile.applications`，并在主站 Applications 页体现。

| 用户行为 / 时机 | 建议 Manus 调用 | 写入/更新字段 | 在主站 Applications 页的体现 |
|-----------------|-----------------|----------------|------------------------------|
| 用户表达兴趣（如「show me more #3」「show details of #5」） | 使用现有 **refine_recommendations**（liked_job_ids / liked_indexes）；可选：新增「记录兴趣」类接口 | 若 Hera 将「兴趣」视为 JobSaved：则 upsert 一条 application，仅设 `jobSave: { title, company }`（或再标记为「感兴趣」状态） | 出现一行该职位；Start Application 仍为橙色，直至「开始申请」被回传 |
| 用户明确「先投 A 再投 B」等（选定要投的职位） | 同上或专用「记录选定申请」接口 | 同上，确保这些 job_id 在 profile.applications 中有记录（jobSave） | 同上 |
| 用户明确不要某职位（排除） | 使用 **refine_recommendations** 的 disliked；**待确认**：是否需要在 Applications 支持「删除」 | **待确认**：Hera 是否从 profile.applications 中删除该条，或仅标记「已排除」 | 若支持删除，则主站该行可移除或置灰 |
| 开始对某职位执行申请（含 bulk 中每一个） | **prepare_application_context** 或新接口「记录开始申请」 | `applicationStartedBy: 'manus'`（及 jobSave 若尚无） | 该行「Start Application」变为绿色「Application Started」 |
| 单次/单个职位投递结束（成功或失败） | **record_apply_result**（Hera 实现 handler 后） | `applicationStatus`（如 submitted/failed）、`appliedVia: 'manus'` | Application Status 与「通过 Manus 投递」可展示 |

- **jobSave**：来源于主站或 Manus 回传；只要 Hera 侧有 `jobId` + `jobSave`（title, company），主站即可在列表中展示标题与公司。
- **简历 / 定制简历**：可由 Hera 的 tailor_resume 或主站生成后写入 `resumeTailor`；Manus 若在「开始申请」前需要简历，可走 **prepare_application_context** 拿 `resume_url`，或先用 Manus 内置生成，没有再用 Hera 的（见下「流程」）。

---

## 三、用户流程简述（从表达到投递完成）

1. **首次搜索 / 推荐**  
   - Manus 调 **recommend_jobs**（或 search_jobs），Hera 返回 job list + job details。  
   - 后续推荐可调 **refine_recommendations**（exclude_ids、liked/disliked），用于「show me more」「show details of #x」等；这些行为在 Hera 侧会用于 refine 逻辑与偏好记录。

2. **表达兴趣 → 视为 JobSaved**  
   - 用户说「show me more #3」「show details of #5」：建议 Manus 用 **refine_recommendations** 传 liked_job_ids / liked_indexes。  
   - Hera 可将这些「感兴趣」的 job_id 视为 JobSaved：即对每个 such job_id 做一次 upsert 到 profile.applications（仅 jobSave，无 applicationStartedBy）。  
   - **待 Manus 确认**：是否同意「兴趣 = JobSaved」且由 Hera 在 refine 或单独接口中写 application；以及「用户明确不要」时是否需要在 Applications 支持删除。

3. **选定要投的职位（含「先投 A 再投 B」）**  
   - 同样视为 JobSaved，即确保这些职位在 profile.applications 中有记录（jobSave）。  
   - 若用户说「不要 #x」，则 disliked 进 refine；是否从 applications 删除，见上「待确认」。

4. **至少一轮 50 条推荐 + 用户已提供简历 → 询问是否 bulk apply**  
   - 用户用编号选职位（如「投 1、3、5」或「投 51、52、55」）。  
   - **编号规则**：第一轮推荐 1–50，第二轮 51–100，以此类推，避免多轮推送时编号重复。  
   - **待 Manus 确认**：多轮推荐时是否由 Manus 侧保证 51–100 的编号展示与传参（如 job_id 或 index），以及 bulk 时是否用 map/并行方式调 Hera 接口。

5. **开始申请（每个职位）**  
   - 在真正开始填表/投递前，Manus 调 **prepare_application_context**（或专用「记录开始申请」）。  
   - Hera 写入/更新该 job 的 application：`applicationStartedBy: 'manus'`（及 jobSave 若尚无）。  
   - **待 Manus 确认**：是否在「开始申请」前统一向用户收集简历与基本问题（Hera 可提供清单）；若无简历，是否优先 Manus 内置生成，没有再用 Hera 的 tailor/generate。

6. **验证与提交**  
   - 不同职位验证时机不同（有的在前有的在后）。  
   - 当 Manus 确认某职位已「提交成功」或「明确失败」时，调 **record_apply_result**（Hera 实现后）：传 job_id、application_status（submitted/failed）、applied_via=manus。  
   - Hera 更新该条 application 的 `applicationStatus` 与 `appliedVia: 'manus'`，主站 Applications 页即可展示状态与渠道。

---

## 四、Hera 现有 Applications 页面说明（供 Manus 参考）

- **URL**：`/applications`（主站）。
- **列表**：每行一个职位，来自用户在主站保存的职位列表，并与 `profile.applications` 按 `jobId` 合并。
- **每行七列**：Job Title + Company；Job Details（详情）；Apply Link（外链）；Start Application（根据 `applicationStartedBy` 显示绿色「Application Started」或橙色「Start Application」）；Tailor Application（查看/去做定制）；Application Status（已提交/失败）；Hiring Status（面试/Offer 阶段）。
- **数据来源**：  
  - 列表行：当前为主站「已保存职位」。  
  - 状态与渠道：来自 `profile.applications`（含 Manus 回传的 `applicationStartedBy`、`appliedVia`、`applicationStatus` 等）。
- **与 Manus 的衔接**：Manus 通过回传「兴趣/选定」「开始申请」「投递结果」，使同一用户在 Hera 主站打开 Applications 时能看到一致的状态；若 Manus 侧也展示申请列表，可调 **get_user_applications** 与 Hera 保持一致。

---

## 五、待 Manus 确认的项（请逐条回复）

1. **兴趣 = JobSaved**  
   - 是否同意：用户「show me more #x」「show details of #x」或选定要投的职位时，Hera 在 profile.applications 中写入/更新该 job（jobSave），视为 JobSaved？  
   - 若同意，Manus 是否会在这些时机调 refine_recommendations（liked）或单独「记录兴趣/选定」接口？

2. **「用户明确不要」的删除**  
   - 是否需要在主站 Applications 页支持「删除某条申请记录」？  
   - 若需要，Hera 可增加从 profile.applications 中移除该 job 的接口与前端删除按钮。

3. **Bulk apply 编号**  
   - 多轮推荐时，第二轮是否采用 51–100、第三轮 101–150 的编号规则？  
   - Bulk 时 Manus 是否会用 map/并行方式对每个选中职位调 Hera 的 prepare/record 接口？

4. **开始申请前的收集**  
   - 是否在「开始申请」前统一问用户：简历 + 若干基本问题（Hera 可提供清单）？  
   - 若用户没有简历：是否优先用 Manus 内置生成，没有再用 Hera 的 tailor/generate？

5. **record_apply_result 的入参**  
   - 投递结束时，Manus 是否可提供：`user_email`、`job_id`、`application_status`（如 `submitted` / `failed`）、`applied_via: 'manus'`？  
   - 若有额外字段（如备注、失败原因）需求，请说明。

6. **列表数据源**  
   - 仅由 Manus 侧产生的申请（用户从未在主站保存该职位），是否需要在 Hera 主站 Applications 页显示？  
   - 若需要，请确认：由 Hera 改为「列表以 profile.applications 为主」或由 Manus 在回传时同时写入某种「保存职位」同步。

---

## 六、Hera 侧下一步（待 Manus 回复后推进）

1. 实现 **record_apply_result** 的 MCP handler：根据 Manus 传入的 `user_email`、`job_id`、`application_status`、`applied_via` 更新 profile.applications。  
2. 视 Manus 确认结果，在 **prepare_application_context** 被调用时顺带写入 `applicationStartedBy: 'manus'`（及 jobSave 若尚无）。  
3. 若采用「兴趣 = JobSaved」：在 refine_recommendations（liked）或新接口中，对 liked 的 job_id 做 upsert application（仅 jobSave）。  
4. 若确认需要「删除」：增加从 profile.applications 删除指定 job 的接口与主站删除能力。  
5. 若确认列表需包含仅 Manus 产生的申请：调整主站 Applications 列表数据源或与 Manus 约定「保存职位」同步方式。

请 Manus 对上述「待确认」项回复后，我们再按约定实现与联调。

---

## 七、Manus 确认结果（已对齐，2025-03）

| 项 | Manus 确认 | Hera 需做 |
|----|------------|-----------|
| **1. 兴趣 = JobSaved** | ✅ 同意。Manus 调 refine_recommendations（liked_job_ids / liked_indexes），不额外调单独接口。 | 在 refine_recommendations 的 liked 分支里，对这些 job_id 做 upsert 到 profile.applications（仅 jobSave: { title, company }）。 |
| **2. 删除能力** | ✅ 需要，轻量即可。用户说「不要 #x」时 Manus 传 disliked_job_ids。 | 对 profile.applications 中对应 job_id 做**软删除**：标记 `excluded: true`，不硬删。主站列表不显示或置灰 excluded 记录；不需额外删除按钮。 |
| **3. Bulk 编号** | ✅ 第一轮 1–50，第二轮 51–100，第三轮 101–150；Manus 维护 job_id ↔ 编号；bulk 时 map 并行调 prepare_application_context，再逐一 record_apply_result。 | 无需 Hera 改动。 |
| **4. 开始申请前收集** | ✅ 统一收集。简历优先级：优先 Hera tailor_resume（按 JD 定制）→ 失败/超时则用户上传的原始简历 → 最后才 Manus 内置生成。基本问题由 Hera 提供清单，Manus 一次性收集后复用到所有职位。 | Hera 提供「开始申请前基本问题」清单给 Manus。 |
| **5. record_apply_result** | ✅ 可提供 user_email、job_id、application_status、applied_via。建议 Hera 增加 **failure_reason**（可选，string），failed 时填如 "email_verification_timeout"、"form_field_missing"、"captcha_blocked"。 | 实现 record_apply_result 的 MCP handler，支持 failure_reason 字段并写入 profile.applications（或单独字段/备注）。 |
| **6. 列表数据源** | ✅ 建议 Hera 改为「列表以 profile.applications 为主，再合并 saved jobs」。Manus 不回写「保存职位」，避免副作用。 | 主站 /applications 列表数据源改为：以 profile.applications 为主（有记录即显示），再与 saved jobs 合并去重展示。 |

**简历优先级（Manus 执行顺序）**：Hera tailor_resume（按 JD）→ 用户原始简历 → Manus 内置生成。

**Hera 实现清单（按 Manus 确认推进）**  
1. refine_recommendations：liked 时 upsert application（仅 jobSave）；disliked 时对对应 application 设 `excluded: true`（需在 profile.applications 增加字段 `excluded?: boolean`）。  
2. prepare_application_context：被调用时顺带 upsert application（jobSave + applicationStartedBy: 'manus'）。  
3. record_apply_result：实现 MCP handler，入参 user_email、job_id、application_status、applied_via、failure_reason（可选），写 applicationStatus、appliedVia、failure_reason。  
4. Applications 列表：数据源改为以 profile.applications 为主，过滤 excluded，再与 saved jobs 合并展示。  
5. 提供「开始申请前基本问题」清单（文档或接口返回）。
