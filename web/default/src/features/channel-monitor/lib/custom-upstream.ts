/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type {
  ChannelMonitorCustomKeyValue,
  ChannelMonitorCustomMetricConfig,
  ChannelMonitorCustomRequestConfig,
  ChannelMonitorCustomUpstreamConfig,
} from '../types'
import type { UpstreamConfigFormValues } from './schema'

type CustomMetricFormValue = UpstreamConfigFormValues['customConfig']['ratio']
type CustomRequestFormValue = CustomMetricFormValue['request']

function createCustomRequestFormValue(
  request: ChannelMonitorCustomRequestConfig | undefined
): CustomRequestFormValue {
  return {
    method: request?.method ?? 'GET',
    path: request?.path ?? '/api/monitor',
    query: (request?.query ?? []).map(toFormKeyValue),
    headers: (request?.headers ?? []).map(toFormKeyValue),
    bodyType: request?.body_type ?? 'none',
    body: request?.body ?? '',
    bodySecret: request?.body_secret ?? false,
    hasBody: request?.has_body ?? false,
    form: (request?.form ?? []).map(toFormKeyValue),
  }
}

function createCustomMetricFormValue(
  metric: ChannelMonitorCustomMetricConfig | undefined,
  fixedValue: number,
  valuePath: string
): CustomMetricFormValue {
  return {
    source: metric?.source ?? 'fixed',
    fixedValue: metric?.fixed_value ?? fixedValue,
    request: createCustomRequestFormValue(metric?.request),
    result: {
      responseType: metric?.result?.response_type ?? 'json',
      valuePath: metric?.result?.value_path ?? valuePath,
      multiplier: metric?.result?.multiplier ?? 1,
    },
  }
}

function toFormKeyValue(value: ChannelMonitorCustomKeyValue) {
  return {
    key: value.key,
    value: value.value ?? '',
    secret: value.secret ?? false,
    hasValue: value.has_value ?? false,
  }
}

function toAPIKeyValue(
  value: CustomRequestFormValue['query'][number]
): ChannelMonitorCustomKeyValue {
  return {
    key: value.key.trim(),
    value: value.value,
    secret: value.secret,
    has_value: value.hasValue,
  }
}

function toAPIRequest(
  request: CustomRequestFormValue
): ChannelMonitorCustomRequestConfig {
  return {
    method: request.method,
    path: request.path.trim(),
    query: request.query.map(toAPIKeyValue),
    headers: request.headers.map(toAPIKeyValue),
    body_type: request.bodyType,
    body: request.body,
    body_secret: request.bodySecret,
    has_body: request.hasBody,
    form: request.form.map(toAPIKeyValue),
  }
}

function toAPIMetric(
  metric: CustomMetricFormValue,
  omitRequest: boolean
): ChannelMonitorCustomMetricConfig {
  if (metric.source === 'fixed') {
    return { source: 'fixed', fixed_value: metric.fixedValue }
  }
  return {
    source: 'http',
    request: omitRequest ? undefined : toAPIRequest(metric.request),
    result: {
      response_type: metric.result.responseType,
      value_path: metric.result.valuePath.trim(),
      multiplier: metric.result.multiplier,
    },
  }
}

export function createChannelMonitorCustomFormConfig(
  config: ChannelMonitorCustomUpstreamConfig | undefined
): UpstreamConfigFormValues['customConfig'] {
  return {
    version: 1,
    ratio: createCustomMetricFormValue(config?.ratio, 1, 'data.ratio'),
    balance: createCustomMetricFormValue(config?.balance, 0, 'data.balance'),
    balanceReuseRatioRequest: config?.balance_reuse_ratio_request ?? false,
  }
}

export function createChannelMonitorCustomRequestConfig(
  config: UpstreamConfigFormValues['customConfig']
): ChannelMonitorCustomUpstreamConfig {
  return {
    version: 1,
    ratio: toAPIMetric(config.ratio, false),
    balance: toAPIMetric(config.balance, config.balanceReuseRatioRequest),
    balance_reuse_ratio_request: config.balanceReuseRatioRequest,
  }
}
