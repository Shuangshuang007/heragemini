#!/usr/bin/env node
/**
 * 接入 Manus 前自测：模拟 Manus 调用链路
 * 1. recommend_jobs 拿 job_id
 * 2. refine_recommendations (liked) → 写入 jobSave
 * 3. prepare_application_context → 写入 applicationStartedBy
 * 4. record_apply_result → 写入 applicationStatus + appliedVia
 * 5. GET /api/applications 校验数据
 *
 * 使用方式：在项目根目录执行
 *   node scripts/test_manus_integration_pre.js
 * 需设置 MCP_SHARED_SECRET，可选 MCP_TEST_BASE_URL（默认 http://localhost:3002）
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
const TEST_EMAIL = process.env.MANUS_TEST_EMAIL || 'manus-pre-test@example.com';
const SKIP_RECOMMEND = process.env.SKIP_RECOMMEND === '1'; // 只测 record_apply_result + GET（需先有 profile+application）

if (!TOKEN) {
  console.error('❌ 请设置 MCP_SHARED_SECRET（.env.local 或环境变量）');
  process.exit(1);
}

async function mcpCall(method, params = {}) {
  const res = await fetch(`${BASE}/api/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return data;
}

async function main() {
  console.log('=== 接入 Manus 前自测 ===\n');
  console.log('Base URL:', BASE);
  console.log('Test user_email:', TEST_EMAIL);
  console.log('');

  let jobId = null;

  let ids = [];
  if (!SKIP_RECOMMEND) {
    // Step 1: recommend_jobs 拿一个 job_id
    console.log('Step 1: recommend_jobs 获取 job_id ...');
    const rec = await mcpCall('tools/call', {
      name: 'recommend_jobs',
      arguments: {
        job_title: 'Software Engineer',
        city: 'Sydney',
        user_profile: { city: 'Sydney', jobTitles: ['Software Engineer'], skills: ['JavaScript'] },
        user_email: TEST_EMAIL,
        limit: 5,
        page_size: 5,
      },
    });
    ids = rec?.result?.meta?.returned_job_ids || [];
    if (ids.length === 0) {
      console.log('⚠️ 没有返回职位，用占位 job_id 继续测写入路径。');
      jobId = 'test-job-id-' + Date.now();
    } else {
      jobId = ids[0];
      console.log('   job_id:', jobId);
    }
    console.log('   OK\n');
  } else {
    jobId = process.env.TEST_JOB_ID || 'test-job-id-' + Date.now();
    console.log('Step 1: 跳过 recommend（SKIP_RECOMMEND=1），使用 job_id:', jobId);
    console.log('');
  }

  // Step 2: refine_recommendations (liked) → 应写入 profile.applications jobSave
  console.log('Step 2: refine_recommendations (user_email + liked_job_ids) ...');
  const refineRes = await mcpCall('tools/call', {
    name: 'refine_recommendations',
    arguments: {
      user_email: TEST_EMAIL,
      liked_job_ids: jobId ? [jobId] : [],
      exclude_ids: ids.slice(0, 10),
      limit: 5,
    },
  });
  if (refineRes.error) {
    console.log('   ⚠️ refine 返回 error（可能无推荐结果）:', refineRes.error);
  } else {
    console.log('   OK');
  }
  console.log('');

  // Step 3: prepare_application_context → 应写入 applicationStartedBy: manus
  console.log('Step 3: prepare_application_context (user_email + job_id) ...');
  const prepRes = await mcpCall('tools/call', {
    name: 'prepare_application_context',
    arguments: {
      user_email: TEST_EMAIL,
      job_id: jobId,
    },
  });
  const prepErr = prepRes?.result?.error || prepRes?.error;
  if (prepErr) {
    if (String(prepErr).includes('Job not found') && jobId.startsWith('test-job-id-')) {
      console.log('   ⚠️ 占位 job_id 无对应职位，prepare 报 job not found 属预期');
    } else {
      console.log('   ❌', prepErr);
    }
  } else {
    console.log('   OK', prepRes?.result?.resume_url ? '(含 resume_url)' : '');
  }
  console.log('');

  // Step 4: record_apply_result → 应写入 applicationStatus + appliedVia
  console.log('Step 4: record_apply_result (submitted, applied_via: manus) ...');
  const recordRes = await mcpCall('tools/call', {
    name: 'record_apply_result',
    arguments: {
      user_email: TEST_EMAIL,
      job_id: jobId,
      application_status: 'submitted',
      applied_via: 'manus',
      failure_reason: null,
    },
  });
  const recordErr = recordRes?.result?.error || recordRes?.error;
  if (recordErr) {
    console.log('   ❌', recordErr);
  } else {
    console.log('   OK');
  }
  console.log('');

  // Step 5: GET /api/applications 校验
  console.log('Step 5: GET /api/applications?email=... 校验数据 ...');
  const appRes = await fetch(`${BASE}/api/applications?email=${encodeURIComponent(TEST_EMAIL)}`);
  const appData = await appRes.json();
  if (!appRes.ok) {
    console.log('   ❌ HTTP', appRes.status, appData);
    return;
  }
  if (!appData.success) {
    console.log('   ⚠️ success: false, message:', appData.message);
    if (appData.message === 'Profile not found') {
      console.log('   （find_or_create 可能未在 tools/call 时为该 email 建 profile，或需先 recommend_jobs 带 user_email 触发）');
    }
    console.log('');
    console.log('=== 自测结束（部分步骤依赖 profile 存在）===');
    return;
  }
  const applications = appData.applications || [];
  const ourApp = applications.find((a) => a.jobId === jobId);
  if (!ourApp) {
    console.log('   当前列表中没有 job_id:', jobId);
    console.log('   列表长度:', applications.length);
    if (applications.length > 0) {
      console.log('   第一条 jobId:', applications[0].jobId);
    }
  } else {
    console.log('   找到对应申请记录:');
    console.log('     jobSave:', ourApp.jobSave ? '有' : '无');
    console.log('     applicationStartedBy:', ourApp.applicationStartedBy || '(未设)');
    console.log('     applicationStatus:', ourApp.applicationStatus || '(未设)');
    console.log('     appliedVia:', ourApp.appliedVia || '(未设)');
    const ok =
      (ourApp.jobSave || ourApp.applicationStartedBy) &&
      ourApp.applicationStatus === 'Application Submitted' &&
      ourApp.appliedVia === 'manus';
    if (ok) {
      console.log('   ✅ 数据符合 Manus 对接预期');
    } else {
      console.log('   ⚠️ 部分字段未如预期，请检查 MCP 各步是否均成功');
    }
  }
  console.log('');
  console.log('=== 自测结束 ===');
}

main().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
