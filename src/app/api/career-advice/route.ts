import { NextRequest, NextResponse } from "next/server";

// Ensure CAREER_SWITCH_API_URL is set in your environment variables
const BASE_CAREER_API_URL = process.env.CAREER_SWITCH_API_URL; // This should be your Vultr API URL

if (!BASE_CAREER_API_URL) {
  console.error("CAREER_SWITCH_API_URL environment variable is not set.");
}

async function proxyRequest(url: string, init?: RequestInit) {
  try {
    const response = await fetch(url, { ...init, cache: "no-store" }); // Disable caching
    const responseText = await response.text();

    try {
      // Attempt to parse as JSON, if successful, return JSON response
      return NextResponse.json(JSON.parse(responseText), { status: response.status });
    } catch (parseError) {
      // If not JSON, return as plain text
      return new NextResponse(responseText, { status: response.status });
    }
  } catch (error: any) {
    console.error(`[Vercel Proxy] Error forwarding request to ${url}:`, error);
    return new NextResponse(`Error forwarding request: ${error.message}`, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const traceId = req.headers.get("x-trace-id") ?? "no-trace";
  const bodyText = await req.text();

  console.info("[Vercel Proxy] /api/career-advice POST", { 
    traceId, 
    bodyText: bodyText.substring(0, 200) + (bodyText.length > 200 ? "..." : "") 
  });

  if (!BASE_CAREER_API_URL) {
    return new NextResponse("Career Switch API URL is not configured on Vercel.", { status: 500 });
  }

  return proxyRequest(`${BASE_CAREER_API_URL}/api/career/advice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-trace-id": traceId // Forward trace ID to Vultr
    },
    body: bodyText // Forward the original body from MCP
  });
}




