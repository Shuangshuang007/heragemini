#!/usr/bin/env node

/**
 * Final Store Submission Test - 4 Tools Lite Version
 * 
 * Requirements:
 * - Must use production/preview URL (NOT localhost)
 * - Must validate text structure, not array length
 * - Must test multiple scenarios (major cities, small cities, edge cases)
 * - Must check for P1 defects ([object Object], fetch failed, TypeError)
 * - Must include detailed validation criteria
 * 
 * Usage:
 *   MCP_SHARED_SECRET=your_token node scripts/test_store_submission_final.js
 */

const BASE_URL = process.env.TEST_URL || 'https://www.heraai.net.au';
const MCP_ENDPOINT = `${BASE_URL}/api/mcp-lite`;
const MCP_TOKEN = process.env.MCP_SHARED_SECRET || process.env.MCP_TOKEN;

if (!MCP_TOKEN) {
  console.error('❌ Error: MCP_SHARED_SECRET or MCP_TOKEN environment variable is required');
  process.exit(1);
}

const TEST_TIMEOUT = 30000;

// Test scenarios
const TEST_SCENARIOS = {
  career_transition_advice: [
    {
      name: 'Standard - Software Engineer',
      args: {
        current_job: 'Software Engineer',
        experience_years: 5,
        skills: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'MongoDB', 'AWS'],
        location: 'New York'
      }
    },
    {
      name: 'Standard - Data Analyst',
      args: {
        current_job: 'Data Analyst',
        experience_years: 3,
        skills: ['Python', 'SQL', 'Tableau', 'Excel', 'Statistics', 'Machine Learning'],
        location: 'Los Angeles'
      }
    },
    {
      name: 'Edge Case - Missing Skills',
      args: {
        current_job: 'Marketing Manager',
        experience_years: 4
        // Missing skills - should handle gracefully
      }
    }
  ],
  search_jobs: [
    {
      name: 'Major City - New York',
      args: {
        job_title: 'Software Engineer',
        city: 'New York'
      }
    },
    {
      name: 'Major City - Los Angeles',
      args: {
        job_title: 'Data Analyst',
        city: 'Los Angeles'
      }
    },
    {
      name: 'Major City - Chicago',
      args: {
        job_title: 'Accountant',
        city: 'Chicago'
      }
    },
    {
      name: 'Edge Case - Missing City',
      args: {
        job_title: 'Software Engineer'
        // Missing city - should handle gracefully
      }
    }
  ],
  recommend_jobs: [
    {
      name: 'Standard - New York',
      args: {
        user_profile: {
          jobTitles: ['Software Engineer'],
          skills: ['React', 'TypeScript', 'Node.js', 'MongoDB', 'AWS', 'Docker'],
          city: 'New York'
        },
        limit: 5
      }
    },
    {
      name: 'Standard - Los Angeles',
      args: {
        user_profile: {
          jobTitles: ['Data Analyst'],
          skills: ['Python', 'SQL', 'Tableau', 'Excel', 'Statistics'],
          city: 'Los Angeles'
        },
        limit: 10
      }
    },
    {
      name: 'Standard - Chicago',
      args: {
        user_profile: {
          jobTitles: ['Accountant'],
          skills: ['Excel', 'QuickBooks', 'Tax Preparation', 'Financial Analysis', 'Auditing'],
          city: 'Chicago'
        },
        limit: 5
      }
    },
    {
      name: 'Edge Case - Missing Profile',
      args: {
        limit: 5
        // Missing user_profile - should handle gracefully
      }
    }
  ],
  tailor_resume: [
    {
      name: 'Standard - With Profile',
      args: {
        resume_content: 'Software Engineer with 5 years of experience in React and Node.js. Led multiple projects...',
        user_profile: {
          jobTitles: ['Software Engineer'],
          skills: ['React', 'TypeScript', 'Node.js'],
          employmentHistory: [
            {
              title: 'Senior Software Engineer',
              company: 'Tech Corp',
              duration: '2020-2024'
            }
          ]
        },
        job_description: 'We are looking for a Senior Software Engineer with React and TypeScript experience...',
        job_title: 'Senior Software Engineer',
        company: 'ABC Inc'
      }
    },
    {
      name: 'Standard - Minimal Input',
      args: {
        resume_content: 'Experienced developer with strong technical skills.',
        user_profile: {
          jobTitles: ['Developer'],
          skills: ['JavaScript', 'Python']
        },
        job_description: 'Looking for a developer...'
      }
    },
    {
      name: 'Edge Case - Missing Resume',
      args: {
        user_profile: {
          jobTitles: ['Engineer'],
          skills: ['React']
        }
        // Missing resume_content - should handle gracefully
      }
    }
  ]
};

// Validation functions
function validateCareerTransitionAdvice(output) {
  const issues = [];
  const text = typeof output === 'string' ? output : JSON.stringify(output);
  
  // Check for P1 defects
  if (text.includes('[object Object]')) {
    issues.push({ severity: 'P1', issue: 'Output contains [object Object]' });
  }
  if (text.includes('fetch failed')) {
    issues.push({ severity: 'P1', issue: 'fetch failed error' });
  }
  if (text.includes('TypeError')) {
    issues.push({ severity: 'P1', issue: 'TypeError in output' });
  }
  
  // Check for empty output
  if (!text || text.trim().length === 0) {
    issues.push({ severity: 'P1', issue: 'Empty output' });
    return { pass: false, issues, criteria: 'Output must be non-empty string' };
  }
  
  // Check for key structures
  const hasRecommended = /recommended|roles|transition/i.test(text);
  const hasJobTitles = /(?:^|\n)\s*(?:\d+\.|[-•])\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/m.test(text);
  const titleMatches = text.match(/(?:^|\n)\s*(?:\d+\.|[-•])\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g);
  const titleCount = titleMatches ? titleMatches.length : 0;
  
  const criteria = [
    `Output is non-empty string: ✅`,
    `Contains key words (recommended/roles/transition): ${hasRecommended ? '✅' : '❌'}`,
    `Contains job title list format: ${hasJobTitles ? '✅' : '❌'}`,
    `Number of job titles found: ${titleCount}`
  ];
  
  const pass = text.length > 0 && !text.includes('[object Object]') && !text.includes('fetch failed') && !text.includes('TypeError') && (hasRecommended || titleCount >= 3);
  
  if (!pass && titleCount < 3 && !hasRecommended) {
    issues.push({ severity: 'P2', issue: `Only found ${titleCount} job titles, expected >= 3 or key words` });
  }
  
  return { pass, issues, criteria };
}

function validateSearchJobs(output) {
  const issues = [];
  const text = typeof output === 'string' ? output : JSON.stringify(output);
  
  // Check for P1 defects
  if (text.includes('[object Object]')) {
    issues.push({ severity: 'P1', issue: 'Output contains [object Object]' });
  }
  if (text.includes('fetch failed')) {
    issues.push({ severity: 'P1', issue: 'fetch failed error' });
  }
  if (text.includes('TypeError')) {
    issues.push({ severity: 'P1', issue: 'TypeError in output' });
  }
  
  // Check for empty output
  if (!text || text.trim().length === 0) {
    issues.push({ severity: 'P1', issue: 'Empty output' });
    return { pass: false, issues, criteria: ['Output must be non-empty string'] };
  }
  
  // ✅ Check if this is an error message (missing parameters)
  const isErrorPrompt = /Please provide.*to search for jobs|missing.*parameter|required.*field/i.test(text);
  
  if (isErrorPrompt) {
    // This is an expected error prompt, should pass
    const criteria = [
      `Output is non-empty string: ✅`,
      `Is error prompt: ✅`,
      `Contains helpful message: ${text.length > 20 ? '✅' : '❌'}`
    ];
    
    const pass = text.length > 0 && !text.includes('[object Object]') && !text.includes('fetch failed') && !text.includes('TypeError') && text.length > 20;
    
    return { pass, issues, criteria, jobCount: null, isErrorPrompt: true };
  }
  
  // Extract job count from text
  const foundMatch = text.match(/Found\s+(\d+)\s+jobs?/i);
  const jobCount = foundMatch ? parseInt(foundMatch[1]) : null;
  
  // Check for job entries
  const hasNumberedEntries = /(?:^|\n)\s*\d+\.\s+/m.test(text);
  const hasBulletEntries = /(?:^|\n)\s*[-•]\s+/m.test(text);
  const hasCompany = /company|company name/i.test(text);
  const hasLocation = /location|city|address/i.test(text);
  const hasLink = /https?:\/\//.test(text);
  
  const criteria = [
    `Output is non-empty string: ✅`,
    `Found jobs count: ${jobCount !== null ? jobCount : 'NOT FOUND'}`,
    `Has numbered entries (1. / 2.): ${hasNumberedEntries ? '✅' : '❌'}`,
    `Has bullet entries (- / •): ${hasBulletEntries ? '✅' : '❌'}`,
    `Contains company info: ${hasCompany ? '✅' : '❌'}`,
    `Contains location info: ${hasLocation ? '✅' : '❌'}`,
    `Contains apply link: ${hasLink ? '✅' : '❌'}`
  ];
  
  let pass = text.length > 0 && !text.includes('[object Object]') && !text.includes('fetch failed') && !text.includes('TypeError');
  
  if (jobCount === null) {
    issues.push({ severity: 'P2', issue: 'Could not find "Found X jobs" pattern in output' });
    pass = false;
  } else if (jobCount > 0) {
    // If jobs found, must have entries
    if (!hasNumberedEntries && !hasBulletEntries) {
      issues.push({ severity: 'P2', issue: 'Found jobs but no numbered/bullet entries' });
      pass = false;
    }
    if (!hasCompany && !hasLocation && !hasLink) {
      issues.push({ severity: 'P2', issue: 'Found jobs but missing company/location/link info' });
      pass = false;
    }
  } else {
    // If 0 jobs, must have clear message
    if (!text.includes('Found 0') && !text.includes('No jobs') && !text.includes('suggest')) {
      issues.push({ severity: 'P2', issue: '0 jobs found but no clear message or suggestions' });
    }
  }
  
  return { pass, issues, criteria, jobCount };
}

function validateRecommendJobs(output) {
  const issues = [];
  const text = typeof output === 'string' ? output : JSON.stringify(output);
  
  // Check for P1 defects
  if (text.includes('[object Object]')) {
    issues.push({ severity: 'P1', issue: 'Output contains [object Object]' });
  }
  if (text.includes('fetch failed')) {
    issues.push({ severity: 'P1', issue: 'fetch failed error' });
  }
  if (text.includes('TypeError')) {
    issues.push({ severity: 'P1', issue: 'TypeError in output' });
  }
  
  // Check for empty output
  if (!text || text.trim().length === 0) {
    issues.push({ severity: 'P1', issue: 'Empty output' });
    return { pass: false, issues, criteria: ['Output must be non-empty string'] };
  }
  
  // ✅ Check if this is an error message (missing profile)
  const isErrorPrompt = /I need your career information|Please share.*job title|missing.*profile|required.*user_profile/i.test(text);
  
  if (isErrorPrompt) {
    // This is an expected error prompt, should pass
    const criteria = [
      `Output is non-empty string: ✅`,
      `Is error prompt: ✅`,
      `Contains helpful message: ${text.length > 20 ? '✅' : '❌'}`
    ];
    
    const pass = text.length > 0 && !text.includes('[object Object]') && !text.includes('fetch failed') && !text.includes('TypeError') && text.length > 20;
    
    return { pass, issues, criteria, recCount: null, isErrorPrompt: true };
  }
  
  // Extract recommendation count
  const recMatch = text.match(/Found\s+(\d+)\s+personalized\s+job\s+recommendations?/i);
  const recCount = recMatch ? parseInt(recMatch[1]) : null;
  
  // Check for job entries
  const hasNumberedEntries = /(?:^|\n)\s*\d+\.\s+/m.test(text);
  const hasCompany = /company|company name/i.test(text);
  const hasJobTitle = /title|position|role/i.test(text);
  const hasLocation = /location|city|address/i.test(text);
  const hasLink = /https?:\/\//.test(text);
  
  // Check for "No recent job postings" in major cities (warning, not failure)
  const hasNoPostings = /No recent job postings/i.test(text);
  
  const criteria = [
    `Output is non-empty string: ✅`,
    `Found recommendations count: ${recCount !== null ? recCount : 'NOT FOUND'}`,
    `Has numbered entries: ${hasNumberedEntries ? '✅' : '❌'}`,
    `Contains company info: ${hasCompany ? '✅' : '❌'}`,
    `Contains job title info: ${hasJobTitle ? '✅' : '❌'}`,
    `Contains location info: ${hasLocation ? '✅' : '❌'}`,
    `Contains apply link: ${hasLink ? '✅' : '❌'}`,
    `Has "No recent job postings" warning: ${hasNoPostings ? '⚠️' : '✅'}`
  ];
  
  let pass = text.length > 0 && !text.includes('[object Object]') && !text.includes('fetch failed') && !text.includes('TypeError');
  
  if (recCount === null) {
    issues.push({ severity: 'P2', issue: 'Could not find "Found X personalized job recommendations" pattern' });
    pass = false;
  } else if (recCount > 0) {
    if (!hasNumberedEntries) {
      issues.push({ severity: 'P2', issue: 'Found recommendations but no numbered entries' });
      pass = false;
    }
    if (!hasCompany && !hasJobTitle && !hasLocation && !hasLink) {
      issues.push({ severity: 'P2', issue: 'Found recommendations but missing all job details' });
      pass = false;
    }
  }
  
  if (hasNoPostings) {
    issues.push({ severity: 'P3', issue: 'Contains "No recent job postings" warning (may be expected for small cities)' });
  }
  
  return { pass, issues, criteria, recCount };
}

function validateTailorResume(output) {
  const issues = [];
  const text = typeof output === 'string' ? output : JSON.stringify(output);
  
  // P1: Check for [object Object] - CRITICAL
  if (text.includes('[object Object]')) {
    issues.push({ severity: 'P1', issue: 'Output contains [object Object] - CRITICAL DEFECT' });
  }
  if (text.includes('fetch failed')) {
    issues.push({ severity: 'P1', issue: 'fetch failed error' });
  }
  if (text.includes('TypeError')) {
    issues.push({ severity: 'P1', issue: 'TypeError in output' });
  }
  
  // Check for empty output
  if (!text || text.trim().length === 0) {
    issues.push({ severity: 'P1', issue: 'Empty output' });
    return { pass: false, issues, criteria: 'Output must be non-empty string' };
  }
  
  // Check for success indicator
  const hasSuccess = /(?:Optimized|Tailored|Successfully|Customized)/i.test(text);
  
  const criteria = [
    `Output is non-empty string: ✅`,
    `Contains [object Object]: ${text.includes('[object Object]') ? '❌ P1 DEFECT' : '✅'}`,
    `Contains success indicator: ${hasSuccess ? '✅' : '❌'}`,
    `Output length: ${text.length} characters`
  ];
  
  const pass = text.length > 0 && !text.includes('[object Object]') && !text.includes('fetch failed') && !text.includes('TypeError') && hasSuccess;
  
  if (!hasSuccess) {
    issues.push({ severity: 'P2', issue: 'Missing success indicator (Optimized/Tailored/Successfully)' });
  }
  
  return { pass, issues, criteria };
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

async function testTool(toolName, scenario) {
  const requestBody = {
    jsonrpc: '2.0',
    id: `test-${toolName}-${Date.now()}`,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: scenario.args
    }
  };
  
  const startTime = Date.now();
  let response, body, elapsed;
  
  try {
    response = await fetchWithTimeout(MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    elapsed = Date.now() - startTime;
    const bodyText = await response.text();
    
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      return {
        pass: false,
        error: 'Invalid JSON response',
        status: response.status,
        bodyText: bodyText.substring(0, 500),
        elapsed
      };
    }
    
    // Extract output text
    let output = '';
    if (body.result?.content && Array.isArray(body.result.content)) {
      const textContent = body.result.content.find(c => c.type === 'text');
      if (textContent) {
        output = textContent.text || '';
      }
    }
    
    // Validate based on tool
    let validation;
    switch (toolName) {
      case 'career_transition_advice':
        validation = validateCareerTransitionAdvice(output);
        break;
      case 'search_jobs':
        validation = validateSearchJobs(output);
        break;
      case 'recommend_jobs':
        validation = validateRecommendJobs(output);
        break;
      case 'tailor_resume':
        validation = validateTailorResume(output);
        break;
      default:
        validation = { pass: false, issues: [{ severity: 'P1', issue: 'Unknown tool' }], criteria: [] };
    }
    
    return {
      pass: response.status === 200 && validation.pass,
      status: response.status,
      elapsed,
      output: output.substring(0, 500), // First 500 chars for preview
      fullOutput: output,
      validation,
      request: requestBody
    };
  } catch (error) {
    elapsed = Date.now() - startTime;
    return {
      pass: false,
      error: error.message,
      elapsed
    };
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 Store Submission Final Test - 4 Tools Lite Version');
  console.log('='.repeat(80));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Endpoint: ${MCP_ENDPOINT}`);
  console.log(`Token: ${MCP_TOKEN.substring(0, 10)}...`);
  console.log('');
  
  const results = {};
  const allP1Issues = [];
  
  // Test each tool
  for (const [toolName, scenarios] of Object.entries(TEST_SCENARIOS)) {
    console.log('\n' + '='.repeat(80));
    console.log(`Testing: ${toolName}`);
    console.log('='.repeat(80));
    
    results[toolName] = [];
    
    for (const scenario of scenarios) {
      console.log(`\n📋 Scenario: ${scenario.name}`);
      console.log(`   Input: ${JSON.stringify(scenario.args, null, 2).substring(0, 200)}...`);
      
      const result = await testTool(toolName, scenario);
      results[toolName].push({ scenario: scenario.name, ...result });
      
      if (result.pass) {
        console.log(`   ✅ PASS (${result.elapsed}ms)`);
      } else {
        console.log(`   ❌ FAIL (${result.elapsed}ms)`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
      }
      
      if (result.validation?.issues) {
        result.validation.issues.forEach(issue => {
          if (issue.severity === 'P1') {
            allP1Issues.push({ tool: toolName, scenario: scenario.name, ...issue });
            console.log(`   ⚠️  P1: ${issue.issue}`);
          }
        });
      }
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Generate report
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TEST REPORT');
  console.log('='.repeat(80));
  
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`Test Date: ${new Date().toISOString()}`);
  console.log('');
  
  // Report for each tool
  for (const [toolName, toolResults] of Object.entries(results)) {
    console.log('\n' + '-'.repeat(80));
    console.log(`Tool: ${toolName}`);
    console.log('-'.repeat(80));
    
    const passCount = toolResults.filter(r => r.pass).length;
    const failCount = toolResults.length - passCount;
    
    console.log(`\nScenarios tested: ${toolResults.length}`);
    console.log(`Passed: ${passCount}`);
    console.log(`Failed: ${failCount}`);
    
    toolResults.forEach((result, idx) => {
      console.log(`\n  Scenario ${idx + 1}: ${result.scenario}`);
      console.log(`  Status: ${result.pass ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  Elapsed: ${result.elapsed}ms`);
      
      if (result.request) {
        console.log(`  Request:`);
        console.log(`    ${JSON.stringify(result.request.params.arguments, null, 4).substring(0, 300)}...`);
      }
      
      if (result.output) {
        console.log(`  Output preview (first 20 lines):`);
        const lines = result.output.split('\n').slice(0, 20);
        lines.forEach(line => console.log(`    ${line}`));
      }
      
      if (result.validation) {
        if (result.validation.criteria && Array.isArray(result.validation.criteria)) {
          console.log(`  Validation Criteria:`);
          result.validation.criteria.forEach(c => console.log(`    ${c}`));
        } else if (result.validation.criteria) {
          console.log(`  Validation Criteria: ${result.validation.criteria}`);
        }
        
        if (result.validation.issues && Array.isArray(result.validation.issues) && result.validation.issues.length > 0) {
          console.log(`  Issues:`);
          result.validation.issues.forEach(issue => {
            console.log(`    [${issue.severity}] ${issue.issue}`);
          });
        }
      }
    });
  }
  
  // P1 Issues Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('🚨 P1 DEFECTS SUMMARY');
  console.log('='.repeat(80));
  
  if (allP1Issues.length === 0) {
    console.log('\n✅ No P1 defects found!');
  } else {
    console.log(`\n❌ Found ${allP1Issues.length} P1 defect(s):`);
    allP1Issues.forEach((issue, idx) => {
      console.log(`\n  ${idx + 1}. Tool: ${issue.tool}`);
      console.log(`     Scenario: ${issue.scenario}`);
      console.log(`     Issue: ${issue.issue}`);
    });
  }
  
  // Final verdict
  console.log('\n\n' + '='.repeat(80));
  console.log('✅ FINAL VERDICT');
  console.log('='.repeat(80));
  
  const totalTests = Object.values(results).flat().length;
  const totalPassed = Object.values(results).flat().filter(r => r.pass).length;
  const hasP1Issues = allP1Issues.length > 0;
  
  console.log(`\nTotal scenarios tested: ${totalTests}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalTests - totalPassed}`);
  console.log(`P1 defects: ${allP1Issues.length}`);
  
  if (totalPassed === totalTests && !hasP1Issues) {
    console.log('\n✅ Lite version is READY FOR STORE SUBMISSION');
    console.log('   All tests passed with 0 P1 defects');
  } else {
    console.log('\n❌ Lite version is NOT READY FOR STORE SUBMISSION');
    if (hasP1Issues) {
      console.log('   P1 defects must be fixed before submission');
    }
    if (totalPassed < totalTests) {
      console.log('   Some test scenarios failed');
    }
  }
  
  console.log('');
}

runTests().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

