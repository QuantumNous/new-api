# English-First I18n Baseline Design

## Goal

Make the default product experience English-first for English-speaking customers without changing the existing global language detection or language switch behavior.

This work must ensure that:

- default UI copy is English instead of Chinese
- default backend-generated messages and emails are English instead of Chinese
- default token group descriptions are English instead of Chinese
- default top-up display and preset amounts are designed around USD instead of CNY
- default provider and video-related labels no longer expose Chinese names
- public-facing docs and generated OpenAPI docs do not ship Chinese as the default text
- after the targeted fixes land, the repository gets a broader i18n sweep for additional English-customer issues

## Current Problem

The current codebase mixes three different classes of language behavior:

- proper localized strings through backend and frontend i18n
- hard-coded Chinese copy in frontend components and backend responses
- Chinese default data values embedded in settings, docs, labels, and generated API descriptions

This creates a poor first-run experience for English customers even when the user does not intentionally switch the site into Chinese.

The concrete issues already identified are:

- registration success and verification success messages are Chinese
- email verification and password reset email content is Chinese
- top-up defaults are CNY-oriented instead of USD-oriented
- post-top-up copy and logs expose Chinese text
- token creation shows Chinese default group descriptions
- default provider labels include Chinese names such as Doubao video
- public docs and OpenAPI output contain Chinese titles, summaries, descriptions, and tags

## Constraints

- Do not change the project's global language detection strategy.
- Do not remove Chinese localization support.
- Do not modify or remove protected project identifiers such as `new-api` and `QuantumNous`.
- Follow the existing backend/frontend i18n patterns where they already exist.
- Keep top-up math and payment compatibility intact while changing the default presentation baseline to USD.
- Do not introduce database-incompatible behavior.

## Approaches

### Approach A: Patch only the reported strings

Fix only the specific pages and flows listed by the user.

#### Pros

- fastest initial turnaround
- small code delta

#### Cons

- high risk of missing more English-customer issues
- leaves docs and generated API output inconsistent
- leaves default data values in Chinese

#### Verdict

Not recommended.

### Approach B: Establish an English-first default baseline

Treat English as the default wording baseline across code, settings defaults, labels, generated docs, and default payment presentation, while preserving explicit Chinese translations.

#### Pros

- matches the English-customer goal directly
- fixes both visible UI and backend-generated content
- creates a maintainable rule for future additions
- supports a follow-up sweep to catch residual issues

#### Cons

- broader change set than a local patch
- needs careful coordination across frontend, backend, settings, and docs

#### Verdict

Recommended.

### Approach C: Full i18n key refactor

Rewrite legacy translation keys and default text structures around English semantic keys everywhere.

#### Pros

- cleanest long-term architecture

#### Cons

- too large for the current fix
- higher regression risk
- unnecessary for the stated goal

#### Verdict

Not suitable for this phase.

## Recommended Design

Use Approach B.

The implementation should define a simple rule:

- all default text and default labels shipped to users must be English
- Chinese remains available only through explicit localized resources or user-authored content

This rule applies to:

- frontend hard-coded messages
- backend API messages and email templates
- default settings values and default group descriptions
- channel/provider labels and model/task labels
- generated OpenAPI docs and checked-in docs

## Scope

### In scope

- registration, login-adjacent, password-reset, and email-binding feedback copy
- email verification and password-reset email subject/body templates
- top-up page default currency display, preset display, and related copy
- top-up success wording that reaches users by default
- default token group descriptions and token creation UI defaults
- provider/channel labels with Chinese names in default UI constants
- public documentation and OpenAPI documents with Chinese default text
- a repository-wide sweep for additional default Chinese text that affects English customers

### Out of scope

- changing the site's language auto-detection algorithm
- removing Chinese translation files
- translating user-authored content stored in system settings or database records
- large-scale i18n key renaming across the entire frontend

## Workstreams

### 1. Frontend default copy

Replace hard-coded Chinese success, info, and error strings in user-facing components with English-first strings.

Priority files include:

- `web/src/components/auth/RegisterForm.jsx`
- `web/src/components/auth/PasswordResetForm.jsx`
- `web/src/components/settings/PersonalSetting.jsx`
- token, top-up, and task-log UI components that still ship direct Chinese copy

Rules:

- if a string already uses `t(...)`, keep the same pattern and ensure the fallback/source string is English
- if a string is currently hard-coded and not localized, convert it to an English-first form and localize if the surrounding component already uses `t(...)`

### 2. Backend generated copy

Convert backend-generated default messages and email templates to English.

Priority files include:

- `controller/misc.go`
- any other controllers returning hard-coded Chinese messages for registration, verification, or password reset flows
- models/services that emit default user-facing top-up messages

Rules:

- use backend i18n helpers where that path already exists
- if a message is a hard-coded default and there is no existing i18n helper in that path, English default text is acceptable in this phase
- email verification and password reset subjects and HTML bodies must be English by default

### 3. Default settings and labels

Change shipped defaults that are currently Chinese.

Priority files include:

- `setting/user_usable_group.go`
- `web/src/constants/channel.constants.js`
- helper render paths that expose provider names or video mode names

Expected changes:

- `default` group description becomes `Default`
- `vip` group description becomes `VIP`
- channel labels such as Doubao and other Chinese providers use English-first labels
- video-related action labels default to English

### 4. USD top-up baseline

Make USD the default design baseline for the top-up experience.

This does not remove support for CNY or custom currencies. It changes the default experience so that:

- default display type resolves to USD unless an explicit non-USD configuration is selected
- preset amount labels and user-facing pricing explanations are authored around USD values
- users should not see a CNY-first experience by default

Required behavior:

- top-up preset amount cards show USD as the primary baseline
- amount explanations and conversion hints only appear when the selected display type is not USD
- any fallback exchange-rate assumptions should treat USD as the base unit, not CNY

Files likely involved:

- `web/src/components/topup/RechargeCard.jsx`
- `web/src/components/topup/index.jsx`
- `web/src/helpers/render.jsx`
- backend status/config providers that determine quota display defaults

### 5. Documentation and generated API docs

Update checked-in documentation that currently exposes Chinese as the default public text.

Priority files include:

- `docs/openapi/api.json`
- `docs/openapi/relay.json`
- any related docs referenced by English customers where default wording is Chinese

Rules:

- API tags, summaries, and descriptions should be English-first
- preserve structure and protected identifiers
- if a Chinese-only glossary or localized README exists, it may remain localized as long as the English-facing default docs are English-first

### 6. Repository-wide i18n sweep

After the targeted fixes land, run a broader repository scan for default Chinese text that affects English customers.

The sweep should cover:

- frontend hard-coded strings
- backend JSON messages
- default labels and settings
- API docs and public docs

The sweep should classify findings into:

- fixed in this branch
- intentionally left localized-only
- deferred because they are not default customer-facing copy

## Data and Behavior Decisions

### Default group descriptions

Ship English descriptions by default:

```json
{
  "default": "Default",
  "vip": "VIP"
}
```

Chinese descriptions remain possible through explicit configuration or localized UI presentation.

### Top-up baseline semantics

USD is the source baseline for display and preset design.

Implications:

- preset amounts should be authored and displayed as USD values by default
- conversion to CNY or custom currency is a derived presentation mode, not the default baseline
- variable names and comments that imply CNY as the default should be normalized to reflect USD-first behavior

### Provider naming

Default provider labels should prefer recognized English names or English transliterations.

Examples:

- `Doubao Video`
- `ByteDance Volcano Ark / Doubao`
- English names for Chinese providers where the project already has a stable English-facing label pattern

## Testing

### Frontend tests and checks

- verify registration and password-reset flows show English success copy by default
- verify token creation default group labels render in English
- verify top-up page default preset cards and amounts render as USD-first
- verify channel selector and related provider labels no longer render Chinese by default

### Backend tests and checks

- verify verification email subject/body are English
- verify password reset email subject/body are English
- verify relevant API responses no longer send Chinese default messages in the targeted flows
- verify default group description helpers return English defaults

### Documentation checks

- verify `docs/openapi/api.json` default tags, summaries, and descriptions are English
- verify `docs/openapi/relay.json` default tags, summaries, and descriptions are English

### Repository sweep verification

- run targeted searches for common Chinese strings and provider names
- manually review remaining hits to distinguish localized resources from English-default violations

## Risks and Mitigations

### Risk: Breaking existing localized Chinese UI behavior

Mitigation:

- keep localized translation files intact
- only change default source strings and hard-coded defaults
- avoid changing user-selected language flow

### Risk: Top-up pricing display regressions

Mitigation:

- keep currency conversion logic intact
- only change the default baseline and presentation assumptions
- verify both USD and non-USD display modes after the change

### Risk: OpenAPI doc edits drift from generator expectations

Mitigation:

- inspect how the checked-in JSON is maintained before editing
- if generated from code comments, update the source comments instead of patching generated output alone
- if checked-in JSON is the maintained artifact, update it directly and verify consistency

## Deliverables

- English-first default copy across targeted frontend and backend flows
- USD-first top-up default presentation
- English default group descriptions and provider labels
- updated English-first public docs and OpenAPI docs
- a documented follow-up sweep result covering additional i18n issues found and fixed in this branch
