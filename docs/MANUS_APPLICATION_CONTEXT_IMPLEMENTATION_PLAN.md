# Hera → Manus: Application Context API – Technical Implementation Plan

## 0. Confirmed design choices

- **100 active limit:** **Per user** (per user active applications ≤ 100). Not global, so multi-user systems are not affected. When creating an intent, count only applications for that `user_email` in statuses `queued` / `prechecking` / `ready` / `running`; reject if ≥ 100.
- **job_snapshot (and create_application_intent response):** MUST include **jobUrl**, **company**, **title**, **location** (and/or **locations**) so that Manus browser automation can open the apply page and identify the job **without a second lookup**. Optional: summary, atsSource, platform, workRights. When integrating with Manus, these conventions are the source of truth; if Manus later requires additional or fewer fields, extend the job_snapshot structure accordingly.

---

## 1. Current Status

### 1.1 Already in place

- **Job discovery & recommendation**
  - `search_jobs` (FAST: single Mongo query + app-layer scoring; 10/20/50; company-only).
  - `recommend_jobs` (single query, hard constraints only, pool 200, score, top N; company optional).
  - `queryJobsWithFilters` in JDS (unchanged); MCP in `src/app/api/mcp/route.ts`.

- **Existing `prepare_application_context` (MCP tool)**
  - **Input:** `user_email`, `job_id` (no `application_id`).
  - **Behaviour:** Fetches job via `queryJobsByIds([job_id])`, profile via `getUserProfile(user_email)`; builds `job_snapshot`, `prompt_snippet`, `submit_policy`, `resume_url` (from profile.applications for that job).
  - **Output:** `prompt_snippet`, `submit_policy`, `job_snapshot`, `resume_url`, `verification_note` (v1 manual takeover).
  - **Gap vs design:** Does not use an “Application” record; does not accept `application_id`; no link to orchestration (create intent → prepare context → report verification → update status).

- **Profile & applications**
  - `get_user_applications`, `upsertJobApplication`, profile `applications[]` (jobId, resumeTailor, applicationStatus, etc.) for display and tailor resume.

### 1.2 Missing for full Customer API integration

| Piece | Purpose |
|-------|--------|
| **Application (orchestration) record** | Single place to track “user applied to job via Manus”: status, task_id, resume_url, timestamps; 100 active limit; link from Manus task back to Hera. |
| **create_application_intent** | Create orchestration record from (user_email, job_id); return application_id for use in prepare_application_context and later callbacks. |
| **prepare_application_context (alignment)** | Accept either `(user_email, job_id)` or `(user_email, application_id)`; when application_id is used, load job from Application.job_id and optionally enrich from DB; return same shape for Manus Create Task. |
| **report_verification_required** | Manus calls when verification/confirmation needed; Hera creates PendingAction, updates Application status, schedules reminders (v2). |
| **resolve_pending_action** | User completed action; Hera marks PendingAction resolved, updates Application (v2). |
| **update_application_status** | Manus reports submitted/failed/expired; Hera updates Application and syncs to profile.applications.applicationStatus. |

So the “bridge” from recommendation to execution is: **create intent (optional but recommended) → prepare context → Manus Create Task**; then **report verification / resolve / update status** for lifecycle.

---

## 2. Proposed Architecture

### 2.1 Two-phase approach

- **Phase 1 (minimal bridge)**  
  - Keep current `prepare_application_context(user_email, job_id)` working.  
  - Add **optional** `application_id` path: if Manus first calls `create_application_intent`, it gets `application_id`; then it can call `prepare_application_context(user_email, application_id)`.  
  - Implement **create_application_intent** and a single **Application** store (in-memory or DB) so that:  
    - We have a record per “user applied to job via Manus.”  
    - We can enforce “100 active applications” and return application_id.  
  - **No** PendingAction / VerificationEvent / reminders in Phase 1; verification remains “manual takeover” as today.

- **Phase 2 (full orchestration)**  
  - Add **report_verification_required**, **resolve_pending_action**, **update_application_status**.  
  - Add PendingAction, VerificationEvent, reminder scheduling, and optional SessionLane as in MANUS_CUSTOMER_API_DESIGN.md.

### 2.2 Where the APIs live

- **Recommendation:** Keep all as **MCP tools** on the same route (`src/app/api/mcp/route.ts`).  
- **Auth:** Reuse existing MCP auth; distinguish Manus via `source: 'manus'` or header (e.g. `X-Caller: manus`) for logging and limits.  
- **Optional:** Later add a thin HTTP wrapper (e.g. `/api/manus/prepare-context`) that maps to the same handler logic if Manus prefers REST; not required for first version.

---

## 3. Data Model (Phase 1)

### 3.1 Naming and placement

- **Collection:** `apply_applications` (not `manus_applications`), so it can hold records for `source: manus | hera_web | api_partner | internal` later.
- **Database:** Same DB as other Hera data (e.g. `hera`); collection lives under that DB.

### 3.2 Application (orchestration) – source of truth

- **apply_applications** is the **source of truth** for execution state. **profile.applications** is a **UI projection** (display list); do not treat profile.applications as the system of record. When syncing final status (e.g. submitted/failed), write applies in **apply_applications** first, then project or sync to profile for UI.
- **Relationship with search/history:** User’s search history and apply records are **not** tightly coupled. Keep search history and apply_applications separate so schemas stay simple. No foreign key from apply to search.

### 3.3 Minimal Phase 1 schema (apply_applications)

- **`_id`** (or **`id`**): application_id (UUID), primary key.
- **`user_id`** (primary user reference): Stable ID for the user (e.g. profile `_id` after lookup by email). Prefer this over email long-term (email can change; profile usually has a stable id). If profile is looked up by `user_email`, set `user_id` from profile when present.
- **`user_email`**: Stored for display, notifications, and as fallback when `user_id` is not yet available. API can continue to accept `user_email` from Manus; we resolve to `user_id` when loading profile.
- **`job_id`**: Hera job id.
- **`job_snapshot`**: title, company, jobUrl, location(s), etc., filled at intent creation or at prepare time (so Manus does not need a second lookup).
- **`source`**: Enum from day one: `manus` | `hera_web` | `api_partner` | `internal`. No free text.
- **`execution_status`**: Execution state for Manus to read/write. Minimal set: `created` | `queued` | `running` | `verification_required` | `submitted` | `failed` (add `expired` if needed). Replaces a vague single `status` so Manus can reliably update state.
- **`created_at`**, **`updated_at`**: Timestamps.
- **Optional for Phase 1:** `created_by` (e.g. `manus_agent_id`) for debugging; `manus_task_id`, `manus_task_url`, `resume_url` (set in prepare_application_context).

**100 active limit:** Per **user** (by `user_id` when set, else by `user_email`). Count documents in `apply_applications` where `execution_status` is one of `created` | `queued` | `running` | `verification_required` for that user; reject create if ≥ 100.

### 3.4 No new tables in Phase 1 for verification

- PendingAction, VerificationEvent, ReminderSchedule, SessionLane → Phase 2.

---

## 4. API Contracts (Phase 1)

### 4.1 create_application_intent

- **Input:** `user_email` (required), `job_id` (required), optional `resume_file_id`, optional `source` (default `manus`, must be one of enum), optional `created_by` (e.g. manus_agent_id).  
- **Validation:** Job exists (queryJobsByIds); **per-user** 100 active limit not exceeded (count by `user_id` when available from profile lookup, else by `user_email`).  
- **Logic:**  
  - Optionally resolve `user_id`: look up profile by `user_email`; if found, set `user_id` (e.g. profile `_id`).  
  - Create document in **apply_applications** with `execution_status: "created"` or `"queued"`, `source`, `created_at`/`updated_at`, optional `created_by`.  
  - Do **not** treat profile.applications as source of truth; optionally **project** a minimal entry to profile.applications for UI (jobId + jobSave) after writing to apply_applications.  
- **Output:** `{ intent_id, application_id, job_snapshot, execution_status: "created"|"queued", created_at }` (intent_id can equal application_id).

### 4.2 prepare_application_context (updated)

- **Input (both supported):**  
  - **A:** `user_email` + `job_id` (current behaviour; no Application record).  
  - **B:** `user_email` + `application_id` (preferred when Manus uses create_application_intent).  
- **Resolution:**  
  - If `application_id` is provided: load Application from **apply_applications** by id; take `job_id`, `user_id`/`user_email`, and optionally `job_snapshot` from it; fetch job + profile as needed; optionally update Application with `resume_url` and `execution_status: "running"` (or a dedicated "ready" value).  
  - If only `job_id` is provided: keep current behaviour (fetch job by id, profile by email).  
- **Output (unchanged shape):**  
  - `prompt_snippet`, `submit_policy`, `job_snapshot`, `resume_url`, `verification_note`  
  - Optional: `attachments` array (e.g. `[{ filename, url }]` for resume).  
- **Job snapshot (required for Manus browser automation – no second lookup):** MUST include so that Manus can open the apply page and identify the job without calling Hera again:
  - **job_id** (id)
  - **title**
  - **company**
  - **location** and/or **locations** (display string and/or raw DB locations; Manus may need both for UI and matching)
  - **jobUrl** (apply URL – primary link for automation)
  - **summary** (optional but useful for prompt)
  - Optionally: atsSource, platform, workRights (for instruction: do not guess sponsor/citizenship).
  - Same fields MUST be returned in **create_application_intent**’s `job_snapshot` so that a single create + prepare flow has everything Manus needs.

### 4.3 get_user_applications (existing)

- No change in Phase 1. Later (Phase 2) you can extend to include orchestration status (e.g. from Application) if desired.

---

## 5. Implementation Order (Phase 1)

1. **Data layer**
   - Define Application type and create store (new Mongo collection recommended; or in-memory + file for PoC).
   - Implement: create application, get by id, **count active by user** (for per-user 100 limit).

2. **create_application_intent**
   - In MCP route: new tool branch; validate user_email + job_id; check 100 limit; create Application; return application_id + job_snapshot.

3. **prepare_application_context**
   - Accept `application_id` in addition to `job_id`.
   - If application_id: load Application → job_id (and optional cached job_snapshot); fetch latest job from DB for freshness; build prompt_snippet, submit_policy, resume_url (from profile or Application), job_snapshot, attachments.
   - If job_id only: keep current behaviour.
   - Enrich job_snapshot with atsSource, platform, workRights if available from job document (no JDS change; use existing job shape from queryJobsByIds).

4. **MCP tool list & docs**
   - Register create_application_intent in tools/list and in the handler.
   - Update tool description for prepare_application_context to state that either (user_email, job_id) or (user_email, application_id) can be used.

5. **Tests**
   - Call create_application_intent then prepare_application_context(application_id); assert response shape and that Manus can use prompt_snippet + job_snapshot + resume_url.

---

## 6. What stays unchanged (no JDS changes)

- **jobDatabaseService.ts:** No changes; continue to use `queryJobsWithFilters`, `queryJobsByIds`, existing job schema (industry, workMode, employmentType, skills, workRights, etc.).
- **search_jobs / recommend_jobs:** No change to query or scoring logic; only the “bridge” (intent + prepare context) is added.
- **Profile DB:** **apply_applications** is source of truth; optional projection/sync from apply_applications to profile.applications for UI. No change to get_user_applications or upsertJobApplication contract.

---

## 7. Phase 2 (later) – list only

- Implement **report_verification_required**, **resolve_pending_action**, **update_application_status** as in MANUS_CUSTOMER_API_DESIGN.md.
- Add collections: PendingAction, VerificationEvent, ReminderSchedule; optional SessionLane.
- Implement reminder scheduling (e.g. 10m / 3m before expiry) and expiration.
- Sync final status to profile via existing `upsertJobApplication` in update_application_status.
- Optional: Manus webhook for task_stopped and Hera callback when pending action is resolved.

---

## 8. Summary

- **Bridge today:** recommend_jobs / search_jobs → user picks job → **prepare_application_context(user_email, job_id)** → Manus Create Task. This already works; no JDS change.
- **Bridge improved (Phase 1):** Add **create_application_intent** and **apply_applications** collection; support **prepare_application_context(user_email, application_id)** so Manus has a stable application_id for verification and status callbacks later; enforce 100 active applications per user.
- **Phase 2:** Add verification reporting, resolution, status update, and reminders as in the design doc.

This plan is implementation-ready: you can implement Phase 1 in the order of Section 5 without changing JDS or existing search/recommend behaviour.

---

## 9. Alignment with GPT design feedback

- **Collection:** `apply_applications` (not manus_applications) — supports multiple sources later.
- **User reference:** `user_id` primary, `user_email` optional/stored; API can still accept `user_email` and resolve to `user_id` via profile lookup.
- **Source of truth:** `apply_applications` = execution truth; `profile.applications` = UI projection; do not use profile as system of record for apply state.
- **execution_status:** Field with enum `created` | `queued` | `running` | `verification_required` | `submitted` | `failed` so Manus can report/read state.
- **source:** Enum from start: `manus` | `hera_web` | `api_partner` | `internal`.
- **created_by:** Optional (e.g. manus_agent_id) for debugging.
- **Search vs apply:** Search history and apply_applications are not tightly coupled; keep schemas separate.
