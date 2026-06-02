/*
Copyright (C) 2025 QuantumNous

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

import { renderQuota } from './render';

export function getLogOther(otherStr) {
  if (otherStr === undefined || otherStr === null || otherStr === '') {
    return {};
  }
  if (typeof otherStr === 'object') {
    return otherStr;
  }
  try {
    return JSON.parse(otherStr);
  } catch (e) {
    console.error(`Failed to parse record.other: "${otherStr}".`, e);
    return null;
  }
}

function stringifyLogEventParam(value) {
  if (value === undefined || value === null) {
    return '';
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatStructuredQuota(quota) {
  if (quota === undefined || quota === null || quota === '') {
    return '';
  }
  const numericQuota = Number(quota);
  if (Number.isFinite(numericQuota)) {
    return renderQuota(numericQuota);
  }
  return stringifyLogEventParam(quota);
}

function formatStructuredAmount(amount) {
  if (amount === undefined || amount === null || amount === '') {
    return '';
  }
  const numericAmount = Number(amount);
  if (Number.isFinite(numericAmount)) {
    return numericAmount.toString();
  }
  return stringifyLogEventParam(amount);
}

export function formatStructuredLogEvent(log, t) {
  const other = getLogOther(log?.other);
  const eventCode = other?.event_code;
  const params = other?.event_params || {};

  if (!eventCode) {
    return null;
  }

  switch (eventCode) {
    case 'topup.success':
      return t('充值成功：增加 {{quota}} 配额，金额 {{amount}}', {
        quota: formatStructuredQuota(params.quota ?? log?.quota),
        amount: formatStructuredAmount(params.amount ?? ''),
      });
    case 'consume.text':
      return t('已计费（文本请求）');
    case 'consume.audio':
      return t('已计费（音频请求）');
    case 'consume.task':
      return t('已计费（任务：{{action}}）', {
        action: stringifyLogEventParam(params.action ?? ''),
      });
    case 'violation_fee.charged':
      return t('违规扣费：{{quota}} 配额', {
        quota: formatStructuredQuota(params.fee_quota ?? log?.quota),
      });
    case 'task.refund':
      return t('任务退款：{{taskId}}', {
        taskId: stringifyLogEventParam(params.task_id ?? ''),
      });
    case 'task.settlement.charge':
      return t('任务补扣费：{{delta}} 配额', {
        delta: formatStructuredQuota(params.delta_quota ?? log?.quota),
      });
    case 'task.settlement.refund':
      return t('任务退还费用：{{delta}} 配额', {
        delta: formatStructuredQuota(params.delta_quota ?? log?.quota),
      });
    default:
      return null;
  }
}
