/*
Copyright (C) 2023-2026 QuantumNous

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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  applyJsonSmartEnter,
  createScrollLayerSynchronizer,
  formatJsonDraft,
  getCursorLocation,
  getJsonValidationState,
} from '../json-code-editor-utils'

describe('json code editor utils', () => {
  test('treats empty drafts as valid editable JSON drafts', () => {
    assert.deepEqual(getJsonValidationState('  \n'), {
      isValid: true,
      messageKey: 'JSON',
    })
  })

  test('reports invalid JSON without throwing away the draft', () => {
    assert.deepEqual(getJsonValidationState('{"model": }'), {
      isValid: false,
      messageKey: 'Invalid JSON',
    })
  })

  test('formats valid JSON with stable two-space indentation', () => {
    assert.deepEqual(formatJsonDraft('{"model":{"ratio":2}}'), {
      didFormat: true,
      value: '{\n  "model": {\n    "ratio": 2\n  }\n}',
    })
  })

  test('keeps invalid JSON drafts unchanged when formatting is requested', () => {
    assert.deepEqual(formatJsonDraft('{"model": }'), {
      didFormat: false,
      value: '{"model": }',
    })
  })

  test('derives the one-based cursor line and column from text offsets', () => {
    assert.deepEqual(getCursorLocation('{\n  "model": 1\n}', 5), {
      line: 2,
      column: 4,
    })
  })

  test('expands paired JSON brackets with a nested indentation line', () => {
    assert.deepEqual(applyJsonSmartEnter('{}', 1, 1), {
      value: '{\n  \n}',
      selectionStart: 4,
      selectionEnd: 4,
    })
  })

  test('coalesces scroll updates while keeping line numbers horizontally fixed', () => {
    const source = { scrollLeft: 12, scrollTop: 40 }
    const contentLayer = { style: { transform: '' } }
    const lineNumberLayer = { style: { transform: '' } }
    const queuedFrames: Array<() => void> = []
    const synchronizer = createScrollLayerSynchronizer(
      source,
      { contentLayer, lineNumberLayer },
      (callback) => {
        queuedFrames.push(callback)
        return queuedFrames.length
      }
    )

    synchronizer.sync()
    source.scrollLeft = 24
    source.scrollTop = 80
    synchronizer.sync()

    assert.equal(queuedFrames.length, 1)

    queuedFrames[0]()

    assert.equal(contentLayer.style.transform, 'translate3d(-24px, -80px, 0)')
    assert.equal(lineNumberLayer.style.transform, 'translate3d(0, -80px, 0)')
  })
})
