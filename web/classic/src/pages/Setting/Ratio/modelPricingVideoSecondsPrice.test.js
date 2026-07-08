import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVideoSecondsPriceValueFromModelMap,
  extractVideoSecondsPriceMap,
} from './modelPricingVideoSecondsPrice.js';

test('extractVideoSecondsPriceMap returns video seconds prices for visual editor', () => {
  const result = extractVideoSecondsPriceMap(`{
    "happyhorse-1.1-r2v": {
      "480p": { "default": 0.5 },
      "720p": { "default": 0.9, "silent": 0.6 },
      "1080p": { "default": 1.2 },
      "2k": { "default": 1.8 },
      "4k": { "silent": 2.6 }
    }
  }`);

  assert.deepEqual(result, {
    'happyhorse-1.1-r2v': {
      '480p_default': 0.5,
      '720p_default': 0.9,
      '720p_silent': 0.6,
      '1080p_default': 1.2,
      '2k_default': 1.8,
      '4k_silent': 2.6,
    },
  });
});

test('buildVideoSecondsPriceValueFromModelMap preserves unrelated models and updates target model', () => {
  const raw = `{
    "model-a": {
      "720p": { "default": 0.4 }
    }
  }`;

  const result = buildVideoSecondsPriceValueFromModelMap(raw, {
    'happyhorse-1.1-r2v': {
      '480p_default': 0.5,
      '720p_default': 0.9,
      '720p_silent': 0.6,
      '1080p_default': 1.2,
      '2k_default': 1.8,
      '4k_silent': 2.6,
    },
  });

  assert.deepEqual(JSON.parse(result), {
    'model-a': {
      '720p': { default: 0.4 },
    },
    'happyhorse-1.1-r2v': {
      '480p': { default: 0.5 },
      '720p': { default: 0.9, silent: 0.6 },
      '1080p': { default: 1.2 },
      '2k': { default: 1.8 },
      '4k': { silent: 2.6 },
    },
  });
});

test('buildVideoSecondsPriceValueFromModelMap deletes a model when all controlled fields are cleared', () => {
  const raw = `{
    "happyhorse-1.1-r2v": {
      "720p": { "default": 0.9, "silent": 0.6 },
      "1080p": { "default": 1.2 }
    },
    "model-a": {
      "720p": { "default": 0.4 }
    }
  }`;

  const result = buildVideoSecondsPriceValueFromModelMap(raw, {
    'happyhorse-1.1-r2v': {
      '480p_default': null,
      '480p_silent': null,
      '720p_default': null,
      '720p_silent': null,
      '1080p_default': null,
      '1080p_silent': null,
      '2k_default': null,
      '2k_silent': null,
      '4k_default': null,
      '4k_silent': null,
    },
  });

  assert.deepEqual(JSON.parse(result), {
    'model-a': {
      '720p': { default: 0.4 },
    },
  });
});

test('buildVideoSecondsPriceValueFromModelMap preserves unknown tiers for edited models', () => {
  const raw = `{
    "happyhorse-1.1-r2v": {
      "8k": { "default": 2.4 },
      "2k": { "silent": 1.9 },
      "720p": { "default": 0.9 }
    }
  }`;

  const result = buildVideoSecondsPriceValueFromModelMap(raw, {
    'happyhorse-1.1-r2v': {
      '480p_default': 0.4,
      '480p_silent': 0.3,
      '720p_default': 1.0,
      '720p_silent': 0.7,
      '1080p_default': 1.3,
      '1080p_silent': 1.1,
      '2k_default': 2.0,
      '2k_silent': 2.3,
    },
  });

  assert.deepEqual(JSON.parse(result), {
    'happyhorse-1.1-r2v': {
      '8k': { default: 2.4 },
      '480p': { default: 0.4, silent: 0.3 },
      '2k': { default: 2.0, silent: 2.3 },
      '720p': { default: 1.0, silent: 0.7 },
      '1080p': { default: 1.3, silent: 1.1 },
    },
  });
});
