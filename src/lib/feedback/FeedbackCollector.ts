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
    // 新增字段（Phase 1）
    shown_jobs?: string[];       // 本次展示给用户的职位ID列表
    liked_jobs?: string[];       // 用户明确喜欢的职位ID列表
    disliked_jobs?: string[];    // 用户明确不喜欢的职位ID列表
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
    
    // 完全非阻塞（不等待结果，fire-and-forget）
    setImmediate(() => {
      // 使用asyncWrite包装，自动处理超时和错误
      this.asyncWrite(async () => {
        // 添加getDb超时保护
        const dbPromise = getDb();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('FEEDBACK_WRITE_TIMEOUT: getDb() exceeded 1.5s')), 1500);
        });
        
        const db = await Promise.race([dbPromise, timeoutPromise]);
        
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
  recordEnd(event_id: string, output: any): void {
    // 完全非阻塞（不等待，不阻塞主流程，fire-and-forget）
    setImmediate(() => {
      // 使用asyncWrite包装，自动处理超时和错误
      this.asyncWrite(async () => {
        // 添加getDb超时保护
        const dbPromise = getDb();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('FEEDBACK_WRITE_TIMEOUT: getDb() exceeded 1.5s')), 1500);
        });
        
        const db = await Promise.race([dbPromise, timeoutPromise]);
        
        await db.collection('feedback_events').updateOne(
          { event_id },
          {
            $set: {
              output: output,
              updated_at: new Date()
            }
          }
        );
        console.log(`[Feedback] ✅ End recorded: ${event_id}`);
      });
    });
  }
  
  /**
   * 获取会话历史反馈
   * 添加超时保护：connect 1.5秒，total 2秒
   */
  async getSessionFeedback(session_id: string, limit: number = 10): Promise<FeedbackEvent[]> {
    try {
      // 添加getDb超时保护
      const dbPromise = getDb();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('FEEDBACK_WRITE_TIMEOUT: getDb() exceeded 1.5s')), 1500);
      });
      
      const db = await Promise.race([dbPromise, timeoutPromise]);
      const col = db.collection<FeedbackEvent>('feedback_events');
      
      // 添加查询超时保护（总超时2秒）
      const queryPromise = col
        .find({ session_id })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
      
      const queryTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('FEEDBACK_WRITE_TIMEOUT: query exceeded 2s')), 2000);
      });
      
      const docs: WithId<FeedbackEvent>[] = await Promise.race([queryPromise, queryTimeoutPromise]);
      
      // 去掉 _id，返回干净的 FeedbackEvent[]
      const events: FeedbackEvent[] = docs.map(({ _id, ...rest }) => rest);
      return events;
      
    } catch (error: any) {
      // 降级为warn，避免误导为主流程错误
      const errorMsg = error?.message || String(error);
      const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('TIMEOUT') || errorMsg.includes('secureConnect');
      
      if (isTimeout) {
        console.warn('[Feedback] FEEDBACK_WRITE_TIMEOUT: Get session failed (non-blocking):', errorMsg);
      } else {
        console.warn('[Feedback] Get session error (non-blocking):', errorMsg);
      }
      return [];
    }
  }
  
  /**
   * 更新反馈字段 - 完全非阻塞（Phase 1 新增）
   * 用于记录 shown_jobs, liked_jobs, disliked_jobs
   */
  updateFeedback(event_id: string, field: string, job_ids: string[]): void {
    // 完全非阻塞（不等待，不阻塞主流程，fire-and-forget）
    setImmediate(() => {
      // 使用asyncWrite包装，自动处理超时和错误
      this.asyncWrite(async () => {
        // 添加getDb超时保护
        const dbPromise = getDb();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('FEEDBACK_WRITE_TIMEOUT: getDb() exceeded 1.5s')), 1500);
        });
        
        const db = await Promise.race([dbPromise, timeoutPromise]);
        
        await db.collection('feedback_events').updateOne(
          { event_id },
          {
            $addToSet: { [`feedback.${field}`]: { $each: job_ids } },
            $set: { updated_at: new Date() }
          }
        );
        console.log(`[Feedback] ✅ Updated ${field} for ${event_id} (${job_ids.length} items)`);
      });
    });
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
   * 添加严格短超时：connect 1-2秒，total 2-3秒
   */
  private async asyncWrite(fn: () => Promise<void>): Promise<void> {
    try {
      // 严格短超时：2秒总超时
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error('FEEDBACK_WRITE_TIMEOUT: Operation exceeded 2s timeout'));
        }, 2000);
      });
      
      await Promise.race([fn(), timeoutPromise]);
    } catch (err: any) {
      // 降级为warn，避免误导为主流程错误
      const errorMsg = err.message || String(err);
      const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('TIMEOUT') || errorMsg.includes('secureConnect');
      
      if (isTimeout) {
        console.warn('[Feedback] FEEDBACK_WRITE_TIMEOUT (non-blocking, ignored):', errorMsg);
      } else {
        console.warn('[Feedback] Write error (non-blocking, ignored):', errorMsg);
      }
      // 不抛出异常，确保主流程不受影响
    }
  }
}

