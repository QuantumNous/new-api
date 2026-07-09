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

function createTestDocument() {
  const emptyList = [];
  const canvasContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    fillRect() {},
    clearRect() {},
    getImageData() {
      return { data: [0, 0, 0, 0] };
    },
    putImageData() {},
    createImageData() {
      return [];
    },
    setTransform() {},
    drawImage() {},
    save() {},
    fillText() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    stroke() {},
    translate() {},
    scale() {},
    rotate() {},
    arc() {},
    fill() {},
    measureText() {
      return { width: 0 };
    },
    transform() {},
    rect() {},
    clip() {},
  };
  return {
    body: {
      appendChild() {},
      removeChild() {},
    },
    head: {
      appendChild() {},
      removeChild() {},
    },
    createElement() {
      return {
        style: {},
        setAttribute() {},
        appendChild() {},
        removeChild() {},
        getContext() {
          return canvasContext;
        },
      };
    },
    getElementsByTagName() {
      return emptyList;
    },
    querySelectorAll() {
      return emptyList;
    },
  };
}

async function loadPricingHelpers() {
  if (!globalThis.window) {
    globalThis.window = globalThis;
  }
  if (!globalThis.document) {
    globalThis.document = createTestDocument();
  }
  if (!globalThis.window.document) {
    globalThis.window.document = globalThis.document;
  }
  if (!globalThis.window.matchMedia) {
    globalThis.window.matchMedia = () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    });
  }
  if (!globalThis.localStorage) {
    globalThis.localStorage = {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    };
  }
  if (!globalThis.Element) {
    globalThis.Element = function Element() {};
    globalThis.Element.prototype.matches = () => false;
    globalThis.Element.prototype.closest = () => null;
  }
  if (!globalThis.window.Element) {
    globalThis.window.Element = globalThis.Element;
  }

  return import('./utils.jsx');
}

test(
  'calculateModelPrice returns task conditional prices when present',
  { timeout: 60000 },
  async () => {
  const { calculateModelPrice, getModelPriceItems } =
    await loadPricingHelpers();
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
  assert.equal(priceData.taskConditionalPrices['1080p'].inputWithVideo, '$31');

  const items = getModelPriceItems(priceData, (value) => value, 'USD');
  assert.equal(items[0].label, '720p Text Only');
  assert.equal(items[3].value, '$31');
  },
);

test(
  'calculateModelPrice returns video seconds prices when present',
  { timeout: 60000 },
  async () => {
  const { calculateModelPrice, getModelPriceItems } =
    await loadPricingHelpers();
  const priceData = calculateModelPrice({
    record: {
      quota_type: 1,
      billing_mode: 'video_seconds',
      video_seconds_price: {
        '720p': { default: 0.9, silent: 0.6 },
        '1080p': { default: 1.2 },
      },
    },
    selectedGroup: 'all',
    groupRatio: {},
    tokenUnit: 'M',
    displayPrice: (value) => `$${value.toFixed(3)}`,
    currency: 'USD',
    quotaDisplayType: 'USD',
  });

  assert.equal(priceData.isVideoSecondsPricing, true);
  assert.equal(priceData.videoSecondsPrices['720p'].silent, '$0.600');

  const items = getModelPriceItems(priceData, (value) => value, 'USD');
  assert.equal(items[0].label, '720p default');
  assert.equal(
    items.find((item) => item.key === '1080p-default')?.value,
    '$1.200',
  );
  assert.equal(
    items.find((item) => item.key === '1080p-audio'),
    undefined,
  );
  },
);
