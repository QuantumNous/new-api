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
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getUserGroups, getUserModelKinds, getUserModels } from '../api'
import { PRICING_KINDS } from '../constants'
import {
  getGroupFallback,
  getModelFallback,
  getOptionLoadErrorMessage,
  shouldClearModelForGroup,
} from '../lib'
import type { GroupOption, ModelOption, PlaygroundConfig } from '../types'

type UsePlaygroundOptionsParams = {
  currentGroup: string
  currentModel: string
  setGroups: (groups: GroupOption[]) => void
  setModels: (models: ModelOption[]) => void
  updateConfig: <K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K]
  ) => void
}

// Generation models cannot answer a chat completion: the chat relay forwards
// them to the task relay, which has no prompt to submit. Keep them out of the
// chat picker and offer them only in their own mode.
function isGenerationKind(kind: string | undefined): boolean {
  return kind === PRICING_KINDS.IMAGE_GEN || kind === PRICING_KINDS.VIDEO_GEN
}

export function usePlaygroundOptions({
  currentGroup,
  currentModel,
  setGroups,
  setModels,
  updateConfig,
}: UsePlaygroundOptionsParams) {
  const { t } = useTranslation()

  const {
    data: modelsData,
    error: modelsError,
    isError: isModelsError,
    isLoading: isLoadingModels,
  } = useQuery({
    queryKey: ['playground-models', currentGroup],
    queryFn: async () =>
      requireServerSuccess(await getUserModels(currentGroup)),
    enabled: currentGroup !== '',
  })

  const { data: modelKinds } = useQuery({
    queryKey: ['playground-model-kinds', currentGroup],
    queryFn: async () => getUserModelKinds(currentGroup),
    enabled: currentGroup !== '',
    staleTime: 5 * 60 * 1000,
  })

  const {
    data: groupsData,
    error: groupsError,
    isError: isGroupsError,
  } = useQuery({
    queryKey: ['playground-groups'],
    queryFn: async () => requireServerSuccess(await getUserGroups()),
  })

  const { chatModels, imageModels, videoModels } = useMemo(() => {
    const all = modelsData ?? []
    // Until the kinds arrive every model is treated as a chat model, which is
    // the behaviour the playground had before the split.
    if (!modelKinds) {
      return { chatModels: all, imageModels: [], videoModels: [] }
    }
    return {
      chatModels: all.filter((model) => !isGenerationKind(modelKinds[model.value])),
      imageModels: all.filter(
        (model) => modelKinds[model.value] === PRICING_KINDS.IMAGE_GEN
      ),
      videoModels: all.filter(
        (model) => modelKinds[model.value] === PRICING_KINDS.VIDEO_GEN
      ),
    }
  }, [modelsData, modelKinds])

  useEffect(() => {
    if (!isModelsError) return

    handleServerError(
      modelsError,
      getOptionLoadErrorMessage(
        modelsError,
        t('Failed to load playground models')
      )
    )
  }, [isModelsError, modelsError, t])

  useEffect(() => {
    if (!isGroupsError) return

    handleServerError(
      groupsError,
      getOptionLoadErrorMessage(
        groupsError,
        t('Failed to load playground groups')
      )
    )
  }, [isGroupsError, groupsError, t])

  useEffect(() => {
    if (!modelsData) return

    setModels(chatModels)
    const fallback = getModelFallback(chatModels, currentModel)

    if (fallback) {
      updateConfig('model', fallback)
      return
    }

    if (shouldClearModelForGroup(chatModels, currentModel)) {
      updateConfig('model', '')
    }
  }, [modelsData, chatModels, currentModel, setModels, updateConfig])

  useEffect(() => {
    if (!groupsData) return

    setGroups(groupsData)
    const fallback = getGroupFallback(groupsData, currentGroup)

    if (fallback) {
      updateConfig('group', fallback)
    }
  }, [groupsData, currentGroup, setGroups, updateConfig])

  return {
    isLoadingModels,
    chatModels,
    imageModels,
    videoModels,
  }
}
