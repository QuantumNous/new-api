/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import {
  Apple,
  ArrowDownToLine,
  ChevronDown,
  Monitor,
  TriangleAlert,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { downloadLabel, formatSize } from '@/features/downloads/release'
import type { DesktopDownload } from '@/features/downloads/types'

export function DownloadActions(props: {
  downloads: DesktopDownload[]
  primary?: DesktopDownload
  loading: boolean
  failed: boolean
  fallbackUrl: string
  /** Product name for the fallback label, e.g. "BoxAI Desktop". */
  productName: string
}) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <Button size='lg' className='rounded-full' disabled aria-disabled='true'>
        <ArrowDownToLine aria-hidden='true' />
        {t('Checking for the latest build')}
      </Button>
    )
  }

  const primaryUrl = props.primary?.url ?? props.fallbackUrl

  // The manifest lives on R2, so a fetch failure means we could not read the release list —
  // a different situation from "no build published yet" and worth saying out loud, since the
  // visitor can retry or fall back to the releases page.
  if (!primaryUrl) {
    return (
      <div className='flex flex-col gap-2'>
        <Button size='lg' className='rounded-full' disabled aria-disabled='true'>
          <ArrowDownToLine aria-hidden='true' />
          {props.failed
            ? t('Downloads are unavailable right now')
            : t('Desktop app coming soon')}
        </Button>
        {props.failed && (
          <p className='text-muted-foreground flex items-center gap-1.5 text-xs'>
            <TriangleAlert className='size-3.5 shrink-0' aria-hidden='true' />
            {t('We could not reach the release manifest. Please try again shortly.')}
          </p>
        )}
      </div>
    )
  }

  const primaryLabel = props.primary
    ? t('Download for {{platform}}', {
        platform:
          props.primary.platform === 'macos' ? t('macOS') : t('Windows'),
      })
    : t('Download {{product}}', { product: props.productName })

  const alternatives = props.downloads.filter(
    (download) => download.url !== primaryUrl
  )

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Button
        size='lg'
        className='rounded-full'
        render={<a href={primaryUrl} download rel='noopener noreferrer' />}
      >
        <ArrowDownToLine aria-hidden='true' />
        {primaryLabel}
      </Button>

      {alternatives.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size='lg'
                variant='outline'
                className='rounded-full'
                aria-label={t('Other platforms')}
              />
            }
          >
            {t('Other platforms')}
            <ChevronDown className='size-4' aria-hidden='true' />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='w-72'>
            {alternatives.map((download) => (
              <DropdownMenuItem
                key={download.url}
                render={<a href={download.url} download />}
              >
                {download.platform === 'macos' ? (
                  <Apple className='size-4' aria-hidden='true' />
                ) : (
                  <Monitor className='size-4' aria-hidden='true' />
                )}
                <span className='flex-1'>{downloadLabel(download)}</span>
                <span className='text-muted-foreground text-xs'>
                  {formatSize(download.size)}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
