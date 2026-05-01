import assert from 'node:assert/strict'

import { getTaskActionLabel } from './task-action-label.ts'

assert.equal(
  getTaskActionLabel({ upstream_kind: 'asset' }, 'Image to Video'),
  'Asset Upload'
)

assert.equal(
  getTaskActionLabel({ action: 'assetUpload' }, 'Image to Video'),
  'Asset Upload'
)

assert.equal(
  getTaskActionLabel({ upstream_kind: 'image' }, 'Image to Video'),
  'Image Generation'
)

assert.equal(
  getTaskActionLabel({}, 'Image to Video'),
  'Image to Video'
)
