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
  DEFAULT_PLAYGROUND_ORDER_STEP,
  UNORDERED_PLAYGROUND_ORDER_BASE,
  applyCategoryRebalance,
  buildPlaygroundModelCollections,
  calculateInsertedOrder,
  parsePlaygroundModelRules,
  serializePlaygroundModelRules,
} from './playgroundModelRules.js';

test('parsePlaygroundModelRules keeps explicit empty categories as override', () => {
  const rules = parsePlaygroundModelRules([
    {
      model: 'gpt-4o',
      orders: { chat: 2, image: 8, invalid: 3 },
      categories: ['chat', 'image', 'chat'],
    },
    { model: 'flux-dev', categories: [] },
  ]);

  assert.deepEqual(rules, [
    {
      model: 'gpt-4o',
      orders: { chat: 2, image: 8, video: null },
      categories: ['chat', 'image'],
      hasCategoryOverride: true,
    },
    {
      model: 'flux-dev',
      orders: { chat: null, image: null, video: null },
      categories: [],
      hasCategoryOverride: true,
    },
  ]);
});

test('parsePlaygroundModelRules expands legacy order for all categories', () => {
  const rules = parsePlaygroundModelRules([
    { model: 'gpt-4o', order: 6, categories: ['chat'] },
  ]);

  assert.deepEqual(rules, [
    {
      model: 'gpt-4o',
      orders: { chat: 6, image: 6, video: 6 },
      categories: ['chat'],
      hasCategoryOverride: true,
    },
  ]);
});

test('buildPlaygroundModelCollections applies per-category custom ordering', () => {
  const pricingItems = [
    {
      model_name: 'gpt-4o',
      supported_endpoint_types: ['openai'],
    },
    {
      model_name: 'gpt-image-1',
      supported_endpoint_types: ['openai', 'image-generation'],
    },
    {
      model_name: 'kling-v1',
      supported_endpoint_types: ['openai-video'],
    },
  ];

  const rawRules = serializePlaygroundModelRules([
    {
      model: 'gpt-image-1',
      orders: {
        chat: 5,
        image: 20,
      },
      categories: ['chat', 'image'],
    },
    {
      model: 'kling-v1',
      orders: {
        image: 10,
        video: 1,
      },
      categories: ['video', 'image'],
    },
  ]);

  const collections = buildPlaygroundModelCollections(pricingItems, rawRules);

  assert.deepEqual(collections.chatModels, ['gpt-image-1', 'gpt-4o']);
  assert.deepEqual(collections.imageModels, ['kling-v1', 'gpt-image-1']);
  assert.deepEqual(collections.videoModels, ['kling-v1']);
});

test('buildPlaygroundModelCollections honors explicit empty categories override', () => {
  const pricingItems = [
    {
      model_name: 'flux-dev',
      supported_endpoint_types: ['openai'],
    },
  ];

  const rawRules = serializePlaygroundModelRules([
    {
      model: 'flux-dev',
      categories: [],
    },
  ]);

  const collections = buildPlaygroundModelCollections(pricingItems, rawRules);

  assert.deepEqual(collections.chatModels, []);
  assert.deepEqual(collections.imageModels, []);
  assert.deepEqual(collections.videoModels, []);
});

test('serializePlaygroundModelRules preserves per-category orders', () => {
  const rawRules = serializePlaygroundModelRules([
    {
      model: 'kling-v1',
      orders: {
        video: 10,
        image: 30,
      },
      categories: ['video', 'image'],
    },
    {
      model: 'gpt-4o',
      orders: {
        chat: 5,
      },
      categories: ['chat'],
    },
  ]);

  assert.match(rawRules, /"orders"/);
  assert.match(rawRules, /"video": 10/);
  assert.match(rawRules, /"chat": 5/);
});

test('calculateInsertedOrder uses midpoint between ranked neighbors', () => {
  const nextOrder = calculateInsertedOrder({
    orderedModels: ['a', 'b', 'c'],
    ordersByModel: {
      a: 100,
      b: 200,
      c: 300,
    },
    draggedModel: 'c',
    targetModel: 'b',
    position: 'before',
  });

  assert.equal(nextOrder, 150);
});

test('calculateInsertedOrder appends after ranked neighbors when dropping into unranked tail', () => {
  const nextOrder = calculateInsertedOrder({
    orderedModels: ['a', 'b', 'c'],
    ordersByModel: {
      a: 100,
      b: null,
      c: null,
    },
    draggedModel: 'c',
    targetModel: 'b',
    position: 'before',
  });

  assert.equal(
    nextOrder,
    (100 + (UNORDERED_PLAYGROUND_ORDER_BASE + 2 * DEFAULT_PLAYGROUND_ORDER_STEP)) /
      2,
  );
});

test('calculateInsertedOrder uses virtual fallback orders for fully unranked lists', () => {
  const nextOrder = calculateInsertedOrder({
    orderedModels: ['a', 'b', 'c'],
    ordersByModel: {
      a: null,
      b: null,
      c: null,
    },
    draggedModel: 'c',
    targetModel: 'b',
    position: 'before',
  });

  assert.equal(
    nextOrder,
    UNORDERED_PLAYGROUND_ORDER_BASE + 1.5 * DEFAULT_PLAYGROUND_ORDER_STEP,
  );
});

test('applyCategoryRebalance assigns stepped decimal-compatible orders', () => {
  const nextRules = applyCategoryRebalance({
    rulesByModel: {
      c: {
        categories: ['chat'],
        hasCategoryOverride: true,
        orders: { chat: null, image: null, video: null },
      },
    },
    orderedModels: ['b', 'c', 'a'],
    category: 'chat',
  });

  assert.deepEqual(nextRules.b.orders.chat, DEFAULT_PLAYGROUND_ORDER_STEP);
  assert.deepEqual(nextRules.c.orders.chat, DEFAULT_PLAYGROUND_ORDER_STEP * 2);
  assert.deepEqual(nextRules.a.orders.chat, DEFAULT_PLAYGROUND_ORDER_STEP * 3);
});

