import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTaskConditionRatioValueFromVideoInputMap,
  extractVideoInputRatioMap,
} from './modelPricingTaskCondition.js';

test('extractVideoInputRatioMap returns video_input ratios for visual editor', () => {
  const raw = JSON.stringify({
    seconds: {
      'model-a': 1.2,
    },
    video_input: {
      'doubao-seedance-1-0-pro-250528': 0.5,
      'doubao-seedance-2-0-260128': 0.6087,
    },
  });

  assert.deepEqual(extractVideoInputRatioMap(raw), {
    'doubao-seedance-1-0-pro-250528': 0.5,
    'doubao-seedance-2-0-260128': 0.6087,
  });
});

test('buildTaskConditionRatioValueFromVideoInputMap preserves other conditions and updates video_input', () => {
  const raw = JSON.stringify({
    seconds: {
      'model-a': 1.2,
    },
    video_input: {
      'old-model': 0.25,
    },
  });

  assert.equal(
    buildTaskConditionRatioValueFromVideoInputMap(raw, {
      'doubao-seedance-1-0-pro-250528': 0.5,
    }),
    JSON.stringify(
      {
        seconds: {
          'model-a': 1.2,
        },
        video_input: {
          'doubao-seedance-1-0-pro-250528': 0.5,
        },
      },
      null,
      2,
    ),
  );
});

test('buildTaskConditionRatioValueFromVideoInputMap removes empty video_input block', () => {
  const raw = JSON.stringify({
    seconds: {
      'model-a': 1.2,
    },
    video_input: {
      'old-model': 0.25,
    },
  });

  assert.equal(
    buildTaskConditionRatioValueFromVideoInputMap(raw, {}),
    JSON.stringify(
      {
        seconds: {
          'model-a': 1.2,
        },
      },
      null,
      2,
    ),
  );
});
