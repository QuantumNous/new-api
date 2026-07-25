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
import * as pixels from './pixels'

describe('recall claim analytics isolation', () => {
  test('blocks Meta and TikTok initialization for direct and nested recall claim URLs', () => {
    assert.equal(typeof pixels.shouldInitializePixelsForURL, 'function')
    assert.equal(
      pixels.shouldInitializePixelsForURL?.(
        'https://console.example.com/sign-up?recall_claim=signed-secret'
      ),
      false
    )
    assert.equal(
      pixels.shouldInitializePixelsForURL?.(
        'https://console.example.com/sign-in?redirect=%2Fconsole%2Ftopup%3Frecall_claim%3Dsigned-secret'
      ),
      false
    )
  })

  test('keeps Meta and TikTok initialization enabled for ordinary auth URLs', () => {
    assert.equal(typeof pixels.shouldInitializePixelsForURL, 'function')
    assert.equal(
      pixels.shouldInitializePixelsForURL?.(
        'https://console.example.com/sign-in?redirect=%2Fkeys'
      ),
      true
    )
  })
})
