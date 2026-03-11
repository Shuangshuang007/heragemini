# Manus 分层档案 + 最小 Apply 小步修改计划

## 目标（不重构、最小改动）

1. Profile 从二元「完整/不完整」改为**三阶段**：`recommendable` → `enhanced_recommendation` → `auto_apply_ready`（+ advanced/web 可到 500）。
2. `recommend_jobs` 返回量按阶段：10 / 50 / 100，高级模式最高 500。
3. `recommend_jobs` 返回结构增加：`profile_stage`、`auto_apply_ready`、`missing_fields`、`next_actions`。
4. 第一版保留 auto apply 入口：单/少量职位 → `prepare_application_context` → 交 Manus 执行，verification 先人工接管。
5. 本轮**只加一个**最小能力：`prepare_application_context`；不做 verification center、reminders、batch queue、session lane、新表。

---

## 需要改动的文件

| 文件 | 改动内容 |
|------|----------|
| `src/app/api/mcp/route.ts` | ① 分层 profile stage 计算；② 按 stage 决定 limit（10/50/100）；③ 返回补 profile_stage, auto_apply_ready, missing_fields, next_actions；④ 新增工具 `prepare_application_context` 及 handler |
| `docs/MANUS_CUSTOMER_API_DESIGN.md` | 同步「分层档案」「推荐数量」「第一版只做 prepare_application_context」说明 |

**不新增**：不新开 Manus 路由、不新表、不新 service 文件；逻辑只在现有 MCP route 内补。

---

## 步骤与顺序

### 步骤 0：备份（先做）

- **做什么**：复制并提交备份。
- **备份范围**：
  - `src/app/api/mcp/route.ts`
  - `docs/MANUS_CUSTOMER_API_DESIGN.md`
  - recommend/search 相关：当前 recommend/search 逻辑都在 `route.ts` 内，故备份该文件即覆盖。
- **执行**：复制到 `docs/backups/` 或项目内 `backups/`，带日期；然后 `git add` + `git commit -m "backup: MCP route and Manus design before staged profile + prepare_application_context"`。
- **验证**：`git log -1 --stat` 能看到备份 commit，且备份文件存在。

---

### 步骤 1：调整 recommend_jobs 的分层返回数量逻辑

- **文件**：`src/app/api/mcp/route.ts`
- **改什么**：
  - 删除或替换原先「Manus + profile 完整 → 50」的二元逻辑。
  - 引入三阶段：`recommendable` / `enhanced_recommendation` / `auto_apply_ready`；advanced/web 模式单独分支（上限 500）。
  - 按阶段设 `effectiveLimit`：recommendable=10，enhanced_recommendation=50，auto_apply_ready=100；advanced/web 时 cap 500。
  - `searchLimit` 随 `effectiveLimit` 放大（例如 `Math.max(effectiveLimit * 3, 180)`），保证有足够候选。
- **影响**：仅影响 `recommend_jobs` 的返回条数，不改变入参 schema（可选：在 schema 里加一句说明 `source` 与 advanced 的关系）。
- **验证**：用不同 profile 质量调用 recommend_jobs（仅 jobTitle+city / 补 skills+expectedPosition / 接近可投递），看返回数量是否为 10 / 50 / 100；advanced 时能否到更高（如 500）。

---

### 步骤 2：recommend_jobs 返回结构增加 profile_stage / auto_apply_ready / missing_fields / next_actions

- **文件**：`src/app/api/mcp/route.ts`
- **改什么**：
  - 在步骤 1 的 stage 计算处，同时算出：`missing_fields`（当前阶段还缺哪些字段）、`next_actions`（建议用户补什么可升阶段）。
  - 在 `recommend_jobs` 的 `json200` 的 `result` 里增加：
    - `profile_stage`: `'recommendable' | 'enhanced_recommendation' | 'auto_apply_ready'`
    - `auto_apply_ready`: boolean
    - `missing_fields`: string[]
    - `next_actions`: string[]（简短文案）
  - 保持现有 `content`、`meta`、`total` 等不变。
- **影响**：调用方（Manus/GPT）可据此展示「还缺什么」「下一步建议」；不破坏现有字段。
- **验证**：同上几种 profile 调用，检查返回中四个新字段是否符合预期（stage 与数量一致、missing 与 next_actions 合理）。

---

### 步骤 3：新增最小 prepare_application_context

- **文件**：`src/app/api/mcp/route.ts`
- **改什么**：
  - 在 GET `tools` 列表里增加一个工具：`prepare_application_context`（name + description + inputSchema）。
  - 在 POST `tools/call` 分支里增加 `name === 'prepare_application_context'` 的 handler。
  - 入参最小集：`user_email`、`job_id`（或 `application_id` 若已有；第一版可只认 job_id）。可选：`resume_url` 或由内部从 profile 取 tailor resume。
  - 返回：一段给 Manus 用的 prompt 文案 + 职位摘要 + submit_policy（如 "do_not_submit_without_explicit_user_confirmation"）+ 可选 resume 链接；不写 DB，不建 application 表。
  - 文档/注释注明：verification 遇到时由 Manus 暂停、人工接管；不做 verification center/reminders 本版。
- **影响**：多一个 MCP 工具；Manus 在用户选职位后调一次即可拿到 context 交给 Create Task。
- **验证**：用 MCP 或 curl 调用 `prepare_application_context`，传入有效 user_email + job_id，检查返回结构含 prompt 片段、job 信息、submit_policy。

---

### 步骤 4：更新文档

- **文件**：`docs/MANUS_CUSTOMER_API_DESIGN.md`
- **改什么**：
  - 在「〇、Customer API 和 GPT MCP 的区别」后或「Manus 内搜索」小节，改为**分层档案**说明：三阶段 + 推荐数量 10/50/100，advanced 最高 500。
  - 补充 `recommend_jobs` 返回结构：`profile_stage`、`auto_apply_ready`、`missing_fields`、`next_actions`。
  - 第一版能力：保留 auto apply 入口；只做 `prepare_application_context`；verification 人工接管；第二版再做 verification center、reminders、batch、100 active。
  - 不重写全文，只做最小增补/替换。
- **影响**：设计与实现一致，便于后续迭代。
- **验证**：通读修改段落，确认与 route 行为一致。

---

## 执行顺序小结

1. **步骤 0**：备份 → 提交 backup commit → 验证。
2. **步骤 1**：分层数量逻辑 → diff 摘要 + 验证。
3. **步骤 2**：返回结构四字段 → diff 摘要 + 验证。
4. **步骤 3**：`prepare_application_context` 工具 → diff 摘要 + 验证。
5. **步骤 4**：更新 MANUS_CUSTOMER_API_DESIGN.md → diff 摘要 + 验证。

每步完成后暂停，给出 diff 摘要和验证结果再进入下一步。
