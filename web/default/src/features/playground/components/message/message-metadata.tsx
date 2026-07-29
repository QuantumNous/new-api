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
import type { TFunction } from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { usePlaygroundStore } from '@/stores/playground-store'

import type { MessageAlignment } from '../../lib'
import type { Message } from '../../types'

type MessageMetadataProps = {
  alignment: MessageAlignment
  message: Message
}

function formatMessageTime(timestamp?: number): string | undefined {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return undefined
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function formatDuration(
  durationMs: number | undefined,
  t: TFunction
): string | undefined {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    return undefined
  }

  if (durationMs < 1000) {
    return t('{{value}}ms', { value: Math.max(1, Math.round(durationMs)) })
  }

  return t('{{value}}s', { value: (durationMs / 1000).toFixed(2) })
}

function formatTokensPerSecond(
  completionTokens: number,
  durationMs: number | undefined
): string | undefined {
  if (
    typeof durationMs !== 'number' ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    completionTokens <= 0
  ) {
    return undefined
  }

  return (completionTokens / (durationMs / 1000)).toFixed(1)
}

export function MessageMetadata(props: MessageMetadataProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const currentModel = usePlaygroundStore((state) => state.config.model)
  const messageTime = formatMessageTime(props.message.createdAt)
  const duration = formatDuration(props.message.durationMs, t)
  let modelLabel: string | undefined
  if (props.message.from === 'assistant') {
    if (props.message.model) {
      modelLabel = props.message.model
    } else if (
      props.message.status === 'complete' ||
      props.message.status === 'error'
    ) {
      modelLabel = t('Model not recorded')
    }
  }
  const usage =
    props.message.from === 'assistant' ? props.message.usage : undefined
  const tokensPerSecond = usage
    ? formatTokensPerSecond(usage.completionTokens, props.message.durationMs)
    : undefined

  const hasDiagnostics = Boolean(duration || usage)
  const showModelChip = Boolean(modelLabel) && modelLabel !== currentModel

  if (!messageTime && !hasDiagnostics && !modelLabel) {
    return null
  }

  return (
    <div
      role={hasDiagnostics ? 'button' : undefined}
      tabIndex={hasDiagnostics ? 0 : undefined}
      onMouseEnter={() => hasDiagnostics && setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => hasDiagnostics && setExpanded(true)}
      onBlur={() => setExpanded(false)}
      className={cn(
        'text-muted-foreground/70 mt-1 flex min-h-4 flex-wrap items-center gap-1.5 text-[10px] leading-none outline-none',
        props.alignment === 'right' && 'justify-end',
        hasDiagnostics && 'cursor-default'
      )}
    >
      {showModelChip ? (
        <span className='font-mono opacity-90'>{modelLabel}</span>
      ) : null}
      {showModelChip && messageTime ? <span aria-hidden='true'>·</span> : null}
      {messageTime ? <time>{messageTime}</time> : null}

      {expanded && hasDiagnostics ? (
        <span className='flex flex-wrap items-center gap-1.5 text-[10px]'>
          {duration ? (
            <>
              <span aria-hidden='true'>·</span>
              <span>{t('Response time: {{duration}}', { duration })}</span>
            </>
          ) : null}
          {usage ? (
            <>
              <span aria-hidden='true'>·</span>
              <span
                className='font-mono'
                title={t('Prompt / completion tokens')}
              >
                ↑{usage.promptTokens.toLocaleString()} ↓
                {usage.completionTokens.toLocaleString()}
              </span>
            </>
          ) : null}
          {tokensPerSecond ? (
            <>
              <span aria-hidden='true'>·</span>
              <span className='font-mono'>{tokensPerSecond} tok/s</span>
            </>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}
