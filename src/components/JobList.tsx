"use client";
import { useState } from 'react';
import { JobDetailPanel } from './JobDetailPanel';
import { Job } from '@/types/job';
import { deduplicateJobTitle } from '../utils/titleDeduplicator';

interface JobListProps {
  jobs: Job[];
  loading?: boolean;
  error?: string | null;
}

const formatLocation = (location: Job['location']) => {
  if (Array.isArray(location)) {
    return location[0] || '';
  }
  return location || '';
};

export default function JobList({ jobs, loading = false, error = null }: JobListProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="col-span-1">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Jobs for you</h2>
        <div className="text-sm text-gray-500">Recent searches</div>
      </div>
      <div className="grid gap-4">
          {loading && <div className="text-gray-500">加载中...</div>}
          {error && <div className="text-red-500">{error}</div>}
          {jobs.map(job => (
            <div
              key={job.id}
              className={`p-4 border rounded-lg cursor-pointer hover:bg-blue-50 ${selectedJob?.id === job.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
              onClick={() => setSelectedJob(job)}
            >
              <div className="font-semibold text-gray-900">{deduplicateJobTitle(job.title)}</div>
              <div className="text-sm text-gray-700">{job.company}</div>
              <div className="text-xs text-gray-500">{formatLocation(job.location)}</div>
              <div className="text-xs text-gray-500 truncate">{job.description}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="col-span-2">
        <JobDetailPanel job={selectedJob} language="zh" />
      </div>
    </div>
  );
} 