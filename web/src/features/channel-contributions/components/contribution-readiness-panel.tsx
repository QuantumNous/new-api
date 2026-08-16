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
import {
  CheckCircle2,
  CircleDashed,
  CloudDownload,
  FlaskConical,
  Loader2,
  Save,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import {
  getTestRunResults,
  isTestRunFresh,
  isTestRunActive,
  modelTestPassed,
  testRunHasCompletePricing,
  testRunPassed,
} from '../lib'
import type { ChannelContributionTestRun } from '../types'
import { ContributionSubmissionControls } from './submission-controls'
import { ContributionTestMatrix } from './test-matrix'

function ReadinessItem(props: { complete: boolean; label: string }) {
  return (
    <li className='flex items-start gap-2 text-sm'>
      {props.complete ? (
        <CheckCircle2
          className='text-success mt-0.5 size-4 shrink-0'
          aria-hidden='true'
        />
      ) : (
        <CircleDashed
          className='text-muted-foreground mt-0.5 size-4 shrink-0'
          aria-hidden='true'
        />
      )}
      <span
        className={props.complete ? 'text-foreground' : 'text-muted-foreground'}
      >
        {props.label}
      </span>
    </li>
  )
}

export function ContributionReadinessPanel(props: {
  saved: boolean
  unsaved: boolean
  modelCount: number
  run: ChannelContributionTestRun | null
  priceConfigured?: boolean
  busy: boolean
  saving: boolean
  fetchingModels: boolean
  testing: boolean
  onSave: () => void
  onFetchModels: () => void
  onTest: () => void
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
  const active = isTestRunActive(props.run)
  const results = getTestRunResults(props.run)
  const hasResults = results.length > 0
  const fresh = isTestRunFresh(props.run)
  const probesPassed = Boolean(
    props.run &&
    ['succeeded', 'passed'].includes(props.run.status) &&
    hasResults &&
    results.every(modelTestPassed) &&
    fresh
  )
  const pricingReady = testRunHasCompletePricing(
    props.run,
    props.priceConfigured
  )
  const ready =
    props.saved &&
    !props.unsaved &&
    props.modelCount > 0 &&
    testRunPassed(props.run, props.priceConfigured)

  return (
    <Card className='gap-0 py-0 lg:sticky lg:top-4'>
      <CardHeader className='border-b py-4'>
        <CardTitle>{t('Validation and submission')}</CardTitle>
        <CardDescription>
          {t('Save the draft, test every model, then submit it for review.')}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-5 py-4'>
        <div className='grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3'>
          <Button
            type='button'
            variant='outline'
            className='h-auto min-h-11 min-w-0 gap-2 px-3 py-2.5'
            disabled={props.busy || !props.unsaved}
            onClick={props.onSave}
          >
            {props.saving ? (
              <Loader2 className='animate-spin' />
            ) : (
              <Save aria-hidden='true' />
            )}
            <span className='text-center leading-tight whitespace-normal'>
              {t('Save draft')}
            </span>
          </Button>
          <Button
            type='button'
            variant='outline'
            className='h-auto min-h-11 min-w-0 gap-2 px-3 py-2.5'
            disabled={props.busy}
            onClick={props.onFetchModels}
          >
            {props.fetchingModels ? (
              <Loader2 className='animate-spin' />
            ) : (
              <CloudDownload aria-hidden='true' />
            )}
            <span className='text-center leading-tight whitespace-normal'>
              {t('Fetch models')}
            </span>
          </Button>
          <Button
            type='button'
            variant='outline'
            className='h-auto min-h-11 min-w-0 gap-2 px-3 py-2.5'
            disabled={props.busy || props.modelCount === 0}
            onClick={props.onTest}
          >
            {props.testing || active ? (
              <Loader2 className='animate-spin' />
            ) : (
              <FlaskConical aria-hidden='true' />
            )}
            <span className='text-center leading-tight whitespace-normal'>
              {t('Test all')}
            </span>
          </Button>
        </div>

        <ul className='grid gap-2 sm:grid-cols-2 lg:grid-cols-1'>
          <ReadinessItem
            complete={props.saved && !props.unsaved}
            label={t('Current draft is saved')}
          />
          <ReadinessItem
            complete={props.modelCount > 0}
            label={t('At least one model is selected')}
          />
          <ReadinessItem
            complete={probesPassed}
            label={t('Required tests passed within the last 30 minutes')}
          />
          <ReadinessItem
            complete={pricingReady}
            label={t('Every model has administrator pricing')}
          />
        </ul>

        {props.unsaved && props.saved ? (
          <Alert>
            <AlertDescription>
              {t('Configuration changes invalidate the previous test result.')}
            </AlertDescription>
          </Alert>
        ) : null}

        {props.run &&
        ['succeeded', 'passed'].includes(props.run.status) &&
        !fresh ? (
          <Alert>
            <AlertDescription>
              {t(
                'This test result is older than 30 minutes. Run all tests again before submitting.'
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        <ContributionTestMatrix run={props.run} />

        <div className='border-t pt-4'>
          <ContributionSubmissionControls
            ready={ready}
            agreementChecked={props.agreementChecked}
            onAgreementCheckedChange={props.onAgreementCheckedChange}
            onOpenAgreement={props.onOpenAgreement}
            isTurnstileEnabled={props.isTurnstileEnabled}
            turnstileSiteKey={props.turnstileSiteKey}
            turnstileToken={props.turnstileToken}
            turnstileWidgetKey={props.turnstileWidgetKey}
            onTurnstileVerify={props.onTurnstileVerify}
            onTurnstileExpire={props.onTurnstileExpire}
            onSubmit={props.onSubmit}
            submitting={props.submitting}
          />
        </div>
      </CardContent>
    </Card>
  )
}
