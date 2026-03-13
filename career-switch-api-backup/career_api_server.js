#!/usr/bin/env node

/**
 * Career Switch API Server (JavaScript version - no TypeScript issues)
 * Port: 3009
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
require('dotenv').config({ path: '.env.local' });

// Initialize OpenAI for report generation
const CAREER_OPENAI_KEY = process.env.OPENAI_API_KEY_CAREERSWITCH;
const openai = CAREER_OPENAI_KEY ? new OpenAI({ apiKey: CAREER_OPENAI_KEY }) : null;
console.log('[Init] Career OpenAI Key:', CAREER_OPENAI_KEY ? '✅ Loaded' : '❌ Missing');

const app = express();
const PORT = process.env.CAREER_SWITCH_PORT || 3009;

app.use(express.json());

// ============================================
// Graph Data Loader
// ============================================

let GRAPH_CACHE = null;

function parseCSV(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Simple CSV parsing (handles commas in fields)
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      data.push(obj);
    }
    
    return data;
  } catch (error) {
    console.error(`Error parsing CSV ${filePath}:`, error.message);
    return [];
  }
}

function loadGraphData() {
  if (GRAPH_CACHE) {
    return GRAPH_CACHE;
  }
  
  console.log('[GraphLoader] Loading career graph data...');
  const startTime = Date.now();
  
  const dataDir = path.join(__dirname, 'graph_data');
  const nodesPath = path.join(dataDir, 'nodes.csv');
  const edgesPath = path.join(dataDir, 'edges.csv');
  const statsPath = path.join(dataDir, 'stats.json');
  
  if (!fs.existsSync(nodesPath) || !fs.existsSync(edgesPath)) {
    throw new Error(`Graph data files not found in ${dataDir}`);
  }
  
  const nodes = parseCSV(nodesPath);
  const edges = parseCSV(edgesPath);
  
  // Parse numbers
  edges.forEach(edge => {
    edge.similarity = parseFloat(edge.similarity);
    edge.sharedCount = parseInt(edge.sharedCount) || 0;
  });
  
  // Load stats
  let stats = {};
  if (fs.existsSync(statsPath)) {
    try {
      const statsContent = fs.readFileSync(statsPath, 'utf-8').trim();
      if (statsContent) {
        stats = JSON.parse(statsContent);
      }
    } catch (e) {
      console.error('[GraphLoader] Error parsing stats.json:', e.message);
      stats = {};
    }
  }
  
  // Build indexes
  const titleIndex = new Map();
  const edgeIndex = new Map();
  
  nodes.forEach(node => {
    const canonical = node.canonicalTitle.toLowerCase();
    if (!titleIndex.has(canonical)) {
      titleIndex.set(canonical, []);
    }
    titleIndex.get(canonical).push(node);
  });
  
  edges.forEach(edge => {
    const fromTitle = edge.fromTitle.toLowerCase();
    if (!edgeIndex.has(fromTitle)) {
      edgeIndex.set(fromTitle, []);
    }
    edgeIndex.get(fromTitle).push(edge);
  });
  
  GRAPH_CACHE = { nodes, edges, stats, titleIndex, edgeIndex };
  
  const loadTime = Date.now() - startTime;
  console.log(`[GraphLoader] ✅ Loaded in ${loadTime}ms: ${nodes.length} nodes, ${edges.length} edges`);
  
  return GRAPH_CACHE;
}

function findNodesByTitle(jobTitle) {
  const graph = loadGraphData();
  const searchTerm = jobTitle.toLowerCase().trim();
  
  const matches = [];
  graph.nodes.forEach(node => {
    const canonical = (node.canonicalTitle || '').toLowerCase();
    const title = (node.title || '').toLowerCase();
    
    if (canonical.includes(searchTerm) || title.includes(searchTerm)) {
      matches.push(node);
    }
  });
  
  return matches;
}

function getTransitionsFrom(jobTitle, limit = 20) {
  const graph = loadGraphData();
  const searchTerm = jobTitle.toLowerCase().trim();
  
  const matches = [];
  graph.edges.forEach(edge => {
    const fromTitle = (edge.fromTitle || '').toLowerCase();
    
    if (fromTitle.includes(searchTerm)) {
      matches.push(edge);
    }
  });
  
  return matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

// ============================================
// API Endpoints
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Héra Career Switch API',
    version: '1.0.0',
    port: PORT,
    openaiEnabled: !!openai,
    timestamp: new Date().toISOString()
  });
});

// Stats
app.get('/api/career/stats', (req, res) => {
  try {
    const graph = loadGraphData();
    res.json({
      success: true,
      stats: graph.stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Career Advice (Main endpoint with mode support)
app.post('/api/career/advice', async (req, res) => {
  try {
    const { currentJob, experience, skills, industry, location, mode = 'raw' } = req.body;
    
    if (!currentJob) {
      return res.status(400).json({
        success: false,
        error: 'currentJob is required'
      });
    }
    
    const currentNodes = findNodesByTitle(currentJob);
    if (currentNodes.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Job title "${currentJob}" not found in career graph`,
        suggestion: 'Try a more common job title or variation'
      });
    }
    
    const node = currentNodes[0];
    const transitions = getTransitionsFrom(currentJob, 50);
    
    // Group by similarity
    const highSimilarity = transitions.filter(t => t.similarity >= 0.7);
    const mediumSimilarity = transitions.filter(t => t.similarity >= 0.5 && t.similarity < 0.7);
    const lowSimilarity = transitions.filter(t => t.similarity < 0.5);
    
    // Build detailed recommendations
    const recommendations = transitions.slice(0, 10).map((edge, index) => {
      const sharedSkills = edge.sharedTags ? edge.sharedTags.split('|').filter(s => s.trim()) : [];
      const gapSkills = edge.gapTags ? edge.gapTags.split('|').filter(s => s.trim()) : [];
      
      return {
        rank: index + 1,
        targetJob: edge.toTitle || 'Unknown',
        similarity: Math.round(edge.similarity * 100),
        difficulty: edge.similarity >= 0.7 ? 'Easy' : edge.similarity >= 0.5 ? 'Moderate' : 'Challenging',
        transitionTime: edge.similarity >= 0.7 ? '3-6 months' : edge.similarity >= 0.5 ? '6-12 months' : '12-24 months',
        sharedSkills: sharedSkills.slice(0, 6),
        skillsToLearn: gapSkills.slice(0, 6),
        sharedCount: sharedSkills.length,
        recommendation: generateRecommendation(edge.similarity)
      };
    });
    
    // Experience insights
    const experienceInsight = getExperienceInsight(experience);
    
    // Build notes
    const notes = [];
    if (transitions.length === 0) {
      notes.push('No direct transitions found. Try alternative job titles or check job title spelling.');
    } else if (transitions.length < 10) {
      notes.push('Limited transitions found. This may be a specialized role.');
    }
    
    // MODE: raw - Only real data
    if (mode === 'raw') {
      return res.json({
        success: true,
        from: node.title,
        query: {
          currentJob,
          experience,
          location: location || 'Australia',
          mode: 'raw'
        },
        candidates: recommendations.map(r => ({
          to: r.targetJob,
          similarity: r.similarity / 100,
          sharedTags: r.sharedSkills,
          skillsToLearn: r.skillsToLearn,
          functionality: node.functionality,
          industry: node.industry,
          data_source: 'graph_csv'
        })),
        notes,
        metadata: {
          totalTransitions: transitions.length,
          graphVersion: '1.0',
          dataSource: 'LinkedIn + SEEK (51,283 positions)'
        }
      });
    }
    
    // MODE: report - Real data + GPT-generated professional report
    const graph = loadGraphData();
    
    // Prepare clean data for GPT (only facts, no fluff)
    const factData = {
      fromTitle: node.title,
      functionality: node.functionality,
      industry: node.industry,
      experience,
      totalTransitions: transitions.length,
      highCompatibilityCount: highSimilarity.length,
      mediumCompatibilityCount: mediumSimilarity.length,
      topCandidates: recommendations.slice(0, 15).map(r => ({
        to: r.targetJob,
        similarity: r.similarity / 100,
        sharedSkills: r.sharedSkills,
        skillsToLearn: r.skillsToLearn
      })),
      dataSource: 'Héra Career Graph (51,283 positions from LinkedIn + SEEK)'
    };
    
    // Generate GPT report or fallback to template
    let gptReport = null;
    if (openai) {
      console.log('[Career API] OpenAI available, generating GPT report...');
      gptReport = await generateGPTReport(factData);
      console.log('[Career API] GPT report result:', gptReport ? '✅ Success' : '❌ Failed, using template');
    } else {
      console.log('[Career API] No OpenAI key, using template report');
    }
    
    const report = gptReport || generateTemplateReport(node.title, recommendations, notes, experience, graph.nodes);
    const careerPathways = buildCareerPathways(recommendations, experience);
    
    // Prepare candidates
    let candidatesList = recommendations.map(r => ({
      to: r.targetJob,
      similarity: r.similarity / 100,
      sharedTags: r.sharedSkills,
      skillsToLearn: r.skillsToLearn,
      difficulty: r.difficulty,
      transitionTime: r.transitionTime
    }));
    
    // 1. Deduplicate candidates (keep highest similarity)
    const candidatesMap = new Map();
    candidatesList.forEach(c => {
      const key = (c.to || '').toLowerCase().trim();
      if (!key) return;
      const existing = candidatesMap.get(key);
      if (!existing || c.similarity > existing.similarity) {
        candidatesMap.set(key, c);
      }
    });
    candidatesList = Array.from(candidatesMap.values());
    
    // 2. Clean careerPathways - deduplicate recommendations and fix action items
    const fixPathway = (node) => {
      if (!node) return;
      
      // Deduplicate recommendations
      if (Array.isArray(node.recommendations)) {
        const seen = new Set();
        node.recommendations = node.recommendations.filter(t => {
          const key = (t || '').toLowerCase().trim();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      
      // Fix action items
      if (node.actionItems) {
        node.actionItems = node.actionItems.map(s =>
          s
            .replace(/architecture\/design decisions/gi, 'product discovery & prioritization decisions')
            .replace(/senior technical tasks/gi, 'own product backlog and delivery milestones')
            .replace(/mentor junior engineers/gi, 'facilitate cross-functional reviews and team coordination')
            .replace(/junior team members/gi, 'junior product team members')
        );
      }
    };
    if (careerPathways) {
      fixPathway(careerPathways.shortTerm);
      fixPathway(careerPathways.midTerm);
      fixPathway(careerPathways.longTerm);
    }
    
    // 3. Normalize accents (ensure "Héra" displays correctly, not escaped)
    const normalizeAccent = (v) => {
      if (typeof v === 'string') {
        return v.replace(/H\\u00e9ra/g, 'Héra').replace(/Hera/g, 'Héra');
      }
      return v;
    };
    
    // Prepare final report object
    let finalReport = gptReport || {
      summary: report.summary,
      marketOverview: report.marketOverview,
      insights: report.insights,
      skillsAnalysis: report.skillsAnalysis,
      actionPlan: report.actionPlan,
      timeline: report.timeline
    };
    
    // Normalize accents in report
    if (finalReport.signature) {
      finalReport.signature = normalizeAccent(finalReport.signature);
    }
    if (finalReport.marketInsights?.dataSource) {
      finalReport.marketInsights.dataSource = normalizeAccent(finalReport.marketInsights.dataSource);
    }
    
    // Prepare metadata
    let reportGeneratedBy = 'Héra AI';
    reportGeneratedBy = normalizeAccent(reportGeneratedBy);
    
    res.json({
      success: true,
      from: node.title,
      query: {
        currentJob,
        experience,
        location: location || 'Australia',
        mode: 'report'
      },
      candidates: candidatesList,
      notes,
      report: finalReport,
      careerPathways,
      metadata: {
        totalTransitions: transitions.length,
        highSimilarity: highSimilarity.length,
        mediumSimilarity: mediumSimilarity.length,
        graphVersion: '1.0',
        dataSource: 'LinkedIn + SEEK (51,283 positions)',
        reportGeneratedBy
      }
    });
    
  } catch (error) {
    console.error('[Career API] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Transitions
app.get('/api/career/transitions/:fromJob', (req, res) => {
  try {
    const { fromJob } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const minSimilarity = parseFloat(req.query.minSimilarity) || 0.5;
    
    const transitions = getTransitionsFrom(fromJob, 100)
      .filter(t => t.similarity >= minSimilarity)
      .slice(0, limit);
    
    res.json({
      success: true,
      fromJob,
      total: transitions.length,
      transitions: transitions.map(edge => ({
        toJob: edge.toTitle,
        similarity: Math.round(edge.similarity * 100),
        sharedSkills: edge.sharedTags ? edge.sharedTags.split('|').slice(0, 5) : [],
        sharedCount: edge.sharedCount,
        fromFunctionality: edge.fromFunctionality,
        toFunctionality: edge.toFunctionality
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Skill gap
app.get('/api/career/skill-gap/:fromJob/:toJob', (req, res) => {
  try {
    const { fromJob, toJob } = req.params;
    const graph = loadGraphData();
    
    const fromSearch = fromJob.toLowerCase();
    const toSearch = toJob.toLowerCase();
    
    const edge = graph.edges.find(e =>
      e.fromTitle.toLowerCase().includes(fromSearch) &&
      e.toTitle.toLowerCase().includes(toSearch)
    );
    
    if (!edge) {
      return res.status(404).json({
        success: false,
        error: 'No direct transition found'
      });
    }
    
    const sharedSkills = edge.sharedTags ? edge.sharedTags.split('|').filter(s => s.trim()) : [];
    
    res.json({
      success: true,
      fromJob: edge.fromTitle,
      toJob: edge.toTitle,
      similarity: Math.round(edge.similarity * 100),
      sharedSkills,
      sharedCount: edge.sharedCount,
      analysis: {
        difficulty: edge.similarity >= 0.7 ? 'Easy' : edge.similarity >= 0.5 ? 'Moderate' : 'Challenging',
        estimatedTime: edge.similarity >= 0.7 ? '3-6 months' : edge.similarity >= 0.5 ? '6-12 months' : '12-24 months',
        recommendation: generateRecommendation(edge.similarity)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search
app.get('/api/career/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'Query parameter q is required' });
    }
    
    const nodes = findNodesByTitle(q);
    res.json({
      success: true,
      query: q,
      total: nodes.length,
      results: nodes.slice(0, 20).map(n => ({
        title: n.title,
        canonicalTitle: n.canonicalTitle,
        functionality: n.functionality,
        industry: n.industry
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Root
app.get('/', (req, res) => {
  res.json({
    service: 'Héra Career Switch API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      stats: '/api/career/stats',
      advice: 'POST /api/career/advice',
      transitions: 'GET /api/career/transitions/:fromJob',
      skillGap: 'GET /api/career/skill-gap/:fromJob/:toJob',
      search: 'GET /api/career/search?q=title'
    }
  });
});

// ============================================
// Helper Functions
// ============================================

async function generateGPTReport(factData) {
  if (!openai) {
    console.log('[GPT Report] No OpenAI key, skipping GPT generation');
    return null;
  }
  
  const systemPrompt = `You are a professional career intelligence analyst.

Your job is to generate a structured, realistic Career Transition Report in English,
using only the verified data provided in JSON format.

Rules:
- All factual content (roles, skills, salaries, transitions, industries) must come from the JSON.
- Never invent or assume data that is not explicitly present.
- If a user profile or background is provided, use it to personalize the report.
- If no profile is provided, write a brief inferred professional profile summary using "fromTitle" and candidate data.
- The report should be written in a consulting tone: concise, factual, and practical.
- Include realistic salary ranges in AUD when possible (based on market averages or dataset references).
- End every report with the following exact signature (note the accented letter é in Héra):
  "Report generated by Héra AI"
- Output valid JSON strictly following the schema below.

Schema:
{
  "title": "string",
  "profileSummary": "string",
  "summary": "string",
  "rationale": ["string"],
  "careerRoadmap": {
    "shortTerm": { "years": "string", "focus": "string", "targetRoles": ["string"], "expectedSalaryRange": "string", "keyActions": ["string"] },
    "midTerm": { "years": "string", "focus": "string", "targetRoles": ["string"], "expectedSalaryRange": "string", "keyActions": ["string"] },
    "longTerm": { "years": "string", "focus": "string", "targetRoles": ["string"], "expectedSalaryRange": "string", "keyActions": ["string"] }
  },
  "skillAnalysis": {
    "transferable": ["string"],
    "toDevelop": ["string"]
  },
  "salaryInsights": {
    "currentRange": "string",
    "targetRange": "string",
    "salaryGrowthComment": "string"
  },
  "marketInsights": {
    "industryDemand": "string",
    "dataSource": "string"
  },
  "recommendations": ["string"],
  "notes": ["string"],
  "signature": "string"
}`;

  const userPrompt = `Below is the verified real data for this person's career transition.
Use only these facts — do not fabricate or assume anything new.

<REAL_DATA_START>
${JSON.stringify(factData, null, 2)}
<REAL_DATA_END>

If a "profile" or "background" is provided, use it directly for personalization.
If no profile is provided, infer a short professional summary from the "fromTitle" and top candidates.

Generate a complete English "Career Transition Report" following the JSON schema above.

Ensure that:
- All salary ranges are realistic and expressed in AUD when relevant.
- Every report ends with EXACTLY this signature:
  "Report generated by Héra AI"
  (be sure "Héra" uses the accented letter "é").`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.25,
      max_tokens: 2500
    });
    
    const reportText = completion.choices[0].message.content;
    const gptReport = JSON.parse(reportText);
    console.log('[GPT Report] ✅ Generated successfully');
    return gptReport;
    
  } catch (error) {
    console.error('[GPT Report] Error:', error.message);
    return null;
  }
}

function generateRecommendation(similarity) {
  if (similarity >= 0.7) {
    return 'Highly compatible - strong skill overlap with minimal retraining needed';
  } else if (similarity >= 0.5) {
    return 'Good fit - some skill development needed, focus on complementary skills';
  } else {
    return 'Significant gap - consider intermediate roles or intensive upskilling program';
  }
}

function generateTemplateReport(fromJob, recommendations, notes, experience, allNodes) {
  // No candidates - fallback
  if (!recommendations || recommendations.length === 0) {
    return {
      summary: `${fromJob} currently has no clear career transition paths in our database. Consider trying alternative job titles or expanding your search criteria.`,
      marketOverview: { totalPositions: 0, industries: [], locations: [] },
      insights: notes,
      actionPlan: [
        'Verify your job title spelling and try common variations',
        'Consider broader job categories or related roles',
        'Expand your location or industry preferences'
      ],
      skillsAnalysis: { transferable: [], toDevelop: [] },
      timeline: {}
    };
  }
  
  const top = recommendations[0];
  const sharedSkillsText = top.sharedSkills.slice(0, 3).join(', ') || 'No data';
  const expText = experience ? ` (based on ${experience} years of experience)` : '';
  
  // MARKET OVERVIEW - Analyze all nodes with similar title
  const relatedJobs = allNodes.filter(n => {
    const title = (n.title || '').toLowerCase();
    const canonical = (n.canonicalTitle || '').toLowerCase();
    const searchTerm = fromJob.toLowerCase();
    return title.includes(searchTerm) || canonical.includes(searchTerm);
  });
  
  const industryDist = {};
  const locationDist = {};
  const functionDist = {};
  
  relatedJobs.forEach(job => {
    if (job.industry) industryDist[job.industry] = (industryDist[job.industry] || 0) + 1;
    if (job.location) locationDist[job.location] = (locationDist[job.location] || 0) + 1;
    if (job.functionality) functionDist[job.functionality] = (functionDist[job.functionality] || 0) + 1;
  });
  
  const topIndustries = Object.entries(industryDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([industry, count]) => ({ industry, count }));
  
  const topLocations = Object.entries(locationDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([location, count]) => ({ location, count }));
  
  const topFunctions = Object.entries(functionDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([func, count]) => ({ function: func, count }));
  
  // SUMMARY
  const summary = `Starting from ${fromJob}${expText}, we identified ${recommendations.length} potential career transitions based on ${relatedJobs.length} positions in our database. The most compatible target role is ${top.targetJob} with ${top.similarity}% similarity. Shared skills include: ${sharedSkillsText}. ${top.skillsToLearn.length > 0 ? `Skills to develop: ${top.skillsToLearn.slice(0, 3).join(', ')}.` : 'No significant skill gaps identified.'}`;
  
  // INSIGHTS
  const insights = [];
  insights.push(`Total career transitions available: ${recommendations.length}`);
  
  const highSim = recommendations.filter(r => r.similarity >= 70).length;
  const medSim = recommendations.filter(r => r.similarity >= 50 && r.similarity < 70).length;
  
  if (highSim > 0) {
    insights.push(`${highSim} high-compatibility roles (70%+ match) - Easy transitions with minimal retraining`);
  }
  if (medSim > 0) {
    insights.push(`${medSim} moderate-compatibility roles (50-70% match) - Requires focused skill development`);
  }
  
  if (experience < 2) {
    insights.push('With 0-2 years experience: Focus on entry-level positions with 70%+ similarity to build track record');
  } else if (experience >= 2 && experience < 5) {
    insights.push('With 2-5 years experience: You can explore moderate-similarity roles (50-70%) by emphasizing transferable skills');
  } else if (experience >= 5) {
    insights.push('With 5+ years experience: Your senior background enables diverse career pivots, even to 40-60% similarity roles');
  }
  
  // SKILLS ANALYSIS
  const allSharedSkills = {};
  const allGapSkills = {};
  
  recommendations.slice(0, 20).forEach(r => {
    r.sharedSkills.forEach(s => allSharedSkills[s] = (allSharedSkills[s] || 0) + 1);
    r.skillsToLearn.forEach(s => allGapSkills[s] = (allGapSkills[s] || 0) + 1);
  });
  
  const transferableSkills = Object.entries(allSharedSkills)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([skill, count]) => ({ skill, frequency: count }));
  
  const skillsToDevelop = Object.entries(allGapSkills)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([skill, count]) => ({ skill, importance: count }));
  
  // ACTION PLAN
  const actionPlan = {
    immediate: [],
    shortTerm: [],
    mediumTerm: []
  };
  
  // Immediate (Week 1-4)
  actionPlan.immediate.push('Update resume to highlight transferable skills: ' + transferableSkills.slice(0, 5).map(s => s.skill).join(', '));
  actionPlan.immediate.push('Research top 3-5 target companies in your preferred industry');
  actionPlan.immediate.push('Set up job alerts for: ' + recommendations.slice(0, 3).map(r => r.targetJob).join(', '));
  
  // Short-term (Month 1-3)
  if (highSim > 0) {
    actionPlan.shortTerm.push('Apply to high-compatibility roles (70%+ match): ' + recommendations.filter(r => r.similarity >= 70).slice(0, 3).map(r => r.targetJob).join(', '));
  }
  actionPlan.shortTerm.push('Network with professionals in target roles via LinkedIn and industry events');
  if (skillsToDevelop.length > 0) {
    actionPlan.shortTerm.push('Begin skill development for top gaps: ' + skillsToDevelop.slice(0, 3).map(s => s.skill).join(', '));
  }
  actionPlan.shortTerm.push('Tailor cover letters emphasizing career transition motivation and transferable skills');
  
  // Medium-term (Month 3-6)
  if (skillsToDevelop.length > 0) {
    actionPlan.mediumTerm.push('Complete courses/certifications for: ' + skillsToDevelop.slice(0, 3).map(s => s.skill).join(', '));
  }
  actionPlan.mediumTerm.push('Seek informational interviews with professionals in target roles');
  actionPlan.mediumTerm.push('Consider volunteer work or side projects to build relevant experience');
  if (medSim > 0) {
    actionPlan.mediumTerm.push('Expand to moderate-similarity roles if initial applications don\'t succeed');
  }
  
  return {
    summary,
    marketOverview: {
      totalPositions: relatedJobs.length,
      industries: topIndustries,
      locations: topLocations,
      functions: topFunctions
    },
    insights,
    skillsAnalysis: {
      transferable: transferableSkills,
      toDevelop: skillsToDevelop
    },
    actionPlan,
    timeline: {
      immediate: 'Week 1-4: Resume update and research',
      shortTerm: 'Month 1-3: Active applications and networking',
      mediumTerm: 'Month 3-6: Skill development and expanded search'
    }
  };
}

function estimateMarketDemand(functionality) {
  if (!functionality) return 'Unknown';
  const highDemand = ['Software Development', 'Data Analysis', 'Product Management', 'DevOps'];
  const mediumDemand = ['Business Analysis', 'Project Management', 'QA'];
  
  if (highDemand.some(d => functionality.includes(d))) return 'Very High';
  if (mediumDemand.some(d => functionality.includes(d))) return 'High';
  return 'Moderate';
}

function getExperienceInsight(years) {
  if (!years || years < 2) {
    return 'With limited experience, focus on roles with 70%+ similarity to build on your existing skills. Consider lateral moves within your current function.';
  } else if (years < 5) {
    return 'Your mid-level experience gives you flexibility to explore roles with 50-70% similarity. Focus on positions that leverage your technical foundation while building new competencies.';
  } else {
    return 'Your senior experience allows you to leverage transferable skills for more diverse transitions. You can confidently explore roles with 40-60% similarity by highlighting your proven track record.';
  }
}

function buildCareerPathways(recommendations, experience) {
  const pathways = {
    shortTerm: {
      timeframe: '0-6 months',
      focus: 'Deepen current expertise or make easy lateral moves',
      recommendations: recommendations.filter(r => r.similarity >= 70).slice(0, 3).map(r => r.targetJob),
      actionItems: [
        'Take on senior technical tasks in current role',
        'Mentor junior team members',
        'Lead a small project or feature',
        'Contribute to architecture/design decisions'
      ]
    },
    midTerm: {
      timeframe: '6-18 months',
      focus: 'Expand into leadership or specialized technical roles',
      recommendations: recommendations.filter(r => r.similarity >= 50 && r.similarity < 70).slice(0, 3).map(r => r.targetJob),
      actionItems: [
        'Take leadership or management training',
        'Build cross-functional communication skills',
        'Gain experience in system/product design',
        'Understand business context of technical decisions'
      ]
    },
    longTerm: {
      timeframe: '18+ months',
      focus: 'Strategic career pivots or advancement to senior roles',
      recommendations: recommendations.filter(r => r.similarity < 50).slice(0, 3).map(r => r.targetJob),
      actionItems: [
        'Develop business acumen and strategic thinking',
        'Build professional network in target domain',
        'Consider formal education (MBA, certifications)',
        'Gain experience in strategic planning and decision-making'
      ]
    }
  };
  
  return pathways;
}

// ============================================
// Start Server
// ============================================

async function startServer() {
  try {
    // Pre-load graph data
    loadGraphData();
    
    app.listen(PORT, () => {
      console.log('='.repeat(60));
      console.log('🚀 Career Switch API Server is running');
      console.log(`📍 Port: ${PORT}`);
      console.log(`🌐 Local: http://localhost:${PORT}`);
      console.log(`💚 Health: http://localhost:${PORT}/health`);
      console.log('='.repeat(60));
    });
    
  } catch (error) {
    console.error('[Career Server] Failed to start:', error.message);
    process.exit(1);
  }
}

startServer();

