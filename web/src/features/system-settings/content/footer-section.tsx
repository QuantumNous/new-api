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
import { ArrowDown, ArrowUp, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FooterSocialIcon } from '@/features/footer/components/footer-social-icon'
import {
  createDefaultFooterConfig,
  parseFooterConfig,
  type FooterColumn,
  type FooterConfig,
  type FooterLink,
  type FooterSocialLink,
} from '@/features/footer/types'

import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  FooterColumnDialog,
  type FooterColumnFormValues,
} from './footer-column-dialog'
import {
  FooterLinkDialog,
  type FooterLinkFormValues,
} from './footer-link-dialog'
import { FooterRegistrationEditor } from './footer-registration-editor'

type FooterSectionProps = {
  data: string
}

type DeleteTarget =
  | { type: 'social'; id: string }
  | { type: 'column'; columnId: string }
  | { type: 'link'; columnId: string; linkId: string }

type IconActionProps = {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
}

function IconAction(props: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type='button'
            size='icon-sm'
            variant={props.destructive ? 'destructive' : 'ghost'}
            aria-label={props.label}
            onClick={props.onClick}
            disabled={props.disabled}
          />
        }
      >
        {props.icon}
      </TooltipTrigger>
      <TooltipContent>{props.label}</TooltipContent>
    </Tooltip>
  )
}

function moveEntry<T>(entries: T[], index: number, offset: -1 | 1): T[] {
  const targetIndex = index + offset
  if (targetIndex < 0 || targetIndex >= entries.length) return entries
  const next = [...entries]
  const [entry] = next.splice(index, 1)
  next.splice(targetIndex, 0, entry)
  return next
}

export function FooterSection(props: FooterSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [config, setConfig] = useState<FooterConfig>(
    () => parseFooterConfig(props.data) ?? createDefaultFooterConfig()
  )
  const [hasChanges, setHasChanges] = useState(false)
  const [columnDialogOpen, setColumnDialogOpen] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkDialogKind, setLinkDialogKind] = useState<'social' | 'column'>(
    'social'
  )
  const [editingColumn, setEditingColumn] = useState<FooterColumn | null>(null)
  const [editingLink, setEditingLink] = useState<
    FooterLink | FooterSocialLink | null
  >(null)
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  useEffect(() => {
    setConfig(parseFooterConfig(props.data) ?? createDefaultFooterConfig())
    setHasChanges(false)
  }, [props.data])

  const openColumnDialog = (column: FooterColumn | null) => {
    setEditingColumn(column)
    setColumnDialogOpen(true)
  }

  const openSocialLinkDialog = (link: FooterSocialLink | null) => {
    setLinkDialogKind('social')
    setEditingLink(link)
    setActiveColumnId(null)
    setLinkDialogOpen(true)
  }

  const openColumnLinkDialog = (columnId: string, link: FooterLink | null) => {
    setLinkDialogKind('column')
    setEditingLink(link)
    setActiveColumnId(columnId)
    setLinkDialogOpen(true)
  }

  const submitColumn = (values: FooterColumnFormValues) => {
    setConfig((current) => ({
      ...current,
      columns: editingColumn
        ? current.columns.map((column) =>
            column.id === editingColumn.id ? { ...column, ...values } : column
          )
        : [
            ...current.columns,
            { id: nanoid(), title: values.title, links: [] },
          ],
    }))
    setHasChanges(true)
    setColumnDialogOpen(false)
  }

  const submitLink = (values: FooterLinkFormValues) => {
    if (linkDialogKind === 'social') {
      setConfig((current) => ({
        ...current,
        socialLinks:
          editingLink && 'icon' in editingLink
            ? current.socialLinks.map((link) =>
                link.id === editingLink.id ? { ...link, ...values } : link
              )
            : [...current.socialLinks, { id: nanoid(), ...values }],
      }))
    } else if (activeColumnId) {
      const linkValues = { label: values.label, url: values.url }
      setConfig((current) => ({
        ...current,
        columns: current.columns.map((column) => {
          if (column.id !== activeColumnId) return column
          return {
            ...column,
            links:
              editingLink && !('icon' in editingLink)
                ? column.links.map((link) =>
                    link.id === editingLink.id
                      ? { ...link, ...linkValues }
                      : link
                  )
                : [...column.links, { id: nanoid(), ...linkValues }],
          }
        }),
      }))
    }
    setHasChanges(true)
    setLinkDialogOpen(false)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'social') {
      setConfig((current) => ({
        ...current,
        socialLinks: current.socialLinks.filter(
          (link) => link.id !== deleteTarget.id
        ),
      }))
    } else if (deleteTarget.type === 'column') {
      setConfig((current) => ({
        ...current,
        columns: current.columns.filter(
          (column) => column.id !== deleteTarget.columnId
        ),
      }))
    } else {
      setConfig((current) => ({
        ...current,
        columns: current.columns.map((column) =>
          column.id === deleteTarget.columnId
            ? {
                ...column,
                links: column.links.filter(
                  (link) => link.id !== deleteTarget.linkId
                ),
              }
            : column
        ),
      }))
    }
    setHasChanges(true)
    setDeleteTarget(null)
  }

  const save = async () => {
    const result = await updateOption.mutateAsync({
      key: 'console_setting.footer',
      value: JSON.stringify(config),
    })
    if (result.success) setHasChanges(false)
  }

  return (
    <SettingsSection title={t('Footer')}>
      <div className='space-y-6'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <p className='text-muted-foreground max-w-2xl text-sm'>
            {t(
              'Manage the description, social links, and link columns shown in the homepage footer.'
            )}
          </p>
          <Button
            size='sm'
            onClick={save}
            disabled={!hasChanges || updateOption.isPending}
          >
            <Save data-icon='inline-start' />
            {updateOption.isPending ? t('Saving...') : t('Save settings')}
          </Button>
        </div>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor='footer-description'>
              {t('Footer description')}
            </FieldLabel>
            <Textarea
              id='footer-description'
              value={config.description}
              maxLength={240}
              rows={3}
              onChange={(event) => {
                setConfig((current) => ({
                  ...current,
                  description: event.target.value,
                }))
                setHasChanges(true)
              }}
            />
            <FieldDescription>
              {t('Text shown below the site name.')}
            </FieldDescription>
          </Field>
        </FieldGroup>

        <FooterRegistrationEditor
          value={config.registrations ?? []}
          onChange={(registrations) => {
            setConfig((current) => ({ ...current, registrations }))
            setHasChanges(true)
          }}
        />

        <Separator />

        <section className='space-y-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <h3 className='text-sm font-semibold'>{t('Social links')}</h3>
              <p className='text-muted-foreground mt-0.5 text-xs'>
                {t('Links displayed beside the site description.')}
              </p>
            </div>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => openSocialLinkDialog(null)}
              disabled={config.socialLinks.length >= 8}
            >
              <Plus data-icon='inline-start' />
              {t('Add social link')}
            </Button>
          </div>

          {config.socialLinks.length === 0 ? (
            <p className='text-muted-foreground rounded-lg border border-dashed p-4 text-sm'>
              {t('No social links configured')}
            </p>
          ) : (
            <ItemGroup className='gap-2'>
              {config.socialLinks.map((link, index) => (
                <Item key={link.id} variant='outline'>
                  <ItemMedia variant='icon'>
                    <FooterSocialIcon name={link.icon} />
                  </ItemMedia>
                  <ItemContent className='min-w-0'>
                    <ItemTitle>{link.label}</ItemTitle>
                    <ItemDescription className='truncate'>
                      {link.url}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <IconAction
                      label={t('Move link up')}
                      icon={<ArrowUp />}
                      onClick={() => {
                        setConfig((current) => ({
                          ...current,
                          socialLinks: moveEntry(
                            current.socialLinks,
                            index,
                            -1
                          ),
                        }))
                        setHasChanges(true)
                      }}
                      disabled={index === 0}
                    />
                    <IconAction
                      label={t('Move link down')}
                      icon={<ArrowDown />}
                      onClick={() => {
                        setConfig((current) => ({
                          ...current,
                          socialLinks: moveEntry(current.socialLinks, index, 1),
                        }))
                        setHasChanges(true)
                      }}
                      disabled={index === config.socialLinks.length - 1}
                    />
                    <IconAction
                      label={t('Edit social link')}
                      icon={<Pencil />}
                      onClick={() => openSocialLinkDialog(link)}
                    />
                    <IconAction
                      label={t('Delete link')}
                      icon={<Trash2 />}
                      destructive
                      onClick={() =>
                        setDeleteTarget({ type: 'social', id: link.id })
                      }
                    />
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </section>

        <Separator />

        <section className='space-y-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <h3 className='text-sm font-semibold'>{t('Footer columns')}</h3>
              <p className='text-muted-foreground mt-0.5 text-xs'>
                {t('Link groups displayed on the right side of the footer.')}
              </p>
            </div>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => openColumnDialog(null)}
              disabled={config.columns.length >= 6}
            >
              <Plus data-icon='inline-start' />
              {t('Add column')}
            </Button>
          </div>

          {config.columns.length === 0 ? (
            <p className='text-muted-foreground rounded-lg border border-dashed p-4 text-sm'>
              {t('No footer columns configured')}
            </p>
          ) : (
            <div className='space-y-3'>
              {config.columns.map((column, columnIndex) => (
                <section key={column.id} className='rounded-lg border'>
                  <div className='bg-muted/40 flex flex-wrap items-center justify-between gap-2 border-b p-3'>
                    <h4 className='min-w-0 flex-1 truncate text-sm font-semibold'>
                      {column.title}
                    </h4>
                    <div className='flex items-center gap-1'>
                      <IconAction
                        label={t('Move column up')}
                        icon={<ArrowUp />}
                        onClick={() => {
                          setConfig((current) => ({
                            ...current,
                            columns: moveEntry(
                              current.columns,
                              columnIndex,
                              -1
                            ),
                          }))
                          setHasChanges(true)
                        }}
                        disabled={columnIndex === 0}
                      />
                      <IconAction
                        label={t('Move column down')}
                        icon={<ArrowDown />}
                        onClick={() => {
                          setConfig((current) => ({
                            ...current,
                            columns: moveEntry(current.columns, columnIndex, 1),
                          }))
                          setHasChanges(true)
                        }}
                        disabled={columnIndex === config.columns.length - 1}
                      />
                      <IconAction
                        label={t('Edit column')}
                        icon={<Pencil />}
                        onClick={() => openColumnDialog(column)}
                      />
                      <IconAction
                        label={t('Delete column')}
                        icon={<Trash2 />}
                        destructive
                        onClick={() =>
                          setDeleteTarget({
                            type: 'column',
                            columnId: column.id,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className='p-2'>
                    {column.links.length > 0 ? (
                      <ItemGroup className='gap-0'>
                        {column.links.map((link, linkIndex) => (
                          <Fragment key={link.id}>
                            <Item size='sm'>
                              <ItemContent className='min-w-0'>
                                <ItemTitle>{link.label}</ItemTitle>
                                <ItemDescription className='truncate'>
                                  {link.url}
                                </ItemDescription>
                              </ItemContent>
                              <ItemActions>
                                <IconAction
                                  label={t('Move link up')}
                                  icon={<ArrowUp />}
                                  onClick={() => {
                                    setConfig((current) => ({
                                      ...current,
                                      columns: current.columns.map((item) =>
                                        item.id === column.id
                                          ? {
                                              ...item,
                                              links: moveEntry(
                                                item.links,
                                                linkIndex,
                                                -1
                                              ),
                                            }
                                          : item
                                      ),
                                    }))
                                    setHasChanges(true)
                                  }}
                                  disabled={linkIndex === 0}
                                />
                                <IconAction
                                  label={t('Move link down')}
                                  icon={<ArrowDown />}
                                  onClick={() => {
                                    setConfig((current) => ({
                                      ...current,
                                      columns: current.columns.map((item) =>
                                        item.id === column.id
                                          ? {
                                              ...item,
                                              links: moveEntry(
                                                item.links,
                                                linkIndex,
                                                1
                                              ),
                                            }
                                          : item
                                      ),
                                    }))
                                    setHasChanges(true)
                                  }}
                                  disabled={
                                    linkIndex === column.links.length - 1
                                  }
                                />
                                <IconAction
                                  label={t('Edit footer link')}
                                  icon={<Pencil />}
                                  onClick={() =>
                                    openColumnLinkDialog(column.id, link)
                                  }
                                />
                                <IconAction
                                  label={t('Delete link')}
                                  icon={<Trash2 />}
                                  destructive
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: 'link',
                                      columnId: column.id,
                                      linkId: link.id,
                                    })
                                  }
                                />
                              </ItemActions>
                            </Item>
                            {linkIndex < column.links.length - 1 ? (
                              <ItemSeparator />
                            ) : null}
                          </Fragment>
                        ))}
                      </ItemGroup>
                    ) : null}
                    <Button
                      type='button'
                      size='sm'
                      variant='ghost'
                      onClick={() => openColumnLinkDialog(column.id, null)}
                      disabled={column.links.length >= 10}
                    >
                      <Plus data-icon='inline-start' />
                      {t('Add footer link')}
                    </Button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>

      <FooterColumnDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        column={editingColumn}
        onSubmit={submitColumn}
      />
      <FooterLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        kind={linkDialogKind}
        link={editingLink}
        onSubmit={submitLink}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={
          deleteTarget?.type === 'column'
            ? t('Delete footer column?')
            : t('Delete footer link?')
        }
        desc={
          deleteTarget?.type === 'column'
            ? t(
                'The column and all links inside it will be removed after you save.'
              )
            : t('The link will be removed after you save.')
        }
        confirmText={t('Delete')}
        destructive
        handleConfirm={confirmDelete}
      />
    </SettingsSection>
  )
}
