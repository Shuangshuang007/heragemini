// ============================================
// Tracking Utilities - Frontend Helper
// ============================================
// 前端追踪工具：检测URL参数并上报反馈

/**
 * 检测并上报ChatGPT追踪参数
 * 在任何Job详情页调用此函数
 */
export async function trackJobView(params: {
  event_id?: string | null;
  session_id?: string | null;
  ref?: string | null;
  job_id: string;
}): Promise<void> {
  const { event_id, session_id, ref, job_id } = params;
  
  // 只有从ChatGPT来的流量才追踪
  if (!event_id || ref !== 'chatgpt') {
    return;
  }
  
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id,
        action: 'clicked',
        payload: {
          job_id,
          timestamp: Date.now()
        }
      })
    });
    
    if (response.ok) {
      console.log('[Tracking] ✅ Click recorded:', event_id);
    } else {
      console.warn('[Tracking] ⚠️ Failed to record:', await response.text());
    }
  } catch (err) {
    console.warn('[Tracking] ⚠️ Network error:', err);
    // 失败不影响页面展示
  }
}

/**
 * 上报保存Job
 */
export async function trackJobSave(event_id: string, job_id: string): Promise<void> {
  try {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id,
        action: 'saved',
        payload: { job_id }
      })
    });
    console.log('[Tracking] ✅ Save recorded:', event_id);
  } catch (err) {
    console.warn('[Tracking] Save tracking failed:', err);
  }
}

/**
 * 上报简历下载
 */
export async function trackResumeDownload(event_id: string): Promise<void> {
  try {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id,
        action: 'downloaded',
        payload: {}
      })
    });
    console.log('[Tracking] ✅ Download recorded:', event_id);
  } catch (err) {
    console.warn('[Tracking] Download tracking failed:', err);
  }
}


