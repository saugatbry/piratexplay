import { NextResponse } from 'next/server';
import { getRecentLogs } from '@/lib/logger';
import { getCacheSize } from '@/lib/cache';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  return NextResponse.json({
    logs: getRecentLogs(limit),
    cacheSize: getCacheSize(),
  });
}
