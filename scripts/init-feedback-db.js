// ============================================
// MongoDB Feedback Collections Initialization
// ============================================
// 创建 feedback_events 和 feedback_aggregates collections
// 创建必要的索引以提升查询性能
//
// 运行方式:
// node scripts/init-feedback-db.js
// ============================================

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function initFeedbackDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB || 'hera';
  
  console.log('🚀 Initializing Feedback Database...');
  console.log(`📍 Database: ${dbName}`);
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(dbName);
    
    // ============================================
    // 1. 创建 feedback_events collection
    // ============================================
    console.log('\n📦 Creating feedback_events collection...');
    
    try {
      await db.createCollection('feedback_events');
      console.log('✅ feedback_events collection created');
    } catch (err) {
      if (err.code === 48) {
        console.log('⚠️  feedback_events already exists (skipped)');
      } else {
        throw err;
      }
    }
    
    // 创建索引
    console.log('📑 Creating indexes for feedback_events...');
    
    await db.collection('feedback_events').createIndex(
      { event_id: 1 },
      { unique: true, name: 'idx_event_id_unique' }
    );
    console.log('  ✅ Index: event_id (unique)');
    
    await db.collection('feedback_events').createIndex(
      { session_id: 1, timestamp: -1 },
      { name: 'idx_session_timestamp' }
    );
    console.log('  ✅ Index: session_id + timestamp');
    
    await db.collection('feedback_events').createIndex(
      { tool: 1, timestamp: -1 },
      { name: 'idx_tool_timestamp' }
    );
    console.log('  ✅ Index: tool + timestamp');
    
    await db.collection('feedback_events').createIndex(
      { timestamp: -1 },
      { name: 'idx_timestamp' }
    );
    console.log('  ✅ Index: timestamp');
    
    await db.collection('feedback_events').createIndex(
      { processed: 1, timestamp: -1 },
      { name: 'idx_processed_timestamp' }
    );
    console.log('  ✅ Index: processed + timestamp');
    
    await db.collection('feedback_events').createIndex(
      { 'feedback.clicked_jobs': 1 },
      { name: 'idx_clicked_jobs', sparse: true }
    );
    console.log('  ✅ Index: feedback.clicked_jobs (sparse)');
    
    await db.collection('feedback_events').createIndex(
      { 'feedback.saved_jobs': 1 },
      { name: 'idx_saved_jobs', sparse: true }
    );
    console.log('  ✅ Index: feedback.saved_jobs (sparse)');
    
    await db.collection('feedback_events').createIndex(
      { trace_id: 1 },
      { name: 'idx_trace_id' }
    );
    console.log('  ✅ Index: trace_id');
    
    // ============================================
    // 2. 创建 feedback_aggregates collection
    // ============================================
    console.log('\n📦 Creating feedback_aggregates collection...');
    
    try {
      await db.createCollection('feedback_aggregates');
      console.log('✅ feedback_aggregates collection created');
    } catch (err) {
      if (err.code === 48) {
        console.log('⚠️  feedback_aggregates already exists (skipped)');
      } else {
        throw err;
      }
    }
    
    // 创建索引
    console.log('📑 Creating indexes for feedback_aggregates...');
    
    await db.collection('feedback_aggregates').createIndex(
      { period: 1 },
      { unique: true, name: 'idx_period_unique' }
    );
    console.log('  ✅ Index: period (unique)');
    
    await db.collection('feedback_aggregates').createIndex(
      { generated_at: -1 },
      { name: 'idx_generated_at' }
    );
    console.log('  ✅ Index: generated_at');
    
    // ============================================
    // 3. 验证创建结果
    // ============================================
    console.log('\n🔍 Verifying collections...');
    
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    const hasFeedbackEvents = collectionNames.includes('feedback_events');
    const hasFeedbackAggregates = collectionNames.includes('feedback_aggregates');
    
    if (hasFeedbackEvents) {
      const eventsIndexes = await db.collection('feedback_events').indexes();
      console.log(`  ✅ feedback_events: ${eventsIndexes.length} indexes`);
    }
    
    if (hasFeedbackAggregates) {
      const aggregatesIndexes = await db.collection('feedback_aggregates').indexes();
      console.log(`  ✅ feedback_aggregates: ${aggregatesIndexes.length} indexes`);
    }
    
    // ============================================
    // 4. 插入测试文档（验证写入）
    // ============================================
    console.log('\n🧪 Inserting test document...');
    
    const testEvent = {
      event_id: 'test_' + Date.now(),
      session_id: 'test_session',
      tool: 'test_tool',
      timestamp: new Date(),
      input: { test: true },
      output: null,
      feedback: {},
      trace_id: 'test_trace',
      processed: false,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await db.collection('feedback_events').insertOne(testEvent);
    console.log('  ✅ Test document inserted');
    
    // 删除测试文档
    await db.collection('feedback_events').deleteOne({ event_id: testEvent.event_id });
    console.log('  ✅ Test document deleted');
    
    console.log('\n🎉 Feedback database initialization completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Database: ${dbName}`);
    console.log(`  - Collections: feedback_events, feedback_aggregates`);
    console.log(`  - Total Indexes: ${hasFeedbackEvents && hasFeedbackAggregates ? 'All created' : 'Partial'}`);
    console.log(`  - Status: Ready for use ✅`);
    
  } catch (error) {
    console.error('\n❌ Initialization failed:', error);
    console.error('Please check:');
    console.error('  1. MONGODB_URI is correctly set');
    console.error('  2. MongoDB server is running');
    console.error('  3. Database permissions are correct');
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// 运行初始化
initFeedbackDatabase();

