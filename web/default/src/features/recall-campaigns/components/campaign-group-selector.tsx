import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { MultiSelect } from '@/components/multi-select'
import { getRecallUserGroups, recallCampaignKeys } from '../api'
import {
  buildRecallGroupOptions,
  selectedRecallGroupFallbackOptions,
} from '../group-options'
import type { RecallGroupMode } from '../types'

interface CampaignGroupSelectorProps {
  groups: string[]
  groupMode: RecallGroupMode
  onChange: (value: string[]) => void
  immutable: boolean
}

type GroupSelectorState = 'loading' | 'error' | 'empty' | 'ready'

function GroupSelectorMessage({ state }: { state: GroupSelectorState }) {
  const { t } = useTranslation()

  if (state === 'loading') {
    return (
      <p className='text-muted-foreground text-xs'>
        {t('Loading configured user groups...')}
      </p>
    )
  }
  if (state === 'error') {
    return (
      <p className='text-destructive text-xs'>
        {t('Failed to load configured user groups.')}
      </p>
    )
  }
  if (state === 'empty') {
    return (
      <p className='text-muted-foreground text-xs'>
        {t('No configured user groups are available.')}
      </p>
    )
  }
  return null
}

export function CampaignGroupSelector(props: CampaignGroupSelectorProps) {
  const { t } = useTranslation()
  const groupQuery = useQuery({
    queryKey: recallCampaignKeys.userGroups,
    queryFn: getRecallUserGroups,
  })
  const configuredOptions = groupQuery.isSuccess
    ? buildRecallGroupOptions(groupQuery.data.data ?? [])
    : []
  const configuredValues = new Set(
    configuredOptions.map((option) => option.value)
  )
  const fallbackOptions = selectedRecallGroupFallbackOptions(
    props.groups
  ).filter((option) => !configuredValues.has(option.value))
  const options = [...configuredOptions, ...fallbackOptions]
  let state: GroupSelectorState
  if (groupQuery.isLoading) {
    state = 'loading'
  } else if (groupQuery.isError) {
    state = 'error'
  } else if (configuredOptions.length === 0) {
    state = 'empty'
  } else {
    state = 'ready'
  }
  const disabled =
    props.immutable || props.groupMode === '' || state !== 'ready'

  return (
    <div className='space-y-2'>
      <Label htmlFor='recall-groups'>{t('Recall user groups')}</Label>
      <MultiSelect
        id='recall-groups'
        options={options}
        selected={props.groups}
        onChange={props.onChange}
        placeholder={t('Select user groups')}
        emptyText={t('No matching user groups')}
        allowCreate={false}
        disabled={disabled}
      />
      <GroupSelectorMessage state={state} />
    </div>
  )
}
