// ============================================
// AgentKit Demo - Planning Only
// ============================================
// 仅演示规划功能，不调用实际API或修改数据

import { plan } from '../../src/experimental/agentkit_mvp/planner';
import type { Intent } from '../../src/experimental/agentkit_mvp/types';

async function demoPlan() {
  console.log('🚀 AgentKit MVP - Planning Demo');
  console.log('================================');
  
  // 测试场景1: 需要简历解析的求职
  const intent1: Intent = {
    primary: 'find_jobs',
    readiness: 'needs_resume',
    blockers: ['resume_missing', 'profile_incomplete'],
    confidence: 0.8,
  };
  
  console.log('\n📋 Scenario 1: Find Jobs (Needs Resume)');
  console.log('Intent:', JSON.stringify(intent1, null, 2));
  
  const plan1 = await plan('demo_user_1', intent1);
  console.log('\n✅ Generated Plan:');
  console.log(JSON.stringify(plan1, null, 2));
  
  // 测试场景2: 完善档案
  const intent2: Intent = {
    primary: 'improve_profile',
    readiness: 'needs_resume',
    blockers: ['skills_outdated', 'experience_gaps'],
    confidence: 0.7,
  };
  
  console.log('\n📋 Scenario 2: Improve Profile');
  console.log('Intent:', JSON.stringify(intent2, null, 2));
  
  const plan2 = await plan('demo_user_2', intent2);
  console.log('\n✅ Generated Plan:');
  console.log(JSON.stringify(plan2, null, 2));
  
  console.log('\n🎯 Demo completed successfully!');
}

// 仅当直接运行时执行，不被import触发
if (require.main === module) {
  demoPlan().catch(console.error);
}
