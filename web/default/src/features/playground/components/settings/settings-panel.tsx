/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { ChevronDown, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { usePlaygroundStore } from '@/stores/playground-store'

import type { StudioModality } from '../../types'
import { ChatParametersSection } from './chat-parameters-section'
import { ChatToolsSection } from './chat-tools-section'
import { GenerationSettingsSection } from './generation-settings-section'

/**
 * Settings sections for the active mode: chat parameters + tools for chat
 * and duo, generation parameters otherwise. Shared by the desktop column
 * and the mobile bottom sheet.
 */
export function SettingsSections(props: {
  modality: StudioModality
  duoActive: boolean
}) {
  const { t } = useTranslation()
  const chatMode = props.duoActive || props.modality === 'chat'

  return (
    <div className='space-y-5'>
      {chatMode ? (
        <>
          <Section title={t('Chat tools')}>
            <ChatToolsSection />
          </Section>
          <AdvancedSection>
            <GroupSection />
            <ChatParametersSection />
          </AdvancedSection>
        </>
      ) : (
        <>
          <GroupSection />
          <Section title={t('Generation parameters')}>
            <GenerationSettingsSection
              modality={props.modality as Exclude<StudioModality, 'chat'>}
            />
          </Section>
        </>
      )}
    </div>
  )
}

/**
 * Sampling parameters and channel selection are power-user knobs; fold them
 * away so the default settings surface stays approachable.
 */
function AdvancedSection(props: { children: React.ReactNode }) {
  const { t } = useTranslation()

  return (
    <Collapsible>
      <CollapsibleTrigger className='text-muted-foreground hover:text-foreground group flex w-full items-center justify-between py-1 text-[11px] font-semibold tracking-wide uppercase'>
        {t('Advanced')}
        <ChevronDown
          className='size-3.5 transition-transform group-data-[panel-open]:rotate-180'
          aria-hidden='true'
        />
      </CollapsibleTrigger>
      <CollapsibleContent className='space-y-4 pt-2'>
        {props.children}
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * Desktop settings column. At ≥1280px it renders inline (280px); between
 * 1024–1279px it floats over the workspace as an overlay so the center
 * column keeps a usable width. Open state is controlled by the caller
 * (persisted at ≥1280px, ephemeral below).
 */
export function SettingsPanel(props: {
  modality: StudioModality
  duoActive: boolean
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const isWide = useMediaQuery('(min-width: 1280px)')

  if (!props.open) return null

  return (
    <aside
      className={cn(
        'border-border bg-background flex w-[280px] shrink-0 flex-col border-l',
        !isWide && 'absolute inset-y-0 right-0 z-20 shadow-xl'
      )}
      aria-label={t('Settings')}
    >
      <div className='border-border flex h-12 shrink-0 items-center justify-between border-b px-3'>
        <h2 className='text-foreground text-sm font-semibold'>
          {t('Settings')}
        </h2>
        <Button
          size='icon'
          variant='ghost'
          className='text-muted-foreground size-7'
          aria-label={t('Close settings')}
          onClick={props.onClose}
        >
          <X className='size-4' />
        </Button>
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto p-3'>
        <SettingsSections
          modality={props.modality}
          duoActive={props.duoActive}
        />
      </div>
    </aside>
  )
}

function GroupSection() {
  const { t } = useTranslation()
  const group = usePlaygroundStore((state) => state.config.group)
  const groups = usePlaygroundStore((state) => state.groups)
  const updateConfig = usePlaygroundStore((state) => state.updateConfig)

  return (
    <div className='space-y-1.5'>
      <Label htmlFor='settings-group' className='text-xs'>
        {t('Channel')}
      </Label>
      <NativeSelect
        id='settings-group'
        size='sm'
        className='w-full'
        value={group}
        onChange={(event) => updateConfig({ group: event.target.value })}
      >
        {groups.length === 0 && (
          <NativeSelectOption value={group}>{group}</NativeSelectOption>
        )}
        {groups.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.desc ? `${option.label} — ${option.desc}` : option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section className='space-y-2'>
      <h3 className='text-muted-foreground text-[11px] font-semibold tracking-wide uppercase'>
        {props.title}
      </h3>
      {props.children}
    </section>
  )
}
