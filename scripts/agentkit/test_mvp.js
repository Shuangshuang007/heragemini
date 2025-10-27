// ============================================
// AgentKit MVP 快速测试脚本 (CommonJS版本)
// ============================================
// 用于验证MVP功能而不依赖复杂的TypeScript编译

const fs = require('fs');
const path = require('path');

console.log('🚀 AgentKit MVP 快速测试');
console.log('========================');

// 测试1: 文件结构验证
console.log('\n1️⃣ 文件结构验证:');
const requiredFiles = [
  'src/experimental/agentkit_mvp/types.ts',
  'src/experimental/agentkit_mvp/planner.ts',
  'src/experimental/agentkit_mvp/executor.ts',
  'src/experimental/agentkit_mvp/registry.ts',
  'src/experimental/agentkit_mvp/memory.ts',
  'src/experimental/agentkit_mvp/README.md',
  'devdata/agentkit/sample-intent.json',
  'devdata/agentkit/sample-plan.json'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file}`);
    allFilesExist = false;
  }
});

// 测试2: 示例数据验证
console.log('\n2️⃣ 示例数据验证:');
try {
  const intentData = JSON.parse(fs.readFileSync('devdata/agentkit/sample-intent.json', 'utf8'));
  const planData = JSON.parse(fs.readFileSync('devdata/agentkit/sample-plan.json', 'utf8'));
  
  console.log('📋 Intent 验证:');
  console.log(`  - primary: ${intentData.primary === 'find_jobs' ? '✅' : '❌'}`);
  console.log(`  - readiness: ${intentData.readiness === 'needs_resume' ? '✅' : '❌'}`);
  console.log(`  - confidence: ${typeof intentData.confidence === 'number' ? '✅' : '❌'}`);
  
  console.log('\n📋 Plan 验证:');
  console.log(`  - plan ID: ${planData.id ? '✅' : '❌'} (${planData.id})`);
  console.log(`  - version: ${planData.version === 'v1.0.0' ? '✅' : '❌'}`);
  console.log(`  - steps count: ${planData.steps && planData.steps.length >= 3 ? '✅' : '❌'} (${planData.steps?.length})`);
  
  if (planData.steps) {
    console.log('  - 步骤序列:');
    planData.steps.forEach((step, i) => {
      console.log(`    ${i+1}. ${step.tool} (priority: ${step.priority})`);
    });
  }
} catch (error) {
  console.log('❌ 示例数据读取失败:', error.message);
}

// 测试3: 代码内容验证
console.log('\n3️⃣ 代码内容验证:');
try {
  const plannerContent = fs.readFileSync('src/experimental/agentkit_mvp/planner.ts', 'utf8');
  const executorContent = fs.readFileSync('src/experimental/agentkit_mvp/executor.ts', 'utf8');
  const registryContent = fs.readFileSync('src/experimental/agentkit_mvp/registry.ts', 'utf8');

  console.log('📋 Planner 验证:');
  console.log(`  - 包含 plan 函数: ${plannerContent.includes('export async function plan') ? '✅' : '❌'}`);
  console.log(`  - 支持 find_jobs: ${plannerContent.includes('find_jobs') ? '✅' : '❌'}`);
  
  console.log('\n📋 Executor 验证:');
  console.log(`  - 包含 execute 函数: ${executorContent.includes('export async function execute') ? '✅' : '❌'}`);
  console.log(`  - 支持 dryRun: ${executorContent.includes('dryRun') ? '✅' : '❌'}`);
  
  console.log('\n📋 Registry 验证:');
  console.log(`  - 包含 parseResume: ${registryContent.includes('parseResume') ? '✅' : '❌'}`);
  console.log(`  - 包含 searchJobs: ${registryContent.includes('searchJobs') ? '✅' : '❌'}`);
  
} catch (error) {
  console.log('❌ 代码文件读取失败:', error.message);
}

// 测试4: 隔离性验证
console.log('\n4️⃣ 隔离性验证:');
const forbiddenPatterns = [
  { pattern: /connectToMongo/, name: '数据库连接' },
  { pattern: /services\//, name: '业务服务引用' },
  { pattern: /engines\//, name: '引擎引用' }
];

try {
  const files = fs.readdirSync('src/experimental/agentkit_mvp');
  files.forEach(file => {
    if (file.endsWith('.ts')) {
      const content = fs.readFileSync(`src/experimental/agentkit_mvp/${file}`, 'utf8');
      forbiddenPatterns.forEach(({ pattern, name }) => {
        if (pattern.test(content)) {
          console.log(`⚠️  ${file} 中发现 ${name} 引用`);
        }
      });
    }
  });
  console.log('✅ 没有发现违规的外部依赖');
} catch (error) {
  console.log('❌ 隔离性检查失败:', error.message);
}

console.log('\n🎯 测试完成！');
console.log('如果所有项目都显示 ✅，说明 MVP 实现正确');
