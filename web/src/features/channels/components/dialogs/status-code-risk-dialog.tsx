import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface StatusCodeRiskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  detailItems: string[]
  onConfirm: () => void
}

const CHECKLIST_KEYS = [
  '高危状态码重试风险确认项1',
  '高危状态码重试风险确认项2',
  '高危状态码重试风险确认项3',
  '高危状态码重试风险确认项4',
] as const

export function StatusCodeRiskDialog({
  open,
  onOpenChange,
  detailItems,
  onConfirm,
}: StatusCodeRiskDialogProps) {
  const { t } = useTranslation()
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())
  const [confirmText, setConfirmText] = useState('')

  const requiredText = t('高危状态码重试风险确认输入文本')
  const allChecked = checkedItems.size === CHECKLIST_KEYS.length
  const textMatches = confirmText.trim() === requiredText.trim()
  const canConfirm = allChecked && textMatches

  const handleConfirm = () => {
    if (!canConfirm) return
    setCheckedItems(new Set())
    setConfirmText('')
    onConfirm()
  }

  const handleCancel = () => {
    setCheckedItems(new Set())
    setConfirmText('')
    onOpenChange(false)
  }

  const toggleCheck = (idx: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-destructive'>
            <AlertTriangle className='h-5 w-5' />
            {t('高危操作确认')}
          </DialogTitle>
          <DialogDescription>
            {t('高危状态码重试风险告知与免责声明Markdown')}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {detailItems.length > 0 && (
            <div className='rounded-lg border border-destructive/30 bg-destructive/5 p-3'>
              <p className='mb-2 text-sm font-medium'>
                {t('检测到以下高危状态码重定向规则')}
              </p>
              <ul className='list-inside list-disc text-sm'>
                {detailItems.map((item) => (
                  <li key={item} className='font-mono text-xs'>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className='space-y-2'>
            {CHECKLIST_KEYS.map((key, idx) => (
              <div key={key} className='flex items-start gap-2'>
                <Checkbox
                  id={`risk-check-${idx}`}
                  checked={checkedItems.has(idx)}
                  onCheckedChange={() => toggleCheck(idx)}
                />
                <Label
                  htmlFor={`risk-check-${idx}`}
                  className='text-sm leading-tight'
                >
                  {t(key)}
                </Label>
              </div>
            ))}
          </div>

          <div className='space-y-1.5'>
            <Label className='text-sm'>
              {t('操作确认')}:{' '}
              <code className='rounded bg-muted px-1 text-xs'>
                {requiredText}
              </code>
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={t('高危状态码重试风险输入框占位文案')}
            />
            {confirmText && !textMatches && (
              <p className='text-xs text-destructive'>
                {t('高危状态码重试风险输入不匹配提示')}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={handleCancel}>
            {t('取消')}
          </Button>
          <Button
            variant='destructive'
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {t('我确认开启高危重试')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
