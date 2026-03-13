# Hera–Manus 对接说明（一版，供 Manus 写 Skills 用）

本文档汇总 Hera 侧已实现的对接点与约定，便于 Manus 侧编写 Skills 时引用。详细字段与流程见 `MANUS_HERA_APPLICATIONS_INTEGRATION_SPEC.md`，开始申请前问题清单见 `MANUS_PRE_APPLY_QUESTIONS_CHECKLIST.md`。

---

## 1. 入口与鉴权

- **Base URL**：`https://www.heraai.net.au`（必须带 www）
- **Endpoint**：`POST /api/mcp`
- **鉴权**：`Authorization: Bearer <MCP_SHARED_SECRET>`
- **协议**：JSON-RPC 2.0，`Content-Type: application/json`
- **方法**：`tools/list`（发现工具）、`tools/call`（执行工具，params: `name`, `arguments`）

---

## 2. 与 Applications 相关的工具与调用时机

| 时机 | 工具 | 要点 |
|------|------|------|
| 用户说「show me more #3」「show details of #5」或选定要投的职位 | **refine_recommendations** | 传 `user_email` + `liked_job_ids` 或 `liked_indexes`（1-based）。Hera 会把这些 job 写入 profile.applications（JobSaved），并用于后续推荐。 |
| 用户说「不要 #x」「排除 #x」 | **refine_recommendations** | 传 `user_email` + `disliked_job_ids` 或 `disliked_indexes`。Hera 会把这些 job 在 profile.applications 中标记为 `excluded`（软删除），主站不展示。 |
| 开始对某职位执行申请（含 bulk 中每一个） | **prepare_application_context** | 传 `user_email` + `job_id`（或 `application_id`）。Hera 返回 prompt_snippet、job_snapshot、resume_url 等，并写入该职位的 applicationStartedBy=manus。Bulk 时对每个选中职位并行调用。 |
| 某职位投递结束（成功或失败） | **record_apply_result** | 传 `user_email`、`job_id`、`application_status`（`"submitted"` \| `"failed"`）、`applied_via: "manus"`，可选 `failure_reason`（string，如 "email_verification_timeout"）。Hera 更新主站 Applications 页状态。 |

---

## 3. 编号规则（Bulk 选职位）

- 第一轮推荐：1–50  
- 第二轮：51–100  
- 第三轮：101–150  
- 用户用编号选时，Manus 将编号映射回 job_id，再对每个 job_id 调 prepare_application_context，投递结束后逐一调 record_apply_result。

---

## 4. 简历优先级（开始申请前）

1. Hera **tailor_resume**（按 JD 定制）  
2. 若 tailor 失败/超时 → 用户上传的**原始简历**（prepare_application_context 的 resume_url）  
3. 最后才用 **Manus 内置生成**  

开始申请前建议统一收集：工作权利、是否需要 sponsorship、可工作地点、手机号、LinkedIn、当前公司是否可联系等；清单见 `MANUS_PRE_APPLY_QUESTIONS_CHECKLIST.md`。

---

## 5. 主站 Applications 页与数据源

- 用户打开 Hera 主站 **/applications** 可看到：Job Title、Job Details、Apply Link、Start Application（Manus 调过 prepare 则显示绿色「Application Started」）、Tailor Application、Application Status、Hiring Status。
- 列表**以 profile.applications 为主**（有记录即显示，含仅由 Manus 回传产生的记录），再合并主站「已保存职位」；被用户「不要 #x」的会软删除（excluded），不展示。

---

## 6. record_apply_result 入参一览

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_email | string | ✅ | 用户邮箱 |
| job_id | string | ✅ | 职位 ID |
| application_status | string | ✅ | `"submitted"` \| `"failed"` |
| applied_via | string | 否 | 默认 `"manus"` |
| failure_reason | string | 否 | 失败时原因，如 "email_verification_timeout"、"form_field_missing"、"captcha_blocked" |

---

## 7. 接入前自测（Hera 本地）

在接入 Manus 前可在 Hera 本地跑一遍模拟调用，确认 MCP 与 Applications API 正常：

```bash
# 确保 .env.local 有 MCP_SHARED_SECRET，本地已启动 npm run dev（端口 3002）
node scripts/test_manus_integration_pre.js
```

脚本会依次：recommend_jobs 取 job_id → refine_recommendations (liked) → prepare_application_context → record_apply_result → GET /api/applications 校验。可选环境变量：`MCP_TEST_BASE_URL`（默认 http://localhost:3002）、`MANUS_TEST_EMAIL`（默认 manus-pre-test@example.com）、`SKIP_RECOMMEND=1`（跳过 recommend，用 `TEST_JOB_ID` 或占位 job_id 只测后续步骤）。

---

## 8. 参考文档

- 完整对接与字段说明：`MANUS_HERA_APPLICATIONS_INTEGRATION_SPEC.md`  
- 开始申请前基本问题：`MANUS_PRE_APPLY_QUESTIONS_CHECKLIST.md`  
- 现有 MCP 使用说明：`MANUS_ADD_CUSTOM_API_NOTE.txt`  

以上为当前一版，Hera 侧已按此实现；Manus 接入前可跑 `scripts/test_manus_integration_pre.js` 自测，写 Skills 时可直接引用本页与上述文档。
