#!/usr/bin/env node
/**
 * Test Manus staged profile (steps 1-3):
 * 1. recommend_jobs tiered limit: 10 / 50 / 100
 * 2. Response has profile_stage, auto_apply_ready, missing_fields, next_actions
 * 3. prepare_application_context returns prompt_snippet, job_snapshot, submit_policy
 */

const path = require('path');
const fs = require('fs');
// Load .env.local from project root if present
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const BASE = process.env.MCP_TEST_BASE_URL || 'http://localhost:3000';
const TOKEN = process.env.MCP_SHARED_SECRET;

if (!TOKEN) {
  console.error('Set MCP_SHARED_SECRET (and optionally MCP_TEST_BASE_URL). Or add to .env.local.');
  process.exit(1);
}

async function mcpCall(method, params = {}) {
  const res = await fetch(`${BASE}/api/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return data;
}

async function main() {
  console.log('=== Testing Manus staged profile (steps 1-3) ===\n');
  console.log('Base URL:', BASE);

  // Search: job title + city (required for recommendation). Use "software engineer in New York City".
  const jobTitle = 'Software Engineer';
  const city = 'New York City';

  // ----- Step 1 + 2: recommend_jobs with 3 profile levels (all use same job_title + city) -----
  const stages = [
    {
      name: 'recommendable (job_title + city only)',
      args: {
        job_title: jobTitle,
        city,
        user_profile: { city, jobTitles: [jobTitle] },
        session_id: 'test-s1',
      },
      expectStage: 'recommendable',
      expectMaxTotal: 10,
    },
    {
      name: 'enhanced_recommendation (+ skills)',
      args: {
        job_title: jobTitle,
        city,
        user_profile: {
          city,
          jobTitles: [jobTitle],
          skills: ['JavaScript', 'React'],
        },
        session_id: 'test-s2',
      },
      expectStage: 'enhanced_recommendation',
      expectMaxTotal: 50,
    },
    {
      name: 'auto_apply_ready (+ employmentHistory)',
      args: {
        job_title: jobTitle,
        city,
        user_profile: {
          city,
          jobTitles: [jobTitle],
          skills: ['JavaScript', 'React'],
          employmentHistory: [{ company: 'Acme', position: 'Developer' }],
        },
        session_id: 'test-s3',
      },
      expectStage: 'auto_apply_ready',
      expectMaxTotal: 100,
    },
  ];

  for (const s of stages) {
    console.log('\n--- recommend_jobs:', s.name, '---');
    try {
      const r = await mcpCall('tools/call', {
        name: 'recommend_jobs',
        arguments: s.args,
      });
      s.lastResult = r;
      const result = r.result || {};
      const total = result.total ?? (result.content?.[0] ? 'N/A' : 0);
      const profile_stage = result.profile_stage;
      const auto_apply_ready = result.auto_apply_ready;
      const missing_fields = result.missing_fields;
      const next_actions = result.next_actions;

      const okStage = profile_stage === s.expectStage;
      const okTotal = typeof total === 'number' && total <= s.expectMaxTotal;
      const okFields =
        Array.isArray(missing_fields) &&
        Array.isArray(next_actions) &&
        typeof auto_apply_ready === 'boolean';

      console.log('  profile_stage:', profile_stage, okStage ? '✓' : `(expected ${s.expectStage})`);
      console.log('  total:', total, okTotal ? '✓' : total > s.expectMaxTotal ? `(max ${s.expectMaxTotal})` : '');
      if (total === 0) console.log('  (0 jobs may be due to DB/Mongo timeout or no data for this city)');
      console.log('  auto_apply_ready:', auto_apply_ready);
      console.log('  missing_fields:', missing_fields?.length ?? 0, 'items');
      console.log('  next_actions:', next_actions?.length ?? 0, 'items');
      if (!okFields) console.log('  ⚠ result missing missing_fields or next_actions');
      console.log(okStage && okFields ? '  ✅ PASS (structure)' : '  ❌ FAIL');
      if (total > 0 && !okTotal) console.log('  ⚠ total over limit for stage');
    } catch (e) {
      console.log('  ❌ Error:', e.message);
    }
  }

  // ----- Step 3: prepare_application_context -----
  console.log('\n--- prepare_application_context ---');
  let jobId = process.env.TEST_JOB_ID;
  if (!jobId && stages[0].lastResult?.result?.meta?.returned_job_ids?.length) {
    jobId = stages[0].lastResult.result.meta.returned_job_ids[0];
  }
  if (!jobId) {
    try {
      const rec = await mcpCall('tools/call', {
        name: 'recommend_jobs',
        arguments: { user_profile: { city: 'Melbourne' }, session_id: 'test-get-id' },
      });
      const ids = rec?.result?.meta?.returned_job_ids;
      if (Array.isArray(ids) && ids.length) jobId = ids[0];
    } catch (e) {
      console.log('  (get job_id from recommend_jobs failed)', e.message);
    }
  }
  if (jobId) {
    try {
      const r = await mcpCall('tools/call', {
        name: 'prepare_application_context',
        arguments: { user_email: 'test@example.com', job_id: jobId },
      });
      const result = r.result || {};
      const hasPrompt = !!result.prompt_snippet;
      const hasSnapshot = !!result.job_snapshot && (result.job_snapshot.title || result.job_snapshot.company);
      const hasPolicy = result.submit_policy === 'do_not_submit_without_explicit_user_confirmation';
      const hasNote = !!result.verification_note;
      console.log('  job_id:', jobId);
      console.log('  prompt_snippet:', hasPrompt ? 'present ✓' : 'missing');
      console.log('  job_snapshot:', hasSnapshot ? 'present ✓' : 'missing');
      console.log('  submit_policy:', result.submit_policy, hasPolicy ? '✓' : '');
      console.log('  verification_note:', hasNote ? 'present ✓' : 'missing');
      console.log(hasPrompt && hasSnapshot && hasPolicy ? '  ✅ PASS' : '  ❌ FAIL');
    } catch (e) {
      console.log('  ❌ Error:', e.message);
    }
  } else {
    console.log('  ⚠ Skip (no job_id). Set TEST_JOB_ID or ensure search_jobs returns ids.');
  }

  console.log('\n=== Done ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
