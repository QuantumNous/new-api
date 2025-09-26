import { useState } from 'react'
import type { ModelInfo } from '@/types/api'
import {
  Search,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { stringToColor } from '@/lib/colors'
import { formatQuota, formatNumber, formatTokens } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ModelMonitoringTableProps {
  models: ModelInfo[]
  loading?: boolean
  error?: string | null
  searchTerm: string
  onSearchChange: (term: string) => void
  businessGroup: string
  onBusinessGroupChange: (group: string) => void
  onRefresh: () => void
}

const ITEMS_PER_PAGE = 10

export function ModelMonitoringTable({
  models,
  loading,
  error,
  searchTerm,
  onSearchChange,
  businessGroup,
  onBusinessGroupChange,
  onRefresh,
}: ModelMonitoringTableProps) {
  const { t } = useTranslation()
  const [currentPage, setCurrentPage] = useState(1)

  // 分页逻辑
  const totalPages = Math.ceil(models.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentModels = models.slice(startIndex, endIndex)

  // 获取业务组列表
  const businessGroups = Array.from(
    new Set(models.map((m) => m.business_group))
  )

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600'
    if (rate >= 90) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getSuccessRateIcon = (rate: number) => {
    if (rate >= 95) return <CheckCircle className='h-4 w-4 text-green-600' />
    if (rate >= 90) return <AlertCircle className='h-4 w-4 text-yellow-600' />
    return <AlertCircle className='h-4 w-4 text-red-600' />
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.monitoring.model_list')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {/* 搜索栏骨架 */}
            <div className='flex items-center space-x-2'>
              <Skeleton className='h-10 flex-1' />
              <Skeleton className='h-10 w-32' />
              <Skeleton className='h-10 w-10' />
            </div>
            {/* 表格骨架 */}
            <div className='space-y-2'>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className='h-12 w-full' />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.monitoring.model_list')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='py-8 text-center'>
            <AlertCircle className='mx-auto mb-4 h-12 w-12 text-red-500' />
            <p className='text-lg font-medium'>
              {t('dashboard.monitoring.load_failed')}
            </p>
            <p className='text-muted-foreground mt-2'>{error}</p>
            <Button onClick={onRefresh} className='mt-4'>
              <RefreshCcw className='mr-2 h-4 w-4' />
              {t('common.retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle>{t('dashboard.monitoring.model_list')}</CardTitle>
          <div className='flex items-center space-x-2'>
            <div className='flex items-center space-x-2'>
              <Search className='text-muted-foreground h-4 w-4' />
              <Input
                placeholder={t('dashboard.monitoring.search_model_placeholder')}
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className='w-64'
              />
            </div>
            <Select value={businessGroup} onValueChange={onBusinessGroupChange}>
              <SelectTrigger className='w-40'>
                <SelectValue
                  placeholder={t('dashboard.monitoring.business_space')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>
                  {t('dashboard.monitoring.all_spaces')}
                </SelectItem>
                {businessGroups.map((group) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant='outline' size='icon' onClick={onRefresh}>
              <RefreshCcw className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {models.length === 0 ? (
          <div className='text-muted-foreground py-8 text-center'>
            <p>{t('dashboard.monitoring.no_matching_models')}</p>
          </div>
        ) : (
          <>
            {/* 数据表格 */}
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t('dashboard.monitoring.model_code')}
                    </TableHead>
                    <TableHead>
                      {t('dashboard.monitoring.business_space')}
                    </TableHead>
                    <TableHead className='text-right'>
                      {t('dashboard.monitoring.total_calls')}
                    </TableHead>
                    <TableHead className='text-right'>
                      {t('dashboard.monitoring.failed_calls')}
                    </TableHead>
                    <TableHead className='text-right'>
                      {t('dashboard.monitoring.failure_rate')}
                    </TableHead>
                    <TableHead className='text-right'>
                      {t('dashboard.monitoring.avg_cost')}
                    </TableHead>
                    <TableHead className='text-right'>
                      {t('dashboard.monitoring.avg_tokens')}
                    </TableHead>
                    <TableHead className='text-right'>
                      {t('dashboard.monitoring.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentModels.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell className='font-medium'>
                        <div className='flex items-center space-x-2'>
                          <div
                            className='h-2 w-2 rounded-full'
                            style={{
                              backgroundColor: stringToColor(model.model_name),
                            }}
                          />
                          <span>{model.model_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline' className='font-mono text-xs'>
                          {model.business_group}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-right'>
                        <span className='font-mono'>
                          {formatNumber(model.quota_used + model.quota_failed)}
                        </span>
                      </TableCell>
                      <TableCell className='text-right'>
                        <span className='font-mono text-red-600'>
                          {formatNumber(model.quota_failed)}
                        </span>
                      </TableCell>
                      <TableCell className='text-right'>
                        <div className='flex items-center justify-end space-x-1'>
                          {getSuccessRateIcon(model.success_rate)}
                          <span
                            className={`font-mono ${getSuccessRateColor(model.success_rate)}`}
                          >
                            {(100 - model.success_rate).toFixed(2)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className='text-right'>
                        <span className='font-mono text-green-600'>
                          {formatQuota(model.avg_quota_per_request)}
                        </span>
                      </TableCell>
                      <TableCell className='text-right'>
                        <span className='font-mono text-blue-600'>
                          {formatTokens(model.avg_tokens_per_request)}
                        </span>
                      </TableCell>
                      <TableCell className='text-right'>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon'>
                              <MoreHorizontal className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuItem>
                              {t('dashboard.monitoring.monitor')}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              {t('dashboard.monitoring.details')}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              {t('dashboard.monitoring.settings')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className='mt-4 flex items-center justify-between'>
                <div className='text-muted-foreground text-sm'>
                  {t('dashboard.monitoring.pagination_info', {
                    start: startIndex + 1,
                    end: Math.min(endIndex, models.length),
                    total: models.length,
                  })}
                </div>
                <div className='flex items-center space-x-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className='h-4 w-4' />
                    {t('common.previous')}
                  </Button>
                  <div className='flex items-center space-x-1'>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNumber
                      if (totalPages <= 5) {
                        pageNumber = i + 1
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i
                      } else {
                        pageNumber = currentPage - 2 + i
                      }

                      return (
                        <Button
                          key={pageNumber}
                          variant={
                            currentPage === pageNumber ? 'default' : 'outline'
                          }
                          size='sm'
                          onClick={() => handlePageChange(pageNumber)}
                          className='h-8 w-8 p-0'
                        >
                          {pageNumber}
                        </Button>
                      )
                    })}
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    {t('common.next')}
                    <ChevronRight className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
