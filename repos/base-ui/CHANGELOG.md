# Versions

## v1.6.0

_Jun 18, 2026_

### General changes

- Correct inaccurate prop JSDoc (#5036) by @atomiks
- Update the hook value when store/arguments change (#4866) by @chuganzy
- Restore viewport morphing after reopen for kept-mounted popups (#5010) by @atomiks
- Fix pseudo-element bounds in dev mode (#5000) by @atomiks

### Accordion

- Fix trigger behavior bugs (#4833) by @atomiks
- Remove region role from `Accordion.Root` (#4961) by @chuganzy
- Align keyboard navigation with APG (#4965) by @chuganzy

### Alert Dialog

- Fix programmatic focus return (#4849) by @atomiks

### Autocomplete

- Keep ArrowLeft/ArrowRight on the input caret in grid mode (#4948) by @spokodev
- Document `open` requirement for the `inline` prop (#5069) by @atomiks

### Avatar

- Fix image status edge cases (#4835) by @atomiks

### Checkbox

- Fix parent group cancellation and indeterminate state (#4941) by @atomiks
- Ignore `data-focused` Field attribute when disabled (#4998) by @atomiks
- Fix extra `validate` fn calls (#4911) by @mj12albert

### Checkbox Group

- Fix parent group cancellation and indeterminate state (#4941) by @atomiks
- Fix parent checkbox with custom `validate` fn (#4912) by @mj12albert
- Fix validation with multiple required checkboxes (#4958) by @atomiks
- Forward group ids (#4997) by @atomiks

### Collapsible

- Fix trigger and panel state bugs (#4848) by @atomiks

### Combobox

- Fix chip context error (#4877) by @lyzno1
- Keep ArrowLeft/ArrowRight on the input caret in grid mode (#4948) by @spokodev
- Avoid re-rendering every item on each keystroke (#4964) by @flaviendelangle
- Fix autofill and selected state edge cases (#4972) by @atomiks
- Document `open` requirement for the `inline` prop (#5069) by @atomiks

### Dialog

- Fix confirmation return focus (#5024) by @atomiks
- Fix programmatic focus return (#4849) by @atomiks
- Fix positioning and viewport edge cases (#4925) by @atomiks
- Fix non-modal focus-out close and tabindex management (#5030) by @atomiks

### Drawer

- Fix confirmation return focus (#5024) by @atomiks
- Improve swipe dismiss drag performance (#4867) by @atomiks
- Drive swipe gestures natively to stop per-frame re-rasterization (#4980) by @atomiks
- Add virtual keyboard provider (#4353) by @atomiks
- Commit swipe on primary-button release (#5057) by @atomiks

### Field

- Fix form validation bugs (#4873) by @atomiks
- Reflect disabled `Field.Item` state in `Field.Label` (#4916) by @chuganzy
- Reflect disabled `Field.Item` state in `Field.Description` (#4960) by @chuganzy
- Fix valueMissing revalidation (#4995) by @atomiks
- Fix validation bugs (#4894) by @atomiks

### Fieldset

- Fix disabled fieldset form bugs (#4890) by @atomiks

### Form

- Fix form validation bugs (#4873) by @atomiks

### Menu

- Fix submenu trigger interactions (#4892) by @atomiks
- Open submenus on hover after a plain delay (#4990) by @atomiks
- Fix controlled hover leave close (#4893) by @atomiks
- Fix positioning and viewport edge cases (#4925) by @atomiks

### Menubar

- Fix vertical menu focus behavior (#4922) by @atomiks

### Meter

- Sync value text with indicator (#4904) by @atomiks

### Navigation Menu

- Preserve exit transition when controlled (#4855) by @mattrothenberg
- Fix interaction, value, and styling-hook bugs (#4942) by @atomiks

### Number Field

- Handle unreadable clipboard paste (#4876) by @lyzno1
- Fix committed values and keyboard stepping (#4905) by @atomiks
- Respect Intl rounding options on blur (#4804) by @atomiks
- Fix formatter locale cache (#4999) by @atomiks
- Preserve numeric precision while keeping default display formatting (#5040) by @atomiks
- Fix input and scrub edge cases (#5046) by @atomiks

### OTP Field

- 🚨 **Breaking change:** Unmark preview<br />
  the namespace export is renamed `OTPFieldPreview` → `OTPField` and should be imported as: `{ OTPField } from '@base-ui/react/otp-field'` (#5029) by @atomiks
- Avoid password manager bubbles after first input (#4868) by @atomiks

### Popover

- Fix controlled hover leave close (#4893) by @atomiks
- Fix programmatic focus return (#4849) by @atomiks
- Fix positioning and viewport edge cases (#4925) by @atomiks
- Fix non-modal focus-out close and tabindex management (#5030) by @atomiks

### Preview Card

- Fix controlled hover leave close (#4893) by @atomiks
- Fix positioning and viewport edge cases (#4925) by @atomiks
- Keep inline preview anchored while open (#4836) by @atomiks
- Close when active trigger unmounts (#4886) by @michaldudak

### Radio Group

- Forward group ids (#4997) by @atomiks
- Fix selection on space key press (#4930) by @chuganzy
- Fix disabled selected form submission (#4926) by @atomiks
- Honor canceled value changes (#4996) by @atomiks

### Scroll Area

- Fix overflow and scrolling state (#4936) by @atomiks
- Add scrolling state to Thumb (#4982) by @aarongarciah

### Select

- Fix autofill and selected state edge cases (#4934) by @atomiks
- Fix dirty state not clearing in multiple mode (#4971) by @atomiks
- Skip disabled items in typeahead and fix multiple-mode serialization (#5025) by @atomiks

### Slider

- Fix extra `validate` fn calls (#4911) by @mj12albert
- Fix interaction edge cases (#4937) by @atomiks
- Fix touchend listener accumulation leak (#5070) by @atomiks

### Switch

- Fix extra `validate` fn calls (#4911) by @mj12albert

### Tabs

- Fix state edge cases (#4935) by @atomiks
- Fix suspended panel activation (#4903) by @atomiks

### Toast

- Fix timer and limit edge cases (#4933) by @atomiks

### Toggle

- Fix grouped cancelation and JSDoc (#4940) by @atomiks

### Toggle Group

- Fix grouped cancelation and JSDoc (#4940) by @atomiks
- Remove invalid `aria-orientation` from `role="group"` element (#4628) by @sernstberger
- Fix disabled state and roving focus bugs (#4968) by @atomiks

### Toolbar

- Do not forward `disabled` to default toolbar button (#4967) by @mj12albert
- Fix disabled state and roving focus bugs (#4968) by @atomiks

### Tooltip

- Fix positioning and viewport edge cases (#4925) by @atomiks
- Fix provider delay group lifecycle (#4887) by @michaldudak
- Reset preventUnmountOnClose on reopen (#4885) by @michaldudak
- Close when active trigger unmounts (#4886) by @michaldudak

All contributors of this release in alphabetical order: @aarongarciah, @atomiks, @chuganzy, @flaviendelangle, @lyzno1, @mattrothenberg, @michaldudak, @mj12albert, @sernstberger, @spokodev

## v1.5.0

_May 19, 2026_

### General changes

- Improve mount performance with interaction splitting, including closed popup mount performance by up to 50% and unmounting performance by up to 85% (#4661) by @atomiks
- Use local document for virtual arrow (#4662) by @lyzno1
- Fix macOS Safari and Firefox minimizing fullscreen when closing popups with <kbd>Esc</kbd> (#4695) by @arturbien
- Drop unnecessary memoization (#4693) by @flaviendelangle
- Do not use `Math.random()` in `useStableCallback()` (#4732) by @michaldudak
- Fix return focus when reference disconnects (#4655) by @atomiks
- Don't steal initial focus if focus already moved inside a popup (#4775) by @stefee

### Alert Dialog

- Fix handle defaults (#4834) by @atomiks

### Autocomplete

- Fix native `FormData` for popup inputs (#4725) by @lunaxislu

### Checkbox

- Submit the associated form when pressing <kbd>Enter</kbd> (#4713) by @michaldudak

### Combobox

- Expose clear visibility state (#4664) by @atomiks
- Fix popup input form submit (#4687) by @atomiks
- Preserve `closeQuery` when closing multiple input-inside-popup combobox (#4715) by @mj12albert
- Fix RTL component behavior (#4840) by @atomiks
- Ignore hidden-input changes while readonly or disabled (#4810) by @lunaxislu

### Dialog

- Consider the controlled `open` prop for open state detection (#4712) by @michaldudak

### Drawer

- Forward `style` prop in `<Drawer.Viewport>` (#4841) by @atomiks

### Field

- Avoid `flushSync` during validation (#4685) by @atomiks

### Form

- Avoid `flushSync` during validation (#4685) by @atomiks

### Menu

- Fix submenu pointer-events scope for `keepMounted` portals (#4723) by @twillhorn
- Support `<Menu.GroupLabel>` in `<Menu.RadioGroup>` (#4826) by @nami8824
- Consider the controlled `open` prop for open state detection (#4712) by @michaldudak

### Navigation Menu

- Fix RTL component behavior (#4840) by @atomiks
- Fix `keepMounted` content sizing (#4817) by @atomiks

### Number Field

- Allow Persian digits in keyboard input (#4719) by @lunaxislu
- Sync pasted input during step interactions (#4824) by @lunaxislu

### OTP Field

- **Breaking change:** Rename `sanitizeValue()` to `normalizeValue()` and allow composing with validation (#4717) by @atomiks
- Avoid `flushSync` during validation (#4685) by @atomiks
- Support <kbd>Ctrl</kbd> and <kbd>Cmd</kbd> shortcuts (#4606) by @atomiks
- Fire `onValueComplete()` for full paste (#4690) by @atomiks
- Fix vertical arrow slot navigation (#4844) by @atomiks
- Ignore hidden input changes while readonly or disabled (#4806) by @lunaxislu
- Prevent locked hidden autofill validation (#4827) by @lunaxislu
- Fix RTL arrow navigation (#4847) by @atomiks

### Popover

- Fix RTL component behavior (#4840) by @atomiks
- Preserve active trigger on close press (#4741) by @mj12albert
- Consider the controlled `open` prop for open state detection (#4712) by @michaldudak

### Preview Card

- Consider the controlled `open` prop for open state detection (#4712) by @michaldudak
- Integrate inline positioning (#2074) by @atomiks

### Scroll Area

- Fix RTL component behavior (#4840) by @atomiks

### Select

- Clear stale item text ref (#4683) by @atomiks
- Add `data-popup-side` to trigger (#4671) by @mj12albert
- Allow mouse selection without highlight (#4699) by @atomiks
- Ignore hidden-input changes while readonly or disabled (#4810) by @lunaxislu
- Fix nested Select requiring extra outside clicks to dismiss parent (#4820) by @mattrothenberg

### Tabs

- Fire `onValueChange()` for automatic tab selection (#4704) by @michaldudak

### Toast

- Re-use `getElementTransform()` and remove local implementation (#4749) by @sai6855
- Fix stuck drag state on release (#4742) by @aeterno-caspian
- Remove memoized selector (#4751) by @atomiks

### Tooltip

- Consider the controlled `open` prop for open state detection (#4712) by @michaldudak
- Fix flickering when nesting tooltip inside another tooltip's trigger (#4501) by @michaldudak

All contributors of this release in alphabetical order: @aeterno-caspian, @arturbien, @atomiks, @flaviendelangle, @Janpot, @lunaxislu, @lyzno1, @mattrothenberg, @michaldudak, @mj12albert, @nami8824, @sai6855, @stefee, @twillhorn

## v1.4.1

_Apr 20, 2026_

### General changes

- Clear highlight on pointer leave when item is clipped by scroll container (#4604) by @atomiks
- Fix `display: contents` tabbability (#4642) by @atomiks
- Fix multi-argument event handler forwarding in `mergeProps` (#4598) by @atomiks
- Mark `date-fns` peer dependencies as optional (#4639) by @LukasTy

### Navigation Menu

- Fix stale popup size on rapid trigger hover (#4646) by @atomiks

All contributors of this release in alphabetical order: @atomiks, @LukasTy

## v1.4.0

_Apr 13, 2026_

### General changes

- Improve `render` prop warning accuracy (#4324, #4363) by @atomiks
- Fix `preventBaseUIHandler` runtime wrapping (#4330) by @atomiks
- Fix Uncaught TypeError: Converting circular structure to JSON (#4452) by @Profesor08
- Expose `form` prop on hidden inputs (#4352) by @atomiks
- Add `suppressHydrationWarning` to hidden inputs (#4482) by @devxoul
- Fix outside-press dismissal in a shared shadow root (#4333) by @atomiks
- Fix `Positioner` not repositioning to a different trigger when reopened with `keepMounted` (#4407) by @mdm317
- Lock scroll of full-width anchored `modal` popups with touch input (#3100) by @atomiks

### Alert Dialog

- Fix detached trigger HMR with recreated handles (#4472) by @atomiks

### Autocomplete

- Fix initial live region announcements (#4286) by @atomiks

### Avatar

- Fix flash when image is cached (#4469) by @mj12albert

### Checkbox

- Fix uncontrolled default initialization (#4535) by @atomiks
- Prevent input state changes in `readOnly` mode (#4551) by @tsbehlman

### Collapsible

- Fix open state when `keepMounted` has no transitions (#4555) by @mj12albert

### Combobox

- Fix clicks in `Chips`/`InputGroup` areas not focusing the input or opening the popup (#4296) by @CiscoFran10
- Fix iOS viewport settling (#4351) by @atomiks
- Fix initial live region announcements (#4286) by @atomiks
- Prevent scroll lock when a controlled value triggers a re-render (#4507) by @ryanrhee
- Fix browser autofill with object values when autofill uses the label (#4560) by @mattrothenberg
- Prevent item taps from blurring the input (#4578) by @atomiks
- Respect rendered chips for keyboard navigation (#4572) by @atomiks

### Dialog

- Fix detached trigger HMR with recreated handles (#4472) by @atomiks

### Drawer

- Fix touch scroll in portaled popups (#4382) by @atomiks
- Fix nested swipe cancel state (#4410) by @atomiks
- Fix interrupted swipe dismiss cleanup (#4467) by @lunaxislu
- Warn when a popup is missing `Viewport` (#4495) by @atomiks
- Prevent dialogs from affecting nested drawer stack (#4493) by @atomiks

### Field

- Fix form error matching in `<Field.Error>` (#4494) by @atomiks

### Menu

- Fix `SubmenuTrigger` not respecting disabled state from `render` (#3858) by @CiscoFran10
- Preserve dialog focus on pointer leave (#4581) by @atomiks

### Navigation Menu

- Remove invalid `aria-orientation` attribute (#4355) by @atomiks
- Add generic `Value` typing (#4328) by @atomiks
- Fix initial trigger switch size snap (#4327) by @atomiks
- Fix top-level trigger pointer events blocking (#4362) by @atomiks
- Fix reverse <kbd>Shift</kbd>+<kbd>Tab</kbd> submenu re-entry (#4464) by @atomiks
- Fix nested inline submenu hover handoff (#4413) by @atomiks
- Fix transition width when reopening (#4587) by @mdm317

### Number Field

- Fix format rounding error on blur (#4557) by @atomiks

### OTP Field

- Add preview `OTPField` component for one-time password and verification code entry (#4365) by @atomiks

### Popover

- Remove stray focus guards around trigger when `modal` (#4350) by @atomiks
- Sync hover open event state (#4526) by @atomiks

### Preview Card

- Fix hover reopen race conditions across close transitions (#4446) by @arturbien

### Select

- Fix browser autofill with object values when autofill uses the label (#4560) by @mattrothenberg
- Preserve touch exit animations (#4325) by @atomiks
- Fix touch reopen highlight (#4356) by @atomiks
- Fix scroll arrows stopping short of the edges (#4447) by @atomiks
- Fix RTL-aligned popup positioning with `alignItemWithTrigger` (#4531) by @atomiks

### Slider

- Fix edge thumb alignment after reveal (#4354) by @atomiks
- Remove extra TalkBack focus targets (#4242) by @atomiks
- Fix keyboard floating-point rounding (#4548) by @atomiks
- Skip client-only prehydration scripts (#4530) by @atomiks

### Switch

- Prevent input state changes in `readOnly` mode (#4551) by @tsbehlman

### Tabs

- Fix `activationDirection` not updating on programmatic value changes (#4347) by @LukasTy
- Fix activation direction on first render (#4532) by @atomiks
- Skip client-only prehydration scripts (#4530) by @atomiks

### Toast

- Keep viewport expanded while touch swiping (#4411) by @atomiks
- Add upsert support to `add` method (#4440) by @atomiks
- Fix timers not resuming after window regains focus (#4438) by @kyrregjerstad

### Toggle Group

- Fix incorrect keyboard nav on cross axis (#4488) by @mj12albert

All contributors of this release in alphabetical order: @arturbien, @atomiks, @CiscoFran10, @devxoul, @flaviendelangle, @kyrregjerstad, @LukasTy, @lunaxislu, @mattrothenberg, @mdm317, @michaldudak, @mj12albert, @Profesor08, @ryanrhee, @sai6855, @tsbehlman

## v1.3.0

_Mar 12, 2026_

### General changes

- Warn when a component function is rendered directly (#4077) by @atomiks
- Reset `openMethod` after close transition (#4128) by @atomiks
- Fire <kbd>Space</kbd> activation on `keydown` in composite widgets (#4053) by @atomiks
- Skip CSS-hidden items during keyboard navigation in composite widgets (#4195) by @atomiks
- Optimize hot paths in `useHover` hooks and `safePolygon` (#4199) by @atomiks
- Snap `--anchor-width` and `--anchor-height` to device pixel grid (#4082) by @flaviendelangle
- Fix outside press dismissal when a component is portaled into a shadow DOM (#4230) by @dmitri-gb
- Fix nested hoverable popups (#4206) by @dmitri-gb
- Apply `data-base-ui-inert` to highest-level node (#3955) by @atomiks
- Fix portable types (#4058) by @cgatian

### Accordion

- Add generic `Value` typing (#4138) by @atomiks

### Autocomplete

- Respect a `null` `filter` prop (#4117) by @atomiks
- Add `InputGroup` part (#3745) by @atomiks

### Avatar

- Remove fallback transition logic and prevent premature image display (#4110) by @atomiks

### Button

- Avoid checking `disabled` twice in `onKeyDown` and `onKeyUp` (#4132) by @flaviendelangle

### Checkbox

- Add automatic `aria-labelledby` support (#4142) by @atomiks

### Combobox

- Avoid applying field attributes to input when it is inside popup (#4154) by @atomiks
- Preserve inline input on `Enter` when nothing is highlighted (#4235) by @atomiks
- Fix ARIA attributes during SSR (#4179) by @atomiks
- Fix wrapping in virtualized grid arrow-key navigation (#4164) by @atomiks
- Add `InputGroup` part (#3745) by @atomiks
- Add support for a visually hidden close button and improve modal focus trapping (#4084) by @atomiks
- Add `Label` part (#4167) by @atomiks

### Context Menu

- Ignore `mouseup` on non-Mac platforms (#3944) by @atomiks

### Drawer

- **Breaking change:** `Drawer` is no longer marked as preview<br />
  `Drawer` is now stable and should be imported as `{ Drawer } from '@base-ui/react/drawer'` (#4293) by @atomiks
- Fix React 17 support (#4178) by @atomiks
- Include border in frontmost height variable (#4202) by @atomiks
- Improve touch selection (#4104) by @atomiks
- Preserve cross-axis scrolling during touch gestures (#4187) by @atomiks
- Prevent swipe dismissal when component is controlled (#4133) by @flaviendelangle
- Add `SwipeArea` part (#4102) by @atomiks
- Make `data-base-ui-swipe-ignore` explicit for touch interactions (#4295) by @atomiks
- Disable inheritance for swipe CSS variables (#4099) by @atomiks

### Field

- Fix field validation when `Form` errors or `invalid` prop are present at same time (#4112) by @mj12albert

### Menu

- Prevent `pointerleave` from stealing focus from dialogs (#4125) by @atomiks
- Optimize `pointer-events` for submenu hover interactions (#4231) by @atomiks
- Fix `closeDelay` not being applied to `Menu.SubmenuTrigger` (#4134) by @flaviendelangle
- Implement content transitions with `Viewport` (#4060) by @michaldudak

### Meter

- Fix label announcements in NVDA (#4200) by @mj12albert

### Navigation Menu

- Fix support for nested inline menus (#4198) by @atomiks
- Fix close propagation in nested hover menus (#4285) by @atomiks
- Close parent menus when nested link with `closeOnClick` is clicked (#4276) by @CiscoFran10
- Fix duplicate `aria-orientation` (#4309) by @atomiks
- Fix delayed trigger switches in Safari (#4310) by @atomiks

### Number Field

- Fix increment/decrement press `reason` values in `onValueCommitted` (#4259) by @jijiseong

### Popover

- Trap focus when `<Popover.Close>` is rendered inside and `modal` is `true`, and add support for a visually hidden close button (#4084) by @atomiks
- Fix nested hoverable popups (#3798) by @flaviendelangle

### Preview Card

- Fix nested hoverable popups (#3798) by @flaviendelangle

### Progress

- Fix label announcements in NVDA (#4200) by @mj12albert

### Radio Group

- Add automatic `aria-labelledby` support (#4142) by @atomiks

### Scroll Area

- Fix focus trapping with a non-scrollable viewport (#4220) by @atomiks
- Fix thumb size after remounting (#4107) by @atomiks

### Select

- Fix hidden input `id` fallback (#4135) by @atomiks
- Fix `Value` placeholder not rendering with `Record` items (#4137) by @vcode-sh
- Fire `onClick` during drag-to-select (#3969) by @obeattie
- Fix `items` type definition for groups (#3884) by @aarongarciah
- Fix `alignItemWithTrigger` fallback with browser zoom (#4292) by @atomiks
- Add `Label` part (#4167) by @atomiks

### Slider

- Add `Label` part (#4167) by @atomiks
- Stop committing validation on `touchend` (#4091) by @jijiseong

### Switch

- Add automatic `aria-labelledby` support (#4142) by @atomiks

### Tabs

- Re-render indicator position on tab resize (#4165) by @atomiks

### Toast

- Enable closing all toasts (#3979) by @chuganzy
- Prevent duplicate `onClose` calls for ending toasts (#4280) by @chuganzy

### Tooltip

- Add `closeOnClick` prop (#4140) by @atomiks

All contributors of this release in alphabetical order: @aarongarciah, @atomiks, @cgatian, @chuganzy, @CiscoFran10, @dmitri-gb, @flaviendelangle, @jijiseong, @michaldudak, @mj12albert, @obeattie, @vcode-sh

## v1.2.0

_Feb 12, 2026_

### General changes

- Do not memoize `state` when not needed (#3812) by @flaviendelangle
- Support lazy element in `render` prop (#3856) by @oliviertassinari
- Replace Firefox deprecated mozInputSource check for virtual click detection (#3942) by @CiscoFran10
- Use `WeakRef` for previously focused elements (#3916) by @atomiks
- Fix page scroll jump when input has focus on unmount in Safari (#3925) by @atomiks
- Fix flash at origin before positioning completes in Preact (#3975) by @OliverSpeir
- Reduce style recalculation with classic scrollbars (#3854) by @mdm317
- Fix event handling in useEnhancedClickHandler (#3981) by @sai6855

### Autocomplete

- Fix filter method's `useMemo` dependency (#3862) by @ZeeshanTamboli
- Fix Autocomplete not using its internal filter method when `mode` is `list` (#3936) by @ZeeshanTamboli
- Remove unnecessary double stringification of item in filtering logic (#3945) by @ZeeshanTamboli
- Add `useFilteredItems` hook (#3732) by @guisehn
- Fix popup closing on iOS VoiceOver (#3859) by @atomiks
- Remove `aria-readonly` prop from `Clear` and `Popup` components when `readOnly` (#3907) by @markocupic024

### Avatar

- Add transition attributes (#3939) by @atomiks

### Button

- Capture component stack for `nativeButton` error message (#3861) by @atomiks

### Checkbox

- Cleanup disabled state tracking (#3913) by @atomiks
- Preserve modifier key properties in the change event (#3935) by @mj12albert
- Allow exit animations on `<Checkbox.Indicator>` when `keepMounted={false}` (#3939) by @atomiks

### Combobox

- Fix the type of the ref of the `Icon` part (#3796) by @flaviendelangle
- Avoid clearing selected value if item is not present in items array (#3824) by @atomiks
- Fix highlight change reason in `ChipRemove` (#3980) by @sai6855
- Keep highlight on last deselect (#3923) by @atomiks
- Fix inline filtering after selection in single mode (#3978) by @atomiks
- Clear highlight on inline blur when inline (#3973) by @atomiks
- Prevent opening popup on autofill change (#3924) by @atomiks
- Distinguish `input-press` from `trigger-press` in `onOpenChange` reason (#4015) by @jijiseong
- Fix async items while popup is open (#4034) by @atomiks
- Prevent `Chip` from receiving focus when `disabled` (#4044) by @jijiseong
- Add `useFilteredItems` hook (#3732) by @guisehn
- Fix popup closing on iOS VoiceOver (#3859) by @atomiks
- Remove `aria-readonly` prop from `Clear` and `Popup` components when `readOnly` (#3907) by @markocupic024
- Fix `onClick` `Item` type (#3964) by @atomiks
- Use reactive `domReferenceElement` subscriptions (#4017) by @atomiks
- Add `autoComplete` prop for explicit browser autofill support (#4005) by @mattrothenberg
- Fix inconsistent isItemEqualToValue argument order (#4056) by @atomiks

### Context Menu

- Fix `disabled` prop not working (#3806) by @arturbien
- Fix explicit `collisionAvoidance` with `side: 'flip'` not working (#3877) by @obeattie

### Drawer

- Create new Drawer / Sheet component (#3680) by @atomiks

### Field

- Prevent re-renders when `Field.Control` is uncontrolled (#3820) by @atomiks
- Fix autofocus in SSR environments (#3871) by @mj12albert
- Fix max update depth loop when using `<React.Activity>` (#3931) by @atomiks
- Add transition attributes (#3939) by @atomiks

### Input

- Fix autofocus in SSR environments (#3871) by @mj12albert
- Update ref type to `HTMLElement` (#3866) by @mj12albert

### Menu

- Fix `onClick` `Item` type (#3964) by @atomiks
- Fix submenu stuck glitch (#3783) by @atomiks
- Fix race conditions (#3821) by @atomiks
- Add `<Menu.LinkItem>` part (#3400) by @mj12albert

### Navigation Menu

- Fix forwarded ref types (#3775) by @CrawlerCode
- Add `keepMounted` prop to `Content` part (#3794) by @atomiks

### Number Field

- Fix click handlers on ScrubArea (#3827) by @mj12albert
- Remove `event.isTrusted` (#3920) by @atomiks
- Stop repeat change at bounds (#3915) by @atomiks
- Add `allowOutOfRange` prop (#3919) by @atomiks
- Fix pen pointer handling (#3917) by @atomiks
- Fix missing field state data attributes (#3909) by @mj12albert

### Popover

- Fix missing `aria-owns` element (#3959) by @atomiks
- Use reactive `domReferenceElement` subscriptions (#4017) by @atomiks
- Fix broken scale transition with detached triggers (#3810) by @michaldudak

### Preview Card

- Fix broken scale transition with detached triggers (#3810) by @michaldudak

### Progress

- De-duplicate `formatValue` function (#3805) by @sai6855

### Radio Group

- Preserve modifier key properties in the change event (#3935) by @mj12albert
- Allow exit animations on `<Radio.Indicator>` when `keepMounted={false}` (#3939) by @atomiks
- Rely on individual radio hidden inputs (#3826) by @atomiks
- Add generic `Value` typing to `Radio` (#4033) by @atomiks

### Scroll Area

- Add `data-scrolling` state attribute to `Root` and `Viewport` parts (#3823) by @arturbien
- Fix overflow edge rounding (#3888) by @atomiks

### Select

- Add `finalFocus` prop (#3785) by @markocupic024
- Fix `alignItemWithTrigger` transform with CSS animations (#3831) by @atomiks
- Fix `highlightItemOnHover` not being respected (#3868) by @sarthakmalik0810
- Reset typeahead on external blur (#2618) by @antonfrolovsky
- Fix scroll height loop (#3795) by @atomiks
- Add `autoComplete` prop for explicit browser autofill support (#4005) by @mattrothenberg
- Fix inconsistent isItemEqualToValue argument order (#4056) by @atomiks

### Slider

- Fix missing field state data attributes (#3909) by @mj12albert
- Fix change event cloning (#3960) by @atomiks

### Switch

- Preserve modifier key properties in the change event (#3935) by @mj12albert

### Tabs

- Add transition attributes to `<Tabs.Panel>` part (#3880) by @atomiks

### Toast

- Make `useToastManager` and `createToastManager` generic functions (#3882) by @solastley
- Prevent dismissed promise toast from reopening on updates (#4040) by @atomiks
- Introduce a store (#3464) by @flaviendelangle

### Toggle

- Improve type safety and inference (#3173) by @michaelhazan

### Toggle Group

- Type value as string to match Toggle (#3770) by @markocupic024
- Enable `Home`/`End` key navigation (#3971) by @jijiseong
- Improve type safety and inference (#3173) by @michaelhazan

### Tooltip

- Prevent opening when focusing a disabled Trigger (#3902) by @michaldudak
- Fix broken scale transition with detached triggers (#3810) by @michaldudak
- Fix disabled prop on Triggers (#4049) by @michaldudak

All contributors of this release in alphabetical order: @antonfrolovsky, @arturbien, @atomiks, @CiscoFran10, @CrawlerCode, @flaviendelangle, @guisehn, @jijiseong, @LukasTy, @markocupic024, @mattrothenberg, @mdm317, @michaelhazan, @michaldudak, @mj12albert, @obeattie, @OliverSpeir, @oliviertassinari, @sai6855, @sarthakmalik0810, @solastley, @ZeeshanTamboli

## v1.1.0

_Jan 15, 2026_

### General changes

- Fix `onOpenChangeComplete(true)` timing (#3558) by @atomiks
- Fix touch `openMethod` when tapping outside element bounds on Safari (#3541) by @atomiks
- Fix visually hidden input styles across form components (#3606) by @atomiks
- Fix click and drags outside a nested popup component from closing its parents (#3571) by @atomiks
- Fix forwarded ref types (#3638) by @atomiks
- Fix detached trigger remounting (#3724) by @atomiks
- Include `ref` in `BaseUIComponentProps` (#2813) by @atomiks
- Remove duplicated `disabled` prop (#3650) by @seongminn
- Allow `actionsRef` to be `null` (#3682) by @mj12albert

### Accordion

- Fix keyboard navigation with non-interactive trigger elements (#3684) by @ZeeshanTamboli

### Autocomplete

- Add `data-popup-side` and `data-list-empty` state attributes to `<Autocomplete.Trigger>` (#3491) by @atomiks
- Add `loopFocus` prop (#3592) by @atomiks
- Fix hidden input `id` and `required` props (#3640) by @atomiks

### Button

- Remove discriminated props union (#3643) by @atomiks

### Checkbox

- Fix hidden input `id` and `required` props (#3640) by @atomiks

### Combobox

- Add `data-popup-side` and `data-list-empty` state attributes to `<Combobox.Trigger>` (#3491) by @atomiks
- Add `loopFocus` prop (#3592) by @atomiks
- Add `toolbar` role to `<Combobox.Chips>` to prevent NVDA from entering browse mode (#3647) by @atomiks
- Add `placeholder` prop to `<Combobox.Value>` (#3604) by @atomiks
- Fix controlled `value` prop when `items` change (#3607) by @atomiks
- Fix `multiple` values label resolution in `<Combobox.Value>` (#3314) by @atomiks
- Forward root `id` to visible form element (#3722) by @atomiks
- Do not trigger Field `onBlur` handlers when opening popup (#3609) by @atomiks

### Context Menu

- Avoid creating sibling elements next to trigger (#3645) by @atomiks

### CSP Provider

- Add `CSPProvider` (#3553) by @atomiks

### Dialog

- Fix `Maximum update depth exceeded` error with Suspense (#3700) by @michaldudak
- Fix `<Dialog.Title>` forwardedRef type (#3736) by @ZeeshanTamboli

### Field

- Add `actionsRef` prop (#3395) by @mj12albert
- Add `nativeLabel` prop to `<Field.Label>` (#3723) by @atomiks
- Add missing type export (#3702) by @DiegoAndai

### Form

- Add `actionsRef` prop (#3395) by @mj12albert

### Menu

- Fix focus guard handling (#3654) by @atomiks
- Avoid disabling modality on click after hover-open (#3455) by @atomiks

### Menubar

- Fix submenu outside-press dismiss on touch (#3556) by @atomiks

### Number Field

- Fix Field `data-focused` state (#3563) by @atomiks
- Fix hidden input focus on submit (#3581) by @atomiks

### Popover

- Fix popup auto resize glitches (#3591) by @atomiks
- Fix focus guard handling (#3654) by @atomiks
- Prevent disabling focus management when clicking trigger before hover delay completes (#3572) by @atomiks
- Refactor popup auto resize logic. It is no longer necessary to specify `--positioner-width`/`--positioner-height` CSS variables on `<Popover.Positioner>` when using detached triggers unless the `Viewport` part has been added to the JSX. (#3652) by @atomiks

### Preview Card

- Support detached triggers (#3566) by @michaldudak and @atomiks

### Radio Group

- Fix `value` type (#3582) by @atomiks
- Fix hidden input `id` and `required` props (#3640) by @atomiks

### Scroll Area

- Perf improvements (#3536) by @atomiks

### Select

- Add `placeholder` prop to `<Select.Value>` (#3604) by @atomiks
- Fix support for transform animations when `alignItemWithTrigger` is active (#3532) by @atomiks
- Fix support for `max-height` popup style when `alignItemWithTrigger` is active (#3573) by @atomiks
- Fix `data-filled` state in `multiple` mode (#3608) by @atomiks
- Fix highlight being removed on popup mouseout when `highlightItemOnHover` is disabled (#3492) by @atomiks
- Fix support for individual transform animations when `alignItemWithTrigger` is active (#3637) by @atomiks
- Fix `multiple` values label resolution in `<Select.Value>` (#3314) by @atomiks
- Forward root `id` to visible form element (#3722) by @atomiks
- Do not trigger Field `onBlur` handlers when opening popup (#3609) by @atomiks

### Slider

- Fix `onValueCommitted` not called for range sliders (#3600) by @mj12albert

### Switch

- Add `value` prop (#3676) by @Grafikart
- Fix hidden input `id` and `required` props (#3640) by @atomiks

### Toast

- Fix timers not being rescheduled when updated (#3564) by @atomiks

### Tooltip

- Fix popup auto resize glitches (#3591) by @atomiks
- Fix `trackCursorAxis` handling (#3679) by @atomiks
- Refactor popup auto resize logic. It is no longer necessary to specify `--positioner-width`/`--positioner-height` CSS variables on `<Tooltip.Positioner>` when using detached triggers unless the `Viewport` part has been added to the JSX. (#3652) by @atomiks

### mergeProps

- Make `mergeProps` public (#3642) by @michaldudak and @LukasTy

### useRender

- Export missing types (#3565) by @michaldudak

All contributors of this release in alphabetical order: @albertdugba, @atomiks, @brijeshb42, @chuganzy, @colmtuite, @dav-is, @DiegoAndai, @Grafikart, @Janpot, @LukasTy, @michaldudak, @mj12albert, @oliviertassinari, @seongminn, @updbqn, @ZeeshanTamboli

## v1.0.0

_Dec 11, 2025_

### General changes

- **Breaking change:** Rename packages to use the `@base-ui` org.<br />
  The package name has changed from `@base-ui-components/react` to `@base-ui/react`.
  (#3462) by @mnajdova

### Combobox

- Respect `itemToStringValue` for `onFormSubmit` (#3441) by @atomiks
- Add `null` as an option for the value prop (#3488) by @mnajdova

### Menu

- Fix submenu opens with 0 delay (#3459) by @atomiks
- Fix focus not returning to trigger on <kbd>Esc</kbd> while pointer rests on popup (#3482) by @atomiks
- Fix always `null` open method (#3486) by @atomiks
- Allow side axis fallback for submenus by default (#3470) by @atomiks

### Navigation Menu

- Fix mount transitions on `Positioner` in Firefox (#3424) by @atomiks

### Number Field

- Fix multiple scrub area support (#3471) by @atomiks

### Popover

- Fix mount transitions on `Positioner` in Firefox (#3424) by @atomiks
- Fix skipped viewport transitions (#3453) by @atomiks

### Select

- Respect `itemToStringValue` for `onFormSubmit` (#3441) by @atomiks
- Add `null` as an option for the value prop (#3488) by @mnajdova

### Tabs

- Fix indicator positioning in transformed containers (#3439) by @atomiks
- Do not initially select a disabled tab (#3475) by @michaldudak

### Toast

- Fix `flushSync` dev error when toast is added (#3443) by @atomiks
- Fix `<Toast.Close>;` emitting `aria-hidden` warning on click (#3469) by @atomiks

### Toggle Group

- More permissive towards falsy toggle values (#3477) by @mj12albert

### Tooltip

- Fix mount transitions on `Positioner` in Firefox (#3424) by @atomiks
- Fix ignored "modal" setting in Popovers experiment (#3474) by @michaldudak
- Fix shared tooltip closing with trigger gaps (#3452) by @atomiks
- Fix skipped viewport transitions (#3453) by @atomiks

All contributors of this release in alphabetical order: @atomiks, @LukasTy, @michaldudak, @mj12albert, @mnajdova, @oliviertassinari, @pondorasti, @romgrk, @ZeeshanTamboli

## v1.0.0-rc.2

_Dec 11, 2025_

This release contains the same code as v1.0.0.
Please refer to that version to see the changes.

## v1.0.0-rc.1

_Dec 11, 2025_

This release contains the same code as v1.0.0.
Please refer to that version to see the changes.

## v1.0.0-rc.0

_Dec 4, 2025_

### General changes

- Fix missing `'use client'` directives (#3408) by @atomiks

### Autocomplete

- Fix `keepHighlight` focus sync (#3399) by @atomiks

### Checkbox

- **Breaking change:** Match native unchecked state in form submission.<br />
  The Checkbox will not submit the `"off"` value with a form when unchecked anymore, unless the new `uncheckedValue` prop is set.
  (#3406) by @atomiks

### Collapsible

- Remove `render={null}` (#3407) by @mj12albert

### Combobox

- **Breaking change:** Removed the `keepHighlight` prop (#3377) by @atomiks

### Dialog

- Close when pressing focusable element outside (#3380) by @atomiks
- Fix closing after pointer lock exit in Firefox (#3379) by @atomiks

### Menu

- Add `highlightItemOnHover` prop (#3377) by @atomiks
- Do not import client components from MenuStore (#3409) by @michaldudak

### Number Field

- Ensure hidden input participates in form validation (#3374) by @atomiks
- Improve symbol replacement logic (#3376) by @atomiks
- Fix fractional step snapping (#3375) by @atomiks
- Fix parsing numbers with Swiss locale (#3361) by @michaldudak
- Fix pointer lock release when soft clicking in Firefox (#3378) by @atomiks

### Popover

- Close when pressing focusable element outside (#3380) by @atomiks
- Fix modal backdrop on touch (#3383) by @atomiks
- Fix popover glitching when flipped (#3364) by @michaldudak

### Select

- Add `highlightItemOnHover` prop (#3377) by @atomiks

### Switch

- **Breaking change:** Match native off state in form submission.<br />
  The Switch will not submit the `"off"` value with a form when unchecked anymore, unless the new `uncheckedValue` prop is set.
  (#3406) by @atomiks

### Tabs

- **Breaking change:** Fix Panel `keepMounted` behavior.<br />
  The `value` prop is now required on `<Tabs.Tab>` and `<Tabs.Panel>` parts.
  (#3372) by @atomiks

### Toast

- Recalculate content height when layout size is fixed (#3359) by @atomiks
- Fix multiple swipe directions on same axis (#3392) by @mj12albert

### Tooltip

- Improve contained triggers performance (#3385) by @michaldudak

All contributors of this release in alphabetical order: @atomiks, @michaldudak, @mj12albert, @oliviertassinari, @pondorasti, @romgrk

## v1.0.0-beta.7

_Nov 27, 2025_

### General changes

- Fix error about `props.ref` access in React &lt;=18 (#3257) by @atomiks
- Prefer non-adaptive anchoring position in `<Positioner>` components and fix `autoFocus` scroll jumps (#3250) by @atomiks
- Make popups' `data-anchor-hidden` state attribute check for anchor presence in layout (#3267) by @atomiks
- Prevent popups from sticking after hover when pressing `&lt;a&gt;` tags inside them (#3318) by @atomiks
- Improve performance when detached triggers are used (#3277)
- Fix iOS VoiceOver voice control accessibility in non-modal popups (#3340)

### Alert Dialog

- Fix trigger registration loop (#3249) by @atomiks
- Fix focus restoration when focused element is hidden with CSS (#3313)

### Checkbox Group

- Fix `aria-describedby` on checkbox group (#3269) by @mj12albert

### Combobox

- Revert overload types to ensure typed wrappers work correctly (#3254) by @atomiks
- Fix ignored `filteredItems` instances (#3272) by @atomiks
- Fix loop when passing `undefined` to `items` prop (#3348)

### Context Menu

- Block mouseup at initial cursor point (#3274) by @atomiks

### Dialog

- Fix trigger registration loop (#3249) by @atomiks
- Fix focus restoration when focused element is hidden with CSS (#3313)

### Form

- Fix cast `ref` type (#3324) by @mj12albert

### Menu

- Fix trigger registration loop (#3249) by @atomiks
- Do not pass `key` to the rendered element (#3255) by @michaldudak
- Fix nested dialog from closing on <kbd>Shift+Tab</kbd> (#3346)

### Navigation Menu

- Fix Safari 18 issue where `<Positioner>` width may be set to 0 on hover (#3309) by @EmilNordling
- Ensure submenu triggers participate in composite list (#3344) by @atomiks

### Number Field

- Fix literal space handling with symbols (#3334) by @atomiks

### Popover

- Fix trigger registration loop (#3249) by @atomiks
- Do not pass `key` to the rendered element (#3255) by @michaldudak
- Fix focus restoration when focused element is hidden with CSS (#3313)

### Select

- Revert overload types to ensure typed wrappers work correctly (#3254) by @atomiks

### Slider

- Fix extra `onValueCommitted` calls (#3312) by @mj12albert
- Fix cast `ref` type (#3324) by @mj12albert

### Tooltip

- Fix trigger registration loop (#3249) by @atomiks

All contributors of this release in alphabetical order: @atomiks, @brijeshb42, @Copilot, @EmilNordling, @michaldudak, @mj12albert, @oliviertassinari, @ZeeshanTamboli

## v1.0.0-beta.6

_Nov 17, 2025_

This is a hotfix release with the following changes:

- Fix for rendering of Alert Dialog, Dialog, Menu, Popover, and Tooltip in React Server Components (#3241) by @michaldudak
- Fix of the types of the refs in the Checkbox, Switch and Radio components (#3246) by @mnajdova
- Fix of the value type error with mergeProps (#3247) by @atomiks

## v1.0.0-beta.5

_Nov 17, 2025_

### General changes

- **Breaking change:** Replace `trackAnchor` with `disableAnchorTracking`.<br />
  If you were using `trackAnchor={false}`, be sure to update your usage to `disableAnchorTracking` instead.
  (#3188) by @mnajdova
- **Breaking change:** Rename `loop` to `loopFocus` (#3186) by @mnajdova
- Fix type portability (#2912) by @atomiks
- Accept a function for the `style` prop (#3038) by @mnajdova
- Create portal elements inside React (#2889) by @atomiks
- Avoid applying `hidden` attribute to indicator elements when they specify `keepMounted` and are invisible (#3228) by @atomiks
- Fix crash in Next.js 16 when accessing `render.props.ref` (#3231) by @atomiks

### Accordion

- **Breaking change:** Change `multiple` prop to be false by default and add a demo (#3141) by @mnajdova
- Fix flaky exit transition (#3101) by @atomiks

### Alert Dialog

- Fix `initialFocus` as function being called on close (#2949) by @atomiks
- Support detached triggers (#2974) by @michaldudak
- Place `overflow: hidden` on `<body>` for overlay scrollbars by default. Avoids sticky elements shifting if `<body>` has an `overflow` style specified. (#3083) by @atomiks
- Add `<AlertDialog.Viewport>` part (#2808) by @atomiks

### Autocomplete

- **Breaking change:** Refactor `alwaysSubmitOnEnter` to `submitOnItemClick` prop.<br />
  If you were using `alwaysSubmitOnEnter`, be sure to update your usage to `submitOnItemClick` instead.
  (#3018) by @atomiks
- Prevent blocking filtering while composing text on Android (#2944) by @atomiks
- Add empty state to `List.State` (#2934) by @atomiks
- Fix `initialFocus` as function being called on close (#2949) by @atomiks
- Add `role="combobox"` to `<Autocomplete.Trigger>` if `<Autocomplete.Input>` is inside Popup (#2973) by @atomiks
- Fix stale `onItemHighlighted` data when filtering with `autoHighlight` (#2829) by @atomiks
- Add empty and side styling attributes on `<Autocomplete.Input>` (#2926) by @atomiks
- Fix `<Autocomplete.Value>` component return type for React 17 (#3050) by @atomiks
- Support `autoHighlight: "always"`, and add `keepHighlight`, `highlightItemOnHover` props (#2976) by @atomiks
- Keep focus on input when pressing list element (#3092) by @atomiks
- Allow <kbd>Esc</kbd> to bubble if `<Autocomplete.Empty>` is not used (#2935) by @atomiks
- Add `dialog` role to popup when input is inside (#3213) by @atomiks

### Button

- New `<Button>` component (#2363) by @atomiks

### Checkbox

- **Breaking change:** Render root as `<span>` instead of `<button>`
  (#3205) by @mj12albert

### Collapsible

- Fix `starting-style` state (#2985) by @atomiks

### Combobox

- Take into account `isItemEqualToValue` when selecting an option in multiple mode (#2893) by @epr3
- Move `CompositeList` to `List` component to make `Input` work with composites (#2883) by @chuganzy
- Fix `onValueChange` type inference when `value` is unspecified (#2897) by @atomiks
- Fix `required` form submission with multiple values (#2925) by @atomiks
- Fix <kbd>Home</kbd>/<kbd>End</kbd> Input scroll in Chrome/Safari (#2928) by @atomiks
- Prevent blocking filtering while composing text on Android (#2944) by @atomiks
- Add empty state to `List.State` (#2934) by @atomiks
- Fix `initialFocus` as function being called on close (#2949) by @atomiks
- Add `role="combobox"` to `<Combobox.Trigger>` if `<Combobox.Input>` is inside Popup (#2973) by @atomiks
- Fix `Field` control ref when input is inside popup (#2971) by @atomiks
- Fix stale `onItemHighlighted` data when filtering with `autoHighlight` (#2829) by @atomiks
- Add empty and side styling attributes on `<Combobox.Input>` (#2926) by @atomiks
- Fix `<Combobox.Value>` component return type for React 17 (#3050) by @atomiks
- Fix input value derivation on `value` and `items` prop updates (#3067) by @atomiks
- Support `autoHighlight: "always"`, and add `keepHighlight`, `highlightItemOnHover` props (#2976) by @atomiks
- Keep focus on input when pressing list element (#3092) by @atomiks
- Fix support of dialog + combobox pattern (#3049) by @atomiks
- Support drag-to-select (#3167) by @atomiks
- Allow <kbd>Esc</kbd> to bubble if `<Combobox.Empty>` is not used (#2935) by @atomiks
- Fix stuck filtering with differing stringifiers (#3201) by @atomiks
- Add `dialog` role to popup when input is inside (#3213) by @atomiks

### Context Menu

- Add `open` state to `<ContextMenu.Trigger>` (#3195) by @atomiks
- Fix ignored `anchor` prop on `<ContextMenu.Positioner>` (#3202) by @atomiks

### Dialog

- **Breaking change:** Replace `dismissible` with `disablePointerDismissal`.<br />
  If you were using `dismissible={false}`, replace it with `disablePointerDismissal`.
  (#3190) by @mnajdova
- Fix `initialFocus` as function being called on close (#2949) by @atomiks
- Support detached triggers (#2974) by @michaldudak
- Place `overflow: hidden` on `<body>` for overlay scrollbars by default. Avoids sticky elements shifting if `<body>` has an `overflow` style specified. (#3083) by @atomiks
- Add `<Dialog.Viewport>` part and scrollable demos on docs (#2808) by @atomiks

### Field

- **Breaking change:** Add `onSubmit` validation mode and make it the default over `onBlur`.<br />
  Fields that use non-`required` attribute validation no longer validate the control on blur. Instead, validation first occurs `onSubmit`, and afterwards revalidation occurs `onChange`.
  (#3013) by @mj12albert
- Add `dirty` and `touched` props (#2950) by @mj12albert
- New `<Field.Item>` part (#2810) by @mj12albert
- Fix `validationMode="onChange"` not clearing custom error state (#3048) by @mj12albert
- Fix external `onChange` validation mode errors (#3137) by @atomiks

### Form

- **Breaking change:** The `onClearErrors` prop has been removed.<br />
  Errors from the `errors` prop are always cleared when the value changes.
  (#3136) by @mj12albert
- Add `onSubmit` validation mode.<br />
  Additionally, `validationMode` can be set on `<Form>`.
  (#3013) by @mj12albert
- Add `onFormSubmit` callback (#3131) by @mj12albert

### Menu

- **Breaking change:** Support detached triggers.<br />
  `openOnHover`, `delay`, and `closeDelay` props have been moved from `<Menu.Root>` to `<Menu.Trigger>`.<br />
  Additionally, menus now must have at least one `<Menu.Trigger>` element.
  (#3170) by @michaldudak
- Ignore disabled item on initial focusing (#2604) by @mnajdova
- Fix stealing focus from dialogs on close (#2920) by @atomiks
- Place `overflow: hidden` on `<body>` for overlay scrollbars by default. Avoids sticky elements shifting if `<body>` has an `overflow` style specified. (#3083) by @atomiks

### Navigation Menu

- Fix nested popup dismiss actions (#2978) by @atomiks
- Fix error on React 17 (#3204) by @atomiks

### Number Field

- Granular change reasons (#3132) by @atomiks

### Popover

- **Breaking change:** Support detached triggers and multiple triggers per popover.<br />
  `openOnHover`, `delay`, and `closeDelay` props have been moved from `<Popover.Root>` to `<Popover.Trigger>`.
  (#2336) by @michaldudak
- Fix `initialFocus` as function being called on close (#2949) by @atomiks
- Fix swiping or scrolling on nested popup dismissing popover on touch (#3011) by @atomiks
- Place `overflow: hidden` on `<body>` for overlay scrollbars by default. Avoids sticky elements shifting if `<body>` has an `overflow` style specified. (#3083) by @atomiks

### Preview Card

- **Breaking change:** Move delay props to trigger.<br />
  If you were using `delay` or `closeDelay` props, be sure to move them to from `<PreviewCard.Root>` to the `<PreviewCard.Trigger>` component.
  (#3182) by @atomiks

### Radio Group

- **Breaking change:** Render root as `<span>` instead of `<button>`
  (#3205) by @mj12albert

### Scroll Area

- **Breaking change:** Improve CSS vars performance.<br />
  The CSS variables are now on the `<ScrollArea.Viewport>` part, not `<ScrollArea.Root>`, and inheritance is disabled for all child elements (or pseudo-elements). Children must manually opt in using `--scroll-area-[variable-name]: inherit`.
  (#3156) by @atomiks

### Select

- **Breaking change:** Make the trigger native button by default.<br />
  The trigger now renders a `<button>` element, be sure to adjust your code if necessary.
  (#3177) by @mnajdova
- Add `open` state type on `Select.Icon` interface (#2919) by @komkanit
- Fix `onValueChange` type inference when `value` is unspecified (#2897) by @atomiks
- Fix `required` form submission with multiple values (#2925) by @atomiks
- Avoid re-rendering on popup height expansion (#2972) by @atomiks
- Place `overflow: hidden` on `<body>` for overlay scrollbars by default. Avoids sticky elements shifting if `<body>` has an `overflow` style specified. (#3083) by @atomiks
- Add `data-placeholder` attribute (#2737) by @seongminn

### Slider

- **Breaking change:** Add `thumbCollisionBehavior` prop.<br />
  In range sliders, moving a thumb with a pointer will now push other thumbs it collides with to avoid blocking drag movements by default (the default value is `push`).<br />
  The value `swap` was also added, which allows thumbs to be dragged past each other when they collide.<br />
  Lastly, the value `none` is the same as the previous behavior, where thumbs can't be dragged past one another.<br />
  Keyboard interactions always use `none` behavior.
  (#2856) by @atomiks
- Granular change reasons (#3132) by @atomiks

### Switch

- **Breaking change:** Render root as `<span>` instead of `<button>`
  (#3205) by @mj12albert

### Tabs

- **Breaking change:** Fix selected/active state naming consistency.<br />
  - Renamed `[data-selected]` to `[data-active]` in `<Tabs.Tab>`
  - Removed `[data-highlighted]` (`:focus-visible` was already the recommendation in styles)
  - `selectedTabPosition`/`selectedTabSize` are now `activeTabPosition`/`activeTabSize` in `Tabs.Indicator.State`
    (#3024) by @atomiks
- **Breaking change:** Change `activateOnFocus` to false.<br />
  If you need your Tabs to activate on focus, be sure to add `activateOnFocus` prop.
  (#3176) by @mnajdova
- Fix Next.js 16 error from `Math.random` id generation (#3051) by @atomiks
- Fix indicator sizing and offsets (#3214) by @atomiks

### Toast

- Allow `React.ReactNode` for `title`/`description` properties (#2929) by @atomiks
- Add ability to anchor to an element (#3096) by @atomiks

### Toolbar

- **Breaking change:** The `cols` prop has been removed.<br />
  This prop was not supposed to be exposed.
  (#3133) by @mj12albert

### Tooltip

- **Breaking change:** Support detached triggers.<br />
  `delay` and `closeDelay` props have been moved from `<Tooltip.Root>` to `<Tooltip.Trigger>`.
  (#3071) by @michaldudak
- **Breaking change:** Change `hoverable` to `disableHoverablePopup`.<br />
  In case you need to disable the hoverable popup behavior, be sure to add the `disableHoverablePopup` prop.
  (#3178) by @mnajdova
- Fix `data-instant` ending transition of same tooltip (#2962) by @atomiks

All contributors of this release in alphabetical order: @atomiks, @brianle1301, @brijeshb42, @chuganzy, @dav-is, @epr3, @fredericoo, @Janpot, @komkanit, @LukasTy, @michaldudak, @mj12albert, @mnajdova, @oliviertassinari, @romgrk, @seongminn, @sukvvon, @ZeeshanTamboli

## v1.0.0-beta.4

_Oct 1, 2025_

### General changes

- **Breaking change:** Generic event details.
  The main exported type is now `BaseUIChangeEventDetails` (with a paired `BaseUIGenericEventDetails`), not `BaseUIEventDetails`.
  (#2796) by @atomiks
- Update `disabled` prop of buttons when ref changes (#2756) by @chuganzy
- Refine event details (#2698) by @atomiks

### Accordion

- **Breaking change:** Use `useId` instead of composite index as fallback value.
  Accordion items must have an explicit `value` set in order to be initially open. Inferring the value by their DOM index is no longer supported.
  (#2664) by @mj12albert
- **Breaking change:** Rename `openMultiple` prop to `multiple`
  (#2764) by @LukasTy

### Autocomplete

- **Breaking change:** Rename `cols` to `grid` prop.
  Specify `grid={true}` instead of `cols={number}` - the columns are automatically inferred from `Autocomplete.Row`
  (#2683) by @atomiks
- Fix duplicate `onOpenChange` calls and pass correct DOM `event`.
  (#2682) by @atomiks
- Fix controlled input value updates (#2707) by @atomiks
- Fix input focus on close when clicking trigger (#2723) by @atomiks
- Add `alwaysSubmitOnEnter` prop and allow form submission on <kbd>Enter</kbd> if no item is highlighted by default (#2700) by @atomiks
- Use `ReadonlyArray` type for `items` (#2819) by @atomiks

### Collapsible

- Fix CollapsiblePanel type to use its own state (#2697) by @chuganzy
- Respect user's CSS `display` property on panel (#2772) by @mj12albert

### Combobox

- **Breaking change**: `onItemHighlighted` now has a `reason` property instead of `type` to be consistent with the `eventDetails` API. (#2796) by @atomiks
- **Breaking change:** Rename `cols` to `grid` prop.
  Specify `grid={true}` instead of `cols={number}` - the columns are automatically inferred from `Combobox.Row`
  (#2683) by @atomiks
- Fix duplicate `onOpenChange` calls and pass correct DOM `event`.
  (#2682) by @atomiks
- Fix initial closed typeahead (#2665) by @atomiks
- Support `autoHighlight` prop (#2668) by @atomiks
- Set default input value based on `value` prop (#2680) by @atomiks
- Fix controlled input value updates (#2707) by @atomiks
- Fix input focus on close when clicking trigger. Fixes a jump to the bottom of the page in Safari (#2723) by @atomiks
- Fix unexpected close with multiple selection and input inside popup (#2771) by @atomiks
- Allow form submission on <kbd>Enter</kbd> if no item is highlighted by default (#2700) by @atomiks
- Avoid refiltering with ending transition in multiple selection mode (#2681) by @atomiks
- Support object values with `isItemEqualToValue` prop (#2704) by @atomiks
- Use `ReadonlyArray` type for `items` (#2819) by @atomiks
- Fix misleading `item-press` reason in `onInputValueChange` (#2830) by @atomiks
- Clear single-select value on input clear (#2860) by @atomiks
- Fix `focusout` of input not closing popup under certain conditions (#2864)

### Context Menu

- Ensure submenus close when parents close (#2768) by @atomiks
- Fix `onClick` firing twice on first click of item (#2849) by @atomiks

### Menu

- Ensure submenus close when parents close (#2768) by @atomiks
- Allow non-nested portals across differing popup trees (#2818) by @atomiks

### Menubar

- Fix Menubar not disabling child Menus (#2736) by @aarongarciah
- Ensure submenus close when parents close (#2768) by @atomiks
- Fix `CompositeList` not updating item order on reordering (#2675) by @chuganzy

### Navigation Menu

- Make link close on click configurable (#2740) by @atomiks
- Fix focus returning to trigger without animations (#2779) by @atomiks
- Fix `CompositeList` not updating item order on reordering (#2675) by @chuganzy

### Number Field

- Fix stuck virtual cursor after mouse tap (#2720) by @atomiks
- Improve parsing logic (#2725) by @atomiks
- Align value changes with `Slider`. An `onValueCommitted` callback has been added. (#2726) by @atomiks

### Popover

- Allow non-nested portals across differing popup trees (#2818) by @atomiks

### Scroll Area

- Add overflow presence state attributes and CSS variables (#2478) by @atomiks
- Fix RTL horizontal scrollbar on Safari (#2776) by @atomiks
- Fix thumb size flicker (#2778) by @atomiks

### Select

- **Breaking change:** Add `Select.List` component. It is now possible for `Select.ScrollArrow` to show when in fallback (`alignItemWithTrigger` deactivated). As a result, if you want the scroll arrows to be hidden in this mode like before, change the styles to default to `display: none` on `.ScrollArrow`, and `display: block` when `[data-side="none"]`. (#2596) by @atomiks
- Block opening the popup when provided `readOnly` (#2717) by @seongminn
- Add `open` state for `Select.Icon` and fix `ref` type (#2714) by @seongminn
- Support object values with `isItemEqualToValue` prop (#2704) by @atomiks
- Use `ReadonlyArray` type for `items` (#2819) by @atomiks

### Slider

- **Breaking change:** `onValueChange` has `activeThumbIndex` as part of the `eventDetails` object as a second parameter, not third. (#2796) by @atomiks
- **Breaking change:** Remove redundant hidden inputs.
  The `inputRef` prop is moved from `Root` to `Thumb`.
  (#2631) by @mj12albert
- Fix pointer tracking bugs (#2688) by @mj12albert
- Fix input attributes (#2728) by @mj12albert
- Add `thumbAlignment` prop (#2540) by @mj12albert

### Switch

- Fix duplicate `name` attribute (#2763) by @mj12albert

### Toast

- **Breaking change:** Support variable height stacking.
  Toasts that have varying heights no longer force a `data-expanded` expanded state on the viewport. CSS should be amended to ensure larger toasts don't overflow a small toast stacked at the front. See this [diff](https://github.com/mui/base-ui/pull/2742/files#diff-e378460dafb74fe0c90ef960ad0ef1c38d68d74b63815520bb437f9041361917) for new styles, along with general improvements to stacking styles.
  (#2742) by @atomiks
- Reduce stickiness of expanded state (#2770) by @atomiks
- Ensure toast is frozen at its current visual transform while swiping (#2769) by @atomiks

### Toggle Group

- **Breaking change:** Rename `toggleMultiple` prop to `multiple`.
  (#2764) by @LukasTy

### Toolbar

- Fix `CompositeList` not updating item order on reordering (#2675) by @chuganzy

### useRender

- Add div as a `defaultTagName` (#2692) by @mnajdova

All contributors of this release in alphabetical order: @aarongarciah, @atomiks, @brijeshb42, @chuganzy, @Copilot, @Janpot, @LukasTy, @martenbjork, @michaldudak, @mj12albert, @mnajdova, @oliviertassinari, @seongminn, @sukvvon, @vladmoroz

## v1.0.0-beta.3

_Sep 3, 2025_

### General changes

- **Breaking change:** Base UI event details.
  Custom event callbacks provide BaseUIEventDetails object as their second parameter.
  This object contains the source event, reason and methods to customize the behavior (where applicable).
  For example, `onOpenChange(open, event, reason)` becomes `onOpenChange(open, eventDetails)`, where `eventDetails` contains `event` and `reason` properties.

  ```diff
  -onOpenChange: (open, event, reason) => {
  +onOpenChange: (open, eventDetails) => {
  - if (reason === 'escape-key') {
  +  if (eventDetails.reason === 'escape-key') {
       // ...
     }
   }
  ```

  (#2382) by @atomiks

### Alert Dialog

- **Breaking change:** Support `initialFocus` and `finalFocus` functions.
  The `initialFocus` and `finalFocus` props can be functions that return DOM elements to focus.
  This is a new feature for `finalFocus` and a breaking change for `initialFocus` as the element must be returned directly (not as a ref).
  (#2536) by @atomiks

### Autocomplete

- New Autocomplete component (#2105) by @atomiks

### Checkbox

- Fix missing validity attributes when wrapped in `Field` (#2572) by @Copilot

### Combobox

- New Combobox component (#2105) by @atomiks

### Context Menu

- Fix default offsets when `align="center"` or `side` differs (#2601) by @atomiks

### Dialog

- **Breaking change:** Support `initialFocus` and `finalFocus` functions.
  The `initialFocus` and `finalFocus` props can be functions that return DOM elements to focus.
  This is a new feature for `finalFocus` and a breaking change for `initialFocus` as the element must be returned directly (not as a ref).
  (#2536) by @atomiks
- Restore focus to popup when focused element is removed (#2479) by @atomiks

### Field

- Prevent defaultValue reset on focus for uncontrolled inputs (#2543) by @ingokpp
- Allow `onValueChange` to fire when `defaultValue`/`value` are not set (#2600) by @atomiks

### Input

- Allow `onValueChange` to fire when `defaultValue`/`value` are not set (#2600) by @atomiks

### Menu

- **Breaking change:** Fix `closeParentOnEsc` default value.
  The default value of `closeParentOnEsc` in Menu.SubmenuRoot is now false.
  When the <kbd>Esc</kbd> key is pressed in a Submenu, the Submenu closes, and the focus correctly moves to the SubmenuTrigger.
  (#2493) by @seongminn
- **Breaking change:** Support `initialFocus` and `finalFocus` functions.
  The `initialFocus` and `finalFocus` props can be functions that return DOM elements to focus.
  This is a new feature for `finalFocus` and a breaking change for `initialFocus` as the element must be returned directly (not as a ref).
  (#2536) by @atomiks
- Fix menu not opening when inside context menu trigger (#2506) by @baptisteArno
- Fix `transform-origin` variable calculation when Positioner `sideOffset` is a function (#2511) by @atomiks
- Fix submenu events (#2483) by @atomiks
- Fix `limitShift` offset based on arrow size (#2571) by @atomiks

### Navigation Menu

- **Breaking change:** Semantic element structure and `active` page prop.
  `NavigationMenu.List` renders `<ul>` and `NavigationMenu.Item` renders `<li>` by default.
  (#2526) by @atomiks
- Unshare `AbortController` instance (#2441) by @tomokinat
- Close on link click by default (#2535) by @atomiks

### Number Field

- Fix duplicate `onValueChange` calls (#2591) by @atomiks

### Popover

- **Breaking change:** Support `initialFocus` and `finalFocus` functions.
  The `initialFocus` and `finalFocus` props can be functions that return DOM elements to focus.
  This is a new feature for `finalFocus` and a breaking change for `initialFocus` as the element must be returned directly (not as a ref).
  (#2536) by @atomiks
- Fix outside click after right clicking in popup (#2508) by @baptisteArno
- Fix unexpected close when nested inside two popovers (#2481) by @atomiks
- Fix `transform-origin` variable calculation when Positioner `sideOffset` is a function (#2511) by @atomiks
- Restore focus to popup when focused element is removed (#2479) by @atomiks
- Fix `limitShift` offset based on arrow size (#2571) by @atomiks

### Preview Card

- Fix `transform-origin` variable calculation when Positioner `sideOffset` is a function (#2511) by @atomiks
- Fix `limitShift` offset based on arrow size (#2571) by @atomiks

### Radio Group

- Return null in form data when no option selected (#2473) by @ingokpp

### Scroll Area

- Prevent pointer events from sibling portals triggering hover (#2542) by @KenanYusuf

### Select

- Fix stale `items` prop (#2397) by @atomiks
- Fix unexpected close when nested inside two popovers (#2481) by @atomiks
- Fix `onValueChange` type inference (#2372) by @atomiks
- Fix `transform-origin` variable calculation when Positioner `sideOffset` is a function (#2511) by @atomiks
- Reset state when selected item is removed (#2577) by @atomiks
- Fix `data-highlighted` and DOM focus item desync (#2569) by @atomiks
- Fix item click with `defaultOpen` prop (#2570) by @atomiks
- Fix scroll arrows not propagating scroll fully to start/end of list (#2523) by @atomiks
- Fix `limitShift` offset based on arrow size (#2571) by @atomiks

### Slider

- **Breaking change:** Instead of the thumb div, the `input type="range"` element receives focus. Focus styles that were targeting the thumb, should be updated.
  For example `.Thumb:focus-visible` should be replaced with `.Thumb:has(:focus-visible)`.
  The `tabIndex` prop is moved from Root to Thumb where it gets forwarded to the input.
  The thumb's `render` prop no longer contains the third `inputProps` argument; the input element is instead merged with children.
  (#2578) by @mj12albert
- Reduce bundle size (#2551) by @oliviertassinari
- Fix thumb `:focus-visible` with mixed keyboard and pointer modality (#2584) by @mj12albert
- Add `index` prop to `Slider.Thumb` (#2593) by @mj12albert

### Tabs

- Fix tab size rounding (#2488) by @atomiks
- Fix highlight sync when focus is inside list (#2487) by @atomiks

### Tooltip

- Fix `transform-origin` variable calculation when Positioner `sideOffset` is a function (#2511) by @atomiks
- Fix `limitShift` offset based on arrow size (#2571) by @atomiks

### useRender

- Add support for data-\* attributes (#2524) by @Raghuboi
- Add `defaultTagName` parameter (#2527) by @atomiks

All contributors of this release in alphabetical order: @atomiks, @baptisteArno, @brijeshb42, @Copilot, @ingokpp, @Janpot, @KenanYusuf, @LukasTy, @michaldudak, @mirka, @mj12albert, @mnajdova, @oliviertassinari, @Powerplex, @Raghuboi, @seongminn, @tomokinat

## v1.0.0-beta.2

_Jul 30, 2025_

### General changes

- Fix navigator checks and ensure safe platform retrieval (#2273) by @mo36924
- Prevent `Space` key default on keydown (#2295) by @atomiks
- Check for `performance` existence on server (#2316) by @atomiks

### Accordion

- Destructure `render` prop (#2280) by @atomiks
- Fix keyboard interactions with elements in the panel (#2321) by @mj12albert
- Fix open transitions in Safari/Firefox (#2327) by @atomiks

### Alert Dialog

- Support `ShadowRoot` containers (#2236) by @atomiks
- Add `forceRender` prop to `Backdrop` part (#2037) by @atomiks
- Improve outside press behavior with touch input (#2334) by @atomiks

### Checkbox

- Fix focusing form controls with `inputRef` (#2252) by @mj12albert

### Collapsible

- Destructure render prop (#2323) by @atomiks
- Fix open transitions in Safari/Firefox (#2327) by @atomiks

### Dialog

- Support `ShadowRoot` containers (#2236) by @atomiks
- Add `forceRender` prop to `Backdrop` part (#2037) by @atomiks
- Improve outside press behavior with touch input (#2334) by @atomiks
- Use `click` event for outside press dismissal (#2275) by @atomiks

### Field

- Deregister fields from `Form` when unmounting (#2231) by @mj12albert

### Form

- Deregister fields from `Form` when unmounting (#2231) by @mj12albert

### Menu

- Support `ShadowRoot` containers (#2236) by @atomiks
- Avoid double `useRenderElement` passes (#2256) by @atomiks
- Improve outside press behavior with touch input (#2334) by @atomiks
- Close submenus when focus is lost by shift-tabbing (#2290) by @michaldudak

### Menubar

- Fix triggers role (#2317) by @atomiks

### Meter

- Fix ARIA attributes and update docs (#2267) by @mj12albert

### Navigation Menu

- **Breaking change:** Support inlined nesting.
  Ensure the popup's `width` is set to `var(--popup-width)` unconditionally (without the media query) on the `.Popup` class.
  (#2269) by @atomiks
- Avoid double `useRenderElement` passes (#2256) by @atomiks
- Add `useButton` integration to `Trigger` (#2296) by @atomiks
- Fix popup size transitions on iOS (#2387) by @atomiks

### Number Field

- Remove `invalid` prop (#2315) by @atomiks
- Fix button disabled state only including root disabled state (#2268) by @mj12albert

### Popover

- Support `ShadowRoot` containers (#2236) by @atomiks
- Remove ancestor nodes from inside elements for outside press detection (#2339) by @atomiks
- Improve outside press behavior with touch input (#2334) by @atomiks
- Use `click` event for outside press dismissal (#2275) by @atomiks

### Preview Card

- Support `ShadowRoot` containers (#2236) by @atomiks

### Progress

- Fix ARIA attributes and update docs (#2267) by @mj12albert

### Radio Group

- Add aria-required attribute (#2227) by @cgatian
- Extend state with `FieldRoot.State` (#2251) by @mj12albert
- Fix focusing form controls with `inputRef` (#2252) by @mj12albert
- Avoid double `useRenderElement` passes (#2256) by @atomiks

### Scroll Area

- Disable `user-select` on scrollbar and non-main button interactions (#2338) by @atomiks

### Select

- Support `ShadowRoot` containers (#2236) by @atomiks
- Add `value` and `readOnly` to `Select.Trigger` state (#2237) by @atomiks
- Add `multiple` prop (#2173) by @atomiks
- Allow typeahead while open for `multiple` mode (#2274) by @atomiks
- Ensure positionerElement is available in document mouseup (#2276) by @atomiks
- Fix `alignItemWithTrigger` fallback scroll jump (#2241) by @atomiks
- Support conditional `multiple` prop in types (#2369) by @atomiks
- Fix multiple ARIA behavior on touch (#2333) by @atomiks
- Improve outside press behavior with touch input (#2334) by @atomiks

### Slider

- Fix focusing form controls with `inputRef` (#2252) by @mj12albert

### Toast

- Fix `promise` method timeout option handling (#2294) by @atomiks
- Make `Toast.Viewport` an announce container (#2246) by @atomiks

### Toggle

- Avoid double `useRenderElement` passes (#2256) by @atomiks

### Toggle Group

- Avoid double `useRenderElement` passes (#2256) by @atomiks

### Toolbar

- Avoid double `useRenderElement` passes (#2256) by @atomiks

### Tooltip

- Support `ShadowRoot` containers (#2236) by @atomiks
- Memoize leftover object in tooltip (#2250) by @sai6855
- Fix error when combining `defaultOpen` and `disabled` (#2374) by @atomiks

All contributors of this release in alphabetical order: @aelfannir, @atomiks, @brijeshb42, @cgatian, @Janpot, @michaldudak, @mj12albert, @mo36924, @romgrk, @sai6855

## v1.0.0-beta.1

_Jul 1, 2025_

### General changes

- Make error messages consistent (#2049) by @michaldudak
- Do not overwrite event handler when `undefined` is passed explicitly (#2151) by @michaldudak

### Accordion

- Allow content to resize naturally (#2043) by @atomiks
- Fix transition status mapping (#2169) by @atomiks
- Fix `aria-controls` reference (#2170) by @atomiks
- Fix test warning about mixed animation types (#2180) by @atomiks

### Checkbox

- **Breaking change:** Support implicit `Field.Label`.
  If `Field.Label` encloses Switch/Checkbox/Radio, the `htmlFor`/`id` attributes are no longer explicitly set to associate them.
  (#2036) by @mj12albert
- Refactor to `useRenderElement` (#2053) by @mj12albert
- Always set `id` on the `<input>` element (#2115) by @mj12albert

### Checkbox Group

- Fix `onCheckedChange` not running when parent checkbox is present (#2155) by @mj12albert

### Collapsible

- Allow content to resize naturally (#2043) by @atomiks
- Fix `aria-controls` reference (#2170) by @atomiks
- Fix test warning about mixed animation types (#2180) by @atomiks

### Context Menu

- **Breaking change:** Add `SubmenuRoot` part.
  Nested menus should be defined with `Menu.SubmenuRoot` instead of `Menu.Root` to to avoid ambiguity.
  (#2042) by @atomiks
- Fix CheckboxItemIndicator export (#2009) by @aarongarciah

### Dialog

- Fix popup prop merging (#2119) by @atomiks

### Field

- **Breaking change:** Support implicit `Field.Label`.
  If `Field.Label` encloses Switch/Checkbox/Radio, the `htmlFor`/`id` attributes are no longer explicitly set to associate them.
  (#2036) by @mj12albert
- Enable custom validation based on other form values (#1941) by @mj12albert
- Fix `onValueChange` `value` type (#2112) by @atomiks
- Fix `Field.Label` focusing trigger (#2118) by @atomiks
- Fix slider field label (#2154) by @mj12albert

### Fieldset

- Refactor to `useRenderElement` (#2053) by @mj12albert

### Form

- Enable custom validation based on other form values (#1941) by @mj12albert

### Input

- Fix `onValueChange` `value` type (#2112) by @atomiks

### Menu

- **Breaking change:** Add `SubmenuRoot` part.
  Nested menus should be defined with `Menu.SubmenuRoot` instead of `Menu.Root` to to avoid ambiguity.
  (#2042) by @atomiks
- Unset `role` from Trigger (#2047) by @atomiks
- Emit `close` event on `cancel-open` (#2067) by @atomiks
- Fix close toggle when rendering non-native button (#2071) by @atomiks
- Add `highlighted` to item `State` (#2079) by @atomiks
- Remove highlighted effect (#2162) by @atomiks
- Cut out internal backdrop to allow interacting with triggers (#2141) by @michaldudak
- Fix active index sync on hover (#2163) by @atomiks
- Fix focus returning to root when submenus have exit transitions (#2163) by @atomiks

### Menubar

- Fix `closeOnClick: false` not working in nested menus (#2094) by @michaldudak

### Navigation Menu

- Handle layout resize while open (#2070) by @atomiks
- Fix positioner height when opening menu using the keyboard arrows (#2060) by @juliomerisio

### Number Field

- Ensure `onValueChange` is called with already-formatted parsed value (#1905) by @atomiks
- Fix revalidation on change (#2174) by @atomiks

### Popover

- Fix close toggle when rendering non-native button (#2071) by @atomiks
- Cut out internal backdrop to allow interacting with triggers (#2141) by @michaldudak

### Radio Group

- **Breaking change:** Support implicit `Field.Label`.
  If `Field.Label` encloses Radio, the `htmlFor`/`id` attributes are no longer explicitly set to associate them.
  (#2036) by @mj12albert
- Refactor to `useRenderElement` (#2053) by @mj12albert

### Scroll Area

- Ignore `data-scrolling` during programmatic scroll (#1908) by @atomiks

### Select

- **Breaking change:** Print raw value in `Select.Value`.
  `<Select.Value>` now prints the raw value by default unless an `items` prop is specified on `Select.Root`.
  See https://base-ui.com/react/components/select#formatting-the-value for more information.
  (#2087) by @atomiks
- Performance: avoid re-renders (#1961) by @romgrk
- Fix close toggle when rendering non-native button (#2071) by @atomiks
- Fix `Field.Label` focusing trigger (#2118) by @atomiks
- Fix programmatic value changes and autofill handling (#2084) by @atomiks
- Add `highlighted` to item `State` (#2079) by @atomiks
- Cut out internal backdrop to allow interacting with triggers (#2141) by @michaldudak
- Pass `value` as state (#2153) by @atomiks
- Extend `FieldRoot.State` type (#2192) by @atomiks

### Slider

- Use pointer capture when dragging (#2059) by @mj12albert
- Fix slider field label (#2154) by @mj12albert

### Switch

- **Breaking change:** Support implicit `Field.Label`.
  If `Field.Label` encloses Switch, the `htmlFor`/`id` attributes are no longer explicitly set to associate them.
  (#2036) by @mj12albert

### Tabs

- Fix indicator positioning when TabsList overflows (#2093) by @mj12albert
- Fix focus going out of sync when selected value is changed externally (#2107) by @atomiks
- Remove highlighted state (#2164) by @atomiks

### Toolbar

- Set `disabled` attr on toolbar button when `focusableWhenDisabled={false}` (#2176) by @mj12albert

### useRender

- Make useRender RSC-friendly (#2134) by @michaldudak

All contributors of this release in alphabetical order: @aarongarciah, @atomiks, @bernardobelchior, @brijeshb42, @Janpot, @juliomerisio, @lesha1201, @michaldudak, @mj12albert, @oliviertassinari, @romgrk

## v1.0.0-beta.0

_May 29, 2025_

### General changes

- Remove proptypes (#1760) by @michaldudak
- Unify component export patterns (#1478) by @michaldudak
- Default `tabIndex` to `0` on `<button>` parts (#1939) by @atomiks

### Accordion

- Stop event propagation to allow composite components to be used within popups (#1871) by @atomiks

### Alert Dialog

- **Breaking change:** Refine `OpenChangeReason`. `hover` is now `trigger-hover`; `click` is now `trigger-press`; `focus` is now `trigger-focus`.
  (#1782) by @atomiks
- Use basic scroll lock on iOS
  (#1890) by @atomiks

### Checkbox

- Set `aria-required`, use `useButton` (#1777) by @mj12albert

### Checkbox Group

- **Breaking change:** Enable submitting checkbox group value as one field.
  For parent checkboxes, use `value` instead of `name` on each `Checkbox.Root` part to link as the values.
  (#1948) by @mj12albert
- Fix `validate` fn incorrectly running twice (#1959) by @mj12albert

### Context Menu

- New `ContextMenu` component (#1665) by @atomiks

### Dialog

- **Breaking change:** Refine `OpenChangeReason`. `hover` is now `trigger-hover`; `click` is now `trigger-press`; `focus` is now `trigger-focus`.
  (#1782) by @atomiks
- Use basic scroll lock on iOS
  (#1890) by @atomiks

### Field

- **Breaking change:** Consolidate `Field.Error` `forceShow` into `match` prop.
  Use `match={true}` (or implicit boolean) instead of `forceShow`.
  (#1919) by @atomiks
- Improve `Label` logic that prevents text selection on double click (#1784) by @atomiks
- Fix validation inconsistency (#1779) by @atomiks
- Fix integration of Base UI components (#1755) by @atomiks
- Set `valueMissing` to false if only error and not dirtied (#1810) by @atomiks
- `validate` with latest value on blur (#1850) by @atomiks
- Revalidate only `required` on change (#1840) by @atomiks
- Run validate function after native validations (#1926) by @mj12albert
- Fix `validate` fn incorrectly running twice (#1959) by @mj12albert
- Integrate range sliders with Form and Field (#1929) by @mj12albert

### Form

- Fix integration of Base UI components (#1755) by @atomiks
- Select inputs on focus (#1858) by @atomiks
- Exclude number formatting from form value (#1957) by @mj12albert
- Integrate range sliders with Form and Field (#1929) by @mj12albert

### Input

- Fix `Input.Props` type (#1915) by @mj12albert
- Extend `Field.Control.State` (#1954) by @atomiks

### Menu

- **Breaking change:** Refine `OpenChangeReason`. `hover` is now `trigger-hover`; `click` is now `trigger-press`; `focus` is now `trigger-focus`.
  (#1782) by @atomiks
- Fix function dependency handling (#1787) by @atomiks
- Add missing `'use client'` to `RadioGroup` part (#1851) by @atomiks
- Ensure `null` items are removed from composite lists (#1847) by @atomiks
- Avoid `:focus-visible` style appearing (#1846) by @atomiks
- Better handle dynamic and non-string items (#1861) by @atomiks
- Add `collisionAvoidance` prop (#1849) by @atomiks
- Add `finalFocus` and `closeDelay` props (#1918) by @atomiks
- Use basic scroll lock on iOS
  (#1890) by @atomiks

### Menubar

- New `Menubar` component (#1684) by @michaldudak

### Navigation Menu

- New `NavigationMenu` component (#1741) by @atomiks

### Number Field

- `validate` with latest value on blur (#1850) by @atomiks
- Move scrubbing logic to `ScrubArea` component (#1859) by @atomiks
- Remove floating point errors when `snapOnStep` is disabled (#1857) by @atomiks
- Stop event propagation to allow composite components to be used within popups (#1871) by @atomiks
- Exclude number formatting from form value (#1957) by @mj12albert

### Popover

- **Breaking change:** Refine `OpenChangeReason`. `hover` is now `trigger-hover`; `click` is now `trigger-press`; `focus` is now `trigger-focus`.
  (#1782) by @atomiks
- Fix function dependency handling (#1787) by @atomiks
- Avoid prop getters when merging props (#1852) by @atomiks
- Add `collisionAvoidance` prop (#1849) by @atomiks
- Fix nested `openOnHover` (#1938) by @atomiks
- Use basic scroll lock on iOS
  (#1890) by @atomiks

### Preview Card

- **Breaking change:** Refine `OpenChangeReason`. `hover` is now `trigger-hover`; `click` is now `trigger-press`; `focus` is now `trigger-focus`.
  (#1782) by @atomiks
- Fix function dependency handling (#1787) by @atomiks
- Add `collisionAvoidance` prop (#1849) by @atomiks

### Radio Group

- Fix composite focus of initially selected radio item (#1753) by @atomiks
- Add `inputRef` props (#1683) by @atomiks
- Stop event propagation to allow composite components to be used within popups (#1871) by @atomiks

### Select

- **Breaking change:** Move item anchoring prop to `Positioner`.
  Use `<Select.Positioner alignItemWithTrigger={false}>` instead of `<Select.Root alignItemToTrigger={false}>` (note the `With` instead of `To`).
  (#1713) by @atomiks
- **Breaking change:** Defer mounting until typeahead is needed.
  The `placeholder` prop is now required. Previously, only SSR needed it to prevent a hydration flash, but client-side rendering now also requires it.
  (#1906) by @atomiks
- **Breaking change:** Refine `OpenChangeReason`. `hover` is now `trigger-hover`; `click` is now `trigger-press`; `focus` is now `trigger-focus`.
  (#1782) by @atomiks
- Fix function dependency handling (#1787) by @atomiks
- Add `inputRef` props (#1683) by @atomiks
- Refactor to `useRenderElement` (#1797) by @atomiks
- Ensure `null` items are removed from composite lists (#1847) by @atomiks
- Fix `id` prop forwarding to hidden input (#1862) by @atomiks
- Avoid `:focus-visible` style appearing (#1846) by @atomiks
- Fix `transitionStatus` mapping on `ItemIndicator` (#1925) by @atomiks
- Better handle dynamic and non-string items (#1861) by @atomiks
- Use `Select.ItemText` ref to grab default text content (#1943) by @atomiks
- Add `collisionAvoidance` prop (#1849) by @atomiks
- Use basic scroll lock on iOS
  (#1890) by @atomiks

### Slider

- **Breaking change:** Drop `inputId` prop from Thumb.
  (#1914) by @mj12albert
- Position thumb based on value instead of pointer location when dragging (#1750) by @DarthSim
- Use `useRenderElement` (#1772) by @mj12albert
- Add `inputRef` props (#1683) by @atomiks
- Add `locale` prop (#1796) by @mj12albert
- Stop event propagation to allow composite components to be used within popups (#1871) by @atomiks
- set `data-dragging` on touchstart and pointerdown (#1874) by @mj12albert
- Integrate range sliders with Form and Field (#1929) by @mj12albert

### Toast

- **Breaking change:** Add `Portal` part.
  Place `<Toast.Viewport>` inside of `<Toast.Portal>`.
  (#1962) by @atomiks
- **Breaking change:** Avoid removing limited toasts from the DOM.
  The `[data-limited]` styles in the demos were updated to handle limited toasts remaining in the DOM. They should now be a standalone style as `&[data-limited] { opacity: 0 }`.
  (#1953) by @atomiks
- Fix swipe jump on iOS (#1785) by @atomiks

### Toggle

- Stop event propagation to allow composite components to be used within popups (#1871) by @atomiks

### Toolbar

- Stop event propagation to allow composite components to be used within popups (#1871) by @atomiks

### Tooltip

- **Breaking change:** Refine `OpenChangeReason`. `hover` is now `trigger-hover`; `click` is now `trigger-press`; `focus` is now `trigger-focus`.
  (#1782) by @atomiks
- Fix function dependency handling (#1787) by @atomiks
- Avoid prop getters when merging props (#1852) by @atomiks
- Remove `trackCursorAxis` type from `Positioner` (#1895) by @atomiks
- Apply `pointer-events: none` to `Positioner` when not hoverable (#1917) by @atomiks
- Add `collisionAvoidance` prop (#1849) by @atomiks

### useRender

- **Breaking change:** Performance/refactor: `useRender`. An object with a `renderElement` property is no longer returned; instead, the hook returns the element directly (`const element = useRender(...)`). The `refs` option was also renamed to `ref`.
  (#1934) by @romgrk
- Skip most of useRenderElement logic when unnecessary (#1967) by @michaldudak

All contributors of this release in alphabetical order: @aarongarciah, @atomiks, @brijeshb42, @DarthSim, @flaviendelangle, @Janpot, @JCQuintas, @michaldudak, @mj12albert, @oliviertassinari, @romgrk, @Yonava, @ZeeshanTamboli

## v1.0.0-alpha.8

_Apr 17, 2025_

### Accordion

- Recalculate panel dimensions on layout resize (#1704) @atomiks
- Rework animations and transitions (#1601) @mj12albert

### AlertDialog

- **Breaking change:** Rename `data-has-nested-dialogs` to `data-nested-dialog-open` (#1686) @mj12albert
- Fix `onOpenChange` types for `event`/`reason` passing (#1721) @atomiks
- Use consistent `inert` attr and map `[data-popup-open]` back to `open` (#1650) @atomiks
- Fix text selection & right-clicks (#1702) @mj12albert

### CheckboxGroup

- Parent checkbox/nested demos (#1610) @atomiks

### Collapsible

- Fix ForwardedRef type of CollapsiblePanel (#1595) @megos
- Recalculate panel dimensions on layout resize (#1704) @atomiks
- Rework animations and transitions (#1601) @mj12albert

### Dialog

- **Breaking change:** Rename `data-has-nested-dialogs` to `data-nested-dialog-open` (#1686) @mj12albert
- **Breaking change:** Add new `trap-focus` value to `modal` prop.
  Dialogs with `modal=false` no longer trap focus.
  (#1571) @atomiks
- Fix `onOpenChange` types for `event`/`reason` passing (#1721) @atomiks
- Use consistent `inert` attr and map `[data-popup-open]` back to `open` (#1650) @atomiks
- Fix text selection & right-clicks (#1702) @mj12albert
- Allow document to slide input into view on iOS when keyboard opens (#1735) @atomiks

### Field

- Fix forwarding of `name` and `disabled` props (#1616) @atomiks

### Menu

- Add missing item data attributes docs (#1691) @atomiks
- Fix `inert` prop compatibility in React <19 (#1618) @sebinsua
- Fix stuck highlight on submenu trigger when submenu opens with keyboard (#1698) @atomiks
- Fix `onOpenChange` types for `event`/`reason` passing (#1721) @atomiks
- Use consistent `inert` attr and map `[data-popup-open]` back to `open` (#1650) @atomiks
- Fix text selection & right-clicks (#1702) @mj12albert

### Meter

- New Meter component (#1435) @mj12albert

### NumberField

- Correct percentage parse handling (#1676) @atomiks
- New `snapOnStep` prop (#1560) @atomiks

### Popover

- **Breaking change:** Add new `trap-focus` value to `modal` prop (#1571) @atomiks
- Fix `inert` prop compatibility in React <19 (#1618) @sebinsua
- Fix `onOpenChange` types for `event`/`reason` passing (#1721) @atomiks
- Use consistent `inert` attr and map `[data-popup-open]` back to `open` (#1650) @atomiks
- Fix text selection & right-clicks (#1702) @mj12albert

### Progress

- **Breaking change:** Add `Progress.Label` and `locale` prop.
  The `getAriaLabel` prop was removed as `Progress.Label` should be used to provide an accessible name.
  (#1666) @mj12albert

### Radio

- Fix value forwarding and null handling (#1697) @atomiks

### ScrollArea

- **Breaking change:** Add `Content` part.
  It is now required to include the `ScrollArea.Content` within `ScrollArea.Viewport` part when the content is horizontally scrollable.
  (#1607) @atomiks
- Handle visibility change and nesting (#1598) @atomiks
- Correct thumb sizing with scrollbar margins (#1606) @atomiks

### Select

- **Breaking change:** Improve item highlight performance.
  The highlighted state is now removed. It's not possible to customize the `data-highlighted` attribute anymore.
  (#1570) @atomiks
- Avoid double commit on value change (#1597) @atomiks
- Reset `selectedIndex` when set to `null` (#1596) @atomiks
- Add missing item data attributes docs (#1691) @atomiks
- Fix `onOpenChange` types for `event`/`reason` passing (#1721) @atomiks
- Use consistent `inert` attr and map `[data-popup-open]` back to `open` (#1650) @atomiks
- Fix text selection & right-clicks (#1702) @mj12albert

### Slider

- Correct thumb positioning when control has padding (#1661) @mj12albert
- Prevent range slider thumbs from being dragged past each other (#1612) @mj12albert
- Fix incorrect CSS position on vertical slider indicator (#1599) @ZeeshanTamboli
- Fix overlapping slider thumbs stuck at min or max (#1732) @mj12albert

### Toast

- New Toast component (#1467) @atomiks

### Tooltip

- Avoid re-rendering unrelated consumers (#1677) @atomiks
- Add `disabled` prop (#1682) @atomiks
- Fix `onOpenChange` types for `event`/`reason` passing (#1721) @atomiks
- Use consistent `inert` attr and map `[data-popup-open]` back to `open` (#1650) @atomiks
- Fix text selection & right-clicks (#1702) @mj12albert

All contributors of this release in alphabetical order: @atomiks, @megos, @michaldudak, @mj12albert, @oliviertassinari, @sebinsua, @ZeeshanTamboli

## v1.0.0-alpha.7

_Mar 20, 2025_

### Accordion

- Fix `aria-labelledby` on accordion panel (#1544) @mj12albert

### AlertDialog

- Fix selection on outside press on Firefox with modal prop (#1573) @atomiks
- Fix non-interactive button disabled state (#1473) @mj12albert
- `actionsRef` prop (#1236) @atomiks

### Avatar

- Support cross origin in useImageLoadingStatus (#1433) @ISnackable
- Add missing Avatar export (#1428) @Gomah

### Collapsible

- Update props destructuring to fix Trigger disabled state (#1469) @huijiewei

### Dialog

- Fix selection on outside press on Firefox with modal prop (#1573) @atomiks
- Fix non-interactive button disabled state (#1473) @mj12albert
- `actionsRef` prop (#1236) @atomiks

### Field

- Fix `FieldControl` [data-filled] not reacting to external value changes (#1565) @atomiks

### Menu

- Ensure submenu triggers respond to clicks when `openOnHover=false` (#1583) @atomiks
- Ensure `stickIfOpen` is reset to `true` correctly (#1548) @atomiks
- Fix selection on outside press on Firefox with modal prop (#1573) @atomiks
- Reset `hoverEnabled` state on close (#1461) @atomiks
- Fix prop merging issues (#1445) @michaldudak
- Set `pointer-events: none` style on backdrops when hoverable (#1351) @atomiks
- `actionsRef` prop (#1236) @atomiks

### NumberField

- Fix ScrubArea on Safari (#1584) @atomiks
- Fix `large/smallStep` getting stuck (#1578) @atomiks
- Fix parse of numbers with spaces as thousands separators (#1577) @michaldudak
- Prevent virtual cursor overlapping native one (#1491) @atomiks
- Fix disabled state on increment/decrement buttons (#1462) @mj12albert
- Correct virtual cursor rendering (#1484) @atomiks
- Add `locale` prop (#1488) @atomiks
- Improve virtual cursor perf (#1485) @atomiks

### Popover

- Ensure `stickIfOpen` is reset to `true` correctly (#1548) @atomiks
- Fix selection on outside press on Firefox with modal prop (#1573) @atomiks
- Set `pointer-events: none` style on backdrops when hoverable (#1351) @atomiks
- Fix non-interactive button disabled state (#1473) @mj12albert
- `modal` prop (#1459) @atomiks
- `actionsRef` prop (#1236) @atomiks

### PreviewCard

- Set `pointer-events: none` style on backdrops when hoverable (#1351) @atomiks
- `actionsRef` prop (#1236) @atomiks

### RadioGroup

- Fix `Form`/`Field` validation integration (#1448) @atomiks
- Handle modifier keys (#1529) @mj12albert

### Select

- Fix selection on outside press on Firefox with modal prop (#1573) @atomiks
- Improve `ScrollArrow` behavior (#1564) @atomiks
- Ensure switching controlled value to `null` updates `Select.Value` label (#1561) @atomiks
- Pass `value` as second argument to function children `Select.Value` (#1562) @atomiks
- Fix focus jump while hovering while navigating with keyboard (#1563) @atomiks
- Fix disabled state changing (#1526) @mj12albert
- `actionsRef` prop (#1236) @atomiks

### Slider

- Fix thumb positioning when controlled value violates min/max/step (#1541) @mj12albert
- Warn when `min` is not less than `max` (#1475) @mj12albert
- Narrow the type of `value` in callbacks (#1241) @seloner

### Tabs

- Fix keyboard navigation involving disabled Tabs (#1449) @mj12albert
- Handle modifier keys (#1529) @mj12albert

### Toolbar

- Add Toolbar components (#1349) @mj12albert

### Tooltip

- `actionsRef` prop (#1236) @atomiks
- Fix `Provider` `delay=0` not being respected (#1416) @atomiks

### useRender

- Add public hook (#1418) @mnajdova
- Refine docs and APIs (#1551) @atomiks

### Docs

- Fix CSS issues (#1585) @atomiks
- Clean up old experiments (#1572) @mj12albert
- Fix SEO site name description (#1520) @oliviertassinari
- Fix `actionsRef` propTypes (#1460) @atomiks
- Tooltip guidelines (#1356) @atomiks
- Update the release instructions (#1444) @michaldudak
- Mention Progress.Value in API reference (#1429) @aarongarciah
- Update release instructions (#1417) @michaldudak

### Internal

- [code-infra] Polish VS Code DX (#1238) @oliviertassinari
- [code-infra] Fix build:types not copying on some setups (#1482) @Janpot
- [Composite] Derive sorted map state (#1489) @atomiks
- Update release docs and scripts (#1245) @oliviertassinari
- Export namespaces consistently (#1472) @michaldudak
- Make `mergeReactProps` work with non-native event handlers (#1440) @michaldudak
- Remove babel-plugin-istanbul (#1409) @michaldudak
- Fix stylelint violations (#1422) @michaldudak
- Misc cleaning (#1579) @atomiks
- [mergeProps] Convert as a top level import and export publicly (#1535) @mnajdova
- [test] Fix wrong env skip (#1490) @atomiks
- [test] Fix PreviewCard test flake (#1487) @atomiks
- [test] Extract common popup tests (#1358) @michaldudak
- [test] Verify root exports (#1431) @michaldudak
- [test] Fix flaky browser tests (#1371) @atomiks
- [test] Update vitest to ^3 (#1453) @michaldudak
- [test] Skip flaky FieldRoot tests in real browsers (#1446) @michaldudak
- [useMergedRefs] Support ref cleanup functions (#1553) @atomiks
- [utils] Change order of args in `mergeReactProps` (#1533) @mnajdova

## v1.0.0-alpha.6

_Feb 6, 2025_

### AlertDialog

- `onOpenChangeComplete` prop (#1305) @atomiks
- Fix jump with `scroll-behavior` style (#1343) @atomiks

### Avatar

- Add Avatar component (#1210) @acomanescu

### Checkbox

- Avoid applying `hidden` attr when `keepMounted=true` for indicators (#1329) @onehanddev

### Dialog

- Remove `modal={open}` state (#1352) @atomiks
- Support multiple non-nested modal backdrops (#1327) @atomiks
- Fix missing `id`s on Title and Description (#1326) @mj12albert
- `onOpenChangeComplete` prop (#1305) @atomiks
- Fix jump with `scroll-behavior` style (#1343) @atomiks

### Field

- Respect `validationMode` (#1053) @atomiks
- Add `filled` and `focused` style hooks (#1341) @atomiks

### Form

- Fix focusing of invalid field controls on errors prop change (#1364) @atomiks

### Menu

- Avoid applying `hidden` attr when `keepMounted=true` for indicators (#1329) @onehanddev
- Support submenus with `openOnHover` prop (#1338) @atomiks
- Fix iPad detection when applying scroll lock (#1342) @mj12albert
- `onOpenChangeComplete` prop (#1305) @atomiks
- Fix jump with `scroll-behavior` style (#1343) @atomiks
- Add `OffsetFunction` for `sideOffset` and `alignOffset` (#1223) @atomiks
- Ensure `keepMounted` is a private param on `Positioner` (#1410) @atomiks

### Popover

- `onOpenChangeComplete` prop (#1305) @atomiks
- Add `OffsetFunction` for `sideOffset` and `alignOffset` (#1223) @atomiks
- Ensure `keepMounted` is a private param on `Positioner` (#1410) @atomiks

### PreviewCard

- `onOpenChangeComplete` prop (#1305) @atomiks
- Add `OffsetFunction` for `sideOffset` and `alignOffset` (#1223) @atomiks
- Ensure `keepMounted` is a private param on `Positioner` (#1410) @atomiks

### Progress

- Add `format` prop and `Value` component (#1355) @mj12albert

### Radio

- Avoid applying `hidden` attr when `keepMounted=true` for indicators (#1329) @onehanddev

### Select

- `onOpenChangeComplete` prop (#1305) @atomiks
- Fix jump with `scroll-behavior` style (#1343) @atomiks
- Add `OffsetFunction` for `sideOffset` and `alignOffset` (#1223) @atomiks
- Ensure `keepMounted` is a private param on `Positioner` (#1410) @atomiks

### Slider

- Fix thumb positioning (#1411) @mj12albert

### Tabs

- Fix being able to activate a disabled tab (#1359) @michaldudak
- Fix tabs activating incorrectly on non-primary button clicks (#1318) @mj12albert

### Tooltip

- `onOpenChangeComplete` prop (#1305) @atomiks
- Add `OffsetFunction` for `sideOffset` and `alignOffset` (#1223) @atomiks
- Ensure `keepMounted` is a private param on `Positioner` (#1410) @atomiks

## v1.0.0-alpha.5

_Jan 10, 2025_

### AlertDialog

- **Breaking change:** Require `Portal` part.
  The AlertDialog must explicitly include the Portal part wrapping the Popup.
  The `keepMounted` prop was removed from the Popup.
  It's only present on the Portal part.
  [#1222](https://github.com/mui/base-ui/pull/1222) @atomiks
- Don't call `onNestedDialogOpen` when unmounting a closed nested dialog [#1280](https://github.com/mui/base-ui/pull/1280) @mj12albert
- Fix the nesting of different dialogs [#1167](https://github.com/mui/base-ui/pull/1167) @mnajdova
- Remove `useFloating` call from the Popup [#1300](https://github.com/mui/base-ui/pull/1300) @michaldudak
- Set `pointer-events` on `InternalBackdrop` based on `open` state [#1221](https://github.com/mui/base-ui/pull/1221) @atomiks
- Use internal backdrop for pointer modality [#1161](https://github.com/mui/base-ui/pull/1161) @atomiks

### Dialog

- **Breaking change:** Require `Portal` part.
  The Dialog must explicitly include the Portal part wrapping the Popup.
  The `keepMounted` prop was removed from the Popup.
  It's only present on the Portal part.
  [#1222](https://github.com/mui/base-ui/pull/1222) @atomiks
- Don't call `onNestedDialogOpen` when unmounting a closed nested dialog [#1280](https://github.com/mui/base-ui/pull/1280) @mj12albert
- Fix the nesting of different dialogs [#1167](https://github.com/mui/base-ui/pull/1167) @mnajdova
- Remove `useFloating` call from the Popup [#1300](https://github.com/mui/base-ui/pull/1300) @michaldudak
- Set `pointer-events` on `InternalBackdrop` based on `open` state [#1221](https://github.com/mui/base-ui/pull/1221) @atomiks
- Use internal backdrop for pointer modality [#1161](https://github.com/mui/base-ui/pull/1161) @atomiks

### Menu

- **Breaking change:** Require `Portal` part.
  The Menu must explicitly include the Portal part wrapping the Positioner.
  The `keepMounted` prop was removed from the Positioner.
  It's only present on the Portal part.
  [#1222](https://github.com/mui/base-ui/pull/1222) @atomiks
- Apply `aria-hidden` to `Arrow` parts [#1196](https://github.com/mui/base-ui/pull/1196) @atomiks
- Fix `focusableWhenDisabled` components [#1313](https://github.com/mui/base-ui/pull/1313) @mj12albert
- Fix `openOnHover` issues [#1191](https://github.com/mui/base-ui/pull/1191) @atomiks
- Fix closing the menu when clicking on checkboxitem/radioitem [#1301](https://github.com/mui/base-ui/pull/1301) @michaldudak
- Fix Enter key preventDefault when rendering links [#1251](https://github.com/mui/base-ui/pull/1251) @mj12albert
- Handle pseudo-element bounds in mouseup detection [#1250](https://github.com/mui/base-ui/pull/1250) @atomiks
- Set `pointer-events` on `InternalBackdrop` based on `open` state [#1221](https://github.com/mui/base-ui/pull/1221) @atomiks
- Use internal backdrop for pointer modality [#1161](https://github.com/mui/base-ui/pull/1161) @atomiks

### NumberField

- Correctly handle quick touches [#1294](https://github.com/mui/base-ui/pull/1294) @atomiks

### Popover

- **Breaking change:** Require `Portal` part.
  The Popover must explicitly include the Portal part wrapping the Positioner.
  The `keepMounted` prop was removed from the Positioner.
  It's only present on the Portal part.
  [#1222](https://github.com/mui/base-ui/pull/1222) @atomiks
- Apply `aria-hidden` to `Arrow` parts [#1196](https://github.com/mui/base-ui/pull/1196) @atomiks
- Fix PopoverTrigger and TooltipTrigger prop types [#1209](https://github.com/mui/base-ui/pull/1209) @mnajdova

### PreviewCard

- **Breaking change:** Require `Portal` part.
  The PreviewCard must explicitly include the Portal part wrapping the Positioner.
  The `keepMounted` prop was removed from the Positioner.
  It's only present on the Portal part.
  [#1222](https://github.com/mui/base-ui/pull/1222) @atomiks
- Apply `aria-hidden` to `Arrow` parts [#1196](https://github.com/mui/base-ui/pull/1196) @atomiks
- Use `FloatingPortalLite` [#1278](https://github.com/mui/base-ui/pull/1278) @atomiks

### Progress

- Set zero width when value is zero [#1204](https://github.com/mui/base-ui/pull/1204) @mj12albert

### ScrollArea

- Differentiate `x`/`y` orientation `data-scrolling` [#1188](https://github.com/mui/base-ui/pull/1188) @atomiks
- Read `DirectionProvider` and use logical positioning CSS props [#1194](https://github.com/mui/base-ui/pull/1194) @mj12albert

### Select

- **Breaking change:** Require `Portal` part.
  The Select must explicitly include the Portal part wrapping the Positioner.
  The `keepMounted` prop was removed from the Positioner.
  It's only present on the Portal part.
  [#1222](https://github.com/mui/base-ui/pull/1222) @atomiks
- Allow `id` to be passed to trigger [#1174](https://github.com/mui/base-ui/pull/1174) @atomiks
- Fallback to standard positioning when pinch-zoomed in Safari [#1139](https://github.com/mui/base-ui/pull/1139) @atomiks
- Fix `focusableWhenDisabled` components [#1313](https://github.com/mui/base-ui/pull/1313) @mj12albert
- Fix highlight flash on Safari [#1233](https://github.com/mui/base-ui/pull/1233) @atomiks
- Handle pseudo-element bounds in mouseup detection [#1250](https://github.com/mui/base-ui/pull/1250) @atomiks
- Use internal backdrop for pointer modality [#1161](https://github.com/mui/base-ui/pull/1161) @atomiks

### Separator

- Support vertical orientation [#1304](https://github.com/mui/base-ui/pull/1304) @mj12albert

### Slider

- Ensure `onValueCommitted` is called with the same value as latest `onValueChange` [#1296](https://github.com/mui/base-ui/pull/1296) @mj12albert
- Replace internal map with `Composite` metadata [#1082](https://github.com/mui/base-ui/pull/1082) @mj12albert
- Set `position: relative` on range slider indicator [#1175](https://github.com/mui/base-ui/pull/1175) @mj12albert
- Use un-rounded values to position thumbs [#1219](https://github.com/mui/base-ui/pull/1219) @mj12albert

### Tabs

- Expose width/height state in tabs indicator [#1288](https://github.com/mui/base-ui/pull/1288) @aarongarciah

### Tooltip

- **Breaking change:** Require `Portal` part.
  The Tooltip must explicitly include the Portal part wrapping the Positioner.
  The `keepMounted` prop was removed from the Positioner.
  It's only present on the Portal part.
  [#1222](https://github.com/mui/base-ui/pull/1222) @atomiks
- Apply `aria-hidden` to `Arrow` parts [#1196](https://github.com/mui/base-ui/pull/1196) @atomiks
- Fix PopoverTrigger and TooltipTrigger prop types [#1209](https://github.com/mui/base-ui/pull/1209) @mnajdova
- Use `FloatingPortalLite` [#1278](https://github.com/mui/base-ui/pull/1278) @atomiks

## v1.0.0-alpha.4

_Dec 17, 2024_

Public alpha launch 🐣 Merry Xmas! 🎁
