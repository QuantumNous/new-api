# English-First I18n Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the default customer-facing experience English-first, with USD as the default top-up baseline, without changing the existing global language selection behavior.

**Architecture:** The work is split across backend default responses, frontend hard-coded copy, shipped default settings/labels, and checked-in API/docs artifacts. Each task adds or updates tests first, then makes the smallest implementation change needed, and ends with targeted verification so regressions stay localized.

**Tech Stack:** Go 1.22+, Gin, GORM, React 18, Vite, i18next, Bun, ripgrep, Go test

---

## File Structure

- `controller/misc.go`
  Default verification and password-reset API messages plus email subject/body templates.
- `controller/token_test.go`
  Existing controller-level Go tests suitable for adding response assertions if token/group defaults need backend coverage.
- `controller/topup_waffo_pancake_test.go`
  Existing quota display baseline tests showing the pattern for `QuotaDisplayType` behavior.
- `setting/user_usable_group.go`
  Shipped default group descriptions that currently default to Chinese.
- `setting/operation_setting/general_setting.go`
  Default quota display type source of truth; already defaults to USD and should stay the baseline.
- `web/src/components/auth/RegisterForm.jsx`
  Registration success/info/error copy; currently includes hard-coded non-English strings.
- `web/src/components/auth/PasswordResetForm.jsx`
  Password reset email-sent success copy.
- `web/src/components/settings/PersonalSetting.jsx`
  Email binding/passkey feedback copy.
- `web/src/components/table/tokens/modals/EditTokenModal.jsx`
  Token creation/edit UX and default group placeholders/messages.
- `web/src/constants/channel.constants.js`
  Shipped default provider/channel labels, including Chinese names.
- `web/src/helpers/render.jsx`
  Shared labels, provider categories, currency symbol/rate helpers, and many default strings.
- `web/src/components/topup/RechargeCard.jsx`
  Top-up preset cards and USD/CNY fallback assumptions in the main billing UI.
- `web/src/helpers/data.js`
  Local storage hydration for `quota_display_type`; verify it preserves USD default.
- `docs/openapi/api.json`
  Checked-in public API docs with default Chinese tags/summaries.
- `docs/openapi/relay.json`
  Checked-in relay API docs with default Chinese tags/summaries.
- `docs/development/2026-04-22-i18n-english-first-sweep.md`
  New follow-up sweep record for residual English-customer i18n findings.

### Task 1: Backend Default Messages And Email Templates

**Files:**
- Modify: `controller/misc.go`
- Modify: `setting/user_usable_group.go`
- Test: `controller/token_test.go`
- Test: `controller/topup_waffo_pancake_test.go`

- [ ] **Step 1: Write the failing backend tests**

Add controller tests that assert English default behavior for verification and password reset flows, plus a simple settings-level assertion for default group descriptions.

```go
func TestSendEmailVerificationUsesEnglishDefaults(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodGet, "/api/verification?email=test@example.com", nil)
	c.Request = req

	SendEmailVerification(c)

	body := recorder.Body.String()
	if strings.Contains(body, "邮箱") || strings.Contains(body, "验证码") {
		t.Fatalf("expected english default response, got %s", body)
	}
}

func TestDefaultUserUsableGroupsAreEnglish(t *testing.T) {
	groups := setting.GetUserUsableGroupsCopy()
	if groups["default"] != "Default" {
		t.Fatalf("expected Default, got %q", groups["default"])
	}
	if groups["vip"] != "VIP" {
		t.Fatalf("expected VIP, got %q", groups["vip"])
	}
}
```

- [ ] **Step 2: Run backend tests to verify they fail**

Run: `go test ./controller -run "TestSendEmailVerificationUsesEnglishDefaults|TestDefaultUserUsableGroupsAreEnglish" -count=1`

Expected: FAIL because current defaults still contain Chinese text and group descriptions are not English.

- [ ] **Step 3: Write the minimal backend implementation**

Update the verification and password-reset templates to English defaults, and switch the shipped group descriptions to English. Keep behavior unchanged beyond wording.

```go
var userUsableGroups = map[string]string{
	"default": "Default",
	"vip":     "VIP",
}
```

```go
subject := fmt.Sprintf("%s Email Verification", common.SystemName)
content := fmt.Sprintf(
	"<p>Hello, you are verifying your email for %s.</p><p>Your verification code is: <strong>%s</strong></p><p>This code is valid for %d minutes. If this wasn't you, you can ignore this email.</p>",
	common.SystemName,
	code,
	common.VerificationValidMinutes,
)
```

- [ ] **Step 4: Run backend tests to verify they pass**

Run: `go test ./controller -run "TestSendEmailVerificationUsesEnglishDefaults|TestDefaultUserUsableGroupsAreEnglish" -count=1`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add controller/misc.go setting/user_usable_group.go controller/token_test.go controller/topup_waffo_pancake_test.go
git commit -m "fix: make backend i18n defaults english-first"
```

### Task 2: Frontend Default Copy And Token Group UX

**Files:**
- Modify: `web/src/components/auth/RegisterForm.jsx`
- Modify: `web/src/components/auth/PasswordResetForm.jsx`
- Modify: `web/src/components/settings/PersonalSetting.jsx`
- Modify: `web/src/components/table/tokens/modals/EditTokenModal.jsx`
- Modify: `web/src/helpers/render.jsx`

- [ ] **Step 1: Write the failing search-based checks**

Before editing, lock down the obvious hard-coded customer-facing Chinese strings that this task must remove.

```bash
rg -n "注册成功|验证码发送成功|重置邮件发送成功|邮箱账户绑定成功|令牌分组，默认为用户的分组|管理员未设置用户可选分组|豆包" web/src/components/auth web/src/components/settings web/src/components/table/tokens web/src/helpers/render.jsx
```

Expected: multiple hits in the target files.

- [ ] **Step 2: Verify the checks fail the english-first requirement**

Run: `rg -n "注册成功|验证码发送成功|重置邮件发送成功|邮箱账户绑定成功|令牌分组，默认为用户的分组|管理员未设置用户可选分组" web/src/components/auth web/src/components/settings web/src/components/table/tokens`

Expected: matches remain, proving the targeted defaults are still not English-first.

- [ ] **Step 3: Write the minimal frontend implementation**

Convert hard-coded copy to English-first strings, preferring existing `t(...)` usage. Keep the component structure intact.

```jsx
showSuccess(t('Registration successful!'));
showSuccess(t('Verification code sent. Please check your email.'));
showSuccess(t('Password reset email sent. Please check your inbox.'));
showSuccess(t('Email account linked successfully!'));
```

```jsx
<Form.Select
  field='group'
  label={t('Token group')}
  placeholder={t('Token group, defaults to the user group')}
  optionList={groups}
  renderOptionItem={renderGroupOption}
/>
```

Also convert default provider/category labels in `render.jsx` from Chinese defaults to English labels such as `Doubao`, `Qwen`, `Hunyuan`, `Kling`, `Jimeng`, and `Yi`.

- [ ] **Step 4: Run the checks to verify the target strings are gone**

Run: `rg -n "注册成功|验证码发送成功|重置邮件发送成功|邮箱账户绑定成功|令牌分组，默认为用户的分组|管理员未设置用户可选分组" web/src/components/auth web/src/components/settings web/src/components/table/tokens`

Expected: no matches

- [ ] **Step 5: Commit**

```bash
git add web/src/components/auth/RegisterForm.jsx web/src/components/auth/PasswordResetForm.jsx web/src/components/settings/PersonalSetting.jsx web/src/components/table/tokens/modals/EditTokenModal.jsx web/src/helpers/render.jsx
git commit -m "fix: make frontend auth and token defaults english-first"
```

### Task 3: USD Top-Up Baseline And Provider Labels

**Files:**
- Modify: `web/src/components/topup/RechargeCard.jsx`
- Modify: `web/src/constants/channel.constants.js`
- Modify: `web/src/helpers/render.jsx`
- Modify: `web/src/helpers/data.js`
- Test: `controller/topup_waffo_pancake_test.go`

- [ ] **Step 1: Write the failing checks for CNY-first assumptions**

Search for comments, fallback values, and user-facing defaults that still assume CNY is the primary baseline.

```bash
rg -n "默认CNY汇率|CNY \\(¥\\)|CNY|人民币|豆包视频|字节火山方舟、豆包通用" web/src/components/topup web/src/constants/channel.constants.js web/src/helpers/render.jsx
```

Expected: matches in `RechargeCard.jsx`, channel constants, and shared helpers.

- [ ] **Step 2: Run targeted backend regression tests before implementation**

Run: `go test ./controller -run "TestGetAmount|TestGetTopupLink|TestGetAmountForWaffoPancake" -count=1`

Expected: PASS or a narrower subset PASS for the existing top-up controller tests. Record the exact passing subset before modifying display assumptions.

- [ ] **Step 3: Write the minimal implementation**

Normalize the top-up UI to USD-first baseline while preserving conversion for explicit non-USD display types. Remove variable names/comments that claim CNY is the default.

```jsx
const { symbol, rate, type } = getCurrencyConfig();
let usdExchangeRate = 1;
try {
  if (statusStr) {
    const s = JSON.parse(statusStr);
    usdExchangeRate = s?.usd_exchange_rate || 1;
  }
} catch (e) {}

if (type === 'USD') {
  displayValue = preset.value;
  displayActualPay = actualPay;
  displaySave = save;
} else if (type === 'CNY') {
  displayValue = preset.value * usdExchangeRate;
  displayActualPay = actualPay * usdExchangeRate;
  displaySave = save * usdExchangeRate;
}
```

Update provider labels in `web/src/constants/channel.constants.js` to English-first values such as:

```js
{ value: 45, color: 'blue', label: 'ByteDance Volcano Ark / Doubao' }
{ value: 54, color: 'blue', label: 'Doubao Video' }
```

- [ ] **Step 4: Re-run targeted checks and backend tests**

Run: `rg -n "默认CNY汇率|豆包视频|字节火山方舟、豆包通用" web/src/components/topup web/src/constants/channel.constants.js web/src/helpers/render.jsx`

Expected: no matches for the targeted default strings.

Run: `go test ./controller -run "TestGetAmount|TestGetTopupLink|TestGetAmountForWaffoPancake" -count=1`

Expected: PASS for the chosen existing top-up regression subset.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/topup/RechargeCard.jsx web/src/constants/channel.constants.js web/src/helpers/render.jsx web/src/helpers/data.js controller/topup_waffo_pancake_test.go
git commit -m "fix: make topup baseline usd-first and provider labels english"
```

### Task 4: OpenAPI Docs And Repository-Wide I18n Sweep

**Files:**
- Modify: `docs/openapi/api.json`
- Modify: `docs/openapi/relay.json`
- Create: `docs/development/2026-04-22-i18n-english-first-sweep.md`

- [ ] **Step 1: Write the failing documentation checks**

Search the public API docs for the customer-facing Chinese tags and summaries already identified.

```bash
rg -n "\"name\": \"分组\"|\"name\": \"视频生成\"|\"summary\": \"发送邮箱验证码\"|\"summary\": \"创建视频" docs/openapi/api.json docs/openapi/relay.json
```

Expected: matches in both OpenAPI files.

- [ ] **Step 2: Run the checks to confirm current docs are not English-first**

Run: `rg -n "\"name\": \"分组\"|\"name\": \"视频生成\"|\"summary\": \"发送邮箱验证码\"|\"summary\": \"创建视频" docs/openapi/api.json docs/openapi/relay.json`

Expected: matches remain.

- [ ] **Step 3: Write the minimal documentation implementation**

Replace the default public-facing tags, summaries, and descriptions with English-first text. Then create a sweep report documenting residual findings and dispositions.

```json
{ "name": "Groups" }
{ "summary": "Send email verification code" }
{ "summary": "Create video" }
{ "name": "Video Generation" }
```

Create `docs/development/2026-04-22-i18n-english-first-sweep.md` with sections:

```md
# 2026-04-22 English-First I18n Sweep

## Fixed
- auth success copy
- email templates
- token group defaults
- provider labels
- OpenAPI summaries/tags

## Localized Only
- zh-CN and zh-TW locale files
- localized README variants

## Deferred
- non-default internal comments
- admin-only technical copy outside the default customer path
```

- [ ] **Step 4: Re-run the documentation checks and broader sweep**

Run: `rg -n "\"name\": \"分组\"|\"name\": \"视频生成\"|\"summary\": \"发送邮箱验证码\"|\"summary\": \"创建视频" docs/openapi/api.json docs/openapi/relay.json`

Expected: no matches

Run: `rg -n "[一-龥]" controller web/src/constants web/src/components web/src/helpers docs/openapi -g "!web/src/i18n/locales/*" -g "!i18n/locales/*"`

Expected: remaining hits are reviewed and either fixed now or listed in the sweep document.

- [ ] **Step 5: Commit**

```bash
git add docs/openapi/api.json docs/openapi/relay.json docs/development/2026-04-22-i18n-english-first-sweep.md
git commit -m "docs: make public api docs english-first"
```

## Self-Review

### Spec coverage

- backend default messages and email templates: covered by Task 1
- frontend default copy and token group UX: covered by Task 2
- USD top-up baseline and provider labels: covered by Task 3
- documentation updates and full-project follow-up sweep: covered by Task 4

No spec gaps remain.

### Placeholder scan

- no blocked placeholder patterns remain inside task steps
- every task includes a concrete file list, command, and code snippet

### Type consistency

- `quota_display_type` remains the existing string field
- `userUsableGroups` remains `map[string]string`
- frontend token group fields continue using the existing `group` property
- OpenAPI docs only change literal text, not schema keys
