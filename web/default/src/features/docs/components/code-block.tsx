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
import { Copy01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

type CodeBlockProps = {
  code: string
  label?: string
}

export function CodeBlock(props: CodeBlockProps) {
  const { t } = useTranslation()

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(props.code)
      toast.success(t('Code copied'))
    } catch {
      toast.error(t('Could not copy code'))
    }
  }

  return (
    <div className='border-border bg-muted/20 overflow-hidden rounded-lg border'>
      <div className='border-border bg-muted/40 flex min-h-10 items-center justify-between gap-3 border-b px-3'>
        <span className='text-muted-foreground font-mono text-xs'>
          {props.label ?? t('Example')}
        </span>
        <Button variant='ghost' size='sm' onClick={copyCode}>
          <HugeiconsIcon icon={Copy01Icon} data-icon='inline-start' />
          {t('Copy')}
        </Button>
      </div>
      <pre className='overflow-x-auto p-4 text-[13px] leading-6'>
        <code className='font-mono'>{props.code}</code>
      </pre>
    </div>
  )
}
