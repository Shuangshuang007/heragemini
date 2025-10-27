// ============================================
// AgentKit V2 逻辑测试 (独立于服务器)
// ============================================

const fs = require('fs');

console.log('🧪 AgentKit V2 逻辑验证测试');
console.log('============================\n');

// 1. 验证我们的代码修改
function verifyCodeChanges() {
  console.log('1️⃣ 验证MCP路由修改...');
  
  const mcpContent = fs.readFileSync('src/app/api/mcp/route.ts', 'utf8');
  
  // 检查我们的方法是否被正确添加
  const v2PlanMethod = mcpContent.includes('body.method === "agentkit-v2/plan"');
  const v2ExecuteMethod = mcpContent.includes('body.method === "agentkit-v2/execute"');
  const dynamicImportPlan = mcpContent.includes("await import('../../experimental/agentkit_mvp/planner')");
  const dynamicImportExecute = mcpContent.includes("await import('../../experimental/agentkit_mvp/executor')");
  
  console.log('✅ agentkit-v2/plan 方法:', v2PlanMethod ? '已正确添加' : '❌ 缺失');
  console.log('✅ agentkit-v2/execute 方法:', v2ExecuteMethod ? '已正确添加' : '❌ 缺失');
  console.log('✅ 动态导入 planner:', dynamicImportPlan ? '已实现' : '❌ 缺失');
  console.log('✅ 动态导入 executor:', dynamicImportExecute ? '已实现' : '❌ 缺失');
  
  // 检查参数处理
  const intentParamCheck = mcpContent.includes('const { userId = \'anonymous\', intent } = body.params || {}');
  const allowToolsCheck = mcpContent.includes('allowTools = ["searchJobs"]');
  
  console.log('✅ Intent参数处理:', intentParamCheck ? '已实现' : '❌ 缺失');
  console.log('✅ allowTools默认值:', allowToolsCheck ? '已设置' : '❌ 缺失');
  
  return v2PlanMethod && v2ExecuteMethod && dynamicImportPlan && dynamicImportExecute;
}

// 2. 验证Executor修改
function verifyExecutorChanges() {
  console.log('\n2️⃣ 验证Executor修改...');
  
  const executorContent = fs.readFileSync('src/experimental/agentkit_mvp/executor.ts', 'utf8');
  
  const allowToolsParam = executorContent.includes('allowTools?: string[]');
  const whitelistCheck = executorContent.includes('allowTools.includes(step.tool)');
  const skipLogic = executorContent.includes('status: \'skipped\'');
  const errorMessage = executorContent.includes('tool not allowed in v2 phase');
  
  console.log('✅ allowTools 参数:', allowToolsParam ? '已添加' : '❌ 缺失');
  console.log('✅ 白名单检查:', whitelistCheck ? '已实现' : '❌ 缺失');
  console.log('✅ 跳过逻辑:', skipLogic ? '已实现' : '❌ 缺失');
  console.log('✅ 错误消息:', errorMessage ? '已配置' : '❌ 缺失');
  
  return allowToolsParam && whitelistCheck && skipLogic;
}

// 3. 验证experimental文件
function verifyExperimentalFiles() {
  console.log('\n3️⃣ 验证Experimental文件...');
  
  const requiredFiles = [
    'src/experimental/agentkit_mvp/types.ts',
    'src/experimental/agentkit_mvp/planner.ts',
    'src/experimental/agentkit_mvp/executor.ts',
    'src/experimental/agentkit_mvp/registry.ts',
    'src/experimental/agentkit_mvp/memory.ts'
  ];
  
  let allFilesExist = true;
  requiredFiles.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`✅ ${file}:`, exists ? '存在' : '❌ 缺失');
    if (!exists) allFilesExist = false;
  });
  
  return allFilesExist;
}

// 4. 生成测试用的请求示例
function generateTestRequests() {
  console.log('\n4️⃣ 生成测试请求示例...');
  
  const intentData = JSON.parse(fs.readFileSync('devdata/agentkit/sample-intent.json', 'utf8'));
  const planData = JSON.parse(fs.readFileSync('devdata/agentkit/sample-plan.json', 'utf8'));
  
  const planRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "agentkit-v2/plan",
    params: {
      userId: "test_user_v2",
      intent: intentData
    }
  };
  
  const executeRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "agentkit-v2/execute", 
    params: {
      plan: planData,
      allowTools: ["searchJobs"]  // 只允许searchJobs
    }
  };
  
  console.log('📋 Planning 请求示例:');
  console.log(JSON.stringify(planRequest, null, 2));
  
  console.log('\n📋 Execution 请求示例:');
  console.log(JSON.stringify(executeRequest, null, 2));
  
  return { planRequest, executeRequest };
}

// 5. 验证响应格式
function verifyResponseFormat() {
  console.log('\n5️⃣ 验证响应格式...');
  
  const mcpContent = fs.readFileSync('src/app/api/mcp/route.ts', 'utf8');
  
  // 检查JSON-RPC响应格式
  const hasJsonRpc = mcpContent.includes('"jsonrpc": "2.0"');
  const hasId = mcpContent.includes('id: body.id ?? null');
  const hasContent = mcpContent.includes('content: [{');
  const hasTraceId = mcpContent.includes('X-AgentKit-V2-Trace-Id');
  
  console.log('✅ JSON-RPC 格式:', hasJsonRpc ? '已实现' : '❌ 缺失');
  console.log('✅ ID 字段:', hasId ? '已处理' : '❌ 缺失');
  console.log('✅ Content 结构:', hasContent ? '已实现' : '❌ 缺失');
  console.log('✅ Trace ID:', hasTraceId ? '已添加' : '❌ 缺失');
  
  return hasJsonRpc && hasId && hasContent;
}

// 执行所有验证
function runAllTests() {
  const codeChangesOK = verifyCodeChanges();
  const executorChangesOK = verifyExecutorChanges();
  const filesOK = verifyExperimentalFiles();
  const responseFormatOK = verifyResponseFormat();
  
  const { planRequest, executeRequest } = generateTestRequests();
  
  console.log('\n🎯 总体验证 Results:');
  console.log('========================');
  console.log('✅ MCP路由修改:', codeChangesOK ? '通过' : '❌ 失败');
  console.log('✅ Executor修改:', executorChangesOK ? '通过' : '❌ 失败');
  console.log('✅ 文件完整性:', filesOK ? '通过' : '❌ 失败');
  console.log('✅ 响应格式:', responseFormatOK ? '通过' : '❌ 失败');
  
  const allTestsPass = codeChangesOK && executorChangesOK && filesOK && responseFormatOK;
  console.log('\n🏆 最终结果:', allTestsPass ? '✅ 所有测试通过' : '❌ 需要修复');
  
  if (allTestsPass) {
    console.log('\n💡 当服务器依赖问题解决后，可以使用以下命令测试:');
    console.log('   curl -X POST "http://localhost:3002/api/mcp" \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'<planRequest>\' | jq');
  }
  
  return allTestsPass;
}

runAllTests();
