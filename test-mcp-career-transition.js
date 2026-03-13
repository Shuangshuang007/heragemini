#!/usr/bin/env node

/**
 * Test MCP career_transition_advice tool
 * 直接测试MCP的career_transition_advice工具
 */

const http = require('http');

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });

const MCP_URL = process.env.MCP_URL || 'http://127.0.0.1:3002';
const MCP_SECRET = process.env.MCP_SHARED_SECRET || process.env.MCP_SECRET || 'your-secret-key';

function makeMcpRequest(toolName, args) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/mcp', MCP_URL);
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });

    const options = {
      hostname: url.hostname,
      port: url.port || 3002,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MCP_SECRET}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(body);
    req.end();
  });
}

async function testCareerTransitionAdvice() {
  console.log('🧪 Testing MCP career_transition_advice tool\n');
  console.log(`📍 MCP URL: ${MCP_URL}\n`);
  console.log('='.repeat(60));

  const testCases = [
    {
      name: 'Test 1: Software Engineer',
      args: {
        current_job: 'software engineer',
        experience_years: 3
      }
    },
    {
      name: 'Test 2: Product Manager',
      args: {
        current_job: 'product manager',
        experience_years: 5
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 ${testCase.name}`);
    console.log(`   Input:`, testCase.args);
    
    try {
      const response = await makeMcpRequest('career_transition_advice', testCase.args);
      
      if (response.status !== 200) {
        console.log(`   ❌ Request failed with status ${response.status}`);
        console.log(`   Response:`, JSON.stringify(response.data, null, 2));
        continue;
      }

      const result = response.data.result;
      
      if (result.isError) {
        console.log(`   ❌ Tool returned error`);
        console.log(`   Error:`, result.content);
        continue;
      }

      console.log(`   ✅ Request successful`);
      
      // Parse the markdown response
      const markdownText = result.content[0]?.text || '';
      
      // Check for Priority 1 fields in the markdown
      const checks = {
        hasOpportunityScore: markdownText.includes('Opportunity Score'),
        hasScore: markdownText.includes('Overall Score'),
        hasFeasibilityScore: markdownText.includes('Feasibility'),
        hasFromCountry: markdownText.includes('From:'),
        hasToCountry: markdownText.includes('To:'),
        hasCrossCountry: markdownText.includes('Cross-country'),
        hasRemoteSupported: markdownText.includes('Remote supported'),
        hasMarketTrend: markdownText.includes('Trend:'),
        hasMarketRemoteRate: markdownText.includes('Remote:'),
        hasMarketAvgSalary: markdownText.includes('Avg Salary'),
        hasMarketIndustryDistribution: markdownText.includes('Top Industries')
      };
      
      console.log(`\n   📊 Priority 1 Fields Check:`);
      Object.entries(checks).forEach(([field, present]) => {
        console.log(`      ${present ? '✅' : '❌'} ${field}`);
      });
      
      const totalChecks = Object.keys(checks).length;
      const passedChecks = Object.values(checks).filter(v => v).length;
      console.log(`\n   📊 Coverage: ${passedChecks}/${totalChecks} (${Math.round(passedChecks/totalChecks*100)}%)`);
      
      // Show a snippet of the response
      const lines = markdownText.split('\n').slice(0, 30);
      console.log(`\n   📄 Response preview (first 30 lines):`);
      lines.forEach((line, i) => {
        if (line.trim()) {
          console.log(`      ${line.substring(0, 80)}`);
        }
      });
      
    } catch (error) {
      console.log(`   ❌ Test failed: ${error.message}`);
      if (error.code === 'ECONNREFUSED') {
        console.log(`   ⚠️  MCP server is not running on ${MCP_URL}`);
        console.log(`   💡 Start the server: cd hera_one && npm run dev`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Tests completed\n');
}

testCareerTransitionAdvice()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });

