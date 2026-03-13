import { NextRequest, NextResponse } from 'next/server';
import { upsertJobApplication } from '@/services/profileDatabaseService';

export async function POST(request: NextRequest) {
  try {
    const { email, jobId, jobSave, resumeTailor, coverLetter, applicationStatus, appliedVia, hiringStatus, applicationStartedBy } = await request.json();
    
    if (!email || !jobId) {
      return NextResponse.json(
        { success: false, error: 'Email and jobId are required' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (jobSave !== undefined) updateData.jobSave = jobSave;
    if (resumeTailor !== undefined) updateData.resumeTailor = resumeTailor;
    if (coverLetter !== undefined) updateData.coverLetter = coverLetter;
    if (applicationStatus !== undefined) updateData.applicationStatus = applicationStatus;
    if (appliedVia !== undefined) updateData.appliedVia = appliedVia;
    if (hiringStatus !== undefined) updateData.hiringStatus = hiringStatus;
    if (applicationStartedBy !== undefined) updateData.applicationStartedBy = applicationStartedBy;

    const success = await upsertJobApplication(email, jobId, updateData);

    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Job application updated successfully' 
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to update job application' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Upsert Application API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
