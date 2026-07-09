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
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTaskBillingSummaryLines,
  buildVideoSecondsBillingProcessLines,
  localizeTaskLogLine,
} from './taskBillingSummary.js';

function createTranslator() {
  const dictionary = {
    '输入价格 {{price}} / 1M tokens': 'Input Price {{price}} / 1M tokens',
    异步任务结算: 'Async task settlement',
    '任务预扣费（将在任务完成后按实际token重算）':
      'Task pre-consumption (will be recalculated by actual tokens after task completion)',
    操作: 'Action',
  };

  return (template, vars = {}) => {
    const translated = dictionary[template] || template;
    return Object.entries(vars).reduce(
      (result, [key, value]) =>
        result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value)),
      translated,
    );
  };
}

test('localizeTaskLogLine falls back to English for task operation lines', () => {
  const t = createTranslator();

  assert.equal(localizeTaskLogLine('操作 generate', t), 'Action generate');
});

test('buildTaskBillingSummaryLines localizes task billing content lines', () => {
  const t = createTranslator();

  const lines = buildTaskBillingSummaryLines({
    other: {
      is_task: true,
      conditional_input_price: 46,
    },
    content: '操作 generate',
    t,
    formatPrice: (value) => `$${value.toFixed(2)}`,
  });

  assert.deepEqual(lines, [
    'Input Price $46.00 / 1M tokens',
    'Action generate',
  ]);
});

test('buildTaskBillingSummaryLines falls back to English settlement text', () => {
  const t = createTranslator();

  const lines = buildTaskBillingSummaryLines({
    other: {
      task_id: 'task_123',
    },
    content: '',
    t,
    formatPrice: (value) => `$${value.toFixed(2)}`,
  });

  assert.deepEqual(lines, ['Async task settlement']);
});

test('buildTaskBillingSummaryLines includes video seconds details', () => {
  const t = createTranslator();

  const lines = buildTaskBillingSummaryLines({
    other: {
      is_task: true,
      billing_mode: 'video_seconds',
      video_seconds_tier: '720p',
      video_audio_enabled: false,
      video_duration_seconds: 5,
      video_seconds_unit_price: 0.6,
    },
    content: 'Action textGenerate',
    t,
    formatPrice: (value) => `$${value.toFixed(2)}`,
  });

  assert.deepEqual(lines, [
    'Resolution 720p',
    'Audio silent',
    'Duration 5s',
    'Unit Price $0.60 / second',
    'Action textGenerate',
  ]);
});

test('buildVideoSecondsBillingProcessLines renders seconds pricing formula', () => {
  const lines = buildVideoSecondsBillingProcessLines({
    other: {
      billing_mode: 'video_seconds',
      group_ratio: 1,
      video_seconds_tier: '1080p',
      video_audio_enabled: true,
      video_duration_seconds: 5,
      video_seconds_unit_price: 1.2,
    },
    formatPrice: (value) => `$${value.toFixed(6)}`,
  });

  assert.deepEqual(lines, [
    'Video Rate $1.200000 / second',
    '1080P / audio / 5s * Group ratio 1 = $6.000000',
  ]);
});
