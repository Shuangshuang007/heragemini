#!/usr/bin/env node

/**
 * Batch test runner - runs tests in smaller batches to avoid timeouts
 */

const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:3002';
const MCP_TOKEN = process.env.MCP_SHARED_SECRET || '';
const BATCH = process.argv[2] || 'all'; // all, career, search, recommend, tailor

if (!MCP_TOKEN) {
  console.error('❌ MCP_SHARED_SECRET not set');
  process.exit(1);
}

// Import the test functions (simplified version)
const { testCareerTransitionAdvice, testSearchJobs, testRecommendJobs, testTailorResume, generateReport } = require('./test_store_submission_lite_v2.js');

async function main() {
  console.log(`Running batch: ${BATCH}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  const results = [];
  
  if (BATCH === 'all' || BATCH === 'career') {
    console.log('=== Testing career_transition_advice ===');
    await testCareerTransitionAdvice();
  }
  
  if (BATCH === 'all' || BATCH === 'search') {
    console.log('=== Testing search_jobs ===');
    await testSearchJobs();
  }
  
  if (BATCH === 'all' || BATCH === 'recommend') {
    console.log('=== Testing recommend_jobs ===');
    await testRecommendJobs();
  }
  
  if (BATCH === 'all' || BATCH === 'tailor') {
    console.log('=== Testing tailor_resume ===');
    await testTailorResume();
  }
  
  console.log('\n✅ Batch complete');
}

main().catch(console.error);







