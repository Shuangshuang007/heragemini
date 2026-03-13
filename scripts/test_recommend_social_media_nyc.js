#!/usr/bin/env node
/**
 * Test recommend_jobs: social media manager + New York City only (no industry/work_mode).
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
  console.log('recommend_jobs: job_title="social media manager", city="New York City" (no industry/work_mode)\n');
  console.log('Base URL:', BASE);

  const t0 = Date.now();
  const r = await mcpCall('tools/call', {
    name: 'recommend_jobs',
    arguments: {
      job_title: 'social media manager',
      city: 'New York City',
      user_profile: {
        city: 'New York City',
        jobTitles: ['Social Media Manager'],
        skills: ['Social Media', 'Content', 'Marketing'],
      },
      session_id: 'test-sm-nyc-' + Date.now(),
    },
  });
  const elapsed = Date.now() - t0;

  const result = r.result || {};
  const total = result.total ?? 0;
  const stage = result.profile_stage;
  const ids = result.meta?.returned_job_ids || [];
  const dbCandidates = result.meta?.db_candidates_count;

  console.log('profile_stage:', stage);
  console.log('DB candidates (before scoring):', dbCandidates ?? '(not set)');
  console.log('total returned:', total);
  console.log('returned_job_ids length:', ids.length);
  console.log('Response time:', elapsed + 'ms');
  if (total > 0) console.log('First 5 job ids:', ids.slice(0, 5));
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
