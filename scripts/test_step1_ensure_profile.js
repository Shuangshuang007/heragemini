#!/usr/bin/env node
/**
 * Step 1 测试：ensureProfileForEmail + get_job_detail 写入 applications
 * 用新 email 调 get_job_detail(job_id, user_email)，再 GET /api/applications 校验
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
const TEST_EMAIL = 'step1-ensure-profile-' + Date.now() + '@example.com';

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
  console.log('=== Step 1: ensureProfileForEmail + get_job_detail ===\n');
  console.log('Base:', BASE);
  console.log('Test email (new, no profile):', TEST_EMAIL);

  // 1) recommend_jobs 拿一个真实 job_id
  console.log('\n1. recommend_jobs 取 job_id ...');
  const rec = await mcpCall('tools/call', {
    name: 'recommend_jobs',
    arguments: { job_title: 'Engineer', city: 'Sydney', limit: 3, page_size: 3 },
  });
  const ids = rec?.result?.meta?.returned_job_ids || [];
  const jobId = ids[0];
  if (!jobId) {
    console.log('   ⚠️ 无 job_id，跳过 get_job_detail 写入测试');
    process.exit(0);
  }
  console.log('   job_id:', jobId);

  // 2) get_job_detail(job_id, user_email) → 应 ensure profile + 写入 applications
  console.log('\n2. get_job_detail(job_id, user_email) ...');
  const detail = await mcpCall('tools/call', {
    name: 'get_job_detail',
    arguments: { job_id: jobId, user_email: TEST_EMAIL },
  });
  if (detail.error) {
    console.error('   ❌ get_job_detail error:', detail.error);
    process.exit(1);
  }
  console.log('   OK, job_detail returned');

  // 3) GET /api/applications?email=... 应有该 job
  console.log('\n3. GET /api/applications?email=...');
  const appRes = await fetch(`${BASE}/api/applications?email=${encodeURIComponent(TEST_EMAIL)}`);
  const appData = await appRes.json();
  if (!appData.success) {
    console.error('   ❌ applications API error:', appData.message || appData);
    process.exit(1);
  }
  const apps = appData.applications || [];
  const found = apps.find((a) => a.jobId === jobId);
  if (!found) {
    console.error('   ❌ 未在 applications 中找到 job_id:', jobId);
    console.log('   applications count:', apps.length);
    process.exit(1);
  }
  console.log('   OK: applications 中含该 job, jobSave:', found.jobSave?.title, found.jobSave?.company);

  console.log('\n✅ Step 1 通过：ensureProfileForEmail + get_job_detail 写入正常');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
