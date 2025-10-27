import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Tech Interview Tips - Complete Guide | Héra AI',
  description: 'Master tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
  keywords: 'tech interview tips, software engineering interviews, tech job interviews, Australian tech jobs, coding interviews, tech career',
  openGraph: {
    title: 'Tech Interview Tips - Complete Guide | Héra AI',
    description: 'Master tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
    type: 'article',
    url: 'https://www.heraai.net.au/resources/interview-tips/tech-interviews',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80',
        width: 1200,
        height: 630,
        alt: 'Tech Interview Tips',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tech Interview Tips - Complete Guide | Héra AI',
    description: 'Master tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.',
    images: ['https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80'],
  },
};

export default function TechInterviewsPage() {
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "TechArticle",
    "headline": "Tech Interview Tips - Complete Guide",
    "description": "Master tech interviews with expert tips from engineers who got hired. Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.",
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
    "keywords": ["tech interview tips", "software engineering interviews", "tech job interviews", "Australian tech jobs", "coding interviews", "tech career"],
    "datePublished": "2025-10-25",
    "dateModified": "2025-10-25",
    "mainEntityOfPage": "https://www.heraai.net.au/resources/interview-tips/tech-interviews",
    "image": "https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80"
  };

  const techInterviews = [
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
            <span className="text-gray-900">Tech Interviews</span>
          </nav>
        </div>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Tech Interview Tips
            </h1>
            <p className="text-xl text-gray-600 mb-6">
              Master tech interviews with expert tips from engineers who got hired. 
              Real Q&As, preparation strategies, and insider advice for all tech jobs in Australia.
            </p>
            <div className="flex flex-wrap gap-2">
              {['tech interview tips', 'software engineering interviews', 'tech job interviews', 'Australian tech jobs'].map((tag, index) => (
                <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </header>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">All Tech Interview Guides</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {techInterviews.map((video) => (
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
              Written by Héra AI Career Team | Updated October 25, 2025 |
              <Link href="/privacy" className="text-blue-600 hover:text-blue-800 ml-2">Privacy Policy</Link>
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}

