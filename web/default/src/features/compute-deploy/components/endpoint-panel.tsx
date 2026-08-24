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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Check, Copy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { COMPUTE_API_BASE, type ComputeModel } from '../catalog'

function CopyButton(props: { value: string; label?: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant='outline'
      size='xs'
      onClick={() => {
        void navigator.clipboard.writeText(props.value)
        setCopied(true)
        toast.success(t('Copied'))
        window.setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? <Check className='size-3.5' /> : <Copy className='size-3.5' />}
      {props.label ?? t('Copy')}
    </Button>
  )
}

function Field(props: { label: string; value: string; copyLabel?: string }) {
  return (
    <div className='bg-muted flex items-center justify-between gap-3 rounded-md px-3 py-2.5'>
      <span className='text-muted-foreground shrink-0 text-xs font-medium'>
        {props.label}
      </span>
      <span className='ml-auto truncate font-mono text-sm font-medium'>
        {props.value}
      </span>
      <CopyButton value={props.value} label={props.copyLabel} />
    </div>
  )
}

export function EndpointPanel(props: { model: ComputeModel }) {
  const { t } = useTranslation()
  const { model } = props

  const curl = `curl ${COMPUTE_API_BASE}/chat/completions \\
  -H "Authorization: Bearer $FLATKEY_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model.id}",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`

  return (
    <div className='flex flex-col gap-4'>
      <div className='bg-primary/10 border-primary/20 flex items-center gap-3 rounded-lg border p-4'>
        <div className='bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full'>
          <Check className='size-5' />
        </div>
        <div>
          <div className='font-semibold'>{t('Endpoint is ready')}</div>
          <div className='text-muted-foreground text-sm'>
            {t(
              'Call it with your existing flatkey key — no new credential needed.'
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className='flex flex-col gap-2 pt-5'>
          <Field label={t('API Base')} value={COMPUTE_API_BASE} />
          <Field label={t('Model')} value={model.id} />
          <div className='bg-muted flex items-center justify-between gap-3 rounded-md px-3 py-2.5'>
            <span className='text-muted-foreground shrink-0 text-xs font-medium'>
              {t('Status')}
            </span>
            <Badge variant='default' className='ml-auto'>
              {t('Running')}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className='pt-5'>
          <div className='mb-2 flex items-center justify-between'>
            <span className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
              {t('Copy and run')}
            </span>
            <CopyButton value={curl} />
          </div>
          <pre className='bg-foreground/95 text-background overflow-x-auto rounded-md p-4 font-mono text-xs leading-relaxed'>
            {curl}
          </pre>
        </CardContent>
      </Card>

      <div className='flex flex-wrap items-center justify-end gap-2'>
        <Button variant='outline' render={<Link to='/playground' />}>
          {t('Test in Playground')}
        </Button>
        <Button
          variant='outline'
          render={
            <Link to='/usage-logs/$section' params={{ section: 'common' }} />
          }
        >
          {t('View usage')}
        </Button>
      </div>
    </div>
  )
}
