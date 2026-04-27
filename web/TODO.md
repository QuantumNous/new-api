# HeroUI v3 Cleanup ✅

All phases complete. The `web/` UI is fully aligned with HeroUI v3
component rules (ref: https://heroui.com/react/llms.txt).

## Final compliance scan

```
$ rg "variant=['\"](solid|bordered|flat|light|faded|shadow)['\"]" web/src/   →  0
$ rg "radius="                                                  web/src/   →  0
$ rg "classNames=\{"                                            web/src/   →  0
$ rg "startContent=|endContent="                                web/src/   →  0
$ rg "from '@/components/(common/ui/Hero|ui/semi)"              web/src/   →  0
$ rg "HeroUIProvider|useDisclosure|useSwitch|useInput|useCheckbox|useRadio"
                                                                web/src/   →  0
$ rg "<Button[^/>]*\bisLoading="                                web/src/   →  0
```

`web/src/components/ui/` retains only `ToastViewport.jsx` (the
v3-native toast portal helper). The Semi-style adapter layer is
gone.

## Shipped PRs

| PR | Phases | Notes |
| -- | ------ | ----- |
| [#9](https://github.com/dingyi/new-api/pull/9)   | 0, 2, 3 | dep upgrade, isLoading, radius, variant codemod (102 files / 325 edits) |
| [#10](https://github.com/dingyi/new-api/pull/10) | 4, 6    | success/warning Buttons + Checkbox classNames slot map |
| [#11](https://github.com/dingyi/new-api/pull/11) | (extra) | console layout overhaul + UI polish + i18n sync |
| [#12](https://github.com/dingyi/new-api/pull/12) | 1       | rewrite ToolPriceSettings / TieredPricingEditor (1700 lines) / DynamicPricingBreakdown; delete the entire HeroCompat / Semi shim layer (-1812 lines) |
| [#13](https://github.com/dingyi/new-api/pull/13) | 5       | startContent / endContent → children (135 edits / 55 files) |

## Reusable codemods

Idempotent — safe to re-run on any branch that picks up new v2-style
patterns.

- `web/scripts/heroui-v3-variant-codemod.mjs` — visual variants → semantic.
- `web/scripts/heroui-v3-startend-content-codemod.mjs` — startContent /
  endContent → children, AST-based via @babel/parser.

## Out of scope

- HeroUI Pro components (Sheet, Sidebar, Stepper, Segment, …). Already
  on the latest beta as of the dep upgrade; no API drift identified.
- `@heroui-native(-pro)`. Native targets are not in this repo's runtime.
- Pre-existing eslint/prettier offenses (~93 missing-license-header
  errors in files outside the v3 cleanup scope).
