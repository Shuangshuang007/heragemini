#!/usr/bin/env node
/**
 * 验证两点：
 * 1. MCP 第一轮（search / recommend / refine）返回的 job_cards[].card 与主站 Job List 维度一致
 * 2. get_job_detail(job_id) 能快速返回对应职位的完整详情，且 id/内容正确
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

// 主站 Job List（JobSummaryCard）用到的维度，与 jobPayloads.JobListPayload 对齐
const MAIN_SITE_LIST_DIMENSIONS = [
  'id',
  'title',
  'company',
  'location',
  'platform',
  'jobUrl',
  'postedDate',
  'salary',
  'employmentType',
  'workMode',
  'experienceTag',
  'skillsMustHave',
  'keyRequirements',
  'matchScore',
  'subScores',
  'highlights',
  'summary',
];

async function mcpCall(method, params = {}) {
  const res = await fetch(`${BASE}/api/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data;
}

// 1) 检查 MCP 返回的 list 是否与主站维度一致（不少字段）
function checkListDimensionsSameAsMainSite(card, toolName) {
  const cardKeys = Object.keys(card || {});
  const missing = MAIN_SITE_LIST_DIMENSIONS.filter((f) => !cardKeys.includes(f));
  const extra = cardKeys.filter((k) => !MAIN_SITE_LIST_DIMENSIONS.includes(k));
  const ok = missing.length === 0;
  console.log(`  [${toolName}] 与主站 list 维度一致: ${ok ? '是' : '否'}`);
  if (missing.length) console.log(`    缺少主站维度: ${missing.join(', ')}`);
  if (extra.length) console.log(`    多出字段(可忽略): ${extra.join(', ')}`);
  return ok;
}

// 2) 检查 get_job_detail 是否快速返回且 id/内容正确
function checkDetailMatchAndFast(detail, expectedJobId, elapsedMs) {
  const idOk = detail && detail.id === expectedJobId;
  const hasDetailFields =
    detail &&
    (detail.summary != null || detail.skillsMustHave?.length || detail.keyRequirements?.length || detail.highlights?.length);
  const fast = elapsedMs < 5000; // 5s 内认为快速
  console.log(`  get_job_detail 返回的 job 与请求 id 一致: ${idOk ? '是' : '否'} (expected ${expectedJobId}, got ${detail?.id})`);
  console.log(`  详情内容完整(有 summary/skills/requirements/highlights 等): ${hasDetailFields ? '是' : '否'}`);
  console.log(`  响应耗时: ${elapsedMs}ms ${fast ? '(快速)' : '(偏慢)'}`);
  return idOk && hasDetailFields;
}

async function main() {
  console.log('Base URL:', BASE);
  console.log('Token:', TOKEN ? '[set]' : '[not set]');
  console.log('');

  let firstJobId = null;

  // --- 1. search_jobs：检查返回 list 维度 = 主站 ---
  console.log('=== 1. search_jobs 返回 list 维度是否与主站一致 ===');
  try {
    const r = await mcpCall('tools/call', {
      name: 'search_jobs',
      arguments: { job_title: 'Software Engineer', city: 'Sydney', mode: 'fast', limit: 5 },
    });
    const res = r.result || {};
    const cards = res.job_cards || [];
    const ids = res.meta?.returned_job_ids || [];
    console.log('  返回条数:', cards.length, 'returned_job_ids:', ids.length);
    if (cards.length > 0) {
      const card = cards[0].card || cards[0];
      firstJobId = card.id || ids[0];
      checkListDimensionsSameAsMainSite(card, 'search_jobs');
    } else {
      console.log('  (无结果，跳过维度检查)');
    }
  } catch (e) {
    console.error('  error:', e.message);
  }
  console.log('');

  // --- 2. recommend_jobs：检查返回 list 维度 = 主站 ---
  console.log('=== 2. recommend_jobs 返回 list 维度是否与主站一致 ===');
  const sessionId = 'test-list-detail-' + Date.now();
  try {
    const r = await mcpCall('tools/call', {
      name: 'recommend_jobs',
      arguments: {
        job_title: 'Software Engineer',
        city: 'Sydney',
        user_profile: { city: 'Sydney', jobTitles: ['Software Engineer'], skills: ['JavaScript'] },
        session_id: sessionId,
      },
    });
    const res = r.result || {};
    const cards = res.job_cards || [];
    const ids = res.meta?.returned_job_ids || [];
    console.log('  返回条数:', cards.length);
    if (cards.length > 0) {
      if (!firstJobId) firstJobId = ids[0] || (cards[0].card && cards[0].card.id);
      const card = cards[0].card || cards[0];
      checkListDimensionsSameAsMainSite(card, 'recommend_jobs');
    } else {
      console.log('  (无结果，跳过维度检查)');
    }
  } catch (e) {
    console.error('  error:', e.message);
  }
  console.log('');

  // --- 3. refine_recommendations：检查返回 list 维度 = 主站 ---
  console.log('=== 3. refine_recommendations 返回 list 维度是否与主站一致 ===');
  try {
    const r = await mcpCall('tools/call', {
      name: 'refine_recommendations',
      arguments: { session_id: sessionId, exclude_ids: [], limit: 5 },
    });
    const res = r.result || {};
    const cards = res.job_cards || [];
    console.log('  返回条数:', cards.length);
    if (cards.length > 0) {
      if (!firstJobId) firstJobId = (cards[0].card && cards[0].card.id) || res.meta?.returned_job_ids?.[0];
      const card = cards[0].card || cards[0];
      checkListDimensionsSameAsMainSite(card, 'refine_recommendations');
    } else {
      console.log('  (无结果，跳过维度检查)');
    }
  } catch (e) {
    console.error('  error:', e.message);
  }
  console.log('');

  // --- 4. show more：get_job_detail 是否快速返回对应职位详情 ---
  console.log('=== 4. show more 流程：get_job_detail 是否快速返回对应职位详情 ===');
  if (!firstJobId) {
    console.log('  跳过：前面步骤没有拿到 job_id');
    return;
  }
  console.log('  请求 job_id:', firstJobId);
  try {
    const t0 = Date.now();
    const r = await mcpCall('tools/call', {
      name: 'get_job_detail',
      arguments: { job_id: firstJobId },
    });
    const elapsedMs = Date.now() - t0;
    const res = r.result || {};
    const detail = res.job_detail;
    checkDetailMatchAndFast(detail, firstJobId, elapsedMs);
  } catch (e) {
    console.error('  error:', e.message);
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
