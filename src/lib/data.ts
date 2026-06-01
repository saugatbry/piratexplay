import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(process.cwd(), 'public', 'data');

export function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readDataFile<T>(filename: string): T | null {
  const filePath = join(DATA_DIR, filename);
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeDataFile<T>(filename: string, data: T): void {
  ensureDataDir();
  const filePath = join(DATA_DIR, filename);
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function getDataFreshenss(filename: string): { exists: boolean; age?: number; fetchedAt?: string } {
  const data = readDataFile<{ fetchedAt?: string }>(filename);
  if (!data?.fetchedAt) return { exists: false };
  const age = Date.now() - new Date(data.fetchedAt).getTime();
  return { exists: true, age, fetchedAt: data.fetchedAt };
}

export function homeDataPath(): string { return 'home.json'; }
export function searchDataPath(query: string): string {
  return `search-${query.replace(/\s+/g, '-').toLowerCase()}.json`;
}
export function infoDataPath(slug: string): string {
  return `info-${slug}.json`;
}
export function popularDataPath(): string { return 'popular.json'; }
