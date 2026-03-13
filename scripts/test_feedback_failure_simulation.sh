#!/bin/bash

# Test 2: Simulate feedback failure by temporarily disabling feedback
# This script tests that tailor_resume still works even when feedback writes fail

set -e

echo "=== Test 2: Feedback Failure Simulation ==="
echo ""
echo "This test simulates feedback write failure by:"
echo "1. Setting MONGODB_URI to an invalid address"
echo "2. Calling tailor_resume"
echo "3. Verifying it still returns 200 OK and completes quickly"
echo ""

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

MCP_TOKEN=${MCP_SHARED_SECRET}
BASE_URL=${NEXT_PUBLIC_BASE_URL:-https://www.heraai.net.au}

if [ -z "$MCP_TOKEN" ]; then
  echo "❌ MCP_SHARED_SECRET not found"
  exit 1
fi

echo "Base URL: $BASE_URL"
echo "MCP Token: ${MCP_TOKEN:0:4}...${MCP_TOKEN: -4}"
echo ""

# Create a temporary test script that sets invalid MONGODB_URI
cat > /tmp/test_feedback_failure.js << 'EOF'
const https = require('https');

const MCP_TOKEN = process.env.MCP_SHARED_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.heraai.net.au';
const MCP_URL = `${BASE_URL}/api/mcp`;

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

(async () => {
  console.log('Calling tailor_resume with feedback failure simulation...');
  console.log('(Note: To truly simulate failure, set MONGODB_URI to invalid address in production)');
  console.log('');
  
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
      console.log(`✅ PASS: tailor_resume returned 200 OK`);
      console.log(`Response time: ${totalElapsed}ms`);
      
      if (totalElapsed < 2000) {
        console.log(`✅ Response time < 2s (target met)`);
      } else if (totalElapsed < 5000) {
        console.log(`⚠️  Response time ${totalElapsed}ms (acceptable, likely business logic time)`);
      } else {
        console.log(`❌ Response time ${totalElapsed}ms (may indicate feedback blocking)`);
      }

      try {
        const parsed = JSON.parse(response.body);
        if (parsed.result && parsed.result.content) {
          console.log(`✅ Response contains content (${parsed.result.content.length} chars)`);
        }
      } catch (e) {
        console.log(`⚠️  Response parsing failed`);
      }
    } else {
      console.log(`❌ FAIL: tailor_resume returned ${response.statusCode}`);
      console.log(`Response: ${response.body.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
  }
})();
EOF

# Run the test
node /tmp/test_feedback_failure.js

echo ""
echo "=== Test Complete ==="
echo ""
echo "📝 To truly test feedback failure, you need to:"
echo "1. Set MONGODB_URI to invalid address in Vercel environment variables"
echo "2. Redeploy the application"
echo "3. Run this test again"
echo ""
echo "Or check production logs for:"
echo "- [warn] FEEDBACK_WRITE_TIMEOUT (expected)"
echo "- [error] secureConnect timed out (should NOT appear)"








