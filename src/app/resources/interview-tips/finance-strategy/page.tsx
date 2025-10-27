import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Finance & Strategy Interview Tips - Complete Guide | Héra AI',
  description: 'Master Finance and Strategy interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Investment Banking, Consulting, PE, and Corporate Finance roles in Australia.',
  keywords: 'Finance jobs Australia, Strategy consulting, Investment Banking interview tips, Management consulting Australia, Private Equity jobs, Corporate Finance roles, Héra AI career guide, AI career agent, job interview preparation Australia',
  openGraph: {
    title: 'Finance & Strategy Interview Tips - Complete Guide | Héra AI',
    description: 'Master Finance and Strategy interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Investment Banking, Consulting, PE, and Corporate Finance roles in Australia.',
    type: 'article',
    url: 'https://www.heraai.net.au/resources/interview-tips/finance-strategy',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80',
        width: 1200,
        height: 630,
        alt: 'Finance & Strategy Interview Tips',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Finance & Strategy Interview Tips - Complete Guide | Héra AI',
    description: 'Master Finance and Strategy interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Investment Banking, Consulting, PE, and Corporate Finance roles in Australia.',
    images: ['https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80'],
  },
  alternates: {
    canonical: 'https://www.heraai.net.au/resources/interview-tips/finance-strategy',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function FinanceStrategyPage() {
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "TechArticle",
    "headline": "Finance & Strategy Interview Tips - Complete Guide | Héra AI",
    "description": "Master Finance and Strategy interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Investment Banking, Consulting, PE, and Corporate Finance roles in Australia.",
    "author": {
      "@type": "Organization",
      "name": "Héra AI",
      "url": "https://www.heraai.net.au",
      "description": "Leading AI Agent for candidates providing tailored interview tips and career insights"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Héra AI",
      "url": "https://www.heraai.net.au",
      "description": "The AI Career Agent Trusted by Jobseekers in Australia and Beyond",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.heraai.net.au/logo.png"
      }
    },
    "keywords": ["Finance jobs Australia", "Strategy consulting", "Investment Banking interview tips", "Management consulting Australia", "Private Equity jobs", "Corporate Finance roles", "Héra AI career guide", "AI career agent", "job interview preparation Australia"],
    "datePublished": "2025-10-28",
    "dateModified": "2025-10-28",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://www.heraai.net.au/resources/interview-tips/finance-strategy"
    },
    "image": {
      "@type": "ImageObject",
      "url": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80",
      "width": 1200,
      "height": 630,
      "alt": "Finance & Strategy Interview Tips"
    }
  };

  const financeStrategyData = {
    articles: [
      {
        id: 'f1',
        title: 'EP1. Top 10 Interview Questions & Tips for Finance/Accounting Roles with Deloitte',
        thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-09-01',
        description: 'Master Deloitte Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
        url: '/resources/interview-tips/finance-strategy/deloitte-finance'
      },
      {
        id: 'f2',
        title: 'EP2. Top 10 Interview Questions & Tips for Finance/Accounting Roles with PwC',
        thumbnail: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-09-02',
        description: 'Master PwC Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
        url: '/resources/interview-tips/finance-strategy/pwc-finance'
      },
      {
        id: 'f3',
        title: 'EP3. Top 10 Interview Questions & Tips for Finance/Accounting Roles with EY',
        thumbnail: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-09-03',
        description: 'Master EY Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
        url: '/resources/interview-tips/finance-strategy/ey-finance'
      },
      {
        id: 'f4',
        title: 'EP4. Top 10 Interview Questions & Tips for Finance/Accounting Roles with KPMG',
        thumbnail: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-09-04',
        description: 'Master KPMG Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
        url: '/resources/interview-tips/finance-strategy/kpmg-finance'
      },
      {
        id: 'f5',
        title: 'EP5. Top 10 Interview Questions & Tips for Finance/Accounting Roles with Westpac',
        thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-09-05',
        description: 'Master Westpac Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
        url: '/resources/interview-tips/finance-strategy/westpac-finance'
      },
      {
        id: 'f6',
        title: 'EP6. Top 10 Interview Questions & Tips for Finance/Accounting Roles with ANZ',
        thumbnail: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-09-06',
        description: 'Master ANZ Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
        url: '/resources/interview-tips/finance-strategy/anz-finance'
      },
      {
        id: 'f7',
        title: 'EP7. Top 10 Interview Questions & Tips for Finance/Accounting Roles with Commonwealth Bank',
        thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-09-07',
        description: 'Master Commonwealth Bank Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
        url: '/resources/interview-tips/finance-strategy/commbank-finance'
      },
      {
        id: 'f8',
        title: 'EP8. Top 10 Interview Questions & Tips for Finance/Accounting Roles with Macquarie Group',
        thumbnail: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-09-08',
        description: 'Master Macquarie Group Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
        url: '/resources/interview-tips/finance-strategy/macquarie-finance'
      },
      {
        id: 'f9',
        title: 'EP9. Top 10 Interview Questions & Tips for Finance/Accounting Roles with NAB',
        thumbnail: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-09-09',
        description: 'Master NAB Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
        url: '/resources/interview-tips/finance-strategy/nab-finance'
      },
      {
        id: 'f10',
        title: 'EP10. Top 10 Interview Questions & Tips for Finance/Accounting Roles with AMP',
        thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-09-10',
        description: 'Master AMP Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
        url: '/resources/interview-tips/finance-strategy/amp-finance'
      },
      {
        id: 'f11',
        title: 'EP11. Top 10 Interview Questions & Tips for Finance/Accounting Roles with BHP',
        thumbnail: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-09-11',
        description: 'Master BHP Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
        url: '/resources/interview-tips/finance-strategy/bhp-finance'
      },
      {
        id: 'f12',
        title: 'EP12. Top 10 Interview Questions & Tips for Finance/Accounting Roles with Telstra',
        thumbnail: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-09-12',
        description: 'Master Telstra Finance and Accounting interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Finance roles in Australia.',
        url: '/resources/interview-tips/finance-strategy/telstra-finance'
      }
    ]
  };

  return (
    <>
      {/* JSON-LD Structured Data */}
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
            <span className="text-gray-900">Finance & Strategy</span>
          </nav>
        </div>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Finance & Strategy Interview Tips</h1>
            <p className="text-xl text-gray-600">
              Master Finance and Strategy interviews with expert tips from professionals who got hired. Real Q&As, preparation strategies, and insider advice for Investment Banking, Consulting, PE, and Corporate Finance roles in Australia.
            </p>
          </div>

          {/* Articles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {financeStrategyData.articles.map((article) => (
              <Link
                key={article.id}
                href={article.url}
                className="group bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200"
              >
                <div className="aspect-video bg-gray-100 relative">
                  <img
                    src={article.thumbnail}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-gray-600 text-xs mb-3 line-clamp-3">
                    {article.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{article.createdAt}</span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                      Article
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Newsletter Signup */}
          <section className="mt-12 p-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Stay Updated with Héra AI — The AI Career Agent Trusted by Jobseekers in Australia and Beyond</h2>
            <p className="text-gray-700 mb-6">
              Héra AI provides tailored interview tips, career insights, and job opportunities for students and professionals across Australia — and beyond.
              <br/><br/>
              Get weekly updates packed with actionable advice, career growth tools, and hiring trends.
              <br/><br/>
              Join thousands of ambitious jobseekers building their future with Héra AI.
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
                <Link
                  href="/resources"
                  className="text-gray-600 hover:text-gray-800 font-medium underline"
                >
                  Explore More Career Resources
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
