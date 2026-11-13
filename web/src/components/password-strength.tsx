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
import { Check, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MOTION_TRANSITION } from '@/lib/motion'
import {
  ACCOUNT_PASSWORD_MAX_LENGTH,
  ACCOUNT_PASSWORD_MIN_LENGTH,
} from '@/lib/password-policy'
import { cn } from '@/lib/utils'

import {
  evaluatePasswordStrength,
  getPasswordConfirmationState,
  type PasswordStrengthRuleId,
  type PasswordStrengthScore,
} from './password-strength-utils'

const STRENGTH_SEGMENTS = [1, 2, 3, 4] as const

const RULE_LABELS: Record<PasswordStrengthRuleId, string> = {
  length: '8–128 characters',
  long: '15 or more characters',
  case: 'Uppercase and lowercase letters',
  digit: 'A number',
  symbol: 'A symbol',
}

const METER_TONES: Record<
  PasswordStrengthScore,
  { bar: string; text: string }
> = {
  0: {
    bar: 'bg-muted-foreground/30',
    text: 'text-muted-foreground',
  },
  1: {
    bar: 'bg-destructive',
    text: 'text-destructive',
  },
  2: {
    bar: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
  },
  3: {
    bar: 'bg-sky-500',
    text: 'text-sky-700 dark:text-sky-400',
  },
  4: {
    bar: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
}

type PasswordStrengthProps = {
  value: string
  className?: string
  id?: string
  quietWhenEmpty?: boolean
}

type PasswordRuleItemProps = {
  rule: {
    id: PasswordStrengthRuleId
    met: boolean
  }
  label: string
  shouldReduceMotion: boolean | null
}

function PasswordRuleItem(props: PasswordRuleItemProps) {
  const { t } = useTranslation()
  const rule = props.rule
  const transition = props.shouldReduceMotion
    ? MOTION_TRANSITION.none
    : MOTION_TRANSITION.spring

  return (
    <li className='text-muted-foreground flex items-center gap-2 text-xs'>
      <span
        aria-hidden='true'
        className={cn(
          'grid size-3.5 shrink-0 place-items-center rounded-sm border transition-colors',
          rule.met
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-border'
        )}
      >
        <motion.span
          initial={false}
          animate={{
            opacity: rule.met ? 1 : 0,
            scale: rule.met ? 1 : 0.65,
          }}
          transition={transition}
        >
          <Check className='size-2.5' strokeWidth={2.5} />
        </motion.span>
      </span>
      <span className={cn(rule.met && 'text-foreground')}>{props.label}</span>
      <span className='sr-only'>{rule.met ? t('Met') : t('Not met')}</span>
    </li>
  )
}

export function PasswordStrength(props: PasswordStrengthProps) {
  const { t } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
  const value = props.value
  const strength = useMemo(() => evaluatePasswordStrength(value), [value])
  const [settledAnnouncement, setSettledAnnouncement] = useState('')
  const tone = METER_TONES[strength.score]
  const isEmpty = strength.lengthState === 'empty'
  const requirementRule = strength.rules.find((rule) => rule.id === 'length')
  const suggestionRules = useMemo(
    () => strength.rules.filter((rule) => rule.id !== 'length'),
    [strength.rules]
  )
  const unmetSuggestionLabels = useMemo(
    () =>
      suggestionRules
        .filter((rule) => !rule.met)
        .map((rule) => t(RULE_LABELS[rule.id])),
    [suggestionRules, t]
  )
  let requirementLabel = t(RULE_LABELS.length)
  if (strength.lengthState === 'too-short') {
    requirementLabel = t('Characters needed: {{count}}', {
      count: ACCOUNT_PASSWORD_MIN_LENGTH - strength.characterCount,
    })
  } else if (strength.lengthState === 'too-long') {
    requirementLabel = t('Characters over limit: {{count}}', {
      count: strength.characterCount - ACCOUNT_PASSWORD_MAX_LENGTH,
    })
  }
  let requirementStatusLabel = t('Password requirements not met')
  let requirementStatusTone = 'text-destructive'
  if (isEmpty) {
    requirementStatusLabel = t(RULE_LABELS.length)
    requirementStatusTone = 'text-muted-foreground'
  } else if (strength.meetsRequirements) {
    requirementStatusLabel = t('Password requirements met')
    requirementStatusTone = 'text-emerald-700 dark:text-emerald-400'
  }

  const announcement = useMemo(() => {
    if (!value) return ''

    const parts = [
      t('Password strength: {{strength}}.', {
        strength: t(strength.labelKey),
      }),
    ]
    if (strength.guessable) {
      parts.push(t('This password is easy to guess.'))
    }
    parts.push(
      strength.meetsRequirements
        ? t('Password requirements met')
        : t('Password requirements not met')
    )
    if (unmetSuggestionLabels.length === 0) {
      parts.push(t('All password suggestions met.'))
    } else {
      parts.push(
        t('Suggestions remaining: {{suggestions}}.', {
          suggestions: unmetSuggestionLabels.join(', '),
        })
      )
    }

    return parts.join(' ')
  }, [
    strength.guessable,
    strength.labelKey,
    strength.meetsRequirements,
    t,
    unmetSuggestionLabels,
    value,
  ])

  useEffect(() => {
    if (!announcement) {
      setSettledAnnouncement('')
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSettledAnnouncement(announcement)
    }, 700)

    return () => window.clearTimeout(timeoutId)
  }, [announcement])

  if (props.quietWhenEmpty && !value) return null

  const transition = shouldReduceMotion
    ? MOTION_TRANSITION.none
    : MOTION_TRANSITION.spring

  return (
    <div id={props.id} className={cn('w-full', props.className)}>
      <div
        role='meter'
        aria-label={t('Password strength')}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={strength.score}
        aria-valuetext={t(strength.labelKey)}
        className='grid grid-cols-4 gap-1.5'
      >
        {STRENGTH_SEGMENTS.map((segment) => (
          <div
            key={segment}
            className='bg-muted relative h-1.5 overflow-hidden rounded-full'
          >
            <motion.span
              aria-hidden='true'
              className={cn(
                'absolute inset-0 origin-left rounded-full',
                tone.bar
              )}
              initial={false}
              animate={{ scaleX: segment <= strength.score ? 1 : 0 }}
              transition={transition}
            />
          </div>
        ))}
      </div>

      <div className='mt-2 flex min-h-5 items-center justify-between gap-3 text-xs'>
        <span className={cn('font-medium', tone.text)}>
          {t(strength.labelKey)}
        </span>
        <span className={requirementStatusTone}>{requirementStatusLabel}</span>
      </div>

      {strength.guessable && (
        <p className='mt-1 text-xs text-amber-700 dark:text-amber-400'>
          {t('Easy to guess')}
        </p>
      )}

      <div className='mt-2'>
        <p className='text-foreground mb-1.5 text-xs font-medium'>
          {t('Password requirement')}
        </p>
        <ul>
          {requirementRule && (
            <PasswordRuleItem
              rule={requirementRule}
              label={requirementLabel}
              shouldReduceMotion={shouldReduceMotion}
            />
          )}
        </ul>
      </div>

      <div className='mt-3'>
        <p className='text-muted-foreground mb-1.5 text-xs font-medium'>
          {t('For a stronger password')}
        </p>
        <ul className='grid gap-1.5 sm:grid-cols-2'>
          {suggestionRules.map((rule) => (
            <PasswordRuleItem
              key={rule.id}
              rule={rule}
              label={t(RULE_LABELS[rule.id])}
              shouldReduceMotion={shouldReduceMotion}
            />
          ))}
        </ul>
      </div>

      <p aria-live='polite' className='sr-only'>
        {settledAnnouncement}
      </p>
    </div>
  )
}

type PasswordConfirmationStatusProps = {
  password: string
  confirmation: string
  // The confirmation field already shows its own validation error, which
  // reports the mismatch after a submit; the live line then stays quiet.
  hasFieldError?: boolean
  className?: string
  id?: string
}

export function PasswordConfirmationStatus(
  props: PasswordConfirmationStatusProps
) {
  const { t } = useTranslation()
  let state = getPasswordConfirmationState(props.password, props.confirmation)
  if (state === 'mismatch' && props.hasFieldError) state = 'empty'

  const matches = state === 'match'
  let label = ''
  if (state !== 'empty') {
    label = matches ? t('Passwords match') : t('Passwords do not match')
  }
  const Icon = matches ? Check : X

  return (
    <p
      id={props.id}
      role='status'
      aria-live='polite'
      aria-atomic='true'
      className={cn(
        state !== 'empty' && 'flex items-center gap-1.5 text-xs',
        matches ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive',
        props.className
      )}
    >
      {state !== 'empty' && (
        <Icon aria-hidden='true' className='size-3.5' strokeWidth={2.5} />
      )}
      {label}
    </p>
  )
}
