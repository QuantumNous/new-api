import type { LogLevel } from '../types';

export const LOG_LEVEL = { silent: -1, error: 0, warn: 1, info: 2 } as const;
export const logger = {
  level: 'info' as LogLevel,
  info(...messages: unknown[]): void {
    if (LOG_LEVEL.info > LOG_LEVEL[logger.level]) return;
    console.info(...messages);
  },
  warn(...messages: unknown[]): void {
    if (LOG_LEVEL.warn > LOG_LEVEL[logger.level]) return;
    console.warn(...messages);
  },
  error(...messages: unknown[]): void {
    if (LOG_LEVEL.error > LOG_LEVEL[logger.level]) return;
    console.error(...messages);
  },
};
