# Hera–Manus 实施路线图（按步骤执行）

本文档把「从推荐职位到启动 Bulk Apply」的完整方案按**步骤 + 测试**拆解，便于一步一步实施。  
与 Manus 的对接约定见 `MANUS_HERA_INTEGRATION_ONE_PAGER_FOR_SKILLS.md`、`MANUS_HERA_APPLICATIONS_INTEGRATION_SPEC.md`。

---

## 当前状态（已完成）

| 阶段 | 内容 | 验收 |
|------|------|------|
| **推荐职位** | recommend_jobs / search_jobs 第一轮只返回列表层（job_cards），不含完整 job_detail | Manus 可拉列表、展示编号 1–50 |
| **多轮职位** | refine_recommendations（exclude_ids 取下一批 50）；get_job_detail（按需拉详情）；liked → 写入 profile.applications，disliked → excluded | 多轮 51–100、101–150；兴趣/排除与主站 Applications 一致 |

---

## 实施顺序总览

```
[已完成] 推荐职位 → 多轮职位
    ↓
[下一步] Phase A：Interested + 对话内摘要与跳转 Hera 免登（方案 A）
    ↓
[然后]   Phase B：开始申请与单次投递（prepare + record_apply_result）
    ↓
[最后]   Phase C：Bulk Apply 联调与启动
```

---

## Phase A：Interested + 对话内摘要与跳转 Hera 免登（方案 A）

**目标**：Manus 对话里展示投递摘要（总数、成功/失败、最近 1 天），文末一句「管理完整投递请前往 Hera」+ 可点击链接；用户点击后**免登**进入 Hera /applications，无需再输密码。

### A.1 Manus 侧（无需 Hera 改接口）

- Manus 调现有 **get_user_applications**，用返回数据在对话里展示：
  - 一共投递了多少
  - 哪些成功、哪些失败（含 failure_reason）
  - 最近 1 天的投递列表
- 文末附一句：「管理完整投递记录请前往 Hera → [点击跳转](URL)」
- 其中 **URL** 由 Hera 新工具 **generate_magic_link** 返回（见 A.2）。

**验收**：Manus 能拿到 get_user_applications 数据并按上述格式展示；链接先可写死 Hera 主站，待 A.2/A.3 完成后再改为 magic link。

---

### A.2 Hera：新增 MCP 工具 generate_magic_link

| 项 | 说明 |
|----|------|
| **工具名** | `generate_magic_link` |
| **入参** | `user_email`（string，必填） |
| **逻辑** | 用 JWT 签发短期 token（payload: `{ email, exp: now + 15min }`），签名用 `MANUS_MAGIC_LINK_SECRET`；返回 `{ magic_link_url: "https://<HERA_DOMAIN>/applications?manus_token=<jwt>" }` |
| **位置** | `src/app/api/mcp/route.ts`：在 tools/list 中注册；在 tools/call 中实现 handler |

**安全**：  
- 环境变量新增 `MANUS_MAGIC_LINK_SECRET`（仅服务端持有）。  
- 可选：token 使用一次后作废（校验时在 Redis/DB 标记已用）。

**验收**：  
- 用 MCP 调用 `generate_magic_link(user_email: "test@example.com")`，返回的 URL 带 `manus_token=eyJ...`，且解码 payload 含 email 与约 15 分钟过期。

---

### A.3 Hera：NextAuth Credentials 支持 manus_token 登录（方案 A）

| 项 | 说明 |
|----|------|
| **目标** | 用户打开 `/applications?manus_token=xxx` 时，用 token 换 NextAuth session，整站视为已登录 |
| **后端** | 在 `src/app/api/auth/[...nextauth]/route.ts` 中增加 **Credentials provider**：`authorize(credentials)` 收到 `token`，用 `MANUS_MAGIC_LINK_SECRET` 校验 JWT，取出 `email`；若该 email 在 Hera 有 profile（或允许无 profile 仅看 applications），则 return `{ id, email, name }`，由 NextAuth 写入 session |
| **前端** | `/applications` 页面（或入口 layout）：加载时若存在 `?manus_token=xxx`，先调用 `signIn('credentials', { token: manus_token, callbackUrl: '/applications' })`；成功后清除 URL 中的 `manus_token`（避免刷新重复使用），再按现有逻辑拉 applications 数据 |

**验收**：  
- 在无登录状态下打开 `https://<hera>/applications?manus_token=<有效 jwt>`，应自动登录并进入 applications 页，且其他需登录页也处于已登录状态。  
- 无 token 或 token 过期/无效时，不创建 session，保持未登录或走原有登录流程。

---

### A.4 联调与测试（Phase A 收尾）

1. **E2E**：Manus 调 `get_user_applications` + `generate_magic_link(user_email)`，将返回的 `magic_link_url` 作为「点击跳转」链接；用户点击后应在 Hera 免登并看到 /applications。  
2. **安全**：确认 token 过期后无法登录；若实现一次性，确认同一 token 用两次第二次失败。

**Phase A 完成标志**：Manus 对话内摘要 + 「管理完整投递请前往 Hera」可点击链接且跳转免登，用户体验闭环。

---

## Phase B：开始申请与单次投递

**目标**：用户在 Manus 选定职位后，能完成「准备上下文 → 开始申请 → 投递结束回传」，主站 Applications 状态正确。

### B.1 确认 prepare_application_context 行为

- 入参：`user_email` + `job_id`（或按需 `application_id`）。
- 行为：返回 prompt_snippet、job_snapshot、resume_url 等；并写入/更新该职位的 `applicationStartedBy: 'manus'`。
- 主站 /applications 该行显示绿色「Application Started」。

**验收**：Manus 对某 job_id 调 prepare_application_context；主站该职位显示「Application Started」。

---

### B.2 确认 record_apply_result 行为

- 入参：`user_email`、`job_id`、`application_status`（`submitted` | `failed`）、`applied_via: "manus"`，可选 `failure_reason`。
- 行为：更新 profile.applications 对应条的 applicationStatus、appliedVia、failureReason；主站 Applications 页状态更新。

**验收**：Manus 在「投递成功/失败」时调 record_apply_result；主站对应行状态与 Manus 一致。

---

### B.3 单次投递 E2E 测试

- 流程：recommend_jobs → 用户选 1 个职位 → get_job_detail 或 refine（liked）→ prepare_application_context →（模拟）record_apply_result(submitted)。
- 验收：主站 /applications 出现该职位，且为「Application Started」+ 「Application Submitted」。

**Phase B 完成标志**：单职位从「选定」到「已投递」在主站与 Manus 数据一致。

---

## Phase C：Bulk Apply 联调与启动

**目标**：用户一次选多个职位（如「投 1、3、5、51、52」），Manus 并行 prepare、逐个投递并回传，主站展示正确。

### C.1 编号与映射约定（已与 Manus 对齐）

- 第一轮 1–50，第二轮 51–100，第三轮 101–150。
- Manus 维护编号 ↔ job_id 映射；bulk 时对每个选中的 job_id 先并行调 prepare_application_context，再在投递结束时逐一调 record_apply_result。

**验收**：Manus 用多轮推荐 + 多选编号，能正确传回 job_id 列表；Hera 不要求改接口。

---

### C.2 开始申请前收集（文档与 Manus 对齐）

- 简历优先级：Hera tailor_resume → 用户原始简历（prepare 的 resume_url）→ Manus 内置生成。
- 基本问题：工作权利、sponsorship、可工作地点、手机号、LinkedIn 等，见 `MANUS_PRE_APPLY_QUESTIONS_CHECKLIST.md`。

**验收**：Manus 在 bulk 前按清单收集；Hera 侧 prepare_application_context / tailor_resume 可稳定返回 resume_url。

---

### C.3 Bulk 流程联调

1. Manus：多轮推荐 → 用户选多个编号 → 映射为 job_ids → 对每个 job_id 并行调用 prepare_application_context。  
2. Manus：逐个执行投递任务，每个任务结束时调 record_apply_result。  
3. Hera：主站 /applications 列表以 profile.applications 为主，展示全部已选/已投职位及状态。

**验收**：  
- 选 3–5 个职位做 bulk，主站出现 3–5 条，状态随 record_apply_result 更新（Application Started → Submitted/Failed）。  
- get_user_applications 返回与主站一致，Manus 对话内摘要（Phase A）也能反映最新数量与状态。

---

### C.4 启动 Bulk Apply

- 与 Manus 确认：生产环境 MCP Base URL、MCP_SHARED_SECRET、HERA_DOMAIN、MANUS_MAGIC_LINK_SECRET 等配置正确。  
- 监控：prepare_application_context / record_apply_result 调用量、失败率；magic link 使用次数与失败（如过期、已用）。

**Phase C 完成标志**：Manus 侧可正式对用户开放「多选职位 → Bulk Apply」，用户可在 Hera 主站与 Manus 对话内看到一致状态，且从 Manus 跳转 Hera 为免登。

---

## 小结：下一步做什么

| 顺序 | 做什么 | 测试/验收 | 然后 |
|------|--------|-----------|------|
| 1 | **A.2** 实现 MCP 工具 `generate_magic_link(user_email)` | MCP 返回带 manus_token 的 URL，JWT 可解码且含 email+exp | 做 A.3 |
| 2 | **A.3** NextAuth 增加 Credentials provider，前端 /applications 接 `?manus_token=` 并 signIn | 无登录状态下带有效 token 打开链接 → 自动登录并进入 /applications | 做 A.4 |
| 3 | **A.4** 与 Manus 联调：摘要 + magic link 点击跳转免登 | 用户从 Manus 点链接进 Hera 免登 | Phase B |
| 4 | **B.1–B.3** 确认 prepare_application_context、record_apply_result，跑单次投递 E2E | 主站状态与 Manus 一致 | Phase C |
| 5 | **C.1–C.4** 编号约定、申请前清单、Bulk 联调、启动 | 多选职位 bulk 全流程在主站与 Manus 一致 | 完成 |

---

## 参考文档

- 对接一页纸（Skills 用）：`MANUS_HERA_INTEGRATION_ONE_PAGER_FOR_SKILLS.md`  
- Applications 集成与 Manus 确认结果：`MANUS_HERA_APPLICATIONS_INTEGRATION_SPEC.md`  
- 开始申请前问题清单：`MANUS_PRE_APPLY_QUESTIONS_CHECKLIST.md`  
- 轻量投递事件设计：`MANUS_LIGHTWEIGHT_APPLY_EVENTS_DESIGN.md`  
- 编排与 create_application_intent（可选 Phase 2）：`MANUS_APPLICATION_CONTEXT_IMPLEMENTATION_PLAN.md`
