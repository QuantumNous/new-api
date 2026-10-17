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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { resolveLocalizedText } from '@/lib/localized-text'

import {
  activateTaskPlugin,
  getTaskPlugin,
  getTaskPluginVersions,
} from '../api'
import type { TaskPluginListItem } from '../types'
import { JavaScriptViewer } from './javascript-viewer'
import { PluginMetadataCard } from './plugin-metadata-card'
import { PluginSandbox } from './plugin-sandbox'
import { SourceDiff } from './source-diff'
import { UsageSchemaTable } from './usage-schema-table'

type PluginDetailSheetProps = {
  plugin: TaskPluginListItem | null
  onOpenChange: (open: boolean) => void
}

export function PluginDetailSheet(props: PluginDetailSheetProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const key = props.plugin?.meta.key ?? ''
  const [compareVersion, setCompareVersion] = useState('')
  const detailQuery = useQuery({
    queryKey: ['task-plugin', key],
    queryFn: () => getTaskPlugin(key),
    enabled: Boolean(key),
  })
  const versionsQuery = useQuery({
    queryKey: ['task-plugin-versions', key],
    queryFn: () => getTaskPluginVersions(key),
    enabled: Boolean(key),
  })
  const compareQuery = useQuery({
    queryKey: ['task-plugin', key, compareVersion],
    queryFn: () => getTaskPlugin(key, compareVersion),
    enabled: Boolean(key && compareVersion),
  })
  const activateMutation = useMutation({
    mutationFn: (version: string) => activateTaskPlugin(key, version),
    onSuccess: () => {
      toast.success(t('Plugin version activated'))
      queryClient.invalidateQueries({ queryKey: ['task-plugins'] })
      queryClient.invalidateQueries({ queryKey: ['task-plugin', key] })
      queryClient.invalidateQueries({ queryKey: ['task-plugin-versions', key] })
    },
    onError: (error) => toast.error(error.message),
  })
  const detail = detailQuery.data
  const versions = versionsQuery.data ?? []
  const description = resolveLocalizedText(
    detail?.meta.description ?? props.plugin?.meta.description,
    i18n.language
  )
  return (
    <Sheet open={Boolean(props.plugin)} onOpenChange={props.onOpenChange}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-4xl'>
        <SheetHeader>
          <SheetTitle>
            {detail?.meta.name ?? props.plugin?.meta.name}
          </SheetTitle>
          <SheetDescription>
            <span className='block font-mono'>{key}</span>
            {description ? (
              <span className='mt-1 block'>{description}</span>
            ) : null}
          </SheetDescription>
        </SheetHeader>
        <div className='space-y-4 px-4 pb-6'>
          {detail && (
            <>
              <PluginMetadataCard meta={detail.meta} />
              <Card>
                <CardHeader>
                  <CardTitle>{t('Billing parameters')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {detail.meta.usageSchema &&
                  Object.keys(detail.meta.usageSchema).length > 0 ? (
                    <UsageSchemaTable schema={detail.meta.usageSchema} />
                  ) : (
                    <p className='text-muted-foreground text-sm'>
                      {t('No billing parameters declared')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
          <Tabs defaultValue='source'>
            <TabsList>
              <TabsTrigger value='source'>{t('Source')}</TabsTrigger>
              <TabsTrigger value='versions'>{t('Version history')}</TabsTrigger>
              <TabsTrigger value='diff'>{t('Source diff')}</TabsTrigger>
              <TabsTrigger value='sandbox'>{t('Sandbox')}</TabsTrigger>
            </TabsList>
            <TabsContent value='source'>
              <JavaScriptViewer
                value={detail?.source ?? ''}
                className='h-[32rem] overflow-hidden rounded-md border'
              />
            </TabsContent>
            <TabsContent value='versions'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Version')}</TableHead>
                    <TableHead>{t('Remark')}</TableHead>
                    <TableHead>{t('Status')}</TableHead>
                    <TableHead className='text-right'>{t('Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((version) => (
                    <TableRow key={version.id}>
                      <TableCell>{version.version}</TableCell>
                      <TableCell>{version.remark || '—'}</TableCell>
                      <TableCell>
                        {version.active ? <Badge>{t('Active')}</Badge> : '—'}
                      </TableCell>
                      <TableCell className='text-right'>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={
                            version.active || activateMutation.isPending
                          }
                          onClick={() =>
                            activateMutation.mutate(version.version)
                          }
                        >
                          <RotateCcw />
                          {t('Activate / Roll back')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value='diff' className='space-y-3'>
              <Select
                value={compareVersion}
                onValueChange={(value) => setCompareVersion(value ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('Select a version to compare')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {versions
                      .filter(
                        (version) => version.version !== detail?.meta.version
                      )
                      .map((version) => (
                        <SelectItem key={version.id} value={version.version}>
                          {version.version}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {compareQuery.data && detail && (
                <SourceDiff
                  before={compareQuery.data.source}
                  after={detail.source}
                />
              )}
            </TabsContent>
            <TabsContent value='sandbox'>
              <PluginSandbox pluginKey={key} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
