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

## 2. 职位列表与详情（第一轮仅列表层，按需拉详情）

- **recommend_jobs / search_jobs / refine_recommendations** 第一轮只返回**列表层**（与主站 Job List 同维度）：`result.job_cards[]` 每项为 `{ card: { id, title, company, location, platform, jobUrl, postedDate, salary, employmentType, workMode, experienceTag, skillsMustHave, keyRequirements, matchScore, subScores, highlights, summary } }`，**不含**完整 job_detail，以节省成本与加快响应。
- **「Show more about #x」**：用户说「show me more about #3」「tell me more about that role」「I want more details」时，Manus 调 **get_job_detail**：传 `job_id`（来自 `job_cards[i].card.id` 或 `meta.returned_job_ids[i]`），可选 `user_email`。Hera 返回 `result.job_detail`（完整详情，与主站详情页一致）。**若传了 `user_email`，该职位会同步写入 profile.applications（视为兴趣/JobSaved）**，主站 Applications 会显示；只有用户明确「不要 #x」时再调 refine 传 `disliked_job_ids` 才会排除。
- **refine_recommendations** 默认每轮最多返回 **50** 条（与 recommend 同量级）；「show me more」时请传上一轮的 `meta.returned_job_ids` 作为 `exclude_ids`，以拿到下一批不重复的职位。

---

## 3. 与 Applications 相关的工具与调用时机

| 时机 | 工具 | 要点 |
|------|------|------|
| 用户说「show me more #3」「show details of #5」要**看详情** | **get_job_detail** | 传 `job_id`（对应 #3 的 id）。可选 `user_email`：传则写入 profile.applications（兴趣），主站可见。返回 `job_detail` 供展示。 |
| 用户表达兴趣或选定要投的职位（不一定要详情） | **refine_recommendations** | 传 `user_email` + `liked_job_ids` 或 `liked_indexes`（1-based）。Hera 会把这些 job 写入 profile.applications（JobSaved），并用于后续推荐。 |
| 用户说「不要 #x」「排除 #x」 | **refine_recommendations** | 传 `user_email` + `disliked_job_ids` 或 `disliked_indexes`。Hera 会在 profile.applications 中标记为 `excluded`（软删除），主站不展示。 |
| 开始对某职位执行申请（含 bulk 中每一个） | **prepare_application_context** | 传 `user_email` + `job_id`（或 `application_id`）。Hera 返回 prompt_snippet、job_snapshot、resume_url 等，并写入该职位的 applicationStartedBy=manus。Bulk 时对每个选中职位并行调用。 |
| 某职位投递结束（成功或失败） | **record_apply_result** | 传 `user_email`、`job_id`、`application_status`（`"submitted"` \| `"failed"`）、`applied_via: "manus"`，可选 `failure_reason`。Hera 更新主站 Applications 页状态。 |

---

## 4. 编号规则（Bulk 选职位）

- 第一轮推荐：1–50  
- 第二轮：51–100  
- 第三轮：101–150  
- 用户用编号选时，Manus 将编号映射回 job_id，再对每个 job_id 调 prepare_application_context，投递结束后逐一调 record_apply_result。

---

## 5. 简历优先级（开始申请前）

1. Hera **tailor_resume**（按 JD 定制）  
2. 若 tailor 失败/超时 → 用户上传的**原始简历**（prepare_application_context 的 resume_url）  
3. 最后才用 **Manus 内置生成**  

开始申请前建议统一收集：工作权利、是否需要 sponsorship、可工作地点、手机号、LinkedIn、当前公司是否可联系等；清单见 `MANUS_PRE_APPLY_QUESTIONS_CHECKLIST.md`。

---

## 6. 主站 Applications 页与数据源

- 用户打开 Hera 主站 **/applications** 可看到：Job Title、Job Details、Apply Link、Start Application（Manus 调过 prepare 则显示绿色「Application Started」）、Tailor Application、Application Status、Hiring Status。
- 列表**以 profile.applications 为主**（有记录即显示，含仅由 Manus 回传产生的记录），再合并主站「已保存职位」；被用户「不要 #x」的会软删除（excluded），不展示。

### 6.1 对话内摘要与跳转 Hera 免登（方案 A）

- Manus 对话内可展示投递摘要：总投递数、成功/失败（含原因）、最近 1 天列表；文末一句「管理完整投递记录请前往 Hera」+ 可点击链接。
- **get_user_applications**：Manus 直接调用即可得到上述摘要所需数据，无需新接口。
- **跳转免登**：Manus 调用 Hera 的 **generate_magic_link(user_email)**（MCP 工具），将返回的 URL 作为「点击跳转」链接；用户点击后在 Hera 用短期 token 自动登录，进入 /applications，无需再输密码。实施步骤与测试见 `MANUS_HERA_IMPLEMENTATION_ROADMAP.md`。

---

## 7. record_apply_result 入参一览

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_email | string | ✅ | 用户邮箱 |
| job_id | string | ✅ | 职位 ID |
| application_status | string | ✅ | `"submitted"` \| `"failed"` |
| applied_via | string | 否 | 默认 `"manus"` |
| failure_reason | string | 否 | 失败时原因，如 "email_verification_timeout"、"form_field_missing"、"captcha_blocked" |

---

## 8. 接入前自测（Hera 本地）

在接入 Manus 前可在 Hera 本地跑一遍模拟调用，确认 MCP 与 Applications API 正常：

```bash
# 确保 .env.local 有 MCP_SHARED_SECRET，本地已启动 npm run dev（端口 3002）
node scripts/test_manus_integration_pre.js
```

脚本会依次：recommend_jobs 取 job_id → refine_recommendations (liked) → prepare_application_context → record_apply_result → GET /api/applications 校验。可选环境变量：`MCP_TEST_BASE_URL`（默认 http://localhost:3002）、`MANUS_TEST_EMAIL`（默认 manus-pre-test@example.com）、`SKIP_RECOMMEND=1`（跳过 recommend，用 `TEST_JOB_ID` 或占位 job_id 只测后续步骤）。

---

## 9. 参考文档

- **实施路线图（按步骤、含摘要与免登）**：`MANUS_HERA_IMPLEMENTATION_ROADMAP.md` — 从「推荐/多轮职位」到「Interested + 对话内摘要与跳转 Hera 免登（方案 A）」再到「Bulk Apply」的完整步骤与测试。
- 完整对接与字段说明：`MANUS_HERA_APPLICATIONS_INTEGRATION_SPEC.md`  
- 开始申请前基本问题：`MANUS_PRE_APPLY_QUESTIONS_CHECKLIST.md`  
- 现有 MCP 使用说明：`MANUS_ADD_CUSTOM_API_NOTE.txt`  

以上为当前一版，Hera 侧已按此实现；Manus 接入前可跑 `scripts/test_manus_integration_pre.js` 自测，写 Skills 时可直接引用本页与上述文档。
