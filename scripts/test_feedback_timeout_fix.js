#!/usr/bin/env node

/**
 * Test Feedback timeout fix with 3 test groups
 * 
 * Test 1: Normal case - call tailor_resume 5 times
 * Test 2: Feedback unavailable - simulate feedback write failure
 * Test 3: Concurrent load - parallel calls to observe throughput
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

// Allow override via command line: node scripts/test_feedback_timeout_fix.js --url=https://www.heraai.net.au
const args = process.argv.slice(2);
const urlArg = args.find(arg => arg.startsWith('--url='));
const BASE_URL = urlArg 
  ? urlArg.split('=')[1] 
  : (process.env.NEXT_PUBLIC_BASE_URL || 'https://www.heraai.net.au');

const MCP_TOKEN = process.env.MCP_SHARED_SECRET;
const MCP_URL = `${BASE_URL}/api/mcp`;

if (!MCP_TOKEN) {
  console.error('❌ MCP_SHARED_SECRET not found in .env.local');
  console.error('   Please set MCP_SHARED_SECRET in .env.local or environment');
  process.exit(1);
}

console.log('=== Feedback Timeout Fix Verification ===\n');
console.log(`Base URL: ${BASE_URL}`);
console.log(`MCP Token: ${MCP_TOKEN.substring(0, 4)}...${MCP_TOKEN.substring(MCP_TOKEN.length - 4)} (len: ${MCP_TOKEN.length})`);
console.log(`MCP Endpoint: ${MCP_URL}\n`);
console.log('💡 Usage: node scripts/test_feedback_timeout_fix.js [--url=https://www.heraai.net.au]\n');

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

    const startTime = Date.now();
    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body,
          elapsed: Date.now() - startTime
        });
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Test 1: Normal case - call tailor_resume 5 times
async function test1() {
  console.log('📋 Test 1: Normal case - call tailor_resume 5 times');
  console.log('   Expected: All 200 OK, no [error] secureConnect timed out, at most warn\n');

  const results = [];
  const errors = [];

  for (let i = 1; i <= 5; i++) {
    const requestData = JSON.stringify({
      jsonrpc: '2.0',
      id: i,
      method: 'tools/call',
      params: {
        name: 'tailor_resume',
        arguments: {
          user_profile: {
            jobTitles: ['Software Engineer'],
            skills: ['JavaScript', 'TypeScript', 'React'],
            employmentHistory: [{
              company: 'Tech Corp',
              position: 'Senior Developer',
              startDate: '2020-01',
              endDate: '2023-12',
              description: 'Led development team'
            }]
          },
          resume_content: JSON.stringify({
            profile: { name: 'Test User', email: 'test@example.com' },
            summary: 'Experienced software engineer',
            experience: [{
              title: 'Senior Developer',
              company: 'Tech Corp',
              startDate: '2020-01',
              endDate: '2023-12',
              description: 'Led development team'
            }],
            skills: ['JavaScript', 'TypeScript', 'React']
          }),
          job_title: 'Senior Software Engineer',
          company: 'Tech Company'
        }
      }
    });

    try {
      const response = await makeRequest(MCP_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MCP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }, requestData);

      results.push({
        attempt: i,
        status: response.statusCode,
        elapsed: response.elapsed,
        success: response.statusCode === 200
      });

      if (response.statusCode === 200) {
        console.log(`   ✅ Attempt ${i}: ${response.statusCode} OK (${response.elapsed}ms)`);
      } else {
        console.log(`   ❌ Attempt ${i}: ${response.statusCode} (${response.elapsed}ms)`);
        try {
          const parsed = JSON.parse(response.body);
          if (parsed.error) {
            errors.push(`Attempt ${i}: ${parsed.error}`);
          }
        } catch (e) {
          errors.push(`Attempt ${i}: ${response.body.substring(0, 100)}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Attempt ${i}: ERROR - ${error.message}`);
      errors.push(`Attempt ${i}: ${error.message}`);
    }
  }

  const successCount = results.filter(r => r.success).length;
  const avgElapsed = results.reduce((sum, r) => sum + r.elapsed, 0) / results.length;

  console.log(`\n   Summary: ${successCount}/5 successful, avg ${Math.round(avgElapsed)}ms`);
  if (errors.length > 0) {
    console.log(`   Errors: ${errors.length}`);
    errors.forEach(e => console.log(`     - ${e}`));
  }

  if (successCount === 5) {
    console.log('   ✅ PASS: All 5 calls succeeded');
  } else {
    console.log(`   ❌ FAIL: Only ${successCount}/5 succeeded`);
  }
  console.log('');
}

// Test 2: Feedback unavailable simulation
async function test2() {
  console.log('📋 Test 2: Feedback unavailable simulation');
  console.log('   Expected: tailor_resume still returns 200 OK, response time < 2s\n');
  console.log('   Note: This test calls tailor_resume normally.');
  console.log('   To truly simulate feedback failure, you would need to:');
  console.log('   - Set MONGODB_URI to invalid address, OR');
  console.log('   - Set ENABLE_FEEDBACK=false in environment\n');

  const requestData = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'tailor_resume',
      arguments: {
        user_profile: {
          jobTitles: ['Software Engineer'],
          skills: ['JavaScript', 'TypeScript'],
          employmentHistory: [{
            company: 'Tech Corp',
            position: 'Developer',
            startDate: '2020-01',
            endDate: '2023-12',
            description: 'Developed web applications'
          }]
        },
        resume_content: JSON.stringify({
          profile: { name: 'Test User' },
          summary: 'Software engineer',
          experience: [{
            title: 'Developer',
            company: 'Tech Corp',
            startDate: '2020-01',
            endDate: '2023-12'
          }],
          skills: ['JavaScript', 'TypeScript']
        }),
        job_title: 'Software Engineer',
        company: 'Tech Company'
      }
    }
  });

  const startTime = Date.now();
  try {
    const response = await makeRequest(MCP_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }, requestData);

    const totalElapsed = Date.now() - startTime;

    if (response.statusCode === 200) {
      console.log(`   ✅ PASS: tailor_resume returned 200 OK`);
      console.log(`   Response time: ${totalElapsed}ms`);
      
      if (totalElapsed < 2000) {
        console.log(`   ✅ Response time < 2s (target met)`);
      } else {
        console.log(`   ⚠️  Response time >= 2s (${totalElapsed}ms)`);
      }

      try {
        const parsed = JSON.parse(response.body);
        if (parsed.result && parsed.result.content) {
          console.log(`   ✅ Response contains content`);
        }
      } catch (e) {
        console.log(`   ⚠️  Response parsing failed`);
      }
    } else {
      console.log(`   ❌ FAIL: tailor_resume returned ${response.statusCode}`);
      console.log(`   Response: ${response.body.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
  }
  console.log('');
}

// Test 3: Concurrent load test
async function test3() {
  console.log('📋 Test 3: Concurrent load test - parallel calls');
  console.log('   Expected: No throughput degradation from Mongo operations\n');

  const requestData = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'search_jobs',
      arguments: {
        job_title: 'Software Engineer',
        city: 'Sydney',
        page_size: 5
      }
    }
  });

  const concurrency = 10;
  console.log(`   Launching ${concurrency} parallel requests...\n`);

  const promises = Array.from({ length: concurrency }, (_, i) => {
    return makeRequest(MCP_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }, requestData).then(response => ({
      index: i + 1,
      status: response.statusCode,
      elapsed: response.elapsed,
      success: response.statusCode === 200
    })).catch(error => ({
      index: i + 1,
      status: 0,
      elapsed: 0,
      success: false,
      error: error.message
    }));
  });

  const startTime = Date.now();
  const results = await Promise.all(promises);
  const totalElapsed = Date.now() - startTime;

  const successCount = results.filter(r => r.success).length;
  const avgElapsed = results.reduce((sum, r) => sum + r.elapsed, 0) / results.length;
  const maxElapsed = Math.max(...results.map(r => r.elapsed));
  const minElapsed = Math.min(...results.map(r => r.elapsed || Infinity));

  console.log(`   Results:`);
  console.log(`   - Success: ${successCount}/${concurrency}`);
  console.log(`   - Total time: ${totalElapsed}ms`);
  console.log(`   - Avg response time: ${Math.round(avgElapsed)}ms`);
  console.log(`   - Min response time: ${minElapsed}ms`);
  console.log(`   - Max response time: ${maxElapsed}ms`);

  if (successCount === concurrency) {
    console.log(`   ✅ PASS: All ${concurrency} concurrent calls succeeded`);
  } else {
    console.log(`   ❌ FAIL: Only ${successCount}/${concurrency} succeeded`);
  }

  // Check for throughput degradation
  if (maxElapsed < 5000) {
    console.log(`   ✅ No significant throughput degradation (max ${maxElapsed}ms)`);
  } else {
    console.log(`   ⚠️  Possible throughput degradation (max ${maxElapsed}ms)`);
  }
  console.log('');
}

// Run all tests
(async () => {
  await test1();
  await test2();
  await test3();
  
  console.log('=== All Tests Complete ===');
  console.log('\n📝 Notes:');
  console.log('- Test 2 requires manual feedback failure simulation (set invalid MONGODB_URI or ENABLE_FEEDBACK=false)');
  console.log('- Check logs for [error] vs [warn] messages');
  console.log('- Verify no [error] secureConnect timed out appears');
})();

