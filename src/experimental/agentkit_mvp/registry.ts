// ============================================
// AgentKit Tool Registry - Mock Implementation
// ============================================
// 仅签名占位，不得导入业务实现
// 所有工具返回mock数据，不连接真实服务

import type { AgentStep } from './types';

export const ToolRegistry = {
  parseResume: async (_args: Record<string, unknown>) => ({ 
    mock: true, 
    result: 'resume_parsed',
    extractedSkills: ['JavaScript', 'React', 'Node.js'],
    extractedExperience: '5 years software development'
  }),
  
  updateProfile: async (_args: Record<string, unknown>) => ({ 
    mock: true, 
    result: 'profile_updated',
    updatedFields: ['skills', 'experience', 'preferences']
  }),
  
  searchJobs: async (_args: Record<string, unknown>) => ({ 
    mock: true, 
    result: 'jobs_found',
    jobCount: 15,
    jobs: Array.from({ length: 5 }, (_, i) => ({
      id: `job_${i}`,
      title: `Software Engineer ${i}`,
      company: `Company ${i}`,
      location: 'Sydney, NSW'
    }))
  }),
  
  rankRecommend: async (_args: Record<string, unknown>) => ({ 
    mock: true, 
    result: 'jobs_ranked',
    recommendations: Array.from({ length: 3 }, (_, i) => ({
      jobId: `job_${i}`,
      score: 0.9 - (i * 0.1),
      reason: `High match for skill set ${i}`
    }))
  }),
} satisfies Record<string, (args: AgentStep['args']) => Promise<unknown>>;
