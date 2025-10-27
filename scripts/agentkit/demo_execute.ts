// ============================================
// AgentKit Demo - Execution Only (Dry Run)
// ============================================
// 基于假数据的dry-run演示，不执行真实业务逻辑

import { execute } from '../../src/experimental/agentkit_mvp/executor';
import type { Plan } from '../../src/experimental/agentkit_mvp/types';
import * as fs from 'node:fs';
import * as path from 'node:path';

async function demoExecute() {
  console.log('🚀 AgentKit MVP - Execution Demo (Dry Run)');
  console.log('==========================================');
  
  try {
    // 读取示例计划
    const samplePlanPath = path.join(__dirname, '../../devdata/agentkit/sample-plan.json');
    const planData = fs.readFileSync(samplePlanPath, 'utf8');
    const plan: Plan = JSON.parse(planData);
    
    console.log('\n📋 Using Sample Plan:');
    console.log(`Plan ID: ${plan.id}`);
    console.log(`User ID: ${plan.userId}`);
    console.log(`Intent: ${plan.intent.primary} (${plan.intent.readiness})`);
    console.log(`Steps: ${plan.steps.length}`);
    
    // Dry-run执行
    console.log('\n🔄 Starting Dry Run Execution...');
    const results = await execute(plan, { dryRun: true });
    
    console.log('\n📊 Execution Results:');
    console.log(`Total Steps: ${results.length}`);
    
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    console.log('\n📝 Detailed Results:');
    results.forEach((result, index) => {
      console.log(`\nStep ${index + 1}: ${result.stepId}`);
      console.log(`  Tool: ${result.tool}`);
      console.log(`  Status: ${result.status}`);
      console.log(`  Latency: ${result.latencyMs}ms`);
      
      if (result.errorMessage) {
        console.log(`  Error: ${result.errorMessage}`);
      }
      
      if (result.outputSnapshot) {
        const output = result.outputSnapshot as any;
        if (output.mock) {
          console.log(`  Output: ${output.result} (mock)`);
        }
      }
    });
    
    console.log('\n🎯 Demo completed successfully!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// 仅当直接运行时执行，不被import触发
if (require.main === module) {
  demoExecute().catch(console.error);
}
