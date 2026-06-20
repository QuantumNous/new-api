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

export function formatTokens(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return Math.max(0, Math.round(number)).toLocaleString();
}

export function formatLatency(milliseconds) {
  const number = Number(milliseconds);
  if (!Number.isFinite(number) || number <= 0) return '--';
  if (number < 1000) return `${Math.round(number)} ms`;
  return `${(number / 1000).toFixed(2)} s`;
}

export function formatThroughput(tokensPerSecond) {
  const number = Number(tokensPerSecond);
  if (!Number.isFinite(number) || number <= 0) return '--';
  return `${number.toFixed(1)} tok/s`;
}

export function formatCost(providerCost, chargedCost) {
  const cost =
    typeof providerCost === 'number'
      ? providerCost
      : typeof providerCost === 'string'
        ? Number(providerCost)
        : chargedCost;
  if (!Number.isFinite(cost) || cost < 0) return '--';
  return `$${cost.toFixed(cost < 0.01 ? 6 : 4)}`;
}

export function stringifyDebugValue(value) {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function normalizedPromptUnits(prompt) {
  if (prompt?.units?.length > 0) return prompt.units;
  let cumulative = 0;
  return (prompt?.messages ?? []).map((message) => {
    const estimatedTokens = message.estimated_tokens ?? 0;
    const start = cumulative;
    cumulative += estimatedTokens;
    return {
      index: message.index,
      message_index: message.index,
      path: `messages[${message.index}].content`,
      role: message.role,
      kind: 'text',
      content_preview: message.content,
      estimated_tokens: estimatedTokens,
      cumulative_start: start,
      cumulative_end: cumulative,
      cache_overlap_tokens: message.cached ? estimatedTokens : 0,
      cache_status: message.cached ? 'hit' : 'unknown',
      token_source: 'local_estimate',
      cache_source: message.cached ? 'legacy_message_flag' : 'legacy_message',
      confidence: message.cached ? 'inferred' : 'estimated',
    };
  });
}

export function derivePromptCacheView(
  units,
  promptTokens,
  cachedTokens,
  existingBoundary,
) {
  if (!units?.length || promptTokens <= 0) {
    return { units: units ?? [], boundary: existingBoundary };
  }
  const hitRate = Math.min(1, Math.max(0, cachedTokens / promptTokens));
  const estimatedTotal = units.reduce(
    (total, unit) => Math.max(total, unit.cumulative_end || 0),
    0,
  );
  const estimatedCachedTokens = Math.round(hitRate * estimatedTotal);
  let breakUnit;
  const resolvedUnits = units.map((unit) => {
    const overlap = Math.min(
      Math.max(estimatedCachedTokens - unit.cumulative_start, 0),
      unit.estimated_tokens,
    );
    let cacheStatus = 'partial';
    if (unit.estimated_tokens === 0) {
      cacheStatus =
        (estimatedCachedTokens > 0 &&
          unit.cumulative_start <= estimatedCachedTokens) ||
        (estimatedCachedTokens > 0 && estimatedCachedTokens >= estimatedTotal)
          ? 'hit'
          : 'miss';
    } else if (overlap <= 0) {
      cacheStatus = 'miss';
    } else if (overlap >= unit.estimated_tokens) {
      cacheStatus = 'hit';
    }
    if (
      !breakUnit &&
      unit.estimated_tokens > 0 &&
      unit.cumulative_end > estimatedCachedTokens
    ) {
      breakUnit = unit;
    }
    return {
      ...unit,
      cache_overlap_tokens: overlap,
      cache_status: cacheStatus,
      cache_source: 'cache_boundary_inference',
      confidence: 'inferred',
    };
  });
  if (!breakUnit) breakUnit = units[units.length - 1];
  return {
    units: resolvedUnits,
    boundary: {
      ...existingBoundary,
      cached_tokens: cachedTokens,
      prompt_tokens: promptTokens,
      cache_hit_rate: existingBoundary?.cache_hit_rate ?? hitRate,
      estimated_cached_tokens:
        existingBoundary?.estimated_cached_tokens ?? estimatedCachedTokens,
      break_unit_index:
        existingBoundary?.break_unit_index ?? breakUnit?.index ?? -1,
      break_unit_path: existingBoundary?.break_unit_path ?? breakUnit?.path,
      break_unit_role: existingBoundary?.break_unit_role ?? breakUnit?.role,
      break_offset_tokens:
        existingBoundary?.break_offset_tokens ??
        (breakUnit
          ? Math.min(
              breakUnit.estimated_tokens,
              Math.max(estimatedCachedTokens - breakUnit.cumulative_start, 0),
            )
          : 0),
      source: existingBoundary?.source ?? 'cache_boundary_inference',
      confidence: existingBoundary?.confidence ?? 'inferred',
    },
  };
}

export function roleCountsFromMessages(messages = []) {
  return messages.reduce((counts, message) => {
    const role = message.role || 'unknown';
    counts[role] = (counts[role] ?? 0) + 1;
    return counts;
  }, {});
}

export function cacheStatusColor(status) {
  if (status === 'hit') return 'green';
  if (status === 'partial') return 'orange';
  if (status === 'miss') return 'grey';
  if (status === 'write') return 'blue';
  return 'light-blue';
}

export function cacheStatusBackground(status) {
  if (status === 'hit') return 'var(--semi-color-success)';
  if (status === 'partial') return 'var(--semi-color-warning)';
  if (status === 'miss') return 'var(--semi-color-tertiary)';
  if (status === 'write') return 'var(--semi-color-info)';
  return 'var(--semi-color-info-light-default)';
}

export function cacheStatusLabel(status, t) {
  if (status === 'hit') return t('cache_status.hit', { defaultValue: 'hit' });
  if (status === 'partial')
    return t('cache_status.partial', { defaultValue: 'partial' });
  if (status === 'miss')
    return t('cache_status.miss', { defaultValue: 'miss' });
  if (status === 'write')
    return t('cache_status.write', { defaultValue: 'write' });
  return t('cache_status.unknown', { defaultValue: 'unknown' });
}

export function confidenceLabel(confidence, t) {
  if (confidence === 'exact')
    return t('confidence.exact', { defaultValue: 'exact' });
  if (confidence === 'inferred')
    return t('confidence.inferred', { defaultValue: 'inferred' });
  if (confidence === 'estimated')
    return t('confidence.estimated', { defaultValue: 'estimated' });
  return confidence || t('Unknown');
}

export function roleLabel(role, t) {
  if (role === 'system') return t('role.system', { defaultValue: 'system' });
  if (role === 'developer')
    return t('role.developer', { defaultValue: 'developer' });
  if (role === 'user') return t('role.user', { defaultValue: 'user' });
  if (role === 'assistant')
    return t('role.assistant', { defaultValue: 'assistant' });
  if (role === 'tool') return t('role.tool', { defaultValue: 'tool' });
  if (role === 'function')
    return t('role.function', { defaultValue: 'function' });
  return role || t('Unknown');
}

export function unitKindLabel(kind, t) {
  if (kind === 'text') return t('unit_kind.text', { defaultValue: 'text' });
  if (kind === 'tool_schema')
    return t('unit_kind.tool_schema', { defaultValue: 'tool schema' });
  if (kind === 'tool_choice')
    return t('unit_kind.tool_choice', { defaultValue: 'tool choice' });
  if (kind === 'response_format')
    return t('unit_kind.response_format', { defaultValue: 'response format' });
  if (kind === 'metadata')
    return t('unit_kind.metadata', { defaultValue: 'metadata' });
  return kind || t('Unknown');
}

export function sourceLabel(source, t) {
  if (source === 'legacy_message')
    return t('source.legacy_message', { defaultValue: 'legacy message' });
  if (source === 'legacy_message_flag')
    return t('source.legacy_message_flag', {
      defaultValue: 'legacy message flag',
    });
  if (source === 'cache_boundary_inference') {
    return t('source.cache_boundary_inference', {
      defaultValue: 'cache boundary inference',
    });
  }
  if (source === 'local_estimate')
    return t('source.local_estimate', { defaultValue: 'local estimate' });
  if (source === 'provider_usage')
    return t('source.provider_usage', { defaultValue: 'provider usage' });
  if (source === 'billing_inference')
    return t('source.billing_inference', {
      defaultValue: 'billing inference',
    });
  return source || t('Unknown');
}

export function finishReasonLabel(reason, t) {
  if (reason === 'tool_calls')
    return t('finish_reason.tool_calls', { defaultValue: 'tool calls' });
  if (reason === 'stop')
    return t('finish_reason.stop', { defaultValue: 'stop' });
  if (reason === 'length')
    return t('finish_reason.length', { defaultValue: 'length' });
  if (reason === 'content_filter')
    return t('finish_reason.content_filter', {
      defaultValue: 'content filter',
    });
  return reason || '--';
}
