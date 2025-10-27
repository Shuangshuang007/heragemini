export const runtime = 'nodejs';
import { saveUserJob } from '../../../lib/db';

/**
 * @param {Request} req
 * @returns {Promise<Response>}
 */
export async function POST(req) {
  const { userId, jobId, status } = await req.json();
  try {
    await saveUserJob(userId, jobId, status || 'saved');
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
  }
} 