import React, { useRef, useState, useEffect } from 'react';
import type { Job } from '../types/job';
import { JobDetailPanel } from './JobDetailPanel';


interface ApplicationJobCardProps {
  job: Job;
  language: 'en' | 'zh';
  isSelected: boolean;
  onSelect: () => void;
  onViewDetails: (job: Job, rect?: DOMRect, cardRef?: React.RefObject<HTMLDivElement> | undefined) => void;
  userProfile?: {
    email?: string;
    jobTitles: string[];
    skills: string[];
    city: string;
    seniority: string;
    openToRelocate: boolean;
  };
  renderCustomActions?: () => React.ReactNode;
  cardId?: string;
  // 新增：MongoDB application 数据
  application?: {
    jobId: string;
    resumeTailor?: {
      gridfsId: string;
      downloadUrl: string;
      filename?: string;
    };
    coverLetter?: {
      gridfsId: string;
      downloadUrl: string;
      filename?: string;
    };
    applicationStatus?: string;
    hiringStatus?: string;
    applicationStartedBy?: 'manus' | 'hera_web';
  };
  
}

const formatLocation = (location: Job['location']) => {
  if (Array.isArray(location)) {
    return location[0] || '';
  }
  return location || '';
};

export function ApplicationJobCard({ 
  job, 
  language, 
  isSelected, 
  onSelect, 
  onViewDetails,
  userProfile,
  cardId,
  renderCustomActions,
  application
}: ApplicationJobCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [hasTailoredResume, setHasTailoredResume] = useState(false);
  const [tailoredResumeUrl, setTailoredResumeUrl] = useState<string>('');
  const [isLoadingTailoredResume, setIsLoadingTailoredResume] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string>('Application Submitted');
  const [hiringStatus, setHiringStatus] = useState<string>('interviewing_round_1');

  const handleViewDetails = () => {
    setShowDetailModal(true);
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
  };

  // 检查是否有Tailored Resume数据
  useEffect(() => {
    // 如果传入了 application 数据，直接使用
    if (application?.resumeTailor?.downloadUrl) {
      setHasTailoredResume(true);
      setTailoredResumeUrl(application.resumeTailor.downloadUrl);
      setIsLoadingTailoredResume(false);
      return;
    }
    
    // 否则使用原有的API调用逻辑
    const checkTailoredResume = async () => {
      if (!userProfile?.email || !job.id) return;
      
      setIsLoadingTailoredResume(true);
      try {
        const response = await fetch('/api/profile/get-application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userProfile.email,
            jobId: job.id
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.application?.resumeTailor?.downloadUrl) {
            setHasTailoredResume(true);
            setTailoredResumeUrl(data.application.resumeTailor.downloadUrl);
          } else {
            setHasTailoredResume(false);
            setTailoredResumeUrl('');
          }
        }
      } catch (error) {
        console.error('Error checking tailored resume:', error);
        setHasTailoredResume(false);
      } finally {
        setIsLoadingTailoredResume(false);
      }
    };

    checkTailoredResume();
  }, [userProfile?.email, job.id, application]);

  // 初始化 applicationStatus（仅 Application Submitted / Application Failed）
  const mapLegacyApplyStatus = (s: string) => {
    if (!s) return 'Application Submitted';
    const toFailed = ['application failed', 'applicationfailed', 'failed'];
    if (toFailed.includes(String(s).toLowerCase())) return 'Application Failed';
    return 'Application Submitted';
  };
  useEffect(() => {
    if (application?.applicationStatus) {
      setApplicationStatus(mapLegacyApplyStatus(application.applicationStatus));
      return;
    }
    const backupStatus = localStorage.getItem(`app_status_${job.id}`);
    if (backupStatus) setApplicationStatus(mapLegacyApplyStatus(backupStatus));
    else setApplicationStatus('Application Submitted');
  }, [application, job.id]);

  // 初始化 hiringStatus，默认 Interviewing – Round 1
  useEffect(() => {
    const v = application?.hiringStatus?.toLowerCase?.() || application?.hiringStatus;
    if (v && ['pending','interviewing_round_1','interviewing_round_2','interviewing_final','offer_received','rejected','accepted'].includes(v)) {
      setHiringStatus(v);
    } else {
      setHiringStatus('interviewing_round_1');
    }
  }, [application?.hiringStatus]);

  const syncToBackend = async (payload: { applicationStatus?: string; hiringStatus?: string }) => {
    const userProfileStr = localStorage.getItem('userProfile');
    if (!userProfileStr) return;
    try {
      const localProfile = JSON.parse(userProfileStr);
      const email = localProfile.email;
      if (!email) return;
      const body: { email: string; jobId: string; applicationStatus?: string; hiringStatus?: string } = { email, jobId: job.id, ...payload };
      const response = await fetch('/api/profile/upsert-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        if (payload.applicationStatus !== undefined) localStorage.setItem(`app_status_${job.id}`, payload.applicationStatus);
      }
    } catch (e) {
      console.error('Error syncing to backend:', e);
    }
  };

  const handleTailoredResumeClick = async () => {
    if (hasTailoredResume && tailoredResumeUrl) {
      // 如果有Tailored Resume，在新标签页中查看PDF
      // 将下载URL转换为查看URL，并添加email参数
      const viewUrl = tailoredResumeUrl.replace('/download-resume/', '/view-resume/');
      const fullViewUrl = `${viewUrl}?email=${encodeURIComponent(userProfile?.email || '')}`;
      window.open(fullViewUrl, '_blank', 'noopener,noreferrer');
    } else {
      // 如果没有Tailored Resume数据，跳转到Jobs页面的对应Job
      // 保存当前Job数据到localStorage，供Jobs页面使用
      const jobDataForJobsPage = {
        jobId: job.id,
        title: job.title,
        company: job.company,
        platform: job.platform,
        url: job.url,
        location: formatLocation(job.location),
        skills: job.skillsMustHave || job.skills,
        seniority: userProfile?.seniority || '',
        description: job.description,
        requirements: job.keyRequirements || job.requirements,
        benefits: job.summary ? [job.summary] : [],
        postedDate: job.postedDate,
        matchScore: job.matchScore,
        matchAnalysis: job.matchAnalysis,
        timestamp: Date.now() // 添加时间戳，用于判断数据新鲜度
      };
      
      localStorage.setItem('jobDetailsFromApplications', JSON.stringify(jobDataForJobsPage));
      
      // 跳转到Jobs页面，并传递jobId参数用于定位
      window.location.href = `/jobs?jobId=${job.id}`;
    }
  };

  return (
    <>
      <div 
        className={`p-3 hover:bg-gray-50 cursor-pointer ${
          isSelected ? 'bg-blue-50' : ''
        }`}
        id={cardId}
        ref={cardRef}
      >
        <div className="flex items-start">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300"
          />
          <div className="ml-3 flex-1">
            {/* 七栏布局：后两栏缩窄，让 Start Application 一行显示 */}
            <div className="grid gap-1.5 items-stretch" style={{ gridTemplateColumns: '1.35fr 0.55fr 0.55fr 0.85fr 0.95fr 0.85fr 0.9fr' }}>
              {/* 第一栏：Job Title + Company（缩窄） */}
              <div className="min-w-0 flex flex-col justify-center">
                <h3 className="text-sm font-semibold text-gray-900 leading-tight truncate">
                  {job.title}
                  {job.platform === 'CorporateDirect' || job.platform === 'PublicSector' ? (
                    <span style={{ color: '#C40233' }} className="ml-1 text-xs italic">
                      {job.platform === 'CorporateDirect' ? 'Corporate Direct' : 'Public Sector'}
                    </span>
                  ) : null}
                </h3>
                <p className="text-xs text-gray-600 truncate">{job.company}</p>
              </div>
              
              {/* 第二栏：Job Details */}
              <div className="flex justify-center items-center">
                <button
                  type="button"
                  className="text-xs font-semibold text-blue-700 hover:underline px-2 py-1"
                  style={{ height: '28px', lineHeight: '18px' }}
                  onClick={(e) => { e.stopPropagation(); handleViewDetails(); }}
                >
                  {language === 'zh' ? '职位详情' : 'Job Details'}
                </button>
              </div>
              
              {/* 第三栏：Apply Link */}
              <div className="flex justify-center items-center">
                {renderCustomActions ? renderCustomActions() : (
                  job.url && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-blue-700 hover:underline px-2 py-1"
                      style={{ height: '28px', lineHeight: '18px' }}
                      onClick={(e) => { e.stopPropagation(); window.open(job.url, '_blank', 'noopener,noreferrer'); }}
                    >
                      {language === 'zh' ? '申请链接' : 'Apply Link'}
                    </button>
                  )
                )}
              </div>

              {/* 第四栏：Start Application（格式与第五栏 Tailor Application 完全一致） */}
              <div className="flex justify-center items-center self-stretch">
                {application?.applicationStartedBy === 'manus' ? (
                  <button
                    type="button"
                    className="text-xs font-semibold bg-green-100 text-blue-700 hover:bg-green-200 hover:underline rounded px-2 py-1 cursor-pointer"
                    style={{ height: '28px', lineHeight: '18px' }}
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    {language === 'zh' ? '申请已开始' : 'Application Started'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-xs font-semibold bg-orange-300 text-blue-700 hover:bg-orange-400 hover:underline rounded px-2 py-1"
                    style={{ height: '28px', lineHeight: '18px' }}
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    {language === 'zh' ? '开始申请' : 'Start Application'}
                  </button>
                )}
              </div>

              {/* 第五栏：Tailor Application（默认对应 Resume，仅改文案） */}
              <div className="flex justify-center items-center self-stretch">
                {isLoadingTailoredResume ? (
                  <span className="text-xs text-gray-500 px-1" style={{ lineHeight: '28px' }}>...</span>
                ) : hasTailoredResume ? (
                  <button
                    type="button"
                    className="text-xs font-semibold bg-green-100 text-blue-700 hover:bg-green-200 hover:underline rounded px-2 py-1 cursor-pointer"
                    style={{ height: '28px', lineHeight: '18px' }}
                    onClick={(e) => { e.stopPropagation(); handleTailoredResumeClick(); }}
                  >
                    {language === 'zh' ? '查看定制申请' : 'View Tailored Application'}
                  </button>
                ) : application?.coverLetter?.downloadUrl ? (
                  <button
                    type="button"
                    className="text-xs font-semibold bg-green-100 text-blue-700 hover:bg-green-200 hover:underline rounded px-2 py-1 cursor-pointer"
                    style={{ height: '28px', lineHeight: '18px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const viewUrl = application.coverLetter!.downloadUrl.replace('/download-cover-letter/', '/view-cover-letter/');
                      window.open(viewUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    {language === 'zh' ? '查看定制申请' : 'View Tailored Application'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-xs font-semibold bg-orange-300 text-blue-700 hover:bg-orange-400 hover:underline rounded px-2 py-1"
                    style={{ height: '28px', lineHeight: '18px' }}
                    onClick={(e) => { e.stopPropagation(); handleTailoredResumeClick(); }}
                  >
                    {language === 'zh' ? 'Tailor Application' : 'Tailor Application'}
                  </button>
                )}
              </div>

              {/* 第六栏：Application Status（仅两项，栏宽缩窄） */}
              <div className="flex justify-center items-center min-w-0 self-stretch">
                <select
                  className="text-xs border border-gray-300 rounded px-1 py-1 w-full max-w-[110px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  style={{ height: '28px' }}
                  value={applicationStatus}
                  onChange={(e) => {
                    const v = e.target.value;
                    setApplicationStatus(v);
                    syncToBackend({ applicationStatus: v });
                  }}
                >
                  <option value="Application Submitted">{language === 'zh' ? '已提交申请' : 'Application Submitted'}</option>
                  <option value="Application Failed">{language === 'zh' ? '申请失败' : 'Application Failed'}</option>
                </select>
              </div>

              {/* 第七栏：Hiring Status（默认 Interviewing，栏宽缩窄） */}
              <div className="flex justify-center items-center min-w-0 self-stretch">
                <select
                  className="text-xs border border-gray-300 rounded px-1 py-1 w-full max-w-[130px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  style={{ height: '28px' }}
                  value={hiringStatus}
                  onChange={(e) => {
                    const v = e.target.value;
                    setHiringStatus(v);
                    syncToBackend({ hiringStatus: v });
                  }}
                >
                  <option value="pending">{language === 'zh' ? 'Pending' : 'Pending'}</option>
                  <option value="interviewing_round_1">{language === 'zh' ? '面试 Round 1' : 'Interviewing – Round 1'}</option>
                  <option value="interviewing_round_2">{language === 'zh' ? '面试 Round 2' : 'Interviewing – Round 2'}</option>
                  <option value="interviewing_final">{language === 'zh' ? '终面' : 'Interviewing – Final Round'}</option>
                  <option value="offer_received">{language === 'zh' ? '收到 Offer' : 'Offer Received'}</option>
                  <option value="rejected">{language === 'zh' ? '被拒' : 'Rejected'}</option>
                  <option value="accepted">{language === 'zh' ? '接受 Offer' : 'Accepted'}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Job Details Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {/* 背景遮罩 */}
          <div className="fixed inset-0 bg-gray-500 bg-opacity-30 transition-opacity pointer-events-auto" onClick={handleCloseDetailModal} />
          {/* 弹窗 */}
          <div className="fixed bg-white shadow-xl rounded-lg border border-gray-200 pointer-events-auto flex flex-col max-w-[90vw] max-h-[80vh] w-full h-auto"
               style={{ 
                 left: '50%', 
                 top: '50%', 
                 transform: 'translate(-50%, -50%)',
                 width: 650, 
                 height: Math.floor(window.innerHeight / 3 * 1.2),
               }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-900">
                {language === 'zh' ? '职位详情' : 'Job Details'}
              </h2>
              <button
                onClick={handleCloseDetailModal}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 text-sm">
              <JobDetailPanel job={job} language={language} compact />
            </div>
          </div>
        </div>
      )}


    </>
  );
}
