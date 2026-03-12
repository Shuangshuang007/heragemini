# Hera as Manus Customer API – Integration Guide

**Goal:** Expose Hera as a stable, public Customer API / MCP data source that **Manus** calls. Manus integrates Hera (e.g. as Custom MCP Server); Hera does not call Manus.

This doc covers: **API surface**, **auth**, **minimal tool set**, **call sequence**, **example payloads**, **deployment**.

---

## 1. Public stable endpoint

| Item | Value |
|------|--------|
| **Base URL** | `https://heraai.net.au` or `https://heraai.one` (production) |
| **API path** | **`/api/mcp`** (fixed; same for all tools) |
| **Method** | `POST` |
| **Content-Type** | `application/json` |

All tools are invoked via the same endpoint using JSON-RPC 2.0:

- **List tools:** `POST /api/mcp` with `method: "tools/list"`.
- **Call a tool:** `POST /api/mcp` with `method: "tools/call"`, `params: { name, arguments }`.

No separate paths per tool; the `method` and `params.name` identify the operation.

---

## 2. Authentication (distinguish manus / gpt / hera_web)

### 2.1 Current: Bearer token

- **Header:** `Authorization: Bearer <token>`
- **Token:** Shared secret (e.g. from env `MCP_SHARED_SECRET`). Same token can be used by multiple callers today; **caller identity** is passed in **request body or header**, not by different tokens.

### 2.2 Recommended: caller identification

So Hera can apply limits and logging per channel:

| Caller | How to identify | Notes |
|--------|------------------|--------|
| **Manus** | Header `X-Caller: manus` **or** in tool args `source: "manus"` | Use for Manus-specific limits (e.g. 50 jobs when profile complete). |
| **GPT** | `X-Caller: gpt` or `source: "gpt"` | Default for ChatGPT / MCP clients. |
| **Hera Web** | `X-Caller: hera_web` or `source: "hera_web"` | Higher limits (e.g. 500), internal UX. |

**Auth design for Manus (first version):**

1. **Keep** a single Bearer token for all authorized callers (e.g. one shared secret for Manus).
2. **Require** Manus to send **`X-Caller: manus`** on every request so the backend can:
   - Log and meter by caller
   - Apply Manus-specific behaviour (e.g. `recommend_jobs` returning up to 50 when profile is complete)
3. **Optional later:** Separate API keys per client (e.g. `X-API-Key: manus_xxx` vs Bearer) for Manus-only key rotation.

**Summary:**  
- **Auth:** `Authorization: Bearer <MCP_SHARED_SECRET>` (or a Manus-dedicated secret).  
- **Caller:** `X-Caller: manus` (or `source: "manus"` in tool arguments where supported).

---

## 3. Minimal tool set (first version Customer API)

These are the tools Manus should use; all are already implemented except where noted.

| # | Tool | Purpose |
|---|------|--------|
| 1 | **recommend_jobs** | Get job recommendations for a user (10/50/100 by profile stage; Manus can get up to 50 when profile is complete). |
| 2 | **create_application_intent** | Create an application record for (user, job); returns `application_id` and `job_snapshot`. Required before using `application_id` in prepare. |
| 3 | **prepare_application_context** | Get prompt, job snapshot, submit policy, resume URL for one job. Input: `user_email` + `job_id` **or** `user_email` + `application_id`. |
| 4 | **get_application_status** | *(Not yet implemented)* When added: return status for an `application_id`. |
| 5 | **update_application_status** | *(Phase 2)* When added: Manus reports submitted/failed; Hera updates apply record and can sync to profile. |

**First version:** Tools 1–3 are enough for the standard flow below. Add 4–5 when Hera exposes them.

---

## 4. Standard call sequence (Manus → Hera)

This is the order Manus should call Hera:

```
1. recommend_jobs          → get list of jobs for the user
2. [User selects job(s)]
3. create_application_intent → get application_id + job_snapshot per selected job
4. prepare_application_context(application_id) → get prompt_snippet + job_snapshot + submit_policy (and resume_url if any)
5. [Manus runs browser/task using that context]
```

Steps 1 → 3 → 4 are the **standard sequence**; step 5 is on Manus side.

---

## 5. Request / response (per tool)

All requests are JSON-RPC 2.0 to `POST /api/mcp`.

### 5.1 List tools

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

**Response (concept):** `result.tools[]` with `name`, `description`, `inputSchema` for each tool.

---

### 5.2 recommend_jobs

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "recommend_jobs",
    "arguments": {
      "user_profile": {
        "city": "Melbourne",
        "jobTitles": ["Software Engineer"],
        "skills": ["JavaScript", "React"],
        "employmentHistory": [{ "company": "Acme", "position": "Developer" }]
      },
      "job_title": "Software Engineer",
      "city": "Melbourne",
      "session_id": "manus-session-abc",
      "source": "manus"
    }
  }
}
```

**Important parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `user_profile` | Yes | At least `city`, `jobTitles`. Add `skills` for more jobs (up to 50); add `employmentHistory` for up to 100. |
| `job_title` | Recommended | Job title filter. |
| `city` | Recommended | Location filter. |
| `session_id` | Recommended | Idempotency / session. |
| `source` | Optional | `"manus"` so Hera applies Manus limits (e.g. 50 when profile complete). |

**Response (success):** HTTP 200, body like:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "..." }],
    "total": 50,
    "profile_stage": "auto_apply_ready",
    "auto_apply_ready": true,
    "missing_fields": [],
    "next_actions": ["Use prepare_application_context when you select jobs to apply"],
    "meta": {
      "returned_job_ids": ["id1", "id2", ...]
    }
  }
}
```

**Manus needs:** `result.meta.returned_job_ids` to let the user pick a job, then pass one `job_id` to `create_application_intent`.

---

### 5.3 create_application_intent

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_application_intent",
    "arguments": {
      "user_email": "user@example.com",
      "job_id": "514b716aceb0140b4c3a457ba7686d15",
      "source": "manus",
      "created_by": "manus_task_xyz"
    }
  }
}
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `user_email` | Yes | User email. |
| `job_id` | Yes | One of the IDs from `recommend_jobs` (e.g. from `meta.returned_job_ids`). |
| `source` | Optional | `"manus"` (default). |
| `created_by` | Optional | Manus task/agent id for debugging. |

**Response (success):** HTTP 200, body like:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "Application intent created. Use application_id with prepare_application_context." }],
    "intent_id": "f67fc1ac-ce22-4fb0-acbd-01d6b0900154",
    "application_id": "f67fc1ac-ce22-4fb0-acbd-01d6b0900154",
    "job_snapshot": {
      "id": "514b716aceb0140b4c3a457ba7686d15",
      "title": "Software Engineer II",
      "company": "Acme Corp",
      "location": "Melbourne",
      "jobUrl": "https://...",
      "summary": "..."
    },
    "execution_status": "created",
    "created_at": "2025-03-12T04:00:00.000Z"
  }
}
```

**Manus must use:** `result.application_id` (and optionally `result.job_snapshot`) in the next step. If the same `user_email` + `job_id` is sent again, the same `application_id` is returned (idempotent).

---

### 5.4 prepare_application_context (with application_id)

**Request (preferred when using create_application_intent):**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "prepare_application_context",
    "arguments": {
      "user_email": "user@example.com",
      "application_id": "f67fc1ac-ce22-4fb0-acbd-01d6b0900154"
    }
  }
}
```

**Alternative (without application_id):** pass `job_id` instead of `application_id` (e.g. when not using the intent flow):

```json
"arguments": {
  "user_email": "user@example.com",
  "job_id": "514b716aceb0140b4c3a457ba7686d15"
}
```

**Response (success):** HTTP 200, body like:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "Application context ready for job: ..." }],
    "prompt_snippet": "Apply to this job on behalf of the user. Job: Software Engineer II at Acme. Apply URL: https://... . Do NOT guess sponsor...",
    "submit_policy": "do_not_submit_without_explicit_user_confirmation",
    "job_snapshot": {
      "id": "514b716aceb0140b4c3a457ba7686d15",
      "title": "Software Engineer II",
      "company": "Acme Corp",
      "location": "Melbourne",
      "jobUrl": "https://...",
      "summary": "..."
    },
    "resume_url": "https://... or null",
    "verification_note": "V1: on verification required, pause and hand over to user (manual takeover)."
  }
}
```

**Manus uses:**  
- `prompt_snippet` + `job_snapshot.jobUrl` (and optionally `resume_url`) to run the apply task.  
- `submit_policy`: do not submit without explicit user confirmation.  
- `verification_note`: in v1, on verification required, pause and hand over to user.

---

## 6. Required response fields (for Manus)

| Step | What Manus needs |
|------|-------------------|
| **recommend_jobs** | `result.meta.returned_job_ids` (array of job IDs). |
| **create_application_intent** | `result.application_id`, `result.job_snapshot` (id, title, company, location, jobUrl, summary). |
| **prepare_application_context** | `result.prompt_snippet`, `result.job_snapshot`, `result.submit_policy`, `result.resume_url` (if any), `result.verification_note`. |

All responses are HTTP 200 with a JSON body; errors are returned in `result.content` and/or `result.error` with a descriptive message.

---

## 7. Deployment / environment

| Requirement | Description |
|-------------|-------------|
| **Public base URL** | Production: `https://heraai.net.au` or `https://heraai.one`. Must be reachable from Manus (no local-only). |
| **Path** | `/api/mcp` must be enabled and stable. |
| **Auth** | `MCP_SHARED_SECRET` (or a Manus-specific secret) set in Hera env; Manus sends it as `Authorization: Bearer <secret>`. |
| **Caller header** | Manus sends `X-Caller: manus` (and/or `source: "manus"` in arguments) for correct limits and logging. |
| **MongoDB** | `apply_applications` collection in the same DB as other Hera data (e.g. `hera`); used by `create_application_intent` and `prepare_application_context`. |
| **Profile DB** | User profile (and optional resume) used by `prepare_application_context`; ensure profile service is available. |

No extra gateway or separate “Manus-only” deployment is required; the same `/api/mcp` serves Manus and other callers, differentiated by auth and `X-Caller` / `source`.

---

## 8. One-page summary for Manus

- **Endpoint:** `POST https://heraai.net.au/api/mcp` (or `https://heraai.one/api/mcp`).  
- **Auth:** `Authorization: Bearer <secret>`; optional: `X-Caller: manus`.  
- **Sequence:**  
  1. `recommend_jobs` → take `meta.returned_job_ids`.  
  2. User picks a job → `create_application_intent(user_email, job_id)` → take `application_id`.  
  3. `prepare_application_context(user_email, application_id)` → take `prompt_snippet`, `job_snapshot`, `submit_policy`, `resume_url`, `verification_note`.  
  4. Run browser/task with that context.  
- **Minimal tools:** `recommend_jobs`, `create_application_intent`, `prepare_application_context`.  
- **Docs:** This file: request/response shapes, required fields, and deployment requirements.

This is what Cursor should focus on: **making Hera a stable, documented Customer API that Manus can call**—not on calling Manus from Hera.
