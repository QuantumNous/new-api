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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Loader } from '@/components/ai-elements/loader'
import { MessageContent } from '@/components/ai-elements/message'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import { Response } from '@/components/ai-elements/response'
import { Shimmer } from '@/components/ai-elements/shimmer'
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources'
import { cn } from '@/lib/utils'

import { MESSAGE_STATUS } from '../constants'
import { getMessageContentState, isErrorMessage } from '../lib'
import { getMessageContentStyles } from '../lib/message-styles'
import type { Message } from '../types'
import { MessageError } from './message-error'

type PlaygroundMessageContentProps = {
  actions: ReactNode
  errorActions?: ReactNode
  message: Message
  versionContent: string
}

export function PlaygroundMessageContent({
  actions,
  errorActions,
  message,
  versionContent,
}: PlaygroundMessageContentProps) {
  const { t } = useTranslation()
  const {
    displayContent,
    hasReasoning,
    hasSources,
    reasoningContent,
    showLoader,
    showMessageContent,
    sources,
  } = getMessageContentState(message, versionContent)
  const isError = isErrorMessage(message)
  const isMessageFinal =
    message.status !== MESSAGE_STATUS.LOADING &&
    message.status !== MESSAGE_STATUS.STREAMING

  return (
    <>
      {hasSources && (
        <Sources>
          <SourcesTrigger count={sources.length} />
          <SourcesContent>
            {sources.map((source) => (
              <Source
                href={source.href}
                key={`${source.href}-${source.title}`}
                title={source.title}
              />
            ))}
          </SourcesContent>
        </Sources>
      )}

      {hasReasoning && (
        <Reasoning defaultOpen isStreaming={message.isReasoningStreaming}>
          <ReasoningTrigger />
          <ReasoningContent>{reasoningContent}</ReasoningContent>
        </Reasoning>
      )}

      {showLoader && (
        <div className='flex items-center gap-2 py-2'>
          <Loader />
          <Shimmer className='text-sm' duration={1}>
            {t('Responding...')}
          </Shimmer>
        </div>
      )}

      {isError && (
        <MessageError
          actions={errorActions}
          message={message}
          className='mb-2'
        />
      )}

      {!isError && showMessageContent && (
        <>
          <MessageContent
            variant='flat'
            className={cn(getMessageContentStyles())}
          >
            <Response final={isMessageFinal}>{displayContent}</Response>
          </MessageContent>
          {actions}
        </>
      )}
    </>
  )
}
