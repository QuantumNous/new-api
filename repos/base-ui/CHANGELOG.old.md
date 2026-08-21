# Non-public versions

## v1.0.0-alpha.3

_Oct 7, 2024_

A big thanks to the 7 contributors who made this release possible. Here are some highlights ✨:

- ⭐ We added several new components: CheckboxGroup, RadioGroup, Form, Separator
- ⭐ Menu has new parts: CheckboxItem, RadioItem, and Group

### `@base_ui/react@1.0.0-alpha.3`

- [AlertDialog] Move types to namespaces (#591) @michaldudak
- [Checkbox] Modernize implementation (#594) @atomiks
- [CheckboxGroup] Implement components and hooks (#458) @atomiks
- [Collapsible] Add Collapsible components and hooks (#481) @mj12albert
- [Dialog] Move types to namespaces (#697) @michaldudak
- [Dialog][Collapsible] Fix style prop merging (#641) @michaldudak
- [Form] Create new `Form` component (#589) @atomiks
- [Menu] CheckboxItem component (#533) @michaldudak
- [Menu] Do not select an item when space is pressed during typeahead (#542) @michaldudak
- [Menu] Fix custom anchor positioning (#609) @michaldudak
- [Menu] Group and Separator components (#535) @michaldudak
- [Menu] Increase test timeout (#592) @michaldudak
- [Menu] RadioItem component (#534) @michaldudak
- [Menu] Remove the unused prop (#647) @michaldudak
- [Menu] Remove wrong default value from docs (#549) @sai6855
- [Menu][Popover][PreviewCard][Tooltip] Add default value as `clippingAncestors` to collisionBoundary prop (#580) @sai6855
- [NumberField] Modernize implementation (#590) @atomiks
- [Popover] Modernize implementation (#607) @atomiks
- [PreviewCard] Modernize implementation (#626) @atomiks
- [RadioGroup] Create new `RadioGroup` component (#487) @atomiks
- [Slider] Fix Home / End regression (#526) @sai6855
- [Tooltip] Modernize implementation (#606) @atomiks
- [useButton] Modernize implementation (#643) @michaldudak
- [useScrollLock] Avoid scrollbar layout shift issues (#604) @atomiks

### Docs

- [docs] Fix 301 redirections in docs @oliviertassinari
- [docs] Make the readme specific to @base_ui/react (#633) @michaldudak
- [docs] Copy vale-action.yml from main repo @oliviertassinari
- [docs] Fix 301 to chromium (#636) @oliviertassinari
- [docs] Avoid dead links in demos (#610) @oliviertassinari
- [docs] Fix rel attribute on edit GitHub links (#614) @oliviertassinari
- [docs] Fix pnpm docs:link-check script (#552) @oliviertassinari
- [docs] Fix Stack Overflow issue canned response @oliviertassinari
- [docs] Fix outdated link to support page @oliviertassinari
- [docs] Clarify contribution guide references @oliviertassinari

### Internal

- [code-infra] Remove custom playwright installation steps (#646) @Janpot
- [core] Fix 301 link to Next.js and git diff @oliviertassinari
- [core] Fix package.json repository rule @oliviertassinari
- [core] MUI X repository moved to a new location @oliviertassinari
- [core] React 19 compatibility (#605) @michaldudak
- [core] Reference `ownerDocument` (#660) @atomiks
- [core] Remove 'use client' from index files (#331) @michaldudak
- [core] Remove /.yarn (#596) @oliviertassinari
- [core] Remove Material UI dependency (#585) @michaldudak
- [core] Remove the legacy components from the repo (#584) @michaldudak
- [core] Rename positionStrategy to positionMethod (#704) @michaldudak
- [docs-infra] Fix double // (#613) @oliviertassinari
- [docs-infra] Strengthen CSP (#595) @oliviertassinari
- [infra] Adds reusable workflow for closing message on issues (#598) @michelengelen
- [infra] Adds reusable workflow for issue cleanup (#597) @michelengelen
- [infra] Fix line break in Stack Overflow message @oliviertassinari
- [test] Fix tests on Safari (#546) @michaldudak
- [test] Fix the test_types_next CI job (#703) @michaldudak
- [test] Improve visual screenshot canva (#708)
- [test] Point Istanbul to correct URL (#657) @sai6855
- [test] Run Browserstack tests on master only (#578) @michaldudak
- [test] Use `waitFor` instead of fixed timeout in tests (#632) @michaldudak
- [website] Improve utm_source strategy @oliviertassinari
- [website] Modernize the Base UI website (#538) @michaldudak

All contributors of this release in alphabetical order: @atomiks, @Janpot, @michaldudak, @michelengelen, @mj12albert, @oliviertassinari, @sai6855

## v1.0.0-alpha.2

_Aug 19, 2024_

A big thanks to the 10 contributors who made this release possible. Here are some highlights ✨:

⭐ We added many new components: AlertDialog, Dialog, Field, Menu, Popover, PreviewCard, Progress, Slider, and Tooltip.

### `@base_ui/react@1.0.0-alpha.2`

- [Checkbox] Fix checked change when clicking button with wrapping label (#467) @atomiks
- [Dialog] Create new component and hook (#372) @michaldudak
- [Field] Create new Field components (#477) @atomiks
- [Menu] Overhaul the component API (#468) @michaldudak
- [NumberField] Fix tests on non-English locale machines (#524) @michaldudak
- [NumberField] Rename `onChange` prop to `onValueChange` (#464) @atomiks
- [Popover] Component and Hook (#381) @atomiks
- [Popover] Fix `keepMounted` focus management (#489) @atomiks
- [Popover] Wait for focus to settle in tests (#491) @michaldudak
- [PreviewCard] Create new component (#469) @atomiks
- [PreviewCard] Fix Firefox browser hang (#490) @atomiks
- [Progress] New `Progress` components (#470) @mj12albert
- [Slider] improve `disabled` prop description (#527) @sai6855
- [Slider] New Slider components and hook (#373) @mj12albert
- [Switch/Checkbox] Rename `onChange` prop to `onCheckedChange` (#465) @atomiks
- [Tabs] Fix indicator tests (#379) @michaldudak
- [Tooltip] Component and Hook (#264) @atomiks
- [Tooltip] Fix animations (#426) @atomiks
- [useCompoundParent] Display `displayName` only in dev (#525) @sai6855

### Docs

- [docs] Add badges like in Material UI @oliviertassinari
- [docs] Add the logo to the README (#448) @danilo-leal
- [docs] Convert alpha component docs to new docs template (#392) @colmtuite
- [docs] Correct Bundlephobia links (#419) @michaldudak
- [docs] Fix page description line break @oliviertassinari
- [docs] Fix the X link (#450) @michaldudak
- [docs] Fix Vale errors (#492) @oliviertassinari
- [docs] Prepare security table for once it has its first release (#536) @oliviertassinari
- [docs] Update twitter.com to x.com @oliviertassinari
- [docs][Tooltip] Use the correct version of ComponentLinkHeader (#425) @michaldudak

### Internal

- [code-infra] Fix pnpm version in package.json engines (#409) @Janpot
- [code-infra] Propagate API docs builder package interface changes (#478) @LukasTy
- [code-infra] Remove raw-loader (#404) @michaldudak
- [code-infra] Use shared .stylelintrc.js config (#415) @oliviertassinari
- [core] Add `trackAnchor` prop for anchor positioning (#519) @atomiks
- [core] Add `useAnchorPositioning` Hook (#461) @atomiks
- [core] Add `useTransitionStatus` and `useExecuteIfNotAnimated` Hooks (#396) @atomiks
- [core] Add codeowners file (#447) @michaldudak
- [core] Allow Renovate to update pnpm (#446) @michaldudak
- [core] Encapsulate the common rendering logic in `useComponentRenderer` (#408) @michaldudak
- [core] Fix event naming convention @oliviertassinari
- [core] Improve performance of `mergeProps` (#456) @marcpachecog
- [core] Improve Tooltip and Popover consistency (#463) @atomiks
- [core] Link GH issue for import/prefer-default-export @oliviertassinari
- [core] Make pnpm version permissive (#529) @atomiks
- [core] Move hooks under component directories (#405) @michaldudak
- [core] Move legacy components to a subdirectory (#410) @michaldudak
- [core] Normalize rest / other to match the most common used @oliviertassinari
- [core] Refactor animation hooks (#417) @atomiks
- [core] Remove sources of old components we don't intend to support (#474) @michaldudak
- [core] Simpler pnpm dedupe error message to act on @oliviertassinari
- [core] Upgrade to core-js v3 (#418) @atomiks
- [core] Verify types in test code (#457) @michaldudak
- [dependencies] Do not try to update ESLint (#515) @michaldudak
- [docs-infra] Fix a stylelint issue (#421) @oliviertassinari
- [docs-infra] Integrate the latest @mui/docs (#378) @michaldudak
- [test] Clean up and unify test code (#532) @michaldudak
- [test] Update test-utils and remove enzyme (#473) @michaldudak
- [test] Use internal-test-utils from npm (#424) @michaldudak
- [typescript] Add `type` to export statements (#544) @michaldudak
- [website] Fix /base-ui/ code duplication (#416) @oliviertassinari- [infra] Add support donation button @oliviertassinari
- [website] Redirect to an existing page on dev (#445) @michaldudak

All contributors of this release in alphabetical order: @atomiks, @colmtuite, @danilo-leal, @Janpot, @LukasTy, @marcpachecog, @michaldudak, @mj12albert, @oliviertassinari, @sai6855

## v1.0.0-alpha.1

<!-- generated comparing v1.0.0-alpha.0..master -->

_May 14, 2024_

A big thanks to the 4 contributors who made this release possible. Here are some highlights ✨:

⭐ We overhauled the Tabs components' API and added a few exciting new features to them (#245).

### `@base_ui/react@1.0.0-alpha.1`

- [NumberField] Fix failing browser tests (#317) @atomiks
- [Tabs] Overhaul Tabs API (#245) @michaldudak

## Docs

- Consistent arrow style (#397) @oliviertassinari
- Link to docs on PRs (#394) @oliviertassinari
- Fix Netlify preview 301 JS assets @oliviertassinari
- Reference shared code from the Core monorepo (#326) @michaldudak
- Remove or hide pages describing the old API (#323) @michaldudak
- Prepare React 19 (#393) @oliviertassinari
- Fix incorrect Tabs import instructions (#401) @michaldudak

## Core

- Rely on @mui/monorepo/.eslintrc (#352) @oliviertassinari
- Use Base UI repo in the release changelog script (#355) @michaldudak
- Export NumberField components and hooks (#400) @atomiks
- Config cleanup (#377) @michaldudak
- Make dependency updates less frequent (#375) @michaldudak
- Update @mui deps to next (#354) @atomiks
- Remove legacy dependencies and settings (#332) @michaldudak
- Remove redundant Next.js config (#333) @oliviertassinari
- Use the root dependency (#334) @oliviertassinari
- Clean up unnecessary files (#324) @michaldudak
- Describe how to publish the docs (#320) @michaldudak
- Change the references to the Material UI repo in the releaseTag script (#319) @michaldudak
- Port e2e infra back to Base UI (#395) @oliviertassinari
- Fix Firefox browser version in karma profile config and resolve user-event test TODOs (#353) @ZeeshanTamboli
- Update Karma config (#322) @michaldudak
- Use absolute URLs for non-Base pages (#321) @michaldudak

All contributors of this release in alphabetical order: @atomiks, @michaldudak, @oliviertassinari, @ZeeshanTamboli

## v1.0.0-alpha.0

_Apr 15, 2024_

This is an initial release of Base UI as the @base_ui/react package.
It features the Checkbox, Number Field, and Switch as the first components to be rewritten with a fresh new API. 🚀

### `@base_ui/react@1.0.0-alpha.0`

- [Checkbox] Component and Hook (#159) @atomiks
- [NumberField] Component and Hook (#186) @atomiks
- [Switch] Implement the component-per-node API (#135) @michaldudak
- [core] Rename package to @base_ui/react (#287) @michaldudak
- [core] Exclude legacy components from the package (#288) @michaldudak
