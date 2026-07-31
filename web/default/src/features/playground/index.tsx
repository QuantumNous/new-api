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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import i18next from 'i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { useOnboardingStore } from '@/stores/onboarding-store'
import {
  clearPtFirstCallExperimentTimer,
  getPtFirstCallExperimentElapsedMs,
  getStoredAdsAttribution,
  isPtFirstCallTopupExperiment,
  isWithinPtFirstCallTarget,
  PT_FIRST_CALL_TARGET_MS,
  PT_FIRST_CALL_TOPUP_EXPERIMENT_ID,
  startPtFirstCallTopupExperiment,
} from '@/lib/analytics/attribution'
import { trackAdsFunnelEvent } from '@/lib/analytics/gtag'
import { useCanUseGroups } from '@/hooks/use-enterprise'
import { useSystemConfig } from '@/hooks/use-system-config'
import { getUserModels, getUserGroups } from './api'
import { PlaygroundChat } from './components/playground-chat'
import { FirstRunWelcome, GetKeyCard } from './components/playground-first-run'
import { PlaygroundInput } from './components/playground-input'
import { MESSAGE_ROLES, MESSAGE_STATUS } from './constants'
import { usePlaygroundState, useChatHandler, useVideoGeneration } from './hooks'
import {
  createUserMessage,
  createLoadingAssistantMessage,
  createLoadingVideoMessage,
  getFirstRunChatOverride as resolveFirstRunChatOverride,
  isVideoGenModelName,
  pickFirstRunModel,
  shouldOpenFirstRunTopupPrompt,
  clearFirstRunDone,
  isFirstRunActive,
  markFirstRunDone,
  markFirstRunStarted,
} from './lib'
import type { Message as MessageType } from './types'

// PLG users are always pinned to the single `plg` group.
const PLG_GROUP = 'plg'

export function Playground({
  firstRun: firstRunFromUrl = false,
}: {
  firstRun?: boolean
}) {
  const navigate = useNavigate()
  const canUseGroups = useCanUseGroups()
  const { playgroundDefaultModel, enableStripeCardBind } = useSystemConfig()
  const authUser = useAuthStore((state) => state.auth.user)
  const openOnboarding = useOnboardingStore((state) => state.openOnboarding)

  // The onboarding is triggered one-shot via `?first=1`, but it must persist
  // across tab switches / reloads for a brand-new user until they finish their
  // first successful call. We remember that per user (keyed on the authed id so
  // a shared browser never leaks state between accounts): a fresh `?first=1`
  // (re-)starts it, completion marks it done. The effective `firstRun` below
  // therefore stays true on later returns until the user has completed once, so
  // every downstream `firstRun` usage is unchanged.
  const userId = authUser?.id
  const firstRun = firstRunFromUrl || isFirstRunActive(userId)

  // Persist first-run entry. Explicit `?first=1` re-enables onboarding even if
  // the user completed it before (clears the done flag), then records that the
  // user has started so a plain tab return keeps showing it.
  useEffect(() => {
    if (!firstRunFromUrl) return
    if (userId === undefined) return
    clearFirstRunDone(userId)
    markFirstRunStarted(userId)
  }, [firstRunFromUrl, userId])
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

  const {
    sendChat,
    stopGeneration: stopChatGeneration,
    isGenerating: isChatGenerating,
  } = useChatHandler({
    config,
    parameterEnabled,
    onMessageUpdate: updateMessages,
    minimalParameters: firstRun,
  })

  const {
    generateVideo,
    stopVideoGeneration,
    releaseVideoObjectUrl,
    isVideoGenerating,
  } = useVideoGeneration({ onMessageUpdate: updateMessages })

  // Either a chat stream or a video-generation task can be in flight; the input,
  // stop button, and welcome chips all key off the combined state.
  const isGenerating = isChatGenerating || isVideoGenerating
  const stopGeneration = useCallback(() => {
    stopChatGeneration()
    stopVideoGeneration()
  }, [stopChatGeneration, stopVideoGeneration])

  // Edit dialog state
  const [editingMessageKey, setEditingMessageKey] = useState<string | null>(
    null
  )

  // --- First-run onboarding state (?first=1) ---
  // Whether the "get your API key" card is currently visible. Shown once per
  // session after the first successful assistant response, then dismissed.
  const [showGetKeyCard, setShowGetKeyCard] = useState(false)
  // Whether the user has actually sent a message during THIS first-run session.
  // The get-key card keys off this (not raw messages) so a stale localStorage
  // conversation can't prematurely surface it.
  const [sentThisSession, setSentThisSession] = useState(false)
  // Guards so one-shot first-run cards fire at most once per session (refs
  // survive re-renders without retriggering effects).
  const clearedFirstRunMessagesRef = useRef(false)
  const getKeyCardShownRef = useRef(false)
  const topupPromptShownRef = useRef(false)
  const [userPickedModel, setUserPickedModel] = useState(false)
  const isPtFirstCallExperiment = useMemo(
    () => isPtFirstCallTopupExperiment(getStoredAdsAttribution()),
    []
  )
  const [ptFirstCallSecondsRemaining, setPtFirstCallSecondsRemaining] =
    useState(PT_FIRST_CALL_TARGET_MS / 1000)
  const ptFirstCallSuccessTrackedRef = useRef(false)
  const ptFirstCallTimeoutTrackedRef = useRef(false)
  const ptFirstCallElapsedMsRef = useRef<number | null>(null)

  // Initialize first-run mode once on mount. The clean slate matters because a
  // just-registered user may be in a browser that still holds a previous
  // account's persisted conversation, which would otherwise suppress the welcome
  // banner (gated on messages.length === 0).
  useEffect(() => {
    if (!firstRun) return
    if (clearedFirstRunMessagesRef.current) return
    clearedFirstRunMessagesRef.current = true
    if (messages.length > 0) updateMessages([])
  }, [firstRun, messages.length, updateMessages])

  // Load models
  const { data: modelsData, isLoading: isLoadingModels } = useQuery({
    queryKey: ['playground-models', config.group],
    queryFn: async () => {
      try {
        return await getUserModels(config.group)
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : i18next.t('Failed to load playground models')
        )
        return []
      }
    },
  })

  // Load groups only when the current user can choose token groups.
  const { data: groupsData } = useQuery({
    queryKey: ['playground-groups'],
    queryFn: async () => {
      try {
        return await getUserGroups()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : i18next.t('Failed to load playground groups')
        )
        return []
      }
    },
    enabled: canUseGroups,
  })

  const firstRunModel = useMemo(() => {
    if (!firstRun || !modelsData?.length) return undefined
    return pickFirstRunModel(modelsData, playgroundDefaultModel)
  }, [firstRun, modelsData, playgroundDefaultModel])

  const isCurrentModelValid =
    !!config.model &&
    !!modelsData?.some((model) => model.value === config.model)
  const isFirstRunModelApplied =
    !!firstRunModel &&
    isCurrentModelValid &&
    (userPickedModel || config.model === firstRunModel)
  const isFirstRunModelReady = !firstRun || isFirstRunModelApplied
  const getFirstRunChatOverride = useCallback(
    () =>
      resolveFirstRunChatOverride({
        firstRun,
        firstRunModel,
        currentModel: config.model,
        userPickedModel,
      }),
    [firstRun, firstRunModel, config.model, userPickedModel]
  )

  // PLG users are pinned to the `plg` group so model fetching uses it.
  useEffect(() => {
    if (authUser && !canUseGroups && config.group !== PLG_GROUP) {
      updateConfig('group', PLG_GROUP)
    }
  }, [authUser, canUseGroups, config.group, updateConfig])

  // Update models when data changes
  useEffect(() => {
    if (!modelsData) return

    setModels(modelsData)

    if (firstRun && !userPickedModel && !!firstRunModel) {
      if (config.model === firstRunModel) return
      updateConfig('model', firstRunModel)
      return
    }

    // Set default model if current model is not available
    const isCurrentModelValid = modelsData.some((m) => m.value === config.model)
    if (!isCurrentModelValid) {
      updateConfig('model', modelsData[0]?.value ?? '')
    }
  }, [
    modelsData,
    config.model,
    firstRun,
    firstRunModel,
    userPickedModel,
    setModels,
    updateConfig,
  ])

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

  // Detect the first successful assistant response in first-run mode and slide
  // in the "get your API key" card once per session.
  const hasCompletedAssistant = useMemo(
    () =>
      messages.some(
        (m) =>
          m.from === MESSAGE_ROLES.ASSISTANT &&
          m.status === MESSAGE_STATUS.COMPLETE &&
          !!m.versions?.[0]?.content?.trim()
      ),
    [messages]
  )

  useEffect(() => {
    if (!firstRun || !isPtFirstCallExperiment || hasCompletedAssistant) return

    if (getPtFirstCallExperimentElapsedMs() === null) {
      startPtFirstCallTopupExperiment()
    }
    trackAdsFunnelEvent('flatkey_pt_first_call_experiment_view', {
      experiment_id: PT_FIRST_CALL_TOPUP_EXPERIMENT_ID,
    })

    const updateTimer = () => {
      const elapsedMs = getPtFirstCallExperimentElapsedMs() ?? 0
      const remainingMs = Math.max(0, PT_FIRST_CALL_TARGET_MS - elapsedMs)
      setPtFirstCallSecondsRemaining(Math.ceil(remainingMs / 1000))
      if (remainingMs > 0 || ptFirstCallTimeoutTrackedRef.current) return

      ptFirstCallTimeoutTrackedRef.current = true
      trackAdsFunnelEvent('flatkey_pt_first_call_60s_timeout', {
        experiment_id: PT_FIRST_CALL_TOPUP_EXPERIMENT_ID,
      })
    }

    updateTimer()
    const timer = window.setInterval(updateTimer, 1000)
    return () => window.clearInterval(timer)
  }, [firstRun, isPtFirstCallExperiment, hasCompletedAssistant])

  useEffect(() => {
    if (!firstRun) return
    if (getKeyCardShownRef.current) return
    // Require a real send this session so a restored conversation can't trigger
    // the card before the user has actually made a call.
    if (!sentThisSession) return
    if (!hasCompletedAssistant) return
    getKeyCardShownRef.current = true
    if (isPtFirstCallExperiment && !ptFirstCallSuccessTrackedRef.current) {
      ptFirstCallSuccessTrackedRef.current = true
      const elapsedMs = getPtFirstCallExperimentElapsedMs()
      ptFirstCallElapsedMsRef.current = elapsedMs
      trackAdsFunnelEvent('flatkey_pt_first_api_call_success', {
        experiment_id: PT_FIRST_CALL_TOPUP_EXPERIMENT_ID,
        elapsed_seconds:
          elapsedMs === null ? undefined : Math.round(elapsedMs / 1000),
        within_60_seconds:
          elapsedMs === null ? false : isWithinPtFirstCallTarget(elapsedMs),
      })
      clearPtFirstCallExperimentTimer()
    }
    // First successful call: mark onboarding done in persistent storage so a
    // later tab return / reload no longer reshows the welcome banner for this
    // user (the effective firstRun then resolves to false).
    markFirstRunDone(userId)
    const showCardTimer = window.setTimeout(() => {
      setShowGetKeyCard(true)
      // First call succeeded — drop `?first=1` from the URL so a reload/back-nav
      // doesn't replay the one-shot onboarding (welcome banner + model force).
      // The card is driven by showGetKeyCard state, so it stays after firstRun flips.
      navigate({ to: '/playground', replace: true })
    }, 0)
    return () => window.clearTimeout(showCardTimer)
  }, [
    firstRun,
    sentThisSession,
    hasCompletedAssistant,
    navigate,
    userId,
    isPtFirstCallExperiment,
  ])

  useEffect(() => {
    const shouldOpen = shouldOpenFirstRunTopupPrompt({
      firstRun,
      sentThisSession,
      hasCompletedAssistant,
      promptShown: topupPromptShownRef.current,
      enableStripeCardBind,
      stripeCardBound: authUser?.stripe_card_bound,
    })
    if (!shouldOpen) return

    topupPromptShownRef.current = true
    if (isPtFirstCallExperiment) {
      const elapsedMs = ptFirstCallElapsedMsRef.current
      trackAdsFunnelEvent('flatkey_pt_topup_offer_open', {
        experiment_id: PT_FIRST_CALL_TOPUP_EXPERIMENT_ID,
        first_call_elapsed_seconds:
          elapsedMs === null ? undefined : Math.round(elapsedMs / 1000),
      })
    }
    openOnboarding()
  }, [
    firstRun,
    sentThisSession,
    hasCompletedAssistant,
    enableStripeCardBind,
    authUser?.stripe_card_bound,
    openOnboarding,
    isPtFirstCallExperiment,
  ])

  const prepareFirstRunSend = useCallback(() => {
    if (firstRun && !isFirstRunModelApplied) {
      toast.error(i18next.t('Failed to load playground models'))
      return false
    }
    if (firstRun) setSentThisSession(true)
    return true
  }, [firstRun, isFirstRunModelApplied])

  const handleSendMessage = (text: string, model?: string) => {
    if (!prepareFirstRunSend()) return
    const userMessage = createUserMessage(text)
    // The effective model for THIS send: an example chip / override wins,
    // otherwise the currently selected model.
    const targetModel = model || config.model

    // An example prompt (or the picker) can force a specific model. Persist the
    // selection so the picker reflects it, and mark it as an explicit user choice
    // so the first-run cheap default never overrides it.
    if (model) {
      setUserPickedModel(true)
      updateConfig('model', model)
    }

    // Video-generation models (veo) do NOT run through chat completions: insert a
    // video assistant bubble and drive the async /v1/videos submit→poll→content
    // flow, which renders an inline <video> when done.
    if (isVideoGenModelName(targetModel)) {
      const videoMessage = createLoadingVideoMessage()
      const newMessages = [...messages, userMessage, videoMessage]
      updateMessages(newMessages)
      generateVideo(text, targetModel, videoMessage.key)
      return
    }

    const assistantMessage = createLoadingAssistantMessage()
    const newMessages = [...messages, userMessage, assistantMessage]
    updateMessages(newMessages)

    // Crucially, pass a forced model as a direct send override: `updateConfig` is
    // async and wouldn't be reflected in `config` for this same-tick send, so the
    // override guarantees THIS message is requested against the forced model.
    if (model) {
      sendChat(newMessages, { model })
      return
    }

    // Send chat request
    sendChat(newMessages, getFirstRunChatOverride())
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

    // Regenerating against a video model re-runs the async video flow using the
    // most recent user prompt rather than hitting chat completions.
    if (isVideoGenModelName(config.model)) {
      const lastUser = [...messagesUpToHere]
        .reverse()
        .find((m) => m.from === MESSAGE_ROLES.USER)
      const prompt = lastUser?.versions?.[0]?.content ?? ''
      const videoMessage = createLoadingVideoMessage()
      const newMessages = [...messagesUpToHere, videoMessage]
      updateMessages(newMessages)
      generateVideo(prompt, config.model, videoMessage.key)
      return
    }

    const loadingMessage = createLoadingAssistantMessage()
    const newMessages = [...messagesUpToHere, loadingMessage]

    updateMessages(newMessages)
    sendChat(newMessages, getFirstRunChatOverride())
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
      if (!prepareFirstRunSend()) return
      updateMessages(toSubmit)
      sendChat(toSubmit, getFirstRunChatOverride())
    },
    [
      editingMessageKey,
      messages,
      prepareFirstRunSend,
      updateMessages,
      sendChat,
      getFirstRunChatOverride,
    ]
  )

  const handleDeleteMessage = (message: MessageType) => {
    // Revoke the video blob URL (if any) so deleting a video message doesn't leak.
    if (message.videoUrl) releaseVideoObjectUrl(message.videoUrl)
    const newMessages = messages.filter((m) => m.key !== message.key)
    updateMessages(newMessages)
  }

  return (
    <div className='relative flex size-full flex-col overflow-hidden'>
      {/* Welcome banner + example prompts — shown on an empty Playground for
          every user (new users get the first-run banner, returning users get a
          neutral "try one of these" header with the same one-click prompts). */}
      {messages.length === 0 && (
        <FirstRunWelcome
          firstRun={firstRun}
          ptFirstCallSecondsRemaining={
            isPtFirstCallExperiment ? ptFirstCallSecondsRemaining : undefined
          }
          disabled={!isFirstRunModelReady}
          onPickExample={handleSendMessage}
        />
      )}
      {/* Full-width scroll container: scrolling works even over side whitespace */}
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

      {/* "Get your API key" card after the first successful response */}
      {showGetKeyCard && (
        <GetKeyCard onDismiss={() => setShowGetKeyCard(false)} />
      )}

      {/* Input area: center content and constrain to the same container width */}
      <div className='mx-auto w-full max-w-4xl'>
        <PlaygroundInput
          disabled={isGenerating}
          submitDisabled={!isFirstRunModelReady}
          showGroupSelector={canUseGroups}
          groups={groups}
          groupValue={config.group}
          isGenerating={isGenerating}
          isModelLoading={isLoadingModels}
          modelValue={config.model}
          models={models}
          onGroupChange={(value) => updateConfig('group', value)}
          onModelChange={(value) => {
            // Mark that the user explicitly chose a model so the first-run cheap
            // default never overrides their choice.
            setUserPickedModel(true)
            updateConfig('model', value)
          }}
          onStop={stopGeneration}
          onSubmit={handleSendMessage}
        />
      </div>
    </div>
  )
}
