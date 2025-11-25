import { NextRequest, NextResponse } from 'next/server';
import { analyzeJobWithGPT, needsJobAnalysis } from '../../../../services/jobAnalysisService';
import {
  getJobById,
  updateJobFields,
  transformMongoDBJobToFrontendFormat,
} from '../../../../services/jobDatabaseService';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: RouteParams) {
  const startTime = Date.now();
  const { id: jobId } = await context.params;
  if (!jobId) {
    return NextResponse.json({ error: 'Job id is required' }, { status: 400 });
  }

  console.log(`[JobDetail] GET /api/jobs/${jobId} - Starting request`);

  // ✅ 从 query 参数获取 userProfile（如果传递）
  const { searchParams } = new URL(_request.url);
  let userProfile = null;
  try {
    const userProfileStr = searchParams.get('userProfile');
    if (userProfileStr) {
      userProfile = JSON.parse(decodeURIComponent(userProfileStr));
      console.log(`[JobDetail] UserProfile provided: ${userProfile.skills?.length || 0} skills`);
    }
  } catch (error) {
    console.warn('[JobDetail] Failed to parse userProfile from query:', error);
  }

  try {
    const jobDoc = await getJobById(jobId);
    if (!jobDoc) {
      console.warn(`[JobDetail] Job not found: ${jobId}`);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    console.log(`[JobDetail] Job found: ${jobDoc.title || 'Unknown'} at ${jobDoc.company || 'Unknown'}`);
    console.log(`[JobDetail] Job data check:`, {
      hasSummary: !!jobDoc.summary,
      summaryLength: jobDoc.summary?.length || 0,
      hasHighlights: Array.isArray(jobDoc.highlights) && jobDoc.highlights.length > 0,
      highlightsCount: Array.isArray(jobDoc.highlights) ? jobDoc.highlights.length : 0,
      hasDetailedSummary: !!jobDoc.detailedSummary,
      detailedSummaryLength: jobDoc.detailedSummary?.length || 0,
      hasMatchAnalysis: !!jobDoc.matchAnalysis,
      matchAnalysisLength: jobDoc.matchAnalysis?.length || 0,
    });

    const baseJob = jobDoc.id
      ? jobDoc
      : {
          ...jobDoc,
          id: jobDoc.jobIdentifier || jobDoc._id?.toString?.() || jobId,
        };

    let enrichedJob = baseJob;

    const needsAnalysis = needsJobAnalysis(baseJob);
    console.log(`[JobDetail] needsJobAnalysis result: ${needsAnalysis}`);

    if (needsAnalysis) {
      try {
        console.log(`[JobDetail] Job needs analysis, calling GPT...`);
        console.log(`[JobDetail] GPT input:`, {
          title: baseJob.title,
          company: baseJob.company,
          hasDescription: !!baseJob.description,
          descriptionLength: baseJob.description?.length || 0,
          hasUserProfile: !!userProfile,
        });
        
        // ✅ 传递 userProfile 给 analyzeJobWithGPT（如果提供）
        const analysis = await analyzeJobWithGPT(baseJob, baseJob.city, userProfile);
        
        console.log(`[JobDetail] GPT analysis result:`, {
          hasSummary: !!analysis.summary,
          hasDetailedSummary: !!analysis.detailedSummary,
          hasMatchAnalysis: !!analysis.matchAnalysis,
          matchScore: analysis.matchScore,
        });
        
        // 保留数据库中的 highlights（如果存在），因为 GPT 分析不生成 highlights
        // highlights 应该来自 pipeline，如果数据库中没有，则保持为空数组
        const enrichedData = {
          ...baseJob,
          ...analysis,
          // 确保 highlights 保留（如果数据库中有）
          highlights: baseJob.highlights || []
        };
        
        console.log(`[JobDetail] Saving analysis to database...`);
        await updateJobFields(jobId, analysis);
        console.log(`[JobDetail] Analysis saved to database`);
        
        enrichedJob = enrichedData;
        console.log(`[JobDetail] GPT analysis completed and saved`);
      } catch (error: any) {
        console.error('[JobDetail] analyze error:', error.message, error.stack);
        enrichedJob = baseJob;
      }
    } else {
      console.log(`[JobDetail] Job already has analysis, skipping GPT`);
      console.log(`[JobDetail] Using existing data:`, {
        summary: baseJob.summary?.substring(0, 50) + '...',
        detailedSummary: baseJob.detailedSummary?.substring(0, 50) + '...',
        matchAnalysis: baseJob.matchAnalysis?.substring(0, 50) + '...',
      });
    }

    const frontendJob = transformMongoDBJobToFrontendFormat(enrichedJob);

    if (!frontendJob) {
      console.error(`[JobDetail] Failed to transform job: ${jobId}`);
      return NextResponse.json({ error: 'Failed to transform job' }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    console.log(`[JobDetail] GET /api/jobs/${jobId} - Completed in ${duration}ms`);
    return NextResponse.json({ job: frontendJob });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[JobDetail] GET /api/jobs/${jobId} - Error after ${duration}ms:`, error.message);
    return NextResponse.json(
      { error: 'Failed to fetch job details', details: error.message },
      { status: 500 }
    );
  }
}

