/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function InviteCodeCard({ affCode }: { affCode: string }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('My Invite Code')}</CardTitle>
      </CardHeader>
      <CardContent className='flex items-center gap-3'>
        <span className='font-mono text-2xl tracking-widest'>
          {affCode || '—'}
        </span>
        <Button
          variant='outline'
          size='sm'
          disabled={!affCode}
          onClick={() => {
            void navigator.clipboard.writeText(affCode)
            toast.success(t('Copied'))
          }}
        >
          <Copy className='mr-1 h-4 w-4' />
          {t('Copy')}
        </Button>
      </CardContent>
    </Card>
  )
}
