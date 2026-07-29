# Activity Email Sender Alias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let administrators maintain authorized SMTP From aliases and let Activity Configuration select one global sender without changing any unrelated system email sender.

**Architecture:** Keep SMTP credentials and the default sender in the existing global option system, add a normalized `SMTPFromAliases` allow-list, and store the Activity-only selection in `recall_campaign_setting.email_from`. Resolve one immutable sender snapshot at the start of each Activity email batch, before message leasing or hourly-quota reservation, and pass it explicitly through Message-ID construction and SMTP sending. Existing email callers continue using `SendEmailWithMessageID` and therefore keep the original `SMTPFrom` behavior.

**Tech Stack:** Go 1.22, Gin, GORM, repository option/config synchronization, React 19, TypeScript, React Query, React Hook Form, Zod, Bun tests, i18next.

---

### Task 1: Add normalized SMTP alias and explicit-sender primitives

**Files:**
- Modify: `common/constants.go:122-130`
- Create: `common/email_sender.go`
- Modify: `common/email.go:42-174`
- Modify: `common/email_test.go`

- [ ] **Step 1: Write failing common-package tests**

Add table-driven tests that lock the public contract:

```go
func TestNormalizeSMTPFromAliases(t *testing.T) {
	got, err := NormalizeSMTPFromAliases(
		" Campaigns@Example.com\nalerts@example.com,campaigns@example.com ",
		"system@example.com",
		"login@example.com",
	)
	require.NoError(t, err)
	require.Equal(t, "Campaigns@Example.com,alerts@example.com", got)

	_, err = NormalizeSMTPFromAliases("safe@example.com\nBcc: victim@example.com", "system@example.com", "login@example.com")
	require.Error(t, err)
}

func TestResolveSMTPSenderUsesCanonicalAllowedAlias(t *testing.T) {
	resolved, err := ResolveSMTPSenderFromConfig(
		"campaigns@example.com",
		"system@example.com",
		"login@example.com",
		"Campaigns@Example.com,alerts@example.com",
	)
	require.NoError(t, err)
	require.Equal(t, "Campaigns@Example.com", resolved.Email)
	require.Equal(t, "example.com", resolved.Domain)
	require.False(t, resolved.UsesDefault)
	require.Equal(t, []SMTPSenderChoice{
		{Email: "system@example.com", IsDefault: true},
		{Email: "Campaigns@Example.com"},
		{Email: "alerts@example.com"},
	}, resolved.Options)
}

func TestResolveSMTPSenderRejectsUnlistedAlias(t *testing.T) {
	_, err := ResolveSMTPSenderFromConfig(
		"other@example.com",
		"system@example.com",
		"login@example.com",
		"campaigns@example.com",
	)
	require.ErrorContains(t, err, "not allowed")
}

func TestSendEmailFromWithMessageIDUsesExplicitEnvelopeAndHeader(t *testing.T) {
	port, wait := startSMTPTestServer(t, smtpTestScript{})
	configureSMTPTestClient(t, port, false)
	err := SendEmailFromWithMessageID(
		"campaigns@example.com",
		"subject",
		"user@example.com",
		"body",
		"<recall-1-1@example.com>",
	)
	require.NoError(t, err)
	result := wait()
	require.Contains(t, result.commands, "MAIL FROM:<campaigns@example.com>")
	require.Contains(t, result.data, "From: Flatkey <campaigns@example.com>\r\n")
}
```

- [ ] **Step 2: Run the tests and confirm the new API is absent**

Run: `go test ./common -run 'Test(NormalizeSMTPFromAliases|ResolveSMTPSender|SendEmailFromWithMessageID)' -count=1`

Expected: FAIL because the alias types/functions and explicit-sender function do not exist.

- [ ] **Step 3: Add the normalized sender model**

Add `SMTPFromAliases` to `common/constants.go` and implement the following focused API in `common/email_sender.go`:

```go
type SMTPSenderChoice struct {
	Email     string `json:"email"`
	IsDefault bool   `json:"is_default"`
}

type ResolvedSMTPSender struct {
	Email       string
	Domain      string
	UsesDefault bool
	Options     []SMTPSenderChoice
}

func NormalizeSMTPFromAliases(value, smtpFrom, smtpAccount string) (string, error)
func ResolveSMTPSender(configured string) (ResolvedSMTPSender, error)
func ResolveSMTPSenderFromConfig(configured, smtpFrom, smtpAccount, aliases string) (ResolvedSMTPSender, error)
func EmailMessageIDDomainForSender(sender string) (string, error)
```

Implementation requirements:

```go
// Split textarea or persisted input, validate every non-empty token as one
// plain mailbox, preserve first spelling/order, and deduplicate with EqualFold.
parts := strings.FieldsFunc(value, func(r rune) bool {
	return r == ',' || r == '\n' || r == '\r'
})

// The effective default is SMTPFrom, falling back to SMTPAccount. An invalid
// or absent default makes resolution fail even when an explicit alias exists.
defaultEmail, defaultDomain, err := plainMailboxAndDomain(firstNonEmpty(smtpFrom, smtpAccount))

// Empty configured selection follows the default. Non-empty selection must
// match an alias or the default case-insensitively and returns canonical spelling.
```

Reject display-name syntax, CR/LF-bearing tokens, missing local/domain parts, invalid domains, and aliases not in the effective choices. Do not mutate any global while resolving.

- [ ] **Step 4: Refactor SMTP sending around an explicit sender**

Keep the existing API and add the new API without changing unrelated callers:

```go
func SendEmailWithMessageID(subject, receiver, content, messageID string) error {
	resolved, err := ResolveSMTPSender("")
	if err != nil {
		return err
	}
	return SendEmailFromWithMessageID(resolved.Email, subject, receiver, content, messageID)
}

func SendEmailFromWithMessageID(from, subject, receiver, content, messageID string) error {
	sender, _, err := plainMailboxAndDomain(from)
	if err != nil {
		return err
	}
	message, err := buildEmailMessageFrom(sender, subject, receiver, content, messageID)
	// Reuse the current auth, TLS, uncertainty classification, recipient parsing,
	// and SMTP connection flow. Pass sender to MAIL FROM and the same sender to
	// the From header builder.
}
```

Retain `buildEmailMessage(...)` as the default-sender compatibility wrapper and introduce `buildEmailMessageFrom(...)` for the explicit path.

- [ ] **Step 5: Run common tests**

Run: `go test ./common/... -count=1`

Expected: PASS; existing default-sender, TLS, error-classification, and Message-ID tests remain green.

- [ ] **Step 6: Commit Task 1 using the Lore protocol**

```text
Keep Activity sender choice out of global SMTP state

Constraint: All aliases share one SMTP account while unrelated system emails retain the default From address.
Rejected: Mutating SMTPFrom per Activity message | It creates cross-request sender races and leaks Activity behavior into other services.
Confidence: high
Scope-risk: moderate
Directive: Pass explicit senders through the SMTP call; never swap process-global SMTPFrom around a send.
Tested: go test ./common/... -count=1
```

### Task 2: Persist and validate the alias allow-list and Activity selection

**Files:**
- Modify: `model/option.go:65-100,282-445,701-722`
- Create: `model/smtp_from_alias_option_test.go`
- Modify: `setting/operation_setting/recall_campaign_setting.go`
- Modify: `setting/operation_setting/recall_campaign_setting_test.go`

- [ ] **Step 1: Write failing setting and option tests**

Cover all persistence boundaries:

```go
func TestRecallCampaignSettingLoadsEmailFrom(t *testing.T) {
	cfg := RecallCampaignSetting{}
	err := config.UpdateConfigFromMap(&cfg, map[string]string{"email_from": "campaigns@example.com"})
	require.NoError(t, err)
	require.Equal(t, "campaigns@example.com", cfg.EmailFrom)
}

func TestUpdateOptionNormalizesSMTPFromAliases(t *testing.T) {
	setupOptionTestDatabase(t)
	withSMTPConfig(t, "system@example.com", "login@example.com", "")
	require.NoError(t, UpdateOption("SMTPFromAliases", " Campaigns@Example.com\nalerts@example.com,campaigns@example.com "))
	require.Equal(t, "Campaigns@Example.com,alerts@example.com", common.SMTPFromAliases)
}

func TestUpdateOptionRejectsRemovingActiveRecallSender(t *testing.T) {
	setupOptionTestDatabase(t)
	withSMTPConfig(t, "system@example.com", "login@example.com", "campaigns@example.com,alerts@example.com")
	setRecallSenderSetting(t, "campaigns@example.com")
	err := UpdateOption("SMTPFromAliases", "alerts@example.com")
	require.ErrorContains(t, err, "currently selected")
	require.Equal(t, "campaigns@example.com,alerts@example.com", common.SMTPFromAliases)
}
```

Also test `recall_campaign_setting.email_from` canonicalizes case against the configured alias and rejects default-address-as-explicit, malformed, and unlisted values.

- [ ] **Step 2: Run focused tests and observe failure**

Run: `go test ./setting/operation_setting ./model -run 'Test(RecallCampaignSetting.*EmailFrom|UpdateOption.*SMTPFromAliases|UpdateOption.*RecallSender)' -count=1`

Expected: FAIL because the fields and option validation do not exist.

- [ ] **Step 3: Register both settings**

Extend the existing structures without a migration:

```go
// common/constants.go, initialized through model.InitOptionMap/updateOptionMap
var SMTPFromAliases = ""

type RecallCampaignSetting struct {
	Enabled          bool   `json:"enabled"`
	BatchSize        int    `json:"batch_size"`
	TickSeconds      int    `json:"tick_seconds"`
	EmailHourlyLimit int    `json:"email_hourly_limit"`
	EmailFrom        string `json:"email_from"`
}
```

Add `common.OptionMap["SMTPFromAliases"] = ""` in `InitOptionMap`, and assign `common.SMTPFromAliases` in `applyOptionMapValue`.

- [ ] **Step 4: Normalize option writes before persistence**

Extend `validateAndNormalizeOptionValue` with precise cases:

```go
case "SMTPFromAliases":
	normalized, err := common.NormalizeSMTPFromAliases(value, common.SMTPFrom, common.SMTPAccount)
	if err != nil {
		return "", err
	}
	active := operation_setting.GetRecallCampaignSetting().EmailFrom
	if active != "" {
		if _, err := common.ResolveSMTPSenderFromConfig(
			active, common.SMTPFrom, common.SMTPAccount, normalized,
		); err != nil {
			return "", errors.New("the currently selected Activity sender must be changed before removing this alias")
		}
	}
	return normalized, nil

case "recall_campaign_setting.email_from":
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}
	resolved, err := common.ResolveSMTPSender(trimmed)
	if err != nil || resolved.UsesDefault {
		return "", errors.New("Activity sender must be one of the configured SMTP aliases")
	}
	return resolved.Email, nil
```

When `SMTPFrom` changes and Activity has an explicit sender, simulate the new effective choices before accepting the write so an alias cannot become orphaned through a default-sender change. Keep all validation before `DB.Save`, preserving the existing no-partial-write behavior.

- [ ] **Step 5: Run setting/model tests**

Run: `go test ./setting/operation_setting ./model -run 'Test(RecallCampaignSetting|UpdateOption.*SMTP|UpdateOption.*RecallSender)' -count=1`

Expected: PASS.

- [ ] **Step 6: Commit Task 2 using the Lore protocol**

```text
Make Activity sender configuration durable and fail closed

Constraint: Alias removal must not orphan the global Activity sender and no schema migration is available.
Rejected: Browser-only allow-list validation | Workers and direct option writes must enforce the same boundary.
Confidence: high
Scope-risk: moderate
Directive: Validate both configuration writes and send-time resolution; out-of-band invalid state must stop Activity sending.
Tested: focused setting and model option tests
```

### Task 3: Add the Activity sender API and admin routes

**Files:**
- Create: `service/recall_email_sender.go`
- Create: `service/recall_email_sender_test.go`
- Modify: `controller/recall_campaign.go:19-33,151-181`
- Modify: `controller/recall_campaign_test.go`
- Modify: `router/api-router.go:207-230`
- Modify: `router/recall_campaign_test.go`

- [ ] **Step 1: Write failing service/controller/router tests**

Lock response redaction and update behavior:

```go
func TestRecallEmailSenderStatusUsesDefaultWithoutSecrets(t *testing.T) {
	withRecallSMTPSettings(t, "system@example.com", "campaigns@example.com", "")
	status, err := GetRecallEmailSenderStatus()
	require.NoError(t, err)
	require.Equal(t, "", status.ConfiguredEmailFrom)
	require.Equal(t, "system@example.com", status.EffectiveEmailFrom)
	require.True(t, status.UsesDefault)
	require.Len(t, status.Options, 2)
}

func TestUpdateRecallEmailSenderPersistsCanonicalAlias(t *testing.T) {
	// PUT {"email_from":"campaigns@example.com"}; assert success response,
	// canonical persisted option, and RecallCampaignSetting.EmailFrom.
}

func TestRecallEmailSenderRoutesRequireAdminAuth(t *testing.T) {
	// Assert GET and PUT /api/recall-campaigns/email-sender are registered before /:id
	// and return HTTP 401 without an admin session.
}
```

- [ ] **Step 2: Run focused tests and observe failure**

Run: `go test ./service ./controller ./router -run 'TestRecallEmailSender' -count=1`

Expected: FAIL because status types, handlers, and routes do not exist.

- [ ] **Step 3: Implement non-secret status projection**

Create the service projection:

```go
type RecallEmailSenderOption struct {
	Email     string `json:"email"`
	IsDefault bool   `json:"is_default"`
}

type RecallEmailSenderStatus struct {
	ConfiguredEmailFrom string                    `json:"configured_email_from"`
	EffectiveEmailFrom  string                    `json:"effective_email_from"`
	UsesDefault          bool                      `json:"uses_default"`
	Options              []RecallEmailSenderOption `json:"options"`
}

func GetRecallEmailSenderStatus() (RecallEmailSenderStatus, error)
func NormalizeRecallEmailSenderSelection(value string) (string, error)
```

The status contains only addresses and flags; it must never expose SMTP server, account, token, TLS, or auth mode.

- [ ] **Step 4: Add thin handlers and routes**

```go
type recallEmailSenderUpdateRequest struct {
	EmailFrom string `json:"email_from"`
}

func GetRecallEmailSender(c *gin.Context) {
	status, err := service.GetRecallEmailSenderStatus()
	if err != nil { common.ApiError(c, err); return }
	common.ApiSuccess(c, status)
}

func UpdateRecallEmailSender(c *gin.Context) {
	var request recallEmailSenderUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request"})
		return
	}
	normalized, err := service.NormalizeRecallEmailSenderSelection(request.EmailFrom)
	if err != nil { common.ApiError(c, err); return }
	if err := model.UpdateOption("recall_campaign_setting.email_from", normalized); err != nil {
		common.ApiError(c, err); return
	}
	status, err := service.GetRecallEmailSenderStatus()
	if err != nil { common.ApiError(c, err); return }
	common.ApiSuccess(c, status)
}
```

Register GET/PUT `/email-sender` inside the existing `AdminAuth` group before `/:id`.

- [ ] **Step 5: Run service/controller/router tests**

Run: `go test ./service ./controller ./router -run 'TestRecallEmailSender' -count=1`

Expected: PASS.

- [ ] **Step 6: Commit Task 3 using the Lore protocol**

```text
Expose one redacted Activity sender control

Constraint: Operators may choose an address but must never receive SMTP credentials through Activity APIs.
Rejected: Reusing the generic options payload | It broadens the endpoint contract and mixes Activity scope with secrets management.
Confidence: high
Scope-risk: narrow
Directive: Keep email-sender routes admin-only and return only address choices plus selection state.
Tested: focused service, controller, and router tests
```

### Task 4: Resolve the Activity sender before leasing and quota reservation

**Files:**
- Modify: `service/recall_email.go:43-53,139-177,291-317,350-374,487-535,704-716`
- Modify: `service/recall_scheduler.go:30-47`
- Modify: `service/recall_email_test.go`
- Modify: `service/recall_worker_test.go`

- [ ] **Step 1: Write failing worker regressions**

Add tests for the two critical boundaries:

```go
func TestRecallEmailWorkerInvalidSenderDoesNotLeaseOrConsumeQuota(t *testing.T) {
	fixture := seedDueRecallEmail(t)
	setRecallSenderConfig(t, "removed@example.com", "campaigns@example.com")
	processed, err := fixture.worker.RunBatch(context.Background(), 10)
	require.Zero(t, processed)
	require.ErrorContains(t, err, "not allowed")
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageScheduled, stored.State)
	status, err := model.GetRecallEmailQuotaStatusWithContext(context.Background(), 100)
	require.NoError(t, err)
	require.Zero(t, status.Used)
}

func TestRecallEmailWorkerUsesLatestConfiguredSenderForQueuedMessage(t *testing.T) {
	fixture := seedDueRecallEmail(t)
	setRecallSenderConfig(t, "alerts@example.com", "campaigns@example.com,alerts@example.com")
	var sentFrom string
	fixture.worker.sender = func(from, subject, receiver, content, messageID string) error {
		sentFrom = from
		require.Contains(t, messageID, "@example.com>")
		return nil
	}
	_, err := fixture.worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, "alerts@example.com", sentFrom)
}
```

Also retain a regression proving `common.SendEmailWithMessageID` still uses the global default sender.

- [ ] **Step 2: Run focused worker tests and observe failure**

Run: `go test ./service -run 'TestRecallEmailWorker.*Sender' -count=1`

Expected: FAIL because the worker sender has no explicit `from` parameter and does not preflight configuration.

- [ ] **Step 3: Carry an immutable sender snapshot through a batch**

Change the injection type and default constructor:

```go
type RecallEmailSender func(from, subject, receiver, content, messageID string) error

func NewRecallEmailWorker(sender RecallEmailSender, ...) *RecallEmailWorker {
	if sender == nil {
		sender = common.SendEmailFromWithMessageID
	}
	// existing dependencies unchanged
}
```

At the first executable line of `RunBatch`, before quota status, due-message listing, or leasing:

```go
senderSnapshot, err := resolveRecallEmailSender()
if err != nil {
	return 0, err
}
```

Pass the snapshot into `processLeasedItem`. `ProcessLeased` must resolve before loading/processing its already-leased item. This keeps invalid configuration fail-closed and prevents quota consumption.

- [ ] **Step 4: Generate Message-ID at the last pre-SMTP boundary**

Move new provider Message-ID allocation from the early render path to immediately before `BeginRecallEmailSMTPAttemptWithContext`. Generate with the snapshot domain:

```go
func recallEmailMessageID(recipientID int64, stageNo int, domain string) (string, error)
```

If a provider Message-ID already exists from a prior SMTP attempt, preserve it for idempotency. If it is empty, generate and persist the new ID only after all claim/render/activity-stop preflight work succeeds. Then reserve quota and call:

```go
if err := w.sender(
	senderSnapshot.Email,
	subject,
	item.Recipient.EmailSnapshot,
	htmlBody,
	providerMessageID,
); err != nil {
	// existing definite/uncertain handling remains unchanged
}
```

- [ ] **Step 5: Update injected test senders mechanically**

All test doubles become five-argument functions. Capture `from` only where the assertion needs it; use `_` for unaffected parameters. Do not alter existing attempt, uncertainty, retry, lease, or quota expectations.

- [ ] **Step 6: Run the recall worker suite**

Run: `go test ./service -run 'Recall.*(Email|Worker)' -count=1`

Expected: PASS, including invalid-config no-lease/no-quota and latest-sender assertions.

- [ ] **Step 7: Commit Task 4 using the Lore protocol**

```text
Bind queued Activity mail to a validated send-time sender

Constraint: Invalid sender configuration must stop before distributed leases and hourly-attempt quota are touched.
Rejected: Snapshotting sender in each campaign or message | Operators require one live Activity-wide selection for unsent queue items.
Confidence: high
Scope-risk: moderate
Directive: Resolve once per batch, carry the value explicitly, allocate new Message-IDs at the final pre-SMTP boundary, and preserve any existing ID for idempotency.
Tested: focused recall email and worker tests
```

### Task 5: Add SMTP alias maintenance to System Settings

**Files:**
- Modify: `web/default/src/features/system-settings/types.ts:354-360`
- Modify: `web/default/src/features/system-settings/operations/index.tsx:68-74`
- Modify: `web/default/src/features/system-settings/operations/section-registry.tsx:102-118`
- Modify: `web/default/src/features/system-settings/integrations/email-settings-section.tsx`
- Create: `web/default/src/features/system-settings/integrations/email-settings-section.test.tsx`

- [ ] **Step 1: Write failing parser/form tests**

Export a pure parser contract and test it before changing the form:

```ts
expect(
  parseSMTPFromAliases(
    ' Campaigns@Example.com\nalerts@example.com ',
    'system@example.com'
  )
).toEqual({
  aliases: ['Campaigns@Example.com', 'alerts@example.com'],
  persisted: 'Campaigns@Example.com,alerts@example.com',
})

expect(() =>
  parseSMTPFromAliases('campaigns@example.com\nCAMPAIGNS@example.com', '')
).toThrow('duplicate')

expect(() =>
  parseSMTPFromAliases('Flatkey <campaigns@example.com>', '')
).toThrow('valid email')
```

Render the section and assert a labeled textarea is present and its saved update uses key `SMTPFromAliases` with comma-separated normalized value.

- [ ] **Step 2: Run the new frontend test and observe failure**

Run: `bun test src/features/system-settings/integrations/email-settings-section.test.tsx`

Expected: FAIL because the parser, field, and option type do not exist.

- [ ] **Step 3: Extend typed defaults and section wiring**

Add `SMTPFromAliases: string` to `SystemSettings`, `operationsDefaults`, and the email section `defaultValues`. Convert persisted commas to one-address-per-line display text when building the section:

```ts
SMTPFromAliases: settings.SMTPFromAliases
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .join('\n'),
```

- [ ] **Step 4: Add Zod-backed textarea validation and normalized save**

Use `Textarea` below `SMTPFrom`. Parse one plain mailbox per non-empty line, reject display names/header breaks, reject case-insensitive duplicates, and reject an alias duplicating the current From address. On save, append:

```ts
if (sanitized.SMTPFromAliases !== initial.SMTPFromAliases) {
  updates.push({
    key: 'SMTPFromAliases',
    value: sanitized.SMTPFromAliases,
  })
}
```

Keep SMTPFrom before SMTPFromAliases in the sequential update list so moving a selected alias into the default sender remains valid. Preserve the current token behavior: blank token never overwrites the existing credential.

- [ ] **Step 5: Run System Settings tests and typecheck**

Run: `bun test src/features/system-settings/integrations/email-settings-section.test.tsx`

Run: `bun run typecheck`

Expected: both PASS.

- [ ] **Step 6: Commit Task 5 using the Lore protocol**

```text
Let administrators maintain authorized From aliases once

Constraint: Operators should not re-enter SMTP credentials for each Activity sender.
Rejected: Free-text sender entry in Activity Configuration | It bypasses provider authorization and repeats configuration work.
Confidence: high
Scope-risk: narrow
Directive: Store aliases comma-separated but present exactly one plain mailbox per line in System Settings.
Tested: email settings component tests and bun run typecheck
```

### Task 6: Add the Activity sender selector and API client

**Files:**
- Modify: `web/default/src/features/recall-campaigns/types.ts:228-245`
- Modify: `web/default/src/features/recall-campaigns/api.ts:1-155`
- Modify: `web/default/src/features/recall-campaigns/api.test.ts`
- Create: `web/default/src/features/recall-campaigns/components/campaign-email-sender-control.tsx`
- Create: `web/default/src/features/recall-campaigns/components/campaign-email-sender-control.test.tsx`
- Modify: `web/default/src/features/recall-campaigns/index.tsx:1-35`
- Modify: `web/default/src/features/recall-campaigns/copy.ts`
- Modify: `web/default/src/features/recall-campaigns/copy.test.ts`

- [ ] **Step 1: Write failing API contract tests**

```ts
await getRecallEmailSenderStatus()
expect(capturedConfig?.method).toBe('get')
expect(capturedConfig?.url).toBe('/api/recall-campaigns/email-sender')

await updateRecallEmailSender('campaigns@example.com')
expect(capturedConfig?.method).toBe('put')
expect(capturedConfig?.url).toBe('/api/recall-campaigns/email-sender')
expect(capturedConfig?.data).toEqual({ email_from: 'campaigns@example.com' })
```

- [ ] **Step 2: Write failing control-state and render tests**

Test default rendering, alias options, save, rollback, load error, and stale edit preservation:

```ts
expect(
  syncRecallEmailSenderFromServer(
    'campaigns@example.com',
    '',
    '',
    ['campaigns@example.com']
  )
).toEqual({ selected: 'campaigns@example.com', confirmed: '' })

expect(rendered).toContain('Default SMTP sender (system@example.com)')
expect(rendered).toContain('<option value="campaigns@example.com">')
```

- [ ] **Step 3: Add client types and functions**

```ts
export interface RecallEmailSenderOption {
  email: string
  is_default: boolean
}

export interface RecallEmailSenderStatus {
  configured_email_from: string
  effective_email_from: string
  uses_default: boolean
  options: RecallEmailSenderOption[]
}

export async function getRecallEmailSenderStatus(): Promise<ApiResponse<RecallEmailSenderStatus>>
export async function updateRecallEmailSender(emailFrom: string): Promise<ApiResponse<RecallEmailSenderStatus>>
```

Add `recallCampaignKeys.emailSender = ['recall-campaigns', 'email-sender']`.

- [ ] **Step 4: Implement the independent selector**

Build `CampaignEmailSenderControl` with `NativeSelect`, a separate save button, its own query/mutation, and no shared form state with the hourly limit. The first option always sends `value=''`:

```tsx
<NativeSelectOption value=''>
  {t('Default SMTP sender ({{email}})', { email: defaultOption.email })}
</NativeSelectOption>
```

On save failure, roll back to the last confirmed value and show the server message. On refetch, update a pristine selection but preserve an unsaved alias that still exists; if an unsaved alias disappeared, roll back and report that sender choices changed.

- [ ] **Step 5: Compose both Activity-wide controls**

Place the sender control and hourly-limit control together in a wrapping actions container before the create button:

```tsx
<div className='flex flex-wrap items-end gap-2'>
  <CampaignEmailSenderControl />
  <CampaignEmailHourlyLimitControl />
</div>
```

The help copy must state that every Activity campaign shares the sender and unrelated system emails are unaffected.

- [ ] **Step 6: Run Activity frontend tests and typecheck**

Run: `bun test src/features/recall-campaigns/api.test.ts src/features/recall-campaigns/components/campaign-email-sender-control.test.tsx src/features/recall-campaigns/copy.test.ts`

Run: `bun run typecheck`

Expected: both PASS.

- [ ] **Step 7: Commit Task 6 using the Lore protocol**

```text
Make the Activity-wide sender selectable beside its quota

Constraint: Sender and hourly limit are independent global Activity settings and must save independently.
Rejected: Adding sender to each campaign editor | It recreates repetitive configuration and changes campaign payloads.
Confidence: high
Scope-risk: narrow
Directive: Use an empty API value for the live default sender and canonical alias values for explicit selection.
Tested: focused Activity API/control/copy tests and bun run typecheck
```

### Task 7: Complete all eight locale translations

**Files:**
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/es.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/pt.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/vi.json`

- [ ] **Step 1: Add the complete English key set**

Register and use these literal keys:

```text
Allowed From aliases
Enter one authorized email address per line.
Aliases must already be authorized by your SMTP provider.
Each alias must be a plain email address.
Sender aliases must be unique.
Sender aliases must not duplicate the From address.
Activity sender address
Default SMTP sender ({{email}})
All Activity Configuration campaigns share this sender. Other system emails are unaffected.
Save sender address
Failed to load sender addresses.
Failed to update sender address.
Sender address choices changed. Review and save again.
```

- [ ] **Step 2: Add real translations in every non-English locale**

Use native translations, preserving only technical literals such as SMTP and email addresses. Do not copy the English sentences into `zh`, `es`, `fr`, `ja`, `pt`, `ru`, or `vi`.

- [ ] **Step 3: Synchronize and verify locale integrity**

Run: `bun run i18n:sync`

Expected: all 8 locales report `0 missing`, `0 extras`, and `0 untranslated`; no newly added key appears in any `src/i18n/locales/_reports/*.untranslated.json`.

- [ ] **Step 4: Commit Task 7 using the Lore protocol**

```text
Make Activity sender controls complete in every console locale

Constraint: The console supports eight locales and untranslated keys silently fall back to English.
Rejected: Shipping English fallback for new controls | It creates a partial operator workflow outside English.
Confidence: high
Scope-risk: narrow
Directive: Keep sender-setting keys synchronized across all eight locale files.
Tested: bun run i18n:sync
```

### Task 8: Full verification, review, PR update, and staging promotion

**Files:**
- Review: all files changed by Tasks 1-7
- Update externally: GitHub PR `SolveaCX/new-api#577`
- Promote: runtime/test commits only to remote `staging`

- [ ] **Step 1: Run backend verification**

Run:

```text
go test ./common/... -count=1
go test ./setting/operation_setting ./model ./controller ./router -run 'Recall|SMTPFromAlias|SMTPFromAliases' -count=1
go test ./service -run 'Recall.*(Email|Worker|Minimum|Promotion|Discount)' -count=1
go build ./...
```

Expected: every command exits 0.

- [ ] **Step 2: Run frontend verification**

From `web/default` run:

```text
bun test src/features/system-settings/integrations/email-settings-section.test.tsx src/features/recall-campaigns
bun run typecheck
bun run i18n:sync
bun run build:check
```

Run ESLint only on changed TS/TSX files and require exit 0. Full-repository lint failures outside the diff are reported separately, not hidden.

- [ ] **Step 3: Verify scope and review the final diff**

Run `git diff --check`, `git status --short`, and `git diff --stat origin/main...HEAD`. Run GitNexus `detect_changes --scope compare --base-ref main` when the index is available; if indexing remains unavailable, record the tool failure and compensate with exact changed-file, caller-search, tests, build, and independent code review evidence.

Perform an independent code review with explicit severity counts and deployment advice. Required release recommendation for this diff:

```text
Router deploy: not required
Reason: changes are limited to console/admin Activity configuration, SMTP sending used by the master recall scheduler, and shared email helpers whose default API remains compatible; relay /v1 traffic is unchanged.
Other deploy targets: newapi-console and staging required; newapi-web, Terraform, and Cloudflare not required.
Risk / validation: verify an authorized alias through staging SMTP plus the no-lease/no-quota invalid-config regression before production.
```

- [ ] **Step 4: Update and push the PR branch safely**

Fetch the remote head, verify the PR source is `fix/recall-account-offer-auto-apply`, rebase only if required by the current PR contract, then push with exact `--force-with-lease=<branch>:<observed-remote-head>` if history was rewritten. Update PR #577 body with:

- optional multi-currency minimum spend (USD/INR/BRL/JPY);
- Activity-only hourly quota;
- global Activity sender alias selection under one SMTP account;
- other system emails unaffected;
- validation commands and known repository-wide lint baseline.

Reply to every actionable review comment with the resolving commit and verification evidence.

- [ ] **Step 5: Promote only runtime/test commits to staging**

Create or reuse an isolated E-drive staging worktree from the latest `origin/staging`. Cherry-pick only Tasks 1-7 runtime/test commits plus the previously verified minimum-spend runtime commits; exclude specification and plan commits. Resolve conflicts on the staging branch, rerun targeted backend/frontend tests and build checks there, then push `staging` normally without force.

- [ ] **Step 6: Confirm the external stop condition**

Confirm:

- PR #577 points to the pushed feature head and shows the updated reasoning trail;
- remote `staging` contains exactly the requested runtime/test changes;
- staging deployment workflow has started or completed successfully;
- no push or merge touched `main`;
- the feature worktree is clean except for documented generated artifacts.
