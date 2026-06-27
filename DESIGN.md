# Design System: ai4codex Pricing / Model Marketplace

## 1. Visual Theme & Atmosphere

The observed pricing page is a compact AI model marketplace rather than a marketing pricing table. Its personality is technical, utility-forward, and dashboard-like: a fixed translucent top bar, dense filter controls, and repeated model cards that put provider, model name, token prices, and billing type within immediate scanning distance. The default observed mode is dark, with a near-black zinc surface, soft white text, blue actions, and categorical accents in violet, teal, amber, rose, and emerald. The interface avoids dramatic imagery; identity comes from structured density, pill controls, icon-first actions, and a card grid that feels like a command surface for comparing models.

- Overall feeling: compact, operational, modern SaaS, model-catalog oriented.
- Visual density: high; many controls and cards are visible in the first viewport.
- Brand posture: technical and practical, with restrained polish from blur, rounded controls, and colored category accents.
- Signature motifs: translucent fixed navigation, two-column desktop card grid, filter chips with counts, dark bordered cards, small token-price rows.

### Key Characteristics

- Dark zinc workspace with blue primary action color.
- Semi Design controls combined with Tailwind utility styling.
- Pricing data is shown as small stacked rows inside rounded cards.
- Sidebar filters use color-coded active chips for provider, group, billing type, tag, and endpoint categories.
- Mobile removes the large sidebar and surfaces a compact "filter" button above a single-column card list.

## 2. Color Palette & Roles

| Role | Semantic Name | Value | Usage |
| --- | --- | --- | --- |
| Page background | Zinc Night | `#16161A` | Body and card background in the observed dark mode. |
| Header glass | Translucent Zinc | `rgba(24, 24, 27, 0.75)` inferred from `dark:bg-zinc-900/75` | Fixed top navigation with backdrop blur. |
| Card surface | Deep Panel | `#16161A` | Model cards and login/card-like surfaces. |
| Hairline border | White Hairline | `rgba(255, 255, 255, 0.08)` | Card borders, outline buttons, disabled copy button, filter chips. |
| Primary text | Soft White | `#F9F9F9` | Main text, brand, headings, nav items. |
| Secondary text | Muted White | `rgba(249, 249, 249, 0.8)` | Card titles and body copy. |
| Tertiary text | Subtle White | `rgba(249, 249, 249, 0.6)` | Pagination and lower-priority metadata. |
| Disabled text | Faint White | `rgba(249, 249, 249, 0.35)` | Disabled pagination and disabled actions. |
| Primary action | Electric Blue | `#54A9FF` | Login/register action styling, links, active pagination, primary CTA color. |
| Active blue tint | Blue Wash | `rgba(84, 169, 255, 0.2)` | Selected pagination and focus-like selected states. |
| Provider accent | Violet | `#A78BFA` | Active provider filter, violet category tone. |
| Group accent | Teal | `#2DD4BF` | Active group filter and secondary category tone. |
| Warning accent | Amber | `#FBBF24` | Category/status accent where warning emphasis is needed. |
| Error accent | Rose | `#FB7185` / `#FC725A` | Alerts, errors, destructive or warning toast states. |
| Success accent | Emerald | `#34D399` | Positive/status accent. |

### Primary

- Electric Blue `#54A9FF` is the most reusable action color. It appears on links, selected pagination, and primary controls.
- Violet `#A78BFA` and teal `#2DD4BF` are category colors rather than global action colors. They help distinguish filter dimensions.

### Interactive

- Standard outline controls use transparent backgrounds, `rgba(255,255,255,0.08)` borders, `10px` radius, and muted white text.
- Active filter chips switch to a translucent fill `rgba(255,255,255,0.12)` and a colored label such as violet or teal.
- Primary action buttons use blue fill and white text; disabled buttons retain the outline form with faint text.
- Nav links use transparent backgrounds, `6px` radius, `8px` padding, and color transitions around `0.2s`.

### Neutral Scale

- `#16161A`: base page and panel surface.
- `#232429` / `#35363C`: darker internal UI tiers and control fills observed in the color sample.
- `#F9F9F9`: primary foreground.
- `rgba(249,249,249,0.8)`: default readable text.
- `rgba(249,249,249,0.6)`: supporting text.
- `rgba(249,249,249,0.35)`: disabled text.

### Surface & Overlay

- Top navigation: fixed at the top, `64px` high, full width, translucent zinc with `backdrop-filter: blur(16px)`.
- Model cards: same dark surface as the page but separated by a faint white border and radius rather than heavy elevation.
- Inputs, selects, icon buttons, switches: filled with `rgba(255,255,255,0.12)` on dark mode.
- The page intentionally uses border-as-depth more than shadow-as-depth.

### Theme Modes

The page exposes a theme switcher with light, dark, and auto options. The fully observed pricing page stayed in dark mode during extraction. Light mode is present as a control path, but its pricing-page token values were not fully captured in the live session.

#### Light Mode

- Background: inferred to invert to light gray/white surfaces from Tailwind classes such as `bg-white/75` and `bg-gray-100`.
- Surface: likely white or near-white cards with gray borders.
- Text: likely gray/black hierarchy.
- Accent: blue, violet, teal, amber, rose, and emerald accents likely remain stable.
- Notes: treat light mode as supported but verify before reproducing exact pricing-page values.

#### Dark Mode

- Background: `#16161A`.
- Surface: `#16161A` cards with `rgba(255,255,255,0.08)` borders.
- Text: `#F9F9F9`, `rgba(249,249,249,0.8)`, `rgba(249,249,249,0.6)`.
- Accent: `#54A9FF` action blue, `#A78BFA` provider violet, `#2DD4BF` group teal.
- Notes: this is the authoritative observed mode for the pricing page.

### Shadows & Depth

- Cards normally show no shadow; separation comes from border, radius, and spacing.
- Hover card class includes `hover:shadow-lg` and `hover:border-gray-300`, so elevation is a hover-only affordance.
- Semi controls have subtle default shadow tokens like `rgba(0,0,0,0.05) 0 1px 2px`, but most visible controls read as flat.

## 3. Typography Rules

### Font Family

- Primary: `Inter, -apple-system, system-ui, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Segoe UI, Helvetica Neue, Helvetica, Arial, sans-serif`.
- Monospace: not meaningfully used on the observed pricing page.
- OpenType Features: none observed; default tracking is normal.

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Brand in nav | Inter/system stack | `18px` | `600` | `28px` | normal | Hidden on mobile; logo remains. |
| Page heading | Inter/system stack | `20px` desktop | `700` | `28px` | normal | Example: `全部供应商`; truncated if needed. |
| Card title | Inter/system stack | `18px` | `700` | `28px` | normal | Model names such as `gpt-5.4`, truncated in a single line. |
| Body / control text | Inter/system stack | `14px` | `400-600` | `20px` | normal | Used for buttons, chips, labels, and controls. |
| Price rows | Inter/system stack | `12px` | `400` | `16px` | normal | Dense stacked rows for input/completion/cache pricing. |
| Nav links | Inter/system stack | `16px` | `600` | normal | normal | Compact semibold labels with 8px padding. |
| Pagination | Inter/system stack | `14px` | `400-600` | `32px` | normal | Active item uses blue text and blue tint background. |

### Principles

- Use semibold labels for navigation and controls so dense layouts remain scannable.
- Keep pricing metadata small but not faint; `12px/16px` works because cards use large internal spacing and strong hierarchy.
- Avoid oversized hero typography on operational pages. The page heading stays compact to preserve room for filters and cards.

## 4. Component Stylings

### Buttons and Links

- Primary CTA: blue fill `#54A9FF`, white text, `9999px` pill radius or Semi primary solid styling where used.
- Secondary CTA: transparent or translucent fill, `rgba(255,255,255,0.08)` border, `10px` radius, `14px/20px` semibold text.
- Filter chips: fixed-looking `32px` height, `6px 12px` padding, `10px` radius. Active chips use translucent fill and colored text; inactive chips use outline borders and muted white.
- Icon buttons: `32px` square circles, `9999px` radius, `6px` padding, translucent fill, Lucide-style line icons.
- Text links: blue `#54A9FF` or primary foreground in nav; nav hover shifts toward Semi primary color.
- Hover and active feel: subtle and fast, with `0.2s` transitions for cards/nav and ease-in Semi transitions for controls.

### Cards and Containers

- Surface style: dark `#16161A` panels with no visible gradient.
- Radius: model cards use `16px`; controls use `10px`; icon buttons and primary pills use `9999px`.
- Border: `1px solid rgba(255,255,255,0.08)`.
- Shadow or elevation: none by default; hover may add large shadow and stronger border.
- Internal spacing: first card content shows roughly `12px` card body padding, a `12px` horizontal gap between provider icon and text, and `4px` vertical gaps for price rows.

### Inputs and Interactive Controls

- Search input wrapper: `32px` height, `10px` radius, `rgba(255,255,255,0.12)` fill, transparent border.
- Input text: `14px`, `30px` line height, transparent input body.
- Switches: `40px x 24px`, `12px` radius, translucent fill in off state.
- Pagination select: `32px` height, `10px` radius, translucent fill.
- Focus behavior: Semi controls imply border/fill transition; exact focus ring was not captured.

### Navigation

- Structure: fixed full-width header, `64px` height, logo/brand at left, scrollable nav center, icon utilities and login/register at right.
- Background treatment: translucent glass layer with `backdrop-filter: blur(16px)`.
- Link style: semibold, rounded `6px`, `8px` padding, transparent default.
- Sticky or scroll behavior: header remains fixed; content begins under it.
- Mobile: brand text collapses away, leaving a `32px` logo; nav becomes horizontally scrollable in a narrow center strip.

### Image Treatment

- Logo uses `/logo.png`, displayed as a `32px` rounded-full image in the header.
- No marketing screenshots or decorative product imagery were observed on the pricing page.
- Visual interest comes from data cards, chips, and icons rather than media.

### Distinctive Components

- Filter sidebar: desktop uses a left rail of categorized filter chips. Categories include provider, token group, billing type, tags, and endpoint type.
- Model price card: provider label/icon on the left, model name as bold heading, price rows below, checkbox/action control to the right, and billing tag at the bottom.
- Mobile filter affordance: sidebar is replaced by a compact `filter 筛选` button beside search/copy controls.
- View mode controls: a `表格视图` outline button and compact `M` button appear on desktop to switch presentation modes or display mode.

## 5. Layout Principles

### Spacing System

- Base unit: `4px` and `8px` are the dominant rhythm.
- Repeated spacing values: `4px` gaps in price rows, `8px` nav/control gaps, `12px` button padding and card inner gaps, `16px` mobile/card gutters, `24px+` section grouping.
- Header height: `64px`.
- Control height: usually `32px`.

### Grid & Container

- Desktop grid: left filter rail about `330px` wide; model cards start around x `339px` and form two columns of about `509px` width with a `16px` gap.
- Desktop cards: first row starts around y `234px`; card heights vary from about `158px` to `178px` depending on whether cache creation pricing is present.
- Mobile grid: one column, `8px` side gutter, cards about `374px` wide on a `390px` viewport.
- Content is dense and viewport-filling rather than centered in a narrow marketing container.

### Whitespace Philosophy

- Whitespace is functional and compact. The page prioritizes comparison and filtering over spacious storytelling.
- Horizontal space is preserved for card content, while filters compress into equal-width chips.
- Mobile keeps the data visible first: search and filter controls appear at the top, then cards immediately follow.

### Border Radius Scale

- Micro: `6px` nav links.
- Standard: `10px` controls, selects, pagination buttons.
- Large: `16px` model cards.
- Pill: `9999px` primary/auth buttons and circular icon buttons.

## 6. Depth & Elevation

| Level | Treatment | Use |
| --- | --- | --- |
| Flat | Transparent background, no border | Page containers and nav link default states. |
| Filled control | `rgba(255,255,255,0.12)` fill, no visible shadow | Search input, active chips, icon buttons, switches. |
| Ring | `1px solid rgba(255,255,255,0.08)` | Cards, outline buttons, disabled copy button. |
| Card | Dark surface, `16px` radius, faint border | Model pricing cards. |
| Hover | Stronger border plus `hover:shadow-lg` | Clickable model cards. |

### Depth Principles

- Surface hierarchy is made mostly with borders and translucency.
- Shadows are restrained so the UI stays crisp and data-dense.
- Blur belongs to the fixed header, not to cards.
- Use elevation only to show hover/click affordance; do not make the base grid float heavily.

## 7. Do's and Don'ts

### Do

- Keep model/pricing information in compact, repeatable cards.
- Use exact token units such as `/ 1M Tokens` in small stacked rows.
- Give filter dimensions their own accent colors while preserving one primary blue action color.
- Use rounded `10px` controls and `16px` cards consistently.
- Preserve high information density on desktop and a single-column data-first flow on mobile.

### Don't

- Do not turn the pricing page into a marketing hero or oversized pricing-table landing page.
- Do not use heavy shadows or glossy gradients on every card.
- Do not mix many unrelated brand colors in a single control; keep accents tied to categories.
- Do not hide prices behind modals when they can fit in the card.
- Do not let mobile retain the full sidebar; collapse it behind the filter button.

## 8. Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
| --- | --- | --- |
| Mobile | `390px` observed | Brand text hides; nav scrolls horizontally; sidebar disappears; search is about `202px`; a filter button appears; cards become one column at about `374px` wide. |
| Tablet | inferred around `768px` | Likely transitional: nav remains compact and grid may reduce before desktop sidebar/card grid fully expands. |
| Desktop | `1381px` observed | Fixed header, left filter rail, two-column card grid, desktop view controls and pagination select. |

### Touch Targets

- Primary mobile cards remain large tap targets.
- Buttons and inputs are `32px` high; this is compact but consistent with dashboard density.
- Mobile filter button is essential because the sidebar is removed from the main flow.

### Collapsing Strategy

- Desktop behavior: filter sidebar is visible; content has heading, description, search, copy, switches, view controls, two-column cards.
- Tablet behavior: preserve controls but consider wrapping the action row before collapsing the sidebar.
- Mobile behavior: show search/copy/filter row first, hide desktop heading/sidebar, render cards in one column, use small pagination.
- Breakpoint-driven component changes: card width changes from about `509px` to `374px`; header brand text hides; nav strip narrows and scrolls.
- Touch target and spacing adjustments: page gutters shrink to `8px`; control row becomes horizontally compressed.

## 9. Agent Prompt Guide

### Quick Color Reference

- Primary CTA: `#54A9FF`
- Background: `#16161A`
- Heading text: `#FFFFFF` or `#F9F9F9`
- Body text: `rgba(249,249,249,0.8)`
- Border or ring: `rgba(255,255,255,0.08)`
- Accent: violet `#A78BFA`, teal `#2DD4BF`, amber `#FBBF24`, rose `#FB7185`, emerald `#34D399`

### Quick Summary

Build ai4codex pricing pages as dense dark-mode SaaS dashboards. Use a fixed translucent blurred header, a left filter rail on desktop, and compact model cards in a two-column grid. Cards use dark surfaces, `16px` radius, faint borders, bold model titles, and `12px` stacked price rows. Controls are small, rounded, Semi-like, and mostly `32px` tall. On mobile, remove the sidebar, keep search and a filter button at the top, and render cards in one column.

### Example Component Prompts

- Hero: "Create a compact model marketplace header area with a `全部供应商` title, a small count badge saying `共 8 个模型`, supporting Chinese description text, a 32px search input, copy button, switches, and view mode controls."
- Card: "Create a dark model pricing card with `16px` radius, faint white border, provider label, bold 18px model name, three to four 12px price rows using `/ 1M Tokens`, a small checkbox/action control on the right, and a rounded `按量计费` tag."
- Navigation: "Create a fixed 64px top nav with a 32px round logo, semibold brand text on desktop, horizontally scrollable nav links, circular icon buttons, and login/register buttons on the right."
- Button or badge: "Use a 32px-high Semi-style chip with 10px radius, 6px 12px padding, semibold 14px text, faint border for inactive state, and translucent fill plus violet or teal text for active state."

### Ready-to-Use Prompt

Design a dark ai4codex-style model pricing marketplace: fixed blurred header, compact Chinese navigation, left filter rail with colored provider/group chips, dense two-column model cards, blue primary action accents, `#16161A` surfaces, faint white borders, `16px` card radius, `10px` control radius, Inter/system typography, and a mobile layout that collapses filters behind a button and stacks cards in one column.

### Iteration Guide

1. Start with the data comparison task: users should see model names, provider, and token prices before decorative content.
2. Keep density high but group controls with consistent chip sizes and category colors.
3. Use border and translucency for hierarchy before adding shadows.
4. Validate mobile early; the sidebar must collapse cleanly without hiding search or cards.

## Optional Appendix: Interaction Patterns

- Header remains fixed at the top with blur and color transitions.
- Nav links and buttons use short transitions, typically `0.2s` or Semi ease-in transitions.
- Model cards are clickable and advertise hover affordance through stronger border and shadow.
- Copy button is disabled until model selections are made.
- Switches toggle display modes such as recharge price display and ratio display.
- Mobile exposes filtering through a `filter 筛选` button instead of the full sidebar.

## Optional Appendix: Content & Messaging Patterns

- Language is direct and utilitarian: `筛选`, `重置`, `供应商`, `可用令牌分组`, `计费类型`, `端点类型`.
- Pricing rows use explicit labels: `输入价格`, `补全价格`, `缓存读取价格`, `缓存创建价格`.
- Units are written consistently as `$0.7500 / 1M Tokens`.
- Model naming is technical and unsoftened, for example `claude-haiku-4-5-20251001`.

## Optional Appendix: Observed Pages

- Observed URL: `https://ai4codex.top/pricing`
- Observed page title: `New API`
- Observed access state: public pricing page available after Cloudflare verification.
- Observed models: 8 total; providers shown include OpenAI and Anthropic/Claude.

## Optional Appendix: Evidence Notes

- Directly observed dark mode values include `#16161A`, `#F9F9F9`, `rgba(249,249,249,0.8)`, `rgba(255,255,255,0.08)`, `#54A9FF`, `#A78BFA`, and `#2DD4BF`.
- Directly observed desktop viewport was about `1381px x 727px`; mobile viewport was `390px x 844px`.
- Light mode exists in the theme menu, but exact pricing-page light-mode computed values were not captured; treat light-mode notes as inferred until verified.
