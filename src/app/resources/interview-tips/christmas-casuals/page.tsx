import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Christmas Casual Interview Tips - Complete Guide | Héra AI',
  description: 'Master Christmas Casual interviews with expert tips from students who got hired. Real Q&As, preparation strategies, and insider advice for Australian retail jobs.',
  keywords: 'Christmas Casual jobs, retail interview tips, holiday employment, Australian retail jobs, Christmas jobs, seasonal employment',
  openGraph: {
    title: 'Christmas Casual Interview Tips - Complete Guide | Héra AI',
    description: 'Master Christmas Casual interviews with expert tips from students who got hired. Real Q&As, preparation strategies, and insider advice for Australian retail jobs.',
    type: 'article',
    url: 'https://www.heraai.net.au/resources/interview-tips/christmas-casuals',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80',
        width: 1200,
        height: 630,
        alt: 'Christmas Casual Interview Tips',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Christmas Casual Interview Tips - Complete Guide | Héra AI',
    description: 'Master Christmas Casual interviews with expert tips from students who got hired. Real Q&As, preparation strategies, and insider advice for Australian retail jobs.',
    images: ['https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80'],
  },
};

export default function ChristmasCasualsPage() {
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "TechArticle",
    "headline": "Christmas Casual Interview Tips - Complete Guide",
    "description": "Master Christmas Casual interviews with expert tips from students who got hired. Real Q&As, preparation strategies, and insider advice for Australian retail jobs.",
    "author": {
      "@type": "Organization",
      "name": "Héra AI",
      "url": "https://www.heraai.net.au"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Héra AI",
      "url": "https://www.heraai.net.au",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.heraai.net.au/logo.png"
      }
    },
    "keywords": ["Christmas Casual jobs", "retail interview tips", "holiday employment", "Australian retail jobs", "Christmas jobs", "seasonal employment"],
    "datePublished": "2025-10-23",
    "dateModified": "2025-10-23",
    "mainEntityOfPage": "https://www.heraai.net.au/resources/interview-tips/christmas-casuals",
    "image": "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80"
  };

  const christmasCasuals = [
    {
      id: '1',
      title: 'EP1. Lululemon Christmas Casual Interview Tips',
      thumbnail: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
      createdAt: '2025-10-01',
      description: 'Lululemon\'s Christmas casual hiring process is known for being fast, friendly, and experience-focused. Get insider tips from the 2025 hiring season.',
      url: '/resources/interview-tips/christmas-casuals/lululemon'
    },
    {
      id: '2',
      title: 'EP2. David Jones Christmas Casual Interview Tips',
      thumbnail: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
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
      description: 'JB Hi-Fi\'s Christmas casual recruitment process is energetic, interactive, and team-oriented. The company looks for candidates who are enthusiastic, proactive, and passionate about technology.',
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
    },
    // Placeholder articles - Row 1
    {
      id: '9',
      title: 'How to Ace Christmas Casual Job Interviews in Australia',
      thumbnail: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
      createdAt: '2025-10-23',
      description: 'A practical, Australia-focused guide to Christmas casual jobs in 2025: interview tips, sample answers, what hiring managers want, and a quick prep checklist.',
      url: '/resources/interview-tips/christmas-casuals/how-to-ace-christmas-casual-job-interviews-in-australia',
      isArticle: true
    },
    {
      id: '9.5',
      title: '🇦🇺 Walk-in Job Hunting Guide in Australia',
      thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
      createdAt: '2025-10-23',
      description: 'Part-Time Job Tips | How to Nail a Walk-In Job Search (and Avoid the Traps!). Master walk-in job hunting with expert tips from students who got hired.',
      url: '/resources/interview-tips/christmas-casuals/walk-in-job-hunting-guide-australia',
      isArticle: true
    }
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-white">
        <div className="border-b border-gray-200 bg-white fixed top-0 left-0 w-full z-50 shadow-sm h-[56px]">
          <nav className="flex justify-between items-center px-6 h-[56px]">
            <div className="flex space-x-6">
              <Link href="/" className="flex items-center space-x-2">
                <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">Héra AI</span>
              </Link>
              <div className="hidden md:flex space-x-6">
                <Link href="/profile" className="border-b-2 border-transparent h-[56px] flex items-center text-[18px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">Profile</Link>
                <Link href="/jobs" className="border-b-2 border-transparent h-[56px] flex items-center text-[18px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">Jobs</Link>
                <Link href="/applications" className="border-b-2 border-transparent h-[56px] flex items-center text-[18px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">Applications</Link>
                <Link href="/resources" className="border-b-2 border-blue-500 h-[56px] flex items-center text-[18px] font-medium text-blue-600">Resources</Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* AccountSettingIcon or other user-related components */}
            </div>
          </nav>
        </div>
        <div className="mt-14 pt-4 px-6">
          <nav className="text-sm text-gray-500">
            <Link href="/resources" className="hover:text-gray-700">Resources</Link>
            <span className="mx-2">/</span>
            <Link href="/resources/interview-tips" className="hover:text-gray-700">Interview Tips</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">Christmas Casuals</span>
          </nav>
        </div>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Christmas Casual Interview Tips
            </h1>
            <p className="text-xl text-gray-600 mb-6">
              Master Christmas Casual interviews with expert tips from students who got hired. 
              Real Q&As, preparation strategies, and insider advice for Australian retail jobs.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Christmas Casual jobs', 'retail interview tips', 'holiday employment', 'Australian retail jobs'].map((tag, index) => (
                <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </header>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">All Christmas Casual Interview Guides</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {christmasCasuals.map((video) => (
                <Link
                  key={video.id}
                  href={video.url}
                  className="block bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* 图片缩略图 */}
                  <div className="aspect-video bg-gray-100 relative">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                    {/* 播放按钮覆盖层 - 仅对视频显示 */}
                    {!video.isArticle && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 hover:bg-opacity-30 transition-all">
                        <div className="w-12 h-12 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </div>
                    )}
                    {/* 文章标识 - 仅对文章显示 */}
                    {video.isArticle && (
                      <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
                        Article
                      </div>
                    )}
                  </div>
                  
                  {/* 视频信息 */}
                  <div className="p-4 space-y-2">
                    {/* 标题和创建时间 */}
                    <div className="space-y-1">
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
                        {video.title}
                      </h3>
                      <p className="text-xs text-gray-500">
                        📅 {video.createdAt}
                      </p>
                    </div>
                    
                    {/* 简介 */}
                    <p className="text-xs text-gray-600 line-clamp-3">
                      {video.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-12 p-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Stay Updated with Héra AI</h2>
            <p className="text-gray-700 mb-6">
              Get weekly career tips, job opportunities, and interview strategies delivered to your inbox. 
              Join thousands of Australian students and graduates who are advancing their careers with Héra AI.
            </p>
            <div className="space-y-4">
              <form className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Subscribe Now
                </button>
              </form>
              <div className="flex justify-center">
                <Link href="/resources" className="text-gray-600 hover:text-gray-800 font-medium underline">Browse More Resources</Link>
              </div>
            </div>
          </section>

          <footer className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Written by Héra AI Career Team | Updated October 23, 2025 |
              <Link href="/privacy" className="text-blue-600 hover:text-blue-800 ml-2">Privacy Policy</Link>
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
