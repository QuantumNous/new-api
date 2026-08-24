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
import { toast } from 'sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  cheapestByGpu,
  computeDeployKeys,
  createInstance,
  getComputeOffers,
  getInstanceConnection,
  getMyInstances,
  stopInstance,
  type ComputeInstance,
  type ComputeOffer,
} from '../api'
import { useComputeBalance } from '../use-compute-balance'

function OfferCard(props: {
  offer: ComputeOffer
  onRent: (o: ComputeOffer) => void
}) {
  const { t } = useTranslation()
  const { offer } = props
  return (
    <div className='bg-card flex flex-col rounded-lg border p-4'>
      <div className='flex items-center justify-between'>
        <span className='font-semibold'>{offer.gpu_name}</span>
        <Badge variant='secondary'>{offer.num_gpus}× GPU</Badge>
      </div>
      <div className='text-muted-foreground mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs'>
        <div className='flex justify-between'>
          <span>VRAM</span>
          <span className='text-foreground font-medium'>
            {Math.round(offer.gpu_ram_gb)} GB
          </span>
        </div>
        <div className='flex justify-between'>
          <span>vCPU</span>
          <span className='text-foreground font-medium'>
            {Math.round(offer.cpu_cores)}
          </span>
        </div>
        <div className='flex justify-between'>
          <span>RAM</span>
          <span className='text-foreground font-medium'>
            {Math.round(offer.ram_gb)} GB
          </span>
        </div>
        <div className='flex justify-between'>
          <span>{t('Disk')}</span>
          <span className='text-foreground font-medium'>
            {Math.round(offer.disk_gb)} GB
          </span>
        </div>
      </div>
      <div className='mt-3 flex items-end justify-between border-t pt-3'>
        <div className='text-lg font-bold tabular-nums'>
          ${offer.cost_per_hour.toFixed(2)}
          <span className='text-muted-foreground text-xs font-normal'>/hr</span>
        </div>
        <Button size='sm' onClick={() => props.onRent(offer)}>
          {t('Rent')}
        </Button>
      </div>
    </div>
  )
}

function RentDialog(props: { offer: ComputeOffer | null; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { quota } = useComputeBalance()
  const [hours, setHours] = useState(1)
  const [sshKey, setSshKey] = useState('')

  const offer = props.offer
  const estimateUsd = offer ? hours * offer.cost_per_hour : 0
  const balanceUsd = quota / 500000
  const insufficient = estimateUsd > balanceUsd

  const mutation = useMutation({
    mutationFn: () =>
      createInstance({
        gpu_name: offer!.gpu_name,
        duration_hours: hours,
        ssh_public_key: sshKey.trim(),
      }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('GPU instance is launching'))
        queryClient.invalidateQueries({
          queryKey: computeDeployKeys.instances(),
        })
        props.onClose()
        setSshKey('')
        setHours(1)
      } else {
        toast.error(res.message || t('Failed to launch GPU instance'))
      }
    },
    onError: () => toast.error(t('Failed to launch GPU instance')),
  })

  return (
    <Dialog open={offer !== null} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('Rent')} {offer?.gpu_name}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Prepaid by the hour from your flatkey balance. SSH in once it is running.'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='rent-hours'>{t('Hours')}</Label>
            <Input
              id='rent-hours'
              type='number'
              min={1}
              max={168}
              value={hours}
              onChange={(e) =>
                setHours(Math.max(1, Number(e.target.value) || 1))
              }
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='rent-ssh'>{t('SSH public key')}</Label>
            <Textarea
              id='rent-ssh'
              rows={3}
              placeholder='ssh-ed25519 AAAA... you@host'
              value={sshKey}
              onChange={(e) => setSshKey(e.target.value)}
              className='font-mono text-xs'
            />
            <span className='text-muted-foreground text-xs'>
              {t('Your public key is added to the box so you can SSH in.')}
            </span>
          </div>
          <div className='bg-muted flex items-center justify-between rounded-md px-3 py-2.5 text-sm'>
            <span className='text-muted-foreground'>
              {t('Estimated')} ({hours}h × ${offer?.cost_per_hour.toFixed(2)})
            </span>
            <span className='font-semibold tabular-nums'>
              ~${estimateUsd.toFixed(2)}
            </span>
          </div>
          {insufficient && (
            <div className='bg-warning/10 border-warning/30 rounded-md border p-2.5 text-xs'>
              {t('Insufficient balance for this rental. Please top up first.')}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={props.onClose}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending || sshKey.trim() === '' || insufficient
            }
          >
            {mutation.isPending ? t('Launching...') : t('Rent')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConnectDialog(props: {
  instance: ComputeInstance | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const inst = props.instance
  const query = useQuery({
    queryKey: computeDeployKeys.connection(inst?.id ?? 0),
    queryFn: () => getInstanceConnection(inst!.id),
    enabled: inst !== null,
  })
  const conn = query.data?.data
  const cmd = conn
    ? `ssh -p ${conn.ssh_port} ${conn.username || 'root'}@${conn.ssh_host}`
    : ''
  return (
    <Dialog open={inst !== null} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Connect')}</DialogTitle>
          <DialogDescription>
            {t('SSH into your rented GPU with the key you provided.')}
          </DialogDescription>
        </DialogHeader>
        {query.isLoading ? (
          <Skeleton className='h-10 w-full' />
        ) : conn && conn.ssh_host ? (
          <pre className='bg-foreground/95 text-background overflow-x-auto rounded-md p-3 font-mono text-xs'>
            {cmd}
          </pre>
        ) : (
          <div className='text-muted-foreground text-sm'>
            {t('Connection details are not ready yet. Try again shortly.')}
          </div>
        )}
        <DialogFooter>
          <Button variant='outline' onClick={props.onClose}>
            {t('Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function statusVariant(s: ComputeInstance['status']) {
  if (s === 'running') return 'default' as const
  if (s === 'provisioning') return 'secondary' as const
  if (s === 'error') return 'destructive' as const
  return 'outline' as const
}

export function GpuInstances() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [renting, setRenting] = useState<ComputeOffer | null>(null)
  const [connecting, setConnecting] = useState<ComputeInstance | null>(null)
  const [pendingStop, setPendingStop] = useState<ComputeInstance | null>(null)

  const offersQuery = useQuery({
    queryKey: computeDeployKeys.offers(),
    queryFn: getComputeOffers,
  })
  const instancesQuery = useQuery({
    queryKey: computeDeployKeys.instances(),
    queryFn: getMyInstances,
  })

  const stopMutation = useMutation({
    mutationFn: (id: number) => stopInstance(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('Instance stopped'))
        queryClient.invalidateQueries({
          queryKey: computeDeployKeys.instances(),
        })
      } else {
        toast.error(res.message || t('Failed to stop instance'))
      }
      setPendingStop(null)
    },
    onError: () => {
      toast.error(t('Failed to stop instance'))
      setPendingStop(null)
    },
  })

  const offers = cheapestByGpu(offersQuery.data?.data?.items ?? [])
  const instances = instancesQuery.data?.data?.items ?? []

  return (
    <div className='flex flex-col gap-6'>
      <section className='flex flex-col gap-3'>
        <div className='text-muted-foreground text-sm'>
          {t(
            'Rent a whole GPU by the hour — SSH or Jupyter in and run your own environment. Prepaid from your flatkey balance.'
          )}
        </div>
        {offersQuery.isLoading ? (
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={`offer-skeleton-${i}`} className='h-40 w-full' />
            ))}
          </div>
        ) : offersQuery.isError ? (
          <div className='text-destructive py-6 text-center text-sm'>
            {t('Failed to load available GPUs')}
          </div>
        ) : offers.length === 0 ? (
          <div className='text-muted-foreground py-6 text-center text-sm'>
            {t('No GPUs available right now')}
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {offers.map((o) => (
              <OfferCard key={o.gpu_name} offer={o} onRent={setRenting} />
            ))}
          </div>
        )}
      </section>

      <section className='flex flex-col gap-3'>
        <div className='text-sm font-semibold'>{t('My GPU instances')}</div>
        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('GPU')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead>{t('Cost per hour')}</TableHead>
                <TableHead className='text-right'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instancesQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Skeleton className='h-5 w-full' />
                  </TableCell>
                </TableRow>
              ) : instances.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='text-muted-foreground py-8 text-center'
                  >
                    {t('No rented instances yet')}
                  </TableCell>
                </TableRow>
              ) : (
                instances.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell className='font-medium'>
                      {inst.gpu_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(inst.status)}>
                        {t(inst.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className='tabular-nums'>
                      ${inst.cost_per_hour.toFixed(2)}
                    </TableCell>
                    <TableCell className='space-x-2 text-right'>
                      <Button
                        variant='outline'
                        size='sm'
                        disabled={inst.status !== 'running'}
                        onClick={() => setConnecting(inst)}
                      >
                        {t('Connect')}
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        disabled={
                          inst.status === 'stopped' || inst.status === 'error'
                        }
                        onClick={() => setPendingStop(inst)}
                      >
                        {t('Terminate')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className='text-muted-foreground text-xs'>
          {t('Terminating stops billing and destroys the instance and its data.')}
        </div>
      </section>

      <RentDialog offer={renting} onClose={() => setRenting(null)} />
      <ConnectDialog instance={connecting} onClose={() => setConnecting(null)} />

      <AlertDialog
        open={pendingStop !== null}
        onOpenChange={(o) => !o && setPendingStop(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Terminate this instance?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'This destroys the instance and its data, and stops billing. This cannot be undone.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={stopMutation.isPending}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingStop && stopMutation.mutate(pendingStop.id)}
              disabled={stopMutation.isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {stopMutation.isPending ? t('Terminating...') : t('Terminate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
