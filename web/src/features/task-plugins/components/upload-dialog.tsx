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
import { AlertTriangle, CircleCheck, Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CodeBlockEditor } from '@/components/ai-elements/code-block'
import { Dialog } from '@/components/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

import { uploadTaskPlugin } from '../api'
import {
  encodePluginIconFile,
  PluginIconFileError,
} from '../lib/plugin-icon-file'
import {
  MAX_PLUGIN_SOURCE_BYTES,
  pluginSourceByteLength,
} from '../lib/plugin-url'
import type { TaskPluginDetail } from '../types'
import { PluginIcon } from './plugin-icon'
import { PluginSourcePicker } from './plugin-source-picker'
import { PluginUrlImportField } from './plugin-url-import-field'

type UploadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialKey?: string
}

export function UploadDialog(props: UploadDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [source, setSource] = useState('')
  const [fileName, setFileName] = useState('')
  const [remark, setRemark] = useState('')
  const [icon, setIcon] = useState('')
  const [iconFileName, setIconFileName] = useState('')
  const [iconError, setIconError] = useState('')
  const [result, setResult] = useState<TaskPluginDetail | null>(null)
  const [importUrl, setImportUrl] = useState('')
  const [importError, setImportError] = useState('')
  const mutation = useMutation({
    mutationFn: () => uploadTaskPlugin(source, remark, icon),
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

  const handleFile = async (file: File) => {
    if (file.size > MAX_PLUGIN_SOURCE_BYTES) {
      setImportError(t('Plugin source exceeds the 1 MiB limit.'))
      return
    }
    setImportError('')
    setFileName(file.name)
    setSource(await file.text())
    setResult(null)
  }

  const handleIconFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setIcon(await encodePluginIconFile(file))
      setIconFileName(file.name)
      setIconError('')
    } catch (error) {
      setIcon('')
      setIconFileName('')
      if (
        error instanceof PluginIconFileError &&
        error.reason === 'too_large'
      ) {
        setIconError(t('Plugin icon exceeds the 512 KiB limit.'))
      } else {
        setIconError(t('Plugin icon must be an .svg or .png file.'))
      }
    }
    setResult(null)
  }

  const close = (open: boolean) => {
    props.onOpenChange(open)
    if (!open) {
      setSource('')
      setFileName('')
      setRemark('')
      setIcon('')
      setIconFileName('')
      setIconError('')
      setResult(null)
      setImportUrl('')
      setImportError('')
      mutation.reset()
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={close}
      contentClassName='sm:max-w-3xl'
      bodyClassName='space-y-4'
      title={
        props.initialKey
          ? t('Upload new plugin version')
          : t('Upload task plugin')
      }
      description={
        props.initialKey
          ? `${t('Plugin key')}: ${props.initialKey}`
          : t('Upload a JavaScript task platform plugin.')
      }
      footer={
        <>
          <Button variant='outline' onClick={() => close(false)}>
            {t('Close')}
          </Button>
          <Button
            disabled={!source.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Spinner aria-hidden='true' />
            ) : (
              <Upload aria-hidden='true' />
            )}
            {mutation.isPending ? t('Uploading...') : t('Upload')}
          </Button>
        </>
      }
    >
      <Alert variant='destructive'>
        <AlertTriangle />
        <AlertTitle>{t('Third-party plugin risk')}</AlertTitle>
        <AlertDescription>
          {t(
            'Uploading a plugin is an administrator-level trust decision. A plugin can access channel credentials and shape upstream requests. Review its source and diff before activation.'
          )}
        </AlertDescription>
      </Alert>

      <FieldGroup>
        <PluginSourcePicker fileName={fileName} onSelect={handleFile} />

        <PluginUrlImportField
          value={importUrl}
          onChange={setImportUrl}
          error={importError}
          onError={setImportError}
          onFetched={(text) => {
            setFileName('')
            setSource(text)
            setResult(null)
          }}
        />

        <CodeBlockEditor
          actions={
            <span className='text-muted-foreground font-mono text-[11px]'>
              {t('{{bytes}} bytes', { bytes: pluginSourceByteLength(source) })}
            </span>
          }
          ariaLabel={t('Plugin source')}
          // The editor is mid-dialog; focusing it on open would scroll the
          // risk warning and the file picker out of view.
          autoFocus={false}
          className='my-0'
          language='javascript'
          onChange={(value) => {
            setSource(value)
            setResult(null)
          }}
          placeholder={t('Paste JavaScript source here...')}
          rows={14}
          title={t('Plugin source')}
          value={source}
        />

        <Field>
          <FieldLabel htmlFor='task-plugin-icon'>{t('Plugin icon')}</FieldLabel>
          <div className='flex items-center gap-3'>
            {icon ? (
              <PluginIcon
                plugin={{ key: result?.meta.key ?? 'upload', iconSrc: icon }}
                size={32}
              />
            ) : null}
            <Input
              id='task-plugin-icon'
              type='file'
              accept='.svg,.png,image/svg+xml,image/png'
              aria-invalid={iconError ? true : undefined}
              onChange={(event) => {
                void handleIconFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
            {icon ? (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => {
                  setIcon('')
                  setIconFileName('')
                  setIconError('')
                }}
              >
                {t('Remove')}
              </Button>
            ) : null}
          </div>
          <FieldDescription>
            {iconFileName ||
              t(
                'Optional icon.svg or icon.png shipped next to plugin.js, up to 512 KiB. Stored separately from the source.'
              )}
          </FieldDescription>
          {iconError ? <FieldError>{iconError}</FieldError> : null}
        </Field>

        <Field>
          <FieldLabel htmlFor='task-plugin-remark'>{t('Remark')}</FieldLabel>
          <Input
            id='task-plugin-remark'
            value={remark}
            placeholder={t('Optional note describing this version')}
            onChange={(event) => setRemark(event.target.value)}
          />
        </Field>
      </FieldGroup>

      {mutation.error ? (
        <Alert variant='destructive'>
          <AlertTriangle />
          <AlertTitle>{t('The gateway rejected this plugin')}</AlertTitle>
          {/* Verbatim: preflight rejections name the conflicting plugin. */}
          <AlertDescription className='whitespace-pre-wrap'>
            {mutation.error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      {result ? (
        <Alert>
          <CircleCheck className='text-primary' />
          <AlertTitle>{t('Parsed plugin metadata')}</AlertTitle>
          <AlertDescription className='font-mono'>
            {result.meta.key} · {result.meta.name} · v{result.meta.version}
          </AlertDescription>
        </Alert>
      ) : null}
    </Dialog>
  )
}
