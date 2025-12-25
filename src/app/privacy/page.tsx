"use client";
import { useRouter } from "next/navigation";
import { Logo } from '@/components/Logo';

export default function PrivacyPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Top Left Logo */}
      <div className="absolute left-8 top-8">
        <Logo />
      </div>
      {/* Top Right Back Button */}
      <button
        className="absolute right-8 top-8 text-blue-600 hover:underline text-base flex items-center"
        onClick={() => router.push('/')}
      >
        <span className="mr-1">←</span> Back
      </button>
      {/* Main Content */}
      <div className="flex flex-col items-center justify-start min-h-screen pt-32 pb-16">
        <div className="bg-white rounded-xl shadow-lg p-10 w-full max-w-4xl">
          {/* Page Title */}
          <div className="text-center mb-8">
            <h1 className="text-lg font-bold text-gray-900 mb-2">Privacy and Cookie Policy</h1>
            <p className="text-sm text-gray-600">Effective Date: July 28, 2025</p>
            <p className="text-sm text-gray-500 mt-1">Last Updated: December 24, 2025</p>
          </div>
          
          {/* Privacy Content */}
          <div className="max-w-none text-gray-700 text-sm">
            <p className="mb-6">
              Héra AI ("we", "us", or "our") is committed to protecting your privacy and handling your personal information in accordance with the Australian Privacy Principles under the Privacy Act 1988 (Cth). This Privacy and Cookie Policy explains how we collect, use, disclose and protect your information when you use our website and services.
            </p>

            <div className="space-y-6">
              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">1. Information We Collect</h2>
                <p className="text-sm mb-3">
                  We may collect the following types of personal information:
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 ml-4">
                  <li>Personal details: name, email address, phone number, city, country, and any other information you provide during account creation or job profile setup.</li>
                  <li>Employment-related information: your resume, work experience, education, job preferences, working rights, and language skills.</li>
                  <li>Technical information: IP address, browser type, pages visited, time spent, and other analytics data.</li>
                  <li>Third-party data: if you connect your account with Google, GitHub or other services, we may access limited profile information as permitted by you.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">2. How We Use Your Information</h2>
                <p className="text-sm mb-3">
                  We use your personal information to:
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 ml-4">
                  <li>Provide, personalise, and improve our services;</li>
                  <li>Automatically generate or update your job-seeking profile;</li>
                  <li>Recommend job opportunities relevant to your profile;</li>
                  <li>Support job application submissions (including to third-party employers and platforms);</li>
                  <li>Communicate with you about service updates, offers, and insights;</li>
                  <li>Analyse usage trends to improve our platform;</li>
                  <li>Comply with legal obligations.</li>
                </ul>
                <p className="text-sm mt-3">
                  We do not sell your personal data to third parties.
                </p>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">3. Disclosure of Information</h2>
                <p className="text-sm mb-3">
                  We may share your information with:
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 ml-4">
                  <li>Trusted third-party service providers (e.g., cloud hosting, analytics tools);</li>
                  <li>Employers or recruitment platforms (only with your consent or auto-apply settings enabled);</li>
                  <li>Legal authorities when required by law or regulation;</li>
                  <li>Our professional advisors, insurers, or auditors, where necessary.</li>
                </ul>
                <p className="text-sm mt-3">
                  All disclosures are made in accordance with Australian privacy law.
                </p>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">3.1 Third-Party Job Data Sources</h2>
                <p className="text-sm mb-3">
                  We distinguish between <strong>ATS-based sources</strong> and <strong>job board platforms</strong>:
                </p>
                
                <div className="text-sm mb-3 ml-4">
                  <p className="font-semibold mb-2">1) ATS / Employer Career Sources (e.g., Lever)</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>We may integrate with <strong>ATS providers</strong> (e.g., Lever) and/or employer career pages that publish job postings via <strong>official or openly available</strong> job feeds/endpoints.</li>
                    <li>For these sources, we may store <strong>job metadata</strong> (e.g., title, company, location, posting URL, timestamps, source tag) to enable search, deduplication, ranking, and recommendations.</li>
                  </ul>
                </div>

                <div className="text-sm mb-3 ml-4">
                  <p className="font-semibold mb-2">2) Job Board Platforms (e.g., LinkedIn, SEEK, Jora, Adzuna)</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>We <strong>do not scrape, copy, or host</strong> job content from these platforms.</li>
                    <li>We may provide <strong>search/deep links</strong> that take users to the original platform.</li>
                    <li>When users click these links, their interaction is governed by the platform's own terms and privacy policy.</li>
                  </ul>
                </div>

                <div className="text-sm mt-3 p-3 bg-gray-50 rounded">
                  <p className="font-semibold mb-2">What we do NOT do:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>We do not scrape or replicate full job page content from job board platforms.</li>
                    <li>We do not collect users' job board platform account credentials.</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">4. International Data Transfers</h2>
                <p className="text-sm">
                  If we transfer personal information outside Australia (e.g., to servers or partners overseas), we take reasonable steps to ensure those recipients comply with privacy obligations similar to those under Australian law.
                </p>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">5. Security of Your Information</h2>
                <p className="text-sm mb-3">
                  We implement reasonable physical, technical, and administrative safeguards to protect your information from misuse, interference, loss, and unauthorised access, modification, or disclosure. Our security measures include:
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 ml-4 mb-3">
                  <li><strong>Transport encryption</strong>: All data transmission uses HTTPS/TLS encryption</li>
                  <li><strong>Access control</strong>: We follow the principle of least privilege for data access</li>
                  <li><strong>Secure credential management</strong>: Authentication tokens and secrets are stored securely in environment variables or secrets manager, and never hardcoded in source code or documentation</li>
                  <li><strong>Log sanitization</strong>: Sensitive information (such as authorization headers) is not logged</li>
                </ul>
                <p className="text-sm">
                  However, no method of electronic transmission or storage is completely secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">6. Cookies and Tracking Technologies</h2>
                <p className="text-sm mb-3">
                  We use cookies and similar technologies to:
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 ml-4">
                  <li>Remember your preferences and session;</li>
                  <li>Analyse site usage and performance;</li>
                  <li>Provide personalised content and recommendations.</li>
                </ul>
                <p className="text-sm mt-3">
                  By using our site, you consent to the use of cookies. You may choose to disable cookies in your browser settings, but this may limit certain functionalities of the site.
                </p>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">7. Your Rights and Choices</h2>
                <p className="text-sm mb-3">
                  You have the right to:
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 ml-4">
                  <li>Access the personal information we hold about you;</li>
                  <li>Request correction of inaccurate information;</li>
                  <li>Withdraw consent for certain uses;</li>
                  <li>Request deletion of your data (subject to legal and operational retention limits);</li>
                  <li>Opt out of marketing communications at any time.</li>
                </ul>
                
                <div className="text-sm mt-4 p-3 bg-gray-50 rounded">
                  <p className="font-semibold mb-2">How to Request Data Deletion:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Send an email to <a href="mailto:shuang@heraai.net.au" className="text-blue-600 hover:underline">shuang@heraai.net.au</a> with the subject "Data Deletion Request"</li>
                    <li>Include your registered email address and specify which data you want deleted (e.g., "all data", "resume only", "application history")</li>
                    <li>To prevent unauthorized deletion, we may need to verify your control over the account (for example, by confirming the request is sent from your registered email address)</li>
                    <li>We will confirm receipt within 5 business days and complete deletion within 30 days (unless legal obligations require longer retention)</li>
                    <li>You will receive confirmation once deletion is complete</li>
                  </ol>
                  <p className="text-sm mt-2">
                    <strong>Note:</strong> Some data may be retained longer if required by law (e.g., financial records for 7 years) or if anonymised for analytics purposes.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">8. Retention of Information</h2>
                <p className="text-sm mb-3">
                  We retain your personal information only as long as needed for the purposes described in this policy or as required by law. Specific retention periods are as follows:
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 ml-4 mb-3">
                  <li><strong>Resume content and profile data</strong>: Retained until you request deletion or your account has been inactive (no login or service usage) for 3 years, whichever comes first.</li>
                  <li><strong>Job application history</strong>: Retained for 2 years from the date of application, or until you request deletion.</li>
                  <li><strong>Email address and account information</strong>: Retained until you request account deletion or your account has been inactive (no login or service usage) for 3 years.</li>
                  <li><strong>Search history and preferences</strong>: Retained for 1 year from last activity (last search or service usage), or until you request deletion.</li>
                  <li><strong>Logs and analytics data</strong>: We aim to retain logs and analytics data for up to 90 days, then anonymise or delete them. Actual retention periods may vary based on our service providers' policies (e.g., application logs, database traces, third-party analytics tools).</li>
                  <li><strong>Job metadata from ATS sources</strong>: Retained for 6 months after we determine a job posting is no longer available (based on our data synchronization status), then deleted.</li>
                </ul>
                <p className="text-sm">
                  We may anonymise data for longer-term analysis and product improvement. Anonymised data cannot be linked back to you and may be retained indefinitely.
                </p>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">9. Children's Privacy</h2>
                <p className="text-sm">
                  Héra AI is not intended for children under the age of 16. We do not knowingly collect personal information from minors without parental consent.
                </p>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">10. Changes to This Policy</h2>
                <p className="text-sm">
                  We may update this Privacy and Cookie Policy from time to time. We will notify you of significant changes via email or site banner and revise the effective date accordingly.
                </p>
              </section>

              <section className="mt-8 pt-6 border-t border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">11. Contact Us</h2>
                <p className="text-sm mb-3">
                  For any privacy-related questions, complaints, or access requests, please contact:
                </p>
                <div className="text-sm space-y-1">
                  <p className="font-semibold">Héra AI</p>
                  <p>📍 Melbourne, Australia</p>
                  <p>📧 <a href="mailto:shuang@heraai.net.au" className="text-blue-600 hover:underline">shuang@heraai.net.au</a></p>
                </div>
                <p className="text-sm mt-3">
                  We will respond within a reasonable period, typically within 30 days.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 