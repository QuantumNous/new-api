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
import { Send, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Turnstile } from '@/components/turnstile'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

import { isTurnstileReady } from '../lib'

export function ContributionSubmissionControls(props: {
  ready: boolean
  agreementChecked: boolean
  onAgreementCheckedChange: (checked: boolean) => void
  onOpenAgreement: () => void
  isTurnstileEnabled: boolean
  turnstileSiteKey: string
  turnstileToken: string
  turnstileWidgetKey: number
  onTurnstileVerify: (token: string) => void
  onTurnstileExpire: () => void
  onSubmit: () => void
  submitting: boolean
}) {
  const { t } = useTranslation()
  const turnstileReady = isTurnstileReady(
    props.isTurnstileEnabled,
    props.turnstileToken
  )
  const disabled =
    !props.ready ||
    !props.agreementChecked ||
    !turnstileReady ||
    props.submitting

  return (
    <div className='space-y-3'>
      {props.ready && props.isTurnstileEnabled ? (
        <Turnstile
          key={props.turnstileWidgetKey}
          siteKey={props.turnstileSiteKey}
          onVerify={props.onTurnstileVerify}
          onExpire={props.onTurnstileExpire}
          className='min-h-16'
        />
      ) : null}

      <div className='flex items-start gap-2.5'>
        <Checkbox
          id='channel-contribution-agreement'
          checked={props.agreementChecked}
          onCheckedChange={props.onAgreementCheckedChange}
          disabled={!props.ready || props.submitting}
          aria-label={t('Accept the channel contribution agreement')}
        />
        <div className='text-muted-foreground min-w-0 leading-5'>
          <Label
            htmlFor='channel-contribution-agreement'
            className='font-normal'
          >
            {t('I have read and agree to')}
          </Label>{' '}
          <button
            type='button'
            className='text-foreground focus-visible:ring-ring rounded-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none'
            onClick={props.onOpenAgreement}
          >
            {t('Channel Contribution Agreement')}
          </button>
        </div>
      </div>

      <Button
        type='button'
        className='w-full justify-center'
        disabled={disabled}
        onClick={props.onSubmit}
      >
        {props.submitting ? (
          <Loader2 className='animate-spin' data-icon='inline-start' />
        ) : (
          <Send data-icon='inline-start' />
        )}
        {t('Submit for review')}
      </Button>
    </div>
  )
}
