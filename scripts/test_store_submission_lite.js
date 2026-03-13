#!/usr/bin/env node

/**
 * Real-world test script for /api/mcp-lite endpoint
 * Tests 4 tools with varied, realistic inputs
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3002';
const MCP_TOKEN = process.env.MCP_SHARED_SECRET || '';

if (!MCP_TOKEN) {
  console.error('❌ MCP_SHARED_SECRET not set');
  process.exit(1);
}

const results = [];

// Helper: Make MCP call with timeout
async function callMCP(method, params, toolName, timeoutMs = 20000) {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
    const data = await response.json();

    return {
      status: response.status,
      elapsed,
      data,
      success: response.ok && !data.error,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    return {
      status: 0,
      elapsed,
      data: { error: { message: error.name === 'AbortError' ? `Timeout after ${timeoutMs}ms` : error.message } },
      success: false,
    };
  }
}

// Helper: Format output for markdown
function formatOutput(data, maxLines = 50) {
  const str = JSON.stringify(data, null, 2);
  const lines = str.split('\n');
  if (lines.length > maxLines) {
    return lines.slice(0, maxLines).join('\n') + '\n... (truncated)';
  }
  return str;
}

// Test A: career_transition_advice (5 groups)
async function testCareerTransitionAdvice() {
  console.log('\n📋 Testing career_transition_advice (5 groups)...\n');

  const testCases = [
    {
      name: 'Software Engineer → Product Manager',
      input: {
        current_job: 'Software Engineer',
        experience_years: 3,
        skills: ['JavaScript', 'React', 'Node.js', 'Agile', 'Scrum'],
        location: 'Sydney',
      },
    },
    {
      name: 'Data Analyst → Data Scientist',
      input: {
        current_job: 'Data Analyst',
        experience_years: 2,
        skills: ['Python', 'SQL', 'Excel', 'Tableau', 'Statistics'],
        industry: 'Finance',
      },
    },
    {
      name: 'Marketing Coordinator → Marketing Manager',
      input: {
        current_job: 'Marketing Coordinator',
        experience_years: 4,
        skills: ['Digital Marketing', 'SEO', 'Content Creation', 'Analytics', 'Campaign Management'],
        location: 'Melbourne',
      },
    },
    {
      name: 'Accountant → Financial Advisor',
      input: {
        current_job: 'Accountant',
        experience_years: 5,
        skills: ['Accounting', 'Tax', 'Financial Reporting', 'Excel', 'QuickBooks'],
        industry: 'Professional Services',
      },
    },
    {
      name: 'UX Designer → Product Designer',
      input: {
        current_job: 'UX Designer',
        experience_years: 2,
        skills: ['Figma', 'User Research', 'Wireframing', 'Prototyping', 'Design Systems'],
        location: 'Brisbane',
      },
    },
  ];

  for (const testCase of testCases) {
    const result = await callMCP('tools/call', {
      name: 'career_transition_advice',
      arguments: testCase.input,
    }, 'career_transition_advice');

    const output = result.data.result?.content?.[0]?.text || result.data.result?.content?.[0]?.data || result.data;
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
    const hasRecommendedRoles = outputStr && (
      outputStr.includes('recommended') ||
      outputStr.includes('candidates') ||
      outputStr.includes('transition') ||
      outputStr.includes('career')
    );
    const hasReasoning = outputStr && (
      outputStr.includes('reason') ||
      outputStr.includes('because') ||
      outputStr.includes('why')
    );
    const hasFailed = outputStr && outputStr.includes('Failed to get career transition advice');

    results.push({
      tool: 'career_transition_advice',
      testName: testCase.name,
      input: testCase.input,
      status: result.status,
      elapsed: result.elapsed,
      output: formatOutput(output),
      pass: result.success && !hasFailed && hasRecommendedRoles && hasReasoning,
      failReason: hasFailed ? outputStr :
                  !result.success ? result.data.error?.message : 
                  (!hasRecommendedRoles || !hasReasoning) ? 'Missing required fields (recommended_roles/reasoning)' : null,
    });

    console.log(`  ${result.success ? '✅' : '❌'} ${testCase.name}: ${result.status} (${result.elapsed}ms)`);
  }
}

// Test B: search_jobs (5 groups)
async function testSearchJobs() {
  console.log('\n📋 Testing search_jobs (5 groups)...\n');

  const testCases = [
    { job_title: 'Software Engineer', city: 'Sydney' },
    { job_title: 'Data Analyst', city: 'Melbourne' },
    { job_title: 'Product Manager', city: 'Brisbane' },
    { job_title: 'UX Designer', city: 'Perth' },
    { job_title: 'Consultant', city: 'Geraldton' },
  ];

  for (const testCase of testCases) {
    const result = await callMCP('tools/call', {
      name: 'search_jobs',
      arguments: {
        job_title: testCase.job_title,
        city: testCase.city,
        page_size: 5,
      },
    }, 'search_jobs');

    const output = result.data.result?.content?.[0]?.text || result.data.result?.content?.[0]?.data || result.data;
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
    // Check if output contains job listings (text format)
    const jobCountMatch = outputStr.match(/Found (\d+) jobs?/i);
    const jobCount = jobCountMatch ? parseInt(jobCountMatch[1]) : 0;
    const hasJobs = jobCount >= 3;
    const hasJobDetails = outputStr.includes('Job Highlights') || outputStr.includes('Apply on') || outputStr.includes('👉');

    results.push({
      tool: 'search_jobs',
      testName: `${testCase.job_title} in ${testCase.city}`,
      input: testCase,
      status: result.status,
      elapsed: result.elapsed,
      output: formatOutput(output),
      pass: result.success && hasJobs && hasJobDetails,
      failReason: !result.success ? result.data.error?.message :
                  !hasJobs ? `Only found ${jobCount} jobs (expected >= 3)` :
                  !hasJobDetails ? 'Missing job details (Job Highlights/Apply links)' : null,
    });

    console.log(`  ${result.success && hasJobs ? '✅' : '❌'} ${testCase.job_title} in ${testCase.city}: ${result.status} (${result.elapsed}ms) - Found ${jobCount} jobs`);
  }
}

// Test C: recommend_jobs (10 groups - CRITICAL)
async function testRecommendJobs() {
  console.log('\n📋 Testing recommend_jobs (10 groups - CRITICAL)...\n');

  const testCases = [
    {
      name: 'Senior Software Engineer - Sydney',
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
      name: 'Mid Data Analyst - Melbourne',
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
      name: 'Junior Product Manager - Brisbane',
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
      name: 'Senior UX Designer - Perth',
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
      name: 'Mid Marketing Manager - Adelaide',
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
      name: 'Senior Consultant - Geelong (Regional)',
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
      name: 'Mid Accountant - Newcastle (Regional)',
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
      name: 'Junior Developer - Sydney',
      input: {
        user_profile: {
          jobTitles: ['Junior Developer'],
          skills: ['JavaScript', 'HTML', 'CSS', 'React', 'Git'],
          city: 'Sydney',
          seniority: 'Junior',
        },
        limit: 5,
      },
    },
    {
      name: 'Mid Business Analyst - Melbourne',
      input: {
        user_profile: {
          jobTitles: ['Business Analyst'],
          skills: ['Requirements Analysis', 'Process Mapping', 'Stakeholder Management', 'SQL', 'Visio'],
          city: 'Melbourne',
          seniority: 'Mid',
        },
        limit: 5,
      },
    },
    {
      name: 'Senior Data Scientist - Sydney',
      input: {
        user_profile: {
          jobTitles: ['Data Scientist'],
          skills: ['Python', 'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Statistics', 'Data Visualization'],
          city: 'Sydney',
          seniority: 'Senior',
        },
        limit: 5,
      },
    },
  ];

  for (const testCase of testCases) {
    const result = await callMCP('tools/call', {
      name: 'recommend_jobs',
      arguments: testCase.input,
    }, 'recommend_jobs');

    const output = result.data.result?.content?.[0]?.text || result.data.result?.content?.[0]?.data || result.data;
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
    // Check if output contains job listings (text format)
    const jobCountMatch = outputStr.match(/Found (\d+) jobs?/i) || outputStr.match(/(\d+) jobs? found/i);
    const jobCount = jobCountMatch ? parseInt(jobCountMatch[1]) : 0;
    const hasJobs = jobCount >= 3;
    const hasJobDetails = outputStr.includes('Job Highlights') || outputStr.includes('Apply on') || outputStr.includes('👉') || outputStr.includes('match_score');
    const hasMatchScore = outputStr.includes('match_score') || outputStr.includes('score') || outputStr.includes('Match');
    const hasJobMatch400 = result.data.error?.message?.includes('jobMatch') || result.data.error?.message?.includes('400') || outputStr.includes('jobMatch 400');

    results.push({
      tool: 'recommend_jobs',
      testName: testCase.name,
      input: testCase.input,
      status: result.status,
      elapsed: result.elapsed,
      output: formatOutput(output),
      pass: result.success && hasJobs && hasJobDetails && !hasJobMatch400 && result.elapsed < 15000,
      failReason: hasJobMatch400 ? 'jobMatch 400 error' :
                  !result.success ? result.data.error?.message :
                  !hasJobs ? `Only found ${jobCount} jobs (expected >= 3)` :
                  !hasJobDetails ? 'Missing job details' :
                  result.elapsed >= 15000 ? `Timeout: ${result.elapsed}ms (expected < 15000ms)` : null,
    });

    console.log(`  ${result.success && hasJobs && !hasJobMatch400 ? '✅' : '❌'} ${testCase.name}: ${result.status} (${result.elapsed}ms) - Found ${jobCount} jobs`);
    if (hasJobMatch400) {
      console.log(`    ⚠️  jobMatch 400 detected!`);
    }
  }
}

// Test D: tailor_resume (5 groups)
async function testTailorResume() {
  console.log('\n📋 Testing tailor_resume (5 groups)...\n');

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
      name: 'Optimize Resume (no JD)',
      input: {
        user_profile: baseProfile,
        resume_content: 'Software Engineer with 3 years experience in React and Node.js. Worked on multiple web applications.',
      },
    },
    {
      name: 'Tailor Resume (with JD)',
      input: {
        user_profile: baseProfile,
        resume_content: 'Software Engineer with 3 years experience in React and Node.js.',
        job_description: 'We are looking for a Senior Software Engineer with experience in React, TypeScript, and cloud technologies. Must have 3+ years of experience.',
        job_title: 'Senior Software Engineer',
        company: 'Tech Startup',
      },
    },
    {
      name: 'Tailor Resume (Data Analyst)',
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
      name: 'Optimize Resume (Product Manager)',
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
      name: 'Tailor Resume (UX Designer)',
      input: {
        user_profile: {
          skills: ['Figma', 'User Research', 'Prototyping'],
          jobTitles: ['UX Designer'],
          employmentHistory: [
            {
              company: 'Design Corp',
              position: 'UX Designer',
              startDate: '2021-06',
              endDate: '2024-06',
              summary: 'Designed user interfaces and conducted user research',
            },
          ],
        },
        resume_content: 'UX Designer with experience in Figma and user research.',
        job_description: 'Seeking a UX Designer with Figma, prototyping, and user research experience.',
        job_title: 'UX Designer',
      },
    },
  ];

  for (const testCase of testCases) {
    const result = await callMCP('tools/call', {
      name: 'tailor_resume',
      arguments: testCase.input,
    }, 'tailor_resume');

    const output = result.data.result?.content?.[0]?.text || result.data.result?.content?.[0]?.data || result.data;
    const hasOutput = output && (typeof output === 'string' || (typeof output === 'object' && Object.keys(output).length > 0));
    const isTimeout = result.elapsed >= 30000;

    results.push({
      tool: 'tailor_resume',
      testName: testCase.name,
      input: testCase.input,
      status: result.status,
      elapsed: result.elapsed,
      output: formatOutput(output),
      pass: result.success && hasOutput && !isTimeout,
      failReason: isTimeout ? `Timeout: ${result.elapsed}ms (expected < 30000ms)` :
                  !result.success ? result.data.error?.message :
                  !hasOutput ? 'No output returned' : null,
    });

    console.log(`  ${result.success && hasOutput && !isTimeout ? '✅' : '❌'} ${testCase.name}: ${result.status} (${result.elapsed}ms)`);
  }
}

// Generate markdown report
function generateReport() {
  const report = ['# Test Results: Store Submission Lite (4 Tools)\n'];
  report.push(`**Test Date**: ${new Date().toISOString()}`);
  report.push(`**Endpoint**: ${BASE_URL}/api/mcp-lite\n`);
  report.push('---\n');

  const toolStats = {};
  results.forEach(r => {
    if (!toolStats[r.tool]) {
      toolStats[r.tool] = { total: 0, passed: 0, failed: 0 };
    }
    toolStats[r.tool].total++;
    if (r.pass) toolStats[r.tool].passed++;
    else toolStats[r.tool].failed++;
  });

  report.push('## Summary\n');
  report.push('| Tool | Total | Passed | Failed | Pass Rate |');
  report.push('|------|-------|--------|--------|-----------|');
  Object.keys(toolStats).forEach(tool => {
    const stats = toolStats[tool];
    const rate = ((stats.passed / stats.total) * 100).toFixed(1);
    report.push(`| ${tool} | ${stats.total} | ${stats.passed} | ${stats.failed} | ${rate}% |`);
  });
  report.push('\n---\n');

  results.forEach((r, idx) => {
    report.push(`## Test ${idx + 1}: ${r.tool} - ${r.testName}\n`);
    report.push(`**Status**: ${r.status} | **Elapsed**: ${r.elapsed}ms | **Result**: ${r.pass ? '✅ PASS' : '❌ FAIL'}\n`);
    
    if (r.failReason) {
      report.push(`**Failure Reason**: ${r.failReason}\n`);
    }

    report.push('### Input\n');
    report.push('```json');
    report.push(JSON.stringify(r.input, null, 2));
    report.push('```\n');

    report.push('### Output\n');
    report.push('```json');
    report.push(r.output);
    report.push('```\n');

    report.push('---\n');
  });

  return report.join('\n');
}

// Main
async function main() {
  console.log('==========================================');
  console.log('Real-world Test: Store Submission Lite');
  console.log('==========================================\n');

  await testCareerTransitionAdvice();
  await testSearchJobs();
  await testRecommendJobs();
  await testTailorResume();

  const report = generateReport();
  const fs = require('fs');
  fs.writeFileSync('TEST_RESULTS_STORE_SUBMISSION_LITE.md', report);

  console.log('\n==========================================');
  console.log('Test Summary');
  console.log('==========================================');
  const toolStats = {};
  results.forEach(r => {
    if (!toolStats[r.tool]) {
      toolStats[r.tool] = { total: 0, passed: 0 };
    }
    toolStats[r.tool].total++;
    if (r.pass) toolStats[r.tool].passed++;
  });

  Object.keys(toolStats).forEach(tool => {
    const stats = toolStats[tool];
    const rate = ((stats.passed / stats.total) * 100).toFixed(1);
    console.log(`${tool}: ${stats.passed}/${stats.total} passed (${rate}%)`);
  });

  console.log('\n✅ Report generated: TEST_RESULTS_STORE_SUBMISSION_LITE.md');
}

main().catch(console.error);

