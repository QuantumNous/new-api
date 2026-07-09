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
} from './taskBillingSummary.js';

function createTranslator() {
  return (template, vars = {}) =>
    Object.entries(vars).reduce(
      (result, [key, value]) =>
        result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value)),
      template,
    );
}

test('buildTaskBillingSummaryLines includes localized video seconds details', () => {
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

test('buildTaskBillingSummaryLines falls back to settlement text', () => {
  const t = createTranslator();

  const lines = buildTaskBillingSummaryLines({
    other: {
      task_id: 'task_123',
    },
    content: '',
    t,
    formatPrice: (value) => `$${value.toFixed(2)}`,
  });

  assert.deepEqual(lines, [
    'Async task settlement',
  ]);
});

test('buildVideoSecondsBillingProcessLines renders seconds pricing formula', () => {
  const t = createTranslator();

  const lines = buildVideoSecondsBillingProcessLines({
    other: {
      billing_mode: 'video_seconds',
      group_ratio: 1,
      video_seconds_tier: '1080p',
      video_audio_enabled: true,
      video_duration_seconds: 5,
      video_seconds_unit_price: 1.2,
    },
    t,
    formatPrice: (value) => `$${value.toFixed(6)}`,
    ratioLabel: 'Group ratio',
  });

  assert.deepEqual(lines, [
    'Video Rate $1.200000 / second',
    '1080P / audio / 5s * Group ratio 1 = $6.000000',
  ]);
});
