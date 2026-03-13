# Hera × Manus 职位卡片渲染方案（仅方案，不改代码）

## 背景与目标

- Hera 已接入 Manus，`recommend_jobs` 可返回最多 50 个职位。
- 当前 Manus 拿到的是**一整段 Markdown 文本**（`result.content[0].text`）+ `meta.returned_job_ids`，没有**按职位分层的结构化数据**，难以做「卡片摘要 + 展开详情」的 UI。
- 目标：**在不丢掉 Hera 丰富信息的前提下**，让返回结构支持 Manus 做「主站风格」的卡片渲染（参考主站 Job List：Match Score、子维度得分、highlights、Apply 等）。

---

## 一、当前 `recommend_jobs` 返回结构（现状）

- **content**：`[{ type: "text", text: "# 🎯 ... \n\n" + summary + cardsContent + feedback_prompt }]`  
  - 即一段 Markdown，由 `buildMarkdownCards` 把前 5 条职位拼成文本，含 title、company、location、Match、subScores、highlights、keyRequirements、skillsMustHave/NiceToHave、workRights、Apply 链接。
- **meta**：`returned_job_ids`、`index_to_id`、`session_id`、`db_candidates_count`。  
- **没有**：按条分拆的、带「卡片层 / 详情层」的 job 数组。

内部已有、但未以结构化形式返回的字段（在 `safeJobs` / GPT 打分结果里）：  
`id`、`title`、`company`、`location`、`employmentType`、`jobUrl`、`matchScore`、`subScores`、`summary`、`highlights`、`skillsMustHave`、`skillsNiceToHave`、`keyRequirements`、`workRights`，以及 DB 里的 `workMode`、`industry`、`salary` 等。

---

## 二、主站 Job List 的展示（参考）

主站卡片已具备、且希望 Manus 也能用的信息层次：

- **默认可见（卡片摘要）**：职位标题、公司、地点、薪资简述、标签（Full time、On-site、技能 pill）、**Match Score**、**子维度得分**（Experience / Industry / Skills）、**前 1～2 条 highlights**、**Apply** 入口。
- **展开/详情**：完整 summary、must-have / nice-to-have、更多 highlights、work rights / sponsorship、详细说明等。

即：**第一层 = 快速浏览 + 匹配度 + 行动入口；第二层 = 完整 Hera 信息密度。**

---

## 三、目标返回结构：分层 + 不丢信息

### 3.1 总体思路

- 在现有 `content`（Markdown）和 `meta` 之外，**新增一个结构化字段**，专门给 Manus（或任何需要卡片 UI 的调用方）用。
- 每个职位一条记录，每条里**显式区分「卡片层」和「详情层」**，便于前端「默认渲染卡片、点击展开详情」。

### 3.2 建议新增字段：`result.job_cards`

名称用 **`job_cards`**（或 `recommendations`），表示「给 Manus 渲染用的结构化展示层」，而不是泛泛的 jobs 列表。

类型：**数组**，元素为对象，每个对象包含两层：

- **`card`**：用户一眼要看到的，极简摘要，**不重复** detail 里的解释性字段。
- **`detail`**：完整解释与 Hera 信息密度，**不要做成 card 的复制版**；sub_scores、employmentType、workMode 等只放在 detail，card 不重复。

这样 Manus 可以：

- 列表/网格只渲染 `card`。
- 点击某条后，用对应 `detail` 渲染详情页或展开区域，无需再请求。

### 3.3 字段归属（card 极简，detail 完整；少重复）

**第一层：`card`（一眼可见，仅摘要）**

只放「用户一眼要看到的」、且**不在 detail 里再重复一遍**的字段：

| 字段 | 说明 | 当前来源 |
|------|------|----------|
| `id` | 职位唯一 ID | `job.id` |
| `title` | 职位标题 | `job.title` |
| `company` | 公司名 | `job.company` |
| `location` | 地点 | `job.location` |
| `matchScore` | 总分（0–100） | `job.matchScore` |
| `highlights_preview` | 前 1～2 条，用于卡片上短预览 | `job.highlights` 或 `job.matchHighlights` 前 2 条 |
| `jobUrl` | 申请/详情链接 | `job.jobUrl` 或 `job.url` |

**不再在 card 里放**：subScores、employmentType、workMode（这些只在 detail 里出现，避免 card 与 detail 大量重复）。

**第二层：`detail`（完整解释，严格用现有字段名）**

全部使用**现有代码/DB 已有字段名**，不创造新名字。与 `safeJobs` / 打分结果 / MongoDB 对齐：

| 字段 | 说明 | 当前来源（严格映射） |
|------|------|------------------------|
| `summary` | 职位/匹配摘要（listSummary） | `job.summary` |
| `skillsMustHave` | 必须技能 | `job.skillsMustHave` |
| `skillsNiceToHave` | 加分项技能 | `job.skillsNiceToHave` |
| `keyRequirements` | 关键要求 | `job.keyRequirements` |
| `highlights` | 完整 highlights | `job.highlights` 或 `job.matchHighlights` |
| `subScores` | 细分得分（experience, industry, skills, other） | `job.subScores` |
| `industry` | 行业 | `job.industry` |
| `employmentType` | 如 Full time | `job.employmentType` |
| `workMode` | 如 On-site / Remote / Hybrid | `job.workMode` |
| `workRights` | 工作权/担保（含 sponsorship 等） | `job.workRights` |
| `salary` | 若有 | `job.salary` |
| `matchAnalysis` | 匹配解释（若 GPT 有返回） | `job.matchAnalysis` |
| `jobUrl` | 职位/申请链接 | `job.jobUrl` / `job.url` |

**不使用的自造字段**：`must_have`、`nice_to_have`、`work_rights`、`match_analysis`（小写蛇形）等；统一用上面的 **skillsMustHave、skillsNiceToHave、keyRequirements、workRights、matchAnalysis** 等与现有代码一致。

### 3.4 是否需要 `card_view` / `detail_view` / `render_hint`

- **建议：不单独增加 `render_hint` 枚举**。  
  用 **`card` / `detail` 两个对象** 已经表达「哪里是摘要、哪里是详情」；Manus 约定「列表用 card，展开用 detail」即可。
- 若希望更显式，可在**每个 job 对象顶层**加一个可选字段，例如：  
  `"render": "card_and_detail"` 或 `"layer": "card" | "detail"`（仅作文档约定，实际渲染仍按 `card` / `detail` 两个 key 来取）。  
  不是必须，优先保持结构简单。

---

## 四、具体返回结构示例（建议）

在现有：

- `result.content`（保留，兼容现有 Markdown 消费方）
- `result.meta`（保留，含 `returned_job_ids` 等）

之外，增加 **`result.job_cards`**（数组），每项形如：

```json
{
  "result": {
    "content": [ { "type": "text", "text": "..." } ],
    "meta": { "returned_job_ids": [...], "session_id": "...", ... },
    "job_cards": [
      {
        "card": {
          "id": "xxx",
          "title": "Software Engineering Associate ...",
          "company": "IBM",
          "location": "Buffalo, New York, United States",
          "matchScore": 67,
          "highlights_preview": ["IBM Consulting CICs are high-delivery...", "As an Associate Application Developer..."],
          "jobUrl": "https://..."
        },
        "detail": {
          "summary": "...",
          "skillsMustHave": ["...", "..."],
          "skillsNiceToHave": ["...", "..."],
          "keyRequirements": ["...", "..."],
          "highlights": ["...", "...", "..."],
          "subScores": { "experience": 50, "industry": 75, "skills": 60, "other": 70 },
          "industry": "Technology",
          "employmentType": "Full time",
          "workMode": "On-site",
          "workRights": { "sponsorship": "available", "requiresStatus": null },
          "salary": "Base: $74,000 - $111,000...",
          "matchAnalysis": "...",
          "jobUrl": "https://..."
        }
      }
    ]
  }
}
```

- **card**：仅「一眼可见」的 7 个字段（id, title, company, location, matchScore, highlights_preview, jobUrl），不重复 detail 的 subScores/employmentType/workMode。
- **detail**：完整解释，**严格使用现有字段名**（summary, skillsMustHave, skillsNiceToHave, keyRequirements, highlights, subScores, industry, employmentType, workMode, workRights, salary, matchAnalysis, jobUrl）。

---

## 五、设计原则对照

1. **不把 Hera 退化成普通列表**  
   - card 保留 `matchScore`（不重复 subScores）；detail 保留 summary、skillsMustHave、skillsNiceToHave、keyRequirements、highlights、subScores、workRights、matchAnalysis 等，和主站信息量一致。

2. **结构统一、稳定**  
   - 所有职位条目都带 `card` + `detail`，字段名和类型固定，方便 Manus 一套组件渲染。

3. **先保证展示清晰**  
   - 不引入复杂交互；只区分「默认看 card」「展开看 detail」「用 apply_url 申请」。

4. **兼容现有行为**  
   - 保留 `content[0].text` 和 `meta`，不破坏现有 GPT/其他消费者；Manus 可选只用 `result.job_cards` 做卡片 UI。

---

## 六、本次不做的事（按你要求）

- 不扩展 verification center、batch orchestration、reminder、更复杂自动投递逻辑。
- 只做：**让 recommend_jobs 的返回结构支持「卡片摘要 + 详细内容」两层，便于 Manus 渲染，同时保留 Hera 的细致推荐信息。**

---

## 七、小结：需要回答的 5 点

1. **如何改成「卡片摘要 + 详细内容」**  
   - 在 `result` 下新增数组 `job_cards`，每项包含 `card`（摘要）和 `detail`（详情）；现有 `content`/`meta` 保留。

2. **默认卡片里放哪些字段**  
   - id、title、company、location、matchScore、highlights_preview（1～2 条）、jobUrl；**不放** subScores、employmentType、workMode（避免与 detail 重复）。

3. **展开区域放哪些字段**  
   - summary、skillsMustHave、skillsNiceToHave、keyRequirements、highlights 全量、subScores、industry、employmentType、workMode、workRights、salary、matchAnalysis、jobUrl 等 Hera 已有且对解释性有用的字段（严格用现有字段名）。

4. **如何在不丢信息密度的前提下方便 Manus 渲染**  
   - 用 `card` / `detail` 明确分层，Manus 列表只读 `card`，展开只读 `detail`；所有 Hera 核心字段都进 `detail`，必要时在 `card` 里做短预览（如 highlights_preview）。

5. **是否需要 card_view / detail_view / render_hint**  
   - 不需要单独枚举；用 `card` 与 `detail` 两个对象即可表达层级；若希望文档更显式，可加可选 `render`/`layer`，但不作为必须字段。

以上为方案说明，**不涉及具体代码修改**；实现时在 `recommend_jobs` 里从现有 `safeJobs`/scored 结果构造 `job_cards[].card` 与 `job_cards[].detail` 即可。
