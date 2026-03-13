# 产品逻辑审阅：Hera 为 Job Discovery + ATS Backend，Manus 为交互 Agent

> 原则：Manus 负责对话与任务执行；Hera 负责 job discovery、application tracking、ATS history、resume/tailoring。不让 Manus 重做 ATS UI，而是打开 Hera 的 ATS 页面。  
> 本文只做 review，不写代码。

---

## 一、产品逻辑共识（你给的定义）

| 项目 | 定义 |
|------|------|
| **Hera** | Job Discovery + Application Tracking 的后端；提供 ATS 历史、简历生成/定制。 |
| **Manus** | 用户交互的 AI agent：对话 + 执行（如自动投递）。 |
| **Interested** | = job detail 被单独展示（例如 Manus 展示某职位完整 JD）。不依赖 liked / jobSave；应以「get_job_detail(job_id)」这类行为为准。 |
| **Selected for application** | 用户明确说「apply #2 #5 #7」或「apply these jobs」。 |
| **Confirm result** | Manus 完成投递后回传 status + appliedVia = manus。 |
| **账号绑定** | Manus 带 user_email 调 Hera；Hera 端 find_or_create_user(email)，使 Manus 用户自动对应到 Hera ATS。 |
| **ATS UI** | 已有 ATS Web UI；Manus 不自己做 application dashboard，而是打开 Hera 的 ATS 页面（如 open https://hera.ai/ats）。 |

---

## 二、按 7 步用户流程的审阅

### 1. Search / Recommend

| 能力 | 现状 | 结论 |
|------|------|------|
| 用户搜索 / Hera 返回推荐 | MCP：`recommend_jobs`（job_title, city, user_profile, session_id, exclude_ids…）返回推荐列表；主站 Jobs 用 mirror-jobs + 可选 record-job-search。 | ✅ 已有 |
| MCP 推荐时是否记「用户搜了什么」 | recommend_jobs 内部**未**调 addJobSearchToProfile。 | ❌ 需补：推荐时若有 user_email + 搜索条件，顺带写 jobSearches |

---

### 2. Interested（= job detail 被单独展示）

| 能力 | 现状 | 结论 |
|------|------|------|
| 定义「感兴趣」= 看了 job detail | 当前无「job detail 被展示」的独立语义；feedback_events 的 liked 是会话内偏好；jobSave 是「保存」不是「看了详情」。 | ❌ 需按产品定义补 |
| get_job_detail(job_id) | **没有**独立 MCP 工具。recommend_jobs 在 manus=true 时在每条 job_cards 里带 `job_detail`，供 Manus 渲染详情；没有「按 job_id 单查一条详情」的接口。 | ❌ 需补 |
| 记录「用户看了该职位详情」 | 无「viewed job detail」的存储与写入。 | ❌ 需补 |

**建议最小实现**：  
- 新增 MCP 工具 **`get_job_detail`**：入参 `job_id`，可选 `user_email`。  
  - 返回与 recommend_jobs 中 `job_detail` 同构的完整详情（便于 Manus 展示完整 JD）。  
  - 若传入 `user_email`，在 Hera 侧记录一次「该用户查看了该职位详情」= **Interested**（存储方式可选：例如 profile 下 `interestedJobIds[]` 或单独 `job_detail_views` 表，只记 job_id + user_email + timestamp）。  
- 这样「Interested = job detail 被单独展示」有明确语义且可复用现有 job 查询与详情结构。

---

### 3. Selected for application（apply #2 #5 #7）

| 能力 | 现状 | 结论 |
|------|------|------|
| 用户明确说申请哪几个 | 主站：点 Tailor/保存时 upsert-application(jobSave)。MCP：`create_application_intent`(user_email, job_id) 单条；可多次调用实现多选。 | ✅ 已有（多选 = 多次调用或多次 upsert） |
| 轻量「选中准备申请」 | 无单独 `record_selected_for_application`；若不用 intent，只能靠 upsertJobApplication(jobSave)。 | ⚠️ 可选：加轻量接口「记录选中」只写 profile.applications（jobSave），不建 intent |

Bulk apply 提示（"You can apply to multiple jobs at once. Just tell me the job numbers."）为 Manus 侧话术与流程，无需 Hera 改代码。

---

### 4. Resume decision（有则 tailor / 无则生成）

| 能力 | 现状 | 结论 |
|------|------|------|
| 针对某职位 tailor | MCP `tailor_resume` + 主站 Tailor 流程；结果写 profile.applications[].resumeTailor。 | ✅ 已有，复用 |
| 无简历时生成 | 主站 Profile 页填表 → generate-resume → profile.resumes[]。MCP **无**「从 profile 生成简历」的 tool。 | ⚠️ 若 Manus 要替用户「生成第一份简历」，需在 MCP 暴露「用 profile 生成简历」或调用现有 generate-resume 的封装 |

---

### 5. Auto apply

| 能力 | 现状 | 结论 |
|------|------|------|
| Manus 执行投递 | Hera 不执行；Manus 用 prepare 给的 context 自己跑。 | ✅ 分工清晰 |
| 准备单次投递上下文 | `prepare_application_context`(user_email, job_id | application_id) 返回 prompt_snippet, job_snapshot, submit_policy, resume_url。 | ✅ 已有 |

---

### 6. Verification

| 能力 | 现状 | 结论 |
|------|------|------|
| 验证码/人工步骤 | prepare 中说明 v1 暂停+人工接管；无 report_verification_required 等接口。 | ✅ 暂按「人工接管」即可，无需改 |

---

### 7. Confirm result（回传 status + appliedVia = manus）

| 能力 | 现状 | 结论 |
|------|------|------|
| 主站改 application 状态 | Applications 页下拉 → upsert-application(applicationStatus)。 | ✅ 已有 |
| 记录「通过谁投递」 | profile.applications 无 appliedVia/channel 字段；upsertJobApplication 不接该参数。 | ❌ 需补 |
| Manus 回传投递结果 | 无 Manus 调 Hera 的「上报 submitted/failed」接口。 | ❌ 需补 |

---

## 三、MCP tools 审阅

| 工具 | 对应产品能力 | 已有/需补 |
|------|----------------|-----------|
| recommend_jobs | Search/Recommend | ✅ 已有；建议内里顺带写 jobSearches |
| search_jobs | Search | ✅ 已有 |
| refine_recommendations | Follow-up/更多 | ✅ 已有 |
| get_user_applications | ATS history 查询 | ✅ 已有；建议返回里带 jobSearches + appliedVia（见下） |
| create_application_intent | 选中准备申请（重路径） | ✅ 已有 |
| prepare_application_context | 单次投递上下文 | ✅ 已有 |
| tailor_resume | Resume tailor | ✅ 已有 |
| **get_job_detail** | **Interested = 展示 job detail** | ❌ 需新增（返回详情 + 可选记 interested） |
| **record_apply_result**（或同名） | **Confirm result：Manus 回传 status + appliedVia** | ❌ 需新增 |
| record_application_preparation | 轻量「选中准备申请」（仅写 profile） | ⚠️ 可选 |

---

## 四、主站 ATS 审阅

| 能力 | 现状 | 结论 |
|------|------|------|
| ATS 页面 | 路径为 **/applications**，展示 profile.applications + userProfile（jobSearches, resumes）；下拉改 applicationStatus。 | ✅ 已有 |
| 数据来源 | GET /api/applications?email= → 需 profile 存在，否则 Profile not found。 | ✅ 已有 |
| 独立「ATS 入口」给 Manus | 当前无 **/ats** 路径；主站统一用 /applications。 | ⚠️ 需产品决定 |
| Manus 打开 ATS 时的身份 | 主站 /applications 依赖 localStorage 的 userProfile（主站登录）。Manus 用户可能从未登录 Hera，仅有 email。 | ⚠️ 需产品/技术方案 |

**建议（不写代码，只列选项）**：  
- **路由**：新增 **/ats** 作为「纯 ATS」入口（可 alias 到 /applications，或同一页面不同 layout），便于 Manus 与文档统一写「open https://hera.ai/ats」。  
- **身份**：  
  - 方案 A：/ats?email=xxx（或 /ats?token= 带签名），ATS 页在「仅 ATS 入口」时接受 query 中的 email/token，用其拉 GET /api/applications?email=；若不做主站登录，需考虑链接泄露与鉴权（例如短期 signed token 代替裸 email）。  
  - 方案 B：Manus 触发 Hera 发 magic link，用户点开即带登录态进 ATS。  
  - 方案 C：OAuth/SSO，Manus 与 Hera 账号打通。  
- 选哪种由产品与安全要求定；当前审阅只标「需补」。

---

## 五、Resume generation / tailoring 审阅

| 能力 | 现状 | 结论 |
|------|------|------|
| Tailor | MCP tailor_resume + 主站 Tailor；逻辑在 Hera，写 applications[].resumeTailor。 | ✅ 已有，复用 |
| 从 profile 生成简历 | 主站 Profile → generate-resume（无 jobId 时写 profile.resumes[]）。MCP 无对应 tool。 | ✅ 主站有；MCP 若要让 Manus 帮用户「生成第一份简历」可再包一层 |
| Cover letter | 主站有；applications[].coverLetter 可存；MCP 无单独 tool。 | ✅ 主站有 |

---

## 六、Application status 审阅

| 能力 | 现状 | 结论 |
|------|------|------|
| 状态值 | applicationStatus：主站下拉 not-applied / applied / interviewing / rejected / accepted；get_user_applications 可按 status_filter 过滤。 | ✅ 已有 |
| 渠道 appliedVia | 无字段、无写入、无回传接口。 | ❌ 需补：profile.applications 加 appliedVia；upsert 与 Manus 回传接口支持 |

---

## 七、账号绑定（find_or_create_user）

| 能力 | 现状 | 结论 |
|------|------|------|
| 按 email 查 profile | getUserProfile(email)。 | ✅ 已有 |
| 按 email 自动建 profile | 无「仅凭 email 首次即建档」的约定；若 profile 不存在，get_user_applications 等会得到空或 not found。 | ❌ 需补 |

**建议**：在 MCP 入口（或所有带 user_email 的 tool）中，若 getUserProfile(user_email) 为 null，则先 **upsertUserProfile({ email: user_email, updatedAt: now })** 等最简字段，再继续逻辑；这样 Manus 用户第一次用任意带 user_email 的 API 即自动在 Hera 有档，ATS 与 get_user_applications 可立即用同一 email。

---

## 八、汇总：已有 / 需补 / 最小改动路径

### 已有、可直接复用

- **MCP**：recommend_jobs, search_jobs, refine_recommendations, get_user_applications, create_application_intent, prepare_application_context, tailor_resume。  
- **主站 ATS**：/applications 页、GET /api/applications?email=、applicationStatus 下拉、applications[] + jobSearches + resumes。  
- **Resume**：tailor 全链路；主站生成简历写 profile.resumes。  
- **Application status**：applicationStatus 读写与过滤。

### 必须补（最小）

1. **Interested 定义**  
   - 新增 **get_job_detail**(job_id, user_email?)：返回与 recommend 中 job_detail 同构的详情；若带 user_email，则记录「该用户查看了该职位详情」（新存或 profile 新字段）。  

2. **Confirm result**  
   - profile.applications 增加 **appliedVia**（如 manus | hera_web）；  
   - 新增 **record_apply_result**(user_email, job_id, status, channel)（或 update_application_status），内部 upsertJobApplication(..., { applicationStatus, appliedVia })。  

3. **账号绑定**  
   - 在 MCP 使用 user_email 时 **find_or_create**：getUserProfile 为空则 upsertUserProfile({ email })。  

4. **推荐时记 search**  
   - recommend_jobs 内，有 user_email 且有搜索条件时，顺带 addJobSearchToProfile。  

5. **get_user_applications 返回**  
   - 增加 jobSearches 与 appliedVia，便于 Manus 展示与激励回传。

### 建议补（产品/体验）

6. **ATS 对 Manus 的入口**  
   - 新增 **/ats**（或明确 /applications 即 ATS）；  
   - 定好 Manus 用户打开 ATS 的身份方式（query token / magic link / 其他）。  

7. **（可选）轻量「选中准备申请」**  
   - record_application_preparation(user_email, job_id, job_snapshot)，只写 profile jobSave，不依赖 intent。  

8. **（可选）MCP 生成简历**  
   - 若 Manus 要帮用户「无简历时生成」，再暴露「用 profile 生成简历」的 tool 或封装现有 generate-resume。

### 最小改动路径（顺序建议）

1. **数据与账号**：applications 加 appliedVia；MCP 入口 find_or_create by user_email。  
2. **Interested**：实现 get_job_detail + 「查看详情」记录。  
3. **Confirm result**：实现 record_apply_result（或同名）并让 Manus 在投递完成后调用。  
4. **推荐记 search**：recommend_jobs 内顺带写 jobSearches。  
5. **get_user_applications**：返回中带 jobSearches + appliedVia。  
6. **ATS 入口**：定案 /ats 与 Manus 用户打开方式（不写代码则只定方案）。

---

## 九、不做的（与你的原则一致）

- 不要求 Manus 重做 ATS UI；引导打开 Hera ATS。  
- 不重写 application orchestration；以「轻量记录 + Manus 回传」为主。  
- 不单独为 Manus 再造一套主流程；MCP 与主站共用 profile、applications、resume 逻辑。

以上为按你给的产品逻辑做的审阅与最小改动路径，无代码改动。
