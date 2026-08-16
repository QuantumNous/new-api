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
import { useCallback } from 'react'

import { PlaygroundChat } from './components/chat/playground-chat'
import { PlaygroundInput } from './components/input/playground-input'
import { PLAYGROUND_MODES } from './constants'
import {
  useChatHandler,
  useImageHandler,
  usePlaygroundConversation,
  usePlaygroundOptions,
  usePlaygroundState,
} from './hooks'
import { getLastUserPrompt } from './lib'
import type { Message } from './types'

export function Playground() {
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
    generateImage,
    stopGeneration: stopImageGeneration,
    isGeneratingImage,
  } = useImageHandler({
    config,
    onMessageUpdate: updateMessages,
  })

  const isImageMode = config.mode === PLAYGROUND_MODES.IMAGE

  const sendConversation = useCallback(
    (nextMessages: Message[]) => {
      if (isImageMode) {
        void generateImage(getLastUserPrompt(nextMessages))
        return
      }

      sendChat(nextMessages)
    },
    [generateImage, isImageMode, sendChat]
  )

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
    sendChat: sendConversation,
  })

  const handleNewChat = () => {
    handleEditOpenChange(false)
    stopGeneration()
    stopImageGeneration()
    clearMessages()
  }

  const isBusy = isGenerating || isGeneratingImage

  const { isLoadingModels } = usePlaygroundOptions({
    currentGroup: config.group,
    currentModel: config.model,
    setGroups,
    setModels,
    updateConfig,
  })

  return (
    <div className='relative flex size-full min-h-0 flex-col overflow-hidden'>
      {/* Full-width scroll container: scrolling works even over side whitespace */}
      <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        <PlaygroundChat
          messages={messages}
          isLoadingMessages={isLoadingMessages}
          onRegenerateMessage={handleRegenerateMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onSelectPrompt={(prompt) => handleSendMessage({ text: prompt })}
          isGenerating={isBusy}
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
          disabled={isBusy}
          groups={groups}
          groupValue={config.group}
          isGenerating={isBusy}
          isModelLoading={isLoadingModels}
          modelValue={config.model}
          models={models}
          onGroupChange={(value) => updateConfig('group', value)}
          onConfigChange={updateConfig}
          onModeChange={(mode) => updateConfig('mode', mode)}
          onModelChange={(value) => updateConfig('model', value)}
          onNewChat={handleNewChat}
          onParameterEnabledChange={updateParameterEnabled}
          onStop={isImageMode ? stopImageGeneration : stopGeneration}
          onSubmit={handleSendMessage}
          parameterEnabled={parameterEnabled}
        />
      </div>
    </div>
  )
}
