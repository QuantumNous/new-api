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
export function isTaskLog(other) {
  return other?.is_task === true || other?.task_id != null;
}

export function localizeTaskLogLine(line, t) {
  const text = String(line ?? '');
  if (!text.trim()) {
    return text;
  }

  if (text === '异步任务结算') {
    return 'Async task settlement';
  }

  if (text === '任务预扣费（将在任务完成后按实际token重算）') {
    return 'Task pre-consumption (will be recalculated by actual tokens after task completion)';
  }

  const actionMatch = text.match(/^操作\s+(.+)$/);
  if (actionMatch) {
    return `Action ${actionMatch[1]}`;
  }

  const inputPriceMatch = text.match(/^输入价格\s+(.+\s\/\s1M tokens)$/);
  if (inputPriceMatch) {
    return `Input Price ${inputPriceMatch[1]}`;
  }

  return text;
}

export function localizeTaskLogContent(content, t) {
  if (!content) {
    return '';
  }

  return String(content)
    .split(/\r?\n/)
    .map((line) => localizeTaskLogLine(line, t))
    .join('\n');
}

export function buildTaskBillingSummaryLines({
  other,
  content,
  t,
  formatPrice,
}) {
  if (!isTaskLog(other)) {
    return [];
  }

  const lines = [];
  const conditionalInputPrice = Number(other?.conditional_input_price);

  if (Number.isFinite(conditionalInputPrice) && conditionalInputPrice > 0) {
    lines.push(`Input Price ${formatPrice(conditionalInputPrice)} / 1M tokens`);
  }

  if (other?.billing_mode === 'video_seconds') {
    if (other?.video_seconds_tier) {
      lines.push(`Resolution ${other.video_seconds_tier}`);
    }
    if (other?.video_audio_enabled !== undefined) {
      lines.push(
        `Audio ${other.video_audio_enabled === true ? 'enabled' : 'silent'}`,
      );
    }
    if (Number.isFinite(Number(other?.video_duration_seconds))) {
      lines.push(`Duration ${Number(other.video_duration_seconds)}s`);
    }
    if (Number.isFinite(Number(other?.video_seconds_unit_price))) {
      lines.push(
        `Unit Price ${formatPrice(Number(other.video_seconds_unit_price))} / second`,
      );
    }
  }

  if (content) {
    lines.push(localizeTaskLogContent(content, t));
  } else if (other?.task_id != null) {
    lines.push('Async task settlement');
  } else {
    lines.push(
      'Task pre-consumption (will be recalculated by actual tokens after task completion)',
    );
  }

  return lines;
}

export function buildVideoSecondsBillingProcessLines({
  other,
  formatPrice,
  ratioLabel = 'Group ratio',
}) {
  if (other?.billing_mode !== 'video_seconds') {
    return [];
  }

  const unitPrice = Number(other?.video_seconds_unit_price);
  const durationSeconds = Number(other?.video_duration_seconds);
  const groupRatio = Number(other?.group_ratio ?? 1);
  const tier = String(other?.video_seconds_tier ?? '').toUpperCase();
  const audioLabel = other?.video_audio_enabled === true ? 'audio' : 'silent';

  if (!Number.isFinite(unitPrice) || !Number.isFinite(durationSeconds)) {
    return [];
  }

  const details = [];
  if (tier) {
    details.push(tier);
  }
  details.push(audioLabel);
  details.push(`${durationSeconds}s`);

  return [
    `Video Rate ${formatPrice(unitPrice)} / second`,
    `${details.join(' / ')} * ${ratioLabel} ${groupRatio} = ${formatPrice(unitPrice * durationSeconds * groupRatio)}`,
  ];
}
