#!/usr/bin/env node
/**
 * Test recommend_jobs with skills filter: AWS + Software Engineer + New York.
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
  console.log('Testing recommend_jobs: job_title=Software Engineer, city=New York City, skills=[AWS], workMode=onsite, employmentType=full time\n');
  console.log('Base URL:', BASE);

  const t0 = Date.now();
  const r = await mcpCall('tools/call', {
    name: 'recommend_jobs',
    arguments: {
      job_title: 'Software Engineer',
      city: 'New York City',
      skills: ['AWS'],
      workMode: 'onsite',
      employmentType: 'full time',
      user_profile: {
        city: 'New York City',
        jobTitles: ['Software Engineer'],
        skills: ['AWS', 'JavaScript'],
      },
      session_id: 'test-skills-aws-' + Date.now(),
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
  if (total > 0) console.log('First 3 job ids:', ids.slice(0, 3));
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
