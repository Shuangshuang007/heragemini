import { MongoClient } from 'mongodb';

// MongoDB连接配置 - 复用现有的配置
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'hera_profiles'; // 新的数据库名称
const COLLECTION_NAME = 'profiles';

let client: MongoClient | null = null;
let db: any = null;
let _mongoPromise: Promise<MongoClient> | null = null;

// Profile数据结构
export interface UserProfile {
  _id?: string; // MongoDB 文档的 ObjectId
  email: string;
  registeredEmail: string; // 新增：注册/登录时使用的邮箱
  firstName: string;
  lastName: string;
  jobTitle?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
  // 新增订阅字段
  subscription?: {
    plan: 'free' | 'daily' | 'weekly' | 'monthly';
    expiresAt: Date;
    active: boolean;
    stripeSessionId?: string;
    updatedAt: Date;
  };
  resumes?: {
    id: string;
    name: string;
    gridfsId?: string;
    downloadUrl?: string;
    pdfUrl?: string; // 保持向后兼容
    createdAt: Date;
  }[];
  originalResumes?: {
    id: string;
    name: string;
    pdfUrl: string;
    createdAt: Date;
  }[];
  jobSearches?: {
    id: string;
    jobTitle: string;
    location: string;
    timestamp: Date;
  }[];
  applications?: {
    jobId: string;
    jobSave?: {
      title: string;
      company: string;
    };
    resumeTailor?: {
      gridfsId: string;
      downloadUrl: string;
      filename?: string;
    };
    coverLetter?: {
      gridfsId: string;
      downloadUrl: string;
      filename?: string;
    };
    applicationStatus?: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
}

// 连接MongoDB
export async function connectToProfileDB() {
  const uri = MONGODB_URI;
  const dbName = DB_NAME;
  
  if (!_mongoPromise) {
    _mongoPromise = new MongoClient(uri).connect(); // 只建一次连接(Promise 可复用)
  }
  
  const client = await _mongoPromise;
  await client.db("admin").command({ ping: 1 }); // 确保连接已可用(极轻量),不想要也可删掉
  
  return { client, db: client.db(dbName) };
}

// 创建或更新用户Profile
export async function upsertUserProfile(profileData: Partial<UserProfile>): Promise<boolean> {
  try {
    const { db } = await connectToProfileDB();
    const collection = db.collection(COLLECTION_NAME);
    
    const now = new Date();
    
    // 检查是否是新用户（没有subscription字段）
    const existingProfile = await collection.findOne({ email: profileData.email }) as UserProfile | null;
    const isNewUser = !existingProfile || !existingProfile.subscription;
    
    // 如果是新用户，初始化subscription字段
    const subscriptionData = isNewUser ? {
      plan: 'free' as const,
      active: false,
      updatedAt: now
    } : undefined;
    
    const updateData = {
      ...profileData,
      updatedAt: now,
      createdAt: profileData.createdAt || now,
      // 如果是新用户，添加subscription字段
      ...(subscriptionData && { subscription: subscriptionData })
    };

    await collection.updateOne(
      { email: profileData.email },
      { $set: updateData },
      { upsert: true }
    );

    if (isNewUser) {
      console.log(`[ProfileDB] Profile ${profileData.email} created with subscription field initialized`);
    } else {
      console.log(`[ProfileDB] Profile ${profileData.email} updated successfully`);
    }
    
    return true;
  } catch (error) {
    console.error('[ProfileDB] Error upserting profile:', error);
    return false;
  }
}

// 获取用户Profile
export async function getUserProfile(email: string): Promise<UserProfile | null> {
  try {
    const { db } = await connectToProfileDB();
    const collection = db.collection(COLLECTION_NAME);
    
    const profile = await collection.findOne({ email });
    return profile as UserProfile | null;
  } catch (error) {
    console.error('[ProfileDB] Error getting profile:', error);
    return null;
  }
}

// 添加简历记录
export async function addResumeToProfile(email: string, resumeData: {
  id: string;
  name: string;
  pdfUrl?: string; // 保持向后兼容
  gridfsId?: string; // 新增GridFS ID字段
  downloadUrl?: string; // 新增下载URL字段
  type?: string; // 新增类型字段
}): Promise<boolean> {
  try {
    const { db } = await connectToProfileDB();
    const collection = db.collection(COLLECTION_NAME);
    
    const resumeRecord = {
      ...resumeData,
      type: resumeData.type || 'ProfileResume', // 默认为ProfileResume
      createdAt: new Date()
    };

    await collection.updateOne(
      { email },
      { 
        $push: { resumes: resumeRecord } as any,
        $set: { updatedAt: new Date() }
      }
    );

    console.log(`[ProfileDB] ${resumeRecord.type} added to profile ${email}`);
    return true;
  } catch (error) {
    console.error('[ProfileDB] Error adding resume to profile:', error);
    return false;
  }
}

// 添加上传的简历记录到originalResumes字段
export async function addOriginalResumeToProfile(email: string, resumeData: {
  id: string;
  name: string;
  pdfUrl: string;
}): Promise<boolean> {
  try {
    const { db } = await connectToProfileDB();
    const collection = db.collection(COLLECTION_NAME);
    
    const resumeRecord = {
      ...resumeData,
      type: 'OriginalResume',
      createdAt: new Date()
    };

    await collection.updateOne(
      { email },
      { 
        $push: { originalResumes: resumeRecord } as any,
        $set: { updatedAt: new Date() }
      }
    );

    console.log(`[ProfileDB] OriginalResume added to profile ${email}`);
    return true;
  } catch (error) {
    console.error('[ProfileDB] Error adding original resume to profile:', error);
    return false;
  }
}

// 添加Job Search记录到jobSearches字段
export async function addJobSearchToProfile(email: string, searchData: {
  jobTitle: string;
  location: string;
}): Promise<boolean> {
  try {
    const { db } = await connectToProfileDB();
    const collection = db.collection(COLLECTION_NAME);
    
    const searchRecord = {
      id: `search_${Date.now()}`,
      jobTitle: searchData.jobTitle,
      location: searchData.location,
      timestamp: new Date()
    };

    await collection.updateOne(
      { email },
      { 
        $push: { jobSearches: searchRecord } as any,
        $set: { updatedAt: new Date() }
      }
    );

    console.log(`[ProfileDB] Job search recorded for ${email}: ${searchData.jobTitle} in ${searchData.location}`);
    return true;
  } catch (error) {
    console.error('[ProfileDB] Error recording job search:', error);
    return false;
  }
}

// 添加或更新Job Application记录
export async function upsertJobApplication(email: string, jobId: string, updateData: {
  jobSave?: {
    title: string;
    company: string;
  };
  resumeTailor?: {
    gridfsId: string;
    downloadUrl: string;
    filename?: string;
  };
  coverLetter?: {
    gridfsId: string;
    downloadUrl: string;
    filename?: string;
  };
  applicationStatus?: string;
}): Promise<boolean> {
  try {
    const { db } = await connectToProfileDB();
    const collection = db.collection(COLLECTION_NAME);
    
    const now = new Date();
    
    // 检查是否已存在该Job的Application记录
    const existingProfile = await collection.findOne({ 
      email, 
      'applications.jobId': jobId 
    }) as UserProfile | null;
    
    if (existingProfile) {
      // 更新现有记录 - 只更新提供的字段，不覆盖为undefined
      const updateFields: any = {
        'applications.$.updatedAt': now,
        updatedAt: now
      };
      
      // 只添加有值的字段
      if (updateData.jobSave !== undefined) updateFields['applications.$.jobSave'] = updateData.jobSave;
      if (updateData.resumeTailor !== undefined) updateFields['applications.$.resumeTailor'] = updateData.resumeTailor;
      if (updateData.coverLetter !== undefined) updateFields['applications.$.coverLetter'] = updateData.coverLetter;
      if (updateData.applicationStatus !== undefined) updateFields['applications.$.applicationStatus'] = updateData.applicationStatus;
      
      await collection.updateOne(
        { 
          email, 
          'applications.jobId': jobId 
        },
        { 
          $set: updateFields
        }
      );
    } else {
      // 创建新记录
      const newApplication = {
        jobId,
        jobSave: updateData.jobSave,
        resumeTailor: updateData.resumeTailor,
        coverLetter: updateData.coverLetter,
        applicationStatus: updateData.applicationStatus,
        createdAt: now,
        updatedAt: now
      };
      
              await collection.updateOne(
        { email },
        { 
          $push: { applications: newApplication } as any,
          $set: { updatedAt: now }
        }
      );
    }

    console.log(`[ProfileDB] Job application updated for ${email}, jobId: ${jobId}`);
    return true;
  } catch (error) {
    console.error('[ProfileDB] Error updating job application:', error);
    return false;
  }
}

// 新增订阅相关函数

// 更新用户订阅状态
export async function updateUserSubscription(
  email: string, 
  subscriptionData: Partial<UserProfile['subscription']> | undefined
): Promise<boolean> {
  try {
    if (!subscriptionData) {
      console.error('[ProfileDB] subscriptionData is undefined');
      return false;
    }

    const { db } = await connectToProfileDB();
    const collection = db.collection(COLLECTION_NAME);
    
    const updateData: any = {
      updatedAt: new Date()
    };

    // 只添加有值的字段
    if (subscriptionData.plan !== undefined) updateData['subscription.plan'] = subscriptionData.plan;
    if (subscriptionData.expiresAt !== undefined) updateData['subscription.expiresAt'] = subscriptionData.expiresAt;
    if (subscriptionData.active !== undefined) updateData['subscription.active'] = subscriptionData.active;
    if (subscriptionData.stripeSessionId !== undefined) updateData['subscription.stripeSessionId'] = subscriptionData.stripeSessionId;
    updateData['subscription.updatedAt'] = new Date();

    await collection.updateOne(
      { 
        $or: [
          { email: email },
          { registeredEmail: email }
        ]
      },
      { $set: updateData }
    );

    console.log(`[ProfileDB] Subscription updated for ${email}`);
    return true;
  } catch (error) {
    console.error('[ProfileDB] Error updating subscription:', error);
    return false;
  }
}

// 获取用户订阅状态
export async function getUserSubscriptionStatus(email: string): Promise<{
  isPremiumToday: boolean;
  plan: string;
  expiresAt?: Date;
}> {
  try {
    const { db } = await connectToProfileDB();
    
    // 验证db对象
    if (!db) {
      console.error('[ProfileDB] Database connection is null');
      return { isPremiumToday: false, plan: 'free' };
    }
    
    const collection = db.collection(COLLECTION_NAME);
    
    // 同时查询 email 和 registeredEmail 字段
    const profile = await collection.findOne({ 
      $or: [
        { email: email },
        { registeredEmail: email }
      ]
    }) as UserProfile | null;
    
    console.log('[ProfileDB] Profile found:', {
      email,
      hasSubscription: !!profile?.subscription,
      subscription: profile?.subscription,
      profileEmail: profile?.email,
      profileRegisteredEmail: profile?.registeredEmail
    });
    
    if (!profile?.subscription?.active || !profile.subscription.expiresAt) {
      console.log('[ProfileDB] No active subscription or missing expiresAt');
      return { isPremiumToday: false, plan: 'free' };
    }

    // 简化的Premium状态检查 - 使用UTC时间比较
    const nowUTC = new Date(); // 当前UTC时间
    
    // 订阅过期时间 (MongoDB中已经是UTC时间)
    const expiresAt = new Date(profile.subscription.expiresAt);
    
    // 如果过期时间在当前UTC时间之后，就是Premium
    const isPremiumToday = expiresAt > nowUTC;
    
    console.log('[ProfileDB] Premium calculation:', {
      nowUTC: nowUTC.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isPremiumToday
    });

    return {
      isPremiumToday,
      plan: profile.subscription.plan,
      expiresAt: expiresAt
    };
  } catch (error) {
    console.error('[ProfileDB] Error getting subscription status:', error);
    return { isPremiumToday: false, plan: 'free' };
  }
}

// 关闭MongoDB连接
export async function closeProfileDBConnection() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

// 清理MongoDB连接
process.on('SIGINT', async () => {
  await closeProfileDBConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeProfileDBConnection();
  process.exit(0);
});

