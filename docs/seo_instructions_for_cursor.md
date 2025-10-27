# SEO + AI Optimization Instructions for Cursor

## 🎯 Goal
Make all Hera AI "Resources" pages (video-based) more visible to:
1. Search engines (Google, Bing)
2. AI crawlers (OpenAI, Perplexity, Anthropic)

## 🧱 Cursor Responsibilities
Cursor should:
- Insert a structured **SEO text block** below each video iframe.
- Include a JSON-LD `<script>` with video metadata.
- Use keywords provided below.
- Keep page layout **unchanged**.

---

## 🪶 Template (To Auto-Insert Under Each Video)

```html
<div class="seo-block">
  <p>
    Learn how to prepare for <strong>{{video_topic}}</strong> with Hera AI. 
    This guide covers <strong>{{keywords}}</strong>, practical examples, and interview techniques.
  </p>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "VideoObject",
    "name": "{{video_title}}",
    "description": "{{video_description}}",
    "thumbnailUrl": "{{thumbnail_url}}",
    "uploadDate": "{{upload_date}}",
    "contentUrl": "{{video_url}}",
    "keywords": ["{{keywords}}", "Hera AI", "Australia", "career tips"]
  }
  </script>
</div>
```

## 📘 Keywords Library (Cursor Can Randomly Rotate or Pick Contextually)

| Category | Example Keywords |
|----------|------------------|
| Interview | interview tips, behavioral interview questions, job interview answers |
| Resume | resume writing tips, resume format, graduate resume Australia |
| Graduate | graduate interview preparation, internship interview, STAR method |
| Retail | retail interview questions, Christmas casual jobs, customer service skills |
| Data Analytics | data analyst interview, SQL interview, Python for data analysis |
| General | career advice, AI job assistant, Hera AI platform, Australia job search |

## ⚙️ Rules

- Use natural English sentences (avoid keyword stuffing).
- Keep text block under 200 words.
- Each page uses relevant keywords + topic.
- Do not change layout or video alignment.

## 💡 Example (Rendered)

```html
<div class="seo-block">
  <p>
    Learn how to ace <strong>retail job interviews in Australia</strong> with Hera AI.
    This video covers <strong>customer service questions, body language, and dressing tips</strong> 
    for Christmas casual roles.
  </p>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "VideoObject",
    "name": "Retail Interview Questions & Answers",
    "description": "How to prepare for retail job interviews in Australia. Includes behavioral and customer service questions.",
    "thumbnailUrl": "https://www.heraai.net.au/images/retail-tips.jpg",
    "uploadDate": "2024-01-12",
    "contentUrl": "https://www.heraai.net.au/resources/retail-interview-tips",
    "keywords": ["retail interview", "customer service", "Australia", "Hera AI"]
  }
  </script>
</div>
```

## 🧠 Outcome

- **SEO**: Google can index structured metadata and video context.
- **AI**: ChatGPT and similar models can semantically understand Hera AI's topics.
- **User**: No UI disruption, better visibility, and consistent experience.

---

## 🚀 Implementation Status

✅ **Completed Tasks:**
- Created video data structure with SEO fields
- Generated individual video pages with dynamic routing
- Added JSON-LD structured data for each video
- Created category pages for better organization
- Updated main Resources page with links to individual videos

✅ **URL Structure:**
- Individual videos: `/resources/interview-tips/[category]/[slug]`
- Category pages: `/resources/interview-tips/[category]`
- Main page: `/resources`

✅ **SEO Features:**
- Dynamic meta titles and descriptions
- JSON-LD VideoObject schema
- Open Graph and Twitter Card meta tags
- Breadcrumb navigation
- Related videos suggestions
- Keyword optimization

## 📋 Next Steps

1. **Cloudflare Integration**: Replace placeholder video URLs with real Cloudflare Stream URLs
2. **Thumbnail Updates**: Replace placeholder thumbnails with real video thumbnails
3. **Content Review**: Review and refine video descriptions and SEO content
4. **Testing**: Test all URLs and ensure proper navigation
5. **Analytics**: Set up tracking for video page performance

## 🔧 Technical Notes

- All video data is centralized in `/src/data/interviewTipsVideos.ts`
- Dynamic routing uses Next.js 13+ app directory structure
- SEO metadata is generated server-side for better performance
- JSON-LD structured data follows schema.org standards
- Responsive design maintains mobile compatibility




