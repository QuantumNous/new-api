export interface HourlyStats {
  hour: number;
  total: number;
  success: number;
  failed: number;
  avgTime: number;
}

export interface ModelSummary {
  modelName: string;
  totalRecords: number;
  successRecords: number;
  failedRecords: number;
  successRate: number;
  avgTime: number;
  firstUsedAt: number | null;
  lastUsedAt: number | null;
  totalQuota: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  avgTotalTokens: number;
  avgQuotaPerRequest: number;
  uniqueUsers: number;
  activeHours: number;
  peakHour: number | null;
  peakCount: number;
  streamRate: number;
  countChange: number | null;
}

export interface ModelChannelInfo {
  channelId: number;
  routeGroup: string;
  channelType: number;
  status: number;
  responseTime: number;
  usedQuota: number;
  priority: number;
  weight: number;
  tag: string;
}

export interface QueryLogsResponseData {
  hourly_stats: HourlyStats[];
  total_records: number;
  summary: ModelSummary;
  related_channels: ModelChannelInfo[];
}

export interface DashboardOverview {
  totalRecords: number;
  successRecords: number;
  failedRecords: number;
  successRate: number;
  avgTime: number;
  activeModels: number;
  activeUsers: number;
  totalQuota: number;
  totalTokens: number;
  activeHours: number;
  peakHour: number | null;
  peakCount: number;
  countChange: number | null;
  firstSeenAt: number | null;
  lastSeenAt: number | null;
}

export interface DashboardResponseData {
  hours: HoursRange;
  overview: DashboardOverview;
  hourly_stats: HourlyStats[];
  top_models: ModelInfo[];
}

export interface KeyQuotaInfo {
  tokenId: number;
  maskedKey: string;
  name: string;
  status: number;
  group: string;
  createdTime: number;
  accessedTime: number;
  expiredTime: number;
  remainQuota: number;
  usedQuota: number;
  unlimitedQuota: boolean;
  modelLimitsEnabled: boolean;
  modelLimits: string[];
  allowIps: string[];
  crossGroupRetry: boolean;
}

export interface KeyUserInfo {
  userId: number;
  username: string;
  displayName: string;
  email: string;
  role: number;
  status: number;
  group: string;
  quota: number;
  usedQuota: number;
  remainQuota: number;
  requestCount: number;
  remark: string;
}

export interface KeyUsageSummary {
  totalRecords: number;
  successRecords: number;
  failedRecords: number;
  successRate: number;
  avgTime: number;
  totalQuota: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  modelCount: number;
  firstUsedAt: number | null;
  lastUsedAt: number | null;
}

export interface KeyHourlyStat {
  hour: number;
  total: number;
  success: number;
  failed: number;
  totalQuota: number;
}

export interface UserUsageSummary {
  totalRecords: number;
  successRecords: number;
  failedRecords: number;
  successRate: number;
  avgTime: number;
  totalQuota: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  tokenCount: number;
  modelCount: number;
  firstUsedAt: number | null;
  lastUsedAt: number | null;
}

export interface UserHourlyStat {
  hour: number;
  total: number;
  success: number;
  failed: number;
  totalQuota: number;
  totalTokens: number;
}

export interface KeyQuotaResponseData {
  hours: HoursRange;
  token: KeyQuotaInfo;
  user: KeyUserInfo;
  usage_summary: KeyUsageSummary;
  hourly_stats: KeyHourlyStat[];
  user_usage_summary: UserUsageSummary;
  user_hourly_stats: UserHourlyStat[];
  top_models: ModelInfo[];
}

export interface ChannelInfo {
  channelId: number;
  channelType: number;
  status: number;
  responseTime: number;
  usedQuota: number;
  priority: number;
  weight: number;
  autoBan: number;
  tag: string;
  createdTime: number;
  testTime: number;
  balance: number;
  balanceUpdatedTime: number;
  remark: string;
}

export interface ChannelUsageSummary {
  totalRecords: number;
  successRecords: number;
  failedRecords: number;
  successRate: number;
  avgTime: number;
  totalQuota: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  modelCount: number;
  firstUsedAt: number | null;
  lastUsedAt: number | null;
}

export interface ChannelHourlyStat {
  hour: number;
  total: number;
  success: number;
  failed: number;
  totalQuota: number;
}

export interface ChannelRecordsResponseData {
  hours: HoursRange;
  channel: ChannelInfo;
  usage_summary: ChannelUsageSummary;
  hourly_stats: ChannelHourlyStat[];
  top_models: ModelInfo[];
}

export type HoursRange = number | 'all';

// Optional custom time range
export interface TimeOpts {
  start?: number;
  end?: number;
}

export interface QueryLogsParams {
  modelName: string;
  hours: HoursRange;
}

export interface ModelInfo {
  name: string;
  count: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  avgTime: number;
  firstUsedAt: number | null;
  lastUsedAt: number | null;
  totalQuota: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  avgTotalTokens: number;
  avgQuotaPerRequest: number;
  uniqueUsers: number;
  activeHours: number;
  peakHour: number | null;
  peakCount: number;
  streamRate: number;
  countChange: number | null;
}

export interface ConfigCheckResult {
  configured: boolean;
  message: string;
}
