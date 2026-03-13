#!/usr/bin/env node

/**
 * Verify Gateway 401 fix with 3 acceptance tests
 * 
 * Test 1: Gateway call without Authorization header (simulating ChatGPT)
 * Test 2: Direct MCP call with token (should still work)
 * Test 3: Direct MCP call without token (should return 401)
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

const MCP_TOKEN = process.env.MCP_SHARED_SECRET;
// Test production environment
const GATEWAY_URL = 'https://www.heraai.net.au';
const MCP_URL = `${GATEWAY_URL}/api/mcp`;
const GATEWAY_ENDPOINT = `${GATEWAY_URL}/api/gateway/mcp`;

if (!MCP_TOKEN) {
  console.error('❌ MCP_SHARED_SECRET not found in .env.local');
  process.exit(1);
}

console.log('=== Gateway 401 Fix Verification ===\n');
console.log(`Gateway URL: ${GATEWAY_URL}`);
console.log(`MCP Token: ${MCP_TOKEN.substring(0, 4)}...${MCP_TOKEN.substring(MCP_TOKEN.length - 4)} (len: ${MCP_TOKEN.length})\n`);

// Helper function to make HTTPS request
function makeRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: options.headers || {}
    };

    if (data) {
      reqOptions.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Test 1: Gateway call without Authorization header
async function test1() {
  console.log('📋 Test 1: Gateway call without Authorization header (simulating ChatGPT)');
  console.log(`   Endpoint: ${GATEWAY_ENDPOINT}`);
  console.log('   Expected: 200 OK, MCP should accept Gateway\'s own token\n');

  const requestData = JSON.stringify({
    tool: 'recommend_jobs',
    arguments: {
      user_profile: {
        jobTitles: ['Software Engineer'],
        skills: ['JavaScript', 'TypeScript'],
        city: 'Sydney'
      },
      limit: 5
    }
  });

  try {
    const response = await makeRequest(GATEWAY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // No Authorization header - Gateway should use its own token
      }
    }, requestData);

    if (response.statusCode === 200) {
      console.log('   ✅ PASS: Gateway call succeeded without upstream Authorization');
      try {
        const parsed = JSON.parse(response.body);
        if (parsed.success) {
          console.log('   ✅ Gateway returned success response');
        } else {
          console.log('   ⚠️  Gateway returned but success=false:', parsed.error);
        }
      } catch (e) {
        console.log('   ⚠️  Response not JSON:', response.body.substring(0, 200));
      }
    } else {
      console.log(`   ❌ FAIL: Gateway returned ${response.statusCode}`);
      console.log('   Response:', response.body.substring(0, 500));
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
  }
  console.log('');
}

// Test 2: Direct MCP call with token
async function test2() {
  console.log('📋 Test 2: Direct MCP call with token');
  console.log(`   Endpoint: ${MCP_URL}`);
  console.log('   Expected: 200 OK\n');

  const requestData = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  });

  try {
    const response = await makeRequest(MCP_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }, requestData);

    if (response.statusCode === 200) {
      console.log('   ✅ PASS: Direct MCP call with token succeeded');
      try {
        const parsed = JSON.parse(response.body);
        if (parsed.result && parsed.result.tools) {
          console.log(`   ✅ MCP returned ${parsed.result.tools.length} tools`);
        }
      } catch (e) {
        console.log('   ⚠️  Response not JSON:', response.body.substring(0, 200));
      }
    } else {
      console.log(`   ❌ FAIL: MCP returned ${response.statusCode}`);
      console.log('   Response:', response.body.substring(0, 500));
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
  }
  console.log('');
}

// Test 3: Direct MCP call without token
async function test3() {
  console.log('📋 Test 3: Direct MCP call without token');
  console.log(`   Endpoint: ${MCP_URL}`);
  console.log('   Expected: 401 Unauthorized (auth still works)\n');

  const requestData = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  });

  try {
    const response = await makeRequest(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // No Authorization header
      }
    }, requestData);

    if (response.statusCode === 401) {
      console.log('   ✅ PASS: MCP correctly rejected request without token (401)');
      try {
        const parsed = JSON.parse(response.body);
        if (parsed.error && parsed.error.includes('Unauthorized')) {
          console.log('   ✅ Error message indicates authentication required');
        }
      } catch (e) {
        // Not JSON, that's OK for 401
      }
    } else {
      console.log(`   ❌ FAIL: MCP returned ${response.statusCode} instead of 401`);
      console.log('   ⚠️  Authentication may not be working correctly');
      console.log('   Response:', response.body.substring(0, 500));
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
  }
  console.log('');
}

// Run all tests
(async () => {
  await test1();
  await test2();
  await test3();
  
  console.log('=== Verification Complete ===');
  console.log('\n📝 Next Steps:');
  console.log('1. If all tests pass, deploy Gateway fix to production');
  console.log('2. Ensure MCP_SHARED_SECRET is set in Vercel for www.heraai.net.au');
  console.log('3. Redeploy after setting environment variables');
})();

