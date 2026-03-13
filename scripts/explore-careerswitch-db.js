// ============================================
// Explore CareerSwitch MongoDB Database
// ============================================
// 探索 CareerSwitch 数据库的结构和数据维度

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'CareerSwitch'; // CareerSwitch 数据库名称

async function exploreCareerSwitchDB() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(DB_NAME);
    
    // 1. 列出所有集合
    console.log('📋 Collections in CareerSwitch database:');
    const collections = await db.listCollections().toArray();
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    console.log('');
    
    // 2. 探索每个集合的结构
    for (const col of collections) {
      const collection = db.collection(col.name);
      const count = await collection.countDocuments();
      
      console.log(`\n📊 Collection: ${col.name}`);
      console.log(`   Document count: ${count}`);
      
      if (count > 0) {
        // 获取一个示例文档
        const sample = await collection.findOne({});
        if (sample) {
          console.log(`   Sample document keys:`, Object.keys(sample));
          console.log(`   Sample document structure:`);
          console.log(JSON.stringify(sample, null, 2).substring(0, 500) + '...');
        }
        
        // 如果是职业相关集合，尝试获取更多信息
        if (col.name.toLowerCase().includes('career') || 
            col.name.toLowerCase().includes('job') ||
            col.name.toLowerCase().includes('transition')) {
          console.log(`\n   🔍 Analyzing ${col.name}...`);
          
          // 尝试获取一些统计信息
          const pipeline = [
            { $limit: 10 },
            { $project: { _id: 0, keys: { $objectToArray: "$$ROOT" } } },
            { $unwind: "$keys" },
            { $group: { _id: "$keys.k", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
          ];
          
          try {
            const keyStats = await collection.aggregate(pipeline).toArray();
            console.log(`   Top 20 fields:`);
            keyStats.forEach(stat => {
              console.log(`     - ${stat._id}: ${stat.count} documents`);
            });
          } catch (e) {
            console.log(`   Could not analyze structure: ${e.message}`);
          }
        }
      }
    }
    
    // 3. 查找可能的职业转换相关集合
    console.log('\n\n🔍 Looking for career transition related collections...');
    const careerCollections = collections.filter(col => 
      col.name.toLowerCase().includes('career') ||
      col.name.toLowerCase().includes('transition') ||
      col.name.toLowerCase().includes('path') ||
      col.name.toLowerCase().includes('skill') ||
      col.name.toLowerCase().includes('job')
    );
    
    if (careerCollections.length > 0) {
      console.log('Found potential career-related collections:');
      careerCollections.forEach(col => {
        console.log(`  - ${col.name}`);
      });
    } else {
      console.log('No obvious career-related collections found.');
      console.log('All collections:', collections.map(c => c.name).join(', '));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

// 运行
exploreCareerSwitchDB().catch(console.error);

