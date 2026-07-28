import type { LogItem } from '@/types/console'
import { formatTime } from '@/utils/format'

export const LOG_EXPORT_HEADERS = [
  'time',
  'token',
  'type',
  'model',
  'channel',
  'request_mode',
  'first_token_latency',
  'prompt_tokens',
  'completion_tokens',
  'cache_read_tokens',
  'cache_write_tokens',
  'cache_ttl',
  'latency',
  'tps',
  'quota',
  'content',
] as const

export function getLogExportValues(log: LogItem): Array<string | number> {
  return [
    formatTime(log.created),
    log.token_name,
    log.type,
    log.model,
    log.channel,
    log.request_mode ?? '',
    log.first_token_latency ?? '',
    log.prompt_tokens,
    log.completion_tokens,
    log.cache_read_tokens ?? '',
    log.cache_write_tokens ?? '',
    log.cache_ttl ?? '',
    log.latency,
    log.tps,
    log.quota,
    log.content,
  ]
}
