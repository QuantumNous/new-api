import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTaskConditionRatioValue,
  extractVideoInputRatio,
} from './taskConditionRatio.js';

test('extractVideoInputRatio returns formatted video_input json', () => {
  const raw = JSON.stringify({
    video_input: {
      'doubao-seedance-1-0-pro-250528': 0.5,
    },
  });

  assert.equal(
    extractVideoInputRatio(raw),
    '{\n  "doubao-seedance-1-0-pro-250528": 0.5\n}',
  );
});

test('buildTaskConditionRatioValue merges video_input into existing conditions', () => {
  const raw = JSON.stringify({
    seconds: {
      'model-a': 1.2,
    },
  });

  assert.equal(
    buildTaskConditionRatioValue(
      raw,
      '{\n  "doubao-seedance-2-0-260128": 0.5\n}',
    ),
    JSON.stringify(
      {
        seconds: {
          'model-a': 1.2,
        },
        video_input: {
          'doubao-seedance-2-0-260128': 0.5,
        },
      },
      null,
      2,
    ),
  );
});
