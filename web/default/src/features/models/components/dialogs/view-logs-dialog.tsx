import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Loader2, RefreshCcw, Terminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { getDeploymentLogs, listDeploymentContainers } from '../../api'

interface ViewLogsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deploymentId: string | number | null
}

export function ViewLogsDialog({
  open,
  onOpenChange,
  deploymentId,
}: ViewLogsDialogProps) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [stream, setStream] = useState<'stdout' | 'stderr' | 'all'>('stdout')
  const [containerId, setContainerId] = useState<string>('')

  const {
    data: containersData,
    isLoading: isLoadingContainers,
    refetch: refetchContainers,
    isFetching: isFetchingContainers,
  } = useQuery({
    queryKey: ['deployment-containers', deploymentId],
    queryFn: () =>
      deploymentId ? listDeploymentContainers(deploymentId) : null,
    enabled: open && deploymentId !== null,
  })

  const containers = useMemo(() => {
    const items = containersData?.data?.containers
    return Array.isArray(items) ? items : []
  }, [containersData?.data?.containers])

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContainerId('')

      setStream('stdout')

      setAutoScroll(true)

      setAutoRefresh(false)
      return
    }

    if (open && containers.length > 0 && !containerId) {
      const first = containers[0]?.container_id
      if (typeof first === 'string' && first) {
        setContainerId(first)
      }
    }
  }, [open, containers, containerId])

  const {
    data: logsData,
    isLoading: isLoadingLogs,
    refetch: refetchLogs,
    isFetching: isFetchingLogs,
  } = useQuery({
    queryKey: ['deployment-logs', deploymentId, containerId, stream],
    queryFn: () =>
      deploymentId && containerId
        ? getDeploymentLogs(deploymentId, {
            container_id: containerId,
            stream,
            limit: 500,
          })
        : null,
    enabled: open && deploymentId !== null && Boolean(containerId),
    refetchInterval: open && autoRefresh ? 5000 : false,
  })

  const logsText = useMemo(() => {
    const raw = logsData?.data
    return typeof raw === 'string' ? raw : ''
  }, [logsData?.data])

  const logLines = useMemo(() => {
    const normalized = logsText.replace(/\r\n?/g, '\n')
    return normalized ? normalized.split('\n') : []
  }, [logsText])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logLines, autoScroll])

  const handleDownload = () => {
    if (!logsText.trim()) return
    const blob = new Blob([logsText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `deployment-${deploymentId}-${containerId || 'logs'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex h-[calc(100dvh-2rem)] flex-col max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:p-4 sm:h-[80vh] sm:max-w-4xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Terminal className='h-5 w-5' />
            {t('Deployment logs')}
          </DialogTitle>
        </DialogHeader>

        <div className='mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3'>
          <div className='text-muted-foreground text-sm'>
            {t('Deployment ID')}: {deploymentId}
          </div>
          <div className='grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                refetchContainers()
                refetchLogs()
              }}
              disabled={isFetchingLogs || isFetchingContainers}
            >
              {isFetchingLogs || isFetchingContainers ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <RefreshCcw className='mr-2 h-4 w-4' />
              )}
              {t('Refresh')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={handleDownload}
              disabled={!logsText.trim()}
            >
              <Download className='mr-2 h-4 w-4' />
              {t('Download')}
            </Button>
            <div className='col-span-2 flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 sm:col-span-1'>
              <span className='text-xs'>{t('Auto refresh')}</span>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            </div>
          </div>
        </div>

        <div className='mb-3 grid gap-2 sm:grid-cols-2 sm:gap-3'>
          <div className='space-y-1'>
            <div className='text-muted-foreground text-xs'>
              {t('Container')}
            </div>
            <Select
              value={containerId}
              onValueChange={(v) => v !== null && setContainerId(v)}
              disabled={isLoadingContainers || containers.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoadingContainers
                      ? t('Loading...')
                      : containers.length === 0
                        ? t('No containers')
                        : t('Select')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {containers.map((c) => {
                  const id = c?.container_id
                  if (typeof id !== 'string' || !id) return null
                  const status =
                    typeof c?.status === 'string' && c.status
                      ? ` (${c.status})`
                      : ''
                  return (
                    <SelectItem key={id} value={id}>
                      {id}
                      {status}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <div className='text-muted-foreground text-xs'>{t('Stream')}</div>
            <Select
              value={stream}
              onValueChange={(v) => {
                if (v === 'stderr' || v === 'all' || v === 'stdout') {
                  setStream(v)
                } else {
                  setStream('stdout')
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('Select')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='stdout'>stdout</SelectItem>
                <SelectItem value='stderr'>stderr</SelectItem>
                <SelectItem value='all'>all</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div
          ref={scrollRef}
          className='flex-1 overflow-auto rounded-md border bg-black p-3 sm:p-4'
          onScroll={(e) => {
            const target = e.target as HTMLDivElement
            const isAtBottom =
              target.scrollHeight - target.scrollTop - target.clientHeight < 50
            setAutoScroll(isAtBottom)
          }}
        >
          {isLoadingContainers || isLoadingLogs ? (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='h-6 w-6 animate-spin text-gray-400' />
            </div>
          ) : containers.length === 0 ? (
            <div className='py-8 text-center text-gray-400'>
              {t('No containers')}
            </div>
          ) : !containerId ? (
            <div className='py-8 text-center text-gray-400'>
              {t('Please select a container')}
            </div>
          ) : !logsText.trim() ? (
            <div className='py-8 text-center text-gray-400'>{t('No logs')}</div>
          ) : (
            <div className='font-mono text-sm'>
              {logLines.map((line, idx) => (
                <div key={idx} className='whitespace-pre-wrap text-gray-200'>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
