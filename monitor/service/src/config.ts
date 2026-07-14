import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(43100),
  MONITOR_BASE_PATH: z.string().default(''),
  API_PREFIX: z.string().default('/api'),
  CORS_ORIGIN: z.string().default('*'),
  MONITOR_API_TOKEN: z.string().optional(),
  GEETEST_CAPTCHA_ID: z.string().optional(),
  GEETEST_CAPTCHA_KEY: z.string().optional(),
  NEWAPI_DB_HOST: z.string().min(1, 'NEWAPI_DB_HOST is required'),
  NEWAPI_DB_PORT: z.coerce.number().int().positive().default(54330),
  NEWAPI_DB_USER: z.string().min(1, 'NEWAPI_DB_USER is required'),
  NEWAPI_DB_PASSWORD: z.string().min(1, 'NEWAPI_DB_PASSWORD is required'),
  NEWAPI_DB_NAME: z.string().min(1, 'NEWAPI_DB_NAME is required'),
  NEWAPI_DB_SSL: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  NEWAPI_URL: z.string().url().optional(),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(900),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const rawEnv = parsed.data;

function normalizeBasePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

const apiPrefix = rawEnv.API_PREFIX.startsWith('/') ? rawEnv.API_PREFIX : `/${rawEnv.API_PREFIX}`;
const basePath = normalizeBasePath(rawEnv.MONITOR_BASE_PATH);

export const config = {
  port: rawEnv.PORT,
  basePath,
  apiPrefix,
  corsOrigin: rawEnv.CORS_ORIGIN,
  monitorApiToken: rawEnv.MONITOR_API_TOKEN?.trim() || '',
  geetestCaptchaId: rawEnv.GEETEST_CAPTCHA_ID?.trim() || '',
  geetestCaptchaKey: rawEnv.GEETEST_CAPTCHA_KEY?.trim() || '',
  cacheTtlSeconds: rawEnv.CACHE_TTL_SECONDS,
  newapiUrl: rawEnv.NEWAPI_URL?.replace(/\/+$/, '') || '',
  database: {
    host: rawEnv.NEWAPI_DB_HOST,
    port: rawEnv.NEWAPI_DB_PORT,
    user: rawEnv.NEWAPI_DB_USER,
    password: rawEnv.NEWAPI_DB_PASSWORD,
    database: rawEnv.NEWAPI_DB_NAME,
    ssl: rawEnv.NEWAPI_DB_SSL,
  },
} as const;
