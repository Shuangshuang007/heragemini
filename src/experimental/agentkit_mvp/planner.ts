// ============================================
// AgentKit Planner - Pure Rule-Based Planning
// ============================================
// 纯规则规划器，不得访问外部API或业务服务

import { Intent, Plan, AgentStep } from './types';

export async function plan(userId: string, intent: Intent): Promise<Plan> {
  const steps: AgentStep[] = [];
  let i = 1;

  // 基于intent的primary类型生成计划步骤
  if (intent.primary === 'find_jobs') {
    if (intent.readiness === 'needs_resume') {
      steps.push({ 
        id: `s${i++}`, 
        tool: 'parseResume', 
        args: { 
          autoParse: true,
          extractSkills: true,
          extractExperience: true 
        }, 
        priority: 1 
      });
      steps.push({ 
        id: `s${i++}`, 
        tool: 'updateProfile', 
        args: { 
          source: 'resume_parsed',
          overwrite: false 
        }, 
        priority: 2 
      });
    }
    
    steps.push({ 
      id: `s${i++}`, 
      tool: 'searchJobs', 
      args: { 
        limit: 20,
        includeRemote: true,
        matchSkills: true 
      }, 
      priority: i 
    });
    
    steps.push({ 
      id: `s${i++}`, 
      tool: 'rankRecommend', 
      args: { 
        algorithm: 'skill_match',
        weightSkills: 0.6,
        weightExperience: 0.4 
      }, 
      priority: i + 1 
    });
  }

  // improve_profile intent
  else if (intent.primary === 'improve_profile') {
    if (intent.readiness === 'needs_resume') {
      steps.push({ 
        id: `s${i++}`, 
        tool: 'parseResume', 
        args: { 
          autoParse: true,
          suggestImprovements: true 
        }, 
        priority: 1 
      });
    }
    
    steps.push({ 
      id: `s${i++}`, 
      tool: 'updateProfile', 
      args: { 
        mode: 'enhance',
        focusAreas: intent.blockers 
      }, 
      priority: i 
    });
  }

  // apply_job intent
  else if (intent.primary === 'apply_job') {
    steps.push({ 
      id: `s${i++}`, 
      tool: 'searchJobs', 
      args: { 
        limit: 10,
        matchingOnly: true 
      }, 
      priority: 1 
    });
    
    steps.push({ 
      id: `s${i++}`, 
      tool: 'rankRecommend', 
      args: { 
        algorithm: 'application_ready',
        filterUnqualified: true 
      }, 
      priority: 2 
    });
  }

  return {
    id: `pln_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    intent,
    steps,
    createdAt: new Date().toISOString(),
    version: 'v1.0.0',
  };
}
