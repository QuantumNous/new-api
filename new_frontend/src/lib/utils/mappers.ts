// 字段映射工具 - 处理后端下划线命名到前端驼峰命名的转换

export interface BackendUser {
  id: number;
  username: string;
  display_name: string;
  role: number;
  status: number;
  email?: string;
  github_id?: string;
  discord_id?: string;
  oidc_id?: string;
  wechat_id?: string;
  telegram_id?: string;
  group: string;
  quota: number;
  used_quota: number;
  request_count: number;
  aff_code: string;
  aff_count?: number;
  aff_quota?: number;
  aff_history_quota?: number;
  inviter_id?: number;
  linux_do_id?: string;
  setting?: any;
  stripe_customer?: string;
  sidebar_modules?: string[];
  permissions?: any;
}

export interface FrontendUser {
  id: number;
  username: string;
  displayName: string;
  role: number;
  status: number;
  email?: string;
  githubId?: string;
  discordId?: string;
  oidcId?: string;
  wechatId?: string;
  telegramId?: string;
  group: string;
  quota: number;
  usedQuota: number;
  requestCount: number;
  affCode: string;
  affCount?: number;
  affQuota?: number;
  affHistoryQuota?: number;
  inviterId?: number;
  linuxDoId?: string;
  setting?: any;
  stripeCustomer?: string;
  sidebarModules?: string[];
  permissions?: any;
}

export function mapBackendToFrontendUser(backend: BackendUser): FrontendUser {
  return {
    id: backend.id,
    username: backend.username,
    displayName: backend.display_name,
    role: backend.role,
    status: backend.status,
    email: backend.email,
    githubId: backend.github_id,
    discordId: backend.discord_id,
    oidcId: backend.oidc_id,
    wechatId: backend.wechat_id,
    telegramId: backend.telegram_id,
    group: backend.group,
    quota: backend.quota,
    usedQuota: backend.used_quota,
    requestCount: backend.request_count,
    affCode: backend.aff_code,
    affCount: backend.aff_count,
    affQuota: backend.aff_quota,
    affHistoryQuota: backend.aff_history_quota,
    inviterId: backend.inviter_id,
    linuxDoId: backend.linux_do_id,
    setting: backend.setting,
    stripeCustomer: backend.stripe_customer,
    sidebarModules: backend.sidebar_modules,
    permissions: backend.permissions,
  };
}

export interface BackendChannel {
  id: number;
  type: number;
  key: string;
  status: number;
  name: string;
  weight: number;
  created_time: number;
  test_time: number;
  response_time: number;
  base_url?: string;
  other?: string;
  balance: number;
  balance_updated_time: number;
  models: string[];
  group: string[];
  used_quota: number;
  model_mapping?: string;
  headers?: string;
  priority: number;
  auto_disable: number;
  status_code_mapping?: string;
  config?: string;
  plugin?: string;
  tag?: string;
}

export interface FrontendChannel {
  id: number;
  type: number;
  key: string;
  status: number;
  name: string;
  weight: number;
  createdTime: number;
  testTime: number;
  responseTime: number;
  baseUrl?: string;
  other?: string;
  balance: number;
  balanceUpdatedTime: number;
  models: string[];
  group: string[];
  usedQuota: number;
  modelMapping?: string;
  headers?: string;
  priority: number;
  autoDisable: number;
  statusCodeMapping?: string;
  config?: string;
  plugin?: string;
  tag?: string;
}

export function mapBackendToFrontendChannel(backend: BackendChannel): FrontendChannel {
  return {
    id: backend.id,
    type: backend.type,
    key: backend.key,
    status: backend.status,
    name: backend.name,
    weight: backend.weight,
    createdTime: backend.created_time,
    testTime: backend.test_time,
    responseTime: backend.response_time,
    baseUrl: backend.base_url,
    other: backend.other,
    balance: backend.balance,
    balanceUpdatedTime: backend.balance_updated_time,
    models: backend.models,
    group: backend.group,
    usedQuota: backend.used_quota,
    modelMapping: backend.model_mapping,
    headers: backend.headers,
    priority: backend.priority,
    autoDisable: backend.auto_disable,
    statusCodeMapping: backend.status_code_mapping,
    config: backend.config,
    plugin: backend.plugin,
    tag: backend.tag,
  };
}

export interface BackendToken {
  id: number;
  user_id: number;
  key: string;
  status: number;
  name: string;
  created_time: number;
  accessed_time: number;
  expired_time: number;
  remain_quota: number;
  unlimited_quota: boolean;
  used_quota: number;
  models: string[];
  subnet?: string;
  group?: string;
}

export interface FrontendToken {
  id: number;
  userId: number;
  key: string;
  status: number;
  name: string;
  createdTime: number;
  accessedTime: number;
  expiredTime: number;
  remainQuota: number;
  unlimitedQuota: boolean;
  usedQuota: number;
  models: string[];
  subnet?: string;
  group?: string;
}

export function mapBackendToFrontendToken(backend: BackendToken): FrontendToken {
  return {
    id: backend.id,
    userId: backend.user_id,
    key: backend.key,
    status: backend.status,
    name: backend.name,
    createdTime: backend.created_time,
    accessedTime: backend.accessed_time,
    expiredTime: backend.expired_time,
    remainQuota: backend.remain_quota,
    unlimitedQuota: backend.unlimited_quota,
    usedQuota: backend.used_quota,
    models: backend.models,
    subnet: backend.subnet,
    group: backend.group,
  };
}
