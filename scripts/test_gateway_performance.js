#!/usr/bin/env node

/**
 * Gateway Performance Test Script
 * 
 * Tests recommend_jobs and search_jobs endpoints with 30 consecutive calls
 * Statistics: p50/p95, failure rate, timeout rate
 * Output: Markdown report
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

// Allow override via command line: node scripts/test_gateway_performance.js --url=https://www.heraai.net.au
const args = process.argv.slice(2);
const urlArg = args.find(arg => arg.startsWith('--url='));
const BASE_URL = urlArg 
  ? urlArg.split('=')[1] 
  : (process.env.NEXT_PUBLIC_BASE_URL || 'https://www.heraai.net.au');

const GATEWAY_ENDPOINT = `${BASE_URL}/api/gateway/mcp`;

// Timeout threshold (ms) - requests exceeding this are considered timeout
const TIMEOUT_THRESHOLD = 30000; // 30 seconds

console.log('=== Gateway Performance Test ===\n');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Gateway Endpoint: ${GATEWAY_ENDPOINT}`);
console.log(`Timeout Threshold: ${TIMEOUT_THRESHOLD}ms\n`);

// Helper function to make HTTPS request with timeout
function makeRequest(url, options, data, timeoutMs = 60000) {
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
    let resolved = false;

    // Set overall timeout
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
            elapsed: Date.now() - startTime
          });
        }
      });
    });

    req.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(error);
      }
    });

    if (data) req.write(data);
    req.end();
  });
}

// Calculate percentile
function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// Test function
async function testTool(toolName, requestData, iterations = 30) {
  console.log(`\n📋 Testing ${toolName} (${iterations} iterations)...`);
  
  const results = [];
  const errors = [];
  
  for (let i = 1; i <= iterations; i++) {
    process.stdout.write(`   ${i}/${iterations}... `);
    
    try {
      const response = await makeRequest(GATEWAY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, JSON.stringify(requestData));
      
      const isSuccess = response.statusCode === 200;
      const isTimeout = response.elapsed >= TIMEOUT_THRESHOLD;
      
      results.push({
        attempt: i,
        statusCode: response.statusCode,
        elapsed: response.elapsed,
        success: isSuccess,
        timeout: isTimeout
      });
      
      if (isSuccess && !isTimeout) {
        console.log(`✅ ${response.elapsed}ms`);
      } else if (isSuccess && isTimeout) {
        console.log(`⚠️  ${response.elapsed}ms (TIMEOUT)`);
      } else {
        console.log(`❌ ${response.statusCode} (${response.elapsed}ms)`);
        errors.push({
          attempt: i,
          statusCode: response.statusCode,
          elapsed: response.elapsed,
          body: response.body.substring(0, 200)
        });
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      results.push({
        attempt: i,
        statusCode: 0,
        elapsed: TIMEOUT_THRESHOLD,
        success: false,
        timeout: true,
        error: error.message
      });
      errors.push({
        attempt: i,
        error: error.message
      });
    }
    
    // Small delay between requests to avoid overwhelming the server
    if (i < iterations) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Calculate statistics
  const successfulResults = results.filter(r => r.success && !r.timeout);
  const failedResults = results.filter(r => !r.success);
  const timeoutResults = results.filter(r => r.timeout);
  
  const elapsedTimes = successfulResults.map(r => r.elapsed);
  
  const stats = {
    total: iterations,
    success: successfulResults.length,
    failed: failedResults.length,
    timeout: timeoutResults.length,
    successRate: (successfulResults.length / iterations * 100).toFixed(1),
    failureRate: (failedResults.length / iterations * 100).toFixed(1),
    timeoutRate: (timeoutResults.length / iterations * 100).toFixed(1),
    min: elapsedTimes.length > 0 ? Math.min(...elapsedTimes) : 0,
    max: elapsedTimes.length > 0 ? Math.max(...elapsedTimes) : 0,
    avg: elapsedTimes.length > 0 ? (elapsedTimes.reduce((a, b) => a + b, 0) / elapsedTimes.length) : 0,
    p50: elapsedTimes.length > 0 ? percentile(elapsedTimes, 50) : 0,
    p95: elapsedTimes.length > 0 ? percentile(elapsedTimes, 95) : 0,
    p99: elapsedTimes.length > 0 ? percentile(elapsedTimes, 99) : 0,
    errors: errors
  };
  
  return { toolName, results, stats };
}

// Generate markdown report
function generateMarkdownReport(testResults) {
  const timestamp = new Date().toISOString();
  const dateStr = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
  
  let markdown = `# Gateway Performance Test Report\n\n`;
  markdown += `**Test Time**: ${dateStr} UTC\n`;
  markdown += `**Environment**: ${BASE_URL}\n`;
  markdown += `**Iterations**: 30 per tool\n`;
  markdown += `**Timeout Threshold**: ${TIMEOUT_THRESHOLD}ms\n\n`;
  markdown += `---\n\n`;
  
  for (const { toolName, stats } of testResults) {
    markdown += `## ${toolName}\n\n`;
    markdown += `### Summary\n\n`;
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total Requests | ${stats.total} |\n`;
    markdown += `| Successful | ${stats.success} (${stats.successRate}%) |\n`;
    markdown += `| Failed | ${stats.failed} (${stats.failureRate}%) |\n`;
    markdown += `| Timeout (≥${TIMEOUT_THRESHOLD}ms) | ${stats.timeout} (${stats.timeoutRate}%) |\n\n`;
    
    if (stats.success > 0) {
      markdown += `### Performance Metrics (Successful Requests Only)\n\n`;
      markdown += `| Metric | Value (ms) |\n`;
      markdown += `|--------|-----------|\n`;
      markdown += `| Min | ${Math.round(stats.min)} |\n`;
      markdown += `| Max | ${Math.round(stats.max)} |\n`;
      markdown += `| Average | ${Math.round(stats.avg)} |\n`;
      markdown += `| **p50 (Median)** | **${Math.round(stats.p50)}** |\n`;
      markdown += `| **p95** | **${Math.round(stats.p95)}** |\n`;
      markdown += `| p99 | ${Math.round(stats.p99)} |\n\n`;
    }
    
    if (stats.errors.length > 0) {
      markdown += `### Errors\n\n`;
      for (const error of stats.errors.slice(0, 10)) {
        if (error.statusCode) {
          markdown += `- Attempt ${error.attempt}: Status ${error.statusCode}, ${error.elapsed}ms\n`;
        } else {
          markdown += `- Attempt ${error.attempt}: ${error.error}\n`;
        }
      }
      if (stats.errors.length > 10) {
        markdown += `- ... and ${stats.errors.length - 10} more errors\n`;
      }
      markdown += `\n`;
    }
    
    markdown += `---\n\n`;
  }
  
  // Comparison section
  if (testResults.length === 2) {
    markdown += `## Comparison\n\n`;
    markdown += `| Metric | ${testResults[0].toolName} | ${testResults[1].toolName} |\n`;
    markdown += `|--------|----------------------|----------------|\n`;
    markdown += `| Success Rate | ${testResults[0].stats.successRate}% | ${testResults[1].stats.successRate}% |\n`;
    markdown += `| Timeout Rate | ${testResults[0].stats.timeoutRate}% | ${testResults[1].stats.timeoutRate}% |\n`;
    markdown += `| p50 | ${Math.round(testResults[0].stats.p50)}ms | ${Math.round(testResults[1].stats.p50)}ms |\n`;
    markdown += `| p95 | ${Math.round(testResults[0].stats.p95)}ms | ${Math.round(testResults[1].stats.p95)}ms |\n`;
    markdown += `| Average | ${Math.round(testResults[0].stats.avg)}ms | ${Math.round(testResults[1].stats.avg)}ms |\n\n`;
  }
  
  markdown += `---\n\n`;
  markdown += `*Generated at ${timestamp}*\n`;
  
  return markdown;
}

// Test data variations - 确保有足够的组合
const JOB_TITLES = [
  'Software Engineer', 'Data Analyst', 'Product Manager', 'Marketing Manager', 'HR Manager',
  'Business Analyst', 'Accountant', 'Sales Manager', 'Project Manager', 'Designer',
  'Nurse', 'Teacher', 'Chef', 'Engineer', 'Consultant', 'Developer', 'Manager',
  'Analyst', 'Specialist', 'Coordinator', 'Executive', 'Director', 'Supervisor',
  'Assistant', 'Officer', 'Representative', 'Technician', 'Administrator', 'Coordinator', 'Lead'
];

const CITIES = [
  'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide',
  'Canberra', 'Gold Coast', 'Newcastle', 'Wollongong', 'Hobart',
  'Darwin', 'Geelong', 'Townsville', 'Cairns', 'Toowoomba',
  'Ballarat', 'Bendigo', 'Albury', 'Launceston', 'Mackay',
  'Rockhampton', 'Bunbury', 'Coffs Harbour', 'Wagga Wagga', 'Hervey Bay',
  'Port Macquarie', 'Tamworth', 'Orange', 'Dubbo', 'Geraldton'
];

const SKILLS_SETS = [
  ['JavaScript', 'TypeScript', 'React'],
  ['Python', 'SQL', 'Data Analysis'],
  ['Project Management', 'Agile', 'Scrum'],
  ['Marketing', 'SEO', 'Content Marketing'],
  ['HR', 'Recruitment', 'Talent Acquisition'],
  ['Accounting', 'Finance', 'Excel'],
  ['Sales', 'CRM', 'Negotiation'],
  ['Design', 'Figma', 'UI/UX'],
  ['Nursing', 'Patient Care', 'Medical'],
  ['Teaching', 'Education', 'Curriculum'],
  ['Cooking', 'Food Safety', 'Menu Planning'],
  ['Engineering', 'CAD', 'Design'],
  ['Consulting', 'Strategy', 'Analysis'],
  ['Development', 'Code Review', 'Testing'],
  ['Management', 'Leadership', 'Planning']
];

// 生成30个不同的参数组合
function generateTestCombinations(count = 30) {
  const combinations = [];
  const used = new Set();
  
  for (let i = 0; i < count; i++) {
    let jobTitle, city, key;
    
    // 确保每个组合都是唯一的
    do {
      jobTitle = JOB_TITLES[Math.floor(Math.random() * JOB_TITLES.length)];
      city = CITIES[Math.floor(Math.random() * CITIES.length)];
      key = `${jobTitle}|${city}`;
    } while (used.has(key) && used.size < JOB_TITLES.length * CITIES.length);
    
    used.add(key);
    combinations.push({
      jobTitle,
      city,
      skills: SKILLS_SETS[i % SKILLS_SETS.length],
      seniority: i % 3 === 0 ? 'Junior' : (i % 3 === 1 ? 'Mid' : 'Senior')
    });
  }
  
  return combinations;
}

// Main test execution
async function main() {
  const testResults = [];
  
  // Test 1: recommend_jobs (使用不同参数)
  console.log('📋 Test 1: recommend_jobs with varied parameters\n');
  
  const recommendCombinations = generateTestCombinations(30);
  const recommendResults = [];
  
  for (let i = 0; i < 30; i++) {
    const { jobTitle, city, skills, seniority } = recommendCombinations[i];
    
    const recommendJobsData = {
      tool: 'recommend_jobs',
      arguments: {
        user_profile: {
          jobTitles: [jobTitle],
          skills: skills,
          city: city,
          seniority: seniority
        },
        job_title: jobTitle,
        city: city,
        limit: 5
      }
    };
    
    process.stdout.write(`   ${i + 1}/30 [${jobTitle} in ${city}]... `);
    
    try {
      const response = await makeRequest(GATEWAY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, JSON.stringify(recommendJobsData));
      
      const isSuccess = response.statusCode === 200;
      const isTimeout = response.elapsed >= TIMEOUT_THRESHOLD;
      
      recommendResults.push({
        attempt: i + 1,
        statusCode: response.statusCode,
        elapsed: response.elapsed,
        success: isSuccess,
        timeout: isTimeout,
        params: `${jobTitle} in ${city}`
      });
      
      if (isSuccess && !isTimeout) {
        console.log(`✅ ${response.elapsed}ms`);
      } else if (isSuccess && isTimeout) {
        console.log(`⚠️  ${response.elapsed}ms (TIMEOUT)`);
      } else {
        console.log(`❌ ${response.statusCode} (${response.elapsed}ms)`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      recommendResults.push({
        attempt: i + 1,
        statusCode: 0,
        elapsed: TIMEOUT_THRESHOLD,
        success: false,
        timeout: true,
        error: error.message,
        params: `${jobTitle} in ${city}`
      });
    }
    
    // Small delay between requests
    if (i < 29) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Aggregate recommend_jobs results
  const successfulRecommend = recommendResults.filter(r => r.success && !r.timeout);
  const failedRecommend = recommendResults.filter(r => !r.success);
  const timeoutRecommend = recommendResults.filter(r => r.timeout);
  const elapsedRecommend = successfulRecommend.map(r => r.elapsed);
  
  const recommendStats = {
    total: 30,
    success: successfulRecommend.length,
    failed: failedRecommend.length,
    timeout: timeoutRecommend.length,
    successRate: (successfulRecommend.length / 30 * 100).toFixed(1),
    failureRate: (failedRecommend.length / 30 * 100).toFixed(1),
    timeoutRate: (timeoutRecommend.length / 30 * 100).toFixed(1),
    min: elapsedRecommend.length > 0 ? Math.min(...elapsedRecommend) : 0,
    max: elapsedRecommend.length > 0 ? Math.max(...elapsedRecommend) : 0,
    avg: elapsedRecommend.length > 0 ? (elapsedRecommend.reduce((a, b) => a + b, 0) / elapsedRecommend.length) : 0,
    p50: elapsedRecommend.length > 0 ? percentile(elapsedRecommend, 50) : 0,
    p95: elapsedRecommend.length > 0 ? percentile(elapsedRecommend, 95) : 0,
    p99: elapsedRecommend.length > 0 ? percentile(elapsedRecommend, 99) : 0,
    errors: failedRecommend.map((r, idx) => ({ attempt: idx + 1, statusCode: r.statusCode, elapsed: r.elapsed }))
  };
  
  testResults.push({ toolName: 'recommend_jobs', results: recommendResults, stats: recommendStats });
  
  // Test 2: search_jobs (使用不同参数)
  console.log('\n📋 Test 2: search_jobs with varied parameters\n');
  
  const searchCombinations = generateTestCombinations(30);
  const searchResults = [];
  
  for (let i = 0; i < 30; i++) {
    const { jobTitle, city } = searchCombinations[i];
    
    const searchJobsData = {
      tool: 'search_jobs',
      arguments: {
        job_title: jobTitle,
        city: city,
        limit: 5
      }
    };
    
    process.stdout.write(`   ${i + 1}/30 [${jobTitle} in ${city}]... `);
    
    try {
      const response = await makeRequest(GATEWAY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, JSON.stringify(searchJobsData));
      
      const isSuccess = response.statusCode === 200;
      const isTimeout = response.elapsed >= TIMEOUT_THRESHOLD;
      
      searchResults.push({
        attempt: i + 1,
        statusCode: response.statusCode,
        elapsed: response.elapsed,
        success: isSuccess,
        timeout: isTimeout,
        params: `${jobTitle} in ${city}`
      });
      
      if (isSuccess && !isTimeout) {
        console.log(`✅ ${response.elapsed}ms`);
      } else if (isSuccess && isTimeout) {
        console.log(`⚠️  ${response.elapsed}ms (TIMEOUT)`);
      } else {
        console.log(`❌ ${response.statusCode} (${response.elapsed}ms)`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      searchResults.push({
        attempt: i + 1,
        statusCode: 0,
        elapsed: TIMEOUT_THRESHOLD,
        success: false,
        timeout: true,
        error: error.message,
        params: `${jobTitle} in ${city}`
      });
    }
    
    // Small delay between requests
    if (i < 29) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Aggregate search_jobs results
  const successfulSearch = searchResults.filter(r => r.success && !r.timeout);
  const failedSearch = searchResults.filter(r => !r.success);
  const timeoutSearch = searchResults.filter(r => r.timeout);
  const elapsedSearch = successfulSearch.map(r => r.elapsed);
  
  const searchStats = {
    total: 30,
    success: successfulSearch.length,
    failed: failedSearch.length,
    timeout: timeoutSearch.length,
    successRate: (successfulSearch.length / 30 * 100).toFixed(1),
    failureRate: (failedSearch.length / 30 * 100).toFixed(1),
    timeoutRate: (timeoutSearch.length / 30 * 100).toFixed(1),
    min: elapsedSearch.length > 0 ? Math.min(...elapsedSearch) : 0,
    max: elapsedSearch.length > 0 ? Math.max(...elapsedSearch) : 0,
    avg: elapsedSearch.length > 0 ? (elapsedSearch.reduce((a, b) => a + b, 0) / elapsedSearch.length) : 0,
    p50: elapsedSearch.length > 0 ? percentile(elapsedSearch, 50) : 0,
    p95: elapsedSearch.length > 0 ? percentile(elapsedSearch, 95) : 0,
    p99: elapsedSearch.length > 0 ? percentile(elapsedSearch, 99) : 0,
    errors: failedSearch.map((r, idx) => ({ attempt: idx + 1, statusCode: r.statusCode, elapsed: r.elapsed }))
  };
  
  testResults.push({ toolName: 'search_jobs', results: searchResults, stats: searchStats });
  
  // Generate and save report
  const markdown = generateMarkdownReport(testResults);
  const fs = require('fs');
  const reportPath = `GATEWAY_PERFORMANCE_TEST_${Date.now()}.md`;
  fs.writeFileSync(reportPath, markdown);
  
  console.log(`\n\n✅ Test completed!`);
  console.log(`📊 Report saved to: ${reportPath}\n`);
  
  // Print summary to console
  console.log('=== Summary ===\n');
  for (const { toolName, stats } of testResults) {
    console.log(`${toolName}:`);
    console.log(`  Success Rate: ${stats.successRate}%`);
    console.log(`  Timeout Rate: ${stats.timeoutRate}%`);
    console.log(`  p50: ${Math.round(stats.p50)}ms`);
    console.log(`  p95: ${Math.round(stats.p95)}ms`);
    console.log('');
  }
}

// Run tests
main().catch(error => {
  console.error('\n❌ Test execution failed:', error);
  process.exit(1);
});

