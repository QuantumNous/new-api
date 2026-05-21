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
import { cn } from '@/lib/utils'

/** Pricing page hero — reduce gray fog from decorative gradients. */
export const pricingHeroGlowClassName = cn(
  'pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-[0.14]'
)

export const pricingSidebarClassName = cn(
  'rounded-xl border border-white/10 bg-slate-950/80 p-3 shadow-lg shadow-black/20 backdrop-blur-md'
)

export const pricingToolbarClassName = cn(
  'rounded-xl border border-white/10 bg-slate-950/70 p-3 shadow-md shadow-black/15 backdrop-blur-md'
)

export const pricingSearchInputClassName = cn(
  'h-10 w-full rounded-lg border border-white/10 bg-slate-950/70 pr-16 pl-10 text-sm text-slate-100',
  'placeholder:text-slate-400',
  'hover:border-white/20',
  'focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none'
)

export const pricingCardClassName = cn(
  'group relative flex flex-col rounded-xl border border-white/10 bg-slate-900/80 p-3 shadow-md shadow-black/20',
  'transition-colors sm:p-5',
  'hover:border-cyan-400/40 hover:bg-slate-900/90'
)

export const pricingCardTitleClassName =
  'truncate font-mono text-[15px] leading-tight font-bold text-slate-50'

export const pricingCardPriceLabelClassName = 'text-slate-300'

export const pricingCardPriceValueClassName =
  'font-mono font-semibold text-cyan-100'

export const pricingCardMetaClassName = 'text-xs font-medium text-slate-300'

export const pricingCardTagClassName = 'text-xs text-slate-400'

export const pricingCardActionButtonClassName = cn(
  'inline-flex items-center gap-1 rounded-md border border-white/15 bg-slate-950/60 px-2 py-1 text-xs font-medium text-slate-200',
  'transition-colors hover:border-cyan-400/35 hover:bg-slate-900 hover:text-white',
  'sm:px-2.5 sm:py-1.5'
)

export const pricingFilterTitleClassName = 'text-sm font-bold text-slate-100'

export const pricingFilterSubtitleClassName = 'mt-1 text-xs text-slate-400'

export const pricingFilterSectionTitleClassName = 'text-sm font-semibold text-slate-200'

export const pricingFilterChipActiveClassName = cn(
  'border-cyan-400/45 bg-cyan-500/15 text-cyan-100 shadow-sm'
)

export const pricingFilterChipInactiveClassName = cn(
  'border-white/15 bg-slate-950/50 text-slate-300',
  'hover:border-white/25 hover:bg-slate-900/80 hover:text-slate-100'
)

export const pricingSegmentTrackClassName = cn(
  'inline-flex h-8 items-center rounded-lg border border-white/10 bg-slate-950/70 p-0.5'
)

export const pricingSegmentActiveClassName = cn(
  'bg-cyan-600 text-white shadow-sm'
)

export const pricingSegmentInactiveClassName = cn(
  'text-slate-300 hover:bg-white/5 hover:text-white'
)

export const pricingOutlineButtonClassName = cn(
  'border-white/15 bg-slate-950/60 text-slate-200 hover:border-white/25 hover:bg-slate-900 hover:text-white',
  'disabled:border-white/10 disabled:bg-slate-950/40 disabled:text-slate-500'
)
