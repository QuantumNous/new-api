# UI Redesign Specification: Trae Style Semi UI

## Overview
This specification outlines the visual redesign of the EndlessToken web interface. The goal is to transform the current interface from a traditional, rigid control panel into a modern, approachable, and brand-distinctive SaaS platform. 

The redesign strategy focuses on a high-impact, low-cost approach: deep customization of the existing Semi Design component library via global CSS Design Tokens, rather than rewriting the component architecture.

## Visual Design Language

The new visual language is characterized by three core decisions:
1. **Foundation**: Semi Design (Enterprise Polish)
2. **Primary Color Palette**: Trae-inspired Emerald/Teal (Greenish-Blue)
3. **Shape & Border Radius**: Pill/Soft Rounded (High Affinity, Consumer-style)

### 1. Color Palette (Trae Emerald/Teal)
The primary color will shift from the default Semi Blue to a vibrant, tech-forward Emerald/Teal. This color conveys efficiency, passage, and safety—fitting for an AI API gateway.

*   **Primary Base**: `~#00B894` (Exact hex to be fine-tuned during implementation for accessibility)
*   **Primary Hover/Active**: Lighter/Darker shades of the base Emerald.
*   **Semantic Colors**: Success (Green), Warning (Orange), Danger (Red) will be subtly adjusted to harmonize with the new primary color, ensuring they don't clash.
*   **Dark Mode**: The primary color will be adapted for the dark theme to ensure adequate contrast against dark backgrounds (`#1f2937` or similar).

### 2. Border Radius & Shape (Pill Style)
The most striking structural change will be the transition to a "Pill" or heavily rounded aesthetic. This softens the UI significantly.

*   **Buttons & Inputs**: `border-radius: 9999px` (or highly rounded, e.g., `12px-16px` for inputs if pill is too restrictive for text entry, but buttons will be strictly pill-shaped).
*   **Cards & Modals**: Large border radii (`16px - 24px`) to match the soft aesthetic of the interactive elements.
*   **Tags & Badges**: Pill-shaped (`border-radius: 9999px`).

## Implementation Strategy

### Approach: Global CSS Token Override
We will implement these changes using **Option 1: Global CSS Variable Overrides**. This avoids the overhead of managing a custom Semi DSM npm package and allows for rapid, iterative tweaking.

### Technical Details
1.  **Target File**: The overrides will be placed in the main stylesheet, typically `web/src/index.css` (or a dedicated `theme.css` imported into it).
2.  **Semi Design Variables**: We will target the specific CSS Custom Properties (Variables) exposed by Semi Design.
    *   *Colors*: `--semi-color-primary`, `--semi-color-primary-hover`, `--semi-color-primary-active`, etc.
    *   *Radii*: `--semi-border-radius-small`, `--semi-border-radius-medium`, `--semi-border-radius-large`, `--semi-border-radius-circle`.
3.  **Theme Support**: The overrides must respect Semi Design's dark mode implementation. We will use the `body[theme-mode='dark']` selector to provide alternative token values for the dark theme where necessary.
4.  **Component Specific Tweaks**: While global tokens handle 90% of the work, some specific components (like the Sidebar or top Navigation) might require targeted CSS overrides if the global tokens don't produce the exact desired "Pill" effect.

## Scope of Work (First Iteration)

1.  **Color System Setup**: Define the exact Hex/RGB values for the Trae Emerald palette (Light & Dark modes).
2.  **Radius System Setup**: Define the specific pixel values for the new rounded/pill token scale.
3.  **CSS Injection**: Write the CSS overrides in `index.css`.
4.  **Visual QA**: Review core pages (Dashboard, Chat/Playground, Settings) to ensure the new tokens haven't broken any layouts and that the contrast is accessible.

## Out of Scope (For Now)
*   Major layout restructuring (e.g., moving the sidebar to the top, completely redesigning the Dashboard grid).
*   Replacing Semi Design with another component library (e.g., Radix UI, Tailwind UI).
*   Adding complex WebGL or canvas-based animations.