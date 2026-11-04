import { existsSync } from 'node:fs';

// astro.config.mjs runs before Astro loads .env, so read it here; variables already set in the environment win.
const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const API_HOST = process.env.DP_API_HOST || 'router.deeppattern.ai';
export const CONSOLE_URL = process.env.DP_CONSOLE_URL || `https://${API_HOST}`;

const basePath = (process.env.DP_DOCS_BASE || '').replace(/^\/+|\/+$/g, '');
export const DOCS_BASE = basePath ? `/${basePath}` : '';

export const fillPlaceholders = (text) => text.replaceAll('{{API_HOST}}', API_HOST);
