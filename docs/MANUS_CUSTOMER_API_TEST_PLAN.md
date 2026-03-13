# Hera → Manus Customer API Test Plan

## Goal

Verify that Hera's Customer API can support Manus job application automation.

Testing should happen in four layers:

1. API-level tests
2. MCP tool tests
3. Internal end-to-end flow tests
4. Manus integration tests

The idea is to test progressively, from the smallest unit to the full flow.

---

## 1. API Layer Tests

Test the core APIs independently before involving MCP or Manus.

### 1.1 Test `create_application_intent`

#### Input

- `user_email`
- `job_id`

#### Example request

```json
{
  "tool": "create_application_intent",
  "arguments": {
    "user_email": "test@example.com",
    "job_id": "12345"
  }
}
```

#### Expected result

Response should contain:

- `application_id`
- `job_id`
- `user_email`
- `status`
- `created_at`

Example response:

```json
{
  "application_id": "app_abc123",
  "status": "pending"
}
```

#### Checks

- Application record is created in DB
- `application_id` is unique
- `status` is initialized correctly
- Duplicate requests are handled correctly

#### Edge cases

Test:

1. Same user + same job twice
2. Invalid `job_id`
3. User exceeding active application limit (per-user 100)

---

### 1.2 Test `prepare_application_context`

Test both supported modes.

**Mode A:** `prepare_application_context(user_email, job_id)`

**Mode B:** `prepare_application_context(user_email, application_id)`

#### Expected response

Response should contain:

- `prompt_snippet`
- `job_snapshot`
- `resume_url`
- `submit_policy`
- `attachments`

#### `job_snapshot` should include

- `job_id`
- `title`
- `company`
- `locations`
- `jobUrl`
- `atsSource`
- `workRights`
- `employmentType`
- `workMode`
- `industry`

#### Validation

Confirm:

- All fields are populated (required ones present)
- Job exists
- Profile data loads correctly
- Resume URL is usable when tailored

---

## 2. MCP Tool Exposure Tests

Verify that tools exposed to ChatGPT / Manus are correct.

### Tools to verify

- `recommend_jobs`
- `search_jobs`
- `create_application_intent`
- `prepare_application_context`

### Checks

Confirm:

1. Tool appears in MCP tool list
2. Schema parameters are correct
3. Descriptions are clear
4. Parameters are extractable from natural language

### Example prompt test

**User input:** "Find social media jobs in New York that are onsite"

**Expected extracted parameters:**

- `job_title` = "social media"
- `city` = "New York"
- `workMode` = "onsite"

---

## 3. Internal Flow Test

Test the full internal pipeline without Manus.

### Step 1

Call: `recommend_jobs`

Confirm:

- Jobs are returned
- Scoring works
- Results are ranked correctly

### Step 2

Select one job from results.

Call: `create_application_intent`

Expected:

- `application_id` is generated
- `status` = "queued" (or "pending" per schema)

### Step 3

Call: `prepare_application_context(user_email, application_id)`

Confirm:

- Context is generated
- Job snapshot is correct (jobUrl, company, title, locations, etc.)
- Resume URL is valid when applicable
- Prompt snippet is usable for Manus Create Task

### Success criteria

The following pipeline works end to end:

```
recommend_jobs → create_application_intent → prepare_application_context
```

No missing required fields in job_snapshot or response.

---

## 4. Manus Integration Test

Test real integration with Manus.

Start with a single job application.

### Step 1

Manus calls: `recommend_jobs`

Select a job.

### Step 2

Manus calls: `create_application_intent`

Receives: `application_id`

### Step 3

Manus calls: `prepare_application_context(user_email, application_id)`

Receives job application context (prompt_snippet, job_snapshot, resume_url, etc.).

### Step 4

Manus executes automation:

- Opens `jobUrl`
- Reads context
- Starts filling the application

### First test goal

Automation reaches the application form successfully.

Submission is optional for the first integration test.

---

## 5. Verification Handling Test

Simulate verification scenarios.

### Possible triggers

- Captcha
- Email verification
- Phone verification
- OTP

### Expected behavior

- Automation pauses
- Application status is updated (when report_verification_required is implemented)
- Human intervention is required (v1: manual takeover)

The system should not crash or lose state.

---

## 6. Performance Check

Ensure the API remains responsive.

### Key checks

- `recommend_jobs` response time
- `create_application_intent` latency
- `prepare_application_context` latency

### Suggested target

Under 1 second for API response in normal cases (recommend_jobs may be longer due to scoring).

---

## 7. Minimum Success Criteria

Customer API can be considered ready when:

1. `recommend_jobs → create_application_intent → prepare_application_context` works end to end
2. Manus can consume `prepare_application_context` (job_snapshot has jobUrl, company, title, locations; no second lookup needed)
3. One real job application flow runs successfully (automation reaches form)
4. Verification scenarios do not break the system

---

## 8. Suggested Test Order

Run tests in this order:

1. `create_application_intent`
2. `prepare_application_context`
3. Internal pipeline test
4. MCP tool exposure test
5. Manus single-job integration test
6. Verification handling test

This order helps isolate issues quickly.

---

## 9. Logging Checklist

For every test, record:

- Request payload
- Response payload
- DB write success/failure
- API latency
- Error messages
- Manus step reached before failure (for integration tests)

This will make debugging much easier.
