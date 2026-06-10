import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { type SecurityHitLog } from '../api/security'

interface LogDetailDrawerProps {
  log: SecurityHitLog | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const actionMap: Record<number, string> = {
  1: 'Pass',
  2: 'Alert',
  3: 'Mask',
  4: 'Block',
  5: 'Review',
}

const riskLevelMap: Record<number, { label: string; color: string }> = {
  1: { label: 'Low', color: 'bg-green-100 text-green-800' },
  2: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  3: { label: 'High', color: 'bg-orange-100 text-orange-800' },
  4: { label: 'Critical', color: 'bg-red-100 text-red-800' },
}

const contentTypeMap: Record<number, string> = {
  1: 'Request',
  2: 'Response',
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-sm break-all">{value ?? <span className="text-muted-foreground">—</span>}</div>
    </div>
  )
}

export function LogDetailDrawer({ log, open, onOpenChange }: LogDetailDrawerProps) {
  const { t } = useTranslation()

  const risk = log ? riskLevelMap[log.risk_level] : undefined

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t('Detection Event Details')}</SheetTitle>
          <SheetDescription>
            {t('Request ID')}: {log?.request_id ?? '—'}
          </SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-4 overflow-y-auto">
          {!log && (
            <div className="text-sm text-muted-foreground">{t('Log not found')}</div>
          )}

          {log && (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{actionMap[log.action] ?? log.action}</Badge>
                {risk && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${risk.color}`}>
                    {risk.label}
                  </span>
                )}
                <span className="text-muted-foreground text-xs ml-auto">
                  {contentTypeMap[log.content_type] ?? log.content_type}
                </span>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <Field label={t('Time')} value={new Date(log.created_at * 1000).toLocaleString()} />
                <Field label={t('User')} value={log.user_name || `User #${log.user_id}`} />
                <Field label={t('Model')} value={log.model_name || '—'} />
                <Field label={t('IP')} value={log.ip || '—'} />
                <Field label={t('Risk Score')} value={log.risk_score} />
                <Field label={t('Rule ID')} value={log.rule_id || '—'} />
                <Field label={t('Group ID')} value={log.group_id || '—'} />
              </div>

              <Separator />

              <Field label={t('Content Hash')} value={log.original_content_hash} />

              {log.processed_content && (
                <Field label={t('Processed Content')} value={log.processed_content} />
              )}

              {log.match_detail && (
                <>
                  <Separator />
                  <Field label={t('Match Detail')} value={log.match_detail} />
                </>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
