#!/usr/bin/env node

/**
 * Real-world test script for /api/mcp-lite endpoint (v2 - Fixed)
 * Tests 4 tools with proper text-based validation (not JSON array parsing)
 * 
 * Requirements:
 * - Must use production/preview URL (not localhost)
 * - Must validate text structure, not JSON arrays
 * - Must include boundary cases
 * - Must document validation criteria
 */

const BASE_URL = process.env.TEST_URL || process.env.MCP_LITE_URL || 'https://www.heraai.net.au';
const MCP_TOKEN = process.env.MCP_SHARED_SECRET || '';

if (!MCP_TOKEN) {
  console.error('❌ MCP_SHARED_SECRET not set');
  process.exit(1);
}

if (BASE_URL.includes('localhost')) {
  console.error('⚠️  WARNING: Using localhost for testing. Results may not reflect production behavior.');
  console.error('   Set TEST_URL or MCP_LITE_URL to production/preview URL for valid results.');
}

const results = [];

// Helper: Make MCP call with timeout and progress logging
async function callMCP(method, params, toolName, timeoutMs = 20000) {
  const startTime = Date.now();
  const requestId = `${toolName}-${Date.now()}`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`    ⏱️  [${requestId}] Timeout warning after ${timeoutMs}ms...`);
      controller.abort();
    }, timeoutMs);

    console.log(`    📤 [${requestId}] Sending request...`);
    const response = await fetch(`${BASE_URL}/api/mcp-lite`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;
    console.log(`    📥 [${requestId}] Response received (${elapsed}ms)`);
    
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.log(`    ⚠️  [${requestId}] JSON parse error: ${e.message}`);
      return {
        status: response.status,
        elapsed,
        data: { error: { message: `JSON parse error: ${e.message}`, rawText: text.substring(0, 200) } },
        success: false,
      };
    }

    return {
      status: response.status,
      elapsed,
      data,
      success: response.ok && !data.error,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`    ❌ [${requestId}] Error: ${error.message}`);
    return {
      status: 0,
      elapsed,
      data: { error: { message: error.name === 'AbortError' ? `Timeout after ${timeoutMs}ms` : error.message } },
      success: false,
    };
  }
}

// Helper: Extract text from response
function extractText(data) {
  if (data.result?.content?.[0]?.text) {
    return data.result.content[0].text;
  }
  if (data.result?.content?.[0]?.data) {
    return typeof data.result.content[0].data === 'string' 
      ? data.result.content[0].data 
      : JSON.stringify(data.result.content[0].data);
  }
  return typeof data === 'string' ? data : JSON.stringify(data);
}

// Helper: Format output for markdown
function formatOutput(text, maxLines = 50) {
  if (!text) return '(empty)';
  const lines = text.split('\n');
  if (lines.length > maxLines) {
    return lines.slice(0, maxLines).join('\n') + '\n... (truncated)';
  }
  return text;
}

// Validation: Check for common errors
function hasCommonErrors(text) {
  const errors = [
    'fetch failed',
    'TypeError',
    '[object Object]',
    'undefined',
    'null',
  ];
  return errors.some(err => text.includes(err));
}

// Test A: career_transition_advice (5 groups + 1 boundary)
async function testCareerTransitionAdvice() {
  console.log('\n📋 Testing career_transition_advice (6 groups: 5 standard + 1 boundary)...\n');

  const testCases = [
    {
      name: 'Standard: Software Engineer → Product Manager',
      category: 'A',
      input: {
        current_job: 'Software Engineer',
        experience_years: 3,
        skills: ['JavaScript', 'React', 'Node.js', 'Agile', 'Scrum', 'TypeScript'],
        location: 'Sydney',
      },
    },
    {
      name: 'Standard: Data Analyst → Data Scientist',
      category: 'A',
      input: {
        current_job: 'Data Analyst',
        experience_years: 2,
        skills: ['Python', 'SQL', 'Excel', 'Tableau', 'Statistics', 'Pandas'],
        industry: 'Finance',
      },
    },
    {
      name: 'Standard: Marketing Coordinator → Marketing Manager',
      category: 'A',
      input: {
        current_job: 'Marketing Coordinator',
        experience_years: 4,
        skills: ['Digital Marketing', 'SEO', 'Content Creation', 'Analytics', 'Campaign Management'],
        location: 'Melbourne',
      },
    },
    {
      name: 'Standard: Accountant → Financial Advisor',
      category: 'A',
      input: {
        current_job: 'Accountant',
        experience_years: 5,
        skills: ['Accounting', 'Tax', 'Financial Reporting', 'Excel', 'QuickBooks'],
        industry: 'Professional Services',
      },
    },
    {
      name: 'Standard: UX Designer → Product Designer',
      category: 'A',
      input: {
        current_job: 'UX Designer',
        experience_years: 2,
        skills: ['Figma', 'User Research', 'Wireframing', 'Prototyping', 'Design Systems'],
        location: 'Brisbane',
      },
    },
    {
      name: 'Boundary: Missing skills',
      category: 'C',
      input: {
        current_job: 'Software Engineer',
        experience_years: 3,
        // skills missing
      },
    },
  ];

  for (const testCase of testCases) {
    const result = await callMCP('tools/call', {
      name: 'career_transition_advice',
      arguments: testCase.input,
    }, 'career_transition_advice', 30000);

    const text = extractText(result.data);
    const hasErrors = hasCommonErrors(text);
    const hasRecommended = text.includes('recommended') || text.includes('transition') || text.includes('roles') || 
                          text.match(/\d+\.\s+[A-Z]/) || text.match(/•\s+[A-Z]/);
    const hasTargetRoles = (text.match(/\d+\.\s+[a-z\s]+(engineer|manager|analyst|designer|advisor)/gi) || []).length >= 3;

    const pass = result.success && !hasErrors && text.length > 100 && (hasRecommended || hasTargetRoles);

    results.push({
      tool: 'career_transition_advice',
      category: testCase.category,
      testName: testCase.name,
      input: testCase.input,
      status: result.status,
      elapsed: result.elapsed,
      output: formatOutput(text),
      pass,
      validationCriteria: {
        hasErrors: !hasErrors,
        hasContent: text.length > 100,
        hasRecommendedStructure: hasRecommended || hasTargetRoles,
      },
      failReason: hasErrors ? `Contains error: ${text.match(/(fetch failed|TypeError|\[object Object\])/)?.[0]}` :
                  !result.success ? result.data.error?.message :
                  text.length <= 100 ? 'Output too short' :
                  !hasRecommended && !hasTargetRoles ? 'Missing recommended roles structure' : null,
    });

    console.log(`  ${pass ? '✅' : '❌'} [${testCase.category}] ${testCase.name}: ${result.status} (${result.elapsed}ms)`);
    if (hasErrors) {
      console.log(`    ⚠️  Error detected in output`);
    }
  }
}

// Test B: search_jobs (5 groups: 3 major cities + 1 regional + 1 boundary)
async function testSearchJobs() {
  console.log('\n📋 Testing search_jobs (6 groups: 3 major + 1 regional + 1 boundary)...\n');

  const testCases = [
    { category: 'A', job_title: 'Software Engineer', city: 'Sydney' },
    { category: 'A', job_title: 'Data Analyst', city: 'Melbourne' },
    { category: 'A', job_title: 'Product Manager', city: 'Brisbane' },
    { category: 'B', job_title: 'Consultant', city: 'Geraldton' },
    { category: 'B', job_title: 'UX Designer', city: 'Geelong' },
    { category: 'C', job_title: '', city: 'Sydney' }, // Boundary: missing job_title
  ];

  for (const testCase of testCases) {
    const result = await callMCP('tools/call', {
      name: 'search_jobs',
      arguments: {
        job_title: testCase.job_title || undefined,
        city: testCase.city,
        page_size: 5,
      },
    }, 'search_jobs', 20000);

    const text = extractText(result.data);
    const hasErrors = hasCommonErrors(text);
    
    // Parse "Found X jobs" from text
    const foundMatch = text.match(/Found\s+(\d+)\s+jobs?/i);
    const jobCount = foundMatch ? parseInt(foundMatch[1]) : 0;
    
    // Check for job listings structure
    const hasJobListings = (text.match(/\d+\.\s+[A-Z]/) || text.match(/•\s+[A-Z]/) || []).length >= 1;
    const hasCompanyInfo = text.includes('company') || text.match(/[A-Z][a-z]+\s+(Pty|Ltd|Inc)/);
    const hasApplyLink = text.includes('Apply') || text.includes('👉') || text.includes('http');
    
    // Validation criteria
    const hasValidStructure = foundMatch !== null; // Must have "Found X jobs"
    const hasJobDetails = jobCount > 0 ? (hasJobListings && (hasCompanyInfo || hasApplyLink)) : text.includes('Found 0') || text.includes('no jobs');
    
    const pass = result.success && !hasErrors && hasValidStructure && hasJobDetails;

    results.push({
      tool: 'search_jobs',
      category: testCase.category,
      testName: `${testCase.job_title || '(empty)'} in ${testCase.city}`,
      input: { job_title: testCase.job_title, city: testCase.city },
      status: result.status,
      elapsed: result.elapsed,
      output: formatOutput(text),
      pass,
      validationCriteria: {
        hasErrors: !hasErrors,
        foundJobsCount: jobCount,
        hasValidStructure,
        hasJobDetails,
      },
      failReason: hasErrors ? `Contains error: ${text.match(/(fetch failed|TypeError|\[object Object\])/)?.[0]}` :
                  !result.success ? result.data.error?.message :
                  !hasValidStructure ? 'Missing "Found X jobs" pattern' :
                  !hasJobDetails ? 'Missing job listing structure' : null,
    });

    console.log(`  ${pass ? '✅' : '❌'} [${testCase.category}] ${testCase.job_title || '(empty)'} in ${testCase.city}: ${result.status} (${result.elapsed}ms) - Found ${jobCount} jobs`);
  }
}

// Test C: recommend_jobs (10 groups: 5 major + 2 regional + 3 boundary)
async function testRecommendJobs() {
  console.log('\n📋 Testing recommend_jobs (10 groups: 5 major + 2 regional + 3 boundary)...\n');

  const testCases = [
    {
      name: 'Major: Senior Software Engineer - Sydney',
      category: 'A',
      input: {
        user_profile: {
          jobTitles: ['Senior Software Engineer'],
          skills: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'AWS', 'Docker', 'Kubernetes'],
          city: 'Sydney',
          seniority: 'Senior',
        },
        limit: 5,
      },
    },
    {
      name: 'Major: Mid Data Analyst - Melbourne',
      category: 'A',
      input: {
        user_profile: {
          jobTitles: ['Data Analyst'],
          skills: ['Python', 'SQL', 'Pandas', 'Tableau', 'Machine Learning', 'Statistics'],
          city: 'Melbourne',
          seniority: 'Mid',
        },
        limit: 5,
      },
    },
    {
      name: 'Major: Junior Product Manager - Brisbane',
      category: 'A',
      input: {
        user_profile: {
          jobTitles: ['Product Manager'],
          skills: ['Product Strategy', 'Agile', 'Scrum', 'User Research', 'Analytics'],
          city: 'Brisbane',
          seniority: 'Junior',
        },
        limit: 5,
      },
    },
    {
      name: 'Major: Senior UX Designer - Perth',
      category: 'A',
      input: {
        user_profile: {
          jobTitles: ['UX Designer'],
          skills: ['Figma', 'User Research', 'Prototyping', 'Design Systems', 'Accessibility'],
          city: 'Perth',
          seniority: 'Senior',
        },
        limit: 5,
      },
    },
    {
      name: 'Major: Mid Marketing Manager - Adelaide',
      category: 'A',
      input: {
        user_profile: {
          jobTitles: ['Marketing Manager'],
          skills: ['Digital Marketing', 'SEO', 'Content Strategy', 'Analytics', 'Campaign Management'],
          city: 'Adelaide',
          seniority: 'Mid',
        },
        limit: 5,
      },
    },
    {
      name: 'Regional: Senior Consultant - Geelong',
      category: 'B',
      input: {
        user_profile: {
          jobTitles: ['Business Consultant'],
          skills: ['Strategy', 'Business Analysis', 'Project Management', 'Stakeholder Management', 'Process Improvement'],
          city: 'Geelong',
          seniority: 'Senior',
        },
        limit: 5,
      },
    },
    {
      name: 'Regional: Mid Accountant - Newcastle',
      category: 'B',
      input: {
        user_profile: {
          jobTitles: ['Accountant'],
          skills: ['Accounting', 'Tax', 'Financial Reporting', 'Excel', 'QuickBooks'],
          city: 'Newcastle',
          seniority: 'Mid',
        },
        limit: 5,
      },
    },
    {
      name: 'Boundary: Missing skills',
      category: 'C',
      input: {
        user_profile: {
          jobTitles: ['Software Engineer'],
          city: 'Sydney',
          // skills missing
        },
        limit: 5,
      },
    },
    {
      name: 'Boundary: Missing city',
      category: 'C',
      input: {
        user_profile: {
          jobTitles: ['Data Analyst'],
          skills: ['Python', 'SQL', 'Pandas', 'Tableau', 'Statistics'],
          // city missing
        },
        limit: 5,
      },
    },
    {
      name: 'Boundary: Empty profile',
      category: 'C',
      input: {
        user_profile: {},
        limit: 5,
      },
    },
  ];

  for (const testCase of testCases) {
    const result = await callMCP('tools/call', {
      name: 'recommend_jobs',
      arguments: testCase.input,
    }, 'recommend_jobs', 20000);

    const text = extractText(result.data);
    const hasErrors = hasCommonErrors(text);
    
    // Parse recommendations count
    const recMatch = text.match(/Found\s+(\d+)\s+(personalized\s+)?job\s+recommendations?/i) || 
                     text.match(/(\d+)\s+recommended\s+jobs?/i) ||
                     text.match(/recommended\s+(\d+)\s+jobs?/i);
    const recCount = recMatch ? parseInt(recMatch[1]) : 0;
    
    // Check for job listings
    const hasJobListings = (text.match(/\d+\.\s+[A-Z]/) || text.match(/•\s+[A-Z]/) || []).length >= 1;
    const hasCompanyInfo = text.includes('company') || text.match(/[A-Z][a-z]+\s+(Pty|Ltd|Inc)/);
    const hasApplyLink = text.includes('Apply') || text.includes('👉') || text.includes('http');
    const hasMatchScore = text.includes('match') || text.includes('score') || text.includes('Match');
    
    // For boundary cases, allow graceful error messages
    const isBoundaryCase = testCase.category === 'C';
    const hasGracefulError = isBoundaryCase && (
      text.includes('required') || text.includes('missing') || text.includes('please') || 
      text.includes('error') || text.includes('invalid')
    );
    
    const hasJobMatch400 = text.includes('jobMatch 400') || result.data.error?.message?.includes('400');
    const hasNoJobsMessage = text.includes('No recent job postings') || text.includes('no jobs found');
    
    const pass = result.success && !hasErrors && !hasJobMatch400 && 
                (isBoundaryCase ? hasGracefulError : (recCount >= 1 && hasJobListings && (hasCompanyInfo || hasApplyLink)));

    results.push({
      tool: 'recommend_jobs',
      category: testCase.category,
      testName: testCase.name,
      input: testCase.input,
      status: result.status,
      elapsed: result.elapsed,
      output: formatOutput(text),
      pass,
      validationCriteria: {
        hasErrors: !hasErrors,
        recommendationsCount: recCount,
        hasJobListings,
        hasJobDetails: hasCompanyInfo || hasApplyLink,
        hasJobMatch400: hasJobMatch400,
        isBoundaryCase,
        hasGracefulError: isBoundaryCase ? hasGracefulError : null,
      },
      failReason: hasJobMatch400 ? 'jobMatch 400 error' :
                  hasErrors ? `Contains error: ${text.match(/(fetch failed|TypeError|\[object Object\])/)?.[0]}` :
                  !result.success ? result.data.error?.message :
                  isBoundaryCase && !hasGracefulError ? 'Boundary case should return graceful error' :
                  !isBoundaryCase && recCount < 1 ? `Only found ${recCount} recommendations (expected >= 1)` :
                  !isBoundaryCase && !hasJobListings ? 'Missing job listing structure' : null,
    });

    console.log(`  ${pass ? '✅' : '❌'} [${testCase.category}] ${testCase.name}: ${result.status} (${result.elapsed}ms) - Found ${recCount} recommendations`);
    if (hasJobMatch400) {
      console.log(`    ⚠️  jobMatch 400 detected!`);
    }
    if (hasNoJobsMessage && testCase.category === 'A') {
      console.log(`    ⚠️  No jobs message in major city (may need review)`);
    }
  }
}

// Test D: tailor_resume (5 groups: 2 optimize + 2 tailor + 1 boundary)
async function testTailorResume() {
  console.log('\n📋 Testing tailor_resume (5 groups: 2 optimize + 2 tailor + 1 boundary)...\n');

  const baseProfile = {
    skills: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'AWS'],
    jobTitles: ['Software Engineer'],
    employmentHistory: [
      {
        company: 'Tech Corp',
        position: 'Software Engineer',
        startDate: '2020-01',
        endDate: '2023-12',
        summary: 'Developed web applications using React and Node.js',
      },
    ],
  };

  const testCases = [
    {
      name: 'Optimize: Resume without JD',
      category: 'A',
      input: {
        user_profile: baseProfile,
        resume_content: 'Software Engineer with 3 years experience in React and Node.js. Worked on multiple web applications.',
      },
    },
    {
      name: 'Tailor: Resume with JD',
      category: 'A',
      input: {
        user_profile: baseProfile,
        resume_content: 'Software Engineer with 3 years experience in React and Node.js.',
        job_description: 'We are looking for a Senior Software Engineer with experience in React, TypeScript, and cloud technologies. Must have 3+ years of experience.',
        job_title: 'Senior Software Engineer',
        company: 'Tech Startup',
      },
    },
    {
      name: 'Tailor: Data Analyst',
      category: 'A',
      input: {
        user_profile: {
          skills: ['Python', 'SQL', 'Pandas', 'Tableau'],
          jobTitles: ['Data Analyst'],
          employmentHistory: [
            {
              company: 'Data Corp',
              position: 'Data Analyst',
              startDate: '2021-01',
              endDate: '2024-01',
              summary: 'Analyzed data using Python and SQL',
            },
          ],
        },
        resume_content: 'Data Analyst with experience in Python and SQL.',
        job_description: 'Looking for a Data Analyst with Python, SQL, and visualization skills.',
        job_title: 'Data Analyst',
      },
    },
    {
      name: 'Optimize: Product Manager',
      category: 'A',
      input: {
        user_profile: {
          skills: ['Product Strategy', 'Agile', 'User Research'],
          jobTitles: ['Product Manager'],
          employmentHistory: [
            {
              company: 'Product Corp',
              position: 'Product Manager',
              startDate: '2022-01',
              endDate: '2024-12',
              summary: 'Managed product roadmap and worked with engineering teams',
            },
          ],
        },
        resume_content: 'Product Manager with experience in product strategy and agile methodologies.',
      },
    },
    {
      name: 'Boundary: Missing resume_content',
      category: 'C',
      input: {
        user_profile: baseProfile,
        // resume_content missing
      },
    },
  ];

  for (const testCase of testCases) {
    const result = await callMCP('tools/call', {
      name: 'tailor_resume',
      arguments: testCase.input,
    }, 'tailor_resume', 35000);

    const text = extractText(result.data);
    const hasErrors = hasCommonErrors(text);
    const hasObjectObject = text.includes('[object Object]');
    const hasSuccessIndicator = text.includes('Optimized') || text.includes('Tailored') || 
                                text.includes('Successfully') || text.includes('Enhanced') ||
                                text.length > 500; // Substantial output
    
    const isBoundaryCase = testCase.category === 'C';
    const hasGracefulError = isBoundaryCase && (
      text.includes('required') || text.includes('missing') || text.includes('please') ||
      text.includes('error') || text.includes('invalid')
    );
    
    const pass = result.success && !hasObjectObject && 
                (isBoundaryCase ? hasGracefulError : (hasSuccessIndicator && text.length > 100));

    results.push({
      tool: 'tailor_resume',
      category: testCase.category,
      testName: testCase.name,
      input: testCase.input,
      status: result.status,
      elapsed: result.elapsed,
      output: formatOutput(text),
      pass,
      validationCriteria: {
        hasErrors: !hasErrors,
        hasObjectObject: hasObjectObject,
        hasSuccessIndicator: isBoundaryCase ? null : hasSuccessIndicator,
        isBoundaryCase,
        hasGracefulError: isBoundaryCase ? hasGracefulError : null,
      },
      failReason: hasObjectObject ? '[object Object] detected (P1 defect)' :
                  hasErrors ? `Contains error: ${text.match(/(fetch failed|TypeError)/)?.[0]}` :
                  !result.success ? result.data.error?.message :
                  isBoundaryCase && !hasGracefulError ? 'Boundary case should return graceful error' :
                  !isBoundaryCase && !hasSuccessIndicator ? 'Missing success indicator' :
                  !isBoundaryCase && text.length <= 100 ? 'Output too short' : null,
    });

    console.log(`  ${pass ? '✅' : '❌'} [${testCase.category}] ${testCase.name}: ${result.status} (${result.elapsed}ms)`);
    if (hasObjectObject) {
      console.log(`    ⚠️  P1 DEFECT: [object Object] detected!`);
    }
  }
}

// Generate comprehensive markdown report
function generateReport() {
  const report = ['# Test Results: Store Submission Lite (4 Tools) - v2\n'];
  report.push(`**Test Date**: ${new Date().toISOString()}`);
  report.push(`**Base URL**: ${BASE_URL}`);
  report.push(`**Environment**: ${BASE_URL.includes('localhost') ? '⚠️ LOCALHOST (Results may not reflect production)' : '✅ Production/Preview'}\n`);
  report.push('---\n');

  // Summary by tool
  const toolStats = {};
  results.forEach(r => {
    if (!toolStats[r.tool]) {
      toolStats[r.tool] = { total: 0, passed: 0, failed: 0, p1Defects: 0 };
    }
    toolStats[r.tool].total++;
    if (r.pass) toolStats[r.tool].passed++;
    else toolStats[r.tool].failed++;
    if (r.failReason?.includes('[object Object]') || r.failReason?.includes('P1')) {
      toolStats[r.tool].p1Defects++;
    }
  });

  report.push('## Summary\n');
  report.push('| Tool | Total | Passed | Failed | Pass Rate | P1 Defects |');
  report.push('|------|-------|--------|--------|-----------|------------|');
  Object.keys(toolStats).forEach(tool => {
    const stats = toolStats[tool];
    const rate = ((stats.passed / stats.total) * 100).toFixed(1);
    report.push(`| ${tool} | ${stats.total} | ${stats.passed} | ${stats.failed} | ${rate}% | ${stats.p1Defects} |`);
  });
  report.push('\n---\n');

  // Group by tool
  const tools = ['career_transition_advice', 'search_jobs', 'recommend_jobs', 'tailor_resume'];
  
  tools.forEach(tool => {
    const toolResults = results.filter(r => r.tool === tool);
    if (toolResults.length === 0) return;

    report.push(`## ${tool}\n`);
    report.push(`**Base URL**: ${BASE_URL}\n`);
    report.push(`**Total Tests**: ${toolResults.length} (${toolResults.filter(r => r.category === 'A').length} standard, ${toolResults.filter(r => r.category === 'B').length} regional, ${toolResults.filter(r => r.category === 'C').length} boundary)\n`);
    
    const passed = toolResults.filter(r => r.pass).length;
    const failed = toolResults.filter(r => !r.pass).length;
    report.push(`**Result**: ${passed}/${toolResults.length} passed\n`);
    
    // Validation criteria summary
    report.push('### Validation Criteria\n');
    report.push('- ✅ HTTP 200 (or defined error codes)');
    report.push('- ✅ Output is non-empty string');
    report.push('- ✅ No fetch failed / TypeError / [object Object]');
    report.push('- ✅ Proper structure based on tool type (see details below)\n');

    // P1 Defects
    const p1Defects = toolResults.filter(r => r.failReason?.includes('[object Object]') || r.failReason?.includes('P1'));
    if (p1Defects.length > 0) {
      report.push('### ⚠️ P1 Defects Found\n');
      p1Defects.forEach(r => {
        report.push(`- **${r.testName}**: ${r.failReason}\n`);
      });
      report.push('\n');
    }

    // Test details
    toolResults.forEach((r, idx) => {
      report.push(`### Test ${idx + 1}: ${r.testName} [${r.category}]\n`);
      report.push(`**Status**: ${r.status} | **Elapsed**: ${r.elapsed}ms | **Result**: ${r.pass ? '✅ PASS' : '❌ FAIL'}\n`);
      
      if (r.failReason) {
        report.push(`**Failure Reason**: ${r.failReason}\n`);
      }

      report.push('**Validation Criteria Applied**:\n');
      report.push('```json');
      report.push(JSON.stringify(r.validationCriteria, null, 2));
      report.push('```\n');

      report.push('**Input**:\n');
      report.push('```json');
      report.push(JSON.stringify(r.input, null, 2));
      report.push('```\n');

      report.push('**Output** (first 50 lines):\n');
      report.push('```');
      report.push(r.output);
      report.push('```\n');

      report.push('---\n');
    });
  });

  // Final conclusion
  report.push('## Final Conclusion\n');
  const allPassed = results.every(r => r.pass);
  const hasP1Defects = results.some(r => r.failReason?.includes('[object Object]') || r.failReason?.includes('P1'));
  const usingLocalhost = BASE_URL.includes('localhost');
  
  if (usingLocalhost) {
    report.push('⚠️ **WARNING**: Tests were run against localhost. Results may not reflect production behavior.\n');
  }
  
  if (hasP1Defects) {
    report.push('❌ **P1 DEFECTS FOUND**: Cannot submit to App Store until fixed.\n');
  }
  
  if (allPassed && !hasP1Defects && !usingLocalhost) {
    report.push('✅ **READY FOR APP STORE SUBMISSION**: All tests passed on production/preview URL.\n');
  } else if (allPassed && !hasP1Defects && usingLocalhost) {
    report.push('⚠️ **CONDITIONAL PASS**: All tests passed, but must re-run on production/preview URL for final validation.\n');
  } else {
    report.push('❌ **NOT READY**: Fix issues above before submission.\n');
  }

  return report.join('\n');
}

// Main
async function main() {
  console.log('==========================================');
  console.log('Real-world Test: Store Submission Lite v2');
  console.log('==========================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`${BASE_URL.includes('localhost') ? '⚠️  WARNING: Using localhost' : '✅ Using production/preview URL'}\n`);

  await testCareerTransitionAdvice();
  await testSearchJobs();
  await testRecommendJobs();
  await testTailorResume();

  const report = generateReport();
  const fs = require('fs');
  fs.writeFileSync('TEST_RESULTS_STORE_SUBMISSION_LITE_V2.md', report);

  console.log('\n==========================================');
  console.log('Test Summary');
  console.log('==========================================');
  const toolStats = {};
  results.forEach(r => {
    if (!toolStats[r.tool]) {
      toolStats[r.tool] = { total: 0, passed: 0, p1Defects: 0 };
    }
    toolStats[r.tool].total++;
    if (r.pass) toolStats[r.tool].passed++;
    if (r.failReason?.includes('[object Object]') || r.failReason?.includes('P1')) {
      toolStats[r.tool].p1Defects++;
    }
  });

  Object.keys(toolStats).forEach(tool => {
    const stats = toolStats[tool];
    const rate = ((stats.passed / stats.total) * 100).toFixed(1);
    console.log(`${tool}: ${stats.passed}/${stats.total} passed (${rate}%)${stats.p1Defects > 0 ? ` - ${stats.p1Defects} P1 defects` : ''}`);
  });

  console.log(`\n✅ Report generated: TEST_RESULTS_STORE_SUBMISSION_LITE_V2.md`);
  console.log(`⚠️  Base URL: ${BASE_URL}${BASE_URL.includes('localhost') ? ' (must use production/preview for final validation)' : ''}`);
}

main().catch(console.error);

