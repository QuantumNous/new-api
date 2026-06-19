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
import { useCallback, useEffect, useRef, useState } from 'react'
import { PanelLeftOpenIcon, PlusIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  getUserModels,
  getUserGroups,
  getChatMessages,
  createChatSession,
  saveChatMessage,
  updateChatTitle,
} from './api'
import { ChatSidebar } from './components/chat-sidebar'
import { PlaygroundChat } from './components/playground-chat'
import { PlaygroundInput } from './components/playground-input'
import { usePlaygroundState, useChatHandler } from './hooks'
import {
  createUserMessage,
  createLoadingAssistantMessage,
  getCurrentVersion,
} from './lib'
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

  // Chat history state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false)
  // Track which message keys we've already saved to avoid double-saving
  const savedMessageKeysRef = useRef<Set<string>>(new Set())
  // Ref to trigger sidebar refresh
  const sidebarRefreshRef = useRef<(() => void) | null>(null)

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

  // Auto-save ASSISTANT messages when they complete (streaming → complete)
  useEffect(() => {
    if (!currentSessionId || isGenerating) return

    for (const msg of messages) {
      if (
        msg.from === 'assistant' &&
        msg.status === 'complete' &&
        !savedMessageKeysRef.current.has(msg.key)
      ) {
        const content = getCurrentVersion(msg).content
        if (!content) continue
        savedMessageKeysRef.current.add(msg.key)
        const reasoning = msg.reasoning?.content || ''
        saveChatMessage(currentSessionId, 'assistant', content, '', reasoning)

        // Auto-update session title from first assistant response
        // If we only have 2 messages (1 user + 1 assistant), generate a title
        const completeMsgs = messages.filter(
          (m) => m.status === 'complete' || m.from === 'user'
        )
        if (completeMsgs.length <= 2) {
          // Use first 50 chars of user's first message as title
          const firstUserMsg = messages.find((m) => m.from === 'user')
          if (firstUserMsg) {
            const userText = getCurrentVersion(firstUserMsg).content
            const autoTitle =
              userText.slice(0, 50) + (userText.length > 50 ? '...' : '')
            updateChatTitle(currentSessionId, autoTitle)
            sidebarRefreshRef.current?.()
          }
        }
      }
    }
  }, [messages, currentSessionId, isGenerating])

  const handleSendMessage = async (
    text: string,
    imageUrl?: string,
    fileContent?: string,
    fileName?: string,
  ) => {
    // Auto-create session if none exists
    let sessionId = currentSessionId

    // Build display title (strip markdown image syntax)
    const cleanTitle = (text || fileName || 'Chat')
      .replace(/!\[image\]\([^)]+\)/g, '')
      .trim()
      .slice(0, 50)

    if (!sessionId) {
      const session = await createChatSession(
        cleanTitle || (imageUrl ? t('Image') : t('File')),
        config.model,
        config.group,
      )
      if (session) {
        sessionId = session.id
        setCurrentSessionId(session.id)
        // Refresh sidebar to show new session
        sidebarRefreshRef.current?.()
      }
    }

    // Build user message — with image, file, or plain text
    let userMessage: MessageType
    // The actual content sent to AI (may include file text)
    let apiText = text
    if (fileContent && fileName) {
      // Prepend file content to the API message but show only the user's question in bubble
      apiText = text
        ? `${text}\n\n📎 **${fileName}**\n\`\`\`\n${fileContent.slice(0, 80000)}\n\`\`\``
        : `📎 **${fileName}**\n\`\`\`\n${fileContent.slice(0, 80000)}\n\`\`\``
      // Display message shows filename chip (not raw content)
      const displayText = text || t('Analyze this file')
      userMessage = createUserMessage(displayText)
      // Store filename as a source-like reference for display
      userMessage.sources = [{ href: '', title: `📎 ${fileName}` }]
    } else if (imageUrl) {
      // Display content for image message
      const displayContent = text || t('Analyze this image')
      userMessage = createUserMessage(displayContent)
      userMessage.sources = [{ href: imageUrl, title: 'Image' }]
    } else {
      userMessage = createUserMessage(text)
    }

    const assistantMessage = createLoadingAssistantMessage()

    const newMessages = [...messages, userMessage, assistantMessage]
    updateMessages(newMessages)

    // Mark user message as saved immediately
    savedMessageKeysRef.current.add(userMessage.key)

    // Save user message to backend
    if (sessionId) {
      saveChatMessage(sessionId, 'user', text || fileName || '', imageUrl || '')
    }

    // Build messages for API — replace last user message with API version (includes file content)
    if (fileContent && apiText !== text) {
      const apiMessages = [...newMessages]
      const userIdx = apiMessages.length - 2 // second to last
      if (userIdx >= 0) {
        apiMessages[userIdx] = {
          ...apiMessages[userIdx],
          versions: [{ id: apiMessages[userIdx].versions[0].id, content: apiText }],
          sources: userMessage.sources,
        }
      }
      sendChat(apiMessages)
    } else {
      sendChat(newMessages)
    }
  }

  const handleSelectSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId)
    savedMessageKeysRef.current = new Set()

    // Load messages from backend
    const savedMessages = await getChatMessages(sessionId)
    if (savedMessages && savedMessages.length > 0) {
      const loadedMessages: MessageType[] = savedMessages.map((m) => {
        // Mark all loaded messages as already saved
        savedMessageKeysRef.current.add(m.id)

        return {
          key: m.id,
          from: m.role as MessageType['from'],
          versions: [{ id: m.id, content: m.content }],
          sources: m.image_urls
            ? m.image_urls
                .split(',')
                .filter(Boolean)
                .map((url) => ({ href: url, title: 'Image' }))
            : undefined,
          reasoning: m.reasoning
            ? { content: m.reasoning, duration: 0 }
            : undefined,
          status: 'complete' as const,
        }
      })
      updateMessages(loadedMessages)
    } else {
      updateMessages([])
    }
  }

  const handleNewChat = () => {
    setCurrentSessionId(null)
    updateMessages([])
    savedMessageKeysRef.current = new Set()
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

  return (
    <div className='relative flex size-full overflow-hidden'>
      {/* Chat History Sidebar — handles its own mobile Sheet internally */}
      <ChatSidebar
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        model={config.model}
        group={config.group}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={sidebarMobileOpen}
        onMobileOpenChange={setSidebarMobileOpen}
        onRefresh={(fn) => {
          sidebarRefreshRef.current = fn
        }}
      />

      {/* Main chat area */}
      <div className='flex flex-1 flex-col overflow-hidden'>
        {/* Mobile top bar — only visible on small screens (md+: sidebar is inline) */}
        <div className='flex md:hidden items-center border-b px-2 py-2 bg-background/80 backdrop-blur-sm gap-1'>
          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8 shrink-0'
            onClick={() => setSidebarMobileOpen(true)}
          >
            <PanelLeftOpenIcon size={18} />
            <span className='sr-only'>{t('Chat History')}</span>
          </Button>
          <span className='flex-1 text-center text-sm font-medium'>{t('Playground')}</span>
          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8 shrink-0'
            onClick={handleNewChat}
          >
            <PlusIcon size={18} />
            <span className='sr-only'>{t('New Chat')}</span>
          </Button>
        </div>

        {/* Full-width scroll container */}
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

        {/* Input area */}
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
            onSubmit={(text, imageUrl, fileContent, fileName) =>
              handleSendMessage(text, imageUrl, fileContent, fileName)
            }
          />
        </div>
      </div>
    </div>
  )
}
