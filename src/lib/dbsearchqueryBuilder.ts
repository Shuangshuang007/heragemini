import { MongoClient } from 'mongodb';
import { greaterAreaMap } from '../utils/greaterAreaMap';

// MongoDB连接配置
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'hera';
const COLLECTION_NAME = 'jobs';

let client: MongoClient | null = null;
let db: any = null;

// 查询构建器接口
export interface QueryBuilder {
  buildJobQuery(keywords: string[], city: string): any;
  buildLocationQuery(city: string): any;
  optimizeQuery(query: any): any;
  createIndexes(): Promise<void>;
}

// MongoDB查询构建器实现
export class MongoDBQueryBuilder implements QueryBuilder {
  
  /**
   * 构建职位查询
   * @param keywords 关键词数组
   * @param city 城市
   * @returns MongoDB查询对象
   */
  buildJobQuery(keywords: string[], city: string): any {
    const query: any = {};
    
    // 构建职位标题查询
    if (keywords && keywords.length > 0) {
      query.$or = keywords.map(keyword => ({
        title: { $regex: this.escapeRegex(keyword), $options: 'i' }
      }));
    }
    
    // 构建扩展位置查询
    if (city) {
      const locationQuery = this.buildExtendedLocationQuery(city);
      if (locationQuery && Object.keys(locationQuery).length > 0) {
        query.$and = query.$and || [];
        query.$and.push(locationQuery);
      }
    }
    
    // 只查询活跃的职位
    query.is_active = { $ne: false };
    
    return this.optimizeQuery(query);
  }
  
  /**
   * 构建城市查询
   * @param city 城市名称
   * @returns 城市查询条件
   */
  buildLocationQuery(city: string): any {
    if (!city) return {};
    
    // 标准化城市名称
    const normalizedCity = this.normalizeCity(city);
    
    const regex = {
      $regex: this.escapeRegex(normalizedCity),
      $options: 'i'
    };

    return {
      locations: regex
    };
  }

  /**
   * 构建扩展位置查询（支持Greater Area）
   * @param city 城市名称（可能包含州/省缩写，如 "New York, NY"）
   * @returns MongoDB扩展位置查询对象
   */
  buildExtendedLocationQuery(city: string): any {
    if (!city) return {};
    
    // 从城市名称中提取基础城市名（去除州/省缩写）
    // 例如: "New York, NY" -> "New York", "Sydney, NSW" -> "Sydney"
    const baseCityName = this.extractBaseCityName(city);
    
    // 先尝试使用基础城市名匹配，如果不存在则使用原始城市名
    const greaterArea = greaterAreaMap[baseCityName] || greaterAreaMap[city];
    
    if (!greaterArea) {
      // 如果没有扩展定义，使用原始逻辑
      return this.buildLocationQuery(city);
    }
    
    // 构建扩展位置查询：核心区域 + 次优区域
    const allLocations = [...greaterArea.core, ...greaterArea.fringe];
    
    // 使用单个regex查询，用|分隔所有位置
    const locationRegex = allLocations.map(location => this.escapeRegex(location)).join('|');
    const regex = {
      $regex: locationRegex,
      $options: 'i'
    };
    
    return {
      locations: regex
    };
  }
  
  /**
   * 从城市名称中提取基础城市名（去除州/省缩写）
   * @param city 城市名称
   * @returns 基础城市名称
   */
  private extractBaseCityName(city: string): string {
    if (!city) return city;
    // 匹配 ", XX" 格式（州/省缩写，通常是 2-3 个字母）
    const match = city.match(/^(.+?),\s*[A-Z]{2,3}$/);
    return match ? match[1].trim() : city.trim();
  }
  
  /**
   * 优化查询
   * @param query 原始查询
   * @returns 优化后的查询
   */
  optimizeQuery(query: any): any {
    // 移除空的$or条件
    if (query.$or && query.$or.length === 0) {
      delete query.$or;
    }
    if (query.$and && query.$and.length === 0) {
      delete query.$and;
    }
    
    // 如果只有is_active条件，添加默认排序
    if (Object.keys(query).length === 1 && query.is_active) {
      query.title = { $exists: true };
    }
    
    return query;
  }
  
  /**
   * 创建MongoDB索引
   */
  async createIndexes(): Promise<void> {
    try {
      const { db } = await this.connectToMongoDB();
      const collection = db.collection(COLLECTION_NAME);
      
      console.log('[QueryBuilder] Creating MongoDB indexes...');
      
      // 创建复合索引
      await collection.createIndex({ title: 1, location: 1 });
      await collection.createIndex({ location: 1, title: 1 });
      await collection.createIndex({ locationRaw: 1, title: 1 });
      await collection.createIndex({ title: "text", location: 1 });
      await collection.createIndex({ is_active: 1, updatedAt: -1 });
      
      console.log('[QueryBuilder] MongoDB indexes created successfully');
    } catch (error) {
      console.error('[QueryBuilder] Error creating indexes:', error);
    }
  }
  
  /**
   * 执行查询
   * @param query 查询条件
   * @param limit 限制数量
   * @param sort 排序条件
   * @returns 查询结果
   */
  async executeQuery(query: any, limit: number = 600, sort: any = { updatedAt: -1, createdAt: -1 }): Promise<any[]> {
    try {
      const { db } = await this.connectToMongoDB();
      const collection = db.collection(COLLECTION_NAME);
      
      console.log('[QueryBuilder] Executing query:', JSON.stringify(query, null, 2));
      
      const jobs = await collection
        .find(query)
        .sort(sort)
        .limit(limit)
        .toArray();
      
      console.log(`[QueryBuilder] Found ${jobs.length} jobs`);
      
      // 去重处理 - 支持 id, jobIdentifier, _id
      const jobMap = new Map();
      for (const job of jobs) {
        // 优先使用 id，其次 jobIdentifier，最后 _id
        const key = job.id || job.jobIdentifier || (job._id ? job._id.toString() : null);
        if (key && !jobMap.has(key)) {
          jobMap.set(key, job);
        }
      }
      
      const uniqueJobs = Array.from(jobMap.values());
      console.log(`[QueryBuilder] After deduplication: ${uniqueJobs.length} jobs (from ${jobs.length} total)`);
      
      return uniqueJobs;
    } catch (error) {
      console.error('[QueryBuilder] Error executing query:', error);
      return [];
    }
  }
  
  /**
   * 连接MongoDB
   */
  private async connectToMongoDB() {
    if (!client) {
      client = new MongoClient(MONGODB_URI);
      await client.connect();
      db = client.db(DB_NAME);
    }
    return { client, db };
  }
  
  /**
   * 转义正则表达式特殊字符
   * @param text 原始文本
   * @returns 转义后的文本
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * 标准化城市名称
   * @param city 城市名称
   * @returns 标准化后的城市名称
   */
  private normalizeCity(city: string): string {
    const cityMap: Record<string, string> = {
      'sydney': 'Sydney',
      'melbourne': 'Melbourne',
      'brisbane': 'Brisbane',
      'perth': 'Perth',
      'adelaide': 'Adelaide',
      'canberra': 'Canberra',
      'darwin': 'Darwin',
      'hobart': 'Hobart'
    };
    
    const normalized = city.toLowerCase().trim();
    return cityMap[normalized] || city;
  }
}

// 单例实例
export const queryBuilder = new MongoDBQueryBuilder();

/**
 * 构建统一查询（便捷函数）
 * @param keywords 关键词数组
 * @param city 城市
 * @param limit 限制数量
 * @returns 查询结果
 */
export async function buildAndExecuteQuery(keywords: string[], city: string, limit: number = 600): Promise<any[]> {
  const query = queryBuilder.buildJobQuery(keywords, city);
  return await queryBuilder.executeQuery(query, limit);
}

/**
 * 测试查询构建器
 */
export async function testQueryBuilder(): Promise<boolean> {
  try {
    // 测试基本查询
    const testQuery = queryBuilder.buildJobQuery(['Software Engineer'], 'Sydney');
    console.log('[QueryBuilder] Test query:', JSON.stringify(testQuery, null, 2));
    
    // 测试连接
    await queryBuilder.createIndexes();
    
    console.log('[QueryBuilder] Test completed successfully');
    return true;
  } catch (error) {
    console.error('[QueryBuilder] Test failed:', error);
    return false;
  }
} 

