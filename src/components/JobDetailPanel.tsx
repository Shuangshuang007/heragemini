import React, { useEffect, useState } from 'react';
import { Job } from '@/types/job';
import { LinkedInAutoApply } from '@/components/LinkedInAutoApply';
import { buildSearchUrl } from '@/utils/platformMapping';
import { deduplicateJobTitle } from '@/utils/titleDeduplicator';
import { isValidSalary } from '@/utils/employmentUtils';

interface JobDetailPanelProps {
  job: Job | null;
  language: 'en' | 'zh';
  compact?: boolean;
}

// 计算距离今天的天数
function getDaysAgo(dateStr?: string): number | null {
  if (!dateStr) return null;
  // 兼容 "27d ago"、"27 days ago"、"Posted 27 days ago"
  const match = dateStr.match(/(\d+)\s*d(?:ays)?\s*ago/i);
  if (match) return parseInt(match[1], 10);
  // 标准日期格式
  const parsed = Date.parse(dateStr.replace(/\./g, '-').replace(/\//g, '-'));
  if (!isNaN(parsed)) {
    const now = new Date();
    const diff = now.getTime() - parsed;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
  return null;
}

const formatLocationDetail = (location: Job['location']): string => {
  if (Array.isArray(location)) {
    return location.join(' · ');
  }
  return location || '';
};

export function JobDetailPanel({ job: selectedJob, language, compact }: JobDetailPanelProps) {
  const [detailedJob, setDetailedJob] = useState<Job | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDetailedJob(null);

    if (!selectedJob?.id) {
      return;
    }

    // ✅ 不再需要生成 detailedSummary，但保留获取最新 job 数据的逻辑
    // 如果需要，可以在这里添加其他条件来触发数据刷新

    setLoadingDetail(true);
    fetch(`/api/jobs/${selectedJob.id}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await res.text());
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setDetailedJob(data.job);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[JobDetailPanel] Failed to load detail:', error);
          // 静默失败，不显示错误信息
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedJob?.id]);

  if (!selectedJob) {
    return (
      <div className={`h-full flex items-center justify-center bg-white rounded-lg border border-gray-200 ${compact ? 'p-2' : 'p-8'}`}>
        <div className="text-center">
          <h3 className={`text-lg font-medium text-gray-900 mb-2 ${compact ? 'mb-1' : 'mb-2'}`}>{language === 'zh' ? '选择一个职位查看详情' : 'Select a job to view details'}</h3>
          <p className="text-gray-500 text-sm">{language === 'zh' ? '从左侧列表中选择一个职位，查看完整的职位描述和要求。' : 'Choose a job from the list to view its full description and requirements.'}</p>
        </div>
      </div>
    );
  }

  const job = detailedJob || selectedJob;

  const highlights = Array.isArray(job.highlights) ? job.highlights : [];
  const mustHaveSkills = Array.isArray(job.skillsMustHave) ? job.skillsMustHave : [];
  const niceToHaveSkills = Array.isArray(job.skillsNiceToHave) ? job.skillsNiceToHave : [];
  const keyRequirements = Array.isArray(job.keyRequirements) ? job.keyRequirements : [];

  return (
    <div className={`h-full bg-white rounded-lg border border-gray-200 overflow-y-auto ${compact ? 'p-2' : 'p-6'}`} style={compact ? { fontSize: '14px', lineHeight: '1.4' } : {}}>
      <div className={compact ? 'mb-2' : 'mb-4'}>
        <div className="flex justify-between items-center">
          <h2 className={`font-bold text-gray-900 dark:text-white ${compact ? 'text-base' : 'text-2xl'}`}>{deduplicateJobTitle(job.title)}</h2>
          {job.url ? (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`bg-gray-100 text-blue-700 font-bold rounded-lg hover:bg-gray-200 transition-colors ${compact ? 'px-2 py-1 text-xs' : 'px-4 py-2'}`}
              style={{ display: 'inline-block', textAlign: 'center' }}
            >
              {language === 'zh' ? '申请' : 'Apply'}
            </a>
          ) : (
            <button
              className={`bg-gray-100 text-blue-700 font-bold rounded-lg hover:bg-gray-200 transition-colors ${compact ? 'px-2 py-1 text-xs' : 'px-4 py-2'}`}
              disabled
            >
              {language === 'zh' ? '申请' : 'Apply'}
            </button>
          )}
        </div>
        <h3 className={`font-semibold text-gray-800 dark:text-gray-200 ${compact ? 'text-sm mt-1' : 'text-xl'}`}>{job.company}</h3>
      </div>
      <div className={`flex flex-wrap gap-2 text-xs text-gray-500 ${compact ? 'mt-2' : 'mt-4'}`}> {/* 位置、发布时间 */}
        <span>{formatLocationDetail(job.location)}</span>
        {job.postedDate && (
          (() => {
            const daysAgo = getDaysAgo(job.postedDate);
            if (daysAgo !== null && daysAgo > 24) {
              return <span>• {language === 'zh' ? '即将过期' : 'Expiring soon'}</span>;
            } else if (daysAgo !== null && daysAgo >= 0) {
              return <span>• {language === 'zh' ? `发布于${daysAgo}天前` : `Posted ${daysAgo} days ago`}</span>;
            } else {
              return <span>• {language === 'zh' ? '发布于' : 'Posted'} {job.postedDate}</span>;
            }
          })()
        )}
      </div>
      
      {/* Job Summary - 使用数据库的 highlights 前 3 条 + job.summary */}
      {(highlights.length > 0) && (
        <div className={compact ? 'mt-2 mb-2' : 'mt-6 mb-6'}>
        <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm mb-1' : 'text-base mb-3'}`}>{language === 'zh' ? '职位概要' : 'Job Summary'}</h3>
          {highlights.length > 0 && (
            <ul className="list-disc list-inside text-xs text-gray-700 space-y-1 mb-2">
              {highlights.slice(0, 3).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Matching Summary - Match Score + Sub Scores + Summary */}
      {(job.matchScore !== undefined || job.summary) && (
        <div className={compact ? 'mt-2 mb-2' : 'mt-6 mb-6'}>
          <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm mb-1' : 'text-base mb-3'}`}>{language === 'zh' ? '匹配分析' : 'Matching Summary'}</h3>
          <div className={`bg-gray-50 rounded-lg ${compact ? 'p-2' : 'p-4'}`}>
            {job.matchScore !== undefined && (
              <div className="mb-2">
              <div className="text-xs font-semibold text-blue-700 mb-1">
                {language === 'zh' ? '匹配分数' : 'Match Score'}: {job.matchScore}
                </div>
                {job.subScores && (
                  <div className="text-xs text-gray-600 mt-1">
                    {language === 'zh' ? '子分数' : 'Sub Scores'}: 
                    {job.subScores.experience !== undefined && ` ${language === 'zh' ? '经验' : 'Experience'}: ${job.subScores.experience}`}
                    {job.subScores.industry !== undefined && ` ${language === 'zh' ? '行业' : 'Industry'}: ${job.subScores.industry}`}
                    {job.subScores.skills !== undefined && ` ${language === 'zh' ? '技能' : 'Skills'}: ${job.subScores.skills}`}
                    {job.subScores.other !== undefined && ` ${language === 'zh' ? '其他' : 'Other'}: ${job.subScores.other}`}
                  </div>
                )}
              </div>
            )}
            {job.summary && (
              <p className="text-xs text-gray-700 mt-2">{job.summary}</p>
            )}
          </div>
        </div>
      )}

      {/* WorkMode */}
      {job.workMode && (
        <div className={compact ? 'mt-2 mb-2' : 'mt-6 mb-6'}>
          <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm mb-1' : 'text-base mb-3'}`}>{language === 'zh' ? '工作模式' : 'Work Mode'}</h3>
          <p className="text-xs text-gray-700">{job.workMode}</p>
        </div>
      )}

      {/* Salary */}
      {job.salary && isValidSalary(job.salary) && (
        <div className={compact ? 'mt-2 mb-2' : 'mt-6 mb-6'}>
          <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm mb-1' : 'text-base mb-3'}`}>{language === 'zh' ? '薪资范围' : 'Salary'}</h3>
          <p className="text-xs text-gray-700">{job.salary}</p>
        </div>
      )}

      {/* Must / Nice to have */}
      {(mustHaveSkills.length > 0 || niceToHaveSkills.length > 0) && (
        <div className={compact ? 'mt-2 mb-2' : 'mt-6 mb-6'}>
          <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm mb-1' : 'text-base mb-3'}`}>
            {language === 'zh' ? '技能要求' : 'Skills & Requirements'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-700">
            {mustHaveSkills.length > 0 && (
              <div>
                <p className="font-medium text-gray-800 mb-1">{language === 'zh' ? '必备条件' : 'Must-have'}</p>
                <ul className="list-disc list-inside space-y-1">
                  {mustHaveSkills.map((skill, index) => (
                    <li key={index}>{skill}</li>
                  ))}
                </ul>
                    </div>
            )}
            {niceToHaveSkills.length > 0 && (
              <div>
                <p className="font-medium text-gray-800 mb-1">{language === 'zh' ? '加分项' : 'Nice-to-have'}</p>
                <ul className="list-disc list-inside space-y-1">
                  {niceToHaveSkills.map((skill, index) => (
                    <li key={index}>{skill}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Key Requirements */}
      {keyRequirements.length > 0 && (
        <div className={compact ? 'mt-2 mb-2' : 'mt-6 mb-6'}>
          <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm mb-1' : 'text-base mb-3'}`}>{language === 'zh' ? '关键要求' : 'Key Requirements'}</h3>
          <ul className="list-disc list-inside text-xs text-gray-700 space-y-1">
            {keyRequirements.map((req, index) => (
              <li key={index}>{req}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Work rights */}
      {job.workRights && (job.workRights.requiresStatus || job.workRights.sponsorship) && (
        <div className={compact ? 'mt-2 mb-2' : 'mt-6 mb-6'}>
          <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm mb-1' : 'text-base mb-3'}`}>{language === 'zh' ? '工作权要求' : 'Work Rights'}</h3>
          <div className="text-xs text-gray-700 space-y-1">
            {job.workRights.requiresStatus && <p>{job.workRights.requiresStatus}</p>}
            {job.workRights.sponsorship && job.workRights.sponsorship !== 'unknown' && (
              <p>
                {language === 'zh' ? '签证赞助：' : 'Sponsorship: '}
                {job.workRights.sponsorship}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 