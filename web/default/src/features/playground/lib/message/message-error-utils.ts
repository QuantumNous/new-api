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
import { MESSAGE_STATUS } from '../../constants'
import type { Message } from '../../types'
import { getMessageContent } from './message-utils'

export const MODEL_PRICING_SETTINGS_PATH = '/pricing-center'

export const TOPUP_PATH = '/console/topup'

const MODEL_PRICE_ERROR_CODE = 'model_price_error'
export const FALLBACK_ERROR_CONTENT = 'An unknown error occurred'

type MessageErrorState = {
  content: string
  kind: 'generic' | 'model-price' | 'quota' | 'model-unavailable'
  showSettingsLink: boolean
}

function isQuotaError(errorCode: string | null | undefined, content: string) {
  if (errorCode?.includes('quota')) return true
  return /quota|余额不足|额度不足/i.test(content)
}

function isModelUnavailableError(
  errorCode: string | null | undefined,
  content: string
) {
  if (errorCode === 'model_not_found' || errorCode === 'invalid_model') {
    return true
  }
  return /无可用渠道|no available channel|model.*(not exist|does not exist|not found)/i.test(
    content
  )
}

export function isAdminRole(role?: number | null): boolean {
  return role != null && role >= 10
}

export function isErrorMessage(message: Message): boolean {
  return message.status === MESSAGE_STATUS.ERROR
}

export function getMessageErrorState(
  message: Message,
  isAdmin: boolean
): MessageErrorState | null {
  if (!isErrorMessage(message)) {
    return null
  }

  const content = getMessageContent(message) || FALLBACK_ERROR_CONTENT
  const isModelPriceError = message.errorCode === MODEL_PRICE_ERROR_CODE

  let kind: MessageErrorState['kind'] = 'generic'
  if (isModelPriceError) {
    kind = 'model-price'
  } else if (isQuotaError(message.errorCode, content)) {
    kind = 'quota'
  } else if (isModelUnavailableError(message.errorCode, content)) {
    kind = 'model-unavailable'
  }

  return {
    content,
    kind,
    showSettingsLink: isModelPriceError && isAdmin,
  }
}
