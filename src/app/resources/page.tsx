"use client";

import React, { useState } from "react";
import { Logo } from "@/components/Logo";
import Link from "next/link";
import { AccountSettingIcon } from '@/components/AccountSettingIcon';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';

export default function ResourcesPage() {
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  const [activeTab, setActiveTab] = useState<string>('interview-tips');
  
  // 使用Premium状态hook
  const premiumStatus = usePremiumStatus();

  // 定义标签页
  const tabs = [
    { id: 'interview-tips', label: language === 'zh' ? '面试技巧' : 'Interview Tips' },
    { id: 'resume-tips', label: language === 'zh' ? '简历技巧' : 'Resume Tips' },
    { id: 'cheat-sheets', label: language === 'zh' ? '速查表' : 'Cheat Sheets' },
    { id: 'career-advice', label: language === 'zh' ? '职业建议' : 'Career Advice' },
    { id: 'work-meme', label: language === 'zh' ? '工作梗图' : 'Work Meme' }
  ];

  // Mock数据 - Interview Tips分类
  const interviewTipsData = {
    categories: [
      {
        name: 'Christmas Casuals',
        videos: [
          {
            id: '1',
            title: 'EP1. Lululemon Christmas Casual Interview Tips',
            thumbnail: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-10-01',
            description: 'Lululemon\'s Christmas casual hiring process is known for being fast, friendly, and experience-focused. Real interview insights from students who got hired.',
            url: '/resources/interview-tips/christmas-casuals/lululemon'
          },
          {
            id: '2',
            title: 'EP2. David Jones Christmas Casual Interview Tips',
            thumbnail: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-10-20',
            description: 'David Jones\' Christmas casual recruitment is structured yet friendly, designed to evaluate your communication, customer service mindset, and cultural fit.',
            url: '/resources/interview-tips/christmas-casuals/david-jones'
          },
          {
            id: '3',
            title: 'EP3. Myer Christmas Casual Interview Tips',
            thumbnail: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-10-10',
            description: 'Myer\'s Christmas casual recruitment process is efficient, structured, and welcoming. The company values a positive attitude, customer focus, and teamwork.',
            url: '/resources/interview-tips/christmas-casuals/myer'
          },
          {
            id: '4',
            title: 'EP4. JB Hi-Fi Christmas Casual Interview Tips',
            thumbnail: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-10-08',
            description: 'JB Hi-Fi\'s Christmas casual recruitment process is energetic, interactive, and team-oriented. The company looks for candidates who are enthusiastic and passionate about technology.',
            url: '/resources/interview-tips/christmas-casuals/jb-hi-fi'
          },
          {
            id: '5',
            title: 'EP5. Ralph Lauren Christmas Casual Interview Tips',
            thumbnail: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-10-05',
            description: 'Ralph Lauren\'s Christmas casual recruitment process emphasizes refinement, confidence, and customer connection. The interview flow is smooth and efficient.',
            url: '/resources/interview-tips/christmas-casuals/ralph-lauren'
          },
          {
            id: '6',
            title: 'EP6. Hugo Boss Christmas Casual Interview Tips',
            thumbnail: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-10-06',
            description: 'Hugo Boss\'s Christmas Casual recruitment process reflects the brand\'s premium yet approachable style — structured, fair, and focused on communication and confidence.',
            url: '/resources/interview-tips/christmas-casuals/hugo-boss'
          },
          {
            id: '7',
            title: 'EP7. David Jones Christmas Casual Logistics Interview Tips',
            thumbnail: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-10-07',
            description: 'David Jones\' Logistics Christmas Casual recruitment process is designed to assess teamwork, reliability, and service attitude — not just retail skills.',
            url: '/resources/interview-tips/christmas-casuals/david-jones-logistics'
          },
          {
            id: '8',
            title: 'EP8. MUJI Christmas Casual Interview Tips',
            thumbnail: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-09-10',
            description: 'MUJI\'s Christmas Casual recruitment emphasizes simplicity, teamwork, and calm professionalism — values that mirror the brand itself.',
            url: '/resources/interview-tips/christmas-casuals/muji'
          }
        ],
        totalCount: 10,
        showAll: true
      },
      {
        name: 'Graduate & Interns',
        videos: [
          {
            id: 'g1',
            title: 'EP1. Commonwealth Bank Summer Internship Interview Tips',
            thumbnail: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-10-23',
            description: 'Master Commonwealth Bank Summer Internship interviews with expert tips from students who got hired. Real Q&As, preparation strategies, and insider advice for Finance, Tech, Markets, and Cyber roles.',
            url: '/resources/interview-tips/graduate-interns/commonwealth-bank'
          },
          {
            id: 'g2',
            title: 'EP2. Westpac Graduate Program Interview Tips',
            thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-11-01',
            description: 'Learn how to ace Westpac Graduate Program interviews with insider tips and preparation strategies.',
            url: '/resources/interview-tips/graduate-interns/westpac'
          },
          {
            id: 'g3',
            title: 'EP3. ANZ Graduate Program Interview Tips',
            thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-11-02',
            description: 'Get ready for ANZ Graduate Program interviews with comprehensive preparation guides.',
            url: '/resources/interview-tips/graduate-interns/anz'
          },
          {
            id: 'g4',
            title: 'EP4. NAB Graduate Program Interview Tips',
            thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-11-03',
            description: 'Master NAB Graduate Program interviews with expert advice and real examples.',
            url: '/resources/interview-tips/graduate-interns/nab'
          },
          {
            id: 'g5',
            title: 'EP5. Deloitte Graduate Program Interview Tips',
            thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-11-04',
            description: 'Learn the secrets to succeeding in Deloitte Graduate Program interviews.',
            url: '/resources/interview-tips/graduate-interns/deloitte'
          },
          {
            id: 'g6',
            title: 'EP6. PwC Graduate Program Interview Tips',
            thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-11-05',
            description: 'Master PwC Graduate Program interviews with insider tips and strategies.',
            url: '/resources/interview-tips/graduate-interns/pwc'
          },
          {
            id: 'g7',
            title: 'EP7. EY Graduate Program Interview Tips',
            thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-11-06',
            description: 'Get ready for EY Graduate Program interviews with expert preparation guides.',
            url: '/resources/interview-tips/graduate-interns/ey'
          },
          {
            id: 'g8',
            title: 'EP8. KPMG Graduate Program Interview Tips',
            thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-11-07',
            description: 'Learn how to ace KPMG Graduate Program interviews with comprehensive tips.',
            url: '/resources/interview-tips/graduate-interns/kpmg'
          }
        ],
        totalCount: 14,
        showAll: true
      },
      {
        name: 'Finance & Strategy',
        videos: [
          {
            id: 'f1',
            title: 'EP1. Top 10 Interview Questions & Tips for Finance/Accounting Roles with Deloitte',
            thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-09-01',
            description: 'Master Deloitte Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
            url: '/resources/interview-tips/finance-strategy/deloitte-finance',
            isArticle: true
          },
          {
            id: 'f2',
            title: 'EP2. Top 10 Interview Questions & Tips for Finance/Accounting Roles with PwC',
            thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-09-02',
            description: 'Master PwC Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
            url: '/resources/interview-tips/finance-strategy/pwc-finance',
            isArticle: true
          },
          {
            id: 'f3',
            title: 'EP3. Top 10 Interview Questions & Tips for Finance/Accounting Roles with EY',
            thumbnail: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-09-03',
            description: 'Master EY Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
            url: '/resources/interview-tips/finance-strategy/ey-finance',
            isArticle: true
          },
          {
            id: 'f4',
            title: 'EP4. Top 10 Interview Questions & Tips for Finance/Accounting Roles with KPMG',
            thumbnail: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-09-04',
            description: 'Master KPMG Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
            url: '/resources/interview-tips/finance-strategy/kpmg-finance',
            isArticle: true
          },
          {
            id: 'f5',
            title: 'EP5. Top 10 Interview Questions & Tips for Finance/Accounting Roles with Westpac',
            thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-09-05',
            description: 'Master Westpac Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
            url: '/resources/interview-tips/finance-strategy/westpac-finance',
            isArticle: true
          },
          {
            id: 'f6',
            title: 'EP6. Top 10 Interview Questions & Tips for Finance/Accounting Roles with ANZ',
            thumbnail: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-09-06',
            description: 'Master ANZ Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
            url: '/resources/interview-tips/finance-strategy/anz-finance',
            isArticle: true
          },
          {
            id: 'f7',
            title: 'EP7. Top 10 Interview Questions & Tips for Finance/Accounting Roles with Commonwealth Bank',
            thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-09-07',
            description: 'Master Commonwealth Bank Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
            url: '/resources/interview-tips/finance-strategy/commbank-finance',
            isArticle: true
          },
          {
            id: 'f8',
            title: 'EP8. Top 10 Interview Questions & Tips for Finance/Accounting Roles with Macquarie Group',
            thumbnail: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-09-08',
            description: 'Master Macquarie Group Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
            url: '/resources/interview-tips/finance-strategy/macquarie-finance',
            isArticle: true
          }
        ],
        totalCount: 12,
        showAll: true
      },
      {
        name: 'Tech Interviews',
        videos: [
          {
            id: '9',
            title: 'EP1. SEEK Tech Interview Questions & Tips',
            thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-10-25',
            description: 'Master SEEK tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
            url: '/resources/interview-tips/tech-interviews/seek-tech-interview'
          },
          {
            id: '10',
             title: 'EP2. ANZ Tech Interview Questions & Tips',
             thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
             createdAt: '2025-10-25',
             description: 'Master ANZ tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
             url: '/resources/interview-tips/tech-interviews/anz-tech-interview'
           },
           {
             id: '11',
             title: 'EP3. Commonwealth Bank Tech Interview Questions & Tips',
             thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
             createdAt: '2025-10-25',
             description: 'Master Commonwealth Bank tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
             url: '/resources/interview-tips/tech-interviews/commbank-tech-interview'
           },
           {
             id: '12',
             title: 'EP4. Westpac Tech Interview Questions & Tips',
             thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
             createdAt: '2025-10-25',
             description: 'Master Westpac tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
             url: '/resources/interview-tips/tech-interviews/westpac-tech-interview'
           },
           {
             id: '13',
             title: 'EP5. NAB Tech Interview Questions & Tips',
             thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
             createdAt: '2025-10-25',
             description: 'Master NAB tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
             url: '/resources/interview-tips/tech-interviews/nab-tech-interview'
           },
           {
             id: '14',
             title: 'EP6. Telstra Tech Interview Questions & Tips',
             thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
             createdAt: '2025-10-25',
             description: 'Master Telstra tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
             url: '/resources/interview-tips/tech-interviews/telstra-tech-interview'
           },
           {
             id: '15',
             title: 'EP7. Macquarie Group Tech Interview Questions & Tips',
             thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
             createdAt: '2025-10-25',
             description: 'Master Macquarie Group tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
             url: '/resources/interview-tips/tech-interviews/macquarie-tech-interview'
           },
           {
             id: '16',
             title: 'EP8. Woolworths Group Tech Interview Questions & Tips',
             thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
             createdAt: '2025-10-25',
             description: 'Master Woolworths Group tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
             url: '/resources/interview-tips/tech-interviews/woolworths-tech-interview'
           },
           {
             id: '17',
             title: 'EP9. BHP Group Tech Interview Questions & Tips',
             thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
             createdAt: '2025-10-25',
             description: 'Master BHP Group tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
             url: '/resources/interview-tips/tech-interviews/bhp-tech-interview'
           },
           {
             id: '18',
             title: 'EP10. Rio Tinto Tech Interview Questions & Tips',
             thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
             createdAt: '2025-10-25',
             description: 'Master Rio Tinto tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
             url: '/resources/interview-tips/tech-interviews/rio-tinto-tech-interview'
           },
           {
             id: '19',
             title: 'EP11. Coles Tech Interview Questions & Tips',
             thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
             createdAt: '2025-10-25',
             description: 'Master Coles tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
             url: '/resources/interview-tips/tech-interviews/coles-tech-interview'
           },
           {
             id: '20',
             title: 'EP12. Atlassian Tech Interview Questions & Tips',
             thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
             createdAt: '2025-10-25',
             description: 'Master Atlassian tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
             url: '/resources/interview-tips/tech-interviews/atlassian-tech-interview'
           },
           {
             id: '21',
             title: 'EP13. Canva Tech Interview Questions & Tips',
             thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
             createdAt: '2025-10-25',
             description: 'Master Canva tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
             url: '/resources/interview-tips/tech-interviews/canva-tech-interview'
          },
          {
            id: '22',
            title: 'EP14. Domain Group Tech Interview Questions & Tips',
            thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-10-25',
            description: 'Master Domain Group tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
            url: '/resources/interview-tips/tech-interviews/domain-group-tech-interview'
          },
          {
            id: '23',
            title: 'EP15. Carsales Tech Interview Questions & Tips',
            thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-10-25',
            description: 'Master Carsales tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
            url: '/resources/interview-tips/tech-interviews/carsales-tech-interview'
          },
          {
            id: '24',
            title: 'EP16. Zip Co Tech Interview Questions & Tips',
            thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-10-25',
            description: 'Master Zip Co tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
            url: '/resources/interview-tips/tech-interviews/zip-co-tech-interview'
          },
          {
            id: '25',
            title: 'EP17. Afterpay Tech Interview Questions & Tips',
            thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            createdAt: '2025-10-25',
            description: 'Master Afterpay tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
            url: '/resources/interview-tips/tech-interviews/afterpay-tech-interview'
          }
        ],
        totalCount: 17,
        showAll: true
      }
    ]
  };

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
              <Link href="/applications" className="border-b-2 border-transparent h-[56px] flex items-center text-[18px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
                Applications
              </Link>
              <Link href="/resources" className="border-b-2 border-blue-500 h-[56px] flex items-center text-[18px] font-medium text-blue-600">
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

      <div className="mt-14 w-full max-w-[1440px] mx-auto px-4 lg:px-3">
        {/* 主要内容区域 */}
        <div className="w-full">
          <div className="bg-white">
            <div className="w-full">
              <div className="sticky top-0 bg-white z-10 p-3 border-b border-gray-200">
                {/* 标签页导航 - 参考Jobs页面样式 */}
                <div className="flex items-center gap-4">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`font-semibold hover:underline ${
                        activeTab === tab.id
                          ? 'text-gray-800'
                          : 'text-gray-500'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* 内容区域 - 根据选中的标签页显示不同内容 */}
              <div className="p-4">
                {activeTab === 'interview-tips' && (
                  <div className="space-y-6">
                    {interviewTipsData.categories.map((category, categoryIndex) => (
                      <div key={categoryIndex} className="space-y-3">
                        {/* 分类标题 */}
                        <h3 className="text-base font-semibold text-gray-900">
                          {category.name}
                        </h3>
                        
                        {/* 视频网格 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {category.videos.slice(0, 8).map((video) => (
                            <Link
                              key={video.id}
                              href={video.url}
                              className="block bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                            >
                              {/* 视频缩略图 */}
                              <div className="aspect-video bg-gray-100 relative">
                                <img
                                  src={video.thumbnail}
                                  alt={video.title}
                                  className="w-full h-full object-cover"
                                />
                                {/* 播放按钮覆盖层 */}
                                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 hover:bg-opacity-30 transition-all">
                                  <div className="w-12 h-12 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M8 5v14l11-7z"/>
                                    </svg>
                                  </div>
                                </div>
                              </div>
                              
                              {/* 视频信息 */}
                              <div className="p-3 space-y-2">
                                {/* 标题和创建时间 */}
                                <div className="space-y-1">
                                  <h4 className="font-medium text-gray-900 text-sm line-clamp-1">
                                    {video.title}
                                  </h4>
                                  <p className="text-xs text-gray-500">
                                    📅 {video.createdAt}
                                  </p>
                                </div>
                                
                                {/* 简介 */}
                                <p className="text-xs text-gray-600 line-clamp-2">
                                  {video.description}
                                </p>
                              </div>
                            </Link>
                          ))}
                        </div>
                        
                        {/* Show All 按钮 */}
                        {category.showAll && (
                          <div className="flex justify-end mt-0.5">
                            <Link 
                              href={
                                category.name === 'Christmas Casuals' ? '/resources/interview-tips/christmas-casuals' :
                                category.name === 'Graduate & Interns' ? '/resources/interview-tips/graduate-interns' :
                                category.name === 'Finance & Strategy' ? '/resources/interview-tips/finance-strategy' :
                                category.name === 'Tech Interviews' ? '/resources/interview-tips/tech-interviews' :
                                '#'
                              }
                              className="text-sm text-gray-600 font-medium hover:underline"
                            >
                              Show All ({category.totalCount})
                            </Link>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {activeTab === 'resume-tips' && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">
                      {language === 'zh' ? '简历技巧视频即将上线...' : 'Resume Tips videos coming soon...'}
                    </p>
                  </div>
                )}
                
                {activeTab === 'cheat-sheets' && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">
                      {language === 'zh' ? '速查表资源即将上线...' : 'Cheat Sheets resources coming soon...'}
                    </p>
                  </div>
                )}
                
                {activeTab === 'career-advice' && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">
                      {language === 'zh' ? '职业建议视频即将上线...' : 'Career Advice videos coming soon...'}
                    </p>
                  </div>
                )}
                
                {activeTab === 'work-meme' && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">
                      {language === 'zh' ? '工作梗图内容即将上线...' : 'Work Meme content coming soon...'}
                    </p>
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
