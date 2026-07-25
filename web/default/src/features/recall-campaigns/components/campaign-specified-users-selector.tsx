import * as React from 'react'
import { useQueries } from '@tanstack/react-query'
import { useDebounce } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MultiSelect, type Option } from '@/components/multi-select'
import { listRecallAudienceUsers, recallCampaignKeys } from '../api'
import {
  mergeRecallAudienceUserOptions,
  parseRecallSpecifiedEmails,
} from '../audience-inputs'
import type { RecallAudienceUserOption } from '../types'

interface CampaignSpecifiedUsersSelectorProps {
  userIDs: number[]
  emails: string[]
  onUserIDsChange: (value: number[]) => void
  onEmailsChange: (value: string[]) => void
  immutable: boolean
}

function userLabel(user: RecallAudienceUserOption): string {
  const name = user.display_name || user.username
  return `${name} - ${user.email} - #${user.id}`
}

function unavailableUserOption(id: number, unavailable: string): Option {
  return {
    label: `${unavailable} - #${id}`,
    value: String(id),
  }
}

function parseSelectedIDs(values: string[]): number[] {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
}

function normalizeEmailText(emails: string[]): string {
  return emails.join('\n')
}

function emailArraySignature(emails: string[]): string {
  const parsed = parseRecallSpecifiedEmails(normalizeEmailText(emails))
  return [...parsed.emails, ...parsed.invalid].join('\u0000')
}

type UserQuery =
  | {
      isSuccess: boolean
      data?: { data?: RecallAudienceUserOption[] }
    }
  | undefined

function queryUsers(query: UserQuery): RecallAudienceUserOption[] {
  if (!query?.isSuccess) return []
  return query.data?.data ?? []
}

export function CampaignSpecifiedUsersSelector(
  props: CampaignSpecifiedUsersSelectorProps
) {
  const { t } = useTranslation()
  const [search, setSearch] = React.useState('')
  const [emailText, setEmailText] = React.useState(() =>
    normalizeEmailText(props.emails)
  )
  const [emailTextDirty, setEmailTextDirty] = React.useState(false)
  const propsEmailSignature = React.useMemo(
    () => emailArraySignature(props.emails),
    [props.emails]
  )
  const lastLoadedEmailSignatureRef = React.useRef(propsEmailSignature)
  const lastEmittedEmailSignatureRef = React.useRef<string | null>(null)
  const debouncedSearch = useDebounce(search.trim(), 300)
  const displayedEmailText = emailText

  React.useLayoutEffect(() => {
    if (propsEmailSignature === lastLoadedEmailSignatureRef.current) return

    if (emailTextDirty) {
      const isParentEcho =
        propsEmailSignature === lastEmittedEmailSignatureRef.current ||
        propsEmailSignature === lastLoadedEmailSignatureRef.current

      if (isParentEcho) return
    }

    // Props do not include a campaign id, so a new normalized email signature
    // is the external-load boundary that replaces an active local draft.
    lastLoadedEmailSignatureRef.current = propsEmailSignature
    lastEmittedEmailSignatureRef.current = null
    setEmailText(normalizeEmailText(props.emails))
    setEmailTextDirty(false)
  }, [emailTextDirty, props.emails, propsEmailSignature])

  const queryConfigs = React.useMemo(() => {
    const configs = []
    if (props.userIDs.length > 0) {
      configs.push({
        queryKey: recallCampaignKeys.audienceUsers({ ids: props.userIDs }),
        queryFn: () => listRecallAudienceUsers({ ids: props.userIDs }),
      })
    }
    if (debouncedSearch) {
      configs.push({
        queryKey: recallCampaignKeys.audienceUsers({
          keyword: debouncedSearch,
        }),
        queryFn: () => listRecallAudienceUsers({ keyword: debouncedSearch }),
      })
    }
    return configs
  }, [debouncedSearch, props.userIDs])

  const userQueries = useQueries({ queries: queryConfigs })
  const selectedQueryIndex = props.userIDs.length > 0 ? 0 : -1
  const searchQueryIndex = props.userIDs.length > 0 ? 1 : 0
  const selectedUsers = queryUsers(userQueries[selectedQueryIndex])
  const searchUsers = queryUsers(userQueries[searchQueryIndex])
  const mergedUsers = mergeRecallAudienceUserOptions(selectedUsers, searchUsers)
  const mergedUserIDs = new Set(mergedUsers.map((user) => user.id))
  const unavailableLabel = t('Unavailable')
  const userOptions: Option[] = [
    ...mergedUsers.map((user) => ({
      label: userLabel(user),
      value: String(user.id),
    })),
    ...props.userIDs
      .filter((id) => !mergedUserIDs.has(id))
      .map((id) => unavailableUserOption(id, unavailableLabel)),
  ]
  const selectedValues = props.userIDs.map(String)
  const parsedEmails = parseRecallSpecifiedEmails(displayedEmailText)
  const normalizedCount = props.userIDs.length + parsedEmails.emails.length
  const hasInvalidEmails = parsedEmails.invalid.length > 0
  const hasUserError = userQueries.some((query) => query.isError)
  const isLoadingUsers = userQueries.some((query) => query.isLoading)
  const emailHelpID = 'recall-specified-emails-help'
  const emailErrorID = 'recall-specified-emails-error'

  const handleEmailChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value
    setEmailTextDirty(true)
    setEmailText(value)
    const parsed = parseRecallSpecifiedEmails(value)
    const emittedEmails =
      parsed.invalid.length > 0
        ? [...parsed.emails, ...parsed.invalid]
        : parsed.emails
    lastEmittedEmailSignatureRef.current = emailArraySignature(emittedEmails)
    props.onEmailsChange(emittedEmails)
  }

  const handleEmailBlur = () => {
    const parsed = parseRecallSpecifiedEmails(displayedEmailText)
    if (parsed.invalid.length === 0) {
      const normalizedEmails = parsed.emails
      lastEmittedEmailSignatureRef.current =
        emailArraySignature(normalizedEmails)
      setEmailTextDirty(false)
      setEmailText(normalizeEmailText(normalizedEmails))
      props.onEmailsChange(normalizedEmails)
    }
  }

  return (
    <div className='space-y-3'>
      <div className='space-y-2'>
        <Label htmlFor='recall-specified-users'>{t('Specified users')}</Label>
        <MultiSelect
          id='recall-specified-users'
          options={userOptions}
          selected={selectedValues}
          onChange={(values) => props.onUserIDsChange(parseSelectedIDs(values))}
          onSearchChange={setSearch}
          placeholder={t('Search users by name, username, or email')}
          emptyText={t('No matching users')}
          disabled={props.immutable}
          maxVisibleChips={20}
        />
        <p className='text-muted-foreground text-xs'>
          {isLoadingUsers
            ? t('Loading matching users...')
            : hasUserError
              ? t('Failed to load matching users.')
              : userOptions.length === 0
                ? t('No selected users.')
                : t('{{count}} / 500 recipients selected', {
                    count: normalizedCount,
                  })}
        </p>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='recall-specified-emails'>{t('Manual emails')}</Label>
        <Textarea
          id='recall-specified-emails'
          value={displayedEmailText}
          onChange={handleEmailChange}
          onBlur={handleEmailBlur}
          disabled={props.immutable}
          aria-describedby={
            hasInvalidEmails ? `${emailHelpID} ${emailErrorID}` : emailHelpID
          }
          aria-invalid={hasInvalidEmails}
          rows={5}
          placeholder={t('one@example.com, two@example.com')}
        />
        <p id={emailHelpID} className='text-muted-foreground text-xs'>
          {t('{{count}} / 500 recipients selected', {
            count: normalizedCount,
          })}
        </p>
        {hasInvalidEmails && (
          <p
            id={emailErrorID}
            role='alert'
            className='text-destructive text-xs'
          >
            {t('Invalid email entries')}: {parsedEmails.invalid.join(', ')}
          </p>
        )}
      </div>
    </div>
  )
}
