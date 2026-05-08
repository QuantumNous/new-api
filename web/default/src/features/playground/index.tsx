import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getUserModels, getUserGroups } from './api'
import { PlaygroundChat } from './components/playground-chat'
import { PlaygroundInput } from './components/playground-input'
import { DEFAULT_GROUP } from './constants'
import { usePlaygroundState, useChatHandler } from './hooks'
import { createUserMessage, createLoadingAssistantMessage } from './lib'
import { inferPlaygroundEndpoint } from './lib/endpoint'
import { isImageGenerationEndpoint, validateImageSize } from './lib/validation'
import type { Message as MessageType, PlaygroundEndpoint } from './types'

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

  const inferredEndpoint = useMemo(
    () => inferPlaygroundEndpoint(config.model),
    [config.model]
  )
  const endpoint = config.endpointOverride ?? inferredEndpoint

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
    queryFn: getUserModels,
  })

  // Load groups
  const { data: groupsData } = useQuery({
    queryKey: ['playground-groups'],
    queryFn: getUserGroups,
  })

  // Update models when data changes
  useEffect(() => {
    if (!modelsData) return

    setModels(modelsData)

    // Set default model if current model is not available
    const isCurrentModelValid = modelsData.some((m) => m.value === config.model)
    if (modelsData.length > 0 && !isCurrentModelValid) {
      updateConfig('model', modelsData[0].value)
      updateConfig('endpointOverride', null)
    }
  }, [modelsData, config.model, setModels, updateConfig])

  // Update groups when data changes
  useEffect(() => {
    if (!groupsData) return

    // Add auto group if not present
    const hasAutoGroup = groupsData.some((g) => g.value === DEFAULT_GROUP)
    const processedGroups = hasAutoGroup
      ? groupsData
      : [
          {
            value: DEFAULT_GROUP,
            label: 'Auto',
            ratio: 1,
            desc: 'Circuit Breaker',
          },
          ...groupsData,
        ]

    setGroups(processedGroups)
  }, [groupsData, setGroups])

  const handleSendMessage = (text: string) => {
    if (isImageGenerationEndpoint(endpoint)) {
      const imageSizeError = validateImageSize(config.image_size)
      if (imageSizeError) {
        toast.error(t(imageSizeError))
        return
      }
    }

    const userMessage = createUserMessage(text)
    const assistantMessage = createLoadingAssistantMessage()

    const newMessages = [...messages, userMessage, assistantMessage]
    updateMessages(newMessages)

    // Send chat request
    sendChat(newMessages)
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

  const handleModelChange = (value: string) => {
    updateConfig('model', value)
    updateConfig('endpointOverride', null)
  }

  const handleEndpointChange = (value: PlaygroundEndpoint) => {
    if (value === inferredEndpoint) {
      updateConfig('endpointOverride', null)
      return
    }

    updateConfig('endpointOverride', value)
  }

  return (
    <div className='relative flex size-full flex-col overflow-hidden'>
      {/* Full-width scroll container: scrolling works even over side whitespace */}
      <div className='flex flex-1 flex-col overflow-hidden'>
        <PlaygroundChat
          messages={messages}
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

      {/* Input area: center content and constrain to the same container width */}
      <div className='mx-auto w-full max-w-4xl'>
        <PlaygroundInput
          disabled={isGenerating}
          endpointValue={endpoint}
          inferredEndpoint={inferredEndpoint}
          groups={groups}
          groupValue={config.group}
          isGenerating={isGenerating}
          isModelLoading={isLoadingModels}
          modelValue={config.model}
          models={models}
          onEndpointChange={handleEndpointChange}
          onGroupChange={(value) => updateConfig('group', value)}
          onImageQualityChange={(value) => updateConfig('image_quality', value)}
          onImageSizeChange={(value) => updateConfig('image_size', value)}
          imageQuality={config.image_quality}
          imageSize={config.image_size}
          onModelChange={handleModelChange}
          onStop={stopGeneration}
          onSubmit={handleSendMessage}
        />
      </div>
    </div>
  )
}
