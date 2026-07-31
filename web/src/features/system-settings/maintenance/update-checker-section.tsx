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
import {
  ExternalLinkIcon,
  RefreshCcwIcon,
  DownloadIcon,
  Undo2Icon,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { formatTimestamp, formatTimestampToDate } from '@/lib/format'
import { api } from '@/lib/api'

import { SettingsSection } from '../components/settings-section'

type ReleaseInfo = {
  name?: string
  body?: string
  html_url?: string
  published_at?: string
}

type UpdateInfo = {
  current_version: string
  latest_version: string
  has_update: boolean
  release_info?: ReleaseInfo
  cached?: boolean
  warning?: string
  deploy_mode?: string
  can_apply?: boolean
}

type RollbackVersion = {
  version: string
  published_at?: string
  html_url?: string
}

type UpdateCheckerSectionProps = {
  currentVersion?: string | null
  startTime?: number | null
}

const UPDATE_TIMEOUT_MS = 15 * 60 * 1000

export function UpdateCheckerSection({
  currentVersion,
  startTime,
}: UpdateCheckerSectionProps) {
  const { t } = useTranslation()
  const [checking, setChecking] = useState(false)
  const [applying, setApplying] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [rollbackVersions, setRollbackVersions] = useState<RollbackVersion[]>(
    []
  )

  const uptime = startTime ? formatTimestamp(startTime) : t('Unknown')
  const version = currentVersion || t('Unknown')

  const loadRollbackVersions = async () => {
    try {
      const res = await api.get('/api/system-update/rollback-versions')
      if (res.data?.success) {
        setRollbackVersions(res.data.data?.versions || [])
      }
    } catch {
      // optional; ignore if backend old or network error
      setRollbackVersions([])
    }
  }

  const handleCheckUpdates = async () => {
    setChecking(true)
    try {
      const res = await api.get('/api/system-update/check', {
        params: { force: true },
      })
      if (!res.data?.success) {
        throw new Error(res.data?.message || t('Failed to check for updates'))
      }
      const data = res.data.data as UpdateInfo
      setUpdateInfo(data)
      await loadRollbackVersions()

      if (data.warning) {
        toast.warning(data.warning)
      }

      if (!data.has_update) {
        toast.success(
          t('You are running the latest version ({{version}}).', {
            version: data.latest_version || data.current_version,
          })
        )
        return
      }

      setDialogOpen(true)
    } catch (error) {
      // Fallback: browser-side GitHub check (legacy behavior) if backend fails
      try {
        const response = await fetch(
          'https://api.github.com/repos/Calcium-Ion/new-api/releases/latest',
          {
            headers: {
              Accept: 'application/vnd.github+json',
              'User-Agent': 'new-api-dashboard',
            },
          }
        )
        if (!response.ok) {
          throw new Error(t('Failed to contact GitHub releases API'))
        }
        const release = (await response.json()) as ReleaseInfo & {
          tag_name?: string
        }
        const latest = (release.tag_name || '').replace(/^v/, '')
        const current = (currentVersion || '').replace(/^v/, '')
        if (current && latest && current === latest) {
          toast.success(
            t('You are running the latest version ({{version}}).', {
              version: release.tag_name,
            })
          )
          return
        }
        setUpdateInfo({
          current_version: current,
          latest_version: latest,
          has_update: true,
          release_info: release,
          can_apply: false,
          deploy_mode: 'unknown',
          warning: t(
            'Backend update API unavailable; showing release notes only.'
          ),
        })
        setDialogOpen(true)
      } catch (fallbackError) {
        const message =
          fallbackError instanceof Error
            ? fallbackError.message
            : error instanceof Error
              ? error.message
              : t('Failed to check for updates')
        toast.error(message)
      }
    } finally {
      setChecking(false)
    }
  }

  const handleApplyUpdate = async () => {
    setApplying(true)
    try {
      const res = await api.post(
        '/api/system-update/apply',
        {},
        { timeout: UPDATE_TIMEOUT_MS }
      )
      if (!res.data?.success) {
        throw new Error(res.data?.message || t('Update failed'))
      }
      const data = res.data.data || {}
      if (data.already_up_to_date) {
        toast.success(t('You are running the latest version ({{version}}).', {
          version: data.latest_version || updateInfo?.latest_version,
        }))
        setDialogOpen(false)
        return
      }
      toast.success(
        data.message ||
          t(
            'Update completed. Please restart the new-api process to load the new binary.'
          )
      )
      setDialogOpen(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Update failed')
      toast.error(message)
    } finally {
      setApplying(false)
    }
  }

  const handleRollback = async (version?: string) => {
    setRollingBack(true)
    try {
      const res = await api.post(
        '/api/system-update/rollback',
        version ? { version } : {},
        { timeout: UPDATE_TIMEOUT_MS }
      )
      if (!res.data?.success) {
        throw new Error(res.data?.message || t('Rollback failed'))
      }
      toast.success(
        res.data.data?.message ||
          t('Rollback completed. Please restart the new-api process.')
      )
      setDialogOpen(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Rollback failed')
      toast.error(message)
    } finally {
      setRollingBack(false)
    }
  }

  const goToRelease = () => {
    const url = updateInfo?.release_info?.html_url
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const canApply = Boolean(updateInfo?.can_apply && updateInfo?.has_update)
  const isDocker = updateInfo?.deploy_mode === 'docker'

  return (
    <>
      <SettingsSection title={t('System maintenance')}>
        <div className='space-y-6'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='rounded-lg border p-4'>
              <div className='text-muted-foreground text-sm'>
                {t('Current version')}
              </div>
              <div className='text-lg font-semibold'>{version}</div>
            </div>
            <div className='rounded-lg border p-4'>
              <div className='text-muted-foreground text-sm'>
                {t('Uptime since')}
              </div>
              <div className='text-lg font-semibold'>{uptime}</div>
            </div>
          </div>

          <div className='flex flex-wrap gap-2'>
            <Button onClick={handleCheckUpdates} disabled={checking || applying}>
              {checking ? (
                t('Checking updates...')
              ) : (
                <>
                  <RefreshCcwIcon className='me-2 h-4 w-4' />
                  {t('Check for updates')}
                </>
              )}
            </Button>
            <Button
              type='button'
              variant='outline'
              disabled={rollingBack || applying || checking}
              onClick={() => handleRollback()}
            >
              <Undo2Icon className='me-2 h-4 w-4' />
              {rollingBack ? t('Rolling back...') : t('Rollback last backup')}
            </Button>
          </div>

          <p className='text-muted-foreground text-sm'>
            {t(
              'In-place update downloads the official release binary and replaces the running executable (binary installs only). Docker users should pull a new image instead.'
            )}
          </p>
        </div>
      </SettingsSection>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={
          updateInfo?.latest_version
            ? t('New version available: {{version}}', {
                version: updateInfo.latest_version,
              })
            : t('Release details')
        }
        description={
          updateInfo?.release_info?.published_at
            ? `${t('Published')} ${formatTimestampToDate(
                new Date(updateInfo.release_info.published_at).getTime(),
                'milliseconds'
              )}`
            : undefined
        }
        contentClassName='max-h-[80vh] overflow-y-auto'
        contentHeight='auto'
        bodyClassName='space-y-4'
        footer={
          <>
            <Button
              type='button'
              variant='secondary'
              onClick={() => setDialogOpen(false)}
            >
              {t('Close')}
            </Button>
            {updateInfo?.release_info?.html_url && (
              <Button type='button' variant='outline' onClick={goToRelease}>
                <ExternalLinkIcon className='me-2 h-4 w-4' />
                {t('Open release')}
              </Button>
            )}
            {canApply && (
              <Button
                type='button'
                onClick={handleApplyUpdate}
                disabled={applying}
              >
                <DownloadIcon className='me-2 h-4 w-4' />
                {applying ? t('Updating...') : t('Update now')}
              </Button>
            )}
          </>
        }
      >
        <div className='space-y-4'>
          {isDocker && (
            <div className='rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm'>
              {t(
                'Docker deployment detected. In-place binary update is disabled. Upgrade with: docker compose pull && docker compose up -d'
              )}
            </div>
          )}
          {!canApply && !isDocker && updateInfo?.has_update && (
            <div className='text-muted-foreground text-sm'>
              {t(
                'Automatic apply is unavailable in this environment. Download the release manually or open the GitHub page.'
              )}
            </div>
          )}
          {updateInfo?.release_info?.body ? (
            <Markdown>{updateInfo.release_info.body}</Markdown>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('No release notes provided.')}
            </p>
          )}

          {rollbackVersions.length > 0 && (
            <div className='space-y-2 border-t pt-4'>
              <div className='text-sm font-medium'>{t('Rollback versions')}</div>
              <div className='flex flex-wrap gap-2'>
                {rollbackVersions.map((v) => (
                  <Button
                    key={v.version}
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={rollingBack || applying}
                    onClick={() => handleRollback(v.version)}
                  >
                    {v.version}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </>
  )
}
