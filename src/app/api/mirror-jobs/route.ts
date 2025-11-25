import { NextRequest, NextResponse } from 'next/server';
import { fetchJobs } from '../../../services/jobFetchService';
import { analyzeJobWithGPT, needsJobAnalysis } from '../../../services/jobAnalysisService';

// 内存防抖存储
const debounceStore = new Map<string, { data: any; timestamp: number }>();
const DEBOUNCE_EXPIRY = 60 * 1000; // 1分钟防抖

// 防抖工具函数
function getDebounceKey(jobTitle: string, city: string): string {
  return `${jobTitle}:${city}`.toLowerCase();
}

function getDebouncedData(jobTitle: string, city: string): any | null {
  const key = getDebounceKey(jobTitle, city);
  const cached = debounceStore.get(key);
  
  if (cached) {
    const now = Date.now();
    if (now - cached.timestamp < DEBOUNCE_EXPIRY) {
      console.log(`[MirrorJobs] ✓ Using debounced data for ${jobTitle} in ${city} (within 1 minute)`);
      return cached.data;
    } else {
      // 超过1分钟，清除防抖数据
      debounceStore.delete(key);
    }
  }
  
  return null;
}

function setDebouncedData(jobTitle: string, city: string, data: any): void {
  const key = getDebounceKey(jobTitle, city);
  debounceStore.set(key, {
    data,
    timestamp: Date.now()
  });
  console.log(`[MirrorJobs] ✓ Data debounced for ${jobTitle} in ${city} (1 minute)`);
}

// 定义职位接口
interface Job {
  id: string;
  title: string;
  company: string;
  location: string | string[];
  description: string;
  salary?: string;
  requirements?: string[];
  benefits?: string[];
  jobType?: string;
  experience?: string;
  postedDate?: string;
  platform: string;
  url: string;
  tags?: string[];
  skills?: string[];
  source?: string;
  sourceType: string;
  summary: string;
  detailedSummary: string;
  matchScore: number | undefined;
  matchAnalysis: string;
  workMode?: string;
}

// POST方法：接收JobFetchService传入的数据并进行GPT分析
// 注意：POST 方法保留 GPT 分析功能，用于后台批处理场景
// 列表阶段的 GET 方法已改为按需模式（不进行批量 GPT 分析）
export async function POST(request: Request) {
  try {
    const { jobs, jobTitle, city, limit, page, isHotJob, platform } = await request.json();
    
    console.log(`[MirrorJobs] POST: Starting GPT analysis for ${jobs.length} jobs, IsHotJob: ${isHotJob}`);
    
    // 对职位进行GPT分析（保持所有原有功能）
    const analyzedJobs = await Promise.all(
      jobs.map(async (job: any) => {
        const jobWithCity = { ...job, city };
        if (!needsJobAnalysis(jobWithCity)) {
          return jobWithCity;
        }
        const result = await analyzeJobWithGPT(jobWithCity, city);
        return {
          ...jobWithCity,
          ...result,
        };
      })
    );
    
    console.log(`[MirrorJobs] POST: Final stats: ${analyzedJobs.length} jobs, Source: ${isHotJob ? 'hot_jobs_database' : 'realtime'}`);
    
    // 保持原有的响应格式
    return NextResponse.json({
      jobs: analyzedJobs,
      total: analyzedJobs.length,
      page: page || 1,
      totalPages: Math.ceil(analyzedJobs.length / (limit || 100)),
      source: isHotJob ? 'hot_jobs_database' : 'realtime',
      isHotJob,
      analysis: {
        totalJobs: analyzedJobs.length,
        dataSource: isHotJob ? 'hot_jobs_database' : 'realtime'
      }
    });
    
  } catch (error: any) {
    console.error('[MirrorJobs] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze jobs', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * @param {Request} req
 * @returns {Promise<Response>}
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobTitle = searchParams.get('jobTitle') || '';
  const city = searchParams.get('city') || '';
  const platform = searchParams.get('platform') || '';
  const limit = parseInt(searchParams.get('limit') || '600');
  const page = parseInt(searchParams.get('page') || '1');
  
  try {
    // 检查防抖数据（1分钟内）
    const debouncedData = getDebouncedData(jobTitle, city);
    if (debouncedData) {
      return NextResponse.json(debouncedData);
    }
    
    // 使用统一的job获取服务
    const result = await fetchJobs({
      jobTitle,
      city,
      limit,
      page,
      platform
    });
    
    // Step 3.2: 列表阶段不再进行批量 GPT 分析
    // GPT 分析改为按需模式：只在用户点击 job detail 或打开 tailor resume 时调用
    // 详情见 /api/jobs/[id] 和 JobDetailPanel/TailorPreview 组件
    console.log(`[MirrorJobs] GET: Returning ${result.jobs.length} jobs without batch GPT analysis (on-demand mode)`);
    
    const responseData = {
      jobs: result.jobs, // 直接返回原始数据，不进行 GPT 分析
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      source: result.source,
      isHotJob: result.isHotJob,
      analysis: {
        ...result.analysis,
        note: 'GPT analysis is now on-demand (triggered when viewing job details)'
      }
    };
    
    // 设置防抖数据（1分钟）
    setDebouncedData(jobTitle, city, responseData);
    
    return NextResponse.json(responseData);
    
  } catch (error: any) {
    console.error('[MirrorJobs] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs', details: error.message },
      { status: 500 }
    );
  }
} 