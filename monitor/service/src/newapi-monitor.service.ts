import { CacheClient } from './cache.js';
import { config } from './config.js';
import { DatabaseClient } from './database.js';
import type {
  ChannelHourlyStat,
  ChannelInfo,
  ChannelRecordsResponseData,
  ChannelUsageSummary,
  ConfigCheckResult,
  DashboardResponseData,
  DashboardOverview,
  HourlyStats,
  HoursRange,
  KeyHourlyStat,
  KeyQuotaInfo,
  KeyQuotaResponseData,
  KeyUserInfo,
  KeyUsageSummary,
  ModelChannelInfo,
  ModelInfo,
  ModelSummary,
  QueryLogsParams,
  QueryLogsResponseData,
  TimeOpts,
  UserHourlyStat,
  UserUsageSummary,
} from './types.js';

export class NewApiMonitorService {
  private readonly cachePrefix = 'newapi:logs:stats:';

  constructor(
    private readonly database: DatabaseClient,
    private readonly cache: CacheClient,
  ) {}

  private getCacheKey({ modelName, hours }: QueryLogsParams): string {
    return `${this.cachePrefix}${modelName}_${hours}_filtered`;
  }

  private getTestDataFilterSql(alias?: string): string {
    const prefix = alias ? `${alias}.` : '';
    return `
      AND COALESCE(${prefix}token_name, '') NOT IN ('TEST', '模型测试')
      AND COALESCE(${prefix}content, '') <> '模型测试'
    `;
  }

  private getLogsBaseFilterSql(alias?: string): string {
    const prefix = alias ? `${alias}.` : '';
    return `
      ${this.getTestDataFilterSql(alias)}
      AND COALESCE(${prefix}model_name, '') <> ''
    `;
  }

  // customStart/customEnd override hours when provided
  private buildTimeFilter(hours: HoursRange, startIndex: number, customStart?: number, customEnd?: number): { sql: string; params: number[] } {
    if (customStart && customEnd) {
      return {
        sql: `AND created_at >= $${startIndex}
            AND created_at <= $${startIndex + 1}`,
        params: [customStart, customEnd],
      };
    }

    const endTimestamp = Math.floor(Date.now() / 1000);

    if (hours === 'all') {
      return {
        sql: `AND created_at <= $${startIndex}`,
        params: [endTimestamp],
      };
    }

    const startTimestamp = endTimestamp - hours * 3600;
    return {
      sql: `AND created_at >= $${startIndex}
          AND created_at <= $${startIndex + 1}`,
      params: [startTimestamp, endTimestamp],
    };
  }

  private buildPreviousPeriodFilter(hours: HoursRange, startIndex: number): { sql: string; params: number[] } | null {
    if (hours === 'all') {
      return null;
    }

    const currentEndTimestamp = Math.floor(Date.now() / 1000);
    const currentStartTimestamp = currentEndTimestamp - hours * 3600;
    const previousStartTimestamp = currentStartTimestamp - hours * 3600;

    return {
      sql: `AND created_at >= $${startIndex}
          AND created_at < $${startIndex + 1}`,
      params: [previousStartTimestamp, currentStartTimestamp],
    };
  }

  private buildBucketSql(hours: HoursRange, alias?: string): string {
    const prefix = alias ? `${alias}.` : '';
    const useMinutes = typeof hours === 'number' && hours <= 6;
    const divisor = useMinutes ? 60 : 3600;
    return `(${prefix}created_at / ${divisor}) * ${divisor}`;
  }

  private getCountChange(currentCount: number, previousCount: number | undefined, hasPreviousPeriod: boolean): number | null {
    if (!hasPreviousPeriod) {
      return null;
    }

    if (previousCount === undefined) {
      return null;
    }

    if (previousCount > 0) {
      return Number((((currentCount - previousCount) / previousCount) * 100).toFixed(2));
    }

    return currentCount > 0 ? 100 : 0;
  }

  private normalizeApiKey(key: string): string {
    return key.trim().replace(/^sk-/, '');
  }

  private maskApiKey(key: string): string {
    if (key.length <= 10) {
      return `${key.slice(0, 2)}***${key.slice(-2)}`;
    }

    return `${key.slice(0, 6)}***${key.slice(-6)}`;
  }

  private splitTextList(value: string | null | undefined): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private async getChannelInfo(channelId: number): Promise<ChannelInfo | null> {
    const rows = await this.database.query<{
      id: string;
      type: string;
      status: string;
      response_time: string | null;
      used_quota: string | null;
      priority: string | null;
      weight: string | null;
      auto_ban: string | null;
      tag: string | null;
      created_time: string | null;
      test_time: string | null;
      balance: string | null;
      balance_updated_time: string | null;
      remark: string | null;
    }>(
      `
        SELECT
          id,
          type,
          status,
          response_time,
          used_quota,
          priority,
          weight,
          auto_ban,
          tag,
          created_time,
          test_time,
          balance,
          balance_updated_time,
          remark
        FROM channels
        WHERE id = $1
        LIMIT 1
      `,
      [channelId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      channelId: Number(row.id),
      channelType: Number(row.type),
      status: Number(row.status),
      responseTime: Number(row.response_time ?? 0),
      usedQuota: Number(row.used_quota ?? 0),
      priority: Number(row.priority ?? 0),
      weight: Number(row.weight ?? 0),
      autoBan: Number(row.auto_ban ?? 0),
      tag: row.tag ?? '',
      createdTime: Number(row.created_time ?? 0),
      testTime: Number(row.test_time ?? 0),
      balance: Number(row.balance ?? 0),
      balanceUpdatedTime: Number(row.balance_updated_time ?? 0),
      remark: row.remark ?? '',
    };
  }

  private async getChannelUsageSummary(channelId: number, hours: HoursRange): Promise<ChannelUsageSummary> {
    const timeFilter = this.buildTimeFilter(hours, 2);
    const logsBaseFilter = this.getLogsBaseFilterSql();
    const rows = await this.database.query<{
      total_count: string;
      success_count: string;
      failed_count: string;
      avg_time: string | null;
      total_quota: string | null;
      total_prompt_tokens: string | null;
      total_completion_tokens: string | null;
      total_tokens: string | null;
      model_count: string;
      first_used_at: string | null;
      last_used_at: string | null;
    }>(
      `
        SELECT
          COUNT(*) AS total_count,
          COUNT(*) FILTER (WHERE type = 2) AS success_count,
          COUNT(*) FILTER (WHERE type = 5) AS failed_count,
          ROUND(AVG(CASE WHEN type = 2 THEN use_time END)::numeric, 2) AS avg_time,
          SUM(quota) AS total_quota,
          SUM(prompt_tokens) AS total_prompt_tokens,
          SUM(completion_tokens) AS total_completion_tokens,
          SUM(prompt_tokens + completion_tokens) AS total_tokens,
          COUNT(DISTINCT model_name) AS model_count,
          MIN(created_at) AS first_used_at,
          MAX(created_at) AS last_used_at
        FROM logs
        WHERE channel_id = $1
          ${timeFilter.sql}
          ${logsBaseFilter}
      `,
      [channelId, ...timeFilter.params],
    );

    const row = rows[0];
    const totalRecords = Number(row?.total_count ?? 0);
    const successRecords = Number(row?.success_count ?? 0);
    const failedRecords = Number(row?.failed_count ?? 0);

    return {
      totalRecords,
      successRecords,
      failedRecords,
      successRate: totalRecords > 0 ? Number(((successRecords / totalRecords) * 100).toFixed(2)) : 0,
      avgTime: Number(row?.avg_time ?? 0),
      totalQuota: Number(row?.total_quota ?? 0),
      totalPromptTokens: Number(row?.total_prompt_tokens ?? 0),
      totalCompletionTokens: Number(row?.total_completion_tokens ?? 0),
      totalTokens: Number(row?.total_tokens ?? 0),
      modelCount: Number(row?.model_count ?? 0),
      firstUsedAt: row?.first_used_at ? Number(row.first_used_at) : null,
      lastUsedAt: row?.last_used_at ? Number(row.last_used_at) : null,
    };
  }

  private async getChannelHourlyStats(channelId: number, hours: HoursRange): Promise<ChannelHourlyStat[]> {
    const timeFilter = this.buildTimeFilter(hours, 2);
    const logsBaseFilter = this.getLogsBaseFilterSql();
    const bucket = this.buildBucketSql(hours);
    const rows = await this.database.query<{
      hour: string;
      total_count: string;
      success_count: string;
      failed_count: string;
      total_quota: string | null;
    }>(
      `
        SELECT
          ${bucket} AS hour,
          COUNT(*) AS total_count,
          COUNT(*) FILTER (WHERE type = 2) AS success_count,
          COUNT(*) FILTER (WHERE type = 5) AS failed_count,
          SUM(quota) AS total_quota
        FROM logs
        WHERE channel_id = $1
          ${timeFilter.sql}
          ${logsBaseFilter}
        GROUP BY hour
        ORDER BY hour ASC
      `,
      [channelId, ...timeFilter.params],
    );

    return rows.map((row) => ({
      hour: Number(row.hour),
      total: Number(row.total_count),
      success: Number(row.success_count),
      failed: Number(row.failed_count),
      totalQuota: Number(row.total_quota ?? 0),
    }));
  }

  private async getChannelTopModels(channelId: number, hours: HoursRange = 'all'): Promise<ModelInfo[]> {
    const timeFilter = this.buildTimeFilter(hours, 2);
    const logsBaseFilter = this.getLogsBaseFilterSql();
    const bucket = this.buildBucketSql(hours);
    const bucketFl = this.buildBucketSql(hours, 'fl');
    const rows = await this.database.query<{
      model_name: string;
      total_count: string;
      success_count: string;
      failed_count: string;
      avg_time: string | null;
      first_used_at: string | null;
      last_used_at: string | null;
      total_quota: string | null;
      total_prompt_tokens: string | null;
      total_completion_tokens: string | null;
      total_tokens: string | null;
      unique_users: string;
      active_hours: string;
      peak_hour: string | null;
      peak_count: string | null;
      stream_count: string;
    }>(
      `
        WITH filtered_logs AS (
          SELECT *
          FROM logs
          WHERE channel_id = $1
            ${timeFilter.sql}
            ${logsBaseFilter}
        ),
        hourly_counts AS (
          SELECT
            model_name,
            ${bucket} AS hour_bucket,
            COUNT(*) AS hour_count
          FROM filtered_logs
          GROUP BY model_name, hour_bucket
        ),
        peak_hours AS (
          SELECT
            model_name,
            hour_bucket,
            hour_count,
            ROW_NUMBER() OVER (
              PARTITION BY model_name
              ORDER BY hour_count DESC, hour_bucket DESC
            ) AS row_num
          FROM hourly_counts
        )
        SELECT
          fl.model_name,
          COUNT(*) AS total_count,
          COUNT(*) FILTER (WHERE fl.type = 2) AS success_count,
          COUNT(*) FILTER (WHERE fl.type = 5) AS failed_count,
          ROUND(AVG(CASE WHEN fl.type = 2 THEN fl.use_time END)::numeric, 2) AS avg_time,
          MIN(fl.created_at) AS first_used_at,
          MAX(fl.created_at) AS last_used_at,
          SUM(fl.quota) AS total_quota,
          SUM(fl.prompt_tokens) AS total_prompt_tokens,
          SUM(fl.completion_tokens) AS total_completion_tokens,
          SUM(fl.prompt_tokens + fl.completion_tokens) AS total_tokens,
          COUNT(DISTINCT fl.user_id) AS unique_users,
          COUNT(DISTINCT ${bucketFl}) AS active_hours,
          MAX(CASE WHEN ph.row_num = 1 THEN ph.hour_bucket END) AS peak_hour,
          MAX(CASE WHEN ph.row_num = 1 THEN ph.hour_count END) AS peak_count,
          COUNT(*) FILTER (WHERE fl.is_stream = true) AS stream_count
        FROM filtered_logs fl
        LEFT JOIN peak_hours ph ON ph.model_name = fl.model_name AND ph.row_num = 1
        GROUP BY fl.model_name
        ORDER BY total_count DESC, fl.model_name ASC
        LIMIT 8
      `,
      [channelId, ...timeFilter.params],
    );

    return rows.map((row) => {
      const count = Number(row.total_count);
      const successCount = Number(row.success_count);
      const totalQuota = Number(row.total_quota ?? 0);
      const totalTokens = Number(row.total_tokens ?? 0);
      return {
        name: row.model_name,
        count,
        successCount,
        failedCount: Number(row.failed_count),
        successRate: count > 0 ? Number(((successCount / count) * 100).toFixed(2)) : 0,
        avgTime: Number(row.avg_time ?? 0),
        firstUsedAt: row.first_used_at ? Number(row.first_used_at) : null,
        lastUsedAt: row.last_used_at ? Number(row.last_used_at) : null,
        totalQuota,
        totalPromptTokens: Number(row.total_prompt_tokens ?? 0),
        totalCompletionTokens: Number(row.total_completion_tokens ?? 0),
        totalTokens,
        avgTotalTokens: count > 0 ? Number((totalTokens / count).toFixed(2)) : 0,
        avgQuotaPerRequest: count > 0 ? Number((totalQuota / count).toFixed(2)) : 0,
        uniqueUsers: Number(row.unique_users ?? 0),
        activeHours: Number(row.active_hours ?? 0),
        peakHour: row.peak_hour ? Number(row.peak_hour) : null,
        peakCount: Number(row.peak_count ?? 0),
        streamRate: count > 0 ? Number(((Number(row.stream_count ?? 0) / count) * 100).toFixed(2)) : 0,
        countChange: null,
      };
    });
  }

  async getChannelRecords(channelId: number, hours: HoursRange = 24): Promise<ChannelRecordsResponseData | null> {
    const channel = await this.getChannelInfo(channelId);
    if (!channel) {
      return null;
    }

    const [usageSummary, hourlyStats, topModels] = await Promise.all([
      this.getChannelUsageSummary(channelId, hours),
      this.getChannelHourlyStats(channelId, hours),
      this.getChannelTopModels(channelId, hours),
    ]);

    return {
      hours,
      channel,
      usage_summary: usageSummary,
      hourly_stats: hourlyStats,
      top_models: topModels,
    };
  }

  private async querySuccessStats(
    modelName: string,
    hours: HoursRange,
  ): Promise<Map<number, { count: number; avgTime: number }>> {
    const timeFilter = this.buildTimeFilter(hours, 2);
    const logsBaseFilter = this.getLogsBaseFilterSql();
    const bucket = this.buildBucketSql(hours);
    const rows = await this.database.query<{
      hour: string;
      count: string;
      avg_time: string | null;
    }>(
      `
        SELECT
          ${bucket} AS hour,
          COUNT(*) AS count,
          ROUND(AVG(use_time)::numeric, 2) AS avg_time
        FROM logs
        WHERE model_name = $1
          ${timeFilter.sql}
          ${logsBaseFilter}
          AND type = 2
        GROUP BY hour
        ORDER BY hour ASC
      `,
      [modelName, ...timeFilter.params],
    );

    return new Map(
      rows.map((row) => [
        Number(row.hour),
        {
          count: Number(row.count),
          avgTime: Number(row.avg_time ?? 0),
        },
      ]),
    );
  }

  private async queryErrorStats(
    modelName: string,
    hours: HoursRange,
  ): Promise<Map<number, number>> {
    const timeFilter = this.buildTimeFilter(hours, 2);
    const logsBaseFilter = this.getLogsBaseFilterSql();
    const bucket = this.buildBucketSql(hours);
    const rows = await this.database.query<{ hour: string; count: string }>(
      `
        SELECT
          ${bucket} AS hour,
          COUNT(*) AS count
        FROM logs
        WHERE model_name = $1
          ${timeFilter.sql}
          ${logsBaseFilter}
          AND type = 5
        GROUP BY hour
        ORDER BY hour ASC
      `,
      [modelName, ...timeFilter.params],
    );

    return new Map(rows.map((row) => [Number(row.hour), Number(row.count)]));
  }

  private async getModelSummary(modelName: string, hours: HoursRange): Promise<ModelSummary> {
    const timeFilter = this.buildTimeFilter(hours, 2);
    const previousPeriodFilter = this.buildPreviousPeriodFilter(hours, 2);
    const logsBaseFilter = this.getLogsBaseFilterSql();
    const bucket = this.buildBucketSql(hours);

    const rows = await this.database.query<{
      total_count: string;
      success_count: string;
      failed_count: string;
      avg_time: string | null;
      first_used_at: string | null;
      last_used_at: string | null;
      total_quota: string | null;
      total_prompt_tokens: string | null;
      total_completion_tokens: string | null;
      total_tokens: string | null;
      unique_users: string;
      stream_count: string;
      active_hours: string;
      peak_hour: string | null;
      peak_count: string | null;
    }>(
      `
        WITH filtered_logs AS (
          SELECT *
          FROM logs
          WHERE model_name = $1
            ${timeFilter.sql}
            ${logsBaseFilter}
        ),
        hourly_counts AS (
          SELECT
            ${bucket} AS hour_bucket,
            COUNT(*) AS hour_count
          FROM filtered_logs
          GROUP BY hour_bucket
        ),
        peak_hour AS (
          SELECT hour_bucket, hour_count
          FROM hourly_counts
          ORDER BY hour_count DESC, hour_bucket DESC
          LIMIT 1
        )
        SELECT
          COUNT(*) AS total_count,
          COUNT(*) FILTER (WHERE type = 2) AS success_count,
          COUNT(*) FILTER (WHERE type = 5) AS failed_count,
          ROUND(AVG(CASE WHEN type = 2 THEN use_time END)::numeric, 2) AS avg_time,
          MIN(created_at) AS first_used_at,
          MAX(created_at) AS last_used_at,
          SUM(quota) AS total_quota,
          SUM(prompt_tokens) AS total_prompt_tokens,
          SUM(completion_tokens) AS total_completion_tokens,
          SUM(prompt_tokens + completion_tokens) AS total_tokens,
          COUNT(DISTINCT user_id) AS unique_users,
          COUNT(*) FILTER (WHERE is_stream = true) AS stream_count,
          COUNT(DISTINCT ${bucket}) AS active_hours,
          MAX(peak_hour.hour_bucket) AS peak_hour,
          MAX(peak_hour.hour_count) AS peak_count
        FROM filtered_logs
        LEFT JOIN peak_hour ON true
      `,
      [modelName, ...timeFilter.params],
    );

    let previousCount: number | undefined;

    if (previousPeriodFilter) {
      const previousRows = await this.database.query<{ total_count: string }>(
        `
          SELECT COUNT(*) AS total_count
          FROM logs
          WHERE model_name = $1
            ${previousPeriodFilter.sql}
            ${logsBaseFilter}
        `,
        [modelName, ...previousPeriodFilter.params],
      );

      previousCount = Number(previousRows[0]?.total_count ?? 0);
    }

    const row = rows[0];
    const totalRecords = Number(row?.total_count ?? 0);
    const successRecords = Number(row?.success_count ?? 0);
    const failedRecords = Number(row?.failed_count ?? 0);
    const totalQuota = Number(row?.total_quota ?? 0);
    const totalPromptTokens = Number(row?.total_prompt_tokens ?? 0);
    const totalCompletionTokens = Number(row?.total_completion_tokens ?? 0);
    const totalTokens = Number(row?.total_tokens ?? 0);

    return {
      modelName,
      totalRecords,
      successRecords,
      failedRecords,
      successRate: totalRecords > 0 ? Number(((successRecords / totalRecords) * 100).toFixed(2)) : 0,
      avgTime: Number(row?.avg_time ?? 0),
      firstUsedAt: row?.first_used_at ? Number(row.first_used_at) : null,
      lastUsedAt: row?.last_used_at ? Number(row.last_used_at) : null,
      totalQuota,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      avgTotalTokens: totalRecords > 0 ? Number((totalTokens / totalRecords).toFixed(2)) : 0,
      avgQuotaPerRequest: totalRecords > 0 ? Number((totalQuota / totalRecords).toFixed(2)) : 0,
      uniqueUsers: Number(row?.unique_users ?? 0),
      activeHours: Number(row?.active_hours ?? 0),
      peakHour: row?.peak_hour ? Number(row.peak_hour) : null,
      peakCount: Number(row?.peak_count ?? 0),
      streamRate: totalRecords > 0 ? Number(((Number(row?.stream_count ?? 0) / totalRecords) * 100).toFixed(2)) : 0,
      countChange: this.getCountChange(totalRecords, previousCount, Boolean(previousPeriodFilter)),
    };
  }

  private async getRelatedChannels(modelName: string): Promise<ModelChannelInfo[]> {
    const rows = await this.database.query<{
      channel_id: string;
      route_group: string;
      channel_type: string;
      status: string;
      response_time: string | null;
      used_quota: string | null;
      priority: string | null;
      weight: string | null;
      tag: string | null;
    }>(
      `
        SELECT
          a.channel_id,
          a."group" AS route_group,
          c.type AS channel_type,
          c.status,
          c.response_time,
          c.used_quota,
          a.priority,
          a.weight,
          a.tag
        FROM abilities a
        INNER JOIN channels c ON c.id = a.channel_id
        WHERE a.model = $1
          AND a.enabled = true
        ORDER BY a.priority DESC, a.weight DESC, a.channel_id ASC, a."group" ASC
      `,
      [modelName],
    );

    return rows.map((row) => ({
      channelId: Number(row.channel_id),
      routeGroup: row.route_group,
      channelType: Number(row.channel_type),
      status: Number(row.status),
      responseTime: Number(row.response_time ?? 0),
      usedQuota: Number(row.used_quota ?? 0),
      priority: Number(row.priority ?? 0),
      weight: Number(row.weight ?? 0),
      tag: row.tag ?? '',
    }));
  }

  private async getDashboardOverview(hours: HoursRange): Promise<DashboardOverview> {
    const timeFilter = this.buildTimeFilter(hours, 1);
    const previousPeriodFilter = this.buildPreviousPeriodFilter(hours, 1);
    const logsBaseFilter = this.getLogsBaseFilterSql();
    const bucket = this.buildBucketSql(hours);

    const rows = await this.database.query<{
      total_count: string;
      success_count: string;
      failed_count: string;
      avg_time: string | null;
      active_models: string;
      active_users: string;
      total_quota: string | null;
      total_tokens: string | null;
      active_hours: string;
      peak_hour: string | null;
      peak_count: string | null;
      first_seen_at: string | null;
      last_seen_at: string | null;
    }>(
      `
        WITH filtered_logs AS (
          SELECT *
          FROM logs
          WHERE 1 = 1
            ${timeFilter.sql}
            ${logsBaseFilter}
        ),
        hourly_counts AS (
          SELECT
            ${bucket} AS hour_bucket,
            COUNT(*) AS hour_count
          FROM filtered_logs
          GROUP BY hour_bucket
        ),
        peak_hour AS (
          SELECT hour_bucket, hour_count
          FROM hourly_counts
          ORDER BY hour_count DESC, hour_bucket DESC
          LIMIT 1
        )
        SELECT
          COUNT(*) AS total_count,
          COUNT(*) FILTER (WHERE type = 2) AS success_count,
          COUNT(*) FILTER (WHERE type = 5) AS failed_count,
          ROUND(AVG(CASE WHEN type = 2 THEN use_time END)::numeric, 2) AS avg_time,
          COUNT(DISTINCT model_name) AS active_models,
          COUNT(DISTINCT user_id) AS active_users,
          SUM(quota) AS total_quota,
          SUM(prompt_tokens + completion_tokens) AS total_tokens,
          COUNT(DISTINCT ${bucket}) AS active_hours,
          MAX(peak_hour.hour_bucket) AS peak_hour,
          MAX(peak_hour.hour_count) AS peak_count,
          MIN(created_at) AS first_seen_at,
          MAX(created_at) AS last_seen_at
        FROM filtered_logs
        LEFT JOIN peak_hour ON true
      `,
      timeFilter.params,
    );

    let previousCount: number | undefined;
    if (previousPeriodFilter) {
      const previousRows = await this.database.query<{ total_count: string }>(
        `
          SELECT COUNT(*) AS total_count
          FROM logs
          WHERE 1 = 1
            ${previousPeriodFilter.sql}
            ${logsBaseFilter}
        `,
        previousPeriodFilter.params,
      );
      previousCount = Number(previousRows[0]?.total_count ?? 0);
    }

    const row = rows[0];
    const totalRecords = Number(row?.total_count ?? 0);
    const successRecords = Number(row?.success_count ?? 0);
    const failedRecords = Number(row?.failed_count ?? 0);

    return {
      totalRecords,
      successRecords,
      failedRecords,
      successRate: totalRecords > 0 ? Number(((successRecords / totalRecords) * 100).toFixed(2)) : 0,
      avgTime: Number(row?.avg_time ?? 0),
      activeModels: Number(row?.active_models ?? 0),
      activeUsers: Number(row?.active_users ?? 0),
      totalQuota: Number(row?.total_quota ?? 0),
      totalTokens: Number(row?.total_tokens ?? 0),
      activeHours: Number(row?.active_hours ?? 0),
      peakHour: row?.peak_hour ? Number(row.peak_hour) : null,
      peakCount: Number(row?.peak_count ?? 0),
      countChange: this.getCountChange(totalRecords, previousCount, Boolean(previousPeriodFilter)),
      firstSeenAt: row?.first_seen_at ? Number(row.first_seen_at) : null,
      lastSeenAt: row?.last_seen_at ? Number(row.last_seen_at) : null,
    };
  }

  private async getDashboardHourlyStats(hours: HoursRange): Promise<HourlyStats[]> {
    const timeFilter = this.buildTimeFilter(hours, 1);
    const logsBaseFilter = this.getLogsBaseFilterSql();
    const bucket = this.buildBucketSql(hours);
    const rows = await this.database.query<{
      hour: string;
      total_count: string;
      success_count: string;
      failed_count: string;
      avg_time: string | null;
    }>(
      `
        SELECT
          ${bucket} AS hour,
          COUNT(*) AS total_count,
          COUNT(*) FILTER (WHERE type = 2) AS success_count,
          COUNT(*) FILTER (WHERE type = 5) AS failed_count,
          ROUND(AVG(CASE WHEN type = 2 THEN use_time END)::numeric, 2) AS avg_time
        FROM logs
        WHERE 1 = 1
          ${timeFilter.sql}
          ${logsBaseFilter}
        GROUP BY hour
        ORDER BY hour ASC
      `,
      timeFilter.params,
    );

    return rows.map((row) => ({
      hour: Number(row.hour),
      total: Number(row.total_count),
      success: Number(row.success_count),
      failed: Number(row.failed_count),
      avgTime: Number(row.avg_time ?? 0),
    }));
  }

  async getDashboard(hours: HoursRange = 24): Promise<DashboardResponseData> {
    const [overview, hourlyStats, topModels] = await Promise.all([
      this.getDashboardOverview(hours),
      this.getDashboardHourlyStats(hours),
      this.getModelList(hours),
    ]);

    return {
      hours,
      overview,
      hourly_stats: hourlyStats,
      top_models: topModels,
    };
  }

  private async getTokenInfo(rawKey: string): Promise<(KeyQuotaInfo & { tokenId: number; userId: number }) | null> {
    const normalizedKey = this.normalizeApiKey(rawKey);
    const rows = await this.database.query<{
      id: string;
      user_id: string;
      key: string;
      name: string;
      status: string;
      group: string | null;
      created_time: string;
      accessed_time: string;
      expired_time: string;
      remain_quota: string;
      used_quota: string;
      unlimited_quota: boolean;
      model_limits_enabled: boolean;
      model_limits: string | null;
      allow_ips: string | null;
      cross_group_retry: boolean | null;
    }>(
      `
        SELECT
          id,
          user_id,
          key,
          name,
          status,
          "group",
          created_time,
          accessed_time,
          expired_time,
          remain_quota,
          used_quota,
          unlimited_quota,
          model_limits_enabled,
          model_limits,
          allow_ips,
          cross_group_retry
        FROM tokens
        WHERE key = $1
        LIMIT 1
      `,
      [normalizedKey],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      tokenId: Number(row.id),
      userId: Number(row.user_id),
      maskedKey: this.maskApiKey(`sk-${row.key.trim()}`),
      name: row.name,
      status: Number(row.status),
      group: row.group ?? '',
      createdTime: Number(row.created_time),
      accessedTime: Number(row.accessed_time),
      expiredTime: Number(row.expired_time),
      remainQuota: Number(row.remain_quota),
      usedQuota: Number(row.used_quota),
      unlimitedQuota: row.unlimited_quota,
      modelLimitsEnabled: row.model_limits_enabled,
      modelLimits: this.splitTextList(row.model_limits),
      allowIps: this.splitTextList(row.allow_ips),
      crossGroupRetry: Boolean(row.cross_group_retry),
    };
  }

  private async getUserInfo(userId: number): Promise<KeyUserInfo | null> {
    const rows = await this.database.query<{
      id: string;
      username: string;
      display_name: string | null;
      email: string | null;
      role: string;
      status: string;
      group: string | null;
      quota: string;
      used_quota: string;
      request_count: string;
      remark: string | null;
    }>(
      `
        SELECT
          id,
          username,
          display_name,
          email,
          role,
          status,
          "group",
          quota,
          used_quota,
          request_count,
          remark
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    const quota = Number(row.quota);
    const usedQuota = Number(row.used_quota);

    return {
      userId: Number(row.id),
      username: row.username,
      displayName: row.display_name ?? '',
      email: row.email ?? '',
      role: Number(row.role),
      status: Number(row.status),
      group: row.group ?? '',
      quota,
      usedQuota,
      remainQuota: quota - usedQuota,
      requestCount: Number(row.request_count),
      remark: row.remark ?? '',
    };
  }

  private async getKeyUsageSummary(tokenId: number): Promise<KeyUsageSummary> {
    const rows = await this.database.query<{
      total_count: string;
      success_count: string;
      failed_count: string;
      avg_time: string | null;
      total_quota: string | null;
      total_prompt_tokens: string | null;
      total_completion_tokens: string | null;
      total_tokens: string | null;
      model_count: string;
      first_used_at: string | null;
      last_used_at: string | null;
    }>(
      `
        SELECT
          COUNT(*) AS total_count,
          COUNT(*) FILTER (WHERE type = 2) AS success_count,
          COUNT(*) FILTER (WHERE type = 5) AS failed_count,
          ROUND(AVG(CASE WHEN type = 2 THEN use_time END)::numeric, 2) AS avg_time,
          SUM(quota) AS total_quota,
          SUM(prompt_tokens) AS total_prompt_tokens,
          SUM(completion_tokens) AS total_completion_tokens,
          SUM(prompt_tokens + completion_tokens) AS total_tokens,
          COUNT(DISTINCT model_name) AS model_count,
          MIN(created_at) AS first_used_at,
          MAX(created_at) AS last_used_at
        FROM logs
        WHERE token_id = $1
      `,
      [tokenId],
    );

    const row = rows[0];
    const totalRecords = Number(row?.total_count ?? 0);
    const successRecords = Number(row?.success_count ?? 0);
    const failedRecords = Number(row?.failed_count ?? 0);

    return {
      totalRecords,
      successRecords,
      failedRecords,
      successRate: totalRecords > 0 ? Number(((successRecords / totalRecords) * 100).toFixed(2)) : 0,
      avgTime: Number(row?.avg_time ?? 0),
      totalQuota: Number(row?.total_quota ?? 0),
      totalPromptTokens: Number(row?.total_prompt_tokens ?? 0),
      totalCompletionTokens: Number(row?.total_completion_tokens ?? 0),
      totalTokens: Number(row?.total_tokens ?? 0),
      modelCount: Number(row?.model_count ?? 0),
      firstUsedAt: row?.first_used_at ? Number(row.first_used_at) : null,
      lastUsedAt: row?.last_used_at ? Number(row.last_used_at) : null,
    };
  }

  private async getKeyHourlyStats(tokenId: number, hours: HoursRange): Promise<KeyHourlyStat[]> {
    const timeFilter = this.buildTimeFilter(hours, 2);
    const bucket = this.buildBucketSql(hours);
    const rows = await this.database.query<{
      hour: string;
      total_count: string;
      success_count: string;
      failed_count: string;
      total_quota: string | null;
    }>(
      `
        SELECT
          ${bucket} AS hour,
          COUNT(*) AS total_count,
          COUNT(*) FILTER (WHERE type = 2) AS success_count,
          COUNT(*) FILTER (WHERE type = 5) AS failed_count,
          SUM(quota) AS total_quota
        FROM logs
        WHERE token_id = $1
          ${timeFilter.sql}
        GROUP BY hour
        ORDER BY hour ASC
      `,
      [tokenId, ...timeFilter.params],
    );

    return rows.map((row) => ({
      hour: Number(row.hour),
      total: Number(row.total_count),
      success: Number(row.success_count),
      failed: Number(row.failed_count),
      totalQuota: Number(row.total_quota ?? 0),
    }));
  }

  private async getKeyTopModels(tokenId: number, hours: HoursRange = 'all'): Promise<ModelInfo[]> {
    const bucket = this.buildBucketSql(hours);
    const bucketFl = this.buildBucketSql(hours, 'fl');
    const rows = await this.database.query<{
      model_name: string;
      total_count: string;
      success_count: string;
      failed_count: string;
      avg_time: string | null;
      first_used_at: string | null;
      last_used_at: string | null;
      total_quota: string | null;
      total_prompt_tokens: string | null;
      total_completion_tokens: string | null;
      total_tokens: string | null;
      unique_users: string;
      active_hours: string;
      peak_hour: string | null;
      peak_count: string | null;
      stream_count: string;
    }>(
      `
        WITH filtered_logs AS (
          SELECT *
          FROM logs
          WHERE token_id = $1
            AND COALESCE(model_name, '') <> ''
        ),
        hourly_counts AS (
          SELECT
            model_name,
            ${bucket} AS hour_bucket,
            COUNT(*) AS hour_count
          FROM filtered_logs
          GROUP BY model_name, hour_bucket
        ),
        peak_hours AS (
          SELECT
            model_name,
            hour_bucket,
            hour_count,
            ROW_NUMBER() OVER (
              PARTITION BY model_name
              ORDER BY hour_count DESC, hour_bucket DESC
            ) AS row_num
          FROM hourly_counts
        )
        SELECT
          fl.model_name,
          COUNT(*) AS total_count,
          COUNT(*) FILTER (WHERE fl.type = 2) AS success_count,
          COUNT(*) FILTER (WHERE fl.type = 5) AS failed_count,
          ROUND(AVG(CASE WHEN fl.type = 2 THEN fl.use_time END)::numeric, 2) AS avg_time,
          MIN(fl.created_at) AS first_used_at,
          MAX(fl.created_at) AS last_used_at,
          SUM(fl.quota) AS total_quota,
          SUM(fl.prompt_tokens) AS total_prompt_tokens,
          SUM(fl.completion_tokens) AS total_completion_tokens,
          SUM(fl.prompt_tokens + fl.completion_tokens) AS total_tokens,
          COUNT(DISTINCT fl.user_id) AS unique_users,
          COUNT(DISTINCT ${bucketFl}) AS active_hours,
          MAX(CASE WHEN ph.row_num = 1 THEN ph.hour_bucket END) AS peak_hour,
          MAX(CASE WHEN ph.row_num = 1 THEN ph.hour_count END) AS peak_count,
          COUNT(*) FILTER (WHERE fl.is_stream = true) AS stream_count
        FROM filtered_logs fl
        LEFT JOIN peak_hours ph ON ph.model_name = fl.model_name AND ph.row_num = 1
        GROUP BY fl.model_name
        ORDER BY total_count DESC, fl.model_name ASC
        LIMIT 8
      `,
      [tokenId],
    );

    return rows.map((row) => {
      const count = Number(row.total_count);
      const successCount = Number(row.success_count);
      const totalQuota = Number(row.total_quota ?? 0);
      const totalTokens = Number(row.total_tokens ?? 0);
      return {
        name: row.model_name,
        count,
        successCount,
        failedCount: Number(row.failed_count),
        successRate: count > 0 ? Number(((successCount / count) * 100).toFixed(2)) : 0,
        avgTime: Number(row.avg_time ?? 0),
        firstUsedAt: row.first_used_at ? Number(row.first_used_at) : null,
        lastUsedAt: row.last_used_at ? Number(row.last_used_at) : null,
        totalQuota,
        totalPromptTokens: Number(row.total_prompt_tokens ?? 0),
        totalCompletionTokens: Number(row.total_completion_tokens ?? 0),
        totalTokens,
        avgTotalTokens: count > 0 ? Number((totalTokens / count).toFixed(2)) : 0,
        avgQuotaPerRequest: count > 0 ? Number((totalQuota / count).toFixed(2)) : 0,
        uniqueUsers: Number(row.unique_users ?? 0),
        activeHours: Number(row.active_hours ?? 0),
        peakHour: row.peak_hour ? Number(row.peak_hour) : null,
        peakCount: Number(row.peak_count ?? 0),
        streamRate: count > 0 ? Number(((Number(row.stream_count ?? 0) / count) * 100).toFixed(2)) : 0,
        countChange: null,
      };
    });
  }

  private async getUserUsageSummary(userId: number): Promise<UserUsageSummary> {
    const rows = await this.database.query<{
      total_count: string;
      success_count: string;
      failed_count: string;
      avg_time: string | null;
      total_quota: string | null;
      total_prompt_tokens: string | null;
      total_completion_tokens: string | null;
      total_tokens: string | null;
      token_count: string;
      model_count: string;
      first_used_at: string | null;
      last_used_at: string | null;
    }>(
      `
        SELECT
          COUNT(*) AS total_count,
          COUNT(*) FILTER (WHERE type = 2) AS success_count,
          COUNT(*) FILTER (WHERE type = 5) AS failed_count,
          ROUND(AVG(CASE WHEN type = 2 THEN use_time END)::numeric, 2) AS avg_time,
          SUM(quota) AS total_quota,
          SUM(prompt_tokens) AS total_prompt_tokens,
          SUM(completion_tokens) AS total_completion_tokens,
          SUM(prompt_tokens + completion_tokens) AS total_tokens,
          COUNT(DISTINCT token_id) AS token_count,
          COUNT(DISTINCT model_name) AS model_count,
          MIN(created_at) AS first_used_at,
          MAX(created_at) AS last_used_at
        FROM logs
        WHERE user_id = $1
      `,
      [userId],
    );

    const row = rows[0];
    const totalRecords = Number(row?.total_count ?? 0);
    const successRecords = Number(row?.success_count ?? 0);
    const failedRecords = Number(row?.failed_count ?? 0);

    return {
      totalRecords,
      successRecords,
      failedRecords,
      successRate: totalRecords > 0 ? Number(((successRecords / totalRecords) * 100).toFixed(2)) : 0,
      avgTime: Number(row?.avg_time ?? 0),
      totalQuota: Number(row?.total_quota ?? 0),
      totalPromptTokens: Number(row?.total_prompt_tokens ?? 0),
      totalCompletionTokens: Number(row?.total_completion_tokens ?? 0),
      totalTokens: Number(row?.total_tokens ?? 0),
      tokenCount: Number(row?.token_count ?? 0),
      modelCount: Number(row?.model_count ?? 0),
      firstUsedAt: row?.first_used_at ? Number(row.first_used_at) : null,
      lastUsedAt: row?.last_used_at ? Number(row.last_used_at) : null,
    };
  }

  private async getUserHourlyStats(userId: number, hours: HoursRange, timeOpts?: TimeOpts): Promise<UserHourlyStat[]> {
    const timeFilter = this.buildTimeFilter(hours, 2, timeOpts?.start, timeOpts?.end);
    const bucket = this.buildBucketSql(hours);
    const rows = await this.database.query<{
      hour: string;
      total_count: string;
      success_count: string;
      failed_count: string;
      total_quota: string | null;
      total_tokens: string | null;
    }>(
      `
        SELECT
          ${bucket} AS hour,
          COUNT(*) AS total_count,
          COUNT(*) FILTER (WHERE type = 2) AS success_count,
          COUNT(*) FILTER (WHERE type = 5) AS failed_count,
          SUM(quota) AS total_quota,
          SUM(prompt_tokens + completion_tokens) AS total_tokens
        FROM logs
        WHERE user_id = $1
          ${timeFilter.sql}
        GROUP BY hour
        ORDER BY hour ASC
      `,
      [userId, ...timeFilter.params],
    );

    return rows.map((row) => ({
      hour: Number(row.hour),
      total: Number(row.total_count),
      success: Number(row.success_count),
      failed: Number(row.failed_count),
      totalQuota: Number(row.total_quota ?? 0),
      totalTokens: Number(row.total_tokens ?? 0),
    }));
  }

  async getKeyQuota(rawKey: string, hours: HoursRange = 24): Promise<KeyQuotaResponseData | null> {
    const token = await this.getTokenInfo(rawKey);
    if (!token) {
      return null;
    }

    const [user, usageSummary, hourlyStats, userUsageSummary, userHourlyStats, topModels] = await Promise.all([
      this.getUserInfo(token.userId),
      this.getKeyUsageSummary(token.tokenId),
      this.getKeyHourlyStats(token.tokenId, hours),
      this.getUserUsageSummary(token.userId),
      this.getUserHourlyStats(token.userId, hours),
      this.getKeyTopModels(token.tokenId),
    ]);

    if (!user) {
      return null;
    }

    return {
      hours,
      token: {
        tokenId: token.tokenId,
        maskedKey: token.maskedKey,
        name: token.name,
        status: token.status,
        group: token.group,
        createdTime: token.createdTime,
        accessedTime: token.accessedTime,
        expiredTime: token.expiredTime,
        remainQuota: token.remainQuota,
        usedQuota: token.usedQuota,
        unlimitedQuota: token.unlimitedQuota,
        modelLimitsEnabled: token.modelLimitsEnabled,
        modelLimits: token.modelLimits,
        allowIps: token.allowIps,
        crossGroupRetry: token.crossGroupRetry,
      },
      user,
      usage_summary: usageSummary,
      hourly_stats: hourlyStats,
      user_usage_summary: userUsageSummary,
      user_hourly_stats: userHourlyStats,
      top_models: topModels,
    };
  }

  // Search by username
  async getUserQuota(username: string, hours: HoursRange = 24, timeOpts?: TimeOpts): Promise<KeyQuotaResponseData | null> {
    // Find user by username
    const userRows = await this.database.query<{ id: string }>(
      `SELECT id FROM users WHERE username = $1 LIMIT 1`,
      [username],
    );
    if (!userRows[0]) return null;
    const userId = Number(userRows[0].id);

    const [user, userUsageSummary, userHourlyStats, topModels] = await Promise.all([
      this.getUserInfo(userId),
      this.getUserUsageSummary(userId),
      this.getUserHourlyStats(userId, hours, timeOpts),
      this.getUserTopModels(userId, hours, timeOpts),
    ]);

    if (!user) return null;

    return {
      hours,
      token: {
        tokenId: 0,
        maskedKey: '',
        name: `${username} (all keys)`,
        status: 1,
        group: user.group,
        createdTime: 0,
        accessedTime: 0,
        expiredTime: 0,
        remainQuota: user.remainQuota,
        usedQuota: user.usedQuota,
        unlimitedQuota: false,
        modelLimitsEnabled: false,
        modelLimits: [] as string[],
        allowIps: [] as string[],
        crossGroupRetry: false,
      },
      user,
      usage_summary: userUsageSummary,
      hourly_stats: userHourlyStats,
      user_usage_summary: userUsageSummary,
      user_hourly_stats: userHourlyStats,
      top_models: topModels,
    };
  }

  private async getUserTopModels(userId: number, hours: HoursRange = 'all', timeOpts?: TimeOpts): Promise<ModelInfo[]> {
    const bucket = this.buildBucketSql(hours);
    const bucketFl = this.buildBucketSql(hours, 'fl');
    const timeFilter = this.buildTimeFilter(hours, 2, timeOpts?.start, timeOpts?.end);
    const rows = await this.database.query<{
      model_name: string;
      total_count: string;
      success_count: string;
      failed_count: string;
      avg_time: string | null;
      first_used_at: string | null;
      last_used_at: string | null;
      total_quota: string | null;
      total_prompt_tokens: string | null;
      total_completion_tokens: string | null;
      total_tokens: string | null;
      unique_users: string;
      active_hours: string;
      peak_hour: string | null;
      peak_count: string | null;
      stream_count: string;
    }>(
      `
        WITH filtered_logs AS (
          SELECT *
          FROM logs
          WHERE user_id = $1
            AND COALESCE(model_name, '') <> ''
            ${timeFilter.sql}
        ),
        hourly_counts AS (
          SELECT
            model_name,
            ${bucket} AS hour_bucket,
            COUNT(*) AS hour_count
          FROM filtered_logs
          GROUP BY model_name, hour_bucket
        ),
        peak_hours AS (
          SELECT
            model_name,
            hour_bucket,
            hour_count,
            ROW_NUMBER() OVER (
              PARTITION BY model_name
              ORDER BY hour_count DESC, hour_bucket DESC
            ) AS row_num
          FROM hourly_counts
        )
        SELECT
          fl.model_name,
          COUNT(*) AS total_count,
          COUNT(*) FILTER (WHERE fl.type = 2) AS success_count,
          COUNT(*) FILTER (WHERE fl.type = 5) AS failed_count,
          ROUND(AVG(CASE WHEN fl.type = 2 THEN fl.use_time END)::numeric, 2) AS avg_time,
          MIN(fl.created_at) AS first_used_at,
          MAX(fl.created_at) AS last_used_at,
          SUM(fl.quota) AS total_quota,
          SUM(fl.prompt_tokens) AS total_prompt_tokens,
          SUM(fl.completion_tokens) AS total_completion_tokens,
          SUM(fl.prompt_tokens + fl.completion_tokens) AS total_tokens,
          COUNT(DISTINCT fl.user_id) AS unique_users,
          COUNT(DISTINCT ${bucketFl}) AS active_hours,
          MAX(CASE WHEN ph.row_num = 1 THEN ph.hour_bucket END) AS peak_hour,
          MAX(CASE WHEN ph.row_num = 1 THEN ph.hour_count END) AS peak_count,
          COUNT(*) FILTER (WHERE fl.is_stream = true) AS stream_count
        FROM filtered_logs fl
        LEFT JOIN peak_hours ph ON ph.model_name = fl.model_name AND ph.row_num = 1
        GROUP BY fl.model_name
        ORDER BY total_count DESC, fl.model_name ASC
        LIMIT 8
      `,
      [userId, ...timeFilter.params],
    );

    return rows.map((row) => {
      const count = Number(row.total_count);
      const successCount = Number(row.success_count);
      const totalQuota = Number(row.total_quota ?? 0);
      const totalTokens = Number(row.total_tokens ?? 0);
      return {
        name: row.model_name,
        count,
        successCount,
        failedCount: Number(row.failed_count),
        successRate: count > 0 ? Number(((successCount / count) * 100).toFixed(2)) : 0,
        avgTime: Number(row.avg_time ?? 0),
        firstUsedAt: row.first_used_at ? Number(row.first_used_at) : null,
        lastUsedAt: row.last_used_at ? Number(row.last_used_at) : null,
        totalQuota,
        totalPromptTokens: Number(row.total_prompt_tokens ?? 0),
        totalCompletionTokens: Number(row.total_completion_tokens ?? 0),
        totalTokens,
        avgTotalTokens: count > 0 ? Number((totalTokens / count).toFixed(2)) : 0,
        avgQuotaPerRequest: count > 0 ? Number((totalQuota / count).toFixed(2)) : 0,
        uniqueUsers: Number(row.unique_users ?? 0),
        activeHours: Number(row.active_hours ?? 0),
        peakHour: row.peak_hour ? Number(row.peak_hour) : null,
        peakCount: Number(row.peak_count ?? 0),
        streamRate: count > 0 ? Number(((Number(row.stream_count ?? 0) / count) * 100).toFixed(2)) : 0,
        countChange: null,
      };
    });
  }

  async queryLogs(params: QueryLogsParams): Promise<QueryLogsResponseData> {
    const cacheKey = this.getCacheKey(params);
    const cached = await this.cache.get<QueryLogsResponseData>(cacheKey);

    if (cached && cached.hourly_stats.length > 0) {
      return cached;
    }

    const [successMap, errorMap, summary, relatedChannels] = await Promise.all([
      this.querySuccessStats(params.modelName, params.hours),
      this.queryErrorStats(params.modelName, params.hours),
      this.getModelSummary(params.modelName, params.hours),
      this.getRelatedChannels(params.modelName),
    ]);

    const allHours = new Set([...successMap.keys(), ...errorMap.keys()]);
    const hourlyStats = Array.from(allHours)
      .map<HourlyStats>((hour) => {
        const successData = successMap.get(hour);
        const success = successData?.count ?? 0;
        const failed = errorMap.get(hour) ?? 0;

        return {
          hour,
          total: success + failed,
          success,
          failed,
          avgTime: successData?.avgTime ?? 0,
        };
      })
      .sort((a, b) => a.hour - b.hour);

    const response: QueryLogsResponseData = {
      hourly_stats: hourlyStats,
      total_records: hourlyStats.reduce((sum, item) => sum + item.total, 0),
      summary,
      related_channels: relatedChannels,
    };

    await this.cache.set(cacheKey, response, config.cacheTtlSeconds);

    return response;
  }

  async getModelList(hours: HoursRange = 24): Promise<ModelInfo[]> {
    const timeFilter = this.buildTimeFilter(hours, 1);
    const previousPeriodFilter = this.buildPreviousPeriodFilter(hours, 1);
    const bucket = this.buildBucketSql(hours);
    const bucketFl = this.buildBucketSql(hours, 'fl');
    const testDataFilter = this.getTestDataFilterSql();

    const rows = await this.database.query<{
      model_name: string;
      total_count: string;
      success_count: string;
      failed_count: string;
      avg_time: string | null;
      first_used_at: string | null;
      last_used_at: string | null;
      total_quota: string | null;
      total_prompt_tokens: string | null;
      total_completion_tokens: string | null;
      total_tokens: string | null;
      unique_users: string;
      stream_count: string;
      active_hours: string;
      peak_hour: string | null;
      peak_count: string | null;
    }>(
      `
        WITH filtered_logs AS (
          SELECT *
          FROM logs
          WHERE 1 = 1
            ${timeFilter.sql}
            ${testDataFilter}
            AND model_name IS NOT NULL
            AND model_name != ''
        ),
        hourly_counts AS (
          SELECT
            model_name,
            ${bucket} AS hour_bucket,
            COUNT(*) AS hour_count
          FROM filtered_logs
          GROUP BY model_name, hour_bucket
        ),
        peak_hours AS (
          SELECT
            model_name,
            hour_bucket,
            hour_count,
            ROW_NUMBER() OVER (
              PARTITION BY model_name
              ORDER BY hour_count DESC, hour_bucket DESC
            ) AS row_num
          FROM hourly_counts
        )
        SELECT
          fl.model_name,
          COUNT(*) AS total_count,
          COUNT(*) FILTER (WHERE fl.type = 2) AS success_count,
          COUNT(*) FILTER (WHERE fl.type = 5) AS failed_count,
          ROUND(AVG(CASE WHEN fl.type = 2 THEN fl.use_time END)::numeric, 2) AS avg_time,
          MIN(fl.created_at) AS first_used_at,
          MAX(fl.created_at) AS last_used_at,
          SUM(fl.quota) AS total_quota,
          SUM(fl.prompt_tokens) AS total_prompt_tokens,
          SUM(fl.completion_tokens) AS total_completion_tokens,
          SUM(fl.prompt_tokens + fl.completion_tokens) AS total_tokens,
          COUNT(DISTINCT fl.user_id) AS unique_users,
          COUNT(*) FILTER (WHERE fl.is_stream = true) AS stream_count,
          COUNT(DISTINCT ${bucketFl}) AS active_hours,
          MAX(CASE WHEN ph.row_num = 1 THEN ph.hour_bucket END) AS peak_hour,
          MAX(CASE WHEN ph.row_num = 1 THEN ph.hour_count END) AS peak_count
        FROM filtered_logs fl
        LEFT JOIN peak_hours ph ON ph.model_name = fl.model_name AND ph.row_num = 1
        GROUP BY fl.model_name
        ORDER BY total_count DESC, fl.model_name ASC
      `,
      timeFilter.params,
    );

    let previousCountMap = new Map<string, number>();

    if (previousPeriodFilter) {
      const previousRows = await this.database.query<{ model_name: string; total_count: string }>(
        `
          SELECT
            model_name,
            COUNT(*) AS total_count
          FROM logs
          WHERE 1 = 1
            ${previousPeriodFilter.sql}
            ${testDataFilter}
            AND model_name IS NOT NULL
            AND model_name != ''
          GROUP BY model_name
        `,
        previousPeriodFilter.params,
      );

      previousCountMap = new Map(
        previousRows.map((row) => [row.model_name, Number(row.total_count)]),
      );
    }

    return rows.map((row) => {
      const count = Number(row.total_count);
      const successCount = Number(row.success_count);
      const failedCount = Number(row.failed_count);
      const totalQuota = Number(row.total_quota ?? 0);
      const totalPromptTokens = Number(row.total_prompt_tokens ?? 0);
      const totalCompletionTokens = Number(row.total_completion_tokens ?? 0);
      const totalTokens = Number(row.total_tokens ?? 0);
      const previousCount = previousCountMap.get(row.model_name);
      const countChange = this.getCountChange(count, previousCount, Boolean(previousPeriodFilter));

      return {
        name: row.model_name,
        count,
        successCount,
        failedCount,
        successRate: count > 0 ? Number(((successCount / count) * 100).toFixed(2)) : 0,
        avgTime: Number(row.avg_time ?? 0),
        firstUsedAt: row.first_used_at ? Number(row.first_used_at) : null,
        lastUsedAt: row.last_used_at ? Number(row.last_used_at) : null,
        totalQuota,
        totalPromptTokens,
        totalCompletionTokens,
        totalTokens,
        avgTotalTokens: count > 0 ? Number((totalTokens / count).toFixed(2)) : 0,
        avgQuotaPerRequest: count > 0 ? Number((totalQuota / count).toFixed(2)) : 0,
        uniqueUsers: Number(row.unique_users),
        activeHours: Number(row.active_hours),
        peakHour: row.peak_hour ? Number(row.peak_hour) : null,
        peakCount: Number(row.peak_count ?? 0),
        streamRate: count > 0 ? Number(((Number(row.stream_count) / count) * 100).toFixed(2)) : 0,
        countChange,
      };
    });
  }

  async checkConfig(): Promise<ConfigCheckResult> {
    try {
      await this.database.healthcheck();
      return {
        configured: true,
        message: this.cache.isEnabled()
          ? 'New API 监控服务可用，数据库与内存缓存正常'
          : 'New API 监控服务可用，数据库正常',
      };
    } catch (error) {
      return {
        configured: false,
        message: `数据库连接失败: ${(error as Error).message}`,
      };
    }
  }
}
