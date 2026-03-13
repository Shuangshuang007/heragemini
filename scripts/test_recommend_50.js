#!/usr/bin/env node
/**
 * Test recommend_jobs enhanced_recommendation: expect up to 50 jobs, or all if fewer.
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
  console.log('Testing recommend_jobs (enhanced_recommendation, up to 50)...\n');
  console.log('Base URL:', BASE);

  const r = await mcpCall('tools/call', {
    name: 'recommend_jobs',
    arguments: {
      job_title: 'Software Engineer',
      city: 'New York City',
      user_profile: {
        city: 'New York City',
        jobTitles: ['Software Engineer'],
        skills: ['JavaScript', 'React'],
      },
      session_id: 'test-50-' + Date.now(),
    },
  });

  const result = r.result || {};
  const total = result.total ?? 0;
  const stage = result.profile_stage;
  const ids = result.meta?.returned_job_ids || [];

  console.log('profile_stage:', stage);
  console.log('total returned:', total);
  console.log('returned_job_ids length:', ids.length);
  console.log(total <= 50 ? 'OK (up to 50, or all if fewer)' : 'WARN (expected at most 50)');
  if (total > 0) console.log('First 3 job ids:', ids.slice(0, 3));
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
