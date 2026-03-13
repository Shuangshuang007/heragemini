/**
 * Shared jobMatch (GPT) scoring for MCP: recommend_jobs, search_jobs, refine_recommendations.
 * Single place to call /api/gpt-services/jobMatch and return job + matchScore, matchAnalysis, etc.
 */

export interface JobMatchUserProfile {
  jobTitles: string[];
  skills: string[];
  city: string | null;
  seniority?: string;
  openToRelocate?: boolean;
  careerPriorities?: string[];
  expectedSalary?: string;
  currentPosition?: string;
  expectedPosition?: string;
  employmentHistory?: Array<{ company: string; position: string }>;
  workingRightsAU?: string;
  workingRightsOther?: string;
}

/**
 * Call jobMatch API for one job; returns job enriched with matchScore, subScores, matchAnalysis, etc.
 * On failure returns job with fallback scores and matchAnalysis: 'Unable to analyze - using fallback scoring'.
 */
export async function scoreJobWithJobMatch(
  job: any,
  userProfile: JobMatchUserProfile
): Promise<any> {
  const jobTitle = (job.title && String(job.title).trim()) || 'Job';
  const jobDescription =
    (job.description && String(job.description).trim()) ||
    (job.summary && String(job.summary).trim()) ||
    (Array.isArray(job.highlights) && job.highlights[0]) ||
    'No description provided.';
  const jobLocation =
    Array.isArray(job.location)
      ? job.location.join(', ')
      : (job.location && String(job.location).trim()) || job.locationRaw || 'Location not specified';

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
  const gptApiUrl = `${baseUrl}/api/gpt-services/jobMatch`;

  try {
    const matchResponse = await fetch(gptApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobTitle,
        jobDescription,
        jobRequirements: job.requirements || [],
        jobLocation,
        skillsMustHave: job.skillsMustHave || [],
        skillsNiceToHave: job.skillsNiceToHave || [],
        keyRequirements: job.keyRequirements || [],
        highlights: job.highlights || [],
        workMode: job.workMode || '',
        salary: job.salary || '',
        industry: job.industry || '',
        workRights: job.workRights || undefined,
        userProfile: {
          jobTitles: userProfile.jobTitles?.length ? userProfile.jobTitles : [job.title || 'Job'],
          skills: userProfile.skills || [],
          city: userProfile.city || '',
          seniority: userProfile.seniority || '',
          openToRelocate: userProfile.openToRelocate ?? false,
          careerPriorities: userProfile.careerPriorities || [],
          expectedSalary: userProfile.expectedSalary,
          currentPosition: userProfile.currentPosition,
          expectedPosition: userProfile.expectedPosition,
          employmentHistory: userProfile.employmentHistory || [],
          workingRightsAU: userProfile.workingRightsAU,
          workingRightsOther: userProfile.workingRightsOther,
        },
      }),
    });

    if (!matchResponse.ok) {
      throw new Error(`Match API error: ${matchResponse.status}`);
    }

    const matchData = await matchResponse.json();

    const validatedSubScores = {
      experience: Math.min(Math.max(matchData.subScores?.experience || 50, 50), 95),
      industry: Math.min(Math.max(matchData.subScores?.industry || 50, 50), 95),
      skills: Math.min(Math.max(matchData.subScores?.skills || 50, 50), 90),
      other: Math.min(Math.max(matchData.subScores?.other || 50, 50), 95),
    };
    const validatedMatchScore = Math.min(Math.max(matchData.score || 50, 50), 95);

    return {
      ...job,
      matchScore: validatedMatchScore,
      subScores: validatedSubScores,
      matchAnalysis: matchData.analysis || 'Analysis not available',
      matchHighlights:
        (matchData.highlights && matchData.highlights.length > 0)
          ? matchData.highlights
          : (job.highlights && job.highlights.length > 0)
            ? job.highlights.slice(0, 3)
            : (job.keyRequirements && job.keyRequirements.length > 0)
              ? job.keyRequirements.slice(0, 3)
              : [],
      summary: matchData.listSummary || job.summary || `${job.title} position at ${job.company}`,
      detailedSummary:
        matchData.detailedSummary ||
        job.detailedSummary ||
        (job.description && job.description.substring(0, 200) + '...'),
      userType: matchData.userType || 'neutral',
    };
  } catch (error) {
    const randomOffset = Math.floor(Math.random() * 20) - 10;
    const baseScore = 60 + randomOffset;
    const finalScore = Math.min(Math.max(baseScore, 50), 80);
    return {
      ...job,
      matchScore: finalScore,
      subScores: {
        experience: Math.min(Math.max(55 + randomOffset, 50), 85),
        industry: Math.min(Math.max(60 + randomOffset, 50), 85),
        skills: Math.min(Math.max(50 + randomOffset, 50), 80),
        other: Math.min(Math.max(65 + randomOffset, 50), 85),
      },
      matchAnalysis: 'Unable to analyze - using fallback scoring',
      matchHighlights:
        (job.highlights && job.highlights.length > 0)
          ? job.highlights.slice(0, 3)
          : (job.keyRequirements && job.keyRequirements.length > 0)
            ? job.keyRequirements.slice(0, 3)
            : [
                `Basic match: ${job.title} position`,
                `Location: ${job.location}`,
                `Company: ${job.company}`,
              ],
      summary: job.summary || `${job.title} position at ${job.company}`,
      detailedSummary: job.detailedSummary || (job.description && job.description.substring(0, 200) + '...'),
      userType: 'neutral',
    };
  }
}
