import { useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota, formatNumber } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ViewType } from '../types'

interface Column {
  key: string
  title: string
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode
}

interface UserModelStatsTableProps {
  items: Record<string, unknown>[]
  loading: boolean
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  type: ViewType
}

function getColumns(type: ViewType, t: (key: string) => string): Column[] {
  const quotaCol: Column = {
    key: 'quota',
    title: t('Quota Used'),
    render: (v) => formatQuota(v as number),
  }
  const tokenCol: Column = {
    key: 'token_used',
    title: t('Total Tokens'),
    render: (v) => formatNumber(v as number),
  }
  const countCol: Column = {
    key: 'count',
    title: t('Request Count'),
    render: (v) => formatNumber(v as number),
  }

  if (type === 'byUser') {
    return [
      { key: 'user_id', title: t('User ID') },
      { key: 'username', title: t('Username') },
      { key: 'user_group', title: t('User Group') },
      countCol,
      tokenCol,
      quotaCol,
    ]
  }

  if (type === 'byModel') {
    return [
      {
        key: 'model_name',
        title: t('Model'),
        render: (v) => <Badge variant='secondary'>{v as string}</Badge>,
      },
      countCol,
      tokenCol,
      quotaCol,
    ]
  }

  if (type === 'byDepartment') {
    return [
      { key: 'org_level1_name', title: '一级组织' },
      { key: 'org_level2_name', title: '二级组织' },
      countCol,
      tokenCol,
      quotaCol,
    ]
  }

  // byDetail
  return [
    { key: 'user_id', title: t('User ID') },
    { key: 'username', title: t('Username') },
    { key: 'user_group', title: t('User Group') },
    {
      key: 'model_name',
      title: t('Model'),
      render: (v) => <Badge variant='secondary'>{v as string}</Badge>,
    },
    countCol,
    tokenCol,
    quotaCol,
  ]
}

export function UserModelStatsTable({
  items,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  type,
}: UserModelStatsTableProps) {
  const { t } = useTranslation()
  const columns = useMemo(() => getColumns(type, t), [type, t])
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className='space-y-3'>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.title}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  {t('Loading...')}
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='text-muted-foreground h-24 text-center'
                >
                  {t('No data')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      {col.render
                        ? col.render(row[col.key], row)
                        : ((row[col.key] as React.ReactNode) ?? '-')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className='flex items-center justify-between'>
          <div className='text-muted-foreground flex items-center gap-2 text-sm'>
            <span>{t('Rows per page')}</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className='h-8 w-[70px]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[20, 50, 100].map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className='ml-2'>
              {t('Page {{current}} of {{total}}', {
                current: page,
                total: totalPages,
              })}
            </span>
          </div>
          <div className='flex items-center gap-1'>
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8'
              disabled={page <= 1}
              onClick={() => onPageChange(1)}
            >
              <ChevronsLeft className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8'
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8'
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8'
              disabled={page >= totalPages}
              onClick={() => onPageChange(totalPages)}
            >
              <ChevronsRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
