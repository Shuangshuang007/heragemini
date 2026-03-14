#!/usr/bin/env node
/**
 * Step 3 测试：prepare_application_context + record_apply_result 的 ensureProfile
 * 用新 email（无 profile）直接调 prepare 和 record_apply_result，校验 applications 有记录
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
const TOKEN = process.env.MCP_SHARED_SECRET;
const TEST_EMAIL = 'step3-prepare-record-' + Date.now() + '@example.com';

if (!TOKEN) {
  console.error('❌ 请设置 MCP_SHARED_SECRET');
  process.exit(1);
}

async function mcpCall(method, params) {
  const res = await fetch(`${BASE}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return res.json();
}

async function main() {
  console.log('=== Step 3: prepare_application_context + record_apply_result (ensureProfile) ===\n');

  console.log('1. recommend_jobs 取一个 job_id ...');
  const rec = await mcpCall('tools/call', {
    name: 'recommend_jobs',
    arguments: { job_title: 'Engineer', city: 'Sydney', limit: 3, page_size: 3 },
  });
  const ids = rec?.result?.meta?.returned_job_ids || [];
  const jobId = ids[0];
  if (!jobId) {
    console.error('   ❌ 无 job_id');
    process.exit(1);
  }
  console.log('   job_id:', jobId);

  console.log('\n2. prepare_application_context(新 email, job_id) ...');
  const prep = await mcpCall('tools/call', {
    name: 'prepare_application_context',
    arguments: { user_email: TEST_EMAIL, job_id: jobId },
  });
  if (prep?.result?.error || prep?.error) {
    console.error('   ❌', prep?.result?.error || prep?.error);
    process.exit(1);
  }
  console.log('   OK');

  console.log('\n3. record_apply_result(新 email, job_id, submitted) ...');
  const record = await mcpCall('tools/call', {
    name: 'record_apply_result',
    arguments: {
      user_email: TEST_EMAIL,
      job_id: jobId,
      application_status: 'submitted',
      applied_via: 'manus',
    },
  });
  if (record?.result?.error || record?.error) {
    console.error('   ❌', record?.result?.error || record?.error);
    process.exit(1);
  }
  console.log('   OK');

  console.log('\n4. GET /api/applications?email=...');
  const appRes = await fetch(`${BASE}/api/applications?email=${encodeURIComponent(TEST_EMAIL)}`);
  const appData = await appRes.json();
  if (!appData.success) {
    console.error('   ❌', appData.message || appData);
    process.exit(1);
  }
  const apps = appData.applications || [];
  const found = apps.find((a) => a.jobId === jobId);
  if (!found) {
    console.error('   ❌ 未找到 job 记录');
    process.exit(1);
  }
  const ok = found.applicationStartedBy === 'manus' && found.applicationStatus === 'Application Submitted' && found.appliedVia === 'manus';
  if (!ok) {
    console.error('   ❌ 字段不符:', { applicationStartedBy: found.applicationStartedBy, applicationStatus: found.applicationStatus, appliedVia: found.appliedVia });
    process.exit(1);
  }
  console.log('   OK: applicationStartedBy=manus, applicationStatus=Application Submitted, appliedVia=manus');

  console.log('\n✅ Step 3 通过');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
