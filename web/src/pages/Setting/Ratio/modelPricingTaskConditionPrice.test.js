import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTaskConditionPriceValueFromModelMap,
  extractTaskConditionPriceMap,
} from './modelPricingTaskConditionPrice.js';

test('extractTaskConditionPriceMap returns task condition prices for visual editor', () => {
  const result = extractTaskConditionPriceMap(`{
    "doubao-seedance-2-0": {
      "720p": { "input_text_only": 46, "input_with_video": 28 },
      "1080p": { "input_text_only": 51, "input_with_video": 31 }
    }
  }`);

  assert.deepEqual(result, {
    'doubao-seedance-2-0': {
      '720p_text_only': 46,
      '720p_video_input': 28,
      '1080p_text_only': 51,
      '1080p_video_input': 31,
    },
  });
});

test('buildTaskConditionPriceValueFromModelMap preserves unrelated models and updates target model', () => {
  const raw = `{
    "model-a": {
      "720p": { "input_text_only": 40, "input_with_video": 25 }
    }
  }`;

  const result = buildTaskConditionPriceValueFromModelMap(raw, {
    'doubao-seedance-2-0': {
      '720p_text_only': 46,
      '720p_video_input': 28,
      '1080p_text_only': 51,
      '1080p_video_input': 31,
    },
  });

  assert.deepEqual(JSON.parse(result), {
    'model-a': {
      '720p': { input_text_only: 40, input_with_video: 25 },
    },
    'doubao-seedance-2-0': {
      '720p': { input_text_only: 46, input_with_video: 28 },
      '1080p': { input_text_only: 51, input_with_video: 31 },
    },
  });
});

test('buildTaskConditionPriceValueFromModelMap deletes a model when all controlled fields are cleared', () => {
  const raw = `{
    "doubao-seedance-2-0": {
      "720p": { "input_text_only": 46, "input_with_video": 28 },
      "1080p": { "input_text_only": 51, "input_with_video": 31 }
    },
    "model-a": {
      "720p": { "input_text_only": 40, "input_with_video": 25 }
    }
  }`;

  const result = buildTaskConditionPriceValueFromModelMap(raw, {
    'doubao-seedance-2-0': {
      '720p_text_only': null,
      '720p_video_input': null,
      '1080p_text_only': null,
      '1080p_video_input': null,
    },
  });

  assert.deepEqual(JSON.parse(result), {
    'model-a': {
      '720p': { input_text_only: 40, input_with_video: 25 },
    },
  });
});

test('buildTaskConditionPriceValueFromModelMap preserves unknown resolution keys for edited models', () => {
  const raw = `{
    "doubao-seedance-2-0": {
      "480p": { "input_text_only": 46, "input_with_video": 28 },
      "720p": { "input_text_only": 46, "input_with_video": 28 }
    }
  }`;

  const result = buildTaskConditionPriceValueFromModelMap(raw, {
    'doubao-seedance-2-0': {
      '720p_text_only': 50,
      '720p_video_input': 30,
      '1080p_text_only': 55,
      '1080p_video_input': 35,
    },
  });

  assert.deepEqual(JSON.parse(result), {
    'doubao-seedance-2-0': {
      '480p': { input_text_only: 46, input_with_video: 28 },
      '720p': { input_text_only: 50, input_with_video: 30 },
      '1080p': { input_text_only: 55, input_with_video: 35 },
    },
  });
});
