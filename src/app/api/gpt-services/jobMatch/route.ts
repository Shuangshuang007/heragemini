import { NextResponse } from 'next/server';
import { matchJobWithGPT } from '@/gpt-services/jobMatch/matchJob';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // 必填：jobTitle、userProfile；其余缺省时用占位值，避免 DB 缺字段导致 400
    if (!data.userProfile || typeof data.userProfile !== 'object') {
      return NextResponse.json(
        { error: 'Missing required fields: userProfile' },
        { status: 400 }
      );
    }
    const payload = {
      ...data,
      jobTitle: (data.jobTitle && String(data.jobTitle).trim()) || 'Job',
      jobDescription: (data.jobDescription && String(data.jobDescription).trim()) || (data.summary && String(data.summary).trim()) || 'No description provided.',
      jobRequirements: Array.isArray(data.jobRequirements) ? data.jobRequirements : [],
      jobLocation: (data.jobLocation && String(data.jobLocation).trim()) || 'Location not specified',
      userProfile: data.userProfile,
    };

    // 调用 GPT 服务
    const result = await matchJobWithGPT(payload);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in job match API:', error);
    return NextResponse.json(
      { error: 'Failed to process job match request' },
      { status: 500 }
    );
  }
} 