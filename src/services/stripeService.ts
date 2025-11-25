import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil' as any,
});

// Price Key配置 - 请将这里的price key替换为你实际的price key
const PRICE_KEYS = {
  daily: process.env.STRIPE_DAILY_PRICE_KEY || 'price_your_daily_price_key_here',
  weekly: process.env.STRIPE_WEEKLY_PRICE_KEY || 'price_your_weekly_price_key_here',
  monthly: process.env.STRIPE_MONTHLY_PRICE_KEY || 'price_your_monthly_price_key_here'
};

export interface CreateCheckoutSessionParams {
  email: string;
  plan: 'daily' | 'weekly' | 'monthly';
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession({
  email,
  plan,
  successUrl,
  cancelUrl
}: CreateCheckoutSessionParams) {
  try {
    const priceKey = PRICE_KEYS[plan];
    
    if (!priceKey || priceKey.includes('price_your_')) {
      throw new Error(`Price key not configured for plan: ${plan}`);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceKey, // 使用price key而不是动态创建价格
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email,
      metadata: {
        plan,
        email,
        expiresAt: getExpiryDate(plan)
      },
      // 添加澳大利亚特定的设置
      locale: 'en', // 改为'en'，Stripe不支持'en-AU'格式
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic',
        },
      },
    });

    return session;
  } catch (error) {
    console.error('[Stripe] Error creating checkout session:', error);
    throw error;
  }
}

// 计算订阅过期时间（澳大利亚时间）
function getExpiryDate(plan: 'daily' | 'weekly' | 'monthly'): string {
  const now = new Date();
  let expiryDate: Date;

  switch (plan) {
    case 'daily':
      // 第二天23:59:59 AEST（24小时有效期）
      expiryDate = new Date(now);
      expiryDate.setDate(now.getDate() + 1);
      expiryDate.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      // 8天后23:59:59 AEST（7天+1天，保持一致性）
      expiryDate = new Date(now);
      expiryDate.setDate(now.getDate() + 8);
      expiryDate.setHours(23, 59, 59, 999);
      break;
    case 'monthly':
      // 31天后23:59:59 AEST（30天+1天，保持一致性）
      expiryDate = new Date(now);
      expiryDate.setDate(now.getDate() + 31);
      expiryDate.setHours(23, 59, 59, 999);
      break;
  }

  return expiryDate.toISOString();
}

export async function constructWebhookEvent(payload: string, signature: string) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
