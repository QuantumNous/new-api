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
import { describe, expect, test } from 'bun:test'
import { getUserModelAccess } from '../api'
import {
  createModelAccessQueryOptions,
  modelAccessQueryKeys,
} from './use-model-access'

describe('model access query options', () => {
  test('shares one stable request per authenticated user', () => {
    const options = createModelAccessQueryOptions(42)

    expect(options.queryKey).toEqual(['user-model-access', 'detail', 42])
    expect(options.queryKey).toEqual(modelAccessQueryKeys.detail(42))
    expect(options.queryFn).toBe(getUserModelAccess)
    expect(options.staleTime).toBe(5 * 60 * 1000)
    expect(options.enabled).toBe(true)
  })

  test('isolates cached model access between authenticated users', () => {
    expect(createModelAccessQueryOptions(1).queryKey).not.toEqual(
      createModelAccessQueryOptions(2).queryKey
    )
  })

  test('disables the request when no authenticated user exists', () => {
    const options = createModelAccessQueryOptions(undefined)

    expect(options.queryKey).toEqual(['user-model-access', 'detail', null])
    expect(options.enabled).toBe(false)
  })
})
