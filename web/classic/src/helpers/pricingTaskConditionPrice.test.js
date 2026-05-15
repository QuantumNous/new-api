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
  assert.equal(
    priceData.taskConditionalPrices['1080p'].inputWithVideo,
    '$31.000',
  );

  const items = getModelPriceItems(priceData, (value) => value, 'USD');
  assert.equal(items[0].label, '720p Text Only');
  assert.equal(items[3].value, '$31.000');
});
