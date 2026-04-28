# TODO

## HeroUI Migration

- [x] Start local dev environment at `http://localhost:5173/`.
- [x] Refresh current Semi compatibility wrapper inventory.
- [x] Continue migrating low-risk settings containers away from `@/components/ui/semi`.
- [x] Re-scan remaining Semi wrapper imports after each migration batch.
- [x] Verify frontend build or targeted lint before handoff.
- [x] Migrate second low-risk batch: `ParamOverrideEntry`, `ThinkingContent`, `ImageUrlInput`, `ModelPricingCombined`, `ChatsSetting`.
- [x] Migrate third low-risk settings batch: `DashboardSetting`, `ModelDeploymentSetting`, `OperationSetting`.
- [x] Migrate personal settings batch: `PreferencesSettings`, `EmailBindModal`, `WeChatBindModal`, `ChangePasswordModal`, `PersonalSetting`.
- [x] Migrate fifth low-risk batch: `AccountDeleteModal`, `UserInfoHeader`, and native language selector cleanup in `PreferencesSettings`.
- [x] Migrate playground batch: `ConfigManager`, `CustomRequestEditor`.
- [x] Migrate SSE viewer: `SSEViewer`.
- [x] Migrate playground controls: `ParameterControl`, `SettingsPanel`.
- [x] Complete playground direct migration: `DebugPanel`, `ChatArea`, `MessageContent`, `pages/Playground/index.jsx`.
- [x] Remove playground Semi token references: `CodeViewer`, `CustomInputRender`.
- [x] Complete settings direct migration: settings files now import Hero compatibility entrypoints instead of `@/components/ui/semi*`.
- [x] Remove settings Semi token references.
- [x] Complete table direct migration: table files now import Hero compatibility entrypoints instead of `@/components/ui/semi*`.
- [x] Remove table and table-hook Semi token references.
- [x] Complete other business migration: `topup` and `helpers` now import Hero compatibility entrypoints.
- [x] Remove all remaining Semi token references.
- [x] Delete unused deep typography shims under `web/src/components/ui/semi/lib/es/typography/`.
- [x] Start true HeroUI cleanup: `SubscriptionPlansCard` no longer uses `HeroCompat` and now uses HeroUI `Card.Content`, `Chip`, `Separator`, native select, and lightweight skeletons.
- [x] Continue pricing cleanup: `PricingCardSkeleton`, `PricingCardView`, and `FilterModalFooter` moved away from old Skeleton/Tag/Button props.
- [x] Fix console layout root causes: Console pages hide footer, main content scrolls, Console routes remount by path/search, settings tabs use controlled native buttons.
- [x] Rewrite Operation/SettingsHeaderNavModules + SettingsSidebarModulesAdmin to native HeroUI v3 (CSS Grid, native Switch+Control+Thumb, Button isPending).
- [x] Fix semi.js Spin/Switch/Col/Form/Banner compat bugs that were silently breaking page layouts (collapsed grids, invisible toggles, missing banner descriptions, infinite re-render loops).
- [x] Stabilize useTableFilterForm api ref to fix infinite update loop on /console/token.
- [x] Map semi-icons string sizes (small/default/large) to numeric pixels (fixed giant warning triangle on /console/models).
- [x] Rewrite Operation tab batch (SettingsCheckin, SettingsCreditLimit, SettingsLog, SettingsSensitiveWords, SettingsMonitoring, HttpStatusCodeRulesInput) to native HeroUI v3.
- [x] Rewrite Dashboard tab (SettingsDataDashboard) and Drawing tab (SettingsDrawing) to native HeroUI v3.
- [x] Rewrite RateLimit tab (SettingsRequestRateLimit) to native HeroUI v3.
- [x] Rewrite Payment tab batch (SettingsGeneralPayment, SettingsPaymentGateway easy-pay, SettingsPaymentGatewayStripe) to native HeroUI v3.
- [x] Rewrite Model tab batch (SettingGlobalModel, SettingGeminiModel, SettingClaudeModel, SettingGrokModel) and Model Deployment (SettingModelDeployment) to native HeroUI v3.
- [x] Rewrite Operation/SettingsGeneral (额度展示类型 + currency exchange combined control) to native HeroUI v3.
- [x] Rewrite ModelHeader / ModelEndpoints / ModelBasicInfo (model-pricing detail subviews) to native HeroUI v3 + lucide.
- [x] Rewrite ChannelsTabs / ModelsTabs to native pill-style tabs with action menus and ConfirmDialog instead of Semi Tabs/Dropdown/Modal.confirm.
- [x] Rewrite SelectionNotification: replace Semi Notification with a fixed bottom-anchored bar.
- [x] Rewrite small modals to native v3 Modal: BatchTagModal, ConfirmationDialog (model-deployments), SyncWizardModal, MissingModelsModal, EditVendorModal, PricingFilterModal.
- [x] Rewrite channels/index, models/index, subscriptions/index to drop Banner/Modal compat (use Tailwind warning panels + ConfirmDialog).
- [x] Rewrite AutoGroupList (Ratio/components) to native HTML datalist + lucide buttons + window.confirm.
- [x] Rewrite GroupTable (Ratio/components) to native inputs + Tailwind + lucide.
- [x] Rewrite ModelDetailSideSheet to a native fixed-position aside panel with backdrop.
- [x] Rewrite PrefillGroupManagement to a native fixed left-side panel + ConfirmDialog.
- [x] Rewrite Codex/SingleModel/EditDeployment modals to native HeroUI v3 Modal anatomy.
- [x] Rewrite GroupGroupRatioRules + GroupSpecialUsableRules (Ratio/components) to native datalist + lucide buttons + window.confirm.
- [x] Rewrite AddUserModal (table/users) to a native fixed left-side panel.
- [x] Rewrite ModelsActions to drop Modal/Popover/RadioGroup compat (uses ConfirmDialog, custom HoverPopover, Button isPending).
- [x] Inline Tag/Avatar/Typography/Toast wrappers in helpers/render.jsx and helpers/utils.jsx (removes 2 high-fanout HeroCompat imports — 6 files dropped from compat in one shot).
- [x] Rewrite ModelPricingTable (model-pricing detail) to native HTML table + Tailwind chips.
- [x] Rewrite ChannelsActions (batch operations) to ConfirmDialog + ClickDropdown + lucide ChevronDown.
- [x] Rewrite UsersColumnDefs to native chips + HoverPanel + ClickMenu (drops Space/Tag/Progress/Popover/Typography/Dropdown/IconMore from compat in one shot).
- [x] Rewrite SubscriptionsColumnDefs to native chips + HoverPanel + ConfirmDialog (drops Modal/Tag/Typography/Popover/Divider/Space from compat).
- [x] Extract HoverPanel and ClickMenu shared components (`web/src/components/common/ui/HoverPanel.jsx`, `ClickMenu.jsx`) so future column defs can reuse without duplicating.
- [x] Rewrite ModelsColumnDefs to native StringTag/ConfirmDialog/CopyableText (drops Space/Tag/Typography/Modal from compat).
- [x] Rewrite Ratio/ModelRatioSettings (8 JSON textareas + reset model ratio confirm) to native textarea + Switch + ConfirmDialog (drops Form/Col/Row/Spin/Popconfirm/Space from compat).
- [x] Rewrite PricingTableColumns to native chips + lucide HelpCircle (drops Tag/Space/IconHelpCircle from compat).
- [x] Rewrite ChannelUpstreamUpdateModal to native v3 Modal anatomy + custom pill-style tabs + native checkbox grid + ConfirmDialog (drops Modal/Checkbox/Empty/Tabs/Typography/IconSearch/Illustrations from compat).
- [x] Rewrite UpstreamConflictModal (model conflict resolution table) to native HTML table with sticky-left model column, per-column header checkboxes (with `indeterminate` ref), HoverPanel for diff content, and a simple Pager (drops Modal/Table/Checkbox/Empty/Tag/Popover/Typography/Illustrations from compat).
- [x] Rewrite EditPrefillGroupModal (left-side panel) to native fixed aside + custom TagInput (Backspace removal, comma/Enter commit, click X to remove tag) + native select for type (drops SideSheet/Form/Tag/Spin/Avatar/Row/Col + Form.TagInput from compat).
- [x] Rewrite UserBindingManagementModal to native v3 Modal anatomy + Spinner + ConfirmDialog (drops Modal/Spin/Typography/Checkbox/Tag/IconLink/IconMail/IconDelete/IconGithubLogo from compat).
- [x] Rewrite UserSubscriptionsModal to right-side panel + native select + ConfirmDialog (keeps CardTable for now; drops SideSheet/Modal/Empty/Tag/Typography/Space/IconPlusCircle/Illustrations).
- [x] Rewrite CheckinCalendar with custom MonthCalendar (7-col grid, prev/next/today nav, today pill, dateRender callback) + ConfirmDialog-style Modal for Turnstile (drops Calendar/Spin/Collapsible/Avatar/Typography/Modal from compat).
- [x] Rewrite EditRedemptionModal (left/right side panel) to native fixed aside + custom NumberField with prefix slot + native datetime-local input + ConfirmDialog for post-create download (drops SideSheet/Modal/Form/Spin/Tag/Typography/Avatar/Row/Col/InputNumber/IconCreditCard/IconSave/IconClose/IconGift from compat).
- [x] Rewrite ChannelSelectorModal (settings) to v3 Modal + native HTML table with HighlightText (mark element), HeaderCheckbox (indeterminate ref), simple per-page pager + page size select (drops Modal/Table/Space/Highlight/Tag/IconSearch from compat).
- [x] Rewrite SettingsPaymentGatewayCreem (Payment tab) to native HeroUI v3: 3-col grid + product table with v3 Modal for add/edit (drops Form/Avatar/Typography/Tag/Modal/Table/InputNumber/IconCoinMoneyStroked from compat).
- [x] Rewrite SettingsFAQ (Dashboard tab) to native HTML table + HeaderCheckbox + ConfirmDialog + v3 Modal for add/edit (drops Space/Table/Form/Typography/Empty/Divider/Modal/Illustrations from compat).
- [x] Rewrite SettingsPaymentGatewayWaffoPancake (Payment tab) to native v3 Switch+Field grid (3+3+2+2+2 column layout, multi-environment webhook keys, sandbox toggle) (drops Banner/Col/Form/Row/Spin from compat).
- [x] Rewrite SettingsUptimeKuma (Dashboard tab) to native HTML table + HeaderCheckbox + ConfirmDialog + v3 Modal (drops Space/Table/Form/Typography/Empty/Divider/Modal/Illustrations from compat).
- [x] Rewrite SettingsAPIInfo (Dashboard tab) to native HTML table + custom ColorChip/ColorDot palette + HeaderCheckbox + ConfirmDialog + v3 Modal (drops Space/Table/Form/Typography/Empty/Divider/Avatar/Modal/Tag/Illustrations from compat).
- [x] Rewrite SettingsAnnouncements (Dashboard tab) to native HTML table + TypeChip + datetime-local input + 2 v3 Modals (edit + content fullscreen) + ConfirmDialog (drops Space/Table/Form/Typography/Empty/Divider/Modal/Tag/TextArea/Illustrations from compat).
- [x] Rewrite TaskLogsColumnDefs (task logs columns) and MjLogsColumnDefs (Midjourney logs columns) to native ColorTag/ProgressBar/EllipsisText/UserChip helpers with 16-color palette and lucide icon prefixes (drops Progress/Tag/Typography/Avatar/Space from compat across both files).
- [x] Rewrite TokensColumnDefs (tokens columns) to native Chip/ProgressBar/HoverPanel/ClickMenu/ConfirmDialog primitives with show-hide token key cell, vendor avatar pills, split chat menu, and inline copy popover (drops Dropdown/Space/SplitButtonGroup/Tag/AvatarGroup/Avatar/Progress/Popover/Typography/Modal + IconTreeTriangleDown/IconCopy/IconEyeOpened/IconEyeClosed from compat).
- [x] Rewrite UsageLogsColumnDefs (usage logs columns) to native ColorTag/UserChip/EllipsisText/HoverPanel primitives with channel-affinity sparkles overlay, stream-status alert overlay, model-mapped popover, cache-summary subtitle, and segment-style detail summary (drops Avatar/Space/Tag/Popover/Typography + IconHelpCircle from compat).
- [x] Rewrite tokens/index (FluentRead detection notice) without HeroCompat: Notification.info popup is replaced by a controlled top-right `FluentNoticePanel` (HeroUI Button + native `<select>` for parity with CCSwitchModal), Notification.close lifecycle becomes plain React state, and Toast/showInfo helpers replace the leftover Toast.success / Notification.close calls (drops Notification/Space/Toast/Typography + Select compat usage from the file).
- [x] Rewrite PricingTable (model-pricing detail table view) to native HTML table without HeroCompat: native thead + tbody, optional row-selection column with HeaderCheckbox + indeterminate ref, sticky-right anchoring honoured for the price column outside compact mode, mobile path delegates to shared CardTable; pagination uses HeroUI Button + native page-size select with rolling page slicing driven by `currentPage`/`pageSize` from `useModelPricingData` (drops Table compat from PricingTable.jsx — last surface in the model-pricing area still on HeroCompat).

## Current Hotspots

- `settings`: largest remaining page-level area, especially form-heavy settings pages.
- `table`: many modals and column definition files still use compatibility wrappers.
- `playground`: smaller but still has `Typography`, `Tabs`, `Dropdown`, `Collapse`, and token remnants.

## Next Migration Candidates

- `web/src/components/settings/{DashboardSetting,ModelDeploymentSetting,OperationSetting}.jsx`: low-risk container files that mainly depend on `Spin`.
- `web/src/pages/Setting/{Drawing,Performance,RateLimit}/...`: form pages still use `Form`, `Row`, `Col`, `Spin`, and `Tag`.
- `web/src/components/table/{channels,models}/...`: high-impact table and modal area, but should be migrated in smaller batches.

## Latest Inventory

- Wrapper imports: `other 3` (Hero compatibility bridge files only).
- Playground wrapper imports: `0`.
- Playground Semi token references: `0`.
- Settings wrapper imports: `0`.
- Settings Semi token references: `0`.
- Table wrapper imports: `0`.
- Table Semi token references: `0`.
- Business wrapper imports: `0`.
- Semi token references: `0`.
- Semi token references: `playground 4`, `settings 16`, `table 31`, `hooks 1`, `other 5`.

## Verification

- `bun run build`: passed.
- `curl -I http://localhost:5173/`: returned `200 OK`.
- `npx -y react-doctor@latest . --verbose --diff`: completed with existing project findings; score `75 / 100`, with 21 errors and 521 warnings across the broader changed tree.
- `bun run build` after second migration batch: passed.
- `bun run build` after third migration batch: passed.
- `bun run build` after personal settings batch: passed.
- `bun run build` after fifth migration batch: passed.
- `bun run build` after playground batch: passed.
- `bun run build` after SSE viewer migration: passed.
- `bun run build` after playground controls migration: passed.
- `bun run build` after completing playground migration: passed.
- `bun run build` after settings migration: passed.
- `curl -I http://localhost:5173/` after settings migration: returned `200 OK`.
- `bun run build` after table migration: passed.
- `curl -I http://localhost:5173/` after table migration: returned `200 OK`.
- `bun run build` after other migration: passed.
- `bun run build` after deleting unused shims: passed.
- `curl -I http://localhost:5173/` after final cleanup: returned `200 OK`.
- `bun run build` after `SubscriptionPlansCard` HeroUI cleanup: passed.
- `bun run build` after pricing card cleanup: passed.
- Console route/sidebar and settings tab navigation verified with Playwright.
- After Operation/Dashboard/Drawing/RateLimit/Payment/Model/General rewrites: 88 files still importing HeroCompat (down from 106), `bun run build` passes, all settings tabs render correctly with Playwright (Operation/Models/Model Deployment/Payment/Stripe verified).
- After table modal/index/tabs rewrites: 72 files still importing HeroCompat (down from 85), `bun run build` passes, /console/models tabs + 新增供应商 modal verified, /console/channel tabs verified, /console/subscription verified.
- After ModelDetailSideSheet / GroupTable / PrefillGroupManagement / CodexOAuth / SingleModelSelect / EditDeployment rewrites: 66 files still importing HeroCompat, `bun run build` passes, /pricing renders, /console/setting?tab=ratio (分组相关设置) renders, /console/models 预填组管理 modal renders.
- After GroupGroupRatioRules / GroupSpecialUsableRules / AddUserModal / ModelsActions / helpers (utils + render) rewrites: 60 files still importing HeroCompat (down from 106 originally), `bun run build` passes, /console (dashboard with renderModelTag), /console/token (renderGroup tag) verified.
- After ChannelsActions / ModelPricingTable / UsersColumnDefs / SubscriptionsColumnDefs rewrites: 56 files still importing HeroCompat (down ~47% from 106 originally). `bun run build` passes. /console/channel and /console/user (with custom HoverPanel popovers) and /console/subscription verified.
- After extracting HoverPanel + ClickMenu shared components, rewriting ModelsColumnDefs and ModelRatioSettings: 54 files still importing HeroCompat (down ~49% from 106 originally). `bun run build` passes. /console/setting?tab=ratio (手动编辑 mode) and /console/models verified.
- After PricingTableColumns / ChannelUpstreamUpdateModal / UpstreamConflictModal / EditPrefillGroupModal rewrites: 50 files still importing HeroCompat (53% complete). `bun run build` passes. /console/models 预填组管理 → 新建组 modal verified to open with new TagInput / select / textarea form.
- After UserBindingManagementModal / UserSubscriptionsModal / CheckinCalendar (custom MonthCalendar) rewrites: 47 files still importing HeroCompat (~56% complete). `bun run build` passes. /console/personal renders correctly.
- After EditRedemptionModal / ChannelSelectorModal / SettingsPaymentGatewayCreem rewrites: 44 files still importing HeroCompat (~58% complete). `bun run build` passes. /console/setting?tab=payment → Creem 设置 verified.
- After SettingsFAQ + SettingsPaymentGatewayWaffoPancake rewrites: 42 files still importing HeroCompat (~60% complete). `bun run build` passes. /console/setting?tab=dashboard with FAQ panel verified.
- After SettingsUptimeKuma + SettingsAPIInfo + SettingsAnnouncements rewrites (3 of the 4 dashboard CRUD tables follow same pattern): 39 files still importing HeroCompat (~63% complete). `bun run build` passes. /console/setting?tab=dashboard verified — all 3 inline panels (Announcements/FAQ/UptimeKuma/APIInfo) render with new HTML tables, pagination, switch toggles.
- After TaskLogsColumnDefs + MjLogsColumnDefs rewrites: 37 files still importing HeroCompat (~65% complete). `bun run build` passes. /console/task and /console/midjourney render correctly.
- After TokensColumnDefs rewrite: 36 files still importing HeroCompat (~66% complete). `bun run build` passes. /console/token renders with new token key show/hide + copy menu + chat split menu + delete confirm.
- After UsageLogsColumnDefs rewrite: 35 files still importing HeroCompat (~67% complete). `bun run build` passes. /console/log renders with new ColorTag/UserChip/EllipsisText/HoverPanel primitives; HMR reloaded both UsageLogsTable and TokensTable cleanly.
- After tokens/index FluentNoticePanel rewrite: 34 files still importing HeroCompat (~68% complete). `bun run build` passes. /console/token loads without errors; FluentRead notice is now a controlled top-right panel that auto-shows when the `#fluent-new-api-container` MutationObserver fires and dismisses cleanly via either `setFluentNoticeOpen(false)` or the local `不再提醒` suppression flag.
- After PricingTable rewrite: 33 files still importing HeroCompat (~69% complete). `bun run build` passes. /pricing 表格视图 verified: header checkbox + column headers (模型名称 / 供应商 / 描述 / 标签 / 计费类型 / 可用端点类型 / 模型价格) render with native `<table>`; empty-state Inbox card centred; no new console errors.

## Console Style Migration from heroui-pro/template-dashboard

- [x] Strip body radial-gradient background; body now matches template's flat `var(--background)`.
- [x] Bring DashboardHeader greeting in line with template navbar title (`text-xl font-semibold text-foreground` + `truncate`).
- [x] Replace literal grays in dashboard panels with semantic HeroUI tokens (`text-foreground`, `text-muted`, `text-primary`, `border-border`, `bg-surface-secondary`).
- [x] Drop `!font-bold` on API route label in `ApiInfoPanel`; use template's `font-semibold` weight instead.
- [x] Add `tabular-nums` + semantic color to KPI numbers in `StatsCards` to match template KPI styling.
- [x] `bun run build` passed after style migration.

### Sidebar (follow-up after first round of feedback)
- [x] Drop `sidebar-shell` glassmorphism + heavy box-shadow + backdrop-blur; sidebar now uses flat `bg-background border-r border-border` like template.
- [x] Replace uppercase tracking-wide section headers with quiet `text-xs text-muted` labels.
- [x] Menu items: `rounded-2xl` → `rounded-md`, `font-semibold` → `font-medium`, slate colors → semantic `text-foreground`/`text-muted`, primary tinted active state → `bg-surface-secondary`.
- [x] Add template-style header block (avatar + display name + role) at top of sidebar.
- [x] Simplify collapse button (drop bordered/backdrop-blur styling, use ghost variant).

## Header Navbar Rebuild (feature/header-navbar-rebuild)

- [x] Adopt `@heroui-pro/react` `Navbar` as the headerbar root: `Navbar.Header`, `Navbar.Brand`, `Navbar.Content`, `Navbar.Spacer`, `Navbar.Item`, `Navbar.MenuToggle`, `Navbar.Menu`, `Navbar.MenuItem`.
- [x] Wire `navigate` prop to `react-router` so `Navbar.Item` performs client-side navigation and external links open in a new tab.
- [x] Refactor `Navigation.jsx` to render desktop nav links via `Navbar.Item` with `isCurrent` derived from `useLocation()`.
- [x] Add `MobileNavMenu.jsx` rendering `Navbar.Menu` / `Navbar.MenuItem` for non-console mobile routes; the existing `MobileMenuButton` (sidebar drawer trigger) still owns the console-mobile case.
- [x] Convert `ActionButtons.jsx` to a fragment so `Navbar.Content` (the new flex parent) controls spacing.
- [x] Add `Navbar.MenuToggle` only on non-console routes (md:hidden) so the hamburger never overlaps the sidebar drawer trigger.
- [x] Localize new strings `主导航` and `打开菜单` across `zh-CN`, `zh-TW`, `en`, `fr`, `ja`, `ru`, `vi`.
- [x] `bun run build` passes after the rebuild.

### Follow-ups
- [ ] Manual QA pass on responsive breakpoints (xs/sm/md), console + non-console routes, and the mobile menu open/close animation while the sidebar drawer is also available.
- [ ] Verify `hideOnScroll` is intentionally off — current layout pins the header inside `Sidebar.Provider`'s flex column, so sticky/scroll-hide does not apply.

### Next steps
- [ ] Visual QA all `/console` sub-pages in light + dark themes; capture before/after.
- [ ] Consider centering page content with `max-w-7xl mx-auto` like template (currently console pages stretch full width).
- [x] Audit remaining literal `text-gray-*` / `text-slate-*` usages elsewhere under `/console` (channels/user/log/topup/setting tables) and replace with semantic tokens in a follow-up pass.

## Console Literal Color Audit (4 commits)

Standardized literal slate/gray ramps across the entire `/console` surface to
the HeroUI semantic tokens (`bg-background`, `bg-surface-secondary`,
`text-foreground`, `text-muted`, `border-border`, `bg-border`,
`bg-foreground text-background` for active pills, `border-border bg-background
... focus:border-primary` for inline inputs, `bg-muted` for neutral status
dots).

Patterns standardized:
- `bg-white/95 ... dark:bg-slate-950/95` → `bg-background/95 backdrop-blur`
- `border-slate-200/80 dark:border-white/10` → `border-border`
- `bg-slate-100/200 dark:bg-slate-800/900` → `bg-surface-secondary`
- `bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500`
  → `bg-surface-secondary text-muted`
- `text-slate-500/600 dark:text-slate-300/400` → `text-muted`
- `text-slate-700/800/900 dark:text-slate-100/200` → `text-foreground`
- `bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900`
  → `bg-foreground text-background`
- `bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200` (chips,
  table cells, inline pills) → `bg-background text-foreground`
- `border-slate-200 bg-white ... focus:border-sky-400 dark:border-slate-700
  dark:bg-slate-900` (inline selects, datetime inputs, single-line editors)
  → `border-border bg-background ... focus:border-primary`
- `text-gray-400/500/600/700/900` → `text-muted` / `text-foreground`
- `bg-gray-50 / bg-gray-50/50` → `bg-surface-secondary` / `bg-surface-secondary/50`
- `border-gray-100/200/300` → `border-border`
- `hover:bg-gray-50` / `hover:bg-slate-100 dark:hover:bg-slate-800` →
  `hover:bg-surface-secondary`

Commits:

1. `refactor(console): swap literal slate/gray tones for semantic tokens`
   - TokensColumnDefs (TONE_CLASSES grey/black/white, CopyableLine hover,
     ProgressBar, VendorAvatar, quota usage capsule).
   - helpers/dashboard.jsx renderMonitorList (illustration tile, monitor
     row hover, name/uptime/status, divider, uptime track + tabular-nums).

2. `refactor(console): swap literal slate/gray tones for semantic tokens
   (table + common/ui)`
   - Column defs: UsersColumnDefs, ChannelsColumnDefs (IO.NET tooltip),
     SubscriptionsColumnDefs, DeploymentsColumnDefs, MjLogsColumnDefs (and
     MjLogsActions), UsageLogsColumnDefs.
   - Shared common/ui: CardPro, CardTable, ColumnSelectorDialog,
     ConfirmDialog, HoverPanel, TableEmptyState, RenderUtils,
     TableFilterForm (FilterInput / FilterSelect / FilterDateRange).

3. `refactor(console): swap literal slate/gray tones for semantic tokens
   (topup + common)`
   - Topup: InvitationCard, RechargeCard, SubscriptionPlansCard,
     index (Creem confirm modal), PaymentConfirmModal,
     SubscriptionPurchaseModal, TopupHistoryModal, TransferModal.
   - Common: DocumentRenderer, MarkdownRenderer.PreCode,
     RiskAcknowledgementModal, SecureVerificationModal, ChannelKeyDisplay,
     ClickMenu, ColumnSelectorDialog, JSONEditor, SelectableButtonGroup.

4. `refactor(console): swap literal slate/gray tones for semantic tokens
   (table modals + settings + setup)` — 76 jsx files
   - Side panels: AddUserModal, EditPrefillGroupModal,
     PrefillGroupManagement, EditRedemptionModal, ModelDetailSideSheet,
     UserSubscriptionsModal.
   - Tabs / dropdowns / actions: ChannelsActions, ChannelsTabs,
     ModelsActions, ModelsTabs, SelectionNotification.
   - Table modals: BatchTagModal, ChannelUpstreamUpdateModal,
     CodexOAuthModal, EditChannelModal (14 inline literals), EditTagModal,
     SingleModelSelectModal, mj-logs ContentModal, AudioPreviewModal,
     task-logs ContentModal, CopyTokensModal, EditTokenModal,
     CCSwitchModal, EditModelModal, EditVendorModal, MissingModelsModal,
     SyncWizardModal, UpstreamConflictModal, AddEditSubscriptionModal,
     ChannelAffinityUsageCacheModal, ColumnSelectorModal,
     ParamOverrideModal, UserInfoModal, ConfirmationDialog,
     EditDeploymentModal, ExtendDurationModal, UpdateConfigModal,
     ViewDetailsModal, ViewLogsModal, EditUserModal,
     UserBindingManagementModal, ChannelSelectorModal.
   - Pricing: PricingSidebar, PricingVendorIntro, SearchActions,
     PricingFilterModal, ModelPricingTable, PricingCardSkeleton,
     PricingCardView, PricingTable, PricingTableColumns.
   - Other: ModelsColumnDefs, TaskLogsColumnDefs, tokens/index
     (FluentNoticePanel + native model select), UsageLogsTable
     (expanded-row grid).
   - Settings personal: AccountManagement, CheckinCalendar,
     NotificationSettings, PreferencesSettings, TwoFASetting,
     UserInfoHeader, AccountDeleteModal, ChangePasswordModal,
     EmailBindModal, WeChatBindModal.
   - Setup wizard: AdminStep, CompleteStep, DatabaseStep, UsageModeStep.
   - pages/Setting: SettingsAPIInfo, SettingsAnnouncements, SettingsFAQ,
     SettingsUptimeKuma, SettingsPaymentGatewayCreem, ModelPricingEditor,
     Setting/index (sidebar tabs).

Verification: `bun run build` passes after every commit.
`/components/table` and `/pages/Setting` now have zero literal slate/gray
classes; `/components/settings`, `/components/topup`, `/components/setup`
also clean.

Out of scope (still uses literals — not part of /console):
`playground/*`, `layout/headerbar/*`, `layout/Footer`, `layout/NoticeModal`,
`auth/*`, `pages/Home`, `pages/About`, `pages/NotFound`, `pages/Forbidden`,
`dashboard/modals/SearchModal`, `model-deployments/DeploymentAccessGuard`,
`common/ErrorBoundary`, `ui/semi.js` (compat shim).

## /console Dashboard Cards → HeroUI Pro Widget (feature/widget-dashboard-cards)

Replace every `Card` based panel under `/console` (the dashboard) with the
HeroUI Pro `Widget` component (`@heroui-pro/react`) so the surface gets the
characteristic gray outer shell + elevated white content area + subtle inner
shadow defined by `widget.css`.

- [x] StatsCards (top 4 KPI tiles: 账户数据 / 使用统计 / 资源消耗 / 性能指标) →
  `Widget` + `Widget.Header` (renders the existing icon+text from
  `createSectionTitle`) + `Widget.Content`. Tightened content padding from
  default `p-4` to `p-3`, dropped value font size from `text-lg` to
  `text-base`, added `min-w-0` to label cluster and `shrink-0` to the
  trailing button / sparkline so the 充值 button no longer clips against
  `$200.00` inside the narrower Widget content area.
- [x] ChartsPanel (模型数据分析) → `Widget` + responsive `Widget.Header`
  (`min-h-12 flex-col … lg:flex-row`) so the inline `Tabs.List` strip fits
  next to `Widget.Title`. `whitespace-nowrap` + `shrink-0` icon prevents
  CJK title characters from stacking when the column is narrow.
- [x] ApiInfoPanel (API信息) → `Widget` with `Widget.Title` + scrollable
  `Widget.Content className='p-0'` for the existing `ScrollableContainer`
  list / `EmptyState`.
- [x] AnnouncementsPanel (系统公告) → `Widget` with responsive header
  (icon + title + 最新20条 chip on one row, then `Widget.Legend` /
  `Widget.LegendItem` for the status colors). Dot colors are mapped through
  a small `LEGEND_COLOR_MAP` so the existing `grey/blue/green/orange/red`
  swatch keys keep working with `Widget.LegendItem` (which expects a CSS
  color string).
- [x] FaqPanel (常见问答) → `Widget` + `Widget.Title` + scrollable
  `Widget.Content className='p-0'` for the `Accordion`/empty state.
- [x] UptimePanel (服务可用性) → `Widget` + `Widget.Header` (refresh button
  on the right) + `Widget.Content className='p-0'` for the
  `Tabs`/`ScrollableContainer` and `Widget.Footer` for the legend.

### Notes

- All headers use a `whitespace-nowrap` flex cluster around the lucide icon
  + `Widget.Title` to keep the title text on one line at narrow widths.
- `Widget.LegendItem` requires an explicit `color` CSS string, so semantic
  legend keys are translated via a local color map only in
  `AnnouncementsPanel`. `UptimePanel` already stores hex strings on the
  `UPTIME_STATUS_MAP` constant, so it passes them through directly.
- `Widget.Header` defaults to `h-8` and `align-items: center`. Headers that
  carry inline tabs or a wrapping legend (`ChartsPanel`, `AnnouncementsPanel`)
  override to `h-auto min-h-12 flex-col items-start … lg:flex-row
  lg:items-center` so the row can grow vertically on small viewports.
- `widget.css` is already pulled in via `@import '@heroui-pro/react/css';`
  in `web/src/index.css`, so no extra CSS plumbing was required.

### Verification

- `bunx prettier --check` (touched dashboard files): passed.
- `bunx eslint` (touched dashboard files): passed (no warnings, no errors).
- Manual screenshot QA at `/console`: stats cards, model analytics chart,
  API info panel, announcements panel, FAQ panel, and uptime panel all
  render with the Widget surface (gray outer shell + elevated white
  content area + subtle shadow) and remain functional.

## Filter Date Range → HeroUI DateRangePicker (feature/heroui-date-range-picker)

Replace the native `<input type="datetime-local">` pair inside the shared
`FilterDateRange` (`web/src/components/common/ui/TableFilterForm.jsx`) with the
HeroUI v3 `DateRangePicker` composition (`DateField` + `RangeCalendar`). The
old browser-native datetime control rendered an unstyled OS dropdown that
clashed with the rest of the HeroUI surface on `/console/midjourney`,
`/console/task`, and `/console/log`.

- [x] Add `@internationalized/date@^3.12.1` as a direct dependency (already a
  transitive dep of `react-aria-components`, but now imported explicitly for
  `parseDateTime` and `CalendarDateTime`).
- [x] Rewrite `FilterDateRange` using `DateRangePicker` + `DateField.Group` +
  `RangeCalendar` from `@heroui/react`. Trigger renders the segmented start/end
  date+time fields with a calendar icon suffix; popover hosts a row of preset
  shortcut buttons (今天 / 近 7 天 / 本周 / 近 30 天 / 本月) above the
  `RangeCalendar`. Granularity is `minute`, hour cycle is 24.
- [x] Preserve the external API: `value` stays as `[startStr, endStr]` of
  `YYYY-MM-DD HH:mm:ss` strings (or `Date` objects from
  `DATE_RANGE_PRESETS`), and `onChange` always emits the same string format.
  Internal helpers `toCalendarDateTime` / `fromCalendarDateTime` round-trip
  values through React Aria's `CalendarDateTime` type without leaking it to
  callers, so `useMjLogsData`, `useTaskLogsData`, and `useUsageLogsData`
  continue to work unchanged.
- [x] Picker is fully controlled (`isOpen` / `onOpenChange`); preset buttons
  set the value and explicitly close the popover.

### Verification

- `bun run build`: passed (28.21s, no new warnings).
- Manual QA at `http://localhost:5173/console/task` and `/console/midjourney`:
  segmented input renders with the HeroUI border + calendar icon suffix;
  popover opens with the 5 preset chips + RangeCalendar grid; clicking 今天
  populates the trigger with today's full-day range and closes the popover.
