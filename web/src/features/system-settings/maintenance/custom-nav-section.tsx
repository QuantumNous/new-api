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
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ReactIconByName } from '@/components/react-icon-by-name'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { INTERFACE_LANGUAGE_OPTIONS } from '@/i18n/languages'

import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  CUSTOM_NAV_CONTENT_TYPES,
  CUSTOM_NAV_MAX_ITEMS,
  CUSTOM_NAV_PLACEMENTS,
  CUSTOM_NAV_SIDEBAR_SECTIONS,
  createCustomNavItem,
  serializeCustomNavItems,
  validateCustomNavItems,
  type CustomNavContentType,
  type CustomNavItem,
  type CustomNavPlacement,
  type CustomNavSidebarSection,
} from './custom-nav-config'

type CustomNavSectionProps = {
  items: CustomNavItem[]
  initialSerialized: string
}

type DraftItem = CustomNavItem & { key: string }

let draftKeySeed = 0

function withDraftKey(item: CustomNavItem): DraftItem {
  draftKeySeed += 1
  return { ...item, key: `custom-nav-${draftKeySeed}` }
}

function stripDraftKey(item: DraftItem): CustomNavItem {
  return {
    id: item.id,
    labels: item.labels,
    icon: item.icon,
    placement: item.placement,
    sidebarSection: item.sidebarSection,
    contentType: item.contentType,
    content: item.content,
    enabled: item.enabled,
  }
}

export function CustomNavSection({
  items,
  initialSerialized,
}: CustomNavSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [draft, setDraft] = useState<DraftItem[]>(() =>
    items.map((item) => withDraftKey(item))
  )

  useEffect(() => {
    setDraft(items.map((item) => withDraftKey(item)))
  }, [items])

  const placementLabels: Record<CustomNavPlacement, string> = {
    sidebar: t('Sidebar'),
    header: t('Header'),
    both: t('Sidebar and header'),
  }

  const sectionLabels: Record<CustomNavSidebarSection, string> = {
    chat: t('Chat area'),
    general: t('Console area'),
    personal: t('Personal area'),
    admin: t('Admin area'),
  }

  const contentTypeLabels: Record<CustomNavContentType, string> = {
    html: t('HTML'),
    markdown: t('Markdown'),
    url: t('URL (iframe)'),
  }

  const errorMessages = {
    id: t('Use lowercase letters, numbers and dashes for the identifier.'),
    'duplicate-id': t('Identifiers must be unique.'),
    label: t('Enter a name for at least one language.'),
    content: t('Content is required.'),
    'content-length': t('Content is too long.'),
    url: t('Enter a valid http(s) URL.'),
  } as const

  const updateItem = (index: number, patch: Partial<CustomNavItem>) => {
    setDraft((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    )
  }

  const updateLabel = (index: number, code: string, value: string) => {
    setDraft((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, labels: { ...item.labels, [code]: value } }
          : item
      )
    )
  }

  const addItem = () => {
    setDraft((current) =>
      current.length >= CUSTOM_NAV_MAX_ITEMS
        ? current
        : [...current, withDraftKey(createCustomNavItem(current.length))]
    )
  }

  const removeItem = (index: number) => {
    setDraft((current) =>
      current.filter((_item, itemIndex) => itemIndex !== index)
    )
  }

  const onSave = async () => {
    const normalized = draft.map((draftItem) => ({
      ...stripDraftKey(draftItem),
      id: draftItem.id.trim(),
      icon: draftItem.icon.trim(),
      labels: Object.fromEntries(
        Object.entries(draftItem.labels)
          .map(([code, label]) => [code, label.trim()] as const)
          .filter(([, label]) => label.length > 0)
      ),
    }))

    const errors = validateCustomNavItems(normalized)
    if (errors.size > 0) {
      const [, firstError] = [...errors][0]
      toast.error(errorMessages[firstError])
      return
    }

    const serialized = serializeCustomNavItems(normalized)
    if (serialized === initialSerialized) {
      return
    }

    await updateOption.mutateAsync({
      key: 'CustomNavItems',
      value: serialized,
    })
  }

  return (
    <SettingsSection title={t('Custom navigation')}>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Add custom buttons to the sidebar and header with localized names, icons and content.'
        )}
      </p>
      <SettingsPageFormActions
        onSave={onSave}
        isSaving={updateOption.isPending}
        saveLabel='Save custom navigation'
      />

      <div className='flex flex-col gap-6'>
        {draft.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            {t('No custom navigation items yet.')}
          </p>
        ) : null}

        {draft.map((item, index) => (
          <div key={item.key} className='rounded-lg border p-4'>
            <div className='mb-4 flex items-center justify-between gap-3'>
              <div className='flex items-center gap-2'>
                {item.icon ? (
                  <ReactIconByName name={item.icon} className='size-4' />
                ) : null}
                <span className='text-sm font-medium'>
                  {item.labels.en || item.id}
                </span>
              </div>
              <div className='flex items-center gap-3'>
                <Label className='text-muted-foreground text-xs'>
                  {t('Enable')}
                </Label>
                <Switch
                  checked={item.enabled}
                  onCheckedChange={(checked) =>
                    updateItem(index, { enabled: checked === true })
                  }
                  aria-label={t('Enable')}
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-sm'
                  className='text-destructive hover:text-destructive'
                  aria-label={t('Delete')}
                  onClick={() => removeItem(index)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>

            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='flex flex-col gap-2'>
                <Label htmlFor={`custom-nav-id-${index}`}>
                  {t('Identifier')}
                </Label>
                <Input
                  id={`custom-nav-id-${index}`}
                  value={item.id}
                  onChange={(event) =>
                    updateItem(index, { id: event.target.value })
                  }
                  placeholder='docs'
                />
              </div>

              <div className='flex flex-col gap-2'>
                <Label htmlFor={`custom-nav-icon-${index}`}>{t('Icon')}</Label>
                <Input
                  id={`custom-nav-icon-${index}`}
                  value={item.icon}
                  onChange={(event) =>
                    updateItem(index, { icon: event.target.value })
                  }
                  placeholder='FiBookOpen'
                />
              </div>

              <div className='flex flex-col gap-2'>
                <Label>{t('Placement')}</Label>
                <Select
                  value={item.placement}
                  onValueChange={(value) => {
                    if (typeof value === 'string' && value) {
                      updateItem(index, {
                        placement: value as CustomNavPlacement,
                      })
                    }
                  }}
                >
                  <SelectTrigger aria-label={t('Placement')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {CUSTOM_NAV_PLACEMENTS.map((placement) => (
                      <SelectItem key={placement} value={placement}>
                        {placementLabels[placement]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='flex flex-col gap-2'>
                <Label>{t('Sidebar category')}</Label>
                <Select
                  value={item.sidebarSection}
                  onValueChange={(value) => {
                    if (typeof value === 'string' && value) {
                      updateItem(index, {
                        sidebarSection: value as CustomNavSidebarSection,
                      })
                    }
                  }}
                >
                  <SelectTrigger aria-label={t('Sidebar category')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {CUSTOM_NAV_SIDEBAR_SECTIONS.map((section) => (
                      <SelectItem key={section} value={section}>
                        {sectionLabels[section]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='flex flex-col gap-2'>
                <Label>{t('Content type')}</Label>
                <Select
                  value={item.contentType}
                  onValueChange={(value) => {
                    if (typeof value === 'string' && value) {
                      updateItem(index, {
                        contentType: value as CustomNavContentType,
                      })
                    }
                  }}
                >
                  <SelectTrigger aria-label={t('Content type')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {CUSTOM_NAV_CONTENT_TYPES.map((contentType) => (
                      <SelectItem key={contentType} value={contentType}>
                        {contentTypeLabels[contentType]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='mt-4 grid gap-3 sm:grid-cols-2'>
              {INTERFACE_LANGUAGE_OPTIONS.map((option) => (
                <div key={option.code} className='flex flex-col gap-2'>
                  <Label htmlFor={`custom-nav-label-${index}-${option.code}`}>
                    {`${option.flag} ${option.label}`}
                  </Label>
                  <Input
                    id={`custom-nav-label-${index}-${option.code}`}
                    value={item.labels[option.code] ?? ''}
                    onChange={(event) =>
                      updateLabel(index, option.code, event.target.value)
                    }
                  />
                </div>
              ))}
            </div>

            <div className='mt-4 flex flex-col gap-2'>
              <Label htmlFor={`custom-nav-content-${index}`}>
                {item.contentType === 'url' ? t('URL') : t('Content')}
              </Label>
              {item.contentType === 'url' ? (
                <Input
                  id={`custom-nav-content-${index}`}
                  value={item.content}
                  onChange={(event) =>
                    updateItem(index, { content: event.target.value })
                  }
                  placeholder='https://example.com/docs'
                />
              ) : (
                <Textarea
                  id={`custom-nav-content-${index}`}
                  rows={6}
                  value={item.content}
                  onChange={(event) =>
                    updateItem(index, { content: event.target.value })
                  }
                />
              )}
            </div>
          </div>
        ))}

        <div>
          <Button
            type='button'
            variant='outline'
            onClick={addItem}
            disabled={draft.length >= CUSTOM_NAV_MAX_ITEMS}
          >
            <Plus />
            {t('Add navigation item')}
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
