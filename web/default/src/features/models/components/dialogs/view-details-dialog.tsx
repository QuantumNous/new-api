import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, ExternalLink, Loader2, RefreshCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { getDeployment, listDeploymentContainers } from '../../api'

export function ViewDetailsDialog({
  open,
  onOpenChange,
  deploymentId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  deploymentId: string | number | null
}) {
  const { t } = useTranslation()

  const {
    data: detailsRes,
    isLoading: isLoadingDetails,
    refetch: refetchDetails,
    isFetching: isFetchingDetails,
  } = useQuery({
    queryKey: ['deployment-details', deploymentId],
    queryFn: () => (deploymentId ? getDeployment(deploymentId) : null),
    enabled: open && deploymentId !== null,
  })

  const {
    data: containersRes,
    isLoading: isLoadingContainers,
    refetch: refetchContainers,
    isFetching: isFetchingContainers,
  } = useQuery({
    queryKey: ['deployment-details-containers', deploymentId],
    queryFn: () =>
      deploymentId ? listDeploymentContainers(deploymentId) : null,
    enabled: open && deploymentId !== null,
  })

  const details = detailsRes?.data
  const containers = useMemo(() => {
    const items = containersRes?.data?.containers
    return Array.isArray(items) ? items : []
  }, [containersRes?.data?.containers])

  const locations = useMemo(() => {
    const items = details?.locations
    if (!Array.isArray(items)) return []
    return items
      .map((x) => {
        if (!x || typeof x !== 'object') return null
        const name = (x as Record<string, unknown>)?.name
        const iso2 = (x as Record<string, unknown>)?.iso2
        const id = (x as Record<string, unknown>)?.id
        return `${String(name ?? id ?? '')}${iso2 ? ` (${iso2})` : ''}`.trim()
      })
      .filter(Boolean) as string[]
  }, [details])

  const handleCopyId = async () => {
    if (deploymentId === null || deploymentId === undefined) return
    try {
      await navigator.clipboard.writeText(String(deploymentId))
      toast.success(t('Copied'))
    } catch {
      toast.error(t('Copy failed'))
    }
  }

  const handleRefresh = () => {
    refetchDetails()
    refetchContainers()
  }

  const payloadJson = useMemo(() => {
    if (!details) return ''
    try {
      return JSON.stringify(details, null, 2)
    } catch {
      return ''
    }
  }, [details])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-hidden max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:p-4 sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('Deployment details')}</DialogTitle>
        </DialogHeader>

        <div className='max-h-[calc(100dvh-8.5rem)] space-y-3 overflow-y-auto py-2 pr-1 sm:max-h-[72vh] sm:space-y-4'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
            <div className='text-muted-foreground text-sm'>
              {t('Deployment ID')}:{' '}
              <span className='font-mono'>{deploymentId}</span>
            </div>
            <div className='grid grid-cols-2 gap-2 sm:flex sm:items-center'>
              <Button variant='outline' size='sm' onClick={handleCopyId}>
                <Copy className='mr-2 h-4 w-4' />
                {t('Copy')}
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={handleRefresh}
                disabled={isFetchingDetails || isFetchingContainers}
              >
                {isFetchingDetails || isFetchingContainers ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <RefreshCcw className='mr-2 h-4 w-4' />
                )}
                {t('Refresh')}
              </Button>
            </div>
          </div>

          <Separator />

          {isLoadingDetails || isLoadingContainers ? (
            <div className='flex items-center justify-center py-10'>
              <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
            </div>
          ) : !detailsRes?.success ? (
            <div className='text-muted-foreground py-10 text-center text-sm'>
              {detailsRes?.message || t('Failed to fetch deployment details')}
            </div>
          ) : (
            <>
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='rounded-lg border p-3'>
                  <div className='text-muted-foreground text-xs'>
                    {t('Status')}
                  </div>
                  <div className='mt-1 font-medium'>
                    {String(details?.status ?? '-')}
                  </div>
                </div>
                <div className='rounded-lg border p-3'>
                  <div className='text-muted-foreground text-xs'>
                    {t('Hardware')}
                  </div>
                  <div className='mt-1 font-medium'>
                    {String(details?.brand_name ?? '')}{' '}
                    {String(details?.hardware_name ?? '')}
                  </div>
                </div>
                <div className='rounded-lg border p-3'>
                  <div className='text-muted-foreground text-xs'>
                    {t('Total GPUs')}
                  </div>
                  <div className='mt-1 font-medium'>
                    {String(
                      details?.total_gpus ?? details?.hardware_qty ?? '-'
                    )}
                  </div>
                </div>
                <div className='rounded-lg border p-3'>
                  <div className='text-muted-foreground text-xs'>
                    {t('Containers')}
                  </div>
                  <div className='mt-1 font-medium'>{containers.length}</div>
                </div>
              </div>

              {locations.length ? (
                <div className='rounded-lg border p-3'>
                  <div className='text-muted-foreground text-xs'>
                    {t('Locations')}
                  </div>
                  <div className='mt-1 flex flex-wrap gap-2 text-sm'>
                    {locations.map((x) => (
                      <span key={x} className='bg-muted rounded-md px-2 py-1'>
                        {x}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {containers.length ? (
                <div className='rounded-lg border p-3'>
                  <div className='text-muted-foreground mb-2 text-xs'>
                    {t('Containers')}
                  </div>
                  <div className='space-y-2'>
                    {containers.map((c) => {
                      const id = c?.container_id
                      if (typeof id !== 'string' || !id) return null
                      const status =
                        typeof c?.status === 'string' ? c.status : undefined
                      const url =
                        typeof c?.public_url === 'string' ? c.public_url : ''
                      return (
                        <div
                          key={id}
                          className='flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2'
                        >
                          <div className='min-w-0'>
                            <div className='truncate font-mono text-sm'>
                              {id}
                            </div>
                            <div className='text-muted-foreground text-xs'>
                              {status ? `${t('Status')}: ${status}` : ''}
                            </div>
                          </div>
                          {url ? (
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => window.open(url, '_blank')}
                            >
                              <ExternalLink className='mr-2 h-4 w-4' />
                              {t('Open')}
                            </Button>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              <Collapsible className='rounded-lg border p-3'>
                <CollapsibleTrigger className='cursor-pointer text-sm font-medium'>
                  {t('Raw JSON')}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className='mt-3 max-h-[360px] overflow-auto rounded-md bg-black p-3 text-xs text-gray-200'>
                    {payloadJson || '-'}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} className='w-full sm:w-auto'>
            {t('Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
