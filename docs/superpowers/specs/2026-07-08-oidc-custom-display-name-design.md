# OIDC Custom Display Name — Design

Date: 2026-07-08

## Problem

The OIDC login button and related copy are hardcoded to the literal string "OIDC" throughout the backend and both frontends. Admins who configure OIDC against a specific identity provider (e.g. a company SSO) want to show a more meaningful name to end users, reducing cognitive load ("Continue with OIDC" vs. "Continue with Acme SSO").

## Reference pattern

The project already has an equivalent feature for admin-defined **Custom OAuth Providers** (`model/custom_oauth_provider.go`): each provider has a `Name` field that is used directly as `GetName()` and rendered on the login button as `Continue with {{name}}`. This design mirrors that pattern for the built-in OIDC provider.

## Scope

Both frontend themes are in scope: `web/default` (React 19 / Base UI, primary) and `web/classic` (Semi Design, legacy but still maintained). Both the settings page and the login page in each theme need the new field / updated copy.

The custom name is fully linked to all places `OIDCProvider.GetName()` feeds into, not just the login button:
- Login page button label.
- OAuth error messages that reference the provider name (e.g. "OIDC login not enabled").
- Auto-generated `DisplayName` for a new user created via first-time OIDC login (currently `"OIDC User"`).

## Backend design

### 1. New setting field

`setting/system_setting/oidc.go` — add to `OIDCSettings`:

```go
type OIDCSettings struct {
    Enabled      bool
    DisplayName  string `json:"display_name"`
    ClientId     string
    ClientSecret string
    WellKnown    string
    AuthorizationEndpoint string
    TokenEndpoint         string
    UserInfoEndpoint      string
}
```

The project's `ConfigManager` (`setting/config/config.go`) persists registered settings structs by reflecting over exported fields and their `json` tags into dotted keys in the generic `options` DB table (e.g. `oidc.display_name`). Adding this field requires **no migration and no new persistence code** — it is automatically readable/writable through the existing `oidc.*` option mechanism and the generic `UpdateOption` controller endpoint.

### 2. Fallback helper

Add one method on `OIDCSettings` in the same file, since it is consumed from two separate packages (`oauth` and `controller`):

```go
func (s *OIDCSettings) GetEffectiveDisplayName() string {
    if s.DisplayName != "" {
        return s.DisplayName
    }
    return "OIDC"
}
```

This centralizes the "what is the default name" business rule in one place instead of duplicating an `if displayName == ""` check at each call site.

### 3. Wiring

- `oauth/oidc.go:43` `(*OIDCProvider).GetName()` returns `system_setting.GetOIDCSettings().GetEffectiveDisplayName()` instead of the hardcoded `"OIDC"` literal. This automatically flows into:
  - Error messages built with `provider.GetName()` in `controller/oauth.go`.
  - The auto-generated `user.DisplayName = provider.GetName() + " User"` in `controller/oauth.go:264`.
- `controller/misc.go` public status payload (~line 111-113) gains `"oidc_display_name": system_setting.GetOIDCSettings().GetEffectiveDisplayName()`, so the frontend login page gets the resolved (already-defaulted) name without needing its own fallback logic duplicated — though the frontend will still apply a defensive `|| 'OIDC'` fallback for robustness against older cached status payloads.

No new validation is required: the field is optional free text, consistent with how `CustomOAuthProvider.Name` is handled (required there only because a custom provider has no sensible default name; OIDC already has one).

## Frontend design

### `web/default`

- **Settings** (`features/system-settings/auth/oauth-section.tsx`): add `display_name` to the OIDC tab's zod schema, form defaults/normalization, and render a text input (optional, placeholder explaining it defaults to "OIDC"). Persist through the existing per-key `useUpdateOption` flow used by the other `oidc.*` fields.
- **Login page** (`features/auth/components/oauth-providers.tsx:101-107`): replace the hardcoded `t('Continue with OIDC')` with `t('Continue with {{name}}', { name: status?.oidc_display_name || 'OIDC' })`. This i18n key already exists (used by custom OAuth providers), so no new translation key is needed here.

### `web/classic`

- **Settings** (`components/settings/SystemSetting.jsx`): add `display_name` to the OIDC form state (~line 59-65), the OIDC form UI (~line 1405-1478), and `submitOIDCSettings` (~line 526).
- **Login page** (`components/auth/LoginForm.jsx:581`): replace hardcoded `t('使用 OIDC 继续')` with `t('使用 {{name}} 继续', { name: status?.oidc_display_name || 'OIDC' })`, reusing the existing key from the custom-provider login button.

### i18n additions

Only the settings-page field label itself needs a new translation key (e.g. `"OIDC Display Name"`), added to `web/default/src/i18n/locales/{en,zh,fr,ru,ja,vi}.json` and the classic theme's equivalent locale files. No new key is needed for the login button text since both themes already have a `{{name}}`-parameterized string for custom OAuth providers.

## Testing

- Backend: table test for `GetEffectiveDisplayName()` (empty → `"OIDC"`, non-empty → the configured value), colocated with existing tests under `setting/system_setting/`.
- Frontend: manual verification in the browser — set a custom display name in the default theme's settings page, confirm the login page button and copy update accordingly; spot-check the classic theme for parity.

## Non-goals

- No icon customization for built-in OIDC (only `Name`, matching what was explicitly requested; `CustomOAuthProvider.Icon` is a separate, unrequested feature).
- No length/format validation on the display name beyond what the generic option system already provides.
