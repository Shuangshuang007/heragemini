#!/usr/bin/env node

/**
 * Test MCP endpoint authentication
 * This script tests the MCP endpoint directly without exposing the token
 */

const https = require('https');

// Read token from environment variable
const token = process.env.MCP_SHARED_SECRET;

if (!token) {
  console.error('❌ MCP_SHARED_SECRET environment variable is not set');
  console.error('Please set it first: export MCP_SHARED_SECRET="your_token_here"');
  process.exit(1);
}

// Show token info (without exposing full value)
const tokenLen = token.length;
const tokenHead = token.substring(0, 4);
const tokenTail = token.substring(token.length - 4);

console.log('=== Step 1: Testing MCP Endpoint Authentication ===\n');
console.log('✅ MCP_SHARED_SECRET found:');
console.log(`   Length: ${tokenLen}`);
console.log(`   Head: ${tokenHead}`);
console.log(`   Tail: ${tokenTail}\n`);

// Test www.heraai.net.au
const testUrl = 'https://www.heraai.net.au/api/mcp';
console.log(`Testing: ${testUrl}\n`);

const requestData = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {}
});

const options = {
  hostname: 'www.heraai.net.au',
  port: 443,
  path: '/api/mcp',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestData)
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`HTTP Status Code: ${res.statusCode}\n`);

    if (res.statusCode === 200) {
      console.log('✅ SUCCESS: MCP endpoint authentication works!');
      console.log('Response preview:');
      try {
        const parsed = JSON.parse(data);
        console.log(JSON.stringify(parsed, null, 2).substring(0, 500) + '...');
      } catch (e) {
        console.log(data.substring(0, 500) + '...');
      }
    } else {
      console.log('❌ FAILED: MCP endpoint returned', res.statusCode);
      console.log('Response:');
      console.log(data);
      console.log('\nPossible causes:');
      console.log('1. MCP_SHARED_SECRET in www.heraai.net.au deployment doesn\'t match');
      console.log('2. Environment variable not set in Vercel deployment');
      console.log('3. Deployment needs to be redeployed after env var change');
    }

    console.log('\n=== Test Complete ===');
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
  process.exit(1);
});

req.write(requestData);
req.end();








