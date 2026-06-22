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

// —— Authenticated ops console (light daily ops v0) —— //

/** Main content area behind sidebar + pages. */
export const opsConsoleContentShellClassName = cn(
  'bg-gradient-to-br from-[#F8FBFF] via-[#F4F8FD] to-[#EEF6FF] text-slate-800'
)

export const opsConsoleSidebarShellClassName = cn(
  '[&_[data-slot=sidebar-inner]]:border-[#DBEAFE]/80',
  '[&_[data-slot=sidebar-inner]]:bg-[#F8FBFF]',
  '[&_[data-slot=sidebar-inner]]:text-slate-700',
  '[&_[data-sidebar=sidebar][data-mobile=true]]:border-[#DBEAFE]/80',
  '[&_[data-sidebar=sidebar][data-mobile=true]]:bg-[#F8FBFF]',
  '[&_[data-sidebar=sidebar][data-mobile=true]]:text-slate-700'
)

export const opsConsoleSidebarContentClassName = cn(
  'min-h-0 flex-1 overflow-y-auto px-2 py-3',
  '[&_[data-sidebar=group-label]]:text-xs [&_[data-sidebar=group-label]]:font-medium [&_[data-sidebar=group-label]]:tracking-wide [&_[data-sidebar=group-label]]:text-slate-500',
  '[&_[data-sidebar=menu-button]:hover]:bg-blue-50/80 [&_[data-sidebar=menu-button]:hover]:text-slate-900',
  '[&_[data-sidebar=menu-sub]]:border-[#DBEAFE]/70',
  '[&_[data-sidebar=menu-sub-button]]:text-slate-500',
  '[&_[data-sidebar=menu-sub-button]:hover]:bg-blue-50/80 [&_[data-sidebar=menu-sub-button]:hover]:text-slate-800',
  '[&_[data-active=true]]:border [&_[data-active=true]]:border-blue-200/70 [&_[data-active=true]]:border-l-2 [&_[data-active=true]]:border-l-blue-500 [&_[data-active=true]]:bg-blue-50/90 [&_[data-active=true]]:text-blue-700',
  '[&_[data-active=true]]:shadow-none',
  '[&_[data-active=true]_svg]:text-blue-600'
)

export const opsConsoleSidebarHeaderClassName =
  'border-b border-[#DBEAFE]/80 px-2 py-3'

export const opsConsoleSidebarRailClassName = 'hover:after:bg-blue-300/40'

export const opsConsoleHeaderClassName = cn(
  'border-b border-[#DBEAFE]/80 bg-white/98 text-slate-800 shadow-[0_1px_0_0_rgba(219,234,254,0.6)] backdrop-blur-md'
)

export const opsConsoleHeaderTriggerClassName = cn(
  'size-8 shrink-0 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
)

export const opsConsoleHeaderToolbarClassName = cn(
  'flex shrink-0 items-center gap-0.5 rounded-lg border border-[#DBEAFE] bg-white px-1 py-0.5 text-slate-700 sm:gap-1 sm:px-1.5',
  portalHeaderDefaultIconGroupClassName
)

export const opsConsoleHeaderNavLinkClassName = cn(
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13px] font-medium text-slate-600 transition-colors duration-200 hover:bg-blue-50/70 hover:text-blue-700'
)

export const opsConsoleHeaderNavLinkActiveClassName = cn(
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-1.5 text-[13px] font-medium text-blue-700 ring-1 ring-blue-200/70 transition-colors duration-200'
)

export const opsConsoleDashboardShellClassName = cn(
  'flex min-h-full flex-col bg-[#F5F7FA] text-slate-800'
)

export const opsConsoleDashboardOverviewWrapClassName = cn(
  '-mx-1 rounded-2xl border border-[#DBEAFE]/80 bg-white/90 px-1 pb-3 pt-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
)

/** Sticky page footer (pagination) on authenticated section pages. */
export const opsConsolePageFooterClassName = cn(
  'shrink-0 border-t border-[#DBEAFE] bg-[#F8FBFF] px-3 py-2.5 text-slate-600 empty:hidden sm:px-4 sm:py-3'
)

/** Unified section page title row (table/card pages). */
export const opsConsolePageTitleClassName =
  'text-lg font-bold tracking-tight text-slate-900 sm:text-xl'

export const opsConsolePageDescriptionClassName =
  'mt-1 max-w-3xl text-sm leading-relaxed text-slate-600'

export const opsConsolePageHeaderRowClassName =
  'flex flex-wrap items-start justify-between gap-x-4 gap-y-3'

/** Primary CTA on ops pages. */
export const opsConsolePrimaryButtonClassName = cn(
  'border-blue-600 bg-blue-600 text-white shadow-sm',
  'hover:border-blue-700 hover:bg-blue-700',
  'disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400'
)

/** Secondary outline action on ops pages. */
export const opsConsoleSecondaryButtonClassName = cn(
  'border-[#DBEAFE] bg-white text-slate-700 shadow-xs',
  'hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
  'disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400'
)

/** Status / filter pill in overview header. */
export const opsConsoleHeaderPillClassName = cn(
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DBEAFE] bg-white px-3 text-sm font-medium text-slate-700 shadow-xs'
)

export const opsConsoleHeaderPillActiveClassName = cn(
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-700 shadow-xs'
)

/** Large white card shell for overview sections. */
export const opsConsoleOverviewCardClassName = cn(
  'overflow-hidden rounded-2xl border border-[#DBEAFE]/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]'
)

export const opsConsoleOverviewCardHeaderClassName = cn(
  'flex flex-wrap items-center justify-between gap-2 border-b border-[#DBEAFE]/70 px-4 py-3 sm:px-5'
)

export const opsConsoleOverviewCardTitleClassName =
  'text-sm font-semibold text-slate-900'

export const opsConsoleOverviewCardDescriptionClassName =
  'text-xs text-slate-500'

export const opsConsoleOverviewLinkClassName =
  'inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline'

// —— Shared DataTable / filter tokens (keys, channels, users, usage-logs) —— //

export const opsConsoleFilterToolbarClassName = cn(
  '[&_input]:border-[#DBEAFE] [&_input]:bg-white [&_input]:text-slate-800',
  '[&_input::placeholder]:text-slate-400',
  '[&_button]:border-[#DBEAFE] [&_button]:bg-white [&_button]:text-slate-700',
  '[&_button_svg]:text-slate-500',
  '[&_button:hover]:border-blue-200 [&_button:hover]:bg-blue-50 [&_button:hover]:text-blue-700',
  '[&_button:hover_svg]:text-blue-600'
)

export const opsConsoleTableHeaderClassName = cn(
  'sticky top-0 z-10 border-b border-[#DBEAFE] bg-[#F4F8FD]',
  '[&_th]:text-slate-700',
  '[&_th_button]:font-medium [&_th_button]:text-slate-700',
  '[&_th_button:hover]:bg-blue-50 [&_th_button:hover]:text-blue-700',
  '[&_th_svg]:text-slate-500',
  '[&_[data-slot=checkbox]]:border-slate-300'
)

export const opsConsoleTableShellClassName = cn(
  'border-[#DBEAFE] bg-white text-slate-800',
  '[&_[data-slot=empty-title]]:text-slate-800',
  '[&_[data-slot=empty-description]]:text-slate-500',
  '[&_[data-slot=empty-icon]]:text-slate-400',
  '[&_[data-slot=table-row]:hover]:!bg-[#EFF6FF]',
  '[&_[data-slot=table-cell]]:text-slate-800',
  '[&_.text-muted-foreground]:text-slate-500',
  '[&_[data-slot=checkbox]]:border-slate-300'
)

export const opsConsoleTableBodyRowClassName = cn(
  'border-b border-[#DBEAFE]/80 transition-colors',
  'hover:!bg-[#EFF6FF]',
  'data-[state=selected]:!bg-blue-50',
  'data-[state=selected]:hover:!bg-blue-100/60',
  'data-[state=selected]:!text-slate-900'
)

export const opsConsoleTableSelectedRowClassName = cn(
  'data-[state=selected]:!bg-blue-50',
  'data-[state=selected]:hover:!bg-blue-100/60',
  'data-[state=selected]:!text-slate-900',
  'data-[state=selected]:ring-1 data-[state=selected]:ring-blue-200/80',
  '[&[data-state=selected]_.text-muted-foreground]:!text-slate-500',
  '[&[data-state=selected]_[data-slot=checkbox]]:border-blue-400/60'
)

export const opsConsoleTableStickyActionsHeaderClassName = cn(
  '[&_th:last-child]:sticky [&_th:last-child]:right-0 [&_th:last-child]:z-20',
  '[&_th:last-child]:border-l [&_th:last-child]:border-[#DBEAFE]',
  '[&_th:last-child]:bg-[#F4F8FD]',
  '[&_th:last-child]:shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.06)]'
)

export const opsConsoleTableStickyActionsCellClassName = cn(
  '[&_td:last-child]:sticky [&_td:last-child]:right-0 [&_td:last-child]:z-10',
  '[&_td:last-child]:border-l [&_td:last-child]:border-[#DBEAFE]',
  '[&_td:last-child]:bg-white',
  '[&_td:last-child]:shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.06)]',
  '[&_[data-slot=table-row][data-state=selected]_td:last-child]:!bg-blue-50',
  '[&_[data-slot=table-row]:hover_td:last-child]:bg-[#EFF6FF]'
)

export const opsConsoleCardClassName =
  'overflow-hidden rounded-lg border border-[#DBEAFE] bg-white'

export const opsConsoleOutlineButtonClassName = cn(
  'border-[#DBEAFE] bg-white text-slate-700 shadow-none',
  'hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
  'disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-60'
)

export const opsConsoleMutedLabelClassName =
  'text-xs font-medium tracking-wider text-slate-500 uppercase'

export const opsConsoleDropdownMenuContentClassName = cn(
  'border border-[#DBEAFE] bg-white text-slate-800 shadow-lg ring-1 ring-blue-100/50'
)

export const opsConsoleDropdownMenuItemClassName =
  'text-slate-700 focus:bg-blue-50 focus:text-blue-700'

export const opsConsoleGhostIconButtonClassName = cn(
  'text-slate-600 hover:bg-blue-50 hover:text-blue-700',
  'disabled:text-slate-400'
)

// —— System settings (platform config center) —— //

export const systemSettingsShellClassName = cn(
  'min-h-full bg-gradient-to-br from-[#F8FBFF] via-[#F4F8FD] to-[#EEF6FF] text-slate-800'
)

/** Light ops shell for platform config center (forms keep native card styles). */
export const systemSettingsContentScopeClassName = cn(
  '[&_[class*="text-muted-foreground"]]:text-slate-500',
  '[&_.text-foreground]:text-slate-900',
  '[&_h3]:text-slate-900 [&_h4]:text-slate-800',
  '[&_[data-slot=form-label]]:text-slate-700',
  '[&_[data-slot=form-description]]:text-slate-500',
  '[&_.bg-card]:border-[#DBEAFE]/80 [&_.bg-card]:bg-white [&_.bg-card]:text-slate-800',
  '[&_.rounded-lg.border]:border-[#DBEAFE]/80',
  '[&_.bg-background]:bg-white',
  '[&_.bg-muted]:bg-[#F8FBFF]',
  '[&_input:not(:disabled)]:border-[#DBEAFE] [&_input:not(:disabled)]:bg-white [&_input:not(:disabled)]:text-slate-800',
  '[&_input:disabled]:cursor-not-allowed [&_input:disabled]:border-slate-200 [&_input:disabled]:bg-slate-50 [&_input:disabled]:text-slate-400',
  '[&_textarea:not(:disabled)]:border-[#DBEAFE] [&_textarea:not(:disabled)]:bg-white [&_textarea:not(:disabled)]:text-slate-800',
  '[&_textarea:disabled]:cursor-not-allowed [&_textarea:disabled]:border-slate-200 [&_textarea:disabled]:bg-slate-50 [&_textarea:disabled]:text-slate-400',
  '[&_[data-slot=input-group]]:border-[#DBEAFE] [&_[data-slot=input-group]]:bg-white',
  '[&_[data-slot=table]]:text-slate-800',
  '[&_thead]:bg-[#F4F8FD] [&_thead]:text-slate-700',
  '[&_tbody_tr:hover]:bg-[#EFF6FF]',
  '[&_tr[data-state=selected]]:border-blue-200 [&_tr[data-state=selected]]:bg-blue-50 [&_tr[data-state=selected]]:text-slate-900',
  '[&_[data-slot=tabs-list]]:gap-1 [&_[data-slot=tabs-list]]:rounded-xl [&_[data-slot=tabs-list]]:border [&_[data-slot=tabs-list]]:border-[#DBEAFE] [&_[data-slot=tabs-list]]:bg-[#F8FBFF] [&_[data-slot=tabs-list]]:p-1',
  '[&_[data-slot=tabs-trigger]]:text-slate-600',
  '[&_[data-slot=tabs-trigger][data-active]]:border [&_[data-slot=tabs-trigger][data-active]]:border-blue-200 [&_[data-slot=tabs-trigger][data-active]]:bg-white [&_[data-slot=tabs-trigger][data-active]]:text-blue-700',
  '[&_[data-slot=sheet-footer]]:border-[#DBEAFE] [&_[data-slot=sheet-footer]]:bg-[#F8FBFF]'
)

export const systemSettingsOutlineButtonClassName = opsConsoleOutlineButtonClassName

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

// —— Auth / sign-in (light ops console, matches authenticated shell) —— //

export const opsAuthPageShellClassName = cn(
  'relative flex min-h-svh flex-col',
  'bg-gradient-to-br from-[#F8FBFF] via-[#F4F8FD] to-[#EEF6FF] text-slate-800',
  'lg:grid lg:grid-cols-2 lg:gap-0'
)

export const opsAuthBrandTitleClassName =
  'text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl'

export const opsAuthBrandDescriptionClassName =
  'text-sm leading-relaxed text-slate-600 sm:text-base'

export const opsAuthCapabilityItemClassName = cn(
  'flex items-start gap-3 rounded-xl border border-[#DBEAFE] bg-white/80 px-4 py-3 shadow-sm'
)

export const opsAuthCapabilityIconClassName =
  'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600'

export const opsAuthCapabilityLabelClassName =
  'text-sm leading-snug text-slate-700'

export const opsAuthCardClassName = cn(
  'border-[#DBEAFE]/80 bg-white shadow-lg shadow-blue-950/5',
  'ring-1 ring-blue-100/60'
)
