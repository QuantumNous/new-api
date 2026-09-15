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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { getGuideBlockKey } from '../catalog'
import { fillGuideTemplate } from '../lib/runtime'
import type { GuideBlock, GuideRuntime } from '../types'
import { GuideCodeBlock } from './guide-code-block'

type DocBlockProps = {
  block: GuideBlock
  runtime: GuideRuntime
}

export function DocBlock(props: DocBlockProps) {
  const { t } = useTranslation()
  const resolve = (value: string) => fillGuideTemplate(t(value), props.runtime)

  if (props.block.type === 'paragraph') {
    return (
      <p className='text-foreground/85 my-4 text-[0.95rem] leading-7 text-pretty'>
        {resolve(props.block.text)}
      </p>
    )
  }

  if (props.block.type === 'code') {
    return <GuideCodeBlock code={props.block} runtime={props.runtime} />
  }

  if (props.block.type === 'callout') {
    return (
      <Alert
        className={cn(
          'my-5',
          props.block.tone === 'warning' && 'border-warning/40 bg-warning/10'
        )}
      >
        <AlertTitle>{resolve(props.block.title)}</AlertTitle>
        <AlertDescription>{resolve(props.block.text)}</AlertDescription>
      </Alert>
    )
  }

  if (props.block.type === 'table') {
    const table = props.block
    return (
      <div className='border-border my-5 max-w-full overflow-x-auto rounded-xl border'>
        <table className='w-full min-w-[36rem] border-collapse text-left text-sm'>
          <thead className='bg-muted/70'>
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column}
                  scope='col'
                  className='border-border border-b px-4 py-3 font-medium'
                >
                  {resolve(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.join('|')}>
                {table.columns.map((column, columnIndex) => (
                  <td
                    key={column}
                    className='border-border text-foreground/80 border-b px-4 py-3 align-top leading-6 last:[tr_&]:border-b-0'
                  >
                    {resolve(row[columnIndex] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (props.block.type === 'steps') {
    return (
      <ol className='my-5 flex flex-col gap-5'>
        {props.block.items.map((item, index) => (
          <li
            key={item.title}
            className='grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3'
          >
            <Badge className='mt-0.5 size-7 rounded-full p-0'>
              {index + 1}
            </Badge>
            <div className='min-w-0'>
              <h3 className='text-sm font-medium'>{resolve(item.title)}</h3>
              {item.text ? (
                <p className='text-muted-foreground mt-1 text-sm leading-6'>
                  {resolve(item.text)}
                </p>
              ) : null}
              {item.code ? (
                <GuideCodeBlock code={item.code} runtime={props.runtime} />
              ) : null}
              {item.action ? (
                <Button
                  variant='outline'
                  size='sm'
                  className='mt-3'
                  render={<Link to={item.action.to} />}
                >
                  {resolve(item.action.label)}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    )
  }

  if (props.block.type === 'platform') {
    const blocks = props.block.platforms[props.runtime.platform] ?? []
    return (
      <div>
        {blocks.map((block) => (
          <DocBlock
            key={`${props.runtime.platform}-${getGuideBlockKey(block)}`}
            block={block}
            runtime={props.runtime}
          />
        ))}
      </div>
    )
  }

  const supportsLargeContext = (props.runtime.contextLength ?? 0) >= 1_000_000
  if (!supportsLargeContext) {
    return (
      <Alert className='my-5'>
        <AlertTitle>{resolve(props.block.unavailableTitle)}</AlertTitle>
        <AlertDescription>
          {resolve(props.block.unavailableText)}
        </AlertDescription>
      </Alert>
    )
  }

  const contextLength = props.runtime.contextLength ?? 1_000_000
  const compactAt = Math.floor(contextLength * 0.9)
  return (
    <div className='my-5'>
      <Alert>
        <AlertTitle>{resolve(props.block.supportedTitle)}</AlertTitle>
        <AlertDescription>
          {resolve(props.block.supportedText)}
        </AlertDescription>
      </Alert>
      <GuideCodeBlock
        code={{
          label: '~/.codex/config.toml',
          language: 'toml',
          copyLabel: 'Copy large-context config',
          template: `model_context_window = ${contextLength}\nmodel_auto_compact_token_limit = ${compactAt}`,
        }}
        runtime={props.runtime}
      />
    </div>
  )
}
