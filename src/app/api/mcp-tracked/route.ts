// ============================================
// Hera AI - MCP Tracked Endpoint (Wrapper Pattern)
// ============================================
// 功能：在原有 /api/mcp 基础上添加 Feedback 追踪
// 设计：零入侵，完全隔离，可随时关闭
// 原则：对 /api/mcp 不做任何修改
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { FeedbackCollector } from '../../../lib/feedback/FeedbackCollector';

const fc = FeedbackCollector.getInstance();

// 功能开关：可随时禁用Feedback
const ENABLE_FEEDBACK = process.env.ENABLE_FEEDBACK !== 'false';

/**
 * GET - 转发到原有 /api/mcp
 */
export async function GET(request: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
    
    const response = await fetch(`${baseUrl}/api/mcp`, {
      method: 'GET',
      headers: request.headers as any
    });
    
    const data = await response.json();
    
    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'X-Feedback-Enabled': String(ENABLE_FEEDBACK),
        'X-Wrapper-Version': '1.0.0'
      }
    });
  } catch (error: any) {
    console.error('[MCP-Tracked] GET error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Wrapper with Feedback
 */
export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  
  try {
    const body = await request.json();
    const { method, params, id } = body;
    
    let event_id: string | null = null;
    let session_id: string = 'unknown';
    
    // 🔵 Step 1: 记录开始（完全非阻塞，<1ms）
    if (ENABLE_FEEDBACK && method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};
      
      // 确定 session_id（优先级：user_email > id > anonymous）
      session_id = args.user_email 
        || id 
        || `anon_${crypto.randomUUID().slice(0, 8)}`;
      
      if (toolName) {
        const trace_id = crypto.randomUUID();
        
        // 不await！立即返回event_id
        event_id = await fc.recordStart(
          toolName,
          args,
          {
            trace_id,
            session_id,
            user_email: args.user_email
          }
        );
        
        console.log(`[MCP-Tracked] Tool: ${toolName}, Event: ${event_id}, Session: ${session_id}`);
      }
    }
    
    // 🔵 Step 2: 转发到原有 /api/mcp（100%不改动！）
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
    const mcpResponse = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || ''
      },
      body: JSON.stringify(body)
    });
    
    const result = await mcpResponse.json();
    
    // 🔵 Step 3: 可逆注入追踪链接（仅jobs数组，不改其他）
    if (ENABLE_FEEDBACK && event_id) {
      injectTrackingLinks(result, event_id, session_id);
    }
    
    // 🔵 Step 4: 记录结束（完全非阻塞，不await）
    if (ENABLE_FEEDBACK && event_id) {
      const processingTime = Date.now() - requestStartTime;
      fc.recordEnd(event_id, result, processingTime);  // 不await！
    }
    
    // 返回结果（与原/api/mcp完全相同，只是多了headers）
    return NextResponse.json(result, {
      status: mcpResponse.status,
      headers: {
        'X-Feedback-Enabled': String(ENABLE_FEEDBACK),
        'X-Event-Id': event_id || 'disabled',
        'X-Session-Id': session_id
      }
    });
    
  } catch (error: any) {
    console.error('[MCP-Tracked] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * 可逆注入追踪参数（只修改URL，不改其他字段）
 * 策略：保守注入，任何异常都忽略
 */
function injectTrackingLinks(
  result: any,
  event_id: string,
  session_id: string
): void {
  try {
    // 只处理标准MCP响应格式
    if (!result?.result?.content) return;
    
    const content = result.result.content;
    if (!Array.isArray(content)) return;
    
    for (const item of content) {
      // 只处理json类型
      if (item.type !== 'json') continue;
      
      const data = item.data?.content;
      if (!data) continue;
      
      // 处理jobs数组
      if (Array.isArray(data.jobs)) {
        data.jobs = data.jobs.map((job: any) => ({
          ...job,
          url: addTrackingParams(job.url, event_id, session_id)
        }));
      }
      
      // 处理recommendations数组（recommend_jobs返回格式）
      if (Array.isArray(data.recommendations)) {
        data.recommendations = data.recommendations.map((job: any) => ({
          ...job,
          url: addTrackingParams(job.url, event_id, session_id)
        }));
      }
    }
    
    console.log(`[Tracking] ✅ Links injected for event ${event_id}`);
    
  } catch (err: any) {
    console.warn('[Tracking] Injection failed (ignored):', err.message);
    // 注入失败不影响返回，保证安全
  }
}

/**
 * 添加追踪参数到URL
 */
function addTrackingParams(
  url: string,
  event_id: string,
  session_id: string
): string {
  if (!url || !event_id) return url;
  
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set('ref', 'chatgpt');
    urlObj.searchParams.set('event', event_id);
    urlObj.searchParams.set('session', session_id);
    return urlObj.toString();
  } catch {
    // URL解析失败，返回原值（安全降级）
    return url;
  }
}

