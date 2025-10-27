// ============================================
// MongoDB Connection Pool - Global Singleton
// ============================================
// Vercel serverless环境下复用MongoDB连接
// 避免每次请求创建新连接，提升性能

import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI!;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// 全局单例模式（Vercel环境复用）
if (!globalThis._mongoClientPromise) {
  client = new MongoClient(uri, options);
  globalThis._mongoClientPromise = client.connect();
  console.log('[MongoClient] New connection created');
} else {
  console.log('[MongoClient] Reusing existing connection');
}

clientPromise = globalThis._mongoClientPromise;

/**
 * 获取 MongoDB Client（复用连接）
 */
export const getMongoClient = async (): Promise<MongoClient> => {
  return await clientPromise;
};

/**
 * 获取 Database 实例
 * @param dbName - 数据库名称，默认使用环境变量 MONGODB_DB 或 'hera'
 */
export const getDb = async (dbName?: string): Promise<Db> => {
  const client = await getMongoClient();
  const database = dbName || process.env.MONGODB_DB || 'hera';
  return client.db(database);
};

/**
 * 健康检查
 */
export const pingMongo = async (): Promise<boolean> => {
  try {
    const client = await getMongoClient();
    await client.db('admin').command({ ping: 1 });
    console.log('[MongoClient] Ping successful');
    return true;
  } catch (error) {
    console.error('[MongoClient] Ping failed:', error);
    return false;
  }
};

// TypeScript全局类型声明
declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

