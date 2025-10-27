// ============================================
// AgentKit V2 简单测试脚本
// ============================================

console.log('# AgentKit V2 Integration Test Commands');
console.log('===========================================\n');

const baseUrl = 'http://localhost:3000';

// 测试数据
const testIntent = {
  primary: "find_jobs",
  readiness: "needs_resume", 
  blockers: ["resume_missing"],
  confidence: 0.8
};

console.log('## 1. Test agentkit-v2/plan');
console.log('```bash');
console.log(`curl -X POST "${baseUrl}/api/mcp" \\`);
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{"jsonrpc":"2.0","id":1,"method":"agentkit-v2/plan","params":{"userId":"test","intent":');
console.log(JSON.stringify(testIntent));
console.log('}}\' | jq');
console.log('```\n');

console.log('## 预期结果:');
console.log('- 返回包含 plan 对象的响应');
console.log('- plan.steps 应该包含 4 个步骤: parseResume → updateProfile → searchJobs → rankRecommend');
console.log('- plan.version 应该是 "v1.0.0"');
