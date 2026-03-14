#!/usr/bin/env node
/**
 * Step 2 测试：record_jobs_for_apply + refine 不再写 liked
 * 1. recommend_jobs 取 2 个 job_id
 * 2. record_jobs_for_apply(user_email, job_ids) → 应写入 applications
 * 3. GET /api/applications 应看到这 2 条
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
const TEST_EMAIL = 'step2-record-jobs-' + Date.now() + '@example.com';

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
  console.log('=== Step 2: record_jobs_for_apply ===\n');

  console.log('1. recommend_jobs 取 job_ids ...');
  const rec = await mcpCall('tools/call', {
    name: 'recommend_jobs',
    arguments: { job_title: 'Engineer', city: 'Sydney', limit: 5, page_size: 5 },
  });
  const ids = rec?.result?.meta?.returned_job_ids || [];
  if (ids.length < 2) {
    console.log('   ⚠️ 不足 2 个 job_id，用现有数量继续');
  }
  const jobIds = ids.slice(0, 2);
  console.log('   job_ids:', jobIds);

  console.log('\n2. record_jobs_for_apply(user_email, job_ids) ...');
  const recRes = await mcpCall('tools/call', {
    name: 'record_jobs_for_apply',
    arguments: { user_email: TEST_EMAIL, job_ids: jobIds },
  });
  if (recRes.error || recRes.result?.error) {
    console.error('   ❌', recRes.error || recRes.result);
    process.exit(1);
  }
  console.log('   OK:', recRes.result?.content?.[0]?.text || recRes.result?.synced_count);

  console.log('\n3. GET /api/applications?email=...');
  const appRes = await fetch(`${BASE}/api/applications?email=${encodeURIComponent(TEST_EMAIL)}`);
  const appData = await appRes.json();
  if (!appData.success) {
    console.error('   ❌', appData.message || appData);
    process.exit(1);
  }
  const apps = appData.applications || [];
  const found = jobIds.every((id) => apps.some((a) => a.jobId === id));
  if (!found) {
    console.error('   ❌ applications 中未找到全部 job_ids');
    console.log('   applications:', apps.length, apps.map((a) => a.jobId));
    process.exit(1);
  }
  console.log('   OK: applications 中含', jobIds.length, '条');

  console.log('\n✅ Step 2 通过');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
