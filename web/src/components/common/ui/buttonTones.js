/*
Copyright (C) 2025 QuantumNous

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

// HeroUI v3 dropped the `color` prop on Button — the v3 variants only cover
// primary / secondary / tertiary / outline / ghost / danger / danger-soft.
// For warning / success buttons we reuse v3's Button base (so size, padding,
// radius, focus / pressed transitions stay correct) and override the
// CSS variables Button reads (`--button-bg`, `--button-bg-hover`,
// `--button-bg-pressed`, `--button-fg`) using the warning / success tokens
// `@heroui/styles` already exposes via Tailwind v4.
//
// Pair these classes with `variant="primary"` (for solid) or
// `variant="tertiary"` (for soft / icon-only) so disabled / pending state
// styling stays consistent with the rest of the app.

export const warningButtonClass =
  '[--button-bg:var(--color-warning)] [--button-bg-hover:var(--color-warning-hover)] [--button-bg-pressed:var(--color-warning-hover)] [--button-fg:var(--color-warning-foreground)]';

export const warningSoftButtonClass =
  '[--button-bg:var(--color-warning-soft)] [--button-bg-hover:var(--color-warning-soft-hover)] [--button-bg-pressed:var(--color-warning-soft-hover)] [--button-fg:var(--color-warning-soft-foreground)]';

// Ghost-style warning: transparent base, warning-tinted hover, warning text.
// Use with `variant="tertiary"` for low-emphasis cautionary actions
// (e.g. "前往设置", "不再提醒", icon-only delete-cache buttons).
export const warningGhostButtonClass =
  'text-warning [--button-bg-hover:var(--color-warning-soft)] [--button-bg-pressed:var(--color-warning-soft-hover)]';

export const successButtonClass =
  '[--button-bg:var(--color-success)] [--button-bg-hover:var(--color-success-hover)] [--button-bg-pressed:var(--color-success-hover)] [--button-fg:var(--color-success-foreground)]';
