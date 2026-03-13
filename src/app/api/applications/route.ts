import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile } from '@/services/profileDatabaseService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    // 获取用户Profile，包含applications数组
    const profile = await getUserProfile(email);
    
    if (!profile) {
      return NextResponse.json({ 
        success: false, 
        message: 'Profile not found' 
      });
    }

    // 提取applications数组，过滤掉 Manus 软删除的（excluded: true）
    const applications = (profile.applications || []).filter((app: any) => !app.excluded);
    
    // 为每个application添加用户信息（用于显示）
    const applicationsWithUserInfo = applications.map(app => ({
      ...app,
      userEmail: profile.email,
      userFirstName: profile.firstName,
      userLastName: profile.lastName,
      userJobTitle: profile.jobTitle,
      userLocation: profile.location
    }));

    return NextResponse.json({ 
      success: true, 
      applications: applicationsWithUserInfo,
      userProfile: {
        _id: (profile as any)._id,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        jobTitle: profile.jobTitle,
        location: profile.location,
        jobSearches: profile.jobSearches || [],
        resumes: profile.resumes || []
      }
    });

  } catch (error) {
    console.error('[Applications API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
