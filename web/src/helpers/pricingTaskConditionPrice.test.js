import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateModelPrice, getModelPriceItems } from './utils.jsx';

test('calculateModelPrice returns task conditional prices when present', () => {
  const priceData = calculateModelPrice({
    record: {
      quota_type: 0,
      model_ratio: 23,
      task_condition_price: {
        '720p': { input_text_only: 46, input_with_video: 28 },
        '1080p': { input_text_only: 51, input_with_video: 31 },
      },
    },
    selectedGroup: 'all',
    groupRatio: {},
    tokenUnit: 'M',
    displayPrice: (value) => `$${value.toFixed(3)}`,
    currency: 'USD',
    quotaDisplayType: 'USD',
  });

  assert.equal(priceData.isTaskConditionalPricing, true);
  assert.equal(priceData.taskConditionalPrices['1080p'].inputWithVideo, '$31.000');

  const items = getModelPriceItems(priceData, (value) => value, 'USD');
  assert.equal(items[0].label, '720p Text Only');
  assert.equal(items[3].value, '$31.000');
});
