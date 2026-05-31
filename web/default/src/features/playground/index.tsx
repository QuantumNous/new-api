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
import { toast } from 'sonner'
import { getUserModels, getUserGroups } from './api'
import { PlaygroundChat } from './components/playground-chat'
import { PlaygroundInput } from './components/playground-input'
import { VideoInputForm } from './components/video-input-form'
import { VideoTaskQueue } from './components/video-task-queue'
import { VideoPlayer } from './components/video-player'
import { usePlaygroundState, useChatHandler, useVideoTask } from './hooks'
import { createUserMessage, createLoadingAssistantMessage } from './lib'
import { HAPPYHORSE_MODEL_PREFIX } from './constants'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import type { Message as MessageType, VideoTaskItem, VideoModelType } from './types'

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

  const { tasks, isSubmitting, submitError, submitTask, clearFinishedTasks, removeTask } =
    useVideoTask()

  // Edit dialog state
  const [editingMessageKey, setEditingMessageKey] = useState<string | null>(null)
  // Previewing video task
  const [previewTask, setPreviewTask] = useState<VideoTaskItem | null>(null)

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

  // Show Video tab if any happyhorse-* model is available
  const hasVideoModels = models.some((m) =>
    m.value.startsWith(HAPPYHORSE_MODEL_PREFIX)
  )

  const handleVideoSubmit = async (
    req: Parameters<typeof submitTask>[0],
    apiKey: string,
    tokenId: number,
    meta?: { size?: string; duration?: number; type?: VideoModelType }
  ) => {
    try {
      await submitTask(req, apiKey, tokenId, meta)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('Failed to submit video task')
      )
    }
  }

  return (
    <div className='relative flex size-full flex-col overflow-hidden'>
      {hasVideoModels ? (
        <Tabs className='flex size-full flex-col overflow-hidden' defaultValue='chat'>
          <div className='flex shrink-0 justify-center border-b px-4 pt-2'>
            <TabsList>
              <TabsTrigger value='chat'>{t('Chat')}</TabsTrigger>
              <TabsTrigger value='video'>{t('Video')}</TabsTrigger>
            </TabsList>
          </div>

          {/* Chat tab */}
          <TabsContent className='flex flex-1 flex-col overflow-hidden' value='chat'>
            <div className='flex flex-1 flex-col overflow-hidden'>
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
            <div className='mx-auto w-full max-w-4xl'>
              <PlaygroundInput
                disabled={isGenerating}
                groups={groups}
                groupValue={config.group}
                isGenerating={isGenerating}
                isModelLoading={isLoadingModels}
                modelValue={config.model}
                models={models}
                onGroupChange={(value) => updateConfig('group', value)}
                onModelChange={(value) => updateConfig('model', value)}
                onStop={stopGeneration}
                onSubmit={handleSendMessage}
              />
            </div>
          </TabsContent>

          {/* Video tab */}
          <TabsContent
            className='flex flex-1 gap-4 overflow-hidden p-4'
            value='video'
          >
            {/* Left: input form */}
            <div className='flex w-80 shrink-0 flex-col overflow-y-auto rounded-xl border'>
              <VideoInputForm
                models={models}
                isSubmitting={isSubmitting}
                onSubmit={handleVideoSubmit}
              />
            </div>
            {/* Right: task queue + preview */}
            <div className='flex flex-1 flex-col gap-4 overflow-y-auto'>
              {previewTask && (
                <VideoPlayer
                  task={previewTask}
                  onClose={() => setPreviewTask(null)}
                />
              )}
              {/* Loading skeleton: show when a task is pending and no preview is active */}
              {!previewTask && tasks.some((t) => t.status === 'queued' || t.status === 'in_progress') && (
                <div className='border-border bg-background rounded-xl border shadow-sm'>
                  <div className='flex items-center justify-between border-b px-4 py-2'>
                    <div className='flex flex-1 flex-col gap-1.5'>
                      <Skeleton className='h-3 w-24' />
                      <Skeleton className='h-4 w-48' />
                    </div>
                  </div>
                  <div className='p-3'>
                    <Skeleton className='aspect-video w-full rounded-lg' />
                  </div>
                  <div className='border-t px-4 py-2'>
                    <Skeleton className='h-3 w-3/4' />
                  </div>
                </div>
              )}
              {submitError && (
                <div className='border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm'>
                  {submitError}
                </div>
              )}
              <VideoTaskQueue
                tasks={tasks}
                onPreview={setPreviewTask}
                onRemove={(id) => {
                  if (previewTask?.id === id) setPreviewTask(null)
                  removeTask(id)
                }}
                onClearFinished={() => {
                  if (previewTask && (previewTask.status === 'completed' || previewTask.status === 'failed')) {
                    setPreviewTask(null)
                  }
                  clearFinishedTasks()
                }}
              />
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          {/* Chat only (no video models available) */}
          <div className='flex flex-1 flex-col overflow-hidden'>
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
          <div className='mx-auto w-full max-w-4xl'>
            <PlaygroundInput
              disabled={isGenerating}
              groups={groups}
              groupValue={config.group}
              isGenerating={isGenerating}
              isModelLoading={isLoadingModels}
              modelValue={config.model}
              models={models}
              onGroupChange={(value) => updateConfig('group', value)}
              onModelChange={(value) => updateConfig('model', value)}
              onStop={stopGeneration}
              onSubmit={handleSendMessage}
            />
          </div>
        </>
      )}
    </div>

  )
}
