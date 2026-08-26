/*
  Data Backup / Restore section
  - Export selected categories as a generic ZIP file (manifest.json + <category>.json)
  - Import a previously exported ZIP; supports skip-existing / overwrite-secret options
  - Backend permission: RootAuth (站长)
*/
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  AlertCircle,
  Download,
  FileArchive,
  RefreshCw,
  Upload,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

import {
  exportBackup,
  getBackupCategories,
  getBackupPreview,
  importBackup,
  type BackupCategoryItem,
  type BackupImportResult,
} from '@/features/system-settings/api'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function BackupSection() {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<BackupCategoryItem[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [includeSecret, setIncludeSecret] = useState(false)
  const [overwriteSecret, setOverwriteSecret] = useState(false)
  const [skipExisting, setSkipExisting] = useState(true)
  const [previewRows, setPreviewRows] = useState<Record<string, number>>({})
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importCategories, setImportCategories] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await getBackupCategories()
        if (cancelled) return
        setCategories(data)
        // 默认勾选除 large 之外的全部
        const init: Record<string, boolean> = {}
        for (const c of data) {
          init[c.key] = !c.is_large
        }
        setSelected(init)
      } catch (e) {
        toast.error(t('Failed to load backup categories'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const refreshPreview = async () => {
    try {
      const out: Record<string, number> = {}
      await Promise.all(
        Object.keys(selected)
          .filter((k) => selected[k])
          .map(async (k) => {
            try {
              const r = await getBackupPreview(k)
              out[k] = r.rows
            } catch {
              out[k] = -1
            }
          })
      )
      setPreviewRows(out)
    } catch (e) {
      toast.error(t('Failed to load preview'))
    }
  }

  const totalRows = Object.values(previewRows).reduce(
    (sum, v) => sum + (v > 0 ? v : 0),
    0
  )

  const handleExport = async () => {
    const cats = Object.keys(selected).filter((k) => selected[k])
    if (cats.length === 0) {
      toast.error(t('Please select at least one category'))
      return
    }
    setBusy(true)
    try {
      const blob = await exportBackup({ categories: cats, include_secret: includeSecret })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      a.download = includeSecret
        ? `new-api-backup-${stamp}.zip`
        : `new-api-backup-nosecret-${stamp}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(
        t('Backup exported: {{size}}', { size: formatBytes(blob.size) })
      )
    } catch (e) {
      toast.error(t('Export failed: {{msg}}', { msg: String(e) }))
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      toast.error(t('Please select a backup file first'))
      return
    }
    setBusy(true)
    try {
      const result = await importBackup({
        file: importFile,
        categories: importCategories,
        skip_existing: skipExisting,
        overwrite_secret: overwriteSecret,
      })
      const summary: string[] = []
      let totalImported = 0
      let totalErrors = 0
      result.results.forEach((r: BackupImportResult) => {
        totalImported += r.imported
        totalErrors += r.errors
        if (r.error_msg) {
          summary.push(`${r.category}: ${r.error_msg}`)
        }
      })
      toast.success(
        t('Imported {{n}} rows, {{e}} errors', {
          n: totalImported,
          e: totalErrors,
        })
      )
      if (summary.length > 0) {
        // eslint-disable-next-line no-console
        console.warn('Backup import partial failures:', summary)
      }
      setImportFile(null)
    } catch (e) {
      toast.error(t('Import failed: {{msg}}', { msg: String(e) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <FileArchive className='h-5 w-5' />
            {t('Data Backup & Restore')}
          </CardTitle>
          <CardDescription>
            {t(
              'Export selected data as a generic ZIP file, or import a previously exported ZIP. Only the site administrator (Root) can perform these operations.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Categories grid */}
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <Label className='text-base font-medium'>
                {t('Select categories')}
              </Label>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    const all: Record<string, boolean> = {}
                    categories.forEach((c) => (all[c.key] = true))
                    setSelected(all)
                  }}
                >
                  {t('Select all')}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setSelected({})}
                >
                  {t('Clear')}
                </Button>
              </div>
            </div>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3'>
              {categories.map((c) => (
                <label
                  key={c.key}
                  className='hover:bg-muted/50 flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors'
                >
                  <Checkbox
                    checked={Boolean(selected[c.key])}
                    onCheckedChange={(v) =>
                      setSelected((prev) => ({ ...prev, [c.key]: Boolean(v) }))
                    }
                  />
                  <div className='flex-1'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium'>{c.display}</span>
                      {c.is_large && (
                        <Badge variant='secondary' className='text-xs'>
                          {t('Large')}
                        </Badge>
                      )}
                    </div>
                    <div className='text-muted-foreground mt-1 text-xs'>
                      <code>{c.key}</code>
                      {previewRows[c.key] !== undefined && (
                        <span className='ml-2'>
                          ({t('{{n}} rows', { n: previewRows[c.key] })})
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Secret toggle */}
          <div className='space-y-2 rounded-lg border p-3'>
            <label className='flex cursor-pointer items-center gap-2'>
              <Checkbox
                checked={includeSecret}
                onCheckedChange={(v) => setIncludeSecret(Boolean(v))}
              />
              <div>
                <div className='font-medium'>
                  {t('Include secrets (channel keys, model source credentials)')}
                </div>
                <div className='text-muted-foreground text-xs'>
                  {t(
                    'When unchecked, sensitive fields are stripped from the export.'
                  )}
                </div>
              </div>
            </label>
          </div>

          {/* Preview / Export */}
          <div className='flex flex-wrap items-center gap-2'>
            <Button variant='outline' onClick={refreshPreview} disabled={busy}>
              <RefreshCw className='mr-2 h-4 w-4' />
              {t('Preview row counts')}
            </Button>
            <Button onClick={handleExport} disabled={busy}>
              <Download className='mr-2 h-4 w-4' />
              {t('Export selected')}
            </Button>
            {totalRows > 0 && (
              <span className='text-muted-foreground text-sm'>
                {t('Estimated: {{n}} rows total', { n: totalRows })}
              </span>
            )}
          </div>

          {includeSecret && (
            <Alert>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>
                {t(
                  'Heads up: the exported ZIP will contain plaintext secrets. Store it safely.'
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Upload className='h-5 w-5' />
            {t('Restore from backup')}
          </CardTitle>
          <CardDescription>
            {t(
              'Upload a ZIP file previously exported from New-API. Rows are matched by natural key (username, name, repo_id, etc).'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <input
            type='file'
            accept='.zip,application/zip'
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            className='text-sm'
          />

          <div className='space-y-2 rounded-lg border p-3'>
            <label className='flex cursor-pointer items-center gap-2'>
              <Checkbox
                checked={skipExisting}
                onCheckedChange={(v) => setSkipExisting(Boolean(v))}
              />
              <div>
                <div className='font-medium'>{t('Skip existing rows')}</div>
                <div className='text-muted-foreground text-xs'>
                  {t(
                    'Recommended. New rows will be added; existing rows stay untouched.'
                  )}
                </div>
              </div>
            </label>
            <label className='flex cursor-pointer items-center gap-2'>
              <Checkbox
                checked={overwriteSecret}
                onCheckedChange={(v) => setOverwriteSecret(Boolean(v))}
              />
              <div>
                <div className='font-medium'>{t('Overwrite secrets')}</div>
                <div className='text-muted-foreground text-xs'>
                  {t(
                    'Replace existing channel keys and model-source credentials with values from the backup.'
                  )}
                </div>
              </div>
            </label>
          </div>

          <div>
            <Label>{t('Limit to categories (optional)')}</Label>
            <div className='mt-2 flex flex-wrap gap-2'>
              {categories.map((c) => {
                const active = importCategories.includes(c.key)
                return (
                  <Badge
                    key={c.key}
                    variant={active ? 'default' : 'outline'}
                    className='cursor-pointer'
                    onClick={() => {
                      setImportCategories((prev) =>
                        prev.includes(c.key)
                          ? prev.filter((x) => x !== c.key)
                          : [...prev, c.key]
                      )
                    }}
                  >
                    {c.display}
                  </Badge>
                )
              })}
            </div>
            <div className='text-muted-foreground mt-2 text-xs'>
              {t(
                'Leave empty to import every category present in the backup.'
              )}
            </div>
          </div>

          <Button onClick={handleImport} disabled={busy || !importFile}>
            <Upload className='mr-2 h-4 w-4' />
            {t('Import')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
