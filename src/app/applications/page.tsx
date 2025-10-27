"use client";

import React, { useEffect, useState, useRef } from "react";
import { Logo } from "@/components/Logo";
import Link from "next/link";
import { ApplicationJobCard } from "@/components/ApplicationJobCard";
import AutoApplyTip from '@/components/AutoApplyTip';
import { Settings } from 'lucide-react';
import { AccountSettingIcon } from '@/components/AccountSettingIcon';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';


interface Application {
  jobId: string;
  jobSave?: {
    title: string;
    company: string;
  };
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
  createdAt: string;
  updatedAt: string;
  userEmail: string;
  userFirstName: string;
  userLastName: string;
  userJobTitle: string;
  userLocation: string;
}

interface UserProfile {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  location: string;
  jobSearches?: Array<{
    id: string;
    jobTitle: string;
    location: string;
    timestamp: string;
  }>;
  resumes?: Array<{
    id: string;
    filename?: string;
    name?: string;
    createdAt: string;
    updatedAt?: string;
    downloadUrl?: string;
  }>;
}

export default function ApplicationsPage() {
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  const [applications, setApplications] = useState<Application[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // 使用Premium状态hook
  const premiumStatus = usePremiumStatus();
  


  // 获取用户Profile、Applications数据和SavedJobs
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // 从localStorage获取savedJobs
        const savedJobsStr = localStorage.getItem('savedJobs');
        if (savedJobsStr) {
          try {
            const jobs = JSON.parse(savedJobsStr);
            setSavedJobs(jobs);
          } catch (error) {
            console.error('Error parsing savedJobs:', error);
            setSavedJobs([]);
          }
        }
        
        // 从localStorage获取用户email
        const userProfileStr = localStorage.getItem('userProfile');
        if (!userProfileStr) {
          setError('User profile not found. Please log in first.');
          setIsLoading(false);
          return;
        }
        
        const localProfile = JSON.parse(userProfileStr);
        const email = localProfile.email;
        
        if (!email) {
          setError('User email not found. Please complete your profile.');
          setIsLoading(false);
          return;
        }
        
        // 调用API获取MongoDB数据
        const response = await fetch(`/api/applications?email=${encodeURIComponent(email)}`);
        if (!response.ok) {
          throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        if (data.success) {
          setApplications(data.applications);
          setUserProfile(data.userProfile);
          setRetryCount(0); // 重置重试计数
        } else {
          // 检查是否是Profile not found错误
          if (data.message === 'Profile not found') {
            if (retryCount < 3) {
              // 前三次显示"Sync in progress"提示
              setError('Sync in progress — wait a few seconds and refresh to proceed.');
              setRetryCount(prev => prev + 1);
            } else {
              // 第四次显示Profile incomplete并引导去Profile页面
              setError('Profile incomplete — please review your profile before proceeding');
            }
          } else {
            setError(data.message || 'Failed to fetch applications');
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 bg-white fixed top-0 left-0 w-full z-50 shadow-sm h-[56px]">
        <nav className="flex justify-between items-center px-6 h-[56px]">
          <div className="flex space-x-6">
            <Logo />
            <div className="hidden md:flex space-x-6">
              <Link href="/profile" className="border-b-2 border-transparent h-[56px] flex items-center text-[18px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
                Profile
              </Link>
              <Link href="/jobs" className="border-b-2 border-transparent h-[56px] flex items-center text-[18px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
                Jobs
              </Link>
              <Link href="/applications" className="border-b-2 border-blue-500 h-[56px] flex items-center text-[18px] font-medium text-blue-600">
                Applications
              </Link>
              <Link href="/resources" className="border-b-2 border-transparent h-[56px] flex items-center text-[18px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
                Resources
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
                          <AccountSettingIcon 
                isPremium={premiumStatus.isPremium}
                className="ml-8"
                expiresAt={premiumStatus.expiresAt}
                expiresAtAEST={premiumStatus.expiresAtAEST}
              />
            {/* 语言栏暂时注释掉 - 这一版本不上线中文
            <select
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-9"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'zh')}
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
            */}
          </div>
        </nav>
      </div>

      <div className="mt-14 flex flex-col lg:flex-row w-full max-w-[1440px] mx-auto px-4 lg:px-3 gap-4">
        {/* 左侧 Job List 区域 */}
        <div className="flex-1 lg:flex-[1.4] min-w-0 overflow-y-auto min-h-[calc(100vh-64px)]">
          <div className="bg-white">
            <div className="w-full">
              <div className="sticky top-0 bg-white z-10 p-2 pt-2 border-b border-gray-200">
                                  <div className="flex flex-col space-y-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        {language === 'zh' ? '申请记录' : 'Applications'}
                      </h2>
                      <AutoApplyTip />
                    </div>
                    <span className="text-sm text-gray-500">
                      {savedJobs.length} {language === 'zh' ? '个职位' : 'jobs'}
                    </span>
                  </div>
                </div>
              </div>
              
              {isLoading ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">
                    {language === 'zh' ? '加载中...' : 'Loading applications...'}
                  </p>
                </div>
              ) : error ? (
                <div className="text-center py-12 px-4">
                  <p className="text-gray-600 mb-4">{error}</p>
                  {error === 'Profile incomplete — please review your profile before proceeding' ? (
                    // Profile incomplete 状态 - 显示去Profile页面按钮
                    <Link
                      href="/profile"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {language === 'zh' ? '完善个人资料' : 'Complete Profile'}
                    </Link>
                  ) : null}
                </div>
              ) : savedJobs.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {savedJobs.map((job, index) => {
                    // 查找匹配的MongoDB application数据
                    const matchingApplication = applications.find(app => app.jobId === job.id);
                    
                    return (
                      <ApplicationJobCard
                        key={job.id + '-' + (job.platform || 'unknown')}
                        job={job}
                        language={language}
                        isSelected={false}
                        onSelect={() => {}}
                        onViewDetails={() => {}}
                        userProfile={{
                          email: userProfile?.email,
                          jobTitles: job.title ? [job.title] : [],
                          skills: job.skills || [],
                          city: job.location || '',
                          seniority: job.experience || '',
                          openToRelocate: false
                        }}
                        cardId={`job-card-${job.id}`}
                        application={matchingApplication}

                      />
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 px-4">
                  <p className="text-gray-500">
                    {language === 'zh'
                      ? '暂无已保存职位。请在职位页面保存您感兴趣的职位。'
                      : 'No saved jobs yet. Please save jobs from the Jobs page.'}
                  </p>
                  <Link
                    href="/jobs"
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {language === 'zh' ? '去职位页面' : 'Go to Jobs'}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧 Computer 终端 */}
        <div className="hidden lg:block lg:flex-[0.6] max-w-[420px] shrink-0 h-screen sticky top-0 border-l border-gray-200 overflow-y-auto">
          <div className="h-screen sticky top-0">
            {/* Hera Computer 框 - 较矮，容纳10行 */}
            <div className="p-4 pt-2 bg-white">
              <h2 className="text-base font-semibold text-gray-700 mb-2">My Resume</h2>
              <div className="bg-white rounded-lg p-4 border border-gray-200 w-full max-w-full min-h-[350px]">
                {userProfile?.resumes && userProfile.resumes.length > 0 ? (
                  <div className="space-y-3">
                    {userProfile.resumes
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, 5)
                      .map((resume, index) => {
                        // 构建完整的查看URL，包含email参数
                        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
                        const downloadUrl = resume.downloadUrl || `${baseUrl}/api/download-resume/${resume.id}`;
                        // 将下载URL转换为查看URL
                        const viewUrl = downloadUrl.replace('/download-resume/', '/view-resume/');
                        const fullViewUrl = `${viewUrl}?email=${encodeURIComponent(userProfile.email)}`;
                        
                        return (
                          <div key={resume.id} className="text-xs text-gray-700 pb-2 border-b border-gray-100 last:border-b-0">
                            <div className="flex items-center justify-between">
                              <div className="text-gray-900">
                                {resume.filename || resume.name || `Resume ${index + 1}`}
                              </div>
                              <button
                                onClick={() => window.open(fullViewUrl, '_blank')}
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                View
                              </button>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {new Date(resume.createdAt).toLocaleDateString('en-AU', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                            {resume.updatedAt && (
                              <div className="text-xs text-gray-400">
                                {new Date(resume.updatedAt).toLocaleDateString('en-AU', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">
                    {language === 'zh' ? '暂无简历记录。' : 'No resume records available.'}
                  </div>
                )}
              </div>
            </div>

            {/* Historical Search 框 */}
            <div className="p-4 bg-white">
              <h2 className="text-base font-semibold text-gray-700 mb-2">Historical Search</h2>
              <div className="bg-white rounded-lg p-4 border border-gray-200 w-full max-w-full min-h-[400px]">
                {userProfile?.jobSearches && userProfile.jobSearches.length > 0 ? (
                  <div className="space-y-3">
                    {userProfile.jobSearches
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .slice(0, 5)
                      .map((search, index) => (
                        <div key={search.id} className="text-xs text-gray-700 pb-2 border-b border-gray-100 last:border-b-0">
                          <div className="text-gray-900">{search.jobTitle}</div>
                          <div className="text-gray-600">{search.location}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(search.timestamp).toLocaleDateString('en-AU', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">
                    {language === 'zh' ? '暂无搜索历史记录。' : 'No search history available.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      

    </div>
  );
}

function getPlatformSearchUrl(job: { platform: string; title: string }) {
  if (!job.platform || !job.title) return '#';
  const title = encodeURIComponent(job.title);
  switch (job.platform.toLowerCase()) {
    case 'linkedin':
      return `https://www.linkedin.com/jobs/search/?keywords=${title}`;
    case 'seek':
      return `https://www.seek.com.au/jobs?keywords=${title}`;
    case 'jora':
      return `https://au.jora.com/j?search_query=${title}`;
    case 'adzuna':
      return `https://www.adzuna.com.au/search?q=${title}`;
    default:
      return '#';
  }
} 