# Versions

## 0.3.0

_Jun 11, 2026_

- **Breaking change:** Replace `@base-ui/utils/detectBrowser` with the new `@base-ui/utils/platform` namespace (#4920) by @romgrk
- Fix `useStore` returning stale values when the store or selector arguments change (#4866) by @chuganzy
- Update `reselect` to 5.2.0 (#4910) by @IzumiSy
- Build the package with a flat output structure (#4959) by @brijeshb42

## 0.2.9

_May 19, 2026_

- Improve `ReactStore` mount performance with interaction splitting (#4661) by @atomiks
- Add `getDefaultFormSubmitter` helper (#4713) by @michaldudak
- Do not use `Math.random()` in `useStableCallback` (#4732) by @michaldudak

## 0.2.8

_Apr 20, 2026_

- Deprecate `isMouseWithinBounds` (#4604) by @atomiks

## 0.2.7

_Apr 13, 2026_

- Update `StoreInspector` to use shadow DOM-safe DOM utilities (#4412) by @atomiks
- Move `createSelectorMemoized` into a separate module to reduce bundle size (#4336) by @atomiks
- Disallow optional and default parameters in `createSelector` combiners (#4299) by @JCQuintas
- Add `addEventListener` and `mergeCleanups` helpers (#4504) by @atomiks
- Fix `useControlled` warnings for circular or unserializable default values (#4452) by @Profesor08
- Support pointer events in `isMouseWithinBounds` (#4528) by @atomiks

## 0.2.6

_Mar 12, 2026_

- Add `createFormatErrorMessage` factory function (#4190) by @brijeshb42

## 0.2.5

_Feb 12, 2026_

- Refactor `ReactStore` and speed up `useStore` (#3384, #3445) by @romgrk
- Reduce `useScrollLock` style recalculation with classic scrollbars (#3854) by @mdm317
- Fix event handling in `useEnhancedClickHandler` (#3981) by @sai6855

## 0.2.4

_Jan 15, 2026_

- Add `visuallyHiddenInput` for visually hidden form controls (#3606) by @atomiks
- Improve `useScrollLock` stable scrollbar gutter detection for custom scrollbars (#3575) by @chuganzy
- Fix `ReactStore` synced value updates when detached triggers remount (#3724) by @atomiks

## 0.2.3

_Dec 11, 2025_

- Rename package from `@base-ui-components/utils` to `@base-ui/utils` (#3462) by @mnajdova

## 0.2.2

_Dec 4, 2025_

- Use raw `useSyncExternalStore` with React 19+ in `useStore` (#3360) by @romgrk

## 0.2.1

_Nov 27, 2025_

- Fix React <=18 ref access in `getReactElementRef` (#3257) by @atomiks
- Make `useScrollLock` cleanup safely check `removeEventListener` (#3264) by @Copilot
- Improve `ReactStore.useSyncedValues` performance for stable objects (#3277) by @michaldudak
- Avoid recreating `ReactStore.useStateSetter` callbacks (#3316) by @romgrk

## 0.2.0

_Nov 17, 2025_

- Add infrastructure to support nested stores (#3037) by @michaldudak
- Export `useScrollLock` (#3233) by @atomiks

## 0.1.0

_Jul 30, 2025_

Initial release
