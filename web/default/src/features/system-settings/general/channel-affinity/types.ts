export interface KeySource {
  type: 'context_int' | 'context_string' | 'gjson'
  key?: string
  path?: string
}

export interface AffinityRule {
  id?: number
  name: string
  model_regex: string[]
  path_regex: string[]
  user_agent_include?: string[]
  key_sources: KeySource[]
  value_regex?: string
  ttl_seconds: number
  skip_retry_on_failure: boolean
  include_using_group: boolean
  include_model_name: boolean
  include_rule_name: boolean
  param_override_template?: Record<string, unknown> | null
}

export interface CacheStats {
  enabled: boolean
  total: number
  unknown: number
  by_rule_name: Record<string, number>
  cache_capacity: number
  cache_algo: string
}

export interface ChannelAffinitySettings {
  'channel_affinity_setting.enabled': boolean
  'channel_affinity_setting.switch_on_success': boolean
  'channel_affinity_setting.max_entries': number
  'channel_affinity_setting.default_ttl_seconds': number
  'channel_affinity_setting.rules': string
}
