import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTaskBillingSummaryLines,
  localizeTaskLogLine,
} from './taskBillingSummary.js';

function createTranslator() {
  const dictionary = {
    '输入价格 {{price}} / 1M tokens': 'Input Price {{price}} / 1M tokens',
    '异步任务结算': 'Async task settlement',
    '任务预扣费（将在任务完成后按实际token重算）':
      'Task pre-consumption (will be recalculated by actual tokens after task completion)',
    '操作': 'Action',
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

  assert.deepEqual(lines, ['Input Price $46.00 / 1M tokens', 'Action generate']);
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
