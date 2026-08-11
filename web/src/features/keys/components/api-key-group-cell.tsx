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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { BadgeCell, TruncatedCell } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { updateApiKeyGroup } from '../api'
import {
  // AutoGroupBadge,
  GroupRatioBadge,
  type GroupRatio,
} from './auto-group-visuals'

type GroupOption = {
  value: string
  label: string
  ratio?: GroupRatio
}

type ApiKeyGroupCellProps = {
  apiKeyId?: number
  crossGroupRetry: boolean
  group: string
  label?: string
  isChain?: boolean
  chainGroups?: string[]
  onGroupChanged?: () => void
  ratio?: GroupRatio
  options?: GroupOption[]
  shouldReduceMotion: boolean
}

function GroupCellContent(props: ApiKeyGroupCellProps) {
  const { t } = useTranslation()

  if (props.isChain) {
    const ratio = typeof props.ratio === 'number' ? props.ratio : undefined
    const chainLabel = props.label || props.group
    const chainGroups = (props.chainGroups || []).join(' -> ')
    return (
      <TruncatedCell
        className='-ml-1.5'
        tooltipContent={
          chainGroups ? `${chainLabel}\n${chainGroups}` : chainLabel
        }
        tooltipClassName='break-all whitespace-pre-line'
      >
        <GroupBadge label={chainLabel} ratio={ratio} />
      </TruncatedCell>
    )
  }

  if (props.group !== 'auto') {
    const ratio = typeof props.ratio === 'number' ? props.ratio : undefined
    return (
      <TruncatedCell
        className='-ml-1.5'
        tooltipContent={props.group || '-'}
        tooltipClassName='break-all'
      >
        <GroupBadge group={props.group} ratio={ratio} />
      </TruncatedCell>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <BadgeCell
            data-api-key-group-cell='auto'
            className='gap-1.5 overflow-visible text-xs'
          />
        }
      >
        <StatusBadge label={t('Cross-group')} variant='info' copyable={false} />
        <GroupRatioBadge
          ratio={props.ratio}
          isAuto
          shouldReduceMotion={props.shouldReduceMotion}
        />
      </TooltipTrigger>
      <TooltipContent>
        <span className='text-xs'>
          {t(
            'Automatically selects the best available group with circuit breaker mechanism'
          )}
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

export function ApiKeyGroupCell(props: ApiKeyGroupCellProps) {
  const { t } = useTranslation()
  const [updating, setUpdating] = useState(false)
  const selectOptions = useMemo(() => {
    const options = [...(props.options ?? [])]
    if (
      props.group &&
      !options.some((option) => option.value === props.group)
    ) {
      options.push({
        value: props.group,
        label: props.label || props.group,
        ratio: props.ratio,
      })
    }
    if (!props.group && !options.some((option) => option.value === '')) {
      options.unshift({ value: '', label: t('User Group') })
    }
    return options
  }, [props.group, props.label, props.options, props.ratio, t])

  const handleChange = async (value: string | null) => {
    if (value === props.group || updating) return
    if (!props.apiKeyId || !value) return
    setUpdating(true)
    try {
      const result = await updateApiKeyGroup(
        props.apiKeyId,
        value,
        value === 'auto'
      )
      if (result.success) {
        toast.success(t('Group updated'))
        props.onGroupChanged?.()
      } else {
        toast.error(result.message || t('An unexpected error occurred'))
      }
    } catch {
      toast.error(t('An unexpected error occurred'))
    } finally {
      setUpdating(false)
    }
  }

  if (!props.options || props.options.length === 0) {
    return <GroupCellContent {...props} />
  }

  const currentLabel =
    selectOptions.find((option) => option.value === props.group)?.label ??
    props.label ??
    props.group ??
    t('User Group')
  const currentOption = selectOptions.find(
    (option) => option.value === props.group
  )

  return (
    <Select value={props.group} onValueChange={handleChange}>
      <SelectTrigger
        size='sm'
        disabled={updating}
        className='hover:bg-muted/60 h-7 max-w-full min-w-28 border-transparent bg-transparent px-1.5'
      >
        <SelectValue placeholder={currentLabel}>
          <span className='flex min-w-0 items-center gap-1.5'>
            <span className='truncate'>{currentLabel}</span>
            {currentOption?.ratio != null && (
              <GroupRatioBadge
                ratio={currentOption.ratio}
                isAuto={currentOption.value === 'auto'}
                shouldReduceMotion={props.shouldReduceMotion}
              />
            )}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className='min-w-72'>
        <SelectGroup>
          {selectOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className='min-w-0 flex-1 truncate'>{option.label}</span>
              <GroupRatioBadge
                ratio={option.ratio}
                isAuto={option.value === 'auto'}
                shouldReduceMotion={props.shouldReduceMotion}
              />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
