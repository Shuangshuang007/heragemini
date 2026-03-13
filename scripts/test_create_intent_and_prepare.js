#!/usr/bin/env node
/**
 * Test Phase 1 bridge: create_application_intent → prepare_application_context(application_id)
 * 1. create_application_intent(user_email, job_id) → application_id, job_snapshot
 * 2. prepare_application_context(user_email, application_id) → prompt_snippet, job_snapshot, submit_policy
 */

const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const BASE = process.env.MCP_TEST_BASE_URL || 'http://localhost:3002';
const TOKEN = process.env.MCP_SHARED_SECRET ? String(process.env.MCP_SHARED_SECRET).trim() : '';
const USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';

if (!TOKEN) {
  console.error('Set MCP_SHARED_SECRET (and optionally MCP_TEST_BASE_URL, TEST_JOB_ID, TEST_USER_EMAIL).');
  process.exit(1);
}

// 调试 401 时对比：本地 token 长度/首尾是否有多余字符（不打印明文）
const raw = process.env.MCP_SHARED_SECRET || '';
const hasWrap = raw !== raw.trim() || /^["']|["']$/.test(raw);
if (process.env.DEBUG_MCP_AUTH) {
  console.log('[DEBUG] MCP_SHARED_SECRET length:', TOKEN.length, '| had leading/trailing wrap?:', hasWrap);
}

async function mcpCall(method, params = {}) {
  const res = await fetch(`${BASE}/api/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  return data;
}

async function main() {
  console.log('=== Test: create_application_intent → prepare_application_context(application_id) ===\n');
  console.log('Base URL:', BASE);
  console.log('User email:', USER_EMAIL);

  let jobId = process.env.TEST_JOB_ID;
  if (!jobId) {
    console.log('\n--- Getting job_id from recommend_jobs ---');
    try {
      const rec = await mcpCall('tools/call', {
        name: 'recommend_jobs',
        arguments: {
          job_title: 'Software Engineer',
          city: 'Melbourne',
          user_profile: { city: 'Melbourne', jobTitles: ['Software Engineer'] },
          session_id: 'test-intent-' + Date.now(),
        },
      });
      const ids = rec?.result?.meta?.returned_job_ids;
      if (Array.isArray(ids) && ids.length) jobId = ids[0];
    } catch (e) {
      console.error('  Error:', e.message);
    }
  }
  if (!jobId) {
    console.error('No job_id. Set TEST_JOB_ID or ensure recommend_jobs returns data.');
    process.exit(1);
  }
  console.log('job_id:', jobId);

  // --- Step 1: create_application_intent ---
  console.log('\n--- Step 1: create_application_intent ---');
  let applicationId;
  let intentResult;
  try {
    const r = await mcpCall('tools/call', {
      name: 'create_application_intent',
      arguments: {
        user_email: USER_EMAIL,
        job_id: jobId,
        source: 'manus',
      },
    });
    intentResult = r.result || {};
    applicationId = intentResult.application_id || intentResult.intent_id;
    const hasId = !!applicationId;
    const hasSnapshot = !!intentResult.job_snapshot && (intentResult.job_snapshot.title || intentResult.job_snapshot.jobUrl);
    const status = intentResult.execution_status;

    console.log('  application_id:', applicationId || '(missing)');
    console.log('  execution_status:', status);
    console.log('  job_snapshot:', hasSnapshot ? 'present' : 'missing');
    if (intentResult.error) console.log('  error:', intentResult.error);

    if (!hasId || !hasSnapshot) {
      console.log('  ❌ FAIL: expected application_id and job_snapshot');
      process.exit(1);
    }
    console.log('  ✅ PASS');
  } catch (e) {
    console.error('  ❌ Error:', e.message);
    process.exit(1);
  }

  // --- Step 2: prepare_application_context(application_id) ---
  console.log('\n--- Step 2: prepare_application_context(user_email, application_id) ---');
  try {
    const r = await mcpCall('tools/call', {
      name: 'prepare_application_context',
      arguments: {
        user_email: USER_EMAIL,
        application_id: applicationId,
      },
    });
    const result = r.result || {};
    const hasPrompt = !!result.prompt_snippet;
    const hasSnapshot = !!result.job_snapshot && (result.job_snapshot.title || result.job_snapshot.jobUrl);
    const hasPolicy = result.submit_policy === 'do_not_submit_without_explicit_user_confirmation';
    const hasNote = !!result.verification_note;

    console.log('  prompt_snippet:', hasPrompt ? 'present' : 'missing');
    console.log('  job_snapshot:', hasSnapshot ? 'present' : 'missing');
    console.log('  submit_policy:', result.submit_policy);
    console.log('  verification_note:', hasNote ? 'present' : 'missing');
    if (result.job_snapshot) {
      console.log('  job_snapshot.title:', result.job_snapshot.title);
      console.log('  job_snapshot.jobUrl:', result.job_snapshot.jobUrl ? '(set)' : '(missing)');
    }
    if (result.error) console.log('  error:', result.error);

    if (!hasPrompt || !hasSnapshot || !hasPolicy) {
      console.log('  ❌ FAIL: expected prompt_snippet, job_snapshot, submit_policy');
      process.exit(1);
    }
    console.log('  ✅ PASS');
  } catch (e) {
    console.error('  ❌ Error:', e.message);
    process.exit(1);
  }

  // --- Idempotent: create_application_intent again same user+job → same application_id ---
  console.log('\n--- Step 3: idempotent create_application_intent (same user+job) ---');
  try {
    const r2 = await mcpCall('tools/call', {
      name: 'create_application_intent',
      arguments: { user_email: USER_EMAIL, job_id: jobId },
    });
    const id2 = r2.result?.application_id || r2.result?.intent_id;
    const sameId = id2 === applicationId;
    console.log('  application_id:', id2, sameId ? '(same ✓)' : '(different)');
    console.log(sameId ? '  ✅ PASS (idempotent)' : '  ❌ FAIL (expected same id)');
  } catch (e) {
    console.error('  ❌ Error:', e.message);
  }

  console.log('\n=== All checks done ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
