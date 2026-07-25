/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { parseVersion, type InspirationVersion, type VersionInput } from './api'

type Props = {
  open: boolean
  version?: InspirationVersion
  editingExistingDraft: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSave: (value: VersionInput) => void
}

type JsonKey =
  | 'tags'
  | 'variables'
  | 'model_policy'
  | 'parameters'
  | 'covers'
  | 'examples'
const jsonKeys: JsonKey[] = [
  'tags',
  'variables',
  'model_policy',
  'parameters',
  'covers',
  'examples',
]

export function VersionEditor(props: Props) {
  const { t } = useTranslation()
  const [value, setValue] = useState(() => parseVersion(props.version))
  const [json, setJson] = useState<Record<JsonKey, string>>({
    tags: '[]',
    variables: '[]',
    model_policy: '{\n  "recommended": [],\n  "compatible": []\n}',
    parameters: '{}',
    covers: '{}',
    examples: '[]',
  })
  const [error, setError] = useState('')
  const jsonLabels: Record<JsonKey, string> = {
    tags: t('Tags'),
    variables: t('Variables'),
    model_policy: t('Model policy'),
    parameters: t('Parameters'),
    covers: t('Covers'),
    examples: t('Examples'),
  }

  useEffect(() => {
    const next = parseVersion(props.version)
    setValue(next)
    setJson(
      Object.fromEntries(
        jsonKeys.map((key) => [key, JSON.stringify(next[key], null, 2)])
      ) as Record<JsonKey, string>
    )
    setError('')
  }, [props.open, props.version])

  const submit = () => {
    try {
      const parsed = Object.fromEntries(
        jsonKeys.map((key) => [key, JSON.parse(json[key])])
      ) as Pick<VersionInput, JsonKey>
      if (
        !Array.isArray(parsed.tags) ||
        !Array.isArray(parsed.variables) ||
        !Array.isArray(parsed.examples)
      ) {
        throw new Error(t('Tags, variables, and examples must be JSON arrays'))
      }
      setError('')
      props.onSave({ ...value, ...parsed })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('Invalid JSON'))
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>
            {props.editingExistingDraft ? t('Edit draft') : t('Create draft')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Edit structured recipe data. Publishing performs strict server validation.'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-4'>
          <div className='grid gap-2'>
            <Label htmlFor='prompt-template'>{t('Prompt template')}</Label>
            <Textarea
              id='prompt-template'
              className='min-h-32 font-mono'
              value={value.prompt_template}
              onChange={(event) =>
                setValue({ ...value, prompt_template: event.target.value })
              }
            />
          </div>
          <div className='grid gap-2 sm:grid-cols-2'>
            <div className='grid gap-2'>
              <Label htmlFor='negative-prompt'>{t('Negative prompt')}</Label>
              <Textarea
                id='negative-prompt'
                value={value.negative_prompt}
                onChange={(event) =>
                  setValue({ ...value, negative_prompt: event.target.value })
                }
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='explanation'>{t('Explanation')}</Label>
              <Textarea
                id='explanation'
                value={value.explanation}
                onChange={(event) =>
                  setValue({ ...value, explanation: event.target.value })
                }
              />
            </div>
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            {jsonKeys.map((key) => (
              <div className='grid gap-2' key={key}>
                <Label htmlFor={`json-${key}`}>{jsonLabels[key]}</Label>
                <Textarea
                  id={`json-${key}`}
                  className='min-h-32 font-mono text-xs'
                  value={json[key]}
                  onChange={(event) =>
                    setJson({ ...json, [key]: event.target.value })
                  }
                />
              </div>
            ))}
          </div>
          {error && (
            <p className='text-destructive text-sm' role='alert'>
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button disabled={props.pending} onClick={submit}>
            {props.pending ? t('Saving...') : t('Save draft')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
