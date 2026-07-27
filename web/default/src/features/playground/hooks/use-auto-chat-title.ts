/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useEffect, useRef } from 'react'

import { usePlaygroundStore } from '@/stores/playground-store'

import { sendChatCompletion } from '../api'
import {
  isChatSession,
  titleFromFirstUserMessage,
  type ChatSession,
} from '../lib'

const TITLE_SYSTEM_PROMPT =
  'Summarize the conversation into a short title of at most 6 words, in the same language the user writes in. Output only the title: no quotes, no punctuation at the end, no explanations.'

function isSnippetTitle(session: ChatSession): boolean {
  if (session.title === 'New chat') return true
  if (session.title === 'Imported Playground chat') return true
  const snippet = titleFromFirstUserMessage(session.messages)
  return snippet != null && snippet === session.title
}

function firstCompletedExchange(
  session: ChatSession
): { user: string; assistant: string } | null {
  let user = ''
  for (const message of session.messages) {
    const content = message.versions[0]?.content?.trim() ?? ''
    if (message.from === 'user' && !user && content) {
      user = content
    } else if (
      message.from === 'assistant' &&
      user &&
      message.status === 'complete' &&
      content
    ) {
      return { user, assistant: content }
    }
  }
  return null
}

/**
 * Upgrades snippet titles ("first 48 chars…") to a model-written title once
 * the first exchange completes. Billed through /pg like any playground turn,
 * using the thread's own model so group access is guaranteed.
 */
export function useAutoChatTitle(enabled: boolean) {
  const sessions = usePlaygroundStore((state) => state.sessions)
  const attemptedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled) return
    for (const session of sessions) {
      if (!isChatSession(session)) continue
      if (session.kind === 'duo') continue
      if (attemptedRef.current.has(session.id)) continue
      if (!isSnippetTitle(session)) continue
      const exchange = firstCompletedExchange(session)
      if (!exchange) continue
      attemptedRef.current.add(session.id)

      const model = session.model || usePlaygroundStore.getState().config.model
      if (!model) continue
      void (async () => {
        try {
          const response = await sendChatCompletion({
            model,
            group: session.group || undefined,
            stream: false,
            max_tokens: 30,
            messages: [
              { role: 'system', content: TITLE_SYSTEM_PROMPT },
              {
                role: 'user',
                content: `User: ${exchange.user.slice(0, 1500)}\n\nAssistant: ${exchange.assistant.slice(0, 1500)}`,
              },
            ],
          })
          const raw = response?.choices?.[0]?.message?.content
          const title = (typeof raw === 'string' ? raw : '')
            .replaceAll(/["'“”「」]/g, '')
            .replaceAll('\n', ' ')
            .trim()
            .slice(0, 60)
          if (!title) return
          const latest = usePlaygroundStore
            .getState()
            .sessions.find((item) => item.id === session.id)
          if (!latest || !isChatSession(latest) || !isSnippetTitle(latest)) {
            return
          }
          usePlaygroundStore.getState().renameSession(session.id, title)
        } catch {
          // Titling is cosmetic; keep the snippet title on any failure.
        }
      })()
    }
  }, [enabled, sessions])
}
