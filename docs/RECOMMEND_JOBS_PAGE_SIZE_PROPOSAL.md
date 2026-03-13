# recommend_jobs 一次性返回 50/100 方案（Manus 反馈）

## 一、Manus 反馈摘要

- API 目前被理解为「对话式分页」：每次 5 个，用户说 "more" 继续。
- Manus 希望**一次性展示 50 甚至 100 张卡片**，建议在 API 增加 `page_size=50` 或 `return_all=true`，一次拿到全部数据再渲染，而不是多轮对话拼凑。

---

## 二、当前后端实际行为（澄清）

| 项目 | 说明 |
|------|------|
| **单次请求返回条数** | 一次 `recommend_jobs` 调用**已经**返回一整批职位，数量由 **profile 阶段** 决定：recommendable → 最多 **10**，enhanced → 最多 **50**，auto_apply_ready → 最多 **100**。 |
| **结构化数据** | `result.job_cards` 和 `meta.returned_job_ids` 里是**本批全部**职位（最多 10/50/100），不是 5 条。 |
| **「5 条」来源** | 只有 **Markdown 文案**（`result.content[0].text`）里用 `buildMarkdownCards` 只渲染了**前 5 条**，用于聊天界面可读性；**不影响** `job_cards` / `returned_job_ids` 的长度。 |
| **是否分页** | 没有「每页 5 条、翻页」的接口设计。如需「更多」，应走 `refine_recommendations` + `exclude_ids`，拿到**下一批**不重复的推荐。 |

结论：若 Manus 使用 **`result.job_cards`**（及 `meta.returned_job_ids`）做卡片 UI，**单次调用已经可以拿到当前阶段允许的最大条数**（10/50/100）。若之前只解析了 Markdown，会误以为只有 5 条。

---

## 三、建议方案：增加 `page_size` 参数（不直接改代码，仅方案）

目标：让 Manus 能**显式请求「这一批我要最多 50 条 / 100 条」**，便于一次性展示 50/100 张卡片，同时后端继续用 profile 阶段做上限保护。

### 3.1 参数设计

- **参数名**：`page_size`（与现有 `listing_search` 的 `page_size` 命名一致，语义清晰）。
- **类型**：`integer`，可选。
- **取值**：建议允许 `10 | 20 | 50 | 100`（或 10–100 连续，由你们定）。
- **默认**：不传时沿用现有逻辑（即由 profile 阶段决定 10/50/100）；若希望 Manus 默认就冲满，可把默认设为 `50`（与当前 `limit` default 50 对齐）。

### 3.2 与现有 `limit` 的关系

- 当前已有 **`limit`**（default 50, min 5, max 100），实际生效条数由 **effectiveLimit = min(limit, stageLimit)** 决定（stageLimit 即 10/50/100）。
- 两种做法二选一（或选一种后对外只宣传一个）：
  - **方案 A**：**不新增** `page_size`，在文档里明确写：**一次性展示请用 `result.job_cards`**；要 50 条就传 `limit=50` 且保证 user_profile 满足 enhanced（即有 skills 或 experience）；要 100 条就传 `limit=100` 且满足 auto_apply_ready（含 employmentHistory）。Manus 传对 `limit` + profile 即可一次拿 50/100。
  - **方案 B**：**新增 `page_size`**，语义为「本批希望返回的最大条数」；与 `limit` 二选一或并存时：**effectiveLimit = min(stageLimit, page_size ?? limit)**，并约定 `page_size` 最大 100。这样 Manus 可显式传 `page_size=50` 或 `page_size=100`，表达「我要一次性拿满 50/100 做卡片展示」。

### 3.3 不建议 `return_all=true`

- 「return_all」容易让人理解为「忽略所有限制、返回库里全部职位」，与当前「按 profile 阶段封顶 10/50/100」的设计冲突。
- 若只是「按当前 profile 允许的上限一次返回」，用 **`page_size=100`**（或 `limit=100`）即可表达，无需再增加布尔参数。

### 3.4 实现要点（若采用方案 B）

1. **Schema**：在 `recommend_jobs` 的 `inputSchema.properties` 中增加 `page_size`（integer, 10–100，可选）。
2. **逻辑**：在计算 `effectiveLimit` 时，若传入 `page_size`，则：  
   `effectiveLimit = min(stageLimit, page_size)`（再与现有 advanced 模式 500 上限等逻辑兼容）。
3. **文档**：在 MANUS_ADD_CUSTOM_API_NOTE 或给 Manus 的说明里写清：
   - 一次性展示 50 张卡片：传 `page_size=50`（或 `limit=50`），并保证 user_profile 至少带 skills 或 experience（enhanced）。
   - 一次性展示 100 张：传 `page_size=100`（或 `limit=100`），并保证 user_profile 带 employmentHistory（auto_apply_ready）。
   - 卡片数据以 **`result.job_cards`** 为准，不要以 Markdown 条数为准。

---

## 四、给 Manus 的简短说明（可抄送）

- **单次调用**：一次 `recommend_jobs` 已经返回**一整批**推荐（最多 10/50/100，由用户 profile 完整度决定），不是「每次 5 条」。
- **一次性展示 50/100 张卡片**：请使用 **`result.job_cards`**（及 `meta.returned_job_ids`）；`content[0].text` 仅为聊天预览（前 5 条）。
- **可选增强**：若希望显式请求「本批最多 50 条 / 100 条」，后端可增加 **`page_size`**（例如 50 或 100），届时传 `page_size=50` 或 `page_size=100` 即可一次拿到对应条数（仍受 profile 阶段上限约束）。

---

## 五、小结

| 选项 | 说明 |
|------|------|
| **不增参数** | 维持现状，文档澄清：用 `job_cards` + `limit`，配合 profile 即可一次拿 50/100。 |
| **增加 page_size** | 显式「本批最大条数」，effectiveLimit = min(stageLimit, page_size)；Manus 传 page_size=50 或 100 即可。 |

建议：先和 Manus 确认是否已用 **`result.job_cards`** 做渲染；若是，可能只需文档澄清即可。若仍希望「显式请求 50/100」的语义，再采用方案 B 增加 `page_size`。
