## 26.3.4

- fix(security): `deepExtend` (used by `addResourceBundle(..., deep, overwrite)`) no longer recurses into inherited properties. It checked key existence with the `in` operator, which walks the prototype chain, so a source key matching an inherited built-in (e.g. `hasOwnProperty`, `toString`) caused recursion into the shared `Object.prototype` function and, with `overwrite: true`, could overwrite e.g. `Object.prototype.hasOwnProperty.call` with a non-callable value — corrupting a shared built-in process-wide (DoS). Existence is now checked with `Object.prototype.hasOwnProperty.call`, so such keys are copied as plain own data instead. This complements the existing `__proto__`/`constructor` guard and is also strictly more correct for an own-property merge. Only affects applications that pass attacker-controlled data with `deep: true` and `overwrite: true`; no standard backend/integration does this. Distinct from CVE-2026-48713 / CVE-2026-48714 (different packages, `setPath` mechanism). Thanks to zx (Jace) for the responsible disclosure.

## 26.3.3

- fix(types): selector `t($ => $.arr, { returnObjects: true, context })` on a JSON array of **heterogeneous** objects now preserves each element's full shape (e.g. `{ transKey1: string; transKey2: string }[]`) instead of collapsing to a union of partial element types. Two type-level causes: (1) `FilterKeys` evaluated the whole array element type at once, so `keyof (A | B)` only saw the keys common to every element — it now distributes over the object union and filters each element independently; (2) when TypeScript merges mismatched array element types it injects phantom optional `undefined` keys (e.g. `transKey1_withContext?: undefined` on elements that don't define it), which the context-detection helpers mistook for real context variants — they now skip keys typed as `undefined`. Also adds a dedicated `context` + `returnObjects: true` selector overload using `const Fn` + `ReturnType<Fn>`, so `Target` is no longer collapsed to `unknown` via `ApplyTarget`. Resolves Problem 1 of #2398 (Problem 2 was already fixed on master). Thanks @sauravgupta-dotcom ([#2438](https://github.com/i18next/i18next/pull/2438)). Fixes [#2398](https://github.com/i18next/i18next/issues/2398).

## 26.3.2

- fix: chained formatters with a parenthesised option that contains the format separator (e.g. `join(separator: ', ')`) now work at **any** position in the chain, not just first. Previously the comma-in-parens reassembly only repaired `formats[0]`, so `{{v, uppercase, join(separator: ', ')}}` split the `join(...)` option on the inner comma and never rejoined it, producing corrupt output. Replaced the first-position-only repair with a position-independent pass that re-joins fragments until each open paren closes. Thanks @spokodev ([#2437](https://github.com/i18next/i18next/pull/2437)).

## 26.3.1

- fix(types): `t()` with a `keyPrefix` no longer pollutes its return type with sibling keys' values. A regression in 26.3.0 — the `[Res] extends [never]` guards added to `KeysBuilderWithReturnObjects` / `KeysBuilderWithoutReturnObjects` turned the builders into deferred conditional types, so `KeyPrefix<Ns>` stopped resolving to a literal union and `keyPrefix` inference widened to the whole namespace. Symptom: `useTranslation(ns, { keyPrefix: 'a.b' })` then `t('title')` would resolve to `'<a.b>.title' | '<other.path>.title' | ...` instead of just the scoped value. Affected every `react-i18next` user using `keyPrefix`. Restored to the eager 26.2.0 form. The same-namespace conflict handling from #2434 still works via `_DropConflictKeys` at the merge layer (in `options.d.ts`). Thanks @aaronrosenthal ([#2436](https://github.com/i18next/i18next/pull/2436)).

## 26.3.0

- feat(types): introduce `ResourceNamespaceMap` — a separate mergeable augmentation surface for namespace resource types, designed for monorepos where multiple packages each want to contribute their own namespaces. Previously, every package had to coordinate on a single `CustomTypeOptions.resources` declaration (or fall back to typing dependency namespaces as `any`) because `resources` is a single property of an interface and TypeScript reports TS2717 when two declarations of the same property disagree. The new interface merges naturally across `declare module 'i18next'` blocks, so each package can ship its own `i18next.d.ts` independently. Per-property merge handles same-namespace contributions from multiple packages, and same-key/different-literal conflicts are silently dropped to avoid poisoning `t()` overload resolution. Fully backwards-compatible — existing `CustomTypeOptions.resources` augmentations continue to work, and both surfaces can coexist. Scalar options (`defaultNS`, `returnNull`, `enableSelector`, etc.) still belong on `CustomTypeOptions`. Thanks @sh3xu ([#2434](https://github.com/i18next/i18next/pull/2434)). Fixes [#2409](https://github.com/i18next/i18next/issues/2409).

## 26.2.0

- feat(types): new `parseInterpolation` TypeOption (default `true`). When set to `false` in `CustomTypeOptions`, the type-level extractor stops parsing translation strings for `{{variable}}` patterns. Required by `i18next-icu` users — the default extractor mistakes ICU MessageFormat nested-brace plurals like `{count, plural, one {{count} row} other {{count} rows}}` for an interpolation block and demands a phantom variable name. The flag is type-only; runtime interpolation is governed by `InterpolationOptions` and is unaffected. Fixes [i18next-icu#85](https://github.com/i18next/i18next-icu/issues/85).
- fix(types): expose `enableSelector` on `InitOptions` so `i18next.init({ enableSelector: 'strict' })` typechecks without a module augmentation. The runtime already reads `opts?.enableSelector` from init options; this lands the matching type declaration next to the other selector-resolution knobs. Accepts `false | true | 'optimize' | 'strict'`. Thanks @Faithfinder ([#2431](https://github.com/i18next/i18next/pull/2431))

## 26.1.0

- feat: `enableSelector: 'strict'` (TypeOptions + runtime option). Opt-in mode that drops the flattened-primary form from `NsResource` at the type level — every namespace (primary included) is exposed only under its own key on `$`, uniformly across single- and multi-ns hooks. At runtime, a leading selector path segment matching the scope's namespace list is always rewritten as a namespace prefix, including the primary. Eliminates the silent-miss surface area where `t($ => $.primary.foo)` typechecks but doesn't resolve under the default mode (see [#2429](https://github.com/i18next/i18next/issues/2429)). Backward-compatible: default `enableSelector: false | true | 'optimize'` behavior is unchanged. Note: strict mode is incompatible with the [#2405](https://github.com/i18next/i18next/issues/2405) pattern (keys whose names match sibling namespaces) — those users should stay on default mode.

## 26.0.10

- feat: `getFixedT` accepts a fourth optional `fixedOpts` argument carrying `scopeNs` — the full namespace list the bound `t` was created for. The selector API uses `scopeNs` to detect when a path's first segment is a namespace prefix, **without** changing resolution scope. Resolution still uses the bound `ns` (a single primary string in the typical react-i18next setup), so plain `t('key')` lookups stay isolated to the primary namespace exactly as before — only `t($ => $.secondaryNs.foo)` selectors now route correctly under `useTranslation([nsA, nsB])`. Fixes the runtime side of [#2429](https://github.com/i18next/i18next/issues/2429) for the `react-i18next` default-`nsMode` case. The 4th argument is opt-in: existing 3-arg `getFixedT(lng, ns, keyPrefix)` callers see no behavior change.

## 26.0.9

- fix(types): unformatted interpolation values are now typed as `string | number` (was `string`). i18next stringifies values at runtime, so requiring callers to wrap numbers in `String(...)` for plain `{{var}}` placeholders was unnecessary friction — and could mask the real problem when a non-string value was passed alongside multiple interpolation slots (the `t()` overload resolution would fall through to the 3-arg form and report a confusing "not assignable to string" error against the options object). Typed format specifiers like `{{x, number}}`, `{{x, currency}}`, `{{x, datetime}}`, etc. keep their precise types; this only relaxes the no-format default. The `count` variable remains `number`-only

## 26.0.8

- fix(types): restore the pre-v25.10.4 `ExistsFunction` shape so plain arrow functions can again be assigned to `ExistsFunction`-typed variables (TypeScript cannot infer type predicates through multi-overload assignment). Direct `i18next.exists(key)` calls still narrow `key` to `SelectorKey` — the predicate is now declared inline on `i18n.exists`. Custom wrappers that want the narrowing can type themselves as `typeof i18next.exists` [2425](https://github.com/i18next/i18next/issues/2425)

## 26.0.7

- fix: when a plural lookup misses, the `missingKey` debug log now shows the actual plural-resolved key (e.g. `foo.bar_many` for Polish `count: 14`) instead of the base key — making it obvious which plural category was expected and missing [2423](https://github.com/i18next/i18next/issues/2423)
- chore: drop `@babel/runtime` runtime dependency. The build no longer generates any `@babel/runtime` imports, so the package is unused by consumers. Rollup now uses `babelHelpers: 'bundled'` so any helpers that are ever needed in the future will be inlined rather than imported externally [2424](https://github.com/i18next/i18next/issues/2424)
- chore: stop emitting `dist/esm/i18next.bundled.js`. It was byte-identical to `dist/esm/i18next.js` because no helpers were being imported [2424](https://github.com/i18next/i18next/issues/2424)

## 26.0.6

Security release — all issues found via an internal audit.

- security: warn when a translation string combines `escapeValue: false` with interpolated variables inside a `$t(key, { ... "{{var}}" ... })` nesting-options block. In that narrow combination, attacker-controlled string values containing `"` can break out of the JSON options literal and inject additional nesting options (e.g. redirect `lng`/`ns`). The default `escapeValue: true` configuration is unaffected because HTML-escaping neutralises the quote before `JSON.parse`. See the [security note in the Nesting docs](https://www.i18next.com/translation-function/nesting#security-note-interpolated-values-inside-a-nesting-options-block) for the full pattern and mitigations
- security: apply `regexEscape` to `unescapePrefix` / `unescapeSuffix` on par with the other interpolation delimiters. Prevents ReDoS (catastrophic-backtracking) when a misconfigured delimiter contains regex metacharacters, and fixes silent breakage of the `{{- var}}` syntax when the delimiter contains characters like `(`, `[`, `.`
- security: strip CR/LF/NUL and other C0/C1 control characters from string log arguments to prevent log forging via user-controlled translation keys, language codes, namespaces, or interpolation variable names (CWE-117)
- chore: ignore `.env*` and `*.pem`/`*.key` files in `.gitignore`

## 26.0.5

- fix: `cloneInstance().changeLanguage()` no longer fails to update language state when the target language is not yet loaded — a race between `init()`'s deferred `load()` and the user's `changeLanguage()` could overwrite `isLanguageChangingTo`, causing `setLngProps` to be skipped [2422](https://github.com/i18next/i18next/issues/2422)

## 26.0.4

- fix(types): inline formatting options like `{{price, currency(EUR)}}` are now correctly resolved to their base format type (e.g. `number` for `currency`) instead of falling back to `string` [2378](https://github.com/i18next/i18next/issues/2378)

## 26.0.3

- fix(types): `addResourceBundle` now accepts an optional 6th `options` parameter (`{ silent?: boolean; skipCopy?: boolean }`) matching the runtime API [2419](https://github.com/i18next/i18next/issues/2419)

## 26.0.2

- fix(types): `t("key", {} as TOptions)` no longer produces a type error — the context constraint now bypasses strict checking when `context` is `unknown` (e.g. from `TOptions`) [2418](https://github.com/i18next/i18next/issues/2418)

## 26.0.1

- fix: Formatter no longer crashes when `alwaysFormat` is `true` and no format specifier is present (`format` is `undefined`)
- fix: Formatter now returns `undefined`/`null` values as-is instead of producing `NaN` when the value is missing

## 26.0.0

**This is a major breaking release:**

### Breaking Changes

- **Remove deprecated `initImmediate` option** — the backward-compatibility mapping from `initImmediate` to `initAsync` (introduced in v24) has been removed. Use `initAsync` instead.
- **Remove legacy `interpolation.format` function** — the old monolithic format function (`interpolation: { format: (value, format, lng) => ... }`) is no longer supported. The built-in Formatter (or a custom Formatter module via `.use()`) is now always used. Migrate to the [new formatting approach](https://www.i18next.com/translation-function/formatting) using `i18next.services.formatter.add()` or `.addCached()` for custom formatters.
- **Remove console support notice** — the console support notice introduced in v25.8.0 has been removed, along with the `showSupportNotice` option and all related internal suppression logic (`globalThis.__i18next_supportNoticeShown`, `I18NEXT_NO_SUPPORT_NOTICE` env var). See our blog post for the [full story](https://www.locize.com/blog/i18next-support-notice).
- **Remove `simplifyPluralSuffix` option** — this option was unused by the core PluralResolver (which relies entirely on `Intl.PluralRules`). It only had an effect in the old v1/v2/v3 compatibility layer. The v4 test compatibility layer now defaults to `true` internally.
- **Remove deprecated `@babel/polyfill`** from devDependencies.

### Improvements

- **Code modernization** across all source files:
  - Replace `indexOf() > -1` / `indexOf() < 0` with `.includes()` (~40+ occurrences)
  - Replace `indexOf() === 0` with `.startsWith()` where appropriate
  - Replace `var` with `const`, `'' + object` with `String(object)`, `.substring()` with `.slice()`
  - Replace `.apply(observer, [event, ...args])` with direct call `observer(event, ...args)`
  - Remove unnecessary `.call(this, ...)` in BackendConnector retry logic
  - Fix `array-callback-return` in LanguageUtils `getBestMatchFromCodes`
  - Clean up all stale `eslint-disable` comments from source files
- **EventEmitter**: add `once()` method for one-time event subscriptions
- **Memory leak fix**: move module-level `checkedLoadedFor` cache to Translator instance, preventing cross-instance state leakage
- **TypeScript**: fix `BackendModule` generic parameter naming inconsistency between CJS and ESM type definitions
- **TypeScript**: add `once()` method to `i18n` and `ResourceStore` type interfaces
- **ESLint 9**: migrate from ESLint 8 (airbnb-base) to ESLint 9 flat config with [neostandard](https://github.com/neostandard/neostandard)
- **Vitest 4**: upgrade from vitest 3 to vitest 4, migrate workspace files to `test.projects` config

## 25.10.10

- feat: suppress support notice automatically in production environments (`NODE_ENV=production`)

## 25.10.9

- feat(types): export `SelectorParam<Ns, KPrefix>` helper type — a stable, readable alternative to `Parameters<TFunction<Ns>>[0]` for typing selector function props [2414](https://github.com/i18next/i18next/issues/2414)

## 25.10.8

- fix(types): reorder `TFunctionSelector` overloads so `Parameters<TFunction>` resolves to the general selector signature instead of the branded `SelectorKey` type [2412](https://github.com/i18next/i18next/issues/2412)

## 25.10.7

- feat(types): support typescript 6 to address [https://github.com/i18next/react-i18next/issues/1910](https://github.com/i18next/react-i18next/issues/1910)

## 25.10.5

- feat(types): selector functions as `keyPrefix` in `getFixedT` now provide full type-safe key narrowing — the returned `t` function is scoped to the prefix subtree [2367](https://github.com/i18next/i18next/issues/2367)

## 25.10.4

- feat(types): `exists()` is now a type guard that narrows the key to `SelectorKey`, so a validated key can be passed directly to `t()` [2364](https://github.com/i18next/i18next/issues/2364)

## 25.10.3

- check also for I18NEXT_NO_SUPPORT_NOTICE env variable

## 25.10.2

- feat(types): `keyFromSelector` is now type-safe — the selector callback is constrained against your resource definitions, catching invalid keys at compile time. Supports optional `ns` and `keyPrefix` options for non-default namespace/prefix contexts [2364](https://github.com/i18next/i18next/issues/2364)

## 25.10.1

- fix(types): `FilterKeys` now correctly excludes base keys that have context variants when the provided context doesn't match any of them (e.g. key `some` with variant `some_me` is no longer accessible with `context="one"`)

## 25.10.0

- feat(types): `keyFromSelector` now returns a branded `SelectorKey` type that `t()` accepts directly, enabling pre-computed and reusable translation keys [2364](https://github.com/i18next/i18next/issues/2364)
- feat: support selector syntax for `keyPrefix` in `getFixedT` and per-call options [2367](https://github.com/i18next/i18next/issues/2367)
- feat(types): interpolation values are now automatically typed based on built-in format specifiers — `{{val, number}}` requires `number`, `{{val, datetime}}` requires `Date`, `{{name}}` requires `string`, etc. Custom formatters can be typed via `interpolationFormatTypeMap` in `CustomTypeOptions` [2378](https://github.com/i18next/i18next/issues/2378)
- fix(types): `FilterKeys` in selector mode now preserves non-context, non-plural leaf keys when `context` is provided, fixing incorrect type narrowing when combining `returnObjects: true` with `context` [2398](https://github.com/i18next/i18next/issues/2398)

## 25.9.0

- feat(types): selector API now enforces `{ count: number }` when a key resolves to plural forms [2373](https://github.com/i18next/i18next/issues/2373)
- fix(types): string unions with invalid members are now correctly detected as type errors when used as context option [2172](https://github.com/i18next/i18next/issues/2172)

## 25.8.20

- fix: `getFixedT()` selector now resolves namespaces against the effective `ns` rather than the global init options [2406](https://github.com/i18next/i18next/issues/2406)

## 25.8.19

- fix: selector API namespace resolution regression for single-string `ns` and primary namespace in array [2405](https://github.com/i18next/i18next/issues/2405). Reverts the broad namespace-prefix rewrite from v25.8.15 and replaces it with a targeted fix that only rewrites paths starting with a secondary namespace in a multi-namespace array, matching the type-level contract of `GetSource`

## 25.8.18

- improve selector api to accept array of selector functions, analogous to array of keys [2404](https://github.com/i18next/i18next/issues/2404)

## 25.8.17

- update deps

## 25.8.16

- fix(types): `on()` method now correctly returns `this` instead of `void`, matching the runtime behavior and enabling proper method chaining in TypeScript

## 25.8.15

- fix: Selector API unable to resolve namespaces [2402](https://github.com/i18next/i18next/issues/2402)

## 25.8.14

- fix: getCleanedCode now replaces all underscores

## 25.8.13

- improve support notice shown logic

## 25.8.12

- improve support notice shown logic

## 25.8.11

- revert fix: compatibility with moduleResolution bundler (issue [2380](https://github.com/i18next/i18next/issues/2380)) [2381](https://github.com/i18next/i18next/pull/2381)

## 25.8.10

- fix(interpolator): guard null matchedDoubleQuotes in nesting option parsing [2395](https://github.com/i18next/i18next/pull/2395)

## 25.8.9

- fix(interpolator): escape nestingOptionsSeparator in nesting option parsing [2394](https://github.com/i18next/i18next/pull/2394)

## 25.8.8

- types(i18n): add missing toJSON() declaration [2393](https://github.com/i18next/i18next/pull/2393)

## 25.8.7

- avoid crash due to ReferenceError without Intl API [2391](https://github.com/i18next/i18next/pull/2391)

## 25.8.6

- ts: address incomplete type definition for `getFixedT()` return value [2318](https://github.com/i18next/i18next/issues/2318)

## 25.8.5

- fix: compatibility with moduleResolution bundler (issue [2380](https://github.com/i18next/i18next/issues/2380)) [2381](https://github.com/i18next/i18next/pull/2381)

## 25.8.4

- fix: crashes when backend in backends array has no name property [2386](https://github.com/i18next/i18next/issues/2386)

## 25.8.3

- ts: document option to suppress the support message [2385](https://github.com/i18next/i18next/issues/2385)

## 25.8.2

- option to suppress the support message [2385](https://github.com/i18next/i18next/issues/2385)

## 25.8.1

- fix(types): Selector API - fix Namespace inference for selector ns option [2384](https://github.com/i18next/i18next/pull/2384)

## 25.8.0

- fix: TFunctionReturn fallback [2360](https://github.com/i18next/i18next/issues/2360)
- chore: added a `console.info` support notice regarding the open-source sustainability of the i18next ecosystem. _(Note: This can be easily suppressed via `showSupportNotice: false`, `globalThis`, or environment variables. See [the FAQ](https://www.locize.com/docs/general-questions/why-am-i-seeing-a-support-notice-for-i18next) for details on how to disable it)._

## 25.7.4

- fix: Interpolation breaks when cloning an instance [2376](https://github.com/i18next/i18next/issues/2376)

## 25.7.3

- type definitions for new transDefaultProps option in react-i18next [react-i18next: #1895](https://github.com/i18next/react-i18next/issues/1895)

## 25.7.2

- fix: Invalid overwrite of default value for overloadTranslationOptionHandler [2374](https://github.com/i18next/i18next/issues/2374).

## 25.7.1

- TS: remove wrong signature [2372](https://github.com/i18next/i18next/issues/2372).

## 25.7.0

- Enhance `cloneInstance` to create a new interpolator if interpolation options are passed in. This will address [2371](https://github.com/i18next/i18next/issues/2371).

## 25.6.3

- chore: dependency updates [2368](https://github.com/i18next/i18next/issues/2366)

## 25.6.2

- types: export `InterpolationMap`

## 25.6.1

- fix: createInstance does not exist on an instance [2366](https://github.com/i18next/i18next/issues/2366)

## 25.6.0

- **feat**: `exists()` method now respects `returnObjects` option - returns `false` when accessing an object key with `returnObjects: false`, enabling detection of object vs string keys [2359](https://github.com/i18next/i18next/issues/2359)

  **Note**: This is a potential behavior change. If you were previously calling `exists()` with `returnObjects: false` on object keys, those calls will now return `false` instead of `true`. This enables developers to detect whether a key points to an object or string value.

## 25.5.3

- export esm type declaration for keyFromSelector [2356](https://github.com/i18next/i18next/pull/2356)

## 25.5.2

- fix [last change](https://github.com/i18next/i18next/pull/2347) => for cjs there is just 1 default export, no named exports, fixes [2348](https://github.com/i18next/i18next/issues/2348)

## 25.5.1

- export keyFromSelector from index.cjs [2347](https://github.com/i18next/i18next/pull/2347)

## 25.5.0

- export keyFromSelector function for testing purposes [2346](https://github.com/i18next/i18next/pull/2346)

## 25.4.2

- fix: enableSelector: true doesn't work with custom keySeparator [2341](https://github.com/i18next/i18next/issues/2341)

## 25.4.1

- fix: KeyPrefix not working with new selector api [2340](https://github.com/i18next/i18next/issues/2340)

## 25.4.0

- add new selector API to improve TypeScript IDE performance [2322](https://github.com/i18next/i18next/pull/2322)
  - To enable it, set `enableSelector: true` in your configuration options
  - With `enableSelector: "optimize"`, i18next can now handle translation dictionaries of any size, without affecting IDE performance or build times
  - To assist with the migration, we've published the following packages:
    - [@i18next-selector/codemod](https://github.com/ahrjarrett/i18next-selector/tree/main/packages/codemod)
    - [@i18next-selector/vite-plugin](https://github.com/ahrjarrett/i18next-selector/tree/main/packages/vite-plugin)

## 25.3.6

- improve fix: Ordinals and non-ordinals don't work together [2337](https://github.com/i18next/i18next/issues/2337)

## 25.3.5

- fix: Ordinals and non-ordinals don't work together [2337](https://github.com/i18next/i18next/issues/2337)

## 25.3.4

- remove unnecessary debug logs

## 25.3.3

- fix: Brackets breaking nesting interpolation [2336](https://github.com/i18next/i18next/issues/2336)

## 25.3.2

- fix `dir()` for non-Intl language codes [2330](https://github.com/i18next/i18next/issues/2330)

## 25.3.1

- warn if legacy `interpolation.format` function is still used

## 25.3.0

- feat: support formatting function with plural and interpolation [2325](https://github.com/i18next/i18next/pull/2325)
- fix `dir()` for Latn language codes [2324](https://github.com/i18next/i18next/issues/2324)

## 25.2.1

- streamline `fallbackLng` option of t call with the init options [2312](https://github.com/i18next/i18next/issues/2312)

## 25.2.0

- introduce `cacheInBuiltFormats` option to address [2227](https://github.com/i18next/i18next/issues/2227)

## 25.1.3

- Ensure nsSeparator is respected when appendNamespaceToMissingKey is true [2311](https://github.com/i18next/i18next/pull/2311), fixes [2310](https://github.com/i18next/i18next/issues/2310)

## 25.1.2

- do not mutate t options, fixes [2307](https://github.com/i18next/i18next/issues/2307)

## 25.1.1

- fix options type for `parseMissingKeyHandler`

## 25.1.0

- feat: `parseMissingKeyHandler` now takes options as parameter like in missingKeyHandler [2304](https://github.com/i18next/i18next/issues/2304)

## 25.0.2

- fix `cloneInstance` with `forkResourceStore: true` addresses [2303](https://github.com/i18next/i18next/issues/2303)

## 25.0.1

- optimize `changeLanguage` to correctly use `getBestMatchFromCodes` (string or array) [2299](https://github.com/i18next/i18next/issues/2299) and improve `resolvedLanguage` set for non canonical codes

## 25.0.0

**This is a potentially breaking release:**

- fix multiple changeLanguage call that may have result in wrong order in previous versions [1605](https://github.com/i18next/i18next/issues/1605) [2298](https://github.com/i18next/i18next/pull/2298)
- adapt `changeLanguage` to always (string or array) use `getBestMatchFromCodes` [2299](https://github.com/i18next/i18next/issues/2299)
- `getBestMatchFromCodes` now tries to fallback to language code with same script [2299](https://github.com/i18next/i18next/issues/2299)

## 24.2.3

- Upgrade @babel/runtime package to version v7.26.10 [2293](https://github.com/i18next/i18next/issues/2293)

## 24.2.2

- fix: Interpolation fails with arrays (TypeError) and doesn't work with objects in defaultValue [1829](https://github.com/i18next/react-i18next/issues/1829)

## 24.2.1

- Standardize null/undefined checks across codebase [2275](https://github.com/i18next/i18next/pull/2275)
- fix(typescript): make TFunction augmentable again [2279](https://github.com/i18next/i18next/pull/2279), fixes [2278](https://github.com/i18next/i18next/issues/2278)

## 24.2.0

- feat(typescript): Add strictKeyChecks option to enforce checking key existence when defaultValue is used [2274](https://github.com/i18next/i18next/pull/2274), fixes [2043](https://github.com/i18next/i18next/issues/2043)

## 24.1.2

- optimize fix: Bug Report: Unsafe Behavior in i18n.t Function Leading to Potential Code Execution [2273](https://github.com/i18next/i18next/issues/2273)

## 24.1.1

- fix: Bug Report: Unsafe Behavior in i18n.t Function Leading to Potential Code Execution [2273](https://github.com/i18next/i18next/issues/2273)

## 24.1.0

- try to address [2270](https://github.com/i18next/i18next/issues/2270) by cloning the store data [2271](https://github.com/i18next/i18next/pull/2271)

## 24.0.5

- remove extra log for [2268](https://github.com/i18next/i18next/pull/2268)

## 24.0.4

- simplify fix: incorrect locale detected [2268](https://github.com/i18next/i18next/pull/2268)

## 24.0.3

- fix: incorrect locale detected [2268](https://github.com/i18next/i18next/pull/2268)
- fix: Intl.getCanonicalLocales throws with custom regions [2267](https://github.com/i18next/i18next/issues/2267)

## 24.0.2

- if no Intl api, log error and use dummy rule

## 24.0.1

- early return and log error, if no Intl api

## 24.0.0

**This is a major breaking release:**

- remove support for older environments
- remove old i18next JSON formats
  - To convert your existing v3 translations to the v4 format, have a look at [i18next-v4-format-converter](https://github.com/i18next/i18next-v4-format-converter) or this [web tool](https://i18next.github.io/i18next-v4-format-converter-web/).
- remove support for compatibility to v1 API
- Intl API is mandatory now and will not fallback anymore
- possible compatibility layer for older formats: `test/compatibility/v4/v4Compatibility.js`
- rename `initImmediate` to `initAsync`
- fallback to `dev` language if plural rule not found
- Dropped support for Node.js < v14
- remove TypeScript v4 support. TypeScript v5 is now an optional peer dependency
- addresses
  - [2244](https://github.com/i18next/i18next/pull/2244)
  - [2184](https://github.com/i18next/i18next/pull/2184)
  - [2213](https://github.com/i18next/i18next/issues/2213)
  - [2206](https://github.com/i18next/i18next/pull/2206)
  - [2208](https://github.com/i18next/i18next/issues/2208)
  - [2148](https://github.com/i18next/i18next/issues/2148)
  - [2254](https://github.com/i18next/i18next/issues/2254)

➡️ check out the [migration guide](https://www.i18next.com/misc/migration-guide#v23.x.x-to-v24.0.0)

## 23.16.8

- fix(plural): Create cache entry for PluralRules created as part of the fallback flow [2256](https://github.com/i18next/i18next/pull/2256)

## 23.16.7

- if plural rule is not found, try to search with language only code [2252](https://github.com/i18next/i18next/issues/2252)

## 23.16.6

- fix: Small typo in the type definitions [2250](https://github.com/i18next/i18next/pull/2250)

## 23.16.5

- fix extractFromKey for use cases like [this](https://github.com/i18next/react-i18next/issues/1810)

## 23.16.4

- revert formatter change [2247](https://github.com/i18next/i18next/pull/2247) because of caching not working anymore

## 23.16.3

- fix utils imports for Deno

## 23.16.2

- perf(size): Adds a isString utility [2248](https://github.com/i18next/i18next/pull/2248)

## 23.16.1

- perf: Optimize size of Formatter [2247](https://github.com/i18next/i18next/pull/2247)

## 23.16.0

- use `Intl.getCanonicalLocales` function if available to format language code, like suggested in [2244](https://github.com/i18next/i18next/pull/2244)

## 23.15.2

- fix(types): make context related keys detection stricter [2243](https://github.com/i18next/i18next/pull/2243) fixes [2242](https://github.com/i18next/i18next/issues/2242)

## 23.15.1

- types(TFunction): make return not inferrable and use defaultValue as return when provided [2234](https://github.com/i18next/i18next/pull/2234)

## 23.15.0

- support unescaped variables in TypeScript [2233](https://github.com/i18next/i18next/pull/2233)

## 23.14.0

- If backend errors with retry flag, set internal state to 0, so reloadingResources should work [147](https://github.com/i18next/i18next-http-backend/issues/147)

## 23.13.0

- Cache output of getRule to optimize performance [2226](https://github.com/i18next/i18next/pull/2226)

## 23.12.7

- revert last optimization to address [2227](https://github.com/i18next/i18next/issues/2227)

## 23.12.6

- remove console.log statement [2227](https://github.com/i18next/i18next/issues/2227)

## 23.12.5

- try to optimize last fix for [2227](https://github.com/i18next/i18next/issues/2227)

## 23.12.4

- try to address [2227](https://github.com/i18next/i18next/issues/2227) without the removal of cached formatter for in-built formatters

## 23.12.3

- fix: Using a comma in a formatter parameter [2225](https://github.com/i18next/i18next/issues/2225)

## 23.12.2

- fix: Nested translation resolution between languages uses the fallback language for nested translations [2216](https://github.com/i18next/i18next/issues/2216) by preserving issue fix "`lng` is undefined when formatter used in `$t( )`" [1938](https://github.com/i18next/i18next/issues/1938)

## 23.12.1

- Use explicit imports for utils [2212](https://github.com/i18next/i18next/pull/2212)

## 23.12.0

- feat: Add posibility to override keyPrefix for certain translation. [2211](https://github.com/i18next/i18next/issues/2211)

## 23.11.5

- perf: use Array.isArray() [2193](https://github.com/i18next/i18next/pull/2193)
- perf: trim keys once [2194](https://github.com/i18next/i18next/pull/2194)

## 23.11.4

- perf(interpolator): use object deconstruction [2181](https://github.com/i18next/i18next/pull/2181)

## 23.11.3

- fix: Unsupported language is automatically added to preload option [2178](https://github.com/i18next/i18next/issues/2178)

## 23.11.2

- allow defaultValue in nested translation [2174](https://github.com/i18next/i18next/issues/2174)

## 23.11.1

- types: remove const from ParseKeys Context type parameter and disable `skipLibCheck` [2169](https://github.com/i18next/i18next/pull/2169)

## 23.11.0

- Fix typing performance regression [2166](https://github.com/i18next/i18next/pull/2166)

## 23.10.1

- optimize getBestMatchFromCodes for https://github.com/i18next/i18next-browser-languageDetector/issues/281

## 23.10.0

- Add 'isInitializing' property so we're able to detect init() was already called [2141](https://github.com/i18next/i18next/issues/2141)

## 23.9.0

- types: support nested keys in `InterpolationMap` [2140](https://github.com/i18next/i18next/pull/2140) fixes [2014](https://github.com/i18next/i18next/issues/2014)

## 23.8.3

- prevent resource mutation when using `addResourceBundle` [2081](https://github.com/i18next/i18next/issues/2081)

## 23.8.2

- optimize `addResources` to address [2130](https://github.com/i18next/i18next/issues/2130)

## 23.8.1

- types: support stricter typechecking for returnEmptyString and returnNull [2129](https://github.com/i18next/i18next/pull/2129)

## 23.8.0

- improve performance by reducing array slices and RegExp recreation [2128](https://github.com/i18next/i18next/pull/2128)

## 23.7.20

- optimize: consistent \_zero special handling also for defaultValue_zero [2124](https://github.com/i18next/i18next/issues/2124)
- intl plural rule for dev is now en (consistent with v3 compatibility)

## 23.7.19

- fix: consistent \_zero special handling also for defaultValue_zero [2124](https://github.com/i18next/i18next/issues/2124)

## 23.7.18

- types: support readonly defaultNS [2123](https://github.com/i18next/i18next/pull/2123)

## 23.7.17

- types: fix support for defaultNS as array (fixes [2118](https://github.com/i18next/i18next/issues/2118)) [2121](https://github.com/i18next/i18next/pull/2121)
- types: fix typo in `CustomInstanceExtensions` [2122](https://github.com/i18next/i18next/pull/2122)

## 23.7.16

- fix: Use Typescript 5 types with Typescript 5+ [2108](https://github.com/i18next/i18next/pull/2108)
  - Hint: If you're using TypeScript 4 and you navigate to the type definitions in your code editor, it might be you will see the TypeScript 5 types, but the TS compiler should use the correct types.

## 23.7.15

- types: simplifies types for array access and fixes [2103](https://github.com/i18next/i18next/issues/2103)

## 23.7.14

- types: fix types for array access

## 23.7.13

- types: optimise ParseTReturn [2095](https://github.com/i18next/i18next/pull/2095)

## 23.7.12

- types: fix for older ts version (context validation only for TS 5)

## 23.7.11

- types: fix for older ts versions [2090](https://github.com/i18next/i18next/issues/2090)

## 23.7.10

- types: initializedStoreOnce and initializedLanguageOnce [2089](https://github.com/i18next/i18next/pull/2089)

## 23.7.9

- types: fix FormatFunction should allow any value inside options parameter

## 23.7.8

- prevent cosmetic SyntaxError because of non catched error variable

## 23.7.7

- optimize TypeScript V4 export

## 23.7.6

- types: CustomInstanceExtenstions

## 23.7.5

- fix types export for TypeScript v4 in combination with react-i18next

## 23.7.4

- fix for TypeScript v4 in combination with react-i18next

## 23.7.3

- fix: consider importing '\*.js'

## 23.7.2

- types: optimize mts

## 23.7.1

- fix some mjs typings

## 23.7.0

- fix: separate cjs and mjs typings [2010](https://github.com/i18next/i18next/issues/2010)
- fix: consider importing './typescript/t.js' [2048](https://github.com/i18next/i18next/issues/2048)

## 23.6.0

- add interpolation data to response if returnDetails is true [2053](https://github.com/i18next/i18next/pull/2053)

## 23.5.1

- types: use unknown to better infer types on nested t functions also for older typescript version [2032](https://github.com/i18next/i18next/issues/2032)

## 23.5.0

- types: use unknown to better infer types on nested t functions [2018](https://github.com/i18next/i18next/pull/2018)

## 23.4.9

- fix: preload languages also on cimode, if configured also as fallbackLng

## 23.4.8

- fix: preload languages also on cimode, if configured

## 23.4.7

- preload languages also on cimode, if configured

## 23.4.6

- pass correct language for custom i18nFormat

## 23.4.5

- types: named export for FlatNamespace

## 23.4.4

- types: add customisation of contextSeparator also on v4 t types [2019](https://github.com/i18next/i18next/pull/2019)

## 23.4.3

- types: add customisation of contextSeparator [2017](https://github.com/i18next/i18next/pull/2017)

## 23.4.2

- types: export some types for next-i18next

## 23.4.1

- types: fix typescript imports

## 23.4.0

- types: Support const modifier for options and key [2007](https://github.com/i18next/i18next/pull/2007)
- types: Support context [2006](https://github.com/i18next/i18next/pull/2006)

## 23.3.0

- types: Fix performance issue that affects flat object with multiple (thousands) keys [2004](https://github.com/i18next/i18next/pull/2004)

## 23.2.11

- types: Fix $TFunctionBrand [1997](https://github.com/i18next/i18next/pull/1997)

## 23.2.10

- types: emit function can have additional arguments [1993](https://github.com/i18next/i18next/issues/1993)

## 23.2.9

- types: Add brand to TFunction type so different namespaces' TFunctions are not treated as compatible [1994](https://github.com/i18next/i18next/pull/1994)

## 23.2.8

- types for hasLoadedNamespace

## 23.2.7

- fix utils import (for Deno)

## 23.2.6

- Re-allow unknown keys, when a defaultValue is provided [1867](https://github.com/i18next/i18next/issues/1867)

## 23.2.5

- Clean language code before passing to formatters [1988](https://github.com/i18next/i18next/pull/1988)

## 23.2.4

- types: Constrain return type when returnObjects is true [1985](https://github.com/i18next/i18next/pull/1985)

## 23.2.3

- types: Optimize logic for fallback ns [1984](https://github.com/i18next/i18next/pull/1984)

## 23.2.2

- types: try to fix fallbackNS type handling also for older TS version [1981](https://github.com/i18next/i18next/issues/1981)

## 23.2.1

- types: fix fallbackNS type handling [1979](https://github.com/i18next/i18next/pull/1979)

## 23.2.0

- types: add fallbackNS type handling [1975](https://github.com/i18next/i18next/pull/1975)

## 23.1.0

- cloneInstance: introduce `forkResourceStore` [1974](https://github.com/i18next/i18next/issues/1974)
- types: default argument values for ParseKeys type

## 23.0.2

- refactor: static createInstance for wider browser support [1973](https://github.com/i18next/i18next/pull/1973)

## 23.0.1

- types: export ParseKeys

## 23.0.0

**This is a major breaking release:**

- redesigned TypeScript types [1911](https://github.com/i18next/i18next/pull/1911)
- removed `setDebug` function in the logger: [1954](https://github.com/i18next/i18next/issues/1954#issuecomment-1537117407)
- changed `returnNull` default to `false` [1885](https://github.com/i18next/i18next/pull/1885)
- drop support for old browsers and Node.js < v12 [1948](https://github.com/i18next/i18next/issues/1948)

- ordinal plural keys are now prefixed with `_ordinal` to help translators (non-breaking, because of fallback) [1945](https://github.com/i18next/i18next/pull/1945)

➡️ check out the [migration guide](https://www.i18next.com/misc/migration-guide#v22.x.x-to-v23.0.0)

## 22.5.1

- ResourceStore addResource: offer possibility to pass keySeparator via options [1968](https://github.com/i18next/i18next/issues/1968)

## 22.5.0

- extend hasLoadedNamespace function options to pass optional lng to optimize server side usage of react-i18next

## 22.4.15

- fix: function t() passed options alteration [1947](https://github.com/i18next/i18next/issues/1947)

## 22.4.14

- fix: pass lng to format function used in nesting [1938](https://github.com/i18next/i18next/issues/1938)

## 22.4.13

- fix: deepFind as fallback for interpolation [1930](https://github.com/i18next/i18next/issues/1930)

## 22.4.12

- fix: getBestMatchFromCodes when dev is a supported lng [1927](https://github.com/i18next/i18next/issues/1927)

## 22.4.11

- types: fix postProcessor key argument type, fixes [1919](https://github.com/i18next/i18next/issues/1919)

## 22.4.10

- format options are optional, fixes [1913](https://github.com/i18next/i18next/issues/1913)

## 22.4.9

- fix: getFixedT with keyPrefix and fallback keys usage [1604](https://github.com/i18next/react-i18next/issues/1604)

## 22.4.8

- fix: nested interpolation with data model "replace"

## 22.4.7

- fix: interpolation with data model "replace"

## 22.4.6

- types: missing dir function export for typescript

## 22.4.5

- types: allow als general options as second argument for t function

## 22.4.4

- types: fix some strange t function overloads fixes [1882](https://github.com/i18next/i18next/issues/1882)

## 22.4.3

- types: t function overloads fix (open issue is still calling t with optional options argument)

## 22.4.2

- types: t function overloads for call with ns option in combination with objects

## 22.4.1

- types: more t function overloads for call with options argument but without ns value

## 22.4.0

- types: more overloads for t function

## 22.3.0

- offer possibility to define a language detector's detect function as promise

## 22.2.0

- types: extend the init method with a generic parameter for backend options [1878](https://github.com/i18next/i18next/pull/1878), [105](https://github.com/i18next/i18next-http-backend/pull/105), [34](https://github.com/i18next/i18next-fs-backend/pull/34)

## 22.1.5

- types: ability to pass ns as option instead of prefix i.e. `i18next.t('bar', { ns: 'alternate' });`

## 22.1.4

- dir function executable also without initialization

## 22.1.3

- named export for dir function

## 22.1.2

- revert: guess if languageDetector is async if no info provided

## 22.1.1

- guess if languageDetector is async if no info provided

## 22.1.0

- extend backend connector to accept also backends with promise / async-await signature

## 22.0.8

- fix options for continuous nesting [1876](https://github.com/i18next/i18next/issues/1876)

## 22.0.7

- Expose some types [1871](https://github.com/i18next/i18next/pull/1871)

## 22.0.6

- fix CallbackError type

## 22.0.5

- Change DefaultTFuncReturn to return null if returnNull typeOption is true [1865](https://github.com/i18next/i18next/pull/1865)

## 22.0.4

- Add type for Formatter.addCached [1862](https://github.com/i18next/i18next/pull/1862)

## 22.0.3

- Make getFixedT type-safe [1860](https://github.com/i18next/i18next/pull/1860)
- types: Omit object from t function [1858](https://github.com/i18next/i18next/pull/1858)

## 22.0.2

- [TypeScript] Add default value for TDefaultResult [1853](https://github.com/i18next/i18next/pull/1853)

## 22.0.1

- Fix normalize type options [1850](https://github.com/i18next/i18next/pull/1850)

## 22.0.0

- Make the translation function fully type-safe [1775](https://github.com/i18next/i18next/pull/1775)

BREAKING:
Since this is a major rewrite for [TypeScript usage](https://www.i18next.com/overview/typescript) we decided to create a major version.
For JavaScript users v22.0.0 is equivalent to 21.10.0

## 21.10.0

- Add formatter cache [1843](https://github.com/i18next/i18next/pull/1843)

## 21.9.2

- optimize single quotes replacement for $t() nesting [1836](https://github.com/i18next/i18next/issues/1836)

## 21.9.1

- defaultNS can now also be set to false

## 21.9.0

- Add Customizable Retry Logic [1810](https://github.com/i18next/i18next/pull/1810)
- types: extend compatibilityJSON with v4

## 21.8.16

- types: fix getDataByLanguage type [1810](https://github.com/i18next/i18next/pull/1810)

## 21.8.15

- fix: make sure retry logic ends for failed backend reads

## 21.8.14

- allow overriding keyPrefix option t function returned from getFixedT (does not work for normal t function)

## 21.8.13

- types: new optional unescape option for react-i18next

## 21.8.12

- fix: respect pluralSeparator for special \_zero handling

## 21.8.11

- fix: types should always come first in exports [1796](https://github.com/i18next/i18next/pull/1796)

## 21.8.10

- types: fix loaded event result

## 21.8.9

- fix: deepFind for null values [1790](https://github.com/i18next/i18next/issues/1790)

## 21.8.8

- fix: loadNamespaces() doesn't keep resolving order when the second request completes before the first one [1785](https://github.com/i18next/i18next/issues/1785)

## 21.8.7

- fix: allow formatters having '' for string options eg. `this is an {{val, array(join: ' | ’)}}`

## 21.8.6

- fix: regression introduced in v21.6.11, respect `appendNamespaceToMissingKey` for `parseMissingKeyHandler` [1507](https://github.com/i18next/react-i18next/issues/1507)

## 21.8.5

- fix: interpolation with $ in values resets nextIndex to wrong position with skipOnVariables [1782](https://github.com/i18next/i18next/issues/1782)

## 21.8.4

- types: keyPrefix in react options

## 21.8.3

- prevent chrome warnings because of `window.navigator.userAgent` usage [1778](https://github.com/i18next/i18next/issues/1778)

## 21.8.2

- types: add saveMissingPlurals option [1774](https://github.com/i18next/i18next/issues/1774)

## 21.8.1

- fix regression introduced with [1768](https://github.com/i18next/i18next/pull/1768)

## 21.8.0

- add maxParallelReads option, default 10 [1771](https://github.com/i18next/i18next/pull/1771)
- reduce CPU usage loading large numbers of items [1768](https://github.com/i18next/i18next/pull/1768)

## 21.7.1

- types: missing returnDetails option in init options [1765](https://github.com/i18next/i18next/issues/1765)

## 21.7.0

- introduce returnDetails option [1764](https://github.com/i18next/i18next/pull/1764)

## 21.6.16

- fix: defaultVariables were not accessible inside plugin parse function [1751](https://github.com/i18next/i18next/pull/1751)

## 21.6.15

- fix hasLoadedNamespace when providing inmemory resources and a backend but partialBundledLanguages is not set

## 21.6.14

- fix formatter for false inline options

## 21.6.13

- make sure resolvedLanguage is set if lazy loading resources

## 21.6.12

- fix ordinal-suffixes for saveMissingWithPlurals [1734](https://github.com/i18next/i18next/pull/1734)

## 21.6.11

- make sure key and additionally optional defaultValue are passed to parseMissingKeyHandler function [1445](https://github.com/i18next/react-i18next/issues/1445)

## 21.6.10

- fix: types for hasLoadedNamespace [1724](https://github.com/i18next/i18next/pull/1724)

## 21.6.9

- fix: respect skipOnVariables option passed in t function also for $t() usage

## 21.6.8

- fix: respect skipOnVariables option passed in t function

## 21.6.7

- fix: consistently lowercase new formatter names internally

## 21.6.6

- fix: deepFind fallback when accessing missing flat dotted key [1719](https://github.com/i18next/i18next/issues/1719)

## 21.6.5

- fix: passed format parameter value truncation in options argument for custom formatter [1715](https://github.com/i18next/i18next/issues/1715)

## 21.6.4

- fix: skipOnVariables (and all other interpolation options should respect defaults) [1711](https://github.com/i18next/i18next/issues/1711)

## 21.6.3

- types: wait option does not exist anymore for react-i18next

## 21.6.2

- remove console.log statement

## 21.6.1

- fix when completely lazy loading namespaces [1709](https://github.com/i18next/i18next/issues/1709)

## 21.6.0

- add \_zero suffix lookup if count === 0 [1705](https://github.com/i18next/i18next/pull/1705)

## 21.5.6

- fix: correct defaults for plural forms (if supplied) [1703](https://github.com/i18next/i18next/issues/1703)

## 21.5.5

- fix: prevent TypeError when using `returnObjects: true` with non string values [1702](https://github.com/i18next/i18next/issues/1702)

## 21.5.4

- include version info in generated package.json of esm dist

## 21.5.3

- do not use options.interpolation reference

## 21.5.2

- missing named exports for TypeScript usage [1692](https://github.com/i18next/i18next/issues/1692)

## 21.5.1

- add package.json to exports subpath

## 21.5.0

- named exports for esm usage [1681](https://github.com/i18next/i18next/pull/1681)

## 21.4.2

- trim multiple formatters, fixes [1689](https://github.com/i18next/i18next/issues/1689)

## 21.4.1

- rtl fix for -arab language codes

## 21.4.0

- bind all i18next functions to this, this way you can for example just use t() instead of i18n.t() [1682](https://github.com/i18next/i18next/issues/1682)

## 21.3.3

- apply default interpolation formatter when interpolation options don't specify one [1680](https://github.com/i18next/i18next/issues/1680)

## 21.3.2

- formatter typescript declarations [1679](https://github.com/i18next/i18next/pull/1679)

## 21.3.1

- get rid of internal isDummy check to prevent react-native issue [1675](https://github.com/i18next/i18next/issues/1675)

## 21.3.0

- adds support for formats provided by Intl API (number, currency, datetime, relativedate, list)

## 21.2.6

- optimize do skip natural language detection also if user provided nsSeparator option is passed via direct options

## 21.2.5

- do skip natural language detection also if user provided nsSeparator option is passed [1665](https://github.com/i18next/i18next/issues/1665)

## 21.2.4

- optimize Intl api check

## 21.2.3

- fix Intl.PluralRules fallback

## 21.2.2

- log error if Intl.PluralRules API is not available

## 21.2.1

- do skip natural language detection, if user provided keySeparator option is passed [1670](https://github.com/i18next/i18next/issues/1670)

## 21.2.0

- provide bundled esm distributable [1667](https://github.com/i18next/i18next/issues/1667)

## 21.1.1

- optimize natural language detection [1661](https://github.com/i18next/i18next/issues/1661)

## 21.1.0

- A new RTL support added for `ckb` language code

## 21.0.2

- fix defaultNS regression if translation namespace is defined in ns option, fixes #1658

## 21.0.1

- fix typescript typo for skipOnVariables

## 21.0.0

**This is a major breaking release:**

- introduce new v4 json format (intl plural forms with ordinal support), simplifyPluralSuffix not used anymore
- `skipOnVariables` by default now is true
- automatically detect natural language keys (no need to set nsSeparator or keySeparator to false)
- remove deprecated whitelist features
- introduce new i18next.resolvedLanguage property

➡️ check out the [migration guide](https://www.i18next.com/misc/migration-guide#v20.x.x-to-v21.0.0)

## 20.6.1

- fix deepFind if looking for nesting array item

## 20.6.0

- feature: key prefix option [1644](https://github.com/i18next/i18next/pull/1644)

## 20.5.0

- introduce missingKeyNoValueFallbackToKey option

## 20.4.0

- change to return false when a nullable argument is passed [1635](https://github.com/i18next/i18next/pull/1635)
- make sure parseMissingKeyHandler is called when defaultValue is provided [1354](https://github.com/i18next/react-i18next/issues/1354)
- types: Fix i18n.use() cannot pass module constructors in TypeScript [1442](https://github.com/i18next/i18next/pull/1442)
- types: fix TypeScript definition for "loaded" event handler [1637](https://github.com/i18next/i18next/issues/1637)

## 20.3.5

- change init warning to only trigger if not using useSSR on react-i18next

## 20.3.4

- fix(types): only use readonly array of strings in API [1629](https://github.com/i18next/i18next/pull/1629)

## 20.3.3

- add transWrapTextNodes to types [1626](https://github.com/i18next/i18next/pull/1626)

## 20.3.2

- context can also be a number [1622](https://github.com/i18next/i18next/issues/1622)

## 20.3.1

- add 'ns' to the 'returnedObjectHandler' options [1619](https://github.com/i18next/i18next/pull/1619)
- disable warn 'accessing an object' when the 'returnedObjectHandler' is defined [1617](https://github.com/i18next/i18next/pull/1617)

## 20.3.0

- add simple toJSON function to fix uncontrolled serialization, fixes [1322](https://github.com/i18next/react-i18next/issues/1322)

## 20.2.4

- fix types for LanguageDetector detect function

## 20.2.3

- if detected lng is falsy, set it to empty array, to make sure at least the fallbackLng will be used

## 20.2.2

- fix plural equations for Kazakh [1608](https://github.com/i18next/i18next/pull/1608)

## 20.2.1

- fix lastIndex in regex when skipOnVariables is true

## 20.2.0

- add ignoreJSONStructure into the types
- stop recursive interpolation also for "{{variable}}" when skipOnVariables is true [1595](https://github.com/i18next/i18next/issues/1595)
- old browser fix for "includes" usage [1597](https://github.com/i18next/i18next/pull/1597)

## 20.1.0

- Add alwaysFormat into the types [1586](https://github.com/i18next/i18next/pull/1586)
- Add interpolation key name to format function [1571](https://github.com/i18next/i18next/pull/1571)

## 20.0.0

- add support to proper augment PluginOptions type [1583](https://github.com/i18next/i18next/pull/1583)
- introduce ignoreJSONStructure flag, to automatically lookup for a flat key if a nested key is not found an vice-versa [1584](https://github.com/i18next/i18next/pull/1584) (MAJOR: because of ignoreJSONStructure is true by default)

## 19.9.2

- try to fix another edge case issue [1570](https://github.com/i18next/i18next/issues/1570) introduces by fixing [1552](https://github.com/i18next/i18next/issues/1552)

## 19.9.1

- Fallback on singular defaultValue [1563](https://github.com/i18next/i18next/pull/1563)

## 19.9.0

- Improve updateMissing default plural behavior [1558](https://github.com/i18next/i18next/pull/1558)
- typescript: type definitions improvements for backend [1560](https://github.com/i18next/i18next/pull/1560)

## 19.8.10

- try to fix another edge case issue [1570](https://github.com/i18next/i18next/issues/1570) introduces by fixing [1552](https://github.com/i18next/i18next/issues/1552)

## 19.8.9

- warn if i18next gets initialized multiple times

## 19.8.8

- fix for cases when calling changeLanguage before finished to initialize [1552](https://github.com/i18next/i18next/issues/1552)

## 19.8.7

- use "Object.prototype.hasOwnProperty" instead of "object.hasOwnProperty", fixes [1542](https://github.com/i18next/i18next/issues/1542)

## 19.8.6

- regression fix because of last prototype pollution fix in v19.8.5

## 19.8.5

- fix potential prototype pollution when backend plugin resolves a malicious language value
- use fallbackLng as default lng

## 19.8.4

- update format function signature for TS [1520](https://github.com/i18next/i18next/pull/1480))

## 19.8.3

- fix prototype pollution with constructor

## 19.8.2

- allow nesting recursively with context (could theoretically generate infinite loop, prevented in [1480](https://github.com/i18next/i18next/pull/1480))

## 19.8.1

- fix "no languageDetector is used" log statement
- do not log "initialized" on cloned instances

## 19.8.0

- allow fallbackLng as function [1508](https://github.com/i18next/i18next/pull/1508)

## 19.7.0

- resource manipulation functions are now chainable

## 19.6.3

- plural rules for ht and iw

## 19.6.2

- fix interpolation with option skipOnVariables when there are multiple placeholders [1490](https://github.com/i18next/i18next/issues/1490)

## 19.6.1

- extend interpolation option skipOnVariables [1488](https://github.com/i18next/i18next/pull/1488)
- typescript: Change bindStore to bindI18nStore in ReactOptions type and update default values [1489](https://github.com/i18next/i18next/pull/1489)

## 19.6.0

- fix prototype pollution
- introduce new interpolation option skipOnVariables [1483](https://github.com/i18next/i18next/pull/1483)

## 19.5.6

- fix local usage of nsSeparator option

## 19.5.5

- fix: recursion when passing nesting to interpolated [1480](https://github.com/i18next/i18next/pull/1480)

## 19.5.4

- typescript fix: getDataByLanguage typings & test [1472](https://github.com/i18next/i18next/pull/1472)
- typescript fix: type declaration of exposed EventEmitter#off methods [1460](https://github.com/i18next/i18next/pull/1460)

## 19.5.3

- fix Macedonian plural formula [1476](https://github.com/i18next/i18next/pull/1476)

## 19.5.2

- fix nesting interpolation with prepended namespace, fixes #1474 [1475](https://github.com/i18next/i18next/pull/1475)

## 19.5.1

- getBestMatchFromCodes: use fallbackLng if nothing found, fixes #1470 [1471](https://github.com/i18next/i18next/pull/1471)

## 19.5.0

- language detectors can return an array of languages and let i18next figure out best match

- rename option whitelist to supportedLngs
- rename option nonExpicitWhitelist to nonExplicitSupportedLngs
- rename function languageUtils.isWhitelisted to languageUtils.isSupportedCode

These changes are made with temporal backwards compatibility and will warn your for deprecated usage of old terms to give users and plugin providers some time to adapt their code base.

The temporal backwards compatibility will be removed in a follow-up major release.

Learn more about why this change was made [here](https://github.com/i18next/i18next/issues/1466).

## 19.4.5

- Add store events to typings [1451](https://github.com/i18next/i18next/pull/1451)

## 19.4.4

- typescript: Allow passing retry boolean to `ReadCallback` [1439](https://github.com/i18next/i18next/pull/1439)

## 19.4.3

- fix regression introduced in "support formatting in nesting" [1419](https://github.com/i18next/i18next/pull/1419)

## 19.4.2

- fix for deno [1428](https://github.com/i18next/i18next/pull/1428)

## 19.4.1

- add getLanguagePartFromCode as in language fallback resolution [1424](https://github.com/i18next/i18next/pull/1424)

## 19.4.0

- support formatting in nesting [1419](https://github.com/i18next/i18next/pull/1419)

## 19.3.4

- fix cloning of service.utils binding to clone [1415](https://github.com/i18next/i18next/pull/1415)

## 19.3.3

- backendConnector extend initial retry from 250 to 350

## 19.3.2

- fix the nested string options parsing introduced in v19.2.0 which broke having multiple options

## 19.3.1

- typescript: add `options.interpolation.nestingOptionsSeparator`

## 19.3.0

- Double fix for 1395 issue [1399](https://github.com/i18next/i18next/pull/1399)
- adds `options.interpolation.nestingOptionsSeparator: ','` to specify that separator

## 19.2.0

- Add ability to use commas in nested keys [1398](https://github.com/i18next/i18next/pull/1398)

## 19.1.0

- explict warning when no languageDetector is used and no lng is defined [1381](https://github.com/i18next/i18next/pull/1381)
- Add option to always format interpolated values [1385](https://github.com/i18next/i18next/pull/1385)
- pass all options to format function [992#issuecomment-577797162](https://github.com/i18next/i18next/issues/992#issuecomment-577797162)

## 19.0.3

- fixes retry interval in backend connector [1378](https://github.com/i18next/i18next/issues/1378)

## 19.0.2

- typescript: Type ResourceStore [1366](https://github.com/i18next/i18next/pull/1366)

## 19.0.1

- ignore non valid keys in saveMissing [1359](https://github.com/i18next/i18next/pull/1359)

## 19.0.0

- typescript: Typescript use `export default` for esm-first approach [1352](https://github.com/i18next/i18next/pull/1352)

## 18.0.1

- check loadedNamespace only once per lng-ns inside using `t` for better performance

## 18.0.0

- When calling `i18next.changeLanguage()` both `i18next.language` and `i18next.languages` will be set to the new language after calling `loadResources` -> means when accessing `t` function meanwhile you will get still the translations for the previous language instead of the fallback.

- **When is this breaking?** this does not break any current test - but if you depend on accessing i18next.language or i18next.dir during language change and expect the new language this will break your app.

- Reasoning: In react-i18next we get in a not ready state for loaded translations while we would prefer just waiting for the new language ready and trigger a rerender then - also a triggered rerender outside of the bound events would end in Suspense...

- How can I get the language i18next will be set to? `i18next.isLanguageChangingTo` is set to the language called

## 17.3.1

- typescript: Add missing `cleanCode` option to TypeScript def [1344](https://github.com/i18next/i18next/pull/1344)

## 17.3.0

- pass used language & namespace to postprocessor [1341](https://github.com/i18next/i18next/pull/1341)

## 17.2.0

- Support using ImmutableJS Records as the data model in interpolation [1339](https://github.com/i18next/i18next/pull/1339)

## 17.1.0

DX improvements:

- warning if accessing t before i18next was initialized or namespace loaded
- warning and cancelling save if saveMissing key before i18next was initialized or namespace loaded

Both are a clear sign you render your app / call t to early not waiting for the callbacks or Promise.resolve on i18next.init, i18next.loadNamespace or i18next.changeLanguage.

## 17.0.18

- Improve performance of EventEmitter.off [1333](https://github.com/i18next/i18next/pull/1333)

## 17.0.17

- fixes: missing nested key fails if no nested value found and defaultValue contains interpolation -> results in endless loop [1332](https://github.com/i18next/i18next/issues/1332)

## 17.0.16

- typescript: fix incorrect callback type for backend module read callback [1322](https://github.com/i18next/i18next/pull/1322)
- typescript: add getDataByLanguage into index.d.ts [1326](https://github.com/i18next/i18next/pull/1326)

## 17.0.15

- Fixed default value as string in IE [1325](https://github.com/i18next/i18next/pull/1325)

## 17.0.14

- typescript: Allow TFunction to receive 1-3 parameters [1317](https://github.com/i18next/i18next/pull/1317)

## 17.0.13

- fixes: Interpolation defaultVariables not recognized on t() [1314](https://github.com/i18next/i18next/issues/1314)

## 17.0.12

- remove unused Interpolator#init reset param (only used internally) [1313](https://github.com/i18next/i18next/pull/1313)
- Cope with null interpolation (unescaped case) [1310](https://github.com/i18next/i18next/pull/1310)

## 17.0.11

- fix issue with unset value in interpolation throwing exception
- typescript: Allow augmentation of TFunction to be able to add overloads [1308](https://github.com/i18next/i18next/pull/1308)

## 17.0.10

- Update Interpolator.js to use regexSafe for unescaped interpolation [1307](https://github.com/i18next/i18next/pull/1307)

## 17.0.9

- typescript: use() should accept a class or object [1301](https://github.com/i18next/i18next/pull/1301)

## 17.0.8

- typescript: Correct `use(module)` types [1296](https://github.com/i18next/i18next/pull/1296)

## 17.0.7

- typescript: Typescript imports [1291](https://github.com/i18next/i18next/pull/1291)
- Disabled default returnedObjectHandler [1288](https://github.com/i18next/i18next/pull/1288)

## 17.0.6

- support montenegrien "crn" plurals

## 17.0.4

- typescript: ResourceKey type should allow top level string value [1267](https://github.com/i18next/i18next/pull/1267)

## 17.0.3

- don't do named exports for umd

## 17.0.2

- typescript: Allow null as TResult [1263](https://github.com/i18next/i18next/pull/1263)
- bring back ./i18next.js and ./i18next.min.js -> used by wildcard unpkg users...<= bad idea doing so
- main export in package.json points to cjs dist

## 17.0.1

- adapt ./index.js to 17.0.0 export

## 17.0.0

- removes checking in build files (umd) into source code - for CDN usage use: [https://unpkg.com/i18next@16.0.0/dist/umd/i18next.js](https://unpkg.com/i18next@16.0.0/dist/umd/i18next.js)
- removes named exports in main file - avoids issues in mixed exports makes usage better in commonjs scenarios (node.js) - no strange `const i18next = require('i18next').default;`
- **impact** you can't no longer `import { changeLanguage } from 'i18next'; changeLanguage('de');` you will have to `import i18next from 'i18next'; i18next.changeLanguage('de');`
- **note** if can create a own file providing the named bound functions and use that instead, sample: [https://github.com/i18next/i18next/blob/v15.0.0/src/index.js#L5](https://github.com/i18next/i18next/blob/v15.0.0/src/index.js#L5)

## 16.0.0

- removes deprecated jsnext:main from package.json
- Bundle all entry points with rollup [1256](https://github.com/i18next/i18next/pull/1256)
- **note:** dist/es -> dist/esm, dist/commonjs -> dist/cjs (individual files -> one bundled file)

## 15.1.3

- typescript: Fix type error when init with locize plugin options [1248](https://github.com/i18next/i18next/pull/1248)

## 15.1.2

- typescript: types(ReactOptions): Add missing props to React Options interface [1247](https://github.com/i18next/i18next/pull/1247)

## 15.1.1

- typescript: Update BackendModule interface to allow null or undefined for the callback [1244](https://github.com/i18next/i18next/pull/1244)

## 15.1.0

- trigger a languageChanging event

## 15.0.9

- IE: <=IE10 fix (unable to call parent constructor) [1227](https://github.com/i18next/i18next/pull/1227)

## 15.0.8

- typescript: adding init function to 3rdParty module typings and enforcing type property [1223](https://github.com/i18next/i18next/pull/1223)

## 15.0.7

- typescript: Add useSuspense to ReactOptions, fix error throwing on test [1219](https://github.com/i18next/i18next/pull/1219)

## 15.0.6

- typescript: add Interpolator interface [1213](https://github.com/i18next/i18next/pull/1213)

## 15.0.5

- typescript: Add `hashTransKey` to `ReactOptions` [1208](https://github.com/i18next/i18next/pull/1208)
- Expose error on reloadResources [1212](https://github.com/i18next/i18next/pull/1212)

## 15.0.4

- add default export on node.js entry [1204](https://github.com/i18next/i18next/pull/1204)
- typescript: Add defaultValue tests and allow second arg string as defaultValue [1206](https://github.com/i18next/i18next/pull/1206)

## 15.0.3

- typescript: accept templatestringsarray as TKey [1199](https://github.com/i18next/i18next/pull/1199)
- allow arrays on addResources

## 15.0.2

- try fixing UMD build

## 15.0.1

- fix export name on global (typo)

## 15.0.0

- update build process (while all test passes feeling more save making this a major release)

## 14.1.1

- allow empty string for array join [1191](https://github.com/i18next/i18next/issues/1191)

## 14.1.0

- support plurals in returning objecttree array [1196](https://github.com/i18next/i18next/issues/1196)

## 14.0.1

- typescript: Parameterized use of TFunction fails while WithT use works [1188](https://github.com/i18next/i18next/pull/1188)

## 14.0.0

- typescript: BREAKING Refactor generics usage [1180](https://github.com/i18next/i18next/pull/1180)

## 13.1.5

- es modules: Fix bug when import by ES Module [1179](https://github.com/i18next/i18next/pull/1179)
- typescript: Add module property [1176](https://github.com/i18next/i18next/pull/1176)

## 13.1.4

- fixes plural rule for JSON compatibility v2 introduced in 11.3.3 https://github.com/i18next/i18next/commit/d4d329fd7042f932eedf8bba1d92234707efd04c#diff-e171f9b8b4e0f5df027bd8bd7b962f1bR1140 [1174](https://github.com/i18next/i18next/issues/1174)

## 13.1.3

- TypeScript: Pull up WithT interface allowing for overrides [1172](https://github.com/i18next/i18next/pull/1172)

## 13.1.2

- Add typescript testing [1165](https://github.com/i18next/i18next/pull/1165)
- Add `transEmptyNodeValue` to `ReactOptions` [1166](https://github.com/i18next/i18next/pull/1166)
- Run prettier on typescript files for easier diffing in PRs [1167](https://github.com/i18next/i18next/pull/1167)

## 13.1.1

- fix init() attributes typings [1158](https://github.com/i18next/i18next/pull/1158)

## 13.1.0

- Support interpolation for defaultValue as parameter [1151](https://github.com/i18next/i18next/pull/1151)

## 13.0.1

- update typedefinitions [1152](https://github.com/i18next/i18next/pull/1152)

## 13.0.0

- pass options to missingInterpolationHandler [1146](https://github.com/i18next/i18next/pull/1146)
- refactor non valid keys handling [1143](https://github.com/i18next/i18next/pull/1143)

BREAKING:

- adds typescript definitions directly into this repo - no longer need to grab them from definitlytyped [1142](https://github.com/i18next/i18next/pull/1142)
- promise API added for all functions providing a callback [1130](https://github.com/i18next/i18next/pull/1130) -> means those will now return a Promise and not this -> so you can't chain eg. i18next.init().on() anylonger as init returns a Promise

## 12.1.0

- adds partialBundledLanguages flag in init options [1136](https://github.com/i18next/i18next/pull/1136)

## 12.0.0

- add hebrew update [1121](https://github.com/i18next/i18next/pull/1121)

## 11.10.2

- revert hebrew

## 11.10.1

- Adds Hebrew plural support [1121](https://github.com/i18next/i18next/pull/1121)

## 11.10.0

- Allow missingInterpolationHandler to be provided as t() option [1118](https://github.com/i18next/i18next/pull/1118)

## 11.9.1

- fixes allow overriding of fallbackLng when in options passed to t functions call

## 11.9.0

- merge load and reloadResources functionality to allow an optional callback in reloadResources

## 11.8.0

- deeper support for i18nFormats - add getResource function from format

## 11.7.0

- allows defining defaultValues for plurals -> same logic as using pluralsuffixes in translation files [details](https://www.i18next.com/translation-function/plurals#how-to-find-the-correct-plural-suffix) using eg. defaultValue_plural / defaultValue_2 based on request [1096](https://github.com/i18next/i18next/issues/1096)

## 11.6.0

- expose new store function getDataByLanguage [1087](https://github.com/i18next/i18next/pull/1087)

## 11.5.0

- EventEmitter.prototype.on returns this for chaining calls [1079](https://github.com/i18next/i18next/pull/1079)

## 11.4.0

- Allow to pass raw value to the custom interpolation escape function [1076](https://github.com/i18next/i18next/pull/1076)

## 11.3.6

- fix support zero for saveMissing plurals [1072](https://github.com/i18next/i18next/pull/1072)

## 11.3.5

- trigger loaded event only once per loaded namespace - consolidate all the loaded and done queued load calls [react-i18next 456 ](https://github.com/i18next/react-i18next/issues/456)

## 11.3.4

- fixes simplifyPluralSuffix: false cases for languages having only singular, plural [1069](https://github.com/i18next/i18next/issues/1069)

## 11.3.3

- pass down resolved to i18nFormat.parse as last argument

## 11.3.2

- Properly handle arguments containing arrays while listening to a wildcard event [1052](https://github.com/i18next/i18next/pull/1052)

## 11.3.1

- Fixes allowing setting keySeparator to false in calling t function [1051](https://github.com/i18next/i18next/pull/1051)

## 11.3.0

- Option to skip interpolation when calling t. [1050](https://github.com/i18next/i18next/pull/1050)

## 11.2.3

- Remove unnecessary warning when value is empty string [1046](https://github.com/i18next/i18next/pull/1046)

## 11.2.2

- adds used key to call parse of i18nFormat

## 11.2.1

- fixes for i18nFormat plugin

## 11.2.0

- allows new plugin of type 'i18nFormat' to override i18next format with eg. ICU format

## 11.0.0 - 11.1.1 (fixing version mismatch cdn.js - npm)

- **[BREAKING]** removes plugin of type cache. Can be replace by [i18next-chained-backend](https://github.com/i18next/i18next-chained-backend) example cache for localStorage [i18next-localstorage-backend](https://github.com/i18next/i18next-localstorage-backend#getting-started)
- **[BREAKING]** removes the support for multiload (multiRead) in backends - will just use read per language-namespace. You can enable multiRead support in backends again by using [i18next-multiload-backend-adapter](https://github.com/i18next/i18next-multiload-backend-adapter)

## 10.6.0

- adds missingInterpolationHandler [1039](https://github.com/i18next/i18next/pull/1039)

## 10.5.1

- fixes call to getPluralFormsOfKey if called with unsupported language [1032](https://github.com/i18next/i18next/issues/1032)
- Avoid mutating whitelist array. [1037](https://github.com/i18next/i18next/pull/1037)

## 10.5.0

- Adds options.silent to addResources and addResourceBundle [1024](https://github.com/i18next/i18next/pull/1024)

## 10.4.1

- forward options in backend.create saveMissing

## 10.4.0

- fixes combination of returnObject and context by returning original value for deep translation when lookup for inner returns a key (failed to translate proper) [1014](https://github.com/i18next/i18next/issues/1014)
- _[EXPERIMENTAL]_ additional you can pass `tDescription` to the `t` options or as a third param to calling `t` -> `t(key, defaultValue, tDescription);`. Those will get forwarded to the backend and can be submitted on saveMissing to provide contextual information for translators.

## 10.3.0

- new option saveMissingPlurals (default true) will enable submitting plural forms on saveMissing if t call is for plural (count passed in options).

## 10.2.2

- fixes Context and nested lost initial options [1009](https://github.com/i18next/i18next/issues/1009)

## 10.2.1

- optimize update output in log

## 10.2.0

- _[EXPERIMENTAL]_ init option updateMissing: enable to update default values if different from translated value (only useful on initial development or when keeping code as source of truth not changing values outside of code)

## 10.1.0

- return boolean, number from translator
- initial set language on translator if non set yet (after that only if loaded) [#998](https://github.com/i18next/i18next/issues/998)

## 10.0.7

- support all overloadTranslationOptionHandler in getFixedT [react-i18next/issues/332](https://github.com/i18next/react-i18next/issues/332)

## 10.0.6

- native browser es modules via adding .js where needed [PR980](https://github.com/i18next/i18next/pull/980)

## 10.0.5

- should fix sync of options in clone and its translator

## 10.0.2

- fixes issue in object return when passing in multiple keys

## 10.0.1

- fixes support for using suffix `_0` on languages only having "singular" form

## 10.0.0

- **[BREAKING]** brings pt, pt-PT, pt-BR plurals in line with, new pt reflects pt-BR and pt-PT gets a special case for plural handling http://www.unicode.org/cldr/charts/26/supplemental/language_plural_rules.html

## 9.1.0

- support for using suffix `_0` on languages only having "singular" form enables easier convert in tool chains

## 9.0.1

- propagate changeLanguage to translator after loadResources

## 9.0.0

- **[BREAKING]** removes the compatibility options to i18next v1 you can add that back like we do in our backward compatibility tests: [https://github.com/i18next/i18next/blob/master/test/backward/v1.11.1.compat.js#L45-L52](https://github.com/i18next/i18next/blob/master/test/backward/v1.11.1.compat.js#L45-L52)
- removes the compatibility options to i18next v1
- allows passing in second param as string on getFixedT returned t function so we could use that as defaultValue
- add setting maxReplaces in interpolation options to prevent endless loop in interpolation

## 8.4.3

- getFixedT lng parameter of array type -> pass as lngs to t function [PR949](https://github.com/i18next/i18next/pull/949)

## 8.4.2

- fixes merging options in clone instance...do not override passed values by values on main instance

## 8.4.1

- emits correct lng to changeLanguage event (fixes async detection behaviour) [PR933](https://github.com/i18next/i18next/pull/933)

## 8.4.0

- expose i18next.options.interpolation.format on i18next.format
- i18next.dir if not passing lng use first of i18next.languages before using i18next.language

## 8.3.0

- allows nesting objects/arrays into objects [#925](https://github.com/i18next/i18next/issues/925)

## 8.2.1

- fixes issue in async lng detection

## 8.2.0

- supports now async language detection - when language detector has member async = true

## 8.1.0

- option to disable nesting by calling `i18next.t('key', { nest: false })` [PR920](https://github.com/i18next/i18next/pull/920)
- fixes passing lng from options to formatter function if available

## 8.0.0

- nonExplicitWhitelist flag now not only gets considered on a fallback lng but also on user language. Eg. userlng 'de-AT' and whitelist ['de'] will now let de-AT pass as whitelisted if nonExplicitWhitelist is set true.

## 7.2.3

- rebuild seems we had a mistake in pushing latest build

## 7.2.2

- fixes issue in accepting string as a result of "nested" lookup [PR909](https://github.com/i18next/i18next/pull/909)

## 7.2.1

- fixes iterating over object's own properties [#904](https://github.com/i18next/i18next/pull/904)

## 7.2.0

- new init option simplifyPluralSuffix - setting it to false will treat all plurals using suffix numbers even for locals only having singular and plural
- even if no lng set or detected at least load the fallback languages
- delay init call on createInstance if not set initImmediate to false [#879](https://github.com/i18next/i18next/issues/879)

## 7.1.3

- fixes issue in returnObject tree called with options including ns: [react-i18next #240](https://github.com/i18next/react-i18next/issues/240)

## 7.1.2

- remove regex escape from format separators [#896](https://github.com/i18next/i18next/pull/896)

## 7.1.1

- change to named plugins for 3rd party - just calling init

## 7.1.0

- add option to include plugins not directly related - they get called their init function with current instance of i18next on init

## 7.0.1

- fix issue in fallback lng detection if no code was detected
- check for having a lng in append when searching locals to load on loadResources - avoid error on express middleware

## 7.0.0

- [BREAKING] Removed special cases for norwegian which resolved nb-NO to nb-NO, no will now resolve to nb-NO, nb [#870](https://github.com/i18next/i18next/issues/870) using norwegian you could migrate to old behaviour like:

  fallbackLng: {
  'nb': ['no', 'en'],
  'nn': ['no', 'en'],
  'default': ['en']
  }

- adding exports for named import (destruction es6) [#873](https://github.com/i18next/i18next/issues/873)
- change entry point for umd build to /src/i18next to avoid mixed export
- replace cloning in interpolation nesting to use object assign instead of json.stringify/parse so circular structures can be used [#875](https://github.com/i18next/i18next/issues/875)
- update all build dependencies

## 6.1.2

- fixes fix in 6.1.1

## 6.1.1

- patching same separators to lookup if the ns exists - else guess the first item is just part of the key and not meant as a namespace

## 6.1.0

- you now can use same nsSeparator and keySeparator (eg. use a dot for both)

## 6.0.3

- do not loop over objectTree if keySeparator is set to false

## 6.0.2

- fixes init flow of clone

## 6.0.1

- fixes issue in event emitter, assert all emitters get called even if one called get removed and changes the array index

## 6.0.0

- Return namespace in cimode with appendNamespaceToCIMode option (default now will only return key without namespace - independent of call to t function) [#863](https://github.com/i18next/i18next/issues/863)

## 5.0.0

- Nested keys should not be escaped by default [#854](https://github.com/i18next/i18next/issues/854)
- Make sure i18next.init() runs for i18next.cloneInstance() [#860](https://github.com/i18next/i18next/pull/860)

## 4.2.0

- adds i18next.isInitialized when isInitialized
- triggers backend loaded event before initialized

## 4.1.3 / 4.1.4

- smaller changes suggested to still inofficial support ie8 [#852](https://github.com/i18next/i18next/issues/852)

## 4.1.2

- fixes same interpolation object with multiple getFixedT() in different locales yields wrong translation [#851](https://github.com/i18next/i18next/issues/851)
- updated all build deps

## 4.1.1

- remove subs array from logger - no longer keep changing debug flag on subs if changing on main

## 4.1.0

- Custom escape function, single-quotes in nested [#843](https://github.com/i18next/i18next/pull/843)

## 4.0.0

- [BREAKING; only webpack2-beta users] will add module entry point used by webpack2, this might break your current build with webpack2-beta if configured incorrectly, see: [#836](https://github.com/i18next/i18next/issues/836)

## 3.5.2

- remove the module entry point again will be added in 4.0.0

## 3.5.1

- fix build output add a test file to test the generated build

## 3.5.0

- Setting options on individual translations override, rather than merge global configs [#832](https://github.com/i18next/i18next/issues/832)
- Create an new translator when cloning i18next instance [#834](https://github.com/i18next/i18next/pull/834)
- allows fallbackLng to be an string, an array or an object defining fallbacks for lng, lng-region plus default, eg

  fallbackLng: {
  'de-CH': ['fr', 'it', 'en'],
  'de': ['fr', 'en'],
  'zh-Hans': ['zh-Hant', 'en'],
  'zh-Hant': ['zh-Hans', 'en'],
  'default': ['en']
  }

## 3.4.4

- Fix Interpolator.escapeValue defaulting to undefined in some cases [#826](https://github.com/i18next/i18next/issues/826)

## 3.4.3

- Fix Interpolator formatter exception error propagation due to not reset RegExp indices [#820](https://github.com/i18next/i18next/issues/820)

## 3.4.2

- assert dir function does not crash if no language available

## 3.4.1

- fix issue with format containing formatSeparator for interpolation formatting

## 3.4.0

- adds formatting 'format this: {{var, formatRule}}' having a function on options.interpolation.format: function(value, format, lng) { return value } like suggested here [#774](https://github.com/i18next/i18next/issues/774)

## 3.3.1

- fixed an issue with several unescaped key in the interpolation string [#746](https://github.com/i18next/i18next/pull/746)

## 3.3.0

- allows option `nonExplicitWhitelist` on init [#741](https://github.com/i18next/i18next/pull/741)

## 3.2.0

- adds api function i18next.reloadResources(), i18next.reloadResources(lngs, ns) to trigger a reload of translations

## 3.1.0

- emits missingKey always (like console.log) even if saveMissing is of -> use missingKeyHandler if you only want the trigger only on saveMissing: true

## 3.0.0

- **[BREAKING]** per default i18next uses now the same index as used in gettext for plurals. eg. for arabic suffixes are 0,1,2,3,4,5 instead of 0,1,2,3,11,100. You can enforce old behaviour by setting compatibilityJSON = 'v2' on i18next init.
- **[BREAKING]** AMD export will be unnamed now
- don't call saveMissing if no lng

## 2.5.1

- fixes rtl support [#656](https://github.com/i18next/i18next/pull/656/files)

## 2.5.0

- allow null or empty string as defaultValue
- init option `initImmediate (default: true)` to init without immediate

## 2.4.1

- if passing resources don't immediate loading fixes [#636](https://github.com/i18next/i18next/issues/636)

## 2.4.0

- support now language code variants with scripts and other exotic forms: zh-Hans-MO, sgn-BE-fr, de-AT-1996,...
- trigger of changeLanguage, load of data with a setTimeout to allow other operations meanwhile

## 2.3.5

- Only add language to preload array when new [#613](https://github.com/i18next/i18next/pull/613/files)

## 2.3.4

- get babel 6 output IE compatible: https://jsfiddle.net/jamuhl/2qc7oLf8/

## 2.3.2

- add index to make export compatible again

## 2.3.1

- build /dist/es with included babelhelpers

## 2.3.0

- change build chain to use rollup...allows 'js:next' and reduces build from 45kb to 33kb minified (/lib --> /dist/commonjs folder, new /dist/es for rollup,...)
- fixes detection when using both context and pluralization and context not found. [#851](https://github.com/i18next/i18next/pull/581)

## 2.2.0

- return instance after init for further chaning
- make init optional on backend, cache
- package.json entry points now to /lib not to mangled version...this might be the better solution for most use cases (build chains built on npm, webpack, browserify, node,...)

## 2.1.0

- allow keySeparator, nsSeparator = false to turn that off

## 2.0.26

- extended emitted arguments on 'added' event

## 2.0.24

- fixes unneeded reload of resources that failed to load

## 2.0.23

- fixes returnObjects in case of multiple namespaces

## 2.0.22

- add options for context, pluralSeparator

## 2.0.21

- clear done load request in backendConnector

## 2.0.20

- pass full options to detectors as third arg

## 2.0.19

- do not callback err in backendConnector if no backend is specified

## 2.0.18

- check for fallbackLng exist

## 2.0.17

- adds cimode to options.whitelist if set
- emits failedLoading on load error

## 2.0.16

- adds addResource to i18next API
- fix init of i18next without options, callback

## 2.0.15

- avoid loading of resources for lng=cimode

## 2.0.14

- enhance callback on load from backend...wait for pendings

## 2.0.10

- fixing build chain
- do not post process on nested translation resolve

## 2.0.5

- fixing allow nesting on interpolated nesting vars

## 2.0.4

- don't log lng changed if no lng was detected
- extend result on arrayJoins

## 2.0.1

- assert defaults are arrays where needed
- assert calling lngUtils.toResolveHierarchy does not add undefined as code if called without code param

## 2.0.0

- complete rewrite of i18next codebase

---

## 1.11.2

- replace forEach loop to support IE8 [PR 461](https://github.com/i18next/i18next/pull/461)

## 1.11.1

- fixes issue in nesting using multiple namespaces and lookups in fallback namespaces
- Fix use of sprintf as shortcutFunction when first argument falsey [PR 453](https://github.com/i18next/i18next/pull/453)

## 1.11.0

- Add nsseparator and keyseparator as options to translation function [PR 446](https://github.com/i18next/i18next/pull/446)
- Resolves issue #448 - TypeScript errors [PR 449](https://github.com/i18next/i18next/pull/449)
- Fixing \_deepExtend to handle keys deep existing in source and target [PR 444](https://github.com/i18next/i18next/pull/444)
- `resource` to `resources` in addResources function [PR 440](https://github.com/i18next/i18next/pull/440)
- Runs multiple post processes for missing translations [PR 438](https://github.com/i18next/i18next/pull/438)
- Add support to override Ajax HTTP headers [PR 431](https://github.com/i18next/i18next/pull/431)
- Fixed mnk plural definition [PR 427](https://github.com/i18next/i18next/pull/427)
- Add dir function to return directionality of current language, closes… [PR 413](https://github.com/i18next/i18next/pull/413)

## 1.10.3

- fixes issue where lng get fixed on data-i18n-options
- [SECURITY] merges Reimplement XSS-vulnerable sequential replacement code [PR 443](https://github.com/i18next/i18next/pull/443)

## 1.10.2

- streamline callback(err, t) for case where resStore is passed in

## 1.10.1

- fixes Adds jquery like functionality without the jquery plugin. [PR 403](https://github.com/i18next/i18next/pull/403) by adding it to output

## 1.10.0

- [BREAKING] new callbacks will be node.js conform function(err, t) | Forward the error from sync fetch methods to the init callback function [PR 402](https://github.com/i18next/i18next/pull/402)
- fix fallback lng option during translations [PR 399](https://github.com/i18next/i18next/pull/399)
- Adds jquery like functionality without the jquery plugin. [PR 403](https://github.com/i18next/i18next/pull/403)

## 1.9.1

- fix fallback lng option during translations [PR 399](https://github.com/i18next/i18next/pull/399)
- Adds jquery like functionality without the jquery plugin. [PR 403](https://github.com/i18next/i18next/pull/403)

## 1.9.0

- i18n.noConflict() [PR 371](https://github.com/i18next/i18next/pull/371)
- fix fallback to default namepsace when namespace passed as an option [PR 375](https://github.com/i18next/i18next/pull/375)
- cache option for ajax requests [PR 376](https://github.com/i18next/i18next/pull/376)
- option to show key on value is empty string [PR 379](https://github.com/i18next/i18next/pull/379)
- Add isInitialized method [PR 380](https://github.com/i18next/i18next/pull/380)
- Null check for detectLngFromLocalStorage [PR 384](https://github.com/i18next/i18next/pull/384)
- support for adding timeout in configuration for ajax request [PR 387](https://github.com/i18next/i18next/pull/387)

## 1.8.2

- fixes build of commonjs with jquery file

## 1.8.0

- [BREAKING] adds custom build for commonjs with jquery...default will be without require for jquery
- fixes issue [issue 360](https://github.com/i18next/i18next/issues/360)
- expose applyReplacement on api
- save resources to localStorage when useLocaleStore is true
- add support on key is a number
- added getResourceBundle to API
- allow multiple post-processors
- fallback to singular if no plural is found fixes issue [issue 356](https://github.com/i18next/i18next/issues/356)
- access localstorage always with try catch fixes issue [issue 353](https://github.com/i18next/i18next/issues/353)

## 1.7.7

- fixes issue with stack overflow on t(lng, count)
- fixes empty value fallback when processing secondary ns

## 1.7.6

- fixes lng detection (i18next-client on npm)

## 1.7.5

- adds option to define defaultOptions, which gets merged into t(options) [issue 307](https://github.com/i18next/i18next/issues/307)
- optimization of size added by plural rules
- handle error on json parse when using internal xhr
- fixes plural/singular on count if going on fallbacks eg. fr --> en
- fixes global leak of sync in amd versions
- apply options.lowerCaseLng to fallbackLng too
- added hasResourceBundle(lng, ns) to check if bundle exists
- added experimental i18n.sync.reload --> resets resStore and reloads resources
- catch issues with localStorage quota
- changes detectlanguage to support whitelist entries

## 1.7.4

- add resource bundle gets deep extend flag i18n.addResourceBundle(lng, ns, { 'deep': { 'key2': 'value2' }}, true);
- new functions to add one key value or multiple i18n.addResource(lng, ns, key, value);, i18n.addResources(lng, ns, {'key1': 'value1', 'deep.key2': 'value2'});
- lngWhitelist merged
- override postMissing function
- allow floats for count
- added indefinite functionality for plurals
- optional set replacing vars to replace member to avoid collision with other options
- experimental optional detectLngFromLocalStorage
- fix for norwegian language

## 1.7.3

- solves issue with ie8 not providing .trim function on string -> added to shim
- set data using \$(selector).i18n() on data-i18n='[data-someDataAttr]key'
- more bullet proof state handling on failed file load
- corrected latvian plurals based on [issue 231](https://github.com/jamuhl/i18next/issues/231)
- allow array of fallback languages
- allow int in values passed to shortcut sprintf
- setLng to 'cimode' will trigger a CI mode returning 'key' instead of translation

## 1.7.2

- introducing option fallbackOnEmpty -> empty string will fallback
- added function removeResourceBundle(lng, ns) -> removes a resource set
- fixed issue with no option passed to setLng
- added ability to prepend, append content with data-i18n attributes
- introducing objectTreeKeyHandler
- fixes issue with i18n.t(null), i18n.t(undefined) throwing exception
- returnObjectTrees does not mangle arrays, functions, and regexps
- optimized structure for bower support

## 1.7.1

- fixed some typo
- allow translate to take an array of keys - take first found
- allow numbers in object trees

## 1.7.0

- test if initialisation finished before allowing calling t function
- setting option fixLng=true will return t function on init or setLng with the lng fixed for every subsequent call to t
- grab key from content if attr data-i18n has no value
- setting shortcutFunction to 'defaultValue' allows calling i18n.t(key, defaultValue)
- empty string in defaultValue is now valid no longer displaying key
- allow option cookieDomain
- fixes issue #115 out of stack exception in IE8 by recursing \_translate in objectTrees

## 1.6.3

- option to parse key if missing
- fixes issue where plural don't get translated if language is passed in t options
- fixes issue where key or defaultValue aren't postProcessed with itself as value
- fixes issue with fallbackLng = false in combination with sendMissingTo = fallback
- fixes namespace fallback loop to only loop if array has really a ns in it

## 1.6.2

- fixes some var typo
- fixes sendMissing to correct namespace
- fixes sendMissing in combination with fallbackNS

## 1.6.1

- PR #106 optionally un/escape interpolated content
- PR #101 automatic gettext like sprintf syntax detection + postprocess injection
- customload will get called on dynamicLoad too
- fixes namespace array settings if loaded resourcebundle or additional namespaces
- lookup of not existend resources can be fallbacked to other namespaces - see option fallbackNS (array or string if one ns to fallback to)
- defaultValues get postProcessed
- BREAKING: per default null values in resources get translated to fallback. This can be changed by setting option fallbackOnNull to false
- PR #81 added support for passing options to nested resources
- PR #88 added an exists method to check for the existence of a key in the resource store
- fixed issue with null value throws in applyReplacement function
- fixed issue #80 empty string lookup ends in fallback instead of returning result in language
- fixed issue with null value in resources not returning expected value
- optimized tests to use on server (nodejs) too
- allow zepto as drop in replacement for \$
- using testacular as runner
- upgraded to grunt 0.4.0
- fixed optional interpolation prefix/suffix not used in plural translation cases
- optimized check if there are multiple keys for the data-i18n attribute to parse

## 1.6.0

- option to specify target to set attributes with jquery function by using 'data-i18n-target attribute'
- function to set new options for nesting functionality
- function to add resources after init
- option to lookup in default namespace if value is not found in given namespace
- option to change interpolation prefix and suffix via translation options
- fixed issue with using ns/keyseparator on plurals, context,...
- fixed issue with posting missing when not using jquery
- post missing in correct lng if lng is given in translation options
- proper usage of deferred object in init function
- fixed issue replacing values in objectTree

## 1.5.10

- BREAKING: fixed plural rules for languages with extended plural forms (more than 2 forms)
- merged pull #61 - custom loader (enables jsonp or other loading custom loading strategies)
- escaping interpolation prefix/suffix for proper regex replace

## 1.5.9

- functions to load additional namespaces after init and to set default namespace to something else
- set if you don't want to read defaultValues from content while using jquery fc
- set dataAttribute to different value
- set cookieName to different value
- some smallbugfixes
- typesafe use of console if in debug mode

## 1.5.8

- disable cookie usage by setting init option useCookie to false
- accept empty string as translation value
- fixed bug in own ajax implementation not using proper sendType
- fixed bug for returning objTree in combination with namespace
- fixed bug in plurals of romanic lngs

## 1.5.7

- pass namespace in t() options
- interpolation nesting
- changable querystring param to look language up from

## 1.5.6

- typesafe check for window, document existance
- runnable under rhino
- seperated amd builds with/without jquery

## 1.5.5

- **BREAKING** added all plurals: suffixes will new be same as in gettext usage (number indexes key_plural_0|2|3|4|5|7|8|10|11|20|100), additional if needed signature of addRule has changed
- added sprintf as postprocessor -> postProcess = 'sprintf' and sprintf = obj or array
- set default postProcessor on init
- redone build process with grunt
- drop in replacement for jquery each, extend, ajax
- setting fallbackLng to false will stop loading and looking it up
- option to load only current or unspecific language files

## 1.5.0

- pass options to sync.\_fetchOne, use options for fetching
- support for i18next-webtranslate

## 1.4.1

- post processor
- **BREAKING:** localStorage defaults to false
- added localStorageExpirationTime for better caching control
- few bug fixes

## 1.4.0

- preload multiple languages
- translate key to other language than current
- fixed issue with namespace usage in combination with context and plurals
- more options to send missing values
- better amd support

## 1.3.4

- set type of ajax request to GET (options sendType: default POST)
- set cookie expiration (options cookieExpirationTime: in minutes)
- read / cache translation options (context, count, ...) in data-attribute (options useDataAttrOptions: default false)

## 1.3.3

- optional return an objectTree from translation
- use jquery promises or callback in initialisation
- rewrote all tests with mocha.js

## 1.3.2

- options to init i18next sync (options -> getAsync = false)
- replace all occurence of replacement string

## 1.3.1

- pass options to selector.i18n() thanks to [@hugojosefson](https://github.com/jamuhl/i18next/pull/10)
- close [issue #8(https://github.com/jamuhl/i18next/issues/8)]: Fail silently when trying to access a path with children
- cleanup
- debug flag (options.debug -> write infos/errors to console)

## 1.2.5

- fix for IE8

## 1.2.4

- added indexOf for non ECMA-262 standard compliant browsers (IE < 9)
- calling i28n() on element with data-i18n attribute will localize it now (i18n now not only works on container elements child)

## 1.2.3

- extended detectLng: switch via qs _setLng=_ or cookie _i18next_
- assert county in locale will be uppercased `en-us` -> `en-US`
- provide option to have locale always lowercased _option lowerCaseLng_
- set lng cookie when set in init function

## 1.2

- support for translation context
- fixed zero count in plurals
- init without options, callback

## 1.1

- support for multiple plural forms
- common.js enabled (for node.js serverside)
- changes to be less dependent on jquery (override it's functions, add to root if no jquery)
- enable it on serverside with node.js [i18next-node](https://github.com/jamuhl/i18next-node)

## 1.0

- support for other attribute translation via _data-i18n_ attribute
- bug fixes
- tests with qunit and sinon

## 0.9

- multi-namespace support
- loading static files or dynamic route
- jquery function for _data-i18n_ attibute
- post missing translations to the server
- graceful fallback en-US -> en -> fallbackLng
- localstorage support
- support for pluralized strings
- insertion of variables into translations
- translation nesting
