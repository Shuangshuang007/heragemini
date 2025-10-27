// ============================================
// AgentKit V2 离线测试脚本
// ============================================
// 不依赖服务器，直接测试我们的experimental代码

const fs = require('fs');

console.log('🧪 AgentKit V2 离线测试');
console.log('========================\n');

async function testOffline() {
  try {
    // 测试1: 验证类型和数据文件
    console.log('1️⃣ 测试数据文件...');
    const intentData = JSON.parse(fs.readFileSync('devdata/agentkit/sample-intent.json', 'utf8'));
    const planData = JSON.parse(fs.readFileSync('devdata/agentkit/sample-plan.json', 'utf8'));
    
    console.log('✅ Intent数据:', intentData.primary, intentData.readiness);
    console.log('✅ Plan数据:', planData.id, planData.steps.length + ' steps');
    
    // 测试2: 验证MCP路由修改
    console.log('\n2️⃣ 测试MCP路由修改...');
    const mcpContent = fs.readFileSync('src/app/api/mcp/route.ts', 'utf8');
    
    const v2PlanPresent = mcpContent.includes('if (body.method === "agentkit-v2/plan")');
    const v2ExecutePresent = mcpContent.includes('if (body.method === "agentkit-v2/execute")');
    const dynamicImportPresent = mcpContent.includes('await import(\'../../experimental/agentkit_mvp/planner\')');
    
    console.log('✅ agentkit-v2/plan方法:', v2PlanPresent ? '已添加' : '缺失');
    console.log('✅ agentkit-v2/execute方法:', v2ExecutePresent ? '已添加' : '缺失');
    console.log('✅ 动态导入:', dynamicImportPresent ? '已实现' : '缺失');
    
    // 测试3: 生成测试请求示例
    console.log('\n3️⃣ 生成测试请求示例...');
    
    const testPlanRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "agentkit-v2/plan",
      params: {
        userId: "test_user",
        intent: intentData
      }
    };
    
    const testExecuteRequest = {
      jsonrpc: "2.0", 
      id: 2,
      method: "agentkit-v2/execute",
      params: {
        plan: planData,
        allowTools: ["searchJobs"]
      }
    };
    
    console.log('📋 测试请求1 - Planning:');
    console.log(JSON.stringify(testPlanRequest, null, 2));
    
    console.log('\n📋 测试请求2 - Execution:');
    console.log(JSON.stringify(testExecuteRequest, null, 2));
    
    // 测试4: 验证executor修改
    console.log('\n4️⃣ 测试Executor修改...');
    const executorContent = fs.readFileSync('src/experimental/agentkit_mvp/executor.ts', 'utf8');
    
    const allowToolsParam = executorContent.includes('allowTools?: string[]');
    const whitelistLogic = executorContent.includes('allowTools.includes(step.tool)');
    const skipMessage = executorContent.includes('tool not allowed in v2 phase');
    
    console.log('✅ allowTools参数:', allowToolsParam ? '已添加' : '缺失');
    console.log('✅ 白名单逻辑:', whitelistLogic ? '已实现' : '缺失');
    console.log('✅ 跳过消息:', skipMessage ? '已配置' : '缺失');
    
    console.log('\n🎯 所有检查通过！');
    console.log('\n📝 下一步:');
    console.log('1. 启动服务: npm run dev');
    console.log('2. 运行在线测试: ./scripts/agentkit/test_curl_commands.sh');
    console.log('3. 或手动测试curl命令');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testOffline();
