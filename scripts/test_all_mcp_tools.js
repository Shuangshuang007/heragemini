#!/usr/bin/env node
/**
 * 逐一测试 MCP 各 tool 是否可调用、返回结构正常（不报 JSON-RPC error）。
 * 使用最小合法参数，不保证业务结果有数据。
 */

const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const BASE = process.env.MCP_TEST_BASE_URL || 'http://localhost:3002';
const TOKEN = process.env.MCP_SHARED_SECRET;
if (!TOKEN) {
  console.error('Set MCP_SHARED_SECRET in .env.local');
  process.exit(1);
}

async function mcpCall(name, args) {
  const res = await fetch(`${BASE}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

function ok(result) {
  if (!result.ok) return false;
  if (result.data.error) return false;
  const r = result.data.result?.result ?? result.data.result;
  if (r?.isError === true) return false;
  const text = (r?.content?.[0]?.text ?? '');
  if (text.startsWith('Failed to run ') || text.startsWith('Failed to tailor') || text.startsWith('Failed to get ')) return false;
  return true;
}

// 快工具在前，recommend_jobs / refine_recommendations 较慢（约 30–60s）
const tests = [
  {
    name: 'build_search_links',
    args: { job_title: 'Software Engineer', city: 'Sydney' },
  },
  {
    name: 'get_user_applications',
    args: { user_email: 'test-mcp-tools@example.com' },
  },
  {
    name: 'career_path_explorer',
    args: { from_job: 'Software Engineer' },
  },
  {
    name: 'career_skill_gap_analysis',
    args: { from_job: 'Software Engineer', to_job: 'Product Manager' },
  },
  {
    name: 'career_transition_advice',
    args: { current_job: 'Software Engineer', experience_years: 5 },
  },
  {
    name: 'job_alert',
    args: { session_id: 'test-alert-' + Date.now(), limit: 5, exclude_ids: [] },
  },
  {
    name: 'prepare_application_context',
    args: { user_email: 'test-mcp@example.com' },
  },
  {
    name: 'create_application_intent',
    args: { user_email: 'test-mcp@example.com', job_id: '00000000000000000000000000000000' },
  },
  {
    name: 'search_jobs_by_company',
    args: { company: 'Atlassian', city: 'Sydney', page_size: 10 },
  },
  {
    name: 'search_jobs',
    args: { job_title: 'Software Engineer', city: 'Melbourne', page_size: 10, session_id: 'test-search-' + Date.now() },
  },
  {
    name: 'tailor_resume',
    args: {
      user_profile: { name: 'Test', skills: ['JavaScript'] },
      resume_content: JSON.stringify({ profile: { name: 'Test' }, summary: 'Engineer', experience: [], skills: ['JS'] }),
      job_description: 'Software Engineer. JavaScript, React.',
      job_title: 'Software Engineer',
      company: 'Test Co',
      customization_level: 'moderate',
    },
  },
  {
    name: 'recommend_jobs',
    args: {
      user_profile: { city: 'Sydney', jobTitles: ['Software Engineer'], skills: ['JavaScript'] },
      job_title: 'Software Engineer',
      city: 'Sydney',
      session_id: 'test-all-tools-' + Date.now(),
    },
  },
  {
    name: 'refine_recommendations',
    args: { session_id: 'test-refine-' + Date.now(), exclude_ids: [] },
  },
];

async function main() {
  console.log('Base URL:', BASE);
  console.log('Testing', tests.length, 'MCP tools...\n');

  const results = [];
  for (const t of tests) {
    process.stdout.write(`  ${t.name} ... `);
    try {
      const result = await mcpCall(t.name, t.args);
      const pass = ok(result);
      results.push({ name: t.name, pass, status: result.status, error: result.data.error });
      console.log(pass ? 'OK' : 'FAIL');
      if (!pass && result.data.error) {
        console.log('      error:', JSON.stringify(result.data.error).slice(0, 120));
      }
      if (!pass && result.data.result?.content?.[0]?.text) {
        const preview = result.data.result.content[0].text.slice(0, 150);
        if (preview.includes('Failed') || preview.includes('Error')) {
          console.log('      text:', preview.replace(/\n/g, ' '));
        }
      }
    } catch (e) {
      results.push({ name: t.name, pass: false, error: e.message });
      console.log('FAIL (exception:', e.message + ')');
    }
  }

  const passed = results.filter((r) => r.pass).length;
  console.log('\n' + '─'.repeat(50));
  console.log(`Result: ${passed}/${results.length} tools OK`);
  if (passed < results.length) {
    console.log('Failed:', results.filter((r) => !r.pass).map((r) => r.name).join(', '));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
