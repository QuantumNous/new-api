import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getUserModels, getUserGroups } from './api'
import { PlaygroundChat } from './components/playground-chat'
import { PlaygroundInput } from './components/playground-input'
import { usePlaygroundState, useChatHandler } from './hooks'
import { createUserMessage, createLoadingAssistantMessage } from './lib'

export function Playground() {
  const {
    config,
    parameterEnabled,
    messages,
    updateMessages,
    setModels,
    setGroups,
  } = usePlaygroundState()

  const { sendChat, stopGeneration, isGenerating } = useChatHandler({
    config,
    parameterEnabled,
    onMessageUpdate: updateMessages,
  })

  // Load models
  const { data: modelsData } = useQuery({
    queryKey: ['playground-models'],
    queryFn: getUserModels,
  })

  // Load groups
  const { data: groupsData } = useQuery({
    queryKey: ['playground-groups'],
    queryFn: getUserGroups,
  })

  // Update models and groups when data changes
  useEffect(() => {
    if (modelsData) setModels(modelsData)
    if (groupsData) setGroups(groupsData)
  }, [modelsData, groupsData, setModels, setGroups])

  const handleSendMessage = (text: string) => {
    const userMessage = createUserMessage(text)
    const assistantMessage = createLoadingAssistantMessage()

    const newMessages = [...messages, userMessage, assistantMessage]
    updateMessages(newMessages)

    // Send chat request
    sendChat(newMessages)
  }

  const handleStopGeneration = () => {
    stopGeneration()
  }

  return (
    <div className='relative flex size-full flex-col divide-y overflow-hidden'>
      <PlaygroundChat messages={messages} />
      <PlaygroundInput
        disabled={isGenerating}
        isGenerating={isGenerating}
        onStop={handleStopGeneration}
        onSubmit={handleSendMessage}
      />
    </div>
  )
}
