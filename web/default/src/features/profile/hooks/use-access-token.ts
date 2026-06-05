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
import { useState, useCallback } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { generateAccessToken } from '../api'

// ============================================================================
// Access Token Hook
// ============================================================================

export function useAccessToken() {
  const [token, setToken] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const { copyToClipboard } = useCopyToClipboard({ notify: false })

  // Generate new access token
  const generate = useCallback(async (): Promise<boolean> => {
    try {
      setGenerating(true)
      const response = await generateAccessToken()

      if (response.success && response.data) {
        setToken(response.data)
        copyToClipboard(response.data)
        toast.success(i18next.t('Token regenerated and copied to clipboard'))
        return true
      }

      toast.error(response.message || i18next.t('Failed to generate token'))
      return false
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to generate token:', error)
      toast.error(i18next.t('Failed to generate token'))
      return false
    } finally {
      setGenerating(false)
    }
  }, [copyToClipboard])

  return {
    token,
    generating,
    generate,
  }
}
