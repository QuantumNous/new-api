import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { z } from 'zod';
import { hasValidMonitorApiToken, requireApiToken } from './auth.js';
import { CacheClient } from './cache.js';
import { config } from './config.js';
import { DatabaseClient } from './database.js';
import { NewApiMonitorService } from './newapi-monitor.service.js';
import {
  buildSearchTarget,
  createSearchAccessToken,
  hasSearchAccessToken,
  isSearchVerificationEnabled,
  revokeSearchAccessToken,
  verifyGeetestCaptcha,
} from './search-verification.js';

const database = new DatabaseClient();
const cache = new CacheClient();
const monitorService = new NewApiMonitorService(database, cache);
const hoursRangeSchema = z.union([z.literal('all'), z.coerce.number().int().positive().max(24 * 365)]);

const queryLogsSchema = z.object({
  model_name: z.string().min(1, 'model_name is required'),
  hours: hoursRangeSchema.optional(),
  p: z.coerce.number().int().positive().optional(),
  page_size: z.coerce.number().int().positive().optional(),
  type: z.coerce.number().int().optional(),
  username: z.string().optional(),
  token_name: z.string().optional(),
  channel: z.string().optional(),
  group: z.string().optional(),
});

const modelListSchema = z.object({
  hours: hoursRangeSchema.optional(),
});

const dashboardSchema = z.object({
  hours: hoursRangeSchema.optional(),
});

const keyQuotaSchema = z.object({
  key: z.string().min(1, 'key is required'),
  hours: hoursRangeSchema.optional(),
});

const channelRecordsSchema = z.object({
  channel_id: z.coerce.number().int().positive(),
  hours: hoursRangeSchema.optional(),
});
const geetestPayloadSchema = z.object({
  lot_number: z.string().min(1, 'lot_number is required'),
  captcha_output: z.string().min(1, 'captcha_output is required'),
  pass_token: z.string().min(1, 'pass_token is required'),
  gen_time: z.string().min(1, 'gen_time is required'),
});
const revokeSearchTokenSchema = z.object({
  search_token: z.string().min(1, 'search_token is required'),
});
const publicDir = path.resolve(process.cwd(), 'public');
const dashboardPath = config.basePath || '/';
const dashboardPathWithTrailingSlash = config.basePath ? `${config.basePath}/` : '/';
const staticPath = config.basePath ? `${config.basePath}/static` : '/static';
const apiPath = `${config.basePath}${config.apiPrefix}`;

function getSearchTargetFromRequest(request: express.Request): string | null {
  if (request.path.endsWith('/key/quota')) {
    const key = typeof request.query.key === 'string' ? request.query.key.trim() : '';
    return key ? buildSearchTarget('key', key) : null;
  }

  if (request.path.endsWith('/channel/records')) {
    const channelId = typeof request.query.channel_id === 'string'
      ? request.query.channel_id.trim()
      : Array.isArray(request.query.channel_id)
        ? String(request.query.channel_id[0] || '').trim()
        : '';
    return channelId ? buildSearchTarget('channel', channelId) : null;
  }

  // User search support
  if (request.path.endsWith('/user/quota')) {
    const username = typeof request.query.username === 'string' ? request.query.username.trim() : '';
    return username ? buildSearchTarget('user', username) : null;
  }

  return null;
}

async function bootstrap(): Promise<void> {
  await cache.connect();

  const app = express();
  app.use(express.json());
  app.use(staticPath, express.static(publicDir));
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin,
      credentials: true,
    }),
  );

  if (config.basePath) {
    app.get('/', (_request, response) => {
      response.redirect(dashboardPath);
    });
  }

  app.get(dashboardPath, (_request, response) => {
    response.sendFile(path.join(publicDir, 'dashboard.html'));
  });

  if (dashboardPathWithTrailingSlash !== dashboardPath) {
    app.get(dashboardPathWithTrailingSlash, (_request, response) => {
      response.sendFile(path.join(publicDir, 'dashboard.html'));
    });
  }

  app.get('/dashboard.html', (_request, response) => {
    response.sendFile(path.join(publicDir, 'dashboard.html'));
  });

  app.get(`${apiPath}/health`, async (_request, response) => {
    const status = await monitorService.checkConfig();
    response.json({
      status: status.configured ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      cache: 'memory',
      database: status.configured ? 'connected' : 'error',
      message: status.message,
    });
  });

  app.get(`${apiPath}/config`, async (_request, response, next) => {
    if (!config.newapiUrl) {
      response.json({
        data: {
          cacheTtlSeconds: config.cacheTtlSeconds,
          geetestCaptchaId: config.geetestCaptchaId || '',
          searchVerificationEnabled: isSearchVerificationEnabled(),
        },
        message: 'NEWAPI_URL not configured',
      });
      return;
    }

    try {
      const upstream = await fetch(`${config.newapiUrl}/api/status`);
      const payload = await upstream.json() as { data?: Record<string, unknown> };
      const raw = payload?.data || {};

      response.json({
        data: {
          logo: raw.logo || '',
          systemName: raw.system_name || '',
          docsLink: raw.docs_link || '',
          serverAddress: raw.server_address || config.newapiUrl,
          version: raw.version || '',
          quotaPerUnit: raw.quota_per_unit || 500000,
          startTime: raw.start_time || null,
          cacheTtlSeconds: config.cacheTtlSeconds,
          geetestCaptchaId: config.geetestCaptchaId || '',
          searchVerificationEnabled: isSearchVerificationEnabled(),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post(`${apiPath}/search/access/revoke`, async (request, response, next) => {
    try {
      const { search_token } = revokeSearchTokenSchema.parse(request.body);
      await revokeSearchAccessToken(cache, search_token);
      response.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.use(apiPath, requireApiToken);

  const requireSearchVerification: express.RequestHandler = async (request, response, next) => {
    try {
      const searchTarget = getSearchTargetFromRequest(request);
      if (!searchTarget) {
        response.status(400).json({
          message: 'Invalid search target',
        });
        return;
      }

      if (hasValidMonitorApiToken(request)) {
        next();
        return;
      }

      const searchToken = typeof request.query.search_token === 'string'
        ? request.query.search_token.trim()
        : '';

      if (searchToken && await hasSearchAccessToken(cache, searchToken, searchTarget)) {
        next();
        return;
      }

      if (!isSearchVerificationEnabled() && !config.monitorApiToken) {
        // No auth configured, allow all searches
        next();
        return;
      }

      if (!isSearchVerificationEnabled()) {
        response.status(403).json({
          code: 'SEARCH_VERIFICATION_REQUIRED',
          message: 'Search verification is not configured',
        });
        return;
      }

      const parsed = geetestPayloadSchema.safeParse(request.query);
      if (!parsed.success) {
        response.status(403).json({
          code: 'SEARCH_CAPTCHA_REQUIRED',
          message: 'Captcha verification required',
        });
        return;
      }

      const verification = await verifyGeetestCaptcha({
        lotNumber: parsed.data.lot_number,
        captchaOutput: parsed.data.captcha_output,
        passToken: parsed.data.pass_token,
        genTime: parsed.data.gen_time,
      });

      if (!verification.success) {
        response.status(403).json({
          code: 'SEARCH_CAPTCHA_INVALID',
          message: verification.reason || 'Captcha verification failed',
        });
        return;
      }

      response.locals.searchAccessToken = await createSearchAccessToken(cache, searchTarget);
      response.locals.searchTarget = searchTarget;
      next();
    } catch (error) {
      next(error);
    }
  };

  app.get(`${apiPath}/logs/models`, async (request, response, next) => {
    try {
      const { hours = 24 } = modelListSchema.parse(request.query);
      const result = await monitorService.getModelList(hours);
      response.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  app.get(`${apiPath}/dashboard`, async (request, response, next) => {
    try {
      const { hours = 24 } = dashboardSchema.parse(request.query);
      const result = await monitorService.getDashboard(hours);
      response.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  app.get(`${apiPath}/key/quota`, requireSearchVerification, async (request, response, next) => {
    try {
      const { key, hours = 24 } = keyQuotaSchema.parse(request.query);
      const result = await monitorService.getKeyQuota(key, hours);

      if (!result) {
        response.status(404).json({
          message: 'Key not found',
        });
        return;
      }

      response.json({
        data: result,
        ...(response.locals.searchAccessToken ? {
          search_token: response.locals.searchAccessToken,
          search_target: response.locals.searchTarget,
        } : {}),
      });
    } catch (error) {
      next(error);
    }
  });

  // User search by username
  app.get(`${apiPath}/user/quota`, requireSearchVerification, async (request, response, next) => {
    try {
      const username = String(request.query.username || '').trim();
      const hours = request.query.hours ? hoursRangeSchema.parse(request.query.hours) : 24;
      const start = request.query.start ? Number(request.query.start) : undefined;
      const end = request.query.end ? Number(request.query.end) : undefined;
      if (!username) {
        response.status(400).json({ message: 'username is required' });
        return;
      }
      const timeOpts = (start && end) ? { start, end } : undefined;
      const result = await monitorService.getUserQuota(username, hours, timeOpts);
      if (!result) {
        response.status(404).json({ message: 'User not found' });
        return;
      }
      response.json({
        data: result,
        ...(response.locals.searchAccessToken ? {
          search_token: response.locals.searchAccessToken,
          search_target: response.locals.searchTarget,
        } : {}),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get(`${apiPath}/channel/records`, requireSearchVerification, async (request, response, next) => {
    try {
      const { channel_id, hours = 24 } = channelRecordsSchema.parse(request.query);
      const result = await monitorService.getChannelRecords(channel_id, hours);

      if (!result) {
        response.status(404).json({
          message: 'Channel not found',
        });
        return;
      }

      response.json({
        data: result,
        ...(response.locals.searchAccessToken ? {
          search_token: response.locals.searchAccessToken,
          search_target: response.locals.searchTarget,
        } : {}),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get(`${apiPath}/logs`, async (request, response, next) => {
    try {
      const params = queryLogsSchema.parse(request.query);
      const result = await monitorService.queryLogs({
        modelName: params.model_name,
        hours: params.hours ?? 24,
      });

      response.json({
        data: result,
        message: '查询成功',
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        message: 'Invalid query parameters',
        errors: error.flatten().fieldErrors,
      });
      return;
    }

    console.error('[server] Unhandled error:', error);
    response.status(500).json({
      message: 'Internal server error',
    });
  });

  const server = app.listen(config.port, () => {
    console.log(`[server] Dashboard: http://localhost:${config.port}${dashboardPath}`);
    console.log(`[server] API: http://localhost:${config.port}${apiPath}`);
  });

  const shutdown = async () => {
    server.close();
    await cache.disconnect();
    await database.close();
  };

  process.on('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });
}

bootstrap().catch((error) => {
  console.error('[bootstrap] Failed to start service:', error);
  process.exit(1);
});
