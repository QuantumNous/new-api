import { Pool, QueryResultRow } from 'pg';
import { config } from './config.js';

export class DatabaseClient {
  private readonly maxRetryAttempts = 2;
  private readonly pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30_000,
    application_name: 'newapi-monitor-service',
    options: '-c default_transaction_read_only=on',
  });

  constructor() {
    this.pool.on('error', (error) => {
      console.error('[database] Unexpected idle client error:', error);
    });
  }

  async query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    for (let attempt = 0; attempt <= this.maxRetryAttempts; attempt += 1) {
      try {
        const result = await this.pool.query<T>(sql, params);
        return result.rows;
      } catch (error) {
        const shouldRetry = attempt < this.maxRetryAttempts && this.isRetryableError(error);
        if (!shouldRetry) {
          throw error;
        }

        const delayMs = 200 * (attempt + 1);
        console.warn(`[database] Query failed, retrying in ${delayMs}ms (attempt ${attempt + 1}/${this.maxRetryAttempts})`);
        await this.delay(delayMs);
      }
    }

    throw new Error('Database query retry loop exited unexpectedly');
  }

  async healthcheck(): Promise<void> {
    await this.query('SELECT 1');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const errorCode = 'code' in error && typeof error.code === 'string' ? error.code : '';
    if (['57P01', '57P02', '57P03', '08000', '08001', '08003', '08006'].includes(errorCode)) {
      return true;
    }

    const message = error.message.toLowerCase();
    return message.includes('connection terminated')
      || message.includes('connection reset')
      || message.includes('terminating connection')
      || message.includes('the database system is starting up')
      || message.includes('timeout expired')
      || message.includes('econnreset')
      || message.includes('econnrefused');
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
