/* HuggingFace Models Table - placeholder */
'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  getHFModels,
  deployHFModel,
  toggleHFModel,
  deleteHFModel,
  searchHFHubModels,
  getModelSources,
} from '../api'
import type { HFModelResponse, HFHubModelInfo, HFModelDeployPayload } from '../api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Trash2, Power, PowerOff } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-500',
  pulling: 'bg-blue-500',
  deploying: 'bg-yellow-500',
  running: 'bg-green-500',
  stopped: 'bg-red-500',
  error: 'bg-red-600',
}

export function HFModelsTable() {
  const { t } = useTranslation()
  const [models, setModels] = useState<HFModelResponse[]>([])
  const [sources, setSources] = useState<Array<{ id: number; label: string }>>([])
  const [loading, setLoading] = useState(true)
  const [deployOpen, setDeployOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const loadModels = async () => {
    try {
      const [modelsData, sourcesData] = await Promise.all([
        getHFModels(),
        getModelSources(),
      ])
      setModels(modelsData)
      setSources(sourcesData.map((s) => ({ id: s.id, label: s.label })))
    } catch (e) {
      toast.error(t('Failed to load HF models'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadModels()
  }, [])

  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      await toggleHFModel(id, enabled)
      toast.success(enabled ? t('Model enabled') : t('Model disabled'))
      loadModels()
    } catch (e) {
      toast.error(t('Failed to toggle model'))
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('Are you sure you want to delete this model?'))) return
    try {
      await deleteHFModel(id)
      toast.success(t('Model deleted'))
      loadModels()
    } catch (e) {
      toast.error(t('Failed to delete model'))
    }
  }

  const handleDeploy = async (data: HFModelDeployPayload) => {
    try {
      await deployHFModel(data)
      toast.success(t('Model deployed'))
      setDeployOpen(false)
      loadModels()
    } catch (e) {
      toast.error(t('Failed to deploy model'))
    }
  }

  if (loading) return <div className='p-4'>{t('Loading...')}</div>

  return (
    <div className='space-y-4 p-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-lg font-semibold'>{t('Hugging Face Models')}</h2>
        <div className='flex gap-2'>
          <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
            <DialogTrigger asChild>
              <Button variant='outline' size='sm'>
                <Search className='h-4 w-4 mr-1' />
                {t('Search Hub')}
              </Button>
            </DialogTrigger>
            <DialogContent className='max-w-2xl'>
              <DialogHeader>
                <DialogTitle>{t('Search Hugging Face Hub')}</DialogTitle>
              </DialogHeader>
              <HFHubSearchDialog sources={sources} onDeploy={(repoId, sourceId) => {
                setDeployOpen(true)
                setSearchOpen(false)
                // Pre-fill deploy form via state or context in real implementation
              }} />
            </DialogContent>
          </Dialog>

          <Dialog open={deployOpen} onOpenChange={setDeployOpen}>
            <DialogTrigger asChild>
              <Button size='sm'>
                <Plus className='h-4 w-4 mr-1' />
                {t('Deploy Model')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('Deploy Hugging Face Model')}</DialogTitle>
              </DialogHeader>
              <HFModelDeployForm sources={sources} onSubmit={handleDeploy} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {models.length === 0 ? (
        <Card>
          <CardContent className='py-8 text-center text-muted-foreground'>
            {t('No models deployed yet. Deploy your first model from Hugging Face Hub.')}
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Repo ID')}</TableHead>
              <TableHead>{t('Source')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Port')}</TableHead>
              <TableHead>{t('Enabled')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((m) => (
              <TableRow key={m.id}>
                <TableCell className='font-mono text-sm'>{m.repo_id}</TableCell>
                <TableCell>{m.source_label || `#${m.source_id}`}</TableCell>
                <TableCell>
                  <Badge variant='outline' className='capitalize'>
                    <span className={`mr-2 inline-block h-2 w-2 rounded-full ${STATUS_COLORS[m.deployment_status] || 'bg-gray-500'}`} />
                    {m.deployment_status}
                  </Badge>
                </TableCell>
                <TableCell>{m.port || '-'}</TableCell>
                <TableCell>
                  <Badge variant={m.enabled ? 'default' : 'secondary'}>
                    {m.enabled ? t('Yes') : t('No')}
                  </Badge>
                </TableCell>
                <TableCell className='text-right space-x-1'>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => handleToggle(m.id, !m.enabled)}
                    title={m.enabled ? t('Disable') : t('Enable')}
                  >
                    {m.enabled ? <PowerOff className='h-4 w-4' /> : <Power className='h-4 w-4' />}
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => handleDelete(m.id)}
                    className='text-destructive'
                    title={t('Delete')}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function HFModelDeployForm({
  sources,
  onSubmit,
}: {
  sources: Array<{ id: number; label: string }>
  onSubmit: (data: HFModelDeployPayload) => void
}) {
  const { t } = useTranslation()
  const [sourceId, setSourceId] = useState<number>(sources[0]?.id || 0)
  const [repoId, setRepoId] = useState('')
  const [task, setTask] = useState('')
  const [port, setPort] = useState('')
  const [gpuIds, setGpuIds] = useState('')
  const [maxConcurrency, setMaxConcurrency] = useState('1')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      source_id: sourceId,
      repo_id: repoId,
      task: task || undefined,
      port: port ? Number(port) : 0,
      gpu_ids: gpuIds || undefined,
      max_concurrency: maxConcurrency ? Number(maxConcurrency) : 1,
    })
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div>
        <Label>{t('Source')}</Label>
        <Select value={String(sourceId)} onValueChange={(v) => setSourceId(Number(v))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>{t('Repo ID')}</Label>
        <Input value={repoId} onChange={(e) => setRepoId(e.target.value)} required placeholder='e.g. gpt2' />
      </div>
      <div>
        <Label>{t('Task (optional)')}</Label>
        <Input value={task} onChange={(e) => setTask(e.target.value)} placeholder='text-generation' />
      </div>
      <div className='grid grid-cols-3 gap-2'>
        <div>
          <Label>{t('Port')}</Label>
          <Input type='number' value={port} onChange={(e) => setPort(e.target.value)} placeholder='0=auto' />
        </div>
        <div>
          <Label>{t('GPU IDs')}</Label>
          <Input value={gpuIds} onChange={(e) => setGpuIds(e.target.value)} placeholder='0,1' />
        </div>
        <div>
          <Label>{t('Max Concurrency')}</Label>
          <Input type='number' value={maxConcurrency} onChange={(e) => setMaxConcurrency(e.target.value)} />
        </div>
      </div>
      <Button type='submit' className='w-full'>{t('Deploy')}</Button>
    </form>
  )
}

function HFHubSearchDialog({
  sources,
  onDeploy,
}: {
  sources: Array<{ id: number; label: string }>
  onDeploy: (repoId: string, sourceId: number) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<HFHubModelInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [sourceId, setSourceId] = useState<number>(sources[0]?.id || 0)

  const handleSearch = async () => {
    if (!query.trim() || !sourceId) return
    setLoading(true)
    try {
      const resp = await searchHFHubModels({ source_id: sourceId, query: query.trim(), limit: 20 })
      setResults(resp.models)
    } catch (e) {
      toast.error(t('Search failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex gap-2'>
        <Select value={String(sourceId)} onValueChange={(v) => setSourceId(Number(v))}>
          <SelectTrigger className='w-48'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('Search models...')}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? t('Searching...') : t('Search')}
        </Button>
      </div>

      {results.length > 0 && (
        <div className='max-h-96 space-y-2 overflow-y-auto'>
          {results.map((m) => (
            <Card key={m.id} className='p-3'>
              <div className='flex items-center justify-between'>
                <div>
                  <div className='font-mono text-sm font-medium'>{m.id}</div>
                  <div className='text-xs text-muted-foreground'>
                    {m.downloads?.toLocaleString()} downloads
                    {m.likes ? ` · ${m.likes} likes` : ''}
                  </div>
                </div>
                <Button size='sm' onClick={() => onDeploy(m.id, sourceId)}>
                  {t('Deploy')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
