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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Download, Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { uploadTaskPlugin } from '../api'
import {
  fetchPluginSourceText,
  MAX_PLUGIN_SOURCE_BYTES,
  normalizePluginSourceUrl,
  PluginSourceFetchError,
  pluginSourceByteLength,
} from '../lib/plugin-url'
import type { TaskPluginDetail } from '../types'

type UploadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialKey?: string
}

export function UploadDialog(props: UploadDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [source, setSource] = useState('')
  const [remark, setRemark] = useState('')
  const [result, setResult] = useState<TaskPluginDetail | null>(null)
  const [importUrl, setImportUrl] = useState('')
  const [importError, setImportError] = useState('')
  const mutation = useMutation({
    mutationFn: () => uploadTaskPlugin(source, remark),
    onSuccess: (data) => {
      setResult(data)
      queryClient.invalidateQueries({ queryKey: ['task-plugins'] })
      if (props.initialKey) {
        queryClient.invalidateQueries({
          queryKey: ['task-plugin', props.initialKey],
        })
        queryClient.invalidateQueries({
          queryKey: ['task-plugin-versions', props.initialKey],
        })
      }
      toast.success(t('Plugin uploaded successfully'))
    },
  })

  const handleFile = async (file?: File) => {
    if (!file) return
    if (file.size > MAX_PLUGIN_SOURCE_BYTES) {
      setImportError(t('Plugin source exceeds the 1 MiB limit.'))
      return
    }
    setImportError('')
    setSource(await file.text())
    setResult(null)
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizePluginSourceUrl(importUrl)
      if (!normalized) {
        throw new Error(t('Enter an absolute http(s) URL.'))
      }
      return fetchPluginSourceText(normalized)
    },
    // The fetched text only fills the source field. Uploading stays an explicit
    // administrator action so the source and the risk warning are reviewed
    // exactly as they are for a manual paste.
    onSuccess: (text) => {
      setImportError('')
      setSource(text)
      setResult(null)
    },
    onError: (error) => {
      if (error instanceof PluginSourceFetchError) {
        if (error.reason === 'too_large') {
          setImportError(t('Plugin source exceeds the 1 MiB limit.'))
          return
        }
        if (error.reason === 'not_found') {
          setImportError(
            t(
              'The URL returned HTTP {{status}}. Check the address, or download the file and paste its source below.',
              { status: error.status ?? 0 }
            )
          )
          return
        }
        setImportError(
          t(
            'Could not fetch this URL from the browser. The host may block cross-origin requests or be unreachable. Download the file and paste its source below.'
          )
        )
        return
      }
      setImportError(error.message)
    },
  })

  const close = (open: boolean) => {
    props.onOpenChange(open)
    if (!open) {
      setSource('')
      setRemark('')
      setResult(null)
      setImportUrl('')
      setImportError('')
      mutation.reset()
      importMutation.reset()
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={close}>
      <DialogContent className='max-w-3xl'>
        <DialogHeader>
          <DialogTitle>
            {props.initialKey
              ? t('Upload new plugin version')
              : t('Upload task plugin')}
          </DialogTitle>
          <DialogDescription>
            {props.initialKey
              ? `${t('Plugin key')}: ${props.initialKey}`
              : t('Upload a JavaScript task platform plugin.')}
          </DialogDescription>
        </DialogHeader>
        <Alert variant='destructive'>
          <AlertTriangle />
          <AlertTitle>{t('Third-party plugin risk')}</AlertTitle>
          <AlertDescription>
            {t(
              'Uploading a plugin is an administrator-level trust decision. A plugin can access channel credentials and shape upstream requests. Review its source and diff before activation.'
            )}
          </AlertDescription>
        </Alert>
        <div className='space-y-2'>
          <Label htmlFor='task-plugin-file'>{t('JavaScript file')}</Label>
          <Input
            id='task-plugin-file'
            type='file'
            accept='.js,text/javascript'
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='task-plugin-url'>{t('Import from URL')}</Label>
          <div className='flex gap-2'>
            <Input
              id='task-plugin-url'
              type='url'
              inputMode='url'
              value={importUrl}
              placeholder='https://github.com/owner/repo/blob/main/plugin.js'
              aria-describedby='task-plugin-url-hint'
              aria-invalid={importError ? true : undefined}
              onChange={(event) => {
                setImportUrl(event.target.value)
                setImportError('')
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                if (importUrl.trim()) importMutation.mutate()
              }}
            />
            <Button
              variant='outline'
              className='shrink-0'
              disabled={!importUrl.trim() || importMutation.isPending}
              onClick={() => importMutation.mutate()}
            >
              <Download />
              {importMutation.isPending ? t('Fetching...') : t('Fetch')}
            </Button>
          </div>
          <p
            id='task-plugin-url-hint'
            className='text-muted-foreground text-xs'
          >
            {t(
              'Fetched in your browser and placed in the source field below for review. GitHub and gist page URLs are rewritten to their raw URL automatically.'
            )}
          </p>
          {importError && (
            <p role='alert' className='text-destructive text-sm'>
              {importError}
            </p>
          )}
        </div>
        <div className='space-y-2'>
          <div className='flex items-center justify-between gap-2'>
            <Label htmlFor='task-plugin-source'>{t('Plugin source')}</Label>
            {source && (
              <span className='text-muted-foreground text-xs'>
                {t('{{bytes}} bytes', {
                  bytes: pluginSourceByteLength(source),
                })}
              </span>
            )}
          </div>
          <Textarea
            id='task-plugin-source'
            value={source}
            onChange={(event) => {
              setSource(event.target.value)
              setResult(null)
            }}
            className='min-h-64 font-mono text-xs'
            placeholder={t('Paste JavaScript source here...')}
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='task-plugin-remark'>{t('Remark')}</Label>
          <Input
            id='task-plugin-remark'
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
          />
        </div>
        {mutation.error && (
          <p className='text-destructive text-sm whitespace-pre-wrap'>
            {mutation.error.message}
          </p>
        )}
        {result && (
          <div className='bg-muted/30 rounded-md border p-3 text-sm'>
            <p className='font-medium'>{t('Parsed plugin metadata')}</p>
            <p>
              {result.meta.key} · {result.meta.name} · {result.meta.version} ·
              API v{result.meta.apiVersion}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant='outline' onClick={() => close(false)}>
            {t('Close')}
          </Button>
          <Button
            disabled={!source.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <Upload />
            {mutation.isPending ? t('Uploading...') : t('Upload')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
