import { Check, Copy, Sparkles } from 'lucide-react'
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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

import { guideTools, type GuideTool, type ToolCategory } from '../data'
import type { GuideAddress } from '../use-guide-address'

const CATEGORIES: { value: ToolCategory | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'chat', label: '聊天与办公' },
  { value: 'translate', label: '翻译与阅读' },
  { value: 'coding', label: '编程开发' },
  { value: 'manager', label: '配置管理' },
  { value: 'platform', label: '自建平台' },
]

const STATUS_META: Record<GuideTool['status'], { label: string; hue: string }> =
  {
    green: { label: '直接可用', hue: 'var(--success)' },
    yellow: { label: '需要配置文件', hue: 'var(--warning)' },
    blue: { label: '专用协议', hue: 'var(--info)' },
    gray: { label: '暂不支持', hue: 'var(--neutral)' },
  }

interface ToolExplorerProps {
  address: GuideAddress
}

/** Category-filtered wall of tool cards with a step-by-step detail dialog. */
export function ToolExplorer({ address }: ToolExplorerProps) {
  const { t } = useTranslation()
  const [category, setCategory] = useState<ToolCategory | 'all'>('all')
  const [active, setActive] = useState<GuideTool | null>(null)
  const { copiedText, copyToClipboard } = useCopyToClipboard()

  const tools = useMemo(() => {
    const visibleTools =
      category === 'all'
        ? [...guideTools]
        : guideTools.filter((tool) => tool.category === category)

    return visibleTools.sort(
      (a, b) => Number(Boolean(b.recommended)) - Number(Boolean(a.recommended))
    )
  }, [category])

  return (
    <div className='flex flex-col gap-6'>
      {/* Category pills */}
      <div
        className='dopa-tab-strip flex flex-wrap items-center gap-2'
        role='tablist'
        aria-label={t('Tool categories')}
      >
        {CATEGORIES.map((c) => {
          const selected = category === c.value
          return (
            <button
              key={c.value}
              type='button'
              role='tab'
              aria-selected={selected}
              onClick={() => setCategory(c.value)}
              className={`dopa-tab-pill dopa-press rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                selected
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {c.label}
            </button>
          )
        })}
      </div>

      {/* Status legend */}
      <div className='text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs'>
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <span key={key} className='inline-flex items-center gap-1.5'>
            <span
              className='size-2.5 rounded-full'
              style={{ backgroundColor: meta.hue }}
            />
            {meta.label}
          </span>
        ))}
      </div>

      {/* Tool cards */}
      <div className='dopa-bento-tools grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {tools.map((tool, i) => {
          const meta = STATUS_META[tool.status]
          return (
            <button
              key={tool.id}
              type='button'
              onClick={() => setActive(tool)}
              className='dopa-tool-tile dopa-lift dopa-fade-up border-border bg-card group flex flex-col gap-2.5 rounded-3xl border p-5 text-left'
              data-recommended={tool.recommended ? 'true' : undefined}
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <div className='flex items-center justify-between gap-2'>
                <span className='text-sm font-bold'>{tool.name}</span>
                <span className='flex items-center gap-1.5'>
                  {tool.recommended && (
                    <Badge className='bg-secondary text-secondary-foreground gap-1 border-transparent'>
                      <Sparkles className='size-3' />
                      {t('Recommended')}
                    </Badge>
                  )}
                  <span
                    aria-label={meta.label}
                    title={meta.label}
                    className='size-2.5 shrink-0 rounded-full'
                    style={{ backgroundColor: meta.hue }}
                  />
                </span>
              </div>
              <p className='text-muted-foreground text-xs leading-relaxed'>
                {tool.summary}
              </p>
              <span className='text-primary mt-auto text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100'>
                {t('View setup steps')} →
              </span>
            </button>
          )
        })}
      </div>

      {/* Detail dialog */}
      <Dialog
        open={active !== null}
        onOpenChange={(open) => !open && setActive(null)}
      >
        <DialogContent className='max-h-[85vh] gap-0 overflow-y-auto sm:max-w-xl'>
          {active && (
            <>
              <DialogHeader className='pb-4'>
                <DialogTitle className='flex items-center gap-2.5'>
                  {active.name}
                  <span
                    className='rounded-full px-2.5 py-0.5 text-xs font-semibold'
                    style={{
                      backgroundColor: `color-mix(in oklab, ${STATUS_META[active.status].hue} 15%, transparent)`,
                      color: STATUS_META[active.status].hue,
                    }}
                  >
                    {STATUS_META[active.status].label}
                  </span>
                </DialogTitle>
                <DialogDescription>{active.summary}</DialogDescription>
              </DialogHeader>

              <ol className='flex flex-col gap-3'>
                {active.steps.map((step, i) => {
                  const filled = address.fill(step)
                  return (
                    <li key={step} className='flex items-start gap-3'>
                      <span className='bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold'>
                        {i + 1}
                      </span>
                      <span className='min-w-0 pt-0.5 text-sm leading-relaxed break-words'>
                        {filled}
                      </span>
                    </li>
                  )
                })}
              </ol>

              {active.tips && active.tips.length > 0 && (
                <div className='border-warning/40 bg-warning/10 mt-5 rounded-2xl border p-4'>
                  <p className='text-sm font-bold'>{t('Heads up')}</p>
                  <ul className='mt-1.5 flex list-disc flex-col gap-1 pl-4'>
                    {active.tips.map((tip) => (
                      <li key={tip} className='text-xs leading-relaxed'>
                        {address.fill(tip)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {active.snippet && (
                <div className='mt-5'>
                  <div className='mb-2 flex items-center justify-between'>
                    <p className='text-sm font-bold'>{active.snippet.label}</p>
                    <Button
                      variant='outline'
                      size='sm'
                      className='h-7 gap-1.5 rounded-full text-xs'
                      onClick={() =>
                        copyToClipboard(
                          address.fill(active.snippet?.code ?? '')
                        )
                      }
                    >
                      {copiedText === address.fill(active.snippet.code) ? (
                        <Check
                          className='dopa-pop-in size-3'
                          style={{ color: 'var(--success)' }}
                        />
                      ) : (
                        <Copy className='size-3' />
                      )}
                      {t('Copy')}
                    </Button>
                  </div>
                  <pre className='border-border bg-muted/60 overflow-x-auto rounded-2xl border p-4 font-mono text-xs leading-relaxed'>
                    {address.fill(active.snippet.code)}
                  </pre>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
