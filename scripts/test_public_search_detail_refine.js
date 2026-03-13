#!/usr/bin/env node
/**
 * 公网/本地 MCP 联调：验证
 * 1. search_jobs (software engineer, New York, aws, fulltime) 是否返回 match_analysis
 * 2. get_job_detail(某个职位) 是否返回完整 job details
 * 3. refine_recommendations "show more" 是否正常，且带 match_analysis
 *
 * 用法：
 *   node scripts/test_public_search_detail_refine.js
 * 公网：在 .env.local 设置 MCP_TEST_BASE_URL=https://your-production-url (及 MCP_SHARED_SECRET)
 *
 * 说明：refine 会对每条结果调 JobMatch，可能需 30–60s，请耐心等待。
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

// 默认公网（Vercel），本地请设 MCP_TEST_BASE_URL=http://localhost:3002
const BASE = process.env.MCP_TEST_BASE_URL || 'https://www.heraai.net.au';
const TOKEN = process.env.MCP_SHARED_SECRET;
const SEARCH_LIMIT = Number(process.env.MCP_TEST_SEARCH_LIMIT) || 50;

function inspectKeys(obj, prefix = '') {
  if (obj == null || typeof obj !== 'object') return prefix + String(obj);
  const keys = Object.keys(obj);
  return keys.length ? prefix + keys.join(', ') : prefix + '(empty)';
}

function sampleValue(v, maxLen = 120) {
  if (v == null) return 'null';
  if (typeof v === 'string') return v.length <= maxLen ? v : v.slice(0, maxLen) + '...';
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (typeof v === 'object') return inspectKeys(v);
  return String(v);
}

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

async function main() {
  console.log('=== MCP 公网/本地：search → get_job_detail → refine (show more) ===\n');
  console.log('Base URL (公网):', BASE);
  console.log('Token:', TOKEN ? '[set]' : '[not set]');
  console.log('search limit:', SEARCH_LIMIT);
  console.log('');

  let searchIds = [];
  const sessionId = 'test-public-' + Date.now();

  // -------------------------------------------------------------------------
  // 1. search_jobs: software engineer, New York, aws, fulltime
  // -------------------------------------------------------------------------
  console.log('========== 1. search_jobs (software engineer, New York, aws, fulltime) ==========\n');
  try {
    const t0 = Date.now();
    const r = await mcpCall('tools/call', {
      name: 'search_jobs',
      arguments: {
        job_title: 'Software Engineer',
        city: 'New York',
        skills: ['AWS'],
        employmentType: 'Full-time',
        mode: 'fast',
        limit: SEARCH_LIMIT,
      },
    });
    const elapsed = Date.now() - t0;
    const res = r.result || {};
    searchIds = res.meta?.returned_job_ids || [];

    console.log('  result 顶层 keys:', inspectKeys(res));
    console.log('  total:', res.total);
    console.log('  mode:', res.mode);
    console.log('  query_used:', JSON.stringify(res.query_used));
    console.log('  meta.returned_job_ids 数量:', searchIds.length);
    console.log('  耗时:', elapsed + 'ms');
    console.log('');

    const cards = res.job_cards || [];
    console.log('  job_cards 数量:', cards.length);
    if (cards.length > 0) {
      const first = cards[0];
      console.log('  job_cards[0] 顶层 keys:', inspectKeys(first));
      if (first.card) {
        console.log('  job_cards[0].card keys:', inspectKeys(first.card));
        console.log('  job_cards[0].card.id:', first.card.id);
        console.log('  job_cards[0].card.title:', sampleValue(first.card.title));
        console.log('  job_cards[0].card.matchScore:', first.card.matchScore);
        console.log('  job_cards[0].card.subScores:', first.card.subScores != null ? JSON.stringify(first.card.subScores) : 'null');
      }
      const ma = first.match_analysis;
      if (ma != null && typeof ma === 'string') {
        console.log('  job_cards[0].match_analysis 存在: 是, 长度:', ma.length);
        console.log('  job_cards[0].match_analysis 内容预览:', sampleValue(ma, 300));
      } else {
        console.log('  job_cards[0].match_analysis 存在: 否, 值:', ma);
      }
    }
  } catch (e) {
    console.error('  error:', e.message);
  }
  console.log('');

  // -------------------------------------------------------------------------
  // 2. get_job_detail(第一个职位)
  // -------------------------------------------------------------------------
  const firstJobId = searchIds[0];
  if (!firstJobId) {
    console.log('========== 2. get_job_detail (跳过：无 job_id) ==========\n');
  } else {
    console.log('========== 2. get_job_detail (job_id: ' + firstJobId + ') ==========\n');
    try {
      const t0 = Date.now();
      const r = await mcpCall('tools/call', {
        name: 'get_job_detail',
        arguments: { job_id: firstJobId },
      });
      const elapsed = Date.now() - t0;
      const res = r.result || {};
      const detail = res.job_detail;

      console.log('  result 顶层 keys:', inspectKeys(res));
      console.log('  耗时:', elapsed + 'ms');
      if (detail) {
        console.log('  job_detail 存在: 是');
        console.log('  job_detail keys:', inspectKeys(detail));
        console.log('  job_detail.id:', detail.id);
        console.log('  job_detail.title:', sampleValue(detail.title));
        console.log('  job_detail.company:', sampleValue(detail.company));
        if (detail.summary != null) console.log('  job_detail.summary 长度:', String(detail.summary).length);
        if (detail.skillsMustHave?.length) console.log('  job_detail.skillsMustHave 条数:', detail.skillsMustHave.length);
        if (detail.keyRequirements?.length) console.log('  job_detail.keyRequirements 条数:', detail.keyRequirements.length);
        if (detail.matchAnalysis != null) {
          console.log('  job_detail.matchAnalysis 存在: 是, 长度:', String(detail.matchAnalysis).length);
          console.log('  job_detail.matchAnalysis 预览:', sampleValue(detail.matchAnalysis, 200));
        } else {
          console.log('  job_detail.matchAnalysis 存在: 否');
        }
      } else {
        console.log('  job_detail 存在: 否');
      }
    } catch (e) {
      console.error('  error:', e.message);
    }
    console.log('');
  }

  // -------------------------------------------------------------------------
  // 3. refine_recommendations "show more" (exclude 第一轮已返回的)
  // -------------------------------------------------------------------------
  console.log('========== 3. refine_recommendations (show more, exclude 第一轮) ==========\n');
  try {
    const t0 = Date.now();
    const r = await mcpCall('tools/call', {
      name: 'refine_recommendations',
      arguments: {
        session_id: sessionId,
        job_title: 'Software Engineer',
        city: 'New York',
        exclude_ids: searchIds,
        limit: 5,
      },
    });
    const elapsed = Date.now() - t0;
    const res = r.result || {};
    const cards = res.job_cards || [];

    console.log('  result 顶层 keys:', inspectKeys(res));
    console.log('  total:', res.total);
    console.log('  excluded_count:', res.excluded_count);
    console.log('  preferences_applied:', res.preferences_applied);
    console.log('  meta.returned_job_ids 数量:', (res.meta?.returned_job_ids || []).length);
    console.log('  耗时:', elapsed + 'ms');
    console.log('  job_cards 数量:', cards.length);

    if (cards.length > 0) {
      const first = cards[0];
      console.log('  job_cards[0] 顶层 keys:', inspectKeys(first));
      if (first.card) {
        console.log('  job_cards[0].card.id:', first.card.id);
        console.log('  job_cards[0].card.title:', sampleValue(first.card.title));
        console.log('  job_cards[0].card.matchScore:', first.card.matchScore);
      }
      const ma = first.match_analysis;
      if (ma != null && typeof ma === 'string') {
        console.log('  job_cards[0].match_analysis 存在: 是, 长度:', ma.length);
        console.log('  job_cards[0].match_analysis 内容预览:', sampleValue(ma, 300));
      } else {
        console.log('  job_cards[0].match_analysis 存在: 否, 值:', ma);
      }
    }
  } catch (e) {
    console.error('  error:', e.message);
  }

  console.log('\n=== Done ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
