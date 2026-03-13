#!/usr/bin/env node

/**
 * Production Test Script for /api/mcp-lite
 * Tests all review steps using Vercel production URL
 * 
 * Usage:
 *   MCP_SHARED_SECRET=your_token node scripts/test_mcp_lite_production.js
 */

const BASE_URL = process.env.TEST_URL || 'https://www.heraai.net.au';
const MCP_ENDPOINT = `${BASE_URL}/api/mcp-lite`;
const MCP_TOKEN = process.env.MCP_SHARED_SECRET || process.env.MCP_TOKEN;

if (!MCP_TOKEN) {
  console.error('❌ Error: MCP_SHARED_SECRET or MCP_TOKEN environment variable is required');
  process.exit(1);
}

const LITE_TOOLS = [
  'career_transition_advice',
  'search_jobs',
  'recommend_jobs',
  'tailor_resume'
];

// Test timeout: 30 seconds per request
const TEST_TIMEOUT = 30000;

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

async function fetchWithTimeout(url, options, timeout = TEST_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

// ============================================
// Test 1: GET /api/mcp-lite - Tool List Discovery
// ============================================
async function testGetToolList() {
  logSection('Test 1: GET /api/mcp-lite - Tool List Discovery');
  
  try {
    log(`Testing: GET ${MCP_ENDPOINT}`, 'blue');
    
    const response = await fetchWithTimeout(MCP_ENDPOINT, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MCP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const status = response.status;
    const headers = Object.fromEntries(response.headers.entries());
    const bodyText = await response.text();
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      log(`\n⚠️  Response is not JSON. Status: ${status}`, 'yellow');
      log(`Response preview: ${bodyText.substring(0, 500)}`, 'yellow');
      return { pass: false, status, error: 'Invalid JSON response', bodyText: bodyText.substring(0, 500) };
    }
    
    log(`\nStatus: ${status}`, status === 200 ? 'green' : 'red');
    log(`Cache-Control: ${headers['cache-control'] || 'NOT SET'}`, headers['cache-control'] ? 'green' : 'yellow');
    
    // Check response format
    const hasTools = Array.isArray(body.tools);
    const toolCount = hasTools ? body.tools.length : 0;
    const expectedTools = LITE_TOOLS;
    
    log(`\nTools found: ${toolCount}`, toolCount === 4 ? 'green' : 'red');
    log(`Expected: 4 tools`, 'blue');
    
    if (hasTools) {
      const toolNames = body.tools.map(t => t.name || t);
      log(`\nTool names:`, 'blue');
      toolNames.forEach((name, idx) => {
        const expected = expectedTools[idx];
        const match = name === expected;
        log(`  ${idx + 1}. ${name} ${match ? '✅' : '❌ (expected: ' + expected + ')'}`, match ? 'green' : 'red');
      });
      
      // Check order
      const orderCorrect = toolNames.every((name, idx) => name === expectedTools[idx]);
      log(`\nOrder correct: ${orderCorrect ? '✅' : '❌'}`, orderCorrect ? 'green' : 'red');
    }
    
    // Check Cache-Control header
    const cacheControl = headers['cache-control'] || '';
    const hasNoStore = cacheControl.includes('no-store');
    log(`\nCache-Control includes 'no-store': ${hasNoStore ? '✅' : '❌'}`, hasNoStore ? 'green' : 'red');
    
    return {
      pass: status === 200 && toolCount === 4 && hasNoStore,
      status,
      toolCount,
      tools: body.tools || [],
      cacheControl: cacheControl
    };
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    return { pass: false, error: error.message };
  }
}

// ============================================
// Test 2: POST tools/list - Tool Definitions
// ============================================
async function testToolsList() {
  logSection('Test 2: POST tools/list - Tool Definitions');
  
  try {
    const requestBody = {
      jsonrpc: '2.0',
      id: 'test-list-1',
      method: 'tools/list',
      params: {}
    };
    
    log(`Testing: POST ${MCP_ENDPOINT}`, 'blue');
    log(`Method: tools/list`, 'blue');
    
    const response = await fetchWithTimeout(MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const status = response.status;
    const bodyText = await response.text();
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      log(`\n⚠️  Response is not JSON. Status: ${status}`, 'yellow');
      log(`Response preview: ${bodyText.substring(0, 500)}`, 'yellow');
      return { pass: false, status, error: 'Invalid JSON response', bodyText: bodyText.substring(0, 500) };
    }
    
    log(`\nStatus: ${status}`, status === 200 ? 'green' : 'red');
    
    // Check JSON-RPC format
    const hasJsonRpc = body.jsonrpc === '2.0';
    const hasResult = body.result !== undefined;
    const hasTools = Array.isArray(body.result?.tools);
    const toolCount = hasTools ? body.result.tools.length : 0;
    
    log(`\nJSON-RPC format: ${hasJsonRpc ? '✅' : '❌'}`, hasJsonRpc ? 'green' : 'red');
    log(`Has result: ${hasResult ? '✅' : '❌'}`, hasResult ? 'green' : 'red');
    log(`Tools found: ${toolCount}`, toolCount === 4 ? 'green' : 'red');
    
    if (hasTools) {
      const toolNames = body.result.tools.map(t => t.name);
      log(`\nTool names:`, 'blue');
      toolNames.forEach((name, idx) => {
        const expected = LITE_TOOLS[idx];
        const match = name === expected;
        log(`  ${idx + 1}. ${name} ${match ? '✅' : '❌'}`, match ? 'green' : 'red');
        
        // Check tool definition completeness
        const tool = body.result.tools[idx];
        const hasDescription = !!tool.description;
        const hasInputSchema = !!tool.inputSchema;
        log(`     Description: ${hasDescription ? '✅' : '❌'}`, hasDescription ? 'green' : 'red');
        log(`     Input Schema: ${hasInputSchema ? '✅' : '❌'}`, hasInputSchema ? 'green' : 'red');
      });
    }
    
    return {
      pass: status === 200 && hasJsonRpc && toolCount === 4,
      status,
      toolCount,
      tools: body.result?.tools || []
    };
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    return { pass: false, error: error.message };
  }
}

// ============================================
// Test 3: Authentication - No Token
// ============================================
async function testAuthNoToken() {
  logSection('Test 3: Authentication - No Token (Should Fail)');
  
  try {
    const response = await fetchWithTimeout(MCP_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const status = response.status;
    const body = await response.text();
    
    log(`Status: ${status}`, status === 401 ? 'green' : 'red');
    log(`Expected: 401 Unauthorized`, 'blue');
    
    const isUnauthorized = status === 401 || body.includes('Unauthorized') || body.includes('unauthorized');
    log(`Unauthorized response: ${isUnauthorized ? '✅' : '❌'}`, isUnauthorized ? 'green' : 'red');
    
    return {
      pass: status === 401 || isUnauthorized,
      status,
      body: body.substring(0, 200)
    };
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    return { pass: false, error: error.message };
  }
}

// ============================================
// Test 4: Authentication - Invalid Token
// ============================================
async function testAuthInvalidToken() {
  logSection('Test 4: Authentication - Invalid Token (Should Fail)');
  
  try {
    const response = await fetchWithTimeout(MCP_ENDPOINT, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid_token_12345',
        'Content-Type': 'application/json'
      }
    });
    
    const status = response.status;
    const body = await response.text();
    
    log(`Status: ${status}`, status === 401 ? 'green' : 'red');
    log(`Expected: 401 Unauthorized`, 'blue');
    
    const isUnauthorized = status === 401 || body.includes('Unauthorized') || body.includes('unauthorized');
    log(`Unauthorized response: ${isUnauthorized ? '✅' : '❌'}`, isUnauthorized ? 'green' : 'red');
    
    return {
      pass: status === 401 || isUnauthorized,
      status,
      body: body.substring(0, 200)
    };
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    return { pass: false, error: error.message };
  }
}

// ============================================
// Test 5: tools/call - Allowlist Check (Invalid Tool)
// ============================================
async function testAllowlistCheck() {
  logSection('Test 5: tools/call - Allowlist Check (Invalid Tool)');
  
  try {
    const requestBody = {
      jsonrpc: '2.0',
      id: 'test-allowlist-1',
      method: 'tools/call',
      params: {
        name: 'invalid_tool_name',
        arguments: {}
      }
    };
    
    log(`Testing: POST ${MCP_ENDPOINT}`, 'blue');
    log(`Method: tools/call`, 'blue');
    log(`Tool: invalid_tool_name (should be rejected)`, 'blue');
    
    const response = await fetchWithTimeout(MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const status = response.status;
    const bodyText = await response.text();
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      log(`\n⚠️  Response is not JSON. Status: ${status}`, 'yellow');
      log(`Response preview: ${bodyText.substring(0, 500)}`, 'yellow');
      return { pass: false, status, error: 'Invalid JSON response', bodyText: bodyText.substring(0, 500) };
    }
    
    log(`\nStatus: ${status}`, status === 200 ? 'green' : 'red');
    
    // Check error format
    const hasError = body.error !== undefined;
    const errorCode = body.error?.code;
    const errorMessage = body.error?.message || '';
    
    log(`Has error field: ${hasError ? '✅' : '❌'}`, hasError ? 'green' : 'red');
    log(`Error code: ${errorCode}`, errorCode === -32601 ? 'green' : 'yellow');
    log(`Error message: ${errorMessage.substring(0, 100)}`, 'blue');
    
    const isRejected = hasError && (errorCode === -32601 || errorMessage.includes('not available'));
    log(`Tool rejected: ${isRejected ? '✅' : '❌'}`, isRejected ? 'green' : 'red');
    
    return {
      pass: status === 200 && isRejected,
      status,
      errorResponse: body.error  // Rename to avoid confusion - this is expected error response
    };
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    return { pass: false, error: error.message };
  }
}

// ============================================
// Test 6: tools/call - Each Tool (Basic Call)
// ============================================
async function testToolCall(toolName, testArgs) {
  logSection(`Test 6.${LITE_TOOLS.indexOf(toolName) + 1}: tools/call - ${toolName}`);
  
  try {
    const requestBody = {
      jsonrpc: '2.0',
      id: `test-${toolName}-${Date.now()}`,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: testArgs
      }
    };
    
    log(`Testing: POST ${MCP_ENDPOINT}`, 'blue');
    log(`Tool: ${toolName}`, 'blue');
    log(`Arguments: ${JSON.stringify(testArgs, null, 2)}`, 'blue');
    
    const startTime = Date.now();
    const response = await fetchWithTimeout(MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    const elapsed = Date.now() - startTime;
    
    const status = response.status;
    const bodyText = await response.text();
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      log(`\n⚠️  Response is not JSON. Status: ${status}`, 'yellow');
      log(`Response preview: ${bodyText.substring(0, 500)}`, 'yellow');
      return { pass: false, status, error: 'Invalid JSON response', bodyText: bodyText.substring(0, 500) };
    }
    
    log(`\nStatus: ${status}`, status === 200 ? 'green' : 'red');
    log(`Elapsed: ${elapsed}ms`, elapsed < 30000 ? 'green' : 'yellow');
    
    // Check JSON-RPC format
    const hasJsonRpc = body.jsonrpc === '2.0';
    const hasResult = body.result !== undefined;
    const hasError = body.error !== undefined;
    
    log(`JSON-RPC format: ${hasJsonRpc ? '✅' : '❌'}`, hasJsonRpc ? 'green' : 'red');
    
    if (hasResult) {
      const result = body.result;
      const hasContent = Array.isArray(result.content);
      log(`Has result: ✅`, 'green');
      log(`Has content array: ${hasContent ? '✅' : '❌'}`, hasContent ? 'green' : 'red');
      
      if (hasContent && result.content.length > 0) {
        const firstContent = result.content[0];
        log(`Content type: ${firstContent.type || 'unknown'}`, 'blue');
        log(`Content preview: ${JSON.stringify(firstContent).substring(0, 150)}...`, 'blue');
      }
    } else if (hasError) {
      log(`Has error: ⚠️`, 'yellow');
      log(`Error code: ${body.error.code}`, 'yellow');
      log(`Error message: ${body.error.message}`, 'yellow');
    }
    
    return {
      pass: status === 200 && hasJsonRpc && (hasResult || hasError),
      status,
      elapsed,
      result: body.result,
      error: body.error
    };
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    return { pass: false, error: error.message };
  }
}

// ============================================
// Main Test Runner
// ============================================
async function runAllTests() {
  log('\n🚀 Starting Production Tests for /api/mcp-lite', 'cyan');
  log(`Base URL: ${BASE_URL}`, 'blue');
  log(`Endpoint: ${MCP_ENDPOINT}`, 'blue');
  log(`Token: ${MCP_TOKEN.substring(0, 10)}...`, 'blue');
  
  const results = {
    getToolList: null,
    toolsList: null,
    authNoToken: null,
    authInvalidToken: null,
    allowlistCheck: null,
    toolCalls: {}
  };
  
  // Test 1: GET tool list
  results.getToolList = await testGetToolList();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: POST tools/list
  results.toolsList = await testToolsList();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 3: Auth - No token
  results.authNoToken = await testAuthNoToken();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 4: Auth - Invalid token
  results.authInvalidToken = await testAuthInvalidToken();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 5: Allowlist check
  results.allowlistCheck = await testAllowlistCheck();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 6: Tool calls
  logSection('Test 6: tools/call - All Tools');
  
  // career_transition_advice
  results.toolCalls.career_transition_advice = await testToolCall('career_transition_advice', {
    current_job: 'Software Engineer',
    experience_years: 3,
    skills: ['JavaScript', 'React', 'Node.js']
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // search_jobs
  results.toolCalls.search_jobs = await testToolCall('search_jobs', {
    job_title: 'Software Engineer',
    city: 'Sydney'
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // recommend_jobs
  results.toolCalls.recommend_jobs = await testToolCall('recommend_jobs', {
    user_profile: {
      jobTitles: ['Software Engineer'],
      skills: ['React', 'TypeScript'],
      city: 'Sydney'
    },
    limit: 5
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // tailor_resume
  results.toolCalls.tailor_resume = await testToolCall('tailor_resume', {
    resume_content: 'Software Engineer with 5 years experience...',
    user_profile: {
      jobTitles: ['Software Engineer'],
      skills: ['React', 'TypeScript']
    },
    job_description: 'We are looking for a Senior Software Engineer...'
  });
  
  // Summary
  logSection('Test Summary');
  
  const allTests = [
    { name: 'GET /api/mcp-lite', result: results.getToolList },
    { name: 'POST tools/list', result: results.toolsList },
    { name: 'Auth - No Token', result: results.authNoToken },
    { name: 'Auth - Invalid Token', result: results.authInvalidToken },
    { name: 'Allowlist Check', result: results.allowlistCheck },
    { name: 'career_transition_advice', result: results.toolCalls.career_transition_advice },
    { name: 'search_jobs', result: results.toolCalls.search_jobs },
    { name: 'recommend_jobs', result: results.toolCalls.recommend_jobs },
    { name: 'tailor_resume', result: results.toolCalls.tailor_resume }
  ];
  
  let passCount = 0;
  let failCount = 0;
  
  allTests.forEach(test => {
    const pass = test.result?.pass === true;
    if (pass) passCount++;
    else failCount++;
    
    log(`${pass ? '✅' : '❌'} ${test.name}`, pass ? 'green' : 'red');
    // Only show error if test failed (not if it's an expected error response)
    if (!pass && test.result?.error && typeof test.result.error === 'string') {
      log(`   Error: ${test.result.error}`, 'red');
    }
  });
  
  log(`\nTotal: ${allTests.length} tests`, 'blue');
  log(`Passed: ${passCount}`, 'green');
  log(`Failed: ${failCount}`, failCount > 0 ? 'red' : 'green');
  
  if (failCount > 0) {
    log('\n⚠️  Some tests failed. Please review the output above.', 'yellow');
    process.exit(1);
  } else {
    log('\n✅ All tests passed!', 'green');
    process.exit(0);
  }
}

// Run tests
runAllTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

