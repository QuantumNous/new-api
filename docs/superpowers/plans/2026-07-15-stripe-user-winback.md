# Stripe User Winback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build a configurable Stripe-native winback system that selects one of three approved audiences, issues a Customer-bound Promotion Code per eligible user, sends one to three recall emails, auto-applies the code to Stripe Checkout, and attributes paid conversions without introducing any Flatkey-local discount or credit grant.

**Architecture:** Add four GORM-backed recall tables and keep the existing Router → Controller → Service → Model layering. A master-node ticker may trigger work, but database uniqueness, conditional state transitions, deterministic run keys, Stripe idempotency keys, and expiring leases provide multi-node correctness. Coupon, Customer, Promotion Code, Checkout, email, audience, claim, and attribution logic stay behind focused service interfaces so tests use SQLite and fakes without external Stripe or SMTP calls.

**Tech Stack:** Go 1.25, Gin, GORM, SQLite/MySQL/PostgreSQL-compatible schema, stripe-go v81.4.0, existing SMTP mailer, React 19, TypeScript 6, TanStack Router/Query/Table, React Hook Form, Zod 4, Bun.

---

## Scope, invariants, and file decomposition

The implementation is one deployable feature because campaign activation, database state, Stripe issuance, email delivery, Checkout application, and payment attribution must agree on the same claim and Promotion Code contract. It is split into small commits, but the operational feature flag remains off until all tasks are deployed together.

The following invariants apply to every task:

- Stripe owns the discount. Flatkey never changes quota, wallet balance, subscription allowance, or order amount because of a recall campaign.
- A campaign owns one Coupon; each recipient owns one Customer-bound Promotion Code with max_redemptions=1.
- Preview performs main-database and LOG_DB reads plus Stripe GET validation only. It never creates Stripe objects, recipients, messages, or email sends.
- Automatic Checkout application sets Discounts.PromotionCode and leaves AllowPromotionCodes unset. Ordinary Stripe Checkout sets AllowPromotionCodes=true and has no automatic Discounts entry.
- Existing payment fulfillment remains authoritative. Recall attribution runs only after CompleteSubscriptionOrder or RechargeWithPaymentSnapshot succeeds.
- LOG_DB may be separate from DB. Candidate IDs are materialized in the application and queried from LOG_DB in bounded batches; no cross-database JOIN or subquery is allowed.
- The scheduler may run only on the master node for efficiency, but no correctness property depends on that.
- A mail result that may have reached SMTP but was not confirmed becomes uncertain and is never automatically resent.
- Pausing or cancelling prevents new recipients, new codes, and later messages; it never revokes a code already issued by Stripe.
- Promotion Codes, raw claim tokens, unsubscribe signatures, Stripe secrets, and full email bodies are not written to ordinary logs.
- The existing /api/user/recall_candidates endpoint remains unchanged for compatibility.

### New backend files

- **setting/operation_setting/recall_campaign_setting.go** — default-off operational gate.
- **setting/operation_setting/recall_campaign_setting_test.go** — default and config-load behavior.
- **model/recall_campaign.go** — campaign entity, enums, draft/state persistence.
- **model/recall_recipient.go** — recipient entity, uniqueness, state transitions, Customer/Promotion Code persistence.
- **model/recall_message.go** — mail task entity, stage uniqueness, lease acquisition, retry/uncertain transitions.
- **model/recall_event.go** — audit/idempotency entity, transactional run key, metrics aggregation.
- **model/recall_repository_test.go** — migration, uniqueness, state, lease, and event concurrency tests.
- **service/recall_contract.go** — typed campaign, audience, discount, product, recurrence, email, claim, and metrics contracts.
- **service/recall_audience.go** — three template selectors and two-phase LOG_DB activity exclusion.
- **service/recall_audience_test.go** — template boundaries, opt-out, email, payment, subscription, and LOG_DB tests.
- **service/recall_stripe.go** — Stripe interface and real v81 adapter.
- **service/recall_stripe_test.go** — Coupon/Customer/Promotion Code/product validation and retry classification tests.
- **service/recall_campaign.go** — draft validation, preview, activation, immutable-field enforcement, scheduling, snapshot orchestration.
- **service/recall_campaign_test.go** — lifecycle, preview purity, schedule idempotency, and email-version tests.
- **service/recall_claim.go** — secure claim generation/validation, product binding, click recording, and signed unsubscribe.
- **service/recall_claim_test.go** — hash-only storage, expiry, wrong account/product, tamper, and opt-out tests.
- **service/recall_worker.go** — recipient provisioning, Customer recovery, Promotion Code creation, and recipient leases.
- **service/recall_worker_test.go** — idempotency, collision retry, transient/permanent error, and multi-worker tests.
- **service/recall_email.go** — safe template rendering, stop checks, stable Message-ID, send-state transitions.
- **service/recall_email_test.go** — one-to-three stages, language fallback, stop conditions, and uncertain-send tests.
- **service/recall_attribution.go** — post-fulfillment direct/assisted/no-coupon attribution, replay idempotency, metrics, reconciliation.
- **service/recall_attribution_test.go** — priority, currency separation, replay, and reconciliation tests.
- **service/recall_scheduler.go** — master-node tick loop that calls idempotent campaign, recipient, mail, and reconciliation batches.
- **controller/recall_campaign.go** — thin admin and user handlers.
- **controller/recall_campaign_test.go** — payload, feature gate, identity, masking, and no-side-effect controller tests.

### Modified backend files

- **model/main.go:256-383** — register the four new tables in normal and fast migrations.
- **model/user.go:20-95** — persist email_verified_at; retain Stripe Customer updates.
- **dto/user_settings.go:5-24** — add recall_marketing_opt_out.
- **controller/user.go:202-274, 1245-1290, 1346-1530** — record verified email and preserve all existing user settings during updates.
- **common/email.go:20-92** — expose a stable Message-ID path while preserving SendEmail behavior.
- **controller/topup_stripe.go:39-72, 675-686, 855-920, 1650-1745** — accept claim, apply claim metadata/Promotion Code, allow ordinary manual codes, invoke attribution after fulfillment.
- **controller/topup_stripe_test.go:318-352** — replace the old hidden-code assertion and add automatic-code mutual-exclusion cases.
- **controller/subscription_payment_stripe.go:17-141** — accept claim, validate plan Price, set Checkout discount/metadata, allow ordinary manual codes.
- **controller/subscription_payment_stripe_test.go** — cover manual and automatic Promotion Code behavior.
- **model/subscription.go:523-589** — retain Stripe Checkout session metadata in provider payload used by attribution/reconciliation.
- **router/api-router.go:130-235** — add AdminAuth and UserAuth recall routes plus signed anonymous unsubscribe.
- **main.go:139-165** — start the idempotent recall scheduler.

### New frontend files

- **web/default/src/features/recall-campaigns/types.ts** — API and UI types.
- **web/default/src/features/recall-campaigns/schemas.ts** — Zod campaign/editor/search schemas.
- **web/default/src/features/recall-campaigns/schemas.test.ts** — audience, discount, execution, product, and email validation.
- **web/default/src/features/recall-campaigns/api.ts** — typed admin APIs.
- **web/default/src/features/recall-campaigns/index.tsx** — list page.
- **web/default/src/features/recall-campaigns/components/campaign-table.tsx** — metrics and actions.
- **web/default/src/features/recall-campaigns/components/campaign-editor.tsx** — create/edit form.
- **web/default/src/features/recall-campaigns/components/campaign-preview-dialog.tsx** — candidate sample and exclusion counts.
- **web/default/src/features/recall-campaigns/components/campaign-detail.tsx** — recipients, messages, errors, audit timeline, and currency metrics.
- **web/default/src/features/recall-campaigns/components/campaign-action-dialog.tsx** — confirm pause/resume/cancel/complete/retry actions.
- **web/default/src/routes/_authenticated/recall-campaigns/index.tsx** — admin list/create route.
- **web/default/src/routes/_authenticated/recall-campaigns/$campaignId.tsx** — admin detail/edit route.
- **web/default/src/features/wallet/lib/recall-claim.ts** — claim lookup and view-model helpers.
- **web/default/src/features/wallet/lib/recall-claim.test.ts** — query retention and product-scope helpers.

### Modified frontend files

- **web/default/src/features/wallet/types.ts:250-320** — claim request/response fields.
- **web/default/src/features/wallet/lib/stripe-payment-request.ts:22-82** — include recall_claim only for Stripe.
- **web/default/src/features/wallet/lib/stripe-payment-request.test.ts:27-70** — exact request coverage.
- **web/default/src/features/wallet/hooks/use-payment.ts:130-285** — pass the verified claim into Stripe requests.
- **web/default/src/features/wallet/index.tsx:68-150, 625-748** — fetch claim, show status, restrict unsupported presets, pass claim.
- **web/default/src/routes/_authenticated/wallet/index.tsx:23-59** — validate and retain recall_claim search.
- **web/default/src/features/subscriptions/types.ts:82-120** — optional recall_claim.
- **web/default/src/features/subscriptions/components/dialogs/subscription-purchase-dialog.tsx:48-130** — show/apply a claim only to eligible Stripe plans.
- **web/default/src/hooks/use-sidebar-data.ts:20-150** — add Recall Campaigns admin item.
- **web/default/src/hooks/use-sidebar-config.ts:35-115** — add recall_campaigns visibility key.
- **web/default/src/hooks/use-sidebar-data.test.ts** — admin/default/user narrowing tests.
- **web/default/src/i18n/locales/en.json**, **zh.json**, **es.json**, **fr.json**, **pt.json**, **ru.json**, **ja.json**, **vi.json** — real translations for all new user-visible text.
- **web/default/src/routeTree.gen.ts** — regenerated by the TanStack Router plugin during typecheck/build.

## Public contracts locked by the plan

The service contract is defined once in service/recall_contract.go and reused by controllers and tests:

    package service

    type RecallCampaignDraft struct {
        Name                  string                    `json:"name"`
        AudienceTemplate      string                    `json:"audience_template"`
        Audience              RecallAudienceConfig      `json:"audience_config"`
        ExecutionMode         string                    `json:"execution_mode"`
        Schedule              RecallScheduleConfig      `json:"schedule"`
        CouponSource          string                    `json:"coupon_source"`
        ExistingCouponID      string                    `json:"existing_coupon_id"`
        Discount              RecallDiscountConfig      `json:"discount_config"`
        Products              RecallProductScope        `json:"product_scope"`
        PromotionValidSeconds int64                     `json:"promotion_valid_seconds"`
        EnrollmentLimit       int                       `json:"enrollment_limit"`
        WorkerConcurrency     int                       `json:"worker_concurrency"`
        Emails                []RecallEmailStage         `json:"email_sequence"`
    }

    type RecallAudienceConfig struct {
        RegistrationAgeDays      int      `json:"registration_age_days"`
        MinRequestCount           int      `json:"min_request_count"`
        MaxQuota                  int      `json:"max_quota"`
        MinPaidAmount             float64  `json:"min_paid_amount"`
        LastAPICallAgeDays        int      `json:"last_api_call_age_days"`
        LastPaymentAgeDays        int      `json:"last_payment_age_days"`
        SubscriptionExpiredDays   int      `json:"subscription_expired_days"`
        MinSubscriptionAmount     float64  `json:"min_subscription_amount"`
        MinSubscriptionCount      int      `json:"min_subscription_count"`
        PaymentProviders          []string `json:"payment_providers"`
        Groups                    []string `json:"groups"`
        GroupMode                 string   `json:"group_mode"`
        RequireVerifiedEmail      bool     `json:"require_verified_email"`
    }

    type RecallScheduleConfig struct {
        ScheduledAt int64  `json:"scheduled_at"`
        Timezone    string `json:"timezone"`
        Frequency   string `json:"frequency"`
        Weekday     int    `json:"weekday"`
        Hour        int    `json:"hour"`
        Minute      int    `json:"minute"`
    }

    type RecallDiscountConfig struct {
        Type                  string  `json:"type"`
        PercentOff            float64 `json:"percent_off"`
        AmountOff             int64   `json:"amount_off"`
        Currency              string  `json:"currency"`
        MinimumAmount         int64   `json:"minimum_amount"`
        MinimumAmountCurrency string  `json:"minimum_amount_currency"`
        CouponRedeemBy        int64   `json:"coupon_redeem_by"`
    }

    type RecallProductScope struct {
        TopUpPriceIDs        []string `json:"topup_price_ids"`
        SubscriptionPriceIDs []string `json:"subscription_price_ids"`
    }

    type RecallEmailStage struct {
        StageNo         int                            `json:"stage_no"`
        DelaySeconds    int64                          `json:"delay_seconds"`
        TemplateVersion int                            `json:"template_version"`
        Templates       map[string]RecallEmailTemplate `json:"templates"`
    }

    type RecallEmailTemplate struct {
        Subject  string `json:"subject"`
        BodyText string `json:"body_text"`
    }

    type RecallClaimView struct {
        CampaignID          int64                `json:"campaign_id"`
        RecipientID         int64                `json:"recipient_id"`
        CampaignName        string               `json:"campaign_name"`
        PromotionCodeMasked string               `json:"promotion_code_masked"`
        ExpiresAt           int64                `json:"expires_at"`
        Discount            RecallDiscountConfig `json:"discount"`
        Products            RecallProductScope   `json:"products"`
        Redeemed            bool                 `json:"redeemed"`
    }

The accepted enum values are fixed:

- audience_template: first_purchase, lapsed_payer, expired_subscription
- execution_mode: manual, scheduled_once, recurring
- coupon_source: automatic, existing
- discount type: percent, fixed
- recurrence frequency: daily, weekly
- group_mode: allow, block
- campaign state: draft, scheduled, running, paused, cancelled, completed
- recipient state: queued, customer_ready, code_ready, contacting, converted, suppressed, ineligible, expired, failed
- message state: scheduled, leased, accepted, retry_wait, uncertain, failed, cancelled
- conversion_kind: direct, assisted, no_coupon

---

### Task 1: Add the default-off operational gate

**Files:**
- Create: setting/operation_setting/recall_campaign_setting.go
- Create: setting/operation_setting/recall_campaign_setting_test.go

- [ ] **Step 1: Write the failing configuration tests**

    func TestRecallCampaignSettingDefaultsDisabled(t *testing.T) {
        require.False(t, IsRecallCampaignEnabled())
        require.Equal(t, 100, GetRecallCampaignSetting().BatchSize)
        require.Equal(t, 30, GetRecallCampaignSetting().TickSeconds)
    }

    func TestRecallCampaignSettingLoadsRegisteredValues(t *testing.T) {
        cfg := RecallCampaignSetting{}
        err := config.UpdateConfigFromMap(&cfg, map[string]string{
            "enabled": "true",
            "batch_size": "25",
            "tick_seconds": "15",
        })
        require.NoError(t, err)
        require.True(t, cfg.Enabled)
        require.Equal(t, 25, cfg.BatchSize)
        require.Equal(t, 15, cfg.TickSeconds)
        require.NoError(t, cfg.NormalizeAndValidate())
        require.Error(t, (&RecallCampaignSetting{BatchSize: 0, TickSeconds: 30}).NormalizeAndValidate())
    }

- [ ] **Step 2: Run the test and verify the symbols do not exist**

Run: go test ./setting/operation_setting -run RecallCampaignSetting -count=1

Expected: FAIL with undefined: IsRecallCampaignEnabled or undefined: RecallCampaignSetting.

- [ ] **Step 3: Add the registered config with bounded normalization**

    import (
        "fmt"
        "sync"

        "github.com/QuantumNous/new-api/setting/config"
    )

    type RecallCampaignSetting struct {
        Enabled     bool `json:"enabled"`
        BatchSize   int  `json:"batch_size"`
        TickSeconds int  `json:"tick_seconds"`
    }

    var recallCampaignSetting = RecallCampaignSetting{
        Enabled: false, BatchSize: 100, TickSeconds: 30,
    }
    var recallCampaignSettingMu sync.RWMutex

    func (s *RecallCampaignSetting) NormalizeAndValidate() error {
        if s.BatchSize < 1 || s.BatchSize > 1000 {
            return fmt.Errorf("batch_size must be between 1 and 1000")
        }
        if s.TickSeconds < 5 || s.TickSeconds > 3600 {
            return fmt.Errorf("tick_seconds must be between 5 and 3600")
        }
        return nil
    }

    func init() {
        config.GlobalConfig.Register("recall_campaign_setting", &recallCampaignSetting)
        config.GlobalConfig.RegisterUpdateLock("recall_campaign_setting", &recallCampaignSettingMu)
    }

    func GetRecallCampaignSetting() RecallCampaignSetting {
        recallCampaignSettingMu.RLock()
        defer recallCampaignSettingMu.RUnlock()
        return recallCampaignSetting
    }

    func IsRecallCampaignEnabled() bool {
        return GetRecallCampaignSetting().Enabled
    }

- [ ] **Step 4: Run the focused tests**

Run: go test ./setting/operation_setting -run RecallCampaignSetting -count=1

Expected: PASS.

- [ ] **Step 5: Commit the gate**

    git add setting/operation_setting/recall_campaign_setting.go setting/operation_setting/recall_campaign_setting_test.go
    git commit -m "Keep Stripe recall dormant until operators opt in" -m "Constraint: The feature must ship default-off across all nodes." -m "Rejected: Environment-only toggle | Existing registered operation settings are hot-loadable and auditable." -m "Confidence: high" -m "Scope-risk: narrow" -m "Directive: Every recall controller, scheduler, and worker entry point must enforce this gate." -m "Tested: go test ./setting/operation_setting -run RecallCampaignSetting -count=1"

### Task 2: Add cross-database recall persistence and user consent fields

**Files:**
- Create: model/recall_campaign.go
- Create: model/recall_recipient.go
- Create: model/recall_message.go
- Create: model/recall_event.go
- Create: model/recall_repository_test.go
- Modify: model/main.go:256-383
- Modify: model/user.go:20-95
- Modify: dto/user_settings.go:5-24
- Modify: controller/user.go:202-274
- Modify: controller/user.go:1245-1290
- Modify: controller/user.go:1346-1530

- [ ] **Step 1: Write migration and uniqueness tests on SQLite**

The test opens a fresh in-memory SQLite database, temporarily assigns model.DB and model.LOG_DB, migrates User plus the four recall entities, and asserts:

    require.True(t, db.Migrator().HasTable(&RecallCampaign{}))
    require.True(t, db.Migrator().HasTable(&RecallRecipient{}))
    require.True(t, db.Migrator().HasTable(&RecallMessage{}))
    require.True(t, db.Migrator().HasTable(&RecallEvent{}))

    first := RecallRecipient{CampaignId: 7, UserId: 11, State: RecallRecipientQueued}
    require.NoError(t, db.Create(&first).Error)
    duplicate := RecallRecipient{CampaignId: 7, UserId: 11, State: RecallRecipientQueued}
    require.Error(t, db.Create(&duplicate).Error)

    message := RecallMessage{RecipientId: first.Id, StageNo: 1, State: RecallMessageScheduled}
    require.NoError(t, db.Create(&message).Error)
    require.Error(t, db.Create(&RecallMessage{
        RecipientId: first.Id, StageNo: 1, State: RecallMessageScheduled,
    }).Error)

    event := RecallEvent{CampaignId: 7, Source: "stripe", SourceEventId: "evt_1", EventType: "payment"}
    require.NoError(t, db.Create(&event).Error)
    require.Error(t, db.Create(&RecallEvent{
        CampaignId: 7, Source: "stripe", SourceEventId: "evt_1", EventType: "payment",
    }).Error)

- [ ] **Step 2: Run the model test and verify it fails before entities exist**

Run: go test ./model -run RecallRepository -count=1

Expected: FAIL with undefined recall entity or state symbols.

- [ ] **Step 3: Define the four entities with TEXT JSON and nullable Stripe ID uniqueness**

Use int64 Unix seconds and GORM tags. The essential shapes are:

    type RecallCampaign struct {
        Id                    int64  `json:"id"`
        Name                  string `json:"name" gorm:"type:varchar(128);not null"`
        Status                string `json:"status" gorm:"type:varchar(24);index;not null"`
        AudienceTemplate      string `json:"audience_template" gorm:"type:varchar(32);not null"`
        AudienceConfig        string `json:"audience_config" gorm:"type:text;not null"`
        ExecutionMode         string `json:"execution_mode" gorm:"type:varchar(24);not null"`
        ScheduledAt           int64  `json:"scheduled_at" gorm:"index"`
        RecurrenceConfig      string `json:"recurrence_config" gorm:"type:text"`
        NextRunAt             int64  `json:"next_run_at" gorm:"index"`
        CouponSource          string `json:"coupon_source" gorm:"type:varchar(16);not null"`
        StripeCouponId        string `json:"stripe_coupon_id" gorm:"type:varchar(128);index"`
        DiscountConfig        string `json:"discount_config" gorm:"type:text;not null"`
        ProductScope          string `json:"product_scope" gorm:"type:text;not null"`
        PromotionValidSeconds int64  `json:"promotion_valid_seconds"`
        EmailSequenceConfig   string `json:"email_sequence_config" gorm:"type:text;not null"`
        EnrollmentLimit       int    `json:"enrollment_limit"`
        WorkerConcurrency     int    `json:"worker_concurrency"`
        CreatedBy             int    `json:"created_by" gorm:"index"`
        CreatedAt             int64  `json:"created_at" gorm:"autoCreateTime"`
        UpdatedAt             int64  `json:"updated_at" gorm:"autoUpdateTime"`
        ActivatedAt           int64  `json:"activated_at"`
        CompletedAt           int64  `json:"completed_at"`
    }

    type RecallRecipient struct {
        Id                    int64   `json:"id"`
        CampaignId            int64   `json:"campaign_id" gorm:"uniqueIndex:idx_recall_campaign_user,priority:1;index"`
        UserId                int     `json:"user_id" gorm:"uniqueIndex:idx_recall_campaign_user,priority:2;index"`
        EligibilitySnapshot   string  `json:"eligibility_snapshot" gorm:"type:text;not null"`
        EmailSnapshot         string  `json:"email_snapshot" gorm:"type:varchar(254);not null"`
        LanguageSnapshot      string  `json:"language_snapshot" gorm:"type:varchar(16);not null"`
        State                 string  `json:"state" gorm:"type:varchar(24);index;not null"`
        LeaseOwner            string  `json:"-" gorm:"type:varchar(96);index"`
        LeaseExpiresAt        int64   `json:"-" gorm:"index"`
        StripeCustomerId      string  `json:"stripe_customer_id" gorm:"type:varchar(128)"`
        StripePromotionCodeId *string `json:"-" gorm:"type:varchar(128);uniqueIndex"`
        PromotionCode         string  `json:"-" gorm:"type:varchar(64)"`
        PromotionExpiresAt    int64   `json:"promotion_expires_at" gorm:"index"`
        ClaimTokenHash        *string `json:"-" gorm:"type:char(64);uniqueIndex"`
        FirstSentAt           int64   `json:"first_sent_at"`
        LastSentAt            int64   `json:"last_sent_at"`
        ClickedAt             int64   `json:"clicked_at"`
        ConvertedAt           int64   `json:"converted_at"`
        ConversionKind        string  `json:"conversion_kind" gorm:"type:varchar(16)"`
        ConversionTradeNo     string  `json:"conversion_trade_no" gorm:"type:varchar(128);index"`
        ConversionCurrency    string  `json:"conversion_currency" gorm:"type:varchar(8)"`
        ConversionAmount      int64   `json:"conversion_amount"`
        DiscountAmount        int64   `json:"discount_amount"`
        LastErrorCode         string  `json:"last_error_code" gorm:"type:varchar(64)"`
        LastErrorMessage      string  `json:"last_error_message" gorm:"type:varchar(512)"`
        CreatedAt             int64   `json:"created_at" gorm:"autoCreateTime"`
        UpdatedAt             int64   `json:"updated_at" gorm:"autoUpdateTime"`
    }

    type RecallMessage struct {
        Id                int64  `json:"id"`
        RecipientId       int64  `json:"recipient_id" gorm:"uniqueIndex:idx_recall_recipient_stage,priority:1;index"`
        StageNo           int    `json:"stage_no" gorm:"uniqueIndex:idx_recall_recipient_stage,priority:2"`
        TemplateVersion   int    `json:"template_version"`
        TemplateSnapshot  string `json:"-" gorm:"type:text;not null"`
        ScheduledAt       int64  `json:"scheduled_at" gorm:"index"`
        State             string `json:"state" gorm:"type:varchar(24);index;not null"`
        AttemptCount      int    `json:"attempt_count"`
        NextAttemptAt     int64  `json:"next_attempt_at" gorm:"index"`
        LeaseOwner        string `json:"-" gorm:"type:varchar(96);index"`
        LeaseExpiresAt    int64  `json:"-" gorm:"index"`
        ProviderMessageId string `json:"provider_message_id" gorm:"type:varchar(255)"`
        ClaimTokenHash    *string `json:"-" gorm:"type:char(64);uniqueIndex"`
        AcceptedAt        int64  `json:"accepted_at"`
        FailedAt          int64  `json:"failed_at"`
        LastErrorCode     string `json:"last_error_code" gorm:"type:varchar(64)"`
        LastErrorMessage  string `json:"last_error_message" gorm:"type:varchar(512)"`
        CreatedAt         int64  `json:"created_at" gorm:"autoCreateTime"`
        UpdatedAt         int64  `json:"updated_at" gorm:"autoUpdateTime"`
    }

    type RecallEvent struct {
        Id            int64  `json:"id"`
        CampaignId    int64  `json:"campaign_id" gorm:"index"`
        RecipientId   int64  `json:"recipient_id" gorm:"index"`
        EventType      string `json:"event_type" gorm:"type:varchar(48);index;not null"`
        Source         string `json:"source" gorm:"type:varchar(32);uniqueIndex:idx_recall_source_event,priority:1"`
        SourceEventId  string `json:"source_event_id" gorm:"type:varchar(160);uniqueIndex:idx_recall_source_event,priority:2"`
        EventData      string `json:"event_data" gorm:"type:text"`
        CreatedAt      int64  `json:"created_at" gorm:"autoCreateTime;index"`
    }

Register all four types in both migrateDB and migrateDBFast. Do not add them to migrateLOGDB; recall state belongs to the main DB.

- [ ] **Step 4: Persist verified-email and global recall opt-out without dropping existing settings**

Add to User:

    EmailVerifiedAt int64 `json:"email_verified_at" gorm:"default:0;column:email_verified_at;index"`

Add to dto.UserSetting:

    RecallMarketingOptOut bool `json:"recall_marketing_opt_out,omitempty"`

Set EmailVerifiedAt=common.GetTimestamp() when password registration actually validates an email code and when EmailBind succeeds. In UpdateUserSetting, start with existingSettings and overwrite only fields present in that endpoint instead of constructing a new value:

    settings := existingSettings
    settings.NotifyType = req.QuotaWarningType
    settings.QuotaWarningThreshold = req.QuotaWarningThreshold
    settings.UpstreamModelUpdateNotifyEnabled = upstreamModelUpdateNotifyEnabled
    settings.AcceptUnsetRatioModel = req.AcceptUnsetModelRatioModel
    settings.RecordIpLog = req.RecordIpLog

This preserves Language, SidebarModules, BillingPreference, and RecallMarketingOptOut.

- [ ] **Step 5: Add model transition and masking helpers**

Define and test:

    func CreateRecallCampaign(campaign *RecallCampaign) error
    func GetRecallCampaignByID(id int64) (*RecallCampaign, error)
    func UpdateRecallCampaignDraft(campaign *RecallCampaign) error
    func TransitionRecallCampaign(id int64, from []string, to string, fields map[string]any) (bool, error)
    func InsertRecallRecipientsAndRunEvent(campaignID int64, recipients []RecallRecipient, runEvent RecallEvent) (int, error)
    func ListRecallRecipients(campaignID int64, offset int, limit int) ([]RecallRecipient, int64, error)
    func MaskPromotionCode(code string) string

MaskPromotionCode returns the first four and last two characters only when length is greater than eight; otherwise it returns a fixed eight-dot mask.

- [ ] **Step 6: Run model and user-setting tests**

Run: go test ./model ./controller -run "RecallRepository|UpdateUserSettingPreserves|EmailVerified" -count=1

Expected: PASS.

- [ ] **Step 7: Commit schema and consent persistence**

    git add model/recall_campaign.go model/recall_recipient.go model/recall_message.go model/recall_event.go model/recall_repository_test.go model/main.go model/user.go dto/user_settings.go controller/user.go
    git commit -m "Persist recall state without weakening user consent" -m "Constraint: SQLite, MySQL, and PostgreSQL must share one schema and LOG_DB may be separate." -m "Rejected: JSON database columns | TEXT keeps the existing three-database contract." -m "Rejected: Reconstructing user settings | It would erase recall opt-out and unrelated preferences." -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Keep nullable Stripe Promotion Code IDs so unique indexes permit unissued recipients." -m "Tested: go test ./model ./controller -run RecallRepository|UpdateUserSettingPreserves|EmailVerified -count=1"

### Task 3: Implement conditional transitions, leases, and run idempotency

**Files:**
- Modify: model/recall_campaign.go
- Modify: model/recall_recipient.go
- Modify: model/recall_message.go
- Modify: model/recall_event.go
- Modify: model/recall_repository_test.go

- [ ] **Step 1: Write failing race-oriented repository tests**

Cover these exact claims:

    acquired1, err := LeaseRecallMessage(message.Id, "node-a", now, now+60)
    require.NoError(t, err)
    acquired2, err := LeaseRecallMessage(message.Id, "node-b", now, now+60)
    require.NoError(t, err)
    require.True(t, acquired1)
    require.False(t, acquired2)

    recovered, err := LeaseRecallMessage(message.Id, "node-b", now+61, now+121)
    require.NoError(t, err)
    require.True(t, recovered)

Start two goroutines against the same SQLite file-backed test DB and assert exactly one LeaseRecallRecipient call returns true. Also assert InsertRecallRecipientsAndRunEvent called twice with source=scheduler and source_event_id=recurring:7:1721000000 inserts recipients once.

- [ ] **Step 2: Run focused tests and verify the missing methods fail compilation**

Run: go test ./model -run "RecallLease|RecallRunIdempotency|RecallTransition" -count=1

Expected: FAIL with undefined lease/transition functions.

- [ ] **Step 3: Implement select-IDs then conditional-update leasing**

Define:

    func ListDueRecallRecipientIDs(now int64, limit int) ([]int64, error)
    func LeaseRecallRecipient(id int64, owner string, now int64, leaseUntil int64) (bool, error)
    func ReleaseRecallRecipientLease(id int64, owner string) error
    func ListDueRecallMessageIDs(now int64, limit int) ([]int64, error)
    func LeaseRecallMessage(id int64, owner string, now int64, leaseUntil int64) (bool, error)
    func CompleteRecallMessageLease(id int64, owner string, from string, to string, fields map[string]any) (bool, error)

The lease update must include state and expiry predicates:

    result := DB.Model(&RecallMessage{}).
        Where("id = ?", id).
        Where("state IN ?", []string{RecallMessageScheduled, RecallMessageRetryWait, RecallMessageLeased}).
        Where("(lease_expires_at = 0 OR lease_expires_at < ?)", now).
        Updates(map[string]any{
            "state": RecallMessageLeased,
            "lease_owner": owner,
            "lease_expires_at": leaseUntil,
        })

Continue only when result.RowsAffected == 1. Recipient leasing uses the same expiry/owner predicate but preserves the durable recipient state; the lease columns are coordination metadata, not a recipient state.

- [ ] **Step 4: Make scheduler run insertion transactional**

Insert the deterministic RecallEvent first inside one DB transaction with clause.OnConflict{DoNothing: true}. Inspect RowsAffected; zero means another node already owns that run, so return inserted=0 and nil without relying on a unique-violation error that would abort a PostgreSQL transaction. If the event insert succeeds, batch insert recipients with clause.OnConflict{DoNothing: true}, create stage-one messages in the same transaction, then commit:

    eventResult := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&runEvent)
    if eventResult.Error != nil {
        return 0, eventResult.Error
    }
    if eventResult.RowsAffected == 0 {
        return 0, nil
    }

Define:

    func InsertRecallRecipientsAndRunEvent(campaignID int64, recipients []RecallRecipient, messages []RecallMessage, runEvent RecallEvent) (int, error)
    func ScheduleNextRecallStages(recipientID int64, messages []RecallMessage) error
    func CancelPendingRecallMessages(recipientID int64, reasonCode string, now int64) (int64, error)

- [ ] **Step 5: Run repository tests repeatedly**

Run: go test ./model -run "RecallLease|RecallRunIdempotency|RecallTransition" -count=20

Expected: PASS on all 20 runs with one lease winner and no duplicate recipients/messages/events.

- [ ] **Step 6: Commit concurrency primitives**

    git add model/recall_campaign.go model/recall_recipient.go model/recall_message.go model/recall_event.go model/recall_repository_test.go
    git commit -m "Let the database arbitrate every recall race" -m "Constraint: Production runs multiple Go nodes and SMTP lacks exactly-once semantics." -m "Rejected: Process-local locks | They cannot coordinate Cloud Run replicas." -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Workers may act only after a conditional lease update reports one affected row." -m "Tested: go test ./model -run RecallLease|RecallRunIdempotency|RecallTransition -count=20"

### Task 4: Implement the three audience templates with two-phase LOG_DB filtering

**Files:**
- Create: service/recall_contract.go
- Create: service/recall_audience.go
- Create: service/recall_audience_test.go
- Modify: model/recall_recipient.go
- Modify: model/log.go

- [ ] **Step 1: Write failing audience boundary tests**

Create table-driven tests for:

- first_purchase includes an enabled, opted-in, verified-email PLG user old enough, under quota, over request threshold, and with no successful TopUp or subscription payment;
- first_purchase excludes a successful non-Stripe payment because the no-payment rule covers every provider;
- lapsed_payer includes a user meeting minimum paid amount, last-payment age, low-balance, and API inactivity;
- expired_subscription includes a user with a past end_time and no currently active UserSubscription;
- all templates exclude disabled users, empty/invalid email, global opt-out, group mismatch, and a recent LogTypeConsume row;
- LOG_DB is a distinct SQLite database and the test still passes, proving no cross-database query;
- preview returns exclusion counts keyed by payment_exists, recent_api_activity, active_subscription, opted_out, invalid_email, unverified_email, group_filtered, threshold_not_met.

The expected public shape is:

    type RecallAudiencePreview struct {
        EligibleTotal int64                     `json:"eligible_total"`
        Sample        []RecallAudienceCandidate `json:"sample"`
        Exclusions    map[string]int64           `json:"exclusions"`
    }

    type RecallAudienceCandidate struct {
        UserID       int    `json:"user_id"`
        EmailMasked  string `json:"email_masked"`
        Language     string `json:"language"`
        SnapshotJSON string `json:"-"`
    }

- [ ] **Step 2: Run and verify the selector is missing**

Run: go test ./service -run RecallAudience -count=1

Expected: FAIL with undefined RecallAudienceSelector or contract types.

- [ ] **Step 3: Add main-DB fact queries in model**

Define model-only query/result structs and methods so service never receives gorm.DB:

    type RecallCandidateQuery struct {
        Template            string
        Now                 int64
        RegistrationBefore  int64
        MaxQuota            int
        MinRequestCount     int
        MinPaidAmount       float64
        LastPaymentBefore   int64
        SubscriptionBefore  int64
        MinSubscriptionCount int
        Groups              []string
        GroupMode           string
        AfterUserID         int
        Limit               int
    }

    type RecallCandidateFact struct {
        User                    User
        PaidAmount              float64
        LastPaymentAt           int64
        SubscriptionAmount      float64
        SubscriptionCount       int64
        LastSubscriptionEndAt   int64
        HasActiveSubscription   bool
    }

    func ListRecallCandidateFacts(query RecallCandidateQuery) ([]RecallCandidateFact, error)
    func FindRecentlyActiveRecallUserIDs(userIDs []int, since int64, batchSize int) (map[int]struct{}, error)
    func HasRecallPaymentAfter(userID int, after int64) (bool, error)

ListRecallCandidateFacts uses main-DB predicates appropriate to the selected template. FindRecentlyActiveRecallUserIDs loops userIDs in batches no larger than batchSize and runs only:

    LOG_DB.Model(&Log{}).
        Where("type = ?", LogTypeConsume).
        Where("created_at >= ?", since).
        Where("user_id IN ?", batch).
        Distinct("user_id").
        Pluck("user_id", &found)

- [ ] **Step 4: Implement selector validation and application-side exclusions**

Define:

    type RecallAudienceSelector struct {
        MainBatchSize int
        LogBatchSize  int
    }

    func NewRecallAudienceSelector() *RecallAudienceSelector
    func (s *RecallAudienceSelector) Preview(ctx context.Context, draft RecallCampaignDraft, sampleSize int, now time.Time) (RecallAudiencePreview, error)
    func (s *RecallAudienceSelector) Snapshot(ctx context.Context, draft RecallCampaignDraft, limit int, now time.Time) ([]model.RecallRecipient, map[string]int64, error)
    func ValidateRecallAudience(template string, cfg RecallAudienceConfig) error

Snapshot and Preview call one internal iterator so eligibility rules cannot drift. Parse User.GetSetting() in application code to enforce RecallMarketingOptOut. Require EmailVerifiedAt>0 only when RequireVerifiedEmail is true. Use net/mail ParseAddress and require the parsed address exactly matches the stored address after trimming. Language preference is UserSetting.Language, then the primary BrowserLang tag, then en.

- [ ] **Step 5: Run focused tests**

Run: go test ./service -run RecallAudience -count=1

Expected: PASS, including the separate LOG_DB case.

- [ ] **Step 6: Commit audience selection**

    git add service/recall_contract.go service/recall_audience.go service/recall_audience_test.go model/recall_recipient.go model/log.go
    git commit -m "Select recall audiences without crossing database boundaries" -m "Constraint: API consumption logs can live in a separate LOG_DB." -m "Rejected: Main-DB subquery inside LOG_DB | It becomes an invalid cross-database reference." -m "Rejected: General rule engine | Version one has exactly three approved templates." -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Preview and activation must share the same selector and exclusion codes." -m "Tested: go test ./service -run RecallAudience -count=1"

### Task 5: Build the Stripe recall adapter and product-scope validation

**Files:**
- Create: service/recall_stripe.go
- Create: service/recall_stripe_test.go
- Modify: model/subscription.go

- [ ] **Step 1: Write fake-client tests for every Stripe object contract**

The interface is:

    type RecallStripeClient interface {
        CreateCoupon(context.Context, *stripe.CouponParams) (*stripe.Coupon, error)
        GetCoupon(context.Context, string) (*stripe.Coupon, error)
        CreateCustomer(context.Context, *stripe.CustomerParams) (*stripe.Customer, error)
        GetCustomer(context.Context, string) (*stripe.Customer, error)
        CreatePromotionCode(context.Context, *stripe.PromotionCodeParams) (*stripe.PromotionCode, error)
        GetPromotionCode(context.Context, string) (*stripe.PromotionCode, error)
        GetPrice(context.Context, string) (*stripe.Price, error)
        GetCheckoutSession(context.Context, string, ...string) (*stripe.CheckoutSession, error)
    }

Tests assert:

- percent Coupon sets PercentOff, Duration=once, AppliesTo.Products, RedeemBy, metadata, and no AmountOff/Currency;
- fixed Coupon sets AmountOff/Currency and no PercentOff;
- existing Coupon rejects deleted, invalid, expired, wrong duration, wrong currency, insufficient max redemption capacity, and product mismatch;
- top-up Price must be one_time, subscription Price must be recurring, and inactive/deleted Prices fail;
- two selected Prices sharing one Product fail when they cross the top-up/subscription boundary or when only one Price under that Product is selected from a configured set;
- Customer params include flatkey_user_id and deterministic idempotency key recall_customer:<userID>;
- Promotion Code params include Coupon, Customer, code, ExpiresAt, MaxRedemptions=1, minimum restriction, metadata, and idempotency key recall_promotion:<campaignID>:<recipientID>;
- Stripe 429/5xx/timeouts classify retryable; invalid_request and missing objects classify permanent; an unknown result after an idempotent Stripe create remains retryable with the same key.

- [ ] **Step 2: Run and verify the adapter symbols are absent**

Run: go test ./service -run RecallStripe -count=1

Expected: FAIL with undefined RecallStripeClient or NewStripeRecallClient.

- [ ] **Step 3: Implement the real v81 adapter**

Use coupon.New/Get, customer.New/Get, promotioncode.New/Get, price.Get, and checkout/session.Get. For every call set stripe.Key from setting.StripeApiSecret and params.Context=ctx. GetCheckoutSession adds each requested expansion through params.AddExpand. Create calls receive SetIdempotencyKey before invoking Stripe.

Define:

    type StripeRecallClient struct{}
    func NewStripeRecallClient() RecallStripeClient

    type RecallStripeService struct {
        client RecallStripeClient
        codeGenerator func(int) (string, error)
    }

    func NewRecallStripeService(client RecallStripeClient) *RecallStripeService
    func (s *RecallStripeService) ValidateAndResolveProducts(ctx context.Context, scope RecallProductScope) (RecallResolvedProductScope, error)
    func (s *RecallStripeService) EnsureCoupon(ctx context.Context, campaignID int64, source string, existingID string, discount RecallDiscountConfig, products RecallResolvedProductScope, enrollmentLimit int) (*stripe.Coupon, RecallDiscountConfig, error)
    func (s *RecallStripeService) EnsureCustomer(ctx context.Context, user model.User) (*stripe.Customer, error)
    func (s *RecallStripeService) CreateRecipientPromotion(ctx context.Context, campaign model.RecallCampaign, recipient model.RecallRecipient, user model.User, coupon *stripe.Coupon, discount RecallDiscountConfig) (*stripe.PromotionCode, error)

RecallResolvedProductScope contains the original top-up/subscription Price IDs and a de-duplicated ProductIDs slice.

ValidateAndResolveProducts also loads every currently configured Stripe top-up Price ID from setting.StripeTopUpPriceIds/StripePriceId and every enabled SubscriptionPlan.StripePriceId through model.ListRecallStripeSubscriptionPrices(). It resolves those configured Prices to Products and rejects a selected scope when an unselected configured Price shares a selected Product, or when one Product crosses the top-up/subscription boundary, because Stripe cannot constrain a Coupon to only one Price under that Product.

- [ ] **Step 4: Generate collision-resistant human-enterable codes**

Use common.GenerateRandomCharsKey with an alphabet-safe post-processing step that removes ambiguous characters and prefixes FK. Retry a Stripe duplicate-code error at most five times with a fresh code. The idempotency key is recall_promotion:<campaignID>:<recipientID>:<attempt>; transient retries reuse the same attempt/key, while a confirmed code collision increments attempt and uses the new derived key. Before any attempt, first check whether the recipient already has a Stripe Promotion Code ID. Never fall back to a shared code.

- [ ] **Step 5: Run focused tests**

Run: go test ./service -run RecallStripe -count=1

Expected: PASS.

- [ ] **Step 6: Commit Stripe isolation**

    git add service/recall_stripe.go service/recall_stripe_test.go model/subscription.go
    git commit -m "Make Stripe the sole authority for recall discounts" -m "Constraint: Coupon scope is Product-based while Flatkey configuration starts from Price IDs." -m "Rejected: Local discount calculation | Stripe Checkout must determine the final amount." -m "Rejected: Shared Promotion Code | Each recipient must be Customer-bound and single-use." -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Create calls retain deterministic idempotency keys across retryable failures." -m "Tested: go test ./service -run RecallStripe -count=1"

### Task 6: Implement campaign validation, preview, activation, and scheduling

**Files:**
- Create: service/recall_campaign.go
- Create: service/recall_campaign_test.go
- Create: service/recall_scheduler.go
- Modify: service/recall_contract.go
- Modify: model/recall_campaign.go
- Modify: model/recall_event.go
- Modify: main.go:139-165

- [ ] **Step 1: Write lifecycle and preview-purity tests**

Use fake audience and Stripe services with call counters. Assert:

- SaveDraft accepts only valid enums, 1-3 unique stage numbers, stage 1 delay=0, increasing delays, non-empty English templates, positive PromotionValidSeconds, bounded EnrollmentLimit/WorkerConcurrency, IANA timezone, daily/weekly recurrence fields, and product scope with at least one Price;
- Preview invokes audience Preview and Stripe GET validation, but zero CreateCoupon/CreateCustomer/CreatePromotionCode/email calls and zero recipient/message rows;
- activating manual creates/validates one Coupon, transitions draft→running, recomputes the audience, and transactionally snapshots recipients/messages;
- scheduled_once transitions draft→scheduled and does not snapshot before ScheduledAt;
- recurring computes NextRunAt and repeated due-run calls with the same recurring:<campaignID>:<nextRunUnix> event insert recipients once;
- activated campaigns reject edits to audience, Coupon, discount, scope, and validity, while an email text update increments TemplateVersion for only future messages;
- pause/resume/cancel/complete transitions are conditional and idempotent;
- cancel changes scheduled/retry_wait messages to cancelled and leaves recipient Promotion Code data untouched;
- all entry points return ErrRecallDisabled when the operational flag is false.

- [ ] **Step 2: Run and verify orchestration methods do not exist**

Run: go test ./service -run RecallCampaign -count=1

Expected: FAIL with undefined RecallCampaignService.

- [ ] **Step 3: Implement the campaign service**

    type RecallCampaignService struct {
        audience *RecallAudienceSelector
        stripe   *RecallStripeService
        now      func() time.Time
    }

    func NewRecallCampaignService(audience *RecallAudienceSelector, stripeService *RecallStripeService) *RecallCampaignService
    func (s *RecallCampaignService) SaveDraft(ctx context.Context, actorID int, draft RecallCampaignDraft) (*model.RecallCampaign, error)
    func (s *RecallCampaignService) UpdateDraft(ctx context.Context, actorID int, id int64, draft RecallCampaignDraft) (*model.RecallCampaign, error)
    func (s *RecallCampaignService) Preview(ctx context.Context, id int64, sampleSize int) (RecallAudiencePreview, RecallStripePreview, error)
    func (s *RecallCampaignService) Activate(ctx context.Context, actorID int, id int64) error
    func (s *RecallCampaignService) Pause(ctx context.Context, actorID int, id int64) error
    func (s *RecallCampaignService) Resume(ctx context.Context, actorID int, id int64) error
    func (s *RecallCampaignService) Cancel(ctx context.Context, actorID int, id int64) error
    func (s *RecallCampaignService) Complete(ctx context.Context, actorID int, id int64) error
    func (s *RecallCampaignService) RunDueCampaigns(ctx context.Context, now time.Time, limit int) (int, error)

All JSON marshaling uses common.Marshal/common.Unmarshal. Validate before persistence. Activation stores the normalized existing Coupon attributes returned by Stripe so the active campaign snapshot matches Stripe reality.

Introduce the runtime incrementally so this commit compiles before recipient/mail/attribution workers exist:

    type RecallRuntime struct {
        Campaigns *RecallCampaignService
    }

    func GetRecallRuntime() *RecallRuntime

This task constructs Campaigns from the real audience and Stripe services. Tasks 7, 8, 9, and 11 add Claims, Recipients, Emails, and Attribution fields and update the same constructor.

- [ ] **Step 4: Implement deterministic daily/weekly recurrence**

Define:

    func NextRecallRun(after time.Time, cfg RecallScheduleConfig) (time.Time, error)

Load cfg.Timezone with time.LoadLocation. Daily schedules use the next local Hour:Minute; weekly schedules additionally require Weekday in 0-6. Convert to UTC Unix seconds for storage. No cron expression is accepted.

- [ ] **Step 5: Add scheduler startup**

    func StartRecallCampaignTasks() {
        recallSchedulerOnce.Do(func() {
            if !common.IsMasterNode {
                return
            }
            gopool.Go(func() {
                ticker := time.NewTicker(time.Duration(
                    operation_setting.GetRecallCampaignSetting().TickSeconds,
                ) * time.Second)
                defer ticker.Stop()
                RunRecallMaintenanceTick(context.Background())
                for range ticker.C {
                    RunRecallMaintenanceTick(context.Background())
                }
            })
        })
    }

RunRecallMaintenanceTick first checks IsRecallCampaignEnabled and returns without reads or writes when false; keeping the master ticker alive permits a registered setting update to enable or disable the feature without restarting the process. In this commit it invokes only GetRecallRuntime().Campaigns.RunDueCampaigns, so the code compiles and the scheduler is useful before later worker types are added. Tasks 8, 9, and 11 append recipient, message, and reconciliation batch calls in that order. Each downstream operation is idempotent; a panic/error is logged without secrets and does not terminate later ticks. Call service.StartRecallCampaignTasks() next to StartSubscriptionQuotaResetTask() in main.go.

- [ ] **Step 6: Run lifecycle tests**

Run: go test ./service -run "RecallCampaign|NextRecallRun" -count=1

Expected: PASS.

- [ ] **Step 7: Commit campaign orchestration**

    git add service/recall_campaign.go service/recall_campaign_test.go service/recall_scheduler.go service/recall_contract.go model/recall_campaign.go model/recall_event.go main.go
    git commit -m "Turn approved recall drafts into idempotent scheduled work" -m "Constraint: Recurrence supports daily or weekly local time, not arbitrary cron." -m "Rejected: Synchronous HTTP batch execution | Stripe and SMTP work must survive request and process failure." -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Master-only scheduling is an optimization; unique run events remain the correctness boundary." -m "Tested: go test ./service -run RecallCampaign|NextRecallRun -count=1"

### Task 7: Implement hash-only claims, observed clicks, and signed global unsubscribe

**Files:**
- Create: service/recall_claim.go
- Create: service/recall_claim_test.go
- Modify: service/recall_contract.go
- Modify: model/recall_recipient.go
- Modify: model/recall_event.go

- [ ] **Step 1: Write claim security tests**

Assert:

- IssueClaim returns a random 48-character token for one leased message, stores only hex(SHA-256(token)) on that message, and copies the first stage hash to the recipient lookup field;
- ValidateClaim succeeds only for the recipient user, active/non-terminal Promotion Code, unexpired code, enabled feature, and selected Price;
- wrong user, unknown token, expired code, converted/suppressed recipient, wrong top-up Price, wrong subscription Price, and disabled feature fail with typed errors;
- first validation sets ClickedAt and inserts an observed_click event; repeated validation is idempotent;
- generated unsubscribe token can opt out without login, modification of payload/signature fails, expiry fails, and success sets RecallMarketingOptOut while cancelling pending messages for all campaigns;
- neither API view contains raw PromotionCode or ClaimTokenHash.

- [ ] **Step 2: Run and verify the claim service is absent**

Run: go test ./service -run RecallClaim -count=1

Expected: FAIL with undefined RecallClaimService.

- [ ] **Step 3: Implement claim hashing and constant-time lookup**

    type RecallClaimService struct {
        now func() time.Time
        random func(int) (string, error)
    }

    func NewRecallClaimService() *RecallClaimService
    func (s *RecallClaimService) IssueClaim(ctx context.Context, campaignID int64, recipientID int64, messageID int64) (string, error)
    func (s *RecallClaimService) ValidateClaim(ctx context.Context, userID int, rawToken string, priceID string, purchaseKind string) (RecallClaimView, error)
    func (s *RecallClaimService) BuildCheckoutDiscount(ctx context.Context, userID int, rawToken string, priceID string, purchaseKind string) (*RecallCheckoutDiscount, error)

Hash with:

    func hashRecallToken(token string) string {
        return hex.EncodeToString(common.Sha256Raw([]byte(token)))
    }

Lookup by the hash through the recipient first-stage hash or any recall_messages.claim_token_hash, then compare the stored hash and computed hash with subtle.ConstantTimeCompare. Bind validation to recipient.UserId and campaign ProductScope. This per-message hash design lets every stage create its raw token immediately before SMTP without persisting plaintext, while links from earlier accepted stages remain valid. RecallCheckoutDiscount contains RecipientID, CampaignID, PromotionCodeID, and metadata values; it never exposes the raw code.

Add Claims *RecallClaimService to RecallRuntime and construct it in GetRecallRuntime. No scheduler call is added for claims; recipient mail and Checkout paths invoke it explicitly.

- [ ] **Step 4: Implement HMAC-signed unsubscribe tokens**

Use a compact payload containing version, user ID, and expiry, serialized with common.Marshal, base64.RawURLEncoding, and signed by common.GenerateHMACWithKey([]byte(common.CryptoSecret), encodedPayload). Verify with hmac.Equal. Define:

    func (s *RecallClaimService) CreateUnsubscribeToken(userID int, expiresAt int64) (string, error)
    func (s *RecallClaimService) Unsubscribe(ctx context.Context, signedToken string) error

Add model.SetRecallMarketingOptOut(userID int, optOut bool) error. It runs in a transaction, locks the User row with clause.Locking{Strength:"UPDATE"} on MySQL/PostgreSQL (SQLite write transactions serialize the update), parses the latest UserSetting, changes only RecallMarketingOptOut, marshals through common.Marshal, and updates only the setting column. The user ID has integrity protection and the endpoint never accepts an email address or replacement identity from the link.

- [ ] **Step 5: Run claim tests**

Run: go test ./service -run RecallClaim -count=1

Expected: PASS.

- [ ] **Step 6: Commit claim security**

    git add service/recall_claim.go service/recall_claim_test.go service/recall_contract.go model/recall_recipient.go model/recall_event.go
    git commit -m "Bind every recall claim to one account and product scope" -m "Constraint: Email links can be forwarded and click scanners can open them." -m "Rejected: Storing raw claim tokens | Database disclosure would create usable Checkout links." -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: A click is observational only; paid Stripe fulfillment is the conversion authority." -m "Tested: go test ./service -run RecallClaim -count=1"

### Task 8: Provision Stripe Customers and per-recipient Promotion Codes

**Files:**
- Create: service/recall_worker.go
- Create: service/recall_worker_test.go
- Modify: service/recall_scheduler.go
- Modify: model/recall_recipient.go
- Modify: model/user.go

- [ ] **Step 1: Write worker tests with fake Stripe**

Assert:

- existing non-deleted Stripe Customer is reused;
- deleted/missing Customer creates a new Customer with the account email, writes User.StripeCustomer through a conditional update, and writes recipient.StripeCustomerId;
- two worker instances competing for one recipient produce one Promotion Code;
- a successful Stripe response is persisted before state advances to code_ready;
- an existing StripePromotionCodeId is fetched/reconciled rather than recreated;
- transient Stripe errors release the lease, keep the prior durable state, and set a bounded retry time;
- permanent Customer/Promotion errors enter failed only for that recipient;
- code collision retries with a new code at most five times;
- pause/cancel detected after lease prevents a new external call;
- stage-one message is scheduled only after code_ready; raw claim creation is deferred until that message is leased for sending;
- logs contain IDs/error classes but no full code, token, secret, or email body.

- [ ] **Step 2: Run and verify the worker is missing**

Run: go test ./service -run RecallWorker -count=1

Expected: FAIL with undefined RecallRecipientWorker.

- [ ] **Step 3: Implement conditional Customer write-back**

Add:

    func SetUserStripeCustomerIfEmptyOrMatches(userID int, expected string, replacement string) (bool, error)
    func GetRecallRecipientForLease(id int64, owner string) (*RecallRecipient, error)
    func AdvanceRecallRecipient(id int64, owner string, from []string, to string, fields map[string]any) (bool, error)

The user update predicate is id=? AND (stripe_customer='' OR stripe_customer=?). If another node stored a different valid Customer first, reload the user and use that Customer after Stripe validation.

- [ ] **Step 4: Implement recipient processing**

    type RecallRecipientWorker struct {
        stripe *RecallStripeService
        claims *RecallClaimService
        now func() time.Time
        owner string
    }

    func NewRecallRecipientWorker(stripeService *RecallStripeService, claims *RecallClaimService, owner string) *RecallRecipientWorker
    func (w *RecallRecipientWorker) RunBatch(ctx context.Context, limit int) (int, error)
    func (w *RecallRecipientWorker) ProcessLeased(ctx context.Context, recipientID int64) error

Processing order is queued → customer_ready → code_ready → contacting. A lease may be held during any non-terminal step without changing that durable state. Before each external call, reload campaign state and feature flag. Stripe idempotency keys are campaign/user for Customer and campaign/recipient/attempt for Promotion Code.

Add Recipients *RecallRecipientWorker to RecallRuntime, construct it with common.GetReplicaID() as owner, and call Recipients.RunBatch after due campaigns in RunRecallMaintenanceTick.

- [ ] **Step 5: Run worker tests repeatedly**

Run: go test ./service -run RecallWorker -count=20

Expected: PASS on all runs; fake counters show one code creation.

- [ ] **Step 6: Commit provisioning**

    git add service/recall_worker.go service/recall_worker_test.go service/recall_scheduler.go model/recall_recipient.go model/user.go
    git commit -m "Issue one recoverable Stripe code per recall recipient" -m "Constraint: Customer and Promotion Code calls can finish after a node loses its lease." -m "Rejected: Campaign-wide failure on one user | Recipient errors must remain isolated." -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Persist external object IDs before advancing local state." -m "Tested: go test ./service -run RecallWorker -count=20"

### Task 9: Send versioned email stages with stable Message-ID and stop checks

**Files:**
- Modify: common/email.go:20-92
- Create: common/email_test.go
- Create: service/recall_email.go
- Create: service/recall_email_test.go
- Modify: service/recall_scheduler.go
- Modify: model/recall_message.go
- Modify: model/recall_recipient.go

- [ ] **Step 1: Lock existing email behavior and the new stable ID path**

Extract a pure builder and test header injection resistance:

    func TestBuildEmailMessageUsesProvidedMessageID(t *testing.T) {
        msg, err := buildEmailMessage("Subject", "user@example.com", "<p>Body</p>", "<recall-9-1@example.com>")
        require.NoError(t, err)
        require.Contains(t, string(msg), "Message-ID: <recall-9-1@example.com>")
    }

    func TestBuildEmailMessageRejectsHeaderNewlines(t *testing.T) {
        _, err := buildEmailMessage("ok\r\nBcc: x@example.com", "user@example.com", "body", "<id@example.com>")
        require.Error(t, err)
    }

Keep SendEmail(subject, receiver, content) unchanged for callers, but delegate to:

    func SendEmailWithMessageID(subject string, receiver string, content string, messageID string) error
    func IsEmailSendUncertain(err error) bool

Add an unexported emailSendError carrying Uncertain bool and Unwrap() error. Authentication, MAIL FROM, RCPT TO, and failure to enter DATA are definite failures. A write/close/connection error after DATA begins is uncertain. The existing non-TLS smtp.SendMail path does not expose phases, so any error from that call is conservatively uncertain. Existing callers still receive an ordinary error through the unchanged SendEmail signature.

- [ ] **Step 2: Write message-worker tests**

Inject:

    type RecallEmailSender func(subject string, receiver string, content string, messageID string) error

Test:

- stage count is 1-3 and scheduled relative to first send;
- each queued message stores TemplateSnapshot and TemplateVersion;
- language chooses exact snapshot language, then en;
- renderer escapes name/body data and inserts masked-safe code display, expiry, product summary, claim button, and unsubscribe URL;
- each leased send generates a new raw claim, stores only its message hash, and uses that raw value in the rendered link;
- a definite pre-accept failure may replace that message hash with a fresh token on retry because no message was accepted; uncertain/accepted messages retain their hash and are never auto-resubmitted;
- stable ID is <recall-<recipientID>-<stageNo>@<SMTP domain>>;
- accepted sets accepted state/timestamps and schedules the next stage exactly once;
- opt-out, payment after enrollment, API activity after enrollment, converted/expired Promotion Code, disabled user/email, and paused/cancelled campaign cancel remaining messages;
- a definitely transient pre-accept SMTP error enters retry_wait with bounded exponential backoff;
- common.IsEmailSendUncertain classifies errors after DATA begins; such an error enters uncertain and is not selected by ListDueRecallMessageIDs;
- manual retry permits failed, not uncertain, unless the admin explicitly sets acknowledge_uncertain=true.

- [ ] **Step 3: Run and verify missing methods**

Run: go test ./common ./service -run "EmailMessage|RecallEmail" -count=1

Expected: FAIL until SendEmailWithMessageID and RecallEmailWorker exist.

- [ ] **Step 4: Implement safe rendering and stop checks**

    type RecallEmailWorker struct {
        sender RecallEmailSender
        audience *RecallAudienceSelector
        claims *RecallClaimService
        now func() time.Time
        owner string
    }

    func NewRecallEmailWorker(sender RecallEmailSender, audience *RecallAudienceSelector, claims *RecallClaimService, owner string) *RecallEmailWorker
    func (w *RecallEmailWorker) RunBatch(ctx context.Context, limit int) (int, error)
    func (w *RecallEmailWorker) ProcessLeased(ctx context.Context, messageID int64) error
    func RenderRecallEmail(input RecallEmailRenderInput) (subject string, htmlBody string, err error)

Use html.EscapeString for all stored/user fields. Convert BodyText line breaks to paragraphs. The service owns the HTML button; campaign editors cannot insert arbitrary HTML/script. After the message lease is acquired and all stop checks pass, call IssueClaim for that message, persist its hash, render with the raw token in memory, and call the sender. Query payment state from main DB and activity state from batched LOG_DB helpers.

Add Emails *RecallEmailWorker to RecallRuntime, inject common.SendEmailWithMessageID, and call Emails.RunBatch after Recipients.RunBatch in RunRecallMaintenanceTick.

- [ ] **Step 5: Run mail tests**

Run: go test ./common ./service -run "EmailMessage|RecallEmail" -count=1

Expected: PASS.

- [ ] **Step 6: Commit email sequencing**

    git add common/email.go common/email_test.go service/recall_email.go service/recall_email_test.go service/recall_scheduler.go model/recall_message.go model/recall_recipient.go
    git commit -m "Stop recall email as soon as the user has returned" -m "Constraint: SMTP acceptance can be uncertain and cannot be made exactly-once." -m "Rejected: Automatic resend after uncertain outcome | It can duplicate customer mail." -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Metrics call SMTP-confirmed messages accepted, never delivered." -m "Tested: go test ./common ./service -run EmailMessage|RecallEmail -count=1"

### Task 10: Apply claims to Stripe top-up and subscription Checkout

**Files:**
- Modify: controller/topup_stripe.go:39-72
- Modify: controller/topup_stripe.go:675-686
- Modify: controller/topup_stripe.go:1650-1745
- Modify: controller/topup_stripe_test.go:318-352
- Modify: controller/subscription_payment_stripe.go:17-141
- Create: controller/subscription_payment_stripe_test.go
- Modify: service/recall_claim.go

- [ ] **Step 1: Replace the old Checkout assumption with failing mutual-exclusion tests**

Top-up tests:

    params := buildStripeCheckoutSessionParams(..., nil)
    require.NotNil(t, params.AllowPromotionCodes)
    require.True(t, *params.AllowPromotionCodes)
    require.Empty(t, params.Discounts)

    discount := &service.RecallCheckoutDiscount{
        PromotionCodeID: "promo_user_1",
        CampaignID: 7,
        RecipientID: 9,
    }
    params = buildStripeCheckoutSessionParams(..., discount)
    require.Nil(t, params.AllowPromotionCodes)
    require.Equal(t, "promo_user_1", *params.Discounts[0].PromotionCode)
    require.Equal(t, "7", params.Metadata["recall_campaign_id"])
    require.Equal(t, "9", params.Metadata["recall_recipient_id"])

Subscription tests assert the same two modes and reject a top-up-only claim for a subscription Price.

- [ ] **Step 2: Run tests and verify the old hidden-code assertion fails**

Run: go test ./controller -run "StripeCheckoutSession.*Promotion|SubscriptionStripe.*Promotion" -count=1

Expected: FAIL because ordinary Checkout currently leaves AllowPromotionCodes nil and subscription has no claim parameter.

- [ ] **Step 3: Extend request types only for Stripe**

    type StripePayRequest struct {
        // existing fields remain unchanged
        RecallClaim string `json:"recall_claim,omitempty"`
    }

    type SubscriptionStripePayRequest struct {
        PlanId      int    `json:"plan_id"`
        RecallClaim string `json:"recall_claim,omitempty"`
    }

Non-Stripe payment DTOs and handlers are unchanged. Frontend types do not offer recall_claim to them.

- [ ] **Step 4: Resolve claims immediately before Checkout creation**

For top-up use the resolved Stripe Price ID from resolveStripeTopUpCheckout. For subscription use plan.StripePriceId. Call:

    discount, err := service.GetRecallRuntime().Claims.BuildCheckoutDiscount(
        c.Request.Context(), userId, req.RecallClaim, priceID, purchaseKind,
    )

An empty claim returns nil,nil. A non-empty invalid claim returns a user-safe error and does not create Checkout.

Change builders to:

    func buildStripeCheckoutSessionParams(..., submitMessage string, recall *service.RecallCheckoutDiscount) *stripe.CheckoutSessionParams
    func genStripeSubscriptionLink(referenceID string, customerID string, email string, priceID string, recall *service.RecallCheckoutDiscount) (string, error)

Apply:

    if recall == nil {
        params.AllowPromotionCodes = stripe.Bool(true)
    } else {
        params.Discounts = []*stripe.CheckoutSessionDiscountParams{{
            PromotionCode: stripe.String(recall.PromotionCodeID),
        }}
        params.Metadata = map[string]string{
            "recall_campaign_id": strconv.FormatInt(recall.CampaignID, 10),
            "recall_recipient_id": strconv.FormatInt(recall.RecipientID, 10),
        }
    }

Do not set both fields.

- [ ] **Step 5: Run Checkout tests**

Run: go test ./controller -run "StripeCheckoutSession.*Promotion|SubscriptionStripe.*Promotion" -count=1

Expected: PASS.

- [ ] **Step 6: Commit Checkout behavior**

    git add controller/topup_stripe.go controller/topup_stripe_test.go controller/subscription_payment_stripe.go controller/subscription_payment_stripe_test.go service/recall_claim.go
    git commit -m "Apply recall codes only inside Stripe Checkout" -m "Constraint: Stripe forbids combining an automatic discount with allow_promotion_codes." -m "Rejected: Local order discount | It would diverge from Stripe's charged amount." -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Ordinary Checkout keeps manual Promotion Code entry; claim Checkout uses Discounts only." -m "Tested: go test ./controller -run StripeCheckoutSession.*Promotion|SubscriptionStripe.*Promotion -count=1"

### Task 11: Attribute successful payments after authoritative fulfillment

**Files:**
- Create: service/recall_attribution.go
- Create: service/recall_attribution_test.go
- Modify: service/recall_scheduler.go
- Modify: model/recall_recipient.go
- Modify: model/recall_event.go
- Modify: model/topup.go
- Modify: model/subscription.go:523-589
- Modify: controller/topup_stripe.go:855-920

- [ ] **Step 1: Write attribution priority and replay tests**

Build stripe.CheckoutSession fixtures containing Discounts and TotalDetails.Breakdown.Discounts. Assert:

- an actual Promotion Code ID matching a recipient records direct even without claim metadata;
- valid claim metadata plus successful payment but no matching code records assisted when another discount applies, or no_coupon when no discount applies;
- observed click without successful fulfillment records no conversion;
- amount/currency/TotalDetails.AmountDiscount and trade number are stored;
- evt_123 replay creates one RecallEvent and one recipient transition;
- a second successful order cannot overwrite the first converted terminal record;
- metrics group USD and JPY separately and never add their minor amounts together;
- reconciliation fetches successful Stripe order session IDs after recipient creation and repairs recall state only; it does not call CompleteSubscriptionOrder or RechargeWithPaymentSnapshot.

- [ ] **Step 2: Run and verify attribution symbols are absent**

Run: go test ./service -run RecallAttribution -count=1

Expected: FAIL with undefined RecallAttributionService.

- [ ] **Step 3: Implement parsing from the verified Stripe event**

    type RecallPaymentFact struct {
        SourceEventID    string
        CheckoutSessionID string
        TradeNo         string
        UserID          int
        AmountTotal     int64
        Currency        string
        DiscountAmount  int64
        PromotionCodeID string
        ClaimCampaignID int64
        ClaimRecipientID int64
    }

    type RecallAttributionService struct {
        stripe RecallStripeClient
        now func() time.Time
    }

    func NewRecallAttributionService(client RecallStripeClient) *RecallAttributionService
    func ParseRecallPayment(event stripe.Event, tradeNo string, userID int) (RecallPaymentFact, error)
    func (s *RecallAttributionService) Attribute(ctx context.Context, fact RecallPaymentFact) error
    func (s *RecallAttributionService) ReconcileBatch(ctx context.Context, limit int) (int, error)

Parse event.Data.Raw with common.Unmarshal into stripe.CheckoutSession. Read session.Discounts first; read TotalDetails.Breakdown.Discounts to obtain the actual amount and PromotionCode when expanded. If fields are not expanded, use GetCheckoutSession with discounts and total_details.breakdown.discounts expansion before classifying.

- [ ] **Step 4: Call attribution only after successful fulfillment**

In fulfillOrder:

- after CompleteSubscriptionOrder returns nil, load the completed order/User ID, build RecallPaymentFact, then call Attribute; attribution error is logged and queued for reconciliation but does not roll back the subscription;
- after RechargeWithPaymentSnapshot returns nil, call Attribute whether recharged is true or false so webhook replay can repair prior attribution;
- never call attribution before those methods return success.

Include checkout_session_id and recall metadata in the subscription provider payload saved by CompleteSubscriptionOrder so reconciliation can retrieve the session without scanning Stripe globally.

Add Attribution *RecallAttributionService to RecallRuntime. RunRecallMaintenanceTick calls ReconcileBatch after mail processing only when a database-backed reconciliation event for the current fifteen-minute window is newly inserted; this prevents every node/tick from scanning the same orders.

- [ ] **Step 5: Add metrics queries**

    type RecallCurrencyMetrics struct {
        Currency         string `json:"currency"`
        DirectCount      int64  `json:"direct_count"`
        AssistedCount    int64  `json:"assisted_count"`
        NoCouponCount    int64  `json:"no_coupon_count"`
        PaymentAmount    int64  `json:"payment_amount"`
        DiscountAmount   int64  `json:"discount_amount"`
    }

    func (s *RecallAttributionService) GetMetrics(ctx context.Context, campaignID int64) (RecallCampaignMetrics, error)

Model defines RecallMetricCountRow and RecallCurrencyMetricRow plus QueryRecallCampaignMetricRows(campaignID int64); service maps those rows into the public RecallCampaignMetrics contract, avoiding a model→service dependency cycle. Counts include candidates/enrolled/excluded, Customer/code success/failure, messages scheduled/accepted/failed/cancelled, observed clicks, and conversion kinds. Currency totals are returned as []RecallCurrencyMetrics.

- [ ] **Step 6: Run attribution and focused webhook tests**

Run: go test ./service ./controller -run "RecallAttribution|StripeWebhook.*Recall" -count=1

Expected: PASS.

- [ ] **Step 7: Commit attribution**

    git add service/recall_attribution.go service/recall_attribution_test.go service/recall_scheduler.go model/recall_recipient.go model/recall_event.go model/topup.go model/subscription.go controller/topup_stripe.go
    git commit -m "Count recall revenue only after Stripe payment fulfillment" -m "Constraint: Existing top-up and subscription fulfillment remains the accounting authority." -m "Rejected: Click-based conversion | Mail scanners and curiosity clicks are not revenue." -m "Rejected: Cross-currency total | Minor units are not comparable without exchange rates." -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Attribution failures may be reconciled but must never re-run order fulfillment." -m "Tested: go test ./service ./controller -run RecallAttribution|StripeWebhook.*Recall -count=1"

### Task 12: Expose thin admin/user APIs with masking and authorization

**Files:**
- Create: controller/recall_campaign.go
- Create: controller/recall_campaign_test.go
- Modify: router/api-router.go:130-235
- Modify: service/recall_campaign.go
- Modify: service/recall_claim.go

- [ ] **Step 1: Write controller tests before registering routes**

Test handlers with Gin and an injected RecallRuntime. controller/recall_campaign.go defines var recallRuntimeProvider = service.GetRecallRuntime; tests replace it with a fake provider and restore it with t.Cleanup:

- disabled flag rejects every create/activate/worker-affecting endpoint;
- create/update require valid JSON and admin actor ID;
- preview returns eligible_total/sample/exclusions/stripe validation and fake counters prove no create/send calls;
- list/detail/recipient outputs mask Promotion Code and omit ClaimTokenHash/TemplateSnapshot;
- claim validation uses c.GetInt("id") and rejects another user;
- anonymous unsubscribe accepts only a valid signed token and immediately suppresses later mail;
- retry accepts failed recipient/message only; uncertain requires acknowledge_uncertain=true;
- cancel/complete/retry write admin audit events with deterministic request event IDs;
- export contains masked codes, currency-separated amounts, and no secret fields.

- [ ] **Step 2: Run and verify missing handlers**

Run: go test ./controller -run RecallCampaign -count=1

Expected: FAIL with undefined handler functions.

- [ ] **Step 3: Add admin routes**

First add the read/action methods used by thin handlers:

    func (s *RecallCampaignService) List(ctx context.Context, page *common.PageInfo, status string) ([]RecallCampaignSummary, int64, error)
    func (s *RecallCampaignService) GetDetail(ctx context.Context, id int64) (RecallCampaignDetail, error)
    func (s *RecallCampaignService) ListRecipients(ctx context.Context, id int64, page *common.PageInfo, state string) ([]RecallRecipientView, int64, error)
    func (s *RecallCampaignService) ListEvents(ctx context.Context, id int64, page *common.PageInfo) ([]model.RecallEvent, int64, error)
    func (s *RecallCampaignService) RetryRecipient(ctx context.Context, actorID int, campaignID int64, recipientID int64, acknowledgeUncertain bool) error
    func (s *RecallCampaignService) Export(ctx context.Context, id int64) ([]byte, error)
    func (s *RecallCampaignService) ValidateStripe(ctx context.Context, draft RecallCampaignDraft) (RecallStripePreview, error)

RecallRecipientView masks PromotionCode through model.MaskPromotionCode and contains no hash/template snapshot. Export emits UTF-8 CSV using encoding/csv, with masked code and one currency column per row. GetMetrics remains on RecallAttributionService.

Under /api/recall-campaigns with middleware.AdminAuth():

    GET    /                         ListRecallCampaigns
    POST   /                         CreateRecallCampaign
    GET    /:id                      GetRecallCampaign
    PUT    /:id                      UpdateRecallCampaign
    POST   /:id/preview              PreviewRecallCampaign
    POST   /:id/activate             ActivateRecallCampaign
    POST   /:id/pause                PauseRecallCampaign
    POST   /:id/resume               ResumeRecallCampaign
    POST   /:id/cancel               CancelRecallCampaign
    POST   /:id/complete             CompleteRecallCampaign
    GET    /:id/recipients           ListRecallRecipients
    GET    /:id/events               ListRecallEvents
    GET    /:id/metrics              GetRecallCampaignMetrics
    GET    /:id/export               ExportRecallCampaign
    POST   /:id/recipients/:rid/retry RetryRecallRecipient
    POST   /stripe/validate          ValidateRecallStripeConfig

Use common.GetPageQuery plus common.ApiSuccess/common.ApiError. Controller code parses IDs and calls service only; no DB/Stripe/mail logic is placed in handlers.

- [ ] **Step 4: Add user and anonymous routes**

Under /api/user/recall with middleware.UserAuth():

    POST /claim/validate ValidateRecallClaim

Request:

    type recallClaimRequest struct {
        Claim        string `json:"claim"`
        PriceID      string `json:"price_id,omitempty"`
        PurchaseKind string `json:"purchase_kind,omitempty"`
    }

The anonymous route is:

    GET /api/recall/unsubscribe UnsubscribeRecallEmail

It accepts token from the query string because it is an email link, verifies HMAC/expiry, renders a minimal localized success/failure response, and does not reveal user identity.

- [ ] **Step 5: Run controller tests**

Run: go test ./controller -run RecallCampaign -count=1

Expected: PASS.

- [ ] **Step 6: Commit API boundaries**

    git add controller/recall_campaign.go controller/recall_campaign_test.go router/api-router.go service/recall_campaign.go service/recall_claim.go
    git commit -m "Expose recall operations without exposing recall secrets" -m "Constraint: Admin APIs need detail while users may view only their own claim." -m "Rejected: Returning raw Promotion Codes in campaign APIs | Operational detail is masked by default." -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Keep controller handlers thin and keep the legacy recall_candidates endpoint unchanged." -m "Tested: go test ./controller -run RecallCampaign -count=1"

### Task 13: Carry claim links through login into wallet and subscription Stripe requests

**Files:**
- Create: web/default/src/features/wallet/lib/recall-claim.ts
- Create: web/default/src/features/wallet/lib/recall-claim.test.ts
- Modify: web/default/src/features/wallet/types.ts:250-320
- Modify: web/default/src/features/wallet/lib/stripe-payment-request.ts:22-82
- Modify: web/default/src/features/wallet/lib/stripe-payment-request.test.ts:27-70
- Modify: web/default/src/features/wallet/hooks/use-payment.ts:130-285
- Modify: web/default/src/features/wallet/index.tsx:68-150
- Modify: web/default/src/features/wallet/index.tsx:625-748
- Modify: web/default/src/routes/_authenticated/wallet/index.tsx:23-59
- Modify: web/default/src/features/subscriptions/types.ts:82-120
- Modify: web/default/src/features/subscriptions/components/dialogs/subscription-purchase-dialog.tsx:48-130

- [ ] **Step 1: Write pure frontend claim tests**

Add recall_claim to walletSearchSchema and test:

    expect(normalizeRecallClaim('  abc123  ')).toBe('abc123')
    expect(normalizeRecallClaim('')).toBeUndefined()
    expect(isRecallPriceEligible(view, 'price_topup_10', 'topup')).toBe(true)
    expect(isRecallPriceEligible(view, 'price_sub_month', 'subscription')).toBe(true)
    expect(isRecallPriceEligible(view, 'price_other', 'topup')).toBe(false)

Extend buildStripePaymentRequest test:

    const request = buildStripePaymentRequest({
      amount: 20,
      redirectUrls,
      recallClaim: 'claim-1',
    })
    expect(request.recall_claim).toBe('claim-1')

An absent claim must omit recall_claim.

- [ ] **Step 2: Run Bun tests and verify the new symbols fail**

Run from web/default: bun test src/features/wallet/lib/recall-claim.test.ts src/features/wallet/lib/stripe-payment-request.test.ts

Expected: FAIL with missing recall-claim module or recallClaim parameter.

- [ ] **Step 3: Add typed claim API/view**

    export interface RecallClaimView {
      campaign_id: number
      recipient_id: number
      campaign_name: string
      promotion_code_masked: string
      expires_at: number
      discount: RecallDiscountConfig
      products: {
        topup_price_ids: string[]
        subscription_price_ids: string[]
      }
      redeemed: boolean
    }

    export async function validateRecallClaim(input: {
      claim: string
      price_id?: string
      purchase_kind?: 'topup' | 'subscription'
    }): Promise<ApiResponse<RecallClaimView>>

Wallet validates the claim after authentication, displays campaign/discount/expiry and a clear invalid/expired message, and retains the raw claim only in component memory/query state. Do not store it in localStorage or analytics.

- [ ] **Step 4: Pass the claim only to Stripe**

Extend PaymentRequest and BuildStripePaymentRequestParams with recall_claim/recallClaim. Extend usePayment.processPayment options with recallClaim and pass it into buildStripePaymentRequest. Non-Stripe requestPayment/requestPaddlePayment branches never receive it.

For subscription:

    export interface SubscriptionPayRequest {
      plan_id: number
      payment_method?: string
      recall_claim?: string
    }

SubscriptionPurchaseDialog receives recallClaim and recallView props, sends recall_claim only from handlePayStripe when the plan Price is eligible, and shows an eligibility warning for other payment methods/plans.

- [ ] **Step 5: Run frontend tests and typecheck**

Run from web/default:

    bun test src/features/wallet/lib/recall-claim.test.ts src/features/wallet/lib/stripe-payment-request.test.ts
    bun run typecheck

Expected: both commands PASS.

- [ ] **Step 6: Commit claim UX**

    git add web/default/src/features/wallet web/default/src/routes/_authenticated/wallet/index.tsx web/default/src/features/subscriptions
    git commit -m "Carry the recipient claim into eligible Stripe purchases" -m "Constraint: Login redirects preserve the wallet URL, but claims must not enter browser storage or analytics." -m "Rejected: Sending claims to every payment provider | Recall discounts are Stripe-only." -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: The backend remains authoritative for user, expiry, Price, and Promotion Code validation." -m "Tested: bun test recall claim and Stripe request tests; bun run typecheck"

### Task 14: Build the configurable admin campaign UI, navigation, and translations

**Files:**
- Create: web/default/src/features/recall-campaigns/types.ts
- Create: web/default/src/features/recall-campaigns/schemas.ts
- Create: web/default/src/features/recall-campaigns/schemas.test.ts
- Create: web/default/src/features/recall-campaigns/api.ts
- Create: web/default/src/features/recall-campaigns/index.tsx
- Create: web/default/src/features/recall-campaigns/components/campaign-table.tsx
- Create: web/default/src/features/recall-campaigns/components/campaign-editor.tsx
- Create: web/default/src/features/recall-campaigns/components/campaign-preview-dialog.tsx
- Create: web/default/src/features/recall-campaigns/components/campaign-detail.tsx
- Create: web/default/src/features/recall-campaigns/components/campaign-action-dialog.tsx
- Create: web/default/src/routes/_authenticated/recall-campaigns/index.tsx
- Create: web/default/src/routes/_authenticated/recall-campaigns/$campaignId.tsx
- Modify: web/default/src/hooks/use-sidebar-data.ts:20-150
- Modify: web/default/src/hooks/use-sidebar-config.ts:35-115
- Modify: web/default/src/hooks/use-sidebar-data.test.ts
- Modify: web/default/src/i18n/locales/en.json
- Modify: web/default/src/i18n/locales/zh.json
- Modify: web/default/src/i18n/locales/es.json
- Modify: web/default/src/i18n/locales/fr.json
- Modify: web/default/src/i18n/locales/pt.json
- Modify: web/default/src/i18n/locales/ru.json
- Modify: web/default/src/i18n/locales/ja.json
- Modify: web/default/src/i18n/locales/vi.json
- Modify: web/default/src/routeTree.gen.ts

- [ ] **Step 1: Write failing Zod contract tests**

The schema exports recallCampaignDraftSchema matching RecallCampaignDraft exactly. Tests assert:

- each audience template accepts its required thresholds and rejects negative days/amounts;
- percent requires 0<percent_off<=100 and amount_off=0;
- fixed requires amount_off>0, uppercase 3-letter currency, and one currency;
- automatic Coupon accepts discount fields; existing requires existing_coupon_id;
- scope requires at least one top-up or subscription Price;
- manual ignores schedule; scheduled_once requires a future scheduled_at; recurring requires IANA timezone plus daily or weekly fields;
- 1-3 stages, unique ascending stage_no, stage 1 delay 0, later delays increasing, English subject/body present;
- EnrollmentLimit is 1-100000 and WorkerConcurrency is 1-20.

- [ ] **Step 2: Run and verify schema module is absent**

Run from web/default: bun test src/features/recall-campaigns/schemas.test.ts

Expected: FAIL with module not found.

- [ ] **Step 3: Implement typed APIs**

    export const recallCampaignKeys = {
      all: ['recall-campaigns'] as const,
      list: (search: RecallCampaignSearch) => ['recall-campaigns', 'list', search] as const,
      detail: (id: number) => ['recall-campaigns', 'detail', id] as const,
      recipients: (id: number, page: number) => ['recall-campaigns', id, 'recipients', page] as const,
      events: (id: number, page: number) => ['recall-campaigns', id, 'events', page] as const,
      metrics: (id: number) => ['recall-campaigns', id, 'metrics'] as const,
    }

Implement list/create/get/update/preview/activate/pause/resume/cancel/complete/retry/export functions against the Task 12 routes. Mutations invalidate list, detail, recipients, events, and metrics keys as applicable.

- [ ] **Step 4: Implement list, editor, preview, and detail pages**

Use SectionPageLayout, React Query, React Hook Form, zodResolver, existing DataTable/Dialog/Button/Input/Select components, and useTranslation in every component.

Editor sections are exactly:

1. name and audience template;
2. template-specific thresholds, group allow/block, verified-email;
3. automatic/existing Coupon and percent/fixed fields;
4. top-up and subscription Stripe Price selection, minimum amount, validity;
5. manual/scheduled_once/recurring fields;
6. one-to-three language-aware email stages and delays.

Preview displays eligible total, masked sample, exclusion counts, resolved Products, and existing/automatic Coupon validation. Detail displays masked code, Customer ID, message stages, observed click, conversion kind, errors, audit timeline, and metrics grouped by currency. Cancel confirmation explicitly states that issued Stripe codes remain usable until expiry.

Activated immutable inputs are disabled. Future email content remains editable and shows TemplateVersion. Retry UI does not offer uncertain resend unless the admin checks an explicit acknowledgment.

- [ ] **Step 5: Add admin routes and sidebar configuration**

Both routes enforce ROLE.ADMIN in beforeLoad. Add:

    {
      title: t('Recall Campaigns'),
      url: '/recall-campaigns',
      icon: MailCheck,
    }

Add admin.recall_campaigns=true to DEFAULT_SIDEBAR_MODULES and:

    '/recall-campaigns': { section: 'admin', module: 'recall_campaigns' }

Extend sidebar tests for default visible, admin-disabled hidden, and user-level narrowing.

- [ ] **Step 6: Add real translations and synchronize**

Add every new visible key to all eight locale files with actual translations. Run:

    bun run i18n:sync

Expected: command exits 0. Inspect src/i18n/locales/_reports/{es,fr,pt,ru,ja,vi,zh}.untranslated.json and confirm none of the newly added recall keys are listed.

- [ ] **Step 7: Run frontend validation**

Run from web/default:

    bun test src/features/recall-campaigns/schemas.test.ts src/hooks/use-sidebar-data.test.ts
    bun run typecheck
    bun run lint
    bun run build:check

Expected: all commands PASS and routeTree.gen.ts contains both recall-campaigns routes.

- [ ] **Step 8: Commit admin UI**

    git add web/default/src/features/recall-campaigns web/default/src/routes/_authenticated/recall-campaigns web/default/src/hooks/use-sidebar-data.ts web/default/src/hooks/use-sidebar-config.ts web/default/src/hooks/use-sidebar-data.test.ts web/default/src/i18n/locales web/default/src/routeTree.gen.ts
    git commit -m "Give operators a safe view of Stripe recall campaigns" -m "Constraint: Eight console locales and sidebar narrowing must remain complete." -m "Rejected: Generic rule-builder UI | Version one exposes only three reviewed audience templates." -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Keep secrets masked and keep cancellation copy explicit about issued Stripe codes." -m "Tested: Bun schema/sidebar tests, i18n sync, typecheck, lint, and build:check"

### Task 15: Run end-to-end verification and record staging acceptance

**Files:**
- Modify only if feature-owned verification exposes a defect: files listed in Tasks 1-14
- Do not modify unrelated baseline failures or user-owned files

- [ ] **Step 1: Run all focused backend tests**

Run:

    go test ./setting/operation_setting -run RecallCampaign -count=1
    go test ./model -run "Recall|EmailVerified" -count=1
    go test ./service -run "Recall|EmailMessage" -count=1
    go test ./controller -run "Recall|StripeCheckoutSession.*Promotion|SubscriptionStripe.*Promotion|StripeWebhook.*Recall" -count=1

Expected: PASS.

- [ ] **Step 2: Run race-sensitive and repeated lease tests**

Run:

    go test -race ./model ./service -run "RecallLease|RecallRunIdempotency|RecallWorker|RecallEmail" -count=1
    go test ./model ./service -run "RecallLease|RecallWorker" -count=20

Expected: PASS with no race report and stable single-winner assertions.

- [ ] **Step 3: Run frontend tests and static checks**

Run from web/default:

    bun test src/features/recall-campaigns/schemas.test.ts src/features/wallet/lib/recall-claim.test.ts src/features/wallet/lib/stripe-payment-request.test.ts src/hooks/use-sidebar-data.test.ts
    bun run i18n:sync
    bun run typecheck
    bun run lint
    bun run build:check

Expected: PASS and no new recall translation key appears in untranslated reports.

- [ ] **Step 4: Run broader build checks without changing unrelated failures**

Run from repository root:

    go test ./setting/... ./model/... ./service/... ./controller/...
    go build ./...
    go test ./...

Expected: feature-owned packages and go build pass after implementation. The final go test ./... may still report the pre-existing missing web/classic/dist embed, BlockRun HTTP-client initialization, or Claude file-content conversion failures observed on the untouched base. If they remain byte-for-byte unrelated to changed files, record them as baseline validation gaps and do not edit those areas.

- [ ] **Step 5: Verify the diff is feature-only**

Run:

    git status --short
    git diff --stat origin/main...HEAD
    git diff --name-only origin/main...HEAD

Expected: only the approved design, this plan, and Task 1-14 feature files appear. The original E:/workspace/new-api worktree and its user-owned relay/channel files remain untouched.

- [ ] **Step 6: Perform Stripe Test Mode staging acceptance after code review**

With recall_campaign_setting.enabled=true only in staging:

1. Create and preview an automatic percent Coupon campaign; confirm preview created no Stripe objects.
2. Activate one user without StripeCustomer; confirm one Customer and one Customer-bound max_redemptions=1 Promotion Code.
3. Open the email claim while logged out; confirm login returns to the same claim and wallet displays the eligible products.
4. Complete one wallet Checkout and one subscription Checkout; confirm Discounts contains the recipient Promotion Code and ordinary Checkout still shows manual code entry.
5. Replay the same Stripe event; confirm fulfillment and recall conversion are not duplicated.
6. Trigger stage-two time, then confirm redemption/payment/API activity/opt-out cancels remaining mail.
7. Pause and cancel campaigns; confirm no new work is leased and already issued codes remain valid.
8. Simulate Stripe 429, SMTP definite failure, SMTP uncertain result, worker restart, and two scheduler nodes; confirm bounded retry, no uncertain auto-resend, lease recovery, and one recipient/code/message.
9. Confirm USD and non-USD metrics render separate currency rows.
10. Return the staging feature flag to false after acceptance unless release authorization explicitly enables it.

- [ ] **Step 7: Run the required review skills**

Use superpowers:requesting-code-review for the completed diff, apply only feature-owned findings, then use superpowers:verification-before-completion to rerun the smallest commands proving every final claim.

- [ ] **Step 8: Commit any verification-owned corrections**

If verification required corrections, commit only those feature files:

    git add <feature-owned corrected files>
    git commit -m "Close recall verification gaps before staging" -m "Constraint: Unrelated baseline failures and user-owned changes are out of scope." -m "Confidence: high" -m "Scope-risk: narrow" -m "Directive: Keep the operational flag disabled until Stripe Test Mode acceptance completes." -m "Tested: focused Go tests, race tests, Bun tests, typecheck, lint, and build"

If no correction was needed, do not create an empty commit.

---

## Self-review record

### Specification coverage

- Three audience templates and all thresholds: Task 4.
- Main DB plus separate LOG_DB filtering: Task 4.
- Four-table schema, JSON TEXT, unique constraints, leases, multi-node idempotency: Tasks 2-3.
- Manual, scheduled_once, recurring daily/weekly execution: Task 6.
- Automatic/existing Coupon, percent/fixed, Product resolution/conflict, one-time duration: Task 5.
- Missing/deleted Customer recovery and per-user Promotion Code: Tasks 5 and 8.
- Hash-only claim, wrong-account/product rejection, click observation, signed global opt-out: Task 7.
- One-to-three versioned emails, language fallback, stop checks, stable Message-ID, uncertain state: Task 9.
- Ordinary manual code input and automatic claim mutual exclusion for wallet/subscription: Task 10.
- Post-fulfillment direct/assisted/no-coupon attribution, replay, reconciliation, currency metrics: Task 11.
- Admin CRUD/preview/actions/detail/retry/export and user claim/unsubscribe APIs: Task 12.
- Wallet/subscription claim UX and admin configuration UI: Tasks 13-14.
- Default-off release boundary and Test Mode acceptance: Tasks 1 and 15.
- No local discount/bonus/credit behavior: locked in invariants and Checkout/attribution tasks.

### Red-flag text scan

Run after saving:

    $bad = @(
      ('T' + 'BD'),
      ('T' + 'ODO'),
      ('implement' + ' later'),
      ('fill in' + ' details'),
      ('appropriate error' + ' handling'),
      ('handle' + ' edge cases'),
      ('Write tests for' + ' the above'),
      ('Similar to' + ' Task')
    )
    Select-String -Path docs/superpowers/plans/2026-07-15-stripe-user-winback.md -Pattern $bad

Expected: no matches.

### Type and signature consistency

- RecallCampaignDraft and nested configs are defined once in service/recall_contract.go and mirrored exactly by frontend schemas/types.
- PurchaseKind uses topup or subscription in claim validation, Checkout, and frontend helpers.
- RecallCheckoutDiscount is the only object passed into Checkout builders; it contains PromotionCodeID, CampaignID, RecipientID, and no raw claim/code.
- Promotion and claim identifiers use int64 for campaign/recipient database IDs and int for existing User IDs.
- Money and discount values are Stripe minor-unit int64 values; percentage is float64; metrics remain separated by currency.
- All JSON persistence uses common.Marshal/common.Unmarshal.
- All worker methods accept context.Context, acquire a DB lease first, and preserve deterministic Stripe idempotency keys.
- Existing SendEmail signature remains compatible; SendEmailWithMessageID is additive.

### Known baseline validation gaps

Before feature implementation, the untouched base already had unrelated go test ./... failures involving missing web/classic/dist, BlockRun HTTP-client initialization, and Claude file-content conversion. Task 15 reruns broad validation but explicitly prohibits modifying those areas unless the feature diff directly causes a new failure.
