// ============================================
// AgentKit Memory - In-Memory Session Store
// ============================================
// 内存占位实现，不连接数据库
// 仅用于MVP演示，生产环境需要替换为持久化存储

type SessionMemory = { [k: string]: unknown };

// 简单的内存存储Map，重启后数据丢失
const sessionMemory = new Map<string, SessionMemory>();

export async function loadMemory(sessionId: string): Promise<SessionMemory> {
  console.log(`[AgentKit Memory] Loading memory for session: ${sessionId}`);
  const memory = sessionMemory.get(sessionId) ?? {};
  console.log(`[AgentKit Memory] Retrieved ${Object.keys(memory).length} memory keys`);
  return memory;
}

export async function saveMemory(
  sessionId: string, 
  patch: SessionMemory
): Promise<void> {
  console.log(`[AgentKit Memory] Saving memory for session: ${sessionId}`);
  const current = sessionMemory.get(sessionId) ?? {};
  const updated = { ...current, ...patch };
  sessionMemory.set(sessionId, updated);
  console.log(`[AgentKit Memory] Saved ${Object.keys(patch).length} memory updates`);
}

export async function clearMemory(sessionId: string): Promise<void> {
  console.log(`[AgentKit Memory] Clearing memory for session: ${sessionId}`);
  sessionMemory.delete(sessionId);
}

export async function getMemoryKeys(): Promise<string[]> {
  return Array.from(sessionMemory.keys());
}
