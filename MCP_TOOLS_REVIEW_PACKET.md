# MCP Tools Review Packet - ChatGPT App Store Submission

**Document Version**: 1.0  
**Last Updated**: 2025-12-24  
**Total Tools**: 11

---

## Overview

This document provides standardized metadata for all 11 MCP tools integrated with Hera AI's ChatGPT App. Each tool entry includes:
- **Description**: One-sentence accurate description (no exaggeration)
- **Input Schema**: Required/optional fields, constraints
- **Output Examples**: Success and failure cases
- **Metadata Flags**: readOnly, openWorld, destructive, requiresConfirmation
- **Special Notes**: Audit-friendly clarifications

---

## Tool 1: `job_alert`

### Description
On-demand job alert checker that returns new jobs since last search within a specified time window. This tool does NOT schedule background jobs or send push notifications; it only returns results when explicitly invoked by the user.

### Input Schema
- **Required**: `session_id` (string) - Stable session identifier for one alert stream
- **Optional**:
  - `job_title` (string) - Falls back to `memory.last_search.job_title` if not provided
  - `city` (string) - Falls back to `memory.last_search.city` if not provided
  - `company` (string) - Optional company filter
  - `keywords` (array of strings) - Optional keywords for title/summary match
  - `limit` (integer, default: 8, min: 1, max: 20) - Maximum number of results
  - `exclude_ids` (array of strings) - Job IDs to exclude (from previous `meta.returned_job_ids`)
  - `window_hours` (integer, min: 1) - Look-back window in hours (default: 24)
  - `since_iso` (string) - Explicit ISO start time (overrides `window_hours`/`last_sent_at`)
  - `liked_indexes`, `disliked_indexes` (array of integers) - User feedback indices
  - `liked_job_ids`, `disliked_job_ids` (array of strings) - User feedback job IDs
  - `run_context` (string) - "scheduled" | "manual" (always "manual" for on-demand)
  - `alert_key` (string) - Stable key for this alert

### Output Examples

**Success**:
```json
{
  "content": [{
    "type": "json",
    "data": {
      "content": {
        "jobs": [
          {
            "id": "job_123",
            "title": "Software Engineer",
            "company": "Tech Corp",
            "location": "Sydney, NSW",
            "url": "https://example.com/job/123"
          }
        ],
        "total": 1,
        "meta": {
          "returned_job_ids": ["job_123"],
          "session_id": "session_abc",
          "window_start": "2025-12-23T10:00:00Z"
        }
      }
    }
  }],
  "isError": false
}
```

**Failure** (No new jobs):
```json
{
  "content": [{
    "type": "text",
    "text": "No new jobs found since last check."
  }],
  "isError": false
}
```

### Metadata Flags
- **readOnly**: `false` - Tool queries database and may update session state
- **openWorld**: `true` - Accesses external job database
- **destructive**: `false` - Does not modify or delete data
- **requiresConfirmation**: `false` - Read-only query operation

### Special Notes for Reviewers
- ⚠️ **CRITICAL**: This tool is **on-demand only**. It does NOT:
  - Schedule background jobs
  - Send push notifications
  - Automatically trigger alerts
  - Store user notification preferences
- User must explicitly invoke this tool each time they want to check for new jobs
- The `run_context` parameter is always "manual" (never "scheduled")
- No subscription or opt-in mechanism required (user controls invocation)

---

## Tool 2: `recommend_jobs`

### Description
AI-powered personalized job matching tool that analyzes user profile (resume, skills, experience) and returns ranked job recommendations with match scores.

### Input Schema
- **Required**: `user_profile` (object) - User profile information
  - `skills` (array of strings) - User's skills
  - `jobTitles` (array of strings) - User's job titles or target positions
  - `employmentHistory` (array of objects) - Work experience
- **Optional**:
  - `job_title` (string) - Target job title filter
  - `city` (string) - Location filter
  - `limit` (integer, default: 10, min: 1, max: 50) - Maximum results
  - `use_chat_context` (boolean, default: true) - Use conversation context
  - `strict_filters` (boolean, default: true) - Apply strict filtering
  - `session_id` (string) - Session identifier for deduplication
  - `user_email` (string) - User email for profile lookup
  - `exclude_ids` (array of strings) - Job IDs to exclude

### Output Examples

**Success**:
```json
{
  "content": [{
    "type": "json",
    "data": {
      "content": {
        "jobs": [
          {
            "id": "job_456",
            "title": "Senior Software Engineer",
            "company": "Tech Corp",
            "location": "Melbourne, VIC",
            "matchScore": 85,
            "subScores": {
              "experience": 90,
              "skills": 85,
              "industry": 80,
              "other": 85
            },
            "matchAnalysis": "Strong match based on 5+ years experience and required skills",
            "url": "https://example.com/job/456"
          }
        ],
        "total": 1,
        "meta": {
          "returned_job_ids": ["job_456"]
        }
      }
    }
  }],
  "isError": false
}
```

**Failure** (No matches):
```json
{
  "content": [{
    "type": "text",
    "text": "No matching jobs found. Try adjusting your search criteria."
  }],
  "isError": false
}
```

### Metadata Flags
- **readOnly**: `false` - Queries database and may update user profile
- **openWorld**: `true` - Accesses external job database
- **destructive**: `false` - Does not modify or delete data
- **requiresConfirmation**: `false` - Read-only recommendation query

---

## Tool 3: `refine_recommendations`

### Description
Refines job recommendations based on user feedback (liked/disliked jobs) and returns new recommendations excluding previously shown jobs.

### Input Schema
- **Required**: None (but `session_id` strongly recommended)
- **Optional**:
  - `session_id` (string) - Session identifier for context
  - `job_title` (string) - Job title filter (reuses from previous search if not provided)
  - `city` (string) - City filter (reuses from previous search if not provided)
  - `liked_job_ids` (array of strings) - Job IDs user explicitly liked
  - `disliked_job_ids` (array of strings) - Job IDs user explicitly disliked
  - `exclude_ids` (array of strings) - Job IDs to exclude (from previous `meta.returned_job_ids`)
  - `limit` (integer, default: 10, min: 1, max: 50) - Maximum results

### Output Examples

**Success**:
```json
{
  "content": [{
    "type": "json",
    "data": {
      "content": {
        "jobs": [
          {
            "id": "job_789",
            "title": "Product Manager",
            "company": "Startup Inc",
            "location": "Sydney, NSW",
            "matchScore": 88,
            "url": "https://example.com/job/789"
          }
        ],
        "total": 1,
        "meta": {
          "returned_job_ids": ["job_789"],
          "refined_from": ["job_456"]
        }
      }
    }
  }],
  "isError": false
}
```

### Metadata Flags
- **readOnly**: `false` - Queries database and processes feedback
- **openWorld**: `true` - Accesses external job database
- **destructive**: `false` - Does not modify or delete data
- **requiresConfirmation**: `false` - Read-only refinement query

---

## Tool 4: `search_jobs`

### Description
Simple job listing search tool for browsing jobs by title and location without personalization. Use this ONLY for simple searches without user profile context.

### Input Schema
- **Required**: At least one of `job_title` OR `city`
- **Optional**:
  - `job_title` (string) - Job title to search
  - `city` (string) - City to search in
  - `page` (integer, default: 1, min: 1) - Page number
  - `page_size` (integer, default: 20, min: 1, max: 50) - Results per page
  - `posted_within_days` (integer, min: 1) - Filter by posting date
  - `platforms` (array of strings) - Filter by platforms: "seek", "linkedin", "jora", "adzuna"
  - `mode` (string) - "fast" | "full" (overrides default mode)

### Output Examples

**Success**:
```json
{
  "content": [{
    "type": "text",
    "text": "## Job Search Results\n\n### Software Engineer at Tech Corp\n📍 Sydney, NSW\n🔗 [View Job](https://example.com/job/123)\n\n---\n\n*Found 1 job(s) matching your search*"
  }],
  "isError": false,
  "mode": "search",
  "query_used": {
    "job_title": "Software Engineer",
    "city": "Sydney"
  },
  "total": 1,
  "isFinal": true
}
```

**Failure** (Missing params):
```json
{
  "content": [{
    "type": "json",
    "data": {
      "content": {
        "jobs": [],
        "total": 0,
        "note": "missing_params",
        "message": "job_title and city are required"
      }
    }
  }],
  "isError": false
}
```

### Metadata Flags
- **readOnly**: `true` - Pure read-only search query
- **openWorld**: `true` - Accesses external job database
- **destructive**: `false` - Does not modify or delete data
- **requiresConfirmation**: `false` - Read-only search operation

---

## Tool 5: `search_jobs_by_company`

### Description
Search jobs by specific company name. Automatically handles company name normalization and parameter correction.

### Input Schema
- **Required**: `company` (string) - Employer name (e.g., "Google", "Atlassian", "NAB")
- **Optional**:
  - `city` (string) - Optional city filter
  - `job_title` (string) - Optional role filter
  - `page` (integer, default: 1, min: 1) - Page number
  - `page_size` (integer, default: 20, min: 1, max: 50) - Results per page
  - `posted_within_days` (integer, min: 1) - Filter by posting date
  - `platforms` (array of strings) - Filter by platforms

### Output Examples

**Success**:
```json
{
  "content": [{
    "type": "text",
    "text": "## Jobs at Google\n\n### Software Engineer at Google\n📍 Sydney, NSW\n🔗 [View Job](https://example.com/job/456)\n\n---\n\n*Found 1 job(s) at Google*"
  }],
  "isError": false
}
```

**Failure** (Missing company):
```json
{
  "content": [{
    "type": "json",
    "data": {
      "content": {
        "jobs": [],
        "total": 0,
        "note": "missing_params",
        "message": "company is required"
      }
    }
  }],
  "isError": false
}
```

### Metadata Flags
- **readOnly**: `true` - Pure read-only search query
- **openWorld**: `true` - Accesses external job database
- **destructive**: `false` - Does not modify or delete data
- **requiresConfirmation**: `false` - Read-only search operation

---

## Tool 6: `build_search_links`

### Description
Generates direct search URLs for job platforms (LinkedIn, SEEK, Jora, Adzuna) based on job title and location. This tool does NOT scrape or store third-party data; it only generates links that users can visit.

### Input Schema
- **Required**:
  - `job_title` (string, minLength: 1) - Job title to search
  - `city` (string, minLength: 1) - City to search in
- **Optional**:
  - `platforms` (array of strings, default: ["linkedin", "seek", "jora", "adzuna"]) - Platforms to generate links for

### Output Examples

**Success**:
```json
{
  "content": [{
    "type": "json",
    "data": {
      "content": {
        "links": [
          {
            "platform": "linkedin",
            "url": "https://www.linkedin.com/jobs/search/?keywords=Software%20Engineer&location=Sydney",
            "label": "LinkedIn Jobs"
          },
          {
            "platform": "seek",
            "url": "https://www.seek.com.au/jobs?keywords=Software+Engineer&location=Sydney",
            "label": "SEEK"
          }
        ],
        "total": 2,
        "query": "Software Engineer in Sydney"
      }
    }
  }],
  "isError": false
}
```

**Failure** (Missing params):
```json
{
  "content": [{
    "type": "json",
    "data": {
      "content": {
        "links": [],
        "total": 0,
        "note": "missing_params"
      }
    }
  }],
  "isError": false
}
```

### Metadata Flags
- **readOnly**: `true` - Pure read-only link generation
- **openWorld**: `false` - Does not access external systems (only generates URLs)
- **destructive**: `false` - Does not modify or delete data
- **requiresConfirmation**: `false` - Read-only link generation

### Special Notes for Reviewers
- ⚠️ **CRITICAL**: This tool does NOT:
  - Scrape or crawl third-party job platforms
  - Store or copy job data from third-party platforms
  - Access third-party APIs without authorization
- It only generates search URLs that users can manually visit
- All job data comes from Hera AI's own aggregated database (not from third-party platforms)

---

## Tool 7: `get_user_applications`

### Description
Retrieves user's job application history from their profile. Returns applications filtered by status (saved, applied, interviewing, offered, rejected).

### Input Schema
- **Required**: `user_email` (string, format: email) - User email address
- **Optional**:
  - `status_filter` (string, enum: ["all", "saved", "applied", "interviewing", "offered", "rejected"], default: "all") - Filter by application status

### Output Examples

**Success**:
```json
{
  "content": [{
    "type": "json",
    "data": {
      "content": {
        "applications": [
          {
            "jobId": "job_123",
            "jobTitle": "Software Engineer",
            "company": "Tech Corp",
            "status": "applied",
            "appliedDate": "2025-12-20T10:00:00Z"
          }
        ],
        "total": 1,
        "status_filter": "all",
        "user_email": "user@example.com"
      }
    }
  }],
  "isError": false
}
```

**Failure** (Profile not found):
```json
{
  "content": [{
    "type": "json",
    "data": {
      "content": {
        "applications": [],
        "total": 0,
        "note": "profile_not_found"
      }
    }
  }],
  "isError": false
}
```

### Metadata Flags
- **readOnly**: `true` - Pure read-only query of user's own data
- **openWorld**: `false` - Accesses only user's own profile data
- **destructive**: `false` - Does not modify or delete data
- **requiresConfirmation**: `false` - Read-only query of user's own data

---

## Tool 8: `tailor_resume`

### Description
Intelligent resume optimization tool that handles two scenarios: (1) Optimize resume without job description (AI-powered enhancement), (2) Tailor resume for specific job description (customization).

### Input Schema
- **Required**:
  - `user_profile` (object) - User profile information
    - `skills` (array of strings)
    - `jobTitles` (array of strings)
    - `employmentHistory` (array of objects)
  - `resume_content` (string) - Current resume content to customize
- **Optional**:
  - `job_id` (string) - Target job ID (if available from job search results)
  - `job_description` (string) - Job description text to tailor resume for
  - `job_title` (string) - Target job title
  - `company` (string) - Target company name
  - `customization_level` (string, enum: ["minimal", "moderate", "comprehensive"], default: "moderate") - Level of customization
  - `user_email` (string, format: email) - User email for saving tailored resume

### Output Examples

**Success**:
```json
{
  "content": [{
    "type": "text",
    "text": "## Tailored Resume\n\n**John Doe**\n\n### Professional Summary\n[AI-generated summary optimized for target role]\n\n### Experience\n[AI-enhanced experience descriptions]\n\n---\n\n*Resume tailored for Software Engineer at Tech Corp*"
  }],
  "isError": false
}
```

**Failure** (Missing params):
```json
{
  "content": [{
    "type": "json",
    "data": {
      "content": {
        "error": "user_profile and resume_content are required"
      }
    }
  }],
  "isError": true
}
```

### Metadata Flags
- **readOnly**: `false` - Generates new resume content (may save to user profile)
- **openWorld**: `false` - Uses AI to process user's own data
- **destructive**: `false` - Does not delete original resume (creates new version)
- **requiresConfirmation**: `true` - **RECOMMENDED** - User should review before saving

### Special Notes for Reviewers
- This tool uses AI (GPT) to enhance/tailor resumes
- Original resume is preserved; tool generates new tailored version
- User can choose to save or discard the tailored resume
- No third-party data is accessed or stored

---

## Tool 9: `career_transition_advice`

### Description
Provides personalized career transition recommendations based on current job title, experience, and skills. Analyzes skill gaps and transition difficulty.

### Input Schema
- **Required**:
  - `current_job` (string) - Current job title
  - `experience_years` (number) - Years of experience
- **Optional**:
  - `skills` (array of strings) - List of skills
  - `industry` (string) - Current industry
  - `location` (string) - Location preference

### Output Examples

**Success**:
```json
{
  "content": [{
    "type": "text",
    "text": "## Career Transition Analysis\n\n### Recommended Transitions:\n\n1. **Product Manager** (85% similarity)\n   - Shared skills: Project management, Communication\n   - Skills to learn: Product strategy, User research\n   - Transition difficulty: Medium\n\n2. **Data Analyst** (75% similarity)\n   - Shared skills: Analysis, Problem-solving\n   - Skills to learn: SQL, Python, Data visualization\n   - Transition difficulty: Medium-High"
  }],
  "isError": false
}
```

### Metadata Flags
- **readOnly**: `true` - Pure read-only analysis (does not modify user profile)
- **openWorld**: `false` - Uses AI to analyze user's own career data
- **destructive**: `false` - Does not modify or delete data
- **requiresConfirmation**: `false` - Read-only analysis

---

## Tool 10: `career_path_explorer`

### Description
Explores all possible career paths from a given job title, showing similarity scores and shared skills between roles.

### Input Schema
- **Required**: `from_job` (string) - Source job title to explore transitions from
- **Optional**:
  - `min_similarity` (number, default: 0.5, min: 0, max: 1) - Minimum similarity threshold
  - `limit` (number, default: 20, min: 1, max: 50) - Maximum number of results

### Output Examples

**Success**:
```json
{
  "content": [{
    "type": "text",
    "text": "## Career Paths from Software Engineer\n\n1. **Product Manager** (90% similarity)\n   - Shared: Technical skills, Problem-solving\n\n2. **Data Engineer** (85% similarity)\n   - Shared: Programming, Database knowledge\n\n3. **DevOps Engineer** (80% similarity)\n   - Shared: Infrastructure, Automation"
  }],
  "isError": false
}
```

### Metadata Flags
- **readOnly**: `true` - Pure read-only exploration
- **openWorld**: `false` - Uses AI to analyze career paths
- **destructive**: `false` - Does not modify or delete data
- **requiresConfirmation**: `false` - Read-only exploration

---

## Tool 11: `career_skill_gap_analysis`

### Description
Analyzes the skill gap between two job roles, identifying shared skills, skills to learn, and transition difficulty.

### Input Schema
- **Required**:
  - `from_job` (string) - Source job title
  - `to_job` (string) - Target job title
- **Optional**: None

### Output Examples

**Success**:
```json
{
  "content": [{
    "type": "text",
    "text": "## Skill Gap Analysis: Software Engineer → Product Manager\n\n### Shared Skills:\n- Problem-solving\n- Communication\n- Technical knowledge\n\n### Skills to Learn:\n- Product strategy\n- User research\n- Stakeholder management\n\n### Transition Difficulty: Medium\n### Estimated Time: 6-12 months"
  }],
  "isError": false
}
```

### Metadata Flags
- **readOnly**: `true` - Pure read-only analysis
- **openWorld**: `false` - Uses AI to analyze skill gaps
- **destructive**: `false` - Does not modify or delete data
- **requiresConfirmation**: `false` - Read-only analysis

---

## Summary Table

| Tool Name | readOnly | openWorld | destructive | requiresConfirmation | Notes |
|-----------|----------|-----------|-------------|---------------------|-------|
| `job_alert` | false | true | false | false | ⚠️ On-demand only, no background push |
| `recommend_jobs` | false | true | false | false | AI-powered matching |
| `refine_recommendations` | false | true | false | false | Feedback-based refinement |
| `search_jobs` | true | true | false | false | Simple listing search |
| `search_jobs_by_company` | true | true | false | false | Company-specific search |
| `build_search_links` | true | false | false | false | ⚠️ URL generation only, no scraping |
| `get_user_applications` | true | false | false | false | User's own data |
| `tailor_resume` | false | false | false | **true** | ⚠️ AI-generated content, user review recommended |
| `career_transition_advice` | true | false | false | false | AI analysis only |
| `career_path_explorer` | true | false | false | false | AI exploration only |
| `career_skill_gap_analysis` | true | false | false | false | AI analysis only |

---

## Compliance Notes

### Data Sources
- **Job Data**: Aggregated from multiple sources and stored in Hera AI's own database
- **Third-Party Platforms**: We generate search URLs (via `build_search_links`) but do NOT scrape, crawl, or store data from LinkedIn, SEEK, Jora, or Adzuna
- **User Data**: All user data (resume, profile, applications) is stored in Hera AI's own database

### Privacy & Security
- All tools require Bearer Token authentication (`MCP_SHARED_SECRET`)
- User data is accessed only with explicit user email or session ID
- No tools perform destructive operations (delete, modify critical data)
- Resume tailoring generates new content but preserves original

### Rate Limiting & Performance
- All tools have timeout protection (15-35 seconds depending on mode)
- Database queries are optimized with pagination
- No tools perform background operations or scheduled tasks

---

**End of Document**









