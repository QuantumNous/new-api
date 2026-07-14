import express from 'express';
import path from 'path';
import { config } from './config';
import { query } from './database';
import { UNSUPPORTED_TEST_CHANNEL_TYPES } from './types';

const app = express();
app.use(express.static(path.join(__dirname, '../public')));

// Channel type name mapping
const CHANNEL_TYPE_NAMES: Record<number, string> = {
  1: 'OpenAI', 2: 'Midjourney', 3: 'Azure', 5: 'MidjourneyPlus',
  14: 'Anthropic', 15: 'Baidu', 17: 'Ali', 18: 'Xunfei',
  19: 'AI360', 23: 'Tencent', 24: 'Google PaLM', 25: 'Moonshot',
  26: 'Zhipu', 27: 'Lingyiwanwu', 28: 'AWS', 29: 'Coze',
  30: 'Cohere', 31: 'DeepL', 33: 'Ollama', 34: 'Groq',
  35: 'Cloudflare', 36: 'SunoAPI', 37: 'Together', 38: 'Novita',
  39: 'VertexAI', 40: 'SiliconFlow', 41: 'VertexAI', 42: 'xAI',
  43: 'DeepSeek', 44: 'Jimeng', 45: 'VolcEngine', 46: 'Minimax',
  47: 'Xinference', 48: 'AIProxyHF', 49: 'Mistral', 50: 'Kling',
  51: 'Jimeng', 52: 'Vidu', 53: 'StabilityAI', 54: 'DoubaoVideo',
  55: 'Codex',
};

// Status constants matching New API
const STATUS_ENABLED = 1;
const STATUS_MANUALLY_DISABLED = 2;
const STATUS_AUTO_DISABLED = 3;

app.get('/api/overview', async (_req, res) => {
  try {
    const channels = await query(
      'SELECT id, type, status, response_time FROM channels WHERE status != $1',
      [STATUS_MANUALLY_DISABLED]
    );
    const availableModels = await query(
      `SELECT DISTINCT a.model FROM abilities a
       JOIN channels c ON c.id = a.channel_id
       WHERE a.enabled = true
         AND c.status != ${STATUS_MANUALLY_DISABLED}
         AND c.type NOT IN (${UNSUPPORTED_TEST_CHANNEL_TYPES.join(',')})`
    );
    const allModels = await query(
      `SELECT DISTINCT a.model FROM abilities a
       JOIN channels c ON c.id = a.channel_id
       WHERE c.status != ${STATUS_MANUALLY_DISABLED}
         AND c.type NOT IN (${UNSUPPORTED_TEST_CHANNEL_TYPES.join(',')})`
    );

    let totalResponseTime = 0;
    let testableCount = 0;
    let operational = 0;
    let failed = 0;

    for (const ch of channels) {
      const chType = parseInt(ch.type, 10);
      if (UNSUPPORTED_TEST_CHANNEL_TYPES.includes(chType)) continue;
      const chStatus = parseInt(ch.status, 10);
      if (chStatus === STATUS_ENABLED) {
        operational++;
        totalResponseTime += parseInt(ch.response_time, 10) || 0;
        testableCount++;
      } else {
        failed++;
        testableCount++;
      }
    }

    res.json({
      total_channels: operational + failed,
      operational_channels: operational,
      failed_channels: failed,
      total_models: availableModels.length,
      unavailable_models: Math.max(0, allModels.length - availableModels.length),
      avg_response_time: testableCount > 0 ? Math.round(totalResponseTime / testableCount) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/channels', async (_req, res) => {
  try {
    const channels = await query(
      'SELECT id, name, type, status, response_time, test_time, models FROM channels ORDER BY id'
    );

    const result = channels
      .filter((ch: any) =>
        !UNSUPPORTED_TEST_CHANNEL_TYPES.includes(parseInt(ch.type, 10)) &&
        parseInt(ch.status, 10) !== STATUS_MANUALLY_DISABLED
      )
      .map((ch: any) => {
      const chType = parseInt(ch.type, 10);
      return {
        id: parseInt(ch.id, 10),
        name: ch.name,
        type: chType,
        type_name: CHANNEL_TYPE_NAMES[chType] || `Type ${chType}`,
        status: parseInt(ch.status, 10),
        response_time: parseInt(ch.response_time, 10) || 0,
        test_time: parseInt(ch.test_time, 10) || 0,
        models: ch.models ? ch.models.split(',').map((m: string) => m.trim()).filter(Boolean) : [],
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/models', async (_req, res) => {
  try {
    const rows = await query(`
      SELECT a.model, a.channel_id, a.enabled, c.name AS channel_name, c.status AS channel_status, c.type AS channel_type
      FROM abilities a
      JOIN channels c ON c.id = a.channel_id
      WHERE a."group" = 'default'
        AND c.status != ${STATUS_MANUALLY_DISABLED}
        AND c.type NOT IN (${UNSUPPORTED_TEST_CHANNEL_TYPES.join(',')})
      ORDER BY a.model, a.channel_id
    `);

    const modelMap = new Map<string, {
      model: string;
      channels: { id: number; name: string; status: number; enabled: boolean }[];
    }>();

    for (const row of rows) {
      if (!modelMap.has(row.model)) {
        modelMap.set(row.model, { model: row.model, channels: [] });
      }
      modelMap.get(row.model)!.channels.push({
        id: parseInt(row.channel_id, 10),
        name: row.channel_name,
        status: parseInt(row.channel_status, 10),
        enabled: row.enabled,
      });
    }

    const result = Array.from(modelMap.values()).map((m) => ({
      model: m.model,
      channels: m.channels,
      available_count: m.channels.filter((c) => c.enabled && c.status === STATUS_ENABLED).length,
      total_count: m.channels.length,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// 注: 统计数据包含测试请求(不再过滤 token_name='模型测试' 等),
// 与 newapi-monitor 的口径分离 — 此面板反映完整的请求/响应数据。
// 此外排除手动禁用的通道(channel.status = STATUS_MANUALLY_DISABLED)。

app.get('/api/timeline/:channelId', async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId, 10);
    if (isNaN(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const period = (req.query.period as string) || '7d';
    // Bucket size and point count per period
    const periodConfig: Record<string, { hours: number; bucketSeconds: number; limit: number }> = {
      '1d':  { hours: 24,   bucketSeconds: 1800,      limit: 48 },
      '7d':  { hours: 168,  bucketSeconds: 3 * 3600,  limit: 56 },
      '15d': { hours: 360,  bucketSeconds: 6 * 3600,  limit: 60 },
      '30d': { hours: 720,  bucketSeconds: 12 * 3600, limit: 60 },
    };
    const cfg = periodConfig[period] || periodConfig['7d'];
    const startTimestamp = Math.floor(Date.now() / 1000) - cfg.hours * 3600;

    const rows = await query(
      `SELECT
        (created_at / $2) * $2 AS bucket,
        COUNT(*) AS total_count,
        COUNT(*) FILTER (WHERE type = 2) AS success_count,
        COUNT(*) FILTER (WHERE type = 5) AS failed_count,
        ROUND(AVG(CASE WHEN type = 2 THEN use_time END)::numeric, 2) AS avg_time
      FROM logs
      WHERE channel_id = $1
        AND type IN (2, 5)
        AND created_at >= $3
      GROUP BY bucket
      ORDER BY bucket DESC
      LIMIT $4`,
      [channelId, cfg.bucketSeconds, startTimestamp, cfg.limit]
    );

    res.json(rows.map((r: any) => ({
      hour: parseInt(r.bucket, 10),
      total: parseInt(r.total_count, 10),
      success: parseInt(r.success_count, 10),
      failed: parseInt(r.failed_count, 10),
      avg_time: parseFloat(r.avg_time) || 0,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/availability', async (req, res) => {
  try {
    const period = (req.query.period as string) || '7d';
    const validPeriods = ['1d', '7d', '15d', '30d'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Use 7d, 15d, or 30d' });
    }

    const hoursMap: Record<string, number> = { '1d': 24, '7d': 168, '15d': 360, '30d': 720 };
    const hours = hoursMap[period];
    const startTimestamp = Math.floor(Date.now() / 1000) - hours * 3600;

    const rows = await query(
      `SELECT
        l.channel_id,
        COUNT(*) AS total_count,
        COUNT(*) FILTER (WHERE l.type = 2) AS success_count,
        COUNT(*) FILTER (WHERE l.type = 5) AS failed_count,
        ROUND(100.0 * COUNT(*) FILTER (WHERE l.type = 2) / NULLIF(COUNT(*), 0), 2) AS success_rate
      FROM logs l
      JOIN channels c ON c.id = l.channel_id
      WHERE l.type IN (2, 5)
        AND l.created_at >= $1
        AND c.status != ${STATUS_MANUALLY_DISABLED}
      GROUP BY l.channel_id`,
      [startTimestamp]
    );

    res.json(rows.map((r: any) => ({
      channel_id: parseInt(r.channel_id, 10),
      period,
      total_count: parseInt(r.total_count, 10),
      success_count: parseInt(r.success_count, 10),
      failed_count: parseInt(r.failed_count, 10),
      availability_pct: r.success_rate,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Fallback to index.html
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(config.port, () => {
  console.log(`NewAPI Health Monitor running on port ${config.port}`);
});
