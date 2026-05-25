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
import { useMemo } from 'react'
import { FileCode2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStatus } from '@/hooks/use-status'
import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  buildUsageGuideRenderContext,
  extractApiKeyUsageGuideJson,
  parseApiKeyUsageGuideConfig,
  renderUsageGuideTemplate,
  type ApiKeyUsageGuideFile,
  type ApiKeyUsageGuidePlatform,
} from '../../lib/usage-guide-templates'

type ApiKeyUsageGuideDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tokenKey: string
  keyName?: string
}

type FileBlockProps = {
  file: ApiKeyUsageGuideFile
  content: string
}

function FileBlock({ file, content }: FileBlockProps) {
  const { t } = useTranslation()

  return (
    <div className='rounded-lg border'>
      <div className='bg-muted/40 flex min-w-0 items-center justify-between gap-3 rounded-t-lg border-b px-3 py-2'>
        <div className='flex min-w-0 items-center gap-2'>
          <FileCode2 className='text-muted-foreground size-4 shrink-0' />
          <div className='min-w-0'>
            <div className='truncate text-sm font-medium'>
              {file.title || t('Configuration file')}
            </div>
            <div className='text-muted-foreground truncate font-mono text-xs'>
              {file.path}
            </div>
          </div>
        </div>
        <CopyButton
          value={content}
          variant='outline'
          size='sm'
          tooltip={t('Copy configuration')}
          successTooltip={t('Configuration copied')}
          aria-label={t('Copy configuration')}
        >
          {t('Copy')}
        </CopyButton>
      </div>
      <pre className='max-h-80 overflow-auto rounded-b-lg bg-neutral-950 p-3 text-xs leading-relaxed text-neutral-50'>
        <code>{content}</code>
      </pre>
    </div>
  )
}

type FilesPanelProps = {
  files: ApiKeyUsageGuideFile[]
  context: ReturnType<typeof buildUsageGuideRenderContext>
  note?: string
}

function FilesPanel({ files, context, note }: FilesPanelProps) {
  const { t } = useTranslation()

  return (
    <div className='space-y-3'>
      {files.map((file, index) => {
        const rendered = renderUsageGuideTemplate(file.content, context)
        const key = file.id || `${file.path}-${index}`
        return <FileBlock key={key} file={file} content={rendered} />
      })}
      {note ? (
        <p className='text-muted-foreground text-xs'>{t(note)}</p>
      ) : null}
    </div>
  )
}

function getInitialPlatform(platforms?: ApiKeyUsageGuidePlatform[]) {
  return platforms?.[0]?.id ?? ''
}

export function ApiKeyUsageGuideDialog({
  open,
  onOpenChange,
  tokenKey,
  keyName = '',
}: ApiKeyUsageGuideDialogProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const rawConfig = extractApiKeyUsageGuideJson(status)
  const config = useMemo(
    () => parseApiKeyUsageGuideConfig(rawConfig),
    [rawConfig]
  )
  const context = useMemo(
    () => buildUsageGuideRenderContext(tokenKey, keyName),
    [keyName, tokenKey]
  )
  const tabsKey = rawConfig || 'default-api-key-usage-tips'
  const firstSectionId = config.sections[0]?.id ?? ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-hidden sm:max-w-4xl'>
        <DialogHeader>
          <DialogTitle>{t('API KEY Usage Tips')}</DialogTitle>
          <DialogDescription>
            {t('Choose a client and copy the generated configuration files.')}
          </DialogDescription>
        </DialogHeader>

        {!tokenKey ? (
          <div className='text-muted-foreground rounded-lg border px-3 py-8 text-center text-sm'>
            {t('API key is still loading. Open the menu again in a moment.')}
          </div>
        ) : config.sections.length > 0 ? (
          <Tabs key={tabsKey} defaultValue={firstSectionId}>
            <TabsList className='max-w-full justify-start overflow-x-auto'>
              {config.sections.map((section) => (
                <TabsTrigger key={section.id} value={section.id}>
                  {t(section.name)}
                </TabsTrigger>
              ))}
            </TabsList>

            {config.sections.map((section) => {
              return (
                <TabsContent
                  key={section.id}
                  value={section.id}
                  className='mt-4 min-h-0'
                >
                  <ScrollArea className='max-h-[60vh] pr-3'>
                    <div className='space-y-4'>
                      {section.description ? (
                        <p className='text-muted-foreground text-sm'>
                          {t(section.description)}
                        </p>
                      ) : null}

                      {section.platforms?.length ? (
                        <Tabs
                          defaultValue={getInitialPlatform(section.platforms)}
                        >
                          <TabsList className='max-w-full justify-start overflow-x-auto'>
                            {section.platforms.map((item) => (
                              <TabsTrigger key={item.id} value={item.id}>
                                {t(item.name)}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                          {section.platforms.map((item) => (
                            <TabsContent
                              key={item.id}
                              value={item.id}
                              className='mt-3'
                            >
                              <FilesPanel
                                files={item.files}
                                context={context}
                                note={item.note}
                              />
                            </TabsContent>
                          ))}
                        </Tabs>
                      ) : (
                        <FilesPanel
                          files={section.files ?? []}
                          context={context}
                          note={section.note}
                        />
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              )
            })}
          </Tabs>
        ) : (
          <div className='text-muted-foreground rounded-lg border px-3 py-8 text-center text-sm'>
            {t('No API KEY usage tips configured.')}
          </div>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
