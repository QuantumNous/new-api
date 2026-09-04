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
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { getUserModels } from './api'
import { DEFAULT_IMAGE_CONFIG } from './constants'
import { PlaygroundChat } from './components/chat/playground-chat'
import { PlaygroundImageStudio } from './components/image/playground-image-studio'
import { PlaygroundInput } from './components/input/playground-input'
import { loadImageConfig, saveImageConfig } from './lib'
import {
  useChatHandler,
  usePlaygroundConversation,
  usePlaygroundOptions,
  usePlaygroundState,
} from './hooks'
import type {
  ImageConfig,
  ModelOption,
  PlaygroundMode,
} from './types'

export function Playground() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<PlaygroundMode>('chat')
  const [imageConfig, setImageConfig] = useState<ImageConfig>(() => ({
    ...DEFAULT_IMAGE_CONFIG,
    ...loadImageConfig(),
  }))
  const {
    config,
    parameterEnabled,
    messages,
    isLoadingMessages,
    models,
    groups,
    updateMessages,
    setModels,
    setGroups,
    updateConfig,
    updateParameterEnabled,
    clearMessages,
  } = usePlaygroundState()

  const { sendChat, stopGeneration, isGenerating } = useChatHandler({
    config,
    parameterEnabled,
    onMessageUpdate: updateMessages,
  })

  const {
    editingMessageKey,
    handleSendMessage,
    handleRegenerateMessage,
    handleEditMessage,
    handleEditOpenChange,
    applyEdit,
    handleDeleteMessage,
  } = usePlaygroundConversation({
    messages,
    updateMessages,
    sendChat,
  })

  const handleClearMessages = () => {
    handleEditOpenChange(false)
    clearMessages()
  }

  const { isLoadingModels } = usePlaygroundOptions({
    currentGroup: config.group,
    currentModel: config.model,
    setGroups,
    setModels,
    updateConfig,
  })

  const imageModelsQuery = useQuery({
    enabled: mode === 'image' && imageConfig.group !== '',
    queryFn: () => getUserModels(imageConfig.group, 'image-generation'),
    queryKey: ['playground-image-models', imageConfig.group],
  })

  const updateImageConfig = <K extends keyof ImageConfig>(
    key: K,
    value: ImageConfig[K]
  ) => {
    setImageConfig((prev) => {
      const updated = { ...prev, [key]: value }
      saveImageConfig(updated)
      return updated
    })
  }

  const handleModeChange = (value: string) => {
    if (value === 'chat' || value === 'image') {
      setMode(value)
    }
  }

  return (
    <div className='relative flex size-full min-h-0 flex-col overflow-hidden'>
      <div className='mx-auto w-full max-w-4xl pt-3'>
        <Tabs
          onValueChange={handleModeChange}
          value={mode}
        >
          <TabsList aria-label={t('Playground mode')}>
            <TabsTrigger value='chat'>{t('Chat')}</TabsTrigger>
            <TabsTrigger value='image'>{t('Image')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {mode === 'image' ? (
        <div className='min-h-0 flex-1 overflow-y-auto'>
          <PlaygroundImageStudio
            groups={groups}
            imageConfig={imageConfig}
            isModelLoading={imageModelsQuery.isLoading}
            models={(imageModelsQuery.data ?? []) as ModelOption[]}
            onImageConfigChange={updateImageConfig}
          />
        </div>
      ) : (
        <>
          {/* Full-width scroll container: scrolling works even over side whitespace */}
          <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
            <PlaygroundChat
              messages={messages}
              isLoadingMessages={isLoadingMessages}
              onRegenerateMessage={handleRegenerateMessage}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onSelectPrompt={handleSendMessage}
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
              config={config}
              disabled={isGenerating}
              groups={groups}
              groupValue={config.group}
              isGenerating={isGenerating}
              isModelLoading={isLoadingModels}
              modelValue={config.model}
              models={models}
              onGroupChange={(value) => updateConfig('group', value)}
              onConfigChange={updateConfig}
              onClearMessages={handleClearMessages}
              onModelChange={(value) => updateConfig('model', value)}
              onParameterEnabledChange={updateParameterEnabled}
              onStop={stopGeneration}
              onSubmit={handleSendMessage}
              parameterEnabled={parameterEnabled}
              hasMessages={messages.length > 0}
            />
          </div>
        </>
      )}
    </div>
  )
}
