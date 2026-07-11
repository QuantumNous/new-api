# Design-system adapters

This directory is the product-policy boundary above the shadcn source in
`src/components/ui/`.

## Import rule

- Application and feature code imports policy-bearing controls from
  `@/components/design-system/*`.
- Files in this directory may import `@/components/ui/*`.
- Do not make `components/ui` depend on this directory.
- Do not proxy a shadcn component unless it carries a stable cross-application
  policy. Components without product policy continue to be imported directly
  from `components/ui`.

The lint configuration enforces this rule for the managed controls.

## Responsive sizing

Default controls are 28px below the `sm` breakpoint and 32px at `sm` and above.
Dense and micro sizes remain fixed:

- `sm` / `icon-sm`: 28px
- `xs` / `icon-xs`: 24px
- `xl`: 40px below `sm`, 44px at `sm` and above

Call sites should select a semantic size and use `className` only for layout.
They must not pin a managed control to a fixed `h-*` or `size-*` value.

## Updating shadcn

Keep `components.json` pointed at `@/components/ui`. Preview upstream changes
before merging:

```sh
bunx --bun shadcn@latest add <component> --dry-run
bunx --bun shadcn@latest add <component> --diff <file>
```

Merge the upstream source into `components/ui`, then verify that the adapter's
prop forwarding and class overrides still match the upstream API. Never use
`--overwrite` without explicit approval.
