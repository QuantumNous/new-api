# Website Reading Checklist

Use this checklist when a website needs a deeper inspection pass before writing `DESIGN.md`.

## 1. Browser-First Setup

- Open the live page in a browser automation tool.
- Prefer a browser-eval workflow such as `agent-browser eval` or an equivalent host-native page-eval tool.
- Inspect at least desktop and mobile.
- Scroll from top to bottom once without taking notes, just to understand the page rhythm.
- Scroll again slowly while collecting evidence.
- In that second pass, gather rendered HTML, key node `outerHTML`, computed styles, CSS variables, readable stylesheet rules, and runtime state diffs from the browser.
- Do not use screenshots as the primary evidence source when page evaluation is available.
- Only use screenshots as a last-resort cross-check if the user explicitly asks for them or if DOM evidence is genuinely insufficient.

### Preferred Eval Sequence

Use this order whenever the browser tool supports JS evaluation:

1. open page
2. wait for load and hydration
3. scroll once to trigger lazy and sticky states
4. extract root CSS variables
5. extract readable stylesheet rules
6. extract representative rendered HTML
7. extract computed styles for key elements
8. extract visible text and CTA content
9. extract hover, sticky, or expanded state changes through DOM or style diffs

## 2. Page Topology

Record the page structure from top to bottom:

- global header or announcement layer
- hero
- feature sections
- social proof
- pricing or plans
- FAQ
- footer

Note which parts are sticky, overlayed, or scroll-reactive.

## 3. Design Tokens to Extract

Capture the repeated system, not one-off anomalies:

- primary and secondary colors
- surface colors
- border colors
- text colors
- accent colors
- font families
- type scale
- radius scale
- spacing rhythm
- shadow styles
- background motifs
- focus ring treatment
- hover-state color deltas
- whether borders are true borders, rings, or shadow-based outlines
- whether the system uses a consistent radius ladder such as `6px`, `8px`, `12px`, `9999px`
- whether type uses distinctive tracking, ligatures, uppercase, or monospace pairings
- whether the site exposes reusable CSS variables or token naming patterns on `:root` or `body`

## 4. Components to Inspect

At minimum, inspect:

- nav items
- CTA buttons
- cards
- badges
- inputs
- tabs
- accordions
- footer links

For each component, note:

- default appearance
- important states
- content density
- icon treatment
- motion or transition feel
- exact padding when practical
- radius and shadow formula when those are signature details
- whether the component is meant to feel structural, decorative, or utility-focused
- representative rendered HTML so the component structure is not inferred only from visuals

## 5. Interaction Sweep

Check all three classes of behavior:

- scroll-driven
- hover-driven
- click-driven

Watch for:

- sticky headers
- reveal-on-scroll blocks
- tab switches
- accordion expansion
- animated counters
- carousel timing
- hover elevation
- underline or color transitions

## 6. Responsive Sweep

Inspect a few meaningful widths when possible:

- desktop around `1440px`
- tablet around `768px`
- mobile around `390px`

Record:

- breakpoint-driven stacking changes
- typography compression
- nav behavior changes
- button sizing changes
- hidden vs retained content
- whether spacing scales down proportionally or is restructured more aggressively
- whether pills and cards keep the same radius at smaller sizes

## 7. Content and Voice

Extract the presentation style:

- headline length
- verb choice
- CTA tone
- sentence cadence
- whether copy is sparse or dense
- whether the brand voice is premium, playful, technical, calm, urgent, or editorial

## 8. Evidence Notes

Be explicit about what is observed versus inferred.

Examples:

- Observed: "Primary CTA buttons use a saturated emerald fill on very dark backgrounds."
- Inferred: "The product prefers one strong accent color per section rather than multi-accent clustering."

For signature details, collect the actual implementation-grade value when possible:

- line height and tracking on headline tiers
- border radius on buttons, cards, images, and badges
- multi-layer box-shadow stacks
- border versus shadow-as-border treatment
- focus ring colors and thickness
- spacing values that appear repeatedly
- root CSS variables and reusable token names
- key node `outerHTML` and accessible stylesheet rules for representative modules

## 9. Richness Check

Before writing the final `DESIGN.md`, ask:

- Can I describe the site's identity in design philosophy language, not just tokens?
- Do I know enough to write a full hierarchy table, not just "large / medium / small"?
- Do I know how cards and buttons are actually built?
- Could I give another agent 3 concrete build prompts that would reproduce this system?

If not, inspect the page again before writing.

## 10. Useful Browser Snippets

Use these only if your browser tool supports evaluating JavaScript on the page.

### Root CSS variables

```js
Object.fromEntries(
  [...getComputedStyle(document.documentElement)]
    .filter((name) => name.startsWith("--"))
    .map((name) => [name, getComputedStyle(document.documentElement).getPropertyValue(name).trim()])
)
```

### Readable stylesheet rules

```js
[...document.styleSheets].map((sheet) => {
  try {
    return {
      href: sheet.href,
      rules: [...sheet.cssRules].slice(0, 40).map((rule) => rule.cssText)
    };
  } catch {
    return {
      href: sheet.href,
      inaccessible: true
    };
  }
})
```

### Representative component HTML

```js
[...document.querySelectorAll("header, h1, button, a, section, article")]
  .slice(0, 20)
  .map((el) => el.outerHTML.slice(0, 1000))
```

### Unique font families

```js
[...new Set(
  [...document.querySelectorAll("body, body *")]
    .slice(0, 250)
    .map((el) => getComputedStyle(el).fontFamily)
    .filter(Boolean)
)].sort()
```

### Visible color sample

```js
[...new Set(
  [...document.querySelectorAll("body, body *")]
    .slice(0, 250)
    .flatMap((el) => {
      const style = getComputedStyle(el);
      return [style.color, style.backgroundColor, style.borderColor];
    })
    .filter((value) => value && value !== "rgba(0, 0, 0, 0)" && value !== "transparent")
)].sort()
```

### Images and background images

```js
JSON.stringify({
  images: [...document.querySelectorAll("img")].map((img) => img.currentSrc || img.src).filter(Boolean),
  backgrounds: [...document.querySelectorAll("body *")]
    .map((el) => getComputedStyle(el).backgroundImage)
    .filter((bg) => bg && bg !== "none")
}, null, 2)
```
