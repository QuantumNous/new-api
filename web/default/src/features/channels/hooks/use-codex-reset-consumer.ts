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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { consumeCodexReset, getCodexUsage } from '../api'
import type { CodexUsageDialogData } from '../components/dialogs/codex-usage-dialog'

/**
 * useCodexResetConsumer centralizes the "consume one rate-limit reset credit"
 * flow shared by both Codex usage dialog mount points (channels-columns and
 * balance-query-dialog). It owns the consuming state and all toasts, and
 * returns the refreshed usage so callers update the dialog without
 * re-implementing the flow.
 *
 * Robustness (deliberate, see code review findings):
 * - The post-consume usage refetch runs in its OWN try/catch so a transient
 *   refetch failure can never be misreported as a consume failure — the credit
 *   was already spent, reporting "failed" would invite a double-spend re-click.
 * - The refetch result is returned only when it actually succeeded, so a
 *   {success:false} body never blanks the dialog into an error view.
 * - A 2xx response that reset zero windows is surfaced as a failure, not a
 *   green "Reset 0 windows" success.
 */
export function useCodexResetConsumer() {
  const { t } = useTranslation()
  const [isConsuming, setIsConsuming] = useState(false)

  // Returns the refreshed usage to store, or null when there is nothing safe to
  // store (consume failed, or the follow-up refetch failed / returned !success).
  const consume = async (
    channelId: number
  ): Promise<CodexUsageDialogData | null> => {
    setIsConsuming(true)
    try {
      const res = await consumeCodexReset(channelId)
      if (!res?.success) {
        toast.error(res?.message || t('Failed to consume reset credit'))
        return null
      }
      const windows = Number(
        (res.data as { windows_reset?: number })?.windows_reset ?? 0
      )
      if (windows > 0) {
        toast.success(t('Reset {{count}} windows', { count: windows }))
      } else {
        // Upstream accepted the request (HTTP 2xx) but reset no window — e.g. the
        // credit was already spent/expired, or there was no active limit window.
        toast.error(t('No rate-limit window was reset'))
      }
    } catch {
      toast.error(t('Failed to consume reset credit'))
      setIsConsuming(false)
      return null
    }

    // Isolated refetch: a failure here must NOT report the (successful) consume
    // as failed, and a !success body must NOT overwrite the last-good state.
    try {
      const refreshed = await getCodexUsage(channelId)
      return refreshed?.success ? refreshed : null
    } catch {
      return null
    } finally {
      setIsConsuming(false)
    }
  }

  return { isConsuming, consume }
}
