# Refine 复用 JobMatch + 双分数加权 — 代码级方案

## 目标

1. **复用** `@/lib/mcpJobMatch` 的 `scoreJobWithJobMatch`，让 refine 返回的每条结果也有 GPT 的 match 分和 match_analysis。
2. **双分数**：`match_score`（主评分，来自 JobMatch） + `preference_score`（和 liked jobs 的相似度，现有 personalized_score）。
3. **加权规则**：默认 0.7/0.3；明确「类似这些」时 0.6/0.4；无 liked 时仅用 match_score。

## 胶圈（集成点）设计

- **只在一个地方接 JobMatch**：在「已确定要返回的 N 条结果」之后，对这 N 条做一次 `scoreJobWithJobMatch` 批量调用，不参与前面的排序与筛选。
- **原因**：refine 已有 exclude、query、规则打分、偏好打分、去重、limit，逻辑复杂；若在候选 200 条上全量调 JobMatch，成本高、时延大。对「最终要展示的 ~50 条」做一次 enrichment，调用次数固定、行为清晰、与 search/recommend 复用同一模块。
- **userProfile 来源**：与 recommend 对齐。有 `user_profile` 时从其中取 jobTitles/skills/city/seniority/… 拼成 `JobMatchUserProfile`；没有则用 refine 已有的 `effectiveJobTitle` / `effectiveCity` / `effectiveSkills` 拼成最小 profile（与 search_jobs 一致），保证 jobMatch API 不因缺 profile 报错。

---

## 1. 参数

在 `refine_recommendations` 的 `args` 解构中增加（可选）：

```ts
emphasis_on_preference = false,  // 用户明确说「类似这些」「similar to #2 #4」时由 caller 传 true
```

不破坏现有参数，默认 `false`。

---

## 2. 打分与排序（在现有「规则 + 偏好」之上改）

**2.1 当前逻辑回顾**

- `scored`：先按 `scoreJobForRecommend` 得到 `matchScore`（规则分），若有 `preferences` 再算 `personalized_score` 并按 `personalized_score` 排序。
- `transformed`：`matchScore = job.matchScore ?? job.personalized_score`，只保留一个分。

**2.2 改为双分数 + 加权（不改排除、查询、limit）**

- **match_score**：排序阶段先用「规则分」作为 match_score（与现在一致），即  
  `match_score = job.matchScore ?? 50`（无规则打分时给 50，避免 undefined）。
- **preference_score**：仅当有 `preferences` 时存在，即现有的 `personalized_score`，算法不变（标题/公司/技能/地点加分，上限 100）。
- **final_score**（仅用于排序）：
  - 无 `liked_job_ids`（即无 `preferences`）：`final_score = match_score`。
  - 有 `preferences` 且 **未** 强调类似：`final_score = 0.7 * match_score + 0.3 * preference_score`。
  - 有 `preferences` 且 **强调**类似（`emphasis_on_preference === true`）：`final_score = 0.6 * match_score + 0.4 * preference_score`。
- 排序：按 `final_score` 降序；截取、去重、`slice(0, effectiveRefineLimit)` 逻辑不变，得到 `results`（约 50 条）。

**2.3 在结果上保留双分（仅内部使用，不参与展示）**

- 在 `transformed` 的 map 里，不再写 `matchScore = job.matchScore ?? job.personalized_score`。
- 改为给每条 job 写入：
  - `match_score: job.matchScore ?? 50`
  - `preference_score: job.personalized_score ?? undefined`（无 preferences 则为 undefined）
- 到 `results` 时每条带 `match_score`、`preference_score`，仅用于排序与 JobMatch 回写；**展示到 job card 的仍是 JobMatch 后的一个总分（matchScore），不展示 preference_score**。

---

## 3. 复用 JobMatch 模块（唯一胶圈）

**位置**：在得到 `results` 之后、写 `feedback_events` / 格式化 / 返回之前。

**3.1 构建 refine 用的 userProfile**

```ts
// 与 recommend 对齐：有 user_profile 则用，否则用 effective* 拼最小 profile
const refineUserProfile: JobMatchUserProfile = (user_profile && Object.keys(user_profile).length > 0)
  ? {
      jobTitles: (user_profile as any).jobTitles?.length ? (user_profile as any).jobTitles : (effectiveJobTitle ? [effectiveJobTitle] : []),
      skills: (user_profile as any).skills ?? effectiveSkills,
      city: (user_profile as any).city ?? effectiveCity ?? null,
      seniority: (user_profile as any).seniority ?? '',
      openToRelocate: (user_profile as any).openToRelocate ?? false,
      careerPriorities: (user_profile as any).careerPriorities ?? [],
      expectedSalary: (user_profile as any).expectedSalary,
      currentPosition: (user_profile as any).currentPosition,
      expectedPosition: (user_profile as any).expectedPosition,
      employmentHistory: (user_profile as any).employmentHistory ?? [],
      workingRightsAU: (user_profile as any).workingRightsAU,
      workingRightsOther: (user_profile as any).workingRightsOther,
    }
  : {
      jobTitles: effectiveJobTitle ? [effectiveJobTitle] : [],
      skills: effectiveSkills,
      city: effectiveCity ?? null,
      seniority: '',
      openToRelocate: false,
      careerPriorities: [],
    };
```

（类型可用 `JobMatchUserProfile`，从 `@/lib/mcpJobMatch` 引入。）

**3.2 对 results 调 JobMatch，并保留 preference_score**

```ts
const jobsWithAnalysis = await Promise.all(
  results.map((j: any) => scoreJobWithJobMatch(j, refineUserProfile))
);
// JobMatch 返回里没有 preference_score，从原 results 按顺序带回去
const enrichedResults = jobsWithAnalysis.map((j: any, i: number) => ({
  ...j,
  match_score: j.matchScore,           // GPT 主评分，覆盖规则分
  preference_score: results[i].preference_score,
}));
// 后续用 enrichedResults 替代 results：feedback、formatted_jobs、job_cards、meta
```

- 不改变顺序、不重新排序：顺序已在上面用 `final_score` 定好。
- `match_score` 以 JobMatch 返回的 `matchScore` 为准；`preference_score` 始终来自 refine 自己的偏好计算，不交给 JobMatch。

---

## 4. 返回与展示（展示零改动）

- **展示层不做任何改变**：refine 的 job card、formatted_jobs 等与**现在**以及 recommend/search **完全一致**。用户看到的仍是「一个总分」——即 JobMatch 返回的 matchScore（及 experience/industry/skills 等子分、match_analysis），**不展示 preference_score**，不展示「两种分数」。
- **job_cards**：用 `enrichedResults` 生成，`buildJobListPayload(j)` 沿用现有逻辑；card 上展示的仍是原来的那一套（总分 + subScores + match_analysis），和 recommend 一致。
- **match_analysis**：来自 `scoreJobWithJobMatch` 的 `matchAnalysis`，用于 `job_cards[].match_analysis`。
- **formatted_jobs 文案**：保持现有展示，不增加「Preference: xx%」或双分文案。
- **preference_score**：仅作为**内部排序因子**参与 final_score 加权，不替换、不覆盖 experience 等主评分；主评分体系（JobMatch 那套）不变，展示的总分就是 matchScore。

---

## 5. 小结（原则对应）

| 原则 | 实现 |
|------|------|
| match_score 永远是主评分 | experience 等子分与 matchScore 不变；展示到 job card 的仍是这一套总分，不换成 preference |
| preference_score 只做 refine 重排 | 仅参与 final_score 加权用于排序，不传给 JobMatch，**不参与展示** |
| preference_score 不替代 match_score | 加权公式里 match 权重大于等于 preference；展示层只展示一个总分（原规则） |
| 展示零改动 | job card / formatted_jobs 与现在、recommend 一致，不展示两种分 |

**胶圈总结**：refine 只在一处调用 `scoreJobWithJobMatch`，且仅对「已选出的 results」做 enrichment；userProfile 与 recommend/search 同源逻辑，复用 `@/lib/mcpJobMatch`，不新增接口。

你确认后我再按此方案改 refine 的代码。
