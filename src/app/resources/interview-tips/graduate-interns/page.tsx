import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Graduate & Interns Interview Tips - Complete Guide | Héra AI',
  description: 'Master Graduate Program and Internship interviews with expert tips from students who got hired. Real Q&As, preparation strategies, and insider advice for Australian graduate jobs.',
  keywords: 'Graduate Program jobs, Internship jobs, graduate interview tips, Australian graduate jobs, internship interview tips, graduate employment, Héra AI career guide',
  openGraph: {
    title: 'Graduate & Interns Interview Tips - Complete Guide | Héra AI',
    description: 'Master Graduate Program and Internship interviews with expert tips from students who got hired. Real Q&As, preparation strategies, and insider advice for Australian graduate jobs.',
    type: 'article',
    url: 'https://www.heraai.net.au/resources/interview-tips/graduate-interns',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80',
        width: 1200,
        height: 630,
        alt: 'Graduate & Interns Interview Tips',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Graduate & Interns Interview Tips - Complete Guide | Héra AI',
    description: 'Master Graduate Program and Internship interviews with expert tips from students who got hired. Real Q&As, preparation strategies, and insider advice for Australian graduate jobs.',
    images: ['https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80'],
  },
};

export default function GraduateInternsPage() {
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "TechArticle",
    "headline": "Graduate & Interns Interview Tips - Complete Guide",
    "description": "Master Graduate Program and Internship interviews with expert tips from students who got hired. Real Q&As, preparation strategies, and insider advice for Australian graduate jobs.",
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
    "keywords": ["Graduate Program jobs", "Internship jobs", "graduate interview tips", "Australian graduate jobs", "internship interview tips", "graduate employment"],
    "datePublished": "2025-10-23",
    "dateModified": "2025-10-23",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://www.heraai.net.au/resources/interview-tips/graduate-interns"
    }
  };

  const graduateInternsData = {
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
        title: 'EP2. Macquarie Group Summer Internship Interview Tips',
        thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-10-24',
        description: 'Learn how to ace Macquarie Group Summer Internship interviews with insider tips and preparation strategies for Finance, Tech, and Risk roles.',
        url: '/resources/interview-tips/graduate-interns/macquarie'
      },
      {
        id: 'g3',
        title: 'EP3. Canva Internship Program Interview Tips',
        thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-10-25',
        description: 'Master Canva Internship Program interviews with expert tips for Design, Data, Engineering, and Marketing roles. Real insights from students who got hired.',
        url: '/resources/interview-tips/graduate-interns/canva'
      },
      {
        id: 'g4',
        title: 'EP4. UBS Australia GBM Summer Analyst Internship Interview Tips',
        thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-10-26',
        description: 'Master UBS Australia GBM Summer Analyst Internship interviews with expert tips for Global Banking and Markets roles. Real insights from students who got hired.',
        url: '/resources/interview-tips/graduate-interns/ubs'
      },
      {
        id: 'g5',
        title: 'EP5. Australian Government Graduate Intern Program Interview Tips',
        thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-10-27',
        description: 'Master Australian Government Graduate/Intern Program interviews with expert tips for digital innovation roles. Real insights from students who got hired.',
        url: '/resources/interview-tips/graduate-interns/telstra-government'
      },
      {
        id: 'g6',
        title: 'EP6. Atlassian Summer Internship Interview Tips',
        thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-10-28',
        description: 'Master Atlassian Summer Internship interviews with expert tips for Software Engineering, UX, Product, and Data roles. Real insights from students who got hired.',
        url: '/resources/interview-tips/graduate-interns/atlassian'
      },
      {
        id: 'g7',
        title: 'EP7. Telstra Career Start Edge Program Interview Tips',
        thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-10-29',
        description: 'Master Telstra Career Start Edge Program interviews with expert tips for Tech, Engineering, and Finance roles. Real insights from students who got hired.',
        url: '/resources/interview-tips/graduate-interns/telstra'
      },
      {
        id: 'g8',
        title: 'EP8. Deloitte Australia Vacationer Program Interview Tips',
        thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-10-30',
        description: 'Master Deloitte Australia Vacationer Program interviews with expert tips for Audit & Assurance roles. Real insights from students who got hired.',
        url: '/resources/interview-tips/graduate-interns/deloitte'
      },
      // Articles - Row 1
      {
        id: 'ga1',
        title: 'Deloitte Consulting Vacationer Program Interview Guide',
        thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-10-30',
        description: 'Master Deloitte Consulting Vacationer Program interviews with expert tips for Strategy, Operations, and Tech Consulting roles. Real insights from students who got hired.',
        url: '/resources/interview-tips/graduate-interns/deloitte-consulting',
        isArticle: true
      },
      {
        id: 'ga2',
        title: 'Deloitte Data & Analytics Vacationer Program Interview Guide',
        thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-10-30',
        description: 'Master Deloitte Data & Analytics Vacationer Program interviews with expert tips for data engineering, analytics, and visualization roles. Real insights from students who got hired.',
        url: '/resources/interview-tips/graduate-interns/deloitte-data',
        isArticle: true
      },
      {
        id: 'ga3',
        title: 'How to Ace Graduate Program Interviews in Australia',
        thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-10-23',
        description: 'A comprehensive guide to Graduate Program interviews in Australia: preparation strategies, common questions, and insider tips for success.',
        url: '/resources/interview-tips/graduate-interns/how-to-ace-graduate-program-interviews-australia',
        isArticle: true
      },
      {
        id: 'ga4',
        title: 'PwC Audit & Assurance Vacationer Program Interview Guide',
        thumbnail: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-10-27',
        description: 'Master PwC Audit & Assurance Vacationer Program interviews with expert tips for Audit, Risk, and Assurance roles. Real insights from students who got hired.',
        url: '/resources/interview-tips/graduate-interns/pwc-audit',
        isArticle: true
      },
      {
        id: 'ga5',
        title: 'PwC Consulting Vacationer Program Interview Guide',
        thumbnail: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-10-28',
        description: 'Master PwC Consulting Vacationer Program interviews with expert tips for Strategy, Operations, and Deals roles. Real insights from students who got hired.',
        url: '/resources/interview-tips/graduate-interns/pwc-consulting',
        isArticle: true
      },
      {
        id: 'ga6',
        title: 'PwC Technology Vacationer Program Interview Guide',
        thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        createdAt: '2025-10-28',
        description: 'Master PwC Technology Vacationer Program interviews with expert tips for Data & Analytics, Digital, and Technology roles. Real insights from students who got hired.',
        url: '/resources/interview-tips/graduate-interns/pwc-technology',
        isArticle: true
      }
    ]
  };

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
            <span className="text-gray-900">Graduate & Interns</span>
          </nav>
        </div>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Graduate & Interns Interview Tips
            </h1>
            <p className="text-xl text-gray-600 mb-6">
              Master Graduate Program and Internship interviews with expert tips from students who got hired. 
              Real Q&As, preparation strategies, and insider advice for Australian graduate jobs.
            </p>
          </header>

          {/* Videos Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
            {graduateInternsData.videos.map((video) => (
              <Link
                key={video.id}
                href={video.url}
                className="group bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow border border-gray-200"
              >
                <div className="aspect-video bg-gray-200 relative">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity duration-300 flex items-center justify-center">
                    <div className="w-12 h-12 bg-white bg-opacity-90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <svg className="w-6 h-6 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                  {video.isArticle && (
                    <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                      Article
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {video.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2 line-clamp-3">
                    {video.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{video.createdAt}</span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {video.url === '#' ? 'Coming Soon' : 'Available'}
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