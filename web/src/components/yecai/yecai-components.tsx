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
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { CircleDollarSign, Sparkles, type LucideIcon } from 'lucide-react'
import { isValidElement, type HTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type YecaiTone = 'leaf' | 'model' | 'money' | 'signal' | 'neutral'

type YecaiPanelElement = 'article' | 'aside' | 'div' | 'li' | 'section'

interface YecaiPanelProps extends HTMLAttributes<HTMLElement> {
  as?: YecaiPanelElement
  layer?: 'base' | 'raised' | 'hero'
  tone?: YecaiTone
}

export function YecaiPanel(props: YecaiPanelProps) {
  const {
    as: Element = 'div',
    className,
    layer = 'base',
    tone = 'neutral',
    ...panelProps
  } = props

  return (
    <Element
      {...panelProps}
      className={cn('yecai-panel', className)}
      data-layer={layer}
      data-tone={tone}
    />
  )
}

interface YecaiBentoGridProps extends HTMLAttributes<HTMLDivElement> {
  density?: 'airy' | 'compact'
}

export function YecaiBentoGrid(props: YecaiBentoGridProps) {
  const { className, density = 'airy', ...gridProps } = props

  return (
    <div
      {...gridProps}
      className={cn('yecai-bento-grid', className)}
      data-density={density}
    />
  )
}

interface YecaiBentoItemProps extends HTMLAttributes<HTMLElement> {
  as?: Exclude<YecaiPanelElement, 'li'>
  tone?: YecaiTone
}

export function YecaiBentoItem(props: YecaiBentoItemProps) {
  const {
    as: Element = 'article',
    className,
    tone = 'neutral',
    ...itemProps
  } = props

  return (
    <Element
      {...itemProps}
      className={cn('yecai-bento-item', className)}
      data-tone={tone}
    />
  )
}

export type YecaiActionProps = ButtonPrimitive.Props & {
  appearance?: 'solid' | 'soft' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'tile'
  tone?: YecaiTone
}

function isNativeButtonRender(render: ButtonPrimitive.Props['render']) {
  if (!render || !isValidElement(render)) return true
  return render.type === 'button'
}

export function YecaiAction(props: YecaiActionProps) {
  const {
    appearance = 'solid',
    className,
    nativeButton,
    render,
    size = 'md',
    tone = 'leaf',
    ...buttonProps
  } = props

  return (
    <ButtonPrimitive
      {...buttonProps}
      className={cn('yecai-action', className)}
      data-appearance={appearance}
      data-slot='yecai-action'
      data-tone={tone}
      data-yecai-size={size}
      nativeButton={nativeButton ?? isNativeButtonRender(render)}
      render={render}
    />
  )
}

interface YecaiMetricProps extends HTMLAttributes<HTMLDivElement> {
  detail?: ReactNode
  icon: LucideIcon
  label: ReactNode
  tone?: YecaiTone
  value: ReactNode
}

export function YecaiMetric(props: YecaiMetricProps) {
  const {
    className,
    detail,
    icon: Icon,
    label,
    tone = 'neutral',
    value,
    ...metricProps
  } = props

  return (
    <div
      {...metricProps}
      className={cn('yecai-metric', className)}
      data-tone={tone}
    >
      <span className='yecai-metric__icon' aria-hidden='true'>
        <Icon />
      </span>
      <span className='yecai-metric__copy'>
        <span className='yecai-metric__label'>{label}</span>
        <strong className='yecai-metric__value'>{value}</strong>
        {detail ? (
          <small className='yecai-metric__detail'>{detail}</small>
        ) : null}
      </span>
    </div>
  )
}

interface YecaiPriceFlowProps extends HTMLAttributes<HTMLElement> {
  accessibleLabel: string
  officialLabel: ReactNode
  officialValue: ReactNode
  savingsLabel?: ReactNode
  savingsValue?: ReactNode
  siteLabel: ReactNode
  siteValue: ReactNode
  size?: 'compact' | 'hero'
}

export function YecaiPriceFlow(props: YecaiPriceFlowProps) {
  const {
    accessibleLabel,
    className,
    officialLabel,
    officialValue,
    savingsLabel,
    savingsValue,
    siteLabel,
    siteValue,
    size = 'compact',
    ...flowProps
  } = props

  return (
    <figure
      {...flowProps}
      aria-label={accessibleLabel}
      className={cn('yecai-price-flow', className)}
      data-size={size}
    >
      <div className='yecai-price-flow__node' data-side='official'>
        <span className='yecai-price-flow__icon' aria-hidden='true'>
          <CircleDollarSign />
        </span>
        <span>{officialLabel}</span>
        <strong>{officialValue}</strong>
      </div>

      <svg
        className='yecai-price-flow__curve'
        viewBox='0 0 160 70'
        preserveAspectRatio='none'
        aria-hidden='true'
      >
        <path d='M 8 50 C 48 8, 108 65, 152 20' />
        <circle className='yecai-price-flow__traveler' r='4'>
          <animateMotion
            dur='3.2s'
            repeatCount='indefinite'
            path='M 8 50 C 48 8, 108 65, 152 20'
          />
        </circle>
      </svg>

      <div className='yecai-price-flow__node' data-side='site'>
        <span className='yecai-price-flow__icon' aria-hidden='true'>
          <Sparkles />
        </span>
        <span>{siteLabel}</span>
        <strong>{siteValue}</strong>
      </div>

      {savingsValue ? (
        <figcaption className='yecai-price-flow__saving'>
          <span>{savingsLabel}</span>
          <strong>{savingsValue}</strong>
        </figcaption>
      ) : null}
    </figure>
  )
}
