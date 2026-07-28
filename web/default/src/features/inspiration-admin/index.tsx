/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, History, Plus, RotateCcw, Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

import {
  activateVersion,
  archiveCategory,
  createCategory,
  createTemplate,
  getTemplate,
  listCategories,
  listTemplates,
  publishDraft,
  saveDraft,
  setArchived,
  updateCategory,
  updateTemplate,
  type InspirationCategory,
  type InspirationTemplate,
  type VersionInput,
} from './api'
import { VersionEditor } from './version-editor'

const queryKeys = {
  all: ['inspiration-admin'] as const,
  categories: ['inspiration-admin', 'categories'] as const,
}

type ConfirmState = { title: string; description: string; run: () => void }

export function InspirationAdmin() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [modality, setModality] = useState('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editingDraft, setEditingDraft] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  const categories = useQuery({
    queryKey: queryKeys.categories,
    queryFn: listCategories,
  })
  const templates = useQuery({
    queryKey: [...queryKeys.all, 'templates', category, modality],
    queryFn: () => listTemplates({ category, modality }),
  })
  const detail = useQuery({
    queryKey: [...queryKeys.all, 'detail', selectedId],
    queryFn: () => getTemplate(selectedId ?? 0),
    enabled: selectedId !== null,
  })
  const visibleTemplates = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return templates.data ?? []
    return (templates.data ?? []).filter((item) =>
      `${item.title} ${item.slug} ${item.description}`
        .toLowerCase()
        .includes(term)
    )
  }, [search, templates.data])

  const action = useMutation({
    mutationFn: async (operation: () => Promise<unknown>) => operation(),
    onSuccess: async () => {
      toast.success(t('Changes saved successfully'))
      setConfirm(null)
      setEditingDraft(false)
      await queryClient.invalidateQueries({ queryKey: queryKeys.all })
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : t('Operation failed')
      ),
  })
  const draft = detail.data?.versions.find(
    (version) => version.state === 'draft'
  )
  const publishedVersion = detail.data?.versions.find(
    (version) => version.id === detail.data?.template.published_version_id
  )

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Official inspiration templates')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='flex flex-col gap-6'>
            <p className='text-muted-foreground text-sm'>
              {t('Manage official recipes, releases, and categories.')}
            </p>
            <Tabs defaultValue='templates'>
              <TabsList>
                <TabsTrigger value='templates'>{t('Templates')}</TabsTrigger>
                <TabsTrigger value='categories'>{t('Categories')}</TabsTrigger>
              </TabsList>
              <TabsContent value='templates' className='mt-4 space-y-4'>
                <TemplateCreate
                  categories={(categories.data ?? []).filter(
                    (item) => item.status === 'active'
                  )}
                  pending={action.isPending}
                  onCreate={(value) =>
                    action.mutate(() => createTemplate(value))
                  }
                />
                <div className='grid gap-2 sm:grid-cols-3'>
                  <Input
                    aria-label={t('Search templates')}
                    placeholder={t('Search templates')}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <NativeSelect
                    className='w-full'
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    <NativeSelectOption value='all'>
                      {t('All categories')}
                    </NativeSelectOption>
                    {categories.data?.map((item) => (
                      <NativeSelectOption key={item.id} value={item.slug}>
                        {item.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    className='w-full'
                    value={modality}
                    onChange={(event) => setModality(event.target.value)}
                  >
                    <NativeSelectOption value='all'>
                      {t('All modalities')}
                    </NativeSelectOption>
                    {['image', 'video', 'chat'].map((item) => (
                      <NativeSelectOption key={item} value={item}>
                        {item}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                {templates.isError && (
                  <p className='text-destructive text-sm'>
                    {t('Failed to load templates')}
                  </p>
                )}
                <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]'>
                  <div className='grid content-start gap-2'>
                    {visibleTemplates.map((item) => (
                      <button
                        type='button'
                        className='hover:bg-muted flex w-full items-center justify-between rounded-lg border p-3 text-left'
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <span>
                          <strong className='block'>{item.title}</strong>
                          <span className='text-muted-foreground text-xs'>
                            {item.slug} · {item.category_slug}
                          </span>
                        </span>
                        <span className='flex gap-1'>
                          <Badge variant='outline'>{item.modality}</Badge>
                          {item.featured && <Badge>{t('Featured')}</Badge>}
                        </span>
                      </button>
                    ))}
                    {!templates.isLoading && visibleTemplates.length === 0 && (
                      <p className='text-muted-foreground py-8 text-center'>
                        {t('No templates found')}
                      </p>
                    )}
                  </div>
                  {detail.data && (
                    <TemplateDetail
                      key={detail.data.template.id}
                      data={detail.data}
                      categories={(categories.data ?? []).filter(
                        (item) => item.status === 'active'
                      )}
                      pending={action.isPending}
                      onEditDraft={() => setEditingDraft(true)}
                      onAction={(next) => action.mutate(next)}
                      onConfirm={setConfirm}
                    />
                  )}
                </div>
              </TabsContent>
              <TabsContent value='categories' className='mt-4'>
                <CategoryManager
                  categories={categories.data ?? []}
                  pending={action.isPending}
                  onSave={(item) =>
                    action.mutate(() =>
                      item.id
                        ? updateCategory(item.id, item)
                        : createCategory(item)
                    )
                  }
                  onArchive={(item) =>
                    setConfirm({
                      title:
                        item.status === 'archived'
                          ? t('Restore category?')
                          : t('Archive category?'),
                      description:
                        item.status === 'archived'
                          ? t(
                              'The category will be available for templates again.'
                            )
                          : t(
                              'Archived categories disappear from the public template center.'
                            ),
                      run: () =>
                        action.mutate(() =>
                          item.status === 'archived'
                            ? updateCategory(item.id, {
                                ...item,
                                status: 'active',
                              })
                            : archiveCategory(item.id)
                        ),
                    })
                  }
                />
              </TabsContent>
            </Tabs>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>
      <VersionEditor
        open={editingDraft}
        version={draft ?? publishedVersion}
        editingExistingDraft={Boolean(draft)}
        pending={action.isPending}
        onOpenChange={setEditingDraft}
        onSave={(value: VersionInput) =>
          selectedId &&
          action.mutate(() => saveDraft(selectedId, draft?.id ?? null, value))
        }
      />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.title ?? ''}
        desc={confirm?.description ?? ''}
        destructive
        isLoading={action.isPending}
        handleConfirm={() => confirm?.run()}
      />
    </>
  )
}

function TemplateCreate(props: {
  categories: InspirationCategory[]
  pending: boolean
  onCreate: (value: Partial<InspirationTemplate>) => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState({
    title: '',
    slug: '',
    category_id: 0,
    modality: 'image',
    description: '',
    featured: false,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{t('Create template')}</CardTitle>
      </CardHeader>
      <CardContent className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <Input
          placeholder={t('Title')}
          value={value.title}
          onChange={(e) => setValue({ ...value, title: e.target.value })}
        />
        <Input
          placeholder={t('Slug')}
          value={value.slug}
          onChange={(e) => setValue({ ...value, slug: e.target.value })}
        />
        <NativeSelect
          className='w-full'
          value={value.category_id}
          onChange={(e) =>
            setValue({ ...value, category_id: Number(e.target.value) })
          }
        >
          <NativeSelectOption value={0}>
            {t('Select category')}
          </NativeSelectOption>
          {props.categories.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          className='w-full'
          value={value.modality}
          onChange={(e) => setValue({ ...value, modality: e.target.value })}
        >
          {['image', 'video', 'chat'].map((item) => (
            <NativeSelectOption key={item} value={item}>
              {item}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          className='sm:col-span-2'
          placeholder={t('Description')}
          value={value.description}
          onChange={(e) => setValue({ ...value, description: e.target.value })}
        />
        <Label className='flex items-center gap-2'>
          <Checkbox
            checked={value.featured}
            onCheckedChange={(checked) =>
              setValue({ ...value, featured: checked === true })
            }
          />
          {t('Featured')}
        </Label>
        <Button
          disabled={
            props.pending || !value.title || !value.slug || !value.category_id
          }
          onClick={() => props.onCreate(value)}
        >
          <Plus />
          {t('Create')}
        </Button>
      </CardContent>
    </Card>
  )
}

function TemplateDetail(props: {
  data: Awaited<ReturnType<typeof getTemplate>>
  categories: InspirationCategory[]
  pending: boolean
  onEditDraft: () => void
  onAction: (action: () => Promise<unknown>) => void
  onConfirm: (value: ConfirmState) => void
}) {
  const { t } = useTranslation()
  const [meta, setMeta] = useState(props.data.template)
  const template = props.data.template
  return (
    <Card className='h-fit'>
      <CardHeader>
        <CardTitle>{template.title}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-2'>
          <Label>{t('Title')}</Label>
          <Input
            value={meta.title}
            onChange={(e) => setMeta({ ...meta, title: e.target.value })}
          />
          <Label>{t('Description')}</Label>
          <Textarea
            value={meta.description}
            onChange={(e) => setMeta({ ...meta, description: e.target.value })}
          />
          <div className='grid grid-cols-2 gap-2'>
            <NativeSelect
              className='w-full'
              value={meta.category_id}
              onChange={(e) =>
                setMeta({ ...meta, category_id: Number(e.target.value) })
              }
            >
              {props.categories.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Input
              type='number'
              aria-label={t('Sort order')}
              value={meta.sort_order ?? 0}
              onChange={(e) =>
                setMeta({ ...meta, sort_order: Number(e.target.value) })
              }
            />
          </div>
          <Label className='flex items-center gap-2'>
            <Checkbox
              checked={meta.featured}
              onCheckedChange={(checked) =>
                setMeta({ ...meta, featured: checked === true })
              }
            />
            {t('Featured')}
          </Label>
          <Button
            disabled={props.pending}
            onClick={() =>
              props.onAction(() => updateTemplate(template.id, meta))
            }
          >
            <Save />
            {t('Save metadata')}
          </Button>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button onClick={props.onEditDraft}>
            {props.data.versions.some((v) => v.state === 'draft')
              ? t('Edit draft')
              : t('Create draft')}
          </Button>
          {template.draft_version_id && (
            <Button
              variant='outline'
              onClick={() =>
                props.onConfirm({
                  title: t('Publish draft?'),
                  description: t(
                    'Publishing makes this draft the active public version.'
                  ),
                  run: () => props.onAction(() => publishDraft(template.id)),
                })
              }
            >
              {t('Publish')}
            </Button>
          )}
          <Button
            variant='outline'
            onClick={() =>
              props.onConfirm({
                title:
                  template.status === 'archived'
                    ? t('Restore template?')
                    : t('Archive template?'),
                description: t('This changes public availability immediately.'),
                run: () =>
                  props.onAction(() =>
                    setArchived(template.id, template.status !== 'archived')
                  ),
              })
            }
          >
            {template.status === 'archived' ? <RotateCcw /> : <Archive />}
            {template.status === 'archived' ? t('Restore') : t('Archive')}
          </Button>
        </div>
        <div>
          <h3 className='mb-2 flex items-center gap-2 font-medium'>
            <History className='size-4' />
            {t('Version history')}
          </h3>
          <div className='space-y-2'>
            {props.data.versions.map((version) => (
              <div
                className='flex flex-col gap-2 rounded-md border p-2 sm:flex-row sm:items-center sm:justify-between'
                key={version.id}
              >
                <span>
                  v{version.version}{' '}
                  <Badge variant='outline'>{version.state}</Badge>
                </span>
                {version.state === 'released' &&
                  template.published_version_id !== version.id && (
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() =>
                        props.onConfirm({
                          title: t('Activate old version?'),
                          description: t(
                            'The selected released version will become public immediately.'
                          ),
                          run: () =>
                            props.onAction(() =>
                              activateVersion(template.id, version.id)
                            ),
                        })
                      }
                    >
                      {t('Activate')}
                    </Button>
                  )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CategoryManager(props: {
  categories: InspirationCategory[]
  pending: boolean
  onSave: (value: InspirationCategory) => void
  onArchive: (value: InspirationCategory) => void
}) {
  const { t } = useTranslation()
  const empty: InspirationCategory = {
    id: 0,
    slug: '',
    name: '',
    description: '',
    status: 'active',
    sort_order: 0,
  }
  const [value, setValue] = useState(empty)
  return (
    <div className='grid gap-4 md:grid-cols-2'>
      <Card>
        <CardHeader>
          <CardTitle>
            {value.id ? t('Edit category') : t('Create category')}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <Input
            placeholder={t('Name')}
            value={value.name}
            onChange={(e) => setValue({ ...value, name: e.target.value })}
          />
          <Input
            disabled={value.id > 0}
            placeholder={t('Slug')}
            value={value.slug}
            onChange={(e) => setValue({ ...value, slug: e.target.value })}
          />
          <Textarea
            placeholder={t('Description')}
            value={value.description}
            onChange={(e) =>
              setValue({ ...value, description: e.target.value })
            }
          />
          <Input
            type='number'
            aria-label={t('Sort order')}
            value={value.sort_order}
            onChange={(e) =>
              setValue({ ...value, sort_order: Number(e.target.value) })
            }
          />
          <Button
            disabled={props.pending || !value.name || !value.slug}
            onClick={() => {
              props.onSave(value)
              setValue(empty)
            }}
          >
            {t('Save category')}
          </Button>
        </CardContent>
      </Card>
      <div className='space-y-2'>
        {props.categories.map((item) => (
          <div
            className='flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between'
            key={item.id}
          >
            <button
              type='button'
              className='text-left'
              onClick={() => setValue(item)}
            >
              <strong className='block'>{item.name}</strong>
              <span className='text-muted-foreground text-xs'>{item.slug}</span>
            </button>
            <Button
              size='sm'
              variant='outline'
              className='self-start sm:self-auto'
              onClick={() => props.onArchive(item)}
            >
              {item.status === 'archived' ? <RotateCcw /> : <Archive />}
              {item.status === 'archived' ? t('Restore') : t('Archive')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
