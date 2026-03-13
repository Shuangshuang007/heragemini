# Test Results: Store Submission Lite (4 Tools)

**Test Date**: 2025-12-26T08:31:46.921Z
**Endpoint**: http://localhost:3002/api/mcp-lite

---

## Summary

| Tool | Total | Passed | Failed | Pass Rate |
|------|-------|--------|--------|-----------|
| career_transition_advice | 5 | 0 | 5 | 0.0% |
| search_jobs | 5 | 4 | 1 | 80.0% |
| recommend_jobs | 10 | 0 | 10 | 0.0% |
| tailor_resume | 5 | 5 | 0 | 100.0% |

---

## Test 1: career_transition_advice - Software Engineer → Product Manager

**Status**: 200 | **Elapsed**: 135ms | **Result**: ❌ FAIL

**Failure Reason**: Failed to get career transition advice: fetch failed

### Input

```json
{
  "current_job": "Software Engineer",
  "experience_years": 3,
  "skills": [
    "JavaScript",
    "React",
    "Node.js",
    "Agile",
    "Scrum"
  ],
  "location": "Sydney"
}
```

### Output

```json
"Failed to get career transition advice: fetch failed"
```

---

## Test 2: career_transition_advice - Data Analyst → Data Scientist

**Status**: 200 | **Elapsed**: 62ms | **Result**: ❌ FAIL

**Failure Reason**: Failed to get career transition advice: fetch failed

### Input

```json
{
  "current_job": "Data Analyst",
  "experience_years": 2,
  "skills": [
    "Python",
    "SQL",
    "Excel",
    "Tableau",
    "Statistics"
  ],
  "industry": "Finance"
}
```

### Output

```json
"Failed to get career transition advice: fetch failed"
```

---

## Test 3: career_transition_advice - Marketing Coordinator → Marketing Manager

**Status**: 200 | **Elapsed**: 99ms | **Result**: ❌ FAIL

**Failure Reason**: Failed to get career transition advice: fetch failed

### Input

```json
{
  "current_job": "Marketing Coordinator",
  "experience_years": 4,
  "skills": [
    "Digital Marketing",
    "SEO",
    "Content Creation",
    "Analytics",
    "Campaign Management"
  ],
  "location": "Melbourne"
}
```

### Output

```json
"Failed to get career transition advice: fetch failed"
```

---

## Test 4: career_transition_advice - Accountant → Financial Advisor

**Status**: 200 | **Elapsed**: 73ms | **Result**: ❌ FAIL

**Failure Reason**: Failed to get career transition advice: fetch failed

### Input

```json
{
  "current_job": "Accountant",
  "experience_years": 5,
  "skills": [
    "Accounting",
    "Tax",
    "Financial Reporting",
    "Excel",
    "QuickBooks"
  ],
  "industry": "Professional Services"
}
```

### Output

```json
"Failed to get career transition advice: fetch failed"
```

---

## Test 5: career_transition_advice - UX Designer → Product Designer

**Status**: 200 | **Elapsed**: 63ms | **Result**: ❌ FAIL

**Failure Reason**: Failed to get career transition advice: fetch failed

### Input

```json
{
  "current_job": "UX Designer",
  "experience_years": 2,
  "skills": [
    "Figma",
    "User Research",
    "Wireframing",
    "Prototyping",
    "Design Systems"
  ],
  "location": "Brisbane"
}
```

### Output

```json
"Failed to get career transition advice: fetch failed"
```

---

## Test 6: search_jobs - Software Engineer in Sydney

**Status**: 200 | **Elapsed**: 10248ms | **Result**: ✅ PASS

### Input

```json
{
  "job_title": "Software Engineer",
  "city": "Sydney"
}
```

### Output

```json
"Found 1707 jobs for \"Software Engineer\" in Sydney\n\n1. \n   Circular Economy Systems (CES)\n   Sydney, Australia\n\n   **Job Highlights:**\n   • CES accelerates the transition to a circular economy by enabling the recycling of close to 10 million drink containers daily through container deposit schemes.\n   • The Solution Architect will lead the transformation of legacy applications into Microsoft Dynamics Finance & Operations, Power Platform, and Azure, working closely with internal stakeholders and vendor resources.\n   • CES offers an inclusive culture, hybrid and flexible working arrangements, and career development opportunities to bring out the best in its people.\n\n   **Must-Have Skills:**\n   • Microsoft Dynamics 365 Finance and Operations expertise\n   • Power Platform customisation and integration\n   • ERP process automation and integration\n   • Leading ERP rollout projects\n   • Strong stakeholder engagement skills\n\n   **Nice-to-Have Skills:**\n   • Accounting experience\n   • CPA qualification\n   • Complex client migration experience\n   • Strong problem-solving skills\n   • Project management skills\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://jobs.ashbyhq.com/circulareconomysystems/6d801c83-fc99-43dd-b635-70181b0d9440)\n\n2. \n   Circular Economy Systems (CES)\n   Sydney, Australia\n\n   **Job Highlights:**\n   • CES accelerates the transition to a circular economy by supporting container deposit schemes and recycling millions of drink containers daily.\n   • The Functional Consultant role is hands-on and delivery-focused, working closely with stakeholders to embed improved processes using Microsoft Dynamics 365 F&O and Power Platform.\n   • CES offers an inclusive culture with hybrid and flexible working arrangements and career development opportunities to bring out the best in its people.\n\n   **Must-Have Skills:**\n   • Microsoft Dynamics 365 Finance & Operations\n   • Functional workshops and process mapping\n   • ERP rollout project experience\n   • Core finance and supply chain modules\n   • Fit-gap analysis and functional specifications\n\n   **Nice-to-Have Skills:**\n   • Collaborative and influencing skills\n   • Ability to work through ambiguity\n   • Strong documentation and organisational skills\n   • Passion for circular economy mission\n   • Hybrid and flexible working environment\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://jobs.ashbyhq.com/circulareconomysystems/ef336780-fc25-45b6-826f-6e5130d081b7)\n\n3. \n   Circular Economy Systems Pty Ltd\n   Sydney, Australia\n\n   **Job Highlights:**\n   • CES accelerates the transition to a circular economy by enabling recycling of close to 10 million drink containers daily through container deposit schemes.\n   • The Functional Consultant role involves leading workshops, translating business needs into functional solutions, and supporting Microsoft Dynamics 365 F&O configuration and optimisation.\n   • CES offers an inclusive culture with hybrid and flexible working options, career development opportunities, and a passionate team dedicated to sustainability and recycling.\n\n   **Must-Have Skills:**\n   • Microsoft Dynamics 365 Finance & Operations\n   • Functional workshops and requirements gathering\n   • ERP rollout project experience\n   • Core finance and supply chain modules knowledge\n   • Fit-gap analysis and functional specification\n\n   **Nice-to-Have Skills:**\n   • Workshop facilitation and process mapping\n   • Collaborative stakeholder engagement\n   • Ability to work through ambiguity\n   • Strong documentation and organisational skills\n   • Delivery-focused and fast-paced environment\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://jobs.ashbyhq.com/circulareconomysystems/ef336780-fc25-45b6-826f-6e5130d081b7)\n\n4. \n   Circular Economy Systems Pty Ltd\n   Sydney, Australia\n\n   **Job Highlights:**\n   • We are proud to be an active contributor in the circular economy through container deposit schemes and help recycle close to 10 million drink containers every day.\n   • You will lead the project team to design and implement solutions in Microsoft Dynamics Finance & Operations, Power Platform and Azure, driving ERP-led transformation.\n   • We provide an inclusive culture, hybrid and flexible working and career development to bring the best out in our people.\n\n   **Must-Have Skills:**\n   • Microsoft Dynamics 365 Finance and Operations expertise\n   • Power Platform customisation and integration\n   • ERP process automation and integration\n   • Leading Financial ERP rollout projects\n   • Strong stakeholder engagement skills\n\n   **Nice-to-Have Skills:**\n   • Accounting experience or CPA qualification\n   • People management of small teams\n   • Project management and organisational skills\n   • Passion for circular economy mission\n   • Collaborative team leadership\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://jobs.ashbyhq.com/circulareconomysystems/6d801c83-fc99-43dd-b635-70181b0d9440)\n\n5. \n   Sustainability Leads\n   Sydney, Australia\n\n   **Job Highlights:**\n   • Join a collaborative, DevOps-oriented squad that thrives on curiosity, ownership and lifting each other higher.\n   • This role offers opportunities to learn new skills with hands-on experience, broader responsibilities, and the impact of seeing your work affect customers faster.\n   • Zip provides a supportive environment with benefits including paid leave, parental leave, mental health initiatives, volunteering leave, and social events.\n\n   **Must-Have Skills:**\n   • Python and JavaScript proficiency\n   • AWS cloud environment experience\n   • DevOps and CI/CD practices\n   • Experience with Kafka streaming technologies\n   • Strong database skills with relational and NoSQL\n\n   **Nice-to-Have Skills:**\n   • Collaborative problem solving\n   • Risk-aware system design mindset\n   • Embraces AI and new tools\n   • Customer First values\n   • Ownership and teamwork culture\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://job-boards.greenhouse.io/zipcolimited/jobs/4626849006)\n\nReply \"more\" for next 5 results."
```

---

## Test 7: search_jobs - Data Analyst in Melbourne

**Status**: 200 | **Elapsed**: 8950ms | **Result**: ✅ PASS

### Input

```json
{
  "job_title": "Data Analyst",
  "city": "Melbourne"
}
```

### Output

```json
"Found 108 jobs for \"Data Analyst\" in Melbourne\n\n1. \n   Vanguard Australia\n   Melbourne, VIC, Australia\n\n   **Job Highlights:**\n   • In this role you will leverage analytics to surface insights of client behavior, satisfaction, and digital containment to influence product decisions and roadmap for the benefit of our clients.\n   • You will lead engagement with internal partners to understand business strategy, questions, and goals, and translate requirements into analytical project approaches.\n   • Vanguard has implemented a hybrid working model designed to capture the benefits of enhanced flexibility while enabling in-person learning, collaboration, and connection.\n\n   **Must-Have Skills:**\n   • SQL and Python coding knowledge\n   • Data storytelling through visualization\n   • Designing and executing end to end experiments\n   • Advanced analytical methods\n   • Mentoring senior data analysts\n\n   **Nice-to-Have Skills:**\n   • Proactive knowledge sharing\n   • Collaborative culture\n   • Hybrid working model\n\n   **Work Rights:**\n   • Requires: Must not require sponsorship\n   • Sponsorship: not_available\n\n   👉 [Apply on the official website via Héra AI](https://vanguard.wd5.myworkdayjobs.com/vanguard_external/job/Malvern-PA/Data-Analyst---CXD--Advanced-Analytics-_161933)\n\n2. \n   Medilaw - NSW\n   Melbourne, Victoria, Australia\n\n   **Job Highlights:**\n   • MedHealth supports whole populations to better outcomes while focusing on individuals to build a better life through work and health.\n   • The Senior Data Analyst partners closely with business leaders to identify opportunities and provide insights-enabled recommendations that improve business performance and operational efficiency.\n   • The company values diversity and inclusion, welcoming people with disabilities, diverse cultural backgrounds, LGBTQI community members, veterans, carers, and Indigenous Australians.\n\n   **Must-Have Skills:**\n   • Strong SQL skills\n   • PowerBI expertise\n   • Data visualisation best practices\n   • Stakeholder engagement skills\n   • Data quality assurance\n\n   **Nice-to-Have Skills:**\n   • Understanding of machine learning concepts\n   • Experience with Python or R\n   • Strong communication and storytelling abilities\n   • Inclusive and responsive workplace practices\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://jobs.smartrecruiters.com/MedHealth3/744000099055527)\n\n3. \n   MedHealth\n   Melbourne, Australia\n\n   **Job Highlights:**\n   • The Senior Data Analyst is responsible for transforming complex data into meaningful insights that drive strategic and operational decision-making.\n   • This role partners closely with business leaders within the Disability & Aged Care Services division to understand challenges, identify opportunities, and provide insights-enabled recommendations.\n   • MedHealth is an Equal Opportunity Employer valuing diversity and inclusivity, welcoming people with disabilities, diverse cultural backgrounds, LGBTQI community members, veterans, carers, and Indigenous Australians.\n\n   **Must-Have Skills:**\n   • Strong SQL skills\n   • PowerBI expertise\n   • Data visualisation best practices\n   • Stakeholder engagement skills\n   • Data quality assurance\n\n   **Nice-to-Have Skills:**\n   • Understanding of machine learning concepts\n   • Experience with Python or R\n   • Strong communication and storytelling abilities\n   • Inclusive and responsive work practices\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://jobs.smartrecruiters.com/MedHealth3/744000099055527)\n\n4. \n   Ededge Groups\n   Melbourne, Australia\n\n   **Job Highlights:**\n   • Ededge is dedicated to nurturing youth potential and empowering exploration in technology and high-growth fields through impactful training and mentorship.\n   • The internship offers hands-on experience working on real-world data projects involving data analysis, machine learning pipelines, and advanced analytical techniques.\n   • Interns gain access to expert mentorship, professional development resources, and potential opportunities for full-time roles based on performance.\n\n   **Must-Have Skills:**\n   • Python programming for EDA\n   • Data preprocessing and visualization\n   • Machine learning and data mining methods\n   • Developing analytical skills\n   • Collaboration with multidisciplinary teams\n\n   **Nice-to-Have Skills:**\n   • Strong problem-solving abilities\n   • Excellent communication and teamwork skills\n   • Ability to work independently and remotely\n   • Experience with Tableau\n   • Focus on risk analytics in banking and finance\n\n   **Work Rights:**\n   • Requires: Not specified\n   • Sponsorship: not_available\n\n   👉 [Apply on the official website via Héra AI](https://www.linkedin.com/jobs/view/4350102222/?eBP=NOT_ELIGIBLE_FOR_CHARGING&refId=8U10hfvMb9Fw9o9bottc%2Fw%3D%3D&trackingId=ZBt%2FPQBKjj0AwVU8oSDAUQ%3D%3D&trk=flagship3_search_srp_jobs)\n\n5. \n   Salvationarmy Org Au\n   Blackburn, Melbourne, Australia\n\n   **Job Highlights:**\n   • The Salvation Army is a Christian movement and one of Australia's largest and most-loved charities committed to transforming lives and futures for the better.\n   • This role involves creating a robust analytics ecosystem supporting the organisation’s mission through scalable, high-quality business intelligence solutions.\n   • Employees benefit from flexible hybrid working arrangements, generous parental leave, salary packaging, wellness initiatives, and ongoing training opportunities.\n\n   **Must-Have Skills:**\n   • Power BI development and optimisation\n   • Microsoft Fabric data pipelines\n   • Data quality and governance\n   • Semantic model design and optimisation\n   • SQL and ETL frameworks expertise\n\n   **Nice-to-Have Skills:**\n   • Python proficiency for automation\n   • Collaborative cross-team communication\n   • Mission-driven and compassionate culture\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://salvationarmy.wd3.myworkdayjobs.com/wday/cxs/salvationarmy/Salvos/job/Blackburn-VIC-Australia/Senior-BI-Developer_R54672-1)\n\nReply \"more\" for next 5 results."
```

---

## Test 8: search_jobs - Product Manager in Brisbane

**Status**: 200 | **Elapsed**: 7926ms | **Result**: ✅ PASS

### Input

```json
{
  "job_title": "Product Manager",
  "city": "Brisbane"
}
```

### Output

```json
"Found 95 jobs for \"Product Manager\" in Brisbane\n\n1. \n   RIB Software\n   Brisbane, Australia\n\n   **Job Highlights:**\n   • The Senior Test Engineer is responsible for assuring the quality of systems and software applications through manual and automation test runs.\n   • RIB Software is a global company with over 2,500 employees delivering innovative end-to-end lifecycle solutions for the engineering and construction industry.\n   • The role involves developing comprehensive test strategies, executing tests, managing defects, and collaborating with cross-functional teams to maintain high quality standards.\n\n   **Must-Have Skills:**\n   • Manual and automated testing\n   • Automation testing frameworks\n   • Continuous Integration (CI) integration\n   • Test execution and defect management\n   • Proficiency in JavaScript, Python, Java\n\n   **Nice-to-Have Skills:**\n   • Knowledge of construction industry tools\n   • Experience with Azure DevOps and Teamcity\n   • Familiarity with Jira, TestRail, Confluence\n   • Construction domain knowledge\n   • Background check compliance\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://aveva.wd3.myworkdayjobs.com/wday/cxs/aveva/RIB_Careers/job/Brisbane-Australia/Senior-Test-Engineer_R012532)\n\n2. \n   Leveltec Engineering Pty Ltd\n   Brisbane, Queensland, Australia\n\n   **Job Highlights:**\n   • These new Field Sales Representative roles will be at the centre of Leveltec’s expansion — building relationships, opening new markets, and bringing Leveltec’s rapidly growing product offering to customers across Australia.\n   • As a Field Sales Representative, you’ll manage and grow customer relationships within your designated state while driving new pipeline opportunities across Leveltec’s product verticals.\n   • Leveltec offers autonomy to build your territory and customer relationships, training, engineering support, and opportunities to work with major Australian mine sites and industry leaders.\n\n   **Must-Have Skills:**\n   • Electrical trade or engineering background\n   • Independent lead generation and pipeline building\n   • Strong face-to-face sales skills\n   • Ability to work autonomously\n   • Technical solution selling\n\n   **Nice-to-Have Skills:**\n   • Problem-solving mindset\n   • Collaboration with national team\n   • Customer relationship building\n   • Experience with major Australian mine sites\n   • Training and engineering support access\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.leveltec.com.au/about-us/careers/)\n\n3. Product Specialist - Laboratory Plastics Essentials\n   Thermo Fisher Scientific\n   Brisbane, Australia\n\n   **Job Highlights:**\n   • The Product Specialist is responsible for driving profitable revenue and developing customer relationships within their territory for the Laboratory Plastics Essentials portfolio.\n   • This predominantly field-based role involves providing competitor and market knowledge, implementing commercial strategies, and supporting customers with end-to-end workflow solutions.\n   • The role requires close collaboration with Product Managers, Key Account Managers, Inside Sales, and Technical Service teams to achieve growth aligned with commercial strategy.\n\n   **Must-Have Skills:**\n   • Develop and execute sales strategies\n   • Manage sales pipeline and forecast accurately\n   • Provide technical and sales support\n   • Customer relationship development\n   • Territory and opportunity management\n\n   **Nice-to-Have Skills:**\n   • Strong organizational and prioritization skills\n   • Solution-focused and strategic thinker\n   • Excellent communication and numeracy skills\n   • Highly motivated and resourceful\n   • Positive and upbeat demeanor\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://jobs.thermofisher.com/global/en/job/R-01331854/Product-Specialist-Laboratory-Plastics-Essentials?rx_ch=jobpost&rx_id=d79fff0c-d6ef-11f0-b041-4d569416fa05&rx_job=R-01331854_rxr-1&rx_medium=post&rx_paid=0&rx_r=none&rx_source=linkedin&rx_ts=20251215T144002Z&rx_vp=linkedindirectindex&utm_medium=post&utm_source=recruitics_linkedindirectindex&refId=34jd24&rx_viewer=3434ffcbd8ee11f09462b595d4af05eadb64ba9e283b42a39b4cdaa29816b15a)\n\n4. Embedded IoT Edge Sales Manager\n   Canonical\n   Brisbane, Australia\n\n   **Job Highlights:**\n   • Canonical is a leading provider of open-source software and operating systems with a global distributed team and a strong focus on embedded Linux and IoT solutions.\n   • The role involves building and executing territory plans, developing pipeline through outreach and marketing, closing contracts, and managing customer relationships with a focus on security-focused brands and manufacturers.\n   • Canonical offers a distributed work environment with twice-yearly in-person team sprints, a personal learning and development budget, annual compensation reviews, and various benefits including wellness programs and travel opportunities.\n\n   **Must-Have Skills:**\n   • Embedded Linux and RTOS expertise\n   • Enterprise software and open source sales\n   • Territory and account planning\n   • Pipeline development and management\n   • Customer relationship management\n\n   **Nice-to-Have Skills:**\n   • Passion for technology and personal projects\n   • High intellect and quick learning ability\n   • Teamwork and collaboration skills\n   • Empathy for customer needs\n   • Multicultural and multinational effectiveness\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://job-boards.greenhouse.io/canonicaljobs/jobs/7162331?gh_src=1csyrqh61us)\n\n5. Senior Business Analyst\n   Global Payments Inc.\n   Brisbane, Australia\n\n   **Job Highlights:**\n   • Global Payments Inc. is a Fortune 500 brand delivering market-leading payment technology solutions to over 5 million customers worldwide.\n   • The Senior Business Analyst role involves bridging the gap between customer requirements and technical delivery by working closely with product managers, technical leads, and stakeholders.\n   • Employees benefit from flexible work arrangements, extensive parental leave, wellness programs, professional development opportunities, and a supportive, inclusive culture.\n\n   **Must-Have Skills:**\n   • Business analysis for complex initiatives\n   • Requirements gathering and prioritization\n   • Process mapping and gap analysis\n   • Agile delivery team experience\n   • Proficient with Jira, Azure DevOps, Confluence\n\n   **Nice-to-Have Skills:**\n   • Proactive problem solving\n   • Strong analytical and critical thinking\n   • Simplifying complex technical information\n   • High attention to detail\n   • Support and guide other analysts\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://jobs.globalpayments.com/en/jobs/r0066699/senior-business-analyst/)\n\nReply \"more\" for next 5 results."
```

---

## Test 9: search_jobs - UX Designer in Perth

**Status**: 200 | **Elapsed**: 7037ms | **Result**: ❌ FAIL

**Failure Reason**: Only found 0 jobs (expected >= 3)

### Input

```json
{
  "job_title": "UX Designer",
  "city": "Perth"
}
```

### Output

```json
"Found 0 jobs for \"UX Designer\" in Perth\n\n\n\nReply \"more\" for next 5 results."
```

---

## Test 10: search_jobs - Consultant in Geraldton

**Status**: 200 | **Elapsed**: 7326ms | **Result**: ✅ PASS

### Input

```json
{
  "job_title": "Consultant",
  "city": "Geraldton"
}
```

### Output

```json
"Found 8 jobs for \"Consultant\" in Geraldton\n\n1. \n   APM\n   Geraldton, WA, Australia\n\n   **Job Highlights:**\n   • APM is a global health and human services organisation empowering people of all abilities to lead independent and fulfilling lives.\n   • This role involves supporting participants with disability to prepare for, find, and maintain sustainable employment while advocating for inclusive hiring practices.\n   • Employees benefit from competitive salary with performance incentives, ongoing training, a supportive team environment, and various leave and wellbeing programs.\n\n   **Must-Have Skills:**\n   • Support participants with disability\n   • Advocate inclusive hiring practices\n   • Build partnerships with companies\n   • Provide creative employment solutions\n   • Full-time Monday to Friday work\n\n   **Nice-to-Have Skills:**\n   • Champion of diversity and inclusion\n   • Innovative and solutions focused\n   • Compassionate and empathetic\n   • Experience in sales or retail\n   • Strong stakeholder communication\n\n   **Work Rights:**\n   • Requires: Eligibility to work in Australia required\n   • Sponsorship: not_available\n\n   👉 [Apply on the official website via Héra AI](https://jobs.smartrecruiters.com/APMGroup/6000000000756079)\n\n2. \n   Assure\n   Geraldton, WA, Australia\n\n   **Job Highlights:**\n   • This isn’t your average desk job and focuses on breaking barriers, creating opportunities and helping people with disability thrive by securing and supporting them into employment.\n   • The role offers a competitive salary plus performance-based incentives, ongoing training and career development, and a supportive and inclusive team environment.\n   • APM is committed to diversity and inclusion, encouraging applications from people of all ages, nationalities, abilities and cultures including indigenous peoples, the LGBTQI+ community and people with disability.\n\n   **Must-Have Skills:**\n   • Supporting participants with disability\n   • Advocating inclusive hiring practices\n   • Building partnerships with diverse employers\n   • Full-time Monday to Friday work schedule\n   • Driver’s licence and insured vehicle\n\n   **Nice-to-Have Skills:**\n   • Champion of diversity and inclusion\n   • Innovative and solutions focused\n   • Compassionate and empathetic\n   • Experience in sales, retail, or hospitality\n   • Strong stakeholder communication skills\n\n   **Work Rights:**\n   • Requires: Eligibility to work in Australia required\n   • Sponsorship: not_available\n\n   👉 [Apply on the official website via Héra AI](https://jobs.smartrecruiters.com/APMGroup/6000000000756079)\n\n3. \n   Early Start Australia\n   Geraldton, WA, Australia\n\n   **Job Highlights:**\n   • This role supports people with disability to prepare for, find and maintain sustainable employment through the Inclusive Employment Australia Program.\n   • The company offers competitive salary plus performance-based incentives, ongoing training, career development, and a supportive inclusive team environment.\n   • APM is committed to diversity and inclusion, encouraging applications from people of all backgrounds and providing various employee wellbeing and recognition programs.\n\n   **Must-Have Skills:**\n   • Supporting participants with disability\n   • Creating employment pathways\n   • Advocating inclusive hiring practices\n   • Building partnerships with diverse employers\n   • Full-time Monday to Friday work schedule\n\n   **Nice-to-Have Skills:**\n   • Champion of diversity and inclusion\n   • Innovative and solutions focused\n   • Compassionate and empathetic\n   • Experience in sales or retail\n   • Strong stakeholder communication skills\n\n   **Work Rights:**\n   • Requires: Eligibility to work in Australia required\n   • Sponsorship: not_available\n\n   👉 [Apply on the official website via Héra AI](https://jobs.smartrecruiters.com/APMGroup/6000000000756079)\n\n4. \n   Konekt\n   Geraldton, WA, Australia\n\n   **Job Highlights:**\n   • This isn’t your average desk job as it focuses on breaking barriers, creating opportunities, and helping people with disability thrive by securing and supporting them into employment.\n   • The role offers a competitive salary plus performance-based incentives, ongoing training and career development, and a supportive and inclusive team environment.\n   • APM is committed to diversity and inclusion, encouraging applications from people of all ages, nationalities, abilities, and cultures including indigenous peoples, the LGBTQI+ community and people with disability.\n\n   **Must-Have Skills:**\n   • Supporting participants with disability\n   • Advocating inclusive hiring practices\n   • Building partnerships with diverse employers\n   • Providing creative employment solutions\n   • Full-time availability Monday to Friday\n\n   **Nice-to-Have Skills:**\n   • Champion of diversity and inclusion\n   • Natural connector and confident communicator\n   • Innovative and solutions focused\n   • Compassionate and empathetic\n   • Experience in sales, retail, or hospitality\n\n   **Work Rights:**\n   • Requires: Eligibility to work in Australia required\n   • Sponsorship: not_available\n\n   👉 [Apply on the official website via Héra AI](https://jobs.smartrecruiters.com/APMGroup/6000000000756079)\n\n5. \n   recruitajobs.com\n   Telstra Store Geraldton\n\n   **Job Highlights:**\n   • Employment Type Permanent Closing Date 2 Jan 2026 11:59pm Job Title Telstra Retail: Customer Service & Sales Consultant Job Summary As a Retail Sales Consultant, you are passionate about delighting Telstra’s customers through outstanding customer service. You achieve this by providing an exceptional in-store customer journey, and through your collaborative approach you empower customers by identifying the products and services they need to transform their telecommunications experience. Job Description Our purpose is to build a connected future so everyone can thrive. Working in a Telstra Retail Stores is not ‘just a job’, it’s an opportunity for tech-curious problem solvers to build a meaningful career within an iconic Aussie brand. The benefits are pretty awesome, too. Every day is different. A Telstra Retail Consultant thrives on making sure our customers connect faster, better, smarter. Every day is an opportunity to showcase your X-factor. To ensure you’re at the top of your game, you will be continually trained up on all the latest cutting-edge tech and gadgets. Your knowledge, progressive sales approach and consultative service superpowers will empower you to support and solution for our customers. If you’d like to know a little more, here’s something we prepared earlier: Life at Telstra We offer the perkiest of perks. When it comes to rewarding our people, we’ve got so much to be excited about. Some of these include: 30% off Telstra services Exclusive discounts and offers across 240 brands and partners A flexible, inclusive approach to parental leave – do it your way! Unlimited access to 17000 learning programs – something for everyone! Team performance-based rewards and recognition programs Telstra sim There’s more! Benefits Your Way - Telstra We’re hiring. Locations: we are currently hiring across: GERALDTON Casual, Part Time- and Full-Time roles available Store hours vary – search your store Is it you we’re looking for? We’re on the lookout for talent to join our team in-store. A Telstra Retail Consultant is a multi-faceted role, and we have found it suits people with these attributes and skills: The ability to easily build a connection with a variety of new and existing customers An appetite to quickly develop customised solutions for customers A drive to reach (and exceed!) sales targets and KPIs The hunger to learn and grow within the role (and beyond!) A positive and resilient approach to customer service within a busy environment Experience in a customer-facing role Hit Apply now! After you’ve submitted your application, our next step is an assessment supported by our partner, Hire Vue. Please keep an eye out for their email to move things along. Retail Opportunities at Telstra When you join our team, you become part of a welcoming and inclusive community where everyone is respected, valued, and celebrated. We actively seek individuals from various backgrounds, ethnicities, genders, and abilities because we know that diversity not only strengthens our team but also enriches our work. We have zero tolerance for harassment of any kind, and we prioritise creating a workplace culture where everyone is safe and can thrive. We work flexibly at Telstra, talk to us about what flexibility means to you. When you apply, you can share your pronouns and /or any reasonable adjustments needed to take part equitably during the recruitment process.\n\n   👉 [Apply on the official website via Héra AI](https://telstra.wd3.myworkdayjobs.com/Telstra_Careers/job/Telstra-Store-Geraldton/Telstra-Retail--Customer-Service---Sales-Consultant_JR-10121580)\n\nReply \"more\" for next 5 results."
```

---

## Test 11: recommend_jobs - Senior Software Engineer - Sydney

**Status**: 200 | **Elapsed**: 16093ms | **Result**: ❌ FAIL

**Failure Reason**: Only found 0 jobs (expected >= 3)

### Input

```json
{
  "user_profile": {
    "jobTitles": [
      "Senior Software Engineer"
    ],
    "skills": [
      "JavaScript",
      "React",
      "Node.js",
      "TypeScript",
      "AWS",
      "Docker",
      "Kubernetes"
    ],
    "city": "Sydney",
    "seniority": "Senior"
  },
  "limit": 5
}
```

### Output

```json
"# 🎯 Personalized Job Recommendations\n\nFound 5 personalized job recommendations based on recent postings. All jobs are sorted by match score (69% - 68%).\n\n💡 **根据你的简历推测目标职位为『Senior Software Engineer』**，地点为『Sydney』。如有其他补充信息或想法，请告诉我！\n\n\n1. \n   Cox Purtell Staffing Services\n   Sydney, Australia\n\n   **Match:** 69% (Experience: 64%, Skills: 59%, Industry: 69%, Other: 74% - Our client is a VC-backed, high-growth FinTech on ...)\n\n   **Job Highlights:**\n   • Our client is a VC-backed, high-growth FinTech on a mission to elevate the finances of everyday Australians.\n   • This role offers the chance to make critical technical decisions that will define the future of their platform.\n   • The focus is on scaling the product with best-in-class CI/CD, stability, and performance using a modern, cutting-edge stack.\n\n   **Must-Have Skills:**\n   • Serverless architecture\n   • AWS AppSync and Amplify\n   • JavaScript/TypeScript development\n   • React and React Native frontend\n   • CI/CD best practices\n\n   **Nice-to-Have Skills:**\n   • Ownership mindset\n   • Problem solving skills\n   • Mission-driven engineering\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.seek.com.au/job/88886290?type=standard&ref=search-standalone#sol=33ad9762b11fed40f4ae180eceec74c053aa48b2)\n\n2. \n   Objective Corporation\n   Sydney, Australia\n\n   **Match:** 69% (Experience: 64%, Skills: 59%, Industry: 69%, Other: 74% - At Objective, we build technology that empowers go...)\n\n   **Job Highlights:**\n   • At Objective, we build technology that empowers government and community organisations to make better decisions, deliver better services, and create stronger outcomes.\n   • You’ll play a key role in our transition to an AWS-hosted platform, ensuring our products remain modern, scalable, and secure.\n   • Your work has a purpose- everything we build helps customers deliver outcomes that matter.\n\n   **Must-Have Skills:**\n   • .NET (C#) full stack development\n   • Modern JavaScript frameworks (React or Angular)\n   • AWS cloud services expertise\n   • Relational and NoSQL databases\n   • RESTful APIs and SOA patterns\n\n   **Nice-to-Have Skills:**\n   • GIS technologies knowledge\n   • Python scripting experience\n   • DevOps tools like Docker or Kubernetes\n   • Strong communication skills\n   • Collaborative cross-functional teamwork\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.seek.com.au/job/88983048?type=standard&ref=search-standalone#sol=c45a0739265b89d10057f8fba2d4acc39d83c14f)\n\n3. \n   Commonwealth Bank\n   Sydney, Australia\n\n   **Match:** 69% (Experience: 64%, Skills: 59%, Industry: 69%, Other: 74% - We’re building tomorrow’s bank today, which means ...)\n\n   **Job Highlights:**\n   • We’re building tomorrow’s bank today, which means we need creative and diverse engineers to help us redefine what customers expect from a bank.\n   • The Cybersecurity Engineering team safeguards the organization by delivering secure, scalable, and high-performing systems that protect critical infrastructure and sensitive data.\n   • As a Senior Software Engineer, you will take technical ownership of critical platforms and services such as Cloudflare and Akamai, ensuring their security, performance, and reliability.\n\n   **Must-Have Skills:**\n   • backend Python API development\n   • Terraform infrastructure as code\n   • automation of Cloudflare and Akamai platforms\n   • DevSecOps mindset and practices\n   • AWS cloud experience\n\n   **Nice-to-Have Skills:**\n   • mentoring and coaching capabilities\n   • experience with shell scripting and PowerShell\n   • knowledge of logging and monitoring tools\n   • strong collaboration skills\n   • experience with Agile software delivery practices\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.seek.com.au/job/88732396?type=standard&ref=search-standalone#sol=5c3a247712de17375c11415e5a0f73be3a8c321f)\n\n4. \n   Microsoft\n   Sydney, Australia\n\n   **Match:** 68% (Experience: 63%, Skills: 58%, Industry: 68%, Other: 73% - Azure Storage team builds and manages the Persiste...)\n\n   **Job Highlights:**\n   • Azure Storage team builds and manages the Persistent Cloud Storage for Microsoft Azure Cloud, supporting major services and large-scale data storage.\n   • The role involves defining technical direction, delivering improvements, and working on complex, highly distributed systems with a focus on performance and reliability.\n   • Microsoft fosters a culture of respect, integrity, accountability, and inclusion, empowering employees to innovate and collaborate towards shared goals.\n\n   **Must-Have Skills:**\n   • Cloud Storage platform development\n   • Highly distributed systems expertise\n   • Coding in C, C++, C#, Java, JavaScript, or Python\n   • Reliability and scalability focus\n   • Debugging live systems\n\n   **Nice-to-Have Skills:**\n   • Thought leadership\n   • Strong communication skills\n   • Growth mindset and innovation\n   • Collaboration and inclusion culture\n\n   **Work Rights:**\n   • Requires: Must pass Microsoft Cloud Background Check\n\n   👉 [Apply on the official website via Héra AI](https://www.seek.com.au/job/88771541?type=standard&ref=search-standalone#sol=9393fa72b20df87f15252abc0b25cf11755e9414)\n\n5. \n   Commonwealth Bank\n   Sydney, New South Wales, Australia,Melbourne, Victoria, Australia\n\n   **Match:** 68% (Experience: 63%, Skills: 58%, Industry: 68%, Other: 73% - We are leading the world in AI ambition within Aus...)\n\n   **Job Highlights:**\n   • We are leading the world in AI ambition within Australia’s largest bank and fintech, engineering the future of banking with innovative Gen AI solutions.\n   • The AI Powered Engineering team operates at the intersection of platform engineering, developer productivity, and applied AI, shipping pragmatic, reusable capabilities that fit enterprise standards.\n   • You will collaborate on complex technical problems, run hands-on experiments with emerging AI/ML tools, and mentor junior engineers while contributing to architectural discussions and engineering standards.\n\n   **Must-Have Skills:**\n   • AI/ML and GenAI tooling\n   • Microservices architecture\n   • Cloud platforms AWS or Azure\n   • Developer productivity improvement\n   • Agile delivery methodologies\n\n   **Nice-to-Have Skills:**\n   • Exposure to AI tools like Roo Code or Claude\n   • Growth mindset with iterative experimentation\n   • Mentoring and uplifting AI literacy\n   • Working in startup-like dynamic teams\n   • Cross-functional collaboration\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.seek.com.au/job/88927593?type=standard&ref=search-standalone#sol=19580c82eba482f8b7a1e192eacf6d59466613a9)\n\nReply \"more\" for next 5 results.\n\n💡 **What would you like to do next?**\n- Tell me which jobs you like (e.g., \"I like #2 and #5\")\n- Tell me which ones don't interest you (e.g., \"Not interested in #3\")\n- Ask for more similar jobs (e.g., \"Show me more jobs like #2\")\n- Or simply say \"show me more recommendations\""
```

---

## Test 12: recommend_jobs - Mid Data Analyst - Melbourne

**Status**: 200 | **Elapsed**: 14816ms | **Result**: ❌ FAIL

**Failure Reason**: Only found 0 jobs (expected >= 3)

### Input

```json
{
  "user_profile": {
    "jobTitles": [
      "Data Analyst"
    ],
    "skills": [
      "Python",
      "SQL",
      "Pandas",
      "Tableau",
      "Machine Learning",
      "Statistics"
    ],
    "city": "Melbourne",
    "seniority": "Mid"
  },
  "limit": 5
}
```

### Output

```json
"# 🎯 Personalized Job Recommendations\n\nFound 5 personalized job recommendations based on recent postings. All jobs are sorted by match score (69% - 66%).\n\n💡 **根据你的简历推测目标职位为『Data Analyst』**，地点为『Melbourne』。如有其他补充信息或想法，请告诉我！\n\n\n1. \n   TwoScots Recruitment\n   Melbourne, Australia\n\n   **Match:** 69% (Experience: 64%, Skills: 59%, Industry: 69%, Other: 74% - TwoScots are partnering with a well-known organisa...)\n\n   **Job Highlights:**\n   • TwoScots are partnering with a well-known organisation in the Education Sector, seeking a Data Analyst to join their growing team based in the Melbourne CBD.\n   • This is a 3 month, temp opportunity with strong possibility for permanency for the right candidate.\n   • The role offers a flexible hybrid working arrangement and a collaborative, values-driven team environment.\n\n   **Must-Have Skills:**\n   • Strong Power BI skills\n   • Dashboard creation and data visualisation\n   • Analyse large and complex data sets\n   • Excellent communication and stakeholder engagement\n\n   **Nice-to-Have Skills:**\n   • Collaborative and values-driven team environment\n   • Flexible hybrid working arrangement\n   • Strong attention to detail\n   • Structured analytical approach\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.seek.com.au/job/88898642?type=standard&ref=search-standalone)\n\n2. Commercial Real Estate Senior Data Analyst\n   TRS Resourcing\n   Melbourne, Australia\n\n   **Match:** 68% (Experience: 63%, Skills: 58%, Industry: 68%, Other: 73% - You’ll support major transactions across Build-to-...)\n\n   **Job Highlights:**\n   • You’ll support major transactions across Build-to-Rent, Student Accommodation, and Land Lease Communities, assisting in financial analysis, feasibility modelling, and marketing strategy for high-profile property assets.\n   • This role involves working closely with senior partners and agents on a diverse range of investment and development projects.\n   • Attractive salary plus bonus incentives are offered along with ongoing professional development and clear career growth pathways.\n\n   **Must-Have Skills:**\n   • Development feasibility and financial modelling\n   • Market research and property analysis\n   • Advanced Excel skills\n   • CRM systems maintenance\n   • Supporting national analyst team\n\n   **Nice-to-Have Skills:**\n   • Strong communication and organisational skills\n   • Collaborative high-energy team environment\n   • Estate Master experience\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.seek.com.au/job/88558074?type=standard&ref=search-standalone#sol=544c553f4176a480c705acdba4ea955d0f803a03)\n\n3. \n   Ededge Groups\n   Melbourne, Australia\n\n   **Match:** 67% (Experience: 62%, Skills: 57%, Industry: 67%, Other: 72% - Ededge is dedicated to nurturing youth potential a...)\n\n   **Job Highlights:**\n   • Ededge is dedicated to nurturing youth potential and empowering exploration in technology and high-growth fields through practical learning experiences.\n   • The internship offers hands-on experience working on real-world data projects, collaborating with a multidisciplinary team, and applying advanced analytical techniques.\n   • Interns gain access to expert mentorship, professional development resources, and potential performance-based incentives with opportunities for full-time roles.\n\n   **Must-Have Skills:**\n   • Data preprocessing and visualization\n   • Python programming for Exploratory Data Analysis\n   • Machine learning and data mining methods\n   • Developing analytical skills\n   • Creating reports and presentations\n\n   **Nice-to-Have Skills:**\n   • Excellent communication and teamwork skills\n   • Strong problem-solving and critical thinking abilities\n   • Ability to work independently and remotely\n   • Access to expert mentorship\n   • Opportunities for full-time roles\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.linkedin.com/jobs/view/4350250020/?eBP=CwEAAAGbIPgLhxiPBl34h2JZI_O3zoJuKzYLTFmkqSmd7FnAfRckAmQn2wPO44rZdtb-atppvXeua_YmDX2rFxOKLIQruDcbvoS2f4h46PR8xwj83pwkkiF2posdbLOKzv-cScRzAC5t4bQJAorgTAlEw1Tu5HkemFjTDoMO9GJcV4PEKhoo_7ty7A-cPg5MqYboGwd6Xw4JEESEqZIzwPXcszOCgGaEoXlB5YfuWYkFY9cpiv0a6kY_cBeokaofB8n3f9NDi9oQr7Yg5-FTLXQ2oXVGjYb2-fqfw01b9wFhxCa9_Lvzj3isxG6dKL_esT4R3cPqZqObfVu7GXj7K1I3cxu6sl6Z8HLE4mDyTSzJ9vC8_vK7lzLdpnYntvLsK7-ngiHLCt5evgHO&refId=bUSmMqI4ZEd2NJfeeqyStA%3D%3D&trackingId=WXhg2zG%2Ft%2BtjHQG%2FAkhbvw%3D%3D&trk=flagship3_search_srp_jobs)\n\n4. \n   AustralianSuper\n   Melbourne, Australia\n\n   **Match:** 67% (Experience: 62%, Skills: 57%, Industry: 67%, Other: 72% - The Data Analyst, ESG & Stewardship, will support ...)\n\n   **Job Highlights:**\n   • The Data Analyst, ESG & Stewardship, will support the Project Team in ensuring compliance with Australian Sustainability Reporting Standards, especially AASB S2 Climate-related Disclosures.\n   • AustralianSuper is committed to colleague development, offering ongoing learning, coaching, training, and career opportunities across a growing global organisation.\n   • The company cultivates a workplace that champions safety, respect, inclusiveness and diversity, supporting flexible working arrangements and reasonable adjustments.\n\n   **Must-Have Skills:**\n   • Data analysis and cleansing\n   • Power BI reporting and visualization\n   • Mapping regulatory data requirements\n   • Data quality controls and governance\n   • Stakeholder collaboration and communication\n\n   **Nice-to-Have Skills:**\n   • Keen interest in datasets\n   • Problem-solving and attention to detail\n   • Organisational and prioritisation skills\n   • Experience with climate-related risk data\n   • Ability to translate technical requirements\n\n   **Work Rights:**\n   • Requires: Australian or New Zealand citizenship or Australian permanent residency required\n   • Sponsorship: not_available\n\n   👉 [Apply on the official website via Héra AI](https://www.seek.com.au/job/89069035?type=standard&ref=search-standalone#sol=07a205cf9e598bd4fc25ef792559569ec9c33bcd)\n\n5. \n   Milestone Information Technology\n   Melbourne, Australia\n\n   **Match:** 66% (Experience: 61%, Skills: 56%, Industry: 66%, Other: 71% - Milestone IT is partnering with a leading healthca...)\n\n   **Job Highlights:**\n   • Milestone IT is partnering with a leading healthcare organisation to deliver innovative, data-driven solutions that directly improve patient care and operational efficiency.\n   • The role involves designing, building, and maintaining robust ETL/ELT pipelines and supporting enterprise-level cloud data platforms to enable advanced analytics.\n   • Employees benefit from a supportive team environment, competitive rates, flexible working arrangements, and the opportunity to contribute to healthcare outcomes through data innovation.\n\n   **Must-Have Skills:**\n   • Strong experience with SQL\n   • Cloud data services expertise\n   • Building and managing data pipelines\n   • Data warehousing concepts knowledge\n   • Healthcare data experience\n\n   **Nice-to-Have Skills:**\n   • Strong communication skills\n   • Ability to work in cross-functional teams\n   • Supportive team environment\n   • Career-growth opportunities\n   • Flexible working arrangements\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.seek.com.au/job/89027697?type=standard&ref=search-standalone#sol=beb2216d583c1e1461802db823a30b9e561cf6f3)\n\nReply \"more\" for next 5 results.\n\n💡 **What would you like to do next?**\n- Tell me which jobs you like (e.g., \"I like #2 and #5\")\n- Tell me which ones don't interest you (e.g., \"Not interested in #3\")\n- Ask for more similar jobs (e.g., \"Show me more jobs like #2\")\n- Or simply say \"show me more recommendations\""
```

---

## Test 13: recommend_jobs - Junior Product Manager - Brisbane

**Status**: 200 | **Elapsed**: 13257ms | **Result**: ❌ FAIL

**Failure Reason**: Only found 0 jobs (expected >= 3)

### Input

```json
{
  "user_profile": {
    "jobTitles": [
      "Product Manager"
    ],
    "skills": [
      "Product Strategy",
      "Agile",
      "Scrum",
      "User Research",
      "Analytics"
    ],
    "city": "Brisbane",
    "seniority": "Junior"
  },
  "limit": 5
}
```

### Output

```json
"# 🎯 Personalized Job Recommendations\n\nFound 5 personalized job recommendations based on recent postings. All jobs are sorted by match score (69% - 68%).\n\n💡 **根据你的简历推测目标职位为『Product Manager』**，地点为『Brisbane』。如有其他补充信息或想法，请告诉我！\n\n\n1. \n   Motorola Solutions\n   Brisbane, Australia\n\n   **Match:** 69% (Experience: 64%, Skills: 59%, Industry: 69%, Other: 74% - The Motorola Solutions Graduate Program offers an ...)\n\n   **Job Highlights:**\n   • The Motorola Solutions Graduate Program offers an intense and engaging experience working with software, network, and system engineers on mission-critical applications.\n   • The role involves supporting design verification, developing test automation, and collaborating with multi-disciplinary teams to enhance public safety communication solutions.\n   • Motorola Solutions fosters a people-first and community-focused culture, empowering employees to deliver on the promise of a safer world.\n\n   **Must-Have Skills:**\n   • IP Networks and RF systems experience\n   • Test automation and software development\n   • Design verification of communication solutions\n   • Technical expertise in customer network support\n   • Collaboration with multi-disciplinary teams\n\n   **Nice-to-Have Skills:**\n   • Knowledge of IT Infrastructure\n   • Industry certification in networking or communications\n   • Understanding of digital communications systems\n   • Interest in emerging technologies\n   • Excellent communication and influencing skills\n\n   **Work Rights:**\n   • Requires: Not specified\n   • Sponsorship: not_available\n\n   👉 [Apply on the official website via Héra AI](https://motorolasolutions.wd5.myworkdayjobs.com/en-US/Careers/job/Murarrie-Australia/Graduate-Engineer_R58930/apply/autofillWithResume)\n\n2. \n   Hays\n   Brisbane, Australia\n\n   **Match:** 69% (Experience: 64%, Skills: 59%, Industry: 69%, Other: 74% - Join a global leader in interactive entertainment ...)\n\n   **Job Highlights:**\n   • Join a global leader in interactive entertainment that is shaping the future of gaming and technology.\n   • Take full responsibility for delivering the mobile app to market and mentor other developers.\n   • Enjoy opportunities for professional growth and learning in a flexible, remote-friendly work environment.\n\n   **Must-Have Skills:**\n   • React Native mobile app development\n   • Experience with Expo framework\n   • Proficiency in TypeScript and Node.js\n   • Automated testing with Jest and Cypress\n   • Mobile app deployment on Android and iOS\n\n   **Nice-to-Have Skills:**\n   • Mentoring and guiding team members\n   • Familiarity with competitive video games\n   • Contributions to open-source projects\n   • Experience in tech startups\n   • Positive and solution-oriented mindset\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.linkedin.com/jobs/view/4343239038/?eBP=NOT_ELIGIBLE_FOR_CHARGING&refId=heJ%2B5lHt4irWOlULlAOoKA%3D%3D&trackingId=4E9uZ7WugBStyl2%2BGwVXkA%3D%3D&trk=flagship3_search_srp_jobs)\n\n3. Software Engineer\n   Trilogy Care Pty Ltd\n   Brisbane, Australia\n\n   **Match:** 69% (Experience: 64%, Skills: 59%, Industry: 69%, Other: 74% - At Trilogy Care, AI isn’t a side project, it’s how...)\n\n   **Job Highlights:**\n   • At Trilogy Care, AI isn’t a side project, it’s how we build and transform health and care technology.\n   • You’ll work in a fast-growing product and engineering team solving deeply human challenges with modern tools and agile ways of working.\n   • The company offers a vibrant team culture, career progression opportunities, hybrid working environment, and various employee benefits including salary packaging and wellness support.\n\n   **Must-Have Skills:**\n   • React, Vue, TypeScript development\n   • Full-stack web and mobile applications\n   • REST API integration\n   • Performance and accessibility optimisation\n   • Agile development environment\n\n   **Nice-to-Have Skills:**\n   • Familiarity with WCAG 2.2\n   • Backend/serverless experience\n   • Cloud platforms knowledge\n   • DevOps tools experience\n   • Collaborative team culture\n\n   **Work Rights:**\n   • Requires: Must have full Australian work rights\n   • Sponsorship: not_available\n\n   👉 [Apply on the official website via Héra AI](https://www.seek.com.au/job/88571773?type=standard&ref=search-standalone)\n\n4. \n   Leonardo.Ai\n   Brisbane, Australia\n\n   **Match:** 68% (Experience: 63%, Skills: 58%, Industry: 68%, Other: 73% - At Leonardo.Ai, we’re building a world-class R&D t...)\n\n   **Job Highlights:**\n   • At Leonardo.Ai, we’re building a world-class R&D team shaping next-generation creative tools for over 250 million users worldwide.\n   • As a Senior Front-End Engineer, you will design elegant, maintainable front-end systems and collaborate closely with designers, product managers, and AI researchers.\n   • We offer a flexible work environment, inclusive culture, impactful projects in AI creativity, and benefits including 20 days annual leave, equity rewards, and extensive parental leave.\n\n   **Must-Have Skills:**\n   • React development\n   • Next.js (App Router)\n   • TypeScript programming\n   • GraphQL experience\n   • CI/CD pipelines\n\n   **Nice-to-Have Skills:**\n   • Collaborative architecture design\n   • Empathetic leadership and mentoring\n   • Growth mindset and curiosity\n   • Strong communication skills\n   • Creative tools passion\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://jobs.ashbyhq.com/leonardo.ai/a87ab5b0-ab7e-4f5f-8323-93db19146d47/application?utm_source=vNEkJaDy8w)\n\n5. \n   Kraken\n   Brisbane, Australia\n\n   **Match:** 68% (Experience: 63%, Skills: 58%, Industry: 68%, Other: 73% - Kraken is a mission-focused company dedicated to a...)\n\n   **Job Highlights:**\n   • Kraken is a mission-focused company dedicated to accelerating global crypto adoption and financial inclusion through secure, innovative blockchain products.\n   • The Institutional Engineering Team builds high-performance custody and settlement systems that protect digital assets for institutional clients with a focus on security, reliability, and scalability.\n   • Engineers collaborate across teams to design, develop, and maintain backend microservices and frontend applications, contributing to a transparent and DevOps-oriented culture.\n\n   **Must-Have Skills:**\n   • Node.js and TypeScript development\n   • Microservices and event-driven architectures\n   • React and Next.js frontend development\n   • SQL database schema design\n   • Docker and CI/CD pipelines\n\n   **Nice-to-Have Skills:**\n   • Understanding of crypto protocols and staking\n   • Experience with gRPC and Protocol Buffers\n   • Hands-on Rust programming\n   • Background in financial and regulated environments\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://jobs.ashbyhq.com/kraken.com/c2e8c3e1-dae3-4f6d-9795-2a5c3ead8496/application?utm_source=LinkedIn)\n\nReply \"more\" for next 5 results.\n\n💡 **What would you like to do next?**\n- Tell me which jobs you like (e.g., \"I like #2 and #5\")\n- Tell me which ones don't interest you (e.g., \"Not interested in #3\")\n- Ask for more similar jobs (e.g., \"Show me more jobs like #2\")\n- Or simply say \"show me more recommendations\""
```

---

## Test 14: recommend_jobs - Senior UX Designer - Perth

**Status**: 200 | **Elapsed**: 8204ms | **Result**: ❌ FAIL

**Failure Reason**: Only found 0 jobs (expected >= 3)

### Input

```json
{
  "user_profile": {
    "jobTitles": [
      "UX Designer"
    ],
    "skills": [
      "Figma",
      "User Research",
      "Prototyping",
      "Design Systems",
      "Accessibility"
    ],
    "city": "Perth",
    "seniority": "Senior"
  },
  "limit": 5
}
```

### Output

```json
"No recent job postings found. Try adjusting your search criteria or check back later for new postings."
```

---

## Test 15: recommend_jobs - Mid Marketing Manager - Adelaide

**Status**: 200 | **Elapsed**: 9444ms | **Result**: ❌ FAIL

**Failure Reason**: Only found 0 jobs (expected >= 3)

### Input

```json
{
  "user_profile": {
    "jobTitles": [
      "Marketing Manager"
    ],
    "skills": [
      "Digital Marketing",
      "SEO",
      "Content Strategy",
      "Analytics",
      "Campaign Management"
    ],
    "city": "Adelaide",
    "seniority": "Mid"
  },
  "limit": 5
}
```

### Output

```json
"# 🎯 Personalized Job Recommendations\n\nFound 1 personalized job recommendations based on recent postings. All jobs are sorted by match score (60% - 60%).\n\n💡 **根据你的简历推测目标职位为『Marketing Manager』**，地点为『Adelaide』。如有其他补充信息或想法，请告诉我！\n\n\n1. \n   jllcareers.com\n   Adelaide, Australia\n\n   **Match:** 60% (Experience: 55%, Skills: 50%, Industry: 60%, Other: 65% - position at jllcareers.com)\n\n   **Job Highlights:**\n   • Basic match:  position\n   • Location: Adelaide, Australia\n   • Company: jllcareers.com\n\n   👉 [Apply on the official website via Héra AI](https://jll.wd1.myworkdayjobs.com/jllcareers/job/Adelaide-SA/Centre-Manager_REQ471231)\n\nReply \"more\" for next 5 results.\n\n💡 **What would you like to do next?**\n- Tell me which jobs you like (e.g., \"I like #2 and #5\")\n- Tell me which ones don't interest you (e.g., \"Not interested in #3\")\n- Ask for more similar jobs (e.g., \"Show me more jobs like #2\")\n- Or simply say \"show me more recommendations\""
```

---

## Test 16: recommend_jobs - Senior Consultant - Geelong (Regional)

**Status**: 200 | **Elapsed**: 7246ms | **Result**: ❌ FAIL

**Failure Reason**: Only found 0 jobs (expected >= 3)

### Input

```json
{
  "user_profile": {
    "jobTitles": [
      "Business Consultant"
    ],
    "skills": [
      "Strategy",
      "Business Analysis",
      "Project Management",
      "Stakeholder Management",
      "Process Improvement"
    ],
    "city": "Geelong",
    "seniority": "Senior"
  },
  "limit": 5
}
```

### Output

```json
"No recent job postings found. Try adjusting your search criteria or check back later for new postings."
```

---

## Test 17: recommend_jobs - Mid Accountant - Newcastle (Regional)

**Status**: 200 | **Elapsed**: 9147ms | **Result**: ❌ FAIL

**Failure Reason**: Only found 0 jobs (expected >= 3)

### Input

```json
{
  "user_profile": {
    "jobTitles": [
      "Accountant"
    ],
    "skills": [
      "Accounting",
      "Tax",
      "Financial Reporting",
      "Excel",
      "QuickBooks"
    ],
    "city": "Newcastle",
    "seniority": "Mid"
  },
  "limit": 5
}
```

### Output

```json
"# 🎯 Personalized Job Recommendations\n\nFound 2 personalized job recommendations based on recent postings. All jobs are sorted by match score (69% - 58%).\n\n💡 **根据你的简历推测目标职位为『Accountant』**，地点为『Newcastle』。如有其他补充信息或想法，请告诉我！\n\n\n1. Project Accountant\n   Nomad Digital\n   Newcastle, United Kingdom\n\n   **Match:** 69% (Experience: 64%, Skills: 59%, Industry: 69%, Other: 74% - Nomad Digital is the world's leading provider of p...)\n\n   **Job Highlights:**\n   • Nomad Digital is the world's leading provider of passenger and fleet connectivity solutions to the railway industry, serving over 80 global customers in more than 40 countries.\n   • This role involves overseeing all financial aspects of a portfolio of projects from bid submission to closure, including tracking invoicing, costs, cashflow, and collaborating with project managers on margin and risk management.\n   • Benefits include Health Care Cash Plan, Life Assurance, Critical Illness Cover, Contributory Pension Scheme, Car Lease Scheme, Workplace Nursery Scheme, and enhanced family leave entitlements.\n\n   **Must-Have Skills:**\n   • Project cost collection and analysis\n   • Revenue recognition IFRS15 compliance\n   • Monthly project account preparation\n   • ERP system experience\n   • Budgeting and forecasting\n\n   **Nice-to-Have Skills:**\n   • Competitive tendering experience\n   • Continuous improvement mindset\n   • Proactive and diplomatic approach\n   • Ability to manipulate large data volumes\n   • Collaborative team environment\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://nomaddigital.bamboohr.com/careers/184)\n\n2. Senior Project Accountant\n   Beca\n   Newcastle, Australia\n\n   **Match:** 58% (Experience: 53%, Skills: 50%, Industry: 58%, Other: 63% - This role is an opportunity to play a vital part i...)\n\n   **Job Highlights:**\n   • This role is an opportunity to play a vital part in driving financial success across our project portfolio by working closely with project leaders and corporate teams.\n   • Beca offers a collaborative and diverse team environment with professional development training programmes and flexible working arrangements to support work-life balance.\n   • Beca is one of the Asia-Pacific region's largest employee-owned professional services consultancies, fostering a culture based on partnership, tenacity, enjoyment, and care.\n\n   **Must-Have Skills:**\n   • Project and contract management experience\n   • Familiarity with Oracle Project Management\n   • Strong communication and numeracy skills\n   • Effective time management\n   • Financial reporting and forecasting\n\n   **Nice-to-Have Skills:**\n   • Commitment to continuous development\n   • Collaboration across teams\n   • Building trusted client relationships\n   • Adherence to workplace safety standards\n   • Supportive and diverse team culture\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://beca.wd105.myworkdayjobs.com/Beca/job/Newcastle-Australia/Senior-Project-Accountant_JR100087)\n\nReply \"more\" for next 5 results.\n\n💡 **What would you like to do next?**\n- Tell me which jobs you like (e.g., \"I like #2 and #5\")\n- Tell me which ones don't interest you (e.g., \"Not interested in #3\")\n- Ask for more similar jobs (e.g., \"Show me more jobs like #2\")\n- Or simply say \"show me more recommendations\""
```

---

## Test 18: recommend_jobs - Junior Developer - Sydney

**Status**: 200 | **Elapsed**: 13431ms | **Result**: ❌ FAIL

**Failure Reason**: Only found 0 jobs (expected >= 3)

### Input

```json
{
  "user_profile": {
    "jobTitles": [
      "Junior Developer"
    ],
    "skills": [
      "JavaScript",
      "HTML",
      "CSS",
      "React",
      "Git"
    ],
    "city": "Sydney",
    "seniority": "Junior"
  },
  "limit": 5
}
```

### Output

```json
"# 🎯 Personalized Job Recommendations\n\nFound 5 personalized job recommendations based on recent postings. All jobs are sorted by match score (69% - 66%).\n\n💡 **根据你的简历推测目标职位为『Junior Developer』**，地点为『Sydney』。如有其他补充信息或想法，请告诉我！\n\n\n1. Junior C++/C# Developer\n   Green Light PS Pty Ltd\n   Sydney, Australia\n\n   **Match:** 69% (Experience: 64%, Skills: 59%, Industry: 69%, Other: 74% - Green Light PS Pty Ltd is seeking Junior Developer...)\n\n   **Job Highlights:**\n   • Green Light PS Pty Ltd is seeking Junior Developers skilled in C++ and/or C# to support a large program of work across multiple Australian offices.\n   • The role involves writing well documented, high performance, reliable, maintainable code and conducting user acceptance testing to ensure quality standards.\n   • The company is committed to diversity, inclusion, and providing a fair recruitment process, encouraging applications from all backgrounds.\n\n   **Must-Have Skills:**\n   • C++ programming\n   • C# programming\n   • Software version control with Git\n   • Testing activities on transformation projects\n   • Mainframe development willingness\n\n   **Nice-to-Have Skills:**\n   • Technical documentation preparation\n   • Innovative process improvement\n   • Team collaboration\n   • Agile software development lifecycle understanding\n\n   **Work Rights:**\n   • Requires: Must have or be able to obtain AGSVA baseline clearance; Australian citizenship required\n   • Sponsorship: not_available\n\n   👉 [Apply on the official website via Héra AI](https://www.seek.com.au/job/88508912?type=standard&ref=search-standalone#sol=6853549b6635efe38c451b5429a84a1430670c88)\n\n2. Frontend Developer\n   LBM Fleet\n   Sydney, Australia\n\n   **Match:** 69% (Experience: 64%, Skills: 59%, Industry: 69%, Other: 74% - You'll be working on a market-leading product with...)\n\n   **Job Highlights:**\n   • You'll be working on a market-leading product with a highly engaged customer base, so everything you build will have an instant, positive impact.\n   • We have an ambitious roadmap that includes delivering new features while maintaining existing functionality and migrating from legacy .NET Framework 4.8 projects to .NET 8+.\n   • The role is fully remote but requires candidates to be based in NSW or QLD Australia with Australian Citizenship or Permanent Residence visa.\n\n   **Must-Have Skills:**\n   • ASP.NET MVC 5 / Razor expertise\n   • JavaScript and jQuery professional experience\n   • Telerik Kendo UI complex implementations\n   • Responsive Design with Bootstrap\n   • WCAG 2.1 Level AA accessibility\n\n   **Nice-to-Have Skills:**\n   • .NET Core / ASP.NET Core experience\n   • Modern JavaScript / TypeScript skills\n   • Legacy-to-modern migration experience\n   • State management patterns knowledge\n   • Testing frameworks familiarity\n\n   **Work Rights:**\n   • Requires: Australian Citizenship or Permanent Residence visa required\n   • Sponsorship: not_available\n\n   👉 [Apply on the official website via Héra AI](https://www.linkedin.com/jobs/view/4319150708/?eBP=NOT_ELIGIBLE_FOR_CHARGING&refId=6yaxmsHasqVZVvqxCeGBrA%3D%3D&trackingId=OkO%2FCUTe4jvKfCQH7xvsFA%3D%3D&trk=flagship3_search_srp_jobs)\n\n3. Team Lead / Consultant - AI & Full Stack Developer\n   Accenture Australia\n   Sydney, Australia\n\n   **Match:** 67% (Experience: 62%, Skills: 57%, Industry: 67%, Other: 72% - Lead small teams and delivery workstreams focused ...)\n\n   **Job Highlights:**\n   • Lead small teams and delivery workstreams focused on AI-first and full-stack solutions to deliver measurable business value.\n   • Coach and guide junior developers, analysts, and engineers on best practices in AI/ML and software engineering.\n   • Accenture fosters an inclusive, bias-free workplace and supports employee well-being with progressive benefits and learning opportunities.\n\n   **Must-Have Skills:**\n   • Full-stack development expertise\n   • AI/ML delivery experience\n   • Python and JavaScript/TypeScript coding\n   • Experience with React and Angular\n   • GenAI tools and ML frameworks\n\n   **Nice-to-Have Skills:**\n   • Mentoring and coaching skills\n   • Passion for emerging AI technologies\n   • Strong delivery execution skills\n   • Inclusive and diverse workplace mindset\n   • Holistic well-being support\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.accenture.com/au-en/careers/jobdetails?id=R00283889_en&src=LINKEDINJP)\n\n4. Senior Full Stack Developer\n   Australian Energy Market Operator (AEMO)\n   Sydney, Australia\n\n   **Match:** 67% (Experience: 62%, Skills: 57%, Industry: 67%, Other: 72% - AEMO is Australia’s independent energy system and ...)\n\n   **Job Highlights:**\n   • AEMO is Australia’s independent energy system and market operator committed to enabling a net zero economy by 2050.\n   • The Senior Full Stack Developer will design and implement microservices and APIs, manage Azure DevOps repos, and lead technical decisions to support the Meter Data Management platform.\n   • Employees benefit from flexible working arrangements, professional development opportunities, volunteering leave, performance bonuses, and wellness programs.\n\n   **Must-Have Skills:**\n   • Node.js application development\n   • C# application development\n   • Azure Kubernetes Service (AKS)\n   • Azure Function Apps\n   • CI/CD pipeline management\n\n   **Nice-to-Have Skills:**\n   • NGINX Ingress Controller knowledge\n   • mTLS secure communication\n   • Mentoring junior developers\n   • Collaborating with cloud engineers and architects\n   • Performance tuning and scaling\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://career10.successfactors.com/career?career_ns=job_listing&company=AEMOProd&navBarLevel=JOB_SEARCH&rcm_site_locale=en_GB&career_job_req_id=12699)\n\n5. \n   Frontend Simplified\n   Sydney, Australia\n\n   **Match:** 66% (Experience: 61%, Skills: 56%, Industry: 66%, Other: 71% - Frontend Simplified is an online bootcamp that hel...)\n\n   **Job Highlights:**\n   • Frontend Simplified is an online bootcamp that helps thousands of students learn frontend development and build real portfolio projects.\n   • The Frontend Mentor will support students by answering technical questions, debugging issues, reviewing projects, and hosting Zoom calls.\n   • This is a full-time remote role requiring a working camera and microphone for video calls.\n\n   **Must-Have Skills:**\n   • Strong experience with HTML, CSS, JavaScript\n   • Proficient in React, Tailwind, Next.js\n   • Knowledge of Typescript and Redux\n   • Good debugging skills\n   • Reliable internet connection\n\n   **Nice-to-Have Skills:**\n   • Basic understanding of backend concepts\n   • Experience mentoring junior developers\n   • Comfortable with project-based learning\n   • Clear communication and patience\n   • Positive and encouraging learning environment\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.linkedin.com/jobs/view/4326705650/?eBP=NOT_ELIGIBLE_FOR_CHARGING&refId=ioW4I04ipjsLhcGxe0T5hQ%3D%3D&trackingId=ZmjRR8qJQc7SDlMcxUjt1g%3D%3D&trk=flagship3_search_srp_jobs)\n\nReply \"more\" for next 5 results.\n\n💡 **What would you like to do next?**\n- Tell me which jobs you like (e.g., \"I like #2 and #5\")\n- Tell me which ones don't interest you (e.g., \"Not interested in #3\")\n- Ask for more similar jobs (e.g., \"Show me more jobs like #2\")\n- Or simply say \"show me more recommendations\""
```

---

## Test 19: recommend_jobs - Mid Business Analyst - Melbourne

**Status**: 200 | **Elapsed**: 13072ms | **Result**: ❌ FAIL

**Failure Reason**: Only found 0 jobs (expected >= 3)

### Input

```json
{
  "user_profile": {
    "jobTitles": [
      "Business Analyst"
    ],
    "skills": [
      "Requirements Analysis",
      "Process Mapping",
      "Stakeholder Management",
      "SQL",
      "Visio"
    ],
    "city": "Melbourne",
    "seniority": "Mid"
  },
  "limit": 5
}
```

### Output

```json
"# 🎯 Personalized Job Recommendations\n\nFound 5 personalized job recommendations based on recent postings. All jobs are sorted by match score (68% - 67%).\n\n💡 **根据你的简历推测目标职位为『Business Analyst』**，地点为『Melbourne』。如有其他补充信息或想法，请告诉我！\n\n\n1. \n   Launch Group\n   Melbourne, Australia\n\n   **Match:** 68% (Experience: 63%, Skills: 58%, Industry: 68%, Other: 73% - Drive audit readiness and uplift governance, risk,...)\n\n   **Job Highlights:**\n   • Drive audit readiness and uplift governance, risk, and compliance practices across the security program.\n   • Lead preparation for NIST 2.0, streamline evidence collection, and design automation to enhance control consistency and efficiency.\n   • Track findings through to closure and maintain clear documentation standards for repeatable audits.\n\n   **Must-Have Skills:**\n   • NIST 800-series and NIST 2.0 expertise\n   • SOX/JSOX and Essential Eight controls knowledge\n   • Audit artifact assembly and management\n   • Automation of control testing and evidence capture\n   • Familiarity with SIEM and GRC platforms\n\n   **Nice-to-Have Skills:**\n   • Agile and Waterfall delivery experience\n   • Strong stakeholder engagement and communication\n   • Team-first and flexible working style\n   • Proactive risk management and escalation\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.launchrecruitment.com.au/jobs?ja-job=1058844&utm_source=LinkedIn)\n\n2. \n   TechnologyOne\n   Melbourne, Australia\n\n   **Match:** 68% (Experience: 63%, Skills: 58%, Industry: 68%, Other: 73% - The P&R Transitions team helps local governments t...)\n\n   **Job Highlights:**\n   • The P&R Transitions team helps local governments transition to TechnologyOne's CiAnywhere platform for Property & Rating solutions.\n   • TechnologyOne offers a competitive remuneration package, flexible hours, free gym membership, and access to LinkedIn Learning for career growth.\n   • The company values diversity and inclusion, fostering a vibrant workplace culture with numerous employee benefits and community involvement.\n\n   **Must-Have Skills:**\n   • Property and Rating Compliance module experience\n   • Business process analysis and optimization\n   • System configuration within TechnologyOne P&R modules\n   • Data migration and validation management\n   • Integration with TechnologyOne enterprise modules\n\n   **Nice-to-Have Skills:**\n   • Problem-solving and innovative solutions\n   • Strong communication and presentation skills\n   • Experience as Business Analyst or Systems Analyst\n   • Customer-focused transition management\n   • Knowledge of local government operations\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.aplitrak.com/?adid=dHlsZXIuc2FuZGVycy45NzIxMy4xNTUwQHRlY2hvbmVsaW1pdGVkYXUuYXBsaXRyYWsuY29t)\n\n3. \n   Logicalis Australia\n   Melbourne, Australia\n\n   **Match:** 68% (Experience: 63%, Skills: 58%, Industry: 68%, Other: 73% - You’ll collaborate closely with stakeholders to ca...)\n\n   **Job Highlights:**\n   • You’ll collaborate closely with stakeholders to capture requirements, analyse processes, and support the delivery of innovative solutions across Loyalty, CRM, and Data initiatives.\n   • Logicalis Australia is a technology services provider with a mission to become the leading employer in the Asia-Pacific region, combining global expertise and local insight.\n   • The company is Great Place to Work® Certified for 2025 and 2026, reflecting a people-first culture and commitment to an inclusive, empowering, and growth-oriented environment.\n\n   **Must-Have Skills:**\n   • Business Analyst with 6 years experience\n   • Stakeholder engagement and communication\n   • Requirement gathering and documentation\n   • Process analysis and improvement\n   • Data analysis tools familiarity\n\n   **Nice-to-Have Skills:**\n   • Customer-focused environment\n   • Detail-oriented and collaborative\n   • Passionate about customer engagement\n   • Flexible working arrangement\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.seek.com.au/job/89064186?type=standard&ref=search-standalone)\n\n4. \n   Robert Walters\n   Melbourne, Australia\n\n   **Match:** 68% (Experience: 63%, Skills: 58%, Industry: 68%, Other: 73% - This role plays a critical part in driving adoptio...)\n\n   **Job Highlights:**\n   • This role plays a critical part in driving adoption and integration of Finance and Payroll system changes within a major education-sector organisation's digital transformation program.\n   • You will be responsible for analysing business and system processes, facilitating workshops, and ensuring alignment between business strategy, functional design, and technical solutions.\n   • The position offers a 2-year fixed term contract within a dedicated Digital Change and Transformation function, reporting to the Business Analyst Lead.\n\n   **Must-Have Skills:**\n   • Finance and Payroll process mapping\n   • Business process re-engineering\n   • BPMN modelling expertise\n   • Workshop facilitation skills\n   • System configuration alignment\n\n   **Nice-to-Have Skills:**\n   • Experience with SAP, Oracle, Workday or ADP\n   • Strong analytical thinking\n   • Excellent communication skills\n   • Collaboration with vendors and technical teams\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.seek.com.au/job/88954287?type=standard&ref=search-standalone#sol=30decc8017925092d9f1c5b96812db1501b44530)\n\n5. Business Analyst\n   GRANITE GROUP\n   Melbourne, Australia\n\n   **Match:** 67% (Experience: 62%, Skills: 57%, Industry: 67%, Other: 72% - This role offers the opportunity to support the mi...)\n\n   **Job Highlights:**\n   • This role offers the opportunity to support the migration of Intranet and Controlled Document Management Systems to SharePoint Online within a large-scale, purpose-driven environment.\n   • You will collaborate closely with stakeholders, solution partners, and cross-functional teams to ensure a seamless transition, drive adoption, and align outcomes with organisational goals.\n   • The position is a 12-month fixed-term opportunity with flexible hybrid working arrangements, generous salary packaging options, discounted health insurance and gym memberships, paid parental leave, and supportive development pathways.\n\n   **Must-Have Skills:**\n   • SharePoint Online expertise\n   • Stakeholder engagement skills\n   • Business and functional requirements gathering\n   • Process mapping and improvement\n   • Change management support\n\n   **Nice-to-Have Skills:**\n   • Experience in clinical environments\n   • Training delivery experience\n   • Collaborative and values-driven culture\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.seek.com.au/job/88565789?type=standard&ref=search-standalone#sol=372a47982f356d657454afa74b7b475d4054496c)\n\nReply \"more\" for next 5 results.\n\n💡 **What would you like to do next?**\n- Tell me which jobs you like (e.g., \"I like #2 and #5\")\n- Tell me which ones don't interest you (e.g., \"Not interested in #3\")\n- Ask for more similar jobs (e.g., \"Show me more jobs like #2\")\n- Or simply say \"show me more recommendations\""
```

---

## Test 20: recommend_jobs - Senior Data Scientist - Sydney

**Status**: 200 | **Elapsed**: 15543ms | **Result**: ❌ FAIL

**Failure Reason**: Only found 0 jobs (expected >= 3)

### Input

```json
{
  "user_profile": {
    "jobTitles": [
      "Data Scientist"
    ],
    "skills": [
      "Python",
      "Machine Learning",
      "Deep Learning",
      "TensorFlow",
      "PyTorch",
      "Statistics",
      "Data Visualization"
    ],
    "city": "Sydney",
    "seniority": "Senior"
  },
  "limit": 5
}
```

### Output

```json
"# 🎯 Personalized Job Recommendations\n\nFound 5 personalized job recommendations based on recent postings. All jobs are sorted by match score (69% - 67%).\n\n💡 **根据你的简历推测目标职位为『Data Scientist』**，地点为『Sydney』。如有其他补充信息或想法，请告诉我！\n\n\n1. \n   Culture Amp\n   Sydney, Australia\n\n   **Match:** 69% (Experience: 64%, Skills: 59%, Industry: 69%, Other: 74% - Culture Amp empowers companies to transform employ...)\n\n   **Job Highlights:**\n   • Culture Amp empowers companies to transform employee engagement and develop high-performing teams using the most comprehensive employee dataset in the world.\n   • This role involves leading discovery work to find meaningful patterns in workforce data and partnering with engineers to productionise insights, including integration with an AI assistant called Coach.\n   • The company offers a competitive compensation package with benefits such as employee share options, wellbeing programs, flexible allowances, extended breaks, and a strong commitment to diversity, equity, inclusion, and anti-racism.\n\n   **Must-Have Skills:**\n   • Python and SQL expertise\n   • Statistical modeling and classical ML\n   • Data quality and standardisation\n   • Exploratory data analysis\n   • Productionising data science models\n\n   **Nice-to-Have Skills:**\n   • Data visualisation skills\n   • Curiosity about actionable insights\n   • Experience with HR/people analytics\n   • Causal inference knowledge\n   • Working with large language models\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://job-boards.greenhouse.io/cultureamp/jobs/7483145)\n\n2. \n   Mercor\n   Sydney, Australia\n\n   **Match:** 68% (Experience: 63%, Skills: 58%, Industry: 68%, Other: 73% - Mercor is hiring experienced Go Engineers to suppo...)\n\n   **Job Highlights:**\n   • Mercor is hiring experienced Go Engineers to support high-impact AI research collaborations by developing coding benchmarks.\n   • This is a fully remote, part-time role with flexible working hours and immediate start, offering $90 per hour plus bonuses.\n   • The position involves debugging, optimizing, and documenting benchmark code to ensure reliability and reproducibility.\n\n   **Must-Have Skills:**\n   • Go programming expertise\n   • Backend software engineering\n   • Debugging and testing code\n   • Technical writing skills\n   • Part-time remote work\n\n   **Nice-to-Have Skills:**\n   • Experience with ML engineering\n   • Applied data science background\n   • Flexible asynchronous schedule\n   • Attention to detail\n   • Providing structured feedback\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://hatch.team/job/backend-engineer-go-job_36MAk1IbmDmXsRkcp8JkQE40nOX?utm_source=linkedinjobs&utm_medium=paid-jobboard&utm_campaign=slots)\n\n3. Data Scientist\n   EatClub\n   Sydney, Australia\n\n   **Match:** 68% (Experience: 63%, Skills: 58%, Industry: 68%, Other: 73% - EatClub is revolutionising the hospitality industr...)\n\n   **Job Highlights:**\n   • EatClub is revolutionising the hospitality industry by leveraging data-driven dynamic pricing to boost restaurant profitability and enhance diner experiences.\n   • The Data Scientist role involves working cross-functionally to build predictive models, analyse behavioural data, and deliver actionable insights that fuel platform growth.\n   • The company offers a remote-first culture with full flexibility, a supportive and diverse team, and the opportunity to create significant impact in a fast-growing food-tech SaaS environment.\n\n   **Must-Have Skills:**\n   • Python (Pandas, NumPy, Scikit-learn, PyTorch)\n   • SQL proficiency\n   • AWS cloud data stacks\n   • Machine learning and data modelling\n   • Data pipelines and ETL\n\n   **Nice-to-Have Skills:**\n   • Experience in SaaS or hospitality\n   • A/B testing frameworks\n   • Passion for food and dining\n   • Strong communication and storytelling\n   • Remote-first culture\n\n   **Work Rights:**\n   • Requires: Full working rights in Australia\n   • Sponsorship: not_available\n\n   👉 [Apply on the official website via Héra AI](https://employmenthero.com/jobs/position/f8714f58-f1dd-4b71-a42b-3d906da3afbd/?job_board=lij)\n\n4. Data Scientist\n   QuantumBlack, AI by McKinsey\n   Sydney, Australia\n\n   **Match:** 67% (Experience: 62%, Skills: 57%, Industry: 67%, Other: 72% - You will work on real-world, high-impact projects ...)\n\n   **Job Highlights:**\n   • You will work on real-world, high-impact projects across a variety of industries, identifying micro patterns in data that clients can exploit to maintain their competitive advantage and transform their day-to-day business.\n   • The role offers continuous learning through structured programs, mentorship, and exposure to accelerate your growth as a technologist and leader in a high-performance culture.\n   • You will be part of a global data science community collaborating with diverse multidisciplinary teams and leveraging advanced technologies including Python, PySpark, Airflow, and cloud platforms.\n\n   **Must-Have Skills:**\n   • Machine learning and data mining techniques\n   • Python and SQL programming\n   • Big data frameworks knowledge\n   • Collaborative problem-solving\n   • Data science model development\n\n   **Nice-to-Have Skills:**\n   • Strong mentorship and apprenticeship culture\n   • Global and diverse team environment\n   • Iterative change and experimentation mindset\n   • Presentation and communication skills\n   • Research and conference participation\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://www.mckinsey.com/careers/search-jobs/jobs/datascientist-quantumblackaibymckinsey-103159?appsource=LinkedIn)\n\n5. \n   H2O.ai\n   Sydney, Australia\n\n   **Match:** 67% (Experience: 62%, Skills: 57%, Industry: 67%, Other: 72% - H2O.ai is a market leader democratizing AI with cu...)\n\n   **Job Highlights:**\n   • H2O.ai is a market leader democratizing AI with cutting-edge Generative AI and predictive AI technologies used by over 20,000 global organizations.\n   • The role involves building AI/ML applications, conducting customer training, and supporting customers throughout their GenAI adoption journey.\n   • H2O.ai offers a remote-friendly culture, flexible working environment, and opportunities for career growth within a diverse and inclusive company.\n\n   **Must-Have Skills:**\n   • Hands-on experience in data science and AI\n   • Expertise in LLMs and Generative AI\n   • Proficiency with H2O AI products\n   • Customer-facing communication skills\n   • Python and ML libraries proficiency\n\n   **Nice-to-Have Skills:**\n   • Experience building industry-specific GenAI applications\n   • Thought leadership in AI community\n   • Running AI hackathons and innovation workshops\n   • Familiarity with enterprise-grade AI solutioning\n\n   **Work Rights:**\n   • Requires: Not specified\n\n   👉 [Apply on the official website via Héra AI](https://h2oai.applytojob.com/apply/UvtK2jgbI6?source=LinkedIn)\n\nReply \"more\" for next 5 results.\n\n💡 **What would you like to do next?**\n- Tell me which jobs you like (e.g., \"I like #2 and #5\")\n- Tell me which ones don't interest you (e.g., \"Not interested in #3\")\n- Ask for more similar jobs (e.g., \"Show me more jobs like #2\")\n- Or simply say \"show me more recommendations\""
```

---

## Test 21: tailor_resume - Optimize Resume (no JD)

**Status**: 200 | **Elapsed**: 68ms | **Result**: ✅ PASS

### Input

```json
{
  "user_profile": {
    "skills": [
      "JavaScript",
      "React",
      "Node.js",
      "TypeScript",
      "AWS"
    ],
    "jobTitles": [
      "Software Engineer"
    ],
    "employmentHistory": [
      {
        "company": "Tech Corp",
        "position": "Software Engineer",
        "startDate": "2020-01",
        "endDate": "2023-12",
        "summary": "Developed web applications using React and Node.js"
      }
    ]
  },
  "resume_content": "Software Engineer with 3 years experience in React and Node.js. Worked on multiple web applications."
}
```

### Output

```json
"# 📝 Resume Optimized Successfully\n\nYour resume has been enhanced with:\n\n## What was improved:\n• Professional summary generated with AI\n• Each employment experience rewritten for better impact\n• Measurable outcomes emphasized\n• Strong action verbs used\n\n## Optimized Resume:\n\n**User**\n\n## Professional Summary\nSoftware Engineer with 3 years experience in React and Node.js. Worked on multiple web applications.\n\n## Employment History\n### Software Engineer\n*Tech Corp*\n2020-01 - 2023-12\n\n## Skills\nJavaScript • React • Node.js • TypeScript • AWS\n\n\n\n*All content has been enhanced while preserving accuracy and authenticity.*"
```

---

## Test 22: tailor_resume - Tailor Resume (with JD)

**Status**: 200 | **Elapsed**: 15458ms | **Result**: ✅ PASS

### Input

```json
{
  "user_profile": {
    "skills": [
      "JavaScript",
      "React",
      "Node.js",
      "TypeScript",
      "AWS"
    ],
    "jobTitles": [
      "Software Engineer"
    ],
    "employmentHistory": [
      {
        "company": "Tech Corp",
        "position": "Software Engineer",
        "startDate": "2020-01",
        "endDate": "2023-12",
        "summary": "Developed web applications using React and Node.js"
      }
    ]
  },
  "resume_content": "Software Engineer with 3 years experience in React and Node.js.",
  "job_description": "We are looking for a Senior Software Engineer with experience in React, TypeScript, and cloud technologies. Must have 3+ years of experience.",
  "job_title": "Senior Software Engineer",
  "company": "Tech Startup"
}
```

### Output

```json
"# 📝 Resume Tailored Successfully\n\n**Target Position:** Senior Software Engineer at Tech Startup\n\n**Customization Level:** moderate\n\n## Key Changes Made:\n• Highlighted React, TypeScript, and AWS skills prominently in the 'Technical Skills' section to match the job description requirements.\n• Revised the professional summary to emphasize relevant experience and skills in React, TypeScript, and cloud technologies.\n• Added specific achievements related to performance improvements and leadership in projects to demonstrate capability and results-driven approach.\n• Focused on responsibilities and tools directly related to the job description, such as React, TypeScript, and AWS, to align with the job requirements.\n\n## Summary:\nThe resume was comprehensively tailored to focus on the candidate's experience and proficiency with React, TypeScript, and AWS, which are key requirements for the Senior Software Engineer position at the tech startup. The structure was optimized to highlight relevant skills upfront and demonstrate a track record of successful projects and leadership in technology environments.\n\n## Additional Recommendations:\n• Consider obtaining certifications in AWS or React to further establish expertise in these areas.\n• Update LinkedIn profile to reflect the same skills and experiences highlighted in the resume to maintain consistency across professional profiles.\n• Engage in professional development activities or community projects involving React or TypeScript to stay updated with the latest advancements and increase networking opportunities in the tech community.\n\n## Tailored Resume:\n\n[object Object]\n\n*Resume has been customized to match the job requirements while maintaining authenticity.*"
```

---

## Test 23: tailor_resume - Tailor Resume (Data Analyst)

**Status**: 200 | **Elapsed**: 11527ms | **Result**: ✅ PASS

### Input

```json
{
  "user_profile": {
    "skills": [
      "Python",
      "SQL",
      "Pandas",
      "Tableau"
    ],
    "jobTitles": [
      "Data Analyst"
    ],
    "employmentHistory": [
      {
        "company": "Data Corp",
        "position": "Data Analyst",
        "startDate": "2021-01",
        "endDate": "2024-01",
        "summary": "Analyzed data using Python and SQL"
      }
    ]
  },
  "resume_content": "Data Analyst with experience in Python and SQL.",
  "job_description": "Looking for a Data Analyst with Python, SQL, and visualization skills.",
  "job_title": "Data Analyst"
}
```

### Output

```json
"# 📝 Resume Tailored Successfully\n\n**Target Position:** Data Analyst at Company\n\n**Customization Level:** moderate\n\n## Key Changes Made:\n• Added a professional summary emphasizing expertise in Python, SQL, and data visualization.\n• Highlighted Python and SQL in the skills section to align with the job description.\n• Enhanced the employment history section to include specific responsibilities and tools used that match the job requirements.\n• Included quantifiable achievements in data analysis and visualization to demonstrate proven impact.\n• Reordered skills to prioritize those mentioned in the job description.\n\n## Summary:\nThe resume has been comprehensively customized for a Data Analyst role requiring Python and SQL expertise, with moderate restructuring to emphasize relevant skills and experiences. Key adjustments include refining the professional summary, tailoring the skills section, and elaborating on relevant job responsibilities and achievements.\n\n## Additional Recommendations:\n• Consider adding specific projects or case studies that showcase the application of Python and SQL in solving business problems.\n• Include any relevant certifications in Python, SQL, or data analysis to further strengthen the application.\n• Maintain an active LinkedIn profile linked in the resume, ensuring it reflects the same skills and experiences.\n\n## Tailored Resume:\n\n[object Object]\n\n*Resume has been customized to match the job requirements while maintaining authenticity.*"
```

---

## Test 24: tailor_resume - Optimize Resume (Product Manager)

**Status**: 200 | **Elapsed**: 75ms | **Result**: ✅ PASS

### Input

```json
{
  "user_profile": {
    "skills": [
      "Product Strategy",
      "Agile",
      "User Research"
    ],
    "jobTitles": [
      "Product Manager"
    ],
    "employmentHistory": [
      {
        "company": "Product Corp",
        "position": "Product Manager",
        "startDate": "2022-01",
        "endDate": "2024-12",
        "summary": "Managed product roadmap and worked with engineering teams"
      }
    ]
  },
  "resume_content": "Product Manager with experience in product strategy and agile methodologies."
}
```

### Output

```json
"# 📝 Resume Optimized Successfully\n\nYour resume has been enhanced with:\n\n## What was improved:\n• Professional summary generated with AI\n• Each employment experience rewritten for better impact\n• Measurable outcomes emphasized\n• Strong action verbs used\n\n## Optimized Resume:\n\n**User**\n\n## Professional Summary\nProduct Manager with experience in product strategy and agile methodologies.\n\n## Employment History\n### Product Manager\n*Product Corp*\n2022-01 - 2024-12\n\n## Skills\nProduct Strategy • Agile • User Research\n\n\n\n*All content has been enhanced while preserving accuracy and authenticity.*"
```

---

## Test 25: tailor_resume - Tailor Resume (UX Designer)

**Status**: 200 | **Elapsed**: 11299ms | **Result**: ✅ PASS

### Input

```json
{
  "user_profile": {
    "skills": [
      "Figma",
      "User Research",
      "Prototyping"
    ],
    "jobTitles": [
      "UX Designer"
    ],
    "employmentHistory": [
      {
        "company": "Design Corp",
        "position": "UX Designer",
        "startDate": "2021-06",
        "endDate": "2024-06",
        "summary": "Designed user interfaces and conducted user research"
      }
    ]
  },
  "resume_content": "UX Designer with experience in Figma and user research.",
  "job_description": "Seeking a UX Designer with Figma, prototyping, and user research experience.",
  "job_title": "UX Designer"
}
```

### Output

```json
"# 📝 Resume Tailored Successfully\n\n**Target Position:** UX Designer at Company\n\n**Customization Level:** moderate\n\n## Key Changes Made:\n• Reordered the resume sections to prioritize relevant experience and skills at the top.\n• Emphasized proficiency in Figma and user research in the professional summary and skills section.\n• Highlighted specific responsibilities and achievements related to Figma and user research in the employment history.\n• Added quantifiable results to demonstrate effectiveness in previous roles.\n\n## Summary:\nThe resume was comprehensively tailored to highlight the candidate's proficiency in Figma and user research, key requirements for the UX Designer position. Sections were reordered to emphasize relevant skills and experiences immediately, making the resume more appealing and relevant to the job description.\n\n## Additional Recommendations:\n• Consider adding specific examples of projects or user interfaces designed using Figma to further showcase applicable skills.\n• Include testimonials or endorsements from previous colleagues or supervisors to enhance credibility.\n• Regularly update the resume to include new skills, tools, or methodologies relevant to UX design to remain competitive in the field.\n\n## Tailored Resume:\n\n[object Object]\n\n*Resume has been customized to match the job requirements while maintaining authenticity.*"
```

---
