import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select'
import {
  getRecallEmailSenderStatus,
  recallCampaignKeys,
  updateRecallEmailSender,
} from '../api'
import type { RecallEmailSenderStatus } from '../types'

const DEFAULT_SENDER_VALUE = ''
const SENDER_CHOICES_CHANGED =
  'Sender address choices changed. Review and save again.'
const SENDER_LOAD_ERROR = 'Failed to load sender addresses.'
const SENDER_UPDATE_ERROR = 'Failed to update sender address.'

interface CampaignEmailSenderControlViewProps {
  disabled: boolean
  error: string
  pending: boolean
  selectedEmailFrom: string
  status: RecallEmailSenderStatus
  onSave: () => void
  onSelectionChange: (value: string) => void
}

interface EmailSenderOption {
  label: string
  value: string
}

interface SenderSyncResult {
  confirmedEmailFrom: string
  error: string
  selectedEmailFrom: string
}

export type RecallEmailSenderState = SenderSyncResult

type RecallEmailSenderStateAction =
  | { type: 'select'; selectedEmailFrom: string }
  | { type: 'server-sync'; serverStatus: RecallEmailSenderStatus }
  | { type: 'save-success'; status: RecallEmailSenderStatus }
  | { type: 'save-failure'; message: string }
  | { type: 'load-error' }

// eslint-disable-next-line react-refresh/only-export-components
export function getRecallEmailSenderOptions(
  status: RecallEmailSenderStatus
): EmailSenderOption[] {
  const defaultOption = status.options.find((option) => option.is_default)
  const options: EmailSenderOption[] = []

  if (defaultOption) {
    options.push({
      label: `Default SMTP sender (${defaultOption.email})`,
      value: DEFAULT_SENDER_VALUE,
    })
  }

  for (const option of status.options) {
    if (option.is_default) continue
    options.push({ label: option.email, value: option.email })
  }

  return options
}

// eslint-disable-next-line react-refresh/only-export-components
export function syncRecallEmailSenderFromServer(
  selectedEmailFrom: string,
  confirmedEmailFrom: string,
  serverStatus: RecallEmailSenderStatus
): SenderSyncResult {
  const nextConfirmedEmailFrom = serverStatus.configured_email_from
  const options = getRecallEmailSenderOptions(serverStatus)
  const selectedOptionStillExists = options.some(
    (option) => option.value === selectedEmailFrom
  )

  if (selectedEmailFrom === confirmedEmailFrom) {
    return {
      confirmedEmailFrom: nextConfirmedEmailFrom,
      error: '',
      selectedEmailFrom: nextConfirmedEmailFrom,
    }
  }

  if (selectedOptionStillExists) {
    return {
      confirmedEmailFrom: nextConfirmedEmailFrom,
      error: '',
      selectedEmailFrom,
    }
  }

  return {
    confirmedEmailFrom: nextConfirmedEmailFrom,
    error: SENDER_CHOICES_CHANGED,
    selectedEmailFrom: nextConfirmedEmailFrom,
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function applyRecallEmailSenderSaveSuccess(
  status: RecallEmailSenderStatus
): Pick<SenderSyncResult, 'confirmedEmailFrom' | 'selectedEmailFrom'> {
  return {
    confirmedEmailFrom: status.configured_email_from,
    selectedEmailFrom: status.configured_email_from,
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function applyRecallEmailSenderSaveFailure(
  confirmedEmailFrom: string,
  message: string
): Pick<SenderSyncResult, 'error' | 'selectedEmailFrom'> {
  return {
    error: message.trim() || SENDER_UPDATE_ERROR,
    selectedEmailFrom: confirmedEmailFrom,
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function reduceRecallEmailSenderState(
  state: RecallEmailSenderState,
  action: RecallEmailSenderStateAction
): RecallEmailSenderState {
  if (action.type === 'select') {
    return {
      ...state,
      error: '',
      selectedEmailFrom: action.selectedEmailFrom,
    }
  }

  if (action.type === 'server-sync') {
    return syncRecallEmailSenderFromServer(
      state.selectedEmailFrom,
      state.confirmedEmailFrom,
      action.serverStatus
    )
  }

  if (action.type === 'save-success') {
    return {
      ...state,
      error: '',
      ...applyRecallEmailSenderSaveSuccess(action.status),
    }
  }

  if (action.type === 'save-failure') {
    return {
      ...state,
      ...applyRecallEmailSenderSaveFailure(
        state.confirmedEmailFrom,
        action.message
      ),
    }
  }

  return {
    ...state,
    error: SENDER_LOAD_ERROR,
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function getRecallEmailSenderControlState(
  status: RecallEmailSenderStatus | undefined,
  pending: boolean,
  queryError: boolean
): { disabled: boolean; loadError: boolean } {
  const missingStatus = !status
  return {
    disabled: pending || missingStatus,
    loadError: queryError && missingStatus,
  }
}

function createDefaultSenderStatus(): RecallEmailSenderStatus {
  return {
    configured_email_from: DEFAULT_SENDER_VALUE,
    effective_email_from: '',
    uses_default: true,
    options: [],
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return SENDER_UPDATE_ERROR
}

export function CampaignEmailSenderControlView(
  props: CampaignEmailSenderControlViewProps
): React.JSX.Element {
  const { t } = useTranslation()
  const options = getRecallEmailSenderOptions(props.status)
  const defaultOption = props.status.options.find((option) => option.is_default)

  return (
    <div className='min-w-80 space-y-2 rounded-lg border p-3'>
      <form
        className='flex items-end gap-2'
        onSubmit={(event) => {
          event.preventDefault()
          props.onSave()
        }}
      >
        <div className='min-w-0 flex-1 space-y-1'>
          <Label htmlFor='recall-email-sender'>
            {t('Activity sender address')}
          </Label>
          <NativeSelect
            id='recall-email-sender'
            disabled={props.disabled || props.pending}
            value={props.selectedEmailFrom}
            onChange={(event) => props.onSelectionChange(event.target.value)}
          >
            {options.map((option) => {
              const label =
                option.value === DEFAULT_SENDER_VALUE
                  ? t('Default SMTP sender ({{email}})', {
                      email: defaultOption?.email ?? '',
                    })
                  : option.label
              return (
                <NativeSelectOption key={option.value} value={option.value}>
                  {label}
                </NativeSelectOption>
              )
            })}
          </NativeSelect>
        </div>
        <Button type='submit' disabled={props.disabled || props.pending}>
          {props.pending ? t('Saving') : t('Save sender address')}
        </Button>
      </form>
      <p className='text-muted-foreground text-xs'>
        {t(
          'All Activity Configuration campaigns share this sender. Other system emails are unaffected.'
        )}
      </p>
      {props.error ? (
        <p role='alert' className='text-destructive text-xs'>
          {t(props.error)}
        </p>
      ) : null}
    </div>
  )
}

export function CampaignEmailSenderControl(): React.JSX.Element {
  const queryClient = useQueryClient()
  const updateSender = useMutation({ mutationFn: updateRecallEmailSender })
  const [senderState, setSenderState] = useState<RecallEmailSenderState>({
    confirmedEmailFrom: DEFAULT_SENDER_VALUE,
    error: '',
    selectedEmailFrom: DEFAULT_SENDER_VALUE,
  })
  const senderQuery = useQuery({
    queryKey: recallCampaignKeys.emailSender,
    queryFn: getRecallEmailSenderStatus,
  })
  const serverStatus = senderQuery.data?.data
  const status = serverStatus ?? createDefaultSenderStatus()
  const controlState = getRecallEmailSenderControlState(
    serverStatus,
    senderQuery.isPending,
    senderQuery.isError
  )

  useEffect(() => {
    if (!senderQuery.data?.data) return
    const serverStatusData = senderQuery.data.data

    setSenderState((currentState) => {
      return reduceRecallEmailSenderState(currentState, {
        serverStatus: serverStatusData,
        type: 'server-sync',
      })
    })
  }, [senderQuery.data])

  const save = async () => {
    if (controlState.disabled) {
      setSenderState((currentState) =>
        reduceRecallEmailSenderState(currentState, { type: 'load-error' })
      )
      return
    }
    setSenderState((currentState) => ({ ...currentState, error: '' }))
    try {
      const response = await updateSender.mutateAsync(
        senderState.selectedEmailFrom
      )
      if (!response.data) {
        setSenderState((currentState) =>
          reduceRecallEmailSenderState(currentState, {
            message: response.message || '',
            type: 'save-failure',
          })
        )
        return
      }

      queryClient.setQueryData(recallCampaignKeys.emailSender, response)
      setSenderState((currentState) =>
        reduceRecallEmailSenderState(currentState, {
          status: response.data as RecallEmailSenderStatus,
          type: 'save-success',
        })
      )
      await queryClient.invalidateQueries({
        queryKey: recallCampaignKeys.emailSender,
      })
    } catch (updateError) {
      setSenderState((currentState) =>
        reduceRecallEmailSenderState(currentState, {
          message: getErrorMessage(updateError),
          type: 'save-failure',
        })
      )
    }
  }

  return (
    <CampaignEmailSenderControlView
      disabled={controlState.disabled}
      error={controlState.loadError ? SENDER_LOAD_ERROR : senderState.error}
      pending={updateSender.isPending}
      selectedEmailFrom={senderState.selectedEmailFrom}
      status={status}
      onSave={() => void save()}
      onSelectionChange={(value) => {
        setSenderState((currentState) =>
          reduceRecallEmailSenderState(currentState, {
            selectedEmailFrom: value,
            type: 'select',
          })
        )
      }}
    />
  )
}
