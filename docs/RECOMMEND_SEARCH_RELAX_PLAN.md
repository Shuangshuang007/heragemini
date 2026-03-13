# recommend_jobs / search_jobs 放宽策略方案与现状对比

## 一、目标

- 结果不足 20 或 50 时，**希望用户能拿到更多职位**（第一轮就有足够选择）。
- **search_jobs** 也可以做一次放宽（与 recommend_jobs 一致思路），而不是永远严格。
- **硬约束**需要对照主站推荐规则重新评估，不默认「city / sponsorship 一定不能放宽」。

---

## 二、主站/文档中的规则（当前依据）

依据 `MANUS_CUSTOMER_API_DESIGN.md` 和现有实现：

| 来源 | 内容 |
|------|------|
| 分层档案 | recommendable → 10 条；enhanced_recommendation → 50 条；auto_apply_ready → 100 条；主站 advanced → 500 条 |
| 返回结构 | profile_stage、missing_fields、next_actions |
| 主站/Manus | 通过 source / X-Caller 区分，主站可拿到更多条（500） |

**文档未明确的内容：**

- 没有写「哪些条件绝不放宽」（没有硬约束清单）。
- 没有写「search_jobs 是否允许放宽」。
- 只约定了「按阶段给多少条」，没有约定「不足时是否补一枪放宽」。

因此「city、sponsorship、citizenship 必须为硬约束」是**当前实现里的假设**，并非主站文档的明确规则。

---

## 三、方案概述（先不改代码，仅方案）

### 3.1 统一思路：单次请求内「先严格，不足再放宽一次」

- **recommend_jobs**：保持现有逻辑（已实现：严格 → 若 &lt; 20/50 则一次放宽 → 合并去重）。
- **search_jobs**：**新增**与 recommend_jobs 同类的「一次放宽」逻辑：
  - 第一轮：按当前参数严格查（job_title + city，以及若有的 page/page_size 等）。
  - 若结果数 &lt; 阈值（例如 20 或 50，见下）：再跑**一轮**放宽查询，只放宽**软约束**。
  - 合并 + 去重，只做这一轮，不做多轮编排。

### 3.2 阈值建议

| 场景 | 阈值 | 说明 |
|------|------|------|
| recommend_jobs | 20（recommendable）/ 50（enhanced） | 与现有一致 |
| search_jobs | 20 或 50 | 建议与 recommend 对齐：例如统一 20，或按 page_size 上限取 min(20, page_size*2) 等 |

### 3.3 硬约束 vs 软约束（重新评估）

主站文档没有给出硬约束列表，下面分两种口径，便于对比和选型。

**口径 A（保守，接近当前实现）**

- **硬约束（绝不放宽）**：city、sponsorship_only（work rights）、以及若有的 citizenship 类字段。
- **软约束（第二轮可放宽）**：job_title 具体程度、industry、skills、workMode、employmentType、company 等。

**口径 B（与主站「多给用户选择」对齐）**

- **硬约束**：仅保留「用户明确表达的“只要”类」+ 法律/合规相关：
  - 用户明确「只要 onsite / 只要 remote」→ workMode 不放宽；
  - sponsorship_only / work rights / citizenship 相关 → 不放宽（合规）；
  - 若用户明确「只要某城市」可视为不放宽 city，否则 city 可在放宽轮作为软约束（例如先放宽到同州/同国）。
- **软约束**：其余皆可放宽，包括 city（在用户未强调「只要某城」时）、industry、title、skills、workMode/employmentType（未强调「只要」时）、company。

**建议**：先按**口径 A** 实现 search_jobs 的放宽（保持 city、sponsorship 为硬约束），避免行为变化过大；主站若后续有明确「主站推荐规则」文档，再向口径 B 收敛。

---

## 四、search_jobs 放宽实现要点（方案层）

- **FAST 模式**：当前是 title + city + page + page_size + postedWithinDays + platforms，一次 `fastDbQuery`。  
  - 放宽轮：可保留 city（口径 A）、去掉或放宽 title 匹配（例如只保留 title 的部分词或同义），再查一次，合并去重。
- **FULL 模式**：当前是 GPT plan → `fetchFromDatabase(jobTitle, city, limit)` → postProcess。  
  - 放宽轮：在 DB 层或 plan 层做一次「放宽 title/其他软约束」的查询，合并去重后再 postProcess。
- 两模式都：**仅增加一次放宽查询 + 合并去重**，不做多轮编排。

---

## 五、与当前实现的差异对比

| 维度 | 当前实现 | 方案（建议） |
|------|----------|--------------|
| **search_jobs** | 严格搜索，无放宽；结果少就少 | 与 recommend 一致：先严格，若结果 &lt; 20（或 50）则**一次**放宽查询，合并去重，再返回 |
| **recommend_jobs** | 已实现：严格 → 若 &lt; 20/50 则一次放宽（仅软约束），合并去重 | 保持现状；可选：后续若主站明确规则，再调整「硬约束」清单 |
| **硬约束** | 当前代码中视为硬约束：city、sponsorship_only；放宽轮不放松 | 方案 A：维持不变。方案 B（可选）：仅「用户明确 only」+ 合规相关为硬约束；city 在未强调时可参与放宽 |
| **软约束** | industry、skills、workMode、employmentType（recommend 放宽轮已不传） | 与现有一致；search_jobs 的放宽轮同样只放宽软约束（如 title 具体程度、industry 等，若未来 search 支持这些参数） |
| **阈值** | recommend：20 / 50（按 profile_stage） | search_jobs 新增阈值 20 或 50（可配置或与 recommend 对齐） |
| **多轮/复杂度** | 单轮严格；recommend 仅多一次放宽 | 仍为「单次请求内最多 2 次查询」，无多轮编排 |

---

## 六、小结

1. **search_jobs**：建议增加「结果 &lt; 20 或 50 时做一次放宽」，与 recommend_jobs 一致思路，保证用户第一轮能拿到更多职位。
2. **硬约束**：主站文档未明确列出；当前实现把 city、sponsorship 当硬约束是合理保守选择；若主站后续有「推荐规则」文档，可再收窄为「仅 explicit only + 合规」为硬约束（口径 B）。
3. **实现范围**：先为 search_jobs（FAST/FULL）增加一层「不足则一次放宽 + 合并去重」，recommend_jobs 逻辑不变；硬/软约束清单暂按口径 A，与现有 recommend 行为一致。

未改代码，仅方案与对比；确定采用后再落实现。
