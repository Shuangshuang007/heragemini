# 完整用户流程审阅与现有逻辑映射

> 按「完整用户流程」审阅现有 MCP、主站 ATS、Resume/Tailor 逻辑，只做 review 与 mapping，不写代码、不重写编排。

---

## 一、按完整用户流程的梳理结果

以下用「流程步骤 → 现有有无 → 落在哪里」对照。

### 1. Search / Recommend（含 refine、来回穿插）

| 能力 | 现有有无 | 落在哪里 |
|------|----------|----------|
| 用户搜索职位 | ✅ 有 | **主站**：Jobs 页调用 mirror-jobs，jobFetchService 里若带 userEmail 会调 `/api/profile/record-job-search` → `addJobSearchToProfile`，写入 `profile.jobSearches[]`。 |
| Hera 推荐职位 | ✅ 有 | **MCP**：`recommend_jobs`（user_profile / job_title / city / session_id / exclude_ids 等），返回推荐列表 + meta（returned_job_ids, profile_stage）。 |
| MCP 推荐时是否记录「用户搜了什么」 | ❌ 无 | **MCP 的 recommend_jobs 内部没有调** `addJobSearchToProfile`。即 Manus/ChatGPT 调推荐时，不会自动写 jobSearches。 |
| Follow-up / 更多 / 排除 | ✅ 有 | **MCP**：`refine_recommendations`（session_id, exclude_ids, liked_job_ids, disliked_job_ids / liked_indexes, disliked_indexes），排除已展示 + 按喜欢/不喜欢调偏好，再查一批。 |
| 历史「已展示 / 喜欢 / 不喜欢」持久化 | ✅ 有 | **MCP**：`feedback_events` 集合（session_id, user_email, tool, returned_job_ids, feedback.liked_jobs, feedback.disliked_jobs）；AgentKit Memory 可选存 shown_job_ids。recommend_jobs / refine 都会写 feedback_events。 |

小结：搜索 + 推荐 + refine 全链路都有；**缺口**是「MCP 推荐时顺带写 jobSearches」没有做。

---

### 2. Interested（表达兴趣 / waitlist）

| 能力 | 现有有无 | 落在哪里 |
|------|----------|----------|
| 用户对某些职位「感兴趣」的持久状态 | ⚠️ 半有 | **Profile 层**：没有单独的 `interested` 或 waitlist 表/字段。**feedback_events** 里有 liked_job_ids，但是**按 session 的反馈**，用于 refine 下一批推荐，不是「用户长期感兴趣的职位列表」。 |
| 主站「收藏/感兴趣」 | ⚠️ 混在 saved | **主站**：Jobs 页有「保存到 MongoDB」= `upsert-application` 只写 jobSave（title, company），不写 applicationStatus；Applications 页的「Saved Jobs」来自 localStorage 的 savedJobs **加上** profile.applications。所以「保存」≈ 进了 applications 一条记录（有 jobSave），没有单独「interested」状态。 |

小结：**Interested 没有独立概念**；要么用 feedback_events 的 liked（会话级），要么用「保存到 applications + jobSave」当「对这份工作有意」的近似。

---

### 3. Selected for application（明确选中一个或多个职位准备申请）

| 能力 | 现有有无 | 落在哪里 |
|------|----------|----------|
| 用户选中职位「要申请」 | ✅ 有 | **主站**：点 Tailor Resume 或 Save 时 `upsert-application`(email, jobId, jobSave)；**MCP**：`create_application_intent`(user_email, job_id) 在 `apply_applications` 表插一条（重的一层）。两者都能表示「用户选了这份工」。 |
| 一次选多个职位 | ✅ 数据模型支持 | **profile.applications[]** 可存多条（每条一个 jobId）。主站 Jobs 页可多选后「保存到 MongoDB」循环 upsert。**create_application_intent** 是单 job 单次调用，要 N 个就调 N 次。 |
| 和「仅感兴趣」区分 | ❌ 不区分 | 没有字段区分「仅感兴趣」vs「已选准备申请」。当前要么只有 jobSave（主站保存），要么还有 applicationStatus（主站 Applications 页下拉：not-applied / applied / …）。 |

小结：**Selected for application 本质已有**：applications 里一条记录 + jobSave 即「选了这份工」；多选靠多条 applications 或多次 intent。缺的是与「interested」的显式区分（若产品需要）。

---

### 4. Resume decision（有简历是否 tailor / 无简历是否生成）

| 能力 | 现有有无 | 落在哪里 |
|------|----------|----------|
| 针对某职位 tailor 简历 | ✅ 有 | **MCP**：`tailor_resume`（job_id, user_email, resume_content, user_profile, …）→ 主站 highlights API 或 GPT tailor → 结果写 `profile.applications[].resumeTailor`。**主站**：Jobs 页「Tailor Resume+」→ TailorPreview → `/api/generate-resume`(jobId) → 同上写 resumeTailor。 |
| 无简历时「生成简历」 | ⚠️ 仅主站 | **主站**：Profile 页用户填表 + 可选上传 → 拼成 resumeData → `/api/generate-resume`(无 jobId) → 写 `profile.resumes[]`。**MCP**：没有 `generate_resume` 或「从 profile 生成简历」的 tool，只有 tailor_resume（需已有 resume 内容或 profile）。 |
| Cover letter | ✅ 有 | 主站有 cover letter 生成/PDF；`profile.applications[].coverLetter` 可存；MCP 没有单独的 cover_letter tool（设计里有提，未实现）。 |
| Manus 是否默认不 tailor | - | 产品侧约定问题；技术上 Manus 可调 tailor_resume，也可不调。 |

小结：**Tailor 主逻辑在 Hera**，MCP 与主站共用；**从零生成简历**只在主站有闭环，MCP 未暴露。

---

### 5. Auto apply（开始自动投递）

| 能力 | 现有有无 | 落在哪里 |
|------|----------|----------|
| Hera 执行自动投递 | ❌ 无 | 我们不做「打开浏览器/填表/点提交」；由 Manus 执行。 |
| 为一次投递准备上下文 | ✅ 有 | **MCP**：`prepare_application_context`(user_email, job_id 或 application_id) → 返回 prompt_snippet, job_snapshot, submit_policy, resume_url 等，供 Manus Create Task 用。 |
| 批量「准备投递」的轻量记录 | ⚠️ 仅重路径 | 重路径：`create_application_intent` 每 job 一条在 apply_applications。轻路径：主站/MCP 直接 `upsertJobApplication`(jobSave) 即「准备投递」记录，无 intent 表。 |

小结：**Auto apply 执行在 Manus**；Hera 只做「准备上下文」和「记录谁选了哪些工」（profile 或 intent 二选一）。

---

### 6. Verification（验证码 / MFA / 最终确认等）

| 能力 | 现有有无 | 落在哪里 |
|------|----------|----------|
| 上报「需要验证」 | ❌ 无 | 设计文档有 `report_verification_required`，**代码未实现**。 |
| 解决待办 / 继续投递 | ❌ 无 | 设计文档有 `resolve_pending_action`，**代码未实现**。 |
| prepare 里的说明 | ✅ 有 | `prepare_application_context` 返回里注明 v1：遇到验证即暂停、人工接管（submit_policy）。 |

小结：**Verification 只存在于设计**，当前无表、无接口、无调度。

---

### 7. Confirm application result（最终是否提交成功 + 渠道）

| 能力 | 现有有无 | 落在哪里 |
|------|----------|----------|
| 记录「已提交/失败」状态 | ✅ 有 | **主站**：Applications 页下拉可设 applicationStatus（not-applied / applied / interviewing / rejected / accepted），同步到 `profile.applications[].applicationStatus`（`/api/profile/upsert-application`）。 |
| 记录「通过谁投递」 | ❌ 无 | profile.applications 没有 `appliedVia` / `channel` 字段；`upsertJobApplication` 也不接受该参数。 |
| Manus 回传投递结果 | ❌ 无 | 没有「Manus 调 Hera 上报 submitted/failed」的接口；设计文档有 `update_application_status`，**代码未实现**。 |

小结：**结果状态**主站可写；**渠道 + Manus 回传**缺失。

---

## 二、现有 MCP / 主站 / ATS / Resume 逻辑的映射关系

### 2.1 MCP 工具与流程步骤

| MCP 工具 | 对应流程步骤 | 说明 |
|----------|--------------|------|
| recommend_jobs | 1. Search/Recommend | 推荐；不写 jobSearches。 |
| search_jobs | 1. Search | 浏览式搜索，同库同 pipeline。 |
| refine_recommendations | 1. Refine/Follow-up | 更多/排除/喜欢不喜欢，写 feedback_events。 |
| get_user_applications | 2/3/7 | 查 profile.applications（+ status_filter）；不返 jobSearches。 |
| create_application_intent | 3/5 | 重路径：写 apply_applications，为 prepare 提供 application_id。 |
| prepare_application_context | 5 | 读 job + 用户，返回给 Manus 的 prompt/attachments 等。 |
| tailor_resume | 4 | 写 applications[].resumeTailor；无 generate_resume。 |
| job_alert | 1 | 按 session 的「新职位」拉取。 |

### 2.2 主站与流程步骤

| 主站能力 | 对应流程步骤 | 说明 |
|----------|--------------|------|
| Jobs 页搜索 | 1 | mirror-jobs + 可选 record-job-search → jobSearches。 |
| Jobs 页保存 / Tailor Resume+ | 3 + 4 | upsert-application(jobSave)；Tailor 再写 resumeTailor。 |
| Applications 页 | 3 / 7 | 展示 profile.applications + localStorage savedJobs；下拉改 applicationStatus。 |
| Profile 页 | 4 + 统一信息 | 简历上传、表单（含 country, linkedin, work rights 等）、生成简历到 profile.resumes。 |
| /api/applications?email= | 2/3/7 | 返回 applications + userProfile（含 jobSearches, resumes）。 |

### 2.3 数据存储与流程

| 存储 | 用途 | 对应步骤 |
|------|------|----------|
| profile.jobSearches | 搜索历史 | 1（仅主站写） |
| profile.applications | 选中的职位、tailor、coverLetter、状态 | 3, 4, 7 |
| profile.resumes | 通用简历（含生成的） | 4 |
| feedback_events | 会话内推荐历史、liked/disliked | 1 refine |
| apply_applications | 重路径的 intent + 执行状态 | 3, 5（可选） |
| AgentKit Memory | shown_job_ids 等（若开启） | 1 |

---

## 三、哪些步骤只是名字不同、本质已有

- **Interested**：没有单独「interested」表；**feedback_events 的 liked_job_ids** = 会话级「喜欢」；**applications 只有 jobSave、无 status** ≈ 「感兴趣/待申请」的混合。若产品不区分「感兴趣」与「已选准备申请」，现有即可。
- **Selected for application**：= 在 applications 里有一条（jobId + jobSave），或 create_application_intent 一条；本质已有。
- **Application status**：主站下拉 + applicationStatus 字段 = 已申请/面试/拒绝/接受等，已有；缺「渠道」。
- **Follow-up after recommendation**：= refine_recommendations + feedback_events，已有。

---

## 四、哪些步骤缺失、需最小补齐

只列**最小缺口**，不造重系统：

1. **MCP 推荐时记一次 search**  
   - 在 `recommend_jobs` 内，当有 `user_email` 且存在搜索条件（如 job_title 或 city）时，顺带调 `addJobSearchToProfile`，写一条 jobSearches。

2. **记录「通过谁投递」**  
   - 在 `profile.applications` 和 `upsertJobApplication` 中增加 `appliedVia?: 'manus' | 'hera_web'`（或 channel）；主站手动改状态时写 `hera_web`。

3. **Manus 回传投递结果**  
   - 提供一个极简接口（MCP tool 或 HTTP）：如 `record_apply_result`(user_email, job_id, status: submitted|failed, channel: 'manus')，内部只调 `upsertJobApplication(..., { applicationStatus, appliedVia })`。

4. **（可选）轻量「准备投递」记录**  
   - 若不想用 create_application_intent，可提供 `record_application_preparation`(user_email, job_id, job_snapshot)，只做 upsertJobApplication(jobSave)，供 Manus 在用户选职位时调。

5. **get_user_applications 可带 jobSearches**  
   - 返回里加上 profile.jobSearches（及 appliedVia），便于 Manus 展示「搜了什么 + 投了什么 + 通过谁」。

Verification（report_verification_required / resolve_pending_action）若不做 v1，可保持「prepare 里说明 + 人工接管」，不列为最小必须。

---

## 五、哪些用户信息适合提前统一收集

现有 Profile 已有、且适合「提前收集、后面少问」的：

- **country, city**：已有，推荐/搜索必用。
- **work rights**：workingRights, workingRightsStatus, workingRightsVisaType, otherWorkingRights（多国家），已有；投递时 sponsorship/visa 可少问。
- **linkedin**：已有；可选给 Manus 填表用。
- **jobTitle, seniority, skills, education, employment**：已有，推荐与 tailor 都用。

未在 profile 或仅间接存在的：

- **GitHub / portfolio**：无独立字段；可放在 website 或 others。
- **gender**：schema 无；若需要再加。

建议：**优先用现有 profile 字段**；Manus 侧用 get_user_profile 或 MCP 能拿到的 profile 即可，不必重复收集；仅当确有需求再加 GitHub/portfolio/gender 等。

---

## 六、「多个 selected for application」现有是否可承接

- **可以**。  
- **profile.applications** 是数组，每条一个 jobId；主站可多次 upsert（或前端批量）；MCP 若用轻路径可多次 `record_application_preparation` 或多次 `upsertJobApplication`。  
- **create_application_intent** 单 job 单次，N 个职位要调 N 次（且受 100 active 上限）；若采用轻量「只写 profile」则无 100 限制，仅受 profile 文档大小等约束。  
- 结论：**多选准备申请**现有数据模型和接口已支持，无需新结构。

---

## 七、建议的最小改造路径（不重写编排/ATS）

1. **先做数据与查询**  
   - profile.applications 增加 `appliedVia`；  
   - `upsertJobApplication` 与 `/api/profile/upsert-application` 支持 appliedVia；  
   - `get_user_applications`（及主站 GET applications）返回里带 jobSearches 和 appliedVia。

2. **再做「自然记录」**  
   - recommend_jobs 内条件满足时调 `addJobSearchToProfile`；  
   - 新增轻量 `record_apply_result`（+ 可选 `record_application_preparation`），只写 profile，不依赖 apply_applications。

3. **主站 ATS 保持不变**  
   - Applications 页继续用现有接口；仅后端支持 appliedVia，主站下拉可后续加「渠道」展示。

4. **create_application_intent / prepare 暂保留**  
   - 若 Manus 仍需「拿单次上下文」可继续用 prepare（可接受 job_id 或 application_id）；intent 作为可选重路径，不做为唯一入口；新逻辑以 profile 轻量记录为主。

5. **Verification / 提醒**  
   - v1 不实现 report_verification_required；保持 prepare 文案中的「暂停 + 人工接管」即可。

这样可在**不动完整编排、不重写 ATS** 的前提下，把「搜了什么、准备投什么、有没有投成、通过谁投成」接齐，并与现有 MCP、主站、resume/tailor 逻辑全部复用或最小扩展。
