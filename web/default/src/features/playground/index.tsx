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
import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/sonner'
import { Trash2, Copy, Send, Square } from 'lucide-react'
import { getUserModels, getUserGroups } from './api'
import { PlaygroundChat } from './components/playground-chat'
import { PlaygroundInput } from './components/playground-input'
import { usePlaygroundState, useChatHandler } from './hooks'
import { createUserMessage, createLoadingAssistantMessage } from './lib'
import type { Message as MessageType } from './types'

export function Playground() {
  const { t } = useTranslation()
  const {
    config,
    parameterEnabled,
    messages,
    models,
    groups,
    updateMessages,
    setModels,
    setGroups,
    updateConfig,
  } = usePlaygroundState()

  const { sendChat, stopGeneration, isGenerating } = useChatHandler({
    config,
    parameterEnabled,
    onMessageUpdate: updateMessages,
  })

  // Edit dialog state
  const [editingMessageKey, setEditingMessageKey] = useState<string | null>(
    null
  )

  // Load models
  const { data: modelsData, isLoading: isLoadingModels } = useQuery({
    queryKey: ['playground-models'],
    queryFn: async () => {
      try {
        return await getUserModels()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t('Failed to load playground models')
        )
        return []
      }
    },
  })

  // Load groups
  const { data: groupsData } = useQuery({
    queryKey: ['playground-groups'],
    queryFn: async () => {
      try {
        return await getUserGroups()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t('Failed to load playground groups')
        )
        return []
      }
    },
  })

  // Update models when data changes
  useEffect(() => {
    if (!modelsData) return

    setModels(modelsData)

    // Set default model if current model is not available
    const isCurrentModelValid = modelsData.some((m) => m.value === config.model)
    if (modelsData.length > 0 && !isCurrentModelValid) {
      updateConfig('model', modelsData[0].value)
    }
  }, [modelsData, config.model, setModels, updateConfig])

  // Update groups when data changes
  useEffect(() => {
    if (!groupsData) return

    setGroups(groupsData)

    const hasCurrentGroup = groupsData.some((g) => g.value === config.group)
    if (!hasCurrentGroup && groupsData.length > 0) {
      const fallback =
        groupsData.find((g) => g.value === 'default')?.value ??
        groupsData[0].value
      updateConfig('group', fallback)
    }
  }, [groupsData, setGroups, config.group, updateConfig])

  const handleSendMessage = (text: string) => {
    const userMessage = createUserMessage(text)
    const assistantMessage = createLoadingAssistantMessage()

    const newMessages = [...messages, userMessage, assistantMessage]
    updateMessages(newMessages)

    // Send chat request
    sendChat(newMessages)
  }

  const handleCopyMessage = (message: MessageType) => {
    // Copy is handled in MessageActions component
    // eslint-disable-next-line no-console
    console.log('Message copied:', message.key)
  }

  const handleRegenerateMessage = (message: MessageType) => {
    // Find the message index and regenerate from there
    const messageIndex = messages.findIndex((m) => m.key === message.key)
    if (messageIndex === -1) return

    // Remove messages after this one and regenerate
    const messagesUpToHere = messages.slice(0, messageIndex)
    const loadingMessage = createLoadingAssistantMessage()
    const newMessages = [...messagesUpToHere, loadingMessage]

    updateMessages(newMessages)
    sendChat(newMessages)
  }

  const handleEditMessage = useCallback((message: MessageType) => {
    setEditingMessageKey(message.key)
  }, [])

  const handleEditOpenChange = useCallback((open: boolean) => {
    if (!open) setEditingMessageKey(null)
  }, [])

  // Apply edit and optionally re-submit from the edited user message
  const applyEdit = useCallback(
    (newContent: string, submit: boolean) => {
      if (!editingMessageKey) return
      const index = messages.findIndex((m) => m.key === editingMessageKey)
      if (index === -1) return

      const updated = messages.map((m) =>
        m.key === editingMessageKey
          ? { ...m, versions: [{ ...m.versions[0], content: newContent }] }
          : m
      )

      setEditingMessageKey(null)

      if (!submit || updated[index].from !== 'user') {
        updateMessages(updated)
        return
      }

      const toSubmit = [
        ...updated.slice(0, index + 1),
        createLoadingAssistantMessage(),
      ]
      updateMessages(toSubmit)
      sendChat(toSubmit)
    },
    [editingMessageKey, messages, updateMessages, sendChat]
  )

  const handleDeleteMessage = (message: MessageType) => {
    const newMessages = messages.filter((m) => m.key !== message.key)
    updateMessages(newMessages)
  }

  const handleClearChat = () => {
    updateMessages([])
  }

  const handleCopyLast = () => {
    const assistantMessages = messages.filter((m) => m.from === 'assistant')
    const lastMessage = assistantMessages[assistantMessages.length - 1]
    if (lastMessage?.versions?.[0]?.content) {
      navigator.clipboard.writeText(lastMessage.versions[0].content)
      toast.success(t('Copied'))
    }
  }

  // Find current model label for display
  const currentModel = models.find((m) => m.value === config.model)

  return (
    <div className='flex size-full flex-col overflow-hidden bg-background'>
      {/* Config bar */}
      <div className='flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3'>
        <div className='flex items-center gap-2'>
          <label className='text-[11px] font-medium text-muted-foreground uppercase tracking-wider'>
            {t('Model')}
          </label>
          <select
            className='h-7 rounded-md border border-border bg-background px-2.5 text-xs focus:border-primary focus:outline-none'
            value={config.model}
            disabled={isLoadingModels || models.length === 0}
            onChange={(e) => updateConfig('model', e.target.value)}
          >
            {models.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className='flex items-center gap-2'>
          <label className='text-[11px] font-medium text-muted-foreground uppercase tracking-wider'>
            {t('Channel')}
          </label>
          <select
            className='h-7 rounded-md border border-border bg-background px-2.5 text-xs focus:border-primary focus:outline-none'
            value={config.group}
            disabled={groups.length === 0}
            onChange={(e) => updateConfig('group', e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>

        <div className='flex items-center gap-2'>
          <label className='text-[11px] font-medium text-muted-foreground uppercase tracking-wider'>
            {t('Temperature')}
          </label>
          <span className='font-mono text-[11px] text-muted-foreground'>
            {config.temperature}
          </span>
          <input
            type='range'
            min={0}
            max={2}
            step={0.1}
            value={config.temperature}
            disabled={!parameterEnabled.temperature}
            onChange={(e) =>
              updateConfig('temperature', Number(e.target.value))
            }
            className='h-1 w-20 accent-primary'
          />
        </div>

        <div className='flex items-center gap-2'>
          <label className='text-[11px] font-medium text-muted-foreground uppercase tracking-wider'>
            {t('Max Tokens')}
          </label>
          <span className='font-mono text-[11px] text-muted-foreground'>
            {config.max_tokens}
          </span>
          <input
            type='range'
            min={256}
            max={8192}
            step={256}
            value={config.max_tokens}
            disabled={!parameterEnabled.max_tokens}
            onChange={(e) =>
              updateConfig('max_tokens', Number(e.target.value))
            }
            className='h-1 w-20 accent-primary'
          />
        </div>

        <div className='ms-auto flex items-center gap-2'>
          <button
            className='inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent'
            onClick={handleClearChat}
          >
            <Trash2 className='size-3' />
            {t('Clear')}
          </button>
          <button
            className='inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent'
            onClick={handleCopyLast}
          >
            <Copy className='size-3' />
            {t('Copy')}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className='flex flex-1 gap-4 overflow-hidden p-4'>
        {/* Chat area */}
        <div className='flex min-w-0 flex-1 flex-col gap-3'>
          <div className='flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card'>
            <PlaygroundChat
              messages={messages}
              onCopyMessage={handleCopyMessage}
              onRegenerateMessage={handleRegenerateMessage}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              isGenerating={isGenerating}
              editingKey={editingMessageKey}
              onCancelEdit={handleEditOpenChange}
              onSaveEdit={(newContent) => applyEdit(newContent, false)}
              onSaveEditAndSubmit={(newContent) => applyEdit(newContent, true)}
            />
          </div>
          <div className='shrink-0'>
            <PlaygroundInput
              disabled={isGenerating}
              isGenerating={isGenerating}
              onStop={stopGeneration}
              onSubmit={handleSendMessage}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className='hidden w-[280px] shrink-0 flex-col gap-3 lg:flex'>
          {/* System prompt */}
          <div className='rounded-lg border border-border bg-card p-4'>
            <h4 className='mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
              {t('System Prompt')}
            </h4>
            <textarea
              className='h-20 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed focus:border-primary focus:outline-none'
              placeholder={t('Enter system prompt...')}
              defaultValue={t(
                'You are a helpful programming assistant, good at explaining technical concepts in clear Chinese.'
              )}
            />
          </div>

          {/* Parameters */}
          <div className='rounded-lg border border-border bg-card p-4'>
            <h4 className='mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
              {t('Parameters')}
            </h4>

            <div className='mb-3 flex items-center justify-between'>
              <label className='text-xs text-foreground'>Top P</label>
              <span className='font-mono text-[11px] text-muted-foreground'>
                {config.top_p}
              </span>
            </div>
            <input
              type='range'
              min={0}
              max={1}
              step={0.1}
              value={config.top_p}
              disabled={!parameterEnabled.top_p}
              onChange={(e) => updateConfig('top_p', Number(e.target.value))}
              className='mb-4 h-1 w-full accent-primary'
            />

            <div className='mb-3 flex items-center justify-between'>
              <label className='text-xs text-foreground'>
                {t('Frequency Penalty')}
              </label>
              <span className='font-mono text-[11px] text-muted-foreground'>
                {config.frequency_penalty}
              </span>
            </div>
            <input
              type='range'
              min={-2}
              max={2}
              step={0.1}
              value={config.frequency_penalty}
              disabled={!parameterEnabled.frequency_penalty}
              onChange={(e) =>
                updateConfig('frequency_penalty', Number(e.target.value))
              }
              className='mb-4 h-1 w-full accent-primary'
            />

            <div className='mb-3 flex items-center justify-between'>
              <label className='text-xs text-foreground'>
                {t('Presence Penalty')}
              </label>
              <span className='font-mono text-[11px] text-muted-foreground'>
                {config.presence_penalty}
              </span>
            </div>
            <input
              type='range'
              min={-2}
              max={2}
              step={0.1}
              value={config.presence_penalty}
              disabled={!parameterEnabled.presence_penalty}
              onChange={(e) =>
                updateConfig('presence_penalty', Number(e.target.value))
              }
              className='h-1 w-full accent-primary'
            />
          </div>

          {/* Session info */}
          <div className='rounded-lg border border-border bg-card p-4'>
            <h4 className='mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
              {t('Session Info')}
            </h4>
            <div className='mb-2 flex items-center justify-between text-sm'>
              <span className='text-muted-foreground'>
                {t('Tokens (Input)')}
              </span>
              <span className='font-mono text-xs'>1,247</span>
            </div>
            <div className='mb-2 flex items-center justify-between text-sm'>
              <span className='text-muted-foreground'>
                {t('Tokens (Output)')}
              </span>
              <span className='font-mono text-xs'>856</span>
            </div>
            <div className='mb-2 flex items-center justify-between text-sm'>
              <span className='text-muted-foreground'>
                {t('Estimated Cost')}
              </span>
              <span className='font-mono text-xs'>$0.0142</span>
            </div>
            <div className='flex items-center justify-between text-sm'>
              <span className='text-muted-foreground'>{t('Duration')}</span>
              <span className='font-mono text-xs'>2.34s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
