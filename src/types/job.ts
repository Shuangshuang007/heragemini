export interface Job {
  id: string;
  title: string;
  company: string;
  location: string | string[];
  description?: string;
  salary?: string;
  /**
   * Legacy fields kept for backward compatibility.
   */
  requirements?: string[];
  benefits?: string[];
  jobType?: string;
  employmentType?: string;
  workMode?: string;
  experience?: string;
  postedDate?: string;
  platform: string;
  url: string;
  /**
   * Derived experience chip used in job list (e.g. "3+ yrs exp").
   */
  experienceTag?: string;
  /**
   * Must-have skills/conditions (Mongo: skillsMust).
   */
  skillsMustHave?: string[];
  /**
   * Nice-to-have skills/conditions (Mongo: skillsNice).
   */
  skillsNiceToHave?: string[];
  /**
   * Highlights array (3 summary sentences).
   */
  highlights?: string[];
  /**
   * Key requirements list.
   */
  keyRequirements?: string[];
  /**
   * Structured work rights info from pipeline.
   */
  workRights?: {
    country?: string;
    requiresStatus?: string;
    sponsorship?: 'required' | 'available' | 'not_available' | 'unknown';
    citizenshipRequired?: boolean;
  };
  /**
   * Raw tags array (legacy fallback).
   */
  tags?: string[];
  /**
   * Legacy skills array (fallback).
   */
  skills?: string[];
  openToRelocate?: boolean;
  matchScore?: number;
  subScores?: {
    experience: number;
    industry: number;
    skills: number;
    other?: number;
  };
  matchAnalysis?: string;
  matchHighlights?: string[];
  summary?: string;
  detailedSummary?: string;
  /**
   * Mongo metadata fields.
   */
  hotjob?: string;
  source?: string[];
  sourceType?: string;
  functionality?: string;
  industry?: string;
} 