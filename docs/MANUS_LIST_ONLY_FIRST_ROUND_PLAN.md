# Manus 第一轮只传 Job List、按需传详情的修改方案（仅方案，不改代码）

## 一、目标与背景

- **目标**：从节约成本和响应速度出发，在 **Job search / recommend / refine 第一轮** 只传「与主站 Job List 一致的列表层信息」，不传每条职位的完整详情（job_detail）。当用户说 **interested** 或 **show more about #x** 时，再通过现有 follow-up 或新工具按需拉取该职位的完整分析。
- **对齐基准**：主站 `/jobs` 页在「列表阶段」展示的内容 = 列表层字段范围，务必全面、不少。

---

## 二、主站 Job List 使用的字段（对齐基准）

主站列表由 `JobSummaryCard` 渲染，数据来自 `Job` 类型（含 `transformMongoDBJobToFrontendFormat` + 打分后的 safeJobs）。**列表可见**的字段如下（与主站一致、不遗漏）：

| 分类 | 字段 | 说明 | 主站列表是否展示 |
|------|------|------|------------------|
| 基础 | id | 职位唯一 ID | 用于选中、Apply、Tailor |
| 基础 | title | 职位标题 | ✅ 卡片标题 |
| 基础 | company | 公司名 | ✅ 副标题 |
| 基础 | location | 地点（字符串或数组） | ✅ 位置行 |
| 基础 | platform | 来源（CorporateDirect / PublicSector 等） | ✅ 角标 |
| 基础 | jobUrl / url | 申请链接 | ✅ Apply 按钮 |
| 时间/薪资 | postedDate | 发布日期（如 "27d ago"） | ✅ 位置行旁 |
| 时间/薪资 | salary | 薪资描述 | ✅ 位置行旁（格式化） |
| 标签 | employmentType | 如 Full time | ✅ Tag |
| 标签 | workMode | 如 On-site / Remote / Hybrid | ✅ Tag |
| 标签 | experienceTag | 经验（如 "3+ yrs exp"） | ✅ Tag |
| 标签 | skillsMustHave | 必须技能（卡片上最多 2–3 个 Tag） | ✅ Tag |
| 标签 | keyRequirements | 关键要求（无 skillsMustHave 时作 Tag 来源） | ✅ Tag |
| 匹配 | matchScore | 总分 0–100 | ✅ 显眼展示 |
| 匹配 | subScores | experience / industry / skills / other | ✅ 与 Match 同行 |
| 匹配 | matchHighlights 或 highlights | 匹配高亮（卡片上 bullet 列表） | ✅ 列表内 |
| 匹配 | summary | 列表用摘要（listSummary） | ✅ 列表内 |

**主站列表不展示、仅在详情/Modal 用的**（第一轮可不传，留给「show more」）：  
`matchAnalysis`、`detailedSummary`、`skillsNiceToHave`（完整）、`workRights`（主站卡片未用）、`industry`（主站卡片未用）。

为与主站完全对齐且「全面不要少」，**第一轮列表层**应包含上表中所有「主站列表展示」的字段；`industry`、`workRights` 若主站列表未用可不在列表层带，但若主站后续在列表展示则可一并带上。

---

## 三、当前 MCP 与主站对比

### 3.1 recommend_jobs（当前）

- **content**：Markdown 文本（buildMarkdownCards），已包含 matchScore、subScores、summary、highlights、keyRequirements、skillsMustHave、skillsNiceToHave、workRights、Apply 等，与主站信息量接近但为整段文本。
- **job_cards**（Manus 用）：
  - **card**：仅 7 个字段 — id, title, company, location, matchScore, highlights_preview(2), jobUrl。**缺少**：platform, postedDate, salary, employmentType, workMode, experienceTag, skillsMustHave/keyRequirements, subScores, summary。
  - **detail**：完整（summary, skillsMustHave, skillsNiceToHave, keyRequirements, highlights, subScores, industry, employmentType, workMode, workRights, salary, matchAnalysis, jobUrl）。
  - **manus=true 时**：每条还带 **job_detail**（= detail），即第一轮就传了全部详情 → 体积大、成本高。

结论：第一轮若只传「列表层」，应让 **job_cards[].card** 扩成「主站列表层」全部字段，并**不再在第一轮带 detail / job_detail**。

### 3.2 refine_recommendations（当前）

- 只返回 **content**（Markdown）+ **meta**（returned_job_ids 等），**没有 job_cards**。
- 若 Manus 要结构化列表，需与 recommend 一致：refine 也返回 **job_cards**，且每条仅「列表层」（与主站 list 对齐），不带 detail。

### 3.3 search_jobs（当前）

- 返回 content（Markdown）+ meta；部分路径有 safeJobs，但未暴露结构化 job_cards。若要对齐「第一轮都是 list」，search 也可在返回中增加 **job_cards**（仅列表层），与 recommend/refine 一致。

---

## 四、列表层字段定义（与主站 Job List 严格对齐）

以下为「第一轮」每条职位**唯一**返回的结构（不再区分 card/detail，只一个 list 对象；或保留 key 名 `card` 但内容扩展为完整列表层）。字段名与主站 `Job` / safeJobs 一致：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 职位 ID |
| title | string | 职位标题 |
| company | string | 公司名 |
| location | string | 地点（数组时取主地点或拼接） |
| platform | string | 来源标签 |
| jobUrl | string | 申请链接 |
| postedDate | string \| null | 发布日期（如 "27d ago"） |
| salary | string \| null | 薪资描述 |
| employmentType | string \| null | 如 Full time |
| workMode | string \| null | 如 On-site / Remote / Hybrid |
| experienceTag | string \| null | 经验标签 |
| skillsMustHave | string[] | 必须技能（列表层可只给前 3 个用于 Tag） |
| keyRequirements | string[] | 关键要求（列表层可只给前 3 个） |
| matchScore | number \| null | 匹配总分 |
| subScores | { experience?, industry?, skills?, other? } \| null | 子维度得分 |
| highlights | string[] | 匹配高亮（主站用 matchHighlights 或 highlights；列表可 2–3 条） |
| summary | string | 列表摘要（listSummary） |

可选（若主站列表已用或即将用）：**industry**、**workRights**。  
不放入列表层：matchAnalysis、detailedSummary、完整 skillsNiceToHave（可仅在「详情」返回）。

---

## 五、修改方案概要

### 5.1 recommend_jobs

1. **列表层唯一**  
   - 第一轮只返回「列表层」：将当前 `job_cards[].card` 扩展为上述完整列表层字段（与主站一致），**不再**在首轮返回 `detail`、`job_detail`。
   - 可选：保留 `include_detail: boolean`（默认 false）；为 true 时仍可兼容旧行为「首轮带 detail」（给非 Manus 或测试用）。

2. **manus 参数**  
   - `manus=true` 时：仅返回列表层（无 job_detail）；或保留 `manus` 但语义改为「返回结构化 job_cards」，结构为「仅 list」。
   - 文档注明：Manus 第一轮只消费列表层；需要某条完整分析时请调 `get_job_detail`。

3. **文案**  
   - 在返回的 content 或 meta 的提示语中增加：用户可通过「show more about #x」获取该职位的更全面分析。

### 5.2 refine_recommendations

1. **增加 job_cards**  
   - 与 recommend 一致：返回 **job_cards**，每条仅「列表层」结构（同上表），**不带** detail。

2. **数据来源**  
   - 从当前 `results`（transformMongoDBJobToFrontendFormat + 打分）构造列表层对象，字段与 recommend 的列表层、主站 Job List 完全一致。

3. **文案**  
   - 同样在提示语中说明：可通过「show more about #x」获取更全面分析。

### 5.3 search_jobs

1. **可选**  
   - 为与 recommend/refine 一致，search 也可在结果中增加 **job_cards**（仅列表层），便于 Manus 统一用「列表 + 按需详情」模型。若当前仅用 Markdown 也可暂不改，在文档中说明「第一轮 list 以 recommend/refine 的 job_cards 为准」。

### 5.4 「Show more / Interested」与按需详情

1. **现有 follow-up**  
   - 在现有 follow-up 逻辑上，提示用户：「可以通过提问 show more about #x 得到更全面的分析」。

2. **按需详情实现方式二选一（或并存）**  
   - **方案 A**：新增工具 **get_job_detail**  
     - 入参：`job_id`（必填），可选 `user_email` / `session_id`（用于个性化摘要等）。  
     - 返回：该职位完整详情（即当前 recommend 的 detail 内容：summary, skillsMustHave, skillsNiceToHave, keyRequirements, highlights, subScores, industry, employmentType, workMode, workRights, salary, matchAnalysis, jobUrl 等）。  
   - **方案 B**：不新增工具，在 **refine_recommendations** 的 follow-up 中，若检测到「用户问的是某一条的详情」（如 "show more about #3"），由 Manus 传 `liked_job_ids: [id_3]` 或单独约定参数（如 `detail_for_job_id`），Hera 在 refine 的响应中只对该条附带 detail（或单独一段 content）。  
   - 建议：**方案 A（get_job_detail）** 更清晰、易扩展，Manus 只需在用户说「show more #x」时调一次 get_job_detail(x)，无需改 refine 语义。

3. **Interested**  
   - 「Interested」仍按现有设计：用户表达对某条感兴趣时，Manus 调 **refine_recommendations** 传 `liked_job_ids`，Hera 写 profile.applications（jobSave 等）；不需要在 interested 时必带完整 detail，若 Manus 要展示详情可再调 get_job_detail。

---

## 六、与主站列表的逐项对照（确保不少）

| 主站 JobSummaryCard 列表用到的内容 | 当前 MCP card | 修改后列表层 |
|-----------------------------------|---------------|--------------|
| id, title, company, location       | ✅ 有         | ✅ 保留并保证一致 |
| platform                           | ❌ 无         | ✅ 新增 |
| jobUrl                             | ✅ 有         | ✅ 保留 |
| postedDate                         | ❌ 无         | ✅ 新增 |
| salary                             | ❌ 无         | ✅ 新增 |
| employmentType                     | ❌ 无         | ✅ 新增 |
| workMode                           | ❌ 无         | ✅ 新增 |
| experienceTag                      | ❌ 无         | ✅ 新增 |
| skillsMustHave / keyRequirements   | ❌ 无         | ✅ 新增（可前 3 条） |
| matchScore                         | ✅ 有         | ✅ 保留 |
| subScores                          | ❌ 无         | ✅ 新增 |
| highlights / matchHighlights       | ✅ highlights_preview(2) | ✅ 保留并可为 2–3 条 |
| summary                            | ❌ 无         | ✅ 新增 |

修改后，第一轮列表层与主站「Job List 时传的信息」对齐，且不缺少主站已展示的任何一项。

---

## 七、小结（先方案、不改代码）

1. **第一轮统一只传「列表层」**  
   recommend_jobs、refine_recommendations（以及可选 search_jobs）第一轮均只返回与主站 Job List 一致的列表层字段，**不**在首轮返回 detail / job_detail。

2. **列表层字段**  
   与主站 `JobSummaryCard` 所用字段完全对齐：id, title, company, location, platform, jobUrl, postedDate, salary, employmentType, workMode, experienceTag, skillsMustHave, keyRequirements, matchScore, subScores, highlights, summary（可选加 industry/workRights）。

3. **按需详情**  
   用户说「show more about #x」或「interested in #x」时，通过 **get_job_detail(job_id)**（建议新增）拉取该条完整分析；在 recommend/refine 的提示语中说明可通过「show more about #x」获取更全面分析。

4. **refine 与 recommend 一致**  
   refine_recommendations 增加 **job_cards**（仅列表层），与 recommend_jobs 结构一致，便于 Manus 统一处理。

5. **兼容**  
   可通过 `include_detail` 或保留 `manus` 的某种用法，在需要时仍可首轮带 detail（非默认），避免破坏现有调用方。

以上为修改方案，不涉及具体代码改动；实现时在 MCP 的 recommend_jobs / refine_recommendations 中从现有 safeJobs/transform 结果构造「列表层」对象，并新增 get_job_detail 即可。
