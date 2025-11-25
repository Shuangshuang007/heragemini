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
  const [applicationStatus, setApplicationStatus] = useState<string>('not-applied');

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

  // 初始化 applicationStatus - 双重保障
  useEffect(() => {
    // 优先级1: 从MongoDB application数据读取
    if (application?.applicationStatus) {
      setApplicationStatus(application.applicationStatus);
      // 同时保存到localStorage作为备份
      localStorage.setItem(`app_status_${job.id}`, application.applicationStatus);
      return;
    }
    
    // 优先级2: 从localStorage读取备份数据
    const backupStatus = localStorage.getItem(`app_status_${job.id}`);
    if (backupStatus) {
      setApplicationStatus(backupStatus);
      return;
    }
    
    // 默认值
    setApplicationStatus('not-applied');
  }, [application, job.id]);

  // 同步 applicationStatus 到 MongoDB
  const syncApplicationStatus = async (newStatus: string) => {
    // 从localStorage获取用户email
    const userProfileStr = localStorage.getItem('userProfile');
    if (!userProfileStr) {
      console.error('No user profile found');
      return;
    }
    
    try {
      const localProfile = JSON.parse(userProfileStr);
      const email = localProfile.email;
      
      if (!email) {
        console.error('No email found in user profile');
        return;
      }
      
      const response = await fetch('/api/profile/upsert-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          jobId: job.id,
          applicationStatus: newStatus
        })
      });
      
      if (response.ok) {
        console.log(`✓ Application status updated to: ${newStatus}`);
        // 同时更新localStorage作为备份
        localStorage.setItem(`app_status_${job.id}`, newStatus);
      } else {
        console.error('Failed to update application status');
      }
    } catch (error) {
      console.error('Error syncing application status:', error);
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
            {/* 六栏布局 - 优化宽度分配 */}
            <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '2.2fr 0.7fr 0.7fr 1.2fr 1.2fr 1fr' }}>
              {/* 第一栏：Job Title + Company + Corporate Direct标志 */}
              <div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 leading-tight tracking-tight">
                    {job.title}
                    {job.platform === 'CorporateDirect' || job.platform === 'PublicSector' ? (
                      <span style={{ color: '#C40233' }} className="ml-2 text-sm italic">
                        {job.platform === 'CorporateDirect' ? 'Corporate Direct' : 'Public Sector'}
                      </span>
                    ) : null}
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed tracking-normal">{job.company}</p>
                </div>
              </div>
              
              {/* 第二栏：View Details按钮 */}
              <div className="flex justify-center">
                <button
                  type="button"
                  className="text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline px-3 py-1 transition-colors duration-150"
                  style={{ height: '28px', lineHeight: '18px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewDetails();
                  }}
                >
                  {language === 'zh' ? '职位详情' : 'Job Details'}
                </button>
              </div>
              
              {/* 第三栏：Apply按钮 */}
              <div className="flex justify-center">
                {renderCustomActions ? (
                  renderCustomActions()
                ) : (
                  <>
                    {job.url && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline px-3 py-1 transition-colors duration-150"
                        style={{ height: '28px', lineHeight: '18px' }}
                        onClick={e => {
                          e.stopPropagation();
                          window.open(job.url, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        {language === 'zh' ? '申请链接' : 'Apply Link'}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* 第四栏：Tailored Resume按钮 */}
              <div className="flex justify-center">
                <button
                  type="button"
                  className={`text-xs font-semibold rounded px-3 py-1 transition-colors duration-150 shadow-sm ${
                    hasTailoredResume 
                      ? 'bg-green-100 text-blue-700 hover:bg-green-200 hover:underline' 
                      : 'bg-orange-300 text-blue-700 hover:bg-orange-400 hover:underline'
                  } ${isLoadingTailoredResume ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{ height: '28px', lineHeight: '18px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTailoredResumeClick();
                  }}
                  disabled={isLoadingTailoredResume}
                >
                  {isLoadingTailoredResume ? (
                    <span className="inline-flex items-center">
                      <svg className="animate-spin -ml-1 mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {language === 'zh' ? '检查中...' : 'Checking...'}
                    </span>
                  ) : hasTailoredResume ? (
                    language === 'zh' ? '查看定制简历' : 'View Tailored Resume'
                  ) : (
                    language === 'zh' ? 'Go Resume Tailor' : 'Go Resume Tailor'
                  )}
                </button>
              </div>

              {/* 第五栏：Tailored Cover Letter按钮 */}
              <div className="flex justify-center">
                {application?.coverLetter?.downloadUrl ? (
                  <button
                    type="button"
                    className="text-xs font-semibold bg-green-100 text-blue-700 hover:bg-green-200 hover:underline rounded px-3 py-1 transition-colors duration-150 shadow-sm cursor-pointer"
                    style={{ height: '28px', lineHeight: '18px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // 在新标签页中查看Cover Letter PDF
                      // 将下载URL转换为查看URL
                      if (application.coverLetter?.downloadUrl) {
                        const viewUrl = application.coverLetter.downloadUrl.replace('/download-cover-letter/', '/view-cover-letter/');
                        window.open(viewUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    {language === 'zh' ? '查看求职信' : 'View Cover Letter'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-xs font-semibold bg-orange-300 text-blue-700 hover:bg-orange-400 hover:underline rounded px-3 py-1 transition-colors duration-150 shadow-sm"
                    style={{ height: '28px', lineHeight: '18px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // 如果没有Cover Letter数据，跳转到Jobs页面的对应Job
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
                    }}
                  >
                    {language === 'zh' ? 'Go Cover Letter Tailor' : 'Go Cover Letter Tailor'}
                  </button>
                )}
              </div>

              {/* 第六栏：Applied状态选择器 */}
              <div className="flex justify-center">
                <select
                  className="text-xs border border-gray-300 rounded px-2 py-1 w-full max-w-[120px] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  style={{ height: '28px' }}
                  value={applicationStatus}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    console.log('Status changed to:', newStatus); // 添加调试日志
                    setApplicationStatus(newStatus); // 立即更新本地状态
                    syncApplicationStatus(newStatus); // 同步到MongoDB
                  }}
                >
                  <option value="not-applied" className="text-gray-600">
                    {language === 'zh' ? '未申请' : 'Not Applied'}
                  </option>
                  <option value="applied" className="text-blue-600">
                    {language === 'zh' ? '已申请' : 'Applied'}
                  </option>
                  <option value="interviewing" className="text-yellow-600">
                    {language === 'zh' ? '面试中' : 'Interviewing'}
                  </option>
                  <option value="rejected" className="text-red-600">
                    {language === 'zh' ? '已拒绝' : 'Rejected'}
                  </option>
                  <option value="accepted" className="text-green-600">
                    {language === 'zh' ? '已接受' : 'Accepted'}
                  </option>
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
