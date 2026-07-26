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
import { useNavigate, useSearch } from '@tanstack/react-router'
import { SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import { canTryInPlayground } from '@/features/pricing/lib/playground-eligibility'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useAuthStore } from '@/stores/auth-store'
import {
  selectActiveChatMessages,
  selectActiveSession,
  usePlaygroundStore,
} from '@/stores/playground-store'

import {
  createManagedToolRun,
  createPlaygroundRun,
  generateImages,
  executeManagedSearch,
  importManagedToolRun,
  submitVideo,
} from './api'
import { ModelCatalog } from './components/catalog/model-catalog'
import { PlaygroundChat } from './components/chat/playground-chat'
import { ChatComposer } from './components/composer/chat-composer'
import { AgentsView } from './components/discover/agents-view'
import {
  SettingsPanel,
  SettingsSections,
} from './components/settings/settings-panel'
import { ModalityQuickSwitch } from './components/shell/modality-quick-switch'
import { PlaygroundShell } from './components/shell/playground-shell'
import { PlaygroundToolbar } from './components/shell/playground-toolbar'
import { WorkspaceHeader } from './components/shell/workspace-header'
import { DuoWorkspace } from './components/workspace/duo-workspace'
import { GenerationWorkspace } from './components/workspace/generation-workspace'
import {
  useChatHandler,
  usePlaygroundConversation,
  usePlaygroundOptions,
  useSessionCloudSync,
} from './hooks'
import { useStudio } from './hooks/use-studio'
import { persistGeneratedMediaAsset } from './lib/download-generated-media'
import {
  extractManagedSearchResult,
  updateManagedAssistant,
} from './lib/managed-tools'
import { isPlaygroundImageModel } from './lib/studio/image-request-schema'
import { getModelModality } from './lib/studio/model-modality'
import type { PlaygroundConfig, StudioModality } from './types'

export function Playground() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = useSearch({ from: '/playground/' })
  const appliedDeepLink = useRef<string | undefined>(undefined)
  const user = useAuthStore((state) => state.auth.user)
  const isAuthenticated = Boolean(user)
  const [signInDialogOpen, setSignInDialogOpen] = useState(false)
  const [catalogDrawerOpen, setCatalogDrawerOpen] = useState(false)
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
  // Settings panel: persisted open state on wide desktop, ephemeral overlay
  // between 1024–1279px, bottom sheet below 1024px.
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isWideDesktop = useMediaQuery('(min-width: 1280px)')
  const [narrowSettingsOpen, setNarrowSettingsOpen] = useState(false)
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false)

  const view = usePlaygroundStore((state) => state.view)
  const setView = usePlaygroundStore((state) => state.setView)
  const workspaceMode = usePlaygroundStore((state) => state.workspaceMode)
  const setWorkspaceMode = usePlaygroundStore((state) => state.setWorkspaceMode)
  const activeModality = usePlaygroundStore((state) => state.activeModality)
  const setActiveModality = usePlaygroundStore(
    (state) => state.setActiveModality
  )
  const selectStoreModel = usePlaygroundStore((state) => state.selectModel)
  const selectDuo = usePlaygroundStore((state) => state.selectDuo)
  const startNewSession = usePlaygroundStore((state) => state.startNewSession)
  const setPrefill = usePlaygroundStore((state) => state.setPrefill)
  const settingsPanelOpen = usePlaygroundStore(
    (state) => state.ui.settingsPanelOpen
  )
  const setSettingsPanelOpen = usePlaygroundStore(
    (state) => state.setSettingsPanelOpen
  )
  const chatTools = usePlaygroundStore((state) => state.chatTools)
  const pinnedModels = usePlaygroundStore((state) => state.pinnedModels)
  const togglePinnedModel = usePlaygroundStore(
    (state) => state.togglePinnedModel
  )
  const config = usePlaygroundStore((state) => state.config)
  const parameterEnabled = usePlaygroundStore((state) => state.parameterEnabled)
  const messages = usePlaygroundStore(selectActiveChatMessages)
  const activeSession = usePlaygroundStore(selectActiveSession)
  const models = usePlaygroundStore((state) => state.models)
  const updateMessages = usePlaygroundStore((state) => state.setMessages)
  const setModels = usePlaygroundStore((state) => state.setModels)
  const setGroups = usePlaygroundStore((state) => state.setGroups)
  const patchConfig = usePlaygroundStore((state) => state.updateConfig)
  const clearMessages = usePlaygroundStore((state) => state.clearMessages)

  useSessionCloudSync(isAuthenticated)
  const updateConfig = useCallback(
    <K extends keyof PlaygroundConfig>(key: K, value: PlaygroundConfig[K]) => {
      patchConfig({ [key]: value })
    },
    [patchConfig]
  )

  const pricing = usePricingData('playground')
  const playgroundModels = useMemo(() => {
    // Strict mode only when at least one model has an explicit playground
    // integration. Otherwise fall back to the full catalog so production
    // sites that have not configured integrations yet still work.
    if (pricing.isLegacyPlaygroundCatalog) return pricing.models
    const eligible = pricing.models.filter(canTryInPlayground)
    return eligible.length > 0 ? eligible : pricing.models
  }, [pricing.isLegacyPlaygroundCatalog, pricing.models])
  const studio = useStudio()
  const publicModels = useMemo(
    () =>
      playgroundModels.map((model) => ({
        label: model.model_name,
        value: model.model_name,
      })),
    [playgroundModels]
  )
  const publicGroups = useMemo(
    () =>
      Object.entries(pricing.usableGroup).map(([value, group]) => ({
        value,
        label: value,
        desc: typeof group === 'string' ? group : group.desc,
        ratio:
          typeof group === 'string' ? pricing.groupRatio[value] : group.ratio,
      })),
    [pricing.groupRatio, pricing.usableGroup]
  )
  const requireAuthentication = useCallback((): boolean => {
    if (user) return true
    setSignInDialogOpen(true)
    return false
  }, [user])

  const payloadOptions = useMemo(
    () => ({
      systemPrompt: chatTools.systemPrompt,
      carryHistory: chatTools.carryHistory,
      visualOutput: chatTools.visualOutput,
    }),
    [chatTools.systemPrompt, chatTools.carryHistory, chatTools.visualOutput]
  )

  const { sendChat, stopGeneration, isGenerating } = useChatHandler({
    config,
    parameterEnabled,
    onMessageUpdate: updateMessages,
    payloadOptions,
  })
  const [isRouting, setIsRouting] = useState(false)
  const isRoutingRef = useRef(false)
  const canSubmitManagedTurn = useCallback(
    () => !isRoutingRef.current && requireAuthentication(),
    [requireAuthentication]
  )

  const routeManagedTurn = useCallback(
    async (turnMessages: import('./types').Message[], text: string) => {
      if (isRoutingRef.current) return
      isRoutingRef.current = true
      setIsRouting(true)
      const assistantKey = turnMessages.at(-1)?.key
      let directName:
        | 'generate_image'
        | 'generate_video'
        | 'web_search'
        | undefined
      if (chatTools.mode === 'image') directName = 'generate_image'
      if (chatTools.mode === 'video') directName = 'generate_video'
      if (chatTools.mode === 'search') directName = 'web_search'
      const setAssistantTool = (
        managedTool: import('./types').ManagedToolCard,
        sources?: import('./types').MessageSource[],
        content?: string
      ) =>
        updateMessages((previous) =>
          assistantKey
            ? updateManagedAssistant(
                previous,
                assistantKey,
                managedTool,
                sources,
                content
              )
            : previous
        )

      let response: Awaited<ReturnType<typeof createManagedToolRun>> | undefined
      let action = directName
      try {
        response = await createManagedToolRun({
          client_request_id: crypto.randomUUID(),
          model: config.model,
          group: config.group,
          user_text: text,
          tool_policy: {
            mode: directName ? 'direct' : 'auto',
            enabled: ['generate_image', 'generate_video', 'web_search'],
            direct: directName ? { name: directName, args: {} } : undefined,
          },
        })
        const run = response.run
        action = run.action === 'chat' ? undefined : run.action
        if (run.status === 'unavailable' || run.status === 'failed') {
          throw new Error(run.error || t('Tool is unavailable'))
        }
        if (run.action === 'chat') {
          sendChat(turnMessages)
          return
        }
        const baseCard = {
          runId: run.id,
          action: run.action,
          status: 'running' as const,
          model: run.tool_model,
        }
        if (run.action === 'web_search') {
          setAssistantTool(baseCard)
          const raw = await executeManagedSearch(
            run.id,
            response.execution.execution_token
          )
          const result = extractManagedSearchResult(raw)
          setAssistantTool(
            { ...baseCard, status: 'completed' },
            result.sources,
            result.text
          )
          return
        }
        if (run.action === 'generate_image') {
          const toolModel = String(
            response.arguments.model || run.tool_model || ''
          )
          if (!isPlaygroundImageModel(toolModel)) {
            throw new Error(
              t(
                'Playground image generation uses GPT-format models only (gpt-image-2 or grok-imagine-image). Select one and try again.'
              )
            )
          }
          setAssistantTool(baseCard)
          const images = await generateImages({
            model: toolModel,
            group: config.group,
            prompt: String(response.arguments.prompt),
            settings: {
              ...studio.settings,
              imageCount:
                Number(response.arguments.n) || studio.settings.imageCount,
              imageSize: String(
                response.arguments.size || studio.settings.imageSize
              ),
              imageQuality: String(
                response.arguments.quality || studio.settings.imageQuality
              ),
            },
            execution: {
              runId: run.id,
              executionToken: response.execution.execution_token,
            },
          })
          const assets = await Promise.all(
            images.map((image, index) =>
              persistGeneratedMediaAsset(
                image.url,
                `chat-image-${index + 1}`,
                'image'
              )
            )
          )
          await Promise.all(
            assets.map((asset) =>
              createPlaygroundRun({
                modality: 'image',
                model: run.tool_model || '',
                prompt: text,
                asset_id: asset.id,
              })
            )
          )
          const urls = assets.map((asset) => asset.url)
          await importManagedToolRun(run.id, {
            execution_token: response.execution.execution_token,
            status: 'completed',
            result: { images: urls },
          })
          setAssistantTool({ ...baseCard, status: 'completed', images: urls })
          return
        }
        setAssistantTool(baseCard)
        const submission = await submitVideo({
          model: String(response.arguments.model),
          group: config.group,
          prompt: String(response.arguments.prompt),
          settings: {
            ...studio.settings,
            videoDuration:
              Number(response.arguments.duration) ||
              studio.settings.videoDuration,
            videoSize: String(
              response.arguments.size || studio.settings.videoSize
            ),
          },
          execution: {
            runId: run.id,
            executionToken: response.execution.execution_token,
          },
        })
        await createPlaygroundRun({
          modality: 'video',
          model: run.tool_model || '',
          prompt: text,
          task_id: submission.taskId,
        })
        await importManagedToolRun(run.id, {
          execution_token: response.execution.execution_token,
          status: 'submitted',
          task_id: submission.taskId,
        })
        setAssistantTool({
          ...baseCard,
          status: 'submitted',
          taskId: submission.taskId,
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t('Tool failed')
        toast.error(message)
        if (response && response.run.status === 'ready') {
          try {
            await importManagedToolRun(response.run.id, {
              execution_token: response.execution.execution_token,
              status: 'failed',
              error: message,
            })
          } catch {
            // Preserve the original execution error for the user.
          }
        }
        if (action) {
          setAssistantTool({
            runId: response?.run.id,
            action,
            status: 'failed',
            error: message,
          })
        } else if (assistantKey) {
          updateMessages((previous) =>
            previous.map((item) =>
              item.key === assistantKey ? { ...item, status: 'error' } : item
            )
          )
        }
      } finally {
        isRoutingRef.current = false
        setIsRouting(false)
      }
    },
    [
      chatTools.mode,
      config.group,
      config.model,
      sendChat,
      studio.settings,
      t,
      updateMessages,
    ]
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
    sendChat,
    routeTurn: routeManagedTurn,
    canSubmit: canSubmitManagedTurn,
    activeModel: config.model,
  })

  const handleClearMessages = () => {
    handleEditOpenChange(false)
    clearMessages()
  }

  const handleNewSession = useCallback(() => {
    handleEditOpenChange(false)
    startNewSession(activeModality)
  }, [activeModality, handleEditOpenChange, startNewSession])

  const { isLoadingModels } = usePlaygroundOptions({
    isAuthenticated,
    publicGroups,
    publicModels,
    currentGroup: config.group,
    currentModel: config.model,
    setGroups,
    setModels,
    updateConfig,
  })
  useEffect(() => {
    if (!search.model || appliedDeepLink.current === search.model) return
    if (!models.some((model) => model.value === search.model)) return
    appliedDeepLink.current = search.model
    const pricingModel = playgroundModels.find(
      (model) => model.model_name === search.model
    )
    const modality = getModelModality(
      pricingModel ?? { model_name: search.model }
    )
    selectStoreModel(search.model, undefined, { switchModality: modality })
  }, [models, playgroundModels, search.model, selectStoreModel])

  const selectedCatalogModel = playgroundModels.find(
    (model) => model.model_name === config.model
  )

  const chatModels = useMemo(
    () =>
      models.filter((option) => {
        const pricingModel = playgroundModels.find(
          (model) => model.model_name === option.value
        )
        return (
          getModelModality(pricingModel ?? { model_name: option.value }) ===
          'chat'
        )
      }),
    [models, playgroundModels]
  )

  const availableModalities = useMemo(() => {
    const found = new Set<StudioModality>()
    for (const option of models) {
      const pricingModel = playgroundModels.find(
        (model) => model.model_name === option.value
      )
      const modality = getModelModality(
        pricingModel ?? { model_name: option.value }
      )
      // Image modality only appears for GPT-format image models.
      if (modality === 'image' && !isPlaygroundImageModel(option.value)) {
        continue
      }
      found.add(modality)
    }
    return [...found]
  }, [models, playgroundModels])

  const selectModelByModality = useCallback(
    (modality: StudioModality, preferredPrompt?: string) => {
      // Prefer restoring the last session for this modality (and its model).
      setActiveModality(modality)

      const current = playgroundModels.find(
        (model) => model.model_name === config.model
      )
      const currentMatches =
        current != null && getModelModality(current) === modality
      if (!currentMatches) {
        const match = playgroundModels.find((model) => {
          if (!models.some((item) => item.value === model.model_name)) {
            return false
          }
          if (getModelModality(model) !== modality) return false
          if (
            modality === 'image' &&
            !isPlaygroundImageModel(model.model_name)
          ) {
            return false
          }
          return true
        })
        if (!match) {
          toast.error(t('No model available for this modality'), {
            description: t(
              'Try another template or wait until matching models load.'
            ),
          })
          return false
        }
        selectStoreModel(match.model_name, undefined, {
          switchModality: modality,
        })
      }

      if (preferredPrompt != null) {
        setPrefill(preferredPrompt)
      }
      return true
    },
    [
      config.model,
      models,
      playgroundModels,
      selectStoreModel,
      setActiveModality,
      setPrefill,
      t,
    ]
  )

  const studioPending =
    studio.imageMutation.isPending ||
    studio.videoMutation.isPending ||
    studio.audioMutation.isPending

  const catalog = (
    <ModelCatalog
      available={models}
      models={playgroundModels}
      selected={workspaceMode === 'duo' ? '' : config.model}
      loading={pricing.isLoading || isLoadingModels}
      error={Boolean(pricing.error)}
      onRetry={() => pricing.refetch()}
      onSelect={(model) => {
        const modality = getModelModality(model)
        selectStoreModel(model.model_name, undefined, {
          switchModality: modality,
        })
        setCatalogDrawerOpen(false)
      }}
      pinnedModels={pinnedModels}
      onTogglePin={togglePinnedModel}
      duoEnabled={workspaceMode === 'duo'}
      onOpenDuo={() => {
        selectDuo()
        setCatalogDrawerOpen(false)
      }}
    />
  )

  const showWorkspace = view === 'workspace'
  const duoActive = workspaceMode === 'duo'
  const desktopSettingsOpen = isWideDesktop
    ? settingsPanelOpen
    : narrowSettingsOpen
  const toggleSettings = () => {
    if (!isDesktop) {
      setSettingsSheetOpen(true)
      return
    }
    if (isWideDesktop) {
      setSettingsPanelOpen(!settingsPanelOpen)
      return
    }
    setNarrowSettingsOpen((open) => !open)
  }
  const closeDesktopSettings = () => {
    if (isWideDesktop) {
      setSettingsPanelOpen(false)
      return
    }
    setNarrowSettingsOpen(false)
  }

  return (
    <PlaygroundShell
      variant={showWorkspace ? 'workspace' : 'discover'}
      toolbar={
        <PlaygroundToolbar
          view={view}
          onViewChange={setView}
          isChatGenerating={isGenerating}
          isStudioPending={studioPending}
          onStopChat={stopGeneration}
        />
      }
      catalog={catalog}
      catalogOpen={catalogDrawerOpen}
      onCatalogOpenChange={setCatalogDrawerOpen}
      historyOpen={historyDrawerOpen}
      onHistoryOpenChange={setHistoryDrawerOpen}
      settings={
        showWorkspace ? (
          <SettingsPanel
            modality={activeModality}
            duoActive={duoActive}
            open={desktopSettingsOpen}
            onClose={closeDesktopSettings}
          />
        ) : undefined
      }
    >
      {view === 'agents' && <AgentsView />}

<<<<<<< Updated upstream
      {view === 'inspiration' && (
        <InspirationView
          myWorks={myWorks}
          recentPrompts={recentPrompts}
          onApplyPrompt={handleApplyPrompt}
          onRemoveWork={removeMyWork}
          isAuthenticated={isAuthenticated}
          onRequireAuth={() => setSignInDialogOpen(true)}
        />
      )}

=======
>>>>>>> Stashed changes
      {showWorkspace && (
        <WorkspaceHeader
          model={config.model}
          pricingModel={selectedCatalogModel}
          group={config.group}
          mode={workspaceMode}
          modality={activeModality}
          sessionTitle={activeSession?.title}
          onOpenCatalog={() => {
            // Desktop keeps the catalog in the left rail; mobile uses a sheet.
            if (!isDesktop) setCatalogDrawerOpen(true)
          }}
          onOpenHistory={() => setHistoryDrawerOpen(true)}
          onNewSession={handleNewSession}
          actions={
            <Button
              size='icon'
              variant='ghost'
              className='text-muted-foreground hover:text-foreground size-9 touch-manipulation sm:size-8'
              aria-label={t('Settings')}
              aria-pressed={isDesktop ? desktopSettingsOpen : undefined}
              onClick={toggleSettings}
            >
              <SlidersHorizontal className='size-4' />
            </Button>
          }
        />
      )}

      {showWorkspace && !duoActive && (
        <ModalityQuickSwitch
          active={activeModality}
          available={availableModalities}
          onSelect={(modality) => {
            selectModelByModality(modality)
          }}
        />
      )}

      {showWorkspace && duoActive && (
        <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 md:p-8'>
          <DuoWorkspace
            chatModels={chatModels}
            onClose={() => setWorkspaceMode('model')}
          />
        </div>
      )}

      {showWorkspace && !duoActive && activeModality === 'chat' && (
        <>
          <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
            <PlaygroundChat
              messages={messages}
              isLoadingMessages={false}
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
          <div className='playground-composer-dock mx-auto w-full max-w-4xl shrink-0 space-y-2 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:px-3 sm:pb-3 md:px-3 md:pb-4'>
            <ChatComposer
              disabled={isGenerating || isRouting}
              isGenerating={isGenerating}
              isModelLoading={isLoadingModels}
              onClearMessages={handleClearMessages}
              onStop={stopGeneration}
              onSubmit={handleSendMessage}
              hasMessages={messages.length > 0}
            />
          </div>
        </>
      )}

      {showWorkspace && !duoActive && activeModality !== 'chat' && (
        <div className='flex min-h-0 flex-1 flex-col'>
          <GenerationWorkspace
            modality={activeModality}
            pricingModel={selectedCatalogModel}
            canSubmit={requireAuthentication}
            studio={studio}
          />
        </div>
      )}

      <Sheet open={settingsSheetOpen} onOpenChange={setSettingsSheetOpen}>
        <SheetContent
          side='bottom'
          className='max-h-[min(88dvh,40rem)] overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom,0px)]'
        >
          <div className='bg-border mx-auto mt-1 mb-1 h-1 w-10 rounded-full' />
          <SheetHeader>
            <SheetTitle>{t('Settings')}</SheetTitle>
          </SheetHeader>
          <div className='px-4 pb-5'>
            <SettingsSections modality={activeModality} duoActive={duoActive} />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={signInDialogOpen}
        onOpenChange={setSignInDialogOpen}
        title={t('Sign in required')}
        description={t('Please sign in to send requests with AI models.')}
        contentClassName='sm:max-w-md'
        footer={
          <>
            <Button
              variant='outline'
              onClick={() => setSignInDialogOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              onClick={() =>
                navigate({
                  to: '/sign-in',
                  search: { redirect: '/playground' },
                })
              }
            >
              {t('Sign in now')}
            </Button>
          </>
        }
      >
        <span />
      </Dialog>
    </PlaygroundShell>
  )
}
