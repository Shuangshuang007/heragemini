#!/usr/bin/env node
/**
 * Test recommend_jobs and search_jobs with: software engineer, new york, aws, fulltime, onsite.
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

if (!TOKEN) {
  console.error('Set MCP_SHARED_SECRET (and optionally MCP_TEST_BASE_URL).');
  process.exit(1);
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
  const data = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return data;
}

async function main() {
  console.log('Base URL:', BASE);
  console.log('');

  // --- recommend_jobs: software engineer, new york, aws, fulltime, onsite ---
  console.log('========== 1. recommend_jobs (software engineer, New York, AWS, full time, onsite) ==========');
  const t1 = Date.now();
  const rec = await mcpCall('tools/call', {
    name: 'recommend_jobs',
    arguments: {
      job_title: 'Software Engineer',
      city: 'New York',
      skills: ['AWS'],
      workMode: 'onsite',
      employmentType: 'full time',
      user_profile: {
        city: 'New York',
        jobTitles: ['Software Engineer'],
        skills: ['AWS', 'JavaScript'],
      },
      session_id: 'test-nyc-' + Date.now(),
    },
  });
  const recMs = Date.now() - t1;
  const recResult = rec.result || {};
  const recTotal = recResult.total ?? 0;
  const recIds = recResult.meta?.returned_job_ids || [];
  console.log('profile_stage:', recResult.profile_stage);
  console.log('total returned:', recTotal);
  console.log('returned_job_ids length:', recIds.length);
  console.log('elapsed:', recMs + 'ms');
  if (recTotal > 0) console.log('First 3 ids:', recIds.slice(0, 3));
  console.log('');

  // --- search_jobs FAST: same query ---
  console.log('========== 2. search_jobs FAST (software engineer, New York) ==========');
  const t2 = Date.now();
  const searchFast = await mcpCall('tools/call', {
    name: 'search_jobs',
    arguments: {
      job_title: 'Software Engineer',
      city: 'New York',
      mode: 'fast',
    },
  });
  const searchFastMs = Date.now() - t2;
  const fastTotal = searchFast.result?.total ?? 0;
  const fastContent = searchFast.result?.content?.[0];
  const fastText = fastContent?.text ?? '';
  console.log('total:', fastTotal);
  console.log('elapsed:', searchFastMs + 'ms');
  console.log('response type:', fastContent?.type ?? '?');
  if (fastText.length > 0) console.log('preview (first 400 chars):', fastText.substring(0, 400) + (fastText.length > 400 ? '...' : ''));
  console.log('');

  // --- search_jobs FULL: same query ---
  console.log('========== 3. search_jobs FULL (software engineer, New York) ==========');
  const t3 = Date.now();
  const searchFull = await mcpCall('tools/call', {
    name: 'search_jobs',
    arguments: {
      job_title: 'Software Engineer',
      city: 'New York',
      mode: 'full',
      limit: 10,
    },
  });
  const searchFullMs = Date.now() - t3;
  const fullResult = searchFull.result || {};
  const fullContent = fullResult.content?.[0];
  const fullData = fullContent?.data?.content;
  const fullJobs = fullData?.jobs ?? [];
  const fullTotal = fullData?.total ?? 0;
  console.log('total:', fullTotal);
  console.log('jobs length:', fullJobs.length);
  console.log('elapsed:', searchFullMs + 'ms');
  if (fullJobs.length > 0) console.log('First job:', fullJobs[0].title, '@', fullJobs[0].company);
  console.log('');
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
