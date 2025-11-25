// 批量将 location 数组转换为 locations 字符串字段（使用 jobIdentifier 游标，支持并发）
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI;
const TARGET_DB = process.env.MONGODB_DB || 'hera';
const TARGET_COLLECTION = process.env.MONGODB_COLLECTION || 'jobs';

// 配置参数
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '500', 10);
const BULK_WRITE_BATCH = parseInt(process.env.BULK_WRITE_BATCH || '500', 10);
const CONCURRENT_BATCHES = parseInt(process.env.CONCURRENT_BATCHES || '20', 10);
const SLEEP_MS = parseInt(process.env.SLEEP_MS || '100', 10);
const START_AFTER_JOB_ID = process.env.START_AFTER_JOB_ID || null;
const MAX_ROUNDS = parseInt(process.env.MAX_ROUNDS || '0', 10); // 0 表示不限制，执行所有

// 游标文件路径
const CURSOR_FILE = path.join(__dirname, 'migrate-location-cursor.json');

// 读取游标位置
async function loadCursor() {
  try {
    const data = await fs.readFile(CURSOR_FILE, 'utf8');
    const cursor = JSON.parse(data);
    console.log(`📖 从文件读取游标: ${cursor.lastJobIdentifier || 'null'}`);
    return cursor.lastJobIdentifier || null;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📖 游标文件不存在，从头开始');
      return null;
    }
    console.error('⚠️  读取游标文件失败:', error.message);
    return null;
  }
}

// 保存游标位置
async function saveCursor(jobIdentifier, round, totalUpdated, totalSkipped) {
  try {
    const cursor = {
      lastJobIdentifier: jobIdentifier,
      lastRound: round,
      totalUpdated,
      totalSkipped,
      lastUpdated: new Date().toISOString()
    };
    await fs.writeFile(CURSOR_FILE, JSON.stringify(cursor, null, 2), 'utf8');
  } catch (error) {
    console.error('⚠️  保存游标文件失败:', error.message);
  }
}

// 将 location 数组转换为 locations 字符串（与测试脚本保持一致）
function convertLocationToLocations(location) {
  // 如果 location 是数组
  if (Array.isArray(location) && location.length > 0) {
    // 过滤并处理每个元素
    const validLocations = location
      .map((loc) => {
        if (typeof loc === 'string') {
          return loc.trim();
        }
        // 兼容对象格式
        if (loc && typeof loc === 'object') {
          return (loc.text || loc.label || loc.name || '').trim();
        }
        return '';
      })
      .filter((loc) => loc.length > 0);
    
    if (validLocations.length > 0) {
      // 用分号+空格分隔，不做任何格式转换
      return validLocations.join('; ');
    }
  }
  
  // 如果 location 是字符串，直接返回
  if (typeof location === 'string' && location.trim()) {
    return location.trim();
  }
  
  return null;
}

async function migrateLocationToLocations() {
  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: CONCURRENT_BATCHES * 2 + 5
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const collection = client.db(TARGET_DB).collection(TARGET_COLLECTION);
    
    // 优先使用环境变量，其次使用保存的游标，最后为 null
    let cursorJobId = START_AFTER_JOB_ID || await loadCursor();
    let round = 1;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const startTime = Date.now();
    
    console.log('🚀 开始迁移 location → locations...\n');
    console.log(`配置: BATCH_SIZE=${BATCH_SIZE}, BULK_WRITE_BATCH=${BULK_WRITE_BATCH}, CONCURRENT_BATCHES=${CONCURRENT_BATCHES}`);
    console.log(`起始游标: ${cursorJobId || '从头开始'}`);
    if (MAX_ROUNDS > 0) {
      console.log(`⚠️  限制执行轮数: ${MAX_ROUNDS} 轮（测试模式）`);
    }
    console.log('');
    
    while (true) {
      // 检查是否达到最大轮数限制
      if (MAX_ROUNDS > 0 && round > MAX_ROUNDS) {
        console.log(`\n🛑 达到最大轮数限制（${MAX_ROUNDS} 轮），停止执行`);
        console.log(`📝 最后处理的 jobIdentifier: ${cursorJobId}`);
        console.log(`💾 游标已保存，下次可以从这个位置继续`);
        break;
      }
      // 1. 查询一批有 location 但还没有 locations 的文档（使用 jobIdentifier 索引）
      const queryStart = Date.now();
      const query = cursorJobId
        ? {
            location: { $exists: true, $ne: null },
            jobIdentifier: { $exists: true, $ne: null, $ne: '', $gt: cursorJobId },
            $or: [
              { locations: { $exists: false } },
              { locations: null },
              { locations: '' }
            ]
          }
        : {
            location: { $exists: true, $ne: null },
            jobIdentifier: { $exists: true, $ne: null, $ne: '' },
            $or: [
              { locations: { $exists: false } },
              { locations: null },
              { locations: '' }
            ]
          };
      
      const jobs = await collection.find(query, {
        projection: { jobIdentifier: 1, location: 1, locations: 1 }
      })
      .sort({ jobIdentifier: 1 })
      .limit(BATCH_SIZE)
      .toArray();
      
      const queryTime = Date.now() - queryStart;
      
      if (jobs.length === 0) {
        console.log(`\n🛑 第 ${round} 轮后停止：查询不到更多数据`);
        // 删除游标文件，表示已完成
        try {
          await fs.unlink(CURSOR_FILE);
          console.log('✅ 已删除游标文件（迁移完成）');
        } catch (error) {
          // 忽略删除错误
        }
        break;
      }
      
      console.log(`\n📦 第 ${round} 轮: 查询到 ${jobs.length} 个文档 (${queryTime}ms)`);
      
      // 2. 转换 location → locations
      const checkStart = Date.now();
      const updateOps = [];
      for (const job of jobs) {
        const locations = convertLocationToLocations(job.location);
        if (locations) {
          // 检查是否已经有 locations 且相同（避免重复更新）
          if (job.locations === locations) {
            totalSkipped++;
            continue;
          }
          
          updateOps.push({
            updateOne: {
              filter: { jobIdentifier: job.jobIdentifier },
              update: { $set: { locations: locations } }
            }
          });
        } else {
          totalSkipped++;
        }
      }
      
      const skipped = jobs.length - updateOps.length;
      totalSkipped += skipped;
      const checkTime = Date.now() - checkStart;
      
      console.log(`  检查完成: 需要更新 ${updateOps.length} 个, 跳过 ${skipped} 个 (已有 locations 或无法转换) (${checkTime}ms)`);
      
      if (updateOps.length === 0) {
        console.log(`  ⏭️  本轮无需更新，继续下一轮...`);
        cursorJobId = jobs[jobs.length - 1].jobIdentifier;
        await saveCursor(cursorJobId, round, totalUpdated, totalSkipped);
        round++;
        if (SLEEP_MS > 0) {
          await new Promise(resolve => setTimeout(resolve, SLEEP_MS));
        }
        continue;
      }
      
      // 3. 批量更新
      const writeStart = Date.now();
      const batches = [];
      for (let i = 0; i < updateOps.length; i += BULK_WRITE_BATCH) {
        batches.push(updateOps.slice(i, i + BULK_WRITE_BATCH));
      }
      
      let roundUpdated = 0;
      for (const batch of batches) {
        const result = await collection.bulkWrite(batch, { 
          ordered: false,
          writeConcern: { w: 1 }
        });
        roundUpdated += result.modifiedCount;
      }
      
      const writeTime = Date.now() - writeStart;
      totalUpdated += roundUpdated;
      
      console.log(`  批量写入: ${roundUpdated} 个文档已更新 (${writeTime}ms)`);
      console.log(`  累计: 已更新 ${totalUpdated} 个, 跳过 ${totalSkipped} 个`);
      
      // 4. 更新游标
      cursorJobId = jobs[jobs.length - 1].jobIdentifier;
      await saveCursor(cursorJobId, round, totalUpdated, totalSkipped);
      
      // 5. 进度统计
      const elapsed = Date.now() - startTime;
      const avgPerDoc = roundUpdated > 0 ? (writeTime / roundUpdated).toFixed(2) : 0;
      console.log(`  本轮耗时: ${queryTime + checkTime + writeTime}ms, 平均每个: ${avgPerDoc}ms`);
      
      round++;
      
      // 6. 短暂休息
      if (SLEEP_MS > 0) {
        await new Promise(resolve => setTimeout(resolve, SLEEP_MS));
      }
    }
    
    // 7. 创建索引
    console.log('\n📊 创建 locations 索引...');
    try {
      await collection.createIndex({ locations: 1 });
      console.log('✅ locations 索引创建成功');
    } catch (error) {
      console.error('⚠️  创建索引失败:', error.message);
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`\n\n✅ 迁移完成！`);
    console.log(`  总轮数: ${round - 1}`);
    console.log(`  总更新: ${totalUpdated} 个文档`);
    console.log(`  总跳过: ${totalSkipped} 个文档`);
    console.log(`  总耗时: ${totalTime}ms (${(totalTime/1000).toFixed(2)}秒)`);
    if (totalUpdated > 0) {
      console.log(`  平均速度: ${(totalUpdated / (totalTime/1000)).toFixed(0)} 个/秒`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

migrateLocationToLocations();

const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI;
const TARGET_DB = process.env.MONGODB_DB || 'hera';
const TARGET_COLLECTION = process.env.MONGODB_COLLECTION || 'jobs';

// 配置参数
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '500', 10);
const BULK_WRITE_BATCH = parseInt(process.env.BULK_WRITE_BATCH || '500', 10);
const CONCURRENT_BATCHES = parseInt(process.env.CONCURRENT_BATCHES || '20', 10);
const SLEEP_MS = parseInt(process.env.SLEEP_MS || '100', 10);
const START_AFTER_JOB_ID = process.env.START_AFTER_JOB_ID || null;
const MAX_ROUNDS = parseInt(process.env.MAX_ROUNDS || '0', 10); // 0 表示不限制，执行所有

// 游标文件路径
const CURSOR_FILE = path.join(__dirname, 'migrate-location-cursor.json');

// 读取游标位置
async function loadCursor() {
  try {
    const data = await fs.readFile(CURSOR_FILE, 'utf8');
    const cursor = JSON.parse(data);
    console.log(`📖 从文件读取游标: ${cursor.lastJobIdentifier || 'null'}`);
    return cursor.lastJobIdentifier || null;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📖 游标文件不存在，从头开始');
      return null;
    }
    console.error('⚠️  读取游标文件失败:', error.message);
    return null;
  }
}

// 保存游标位置
async function saveCursor(jobIdentifier, round, totalUpdated, totalSkipped) {
  try {
    const cursor = {
      lastJobIdentifier: jobIdentifier,
      lastRound: round,
      totalUpdated,
      totalSkipped,
      lastUpdated: new Date().toISOString()
    };
    await fs.writeFile(CURSOR_FILE, JSON.stringify(cursor, null, 2), 'utf8');
  } catch (error) {
    console.error('⚠️  保存游标文件失败:', error.message);
  }
}

// 将 location 数组转换为 locations 字符串（与测试脚本保持一致）
function convertLocationToLocations(location) {
  // 如果 location 是数组
  if (Array.isArray(location) && location.length > 0) {
    // 过滤并处理每个元素
    const validLocations = location
      .map((loc) => {
        if (typeof loc === 'string') {
          return loc.trim();
        }
        // 兼容对象格式
        if (loc && typeof loc === 'object') {
          return (loc.text || loc.label || loc.name || '').trim();
        }
        return '';
      })
      .filter((loc) => loc.length > 0);
    
    if (validLocations.length > 0) {
      // 用分号+空格分隔，不做任何格式转换
      return validLocations.join('; ');
    }
  }
  
  // 如果 location 是字符串，直接返回
  if (typeof location === 'string' && location.trim()) {
    return location.trim();
  }
  
  return null;
}

async function migrateLocationToLocations() {
  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: CONCURRENT_BATCHES * 2 + 5
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const collection = client.db(TARGET_DB).collection(TARGET_COLLECTION);
    
    // 优先使用环境变量，其次使用保存的游标，最后为 null
    let cursorJobId = START_AFTER_JOB_ID || await loadCursor();
    let round = 1;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const startTime = Date.now();
    
    console.log('🚀 开始迁移 location → locations...\n');
    console.log(`配置: BATCH_SIZE=${BATCH_SIZE}, BULK_WRITE_BATCH=${BULK_WRITE_BATCH}, CONCURRENT_BATCHES=${CONCURRENT_BATCHES}`);
    console.log(`起始游标: ${cursorJobId || '从头开始'}`);
    if (MAX_ROUNDS > 0) {
      console.log(`⚠️  限制执行轮数: ${MAX_ROUNDS} 轮（测试模式）`);
    }
    console.log('');
    
    while (true) {
      // 检查是否达到最大轮数限制
      if (MAX_ROUNDS > 0 && round > MAX_ROUNDS) {
        console.log(`\n🛑 达到最大轮数限制（${MAX_ROUNDS} 轮），停止执行`);
        console.log(`📝 最后处理的 jobIdentifier: ${cursorJobId}`);
        console.log(`💾 游标已保存，下次可以从这个位置继续`);
        break;
      }
      // 1. 查询一批有 location 但还没有 locations 的文档（使用 jobIdentifier 索引）
      const queryStart = Date.now();
      const query = cursorJobId
        ? {
            location: { $exists: true, $ne: null },
            jobIdentifier: { $exists: true, $ne: null, $ne: '', $gt: cursorJobId },
            $or: [
              { locations: { $exists: false } },
              { locations: null },
              { locations: '' }
            ]
          }
        : {
            location: { $exists: true, $ne: null },
            jobIdentifier: { $exists: true, $ne: null, $ne: '' },
            $or: [
              { locations: { $exists: false } },
              { locations: null },
              { locations: '' }
            ]
          };
      
      const jobs = await collection.find(query, {
        projection: { jobIdentifier: 1, location: 1, locations: 1 }
      })
      .sort({ jobIdentifier: 1 })
      .limit(BATCH_SIZE)
      .toArray();
      
      const queryTime = Date.now() - queryStart;
      
      if (jobs.length === 0) {
        console.log(`\n🛑 第 ${round} 轮后停止：查询不到更多数据`);
        // 删除游标文件，表示已完成
        try {
          await fs.unlink(CURSOR_FILE);
          console.log('✅ 已删除游标文件（迁移完成）');
        } catch (error) {
          // 忽略删除错误
        }
        break;
      }
      
      console.log(`\n📦 第 ${round} 轮: 查询到 ${jobs.length} 个文档 (${queryTime}ms)`);
      
      // 2. 转换 location → locations
      const checkStart = Date.now();
      const updateOps = [];
      for (const job of jobs) {
        const locations = convertLocationToLocations(job.location);
        if (locations) {
          // 检查是否已经有 locations 且相同（避免重复更新）
          if (job.locations === locations) {
            totalSkipped++;
            continue;
          }
          
          updateOps.push({
            updateOne: {
              filter: { jobIdentifier: job.jobIdentifier },
              update: { $set: { locations: locations } }
            }
          });
        } else {
          totalSkipped++;
        }
      }
      
      const skipped = jobs.length - updateOps.length;
      totalSkipped += skipped;
      const checkTime = Date.now() - checkStart;
      
      console.log(`  检查完成: 需要更新 ${updateOps.length} 个, 跳过 ${skipped} 个 (已有 locations 或无法转换) (${checkTime}ms)`);
      
      if (updateOps.length === 0) {
        console.log(`  ⏭️  本轮无需更新，继续下一轮...`);
        cursorJobId = jobs[jobs.length - 1].jobIdentifier;
        await saveCursor(cursorJobId, round, totalUpdated, totalSkipped);
        round++;
        if (SLEEP_MS > 0) {
          await new Promise(resolve => setTimeout(resolve, SLEEP_MS));
        }
        continue;
      }
      
      // 3. 批量更新
      const writeStart = Date.now();
      const batches = [];
      for (let i = 0; i < updateOps.length; i += BULK_WRITE_BATCH) {
        batches.push(updateOps.slice(i, i + BULK_WRITE_BATCH));
      }
      
      let roundUpdated = 0;
      for (const batch of batches) {
        const result = await collection.bulkWrite(batch, { 
          ordered: false,
          writeConcern: { w: 1 }
        });
        roundUpdated += result.modifiedCount;
      }
      
      const writeTime = Date.now() - writeStart;
      totalUpdated += roundUpdated;
      
      console.log(`  批量写入: ${roundUpdated} 个文档已更新 (${writeTime}ms)`);
      console.log(`  累计: 已更新 ${totalUpdated} 个, 跳过 ${totalSkipped} 个`);
      
      // 4. 更新游标
      cursorJobId = jobs[jobs.length - 1].jobIdentifier;
      await saveCursor(cursorJobId, round, totalUpdated, totalSkipped);
      
      // 5. 进度统计
      const elapsed = Date.now() - startTime;
      const avgPerDoc = roundUpdated > 0 ? (writeTime / roundUpdated).toFixed(2) : 0;
      console.log(`  本轮耗时: ${queryTime + checkTime + writeTime}ms, 平均每个: ${avgPerDoc}ms`);
      
      round++;
      
      // 6. 短暂休息
      if (SLEEP_MS > 0) {
        await new Promise(resolve => setTimeout(resolve, SLEEP_MS));
      }
    }
    
    // 7. 创建索引
    console.log('\n📊 创建 locations 索引...');
    try {
      await collection.createIndex({ locations: 1 });
      console.log('✅ locations 索引创建成功');
    } catch (error) {
      console.error('⚠️  创建索引失败:', error.message);
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`\n\n✅ 迁移完成！`);
    console.log(`  总轮数: ${round - 1}`);
    console.log(`  总更新: ${totalUpdated} 个文档`);
    console.log(`  总跳过: ${totalSkipped} 个文档`);
    console.log(`  总耗时: ${totalTime}ms (${(totalTime/1000).toFixed(2)}秒)`);
    if (totalUpdated > 0) {
      console.log(`  平均速度: ${(totalUpdated / (totalTime/1000)).toFixed(0)} 个/秒`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

migrateLocationToLocations();












