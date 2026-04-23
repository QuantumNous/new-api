import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTaskBillingSummaryLines } from './taskBillingSummary.js';

function createTranslator() {
  return (template, vars = {}) =>
    Object.entries(vars).reduce(
      (result, [key, value]) =>
        result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value)),
      template,
    );
}

test('buildTaskBillingSummaryLines uses conditional input price for task pre-consume logs', () => {
  const t = createTranslator();

  const lines = buildTaskBillingSummaryLines({
    other: {
      is_task: true,
      conditional_input_price: 46,
    },
    content: '操作 generate',
    t,
    formatPrice: (value) => `$${value.toFixed(6)}`,
  });

  assert.deepEqual(lines, ['输入价格 $46.000000 / 1M tokens', '操作 generate']);
});

test('buildTaskBillingSummaryLines falls back to task settlement text without fake output pricing', () => {
  const t = createTranslator();

  const lines = buildTaskBillingSummaryLines({
    other: {
      task_id: 'task_123',
    },
    content: '',
    t,
    formatPrice: (value) => `$${value.toFixed(6)}`,
  });

  assert.deepEqual(lines, ['异步任务结算']);
});
