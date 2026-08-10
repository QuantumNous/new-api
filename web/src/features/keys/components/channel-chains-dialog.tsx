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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog } from '@/components/dialog'
import { MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import {
  createChannelChain,
  deleteChannelChain,
  getChannelChains,
  getUserChannels,
  updateChannelChain,
} from '../api'
import type { ChannelChain } from '../types'

type ChannelChainsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ChainDraft = {
  chainId?: string
  name: string
  channels: number[]
}

export function ChannelChainsDialog({
  open,
  onOpenChange,
}: ChannelChainsDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<ChainDraft | null>(null)
  const [deleting, setDeleting] = useState<ChannelChain | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingChain, setDeletingChain] = useState(false)

  const { data: chainsData, isLoading } = useQuery({
    queryKey: ['channel-chains'],
    queryFn: getChannelChains,
    enabled: open,
    staleTime: 0,
  })
  const { data: channelsData } = useQuery({
    queryKey: ['user-channels'],
    queryFn: getUserChannels,
    enabled: open,
    staleTime: 0,
  })

  const chains = chainsData?.data?.chains ?? []
  const maxChains = chainsData?.data?.max_chains ?? 10
  const maxChannelsPerChain =
    chainsData?.data?.max_channels_per_chain ?? 10
  const tokenUsage = chainsData?.data?.token_usage ?? {}
  const channelById = useMemo(() => {
    return new Map(
      (channelsData?.data?.channels ?? []).map((channel) => [
        channel.id,
        channel,
      ])
    )
  }, [channelsData])

  const channelOptions = useMemo(
    () =>
      (channelsData?.data?.channels ?? []).map((channel) => ({
        label: `${channel.name} (#${channel.id})`,
        value: String(channel.id),
      })),
    [channelsData]
  )
  const availableChannelOptions = useMemo(
    () =>
      channelOptions.filter(
        (option) => !editing?.channels.includes(Number(option.value))
      ),
    [channelOptions, editing]
  )

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['channel-chains'] }),
      queryClient.invalidateQueries({ queryKey: ['user-groups'] }),
      queryClient.invalidateQueries({ queryKey: ['keys'] }),
    ])
  }

  const closeEditor = () => {
    setEditing(null)
    setSaving(false)
  }

  const handleSave = async () => {
    if (!editing) return
    const name = editing.name.trim()
    if (!name) {
      toast.error(t('Please enter a chain name'))
      return
    }
    if (editing.channels.length === 0) {
      toast.error(t('Select at least one channel for the chain'))
      return
    }
    setSaving(true)
    try {
      const payload = { name, channels: editing.channels }
      const result = editing.chainId
        ? await updateChannelChain(editing.chainId, payload)
        : await createChannelChain(payload)
      if (result.success) {
        toast.success(t('Channel chain saved'))
        await invalidate()
        closeEditor()
      } else {
        toast.error(result.message || t('An unexpected error occurred'))
      }
    } catch {
      toast.error(t('An unexpected error occurred'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeletingChain(true)
    try {
      const result = await deleteChannelChain(deleting.id)
      if (result.success) {
        const resetCount = result.data?.reset_tokens ?? 0
        toast.success(
          resetCount > 0
            ? t(
                'Channel chain deleted. {{count}} API key(s) switched to follow your account group.',
                { count: resetCount }
              )
            : t('Channel chain deleted')
        )
        await invalidate()
        setDeleting(null)
      } else {
        toast.error(result.message || t('An unexpected error occurred'))
      }
    } catch {
      toast.error(t('An unexpected error occurred'))
    } finally {
      setDeletingChain(false)
    }
  }

  const moveChannel = (index: number, direction: -1 | 1) => {
    if (!editing) return
    const target = index + direction
    if (target < 0 || target >= editing.channels.length) return
    const channels = [...editing.channels]
    ;[channels[index], channels[target]] = [channels[target], channels[index]]
    setEditing({ ...editing, channels })
  }

  let body: React.ReactNode
  if (isLoading) {
    body = (
      <div className='text-muted-foreground py-8 text-center text-sm'>
        {t('Loading...')}
      </div>
    )
  } else if (editing) {
    body = (
      <div className='space-y-4'>
        <div className='space-y-1.5'>
          <label className='text-sm font-medium' htmlFor='channel-chain-name'>
            {t('Chain name')}
          </label>
          <Input
            id='channel-chain-name'
            value={editing.name}
            onChange={(event) =>
              setEditing({ ...editing, name: event.target.value })
            }
            placeholder={t('e.g., primary -> backup')}
          />
        </div>
        <div className='space-y-1.5'>
          <label className='text-sm font-medium' htmlFor='channel-chain-channels'>
            {t('Channels')}
          </label>
          <MultiSelect
            id='channel-chain-channels'
            options={availableChannelOptions}
            selected={[]}
            onChange={(values) => {
              const added = values
                .map((value) => Number(value))
                .filter((id) => !editing.channels.includes(id))
              setEditing({
                ...editing,
                channels: [...editing.channels, ...added],
              })
            }}
            placeholder={t('Add a channel to the chain')}
            disabled={editing.channels.length >= maxChannelsPerChain}
            maxVisibleChips={3}
          />
          <p className='text-muted-foreground text-xs'>
            {t('Channels: {{used}}/{{max}}', {
              used: editing.channels.length,
              max: maxChannelsPerChain,
            })}
          </p>
        </div>
        <div className='space-y-2'>
          {editing.channels.map((channelId, index) => {
            const channel = channelById.get(channelId)
            return (
              <div
                key={channelId}
                className='border-muted bg-muted/40 flex items-center justify-between gap-2 rounded-lg border px-3 py-2'
              >
                <div className='flex min-w-0 items-center gap-2'>
                  <span className='text-muted-foreground font-mono text-xs'>
                    {index + 1}
                  </span>
                  <span className='min-w-0 truncate text-sm font-medium'>
                    {channel ? channel.name : `#${channelId}`}
                  </span>
                  <span className='text-muted-foreground font-mono text-xs'>
                    #{channelId}
                  </span>
                </div>
                <div className='flex shrink-0 items-center gap-1'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='size-7'
                    disabled={index === 0}
                    aria-label={t('Move up')}
                    onClick={() => moveChannel(index, -1)}
                  >
                    <ArrowUp className='size-3.5' />
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='size-7'
                    disabled={index === editing.channels.length - 1}
                    aria-label={t('Move down')}
                    onClick={() => moveChannel(index, 1)}
                  >
                    <ArrowDown className='size-3.5' />
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='text-destructive size-7'
                    aria-label={t('Remove')}
                    onClick={() =>
                      setEditing({
                        ...editing,
                        channels: editing.channels.filter(
                          (_, i) => i !== index
                        ),
                      })
                    }
                  >
                    <X className='size-3.5' />
                  </Button>
                </div>
              </div>
            )
          })}
          {editing.channels.length === 0 && (
            <div className='text-muted-foreground border-muted rounded-lg border border-dashed p-4 text-center text-sm'>
              {t('Select at least one channel for the chain')}
            </div>
          )}
        </div>
      </div>
    )
  } else {
    body = (
      <div className='space-y-4'>
        <div className='bg-muted/50 text-muted-foreground flex items-start gap-3 rounded-lg p-3 text-xs leading-relaxed'>
          <div className='space-y-1'>
            <p>
              {t(
                'A channel chain routes each request through the channels in the order you set: when a channel is unavailable, the next one is tried automatically.'
              )}
            </p>
            <p>
              {t(
                'Create a chain, then select it as the group of an API key. Renaming or reordering a chain takes effect immediately without touching the key.'
              )}
            </p>
          </div>
        </div>

        {chains.length === 0 ? (
          <div className='text-muted-foreground border-muted flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm'>
            <Plus className='size-6' />
            {t('You have not created any channel chains yet.')}
          </div>
        ) : (
          <div className='space-y-2'>
            {chains.map((chain) => (
              <div
                key={chain.id}
                className='border-muted flex flex-col gap-2 rounded-lg border p-3'
              >
                <div className='flex items-center justify-between gap-2'>
                  <div className='flex min-w-0 items-center gap-2'>
                    <span className='truncate text-sm font-medium'>
                      {chain.name}
                    </span>
                    <span className='text-muted-foreground shrink-0 text-xs'>
                      {t('Bound API keys: {{count}}', {
                        count: tokenUsage[`chain:${chain.id}`] ?? 0,
                      })}
                    </span>
                  </div>
                  <div className='flex shrink-0 items-center gap-1'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='size-7'
                      aria-label={t('Edit channel chain')}
                      onClick={() =>
                        setEditing({
                          chainId: chain.id,
                          name: chain.name,
                          channels: [...chain.channels],
                        })
                      }
                    >
                      <Pencil className='size-3.5' />
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='text-destructive size-7'
                      aria-label={t('Delete chain')}
                      onClick={() => setDeleting(chain)}
                    >
                      <Trash2 className='size-3.5' />
                    </Button>
                  </div>
                </div>
                {chain.channels.length === 0 ? (
                  <span className='text-warning text-xs'>
                    {t(
                      'This chain has no channels left. Edit it or delete it.'
                    )}
                  </span>
                ) : (
                  <div className='flex flex-wrap items-center gap-1.5'>
                    {chain.channels.map((channelId, index) => {
                      const channel = channelById.get(channelId)
                      return (
                        <span
                          key={channelId}
                          className='flex items-center gap-1.5'
                        >
                          {index > 0 && (
                            <span className='text-muted-foreground text-xs'>
                              →
                            </span>
                          )}
                          <span className='bg-muted text-muted-foreground inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-xs'>
                            <span className='min-w-0 truncate'>
                              {channel ? channel.name : `#${channelId}`}
                            </span>
                            <span className='font-mono'>#{channelId}</span>
                          </span>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className='text-muted-foreground flex items-center justify-between text-xs'>
          <span>
            {t('Chains: {{used}}/{{max}}', {
              used: chains.length,
              max: maxChains,
            })}
          </span>
        </div>
      </div>
    )
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setEditing(null)
          }
          onOpenChange(next)
        }}
        title={editing ? t('Edit channel chain') : t('Model Group Chains')}
        description={
          editing
            ? t(
                'Pick channels and order them; requests fall back channel by channel.'
              )
            : t(
                'Chain your accessible channels in a custom order and use the chain as an API key group.'
              )
        }
        contentClassName='sm:max-w-[560px]'
        contentHeight='auto'
        bodyClassName='space-y-4'
        footer={
          editing ? (
            <div className='flex w-full justify-end gap-2'>
              <Button variant='outline' onClick={closeEditor}>
                {t('Cancel')}
              </Button>
              <Button type='button' onClick={handleSave} disabled={saving}>
                {saving ? t('Saving...') : t('Save chain')}
              </Button>
            </div>
          ) : (
            <div className='flex w-full justify-end'>
              <Button
                type='button'
                size='sm'
                disabled={chains.length >= maxChains}
                onClick={() => setEditing({ name: '', channels: [] })}
              >
                <Plus className='h-4 w-4' />
                {t('New chain')}
              </Button>
            </div>
          )
        }
      >
        {body}
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title={t('Delete chain')}
        desc={t(
          'Are you sure you want to delete this channel chain? API keys bound to it will switch to your account group.'
        )}
        confirmText={t('Delete')}
        destructive
        isLoading={deletingChain}
        handleConfirm={handleDelete}
        className='sm:max-w-md'
      />
    </>
  )
}
