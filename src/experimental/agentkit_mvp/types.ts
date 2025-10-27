export type Intent = {
  primary: 'find_jobs' | 'improve_profile' | 'apply_job';
  readiness: 'ready' | 'needs_resume' | 'needs_profile';
  blockers: string[];
  confidence: number;
};

export type AgentStep = {
  id: string;
  tool: 'parseResume' | 'updateProfile' | 'searchJobs' | 'rankRecommend';
  args: Record<string, unknown>;
  priority: number;
};

export type Plan = {
  id: string;
  userId: string;
  intent: Intent;
  steps: AgentStep[];
  createdAt: string;
  version: 'v1.0.0';
};

export type ExecutionRecord = {
  id: string;
  planId: string;
  stepId: string;
  tool: AgentStep['tool'];
  status: 'pending' | 'success' | 'error' | 'skipped';
  latencyMs?: number;
  errorMessage?: string;
  inputSnapshot?: unknown;
  outputSnapshot?: unknown;
  createdAt: string;
};
