import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'PwC Technology Vacationer Program Interview Guide Australia 2025 | Héra AI Career Guide',
  description: '💻 Master PwC Technology Vacationer Program interviews with expert tips from students who got hired. Real Q&As, preparation strategies, and insider advice for Data & Analytics, Digital, and Technology roles in Australia.',
  keywords: 'PwC Technology jobs Australia, Vacationer Program, graduate interview tips, Australian graduate jobs, technology interview tips, data analytics Australia, digital transformation Australia, Héra AI career guide, AI career agent, job interview preparation Australia',
  openGraph: {
    title: 'PwC Technology Vacationer Program Interview Guide Australia 2025 | Héra AI Career Guide',
    description: '💻 Master PwC Technology Vacationer Program interviews with expert tips from students who got hired. Real Q&As, preparation strategies, and insider advice for Data & Analytics, Digital, and Technology roles in Australia.',
    type: 'article',
    url: 'https://www.heraai.net.au/resources/interview-tips/graduate-interns/pwc-technology',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80',
        width: 1200,
        height: 630,
        alt: 'PwC Technology Vacationer Program Interview Guide Australia 2025',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PwC Technology Vacationer Program Interview Guide Australia 2025 | Héra AI Career Guide',
    description: '💻 Master PwC Technology Vacationer Program interviews with expert tips from students who got hired. Real Q&As, preparation strategies, and insider advice for Data & Analytics, Digital, and Technology roles in Australia.',
    images: ['https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80'],
  },
  alternates: {
    canonical: 'https://www.heraai.net.au/resources/interview-tips/graduate-interns/pwc-technology',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PwCTechnologyPage() {
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "TechArticle",
    "headline": "PwC Technology Vacationer Program Interview Guide Australia 2025 | Héra AI Career Guide",
    "description": "Master PwC Technology Vacationer Program interviews with expert tips from students who got hired. Real Q&As, preparation strategies, and insider advice for Data & Analytics, Digital, and Technology roles in Australia.",
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
    "keywords": ["PwC Technology jobs Australia", "Vacationer Program", "graduate interview tips", "Australian graduate jobs", "technology interview tips", "data analytics Australia", "digital transformation Australia", "Héra AI career guide", "AI career agent", "job interview preparation Australia"],
    "datePublished": "2025-10-28",
    "dateModified": "2025-10-28",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://www.heraai.net.au/resources/interview-tips/graduate-interns/pwc-technology"
    },
    "image": {
      "@type": "ImageObject",
      "url": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80",
      "width": 1200,
      "height": 630,
      "alt": "PwC Technology Vacationer Program Interview Guide Australia 2025"
    }
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
            <Link href="/resources/interview-tips/graduate-interns" className="hover:text-gray-700">Graduate & Interns</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">PwC Technology</span>
          </nav>
        </div>
        <div className="max-w-4xl mx-auto px-6 py-8">
          <article className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* Article Header */}
            <div className="p-8 border-b border-gray-200">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                PwC Technology Vacationer Program Interview Guide
              </h1>
              <p className="text-xl text-gray-600 mb-6">
                Ready to drive digital transformation? PwC's Technology Vacationer Program immerses you in real client projects in data & analytics, digital transformation, and technology consulting. The program lasts 6–8 weeks and can lead directly to a graduate offer.
              </p>
              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Published: October 28, 2025</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Updated: October 28, 2025</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>By: Héra AI Career Team</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">PwC Technology</span>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">Data & Analytics</span>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">Digital Transformation</span>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">Technology Consulting</span>
              </div>
            </div>

            {/* Featured Image */}
            <div className="aspect-video bg-gray-100 relative">
              <img
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80"
                alt="PwC Technology Vacationer Program Interview Guide Australia 2025"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Article Content */}
            <div className="p-8">
              <div className="prose prose-lg max-w-none">
                <section className="mb-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">🎓 Program Snapshot & Eligibility</h2>
                  
                  <div className="bg-blue-50 p-6 rounded-lg mb-6">
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>The Vacationer Program offers ~6-8 weeks of paid work (often over summer) in Australia across technology and data & analytics streams.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>Applicants are usually penultimate-year students (or final year depending on stream) with eligibility to work in Australia.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>Examples of skill sets sought: data analysis, visualization, software development, cloud/analytics tools, and ability to apply tech solutions in business contexts.</span>
                      </li>
                    </ul>
                  </div>
                </section>

                <div className="bg-gray-100 h-px my-8"></div>

                <section className="mb-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">🧭 Recruitment Process (specific to Technology/Data)</h2>
                  
                  <div className="bg-green-50 p-6 rounded-lg mb-6">
                    <ol className="space-y-2 text-gray-700 list-decimal list-inside">
                      <li><strong>Online Application</strong> – Submit CV + academic transcript + motivation questions.</li>
                      <li><strong>Online Assessment/Game-Based Test</strong> – Measures cognitive, situational judgment and may include "mini game" or logic tasks.</li>
                      <li><strong>Video Interview</strong> – Pre-recorded or live, focusing on behavioral, situational and sometimes technical/data questions. For data streams: may include problem solving or describing data usage.</li>
                      <li><strong>Assessment Centre / Final Interview</strong> – For successful candidates: group case (sometimes tech/data focused), 1-on-1 interview with team lead/manager, possibly technical questioning (SQL, tools, methods) for analytics roles.</li>
                    </ol>
                  </div>
                </section>

                <div className="bg-gray-100 h-px my-8"></div>

                <section className="mb-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">💬 Sample Interview Questions (Technology/Data Track)</h2>
                  
                  <p className="text-gray-700 mb-4">
                    These are questions reported by real candidates for PwC's data/tech roles in Australia (and globally) — good to prepare.
                  </p>
                  
                  <div className="bg-yellow-50 p-6 rounded-lg mb-6">
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-600 mt-1">•</span>
                        <span>"Tell me about a time you used data to influence a decision."</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-600 mt-1">•</span>
                        <span>"Describe a technical challenge you faced in a team project and how you resolved it."</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-600 mt-1">•</span>
                        <span>"How do you keep up with new technology?" or "Which emerging technology do you think will most impact our business?"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-600 mt-1">•</span>
                        <span>"Tell me about a time you were given a vague piece of information, and you had to complete a task." (great for data/analytics context)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-600 mt-1">•</span>
                        <span>"You know that there will be overtime right? Are you okay with that?" (reported for analytics roles – shows workplace expectation)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-600 mt-1">•</span>
                        <span>"Why do you want to work for PwC in Technology / Data & Analytics?" – behavioral and motivation question.</span>
                      </li>
                    </ul>
                  </div>
                </section>

                <div className="bg-gray-100 h-px my-8"></div>

                <section className="mb-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">✅ Tips to Stand Out (Technology/Data Track)</h2>
                  
                  <div className="bg-green-50 p-6 rounded-lg">
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-1">•</span>
                        <span>Link technical skills to business value — don't just list tools, show what you achieved with them (e.g., improved efficiency, derived insights, supported decisions).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-1">•</span>
                        <span>Use the STAR method for behavioral answers (Situation → Task → Action → Result), but for data/tech also include Method → Outcome → Learnings.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-1">•</span>
                        <span>Be prepared to discuss a project: what data you used, how you cleaned it, what methods/analysis, what outcomes, what trade-offs.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-1">•</span>
                        <span>Demonstrate learning agility — tech/data changes fast; show you've picked up new tools or adapted to new challenges.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-1">•</span>
                        <span>In group case or assessment centre: show you can communicate clearly (especially to non-technical stakeholders) — many tech/data roles also require translating insights to business context.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 mt-1">•</span>
                        <span>Align with PwC's values and culture: "Act with integrity", "Make a difference", "Care", "Work together", "Reimagine the possible". One interview reported being asked: "Which of these values do you most apply to and why?"</span>
                      </li>
                    </ul>
                  </div>
                </section>

                <div className="bg-gray-100 h-px my-8"></div>

                <section className="mb-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">🔗 Apply Now</h2>
                  
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <p className="text-gray-700">
                      Official application page: <Link href="https://jobs-au.pwc.com/au/en/vacation-program" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">https://jobs-au.pwc.com/au/en/vacation-program</Link>
                    </p>
                  </div>
                </section>

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
          </article>
        </div>
      </div>
    </>
  );
}

