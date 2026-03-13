#!/usr/bin/env node

/**
 * Quick test for a single tool - to debug timeout issues
 */

const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:3002';
const MCP_TOKEN = process.env.MCP_SHARED_SECRET || '';
const TOOL = process.argv[2] || 'search_jobs';

if (!MCP_TOKEN) {
  console.error('❌ MCP_SHARED_SECRET not set');
  process.exit(1);
}

async function testTool() {
  console.log(`Testing ${TOOL} on ${BASE_URL}...\n`);

  let params = {};
  if (TOOL === 'search_jobs') {
    params = { name: 'search_jobs', arguments: { job_title: 'Software Engineer', city: 'Sydney', page_size: 5 } };
  } else if (TOOL === 'career_transition_advice') {
    params = { name: 'career_transition_advice', arguments: { current_job: 'Software Engineer', experience_years: 3, skills: ['JavaScript', 'React'] } };
  } else if (TOOL === 'recommend_jobs') {
    params = { name: 'recommend_jobs', arguments: { user_profile: { jobTitles: ['Software Engineer'], skills: ['JavaScript', 'React'], city: 'Sydney' }, limit: 5 } };
  } else if (TOOL === 'tailor_resume') {
    params = { name: 'tailor_resume', arguments: { user_profile: { jobTitles: ['Software Engineer'] }, resume_content: 'Test resume' } };
  }

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.log('⏱️  Timeout after 20s');
    }, 20000);

    const response = await fetch(`${BASE_URL}/api/mcp-lite`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;
    const text = await response.text();
    
    console.log(`Status: ${response.status}`);
    console.log(`Elapsed: ${elapsed}ms`);
    console.log(`Response length: ${text.length}`);
    console.log(`\nResponse (first 500 chars):\n${text.substring(0, 500)}`);
    
    try {
      const data = JSON.parse(text);
      console.log(`\nParsed JSON keys: ${Object.keys(data).join(', ')}`);
    } catch (e) {
      console.log(`\n⚠️  Not valid JSON`);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  }
}

testTool();







