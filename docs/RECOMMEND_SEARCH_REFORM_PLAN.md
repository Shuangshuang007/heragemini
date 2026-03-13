# recommend_jobs / search_jobs 统一改造方案（仅方案，不改动代码）

## 一、要解决的问题

1. **recommend_jobs**：已做「严格 → 不足则一次放宽」，需明确硬/软约束、地理位置、sponsorship 在主站与 MCP 的约定。
2. **search_jobs**：目前严格不放宽；希望结果不足 20/50 时也能做一次放宽，给用户更多选择。
3. **地理位置**：主站用 greaterArea（core+fringe）查；MCP 用 city 对 locations 做 regex。是否统一、何时放宽 city。
4. **Sponsorship**：主站打分只用了 citizenshipRequired + requiresStatus，未用 sponsorship 字段；主站列表不按 sponsorship 筛。MCP 有 sponsorship_only 筛选。放宽时是否仍把 sponsorship 当硬约束。
5. **其他维度**：industry、skills、workMode、employmentType 已按软约束处理（放宽时可去掉）。

---

## 二、原则（不改动的前提约定）

- **单请求内最多两轮**：先严格，不足则一次放宽，合并去重，不做多轮编排。
- **硬约束**：在放宽轮**绝不放松**的条件。
- **软约束**：在放宽轮可以去掉或放宽的条件。
- **主站对齐**：主站（heraai.one）已有的规则（如 greaterArea、jobMatch 的 work rights 打分）作为参考，MCP 可选用或与主站共享同一套逻辑。

---

## 三、各维度方案

### 3.1 地理位置（city / locations）

| 项目 | 现状 | 方案建议 |
|------|------|----------|
| **主站** | Hot Jobs 用 greaterArea（core+fringe）查 locations；jobMatch 用 getLocationWeight（fringe 0.85）调分。 | 保持现状。 |
| **MCP recommend_jobs / search_jobs** | 用 `city` 对 `locations` 做 regex，未用 greaterArea。 | **可选**：在 `queryJobsWithFilters` 或调用前，若 city 在 greaterAreaMap 有定义，则用 core+fringe 拼成 locations 的 $or 或 regex，与主站 Hot Jobs 一致；若无定义则保持「city regex」。不要求必须改，属增强。 |
| **放宽轮是否放宽 city** | 当前 recommend_jobs 放宽轮保留 city（硬约束）。 | **建议**：city 仍为硬约束，放宽轮不放松。理由：主站是「同城大区」扩展（core+fringe），不是「换城」；若放宽到其他城市需产品单独拍板。 |

### 3.2 Sponsorship（workRights.sponsorship）

| 项目 | 现状 | 方案建议 |
|------|------|----------|
| **主站** | 列表不按 sponsorship 筛；jobMatch 只对 citizenshipRequired、requiresStatus 减分，**未用 sponsorship 字段**。 | **可选**：若产品希望主站也体现「用户需要 sponsor / 职位不提供」则减分，可在 `checkWorkRightsMatch` 中增加对 `job.sponsorship` 与用户「是否需要 sponsorship」的判断并给 penalty；否则保持现状。 |
| **MCP** | 有 `sponsorship_only` 筛选（只返回 available/required）；放宽轮仍带 sponsorship_only（硬约束）。 | **建议**：维持「sponsorship 当硬约束」——用户显式要「仅看能 sponsor 的」时，放宽轮仍不返回 not_available。不在放宽时悄悄放宽 sponsorship。 |
| **统一** | 主站无 sponsorship 打分、MCP 有 sponsorship 筛选。 | 方案阶段不强制主站加 sponsorship 打分；若加，建议与 MCP 的 sponsorship_only 语义一致（available/required = 可/需担保）。 |

### 3.3 硬约束 vs 软约束（统一清单）

| 约束 | 建议类型 | 说明 |
|------|----------|------|
| **city** | 硬 | 放宽轮不放松；可选增强为 greaterArea 查。 |
| **sponsorship_only** | 硬 | 用户传 true 时，放宽轮仍只返回 sponsorship 为 available/required。 |
| **job_title** | 软（可放宽） | 放宽轮可保留「同城+标题模糊」或仅同城，视产品；当前实现是保留 jobTitle。 |
| **industry** | 软 | 放宽轮去掉。 |
| **skills** | 软 | 放宽轮去掉。 |
| **workMode** | 软 | 放宽轮去掉。 |
| **employmentType** | 软 | 放宽轮去掉。 |
| **company** | 软 | 若有 company 筛选，放宽轮去掉。 |

不新增「citizenship / requiresStatus 当硬约束」的筛选参数；主站打分里已用这两项减分，MCP 若将来要筛可再加参数。

### 3.4 recommend_jobs

| 项目 | 现状 | 方案建议 |
|------|------|----------|
| 流程 | 严格 → 若 &lt; 20/50 则一次放宽（去掉 industry/skills/workMode/employmentType），合并去重。 | 保持。 |
| 硬约束 | city、sponsorship_only 在放宽轮保留。 | 明确写入注释/文档：硬约束仅此两个（+ 若有 excludeIds）。 |
| 阈值 | 20（recommendable）/ 50（enhanced）。 | 保持。 |
| 地理位置 | 未用 greaterArea。 | 可选：在构建 query 时对 city 用 greaterArea（若有），与主站一致。 |
| 其他 | - | 无必改项。 |

### 3.5 search_jobs

| 项目 | 现状 | 方案建议 |
|------|------|----------|
| 流程 | 仅严格查询，不放宽。 | **增加**：与 recommend_jobs 一致，先严格；若结果数 &lt; 阈值（建议 20 或与 page_size 对齐），再跑**一轮**放宽查询（只放宽软约束），合并去重后返回。 |
| 阈值 | 无。 | 建议 20，或 min(20, page_size * 2)；与 recommend 对齐即可。 |
| 硬约束 | 无放宽故无区分。 | 放宽轮保留：city（及若未来有 sponsorship_only 则保留）。 |
| 软约束 | 无。 | 放宽轮：若有 industry/skills/workMode/employmentType 等参数则去掉；title 可保留或做模糊（与 recommend 一致）。 |
| 地理位置 | FAST 用 title+city；FULL 用 GPT plan + fetchFromDatabase。 | 可选：DB 查询用 greaterArea（若 city 有定义）；不做强制。 |

### 3.6 主站 jobMatch 与 sponsorship

| 项目 | 现状 | 方案建议 |
|------|------|----------|
| 打分 | citizenshipRequired、requiresStatus 不满足则 otherScore 减 10%。sponsorship 未参与。 | **可选**：若产品希望「用户需要 sponsorship 而职位 not_available 时减分」，在 `checkWorkRightsMatch` 中增加：用户需 sponsor 且 job.sponsorship === 'not_available' → 给 penalty（如 0.1）；反之「用户需 sponsor 且职位 available/required」可不减分或微加分。具体比例与主站产品约定。 |
| 不改动 | - | 若暂不动主站打分，则仅文档注明：主站目前无 sponsorship 维度打分，仅 MCP 有 sponsorship_only 筛选。 |

---

## 四、实施顺序建议（仍不改动，仅顺序）

1. **明确并文档化**：在代码或设计文档中写死「recommend_jobs / search_jobs 硬约束 = city + sponsorship_only」；软约束 = industry, skills, workMode, employmentType（+ 可选 company）。
2. **search_jobs 增加一次放宽**：在 search_jobs 的 FAST 与 FULL 分支中，当结果 &lt; 阈值时，各做一次「仅放宽软约束」的查询，合并去重；不放松 city（及未来若有的 sponsorship_only）。
3. **地理位置（可选）**：在 `queryJobsWithFilters` 或调用层，若传入的 city 在 greaterAreaMap 存在，则用 core+fringe 生成 locations 条件，与主站 Hot Jobs 一致。
4. **主站 sponsorship 打分（可选）**：产品确认后，在 `checkWorkRightsMatch` 中增加对 `sponsorship` 的判断及 penalty，与 MCP 的 sponsorship_only 语义一致。

---

## 五、小结表

| 维度 | recommend_jobs | search_jobs | 主站 (jobs 页) |
|------|----------------|-------------|----------------|
| 放宽 | 已有，&lt;20/50 一次放宽 | **建议加**：&lt; 阈值一次放宽 | 不涉及（列表来自 job-fetch-service） |
| 硬约束 | city, sponsorship_only | 放宽轮同左 | - |
| 软约束 | industry, skills, workMode, employmentType | 同左 | - |
| 地理位置 | 可选 greaterArea | 可选 greaterArea | 已用 greaterArea（Hot Jobs） |
| Sponsorship | 筛选：sponsorship_only；放宽不放松 | 若将来支持该参数则同 recommend | 打分可选：补 sponsorship 维度 |

以上为方案，**不做任何代码改动**；若需要某一条落进实现再按此方案改。
