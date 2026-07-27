/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { Apple, ArrowDownToLine, ChevronDown, Monitor } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { formatSize } from '../lib/release'
import type { DesktopDownload } from '../types'

const KIND_LABEL: Record<DesktopDownload['kind'], string> = {
  dmg: 'macOS · Apple Silicon',
  exe: 'Windows · Installer',
  msi: 'Windows · MSI',
}

export function DownloadActions(props: {
  downloads: DesktopDownload[]
  primary?: DesktopDownload
  loading: boolean
  fallbackUrl: string
}) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <Button size='lg' disabled aria-disabled='true'>
        <ArrowDownToLine aria-hidden='true' />
        {t('Checking for the latest build')}
      </Button>
    )
  }

  // No manifest and no manual override: there is genuinely nothing to hand out yet.
  if (!props.primary && !props.fallbackUrl) {
    return (
      <Button size='lg' disabled aria-disabled='true'>
        <ArrowDownToLine aria-hidden='true' />
        {t('Desktop app coming soon')}
      </Button>
    )
  }

  const primaryUrl = props.primary?.url ?? props.fallbackUrl
  const primaryLabel = props.primary
    ? t('Download for {{platform}}', {
        platform:
          props.primary.platform === 'macos' ? t('macOS') : t('Windows'),
      })
    : t('Download BoxAI Desktop')

  const alternatives = props.downloads.filter(
    (download) => download.url !== primaryUrl
  )

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Button
        size='lg'
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
                aria-label={t('Other platforms')}
              />
            }
          >
            {t('Other platforms')}
            <ChevronDown className='size-4' aria-hidden='true' />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='w-64'>
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
                <span className='flex-1'>{KIND_LABEL[download.kind]}</span>
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
