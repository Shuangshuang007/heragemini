// 批量从 jobs_pipeline 同步 jobUrl 到 jobs 集合
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI;
const PIPELINE_DB = 'hera_jobs';
const PIPELINE_COLLECTION = 'jobs_pipeline';
const TARGET_DB = process.env.MONGODB_DB || 'hera';
const TARGET_COLLECTION = process.env.MONGODB_COLLECTION || 'jobs';

// 配置参数
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '500', 10);
const BULK_WRITE_BATCH = parseInt(process.env.BULK_WRITE_BATCH || '500', 10);
const CONCURRENT_BATCHES = parseInt(process.env.CONCURRENT_BATCHES || '3', 10);
const SLEEP_MS = parseInt(process.env.SLEEP_MS || '100', 10);
const START_AFTER_JOB_ID = process.env.START_AFTER_JOB_ID || null;

// 游标文件路径
const CURSOR_FILE = path.join(__dirname, 'sync-jobUrl-cursor.json');

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

async function syncJobUrlBatch() {
  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: CONCURRENT_BATCHES * 2 + 5
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const pipelineCollection = client.db(PIPELINE_DB).collection(PIPELINE_COLLECTION);
    const jobsCollection = client.db(TARGET_DB).collection(TARGET_COLLECTION);
    
    // 优先使用环境变量，其次使用保存的游标，最后为 null
    let cursorJobId = START_AFTER_JOB_ID || await loadCursor();
    let round = 1;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const startTime = Date.now();
    
    console.log('🚀 开始批量同步 jobUrl...\n');
    console.log(`配置: BATCH_SIZE=${BATCH_SIZE}, BULK_WRITE_BATCH=${BULK_WRITE_BATCH}, CONCURRENT_BATCHES=${CONCURRENT_BATCHES}`);
    console.log(`起始游标: ${cursorJobId || '从头开始'}\n`);
    
    while (true) {
      // 1. 从 pipeline 查询一批有 jobUrl 的文档（使用 jobIdentifier 索引）
      const queryStart = Date.now();
      const query = cursorJobId
        ? {
            jobUrl: { $exists: true, $ne: null, $ne: '' },
            jobIdentifier: { $exists: true, $ne: null, $ne: '', $gt: cursorJobId }
          }
        : {
            jobUrl: { $exists: true, $ne: null, $ne: '' },
            jobIdentifier: { $exists: true, $ne: null, $ne: '' }
          };
      
      const pipelineJobs = await pipelineCollection.find(query, {
        projection: { jobIdentifier: 1, jobUrl: 1 }
      })
      .sort({ jobIdentifier: 1 })
      .limit(BATCH_SIZE)
      .toArray();
      
      const queryTime = Date.now() - queryStart;
      
      if (pipelineJobs.length === 0) {
        console.log(`\n🛑 第 ${round} 轮后停止：查询不到更多数据`);
        // 删除游标文件，表示已完成
        try {
          await fs.unlink(CURSOR_FILE);
          console.log('✅ 已删除游标文件（同步完成）');
        } catch (error) {
          // 忽略删除错误
        }
        break;
      }
      
      console.log(`\n📦 第 ${round} 轮: 从 pipeline 查询到 ${pipelineJobs.length} 个文档 (${queryTime}ms)`);
      
      // 2. 检查 jobs 集合中哪些需要更新（避免重复）
      const checkStart = Date.now();
      const jobIdentifiers = pipelineJobs.map(j => j.jobIdentifier);
      const existingJobs = await jobsCollection.find({
        jobIdentifier: { $in: jobIdentifiers }
      }, {
        projection: { jobIdentifier: 1, jobUrl: 1 }
      }).toArray();
      
      const existingMap = new Map();
      existingJobs.forEach(job => {
        existingMap.set(job.jobIdentifier, job.jobUrl);
      });
      
      // 3. 过滤出需要更新的（避免重复：只更新没有 jobUrl 或 jobUrl 为空的）
      const needUpdate = pipelineJobs.filter(pipelineJob => {
        const existingUrl = existingMap.get(pipelineJob.jobIdentifier);
        return !existingUrl || existingUrl === '';
      });
      
      const skipped = pipelineJobs.length - needUpdate.length;
      totalSkipped += skipped;
      const checkTime = Date.now() - checkStart;
      
      console.log(`  检查完成: 需要更新 ${needUpdate.length} 个, 跳过 ${skipped} 个 (已有 jobUrl) (${checkTime}ms)`);
      
      if (needUpdate.length === 0) {
        console.log(`  ⏭️  本轮无需更新，继续下一轮...`);
        cursorJobId = pipelineJobs[pipelineJobs.length - 1].jobIdentifier;
        // 保存游标（即使没有更新也要保存位置）
        await saveCursor(cursorJobId, round, totalUpdated, totalSkipped);
        round++;
        if (SLEEP_MS > 0) {
          await new Promise(resolve => setTimeout(resolve, SLEEP_MS));
        }
        continue;
      }
      
      // 4. 构建批量更新操作
      const updateOps = needUpdate.map(pipelineJob => ({
        updateOne: {
          filter: { jobIdentifier: pipelineJob.jobIdentifier },
          update: { $set: { jobUrl: pipelineJob.jobUrl } },
          upsert: false // 不创建新文档，只更新存在的
        }
      }));
      
      // 5. 分批执行 bulkWrite
      const writeStart = Date.now();
      const batches = [];
      for (let i = 0; i < updateOps.length; i += BULK_WRITE_BATCH) {
        batches.push(updateOps.slice(i, i + BULK_WRITE_BATCH));
      }
      
      let roundUpdated = 0;
      for (const batch of batches) {
        const result = await jobsCollection.bulkWrite(batch, { 
          ordered: false,
          writeConcern: { w: 1 } // 快速确认
        });
        roundUpdated += result.modifiedCount;
      }
      
      const writeTime = Date.now() - writeStart;
      totalUpdated += roundUpdated;
      
      console.log(`  批量写入: ${roundUpdated} 个文档已更新 (${writeTime}ms)`);
      console.log(`  累计: 已更新 ${totalUpdated} 个, 跳过 ${totalSkipped} 个`);
      
      // 6. 更新游标
      cursorJobId = pipelineJobs[pipelineJobs.length - 1].jobIdentifier;
      
      // 7. 保存游标位置（每轮都保存，确保断点续传）
      await saveCursor(cursorJobId, round, totalUpdated, totalSkipped);
      
      // 8. 进度统计
      const elapsed = Date.now() - startTime;
      const avgPerDoc = roundUpdated > 0 ? (writeTime / roundUpdated).toFixed(2) : 0;
      console.log(`  本轮耗时: ${queryTime + checkTime + writeTime}ms, 平均每个: ${avgPerDoc}ms`);
      
      round++;
      
      // 9. 短暂休息，避免过载
      if (SLEEP_MS > 0) {
        await new Promise(resolve => setTimeout(resolve, SLEEP_MS));
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`\n\n✅ 批量同步完成！`);
    console.log(`  总轮数: ${round - 1}`);
    console.log(`  总更新: ${totalUpdated} 个文档`);
    console.log(`  总跳过: ${totalSkipped} 个文档（已有 jobUrl）`);
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

syncJobUrlBatch();


const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI;
const PIPELINE_DB = 'hera_jobs';
const PIPELINE_COLLECTION = 'jobs_pipeline';
const TARGET_DB = process.env.MONGODB_DB || 'hera';
const TARGET_COLLECTION = process.env.MONGODB_COLLECTION || 'jobs';

// 配置参数
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '500', 10);
const BULK_WRITE_BATCH = parseInt(process.env.BULK_WRITE_BATCH || '500', 10);
const CONCURRENT_BATCHES = parseInt(process.env.CONCURRENT_BATCHES || '3', 10);
const SLEEP_MS = parseInt(process.env.SLEEP_MS || '100', 10);
const START_AFTER_JOB_ID = process.env.START_AFTER_JOB_ID || null;

// 游标文件路径
const CURSOR_FILE = path.join(__dirname, 'sync-jobUrl-cursor.json');

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

async function syncJobUrlBatch() {
  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: CONCURRENT_BATCHES * 2 + 5
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const pipelineCollection = client.db(PIPELINE_DB).collection(PIPELINE_COLLECTION);
    const jobsCollection = client.db(TARGET_DB).collection(TARGET_COLLECTION);
    
    // 优先使用环境变量，其次使用保存的游标，最后为 null
    let cursorJobId = START_AFTER_JOB_ID || await loadCursor();
    let round = 1;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const startTime = Date.now();
    
    console.log('🚀 开始批量同步 jobUrl...\n');
    console.log(`配置: BATCH_SIZE=${BATCH_SIZE}, BULK_WRITE_BATCH=${BULK_WRITE_BATCH}, CONCURRENT_BATCHES=${CONCURRENT_BATCHES}`);
    console.log(`起始游标: ${cursorJobId || '从头开始'}\n`);
    
    while (true) {
      // 1. 从 pipeline 查询一批有 jobUrl 的文档（使用 jobIdentifier 索引）
      const queryStart = Date.now();
      const query = cursorJobId
        ? {
            jobUrl: { $exists: true, $ne: null, $ne: '' },
            jobIdentifier: { $exists: true, $ne: null, $ne: '', $gt: cursorJobId }
          }
        : {
            jobUrl: { $exists: true, $ne: null, $ne: '' },
            jobIdentifier: { $exists: true, $ne: null, $ne: '' }
          };
      
      const pipelineJobs = await pipelineCollection.find(query, {
        projection: { jobIdentifier: 1, jobUrl: 1 }
      })
      .sort({ jobIdentifier: 1 })
      .limit(BATCH_SIZE)
      .toArray();
      
      const queryTime = Date.now() - queryStart;
      
      if (pipelineJobs.length === 0) {
        console.log(`\n🛑 第 ${round} 轮后停止：查询不到更多数据`);
        // 删除游标文件，表示已完成
        try {
          await fs.unlink(CURSOR_FILE);
          console.log('✅ 已删除游标文件（同步完成）');
        } catch (error) {
          // 忽略删除错误
        }
        break;
      }
      
      console.log(`\n📦 第 ${round} 轮: 从 pipeline 查询到 ${pipelineJobs.length} 个文档 (${queryTime}ms)`);
      
      // 2. 检查 jobs 集合中哪些需要更新（避免重复）
      const checkStart = Date.now();
      const jobIdentifiers = pipelineJobs.map(j => j.jobIdentifier);
      const existingJobs = await jobsCollection.find({
        jobIdentifier: { $in: jobIdentifiers }
      }, {
        projection: { jobIdentifier: 1, jobUrl: 1 }
      }).toArray();
      
      const existingMap = new Map();
      existingJobs.forEach(job => {
        existingMap.set(job.jobIdentifier, job.jobUrl);
      });
      
      // 3. 过滤出需要更新的（避免重复：只更新没有 jobUrl 或 jobUrl 为空的）
      const needUpdate = pipelineJobs.filter(pipelineJob => {
        const existingUrl = existingMap.get(pipelineJob.jobIdentifier);
        return !existingUrl || existingUrl === '';
      });
      
      const skipped = pipelineJobs.length - needUpdate.length;
      totalSkipped += skipped;
      const checkTime = Date.now() - checkStart;
      
      console.log(`  检查完成: 需要更新 ${needUpdate.length} 个, 跳过 ${skipped} 个 (已有 jobUrl) (${checkTime}ms)`);
      
      if (needUpdate.length === 0) {
        console.log(`  ⏭️  本轮无需更新，继续下一轮...`);
        cursorJobId = pipelineJobs[pipelineJobs.length - 1].jobIdentifier;
        // 保存游标（即使没有更新也要保存位置）
        await saveCursor(cursorJobId, round, totalUpdated, totalSkipped);
        round++;
        if (SLEEP_MS > 0) {
          await new Promise(resolve => setTimeout(resolve, SLEEP_MS));
        }
        continue;
      }
      
      // 4. 构建批量更新操作
      const updateOps = needUpdate.map(pipelineJob => ({
        updateOne: {
          filter: { jobIdentifier: pipelineJob.jobIdentifier },
          update: { $set: { jobUrl: pipelineJob.jobUrl } },
          upsert: false // 不创建新文档，只更新存在的
        }
      }));
      
      // 5. 分批执行 bulkWrite
      const writeStart = Date.now();
      const batches = [];
      for (let i = 0; i < updateOps.length; i += BULK_WRITE_BATCH) {
        batches.push(updateOps.slice(i, i + BULK_WRITE_BATCH));
      }
      
      let roundUpdated = 0;
      for (const batch of batches) {
        const result = await jobsCollection.bulkWrite(batch, { 
          ordered: false,
          writeConcern: { w: 1 } // 快速确认
        });
        roundUpdated += result.modifiedCount;
      }
      
      const writeTime = Date.now() - writeStart;
      totalUpdated += roundUpdated;
      
      console.log(`  批量写入: ${roundUpdated} 个文档已更新 (${writeTime}ms)`);
      console.log(`  累计: 已更新 ${totalUpdated} 个, 跳过 ${totalSkipped} 个`);
      
      // 6. 更新游标
      cursorJobId = pipelineJobs[pipelineJobs.length - 1].jobIdentifier;
      
      // 7. 保存游标位置（每轮都保存，确保断点续传）
      await saveCursor(cursorJobId, round, totalUpdated, totalSkipped);
      
      // 8. 进度统计
      const elapsed = Date.now() - startTime;
      const avgPerDoc = roundUpdated > 0 ? (writeTime / roundUpdated).toFixed(2) : 0;
      console.log(`  本轮耗时: ${queryTime + checkTime + writeTime}ms, 平均每个: ${avgPerDoc}ms`);
      
      round++;
      
      // 9. 短暂休息，避免过载
      if (SLEEP_MS > 0) {
        await new Promise(resolve => setTimeout(resolve, SLEEP_MS));
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`\n\n✅ 批量同步完成！`);
    console.log(`  总轮数: ${round - 1}`);
    console.log(`  总更新: ${totalUpdated} 个文档`);
    console.log(`  总跳过: ${totalSkipped} 个文档（已有 jobUrl）`);
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

syncJobUrlBatch();













