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
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { sendCodexInvite } from '../api'
import { getCodexInviteFailedEmails } from '../lib/codex-invite-send-result'

type CodexInviteSendState = {
  ok: boolean
  failedEmails: string[]
}

type CodexInviteSendOptions = {
  confirmedRecipientConsent?: boolean
}

export function useCodexInviteSender() {
  const { t } = useTranslation()
  const [isSending, setIsSending] = useState(false)
  const sendingRef = useRef(false)

  const send = async (
    channelId: number,
    emails: string[],
    options: CodexInviteSendOptions = {}
  ): Promise<CodexInviteSendState> => {
    if (sendingRef.current) return { ok: false, failedEmails: emails }
    sendingRef.current = true
    setIsSending(true)
    try {
      const res = await sendCodexInvite(channelId, emails, options)
      if (!res?.success) {
        toast.error(res?.message || t('Failed to send Codex invite'))
        return { ok: false, failedEmails: emails }
      }

      const failed = getCodexInviteFailedEmails(res)
      if (failed.length > 0) {
        toast.error(
          t('Invite failed for: {{emails}}', { emails: failed.join(', ') })
        )
        return { ok: false, failedEmails: failed }
      }

      toast.success(t('Codex invite sent'))
      return { ok: true, failedEmails: [] }
    } catch {
      toast.error(t('Failed to send Codex invite'))
      return { ok: false, failedEmails: emails }
    } finally {
      sendingRef.current = false
      setIsSending(false)
    }
  }

  return { isSending, send }
}
