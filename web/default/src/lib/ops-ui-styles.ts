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
/**
 * Shared ops-center / public portal UI tokens (presentation only).
 */
import { cn } from '@/lib/utils'

// —— Public portal header (dark hero / dark background) —— //

export const portalHeaderSiteNameClassName = 'text-sm font-semibold text-slate-100'

export const portalHeaderNavLinkClassName =
  'rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-200 transition-colors duration-200 hover:text-white'

export const portalHeaderNavLinkActiveClassName =
  'rounded-lg px-3 py-1.5 text-[13px] font-semibold text-white transition-colors duration-200'

/** Between primary nav links and right toolbar (portal). */
export const portalHeaderNavActionsSeparatorClassName =
  'mx-3 h-6 w-px shrink-0 self-center bg-white/15 md:mx-4'

export const portalHeaderDefaultNavActionsSeparatorClassName =
  'mx-2 h-6 w-px shrink-0 self-center bg-border/40 md:mx-3'

/** Desktop nav link row. */
export const portalHeaderNavLinksClassName =
  'flex min-w-0 shrink flex-nowrap items-center gap-4 overflow-x-auto md:gap-5 lg:gap-6'

export const portalHeaderDefaultNavLinksClassName =
  'flex min-w-0 shrink flex-nowrap items-center gap-4 overflow-x-auto md:gap-5 lg:gap-6'

/** Logo + nav + actions cluster on the right half. */
export const portalHeaderNavClusterClassName =
  'hidden min-w-0 flex-1 flex-nowrap items-center justify-end sm:flex'

/** Right-side toolbar: language, theme, notifications, profile. */
export const portalHeaderActionsClassName =
  'flex shrink-0 flex-nowrap items-center gap-2.5 pl-1'

export const portalHeaderIconSlotClassName =
  'inline-flex size-9 shrink-0 items-center justify-center'

export const portalHeaderIconButtonClassName = cn(
  'inline-flex size-9 shrink-0 items-center justify-center rounded-lg p-0',
  'text-slate-300 hover:bg-white/10 hover:text-white',
  '[&_svg]:size-[1.2rem] [&_svg]:shrink-0'
)

export const portalHeaderDefaultDividerClassName =
  'mx-1 h-6 w-px shrink-0 self-center bg-border/40'

export const portalHeaderDefaultActionsClassName =
  'flex shrink-0 flex-nowrap items-center gap-2.5 pl-1'

export const portalHeaderDefaultIconButtonClassName = cn(
  'inline-flex size-9 shrink-0 items-center justify-center rounded-lg p-0',
  'text-muted-foreground hover:bg-muted hover:text-foreground',
  '[&_svg]:size-[1.2rem] [&_svg]:shrink-0'
)

export const portalHeaderNavScrolledClassName = cn(
  'h-12 min-w-0 rounded-2xl border border-white/10 bg-slate-950/75 pr-2 pl-4 shadow-[0_2px_24px_-6px_rgba(0,0,0,0.45)] ring-[0.5px] ring-white/10 backdrop-blur-2xl'
)

/** Icon cluster (language / theme / notifications). */
export const portalHeaderIconGroupClassName = cn(
  'flex shrink-0 flex-nowrap items-center gap-2.5',
  '[&_button]:inline-flex [&_button]:size-9 [&_button]:shrink-0 [&_button]:items-center [&_button]:justify-center',
  '[&_button]:rounded-lg [&_button]:p-0',
  '[&_button]:text-slate-300',
  '[&_button:hover]:bg-white/10 [&_button:hover]:text-white',
  '[&_button_svg]:size-[1.2rem] [&_button_svg]:shrink-0 [&_button_svg]:text-slate-300',
  '[&_button:hover_svg]:text-white',
  '[&_.relative]:inline-flex [&_.relative]:size-9 [&_.relative]:shrink-0 [&_.relative]:items-center [&_.relative]:justify-center'
)

export const portalHeaderDefaultIconGroupClassName = cn(
  'flex shrink-0 flex-nowrap items-center gap-2.5',
  '[&_button]:inline-flex [&_button]:size-9 [&_button]:shrink-0 [&_button]:items-center [&_button]:justify-center',
  '[&_button]:rounded-lg [&_button]:p-0',
  '[&_button]:text-muted-foreground',
  '[&_button:hover]:bg-muted [&_button:hover]:text-foreground',
  '[&_button_svg]:size-[1.2rem] [&_button_svg]:shrink-0',
  '[&_.relative]:inline-flex [&_.relative]:size-9 [&_.relative]:shrink-0 [&_.relative]:items-center [&_.relative]:justify-center'
)

export const portalHeaderNotificationSlotClassName = cn(
  'inline-flex size-9 shrink-0 items-center justify-center overflow-visible',
  '[&_.relative]:overflow-visible'
)

export const portalHeaderProfileSlotClassName = cn(
  'ml-1 inline-flex size-9 shrink-0 items-center justify-center',
  '[&_button]:size-9 [&_button]:shrink-0 [&_button]:p-0',
  '[&_button]:overflow-visible'
)

export const portalHeaderSignInButtonClassName = cn(
  'h-8 rounded-lg border border-white/20 bg-white/10 px-3.5 text-xs font-medium text-slate-100 shadow-none',
  'hover:border-white/30 hover:bg-white/15 hover:text-white'
)

export const portalHeaderMobileMenuButtonClassName = cn(
  'size-9 text-slate-300 hover:bg-white/10 hover:text-white'
)

export const portalHeaderMobileOverlayClassName =
  'bg-slate-950/98 fixed inset-0 z-40 backdrop-blur-2xl'

export const portalHeaderMobileNavLinkClassName =
  'flex items-center gap-3 py-3 text-base font-medium tracking-tight text-slate-200 transition-colors hover:text-white'

export const portalHeaderMobileNavLinkActiveClassName =
  'flex items-center gap-3 py-3 text-base font-semibold tracking-tight text-white'

export const portalHeaderMobileCtaClassName = cn(
  'inline-flex h-10 items-center justify-center rounded-lg border border-cyan-400/50 bg-cyan-600 text-sm font-medium text-white',
  'transition-colors hover:border-cyan-300/60 hover:bg-cyan-500 active:bg-cyan-700'
)

export const portalHeaderSkeletonClassName = 'bg-white/10'
