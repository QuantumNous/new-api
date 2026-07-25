package service

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRecallAudienceTestDBs(t *testing.T) (*gorm.DB, *gorm.DB) {
	t.Helper()
	mainDB, err := gorm.Open(sqlite.Open(t.TempDir()+"/main.db"), &gorm.Config{})
	require.NoError(t, err)
	logDB, err := gorm.Open(sqlite.Open(t.TempDir()+"/log.db"), &gorm.Config{})
	require.NoError(t, err)
	mainSQLDB, err := mainDB.DB()
	require.NoError(t, err)
	logSQLDB, err := logDB.DB()
	require.NoError(t, err)

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	model.DB = mainDB
	model.LOG_DB = logDB
	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		_ = mainSQLDB.Close()
		_ = logSQLDB.Close()
	})

	require.NoError(t, mainDB.AutoMigrate(
		&model.User{},
		&model.TopUp{},
		&model.SubscriptionOrder{},
		&model.UserSubscription{},
		&model.RecallRecipient{},
		&model.RecallMessage{},
		&model.RecallEvent{},
	))
	require.NoError(t, logDB.AutoMigrate(&model.Log{}))
	return mainDB, logDB
}

func registerRecallAudienceContextProbe(t *testing.T, db *gorm.DB, table string) <-chan struct{} {
	t.Helper()
	entered := make(chan struct{}, 1)
	callbackName := "recall_audience_context_" + table + "_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != table {
			return
		}
		select {
		case entered <- struct{}{}:
		default:
		}
		select {
		case <-tx.Statement.Context.Done():
			tx.AddError(tx.Statement.Context.Err())
		case <-time.After(2 * time.Second):
			tx.AddError(fmt.Errorf("timed out waiting for caller context cancellation on %s", table))
		}
	}))
	t.Cleanup(func() { _ = db.Callback().Query().Remove(callbackName) })
	return entered
}

func createRecallAudienceUser(t *testing.T, db *gorm.DB, now int64, suffix string, overrides func(*model.User)) model.User {
	t.Helper()
	settingJSON, err := common.Marshal(dto.UserSetting{Language: "zh"})
	require.NoError(t, err)
	user := model.User{
		Username:        "recall_" + suffix,
		AffCode:         "recall_aff_" + suffix,
		Password:        "hashed-password",
		Status:          common.UserStatusEnabled,
		Email:           suffix + "@example.com",
		EmailVerifiedAt: now - 1,
		Quota:           10,
		RequestCount:    10,
		Group:           "plg",
		Setting:         string(settingJSON),
		CreatedAt:       now - 10*86400,
	}
	if overrides != nil {
		overrides(&user)
	}
	require.NoError(t, db.Create(&user).Error)
	return user
}

func TestRecallAudienceValidationRejectsUnknownTemplate(t *testing.T) {
	err := ValidateRecallAudience("unknown", RecallAudienceConfig{})

	require.Error(t, err)
}

func TestRecallAudienceValidationAcceptsSupportedTemplates(t *testing.T) {
	for _, template := range []string{"first_purchase", "lapsed_payer", "expired_subscription"} {
		t.Run(template, func(t *testing.T) {
			require.NoError(t, ValidateRecallAudience(template, RecallAudienceConfig{}))
		})
	}
}

func TestValidateRecallAudienceNewTemplates(t *testing.T) {
	tooManyUserIDs := make([]int, 501)
	for i := range tooManyUserIDs {
		tooManyUserIDs[i] = i + 1
	}
	combinedLimitIDs := make([]int, 250)
	for i := range combinedLimitIDs {
		combinedLimitIDs[i] = i + 1
	}
	combinedLimitEmails := make([]string, 251)
	for i := range combinedLimitEmails {
		combinedLimitEmails[i] = fmt.Sprintf("limit-%03d@example.com", i)
	}
	duplicateHeavyIDs := make([]int, 0, 500)
	duplicateHeavyEmails := make([]string, 0, 500)
	for i := 0; i < 250; i++ {
		duplicateHeavyIDs = append(duplicateHeavyIDs, i+1, i+1)
		email := fmt.Sprintf("duplicate-%03d@example.com", i)
		duplicateHeavyEmails = append(duplicateHeavyEmails, email, strings.ToUpper(email))
	}

	tests := []struct {
		template string
		cfg      RecallAudienceConfig
		wantErr  string
	}{
		{"registered_only", RecallAudienceConfig{RegistrationStartAt: 100, RegistrationEndAt: 200}, ""},
		{"registered_only", RecallAudienceConfig{RegistrationEndAt: 200}, "registration time range"},
		{"registered_only", RecallAudienceConfig{RegistrationStartAt: 100}, "registration time range"},
		{"registered_only", RecallAudienceConfig{RegistrationStartAt: 200, RegistrationEndAt: 100}, "registration time range"},
		{"specified_users", RecallAudienceConfig{SpecifiedUserIDs: []int{7}}, ""},
		{"specified_users", RecallAudienceConfig{SpecifiedEmails: []string{"ops@example.com"}}, ""},
		{"specified_users", RecallAudienceConfig{}, "at least one"},
		{"specified_users", RecallAudienceConfig{SpecifiedUserIDs: []int{0}}, "positive"},
		{"specified_users", RecallAudienceConfig{SpecifiedUserIDs: []int{-1}}, "positive"},
		{"specified_users", RecallAudienceConfig{SpecifiedEmails: []string{"not-an-email"}}, "email"},
		{"specified_users", RecallAudienceConfig{SpecifiedEmails: []string{"Display Name <ops@example.com>"}}, "email"},
		{"specified_users", RecallAudienceConfig{SpecifiedEmails: []string{"ops@example.com (ops)"}}, "email"},
		{"specified_users", RecallAudienceConfig{SpecifiedEmails: []string{"ops@example.com, alerts@example.com"}}, "email"},
		{"specified_users", RecallAudienceConfig{SpecifiedEmails: []string{"   "}}, "email"},
		{"specified_users", RecallAudienceConfig{SpecifiedUserIDs: tooManyUserIDs}, "500"},
		{"specified_users", RecallAudienceConfig{SpecifiedUserIDs: combinedLimitIDs, SpecifiedEmails: combinedLimitEmails}, "500"},
		{"specified_users", RecallAudienceConfig{SpecifiedUserIDs: duplicateHeavyIDs, SpecifiedEmails: duplicateHeavyEmails}, ""},
	}
	for _, test := range tests {
		t.Run(test.template+"/"+test.wantErr, func(t *testing.T) {
			err := ValidateRecallAudience(test.template, test.cfg)
			if test.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.ErrorContains(t, err, test.wantErr)
		})
	}
}

func TestValidateRecallAudienceNewTemplatesIgnoreInactiveLegacyFields(t *testing.T) {
	staleLegacy := RecallAudienceConfig{
		RegistrationAgeDays:     -1,
		MinRequestCount:         -1,
		MaxQuota:                -1,
		MinPaidAmount:           -1,
		LastAPICallAgeDays:      -1,
		LastPaymentAgeDays:      -1,
		SubscriptionExpiredDays: -1,
		MinSubscriptionAmount:   -1,
		MinSubscriptionCount:    -1,
		PaymentProviders:        []string{""},
	}

	registeredOnly := staleLegacy
	registeredOnly.RegistrationStartAt = 100
	registeredOnly.RegistrationEndAt = 200
	require.NoError(t, ValidateRecallAudience("registered_only", registeredOnly))

	specifiedUsers := staleLegacy
	specifiedUsers.Groups = []string{"plg"}
	specifiedUsers.GroupMode = "unsupported"
	specifiedUsers.SpecifiedUserIDs = []int{7}
	require.NoError(t, ValidateRecallAudience("specified_users", specifiedUsers))
}

func TestValidateRecallAudienceNewTemplatesRespectActiveGroupFields(t *testing.T) {
	tests := []struct {
		name string
		cfg  RecallAudienceConfig
	}{
		{name: "unknown group mode", cfg: RecallAudienceConfig{
			RegistrationStartAt: 100,
			RegistrationEndAt:   200,
			Groups:              []string{"plg"},
			GroupMode:           "unsupported",
		}},
		{name: "groups without mode", cfg: RecallAudienceConfig{
			RegistrationStartAt: 100,
			RegistrationEndAt:   200,
			Groups:              []string{"plg"},
		}},
		{name: "mode without groups", cfg: RecallAudienceConfig{
			RegistrationStartAt: 100,
			RegistrationEndAt:   200,
			GroupMode:           "allow",
		}},
		{name: "empty group", cfg: RecallAudienceConfig{
			RegistrationStartAt: 100,
			RegistrationEndAt:   200,
			Groups:              []string{""},
			GroupMode:           "allow",
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			require.Error(t, ValidateRecallAudience("registered_only", test.cfg))
		})
	}
}

func TestValidateRecallAudienceExistingTemplatesIgnoreNewFields(t *testing.T) {
	cfg := RecallAudienceConfig{
		RegistrationStartAt: 200,
		RegistrationEndAt:   100,
		SpecifiedUserIDs:    []int{0},
		SpecifiedEmails:     []string{"Display Name <ops@example.com>"},
	}

	for _, template := range []string{"first_purchase", "lapsed_payer", "expired_subscription"} {
		t.Run(template, func(t *testing.T) {
			require.NoError(t, ValidateRecallAudience(template, cfg))
		})
	}
}

func TestNormalizeRecallAudienceSpecifiedUsers(t *testing.T) {
	require.Equal(t, []int{7, 3, 9}, normalizeRecallUserIDs([]int{7, 3, 7, 9, 3}))
	require.Equal(t, []string{"ops@example.com", "alerts@example.com"}, normalizeRecallEmails([]string{
		" Ops@Example.COM ",
		"ops@example.com",
		"ALERTS@example.com",
		" alerts@example.com ",
		" ",
	}))
	require.NotNil(t, normalizeRecallUserIDs(nil))
	require.NotNil(t, normalizeRecallEmails(nil))
}

func TestRecallAudienceRegisteredOnlySelectsInclusiveUnusedRegistrations(t *testing.T) {
	mainDB, logDB := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	const startAt int64 = now - 10_000
	const endAt int64 = now - 1_000
	start := createRecallAudienceUser(t, mainDB, now, "registered_start", func(user *model.User) {
		user.CreatedAt = startAt
		user.RequestCount = 0
	})
	end := createRecallAudienceUser(t, mainDB, now, "registered_end", func(user *model.User) {
		user.CreatedAt = endAt
		user.RequestCount = 0
	})
	createRecallAudienceUser(t, mainDB, now, "registered_before", func(user *model.User) {
		user.CreatedAt = startAt - 1
		user.RequestCount = 0
	})
	createRecallAudienceUser(t, mainDB, now, "registered_after", func(user *model.User) {
		user.CreatedAt = endAt + 1
		user.RequestCount = 0
	})
	used := createRecallAudienceUser(t, mainDB, now, "registered_used", func(user *model.User) {
		user.CreatedAt = startAt + 1
		user.RequestCount = 1
	})
	paid := createRecallAudienceUser(t, mainDB, now, "registered_paid", func(user *model.User) {
		user.CreatedAt = startAt + 2
		user.RequestCount = 0
	})
	require.NoError(t, mainDB.Create(&model.TopUp{
		UserId:          paid.Id,
		Money:           25,
		TradeNo:         "registered-only-paid",
		PaymentProvider: model.PaymentProviderPaddle,
		CompleteTime:    startAt + 10,
		Status:          common.TopUpStatusSuccess,
	}).Error)
	require.NoError(t, logDB.Create(&model.Log{UserId: start.Id, Type: model.LogTypeConsume, CreatedAt: now - 60}).Error)

	selector := NewRecallAudienceSelector()
	selector.MainBatchSize = 1
	preview, err := selector.Preview(context.Background(), RecallCampaignDraft{
		AudienceTemplate: "registered_only",
		Audience: RecallAudienceConfig{
			RegistrationStartAt: startAt,
			RegistrationEndAt:   endAt,
			LastAPICallAgeDays:  30,
		},
	}, 10, time.Unix(now, 0))
	require.NoError(t, err)
	require.EqualValues(t, 2, preview.EligibleTotal)
	require.Equal(t, []RecallAudienceCandidate{
		{UserID: start.Id, EmailMasked: "r***@example.com", Language: "zh"},
		{UserID: end.Id, EmailMasked: "r***@example.com", Language: "zh"},
	}, preview.Sample)
	require.EqualValues(t, 1, preview.Exclusions["payment_exists"])
	require.Zero(t, preview.Exclusions["recent_api_activity"], "registered_only must not use stale LastAPICallAgeDays")
	require.NotContains(t, []int{preview.Sample[0].UserID, preview.Sample[1].UserID}, used.Id)
}

func TestRecallAudienceSpecifiedUsersUsesExactUnionAndSafetyExclusions(t *testing.T) {
	mainDB, logDB := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	idOnly := createRecallAudienceUser(t, mainDB, now, "specified_id", func(user *model.User) {
		user.RequestCount = 0
		user.CreatedAt = now
		user.Group = "blocked"
	})
	emailOnly := createRecallAudienceUser(t, mainDB, now, "specified_email", func(user *model.User) {
		user.RequestCount = 1
		user.CreatedAt = now
		user.Group = "blocked"
	})
	overlap := createRecallAudienceUser(t, mainDB, now, "specified_overlap", func(user *model.User) {
		user.Email = "SpecifiedOverlap@Example.COM"
		user.RequestCount = 1
		user.CreatedAt = now
		user.Group = "blocked"
	})
	disabled := createRecallAudienceUser(t, mainDB, now, "specified_disabled", func(user *model.User) {
		user.Status = common.UserStatusDisabled
	})
	invalid := createRecallAudienceUser(t, mainDB, now, "specified_invalid", func(user *model.User) {
		user.Email = "not-an-email"
	})
	optOutJSON, err := common.Marshal(dto.UserSetting{RecallMarketingOptOut: true})
	require.NoError(t, err)
	optedOut := createRecallAudienceUser(t, mainDB, now, "specified_opted_out", func(user *model.User) {
		user.Setting = string(optOutJSON)
	})
	unverified := createRecallAudienceUser(t, mainDB, now, "specified_unverified", func(user *model.User) {
		user.EmailVerifiedAt = 0
	})
	createRecallAudienceUser(t, mainDB, now, "specified_unlisted", nil)
	require.NoError(t, logDB.Create(&model.Log{UserId: idOnly.Id, Type: model.LogTypeConsume, CreatedAt: now - 60}).Error)
	require.NoError(t, mainDB.Create(&model.TopUp{
		UserId:          emailOnly.Id,
		Money:           25,
		TradeNo:         "specified-paid",
		PaymentProvider: model.PaymentProviderStripe,
		CompleteTime:    now - 60,
		Status:          common.TopUpStatusSuccess,
	}).Error)

	selector := NewRecallAudienceSelector()
	selector.MainBatchSize = 2
	recipients, exclusions, err := selector.Snapshot(context.Background(), RecallCampaignDraft{
		AudienceTemplate: "specified_users",
		Audience: RecallAudienceConfig{
			RegistrationStartAt:     now - 100,
			RegistrationEndAt:       now - 50,
			MinRequestCount:         99,
			LastAPICallAgeDays:      30,
			Groups:                  []string{"plg"},
			GroupMode:               "allow",
			RequireVerifiedEmail:    true,
			SpecifiedUserIDs:        []int{idOnly.Id, overlap.Id, disabled.Id, invalid.Id, optedOut.Id, unverified.Id, 999_999},
			SpecifiedEmails:         []string{strings.ToUpper(emailOnly.Email), strings.ToLower(overlap.Email), "missing@example.com"},
			PaymentProviders:        []string{model.PaymentProviderPaddle},
			LastPaymentAgeDays:      999,
			MinPaidAmount:           999,
			SubscriptionExpiredDays: 999,
			MinSubscriptionAmount:   999,
			MinSubscriptionCount:    999,
		},
	}, 10, time.Unix(now, 0))
	require.NoError(t, err)
	gotUserIDs := make([]int, len(recipients))
	emailOnlyRecipientFound := false
	for i := range recipients {
		gotUserIDs[i] = recipients[i].UserId
		require.NotContains(t, recipients[i].EligibilitySnapshot, "missing@example.com")
		if recipients[i].UserId == 0 {
			emailOnlyRecipientFound = true
			require.Equal(t, "missing@example.com", recipients[i].EmailSnapshot)
			require.Equal(t, "en", recipients[i].LanguageSnapshot)
		}
		var snapshot map[string]any
		require.NoError(t, common.Unmarshal([]byte(recipients[i].EligibilitySnapshot), &snapshot))
		require.ElementsMatch(t, []string{
			"template", "user_id", "registered_at", "quota", "request_count", "paid_amount",
			"last_payment_at", "subscription_amount", "subscription_count", "last_subscription_end_at",
		}, recallAudienceJSONKeys(snapshot))
	}
	require.Equal(t, []int{idOnly.Id, emailOnly.Id, overlap.Id, 0}, gotUserIDs)
	require.True(t, emailOnlyRecipientFound)
	require.EqualValues(t, 1, exclusions["disabled"])
	require.EqualValues(t, 1, exclusions["invalid_email"])
	require.EqualValues(t, 1, exclusions["opted_out"])
	require.EqualValues(t, 1, exclusions["unverified_email"])
	require.Zero(t, exclusions["group_filtered"], "specified_users must ignore hidden group config")
	require.Zero(t, exclusions["recent_api_activity"], "specified_users must not use stale LastAPICallAgeDays")
	require.Zero(t, exclusions["payment_exists"], "specified_users payment facts must not exclude exact users")
	require.Zero(t, exclusions["threshold_not_met"], "specified_users must bypass behavioral thresholds")
}

func TestRecallAudienceValidationRejectsInvalidBoundaries(t *testing.T) {
	tests := []struct {
		name     string
		template string
		cfg      RecallAudienceConfig
	}{
		{name: "negative days", template: "first_purchase", cfg: RecallAudienceConfig{RegistrationAgeDays: -1}},
		{name: "negative amount", template: "lapsed_payer", cfg: RecallAudienceConfig{MinPaidAmount: -1}},
		{name: "negative count", template: "expired_subscription", cfg: RecallAudienceConfig{MinSubscriptionCount: -1}},
		{name: "unknown group mode", template: "first_purchase", cfg: RecallAudienceConfig{Groups: []string{"plg"}, GroupMode: "maybe"}},
		{name: "groups without mode", template: "first_purchase", cfg: RecallAudienceConfig{Groups: []string{"plg"}}},
		{name: "mode without groups", template: "first_purchase", cfg: RecallAudienceConfig{GroupMode: "allow"}},
		{name: "empty provider", template: "lapsed_payer", cfg: RecallAudienceConfig{PaymentProviders: []string{""}}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			require.Error(t, ValidateRecallAudience(test.template, test.cfg))
		})
	}
}

func TestRecallAudienceContractsUseStableJSONNames(t *testing.T) {
	draft := RecallCampaignDraft{
		Name:             "winback",
		AudienceTemplate: "first_purchase",
		Audience:         RecallAudienceConfig{RegistrationAgeDays: 7},
		Schedule:         RecallScheduleConfig{ScheduledAt: 123},
		Discount:         RecallDiscountConfig{Type: "percent", PercentOff: 20},
		Products:         RecallProductScope{TopUpPriceIDs: []string{"price_topup"}},
		Emails: []RecallEmailStage{{
			StageNo: 1,
			Templates: map[string]RecallEmailTemplate{
				"en": {Subject: "Come back", BodyText: "Hello"},
			},
		}},
	}
	raw, err := common.Marshal(draft)
	require.NoError(t, err)
	var draftJSON map[string]any
	require.NoError(t, common.Unmarshal(raw, &draftJSON))
	require.ElementsMatch(t, []string{
		"name", "audience_template", "audience_config", "execution_mode", "schedule",
		"coupon_source", "existing_coupon_id", "discount_config", "product_scope",
		"promotion_valid_seconds", "enrollment_limit", "worker_concurrency", "email_sequence",
	}, recallAudienceJSONKeys(draftJSON))
	productScope, ok := draftJSON["product_scope"].(map[string]any)
	require.True(t, ok)
	require.ElementsMatch(t, []string{"topup_price_ids", "subscription_price_ids"}, recallAudienceJSONKeys(productScope))

	candidateRaw, err := common.Marshal(RecallAudienceCandidate{UserID: 1, SnapshotJSON: `{"secret":true}`})
	require.NoError(t, err)
	require.NotContains(t, string(candidateRaw), "secret")

	claimRaw, err := common.Marshal(RecallClaimView{CampaignID: 1, RecipientID: 2})
	require.NoError(t, err)
	var claimJSON map[string]any
	require.NoError(t, common.Unmarshal(claimRaw, &claimJSON))
	require.ElementsMatch(t, []string{
		"campaign_id", "recipient_id", "campaign_name", "promotion_code_masked",
		"expires_at", "discount", "products", "redeemed",
	}, recallAudienceJSONKeys(claimJSON))
}

func TestRecallAudienceConfigJSONContractIncludesActivityFields(t *testing.T) {
	raw, err := common.Marshal(RecallAudienceConfig{
		RegistrationStartAt: 100,
		RegistrationEndAt:   200,
		SpecifiedUserIDs:    []int{7, 3},
		SpecifiedEmails:     []string{"ops@example.com", "alerts@example.com"},
	})
	require.NoError(t, err)

	var cfgJSON map[string]any
	require.NoError(t, common.Unmarshal(raw, &cfgJSON))
	require.ElementsMatch(t, []string{
		"registration_age_days", "registration_start_at", "registration_end_at",
		"min_request_count", "max_quota", "min_paid_amount", "last_api_call_age_days",
		"last_payment_age_days", "subscription_expired_days", "min_subscription_amount",
		"min_subscription_count", "payment_providers", "groups", "group_mode",
		"require_verified_email", "specified_user_ids", "specified_emails",
	}, recallAudienceJSONKeys(cfgJSON))
	require.IsType(t, float64(0), cfgJSON["registration_start_at"])
	require.IsType(t, float64(0), cfgJSON["registration_end_at"])
	require.IsType(t, []any{}, cfgJSON["specified_user_ids"])
	require.IsType(t, []any{}, cfgJSON["specified_emails"])
}

func recallAudienceJSONKeys(value map[string]any) []string {
	keys := make([]string, 0, len(value))
	for key := range value {
		keys = append(keys, key)
	}
	return keys
}

func TestRecallAudienceFirstPurchaseUsesAllPaymentProvidersAndPreviewDoesNotWrite(t *testing.T) {
	mainDB, logDB := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	eligible := createRecallAudienceUser(t, mainDB, now, "eligible", nil)
	paid := createRecallAudienceUser(t, mainDB, now, "paid", nil)
	require.NoError(t, mainDB.Create(&model.TopUp{
		UserId:          paid.Id,
		Money:           12,
		TradeNo:         "non-stripe-success",
		PaymentProvider: model.PaymentProviderPaddle,
		CompleteTime:    now - 86400,
		Status:          common.TopUpStatusSuccess,
	}).Error)

	selector := NewRecallAudienceSelector()
	selector.MainBatchSize = 1
	selector.LogBatchSize = 1
	preview, err := selector.Preview(context.Background(), RecallCampaignDraft{
		AudienceTemplate: "first_purchase",
		Audience: RecallAudienceConfig{
			RegistrationAgeDays: 7,
			MinRequestCount:     5,
			MaxQuota:            10,
		},
	}, 10, time.Unix(now, 0))
	require.NoError(t, err)
	require.EqualValues(t, 1, preview.EligibleTotal)
	require.Equal(t, []RecallAudienceCandidate{{
		UserID:      eligible.Id,
		EmailMasked: "e***@example.com",
		Language:    "zh",
	}}, preview.Sample)
	require.EqualValues(t, 1, preview.Exclusions["payment_exists"])
	for _, key := range []string{
		"payment_exists", "recent_api_activity", "active_subscription", "opted_out",
		"invalid_email", "unverified_email", "group_filtered", "threshold_not_met",
	} {
		require.Contains(t, preview.Exclusions, key)
	}

	for name, dbAndModel := range map[string]struct {
		db    *gorm.DB
		model any
	}{
		"recipient": {mainDB, &model.RecallRecipient{}},
		"message":   {mainDB, &model.RecallMessage{}},
		"event":     {mainDB, &model.RecallEvent{}},
		"log":       {logDB, &model.Log{}},
	} {
		t.Run(fmt.Sprintf("zero_%s_writes", name), func(t *testing.T) {
			var count int64
			require.NoError(t, dbAndModel.db.Model(dbAndModel.model).Count(&count).Error)
			require.Zero(t, count)
		})
	}
}

func TestRecallAudienceFirstPurchaseExcludesSuccessfulSubscriptionPayment(t *testing.T) {
	mainDB, _ := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	paid := createRecallAudienceUser(t, mainDB, now, "subscription_paid", nil)
	require.NoError(t, mainDB.Create(&model.SubscriptionOrder{
		UserId:          paid.Id,
		Money:           25,
		TradeNo:         "subscription-success",
		PaymentProvider: model.PaymentProviderWaffo,
		CompleteTime:    now - 86400,
		Status:          common.TopUpStatusSuccess,
	}).Error)

	preview, err := NewRecallAudienceSelector().Preview(context.Background(), RecallCampaignDraft{
		AudienceTemplate: "first_purchase",
		Audience: RecallAudienceConfig{
			RegistrationAgeDays: 7,
			MinRequestCount:     5,
			MaxQuota:            10,
		},
	}, 10, time.Unix(now, 0))
	require.NoError(t, err)
	require.Zero(t, preview.EligibleTotal)
	require.EqualValues(t, 1, preview.Exclusions["payment_exists"])
}

func TestRecallAudienceFirstPurchaseExcludesSuccessfulZeroValuePaymentWithoutTimestamps(t *testing.T) {
	mainDB, _ := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	paid := createRecallAudienceUser(t, mainDB, now, "zero_value_paid", nil)
	require.NoError(t, mainDB.Create(&model.TopUp{
		UserId:          paid.Id,
		Money:           0,
		TradeNo:         "zero-value-success",
		PaymentProvider: model.PaymentProviderStripe,
		Status:          common.TopUpStatusSuccess,
	}).Error)

	preview, err := NewRecallAudienceSelector().Preview(context.Background(), RecallCampaignDraft{
		AudienceTemplate: "first_purchase",
		Audience: RecallAudienceConfig{
			RegistrationAgeDays: 7,
			MinRequestCount:     5,
			MaxQuota:            10,
		},
	}, 10, time.Unix(now, 0))
	require.NoError(t, err)
	require.Zero(t, preview.EligibleTotal)
	require.EqualValues(t, 1, preview.Exclusions["payment_exists"])
}

func TestRecallAudienceLapsedPayerFiltersProviderAndRecentActivity(t *testing.T) {
	mainDB, logDB := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	eligible := createRecallAudienceUser(t, mainDB, now, "lapsed_eligible", nil)
	recent := createRecallAudienceUser(t, mainDB, now, "lapsed_recent", nil)
	otherProvider := createRecallAudienceUser(t, mainDB, now, "lapsed_other_provider", nil)
	for _, payment := range []model.TopUp{
		{UserId: eligible.Id, Money: 100, TradeNo: "lapsed-eligible", PaymentProvider: model.PaymentProviderStripe, CompleteTime: now - 60*86400, Status: common.TopUpStatusSuccess},
		{UserId: recent.Id, Money: 100, TradeNo: "lapsed-recent", PaymentProvider: model.PaymentProviderStripe, CompleteTime: now - 60*86400, Status: common.TopUpStatusSuccess},
		{UserId: otherProvider.Id, Money: 100, TradeNo: "lapsed-other", PaymentProvider: model.PaymentProviderPaddle, CompleteTime: now - 60*86400, Status: common.TopUpStatusSuccess},
	} {
		require.NoError(t, mainDB.Create(&payment).Error)
	}
	require.NoError(t, logDB.Create(&model.Log{UserId: recent.Id, Type: model.LogTypeConsume, CreatedAt: now - 86400}).Error)

	selector := NewRecallAudienceSelector()
	selector.LogBatchSize = 1
	preview, err := selector.Preview(context.Background(), RecallCampaignDraft{
		AudienceTemplate: "lapsed_payer",
		Audience: RecallAudienceConfig{
			MinPaidAmount:      50,
			LastAPICallAgeDays: 30,
			LastPaymentAgeDays: 30,
			MaxQuota:           10,
			PaymentProviders:   []string{model.PaymentProviderStripe},
		},
	}, 10, time.Unix(now, 0))
	require.NoError(t, err)
	require.EqualValues(t, 1, preview.EligibleTotal)
	require.Equal(t, eligible.Id, preview.Sample[0].UserID)
	require.EqualValues(t, 1, preview.Exclusions["recent_api_activity"])
	require.EqualValues(t, 1, preview.Exclusions["threshold_not_met"])
}

func TestRecallAudiencePaymentProviderFilterIgnoresSurroundingWhitespace(t *testing.T) {
	mainDB, _ := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	eligible := createRecallAudienceUser(t, mainDB, now, "provider_whitespace", nil)
	require.NoError(t, mainDB.Create(&model.TopUp{
		UserId: eligible.Id, Money: 100, TradeNo: "provider-whitespace",
		PaymentProvider: model.PaymentProviderStripe, CompleteTime: now - 60*86400, Status: common.TopUpStatusSuccess,
	}).Error)

	preview, err := NewRecallAudienceSelector().Preview(context.Background(), RecallCampaignDraft{
		AudienceTemplate: "lapsed_payer",
		Audience: RecallAudienceConfig{
			MinPaidAmount:      50,
			LastPaymentAgeDays: 30,
			MaxQuota:           10,
			PaymentProviders:   []string{"  " + model.PaymentProviderStripe + "  "},
		},
	}, 10, time.Unix(now, 0))
	require.NoError(t, err)
	require.EqualValues(t, 1, preview.EligibleTotal)
	require.Equal(t, eligible.Id, preview.Sample[0].UserID)
}

func TestRecallAudienceExpiredSubscriptionRequiresExpiredHistoryWithoutActiveSubscription(t *testing.T) {
	mainDB, _ := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	eligible := createRecallAudienceUser(t, mainDB, now, "expired_eligible", nil)
	active := createRecallAudienceUser(t, mainDB, now, "expired_active", nil)
	for _, subscription := range []model.UserSubscription{
		{UserId: eligible.Id, PlanId: 1, EndTime: now - 60*86400, Status: "expired"},
		{UserId: active.Id, PlanId: 1, EndTime: now - 60*86400, Status: "expired"},
		{UserId: active.Id, PlanId: 2, EndTime: now + 60*86400, Status: "active"},
	} {
		require.NoError(t, mainDB.Create(&subscription).Error)
	}

	preview, err := NewRecallAudienceSelector().Preview(context.Background(), RecallCampaignDraft{
		AudienceTemplate: "expired_subscription",
		Audience: RecallAudienceConfig{
			SubscriptionExpiredDays: 30,
			MinSubscriptionCount:    1,
		},
	}, 10, time.Unix(now, 0))
	require.NoError(t, err)
	require.EqualValues(t, 1, preview.EligibleTotal)
	require.Equal(t, eligible.Id, preview.Sample[0].UserID)
	require.EqualValues(t, 1, preview.Exclusions["active_subscription"])
}

func TestRecallAudienceSnapshotHonorsLimitAndKeepsFullEmail(t *testing.T) {
	mainDB, _ := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	first := createRecallAudienceUser(t, mainDB, now, "snapshot_first", nil)
	createRecallAudienceUser(t, mainDB, now, "snapshot_second", nil)

	recipients, _, err := NewRecallAudienceSelector().Snapshot(context.Background(), RecallCampaignDraft{
		AudienceTemplate: "first_purchase",
		Audience: RecallAudienceConfig{
			RegistrationAgeDays: 7,
			MinRequestCount:     5,
			MaxQuota:            10,
		},
	}, 1, time.Unix(now, 0))
	require.NoError(t, err)
	require.Len(t, recipients, 1)
	require.Equal(t, first.Id, recipients[0].UserId)
	require.Equal(t, "snapshot_first@example.com", recipients[0].EmailSnapshot)
	require.Equal(t, "zh", recipients[0].LanguageSnapshot)
	require.Equal(t, model.RecallRecipientQueued, recipients[0].State)
	require.NotEmpty(t, recipients[0].EligibilitySnapshot)

	var snapshot map[string]any
	require.NoError(t, common.Unmarshal([]byte(recipients[0].EligibilitySnapshot), &snapshot))
	require.EqualValues(t, first.Id, snapshot["user_id"])

	var recipientCount int64
	require.NoError(t, mainDB.Model(&model.RecallRecipient{}).Count(&recipientCount).Error)
	require.Zero(t, recipientCount, "Snapshot returns rows but must not persist them")
}

func TestRecallAudienceSnapshotLimitDoesNotTruncateExclusions(t *testing.T) {
	for _, test := range []struct {
		name           string
		limit          int
		recipientCount int
	}{
		{name: "positive limit", limit: 1, recipientCount: 1},
		{name: "zero limit", limit: 0, recipientCount: 0},
	} {
		t.Run(test.name, func(t *testing.T) {
			mainDB, logDB := setupRecallAudienceTestDBs(t)
			const now int64 = 2_000_000_000
			createRecallAudienceUser(t, mainDB, now, "snapshot_limit_eligible", nil)
			createRecallAudienceUser(t, mainDB, now, "snapshot_limit_invalid", func(user *model.User) {
				user.Email = "not-an-email"
			})
			optOutJSON, err := common.Marshal(dto.UserSetting{RecallMarketingOptOut: true})
			require.NoError(t, err)
			createRecallAudienceUser(t, mainDB, now, "snapshot_limit_opted_out", func(user *model.User) {
				user.Setting = string(optOutJSON)
			})
			recent := createRecallAudienceUser(t, mainDB, now, "snapshot_limit_recent", nil)
			require.NoError(t, logDB.Create(&model.Log{
				UserId: recent.Id, Type: model.LogTypeConsume, CreatedAt: now - 60,
			}).Error)

			recipients, exclusions, err := NewRecallAudienceSelector().Snapshot(context.Background(), RecallCampaignDraft{
				AudienceTemplate: "first_purchase",
				Audience: RecallAudienceConfig{
					RegistrationAgeDays: 7,
					MinRequestCount:     5,
					MaxQuota:            10,
					LastAPICallAgeDays:  30,
				},
			}, test.limit, time.Unix(now, 0))
			require.NoError(t, err)
			require.Len(t, recipients, test.recipientCount)
			require.EqualValues(t, 1, exclusions["invalid_email"])
			require.EqualValues(t, 1, exclusions["opted_out"])
			require.EqualValues(t, 1, exclusions["recent_api_activity"])
		})
	}
}

func TestRecallAudienceCommonExclusionsApplyToEveryTemplate(t *testing.T) {
	for _, template := range []string{"first_purchase", "lapsed_payer", "expired_subscription"} {
		t.Run(template, func(t *testing.T) {
			mainDB, logDB := setupRecallAudienceTestDBs(t)
			const now int64 = 2_000_000_000
			optOutJSON, err := common.Marshal(dto.UserSetting{RecallMarketingOptOut: true})
			require.NoError(t, err)

			users := []model.User{
				createRecallAudienceUser(t, mainDB, now, template+"_eligible", nil),
				createRecallAudienceUser(t, mainDB, now, template+"_disabled", func(user *model.User) { user.Status = common.UserStatusDisabled }),
				createRecallAudienceUser(t, mainDB, now, template+"_empty", func(user *model.User) { user.Email = "" }),
				createRecallAudienceUser(t, mainDB, now, template+"_invalid", func(user *model.User) { user.Email = "not-an-email" }),
				createRecallAudienceUser(t, mainDB, now, template+"_display", func(user *model.User) { user.Email = "Display Name <display@example.com>" }),
				createRecallAudienceUser(t, mainDB, now, template+"_opted_out", func(user *model.User) { user.Setting = string(optOutJSON) }),
				createRecallAudienceUser(t, mainDB, now, template+"_unverified", func(user *model.User) { user.EmailVerifiedAt = 0 }),
				createRecallAudienceUser(t, mainDB, now, template+"_group", func(user *model.User) { user.Group = "blocked" }),
				createRecallAudienceUser(t, mainDB, now, template+"_recent", nil),
			}
			for _, user := range users {
				switch template {
				case "lapsed_payer":
					require.NoError(t, mainDB.Create(&model.TopUp{
						UserId: user.Id, Money: 100, TradeNo: fmt.Sprintf("common-%s-%d", template, user.Id),
						PaymentProvider: model.PaymentProviderStripe, CompleteTime: now - 60*86400, Status: common.TopUpStatusSuccess,
					}).Error)
				case "expired_subscription":
					require.NoError(t, mainDB.Create(&model.UserSubscription{
						UserId: user.Id, PlanId: user.Id, EndTime: now - 60*86400, Status: "expired",
					}).Error)
				}
			}
			recentUser := users[len(users)-1]
			require.NoError(t, logDB.Create(&model.Log{UserId: recentUser.Id, Type: model.LogTypeConsume, CreatedAt: now - 60}).Error)

			cfg := RecallAudienceConfig{
				LastAPICallAgeDays:   30,
				Groups:               []string{"plg"},
				GroupMode:            "allow",
				RequireVerifiedEmail: true,
			}
			switch template {
			case "first_purchase":
				cfg.RegistrationAgeDays = 7
				cfg.MinRequestCount = 5
				cfg.MaxQuota = 10
			case "lapsed_payer":
				cfg.MinPaidAmount = 50
				cfg.LastPaymentAgeDays = 30
				cfg.MaxQuota = 10
			case "expired_subscription":
				cfg.SubscriptionExpiredDays = 30
				cfg.MinSubscriptionCount = 1
			}

			preview, err := NewRecallAudienceSelector().Preview(context.Background(), RecallCampaignDraft{
				AudienceTemplate: template,
				Audience:         cfg,
			}, 20, time.Unix(now, 0))
			require.NoError(t, err)
			require.EqualValues(t, 1, preview.EligibleTotal)
			require.EqualValues(t, 1, preview.Exclusions["disabled"])
			require.EqualValues(t, 3, preview.Exclusions["invalid_email"])
			require.EqualValues(t, 1, preview.Exclusions["opted_out"])
			require.EqualValues(t, 1, preview.Exclusions["unverified_email"])
			require.EqualValues(t, 1, preview.Exclusions["group_filtered"])
			require.EqualValues(t, 1, preview.Exclusions["recent_api_activity"])
		})
	}
}

func TestRecallAudienceFirstPurchaseGroupFilters(t *testing.T) {
	mainDB, _ := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	plg := createRecallAudienceUser(t, mainDB, now, "first_purchase_plg", nil)
	defaultUser := createRecallAudienceUser(t, mainDB, now, "first_purchase_default", func(user *model.User) {
		user.Group = "default"
	})
	admin := createRecallAudienceUser(t, mainDB, now, "first_purchase_admin", func(user *model.User) {
		user.Group = "admin"
	})

	tests := []struct {
		name              string
		groups            []string
		groupMode         string
		wantUserIDs       []int
		wantGroupFiltered int64
	}{
		{name: "no filter includes every group", wantUserIDs: []int{plg.Id, defaultUser.Id, admin.Id}},
		{name: "allow default selects only default", groups: []string{"default"}, groupMode: "allow", wantUserIDs: []int{defaultUser.Id}, wantGroupFiltered: 2},
		{name: "block admin excludes only admin", groups: []string{"admin"}, groupMode: "block", wantUserIDs: []int{plg.Id, defaultUser.Id}, wantGroupFiltered: 1},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			preview, err := NewRecallAudienceSelector().Preview(context.Background(), RecallCampaignDraft{
				AudienceTemplate: "first_purchase",
				Audience: RecallAudienceConfig{
					RegistrationAgeDays: 7,
					MinRequestCount:     5,
					MaxQuota:            10,
					Groups:              test.groups,
					GroupMode:           test.groupMode,
				},
			}, 10, time.Unix(now, 0))
			require.NoError(t, err)
			require.EqualValues(t, len(test.wantUserIDs), preview.EligibleTotal)
			actualUserIDs := make([]int, 0, len(preview.Sample))
			for _, candidate := range preview.Sample {
				actualUserIDs = append(actualUserIDs, candidate.UserID)
			}
			require.ElementsMatch(t, test.wantUserIDs, actualUserIDs)
			require.EqualValues(t, test.wantGroupFiltered, preview.Exclusions["group_filtered"])
		})
	}
}

func TestRecallAudienceGroupBlockModeExcludesMatchingGroups(t *testing.T) {
	mainDB, _ := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	eligible := createRecallAudienceUser(t, mainDB, now, "group_block_eligible", nil)
	createRecallAudienceUser(t, mainDB, now, "group_block_excluded", func(user *model.User) {
		user.Group = "blocked"
	})

	preview, err := NewRecallAudienceSelector().Preview(context.Background(), RecallCampaignDraft{
		AudienceTemplate: "first_purchase",
		Audience: RecallAudienceConfig{
			RegistrationAgeDays: 7,
			MinRequestCount:     5,
			MaxQuota:            10,
			Groups:              []string{"blocked"},
			GroupMode:           "block",
		},
	}, 10, time.Unix(now, 0))
	require.NoError(t, err)
	require.EqualValues(t, 1, preview.EligibleTotal)
	require.Equal(t, eligible.Id, preview.Sample[0].UserID)
	require.EqualValues(t, 1, preview.Exclusions["group_filtered"])
}

func TestRecallAudienceLogLookupUsesOnlyLogDBAndHonorsBatchSize(t *testing.T) {
	mainDB, logDB := setupRecallAudienceTestDBs(t)
	require.False(t, mainDB.Migrator().HasTable(&model.Log{}))
	require.False(t, logDB.Migrator().HasTable(&model.User{}))

	const since int64 = 100
	userIDs := []int{1, 2, 3, 4, 5}
	for _, userID := range userIDs {
		require.NoError(t, logDB.Create(&model.Log{UserId: userID, Type: model.LogTypeConsume, CreatedAt: since}).Error)
	}
	require.NoError(t, logDB.Create(&model.Log{UserId: 99, Type: model.LogTypeManage, CreatedAt: since}).Error)

	queryCount := 0
	maxBatchSize := 0
	callbackName := "recall_audience_batch_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, logDB.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "logs" {
			return
		}
		queryCount++
		for _, value := range tx.Statement.Vars {
			if ids, ok := value.([]int); ok && len(ids) > maxBatchSize {
				maxBatchSize = len(ids)
			}
		}
	}))
	t.Cleanup(func() { _ = logDB.Callback().Query().Remove(callbackName) })

	active, err := model.FindRecentlyActiveRecallUserIDs(userIDs, since, 2)
	require.NoError(t, err)
	require.Len(t, active, len(userIDs))
	require.Equal(t, 3, queryCount)
	require.LessOrEqual(t, maxBatchSize, 2)

	beforeEmpty := queryCount
	active, err = model.FindRecentlyActiveRecallUserIDs(nil, since, 2)
	require.NoError(t, err)
	require.Empty(t, active)
	require.Equal(t, beforeEmpty, queryCount, "empty input must not query LOG_DB")

	_, err = model.FindRecentlyActiveRecallUserIDs(userIDs, since, 0)
	require.Error(t, err)
}

func TestRecallAudienceMainQueryReceivesCallerContext(t *testing.T) {
	mainDB, _ := setupRecallAudienceTestDBs(t)
	entered := registerRecallAudienceContextProbe(t, mainDB, "users")
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	result := make(chan error, 1)

	go func() {
		_, err := NewRecallAudienceSelector().Preview(ctx, RecallCampaignDraft{
			AudienceTemplate: "first_purchase",
		}, 1, time.Unix(2_000_000_000, 0))
		result <- err
	}()

	select {
	case <-entered:
		cancel()
	case <-time.After(2 * time.Second):
		t.Fatal("main query callback was not entered")
	}
	select {
	case err := <-result:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(3 * time.Second):
		t.Fatal("main query did not return after caller cancellation")
	}
}

func TestRecallAudienceLogQueryReceivesCallerContext(t *testing.T) {
	mainDB, logDB := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	createRecallAudienceUser(t, mainDB, now, "log_context", nil)
	entered := registerRecallAudienceContextProbe(t, logDB, "logs")
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	result := make(chan error, 1)

	go func() {
		_, err := NewRecallAudienceSelector().Preview(ctx, RecallCampaignDraft{
			AudienceTemplate: "first_purchase",
			Audience: RecallAudienceConfig{
				RegistrationAgeDays: 7,
				MinRequestCount:     5,
				MaxQuota:            10,
				LastAPICallAgeDays:  30,
			},
		}, 1, time.Unix(now, 0))
		result <- err
	}()

	select {
	case <-entered:
		cancel()
	case <-time.After(2 * time.Second):
		t.Fatal("log query callback was not entered")
	}
	select {
	case err := <-result:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(3 * time.Second):
		t.Fatal("log query did not return after caller cancellation")
	}
}

func TestRecallAudienceExpiredSubscriptionFiltersAmountByPaymentProvider(t *testing.T) {
	mainDB, _ := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	eligible := createRecallAudienceUser(t, mainDB, now, "subscription_amount_eligible", nil)
	otherProvider := createRecallAudienceUser(t, mainDB, now, "subscription_amount_other", nil)
	for _, user := range []model.User{eligible, otherProvider} {
		require.NoError(t, mainDB.Create(&model.UserSubscription{
			UserId: user.Id, PlanId: user.Id, EndTime: now - 60*86400, Status: "expired",
		}).Error)
	}
	for _, order := range []model.SubscriptionOrder{
		{UserId: eligible.Id, Money: 20, TradeNo: "subscription-amount-stripe", PaymentProvider: model.PaymentProviderStripe, CompleteTime: now - 90*86400, Status: common.TopUpStatusSuccess},
		{UserId: otherProvider.Id, Money: 100, TradeNo: "subscription-amount-paddle", PaymentProvider: model.PaymentProviderPaddle, CompleteTime: now - 90*86400, Status: common.TopUpStatusSuccess},
	} {
		require.NoError(t, mainDB.Create(&order).Error)
	}

	preview, err := NewRecallAudienceSelector().Preview(context.Background(), RecallCampaignDraft{
		AudienceTemplate: "expired_subscription",
		Audience: RecallAudienceConfig{
			SubscriptionExpiredDays: 30,
			MinSubscriptionAmount:   10,
			MinSubscriptionCount:    1,
			PaymentProviders:        []string{model.PaymentProviderStripe},
		},
	}, 10, time.Unix(now, 0))
	require.NoError(t, err)
	require.EqualValues(t, 1, preview.EligibleTotal)
	require.Equal(t, eligible.Id, preview.Sample[0].UserID)
	require.EqualValues(t, 1, preview.Exclusions["threshold_not_met"])
}

func TestRecallAudiencePaymentFactsDeduplicateMirroredSubscriptionTopUp(t *testing.T) {
	mainDB, _ := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	user := createRecallAudienceUser(t, mainDB, now, "deduplicated_payment", nil)
	require.NoError(t, mainDB.Create(&model.TopUp{
		UserId: user.Id, Money: 20, TradeNo: "mirrored-trade", PaymentProvider: model.PaymentProviderStripe,
		CompleteTime: now - 60*86400, Status: common.TopUpStatusSuccess,
	}).Error)
	require.NoError(t, mainDB.Create(&model.SubscriptionOrder{
		UserId: user.Id, Money: 20, TradeNo: "mirrored-trade", PaymentProvider: model.PaymentProviderStripe,
		CompleteTime: now - 60*86400, Status: common.TopUpStatusSuccess,
	}).Error)

	facts, err := model.ListRecallCandidateFacts(model.RecallCandidateQuery{
		Template: "lapsed_payer", Now: now, Limit: 10, PaymentProviders: []string{model.PaymentProviderStripe},
	})
	require.NoError(t, err)
	require.Len(t, facts, 1)
	require.Equal(t, 20.0, facts[0].PaidAmount)
}

func TestRecallAudienceMirroredPaymentUsesLatestCompletionTime(t *testing.T) {
	mainDB, _ := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	user := createRecallAudienceUser(t, mainDB, now, "mirrored_latest_payment", nil)
	require.NoError(t, mainDB.Create(&model.TopUp{
		UserId: user.Id, Money: 20, TradeNo: "mirrored-latest-trade", PaymentProvider: model.PaymentProviderStripe,
		CompleteTime: now - 60*86400, Status: common.TopUpStatusSuccess,
	}).Error)
	require.NoError(t, mainDB.Create(&model.SubscriptionOrder{
		UserId: user.Id, Money: 20, TradeNo: "mirrored-latest-trade", PaymentProvider: model.PaymentProviderStripe,
		CompleteTime: now - 86400, Status: common.TopUpStatusSuccess,
	}).Error)

	preview, err := NewRecallAudienceSelector().Preview(context.Background(), RecallCampaignDraft{
		AudienceTemplate: "lapsed_payer",
		Audience: RecallAudienceConfig{
			MinPaidAmount:      10,
			LastPaymentAgeDays: 30,
			MaxQuota:           10,
			PaymentProviders:   []string{model.PaymentProviderStripe},
		},
	}, 10, time.Unix(now, 0))
	require.NoError(t, err)
	require.Zero(t, preview.EligibleTotal)
	require.EqualValues(t, 1, preview.Exclusions["threshold_not_met"])
}

func TestRecallAudienceHasPaymentAfterFallsBackToCreateTime(t *testing.T) {
	mainDB, _ := setupRecallAudienceTestDBs(t)
	const after int64 = 1_000
	user := createRecallAudienceUser(t, mainDB, 2_000_000_000, "payment_after", nil)
	require.NoError(t, mainDB.Create(&model.TopUp{
		UserId: user.Id, Money: 1, TradeNo: "payment-after", PaymentProvider: model.PaymentProviderStripe,
		CreateTime: after + 1, CompleteTime: 0, Status: common.TopUpStatusSuccess,
	}).Error)

	paid, err := model.HasRecallPaymentAfter(user.Id, after)
	require.NoError(t, err)
	require.True(t, paid)
	paid, err = model.HasRecallPaymentAfter(user.Id+1000, after)
	require.NoError(t, err)
	require.False(t, paid)
}

func TestRecallAudiencePreviewAndSnapshotShareEligibilityAndLanguageFallback(t *testing.T) {
	mainDB, _ := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	first := createRecallAudienceUser(t, mainDB, now, "iterator_first", func(user *model.User) {
		user.Setting = ""
		user.BrowserLang = "pt-BR"
	})
	second := createRecallAudienceUser(t, mainDB, now, "iterator_second", func(user *model.User) {
		user.Setting = ""
		user.BrowserLang = ""
	})
	draft := RecallCampaignDraft{
		AudienceTemplate: "first_purchase",
		Audience:         RecallAudienceConfig{RegistrationAgeDays: 7, MinRequestCount: 5, MaxQuota: 10},
	}
	selector := NewRecallAudienceSelector()
	selector.MainBatchSize = 1
	preview, err := selector.Preview(context.Background(), draft, 10, time.Unix(now, 0))
	require.NoError(t, err)
	recipients, _, err := selector.Snapshot(context.Background(), draft, 10, time.Unix(now, 0))
	require.NoError(t, err)
	require.Equal(t, []int{first.Id, second.Id}, []int{preview.Sample[0].UserID, preview.Sample[1].UserID})
	require.Equal(t, []int{first.Id, second.Id}, []int{recipients[0].UserId, recipients[1].UserId})
	require.Equal(t, "pt", preview.Sample[0].Language)
	require.Equal(t, "en", preview.Sample[1].Language)
}

func TestRecallAudienceMalformedSettingFallsBackToBrowserAndDefaultLanguage(t *testing.T) {
	mainDB, _ := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	browserFallback := createRecallAudienceUser(t, mainDB, now, "malformed_setting_browser", func(user *model.User) {
		user.Setting = "{not-json"
		user.BrowserLang = "fr-FR"
	})
	defaultFallback := createRecallAudienceUser(t, mainDB, now, "malformed_setting_default", func(user *model.User) {
		user.Setting = "{not-json"
		user.BrowserLang = ""
	})

	preview, err := NewRecallAudienceSelector().Preview(context.Background(), RecallCampaignDraft{
		AudienceTemplate: "first_purchase",
		Audience:         RecallAudienceConfig{RegistrationAgeDays: 7, MinRequestCount: 5, MaxQuota: 10},
	}, 10, time.Unix(now, 0))
	require.NoError(t, err)
	require.Equal(t, []int{browserFallback.Id, defaultFallback.Id}, []int{
		preview.Sample[0].UserID,
		preview.Sample[1].UserID,
	})
	require.Equal(t, "fr", preview.Sample[0].Language)
	require.Equal(t, "en", preview.Sample[1].Language)
}

func TestRecallAudienceSeparatorOnlySettingLanguageFallsBackToBrowserLanguage(t *testing.T) {
	mainDB, _ := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	settingJSON, err := common.Marshal(dto.UserSetting{Language: "-"})
	require.NoError(t, err)
	user := createRecallAudienceUser(t, mainDB, now, "separator_setting_language", func(user *model.User) {
		user.Setting = string(settingJSON)
		user.BrowserLang = "ja-JP"
	})

	preview, err := NewRecallAudienceSelector().Preview(context.Background(), RecallCampaignDraft{
		AudienceTemplate: "first_purchase",
		Audience:         RecallAudienceConfig{RegistrationAgeDays: 7, MinRequestCount: 5, MaxQuota: 10},
	}, 10, time.Unix(now, 0))
	require.NoError(t, err)
	require.Equal(t, user.Id, preview.Sample[0].UserID)
	require.Equal(t, "ja", preview.Sample[0].Language)
}

func TestRecallAudienceSeparatorOnlyBrowserLanguageFallsBackToEnglish(t *testing.T) {
	mainDB, _ := setupRecallAudienceTestDBs(t)
	const now int64 = 2_000_000_000
	user := createRecallAudienceUser(t, mainDB, now, "separator_browser_language", func(user *model.User) {
		user.Setting = ""
		user.BrowserLang = "__"
	})

	preview, err := NewRecallAudienceSelector().Preview(context.Background(), RecallCampaignDraft{
		AudienceTemplate: "first_purchase",
		Audience:         RecallAudienceConfig{RegistrationAgeDays: 7, MinRequestCount: 5, MaxQuota: 10},
	}, 10, time.Unix(now, 0))
	require.NoError(t, err)
	require.Equal(t, user.Id, preview.Sample[0].UserID)
	require.Equal(t, "en", preview.Sample[0].Language)
}

func TestRecallAudienceHonorsCancellationAndRejectsInvalidBatchSizes(t *testing.T) {
	setupRecallAudienceTestDBs(t)
	draft := RecallCampaignDraft{AudienceTemplate: "first_purchase"}
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := NewRecallAudienceSelector().Preview(cancelled, draft, 1, time.Unix(2_000_000_000, 0))
	require.ErrorIs(t, err, context.Canceled)

	selector := NewRecallAudienceSelector()
	selector.MainBatchSize = 0
	_, err = selector.Preview(context.Background(), draft, 1, time.Unix(2_000_000_000, 0))
	require.Error(t, err)
	selector = NewRecallAudienceSelector()
	selector.LogBatchSize = 0
	_, err = selector.Preview(context.Background(), draft, 1, time.Unix(2_000_000_000, 0))
	require.Error(t, err)
}
