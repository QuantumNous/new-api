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
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-slate-200 transition-colors duration-200 hover:text-white sm:px-2.5 sm:text-[13px] lg:px-3'

/** Same metrics as inactive — avoids nav group shifting when route changes. */
export const portalHeaderNavLinkActiveClassName =
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-white transition-colors duration-200 sm:px-2.5 sm:text-[13px] lg:px-3'

// —— Shared top nav bar layout (public header + app header) —— //

/** Full-width row; horizontal scroll before any label truncates. */
export const topNavBarRowClassName =
  'relative flex h-full w-full min-w-0 flex-nowrap items-center overflow-x-auto overflow-y-visible'

/** Left brand cluster — never shrink, never truncate platform name. */
export const topNavBrandZoneClassName =
  'relative z-20 flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2.5'

export const topNavBrandSiteNameClassName =
  'text-sm font-semibold tracking-tight whitespace-nowrap'

/** Middle nav column (flex center; may shift when viewport is tight). */
export const topNavCenterZoneClassName =
  'relative z-10 hidden min-w-0 flex-1 justify-center overflow-visible px-1 sm:flex sm:px-2'

/** @deprecated Use topNavCenterZoneClassName */
export const topNavCenterAbsoluteClassName = topNavCenterZoneClassName

/** Five primary links: no clip, no ellipsis. */
export const topNavLinksListClassName =
  'flex shrink-0 flex-nowrap items-center justify-center gap-2 md:gap-3 xl:gap-4'

export const topNavDesktopNavClassName =
  'flex w-full min-w-0 items-center justify-center'

/** Right toolbar (icons, optional search). */
export const topNavRightZoneClassName =
  'relative z-20 ms-auto flex shrink-0 flex-nowrap items-center justify-end gap-2 sm:gap-2.5'

/** Header search: only on very wide viewports; never competes with brand/nav. */
export const topNavSearchSlotClassName =
  'hidden w-[11rem] shrink-0 3xl:block 3xl:w-[12rem]'

/** Between primary nav links and right toolbar (portal). */
export const portalHeaderNavActionsSeparatorClassName =
  'mx-2 h-6 w-px shrink-0 self-center bg-white/15 md:mx-2.5'

export const portalHeaderDefaultNavActionsSeparatorClassName =
  'mx-2 h-6 w-px shrink-0 self-center bg-border/40 md:mx-3'

/** @deprecated Use topNavLinksListClassName — kept for callers migrating off flex-end clusters. */
export const portalHeaderNavLinksClassName = topNavLinksListClassName

export const portalHeaderDefaultNavLinksClassName = topNavLinksListClassName

/** @deprecated Use topNavBarRowClassName + topNavRightZoneClassName. */
export const portalHeaderNavClusterClassName = topNavRightZoneClassName

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

// —— Public portal page shell (pricing / rankings / about) —— //

export const publicPortalPageShellClassName = cn(
  'dark relative min-h-svh overflow-x-clip',
  'bg-gradient-to-b from-slate-950 via-indigo-950/35 to-slate-950 text-slate-100'
)

/** Card surfaces on dark portal pages. */
export const publicPortalCardClassName = cn(
  'overflow-hidden rounded-xl border border-white/10',
  'bg-slate-900/70 shadow-lg shadow-black/25 backdrop-blur-md'
)

/** Descendant overrides for legacy light-theme components inside portal pages. */
export const publicPortalContentScopeClassName = cn(
  '[&_[class*="text-muted-foreground"]]:text-slate-300',
  '[&_.text-foreground]:text-slate-50',
  '[&_.bg-background]:bg-slate-900/75',
  '[&_.bg-card]:border-white/10 [&_.bg-card]:bg-slate-900/85',
  '[&_[class*="bg-muted"]]:bg-white/[0.06]',
  '[&_[class*="border-border"]]:border-white/12',
  '[&_.border-dashed]:border-white/15',
  '[&_input]:border-white/15 [&_input]:bg-slate-950/70 [&_input]:text-slate-50',
  '[&_input::placeholder]:text-slate-400',
  '[&_[data-slot=table]]:text-slate-100',
  '[&_thead]:bg-slate-900/90 [&_thead]:text-slate-200',
  '[&_tbody_tr:hover]:bg-white/[0.06]',
  '[&_[role=tablist]]:border-white/10',
  '[&_.prose]:prose-invert [&_.prose]:text-slate-200'
)

// —— System settings (platform config center) —— //

export const systemSettingsShellClassName =
  'dark min-h-full text-slate-100'

/** Descendant overrides inside /system-settings (forms, tables, sheets). */
export const systemSettingsContentScopeClassName = cn(
  '[&_[class*="text-muted-foreground"]]:text-slate-300',
  '[&_.text-foreground]:text-slate-50',
  '[&_h3]:text-slate-50 [&_h4]:text-slate-100',
  '[&_[data-slot=form-label]]:text-slate-200',
  '[&_[data-slot=form-description]]:text-slate-400',
  '[&_.bg-card]:border-white/12 [&_.bg-card]:bg-slate-900/90 [&_.bg-card]:text-slate-100',
  '[&_.rounded-lg.border]:border-white/12',
  '[&_.bg-background]:bg-slate-900/90',
  '[&_.bg-muted]:bg-white/[0.06]',
  '[&_input:not(:disabled)]:border-white/15 [&_input:not(:disabled)]:bg-slate-950/85 [&_input:not(:disabled)]:text-slate-50',
  '[&_input:disabled]:cursor-not-allowed [&_input:disabled]:border-white/10 [&_input:disabled]:bg-slate-900/55 [&_input:disabled]:text-slate-300',
  '[&_textarea:not(:disabled)]:border-white/15 [&_textarea:not(:disabled)]:bg-slate-950/85 [&_textarea:not(:disabled)]:text-slate-50',
  '[&_textarea:disabled]:cursor-not-allowed [&_textarea:disabled]:border-white/10 [&_textarea:disabled]:bg-slate-900/55 [&_textarea:disabled]:text-slate-300',
  '[&_[data-slot=input-group]]:border-white/15 [&_[data-slot=input-group]]:bg-slate-950/85',
  '[&_[data-slot=input-group-input]:not(:disabled)]:text-slate-50',
  '[&_[data-slot=input-group-input]:disabled]:text-slate-300',
  '[&_[data-slot=input-group-addon]]:text-slate-300',
  '[&_[data-slot=table]]:text-slate-100',
  '[&_thead]:bg-slate-900/95 [&_thead]:text-slate-200',
  '[&_tbody_tr:hover]:bg-white/[0.05]',
  '[&_tr[data-state=selected]]:border-cyan-400/20 [&_tr[data-state=selected]]:bg-cyan-500/12 [&_tr[data-state=selected]]:text-slate-50',
  '[&_tr[data-state=selected]_.text-muted-foreground]:text-slate-200',
  '[&_[data-slot=tabs-list]]:gap-1 [&_[data-slot=tabs-list]]:rounded-xl [&_[data-slot=tabs-list]]:border [&_[data-slot=tabs-list]]:border-white/10 [&_[data-slot=tabs-list]]:bg-slate-900/70 [&_[data-slot=tabs-list]]:p-1',
  '[&_[data-slot=tabs-trigger]]:text-slate-300',
  '[&_[data-slot=tabs-trigger][data-active]]:border [&_[data-slot=tabs-trigger][data-active]]:border-cyan-300/40 [&_[data-slot=tabs-trigger][data-active]]:bg-cyan-400/15 [&_[data-slot=tabs-trigger][data-active]]:text-white',
  '[&_[data-slot=sheet-footer]]:border-white/10 [&_[data-slot=sheet-footer]]:bg-slate-900/95'
)

export const systemSettingsOutlineButtonClassName = cn(
  'border-white/20 bg-slate-900/65 text-slate-100 shadow-sm',
  'hover:border-white/30 hover:bg-white/10 hover:text-white',
  'disabled:pointer-events-none disabled:border-white/10 disabled:bg-slate-900/45 disabled:text-slate-400 disabled:opacity-100'
)

export const systemSettingsPricingPanelClassName = cn(
  'border-white/12 bg-slate-900/90 text-slate-100',
  '[&_[data-slot=sheet-footer]]:bg-slate-900/95'
)

export const systemSettingsPricingTabsListClassName = cn(
  'grid w-full grid-cols-3 gap-1 rounded-xl border border-white/10 bg-slate-900/70 p-1'
)

export const systemSettingsPricingTabsTriggerClassName = cn(
  'text-slate-300 data-active:border data-active:border-cyan-300/40 data-active:bg-cyan-400/15 data-active:text-white'
)
