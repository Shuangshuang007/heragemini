// ============================================
// FeedbackCollector - Non-blocking Tool Tracking
// ============================================
// 完全非阻塞设计：
// - recordStart() 不等待写入完成
// - recordEnd() 不等待写入完成
// - 错误不影响主流程

import { getDb } from '../db/mongoClient';
import { WithId, ObjectId } from 'mongodb';
import crypto from 'crypto';

export interface FeedbackEvent {
  _id?: ObjectId;
  event_id: string;
  session_id: string;
  user_email?: string | null;
  email_hash?: string | null;
  email_domain?: string | null;
  tool: string;
  timestamp: Date;
  input: any;
  output: any;
  feedback: {
    clicked_jobs?: string[];
    saved_jobs?: string[];
    applied_jobs?: string[];
    downloaded_resume?: boolean;
    clicked_at?: Date;
    saved_at?: Date;
    applied_at?: Date;
    downloaded_at?: Date;
  };
  trace_id: string;
  processed: boolean;
  created_at: Date;
  updated_at: Date;
}

export class FeedbackCollector {
  private static instance: FeedbackCollector;
  
  static getInstance(): FeedbackCollector {
    if (!this.instance) {
      this.instance = new FeedbackCollector();
    }
    return this.instance;
  }
  
  /**
   * 记录工具调用开始 - 完全非阻塞
   * @returns event_id 立即返回，写入在后台进行
   */
  async recordStart(
    toolName: string,
    input: any,
    metadata: {
      trace_id: string;
      session_id: string;
      user_email?: string;
    }
  ): Promise<string> {
    const event_id = crypto.randomUUID();
    
    // 完全非阻塞（不等待结果）
    setImmediate(() => {
      this.asyncWrite(async () => {
        const db = await getDb();
        
        // 处理PII（个人信息保护）
        const piiData = this.processPII(metadata.user_email);
        
        const event: Partial<FeedbackEvent> = {
          event_id,
          session_id: metadata.session_id,
          ...piiData,
          tool: toolName,
          timestamp: new Date(),
          input,
          output: null,
          feedback: {},
          trace_id: metadata.trace_id,
          processed: false,
          created_at: new Date(),
          updated_at: new Date()
        };
        
        await db.collection('feedback_events').insertOne(event);
        console.log(`[Feedback] ✅ Start recorded: ${toolName} (${event_id})`);
      });
    });
    
    return event_id;
  }
  
  /**
   * 更新输出结果 - 完全非阻塞
   */
  recordEnd(event_id: string, output: any, processing_time_ms: number): void {
    // 完全非阻塞（不等待，不阻塞主流程）
    setImmediate(() => {
      this.asyncWrite(async () => {
        const db = await getDb();
        await db.collection('feedback_events').updateOne(
          { event_id },
          {
            $set: {
              output: {
                result: output,
                processing_time_ms
              },
              updated_at: new Date()
            }
          }
        );
        console.log(`[Feedback] ✅ End recorded: ${event_id} (${processing_time_ms}ms)`);
      });
    });
  }
  
  /**
   * 获取会话历史反馈
   */
  async getSessionFeedback(session_id: string, limit: number = 10): Promise<FeedbackEvent[]> {
    try {
      const db = await getDb();
      const col = db.collection<FeedbackEvent>('feedback_events');
      
      const docs: WithId<FeedbackEvent>[] = await col
        .find({ session_id })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
      
      // 去掉 _id，返回干净的 FeedbackEvent[]
      const events: FeedbackEvent[] = docs.map(({ _id, ...rest }) => rest);
      return events;
      
    } catch (error) {
      console.error('[Feedback] Get session error:', error);
      return [];
    }
  }
  
  /**
   * 处理PII（个人信息）- 支持隐私保护模式
   */
  private processPII(email?: string): {
    user_email: string | null;
    email_hash: string | null;
    email_domain: string | null;
  } {
    if (!email) {
      return {
        user_email: null,
        email_hash: null,
        email_domain: null
      };
    }
    
    // 检查是否启用隐私保护模式
    const piiDisabled = process.env.FEEDBACK_PII_DISABLED === 'true';
    
    if (piiDisabled) {
      // 只存储hash和域名
      const email_hash = crypto
        .createHash('sha256')
        .update(email.toLowerCase())
        .digest('hex');
      const email_domain = email.split('@')[1] || null;
      
      return {
        user_email: null,
        email_hash,
        email_domain
      };
    }
    
    // 默认存储完整email
    return {
      user_email: email,
      email_hash: null,
      email_domain: email.split('@')[1] || null
    };
  }
  
  /**
   * 异步写入包装器 - 吞掉所有错误，不影响主流程
   */
  private async asyncWrite(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err: any) {
      console.error('[Feedback] Write error (non-blocking, ignored):', err.message);
      // 不抛出异常，确保主流程不受影响
    }
  }
}

