/* Model Sources Table - placeholder */
'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getModelSources, createModelSource, deleteModelSource } from '../api'
import type { ModelSourceResponse, ModelSourceCreatePayload } from '../api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'

const SOURCE_TYPE_LABELS: Record<string, string> = {
  huggingface: 'Hugging Face',
  modelscope: '魔搭社区',
  paddlehub: '飞桨 PaddleHub',
  modelers: '魔乐 Modelers',
  openi: 'OpenI 启智',
  moark: '模力方舟',
}

export function ModelSourcesTable() {
  const { t } = useTranslation()
  const [sources, setSources] = useState<ModelSourceResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadSources = async () => {
    try {
      const data = await getModelSources()
      setSources(data)
    } catch (e) {
      toast.error(t('Failed to load model sources'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSources()
  }, [])

  const handleCreate = async (data: ModelSourceCreatePayload) => {
    try {
      await createModelSource(data)
      toast.success(t('Model source created'))
      setDialogOpen(false)
      loadSources()
    } catch (e) {
      toast.error(t('Failed to create model source'))
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('Are you sure you want to delete this model source?'))) return
    try {
      await deleteModelSource(id)
      toast.success(t('Model source deleted'))
      loadSources()
    } catch (e) {
      toast.error(t('Failed to delete model source'))
    }
  }

  if (loading) return <div className='p-4'>{t('Loading...')}</div>

  return (
    <div className='space-y-4 p-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-lg font-semibold'>{t('Model Sources')}</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size='sm'>
              <Plus className='h-4 w-4 mr-1' />
              {t('Add Source')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('Add Model Source')}</DialogTitle>
            </DialogHeader>
            <ModelSourceForm onSubmit={handleCreate} />
          </DialogContent>
        </Dialog>
      </div>

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        {sources.map((source) => (
          <Card key={source.id}>
            <CardHeader className='pb-2'>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-base'>{source.label}</CardTitle>
                <Badge variant={source.enabled ? 'default' : 'secondary'}>
                  {source.enabled ? t('Enabled') : t('Disabled')}
                </Badge>
              </div>
              <CardDescription>
                {SOURCE_TYPE_LABELS[source.source_type] || source.source_type}
              </CardDescription>
            </CardHeader>
            <CardContent className='flex items-center justify-between pt-0'>
              <span className='text-xs text-muted-foreground'>
                {source.has_credential ? t('Credential configured') : t('No credential')}
              </span>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => handleDelete(source.id)}
                className='text-destructive h-8 w-8'
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ModelSourceForm({ onSubmit }: { onSubmit: (data: ModelSourceCreatePayload) => void }) {
  const { t } = useTranslation()
  const [sourceType, setSourceType] = useState<string>('huggingface')
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [username, setUsername] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const base: ModelSourceCreatePayload = {
      source_type: sourceType as ModelSourceCreatePayload['source_type'],
      label,
      enabled: true,
    }
    switch (sourceType) {
      case 'huggingface':
        base.huggingface_credential = { api_key: apiKey, username: username || undefined }
        break
      case 'modelscope':
        base.modelscope_credential = { access_token: apiKey }
        break
      case 'paddlehub':
        base.paddlehub_credential = { access_token: apiKey }
        break
      case 'modelers':
        base.modelers_credential = { access_token: apiKey }
        break
      case 'openi':
        base.openi_credential = { access_token: apiKey }
        break
      case 'moark':
        base.moark_credential = { access_token: apiKey }
        break
    }
    onSubmit(base)
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div>
        <Label>{t('Platform')}</Label>
        <select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
          className='w-full mt-1 rounded-md border px-3 py-2 text-sm'
        >
          <option value='huggingface'>Hugging Face</option>
          <option value='modelscope'>魔搭社区</option>
          <option value='paddlehub'>飞桨 PaddleHub</option>
          <option value='modelers'>魔乐 Modelers</option>
          <option value='openi'>OpenI 启智</option>
          <option value='moark'>模力方舟</option>
        </select>
      </div>
      <div>
        <Label>{t('Label')}</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} required />
      </div>
      <div>
        <Label>{t('API Key / Token')}</Label>
        <Input type='password' value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
      </div>
      {sourceType === 'huggingface' && (
        <div>
          <Label>{t('Username (optional)')}</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
      )}
      <Button type='submit' className='w-full'>{t('Create')}</Button>
    </form>
  )
}
