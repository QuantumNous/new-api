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
import { act, renderHook } from '@testing-library/react'
import { toast } from 'sonner'
import { describe, expect, it, vi } from 'vitest'

import { usePlaygroundConversation } from '../use-playground-conversation'

function renderConversation(model: string) {
  const sendChat = vi.fn()
  const updateMessages = vi.fn()
  const { result } = renderHook(() =>
    usePlaygroundConversation({
      messages: [],
      model,
      updateMessages,
      sendChat,
    })
  )
  return { result, sendChat, updateMessages }
}

describe('sending without a model', () => {
  it('sends no request and tells the user to pick a model', () => {
    const notify = vi.spyOn(toast, 'error').mockReturnValue('no-model')
    const { result, sendChat, updateMessages } = renderConversation('')

    let sent = true
    act(() => {
      sent = result.current.handleSendMessage('Code')
    })

    expect(sent).toBe(false)
    expect(sendChat).not.toHaveBeenCalled()
    expect(updateMessages).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('Please select a model first')
  })

  it('sends the message once a model is selected', () => {
    const { result, sendChat } = renderConversation('claude-haiku-5-5')

    let sent = false
    act(() => {
      sent = result.current.handleSendMessage('Code')
    })

    expect(sent).toBe(true)
    expect(sendChat).toHaveBeenCalledTimes(1)
  })
})
