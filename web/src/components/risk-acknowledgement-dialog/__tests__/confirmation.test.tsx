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
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { RiskAcknowledgementDialog } from '@/components/risk-acknowledgement-dialog'

const requiredTextParts = [
  { type: 'input', text: '我已阅读并理解上述合规提醒' },
  { type: 'static', text: '，' },
  { type: 'input', text: '确认相关法律风险' },
  { type: 'static', text: '，并' },
  { type: 'input', text: '确认承担因部署' },
  { type: 'static', text: '、' },
  { type: 'input', text: '运营和收费行为产生的法律责任' },
] satisfies ComponentProps<
  typeof RiskAcknowledgementDialog
>['requiredTextParts']

function renderConfirmation(
  props: Partial<ComponentProps<typeof RiskAcknowledgementDialog>> = {}
) {
  const onConfirm = vi.fn()
  render(
    <RiskAcknowledgementDialog
      open
      onOpenChange={() => {}}
      title='Confirm compliance terms'
      requiredTextParts={requiredTextParts}
      onConfirm={onConfirm}
      {...props}
    />
  )
  return { user: userEvent.setup(), onConfirm }
}

describe('risk acknowledgement confirmation', () => {
  it.each(['compositionEnd', 'blur'] as const)(
    'enables confirmation when %s commits the final text without another input event',
    async (commitEvent) => {
      const { user, onConfirm } = renderConfirmation()
      const confirm = screen.getByRole('button', { name: 'Confirm' })

      for (const part of requiredTextParts) {
        if (part.type !== 'input') continue
        const input = screen.getByPlaceholderText(part.text)
        await user.click(input)
        fireEvent.compositionStart(input)
        fireEvent.input(input, {
          target: { value: part.text.slice(0, -1) },
          isComposing: true,
          inputType: 'insertCompositionText',
        })
        expect(confirm).toBeDisabled()

        // The committed DOM value can arrive at the composition/blur boundary
        // without React receiving another change event for that final value.
        fireEvent[commitEvent](input, {
          target: { value: part.text },
          data: part.text.slice(-1),
        })
        expect(input).toHaveValue(part.text)
      }

      expect(confirm).toBeEnabled()
      await user.click(confirm)
      expect(onConfirm).toHaveBeenCalledOnce()
    }
  )

  it('requires every segment to match after typing, pasting, and deleting text', async () => {
    const { user, onConfirm } = renderConfirmation()
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    expect(confirm).toBeDisabled()

    for (const part of requiredTextParts) {
      if (part.type !== 'input') continue
      await user.type(screen.getByPlaceholderText(part.text), part.text)
    }
    expect(confirm).toBeEnabled()

    const input = screen.getByPlaceholderText('确认相关法律风险')
    await user.clear(input)
    expect(confirm).toBeDisabled()
    await user.paste('确认相关法律风')
    expect(confirm).toBeDisabled()
    expect(input).toHaveAttribute('aria-invalid', 'true')

    await user.clear(input)
    await user.paste('确认相关法律风险')
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it.each(['compositionEnd', 'blur'] as const)(
    'accepts a single text committed on %s only after the checklist is checked',
    async (commitEvent) => {
      const { user } = renderConfirmation({
        requiredTextParts: [],
        requiredText: '我已阅读并理解上述合规提醒',
        checklist: ['I understand the risks'],
      })
      const input = screen.getByRole('textbox')
      const confirm = screen.getByRole('button', { name: 'Confirm' })
      await user.click(input)
      fireEvent.compositionStart(input)
      fireEvent.input(input, {
        target: { value: '我已阅读并理解上述合规提' },
        isComposing: true,
      })
      fireEvent[commitEvent](input, {
        target: { value: '我已阅读并理解上述合规提醒' },
        data: '醒',
      })
      expect(confirm).toBeDisabled()

      await user.click(
        screen.getByRole('checkbox', { name: 'I understand the risks' })
      )
      expect(input).toHaveValue('我已阅读并理解上述合规提醒')
      expect(confirm).toBeEnabled()
      await user.clear(input)
      expect(confirm).toBeDisabled()
    }
  )
})
