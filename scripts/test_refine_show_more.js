#!/usr/bin/env node
/**
 * Test: first round "software engineer in New York", second round "show me more jobs with aws".
 * Refine must return > 0 (not 0). Confirms we did not break refine recommendation logic.
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
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data;
}

async function main() {
  console.log('Base URL:', BASE);
  console.log('');

  const sessionId = 'test-refine-show-more-' + Date.now();

  // Round 1: Software Engineer in New York
  console.log('=== Round 1: recommend_jobs "software engineer" in "New York" ===');
  let firstIds = [];
  try {
    const r = await mcpCall('tools/call', {
      name: 'recommend_jobs',
      arguments: {
        job_title: 'Software Engineer',
        city: 'New York',
        user_profile: { city: 'New York', jobTitles: ['Software Engineer'], skills: ['JavaScript'] },
        session_id: sessionId,
        page_size: 20,
      },
    });
    const res = r.result || {};
    firstIds = res.meta?.returned_job_ids || [];
    const total1 = res.total ?? 0;
    console.log('  total:', total1, 'returned_job_ids:', firstIds.length);
    if (firstIds.length > 0) console.log('  first 3 ids:', firstIds.slice(0, 3));
  } catch (e) {
    console.error('  error:', e.message);
    process.exit(1);
  }
  console.log('');

  // Round 2: Show me more jobs with AWS (refine with exclude_ids from round 1 + skills AWS)
  console.log('=== Round 2: refine_recommendations "show me more jobs with aws" ===');
  console.log('  (exclude_ids from round 1, skills: ["AWS"], limit: 15)');
  try {
    const r = await mcpCall('tools/call', {
      name: 'refine_recommendations',
      arguments: {
        session_id: sessionId,
        exclude_ids: firstIds,
        job_title: 'Software Engineer',
        city: 'New York',
        skills: ['AWS'],
        user_profile: { city: 'New York', jobTitles: ['Software Engineer'], skills: ['JavaScript', 'AWS'] },
        limit: 15,
      },
    });
    const res = r.result || {};
    const total2 = res.total ?? 0;
    const cards = res.job_cards || [];
    const ids2 = res.meta?.returned_job_ids || [];
    console.log('  refine total:', total2, 'job_cards:', cards.length, 'returned_job_ids:', ids2.length);
    if (total2 === 0) {
      console.log('  FAIL: refine returned 0. "Show me more jobs" must not return 0.');
      process.exit(1);
    }
    console.log('  PASS: refine returned', total2, 'jobs (> 0)');
    if (ids2.length > 0) console.log('  first 3 ids:', ids2.slice(0, 3));
  } catch (e) {
    console.error('  error:', e.message);
    process.exit(1);
  }

  console.log('\nDone. Refine logic OK (show me more returned > 0).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
