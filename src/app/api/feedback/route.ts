// ============================================
// Feedback API - User Behavior Tracking
// ============================================
// 接收用户行为反馈：点击、保存、下载、申请
// 更新 feedback_events 中的 feedback 字段

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db/mongoClient';

/**
 * POST - 记录用户反馈
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_id, action, payload } = body;
    
    // 验证必填字段
    if (!event_id || !action) {
      return NextResponse.json(
        { error: 'event_id and action are required' },
        { status: 400 }
      );
    }
    
    // 支持的action类型
    const validActions = ['clicked', 'saved', 'applied', 'downloaded'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { 
          error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
          valid_actions: validActions
        },
        { status: 400 }
      );
    }
    
    const db = await getDb();
    
    // 构建更新操作
    const updateOps: any = {
      $set: {
        [`feedback.${action}_at`]: new Date(),
        updated_at: new Date()
      }
    };
    
    // 如果有job_id，添加到对应数组
    if (payload?.job_id) {
      updateOps.$addToSet = {
        [`feedback.${action}_jobs`]: payload.job_id
      };
    }
    
    // 特殊处理downloaded（boolean类型）
    if (action === 'downloaded') {
      updateOps.$set[`feedback.downloaded_resume`] = true;
    }
    
    // 更新feedback字段
    const result = await db.collection('feedback_events').updateOne(
      { event_id },
      updateOps
    );
    
    if (result.matchedCount === 0) {
      console.warn(`[Feedback API] Event ${event_id} not found`);
      return NextResponse.json(
        { 
          success: false,
          error: 'Event not found',
          event_id 
        },
        { status: 404 }
      );
    }
    
    console.log(`[Feedback API] ✅ ${action} recorded for event ${event_id}`);
    
    return NextResponse.json({
      success: true,
      event_id,
      action,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Feedback API] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET - 查询会话历史
 * Query: ?session_id=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const session_id = request.nextUrl.searchParams.get('session_id');
    
    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id parameter is required' },
        { status: 400 }
      );
    }
    
    const db = await getDb();
    const events = await db.collection('feedback_events')
      .find({ session_id })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    
    // 统计数据
    const stats = {
      total_events: events.length,
      tools_used: [...new Set(events.map((e: any) => e.tool))],
      events_with_feedback: events.filter((e: any) => 
        e.feedback && Object.keys(e.feedback).length > 0
      ).length
    };
    
    return NextResponse.json({
      session_id,
      stats,
      events
    });
    
  } catch (error: any) {
    console.error('[Feedback API] Query error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

