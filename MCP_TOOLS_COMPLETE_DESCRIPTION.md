# HeraAI MCP 工具完整说明文档

本文档包含所有 MCP 工具的完整描述，可用于 ChatGPT Apps & Connectors 配置。

---

## 工具列表（共 11 个）

1. `job_alert` - 职位提醒
2. `recommend_jobs` - 个性化职位推荐
3. `refine_recommendations` - 优化推荐结果
4. `search_jobs_by_company` - 按公司搜索职位
5. `search_jobs` - 简单职位搜索
6. `build_search_links` - 生成搜索链接
7. `get_user_applications` - 获取申请历史
8. `tailor_resume` - 简历定制
9. `career_transition_advice` - 职业转换建议
10. `career_path_explorer` - 职业路径探索
11. `career_skill_gap_analysis` - 技能差距分析

---

## 1. job_alert

**工具名称**: `job_alert`

**完整描述**:
```
📣 JOB ALERT - Send fresh jobs based on last search and time window. Use this to deliver periodic alerts with 'only new since last sent'.

Rules:
• Always reuse the same session_id for one alert stream
• Pass exclude_ids from previous meta.returned_job_ids to avoid duplicates
• If job_title/city not provided, server backfills from last_search
• Time window default 24h; can override with window_hours
```

**参数说明**:
- `session_id` (string, 必填) - Stable session for one alert stream
- `limit` (integer, 必填, 默认: 8, 范围: 1-20) - Number of jobs to return
- `exclude_ids` (array<string>, 必填) - IDs to exclude (previous returned_job_ids)
- `job_title` (string, 可选) - Falls back to memory.last_search.job_title
- `city` (string, 可选) - Falls back to memory.last_search.city
- `company` (string, 可选) - Optional company filter
- `keywords` (array<string>, 可选) - Optional keywords for title/summary match
- `window_hours` (integer, 可选, 最小值: 1) - Look-back window in hours (default 24)
- `since_iso` (string, 可选) - Explicit ISO start time; overrides window_hours/last_sent_at
- `liked_indexes` (array<integer>, 可选) - 1-based indexes of liked jobs
- `disliked_indexes` (array<integer>, 可选) - 1-based indexes of disliked jobs
- `liked_job_ids` (array<string>, 可选) - Job IDs user explicitly liked
- `disliked_job_ids` (array<string>, 可选) - Job IDs user explicitly disliked
- `run_context` (string, 可选) - "scheduled" | "manual"
- `alert_key` (string, 可选) - Stable key for this alert

---

## 2. recommend_jobs

**工具名称**: `recommend_jobs`

**完整描述**:
```
🎯 PERSONALIZED JOB RECOMMENDATIONS - Use this for AI-powered job matching!

✅ ALWAYS use this tool when user:
• Says 'recommend jobs', 'suggest jobs', 'job advice', 'match me', 'help me find jobs'
• Provides resume, profile, experience, skills, or career context
• Asks for 'jobs that match my background' or 'jobs for me'
• Mentions seniority level, career priorities, or preferences
• Wants personalized job suggestions based on their profile
• Uploads a resume or provides detailed career information

🎯 This tool performs intelligent job matching by:
• Analyzing user's resume/profile and career context
• Using explicit job_title/city if provided, otherwise inferring from resume (expectedPosition/cityPreference)
• Searching database with determined filters
• Scoring jobs based on experience, skills, industry fit
• Returning top personalized recommendations with detailed match scores
• Informing user when using resume inference for job targeting

📝 Examples:
• 'Recommend jobs for me based on my resume' → Uses resume expectedPosition
• 'Suggest business analyst roles in Melbourne' → Uses explicit job_title + city
• 'What jobs match my 5 years React experience in Sydney?' → Uses explicit criteria
• 'Help me find data analyst positions' → Uses explicit job_title
• 'I'm a senior developer, recommend suitable roles' → Uses profile context

⚠️ NEVER call search_jobs after this tool - it provides complete results
```

**参数说明**:
- `user_profile` (object, 必填) - User profile information for job matching
  - `jobTitles` (array<string>, 可选) - User's job titles or target positions
  - `skills` (array<string>, 可选) - User's skills and competencies
  - `city` (string, 可选) - User's preferred city
  - `seniority` (string, 可选, enum: ["Junior", "Mid", "Senior", "Lead", "Manager", "Director", "VP", "C-level"]) - User's seniority level
  - `openToRelocate` (boolean, 可选) - Whether user is open to relocation
  - `careerPriorities` (array<string>, 可选) - User's career priorities and preferences
  - `expectedPosition` (string, 可选) - Expected position level
  - `currentPosition` (string, 可选) - Current position level
  - `expectedSalary` (string, 可选, enum: ["Lowest", "Low", "Medium", "High", "Highest"]) - Expected salary range
  - `employmentHistory` (array<object>, 可选) - User's employment history
    - `company` (string) - Company name
    - `position` (string) - Position title
- `job_title` (string, 可选) - Specific job title to search for (e.g. 'business analyst', 'software engineer')
- `city` (string, 可选) - City to search for jobs (e.g. 'Melbourne', 'Sydney')
- `limit` (integer, 可选, 默认: 10, 范围: 5-20) - Number of recent jobs to analyze
- `use_chat_context` (boolean, 可选, 默认: true) - Whether to use recent chat context for profile signals
- `strict_filters` (boolean, 可选, 默认: true) - If true and job_title/city provided, enforce them as database filters before scoring

---

## 3. refine_recommendations

**工具名称**: `refine_recommendations`

**完整描述**:
```
🔄 REFINE JOB RECOMMENDATIONS - Use when user wants MORE jobs or provides FEEDBACK on previous recommendations!

✅ ALWAYS use this tool when user:
• Says 'show me more', 'more jobs', 'more recommendations', 'continue', 'next batch'
• Provides feedback: 'I like #2 and #5', 'not interested in #3', 'exclude the Google one'
• Asks for similar jobs: 'more like the first one', 'similar to the Canva job'
• Wants to refine: 'different companies', 'other options'

🎯 This tool:
• Excludes ALL previously shown jobs (from meta.returned_job_ids)
• Applies user preferences (liked/disliked jobs)
• Analyzes liked jobs to find similar opportunities
• Returns fresh recommendations with no duplicates

📝 Examples:
• User: 'show me more' → refine_recommendations({ session_id, exclude_ids: [previous IDs] })
• User: 'I like #2, not #3' → refine_recommendations({ liked_job_ids: [id_2], disliked_job_ids: [id_3] })
• User: 'more jobs like the Amazon one' → refine_recommendations({ liked_job_ids: [amazon_id] })

⚠️ IMPORTANT: Always pass exclude_ids from previous meta.returned_job_ids to avoid duplicates!
```

**参数说明**:
- `session_id` (string, 必填) - Session ID to track conversation context
- `job_title` (string, 可选) - Job title to search (optional, can reuse from previous search)
- `city` (string, 可选) - City to search in (optional, can reuse from previous search)
- `liked_job_ids` (array<string>, 可选) - Job IDs user explicitly liked (e.g., from 'I like #2 and #5')
- `disliked_job_ids` (array<string>, 可选) - Job IDs user explicitly disliked (e.g., from 'not interested in #3')
- `liked_indexes` (array<integer>, 可选) - 1-based indexes of liked jobs from the last results (server maps to IDs)
- `disliked_indexes` (array<integer>, 可选) - 1-based indexes of disliked jobs from the last results (server maps to IDs)
- `exclude_ids` (array<string>, 可选) - ALL job IDs to exclude from search (from meta.returned_job_ids of previous calls)
- `user_email` (string, 可选) - User email for cross-session tracking
- `limit` (integer, 可选, 默认: 10, 范围: 5-20) - Number of jobs to return

---

## 4. search_jobs_by_company

**工具名称**: `search_jobs_by_company`

**完整描述**:
```
🏢 USE THIS for ANY company/employer searches!

✅ ALWAYS use this tool when user mentions ANY company name:
• Google, Microsoft, Atlassian, NAB, ANZ, Commonwealth Bank
• Apple, Amazon, Meta, Netflix, Spotify, Uber
• Wesley College, University of Melbourne, Monash University
• Any company ending in Ltd, Inc, Corp, Bank, Group, University, College

📋 Mapping rules:
• Company name → company field
• 'in/near <City>' → city field  
• Job role → job_title field

🎯 Examples:
• 'jobs at Google' -> company='Google'
• 'accountant at Microsoft' -> company='Microsoft', job_title='accountant'
• 'find jobs with NAB in Melbourne' -> company='NAB', city='Melbourne'
• 'software engineer at Atlassian' -> company='Atlassian', job_title='software engineer'
```

**参数说明**:
- `company` (string, 必填) - Employer name, e.g., 'Google', 'Atlassian', 'NAB'
- `city` (string, 可选) - Optional city filter, e.g., 'Melbourne'
- `job_title` (string, 可选) - Optional role filter, e.g., 'software engineer'
- `page` (integer, 可选, 默认: 1, 最小值: 1) - Page number for pagination
- `page_size` (integer, 可选, 默认: 20, 范围: 1-50) - Results per page (max 50)
- `posted_within_days` (integer, 可选, 最小值: 1) - Filter jobs posted within X days (optional)
- `platforms` (array<string>, 可选) - Filter by platforms: seek, linkedin, jora, adzuna, etc. (optional)

---

## 5. search_jobs

**工具名称**: `search_jobs`

**完整描述**:
```
🔍 LISTING SEARCH - Use this ONLY for simple job searches!

✅ Use ONLY when user asks for:
• 'find jobs', 'search jobs', 'browse jobs' WITHOUT personal context
• Specific job titles: 'software engineer jobs', 'accountant positions'
• Specific cities: 'jobs in Melbourne', 'Sydney jobs'
• General job searches WITHOUT resume/profile/experience context

🚫 NEVER use this if user:
• Says 'recommend', 'suggest', 'advice', 'match', 'help me find'
• Provides resume, profile, experience, skills, or background
• Asks for personalized job matching or career advice
• Mentions seniority level, career priorities, or preferences
• Wants job recommendations based on their profile

📝 Examples:
• 'find software engineer jobs in Sydney'
• 'search for accountant positions'
• 'browse jobs in Melbourne'

❌ WRONG usage (use recommend_jobs instead):
• 'recommend jobs for me' -> use recommend_jobs
• 'suggest jobs based on my resume' -> use recommend_jobs
• 'help me find jobs that match my experience' -> use recommend_jobs
```

**参数说明**:
- `job_title` (string, 可选) - e.g., 'software engineer' (至少需要 job_title 或 city 之一)
- `city` (string, 可选) - City only, e.g., 'Melbourne', 'Sydney' (至少需要 job_title 或 city 之一)
- `page` (integer, 可选, 默认: 1, 最小值: 1) - Page number for pagination
- `page_size` (integer, 可选, 默认: 20, 范围: 1-50) - Results per page (max 50)
- `posted_within_days` (integer, 可选, 最小值: 1) - Filter jobs posted within X days (optional)
- `platforms` (array<string>, 可选) - Filter by platforms: seek, linkedin, jora, adzuna, etc. (optional)
- `mode` (string, 可选, enum: ["fast", "full"]) - Override default mode for this request (optional)

---

## 6. build_search_links

**工具名称**: `build_search_links`

**完整描述**:
```
Generate direct search URLs for job platforms.
```

**参数说明**:
- `job_title` (string, 必填, 最小长度: 1) - Job title to search for
- `city` (string, 必填, 最小长度: 1) - City to search in
- `platforms` (array<string>, 可选, 默认: ["linkedin", "seek", "jora", "adzuna"]) - List of platforms to generate links for

---

## 7. get_user_applications

**工具名称**: `get_user_applications`

**完整描述**:
```
Retrieve user job application history.
```

**参数说明**:
- `user_email` (string, 必填, format: email) - User email address
- `status_filter` (string, 可选, 默认: "all", enum: ["all", "saved", "applied", "interviewing", "offered", "rejected"]) - Filter applications by status

---

## 8. tailor_resume

**工具名称**: `tailor_resume`

**完整描述**:
```
📝 INTELLIGENT RESUME OPTIMIZATION - Handles two distinct scenarios!

✅ OPTIMIZE RESUME (without job description):
• Keywords: 'optimize resume', 'improve resume', 'enhance resume', 'boost resume', 'refine resume', 'upgrade resume', 'perfect resume', 'polish resume', 'strengthen resume', 'revamp resume', 'rewrite resume with AI'
• Action: Rewrite each employment experience with AI + generate professional highlights
• Uses existing boost resume logic from profile page

✅ TAILOR RESUME (with job description):
• Keywords: 'tailor resume', 'customize resume', 'adapt resume', 'match resume to job', 'target resume', 'adjust resume for position', 'modify resume', 'fit resume to role'
• Action: Customize resume content for specific job requirements
• Uses existing tailor resume logic from jobs page

🎯 This tool intelligently handles both scenarios by analyzing input parameters.
💡 Always preserve original resume format and structure while enhancing content quality.
```

**参数说明**:
- `user_profile` (object, 必填) - User profile information
  - `skills` (array<string>, 可选) - User's skills
  - `jobTitles` (array<string>, 可选) - User's job titles
  - `employmentHistory` (array<object>, 可选) - User's employment history
    - `company` (string) - Company name
    - `position` (string) - Position title
    - `startDate` (string) - Start date
    - `endDate` (string) - End date
    - `summary` (string) - Job summary/description
- `resume_content` (string, 必填) - Current resume content to customize
- `job_id` (string, 可选) - Target job ID (if available from job search results)
- `job_description` (string, 可选) - Job description text to tailor resume for
- `job_title` (string, 可选) - Target job title
- `company` (string, 可选) - Target company name
- `customization_level` (string, 可选, 默认: "moderate", enum: ["minimal", "moderate", "comprehensive"]) - Level of customization to apply
- `user_email` (string, 可选, format: email) - User email for saving tailored resume

---

## 9. career_transition_advice

**工具名称**: `career_transition_advice`

**完整描述**:
```
🎯 CAREER TRANSITION ADVICE - Get personalized career switch recommendations!

✅ Use this tool when user:
• Asks 'what careers can I transition to?', 'career change advice', 'what should I do next?'
• Provides current job title and experience
• Wants to explore career switch options
• Mentions career transition, pivot, or change

🎯 This tool provides:
• Personalized career transition recommendations
• Skill gap analysis between current and target roles
• Transition difficulty assessment
• Actionable career pathway suggestions

📝 Examples:
• 'I'm a software engineer with 3 years experience, what careers can I transition to?'
• 'Help me explore career options from product manager'
• 'What are good career paths for a data analyst?'
```

**参数说明**:
- `current_job` (string, 必填) - Current job title
- `experience_years` (number, 必填) - Years of experience
- `skills` (array<string>, 可选) - Optional: List of skills
- `industry` (string, 可选) - Optional: Current industry
- `location` (string, 可选) - Optional: Location preference

---

## 10. career_path_explorer

**工具名称**: `career_path_explorer`

**完整描述**:
```
🔍 CAREER PATH EXPLORER - Explore all possible career paths from a job title!

✅ Use this tool when user:
• Asks 'show me all career paths from X', 'what jobs can I transition to from Y'
• Wants to explore multiple transition options
• Looking for similarity-based career recommendations

🎯 This tool provides:
• All possible career transitions from a given job
• Similarity scores for each transition
• Shared skills between roles
• Filtered results by similarity threshold

📝 Examples:
• 'Show me all career paths from software engineer'
• 'What jobs can I transition to from product manager?'
• 'Explore career options from data analyst with 70%+ similarity'
```

**参数说明**:
- `from_job` (string, 必填) - Source job title to explore transitions from
- `min_similarity` (number, 可选, 默认: 0.5, 范围: 0-1) - Minimum similarity threshold (0-1)
- `limit` (number, 可选, 默认: 20, 范围: 1-50) - Maximum number of results

---

## 11. career_skill_gap_analysis

**工具名称**: `career_skill_gap_analysis`

**完整描述**:
```
📊 SKILL GAP ANALYSIS - Analyze the skill gap between two job roles!

✅ Use this tool when user:
• Asks 'what's the skill gap between X and Y', 'what skills do I need to switch to Y'
• Wants to understand transition requirements
• Needs specific skills to develop for target role

🎯 This tool provides:
• Detailed skill gap analysis between two roles
• Shared skills (what you already have)
• Skills to learn (what you need to develop)
• Transition difficulty assessment
• Estimated time to transition

📝 Examples:
• 'What's the skill gap between software engineer and data analyst?'
• 'What skills do I need to become a product manager?'
• 'Analyze the gap between my current role and business analyst'
```

**参数说明**:
- `from_job` (string, 必填) - Source job title
- `to_job` (string, 必填) - Target job title

---

## 使用说明

### 工具选择决策树

1. **用户提到公司名** → 使用 `search_jobs_by_company`
2. **用户说"推荐"、"建议"、"匹配"** → 使用 `recommend_jobs`
3. **用户说"显示更多"、"更多职位"** → 使用 `refine_recommendations`
4. **用户说"搜索"、"查找"（无个性化需求）** → 使用 `search_jobs`
5. **用户说"优化简历"、"定制简历"** → 使用 `tailor_resume`
6. **用户问"转行"、"职业转换"** → 使用 `career_transition_advice`
7. **用户问"职业路径"、"探索可能性"** → 使用 `career_path_explorer`
8. **用户问"技能差距"** → 使用 `career_skill_gap_analysis`
9. **用户要"申请历史"** → 使用 `get_user_applications`
10. **用户要"搜索链接"** → 使用 `build_search_links`
11. **定时提醒场景** → 使用 `job_alert`

---

## MCP Server 配置信息

**Server URL**: `https://www.neradi.net.au/api/mcp`

**Authorization**: None (无需认证)

**Protocol**: JSON-RPC 2.0

**Available Methods**:
- `tools/list` - 获取所有工具列表
- `tools/call` - 调用工具
- `agentkit/plan` - AgentKit 规划（可选）
- `agentkit/execute` - AgentKit 执行（可选）

---

## 注意事项

1. **session_id 的重要性**: `refine_recommendations` 和 `job_alert` 需要稳定的 `session_id` 来维护状态
2. **去重机制**: `refine_recommendations` 必须传递 `exclude_ids` 以避免重复
3. **工具选择**: 区分 `recommend_jobs`（个性化）和 `search_jobs`（简单搜索）
4. **外部 API 风险**: `career_transition_advice`、`career_path_explorer`、`career_skill_gap_analysis` 依赖外部 API，可能不稳定
5. **参数验证**: 所有必填参数必须在调用前验证

---

本文档版本: 1.0  
最后更新: 2024-01

