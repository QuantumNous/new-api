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
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getUserGroups, getUserModels } from '../api'
import {
  getGroupFallback,
  getModelFallback,
  getOptionLoadErrorMessage,
  shouldClearModelForGroup,
} from '../lib'
import type { GroupOption, ModelOption, PlaygroundConfig } from '../types'

type UsePlaygroundOptionsParams = {
  isAuthenticated: boolean
  publicGroups: GroupOption[]
  publicModels: ModelOption[]
  currentGroup: string
  currentModel: string
  setGroups: (groups: GroupOption[]) => void
  setModels: (models: ModelOption[]) => void
  updateConfig: <K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K]
  ) => void
}

export function usePlaygroundOptions({
  isAuthenticated,
  publicGroups,
  publicModels,
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
    queryFn: () => getUserModels(currentGroup),
    enabled: isAuthenticated && currentGroup !== '',
  })

  const {
    data: groupsData,
    error: groupsError,
    isError: isGroupsError,
  } = useQuery({
    queryKey: ['playground-groups'],
    queryFn: getUserGroups,
    enabled: isAuthenticated,
  })

  useEffect(() => {
    if (!isModelsError) return

    toast.error(
      getOptionLoadErrorMessage(
        modelsError,
        t('Failed to load playground models')
      )
    )
  }, [isModelsError, modelsError, t])

  useEffect(() => {
    if (!isGroupsError) return

    toast.error(
      getOptionLoadErrorMessage(
        groupsError,
        t('Failed to load playground groups')
      )
    )
  }, [isGroupsError, groupsError, t])

  useEffect(() => {
    if (isAuthenticated) return

    setModels(publicModels)
    const modelFallback = getModelFallback(publicModels, currentModel)
    if (modelFallback) {
      updateConfig('model', modelFallback)
    } else if (
      publicModels.length > 0 &&
      shouldClearModelForGroup(publicModels, currentModel)
    ) {
      updateConfig('model', '')
    }

    setGroups(publicGroups)
    const groupFallback = getGroupFallback(publicGroups, currentGroup)
    if (groupFallback) updateConfig('group', groupFallback)
  }, [
    currentGroup,
    currentModel,
    isAuthenticated,
    publicGroups,
    publicModels,
    setGroups,
    setModels,
    updateConfig,
  ])

  useEffect(() => {
    if (!isAuthenticated) return
    if (!modelsData) return

    setModels(modelsData)
    const fallback = getModelFallback(modelsData, currentModel)

    if (fallback) {
      updateConfig('model', fallback)
      return
    }

    if (shouldClearModelForGroup(modelsData, currentModel)) {
      updateConfig('model', '')
    }
  }, [isAuthenticated, modelsData, currentModel, setModels, updateConfig])

  useEffect(() => {
    if (!isAuthenticated || !groupsData) return

    setGroups(groupsData)
    const fallback = getGroupFallback(groupsData, currentGroup)

    if (fallback) {
      updateConfig('group', fallback)
    }
  }, [isAuthenticated, groupsData, currentGroup, setGroups, updateConfig])

  return {
    isLoadingModels: isAuthenticated && isLoadingModels,
  }
}
