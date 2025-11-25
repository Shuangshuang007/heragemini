// ============================================
// AgentKit MCP Tool Executor - Calls existing MCP tools
// ============================================

import { connectToMongoDB, transformMongoDBJobToFrontendFormat } from '../../services/jobDatabaseService';
import { getUserProfile } from '../../services/profileDatabaseService';

const buildLocationConditions = (city?: string) => {
  if (!city) return null;
  // 优化：只使用 locations 字段查询（有索引，查询快）
  // 返回时通过 transformMongoDBJobToFrontendFormat 的 normalizeLocation 函数保持 location 字段给前端
  const regex = { $regex: city, $options: 'i' };
  return {
    locations: regex
  };
};

/**
 * Execute MCP tools from AgentKit context
 */
export class MCPToolExecutor {
  
  /**
   * Execute recommend_jobs tool using existing MCP logic
   */
  async executeRecommendJobs(args: any): Promise<any> {
    try {
      const { 
        user_profile = {}, 
        job_title, 
        city, 
        limit = 10, 
        use_chat_context = true, 
        strict_filters = true 
      } = args;
      
      console.log('[MCPToolExecutor] Executing recommend_jobs with args:', { job_title, city, limit });

      // 信息优先级处理：对话明确信息 > 简历解析信息 > 默认值
      const determineSearchCriteria = () => {
        if (job_title || city) {
          return {
            jobTitle: job_title || null,
            city: city || null,
            source: 'explicit_input',
            usedResumeInference: false
          };
        }
        
        if (user_profile.expectedPosition || user_profile.jobTitles?.[0] || user_profile.city) {
          return {
            jobTitle: user_profile.expectedPosition || user_profile.jobTitles?.[0] || null,
            city: user_profile.city || null,
            source: 'resume_parsed',
            usedResumeInference: true,
            inferredPosition: user_profile.expectedPosition || user_profile.jobTitles?.[0] || null
          };
        }
        
        return {
          jobTitle: null,
          city: 'Melbourne',
          source: 'default',
          usedResumeInference: false
        };
      };
      
      const searchCriteria = determineSearchCriteria();
      
      // 构建用户档案
      const defaultProfile = {
        skills: user_profile.skills && user_profile.skills.length > 0 ? user_profile.skills : ['General Skills', 'Problem Solving', 'Communication'],
        city: searchCriteria.city || 'Melbourne',
        seniority: user_profile.seniority || 'Mid',
        jobTitles: user_profile.jobTitles && user_profile.jobTitles.length > 0 ? user_profile.jobTitles : ['General Professional'],
        openToRelocate: user_profile.openToRelocate || false,
        careerPriorities: user_profile.careerPriorities && user_profile.careerPriorities.length > 0 ? user_profile.careerPriorities : ['Career Growth', 'Work-Life Balance'],
        expectedSalary: user_profile.expectedSalary || 'Medium',
        currentPosition: user_profile.currentPosition || 'Professional',
        expectedPosition: user_profile.expectedPosition || 'Senior Professional',
        employmentHistory: user_profile.employmentHistory && user_profile.employmentHistory.length > 0 ? user_profile.employmentHistory : [
          { company: 'Previous Company', position: 'Professional Role' }
        ]
      };

      // 从数据库获取职位
      const { db } = await connectToMongoDB();
      const collection = db.collection('jobs');
      
      const query: any = { is_active: { $ne: false } };
      
      if (strict_filters && (searchCriteria.jobTitle || searchCriteria.city)) {
        if (searchCriteria.jobTitle) {
          query.$or = [
            { title: { $regex: searchCriteria.jobTitle, $options: 'i' } },
            { summary: { $regex: searchCriteria.jobTitle, $options: 'i' } }
          ];
        }
        if (searchCriteria.city) {
          const locationFilter = buildLocationConditions(searchCriteria.city);
          if (locationFilter) {
            query.$and = query.$and || [];
            query.$and.push(locationFilter);
          }
        }
      } else if (searchCriteria.city) {
        const locationFilter = buildLocationConditions(searchCriteria.city);
        if (locationFilter) {
          query.$and = query.$and || [];
          query.$and.push(locationFilter);
        }
      }
      
      const searchLimit = Math.max(limit * 3, 30);
      const recentJobs = await collection
        .find(query)
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(searchLimit)
        .toArray();

      const transformedJobs = recentJobs.map(transformMongoDBJobToFrontendFormat).filter(Boolean);

      if (transformedJobs.length === 0) {
        return {
          success: true,
          recommendations: [],
          message: 'No jobs found matching criteria',
          searchCriteria,
          totalFound: 0
        };
      }

      // 尝试调用外部API，如果失败则返回基础结果
      let analyzedJobs = transformedJobs;
      let finalRecommendations = transformedJobs;

      try {
        // 发送到 mirror-jobs API 进行匹配分析
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
        const jobAnalysisResponse = await fetch(`${baseUrl}/api/mirror-jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobs: transformedJobs.slice(0, 15),
            userProfile: defaultProfile
          })
        });

        if (jobAnalysisResponse.ok) {
          const analysisData = await jobAnalysisResponse.json();
          analyzedJobs = analysisData.jobs || transformedJobs;
        }

        // 调用 GPT 服务进行匹配评分
        const gptResponse = await fetch(`${baseUrl}/api/gpt-services/jobMatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobs: analyzedJobs.slice(0, limit),
            userProfile: defaultProfile
          })
        });

        if (gptResponse.ok) {
          const gptData = await gptResponse.json();
          finalRecommendations = gptData.recommendations || analyzedJobs;
        }
      } catch (apiError) {
        console.warn('[MCPToolExecutor] External API calls failed, returning basic results:', apiError);
        // 如果外部API调用失败，仍然返回数据库查询结果
      }

      return {
        success: true,
        recommendations: finalRecommendations.slice(0, limit),
        searchCriteria,
        totalFound: transformedJobs.length,
        processedAt: new Date().toISOString(),
        note: transformedJobs.length > 0 ? 'Basic results from database' : 'No jobs found'
      };

    } catch (error: any) {
      console.error('[MCPToolExecutor] recommend_jobs execution failed:', error);
      return {
        success: false,
        error: error.message,
        recommendations: []
      };
    }
  }

  /**
   * Execute search_jobs tool using existing MCP logic
   */
  async executeSearchJobs(args: any): Promise<any> {
    try {
      const { job_title, city, limit = 20 } = args;
      
      if (!job_title || !city) {
        throw new Error('job_title and city are required for search_jobs');
      }

      console.log('[MCPToolExecutor] Executing search_jobs with args:', { job_title, city, limit });

      const { db } = await connectToMongoDB();
      const collection = db.collection('jobs');
      
      const query: any = { 
        is_active: { $ne: false },
        $or: [
          { title: { $regex: job_title, $options: 'i' } },
          { summary: { $regex: job_title, $options: 'i' } }
        ],
        // location filter applied below
      };
      const locationFilter = buildLocationConditions(city);
      if (locationFilter) {
        query.$and = query.$and || [];
        query.$and.push(locationFilter);
      }

      const jobs = await collection
        .find(query)
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(limit)
        .toArray();

      const transformedJobs = jobs.map(transformMongoDBJobToFrontendFormat).filter(Boolean);

      return {
        success: true,
        jobs: transformedJobs,
        total: transformedJobs.length,
        searchParams: { job_title, city, limit },
        executedAt: new Date().toISOString()
      };

    } catch (error: any) {
      console.error('[MCPToolExecutor] search_jobs execution failed:', error);
      return {
        success: false,
        error: error.message,
        jobs: []
      };
    }
  }
}
