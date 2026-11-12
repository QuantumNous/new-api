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
import { useMutation } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { findPluginByCode } from '../lib/marketplace'
import type { MarketplacePlugin, MarketplaceSource } from '../types'

/** A plugin found by its code, and the source that lists it. */
export type PluginCodeMatch = {
  code: string
  source: MarketplaceSource
  plugin: MarketplacePlugin
}

type PluginCodeLookupProps = {
  /** Configured official sources; their indexes list official plugin codes. */
  officialSources: MarketplaceSource[]
  /** The configured community source, if any; the site resolves community codes. */
  communitySource?: MarketplaceSource
  /** Called after each lookup; null when no plugin has the code. */
  onResult: (match: PluginCodeMatch | null) => void
}

/** newapi.ai gives every official and community plugin an 8-digit code. */
const PLUGIN_CODE = /^\d{8}$/

/** Finds a plugin by its code; the panel shows it as a card to install from. */
export function PluginCodeLookup(props: PluginCodeLookupProps) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const lookup = useMutation({
    mutationFn: (value: string) =>
      findPluginByCode(value, props.officialSources, props.communitySource),
    meta: { errorToast: false },
    onSuccess: (found, value) => {
      props.onResult(found ? { code: value, ...found } : null)
    },
  })
  const trimmed = code.trim()
  const valid = PLUGIN_CODE.test(trimmed)
  let message = ''
  if (lookup.isSuccess && !lookup.data) {
    message = t('No plugin has this code.')
  }
  if (lookup.isError) {
    message = t('Could not look up the code. Try again later.')
  }

  return (
    <form
      className='space-y-1.5'
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) lookup.mutate(trimmed)
      }}
    >
      <div className='flex items-center gap-2'>
        <Label htmlFor='community-plugin-code' className='shrink-0'>
          {t('Plugin code')}
        </Label>
        {/* Sized for the 8-digit code. */}
        <Input
          id='community-plugin-code'
          value={code}
          placeholder='12345678'
          inputMode='numeric'
          autoComplete='off'
          spellCheck={false}
          className='h-8 w-36 font-mono'
          aria-invalid={Boolean(message)}
          aria-describedby={
            message ? 'community-plugin-code-message' : undefined
          }
          onChange={(event) => {
            setCode(event.target.value)
            if (!lookup.isIdle) lookup.reset()
          }}
        />
        <Button
          type='submit'
          variant='outline'
          size='sm'
          disabled={!valid || lookup.isPending}
        >
          <Search />
          {t('Find')}
        </Button>
      </div>
      {message && (
        <p
          id='community-plugin-code-message'
          role='alert'
          className='text-destructive text-sm'
        >
          {message}
        </p>
      )}
    </form>
  )
}
