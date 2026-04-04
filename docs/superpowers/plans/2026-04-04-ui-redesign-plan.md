# UI Redesign: Trae Style & Pill Shape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Trae Emerald/Teal primary color and Pill-style border radii globally using Semi Design CSS token overrides in the existing `index.css` file.

**Architecture:** We will modify `web/src/index.css` to inject CSS Custom Properties under the `:root` and `html.dark` selectors. This approach avoids touching individual React components and applies the new design system globally via Semi Design's built-in token system.

**Tech Stack:** CSS (Tailwind + Semi Design Tokens), React (Implicitly affected)

---

### Task 1: Setup Global Color and Radius Tokens

**Files:**
- Modify: `web/src/index.css:16-32`
- Modify: `web/src/index.css:968-984` (Remove old custom border-radius rules to prevent conflicts with our new global token approach)

- [ ] **Step 1: Inject Semi Design Color Tokens into `:root`**

Update `web/src/index.css` by modifying the existing `:root` block to include the Trae Emerald color palette and the Pill radius tokens.

```css
/* ==================== 全局基础样式 ==================== */
:root {
  --sidebar-width: 180px;
  --sidebar-width-collapsed: 60px;
  --sidebar-current-width: var(--sidebar-width);

  /* --- Trae Emerald Primary Color Tokens --- */
  --semi-color-primary: #00B894;
  --semi-color-primary-hover: #00D2A6;
  --semi-color-primary-active: #00997A;
  --semi-color-primary-disabled: rgba(0, 184, 148, 0.4);
  --semi-color-primary-light-default: rgba(0, 184, 148, 0.1);
  --semi-color-primary-light-hover: rgba(0, 184, 148, 0.2);
  --semi-color-primary-light-active: rgba(0, 184, 148, 0.3);

  /* --- Pill Style Radius Tokens --- */
  --semi-border-radius-extra-small: 6px;
  --semi-border-radius-small: 8px;
  --semi-border-radius-medium: 12px;
  --semi-border-radius-large: 16px;
  --semi-border-radius-circle: 9999px;
  --semi-border-radius-full: 9999px;
}
```

- [ ] **Step 2: Inject Dark Mode Color Tokens**

Add an `html.dark` block right after the `:root` block (around line 33, before the `body.sidebar-collapsed` selector) to handle the dark mode variants of the Trae Emerald colors.

```css
/* ==================== 暗黑模式全局变量 ==================== */
html.dark {
  /* --- Trae Emerald Primary Color Tokens (Dark Mode adjustments) --- */
  --semi-color-primary: #00D2A6;
  --semi-color-primary-hover: #00E6B8;
  --semi-color-primary-active: #00B894;
  --semi-color-primary-disabled: rgba(0, 210, 166, 0.4);
  --semi-color-primary-light-default: rgba(0, 210, 166, 0.15);
  --semi-color-primary-light-hover: rgba(0, 210, 166, 0.25);
  --semi-color-primary-light-active: rgba(0, 210, 166, 0.35);
}
```

- [ ] **Step 3: Remove Conflicting Old Custom Border Radius Rules**

Find the `/* ==================== 自定义圆角样式 ==================== */` section at the bottom of `web/src/index.css` (around lines 968-984) and remove the hardcoded `border-radius: 10px !important;` block to allow our new Semi tokens to work properly.

Replace:
```css
/* ==================== 自定义圆角样式 ==================== */
.semi-radio,
.semi-tagInput,
.semi-input-textarea-wrapper,
.semi-navigation-sub-title,
.semi-chat-inputBox-sendButton,
.semi-page-item,
.semi-navigation-item,
.semi-tag-closable,
.semi-input-wrapper,
.semi-tabs-tab-button,
.semi-select,
.semi-button,
.semi-datepicker-range-input {
  border-radius: 10px !important;
}
```

With:
```css
/* ==================== 自定义圆角样式 ==================== */
/* Pill style component specific overrides */
.semi-button,
.semi-input-wrapper,
.semi-select,
.semi-tagInput-wrapper,
.semi-datepicker-range-input {
  border-radius: var(--semi-border-radius-full) !important;
}

.semi-tag-closable,
.semi-radio-inner,
.semi-page-item,
.semi-tabs-tab-button {
  border-radius: var(--semi-border-radius-full) !important;
}

.semi-input-textarea-wrapper {
  border-radius: var(--semi-border-radius-large) !important; /* Textareas look weird as full pills */
}
```

- [ ] **Step 4: Commit**

```bash
git add web/src/index.css
git commit -m "feat(ui): implement trae emerald colors and pill radius tokens globally"
```

---

### Task 2: Refine Component-Specific Overrides for Pill Aesthetic

**Files:**
- Modify: `web/src/index.css`

- [ ] **Step 1: Adjust Navigation/Sidebar Items for Pill Shape**

Locate the `.sidebar-nav-item` selector (around line 151) and update the `border-radius` to make the sidebar items fully rounded (pill shaped).

Change:
```css
.sidebar-nav-item {
  border-radius: 6px;
  margin: 3px 8px;
  transition: all 0.15s ease;
  padding: 8px 12px;
}
```

To:
```css
.sidebar-nav-item {
  border-radius: var(--semi-border-radius-full);
  margin: 3px 8px;
  transition: all 0.15s ease;
  padding: 8px 12px;
}
```

- [ ] **Step 2: Ensure Cards use Large Radius**

Add a global override for Semi Cards to use the new large border radius, ensuring they look soft but not fully pill-shaped. Add this anywhere near the bottom component specific styles (e.g. before the animation keyframes).

```css
/* Card Soft Rounded Style */
.semi-card {
  border-radius: var(--semi-border-radius-large) !important;
}
```

- [ ] **Step 3: Run dev server to verify**

Run: `cd web && bun run dev`
Action: Open the browser and verify the primary color is now green (`#00B894`), buttons are fully rounded (pill), inputs are fully rounded, and cards have a soft rounded edge.

- [ ] **Step 4: Commit**

```bash
git add web/src/index.css
git commit -m "style(ui): refine component specific border radii for pill aesthetic"
```