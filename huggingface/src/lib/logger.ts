const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LEVELS[LOG_LEVEL as LogLevel] ?? LEVELS.info;

interface FetchLogEntry {
  url: string;
  strategy: string;
  status: number;
  timeMs: number;
  htmlLength: number;
  cloudflareDetected: boolean;
  success: boolean;
  error?: string;
}

const recentLogs: FetchLogEntry[] = [];
const MAX_LOG_ENTRIES = 200;

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (LEVELS[level] < currentLevel) return;
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  if (data) {
    console.log(`${prefix} ${message}`, JSON.stringify(data));
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export function logFetch(entry: FetchLogEntry): void {
  log('info', `[FETCH] ${entry.strategy} ${entry.url}`, {
    status: entry.status,
    timeMs: entry.timeMs,
    htmlLength: entry.htmlLength,
    cloudflare: entry.cloudflareDetected,
    success: entry.success,
  });
  recentLogs.unshift(entry);
  if (recentLogs.length > MAX_LOG_ENTRIES) recentLogs.pop();
}

export function debug(message: string, data?: Record<string, unknown>): void {
  log('debug', message, data);
}

export function info(message: string, data?: Record<string, unknown>): void {
  log('info', message, data);
}

export function warn(message: string, data?: Record<string, unknown>): void {
  log('warn', message, data);
}

export function error(message: string, data?: Record<string, unknown>): void {
  log('error', message, data);
}

export function getRecentLogs(limit = 50): FetchLogEntry[] {
  return recentLogs.slice(0, limit);
}
