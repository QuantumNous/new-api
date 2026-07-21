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
  advanceOptionCasBaselines,
  createOptionCasBaselines,
} from './ratio-settings-cas'

describe('ratio settings CAS baselines', () => {
  test('advances only successfully saved values for consecutive saves', () => {
    const original = {
      ModelPrice: '{\n  "image-model": 0.1\n}',
      ModelRatio: '{\n  "chat-model": 1\n}',
      ExposeRatioEnabled: false,
    }
    const firstSave = {
      ModelPrice: '{"image-model":0.2}',
      ModelRatio: '{"chat-model":1}',
      ExposeRatioEnabled: false,
    }

    const initialBaselines = createOptionCasBaselines(original)
    const nextBaselines = advanceOptionCasBaselines(
      initialBaselines,
      ['ModelPrice'],
      firstSave
    )

    assert.equal(nextBaselines.ModelPrice, firstSave.ModelPrice)
    assert.equal(nextBaselines.ModelRatio, original.ModelRatio)
    assert.equal(nextBaselines.ExposeRatioEnabled, 'false')

    const secondSave = {
      ...firstSave,
      ModelPrice: '{"image-model":0.3}',
    }
    const finalBaselines = advanceOptionCasBaselines(
      nextBaselines,
      ['ModelPrice'],
      secondSave
    )

    assert.equal(finalBaselines.ModelPrice, secondSave.ModelPrice)
  })
})
