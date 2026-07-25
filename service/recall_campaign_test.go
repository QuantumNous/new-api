package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
	"gorm.io/gorm"
)

type recallCampaignFakeEmailTranslator struct {
	mu          sync.Mutex
	calls       [][]RecallEmailStage
	err         error
	translateFn func([]RecallEmailStage) (map[int]map[string]RecallEmailTemplate, error)
}

func (f *recallCampaignFakeEmailTranslator) Translate(_ context.Context, stages []RecallEmailStage) (map[int]map[string]RecallEmailTemplate, error) {
	f.mu.Lock()
	f.calls = append(f.calls, cloneRecallCampaignTestStages(stages))
	f.mu.Unlock()
	if f.err != nil {
		return nil, f.err
	}
	if f.translateFn != nil {
		return f.translateFn(stages)
	}
	return recallCampaignTestTranslations(stages), nil
}

func (f *recallCampaignFakeEmailTranslator) callCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.calls)
}

func cloneRecallCampaignTestStages(stages []RecallEmailStage) []RecallEmailStage {
	cloned := make([]RecallEmailStage, len(stages))
	for i := range stages {
		cloned[i] = stages[i]
		cloned[i].Templates = make(map[string]RecallEmailTemplate, len(stages[i].Templates))
		for language, template := range stages[i].Templates {
			cloned[i].Templates[language] = template
		}
	}
	return cloned
}

func recallCampaignTestTranslations(stages []RecallEmailStage) map[int]map[string]RecallEmailTemplate {
	translations := make(map[int]map[string]RecallEmailTemplate, len(stages))
	for _, stage := range stages {
		english := stage.Templates["en"]
		localized := make(map[string]RecallEmailTemplate, len(recallEmailTranslationLanguages))
		for _, language := range recallEmailTranslationLanguages {
			localized[language] = RecallEmailTemplate{
				Subject:  language + ":" + english.Subject,
				BodyText: language + ":" + english.BodyText,
			}
		}
		translations[stage.StageNo] = localized
	}
	return translations
}

func recallCampaignHTMLTranslations(stages []RecallEmailStage, version string) map[int]map[string]RecallEmailTemplate {
	translations := make(map[int]map[string]RecallEmailTemplate, len(stages))
	for _, stage := range stages {
		english := stage.Templates["en"]
		document, err := parseRecallEmailHTML(english.BodyHTML)
		if err != nil {
			panic(err)
		}
		segments := document.TranslationSegments()
		localized := make(map[string]RecallEmailTemplate, len(recallEmailTranslationLanguages))
		for _, language := range recallEmailTranslationLanguages {
			localizedSegments := make([]string, len(segments))
			for index, segment := range segments {
				localizedSegments[index] = language + ":" + version + ":" + segment
			}
			bodyHTML, err := document.Rebuild(localizedSegments)
			if err != nil {
				panic(err)
			}
			localized[language] = RecallEmailTemplate{
				Subject:  language + ":" + version + ":" + english.Subject,
				BodyHTML: bodyHTML,
			}
		}
		translations[stage.StageNo] = localized
	}
	return translations
}

func requireRecallCampaignCanonicalLanguages(t *testing.T, stages []RecallEmailStage) {
	t.Helper()
	want := append([]string{"en"}, recallEmailTranslationLanguages...)
	for _, stage := range stages {
		require.Len(t, stage.Templates, len(want))
		for _, language := range want {
			template, ok := stage.Templates[language]
			require.True(t, ok, "missing language %s", language)
			require.NotEmpty(t, template.Subject)
			require.True(t, template.BodyText != "" || template.BodyHTML != "", "missing body for language %s", language)
		}
	}
}

func setupRecallCampaignTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/recall-campaign.db"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	model.DB = db
	model.LOG_DB = db
	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		_ = sqlDB.Close()
	})
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.TopUp{},
		&model.SubscriptionOrder{},
		&model.SubscriptionPlan{},
		&model.UserSubscription{},
		&model.RecallCampaign{},
		&model.RecallRecipient{},
		&model.RecallMessage{},
		&model.RecallEvent{},
		&model.Log{},
	))
	return db
}

func setRecallCampaignEnabled(t *testing.T, enabled bool) {
	t.Helper()
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.enabled":      boolString(enabled),
		"recall_campaign_setting.batch_size":   "100",
		"recall_campaign_setting.tick_seconds": "30",
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
			"recall_campaign_setting.enabled":      "false",
			"recall_campaign_setting.batch_size":   "100",
			"recall_campaign_setting.tick_seconds": "30",
		}))
	})
}

func boolString(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func loadRecallCampaignEnabled(t *testing.T, enabled bool) {
	t.Helper()
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.enabled":      boolString(enabled),
		"recall_campaign_setting.batch_size":   "100",
		"recall_campaign_setting.tick_seconds": "30",
	}))
}

type recallCampaignStripeCalls struct {
	createCoupon        int
	getCoupon           int
	createCustomer      int
	getCustomer         int
	createPromotionCode int
	getPromotionCode    int
	getPrice            int
	createCouponStarted chan<- struct{}
	createCouponRelease <-chan struct{}
	couponIDs           []string
	couponKeys          []string
}

func newRecallCampaignStripeService(t *testing.T, calls *recallCampaignStripeCalls) *RecallStripeService {
	t.Helper()
	originalTopUps := setting.StripeTopUpPriceIds
	originalPrice := setting.StripePriceId
	originalPrice20 := setting.StripePriceId20
	originalPrice200 := setting.StripePriceId200
	setting.StripeTopUpPriceIds = `{"10":"price_topup"}`
	setting.StripePriceId = ""
	setting.StripePriceId20 = ""
	setting.StripePriceId200 = ""
	t.Cleanup(func() {
		setting.StripeTopUpPriceIds = originalTopUps
		setting.StripePriceId = originalPrice
		setting.StripePriceId20 = originalPrice20
		setting.StripePriceId200 = originalPrice200
	})
	client := &recallStripeFakeClient{
		createCouponFn: func(_ context.Context, params *stripe.CouponParams) (*stripe.Coupon, error) {
			calls.createCoupon++
			if params.IdempotencyKey != nil {
				calls.couponKeys = append(calls.couponKeys, *params.IdempotencyKey)
			}
			if calls.createCouponStarted != nil {
				calls.createCouponStarted <- struct{}{}
			}
			if calls.createCouponRelease != nil {
				<-calls.createCouponRelease
			}
			couponID := "coupon_recall"
			if calls.createCoupon <= len(calls.couponIDs) {
				couponID = calls.couponIDs[calls.createCoupon-1]
			}
			return &stripe.Coupon{
				ID:         couponID,
				Valid:      true,
				Duration:   stripe.CouponDurationOnce,
				PercentOff: *params.PercentOff,
				AppliesTo:  &stripe.CouponAppliesTo{Products: []string{"prod_topup"}},
			}, nil
		},
		getCouponFn: func(_ context.Context, id string) (*stripe.Coupon, error) {
			calls.getCoupon++
			return &stripe.Coupon{
				ID:         id,
				Valid:      true,
				Duration:   stripe.CouponDurationOnce,
				PercentOff: 20,
				AppliesTo:  &stripe.CouponAppliesTo{Products: []string{"prod_topup"}},
			}, nil
		},
		createCustomerFn: func(_ context.Context, _ *stripe.CustomerParams) (*stripe.Customer, error) {
			calls.createCustomer++
			return &stripe.Customer{ID: "cus_recall"}, nil
		},
		getCustomerFn: func(_ context.Context, id string) (*stripe.Customer, error) {
			calls.getCustomer++
			return &stripe.Customer{ID: id}, nil
		},
		createPromotionCodeFn: func(_ context.Context, _ *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			calls.createPromotionCode++
			return &stripe.PromotionCode{ID: "promo_recall"}, nil
		},
		getPromotionCodeFn: func(_ context.Context, id string) (*stripe.PromotionCode, error) {
			calls.getPromotionCode++
			return &stripe.PromotionCode{ID: id}, nil
		},
		getPriceFn: func(_ context.Context, id string) (*stripe.Price, error) {
			calls.getPrice++
			return &stripe.Price{
				ID:      id,
				Active:  true,
				Type:    stripe.PriceTypeOneTime,
				Product: &stripe.Product{ID: "prod_topup"},
			}, nil
		},
		getCheckoutSessionFn: func(_ context.Context, id string, _ ...string) (*stripe.CheckoutSession, error) {
			return &stripe.CheckoutSession{ID: id}, nil
		},
	}
	return NewRecallStripeService(client)
}

func createRecallCampaignEligibleUser(t *testing.T, db *gorm.DB, now time.Time, suffix string) model.User {
	t.Helper()
	return createRecallAudienceUser(t, db, now.Unix(), suffix, func(user *model.User) {
		user.CreatedAt = now.Add(-30 * 24 * time.Hour).Unix()
		user.RequestCount = 10
		user.Quota = 0
		user.Group = "plg"
	})
}

func validRecallCampaignDraft(now time.Time) RecallCampaignDraft {
	return RecallCampaignDraft{
		Name:             "First purchase win-back",
		AudienceTemplate: "first_purchase",
		Audience: RecallAudienceConfig{
			RegistrationAgeDays:  7,
			MinRequestCount:      1,
			MaxQuota:             100,
			LastAPICallAgeDays:   3,
			RequireVerifiedEmail: true,
		},
		ExecutionMode:         "manual",
		CouponSource:          "automatic",
		Discount:              RecallDiscountConfig{Type: "percent", PercentOff: 20},
		Products:              RecallProductScope{TopUpPriceIDs: []string{"price_topup"}},
		PromotionValidSeconds: 7 * 24 * 60 * 60,
		EnrollmentLimit:       100,
		WorkerConcurrency:     5,
		Emails: []RecallEmailStage{{
			StageNo:         1,
			DelaySeconds:    0,
			TemplateVersion: 99,
			Templates: map[string]RecallEmailTemplate{
				"en": {Subject: "Come back", BodyText: "A Stripe offer is waiting."},
			},
		}},
		Schedule: RecallScheduleConfig{ScheduledAt: now.Add(time.Hour).Unix()},
	}
}

func TestRecallCampaignReadPaginationIsNormalizedAndBounded(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	campaigns := make([]model.RecallCampaign, 101)
	for i := range campaigns {
		campaigns[i] = model.RecallCampaign{
			Name:                "bounded campaign",
			Status:              model.RecallCampaignDraft,
			AudienceTemplate:    "first_purchase",
			AudienceConfig:      `{}`,
			ExecutionMode:       "manual",
			CouponSource:        "automatic",
			DiscountConfig:      `{}`,
			ProductScope:        `{}`,
			EmailSequenceConfig: `[]`,
		}
	}
	require.NoError(t, db.Create(&campaigns).Error)
	target := campaigns[0]
	recipients := make([]model.RecallRecipient, 101)
	events := make([]model.RecallEvent, 101)
	for i := range recipients {
		recipients[i] = model.RecallRecipient{
			CampaignId:          target.Id,
			UserId:              30_000 + i,
			EligibilitySnapshot: `{}`,
			EmailSnapshot:       "bounded@example.com",
			LanguageSnapshot:    "en",
			State:               model.RecallRecipientQueued,
		}
		events[i] = model.RecallEvent{
			CampaignId:    target.Id,
			EventType:     "bounded_event",
			Source:        "service_pagination_test",
			SourceEventId: fmt.Sprint(i),
			EventData:     `{}`,
		}
	}
	require.NoError(t, db.Create(&recipients).Error)
	require.NoError(t, db.Create(&events).Error)

	service := NewRecallCampaignService(NewRecallAudienceSelector(), nil)
	for _, test := range []struct {
		name         string
		page         common.PageInfo
		wantPage     int
		wantPageSize int
		wantItems    int
	}{
		{name: "negative", page: common.PageInfo{Page: -2, PageSize: -5}, wantPage: 1, wantPageSize: common.ItemsPerPage, wantItems: common.ItemsPerPage},
		{name: "zero", page: common.PageInfo{}, wantPage: 1, wantPageSize: common.ItemsPerPage, wantItems: common.ItemsPerPage},
		{name: "oversize", page: common.PageInfo{Page: 1, PageSize: 1_000}, wantPage: 1, wantPageSize: 100, wantItems: 100},
	} {
		t.Run(test.name, func(t *testing.T) {
			campaignPage := test.page
			campaignItems, total, err := service.List(context.Background(), &campaignPage, "")
			require.NoError(t, err)
			require.Equal(t, int64(101), total)
			require.Equal(t, test.wantPage, campaignPage.Page)
			require.Equal(t, test.wantPageSize, campaignPage.PageSize)
			require.Len(t, campaignItems, test.wantItems)

			recipientPage := test.page
			recipientItems, total, err := service.ListRecipients(context.Background(), target.Id, &recipientPage, "")
			require.NoError(t, err)
			require.Equal(t, int64(101), total)
			require.Equal(t, test.wantPage, recipientPage.Page)
			require.Equal(t, test.wantPageSize, recipientPage.PageSize)
			require.Len(t, recipientItems, test.wantItems)

			eventPage := test.page
			eventItems, total, err := service.ListEvents(context.Background(), target.Id, &eventPage)
			require.NoError(t, err)
			require.Equal(t, int64(101), total)
			require.Equal(t, test.wantPage, eventPage.Page)
			require.Equal(t, test.wantPageSize, eventPage.PageSize)
			require.Len(t, eventItems, test.wantItems)
		})
	}
}

func TestRecallCampaignExportRejectsRowAndByteOverflow(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	campaign := model.RecallCampaign{
		Name:                "bounded export",
		Status:              model.RecallCampaignCompleted,
		AudienceTemplate:    "first_purchase",
		AudienceConfig:      `{}`,
		ExecutionMode:       "manual",
		CouponSource:        "automatic",
		DiscountConfig:      `{}`,
		ProductScope:        `{}`,
		EmailSequenceConfig: `[]`,
	}
	require.NoError(t, db.Create(&campaign).Error)
	recipients := []model.RecallRecipient{
		{CampaignId: campaign.Id, UserId: 40_001, EligibilitySnapshot: `{}`, EmailSnapshot: "one@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued},
		{CampaignId: campaign.Id, UserId: 40_002, EligibilitySnapshot: `{}`, EmailSnapshot: "two@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued},
		{CampaignId: campaign.Id, UserId: 40_003, EligibilitySnapshot: `{}`, EmailSnapshot: "three@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued},
	}
	require.NoError(t, db.Create(&recipients).Error)

	service := NewRecallCampaignService(NewRecallAudienceSelector(), nil)
	service.exportMaxRows = 2
	service.exportMaxBytes = 1_024
	data, err := service.Export(context.Background(), campaign.Id)
	require.ErrorContains(t, err, "maximum of 2 recipients")
	require.Nil(t, data, "row overflow must not return a truncated CSV")

	require.NoError(t, db.Delete(&recipients[2]).Error)
	service.exportMaxRows = 3
	service.exportMaxBytes = 32
	data, err = service.Export(context.Background(), campaign.Id)
	require.ErrorContains(t, err, "maximum of 32 bytes")
	require.Nil(t, data, "byte overflow must not return a truncated CSV")
}

func TestRecallCampaignExportHonorsCancelledContext(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	campaign := model.RecallCampaign{
		Name:                "cancelled export",
		Status:              model.RecallCampaignCompleted,
		AudienceTemplate:    "first_purchase",
		AudienceConfig:      `{}`,
		ExecutionMode:       "manual",
		CouponSource:        "automatic",
		DiscountConfig:      `{}`,
		ProductScope:        `{}`,
		EmailSequenceConfig: `[]`,
	}
	require.NoError(t, db.Create(&campaign).Error)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), nil)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	data, err := service.Export(ctx, campaign.Id)

	require.ErrorIs(t, err, context.Canceled)
	require.Nil(t, data)
}

func TestRecallCampaignSaveDraftValidatesAndNormalizes(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), nil)
	service.now = func() time.Time { return now }

	campaign, err := service.SaveDraft(context.Background(), 7, validRecallCampaignDraft(now))

	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignDraft, campaign.Status)
	require.Zero(t, campaign.ScheduledAt, "manual schedules are ignored")
	var emails []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(campaign.EmailSequenceConfig), &emails))
	require.Equal(t, 1, emails[0].TemplateVersion)
}

func TestRecallCampaignDraftCanonicalizesSpecifiedAudienceBeforeSave(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), nil)
	service.now = func() time.Time { return now }
	draft := validRecallCampaignDraft(now)
	draft.AudienceTemplate = "specified_users"
	draft.Audience = RecallAudienceConfig{
		SpecifiedUserIDs: []int{7, 3, 7},
		SpecifiedEmails:  []string{" Ops@Example.COM ", "ops@example.com", "alerts@example.com"},
	}

	campaign, err := service.SaveDraft(context.Background(), 7, draft)

	require.NoError(t, err)
	var stored RecallAudienceConfig
	require.NoError(t, common.Unmarshal([]byte(campaign.AudienceConfig), &stored))
	require.Equal(t, []int{7, 3}, stored.SpecifiedUserIDs)
	require.Equal(t, []string{"ops@example.com", "alerts@example.com"}, stored.SpecifiedEmails)
	require.Contains(t, campaign.AudienceConfig, `"specified_user_ids":[7,3]`)
	require.Contains(t, campaign.AudienceConfig, `"specified_emails":["ops@example.com","alerts@example.com"]`)
}

func TestRecallCampaignDraftSerializesEmptySpecifiedAudienceLists(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), nil)
	service.now = func() time.Time { return now }
	draft := validRecallCampaignDraft(now)
	draft.AudienceTemplate = "registered_only"
	draft.Audience = RecallAudienceConfig{RegistrationStartAt: 100, RegistrationEndAt: 200}

	campaign, err := service.SaveDraft(context.Background(), 7, draft)

	require.NoError(t, err)
	require.Contains(t, campaign.AudienceConfig, `"specified_user_ids":[]`)
	require.Contains(t, campaign.AudienceConfig, `"specified_emails":[]`)
}

func TestRecallCampaignSaveAndUpdateDraftAllowNewAudienceTemplates(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), nil)
	service.now = func() time.Time { return now }

	tests := []struct {
		template string
		audience RecallAudienceConfig
	}{
		{template: "registered_only", audience: RecallAudienceConfig{RegistrationStartAt: 100, RegistrationEndAt: 200}},
		{template: "specified_users", audience: RecallAudienceConfig{SpecifiedUserIDs: []int{7}}},
	}
	for _, test := range tests {
		t.Run(test.template, func(t *testing.T) {
			draft := validRecallCampaignDraft(now)
			draft.Name = "Persist " + test.template
			draft.AudienceTemplate = test.template
			draft.Audience = test.audience
			campaign, err := service.SaveDraft(context.Background(), 7, draft)
			require.NoError(t, err)

			draft.Name = "Updated " + test.template
			updated, err := service.UpdateDraft(context.Background(), 7, campaign.Id, draft)

			require.NoError(t, err)
			require.Equal(t, draft.Name, updated.Name)
			require.Equal(t, test.template, updated.AudienceTemplate)
		})
	}
}

func TestRecallCampaignSaveDraftTranslatesAndPersistsAllLanguages(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 21, 9, 0, 0, 0, time.UTC)
	translator := &recallCampaignFakeEmailTranslator{}
	service := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	service.now = func() time.Time { return now }
	draft := validRecallCampaignDraft(now)
	draft.Emails = append(draft.Emails, RecallEmailStage{
		StageNo:      2,
		DelaySeconds: 3600,
		Templates: map[string]RecallEmailTemplate{
			"en": {Subject: "One more reason", BodyText: "Your offer is still waiting."},
		},
	})

	campaign, err := service.SaveDraft(context.Background(), 7, draft)

	require.NoError(t, err)
	require.Equal(t, 1, translator.callCount())
	require.Len(t, translator.calls[0], 2, "all stages must be translated in one batch")
	for _, stage := range translator.calls[0] {
		require.Equal(t, map[string]RecallEmailTemplate{"en": stage.Templates["en"]}, stage.Templates)
	}
	var stored []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(campaign.EmailSequenceConfig), &stored))
	requireRecallCampaignCanonicalLanguages(t, stored)
	require.Equal(t, "zh:Come back", stored[0].Templates["zh"].Subject)
	require.Equal(t, "vi:Your offer is still waiting.", stored[1].Templates["vi"].BodyText)
}

func TestRecallCampaignSaveDraftFallsBackToEnglishWhenTranslationIsNotConfigured(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 25, 9, 0, 0, 0, time.UTC)
	translator := NewRecallEmailTranslator(RecallEmailTranslatorOptions{})
	service := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	service.now = func() time.Time { return now }

	campaign, err := service.SaveDraft(context.Background(), 7, validRecallCampaignDraft(now))

	require.NoError(t, err)
	require.NotNil(t, campaign)
	var stored []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(campaign.EmailSequenceConfig), &stored))
	require.Len(t, stored, 1)
	require.Equal(t, map[string]RecallEmailTemplate{
		"en": stored[0].Templates["en"],
	}, stored[0].Templates)
}

func TestRecallCampaignSaveDraftTranslationFailureDoesNotPersist(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 21, 9, 0, 0, 0, time.UTC)
	translator := &recallCampaignFakeEmailTranslator{err: errors.New("translation unavailable")}
	service := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	service.now = func() time.Time { return now }

	campaign, err := service.SaveDraft(context.Background(), 7, validRecallCampaignDraft(now))

	require.ErrorContains(t, err, "translation unavailable")
	require.Nil(t, campaign)
	var count int64
	require.NoError(t, db.Model(&model.RecallCampaign{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestRecallCampaignUpdateDraftReusesCompleteStoredTranslations(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 21, 9, 0, 0, 0, time.UTC)
	translator := &recallCampaignFakeEmailTranslator{}
	service := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	service.now = func() time.Time { return now }
	draft := validRecallCampaignDraft(now)
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)

	draft.Name = "Renamed without content changes"
	updated, err := service.UpdateDraft(context.Background(), 7, campaign.Id, draft)

	require.NoError(t, err)
	require.Equal(t, 1, translator.callCount(), "unchanged English must reuse complete stored translations")
	var stages []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(updated.EmailSequenceConfig), &stages))
	requireRecallCampaignCanonicalLanguages(t, stages)
	require.Equal(t, "ja:Come back", stages[0].Templates["ja"].Subject)
}

func TestRecallCampaignUpdateDraftRepairsMissingLocalizedTemplate(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 21, 9, 0, 0, 0, time.UTC)
	translator := &recallCampaignFakeEmailTranslator{}
	service := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	service.now = func() time.Time { return now }
	draft := validRecallCampaignDraft(now)
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	var damaged []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(campaign.EmailSequenceConfig), &damaged))
	delete(damaged[0].Templates, "zh")
	raw, err := common.Marshal(damaged)
	require.NoError(t, err)
	require.NoError(t, db.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Update("email_sequence_config", string(raw)).Error)

	updated, err := service.UpdateDraft(context.Background(), 7, campaign.Id, draft)

	require.NoError(t, err)
	require.Equal(t, 2, translator.callCount())
	var stages []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(updated.EmailSequenceConfig), &stages))
	requireRecallCampaignCanonicalLanguages(t, stages)
	require.Equal(t, "zh:Come back", stages[0].Templates["zh"].Subject)
}

func TestRecallCampaignUpdateDraftReplacesGeneratedTranslationsWhenEnglishChanges(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 21, 9, 0, 0, 0, time.UTC)
	translator := &recallCampaignFakeEmailTranslator{}
	service := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	service.now = func() time.Time { return now }
	draft := validRecallCampaignDraft(now)
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	draft.Emails[0].Templates["en"] = RecallEmailTemplate{Subject: "A new subject", BodyText: "A new body"}

	updated, err := service.UpdateDraft(context.Background(), 7, campaign.Id, draft)

	require.NoError(t, err)
	require.Equal(t, 2, translator.callCount())
	var stages []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(updated.EmailSequenceConfig), &stages))
	require.Equal(t, "fr:A new subject", stages[0].Templates["fr"].Subject)
	require.Equal(t, "ru:A new body", stages[0].Templates["ru"].BodyText)
}

func TestRecallCampaignUpdateDraftReusesUnchangedEnglishHTMLTranslations(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 21, 9, 0, 0, 0, time.UTC)
	translator := &recallCampaignFakeEmailTranslator{}
	translator.translateFn = func(stages []RecallEmailStage) (map[int]map[string]RecallEmailTemplate, error) {
		return recallCampaignHTMLTranslations(stages, "stored"), nil
	}
	service := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	service.now = func() time.Time { return now }
	draft := validRecallCampaignDraft(now)
	draft.Emails[0].Templates["en"] = RecallEmailTemplate{Subject: "HTML offer", BodyHTML: validRecallHTML}
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)

	draft.Name = "Rename only"
	updated, err := service.UpdateDraft(context.Background(), 7, campaign.Id, draft)

	require.NoError(t, err)
	require.Equal(t, 1, translator.callCount(), "unchanged English HTML must reuse stored localized HTML")
	var stages []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(updated.EmailSequenceConfig), &stages))
	require.Equal(t, "zh:stored:HTML offer", stages[0].Templates["zh"].Subject)
	require.Contains(t, stages[0].Templates["zh"].BodyHTML, "zh:stored:Claim offer")
	require.Empty(t, stages[0].Templates["zh"].BodyText)
}

func TestRecallCampaignUpdateDraftReplacesAllGeneratedHTMLTranslationsWhenEnglishChanges(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 21, 9, 0, 0, 0, time.UTC)
	translator := &recallCampaignFakeEmailTranslator{}
	translationVersion := "initial"
	translator.translateFn = func(stages []RecallEmailStage) (map[int]map[string]RecallEmailTemplate, error) {
		return recallCampaignHTMLTranslations(stages, translationVersion), nil
	}
	service := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	service.now = func() time.Time { return now }
	draft := validRecallCampaignDraft(now)
	draft.Emails[0].Templates["en"] = RecallEmailTemplate{Subject: "HTML offer", BodyHTML: validRecallHTML}
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)

	translationVersion = "replacement"
	draft.Emails[0].Templates["en"] = RecallEmailTemplate{
		Subject:  "Updated HTML offer",
		BodyHTML: strings.Replace(validRecallHTML, "Claim offer", "Claim updated offer", 1),
	}
	updated, err := service.UpdateDraft(context.Background(), 7, campaign.Id, draft)

	require.NoError(t, err)
	require.Equal(t, 2, translator.callCount())
	var stages []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(updated.EmailSequenceConfig), &stages))
	for _, language := range recallEmailTranslationLanguages {
		template := stages[0].Templates[language]
		require.Equal(t, language+":replacement:Updated HTML offer", template.Subject)
		require.Contains(t, template.BodyHTML, language+":replacement:Claim updated offer")
		require.NotContains(t, template.BodyHTML, "initial")
		require.Empty(t, template.BodyText)
	}
}

func TestRecallCampaignSaveDraftRejectsInvalidTranslatedHTMLBeforePersistence(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 21, 9, 0, 0, 0, time.UTC)
	translator := &recallCampaignFakeEmailTranslator{}
	translator.translateFn = func(stages []RecallEmailStage) (map[int]map[string]RecallEmailTemplate, error) {
		translations := recallCampaignHTMLTranslations(stages, "bad")
		translations[1]["zh"] = RecallEmailTemplate{
			Subject:  "zh:bad:HTML offer",
			BodyHTML: strings.Replace(validRecallHTML, `href="{{.ClaimURL}}"`, `href="https://flatkey.ai/help"`, 1),
		}
		return translations, nil
	}
	service := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	service.now = func() time.Time { return now }
	draft := validRecallCampaignDraft(now)
	draft.Emails[0].Templates["en"] = RecallEmailTemplate{Subject: "HTML offer", BodyHTML: validRecallHTML}

	campaign, err := service.SaveDraft(context.Background(), 7, draft)

	require.ErrorContains(t, err, "ClaimURL action must appear in an anchor href")
	require.Nil(t, campaign)
	var count int64
	require.NoError(t, db.Model(&model.RecallCampaign{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestRecallCampaignSaveDraftIgnoresClientSubmittedNonEnglishTemplates(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 21, 9, 0, 0, 0, time.UTC)
	translator := &recallCampaignFakeEmailTranslator{}
	service := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	service.now = func() time.Time { return now }
	draft := validRecallCampaignDraft(now)
	draft.Emails[0].Templates = map[string]RecallEmailTemplate{
		" EN ": {Subject: "Come back", BodyText: "A Stripe offer is waiting."},
		"fr":   {Subject: "", BodyText: "forged"},
		"xx":   {Subject: "forged\r\nheader", BodyText: strings.Repeat("x", recallEmailBodyMaxRunes+1)},
	}

	campaign, err := service.SaveDraft(context.Background(), 7, draft)

	require.NoError(t, err)
	require.Equal(t, 1, translator.callCount())
	require.Equal(t, map[string]RecallEmailTemplate{
		"en": {Subject: "Come back", BodyText: "A Stripe offer is waiting."},
	}, translator.calls[0][0].Templates)
	var stages []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(campaign.EmailSequenceConfig), &stages))
	requireRecallCampaignCanonicalLanguages(t, stages)
	require.Equal(t, "fr:Come back", stages[0].Templates["fr"].Subject)
	require.NotEqual(t, "forged", stages[0].Templates["fr"].BodyText)
}

func TestRecallCampaignActivatedTranslatedEmailUpdateIncrementsVersionOnce(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 21, 9, 0, 0, 0, time.UTC)
	translator := &recallCampaignFakeEmailTranslator{}
	service := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}), translator)
	service.now = func() time.Time { return now }
	draft := validRecallCampaignDraft(now)
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 9001, EligibilitySnapshot: `{}`, EmailSnapshot: "snapshot@example.com", LanguageSnapshot: "fr", State: model.RecallRecipientContacting}
	require.NoError(t, db.Create(&recipient).Error)
	messageSnapshot, err := common.Marshal(map[string]RecallEmailTemplate{
		"fr": {Subject: "old snapshot", BodyHTML: validRecallHTML},
	})
	require.NoError(t, err)
	message := model.RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: string(messageSnapshot), State: model.RecallMessageScheduled}
	require.NoError(t, db.Create(&message).Error)
	draft.Emails[0].Templates["en"] = RecallEmailTemplate{Subject: "Updated once", BodyText: "Updated body once"}

	updated, err := service.UpdateDraft(context.Background(), 7, campaign.Id, draft)

	require.NoError(t, err)
	require.Equal(t, 2, translator.callCount())
	var stages []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(updated.EmailSequenceConfig), &stages))
	require.Equal(t, 2, stages[0].TemplateVersion)
	require.Equal(t, "es:Updated once", stages[0].Templates["es"].Subject)
	var preserved model.RecallMessage
	require.NoError(t, db.First(&preserved, message.Id).Error)
	require.Equal(t, message.TemplateSnapshot, preserved.TemplateSnapshot)
	require.Equal(t, 1, preserved.TemplateVersion)

	draft.Name = "Only rename"
	updated, err = service.UpdateDraft(context.Background(), 7, campaign.Id, draft)
	require.NoError(t, err)
	require.Equal(t, 2, translator.callCount(), "same English content must not be translated again")
	require.NoError(t, common.Unmarshal([]byte(updated.EmailSequenceConfig), &stages))
	require.Equal(t, 2, stages[0].TemplateVersion, "name-only edits must not bump template version")

	draft.Name = "Second active template update"
	draft.Emails[0].Templates["en"] = RecallEmailTemplate{Subject: "Updated twice", BodyText: "Updated body twice"}
	updated, err = service.UpdateDraft(context.Background(), 7, campaign.Id, draft)
	require.NoError(t, err)
	require.NoError(t, common.Unmarshal([]byte(updated.EmailSequenceConfig), &stages))
	require.Equal(t, 3, stages[0].TemplateVersion)
	require.NoError(t, db.First(&preserved, message.Id).Error)
	require.Equal(t, message.TemplateSnapshot, preserved.TemplateSnapshot)
	require.Equal(t, 1, preserved.TemplateVersion)
}

func TestRecallCampaignActivatedEmailUpdateUsesCampaignNameForEmptySubject(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 21, 9, 0, 0, 0, time.UTC)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	draft := validRecallCampaignDraft(now)
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	draft.Name = "Active campaign fallback"
	template := draft.Emails[0].Templates["en"]
	template.Subject = " "
	draft.Emails[0].Templates["en"] = template

	updated, err := service.UpdateDraft(context.Background(), 7, campaign.Id, draft)

	require.NoError(t, err)
	storedDraft, err := recallCampaignDraftFromModel(updated)
	require.NoError(t, err)
	require.Equal(t, "Active campaign fallback", storedDraft.Emails[0].Templates["en"].Subject)
}

func TestRecallCampaignActivationSnapshotsTopUpDisplayAmount(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 21, 9, 0, 0, 0, time.UTC)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, validRecallCampaignDraft(now))
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)

	setting.StripeTopUpPriceIds = ""
	setting.StripePriceId = ""
	setting.StripePriceId20 = ""
	setting.StripePriceId200 = ""
	productSummary, err := recallEmailProductSummary(stored.ProductScope, "en")

	require.NoError(t, err)
	require.Equal(t, "Top-ups: 10 USD", productSummary)
	require.NotContains(t, productSummary, "price_topup")
}

func TestRecallCampaignConcurrentEmailEditsUseConfigRevisionFenceAfterTranslation(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 21, 9, 0, 0, 0, time.UTC)
	arrived := make(chan struct{}, 2)
	release := make(chan struct{})
	translator := &recallCampaignFakeEmailTranslator{}
	translator.translateFn = func(stages []RecallEmailStage) (map[int]map[string]RecallEmailTemplate, error) {
		if strings.Contains(stages[0].Templates["en"].Subject, "concurrent") {
			arrived <- struct{}{}
			<-release
		}
		return recallCampaignTestTranslations(stages), nil
	}
	service := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}), translator)
	service.now = func() time.Time { return now }
	draft := validRecallCampaignDraft(now)
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))

	makeEdit := func(subject string) RecallCampaignDraft {
		edit := validRecallCampaignDraft(now)
		edit.Emails[0].Templates["en"] = RecallEmailTemplate{Subject: subject, BodyText: subject + " body"}
		return edit
	}
	edits := []RecallCampaignDraft{makeEdit("First concurrent edit"), makeEdit("Second concurrent edit")}
	errs := make(chan error, len(edits))
	for i := range edits {
		edit := edits[i]
		go func() {
			_, updateErr := service.UpdateDraft(context.Background(), 7, campaign.Id, edit)
			errs <- updateErr
		}()
	}
	<-arrived
	<-arrived
	close(release)

	results := []error{<-errs, <-errs}
	successes := 0
	for _, updateErr := range results {
		if updateErr == nil {
			successes++
		}
	}
	require.Equal(t, 1, successes)
	require.Equal(t, 3, translator.callCount(), "both contenders may translate before the database fence")
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.EqualValues(t, 2, stored.ConfigRevision)
	var stages []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(stored.EmailSequenceConfig), &stages))
	winner := stages[0].Templates["en"].Subject
	require.Contains(t, []string{"First concurrent edit", "Second concurrent edit"}, winner)
	require.Equal(t, "ja:"+winner, stages[0].Templates["ja"].Subject)
	require.Equal(t, 2, stages[0].TemplateVersion)
}

func TestRecallCampaignSaveDraftRejectsInvalidEnglishTemplateBoundaries(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*RecallEmailTemplate)
		want   string
	}{
		{name: "subject too long", mutate: func(template *RecallEmailTemplate) {
			template.Subject = strings.Repeat("界", recallEmailSubjectMaxRunes+1)
		}, want: "subject"},
		{name: "body too long", mutate: func(template *RecallEmailTemplate) {
			template.BodyText = strings.Repeat("界", recallEmailBodyMaxRunes+1)
		}, want: "body"},
		{name: "subject CRLF", mutate: func(template *RecallEmailTemplate) { template.Subject = "hello\r\nBcc: forged@example.com" }, want: "single line"},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			db := setupRecallCampaignTestDB(t)
			setRecallCampaignEnabled(t, true)
			now := time.Date(2026, 7, 21, 9, 0, 0, 0, time.UTC)
			service := NewRecallCampaignService(NewRecallAudienceSelector(), nil)
			service.now = func() time.Time { return now }
			draft := validRecallCampaignDraft(now)
			template := draft.Emails[0].Templates["en"]
			testCase.mutate(&template)
			draft.Emails[0].Templates["en"] = template

			campaign, err := service.SaveDraft(context.Background(), 7, draft)

			require.ErrorContains(t, err, testCase.want)
			require.Nil(t, campaign)
			var count int64
			require.NoError(t, db.Model(&model.RecallCampaign{}).Count(&count).Error)
			require.Zero(t, count)
		})
	}
}

func TestNormalizeRecallEmailTemplateRequiresExactlyOneBody(t *testing.T) {
	tests := []struct {
		name     string
		template RecallEmailTemplate
		wantErr  string
	}{
		{
			name:     "accepts text body",
			template: RecallEmailTemplate{Subject: "Return", BodyText: "Plain offer body"},
		},
		{
			name:     "accepts html body",
			template: RecallEmailTemplate{Subject: "Return", BodyHTML: validRecallHTML},
		},
		{
			name:     "rejects neither body",
			template: RecallEmailTemplate{Subject: "Return"},
			wantErr:  "requires exactly one of body_text or body_html",
		},
		{
			name:     "rejects both bodies",
			template: RecallEmailTemplate{Subject: "Return", BodyText: "Plain offer body", BodyHTML: validRecallHTML},
			wantErr:  "requires exactly one of body_text or body_html",
		},
		{
			name:     "rejects invalid html",
			template: RecallEmailTemplate{Subject: "Return", BodyHTML: `<html><body><p>No required links</p></body></html>`},
			wantErr:  `stage 2 language "en" body_html`,
		},
		{
			name:     "text body keeps rune limit",
			template: RecallEmailTemplate{Subject: "Return", BodyText: strings.Repeat("界", recallEmailBodyMaxRunes+1)},
			wantErr:  "body must contain at most",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			got, err := normalizeRecallEmailTemplate(2, "en", testCase.template)

			if testCase.wantErr == "" {
				require.NoError(t, err)
				require.Equal(t, strings.TrimSpace(testCase.template.Subject), got.Subject)
				require.Equal(t, strings.TrimSpace(testCase.template.BodyText), got.BodyText)
				require.Equal(t, strings.TrimSpace(testCase.template.BodyHTML), got.BodyHTML)
				return
			}
			require.ErrorContains(t, err, testCase.wantErr)
		})
	}
}

func TestRecallCampaignSaveDraftRejectsInvalidBoundaries(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), nil)
	service.now = func() time.Time { return now }

	tests := []struct {
		name   string
		mutate func(*RecallCampaignDraft)
	}{
		{name: "empty name", mutate: func(d *RecallCampaignDraft) { d.Name = " " }},
		{name: "unknown audience", mutate: func(d *RecallCampaignDraft) { d.AudienceTemplate = "custom" }},
		{name: "unknown group mode", mutate: func(d *RecallCampaignDraft) {
			d.Audience.Groups = []string{"plg"}
			d.Audience.GroupMode = "include"
		}},
		{name: "unknown execution mode", mutate: func(d *RecallCampaignDraft) { d.ExecutionMode = "cron" }},
		{name: "unknown coupon source", mutate: func(d *RecallCampaignDraft) { d.CouponSource = "local" }},
		{name: "unknown discount type", mutate: func(d *RecallCampaignDraft) { d.Discount.Type = "credit" }},
		{name: "automatic fixed coupon lacks currency options", mutate: func(d *RecallCampaignDraft) {
			d.Discount = RecallDiscountConfig{Type: "fixed", AmountOff: 500, Currency: "usd"}
		}},
		{name: "automatic coupon has existing id", mutate: func(d *RecallCampaignDraft) { d.ExistingCouponID = "coupon_existing" }},
		{name: "existing coupon lacks id", mutate: func(d *RecallCampaignDraft) { d.CouponSource = "existing" }},
		{name: "no prices", mutate: func(d *RecallCampaignDraft) { d.Products = RecallProductScope{} }},
		{name: "zero validity", mutate: func(d *RecallCampaignDraft) { d.PromotionValidSeconds = 0 }},
		{name: "zero enrollment", mutate: func(d *RecallCampaignDraft) { d.EnrollmentLimit = 0 }},
		{name: "too much enrollment", mutate: func(d *RecallCampaignDraft) { d.EnrollmentLimit = 100001 }},
		{name: "zero concurrency", mutate: func(d *RecallCampaignDraft) { d.WorkerConcurrency = 0 }},
		{name: "too much concurrency", mutate: func(d *RecallCampaignDraft) { d.WorkerConcurrency = 21 }},
		{name: "no email stages", mutate: func(d *RecallCampaignDraft) { d.Emails = nil }},
		{name: "too many email stages", mutate: func(d *RecallCampaignDraft) {
			d.Emails = append(d.Emails, d.Emails[0], d.Emails[0], d.Emails[0])
		}},
		{name: "duplicate stage number", mutate: func(d *RecallCampaignDraft) {
			d.Emails = append(d.Emails, RecallEmailStage{StageNo: 1, DelaySeconds: 10, Templates: d.Emails[0].Templates})
		}},
		{name: "stage one delay", mutate: func(d *RecallCampaignDraft) { d.Emails[0].DelaySeconds = 1 }},
		{name: "stage delay not increasing", mutate: func(d *RecallCampaignDraft) {
			d.Emails = append(d.Emails, RecallEmailStage{StageNo: 2, DelaySeconds: 0, Templates: d.Emails[0].Templates})
		}},
		{name: "missing english", mutate: func(d *RecallCampaignDraft) {
			d.Emails[0].Templates = map[string]RecallEmailTemplate{"zh": {Subject: "回来", BodyText: "优惠"}}
		}},
		{name: "scheduled once is not future", mutate: func(d *RecallCampaignDraft) {
			d.ExecutionMode = "scheduled_once"
			d.Schedule.ScheduledAt = now.Unix()
		}},
		{name: "recurring invalid timezone", mutate: func(d *RecallCampaignDraft) {
			d.ExecutionMode = "recurring"
			d.Schedule = RecallScheduleConfig{Timezone: "Mars/Olympus", Frequency: "daily", Hour: 9}
		}},
		{name: "recurring invalid frequency", mutate: func(d *RecallCampaignDraft) {
			d.ExecutionMode = "recurring"
			d.Schedule = RecallScheduleConfig{Timezone: "Asia/Shanghai", Frequency: "monthly", Hour: 9}
		}},
		{name: "recurring invalid hour", mutate: func(d *RecallCampaignDraft) {
			d.ExecutionMode = "recurring"
			d.Schedule = RecallScheduleConfig{Timezone: "Asia/Shanghai", Frequency: "daily", Hour: 24}
		}},
		{name: "recurring invalid minute", mutate: func(d *RecallCampaignDraft) {
			d.ExecutionMode = "recurring"
			d.Schedule = RecallScheduleConfig{Timezone: "Asia/Shanghai", Frequency: "daily", Hour: 9, Minute: 60}
		}},
		{name: "weekly invalid weekday", mutate: func(d *RecallCampaignDraft) {
			d.ExecutionMode = "recurring"
			d.Schedule = RecallScheduleConfig{Timezone: "Asia/Shanghai", Frequency: "weekly", Weekday: 7, Hour: 9}
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			draft := validRecallCampaignDraft(now)
			tt.mutate(&draft)
			_, err := service.SaveDraft(context.Background(), 7, draft)
			require.Error(t, err)
		})
	}
}

func TestRecallCampaignSaveDraftUsesCampaignNameForEmptySubject(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), nil)
	service.now = func() time.Time { return now }
	draft := validRecallCampaignDraft(now)
	draft.Name = "  Summer return offer  "
	template := draft.Emails[0].Templates["en"]
	template.Subject = " "
	draft.Emails[0].Templates["en"] = template

	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	storedDraft, err := recallCampaignDraftFromModel(campaign)
	require.NoError(t, err)
	require.Equal(t, "Summer return offer", storedDraft.Name)
	require.Equal(t, "Summer return offer", storedDraft.Emails[0].Templates["en"].Subject)
}

func TestNextRecallRunUsesIANAWallClock(t *testing.T) {
	after := time.Date(2026, 7, 15, 0, 30, 0, 0, time.UTC)

	daily, err := NextRecallRun(after, RecallScheduleConfig{
		Timezone:  "Asia/Shanghai",
		Frequency: "daily",
		Hour:      9,
	})
	require.NoError(t, err)
	require.Equal(t, time.Date(2026, 7, 15, 1, 0, 0, 0, time.UTC), daily)

	nextDay, err := NextRecallRun(daily, RecallScheduleConfig{
		Timezone:  "Asia/Shanghai",
		Frequency: "daily",
		Hour:      9,
	})
	require.NoError(t, err)
	require.Equal(t, time.Date(2026, 7, 16, 1, 0, 0, 0, time.UTC), nextDay)

	weekly, err := NextRecallRun(after, RecallScheduleConfig{
		Timezone:  "Asia/Shanghai",
		Frequency: "weekly",
		Weekday:   int(time.Friday),
		Hour:      9,
		Minute:    15,
	})
	require.NoError(t, err)
	require.Equal(t, time.Date(2026, 7, 17, 1, 15, 0, 0, time.UTC), weekly)

	beforeSpringForward := time.Date(2026, 3, 8, 5, 0, 0, 0, time.UTC)
	missingWallClock, err := NextRecallRun(beforeSpringForward, RecallScheduleConfig{
		Timezone:  "America/New_York",
		Frequency: "daily",
		Hour:      2,
		Minute:    30,
	})
	require.NoError(t, err)
	require.Equal(t, time.Date(2026, 3, 9, 6, 30, 0, 0, time.UTC), missingWallClock)
}

func TestNextRecallRunRejectsInvalidSchedule(t *testing.T) {
	after := time.Date(2026, 7, 15, 0, 30, 0, 0, time.UTC)
	for _, cfg := range []RecallScheduleConfig{
		{Timezone: "", Frequency: "daily", Hour: 9},
		{Timezone: "Local", Frequency: "daily", Hour: 9},
		{Timezone: "Mars/Olympus", Frequency: "daily", Hour: 9},
		{Timezone: "UTC", Frequency: "monthly", Hour: 9},
		{Timezone: "UTC", Frequency: "daily", Hour: -1},
		{Timezone: "UTC", Frequency: "daily", Minute: 60},
		{Timezone: "UTC", Frequency: "weekly", Weekday: 7, Hour: 9},
	} {
		_, err := NextRecallRun(after, cfg)
		require.Error(t, err, "%+v", cfg)
	}
}

func TestRecallCampaignPreviewIsReadOnly(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "preview")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	calls := &recallCampaignStripeCalls{}
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, calls))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)

	audience, stripePreview, err := service.Preview(context.Background(), campaign.Id, 5)

	require.NoError(t, err)
	require.EqualValues(t, 1, audience.EligibleTotal)
	require.Equal(t, []string{"prod_topup"}, stripePreview.ProductIDs)
	require.Equal(t, 1, calls.getPrice)
	require.Zero(t, calls.createCoupon)
	require.Zero(t, calls.createCustomer)
	require.Zero(t, calls.createPromotionCode)
	var recipientCount int64
	var messageCount int64
	require.NoError(t, db.Model(&model.RecallRecipient{}).Count(&recipientCount).Error)
	require.NoError(t, db.Model(&model.RecallMessage{}).Count(&messageCount).Error)
	require.Zero(t, recipientCount)
	require.Zero(t, messageCount)
}

func TestRecallCampaignPreviewValidatesExistingCouponWithGET(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "existing-preview")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	draft.CouponSource = "existing"
	draft.ExistingCouponID = "coupon_existing"
	calls := &recallCampaignStripeCalls{}
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, calls))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)

	_, preview, err := service.Preview(context.Background(), campaign.Id, 1)

	require.NoError(t, err)
	require.Equal(t, "coupon_existing", preview.CouponID)
	require.Equal(t, 1, calls.getCoupon)
	require.Zero(t, calls.createCoupon)
}

func TestRecallCampaignActivationSupportsSpecifiedUsersWithoutWidening(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	idOnly := createRecallAudienceUser(t, db, now.Unix(), "activation_specified_id", nil)
	emailOnly := createRecallAudienceUser(t, db, now.Unix(), "activation_specified_email", nil)
	createRecallAudienceUser(t, db, now.Unix(), "activation_specified_unlisted", nil)
	calls := &recallCampaignStripeCalls{}
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, calls))
	service.now = func() time.Time { return now }

	draft := validRecallCampaignDraft(now)
	draft.AudienceTemplate = "specified_users"
	draft.Audience = RecallAudienceConfig{
		SpecifiedUserIDs: []int{idOnly.Id, 999_999},
		SpecifiedEmails:  []string{strings.ToUpper(emailOnly.Email), "missing@example.com"},
	}
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)

	audiencePreview, _, err := service.Preview(context.Background(), campaign.Id, 10)
	require.NoError(t, err)
	require.EqualValues(t, 3, audiencePreview.EligibleTotal)
	require.Len(t, audiencePreview.Sample, 3)
	require.Equal(t, []int{idOnly.Id, emailOnly.Id, 0}, []int{
		audiencePreview.Sample[0].UserID,
		audiencePreview.Sample[1].UserID,
		audiencePreview.Sample[2].UserID,
	})
	require.Contains(t, audiencePreview.Sample[2].EmailMasked, "@example.com")

	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))

	require.Equal(t, 2, calls.getPrice)
	require.Equal(t, 1, calls.createCoupon)
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignRunning, stored.Status)
	var recipients []model.RecallRecipient
	require.NoError(t, db.Order("user_id ASC, id ASC").Find(&recipients).Error)
	require.Len(t, recipients, 3)
	recipientsByIdentity := make(map[string]model.RecallRecipient, len(recipients))
	for _, recipient := range recipients {
		recipientsByIdentity[recipient.RecipientIdentity] = recipient
		require.NotContains(t, recipient.EligibilitySnapshot, "999999")
	}
	idRecipient := recipientsByIdentity[model.RecallRecipientIdentityForUser(idOnly.Id)]
	require.Equal(t, idOnly.Id, idRecipient.UserId)
	require.Equal(t, strings.ToLower(idOnly.Email), idRecipient.EmailSnapshot)
	emailRecipient := recipientsByIdentity[model.RecallRecipientIdentityForUser(emailOnly.Id)]
	require.Equal(t, emailOnly.Id, emailRecipient.UserId)
	require.Equal(t, strings.ToLower(emailOnly.Email), emailRecipient.EmailSnapshot)
	externalRecipient := recipientsByIdentity[model.RecallRecipientIdentityForEmail("missing@example.com")]
	require.Zero(t, externalRecipient.UserId)
	require.Equal(t, "missing@example.com", externalRecipient.EmailSnapshot)
	require.Contains(t, externalRecipient.EligibilitySnapshot, `"user_id":0`)
	var messageCount int64
	require.NoError(t, db.Model(&model.RecallMessage{}).Count(&messageCount).Error)
	require.Zero(t, messageCount)
}

func TestRecallCampaignActivationSupportsRegisteredOnlyWithoutWidening(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	startAt := now.Add(-2 * time.Hour).Unix()
	endAt := now.Add(-time.Hour).Unix()
	eligible := createRecallAudienceUser(t, db, now.Unix(), "activation_registered_eligible", func(user *model.User) {
		user.CreatedAt = startAt
		user.RequestCount = 0
	})
	createRecallAudienceUser(t, db, now.Unix(), "activation_registered_used", func(user *model.User) {
		user.CreatedAt = startAt
		user.RequestCount = 1
	})
	createRecallAudienceUser(t, db, now.Unix(), "activation_registered_outside", func(user *model.User) {
		user.CreatedAt = endAt + 1
		user.RequestCount = 0
	})
	calls := &recallCampaignStripeCalls{}
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, calls))
	service.now = func() time.Time { return now }

	draft := validRecallCampaignDraft(now)
	draft.AudienceTemplate = "registered_only"
	draft.Audience = RecallAudienceConfig{RegistrationStartAt: startAt, RegistrationEndAt: endAt}
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)

	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))

	var recipients []model.RecallRecipient
	require.NoError(t, db.Find(&recipients).Error)
	require.Len(t, recipients, 1)
	require.Equal(t, eligible.Id, recipients[0].UserId)
}

func TestRecallCampaignManualActivationSnapshotsOnce(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "manual")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	calls := &recallCampaignStripeCalls{}
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, calls))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)

	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))

	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignRunning, stored.Status)
	require.Equal(t, "coupon_recall", stored.StripeCouponId)
	require.Equal(t, 1, calls.createCoupon)
	require.Zero(t, calls.createCustomer)
	require.Zero(t, calls.createPromotionCode)
	var recipients []model.RecallRecipient
	require.NoError(t, db.Find(&recipients).Error)
	require.Len(t, recipients, 1)
	require.Equal(t, now.Add(time.Duration(draft.PromotionValidSeconds)*time.Second).Unix(), recipients[0].PromotionExpiresAt)
	var messages []model.RecallMessage
	require.NoError(t, db.Find(&messages).Error)
	require.Empty(t, messages, "stage one is scheduled only after the recipient reaches code_ready")
	var events []model.RecallEvent
	require.NoError(t, db.Find(&events).Error)
	require.Len(t, events, 1)
	require.Equal(t, fmt.Sprintf("manual:%d", campaign.Id), events[0].SourceEventId)
}

func TestRecallCampaignActivationUsesOneTimestamp(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "activation-time")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)

	clockCalls := 0
	service.now = func() time.Time {
		current := now.Add(time.Duration(clockCalls) * time.Second)
		clockCalls++
		return current
	}
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))

	require.Equal(t, 1, clockCalls)
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, now.Unix(), stored.ActivatedAt)
	var recipient model.RecallRecipient
	require.NoError(t, db.First(&recipient).Error)
	require.Equal(t, now.Add(time.Duration(draft.PromotionValidSeconds)*time.Second).Unix(), recipient.PromotionExpiresAt)
	var messageCount int64
	require.NoError(t, db.Model(&model.RecallMessage{}).Count(&messageCount).Error)
	require.Zero(t, messageCount)
}

func TestRecallCampaignActivationRejectsStaleConfigRevisionAndRetriesWithNewStripeKey(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	draft := validRecallCampaignDraft(now)
	draft.ExecutionMode = "scheduled_once"
	draft.Schedule.ScheduledAt = now.Add(time.Hour).Unix()
	started := make(chan struct{}, 1)
	release := make(chan struct{})
	calls := &recallCampaignStripeCalls{
		createCouponStarted: started,
		createCouponRelease: release,
		couponIDs:           []string{"coupon_revision_1", "coupon_revision_2"},
	}
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, calls))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.EqualValues(t, 1, campaign.ConfigRevision)

	activationErr := make(chan error, 1)
	go func() {
		activationErr <- service.Activate(context.Background(), 7, campaign.Id)
	}()
	<-started

	updatedDraft := draft
	updatedDraft.Name = "Revision two"
	updatedDraft.Audience.MaxQuota--
	updated, err := service.UpdateDraft(context.Background(), 7, campaign.Id, updatedDraft)
	require.NoError(t, err)
	require.EqualValues(t, 2, updated.ConfigRevision)
	close(release)

	require.Error(t, <-activationErr)
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignDraft, stored.Status)
	require.Equal(t, "Revision two", stored.Name)
	require.Empty(t, stored.StripeCouponId)
	require.Equal(t, []string{fmt.Sprintf("recall_coupon:%d:1", campaign.Id)}, calls.couponKeys)

	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	stored, err = model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignScheduled, stored.Status)
	require.Equal(t, "coupon_revision_2", stored.StripeCouponId)
	require.Equal(t, []string{
		fmt.Sprintf("recall_coupon:%d:1", campaign.Id),
		fmt.Sprintf("recall_coupon:%d:2", campaign.Id),
	}, calls.couponKeys)
}

func TestRecallCampaignScheduledOnceWaitsUntilDue(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "scheduled")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	draft.ExecutionMode = "scheduled_once"
	draft.Schedule = RecallScheduleConfig{ScheduledAt: now.Add(time.Hour).Unix()}
	calls := &recallCampaignStripeCalls{}
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, calls))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	require.NoError(t, service.Pause(context.Background(), 7, campaign.Id))
	require.NoError(t, service.Resume(context.Background(), 7, campaign.Id))

	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignRunning, stored.Status)
	processed, err := service.RunDueCampaigns(context.Background(), now.Add(59*time.Minute), 10)
	require.NoError(t, err)
	require.Zero(t, processed)
	var count int64
	require.NoError(t, db.Model(&model.RecallRecipient{}).Count(&count).Error)
	require.Zero(t, count)

	processed, err = service.RunDueCampaigns(context.Background(), now.Add(time.Hour), 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	stored, err = model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignRunning, stored.Status)
	require.NoError(t, db.Model(&model.RecallRecipient{}).Count(&count).Error)
	require.EqualValues(t, 1, count)
}

func TestRecallCampaignScheduledOnceRunRequiresOriginalNextRunFence(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "scheduled-fence")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	draft.ExecutionMode = "scheduled_once"
	draft.Schedule.ScheduledAt = now.Add(time.Hour).Unix()
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	stale, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	replacementNextRunAt := stale.NextRunAt + 60
	require.NoError(t, db.Model(&model.RecallCampaign{}).
		Where("id = ?", campaign.Id).
		Update("next_run_at", replacementNextRunAt).Error)

	committed, err := service.runDueCampaign(context.Background(), stale, time.Unix(stale.NextRunAt, 0))

	require.NoError(t, err)
	require.False(t, committed)
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignScheduled, stored.Status)
	require.Equal(t, replacementNextRunAt, stored.NextRunAt)
	var eventCount int64
	require.NoError(t, db.Model(&model.RecallEvent{}).Count(&eventCount).Error)
	require.Zero(t, eventCount)
}

func TestRecallCampaignScheduledRunRejectsStaleConfigRevision(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "scheduled-config-revision")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	draft.ExecutionMode = "scheduled_once"
	draft.Schedule.ScheduledAt = now.Add(time.Hour).Unix()
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	stale, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.EqualValues(t, 1, stale.ConfigRevision)

	emailChange := draft
	emailChange.Emails[0].Templates["en"] = RecallEmailTemplate{Subject: "Revision two", BodyText: "New body"}
	updated, err := service.UpdateDraft(context.Background(), 7, campaign.Id, emailChange)
	require.NoError(t, err)
	require.EqualValues(t, 2, updated.ConfigRevision)

	committed, err := service.runDueCampaign(context.Background(), stale, time.Unix(stale.NextRunAt, 0))

	require.NoError(t, err)
	require.False(t, committed)
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignScheduled, stored.Status)
	require.Equal(t, stale.NextRunAt, stored.NextRunAt)
	for _, table := range []any{&model.RecallRecipient{}, &model.RecallMessage{}, &model.RecallEvent{}} {
		var count int64
		require.NoError(t, db.Model(table).Count(&count).Error)
		require.Zero(t, count)
	}
}

func TestRecallCampaignRunEventConflictDoesNotCountProcessed(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "scheduled-event-owner")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	draft.ExecutionMode = "scheduled_once"
	draft.Schedule.ScheduledAt = now.Add(time.Hour).Unix()
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	require.NoError(t, db.Create(&model.RecallEvent{
		CampaignId:    campaign.Id,
		EventType:     "campaign_run",
		Source:        "scheduler",
		SourceEventId: fmt.Sprintf("scheduled_once:%d:%d", campaign.Id, draft.Schedule.ScheduledAt),
		EventData:     `{}`,
	}).Error)

	processed, err := service.RunDueCampaigns(context.Background(), now.Add(time.Hour), 10)

	require.NoError(t, err)
	require.Zero(t, processed)
	var recipientCount int64
	require.NoError(t, db.Model(&model.RecallRecipient{}).Count(&recipientCount).Error)
	require.Zero(t, recipientCount)
}

func TestRecallCampaignActivationRejectsScheduledRunAtCouponRedeemBy(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	draft := validRecallCampaignDraft(now)
	draft.ExecutionMode = "scheduled_once"
	draft.Schedule.ScheduledAt = now.Add(time.Hour).Unix()
	draft.Discount.CouponRedeemBy = draft.Schedule.ScheduledAt
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)

	err = service.Activate(context.Background(), 7, campaign.Id)

	require.Error(t, err)
	stored, getErr := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, getErr)
	require.Equal(t, model.RecallCampaignDraft, stored.Status)
}

func TestRecallCampaignRecurringRunUsesDeterministicEventKey(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 0, 30, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "recurring")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	draft.ExecutionMode = "recurring"
	draft.Schedule = RecallScheduleConfig{Timezone: "Asia/Shanghai", Frequency: "daily", Hour: 9}
	calls := &recallCampaignStripeCalls{}
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, calls))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	firstRunAt := stored.NextRunAt
	require.Equal(t, time.Date(2026, 7, 16, 1, 0, 0, 0, time.UTC).Unix(), firstRunAt)

	processed, err := service.RunDueCampaigns(context.Background(), time.Unix(firstRunAt, 0), 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	processed, err = service.RunDueCampaigns(context.Background(), time.Unix(firstRunAt, 0), 10)
	require.NoError(t, err)
	require.Zero(t, processed)

	var recipientCount int64
	var messageCount int64
	require.NoError(t, db.Model(&model.RecallRecipient{}).Count(&recipientCount).Error)
	require.NoError(t, db.Model(&model.RecallMessage{}).Count(&messageCount).Error)
	require.EqualValues(t, 1, recipientCount)
	require.Zero(t, messageCount)
	var event model.RecallEvent
	require.NoError(t, db.First(&event).Error)
	require.Equal(t, fmt.Sprintf("recurring:%d:%d", campaign.Id, firstRunAt), event.SourceEventId)
	stored, err = model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignRunning, stored.Status)
	require.Equal(t, time.Date(2026, 7, 17, 1, 0, 0, 0, time.UTC).Unix(), stored.NextRunAt)
}

func TestRecallCampaignRecurringStopsSchedulingAfterLastValidRun(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 0, 30, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "recurring-redeem-by")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	draft.ExecutionMode = "recurring"
	draft.Schedule = RecallScheduleConfig{Timezone: "Asia/Shanghai", Frequency: "daily", Hour: 9}
	draft.Discount.CouponRedeemBy = time.Date(2026, 7, 17, 1, 0, 0, 0, time.UTC).Unix()
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)

	processed, err := service.RunDueCampaigns(context.Background(), time.Unix(stored.NextRunAt, 0), 10)

	require.NoError(t, err)
	require.Equal(t, 1, processed)
	stored, err = model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignRunning, stored.Status)
	require.Zero(t, stored.NextRunAt)
	require.Zero(t, stored.CompletedAt)
	var recipient model.RecallRecipient
	require.NoError(t, db.First(&recipient).Error)
	require.Equal(t, model.RecallRecipientQueued, recipient.State)
	var messageCount int64
	require.NoError(t, db.Model(&model.RecallMessage{}).Count(&messageCount).Error)
	require.Zero(t, messageCount)
}

func TestRecallCampaignDueRunCompletesWhenCouponRedeemByAlreadyReached(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "late-redeem-by")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	draft.ExecutionMode = "scheduled_once"
	draft.Schedule.ScheduledAt = now.Add(time.Hour).Unix()
	draft.Discount.CouponRedeemBy = now.Add(90 * time.Minute).Unix()
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))

	processed, err := service.RunDueCampaigns(context.Background(), time.Unix(draft.Discount.CouponRedeemBy, 0), 10)

	require.NoError(t, err)
	require.Zero(t, processed)
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignCompleted, stored.Status)
	require.Zero(t, stored.NextRunAt)
	for _, table := range []any{&model.RecallRecipient{}, &model.RecallMessage{}, &model.RecallEvent{}} {
		var count int64
		require.NoError(t, db.Model(table).Count(&count).Error)
		require.Zero(t, count)
	}
}

func TestRecallCampaignDueRunIsolatesPermanentCampaignErrorAndStopsPoison(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "due-error-isolation")
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }

	createScheduled := func(name string) *model.RecallCampaign {
		draft := validRecallCampaignDraft(now)
		draft.Name = name
		draft.Audience.LastAPICallAgeDays = 0
		draft.ExecutionMode = "scheduled_once"
		draft.Schedule.ScheduledAt = now.Add(time.Hour).Unix()
		campaign, err := service.SaveDraft(context.Background(), 7, draft)
		require.NoError(t, err)
		require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
		return campaign
	}
	poisoned := createScheduled("Poisoned")
	healthy := createScheduled("Healthy")
	require.NoError(t, db.Model(&model.RecallCampaign{}).
		Where("id = ?", poisoned.Id).
		Update("email_sequence_config", `{`).Error)

	processed, err := service.RunDueCampaigns(context.Background(), now.Add(time.Hour), 10)

	require.Error(t, err)
	require.Equal(t, 1, processed)
	poisonedStored, getErr := model.GetRecallCampaignByID(poisoned.Id)
	require.NoError(t, getErr)
	require.Equal(t, model.RecallCampaignCompleted, poisonedStored.Status)
	require.Zero(t, poisonedStored.NextRunAt)
	healthyStored, getErr := model.GetRecallCampaignByID(healthy.Id)
	require.NoError(t, getErr)
	require.Equal(t, model.RecallCampaignRunning, healthyStored.Status)
	var healthyRecipients int64
	require.NoError(t, db.Model(&model.RecallRecipient{}).Where("campaign_id = ?", healthy.Id).Count(&healthyRecipients).Error)
	require.EqualValues(t, 1, healthyRecipients)
}

func TestRecallCampaignDueRunRecoversPerCampaignPanicAndContinues(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "due-panic-isolation")
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }

	for _, name := range []string{"Panics once", "Still runs"} {
		draft := validRecallCampaignDraft(now)
		draft.Name = name
		draft.Audience.LastAPICallAgeDays = 0
		draft.ExecutionMode = "scheduled_once"
		draft.Schedule.ScheduledAt = now.Add(time.Hour).Unix()
		campaign, err := service.SaveDraft(context.Background(), 7, draft)
		require.NoError(t, err)
		require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	}
	var panicOnce atomic.Bool
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register("recall_due_panic_once", func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "users" && panicOnce.CompareAndSwap(false, true) {
			panic("campaign-scoped test panic")
		}
	}))

	var processed int
	var runErr error
	require.NotPanics(t, func() {
		processed, runErr = service.RunDueCampaigns(context.Background(), now.Add(time.Hour), 10)
	})
	require.Error(t, runErr)
	require.Equal(t, 1, processed)
	var recipientCount int64
	require.NoError(t, db.Model(&model.RecallRecipient{}).Count(&recipientCount).Error)
	require.EqualValues(t, 1, recipientCount)
}

func TestRecallCampaignActivatedUpdateOnlyChangesFutureEmailVersion(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "update")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))

	immutableChanges := []struct {
		name   string
		mutate func(*RecallCampaignDraft)
	}{
		{name: "audience", mutate: func(change *RecallCampaignDraft) { change.Audience.MaxQuota++ }},
		{name: "coupon source and ID", mutate: func(change *RecallCampaignDraft) {
			change.CouponSource = "existing"
			change.ExistingCouponID = "coupon_existing"
		}},
		{name: "discount", mutate: func(change *RecallCampaignDraft) { change.Discount.PercentOff++ }},
		{name: "product scope", mutate: func(change *RecallCampaignDraft) {
			change.Products.TopUpPriceIDs = append(change.Products.TopUpPriceIDs, "price_other")
		}},
		{name: "promotion validity", mutate: func(change *RecallCampaignDraft) { change.PromotionValidSeconds++ }},
	}
	for _, testCase := range immutableChanges {
		t.Run(testCase.name, func(t *testing.T) {
			immutableChange := draft
			testCase.mutate(&immutableChange)
			_, err := service.UpdateDraft(context.Background(), 7, campaign.Id, immutableChange)
			require.Error(t, err)
		})
	}

	emailChange := draft
	emailChange.Emails[0].Templates["en"] = RecallEmailTemplate{Subject: "New subject", BodyText: "New body"}
	updated, err := service.UpdateDraft(context.Background(), 7, campaign.Id, emailChange)
	require.NoError(t, err)
	var stages []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(updated.EmailSequenceConfig), &stages))
	require.Equal(t, 2, stages[0].TemplateVersion)
	var messageCount int64
	require.NoError(t, db.Model(&model.RecallMessage{}).Count(&messageCount).Error)
	require.Zero(t, messageCount)

	emailChange.Emails[0].Templates["en"] = RecallEmailTemplate{Subject: "Third subject", BodyText: "Third body"}
	updated, err = service.UpdateDraft(context.Background(), 7, campaign.Id, emailChange)
	require.NoError(t, err)
	require.NoError(t, common.Unmarshal([]byte(updated.EmailSequenceConfig), &stages))
	require.Equal(t, 3, stages[0].TemplateVersion)
}

func TestRecallCampaignActivatedEmailUpdateIgnoresPastImmutableTimestamps(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	draft := validRecallCampaignDraft(now)
	draft.ExecutionMode = "scheduled_once"
	draft.Schedule.ScheduledAt = now.Add(time.Hour).Unix()
	draft.Discount.CouponRedeemBy = now.Add(2 * time.Hour).Unix()
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))

	discount := draft.Discount
	discount.CouponRedeemBy = 1
	discountJSON, err := common.Marshal(discount)
	require.NoError(t, err)
	require.NoError(t, db.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Updates(map[string]any{
		"scheduled_at":    int64(-1),
		"discount_config": string(discountJSON),
	}).Error)

	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	edit, err := recallCampaignDraftFromModel(stored)
	require.NoError(t, err)
	edit.Emails[0].Templates["en"] = RecallEmailTemplate{Subject: "Updated subject", BodyText: "Updated body"}
	updated, err := service.UpdateDraft(context.Background(), 7, campaign.Id, edit)
	require.NoError(t, err)

	var stages []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(updated.EmailSequenceConfig), &stages))
	require.Equal(t, "Updated subject", stages[0].Templates["en"].Subject)
	require.Equal(t, 2, stages[0].TemplateVersion)
}

func TestRecallCampaignConcurrentEmailEditsUseConfigRevisionFence(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	draft := validRecallCampaignDraft(now)
	draft.ExecutionMode = "scheduled_once"
	draft.Schedule.ScheduledAt = now.Add(time.Hour).Unix()
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))

	arrived := make(chan struct{}, 2)
	release := make(chan struct{})
	var blocked atomic.Int32
	callbackName := "recall_concurrent_email_revision_fence"
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "recall_campaigns" && blocked.Add(1) <= 2 {
			arrived <- struct{}{}
			<-release
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, db.Callback().Update().Remove(callbackName))
	})

	makeEdit := func(subject string) RecallCampaignDraft {
		edit := validRecallCampaignDraft(now)
		edit.ExecutionMode = "scheduled_once"
		edit.Schedule.ScheduledAt = draft.Schedule.ScheduledAt
		edit.Emails[0].Templates["en"] = RecallEmailTemplate{Subject: subject, BodyText: subject + " body"}
		return edit
	}
	edits := []RecallCampaignDraft{makeEdit("First concurrent edit"), makeEdit("Second concurrent edit")}
	errs := make(chan error, len(edits))
	for i := range edits {
		edit := edits[i]
		go func() {
			_, updateErr := service.UpdateDraft(context.Background(), 7, campaign.Id, edit)
			errs <- updateErr
		}()
	}
	<-arrived
	<-arrived
	close(release)

	results := []error{<-errs, <-errs}
	successes := 0
	for _, updateErr := range results {
		if updateErr == nil {
			successes++
		}
	}
	require.Equal(t, 1, successes)
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.EqualValues(t, 2, stored.ConfigRevision)
	var stages []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(stored.EmailSequenceConfig), &stages))
	require.Equal(t, 2, stages[0].TemplateVersion)

	retried, err := service.UpdateDraft(context.Background(), 7, campaign.Id, makeEdit("Retried edit"))
	require.NoError(t, err)
	require.EqualValues(t, 3, retried.ConfigRevision)
	require.NoError(t, common.Unmarshal([]byte(retried.EmailSequenceConfig), &stages))
	require.Equal(t, 3, stages[0].TemplateVersion)
}

func TestRecallCampaignLifecycleIsConditionalIdempotentAndCancelPreservesCode(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "lifecycle")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))

	require.NoError(t, service.Pause(context.Background(), 7, campaign.Id))
	require.NoError(t, service.Pause(context.Background(), 7, campaign.Id))
	require.NoError(t, service.Resume(context.Background(), 7, campaign.Id))
	require.NoError(t, service.Resume(context.Background(), 7, campaign.Id))
	var recipient model.RecallRecipient
	require.NoError(t, db.First(&recipient).Error)
	promotionID := "promo_keep"
	require.NoError(t, db.Model(&recipient).Updates(map[string]any{
		"stripe_promotion_code_id": promotionID,
		"promotion_code":           "FKKEEPCODE",
	}).Error)
	require.NoError(t, db.Create(&model.RecallMessage{
		RecipientId:      recipient.Id,
		StageNo:          1,
		TemplateVersion:  1,
		TemplateSnapshot: `{}`,
		ScheduledAt:      now.Unix(),
		State:            model.RecallMessageRetryWait,
	}).Error)
	require.NoError(t, db.Create(&model.RecallMessage{
		RecipientId:      recipient.Id,
		StageNo:          2,
		TemplateVersion:  1,
		TemplateSnapshot: `{}`,
		ScheduledAt:      now.Add(time.Hour).Unix(),
		State:            model.RecallMessageScheduled,
	}).Error)

	require.NoError(t, service.Cancel(context.Background(), 7, campaign.Id))
	require.NoError(t, service.Cancel(context.Background(), 7, campaign.Id))
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignCancelled, stored.Status)
	require.NoError(t, db.First(&recipient, recipient.Id).Error)
	require.NotNil(t, recipient.StripePromotionCodeId)
	require.Equal(t, promotionID, *recipient.StripePromotionCodeId)
	require.Equal(t, "FKKEEPCODE", recipient.PromotionCode)
	var messages []model.RecallMessage
	require.NoError(t, db.Order("stage_no ASC").Find(&messages).Error)
	require.Len(t, messages, 2)
	require.Equal(t, model.RecallMessageCancelled, messages[0].State)
	require.Equal(t, model.RecallMessageCancelled, messages[1].State)
	require.Error(t, service.Resume(context.Background(), 7, campaign.Id))

	completeDraft := validRecallCampaignDraft(now)
	completeDraft.Name = "Complete me"
	completeCampaign, err := service.SaveDraft(context.Background(), 7, completeDraft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, completeCampaign.Id))
	require.NoError(t, service.Complete(context.Background(), 7, completeCampaign.Id))
	require.NoError(t, service.Complete(context.Background(), 7, completeCampaign.Id))
	completed, err := model.GetRecallCampaignByID(completeCampaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignCompleted, completed.Status)
}

func TestRecallCampaignRetryTreatsOnlyExpiredSendingAsAcknowledgedUncertainty(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_200_000, 0).UTC()
	service := NewRecallCampaignService(nil, nil)
	service.now = func() time.Time { return now }

	recipients := []model.RecallRecipient{
		{CampaignId: 51, UserId: 951, EligibilitySnapshot: `{}`, EmailSnapshot: "expired-sending@example.com", LanguageSnapshot: "en", State: model.RecallRecipientContacting},
		{CampaignId: 51, UserId: 952, EligibilitySnapshot: `{}`, EmailSnapshot: "active-sending@example.com", LanguageSnapshot: "en", State: model.RecallRecipientContacting},
		{CampaignId: 51, UserId: 953, EligibilitySnapshot: `{}`, EmailSnapshot: "missing-sending-lease@example.com", LanguageSnapshot: "en", State: model.RecallRecipientContacting},
	}
	require.NoError(t, db.Create(&recipients).Error)
	messages := []model.RecallMessage{
		{RecipientId: recipients[0].Id, StageNo: 1, TemplateVersion: 4, TemplateSnapshot: `{"en":{"subject":"preserved"}}`, State: model.RecallMessageSending, AttemptCount: 1, LeaseOwner: "crashed-node", LeaseExpiresAt: now.Unix() - 1, UpdatedAt: now.Unix() - 10},
		{RecipientId: recipients[1].Id, StageNo: 1, TemplateVersion: 5, TemplateSnapshot: `{"en":{"subject":"active"}}`, State: model.RecallMessageSending, AttemptCount: 1, LeaseOwner: "live-node", LeaseExpiresAt: now.Unix() + 1, UpdatedAt: now.Unix() - 9},
		{RecipientId: recipients[2].Id, StageNo: 1, TemplateVersion: 6, TemplateSnapshot: `{"en":{"subject":"missing"}}`, State: model.RecallMessageSending, AttemptCount: 1, UpdatedAt: now.Unix() - 8},
	}
	require.NoError(t, db.Create(&messages).Error)
	due, err := model.ListDueRecallMessageIDs(now.Unix(), 10)
	require.NoError(t, err)
	require.NotContains(t, due, messages[0].Id, "an expired sending lease must remain out of automatic scheduling")

	err = service.RetryRecipient(context.Background(), 7, 51, recipients[0].Id, false)
	require.ErrorContains(t, err, "acknowledge_uncertain=true")
	err = service.RetryRecipient(context.Background(), 7, 51, recipients[1].Id, true)
	require.Error(t, err)
	err = service.RetryRecipient(context.Background(), 7, 51, recipients[2].Id, true)
	require.Error(t, err)
	err = service.RetryRecipient(context.Background(), 7, 51, recipients[0].Id, true)
	require.NoError(t, err)

	var retried model.RecallMessage
	require.NoError(t, db.First(&retried, messages[0].Id).Error)
	require.Equal(t, model.RecallMessageRetryWait, retried.State)
	require.Equal(t, now.Unix(), retried.NextAttemptAt)
	require.Equal(t, 4, retried.TemplateVersion)
	require.Equal(t, messages[0].TemplateSnapshot, retried.TemplateSnapshot)
	require.Empty(t, retried.LeaseOwner)
	require.Zero(t, retried.LeaseExpiresAt)

	var active model.RecallMessage
	require.NoError(t, db.First(&active, messages[1].Id).Error)
	require.Equal(t, model.RecallMessageSending, active.State)
	require.Equal(t, "live-node", active.LeaseOwner)

	var events []model.RecallEvent
	require.NoError(t, db.Where("recipient_id = ?", recipients[0].Id).Find(&events).Error)
	require.Len(t, events, 1)
	require.Contains(t, events[0].EventData, `"previous_state":"sending"`)
	require.Contains(t, events[0].EventData, `"acknowledge_uncertain":true`)
	require.Contains(t, events[0].EventData, fmt.Sprintf(`"previous_lease_expires_at":%d`, now.Unix()-1))

	due, err = model.ListDueRecallMessageIDs(now.Unix(), 10)
	require.NoError(t, err)
	require.Contains(t, due, messages[0].Id, "the acknowledged retry must re-enter normal worker scheduling")
	won, err := model.LeaseRecallMessage(messages[0].Id, "next-worker", now.Unix(), now.Unix()+60)
	require.NoError(t, err)
	require.True(t, won)
}

func TestRecallCampaignConfigurationEntryPointsRemainAvailableWhenRuntimeDisabled(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, validRecallCampaignDraft(now))
	require.NoError(t, err)
	loadRecallCampaignEnabled(t, false)

	created, err := service.SaveDraft(context.Background(), 7, validRecallCampaignDraft(now))
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignDraft, created.Status)

	updatedDraft := validRecallCampaignDraft(now)
	updatedDraft.Name = "Editable while recall is paused"
	updated, err := service.UpdateDraft(context.Background(), 7, campaign.Id, updatedDraft)
	require.NoError(t, err)
	require.Equal(t, updatedDraft.Name, updated.Name)

	_, _, err = service.Preview(context.Background(), campaign.Id, 1)
	require.NoError(t, err)
	_, err = service.ValidateStripe(context.Background(), updatedDraft)
	require.NoError(t, err)
}

func TestRecallCampaignExecutionEntryPointsRespectFeatureGate(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, validRecallCampaignDraft(now))
	require.NoError(t, err)
	loadRecallCampaignEnabled(t, false)

	for _, action := range []func(context.Context, int, int64) error{
		service.Activate,
		service.Pause,
		service.Resume,
		service.Cancel,
		service.Complete,
	} {
		require.ErrorIs(t, action(context.Background(), 7, campaign.Id), ErrRecallDisabled)
	}
	_, err = service.RunDueCampaigns(context.Background(), now, 10)
	require.ErrorIs(t, err, ErrRecallDisabled)
	require.True(t, errors.Is(err, ErrRecallDisabled))
}

func TestRecallCampaignRecurringEnrollmentLimitIsCampaignWide(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 0, 30, 0, 0, time.UTC)
	first := createRecallCampaignEligibleUser(t, db, now, "cap-first")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	draft.ExecutionMode = "recurring"
	draft.Schedule = RecallScheduleConfig{Timezone: "Asia/Shanghai", Frequency: "daily", Hour: 9}
	draft.EnrollmentLimit = 1
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, 1, mustRunDueCampaigns(t, service, time.Unix(stored.NextRunAt, 0)))

	require.NoError(t, db.Model(&model.User{}).Where("id = ?", first.Id).Update("status", common.UserStatusDisabled).Error)
	createRecallCampaignEligibleUser(t, db, now.Add(time.Hour), "cap-second")
	stored, err = model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, 1, mustRunDueCampaigns(t, service, time.Unix(stored.NextRunAt, 0)))

	var recipientCount int64
	require.NoError(t, db.Model(&model.RecallRecipient{}).Where("campaign_id = ?", campaign.Id).Count(&recipientCount).Error)
	require.EqualValues(t, 1, recipientCount)
}

func TestRecallCampaignRecurringSkipsAlreadyEnrolledUsersBeforeApplyingRemainingLimit(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 0, 30, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "skip-enrolled-first")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	draft.ExecutionMode = "recurring"
	draft.Schedule = RecallScheduleConfig{Timezone: "Asia/Shanghai", Frequency: "daily", Hour: 9}
	draft.EnrollmentLimit = 2
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, 1, mustRunDueCampaigns(t, service, time.Unix(stored.NextRunAt, 0)))

	second := createRecallCampaignEligibleUser(t, db, now.Add(time.Hour), "skip-enrolled-second")
	stored, err = model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, 1, mustRunDueCampaigns(t, service, time.Unix(stored.NextRunAt, 0)))

	var recipients []model.RecallRecipient
	require.NoError(t, db.Where("campaign_id = ?", campaign.Id).Order("user_id ASC").Find(&recipients).Error)
	require.Len(t, recipients, 2)
	require.Equal(t, second.Id, recipients[1].UserId)
}

func TestRecallCampaignRecurringSkipsExistingEmailIdentityWhenUserLaterRegisters(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 0, 30, 0, 0, time.UTC)
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	draft.ExecutionMode = "recurring"
	draft.Schedule = RecallScheduleConfig{Timezone: "Asia/Shanghai", Frequency: "daily", Hour: 9}
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	existing := model.RecallRecipient{
		CampaignId:          campaign.Id,
		UserId:              0,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "person@example.com",
		RecipientIdentity:   model.RecallRecipientIdentityForEmail("person@example.com"),
		LanguageSnapshot:    "en",
		State:               model.RecallRecipientQueued,
	}
	require.NoError(t, db.Create(&existing).Error)
	createRecallAudienceUser(t, db, now.Unix(), "recurring_registered_person", func(user *model.User) {
		user.CreatedAt = now.Add(-30 * 24 * time.Hour).Unix()
		user.RequestCount = 10
		user.Quota = 0
		user.Group = "plg"
		user.Email = "PERSON@example.com"
	})
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)

	require.Equal(t, 1, mustRunDueCampaigns(t, service, time.Unix(stored.NextRunAt, 0)))

	var recipients []model.RecallRecipient
	require.NoError(t, db.Where("campaign_id = ?", campaign.Id).Find(&recipients).Error)
	require.Len(t, recipients, 1)
	require.Equal(t, existing.Id, recipients[0].Id)
	var messageCount int64
	require.NoError(t, db.Model(&model.RecallMessage{}).Where("recipient_id = ?", existing.Id).Count(&messageCount).Error)
	require.Zero(t, messageCount)
}

func TestRecallCampaignRecurringSkipsExistingPositiveUserIDWhenEmailChanges(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 0, 30, 0, 0, time.UTC)
	user := createRecallCampaignEligibleUser(t, db, now, "recurring_changed_email")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	draft.ExecutionMode = "recurring"
	draft.Schedule = RecallScheduleConfig{Timezone: "Asia/Shanghai", Frequency: "daily", Hour: 9}
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return now }
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	existing := model.RecallRecipient{
		CampaignId:          campaign.Id,
		UserId:              user.Id,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "old-recurring@example.com",
		RecipientIdentity:   model.RecallRecipientIdentityForUser(user.Id),
		LanguageSnapshot:    "en",
		State:               model.RecallRecipientQueued,
	}
	require.NoError(t, db.Create(&existing).Error)
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", user.Id).Update("email", "changed-recurring@example.com").Error)
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)

	require.Equal(t, 1, mustRunDueCampaigns(t, service, time.Unix(stored.NextRunAt, 0)))

	var recipientCount int64
	require.NoError(t, db.Model(&model.RecallRecipient{}).Where("campaign_id = ?", campaign.Id).Count(&recipientCount).Error)
	require.EqualValues(t, 1, recipientCount)
}

func TestRecallCampaignRecurringSnapshotSkipsExistingIdentityBeforeInsert(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 0, 30, 0, 0, time.UTC)
	draft := validRecallCampaignDraft(now)
	draft.AudienceTemplate = "specified_users"
	draft.Audience = RecallAudienceConfig{SpecifiedEmails: []string{"direct-repeat@example.com"}}
	draft.ExecutionMode = "recurring"
	draft.Schedule = RecallScheduleConfig{Timezone: "Asia/Shanghai", Frequency: "daily", Hour: 9}
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	existing := model.RecallRecipient{
		CampaignId:          campaign.Id,
		UserId:              0,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "other@example.com",
		RecipientIdentity:   model.RecallRecipientIdentityForEmail("direct-repeat@example.com"),
		LanguageSnapshot:    "en",
		State:               model.RecallRecipientQueued,
	}
	require.NoError(t, db.Create(&existing).Error)

	recipients, _, err := service.snapshotRecurringAudience(context.Background(), campaign.Id, draft, 10, now)

	require.NoError(t, err)
	require.Empty(t, recipients)
}

func TestRecallCampaignRecurringSnapshotDeduplicatesNormalizedEmailWithinRun(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 0, 30, 0, 0, time.UTC)
	createRecallAudienceUser(t, db, now.Unix(), "recurring_same_email_first", func(user *model.User) {
		user.CreatedAt = now.Add(-30 * 24 * time.Hour).Unix()
		user.RequestCount = 10
		user.Quota = 0
		user.Group = "plg"
		user.Email = "same-run@example.com"
	})
	createRecallAudienceUser(t, db, now.Unix(), "recurring_same_email_second", func(user *model.User) {
		user.CreatedAt = now.Add(-30 * 24 * time.Hour).Unix()
		user.RequestCount = 10
		user.Quota = 0
		user.Group = "plg"
		user.Email = "SAME-RUN@example.com"
	})
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	draft.ExecutionMode = "recurring"
	draft.Schedule = RecallScheduleConfig{Timezone: "Asia/Shanghai", Frequency: "daily", Hour: 9}
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)

	recipients, _, err := service.snapshotRecurringAudience(context.Background(), campaign.Id, draft, 10, now)

	require.NoError(t, err)
	require.Len(t, recipients, 1)
	require.Equal(t, "same-run@example.com", recipients[0].EmailSnapshot)
}

func mustRunDueCampaigns(t *testing.T, service *RecallCampaignService, now time.Time) int {
	t.Helper()
	processed, err := service.RunDueCampaigns(context.Background(), now, 10)
	require.NoError(t, err)
	return processed
}

func TestRecallCampaignMaintenanceTickDoesNoDatabaseWorkWhenDisabled(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, false)
	var operations atomic.Int64
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register("recall_disabled_query", func(_ *gorm.DB) {
		operations.Add(1)
	}))
	require.NoError(t, db.Callback().Create().Before("gorm:create").Register("recall_disabled_create", func(_ *gorm.DB) {
		operations.Add(1)
	}))
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register("recall_disabled_update", func(_ *gorm.DB) {
		operations.Add(1)
	}))

	RunRecallMaintenanceTick(context.Background())

	require.Zero(t, operations.Load())
}

func TestRecallCampaignRuntimeInitiallyContainsCampaigns(t *testing.T) {
	runtime := GetRecallRuntime()
	require.NotNil(t, runtime)
	require.NotNil(t, runtime.Campaigns)
	require.NotNil(t, runtime.Campaigns.emailTranslator, "production runtime must never silently bypass localization")
}
