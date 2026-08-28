/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'
import { forwardRef, useImperativeHandle } from 'react'
import { useForm } from 'react-hook-form'
import { describe, expect, test, vi } from 'vitest'

import { ModelRatioForm } from '../model-ratio-form'

const commitOpenEditor = vi.fn(async () => true)
let saveAppliedPrice: (() => Promise<boolean>) | undefined

vi.mock('../model-ratio-visual-editor', () => ({
  ModelRatioVisualEditor: forwardRef(function MockVisualEditor(
    props: { onApplyPriceMatchSave?: () => Promise<boolean> },
    ref
  ) {
    useImperativeHandle(ref, () => ({ commitOpenEditor }))
    saveAppliedPrice = props.onApplyPriceMatchSave
    return null
  }),
}))

const initialValues = {
  ModelPrice: '{}',
  ModelRatio: '{}',
  CacheRatio: '{}',
  CreateCacheRatio: '{}',
  CompletionRatio: '{}',
  ImageRatio: '{}',
  AudioRatio: '{}',
  AudioCompletionRatio: '{}',
  ExposeRatioEnabled: false,
  BillingMode: '{}',
  BillingExpr: '{}',
}

function TestForm(props: {
  onSave: (values: typeof initialValues) => Promise<void>
}) {
  const form = useForm({ defaultValues: initialValues })
  return (
    <ModelRatioForm
      form={form}
      savedValues={initialValues}
      onSave={props.onSave}
      onReset={() => undefined}
      isSaving={false}
      isResetting={false}
    />
  )
}

describe('model ratio form', () => {
  test('saves an applied price without committing a stale open editor', async () => {
    commitOpenEditor.mockClear()
    const onSave = vi.fn(async () => undefined)
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <TestForm onSave={onSave} />
      </QueryClientProvider>
    )

    expect(saveAppliedPrice).toBeTypeOf('function')
    await act(async () => {
      await saveAppliedPrice?.()
    })

    expect(commitOpenEditor).not.toHaveBeenCalled()
    expect(onSave).toHaveBeenCalledWith(initialValues)
    queryClient.clear()
  })
})
