# Manus Customer API 设计方案（Hera Apply Runtime）

> 目标：把 Hera 作为 Manus 的「职位+企业数据 + 投递编排」合作方，支持主站推荐 200–500 岗位、批量创建最多 100 个 active application jobs，由 Manus 执行投递；Hera 统一处理 verification / pending actions / reminders。  
> 本文在研读 [Manus API 文档](https://open.manus.ai/docs) 与现有 Hera MCP/Profile 后整理，可与 ChatGPT 的规划对照并迭代。

---

## 〇、Customer API 和 GPT MCP 的区别（你要多做什么）

### “Manus Customer API” 是什么意思？

- **不是** Manus 官方提供的一个叫 “Customer API” 的独立产品。  
- **实际含义**：**你们（Hera）作为 Manus 的客户/合作方，提供给 Manus 调用的接口**，用来拿职位数据、推荐结果、投递上下文等。  
- 可以理解为：**给 Manus 用的 API = 你们的 Customer API（你们是 Manus 的 customer，你们出的 API 给 Manus 用）。**

### 和给 ChatGPT 做的 MCP 有什么差异？

| 维度 | GPT 用的 MCP | Manus 用的（Customer API） |
|------|----------------|-----------------------------|
| **谁在调** | ChatGPT 后端调你们 | Manus 后端/Agent 调你们 |
| **协议** | 同一套 MCP（POST + tools/call） | 可以**完全一样**：还是同一个 `/api/mcp`，只是调用方从 GPT 换成 Manus |
| **认证** | 现有 Bearer / MCP_SHARED_SECRET | 可以同密钥，或单独给 Manus 一个 API Key / Header 区分 |
| **工具列表** | recommend_jobs, search_jobs, tailor_resume… | **同一批工具**，Manus 主要用推荐/搜索；按需再加 5 个 apply 工具 |
| **行为差异** | 按对话一次推少量（如 5～20 条） | 按**分层档案**返回 10/50/100 条，主站 advanced 最高 500 条 |

所以：  
- **接口层面**：不必再做一套新 API，**复用现有 MCP 路由和工具**即可。  
- **你要多做的**只有几件事：  
  1. **区分调用方**：用 Header（如 `X-Caller: manus`）或参数（如 `source: 'manus'`）识别是 Manus 在调。  
  2. **Manus 专用行为**：当调用方是 Manus 且满足条件（如完整简历）时，**固定返回 50 个职位**（见下节）。  
  3. **（可选）** 给 Manus 单独配一个 API Key，便于计费/限流/日志。  
  4. **（后续）** 若要做「投递编排」（批量 apply、verification 上报等），再加 5 个 apply 工具和新表。

### 小结

- **Customer API = 你们给 Manus 调用的那套接口**，可以和 GPT 的 MCP **共用同一套**。  
- **额外工作**：在 `recommend_jobs` 里按分层档案返回 10/50/100（及 advanced 最高 500）；返回中带 `profile_stage`、`missing_fields`、`next_actions`；提供 `prepare_application_context` 供 Manus 拿单次投递上下文。

### 分层档案（Staged Profile）与推荐数量（已实现）

- **三阶段**：`recommendable` → `enhanced_recommendation` → `auto_apply_ready`（非二元“完整/不完整”）。
- **推荐数量**：按阶段与模式  
  - `recommendable`（仅有 job title / location 等基础条件）：最多 **10** 条  
  - `enhanced_recommendation`（目标职位 + skills）：最多 **50** 条  
  - `auto_apply_ready`（再具备 employmentHistory）：最多 **100** 条  
  - **Advanced / 主站模式**（`source: 'hera_web'` 或 Header `X-Caller: hera_web`）：上限 **500** 条
- **`recommend_jobs` 返回结构**（除原有 content / meta 外）新增：  
  - `profile_stage`: `'recommendable' | 'enhanced_recommendation' | 'auto_apply_ready'`  
  - `auto_apply_ready`: boolean  
  - `missing_fields`: string[]（当前阶段还缺的字段）  
  - `next_actions`: string[]（建议用户补什么可升阶段 / 下一步操作）

### 第一版 Auto Apply 入口（已实现）

- **保留入口**：用户选中职位 → 调 `prepare_application_context` → 得到 context 交给 Manus 执行单次投递。
- **入参**：`user_email`、`job_id`。
- **返回**：`prompt_snippet`（给 Manus Create Task 的 prompt）、`submit_policy`、`job_snapshot`、`resume_url`（若该 job 已有 tailor 简历）。
- **Verification**：第一版不做 verification center；遇到验证时**暂停 + 人工接管**（`verification_note` 在返回中说明）。
- **第二版再补**：verification center、reminders、batch apply queue、100 active apply jobs 等。

---

## 一、Manus API 事实摘要（与设计强相关）

| 能力 | 说明 |
|------|------|
| **Create Task** | `POST /v1/tasks`：必填 `prompt`、`agentProfile`；可选 `project_id`（套用 project instruction）、`attachments`、`taskId`（多轮）、`connectors`、`taskMode`（chat/adaptive/agent）、`interactiveMode` |
| **Create Project** | `POST /v1/projects`：`name` + `instruction`，所有关联 task 自动套用 instruction |
| **Webhooks** | `task_created`、`task_stopped`。`task_stopped` 含 `stop_reason`: `"finish"` \| `"ask"`（ask = 需要用户输入） |
| **Get Task** | `GET /v1/tasks/{task_id}`：`status` = pending \| running \| completed \| failed；可选 `incomplete_details`、`output`（消息列表） |

要点：

- **Verification 形态**：Manus 官方 webhook 只给 `stop_reason: "ask"` + `message` 文本，**没有**结构化 verification 类型（email_code / sms_code / mfa 等）。因此要么：  
  - **方案 A**：Manus 在执行到需要验证时，**调用 Hera 的 `report_verification_required`**，把类型、超时、job 信息等结构化上报；  
  - **方案 B**：在 project instruction 里约定 Manus 在 `message` 里输出固定 JSON 结构，Hera webhook 解析。  
  推荐 **方案 A**（Manus 调 Hera API），结构清晰、易扩展。
- **执行层**：Manus 只负责「跑 task」；任务内容、上下文、是否允许提交等由 Hera 通过 **project instruction + Create Task 的 prompt/attachments** 注入。

---

## 二、现有 Hera 可复用部分

- **职位/企业数据**：`recommend_jobs`、`search_jobs`、`search_jobs_by_company`、`build_search_links` 等可直接给 Manus 或 Manus 用户使用（复用现有 MCP 或对等的 HTTP Customer API）。
- **用户侧申请记录**：`get_user_applications`、`/api/profile/upsert-application`、`upsertJobApplication`，以及 Profile 里 `applications[]`（jobId, jobSave, resumeTailor, coverLetter, applicationStatus）。
- **简历**：`tailor_resume` 已存在；Manus 创建 task 时可带 resume 等 attachment，Hera 可提供「为某 job 生成 tailor 简历并返回 URL」的接口供 Manus 使用。

**现有 MCP 需要改动的点**（在「只扩不拆」前提下）：

1. **认证与路由**  
   - 若 Manus 走 HTTP 而非 MCP 协议：可复用同一套 handler 逻辑，增加一条路由（如 `/api/manus` 或 `/api/customer/manus`），用 API Key 或约定 Bearer 区分 Manus。
2. **限流与配额**  
   - 推荐 200–500 jobs、最多 100 active application jobs：在「创建投递意图」或「准备 context」的接口里做计数与上限校验。
3. **get_user_applications 扩展**  
   - 若引入下面说的「编排用 Application」表，可增加按 `orchestration_status` 过滤（或返回两种：profile 的 applications 与 apply_runtime 的 applications），具体看是否同表存储（见下节）。

---

## 三、A. 新工具 Schema（5 个 Apply 相关）

以下 5 个工具面向「Manus Apply Runtime」：由 Manus 或 Hera 主站调用，用于创建投递意图、准备上下文、上报验证、解决待办、更新状态。

### 1. `create_application_intent`

创建一条「待执行」的投递意图，计入 100 active 上限。

```yaml
name: create_application_intent
description: >
  Create an application intent for a job. Counts toward the 100 active application limit.
  Call after user or system has chosen a job to apply via Manus.
inputSchema:
  type: object
  required: [user_email, job_id]
  properties:
    user_email: { type: string, description: "User email" }
    job_id: { type: string, description: "Hera job ID" }
    resume_file_id: { type: string, description: "Optional Manus file_id or Hera resume identifier for attachment" }
    source: { type: string, enum: [manus, hera_web], default: manus }
```

**返回**：`{ intent_id, application_id, job_snapshot, status: "queued", created_at }`  
内部：创建 Application 记录，状态 `queued`；可选与 profile.applications 做一次 upsert（仅 jobId + jobSave），避免重复。

---

### 2. `prepare_application_context`

为 Manus Create Task 准备「单条投递」的上下文（职位信息、用户信息、简历链接、提交政策等），供 Manus 作为 prompt/instruction 或附件使用。

```yaml
name: prepare_application_context
description: >
  Get application context for a single job to pass to Manus Create Task
  (prompt + attachments). Includes job snapshot, user profile summary,
  resume URL if tailored, and submit_policy.
inputSchema:
  type: object
  required: [user_email, application_id]
  properties:
    user_email: { type: string }
    application_id: { type: string }
```

**返回**：  
- `prompt_snippet`: 建议放入 Manus task prompt 的文本（职位标题、公司、要求摘要等）。  
- `submit_policy`: 例如 "do_not_submit_without_explicit_user_confirmation" 或 "allow_auto_submit_if_no_sensitive_prompt"。  
- `resume_url`: 可选，该 job 的 tailor 简历下载链接。  
- `job_snapshot`: 结构化职位信息（禁止 Manus 猜 sponsor/clearance/citizenship 的说明可写在这里或 project instruction）。  
- `attachments`: 建议的 attachments 数组（如 `[{ filename, url }]`）。

---

### 3. `report_verification_required`

Manus 执行到需要用户输入时调用（例如验证码、MFA、最终确认），Hera 落库并触发提醒。

```yaml
name: report_verification_required
description: >
  Report that a verification or user action is required for an application.
  Pauses the application and creates a PendingAction; Hera will remind the user.
inputSchema:
  type: object
  required: [application_id, pending_action_type, message, expires_at_iso]
  properties:
    application_id: { type: string }
    task_id: { type: string, description: "Manus task_id for reference" }
    task_url: { type: string }
    pending_action_type:
      type: string
      enum:
        - email_code
        - sms_code
        - mfa
        - captcha_manual_takeover
        - unclear_sensitive_answer
        - final_submit_confirmation
    message: { type: string, description: "Human-readable message for the user" }
    expires_at_iso: { type: string, format: date-time }
    metadata: { type: object, description: "Optional extra (e.g. platform name)" }
```

**返回**：`{ pending_action_id, application_id, status: "awaiting_user_input", reminder_scheduled: true }`  
内部：插入 PendingAction、更新 Application 状态为 `awaiting_user_input`、写入 VerificationEvent、调度提醒（见 D 节）。

---

### 4. `resolve_pending_action`

用户完成验证/操作后调用，使该 pending 关闭并允许 Manus 继续（具体「继续」由 Manus 侧用 task_id 多轮或新 task 实现，Hera 只记录状态）。

```yaml
name: resolve_pending_action
description: >
  Mark a pending action as resolved (e.g. user entered code, confirmed submit).
  Application can move to ready_to_submit or submitted.
inputSchema:
  type: object
  required: [pending_action_id, resolution]
  properties:
    pending_action_id: { type: string }
    resolution: { type: string, enum: [completed, user_cancelled, expired] }
    user_message: { type: string, description: "Optional: code or confirmation note" }
```

**返回**：`{ pending_action_id, application_id, status: "resolved", application_status }`  
内部：更新 PendingAction 为 resolved、可选更新 Application 状态（例如 -> `ready_to_submit`）、记一条 VerificationEvent。

---

### 5. `update_application_status`

同步最终投递结果或失败/过期，与现有 profile `applicationStatus` 对齐。

```yaml
name: update_application_status
description: >
  Update application status after submit or failure/expiry.
  Syncs to user's profile applications for get_user_applications.
inputSchema:
  type: object
  required: [application_id, status]
  properties:
    application_id: { type: string }
    status: { type: string, enum: [submitted, failed, expired] }
    task_id: { type: string }
    note: { type: string }
```

**返回**：`{ application_id, status, profile_synced: true }`  
内部：更新编排表状态；并调用现有 `upsertJobApplication(email, jobId, { applicationStatus })` 同步到 profile。

---

## 四、B. 数据表 / 类型定义

### 4.1 与现有 Profile 的关系

- 现有 **profile.applications** 保留：用于「用户看到的申请列表」、`get_user_applications`、简历/封面信存储。  
- 新增「投递编排」数据：可单独集合（推荐），或与 profile 解耦后通过 `user_email` + `job_id` 关联。

### 4.2 Application（编排用）

建议**新集合** `apply_applications`（或 `manus_applications`）：

```ts
interface Application {
  id: string;                    // uuid
  user_email: string;
  job_id: string;
  job_snapshot: { title: string; company: string; source?: string; url?: string };
  status: ApplicationStatus;
  manus_task_id?: string;
  manus_task_url?: string;
  resume_file_id?: string;
  resume_url?: string;
  source: 'manus' | 'hera_web';
  created_at: Date;
  updated_at: Date;
  submitted_at?: Date;
}

type ApplicationStatus =
  | 'queued'
  | 'prechecking'
  | 'ready'
  | 'running'
  | 'awaiting_user_input'
  | 'ready_to_submit'
  | 'submitted'
  | 'failed'
  | 'expired';
```

### 4.3 PendingAction

```ts
interface PendingAction {
  id: string;
  application_id: string;
  task_id: string;
  task_url?: string;
  type: PendingActionType;
  message: string;
  status: 'active' | 'resolved' | 'expired';
  resolution?: 'completed' | 'user_cancelled' | 'expired';
  expires_at: Date;
  created_at: Date;
  resolved_at?: Date;
  metadata?: Record<string, unknown>;
}

type PendingActionType =
  | 'email_code'
  | 'sms_code'
  | 'mfa'
  | 'captcha_manual_takeover'
  | 'unclear_sensitive_answer'
  | 'final_submit_confirmation';
```

### 4.4 VerificationEvent（审计/分析）

```ts
interface VerificationEvent {
  id: string;
  application_id: string;
  pending_action_id: string;
  event: 'created' | 'reminder_10m' | 'reminder_3m' | 'resolved' | 'expired';
  at: Date;
  payload?: Record<string, unknown>;
}
```

### 4.5 SessionLane（同用户 × 同站点 × 同 session 串行）

```ts
interface SessionLane {
  id: string;
  user_email: string;
  site_key: string;   // e.g. "seek", "linkedin"
  session_id: string;
  current_application_id?: string;
  updated_at: Date;
}
```

用于限制：同一 lane 上一次只跑一个 application；不同 site 可有限并发（由 Hera 在「拉取 ready 任务」或 Manus 回调时校验）。

### 4.6 ReminderSchedule

```ts
interface ReminderSchedule {
  pending_action_id: string;
  reminder_10m_at?: Date;
  reminder_3m_at?: Date;
  expired_at: Date;
}
```

可用独立集合，或合并在 PendingAction 的字段里（如 `reminder_10m_sent`, `reminder_3m_sent`）。

---

## 五、C. Application Orchestration Sequence

1. **主站/Manus** 选岗：用户或 Manus 从 Hera 获取推荐/搜索列表（现有 `recommend_jobs` / `search_jobs`）。
2. **创建意图**：调用 `create_application_intent(user_email, job_id)` → 得到 `application_id`，状态 `queued`。
3. **准备上下文**：调用 `prepare_application_context(user_email, application_id)` → 得到 prompt 片段、submit_policy、resume_url、job_snapshot、attachments。
4. **Manus 创建 Task**：  
   - 使用 **Hera 的 project-level instruction**（禁止猜 sponsor/clearance/citizenship、verification 必须暂停并上报 Hera、submit 前遵循 submit_policy）。  
   - Create Task 时把上面 context 放入 `prompt` 或 attachments；`project_id` 指向该 instruction 的 project。  
   - 记录 `manus_task_id` 到 Application，状态 → `prechecking` → `ready` → `running`。
5. **执行中**：  
   - 若需用户输入：Manus 调 `report_verification_required` → Hera 创建 PendingAction、状态 → `awaiting_user_input`、发提醒。  
   - 用户完成后：Manus 或 Hera 调 `resolve_pending_action` → 状态 → `ready_to_submit` 或继续 running（由 Manus 侧逻辑决定是否同一 task 继续）。  
   - 提交前 Manus 再次遵守 submit_policy（可约定在 instruction 里写死「提交前必须调 Hera 某接口确认」）。
6. **结束**：Manus 调 `update_application_status(application_id, submitted|failed|expired)`；Hera 同步到 profile.applications.applicationStatus。

---

## 六、D. Verification & Reminder Flow

- **新建 PendingAction 后**：立即提醒（推送/邮件/站内信由你们现有通道发）。  
- **剩余 10 分钟**：再提醒一次（可用 cron 或 queue 扫 `expires_at - 10m`）。  
- **剩余 3 分钟**：再提醒一次。  
- **超时**：将 PendingAction 标为 `expired`，Application 可标为 `expired` 或保持 `awaiting_user_input` 并允许「重试」（由 `resolve_pending_action(..., resolution: 'expired')` 或单独「重试」接口）。

Verification 的**返回形态**建议：

- **Manus 调 Hera**：`report_verification_required` 返回 `{ pending_action_id, status, reminder_scheduled }`；Manus 据此暂停，等待用户去 Hera 端或邮件/推送完成操作。  
- **Hera 给用户/前端**：提供「待处理列表」接口（按 `user_email` 查 PendingAction），返回类型、message、task_url、expires_at、剩余时间；前端可展示「需要验证码」「需要最终确认」等。  
- **Hera 给 Manus**：若 Manus 需要「用户已解决」的通知，可提供 webhook（Hera 在 `resolve_pending_action` 后调 Manus 的 callback）或由 Manus 轮询 Get Task / 调 Hera「获取 application 状态」接口。

---

## 七、E. 对接 Manus Task Payload 示例

### 7.1 Project Instruction（创建一次，所有 Hera 投递 task 共用）

```text
You are applying to a job on behalf of the user. Context is provided in the task prompt and attachments.
- Do NOT guess or invent sponsor, clearance, or citizenship requirements; use only what Hera provides.
- When the platform requires user verification (email code, SMS, MFA, captcha, or final confirmation),
  you MUST pause and call Hera's report_verification_required API with the correct type and expiry.
  Do not proceed until the user has resolved the action and you are instructed to continue.
- Before submitting the application, you MUST follow the submit_policy provided by Hera
  (e.g. do not submit without explicit user confirmation if policy says so).
```

### 7.2 Create Task 请求体示例

```json
{
  "prompt": "Apply to this job using the attached context.\n\nJob: Senior Engineer at Acme Corp\nApply URL: https://...\n\nSubmit policy: do_not_submit_without_explicit_user_confirmation.\n\nIf you need verification (code, MFA, captcha, final confirm), call Hera report_verification_required and stop.",
  "agentProfile": "manus-1.6",
  "project_id": "proj_hera_apply_xxx",
  "attachments": [
    {
      "filename": "resume.pdf",
      "url": "https://hera.example.com/api/download-resume/xxx"
    }
  ],
  "taskMode": "agent",
  "interactiveMode": true
}
```

`prompt` 内容可由 `prepare_application_context` 的返回拼装而成；敏感信息（如禁止猜测的字段）可只在 instruction + 结构化 context 里提供。

---

## 八、实施顺序建议

1. **数据层**：新增集合与类型（Application, PendingAction, VerificationEvent, SessionLane, ReminderSchedule），不破坏现有 profile.applications。  
2. **API 层**：实现 5 个新工具对应的 HTTP 接口（可挂在 `/api/mcp` 同一 handler 的 tool 分支，或单独 `/api/manus/*`）。  
3. **Manus 侧**：创建 Hera Apply Project、配置 webhook（若需要 Hera 主动通知 Manus）、在 Manus 执行流里接 `report_verification_required` / `resolve_pending_action` / `update_application_status`。  
4. **提醒与超时**：实现 10m/3m/expired 的调度与 PendingAction 状态更新。  
5. **现有 MCP**：按需增加 Manus 用到的 tool 列表暴露、限流与 100 active 校验；`get_user_applications` 可后续扩展返回编排状态。

如需，我可以下一步把「新工具在现有 `route.ts` 里的注册方式」和「Manus webhook 接收 task_stopped 后如何调 Hera」写成具体代码草稿（文件路径 + 函数签名级别），方便你直接落地实现。
