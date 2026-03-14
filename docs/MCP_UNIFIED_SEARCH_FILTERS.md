# MCP 统一搜索维度方案

recommend_jobs、search_jobs、refine_recommendations 三个工具**统一支持相同的一组可选筛选维度**，便于按时间、地点、公司、工作方式等过滤。

---

## 统一支持的维度

| 维度 | 参数名 | 类型 | 说明 | 入查询方式 |
|------|--------|------|------|------------|
| **时间** | `posted_within_days` | integer | 只要 X 天内发布的职位（如 7 = 最近 7 天） | DB 条件：postedDate/createdAt/updatedAt >= (now - X days) |
| **地点** | `city` | string | 城市 | DB 条件 |
| **公司** | `company` | string | 指定公司 | DB 条件 |
| **职位标题** | `job_title` | string | 标题关键词 | recommend/refine 多为打分用；search 可入查询 |
| **行业** | `industry` | string | 行业 | DB 条件（refine/search）或打分（recommend） |
| **技能** | `skills` | string[] | 技能列表 | DB 条件或打分 |
| **工作方式** | `workMode` | string | onsite \| remote \| hybrid | 依 workModeStrict 入查询或仅打分 |
| **雇佣类型** | `employmentType` | string | full time \| part time \| contract \| casual | 依 employmentTypeStrict 入查询或仅打分 |
| **仅 sponsorship** | `sponsorship_only` | boolean | 仅要提供/要求 sponsorship 的职位 | DB 条件 |
| **排除 ID** | `exclude_ids` | string[] | 排除的 job_id 列表 | DB $nor |

---

## 各工具当前支持情况

| 维度 | recommend_jobs | search_jobs | refine_recommendations |
|------|----------------|-------------|-------------------------|
| posted_within_days | ✅ 已支持 | ✅ 已支持 | ✅ 已支持 |
| city | ✅ | ✅ | ✅ |
| company | ✅ | ✅ | ✅ |
| job_title | ✅ | ✅ | ✅ |
| industry | ✅ | ✅ | ✅ |
| skills | ✅ | ✅ | ✅ |
| workMode / workModeStrict | ✅ | ✅ | ✅ |
| employmentType / employmentTypeStrict | ✅ | ✅ | ✅ |
| sponsorship_only | ✅ | ✅ | ✅ |
| exclude_ids | ✅ | ✅ | ✅ |

底层统一使用 `queryJobsWithFilters(options)`，其中 `postedWithinDays`、`city`、`company` 等传入即生效。

---

## 使用示例

- 只要 7 天内的推荐：`recommend_jobs({ user_profile, job_title, city, posted_within_days: 7 })`
- 只要 7 天内的搜索：`search_jobs({ job_title, city, posted_within_days: 7 })`
- 只要 7 天内的 refine：`refine_recommendations({ session_id, exclude_ids, posted_within_days: 7 })`

用户说「只要最近一周的」「7 天内的」「new jobs」时，均可传 `posted_within_days: 7`（或 1、3、14 等）。
