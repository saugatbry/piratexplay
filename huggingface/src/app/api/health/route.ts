import { NextResponse } from 'next/server';
import { readDataFile, getDataFreshenss, homeDataPath, popularDataPath } from '@/lib/data';
import { getCacheStats } from '@/lib/cache';
import { HomeResponse } from '@/types';

export async function GET() {
  const homeFresh = getDataFreshenss(homeDataPath());
  const popFresh = getDataFreshenss(popularDataPath());
  const homeData = readDataFile<HomeResponse>(homeDataPath());

  const totalCached = homeData?.sections?.reduce((sum, s) => sum + s.items.length, 0) || 0;

  return NextResponse.json({
    status: homeData?.sections?.length ? 'ready' : 'no-data',
    message: homeData?.sections?.length
      ? 'Pre-scraped data available. Run node scripts/refresh.mjs locally to refresh.'
      : 'No pre-scraped data. Run node scripts/refresh.mjs on a network with PirateXPlay access.',
    data: {
      home: homeFresh.exists
        ? { cached: true, age: homeFresh.age ? Math.round(homeFresh.age / 1000 / 60) + 'm' : 'unknown', totalItems: totalCached }
        : { cached: false },
      popular: popFresh.exists ? { cached: true } : { cached: false },
      cacheMemory: getCacheStats(),
    },
    instructions: {
      refresh: 'node scripts/refresh.mjs',
      deploy: 'Run refresh script locally first, then commit public/data/ and deploy.',
    },
  });
}
