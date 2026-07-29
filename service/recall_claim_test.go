package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRecallClaimIssueStoresOnlyHashAndCopiesStageOneLookup(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()

	campaign := model.RecallCampaign{Name: "win-back", Status: model.RecallCampaignRunning, AudienceTemplate: "first_purchase", AudienceConfig: `{}`, ExecutionMode: "manual", CouponSource: "automatic", DiscountConfig: `{}`, ProductScope: `{}`, EmailSequenceConfig: `[]`}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 7, EligibilitySnapshot: `{}`, EmailSnapshot: "user@example.com", LanguageSnapshot: "en", State: model.RecallRecipientContacting}
	require.NoError(t, db.Create(&recipient).Error)
	message := model.RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: `{}`, ScheduledAt: now.Unix(), State: model.RecallMessageLeased, LeaseOwner: "worker-a", LeaseExpiresAt: now.Add(time.Minute).Unix()}
	require.NoError(t, db.Create(&message).Error)

	claimService := NewRecallClaimService()
	claimService.random = bytes.NewReader(bytes.Repeat([]byte{0xab}, 36))
	claim, err := claimService.IssueClaim(context.Background(), message.Id, "worker-a", message.LeaseExpiresAt)
	require.NoError(t, err)
	require.Len(t, claim, 48)

	wantHashBytes := sha256.Sum256([]byte(claim))
	wantHash := hex.EncodeToString(wantHashBytes[:])
	var storedMessage model.RecallMessage
	require.NoError(t, db.First(&storedMessage, message.Id).Error)
	require.NotNil(t, storedMessage.ClaimTokenHash)
	require.Equal(t, wantHash, *storedMessage.ClaimTokenHash)
	require.NotContains(t, *storedMessage.ClaimTokenHash, claim)
	var storedRecipient model.RecallRecipient
	require.NoError(t, db.First(&storedRecipient, recipient.Id).Error)
	require.NotNil(t, storedRecipient.ClaimTokenHash)
	require.Equal(t, wantHash, *storedRecipient.ClaimTokenHash)
}

func TestRecallClaimIssueKeepsIndependentAcceptedAndUncertainLinks(t *testing.T) {
	for _, state := range []string{model.RecallMessageAccepted, model.RecallMessageUncertain} {
		t.Run(state, func(t *testing.T) {
			db := setupRecallCampaignTestDB(t)
			now := time.Unix(1_721_000_000, 0).UTC()
			campaign := model.RecallCampaign{Name: "win-back", Status: model.RecallCampaignRunning, AudienceTemplate: "first_purchase", AudienceConfig: `{}`, ExecutionMode: "manual", CouponSource: "automatic", DiscountConfig: `{}`, ProductScope: `{}`, EmailSequenceConfig: `[]`}
			require.NoError(t, db.Create(&campaign).Error)
			stageOneHash := recallClaimHash(strings.Repeat("a", 48))
			recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 7, EligibilitySnapshot: `{}`, EmailSnapshot: "user@example.com", LanguageSnapshot: "en", State: model.RecallRecipientContacting, ClaimTokenHash: &stageOneHash}
			require.NoError(t, db.Create(&recipient).Error)
			preservedHash := recallClaimHash(strings.Repeat("p", 48))
			preserved := model.RecallMessage{RecipientId: recipient.Id, StageNo: 2, TemplateVersion: 1, TemplateSnapshot: `{}`, State: state, ClaimTokenHash: &preservedHash}
			require.NoError(t, db.Create(&preserved).Error)
			leased := model.RecallMessage{RecipientId: recipient.Id, StageNo: 3, TemplateVersion: 1, TemplateSnapshot: `{}`, State: model.RecallMessageLeased, LeaseOwner: "worker-a", LeaseExpiresAt: now.Add(time.Minute).Unix()}
			require.NoError(t, db.Create(&leased).Error)

			claimService := NewRecallClaimService()
			claimService.random = bytes.NewReader(bytes.Repeat([]byte{0xbc}, 36))
			claim, err := claimService.IssueClaim(context.Background(), leased.Id, leased.LeaseOwner, leased.LeaseExpiresAt)
			require.NoError(t, err)
			require.NotEqual(t, preservedHash, recallClaimHash(claim))

			var storedPreserved model.RecallMessage
			require.NoError(t, db.First(&storedPreserved, preserved.Id).Error)
			require.Equal(t, preservedHash, *storedPreserved.ClaimTokenHash)
			var storedRecipient model.RecallRecipient
			require.NoError(t, db.First(&storedRecipient, recipient.Id).Error)
			require.Equal(t, stageOneHash, *storedRecipient.ClaimTokenHash, "later stages must not replace the stage-one lookup")
		})
	}
}

type recallClaimFixture struct {
	campaign  model.RecallCampaign
	recipient model.RecallRecipient
	message   model.RecallMessage
	claim     string
}

func createRecallClaimFixture(t *testing.T, now time.Time) recallClaimFixture {
	t.Helper()
	discountJSON, err := common.Marshal(RecallDiscountConfig{Type: "percent", PercentOff: 20})
	require.NoError(t, err)
	productsJSON, err := common.Marshal(RecallProductScope{
		TopUpPriceIDs:        []string{"price_topup"},
		SubscriptionPriceIDs: []string{"price_subscription"},
	})
	require.NoError(t, err)
	campaign := model.RecallCampaign{
		Name: "win-back", Status: model.RecallCampaignRunning, AudienceTemplate: "first_purchase",
		AudienceConfig: `{}`, ExecutionMode: "manual", CouponSource: "automatic",
		DiscountConfig: string(discountJSON), ProductScope: string(productsJSON), EmailSequenceConfig: `[]`,
	}
	require.NoError(t, model.DB.Create(&campaign).Error)
	promotionID := "promo_recall"
	recipient := model.RecallRecipient{
		CampaignId: campaign.Id, UserId: 7, EligibilitySnapshot: `{}`, EmailSnapshot: "user@example.com",
		LanguageSnapshot: "en", State: model.RecallRecipientContacting,
		StripePromotionCodeId: &promotionID, PromotionCode: "FKSECRET234", PromotionExpiresAt: now.Add(time.Hour).Unix(),
	}
	require.NoError(t, model.DB.Create(&recipient).Error)
	claim := strings.Repeat("c", 48)
	claimHash := recallClaimHash(claim)
	message := model.RecallMessage{
		RecipientId: recipient.Id, StageNo: 2, TemplateVersion: 1, TemplateSnapshot: `{}`,
		ScheduledAt: now.Unix(), State: model.RecallMessageAccepted, ClaimTokenHash: &claimHash,
	}
	require.NoError(t, model.DB.Create(&message).Error)
	return recallClaimFixture{campaign: campaign, recipient: recipient, message: message, claim: claim}
}

func createRecallEmailOnlyClaimFixture(t *testing.T, now time.Time, email string) recallClaimFixture {
	t.Helper()
	discountJSON, err := common.Marshal(RecallDiscountConfig{Type: "percent", PercentOff: 20})
	require.NoError(t, err)
	productsJSON, err := common.Marshal(RecallProductScope{
		TopUpPriceIDs:        []string{"price_topup"},
		SubscriptionPriceIDs: []string{"price_subscription"},
	})
	require.NoError(t, err)
	campaign := model.RecallCampaign{
		Name: "email-only win-back", Status: model.RecallCampaignRunning, AudienceTemplate: "specified_users",
		AudienceConfig: `{}`, ExecutionMode: "manual", CouponSource: "automatic",
		DiscountConfig: string(discountJSON), ProductScope: string(productsJSON), EmailSequenceConfig: `[]`,
	}
	require.NoError(t, model.DB.Create(&campaign).Error)
	promotionID := "promo_email_only"
	recipient := model.RecallRecipient{
		CampaignId: campaign.Id, UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: email,
		LanguageSnapshot: "en", State: model.RecallRecipientContacting,
		StripePromotionCodeId: &promotionID, PromotionCode: "FKEMAIL234", PromotionExpiresAt: now.Add(time.Hour).Unix(),
	}
	require.NoError(t, model.DB.Create(&recipient).Error)
	claim := strings.Repeat("e", 48)
	claimHash := recallClaimHash(claim)
	message := model.RecallMessage{
		RecipientId: recipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: `{}`,
		ScheduledAt: now.Unix(), State: model.RecallMessageAccepted, ClaimTokenHash: &claimHash,
	}
	require.NoError(t, model.DB.Create(&message).Error)
	return recallClaimFixture{campaign: campaign, recipient: recipient, message: message, claim: claim}
}

func createRecallOfferFixture(t *testing.T, user model.User, now time.Time, name string, status string, discount RecallDiscountConfig, products RecallProductScope, mutate func(*model.RecallRecipient)) recallClaimFixture {
	t.Helper()
	discountJSON, err := common.Marshal(discount)
	require.NoError(t, err)
	productsJSON, err := common.Marshal(products)
	require.NoError(t, err)
	campaign := model.RecallCampaign{
		Name: name, Status: status, AudienceTemplate: "specified_users",
		AudienceConfig: `{}`, ExecutionMode: "manual", CouponSource: "automatic",
		DiscountConfig: string(discountJSON), ProductScope: string(productsJSON), EmailSequenceConfig: `[]`,
	}
	require.NoError(t, model.DB.Create(&campaign).Error)
	promotionID := "promo_" + strings.ReplaceAll(name, " ", "_")
	recipient := model.RecallRecipient{
		CampaignId: campaign.Id, UserId: user.Id, EligibilitySnapshot: `{}`, EmailSnapshot: user.Email,
		LanguageSnapshot: "en", State: model.RecallRecipientContacting,
		StripePromotionCodeId: &promotionID, PromotionCode: "FK" + strings.ToUpper(strings.ReplaceAll(name, " ", "")) + "234",
		PromotionExpiresAt: now.Add(time.Hour).Unix(), PromotionIssuedAt: now.Add(-time.Minute).Unix(),
		StripeCustomerId: "cus_" + strings.ReplaceAll(name, " ", "_"),
	}
	if mutate != nil {
		mutate(&recipient)
	}
	require.NoError(t, model.DB.Create(&recipient).Error)
	return recallClaimFixture{campaign: campaign, recipient: recipient}
}

func recallClaimHash(claim string) string {
	digest := sha256.Sum256([]byte(claim))
	return hex.EncodeToString(digest[:])
}

func TestRecallClaimValidateFindsAnyStageHashAndRecordsOneObservedClick(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	fixture := createRecallClaimFixture(t, now)
	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }

	first, err := claimService.ValidateClaim(context.Background(), fixture.recipient.UserId, fixture.claim)
	require.NoError(t, err)
	require.Equal(t, fixture.campaign.Id, first.CampaignID)
	require.Equal(t, fixture.recipient.Id, first.RecipientID)
	require.Equal(t, model.MaskPromotionCode(fixture.recipient.PromotionCode), first.PromotionCodeMasked)
	require.NotEqual(t, fixture.recipient.PromotionCode, first.PromotionCodeMasked)
	second, err := claimService.ValidateClaim(context.Background(), fixture.recipient.UserId, fixture.claim)
	require.NoError(t, err)
	require.Equal(t, first, second)

	var storedRecipient model.RecallRecipient
	require.NoError(t, db.First(&storedRecipient, fixture.recipient.Id).Error)
	require.Equal(t, now.Unix(), storedRecipient.ClickedAt)
	require.Zero(t, storedRecipient.ConvertedAt, "a click must never be a conversion")
	var events []model.RecallEvent
	require.NoError(t, db.Where("recipient_id = ? AND event_type = ?", fixture.recipient.Id, "observed_click").Find(&events).Error)
	require.Len(t, events, 1)
}

func TestRecallClaimValidateReturnsInternalSubscriptionPlanIDs(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	disabledPlan := model.SubscriptionPlan{
		Id:            70,
		Title:         "Go retired",
		Enabled:       false,
		StripePriceId: "price_subscription",
	}
	firstPlan := model.SubscriptionPlan{
		Id:            71,
		Title:         "Go",
		Enabled:       true,
		StripePriceId: "price_subscription",
	}
	secondPlan := model.SubscriptionPlan{
		Id:            72,
		Title:         "Go legacy",
		Enabled:       true,
		StripePriceId: "price_subscription",
	}
	require.NoError(t, db.Create(&[]model.SubscriptionPlan{secondPlan, disabledPlan, firstPlan}).Error)
	require.NoError(t, db.Model(&model.SubscriptionPlan{}).Where("id = ?", disabledPlan.Id).Update("enabled", false).Error)
	fixture := createRecallClaimFixture(t, now)
	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }

	view, err := claimService.ValidateClaim(context.Background(), fixture.recipient.UserId, fixture.claim)

	require.NoError(t, err)
	require.Equal(t, []int{firstPlan.Id, secondPlan.Id}, view.Products.SubscriptionPlanIDs)
	require.Equal(t, []string{"price_subscription"}, view.Products.SubscriptionPriceIDs)
}

func TestRecallClaimListOffersBatchHydratesSubscriptionPlans(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	user := model.User{Username: "recall-list-batch", AffCode: "recall-list-batch-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "batch@example.com"}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Create(&[]model.SubscriptionPlan{
		{Id: 10, Title: "A", Enabled: true, StripePriceId: "price_a"},
		{Id: 20, Title: "B", Enabled: true, StripePriceId: "price_b"},
		{Id: 30, Title: "B legacy", Enabled: true, StripePriceId: "price_b"},
		{Id: 40, Title: "retired", Enabled: false, StripePriceId: "price_a"},
	}).Error)
	require.NoError(t, db.Model(&model.SubscriptionPlan{}).Where("id = ?", 40).Update("enabled", false).Error)

	productScopes := []RecallProductScope{
		{SubscriptionPriceIDs: []string{"price_b", "price_a", "price_b"}},
		{SubscriptionPriceIDs: []string{"price_a"}},
		{SubscriptionPriceIDs: []string{"price_b"}},
	}
	discountJSON, err := common.Marshal(RecallDiscountConfig{Type: "percent", PercentOff: 10})
	require.NoError(t, err)
	promotionID := func(value string) *string { return &value }
	for i, products := range productScopes {
		productsJSON, err := common.Marshal(products)
		require.NoError(t, err)
		campaign := model.RecallCampaign{
			Name: fmt.Sprintf("batch-%d", i), Status: model.RecallCampaignRunning, CampaignType: model.RecallCampaignTypePromotion,
			AudienceTemplate: "specified_users", AudienceConfig: `{}`, ExecutionMode: "manual", CouponSource: "automatic",
			DiscountConfig: string(discountJSON), ProductScope: string(productsJSON), EmailSequenceConfig: `[]`,
		}
		require.NoError(t, db.Create(&campaign).Error)
		recipient := model.RecallRecipient{
			CampaignId: campaign.Id, UserId: user.Id, EligibilitySnapshot: `{}`, EmailSnapshot: user.Email,
			LanguageSnapshot: "en", State: model.RecallRecipientContacting,
			StripePromotionCodeId: promotionID(fmt.Sprintf("promo_batch_%d", i)), PromotionCode: fmt.Sprintf("FKBATCH%d", i),
			PromotionExpiresAt: now.Add(time.Hour).Unix(), PromotionIssuedAt: now.Add(-time.Duration(i) * time.Minute).Unix(),
		}
		require.NoError(t, db.Create(&recipient).Error)
	}

	planQueries := int32(0)
	callbackName := "recall_claim_list_offer_batch_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "subscription_plans" {
			atomic.AddInt32(&planQueries, 1)
		}
	}))
	t.Cleanup(func() { _ = db.Callback().Query().Remove(callbackName) })

	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }
	offers, err := claimService.ListOffers(context.Background(), user.Id)

	require.NoError(t, err)
	require.Len(t, offers, 3)
	require.EqualValues(t, 1, atomic.LoadInt32(&planQueries))
	require.Equal(t, []string{"price_b", "price_a"}, offers[0].Products.SubscriptionPriceIDs)
	require.Equal(t, []int{20, 30, 10}, offers[0].Products.SubscriptionPlanIDs)
	require.Equal(t, []int{10}, offers[1].Products.SubscriptionPlanIDs)
	require.Equal(t, []int{20, 30}, offers[2].Products.SubscriptionPlanIDs)
}

func TestRecallResolveBestOfferScansPastDisplayLimitForHighestActualDiscount(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	user := model.User{Username: "recall-best-over-limit", AffCode: "recall-best-over-limit-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "best-over-limit@example.com"}
	require.NoError(t, db.Create(&user).Error)

	createOffer := func(index int, issuedAt int64, percentOff float64) model.RecallRecipient {
		t.Helper()
		discountJSON, err := common.Marshal(RecallDiscountConfig{Type: "percent", PercentOff: percentOff})
		require.NoError(t, err)
		productsJSON, err := common.Marshal(RecallProductScope{SubscriptionPriceIDs: []string{"price_subscription"}})
		require.NoError(t, err)
		campaign := model.RecallCampaign{
			Name: fmt.Sprintf("best-over-limit-%03d", index), Status: model.RecallCampaignRunning, CampaignType: model.RecallCampaignTypePromotion,
			AudienceTemplate: "specified_users", AudienceConfig: `{}`, ExecutionMode: "manual", CouponSource: "automatic",
			DiscountConfig: string(discountJSON), ProductScope: string(productsJSON), EmailSequenceConfig: `[]`,
		}
		require.NoError(t, db.Create(&campaign).Error)
		promotionID := fmt.Sprintf("promo_best_over_limit_%03d", index)
		recipient := model.RecallRecipient{
			CampaignId: campaign.Id, UserId: user.Id, EligibilitySnapshot: `{}`, EmailSnapshot: user.Email,
			LanguageSnapshot: "en", State: model.RecallRecipientContacting,
			StripePromotionCodeId: &promotionID, PromotionCode: fmt.Sprintf("FKBEST%03d", index),
			PromotionExpiresAt: now.Add(time.Hour).Unix(), PromotionIssuedAt: issuedAt,
		}
		require.NoError(t, db.Create(&recipient).Error)
		return recipient
	}

	for i := 0; i < 100; i++ {
		createOffer(i, now.Unix()-int64(i), 5)
	}
	bestRecipient := createOffer(100, now.Unix()-1_000, 50)

	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }
	best, err := claimService.ResolveBestRecallOffer(context.Background(), user.Id, RecallPurchaseKindSubscription, "price_subscription", "USD", 10_000)

	require.NoError(t, err)
	require.NotNil(t, best)
	require.Equal(t, bestRecipient.Id, best.View.RecipientID)
	require.EqualValues(t, 5_000, best.DiscountMinor)
}

func TestRecallContentOnlyClaimValidationFailsClosedWithoutClick(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	fixture := createRecallClaimFixture(t, now)
	require.NoError(t, db.Model(&model.RecallCampaign{}).Where("id = ?", fixture.campaign.Id).Update("campaign_type", model.RecallCampaignTypeContentOnly).Error)
	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }

	_, err := claimService.ValidateClaim(context.Background(), fixture.recipient.UserId, fixture.claim)

	require.ErrorIs(t, err, ErrRecallClaimPromotionInvalid)
	var eventCount int64
	require.NoError(t, db.Model(&model.RecallEvent{}).Where("recipient_id = ? AND event_type = ?", fixture.recipient.Id, "observed_click").Count(&eventCount).Error)
	require.Zero(t, eventCount)
}

func TestRecallClaimValidateAcceptsStageOneRecipientLookupAfterMessageAcceptance(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	fixture := createRecallClaimFixture(t, now)
	stageOneClaim := strings.Repeat("a", 48)
	stageOneHash := recallClaimHash(stageOneClaim)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Update("claim_token_hash", stageOneHash).Error)

	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }
	view, err := claimService.ValidateClaim(context.Background(), fixture.recipient.UserId, stageOneClaim)
	require.NoError(t, err)
	require.Equal(t, fixture.recipient.Id, view.RecipientID)

	view, err = claimService.ValidateClaim(context.Background(), fixture.recipient.UserId, fixture.claim)
	require.NoError(t, err, "an accepted later-stage message link must remain independently valid")
	require.Equal(t, fixture.recipient.Id, view.RecipientID)
}

func TestRecallClaimValidateEmailOnlyBindsMatchingEnabledUserAndKeepsEmailIdentity(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	fixture := createRecallEmailOnlyClaimFixture(t, now, "emailonly@example.com")
	user := model.User{Username: "email-only-user", AffCode: "email-only-aff", Password: "hash", Status: common.UserStatusEnabled, Email: " EmailOnly@Example.com "}
	require.NoError(t, db.Create(&user).Error)

	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }
	view, err := claimService.ValidateClaim(context.Background(), user.Id, fixture.claim)

	require.NoError(t, err)
	require.Equal(t, fixture.recipient.Id, view.RecipientID)
	var stored model.RecallRecipient
	require.NoError(t, db.First(&stored, fixture.recipient.Id).Error)
	require.Equal(t, user.Id, stored.UserId)
	require.Equal(t, model.RecallRecipientIdentityForEmail("emailonly@example.com"), stored.RecipientIdentity)

	view, err = claimService.ValidateClaim(context.Background(), user.Id, fixture.claim)
	require.NoError(t, err)
	require.Equal(t, fixture.recipient.Id, view.RecipientID)
}

func TestRecallClaimValidateEmailOnlyRejectsMismatchDisabledAndCompetingUsers(t *testing.T) {
	tests := []struct {
		name       string
		userEmail  string
		userStatus int
	}{
		{name: "different email", userEmail: "different@example.com", userStatus: common.UserStatusEnabled},
		{name: "disabled", userEmail: "emailonly@example.com", userStatus: common.UserStatusDisabled},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			db := setupRecallCampaignTestDB(t)
			setRecallCampaignEnabled(t, true)
			now := time.Unix(1_721_000_000, 0).UTC()
			fixture := createRecallEmailOnlyClaimFixture(t, now, "emailonly@example.com")
			user := model.User{Username: "email-only-" + strings.ReplaceAll(test.name, " ", "-"), AffCode: "email-only-aff-" + strings.ReplaceAll(test.name, " ", "-"), Password: "hash", Status: test.userStatus, Email: test.userEmail}
			require.NoError(t, db.Create(&user).Error)

			claimService := NewRecallClaimService()
			claimService.now = func() time.Time { return now }
			_, err := claimService.ValidateClaim(context.Background(), user.Id, fixture.claim)

			require.ErrorIs(t, err, ErrRecallClaimWrongUser)
			var stored model.RecallRecipient
			require.NoError(t, db.First(&stored, fixture.recipient.Id).Error)
			require.Zero(t, stored.UserId)
		})
	}

	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	fixture := createRecallEmailOnlyClaimFixture(t, now, "shared@example.com")
	first := model.User{Username: "email-only-first", AffCode: "email-only-first-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "shared@example.com"}
	second := model.User{Username: "email-only-second", AffCode: "email-only-second-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "shared@example.com"}
	require.NoError(t, db.Create(&first).Error)
	require.NoError(t, db.Create(&second).Error)
	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }
	_, err := claimService.ValidateClaim(context.Background(), first.Id, fixture.claim)
	require.NoError(t, err)
	_, err = claimService.ValidateClaim(context.Background(), second.Id, fixture.claim)
	require.ErrorIs(t, err, ErrRecallClaimWrongUser)
	var stored model.RecallRecipient
	require.NoError(t, db.First(&stored, fixture.recipient.Id).Error)
	require.Equal(t, first.Id, stored.UserId)
}

func TestRecallClaimValidateEmailOnlyDoesNotBindInvalidClaims(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*testing.T, recallClaimFixture, time.Time)
		wantErr error
	}{
		{name: "expired", wantErr: ErrRecallClaimExpired, mutate: func(t *testing.T, f recallClaimFixture, now time.Time) {
			require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", f.recipient.Id).Update("promotion_expires_at", now.Unix()).Error)
		}},
		{name: "converted", wantErr: ErrRecallClaimConverted, mutate: func(t *testing.T, f recallClaimFixture, _ time.Time) {
			require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", f.recipient.Id).Updates(map[string]any{"state": model.RecallRecipientConverted, "converted_at": int64(1)}).Error)
		}},
		{name: "suppressed", wantErr: ErrRecallClaimSuppressed, mutate: func(t *testing.T, f recallClaimFixture, _ time.Time) {
			require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", f.recipient.Id).Update("state", model.RecallRecipientSuppressed).Error)
		}},
		{name: "draft campaign", wantErr: ErrRecallClaimInactive, mutate: func(t *testing.T, f recallClaimFixture, _ time.Time) {
			require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", f.campaign.Id).Update("status", model.RecallCampaignDraft).Error)
		}},
		{name: "invalid promotion", wantErr: ErrRecallClaimPromotionInvalid, mutate: func(t *testing.T, f recallClaimFixture, _ time.Time) {
			require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", f.recipient.Id).Update("promotion_code", "").Error)
		}},
		{name: "invalid discount config", wantErr: ErrRecallClaimInvalidConfig, mutate: func(t *testing.T, f recallClaimFixture, _ time.Time) {
			require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", f.campaign.Id).Update("discount_config", `{`).Error)
		}},
		{name: "invalid product config", wantErr: ErrRecallClaimInvalidConfig, mutate: func(t *testing.T, f recallClaimFixture, _ time.Time) {
			require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", f.campaign.Id).Update("product_scope", `{`).Error)
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			db := setupRecallCampaignTestDB(t)
			setRecallCampaignEnabled(t, true)
			now := time.Unix(1_721_000_000, 0).UTC()
			fixture := createRecallEmailOnlyClaimFixture(t, now, "emailonly-invalid@example.com")
			user := model.User{Username: "email-only-invalid-" + strings.ReplaceAll(test.name, " ", "-"), AffCode: "email-only-invalid-aff-" + strings.ReplaceAll(test.name, " ", "-"), Password: "hash", Status: common.UserStatusEnabled, Email: "emailonly-invalid@example.com"}
			require.NoError(t, db.Create(&user).Error)
			test.mutate(t, fixture, now)

			claimService := NewRecallClaimService()
			claimService.now = func() time.Time { return now }
			_, err := claimService.ValidateClaim(context.Background(), user.Id, fixture.claim)

			require.ErrorIs(t, err, test.wantErr)
			var stored model.RecallRecipient
			require.NoError(t, db.First(&stored, fixture.recipient.Id).Error)
			require.Zero(t, stored.UserId)
		})
	}
}

func TestRecallClaimValidateEmailOnlyMapsMissingUserButPropagatesUserLoadErrors(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	fixture := createRecallEmailOnlyClaimFixture(t, now, "missing-user@example.com")
	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }

	_, err := claimService.ValidateClaim(context.Background(), 999_999, fixture.claim)
	require.ErrorIs(t, err, ErrRecallClaimWrongUser)

	sentinel := errors.New("user load failed")
	callbackName := "recall_claim_user_load_error_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "users" {
			tx.AddError(sentinel)
		}
	}))
	t.Cleanup(func() { _ = db.Callback().Query().Remove(callbackName) })

	_, err = claimService.ValidateClaim(context.Background(), 999_999, fixture.claim)
	require.ErrorIs(t, err, sentinel)
}

func TestRecallClaimValidateRejectsInvalidClaimsWithTypedErrors(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*testing.T, recallClaimFixture, time.Time)
		userID  int
		claim   func(recallClaimFixture) string
		wantErr error
	}{
		{name: "wrong user", userID: 8, claim: func(f recallClaimFixture) string { return f.claim }, wantErr: ErrRecallClaimWrongUser},
		{name: "unknown", userID: 7, claim: func(recallClaimFixture) string { return strings.Repeat("z", 48) }, wantErr: ErrRecallClaimUnknown},
		{name: "expired", userID: 7, claim: func(f recallClaimFixture) string { return f.claim }, wantErr: ErrRecallClaimExpired, mutate: func(t *testing.T, f recallClaimFixture, now time.Time) {
			require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", f.recipient.Id).Update("promotion_expires_at", now.Unix()).Error)
		}},
		{name: "converted", userID: 7, claim: func(f recallClaimFixture) string { return f.claim }, wantErr: ErrRecallClaimConverted, mutate: func(t *testing.T, f recallClaimFixture, _ time.Time) {
			require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", f.recipient.Id).Updates(map[string]any{"state": model.RecallRecipientConverted, "converted_at": int64(1)}).Error)
		}},
		{name: "suppressed", userID: 7, claim: func(f recallClaimFixture) string { return f.claim }, wantErr: ErrRecallClaimSuppressed, mutate: func(t *testing.T, f recallClaimFixture, _ time.Time) {
			require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", f.recipient.Id).Update("state", model.RecallRecipientSuppressed).Error)
		}},
		{name: "draft campaign", userID: 7, claim: func(f recallClaimFixture) string { return f.claim }, wantErr: ErrRecallClaimInactive, mutate: func(t *testing.T, f recallClaimFixture, _ time.Time) {
			require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", f.campaign.Id).Update("status", model.RecallCampaignDraft).Error)
		}},
		{name: "invalid promotion", userID: 7, claim: func(f recallClaimFixture) string { return f.claim }, wantErr: ErrRecallClaimPromotionInvalid, mutate: func(t *testing.T, f recallClaimFixture, _ time.Time) {
			require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", f.recipient.Id).Update("promotion_code", "").Error)
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setupRecallCampaignTestDB(t)
			setRecallCampaignEnabled(t, true)
			now := time.Unix(1_721_000_000, 0).UTC()
			fixture := createRecallClaimFixture(t, now)
			if test.mutate != nil {
				test.mutate(t, fixture, now)
			}
			claimService := NewRecallClaimService()
			claimService.now = func() time.Time { return now }
			_, err := claimService.ValidateClaim(context.Background(), test.userID, test.claim(fixture))
			require.ErrorIs(t, err, test.wantErr)
		})
	}
}

func TestRecallClaimValidateKeepsIssuedClaimsValidAfterCampaignEnds(t *testing.T) {
	for _, status := range []string{model.RecallCampaignCompleted} {
		t.Run(status, func(t *testing.T) {
			setupRecallCampaignTestDB(t)
			setRecallCampaignEnabled(t, true)
			now := time.Unix(1_721_000_000, 0).UTC()
			fixture := createRecallClaimFixture(t, now)
			require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", fixture.campaign.Id).Update("status", status).Error)

			claimService := NewRecallClaimService()
			claimService.now = func() time.Time { return now }
			view, err := claimService.ValidateClaim(context.Background(), fixture.recipient.UserId, fixture.claim)
			require.NoError(t, err)
			require.Equal(t, fixture.recipient.Id, view.RecipientID)
		})
	}
}

func TestRecallClaimValidateRejectsRecipientThatBecomesTerminalAfterLookup(t *testing.T) {
	tests := []struct {
		name        string
		state       string
		convertedAt int64
		wantErr     error
	}{
		{name: "converted", state: model.RecallRecipientConverted, convertedAt: 1, wantErr: ErrRecallClaimConverted},
		{name: "suppressed", state: model.RecallRecipientSuppressed, wantErr: ErrRecallClaimSuppressed},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			db := setupRecallCampaignTestDB(t)
			setRecallCampaignEnabled(t, true)
			now := time.Unix(1_721_000_000, 0).UTC()
			fixture := createRecallClaimFixture(t, now)
			sqlDB, err := db.DB()
			require.NoError(t, err)

			var changed atomic.Bool
			var callbackErr error
			callbackName := "recall_claim_terminal_after_lookup_" + strings.ReplaceAll(t.Name(), "/", "_")
			require.NoError(t, db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
				if tx.Statement.Table != "recall_campaigns" || !changed.CompareAndSwap(false, true) {
					return
				}
				_, callbackErr = sqlDB.ExecContext(context.Background(),
					"UPDATE recall_recipients SET state = ?, converted_at = ? WHERE id = ?",
					test.state, test.convertedAt, fixture.recipient.Id,
				)
			}))
			t.Cleanup(func() { _ = db.Callback().Query().Remove(callbackName) })

			claimService := NewRecallClaimService()
			claimService.now = func() time.Time { return now }
			_, err = claimService.BuildCheckoutDiscount(context.Background(), fixture.recipient.UserId, fixture.claim, RecallPurchaseKindTopUp, "price_topup")
			require.NoError(t, callbackErr)
			require.True(t, changed.Load())
			require.ErrorIs(t, err, test.wantErr)
		})
	}
}

func TestRecallClaimBuildCheckoutDiscountValidatesKindAndPrice(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	fixture := createRecallClaimFixture(t, now)
	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }

	topup, err := claimService.BuildCheckoutDiscount(context.Background(), fixture.recipient.UserId, fixture.claim, RecallPurchaseKindTopUp, "price_topup")
	require.NoError(t, err)
	require.NotNil(t, topup)
	require.Equal(t, *fixture.recipient.StripePromotionCodeId, topup.PromotionCodeID)
	require.Equal(t, fixture.campaign.Id, topup.CampaignID)
	require.Equal(t, fixture.recipient.Id, topup.RecipientID)
	subscription, err := claimService.BuildCheckoutDiscount(context.Background(), fixture.recipient.UserId, fixture.claim, RecallPurchaseKindSubscription, "price_subscription")
	require.NoError(t, err)
	require.Equal(t, *fixture.recipient.StripePromotionCodeId, subscription.PromotionCodeID)
	require.Equal(t, fixture.campaign.Id, subscription.CampaignID)
	require.Equal(t, fixture.recipient.Id, subscription.RecipientID)

	_, err = claimService.BuildCheckoutDiscount(context.Background(), fixture.recipient.UserId, fixture.claim, RecallPurchaseKindTopUp, "price_other")
	require.ErrorIs(t, err, ErrRecallClaimWrongPrice)
	_, err = claimService.BuildCheckoutDiscount(context.Background(), fixture.recipient.UserId, fixture.claim, RecallPurchaseKindSubscription, "price_topup")
	require.ErrorIs(t, err, ErrRecallClaimWrongPrice)
	_, err = claimService.BuildCheckoutDiscount(context.Background(), fixture.recipient.UserId, fixture.claim, "other", "price_topup")
	require.ErrorIs(t, err, ErrRecallClaimPurchaseKind)
}

func TestRecallClaimDisabledAndEmptyCheckoutClaim(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, false)
	claimService := NewRecallClaimService()

	discount, err := claimService.BuildCheckoutDiscount(context.Background(), 7, "", RecallPurchaseKindTopUp, "price_topup")
	require.NoError(t, err)
	require.Nil(t, discount)
	_, err = claimService.ValidateClaim(context.Background(), 7, strings.Repeat("c", 48))
	require.ErrorIs(t, err, ErrRecallDisabled)
	_, err = claimService.BuildCheckoutDiscount(context.Background(), 7, strings.Repeat("c", 48), RecallPurchaseKindTopUp, "price_topup")
	require.ErrorIs(t, err, ErrRecallDisabled)

	offers, err := claimService.ListOffers(context.Background(), 7)
	require.NoError(t, err)
	require.Empty(t, offers)
}

func TestRecallListOffersSkipsMalformedAndUnsafeFields(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	user := model.User{Username: "offer-user", AffCode: "offer-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "offer@example.com"}
	require.NoError(t, db.Create(&user).Error)
	valid := createRecallOfferFixture(t, user, now, "valid offer", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "percent", PercentOff: 25},
		RecallProductScope{TopUpPriceIDs: []string{"price_topup"}},
		func(recipient *model.RecallRecipient) { recipient.PromotionIssuedAt = now.Unix() })
	malformed := createRecallOfferFixture(t, user, now, "malformed offer", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "percent", PercentOff: 50},
		RecallProductScope{TopUpPriceIDs: []string{"price_topup"}},
		nil)
	require.NoError(t, db.Model(&model.RecallCampaign{}).Where("id = ?", malformed.campaign.Id).Update("discount_config", `{`).Error)

	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }
	offers, err := claimService.ListOffers(context.Background(), user.Id)

	require.NoError(t, err)
	require.Len(t, offers, 1)
	require.Equal(t, valid.campaign.Id, offers[0].CampaignID)
	require.Equal(t, valid.recipient.Id, offers[0].RecipientID)
	require.Equal(t, model.MaskPromotionCode(valid.recipient.PromotionCode), offers[0].PromotionCodeMasked)
	require.Equal(t, now.Unix(), offers[0].IssuedAt)

	raw, err := common.Marshal(offers[0])
	require.NoError(t, err)
	var offerJSON map[string]any
	require.NoError(t, common.Unmarshal(raw, &offerJSON))
	require.ElementsMatch(t, []string{
		"campaign_id", "recipient_id", "campaign_name", "promotion_code_masked",
		"expires_at", "discount", "products", "redeemed", "issued_at",
	}, recallAudienceJSONKeys(offerJSON))
	require.NotContains(t, string(raw), *valid.recipient.StripePromotionCodeId)
	require.NotContains(t, string(raw), valid.recipient.PromotionCode)
	require.NotContains(t, string(raw), valid.recipient.EmailSnapshot)
	require.NotContains(t, string(raw), valid.recipient.StripeCustomerId)
}

func TestRecallListOffersPropagatesSubscriptionPlanHydrationErrors(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	user := model.User{Username: "offer-plan-error-user", AffCode: "offer-plan-error-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "offer-plan-error@example.com"}
	require.NoError(t, db.Create(&user).Error)
	createRecallOfferFixture(t, user, now, "plan hydration error", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "percent", PercentOff: 25},
		RecallProductScope{SubscriptionPriceIDs: []string{"price_subscription"}},
		nil)
	sentinel := errors.New("subscription plan lookup failed")
	callbackName := "recall_offer_plan_hydration_error_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "subscription_plans" {
			tx.AddError(sentinel)
		}
	}))
	t.Cleanup(func() { _ = db.Callback().Query().Remove(callbackName) })

	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }
	_, err := claimService.ListOffers(context.Background(), user.Id)

	require.ErrorIs(t, err, sentinel)
}

func TestRecallListOffersHydratesSubscriptionPlansInOneBatch(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	user := model.User{Username: "offer-plan-batch-user", AffCode: "offer-plan-batch-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "offer-plan-batch@example.com"}
	require.NoError(t, db.Create(&user).Error)
	plans := []model.SubscriptionPlan{
		{Id: 91, Title: "Plan A", Enabled: true, StripePriceId: "price_subscription_a"},
		{Id: 92, Title: "Plan B", Enabled: true, StripePriceId: "price_subscription_b"},
	}
	require.NoError(t, db.Create(&plans).Error)
	createRecallOfferFixture(t, user, now, "plan batch first", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "percent", PercentOff: 25},
		RecallProductScope{SubscriptionPriceIDs: []string{"price_subscription_a", "price_subscription_b"}},
		func(recipient *model.RecallRecipient) { recipient.PromotionIssuedAt = now.Add(time.Second).Unix() })
	createRecallOfferFixture(t, user, now, "plan batch second", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "percent", PercentOff: 15},
		RecallProductScope{SubscriptionPriceIDs: []string{"price_subscription_b"}},
		nil)

	subscriptionPlanQueries := 0
	callbackName := "recall_offer_plan_batch_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "subscription_plans" {
			subscriptionPlanQueries++
		}
	}))
	t.Cleanup(func() { _ = db.Callback().Query().Remove(callbackName) })

	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }
	offers, err := claimService.ListOffers(context.Background(), user.Id)

	require.NoError(t, err)
	require.Len(t, offers, 2)
	require.Equal(t, 1, subscriptionPlanQueries, "ListOffers must batch subscription plan hydration instead of querying per candidate")
	require.ElementsMatch(t, []int{plans[0].Id, plans[1].Id}, offers[0].Products.SubscriptionPlanIDs)
	require.Equal(t, []int{plans[1].Id}, offers[1].Products.SubscriptionPlanIDs)
}

func TestRecallOfferStatusEligibilitySharedByListResolveAndClaim(t *testing.T) {
	for _, status := range []string{model.RecallCampaignScheduled, model.RecallCampaignRunning, model.RecallCampaignPaused, model.RecallCampaignCompleted} {
		t.Run(status, func(t *testing.T) {
			db := setupRecallCampaignTestDB(t)
			setRecallCampaignEnabled(t, true)
			now := time.Unix(1_721_000_000, 0).UTC()
			user := model.User{Username: "status-" + status, AffCode: "status-aff-" + status, Password: "hash", Status: common.UserStatusEnabled, Email: status + "@example.com"}
			require.NoError(t, db.Create(&user).Error)
			fixture := createRecallOfferFixture(t, user, now, "status "+status, status,
				RecallDiscountConfig{Type: "percent", PercentOff: 10},
				RecallProductScope{TopUpPriceIDs: []string{"price_topup"}}, nil)
			claim := strings.Repeat("s", 48)
			claimHash := recallClaimHash(claim)
			require.NoError(t, db.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Update("claim_token_hash", claimHash).Error)

			claimService := NewRecallClaimService()
			claimService.now = func() time.Time { return now }
			offers, err := claimService.ListOffers(context.Background(), user.Id)
			require.NoError(t, err)
			require.Len(t, offers, 1)
			resolved, err := claimService.ResolveBestRecallOffer(context.Background(), user.Id, RecallPurchaseKindTopUp, "price_topup", "USD", 1000)
			require.NoError(t, err)
			require.NotNil(t, resolved)
			_, err = claimService.ValidateClaim(context.Background(), user.Id, claim)
			require.NoError(t, err)
		})
	}

	t.Run(model.RecallCampaignCancelled, func(t *testing.T) {
		db := setupRecallCampaignTestDB(t)
		setRecallCampaignEnabled(t, true)
		now := time.Unix(1_721_000_000, 0).UTC()
		user := model.User{Username: "status-cancelled", AffCode: "status-aff-cancelled", Password: "hash", Status: common.UserStatusEnabled, Email: "cancelled@example.com"}
		require.NoError(t, db.Create(&user).Error)
		fixture := createRecallOfferFixture(t, user, now, "status cancelled", model.RecallCampaignCancelled,
			RecallDiscountConfig{Type: "percent", PercentOff: 10},
			RecallProductScope{TopUpPriceIDs: []string{"price_topup"}}, nil)
		claim := strings.Repeat("x", 48)
		claimHash := recallClaimHash(claim)
		require.NoError(t, db.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Update("claim_token_hash", claimHash).Error)

		claimService := NewRecallClaimService()
		claimService.now = func() time.Time { return now }
		offers, err := claimService.ListOffers(context.Background(), user.Id)
		require.NoError(t, err)
		require.Empty(t, offers)
		resolved, err := claimService.ResolveBestRecallOffer(context.Background(), user.Id, RecallPurchaseKindTopUp, "price_topup", "USD", 1000)
		require.NoError(t, err)
		require.Nil(t, resolved)
		_, err = claimService.ValidateClaim(context.Background(), user.Id, claim)
		require.ErrorIs(t, err, ErrRecallClaimInactive)
	})
}

func TestRecallResolveBestOfferActualDiscountAndOrdering(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	user := model.User{Username: "best-offer-user", AffCode: "best-offer-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "best@example.com"}
	require.NoError(t, db.Create(&user).Error)
	createRecallOfferFixture(t, user, now, "newer small", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "percent", PercentOff: 10},
		RecallProductScope{TopUpPriceIDs: []string{"price_topup"}}, func(recipient *model.RecallRecipient) {
			recipient.PromotionIssuedAt = now.Add(20 * time.Second).Unix()
		})
	larger := createRecallOfferFixture(t, user, now, "older larger", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "fixed", AmountOff: 1500, Currency: "USD"},
		RecallProductScope{TopUpPriceIDs: []string{"price_topup"}}, func(recipient *model.RecallRecipient) {
			recipient.PromotionIssuedAt = now.Add(10 * time.Second).Unix()
		})

	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }
	resolved, err := claimService.ResolveBestRecallOffer(context.Background(), user.Id, RecallPurchaseKindTopUp, "price_topup", "USD", 10_000)

	require.NoError(t, err)
	require.NotNil(t, resolved)
	require.Equal(t, larger.recipient.Id, resolved.View.RecipientID)
	require.Equal(t, int64(1500), resolved.DiscountMinor)
	require.Equal(t, *larger.recipient.StripePromotionCodeId, resolved.PromotionCodeID)
}

func TestRecallResolveBestOfferCanonicalizesPersistedCurrencyConfig(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	user := model.User{Username: "canonical-offer-user", AffCode: "canonical-offer-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "canonical@example.com"}
	require.NoError(t, db.Create(&user).Error)
	option := createRecallOfferFixture(t, user, now, "canonical option", model.RecallCampaignRunning,
		RecallDiscountConfig{
			Type:                  "fixed",
			AmountOff:             500,
			Currency:              "usd",
			CurrencyOptions:       map[string]int64{"brl": 2500},
			MinimumAmount:         10000,
			MinimumAmountCurrency: "brl",
		},
		RecallProductScope{TopUpPriceIDs: []string{"price_topup"}}, nil)

	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }
	resolved, err := claimService.ResolveBestRecallOffer(context.Background(), user.Id, RecallPurchaseKindTopUp, "price_topup", "BRL", 10000)

	require.NoError(t, err)
	require.NotNil(t, resolved)
	require.Equal(t, option.recipient.Id, resolved.View.RecipientID)
	require.Equal(t, int64(2500), resolved.DiscountMinor)
}

func TestRecallResolveBestOfferSkipsSubscriptionPlanHydration(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	user := model.User{Username: "resolve-no-plan-user", AffCode: "resolve-no-plan-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "resolve-no-plan@example.com"}
	require.NoError(t, db.Create(&user).Error)
	fixture := createRecallOfferFixture(t, user, now, "resolve no plan hydration", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "percent", PercentOff: 25},
		RecallProductScope{SubscriptionPriceIDs: []string{"price_subscription"}},
		nil)
	sentinel := errors.New("subscription plan lookup must not run")
	var planLookupCalled atomic.Bool
	callbackName := "recall_resolve_no_plan_hydration_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "subscription_plans" {
			planLookupCalled.Store(true)
			tx.AddError(sentinel)
		}
	}))
	t.Cleanup(func() { _ = db.Callback().Query().Remove(callbackName) })

	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }
	resolved, err := claimService.ResolveBestRecallOffer(context.Background(), user.Id, RecallPurchaseKindSubscription, "price_subscription", "USD", 10000)

	require.NoError(t, err)
	require.NotNil(t, resolved)
	require.Equal(t, fixture.recipient.Id, resolved.View.RecipientID)
	require.Equal(t, int64(2500), resolved.DiscountMinor)
	require.False(t, planLookupCalled.Load())
}

func TestRecallResolveBestOfferTiesByIssuedAtThenRecipientID(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	user := model.User{Username: "tie-offer-user", AffCode: "tie-offer-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "tie@example.com"}
	require.NoError(t, db.Create(&user).Error)
	old := createRecallOfferFixture(t, user, now, "old tie", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "percent", PercentOff: 10},
		RecallProductScope{SubscriptionPriceIDs: []string{"price_subscription"}}, func(recipient *model.RecallRecipient) {
			recipient.PromotionIssuedAt = now.Unix()
		})
	newer := createRecallOfferFixture(t, user, now, "new tie", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "percent", PercentOff: 10},
		RecallProductScope{SubscriptionPriceIDs: []string{"price_subscription"}}, func(recipient *model.RecallRecipient) {
			recipient.PromotionIssuedAt = now.Add(time.Second).Unix()
		})
	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }

	resolved, err := claimService.ResolveBestRecallOffer(context.Background(), user.Id, RecallPurchaseKindSubscription, "price_subscription", "USD", 10_000)
	require.NoError(t, err)
	require.Equal(t, newer.recipient.Id, resolved.View.RecipientID)

	require.NoError(t, db.Model(&model.RecallRecipient{}).Where("id = ?", newer.recipient.Id).Update("promotion_issued_at", old.recipient.PromotionIssuedAt).Error)
	resolved, err = claimService.ResolveBestRecallOffer(context.Background(), user.Id, RecallPurchaseKindSubscription, "price_subscription", "USD", 10_000)
	require.NoError(t, err)
	require.Equal(t, old.recipient.Id, resolved.View.RecipientID)
}

func TestRecallResolveBestOfferRejectsInvalidFactsAndProductEligibility(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	user := model.User{Username: "facts-offer-user", AffCode: "facts-offer-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "facts@example.com"}
	require.NoError(t, db.Create(&user).Error)
	createRecallOfferFixture(t, user, now, "facts offer", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "percent", PercentOff: 10},
		RecallProductScope{TopUpPriceIDs: []string{"price_topup"}, SubscriptionPriceIDs: []string{"price_subscription"}}, nil)
	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }

	for _, test := range []struct {
		name     string
		kind     string
		priceID  string
		currency string
		subtotal int64
	}{
		{name: "empty kind", kind: "", priceID: "price_topup", currency: "USD", subtotal: 1000},
		{name: "unknown kind", kind: "other", priceID: "price_topup", currency: "USD", subtotal: 1000},
		{name: "empty price", kind: RecallPurchaseKindTopUp, priceID: "", currency: "USD", subtotal: 1000},
		{name: "empty currency", kind: RecallPurchaseKindTopUp, priceID: "price_topup", currency: "", subtotal: 1000},
		{name: "negative subtotal", kind: RecallPurchaseKindTopUp, priceID: "price_topup", currency: "USD", subtotal: -1},
	} {
		t.Run(test.name, func(t *testing.T) {
			_, err := claimService.ResolveBestRecallOffer(context.Background(), user.Id, test.kind, test.priceID, test.currency, test.subtotal)
			require.Error(t, err)
		})
	}

	zeroSubtotal, err := claimService.ResolveBestRecallOffer(context.Background(), user.Id, RecallPurchaseKindSubscription, "price_subscription", "USD", 0)
	require.NoError(t, err)
	require.Nil(t, zeroSubtotal)

	wrongPrice, err := claimService.ResolveBestRecallOffer(context.Background(), user.Id, RecallPurchaseKindTopUp, "price_subscription", "USD", 1000)
	require.NoError(t, err)
	require.Nil(t, wrongPrice)

	zeroUser := model.User{Username: "zero-offer-user", AffCode: "zero-offer-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "zero@example.com"}
	require.NoError(t, db.Create(&zeroUser).Error)
	createRecallOfferFixture(t, zeroUser, now, "zero offer", model.RecallCampaignRunning,
		RecallDiscountConfig{Type: "fixed", AmountOff: 0, Currency: "USD"},
		RecallProductScope{TopUpPriceIDs: []string{"price_topup"}}, nil)
	zero, err := claimService.ResolveBestRecallOffer(context.Background(), zeroUser.Id, RecallPurchaseKindTopUp, "price_topup", "USD", 1000)
	require.NoError(t, err)
	require.Nil(t, zero)
}

func TestRecallFirstMonthDiscountAmountMinor(t *testing.T) {
	tests := []struct {
		name     string
		discount RecallDiscountConfig
		currency string
		unit     int64
		want     int64
	}{
		{
			name:     "percent rounds positive minor units",
			discount: RecallDiscountConfig{Type: "percent", PercentOff: 12.5},
			currency: "BRL",
			unit:     999,
			want:     125,
		},
		{
			name:     "percent rounds USD half up to minor unit",
			discount: RecallDiscountConfig{Type: "percent", PercentOff: 12.5},
			currency: "USD",
			unit:     999,
			want:     125,
		},
		{
			name:     "percent rounds JPY half up to integer unit",
			discount: RecallDiscountConfig{Type: "percent", PercentOff: 12.5},
			currency: "JPY",
			unit:     999,
			want:     125,
		},
		{
			name: "fixed prefers currency options case insensitively",
			discount: RecallDiscountConfig{
				Type:            "fixed",
				AmountOff:       500,
				Currency:        "brl",
				CurrencyOptions: map[string]int64{"InR": 45000, "BRL": 2500},
			},
			currency: "brl",
			unit:     10000,
			want:     2500,
		},
		{
			name:     "fixed falls back to primary currency",
			discount: RecallDiscountConfig{Type: "fixed", AmountOff: 500, Currency: "USD"},
			currency: "usd",
			unit:     10000,
			want:     500,
		},
		{
			name:     "fixed ignores primary currency mismatch",
			discount: RecallDiscountConfig{Type: "fixed", AmountOff: 500, Currency: "USD"},
			currency: "BRL",
			unit:     10000,
			want:     0,
		},
		{
			name: "minimum allows matching currency at threshold",
			discount: RecallDiscountConfig{
				Type:                  "fixed",
				AmountOff:             500,
				Currency:              "usd",
				MinimumAmount:         10000,
				MinimumAmountCurrency: "USD",
			},
			currency: "usd",
			unit:     10000,
			want:     500,
		},
		{
			name: "minimum rejects amount below threshold",
			discount: RecallDiscountConfig{
				Type:                  "fixed",
				AmountOff:             500,
				Currency:              "usd",
				MinimumAmount:         10001,
				MinimumAmountCurrency: "usd",
			},
			currency: "usd",
			unit:     10000,
			want:     0,
		},
		{
			name: "minimum rejects currency mismatch",
			discount: RecallDiscountConfig{
				Type:                  "fixed",
				AmountOff:             500,
				Currency:              "usd",
				MinimumAmount:         10000,
				MinimumAmountCurrency: "eur",
			},
			currency: "usd",
			unit:     10000,
			want:     0,
		},
		{
			name:     "percent clamps to unit",
			discount: RecallDiscountConfig{Type: "percent", PercentOff: 150},
			currency: "USD",
			unit:     10000,
			want:     10000,
		},
		{
			name:     "fixed clamps negative to zero",
			discount: RecallDiscountConfig{Type: "fixed", AmountOff: -500, Currency: "USD"},
			currency: "USD",
			unit:     10000,
			want:     0,
		},
		{
			name:     "fixed clamps to subtotal",
			discount: RecallDiscountConfig{Type: "fixed", AmountOff: 1500, Currency: "USD"},
			currency: "USD",
			unit:     1000,
			want:     1000,
		},
		{
			name:     "zero discount is ineligible",
			discount: RecallDiscountConfig{Type: "fixed", AmountOff: 0, Currency: "USD"},
			currency: "USD",
			unit:     1000,
			want:     0,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := calculateRecallFirstMonthDiscountAmountMinor(test.discount, test.currency, test.unit)
			require.Equal(t, test.want, got)
		})
	}
}

func TestRecallFirstMonthDiscountAmountMinorMinimumSpend(t *testing.T) {
	discount := RecallDiscountConfig{
		Type:      "fixed",
		AmountOff: 500,
		Currency:  "usd",
		CurrencyOptions: map[string]int64{
			"inr": 45_000,
			"brl": 2_500,
			"jpy": 750,
		},
		MinimumSpend: &RecallMinimumSpendConfig{
			Enabled: true,
			Amounts: map[string]int64{"usd": 2_500, "inr": 200_000, "brl": 12_500, "jpy": 3_750},
		},
	}
	tests := []struct {
		name     string
		currency string
		unit     int64
		want     int64
	}{
		{name: "USD below threshold", currency: "USD", unit: 2_499, want: 0},
		{name: "USD at threshold", currency: "USD", unit: 2_500, want: 500},
		{name: "INR below threshold", currency: "INR", unit: 199_999, want: 0},
		{name: "INR at threshold", currency: "INR", unit: 200_000, want: 45_000},
		{name: "BRL below threshold", currency: "BRL", unit: 12_499, want: 0},
		{name: "BRL at threshold", currency: "BRL", unit: 12_500, want: 2_500},
		{name: "JPY below threshold", currency: "JPY", unit: 3_749, want: 0},
		{name: "JPY at threshold", currency: "JPY", unit: 3_750, want: 750},
		{name: "missing runtime currency", currency: "", unit: 2_500, want: 0},
		{name: "unsupported runtime currency", currency: "EUR", unit: 2_500, want: 0},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := calculateRecallFirstMonthDiscountAmountMinor(discount, test.currency, test.unit)
			require.Equal(t, test.want, got)
		})
	}

	disabled := discount
	disabled.MinimumSpend = &RecallMinimumSpendConfig{Enabled: false}
	require.Equal(t, int64(500), calculateRecallFirstMonthDiscountAmountMinor(disabled, "USD", 1_000))
}

func TestRecallActualDiscountAmountMinorUsesExactCheckoutFacts(t *testing.T) {
	tests := []struct {
		name     string
		discount RecallDiscountConfig
		currency string
		subtotal int64
		want     int64
	}{
		{
			name:     "percent rounds USD half up to minor unit",
			discount: RecallDiscountConfig{Type: "percent", PercentOff: 12.5},
			currency: "USD",
			subtotal: 999,
			want:     125,
		},
		{
			name:     "percent rounds JPY half up to integer unit",
			discount: RecallDiscountConfig{Type: "percent", PercentOff: 12.5},
			currency: "JPY",
			subtotal: 999,
			want:     125,
		},
		{
			name: "fixed canonicalizes persisted lowercase currency option",
			discount: RecallDiscountConfig{
				Type:            "fixed",
				AmountOff:       500,
				Currency:        "usd",
				CurrencyOptions: map[string]int64{"brl": 2500},
			},
			currency: "BRL",
			subtotal: 10000,
			want:     2500,
		},
		{
			name: "fixed still requires semantic currency match after canonicalization",
			discount: RecallDiscountConfig{
				Type:            "fixed",
				AmountOff:       500,
				Currency:        "usd",
				CurrencyOptions: map[string]int64{"brl": 2500},
			},
			currency: "JPY",
			subtotal: 10000,
			want:     0,
		},
		{
			name: "fixed uses exact uppercase currency option",
			discount: RecallDiscountConfig{
				Type:            "fixed",
				AmountOff:       500,
				Currency:        "USD",
				CurrencyOptions: map[string]int64{"BRL": 2500},
			},
			currency: "BRL",
			subtotal: 10000,
			want:     2500,
		},
		{
			name: "minimum canonicalizes persisted lowercase currency",
			discount: RecallDiscountConfig{
				Type:                  "fixed",
				AmountOff:             500,
				Currency:              "usd",
				MinimumAmount:         10000,
				MinimumAmountCurrency: "usd",
			},
			currency: "USD",
			subtotal: 10000,
			want:     500,
		},
		{
			name:     "fixed clamps to subtotal",
			discount: RecallDiscountConfig{Type: "fixed", AmountOff: 1500, Currency: "USD"},
			currency: "USD",
			subtotal: 1000,
			want:     1000,
		},
		{
			name:     "zero discount is ineligible",
			discount: RecallDiscountConfig{Type: "fixed", AmountOff: 0, Currency: "USD"},
			currency: "USD",
			subtotal: 1000,
			want:     0,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := calculateRecallActualDiscountAmountMinor(test.discount, test.currency, test.subtotal)
			require.Equal(t, test.want, got)
		})
	}
}

func TestRecallActualDiscountAmountMinorMinimumSpend(t *testing.T) {
	discount := RecallDiscountConfig{
		Type:      "fixed",
		AmountOff: 500,
		Currency:  "usd",
		CurrencyOptions: map[string]int64{
			"inr": 45_000,
			"brl": 2_500,
			"jpy": 750,
		},
		MinimumSpend: &RecallMinimumSpendConfig{
			Enabled: true,
			Amounts: map[string]int64{"usd": 2_500, "inr": 200_000, "brl": 12_500, "jpy": 3_750},
		},
	}
	tests := []struct {
		name     string
		currency string
		subtotal int64
		want     int64
	}{
		{name: "USD below threshold", currency: "USD", subtotal: 2_499, want: 0},
		{name: "USD at threshold", currency: "USD", subtotal: 2_500, want: 500},
		{name: "INR below threshold", currency: "INR", subtotal: 199_999, want: 0},
		{name: "INR at threshold", currency: "INR", subtotal: 200_000, want: 45_000},
		{name: "BRL below threshold", currency: "BRL", subtotal: 12_499, want: 0},
		{name: "BRL at threshold", currency: "BRL", subtotal: 12_500, want: 2_500},
		{name: "JPY below threshold", currency: "JPY", subtotal: 3_749, want: 0},
		{name: "JPY at threshold", currency: "JPY", subtotal: 3_750, want: 750},
		{name: "missing runtime currency", currency: "", subtotal: 2_500, want: 0},
		{name: "unsupported runtime currency", currency: "EUR", subtotal: 2_500, want: 0},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := calculateRecallActualDiscountAmountMinor(discount, test.currency, test.subtotal)
			require.Equal(t, test.want, got)
		})
	}

	disabled := discount
	disabled.MinimumSpend = &RecallMinimumSpendConfig{Enabled: false}
	require.Equal(t, int64(500), calculateRecallActualDiscountAmountMinor(disabled, "USD", 1_000))
}

func TestRecallClaimAPITypesDoNotExposeSecrets(t *testing.T) {
	promotionID := "promo_secret"
	hash := strings.Repeat("f", 64)
	viewRaw, err := common.Marshal(RecallClaimView{PromotionCodeMasked: "FKSE****34"})
	require.NoError(t, err)
	require.NotContains(t, string(viewRaw), "promo_secret")
	require.NotContains(t, string(viewRaw), hash)
	recipientRaw, err := common.Marshal(model.RecallRecipient{StripePromotionCodeId: &promotionID, PromotionCode: "FKSECRET234", ClaimTokenHash: &hash})
	require.NoError(t, err)
	require.NotContains(t, string(recipientRaw), promotionID)
	require.NotContains(t, string(recipientRaw), "FKSECRET234")
	require.NotContains(t, string(recipientRaw), hash)
	messageRaw, err := common.Marshal(model.RecallMessage{ClaimTokenHash: &hash})
	require.NoError(t, err)
	require.NotContains(t, string(messageRaw), hash)
	checkoutRaw, err := common.Marshal(RecallCheckoutDiscount{PromotionCodeID: promotionID, CampaignID: 12, RecipientID: 34})
	require.NoError(t, err)
	var checkoutJSON map[string]any
	require.NoError(t, common.Unmarshal(checkoutRaw, &checkoutJSON))
	require.ElementsMatch(t, []string{"promotion_code_id", "campaign_id", "recipient_id", "discount_amount_minor"}, recallAudienceJSONKeys(checkoutJSON))
	require.NotContains(t, string(checkoutRaw), "FKSECRET234")
	require.NotContains(t, string(checkoutRaw), hash)
}

func TestRecallClaimSignedUnsubscribePreservesSettingsAndCancelsAllPendingMessages(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Unix(1_721_000_000, 0).UTC()
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "recall-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	settingJSON, err := common.Marshal(dto.UserSetting{Language: "zh", BillingPreference: "wallet_first", RecallMarketingOptOut: false})
	require.NoError(t, err)
	user := model.User{Username: "unsubscribe-user", AffCode: "unsubscribe-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "unsubscribe@example.com", Setting: string(settingJSON)}
	require.NoError(t, db.Create(&user).Error)

	var leasedMessage model.RecallMessage
	for campaignIndex := 0; campaignIndex < 2; campaignIndex++ {
		campaign := model.RecallCampaign{Name: "campaign", Status: model.RecallCampaignRunning, AudienceTemplate: "first_purchase", AudienceConfig: `{}`, ExecutionMode: "manual", CouponSource: "automatic", DiscountConfig: `{}`, ProductScope: `{}`, EmailSequenceConfig: `[]`}
		require.NoError(t, db.Create(&campaign).Error)
		recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: user.Id, EligibilitySnapshot: `{}`, EmailSnapshot: user.Email, LanguageSnapshot: "zh", State: model.RecallRecipientContacting}
		require.NoError(t, db.Create(&recipient).Error)
		for stage, state := range []string{model.RecallMessageScheduled, model.RecallMessageRetryWait, model.RecallMessageLeased, model.RecallMessageAccepted} {
			message := model.RecallMessage{RecipientId: recipient.Id, StageNo: stage + 1, TemplateVersion: 1, TemplateSnapshot: `{}`, State: state}
			if state == model.RecallMessageLeased {
				message.LeaseOwner = "old-worker"
				message.LeaseExpiresAt = now.Add(time.Minute).Unix()
			}
			require.NoError(t, db.Create(&message).Error)
			if state == model.RecallMessageLeased && leasedMessage.Id == 0 {
				leasedMessage = message
			}
		}
	}

	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }
	token, err := claimService.CreateUnsubscribeToken(user.Id, now.Add(time.Hour))
	require.NoError(t, err)
	require.NoError(t, claimService.Unsubscribe(context.Background(), token))

	var storedUser model.User
	require.NoError(t, db.First(&storedUser, user.Id).Error)
	storedSetting := dto.UserSetting{}
	require.NoError(t, common.Unmarshal([]byte(storedUser.Setting), &storedSetting))
	require.True(t, storedSetting.RecallMarketingOptOut)
	require.Equal(t, "zh", storedSetting.Language)
	require.Equal(t, "wallet_first", storedSetting.BillingPreference)
	var cancelled int64
	require.NoError(t, db.Model(&model.RecallMessage{}).Where("state = ?", model.RecallMessageCancelled).Count(&cancelled).Error)
	require.EqualValues(t, 6, cancelled)
	var accepted int64
	require.NoError(t, db.Model(&model.RecallMessage{}).Where("state = ?", model.RecallMessageAccepted).Count(&accepted).Error)
	require.EqualValues(t, 2, accepted)
	won, err := model.CompleteRecallMessageLease(
		leasedMessage.Id,
		"old-worker",
		leasedMessage.LeaseExpiresAt,
		model.RecallMessageLeased,
		model.RecallMessageAccepted,
		map[string]any{"accepted_at": now.Unix()},
	)
	require.NoError(t, err)
	require.False(t, won, "an opted-out user's old worker must lose its cancelled lease")
}

func TestRecallClaimOptOutSurvivesStaleUserSettingsWriter(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	settingJSON, err := common.Marshal(dto.UserSetting{Language: "zh", RecallMarketingOptOut: false})
	require.NoError(t, err)
	user := model.User{Username: "stale-settings-user", AffCode: "stale-settings-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "stale@example.com", Setting: string(settingJSON)}
	require.NoError(t, db.Create(&user).Error)

	var staleWriter model.User
	require.NoError(t, db.First(&staleWriter, user.Id).Error)
	found, err := model.SetRecallMarketingOptOutWithContext(context.Background(), user.Id, time.Now().Unix())
	require.NoError(t, err)
	require.True(t, found)

	staleSetting := staleWriter.GetSetting()
	staleSetting.BillingPreference = "stripe_first"
	staleWriter.SetSetting(staleSetting)
	require.NoError(t, staleWriter.Update(false))

	var storedUser model.User
	require.NoError(t, db.First(&storedUser, user.Id).Error)
	storedSetting := storedUser.GetSetting()
	require.True(t, storedSetting.RecallMarketingOptOut)
	require.Equal(t, "stripe_first", storedSetting.BillingPreference)
}

func TestRecallClaimUnsubscribeRejectsTamperingAndExpiry(t *testing.T) {
	setupRecallCampaignTestDB(t)
	now := time.Unix(1_721_000_000, 0).UTC()
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "recall-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }

	token, err := claimService.CreateUnsubscribeToken(7, now.Add(time.Hour))
	require.NoError(t, err)
	tampered := token[:len(token)-1] + "0"
	err = claimService.Unsubscribe(context.Background(), tampered)
	require.True(t, errors.Is(err, ErrRecallUnsubscribeInvalid))
	expired, err := claimService.CreateUnsubscribeToken(7, now.Add(-time.Second))
	require.NoError(t, err)
	err = claimService.Unsubscribe(context.Background(), expired)
	require.ErrorIs(t, err, ErrRecallUnsubscribeExpired)
}

func signRecallUnsubscribePayload(t *testing.T, payload any) string {
	t.Helper()
	payloadJSON, err := common.Marshal(payload)
	require.NoError(t, err)
	encodedPayload := base64.RawURLEncoding.EncodeToString(payloadJSON)
	signature := common.GenerateHMACWithKey([]byte(common.CryptoSecret), encodedPayload)
	return encodedPayload + "." + signature
}

func TestRecallClaimRecipientUnsubscribeSuppressesOnlyUnboundRecipient(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	now := time.Unix(1_721_000_000, 0).UTC()
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "recall-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	campaign := model.RecallCampaign{Name: "recipient unsubscribe", Status: model.RecallCampaignRunning, AudienceTemplate: "specified_users", AudienceConfig: `{}`, ExecutionMode: "manual", CouponSource: "automatic", DiscountConfig: `{}`, ProductScope: `{}`, EmailSequenceConfig: `[]`}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: "local-unsub@example.com", LanguageSnapshot: "en", State: model.RecallRecipientContacting, LeaseOwner: "recipient-worker", LeaseExpiresAt: now.Add(time.Minute).Unix()}
	other := model.RecallRecipient{CampaignId: campaign.Id, UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: "other-unsub@example.com", LanguageSnapshot: "en", State: model.RecallRecipientContacting}
	require.NoError(t, db.Create(&recipient).Error)
	require.NoError(t, db.Create(&other).Error)
	states := []string{model.RecallMessageScheduled, model.RecallMessageRetryWait, model.RecallMessageLeased, model.RecallMessageSending, model.RecallMessageAccepted}
	for index, state := range states {
		message := model.RecallMessage{RecipientId: recipient.Id, StageNo: index + 1, TemplateVersion: 1, TemplateSnapshot: `{}`, State: state, NextAttemptAt: now.Add(time.Minute).Unix(), LeaseOwner: "old-worker", LeaseExpiresAt: now.Add(time.Minute).Unix()}
		require.NoError(t, db.Create(&message).Error)
	}
	otherMessage := model.RecallMessage{RecipientId: other.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: `{}`, State: model.RecallMessageScheduled}
	require.NoError(t, db.Create(&otherMessage).Error)

	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }
	token, err := claimService.CreateRecipientUnsubscribeToken(recipient.Id, now.Add(time.Hour))
	require.NoError(t, err)
	require.NoError(t, claimService.Unsubscribe(context.Background(), token))
	require.NoError(t, claimService.Unsubscribe(context.Background(), token))

	var storedRecipient model.RecallRecipient
	require.NoError(t, db.First(&storedRecipient, recipient.Id).Error)
	require.Equal(t, model.RecallRecipientSuppressed, storedRecipient.State)
	require.Zero(t, storedRecipient.UserId)
	require.Empty(t, storedRecipient.LeaseOwner)
	require.Zero(t, storedRecipient.LeaseExpiresAt)
	var messages []model.RecallMessage
	require.NoError(t, db.Where("recipient_id = ?", recipient.Id).Order("stage_no ASC").Find(&messages).Error)
	for index, message := range messages {
		if index < 4 {
			require.Equal(t, model.RecallMessageCancelled, message.State)
			require.Equal(t, "recipient_unsubscribed", message.LastErrorCode)
			require.Zero(t, message.NextAttemptAt)
			require.Empty(t, message.LeaseOwner)
			require.Zero(t, message.LeaseExpiresAt)
			continue
		}
		require.Equal(t, model.RecallMessageAccepted, message.State)
	}
	var storedOther model.RecallMessage
	require.NoError(t, db.First(&storedOther, otherMessage.Id).Error)
	require.Equal(t, model.RecallMessageScheduled, storedOther.State)
}

func TestRecallClaimRecipientUnsubscribeBoundRecipientUsesGlobalOptOut(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	now := time.Unix(1_721_000_000, 0).UTC()
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "recall-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	user := model.User{Username: "recipient-unsub-user", AffCode: "recipient-unsub-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "bound-unsub@example.com"}
	otherUser := model.User{Username: "recipient-unsub-other", AffCode: "recipient-unsub-other-aff", Password: "hash", Status: common.UserStatusEnabled, Email: "other-bound-unsub@example.com"}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Create(&otherUser).Error)
	campaign := model.RecallCampaign{Name: "bound recipient unsubscribe", Status: model.RecallCampaignRunning, AudienceTemplate: "specified_users", AudienceConfig: `{}`, ExecutionMode: "manual", CouponSource: "automatic", DiscountConfig: `{}`, ProductScope: `{}`, EmailSequenceConfig: `[]`}
	require.NoError(t, db.Create(&campaign).Error)
	first := model.RecallRecipient{CampaignId: campaign.Id, UserId: user.Id, EligibilitySnapshot: `{}`, EmailSnapshot: user.Email, LanguageSnapshot: "en", State: model.RecallRecipientContacting}
	second := model.RecallRecipient{CampaignId: campaign.Id + 1, UserId: user.Id, EligibilitySnapshot: `{}`, EmailSnapshot: user.Email, LanguageSnapshot: "en", State: model.RecallRecipientContacting}
	other := model.RecallRecipient{CampaignId: campaign.Id, UserId: otherUser.Id, EligibilitySnapshot: `{}`, EmailSnapshot: otherUser.Email, LanguageSnapshot: "en", State: model.RecallRecipientContacting}
	require.NoError(t, db.Create(&first).Error)
	require.NoError(t, db.Create(&second).Error)
	require.NoError(t, db.Create(&other).Error)
	for index, recipientID := range []int64{first.Id, second.Id, other.Id} {
		message := model.RecallMessage{RecipientId: recipientID, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: `{}`, State: model.RecallMessageScheduled}
		require.NoError(t, db.Create(&message).Error, index)
	}

	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }
	token, err := claimService.CreateRecipientUnsubscribeToken(first.Id, now.Add(time.Hour))
	require.NoError(t, err)
	require.NoError(t, claimService.Unsubscribe(context.Background(), token))
	require.NoError(t, claimService.Unsubscribe(context.Background(), token))

	var storedUser model.User
	require.NoError(t, db.First(&storedUser, user.Id).Error)
	require.True(t, storedUser.GetSetting().RecallMarketingOptOut)
	var cancelled int64
	require.NoError(t, db.Model(&model.RecallMessage{}).Where("recipient_id IN ? AND state = ?", []int64{first.Id, second.Id}, model.RecallMessageCancelled).Count(&cancelled).Error)
	require.EqualValues(t, 2, cancelled)
	var otherMessage model.RecallMessage
	require.NoError(t, db.Where("recipient_id = ?", other.Id).First(&otherMessage).Error)
	require.Equal(t, model.RecallMessageScheduled, otherMessage.State)
	var storedOtherUser model.User
	require.NoError(t, db.First(&storedOtherUser, otherUser.Id).Error)
	require.False(t, storedOtherUser.GetSetting().RecallMarketingOptOut)
}

func TestRecallClaimRecipientUnsubscribeMapsMissingRecipientButPropagatesLoadErrors(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	now := time.Unix(1_721_000_000, 0).UTC()
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "recall-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }

	missingToken, err := claimService.CreateRecipientUnsubscribeToken(999_999, now.Add(time.Hour))
	require.NoError(t, err)
	require.ErrorIs(t, claimService.Unsubscribe(context.Background(), missingToken), ErrRecallUnsubscribeInvalid)

	campaign := model.RecallCampaign{Name: "recipient load error", Status: model.RecallCampaignRunning, AudienceTemplate: "specified_users", AudienceConfig: `{}`, ExecutionMode: "manual", CouponSource: "automatic", DiscountConfig: `{}`, ProductScope: `{}`, EmailSequenceConfig: `[]`}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: "load-error@example.com", LanguageSnapshot: "en", State: model.RecallRecipientContacting}
	require.NoError(t, db.Create(&recipient).Error)
	token, err := claimService.CreateRecipientUnsubscribeToken(recipient.Id, now.Add(time.Hour))
	require.NoError(t, err)

	cancelledCtx, cancel := context.WithCancel(context.Background())
	cancel()
	require.ErrorIs(t, claimService.Unsubscribe(cancelledCtx, token), context.Canceled)

	sentinel := errors.New("recipient load failed")
	callbackName := "recall_unsubscribe_recipient_load_error_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "recall_recipients" {
			tx.AddError(sentinel)
		}
	}))
	t.Cleanup(func() { _ = db.Callback().Query().Remove(callbackName) })
	require.ErrorIs(t, claimService.Unsubscribe(context.Background(), token), sentinel)
}

func TestRecallClaimUnsubscribeRejectsInvalidVersionsAndMixedFields(t *testing.T) {
	setupRecallCampaignTestDB(t)
	now := time.Unix(1_721_000_000, 0).UTC()
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "recall-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	claimService := NewRecallClaimService()
	claimService.now = func() time.Time { return now }

	tests := []struct {
		name    string
		payload map[string]any
	}{
		{name: "unknown version", payload: map[string]any{"v": 3, "u": 7, "e": now.Add(time.Hour).Unix()}},
		{name: "v1 missing user", payload: map[string]any{"v": 1, "e": now.Add(time.Hour).Unix()}},
		{name: "v1 mixed recipient", payload: map[string]any{"v": 1, "u": 7, "r": 9, "e": now.Add(time.Hour).Unix()}},
		{name: "v2 missing recipient", payload: map[string]any{"v": 2, "e": now.Add(time.Hour).Unix()}},
		{name: "v2 mixed user", payload: map[string]any{"v": 2, "u": 7, "r": 9, "e": now.Add(time.Hour).Unix()}},
		{name: "v2 bad recipient", payload: map[string]any{"v": 2, "r": -1, "e": now.Add(time.Hour).Unix()}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := claimService.Unsubscribe(context.Background(), signRecallUnsubscribePayload(t, test.payload))
			require.ErrorIs(t, err, ErrRecallUnsubscribeInvalid)
		})
	}
	expiredV2 := signRecallUnsubscribePayload(t, map[string]any{"v": 2, "r": 9, "e": now.Add(-time.Second).Unix()})
	require.ErrorIs(t, claimService.Unsubscribe(context.Background(), expiredV2), ErrRecallUnsubscribeExpired)
}

func TestRecallClaimRuntimeContainsClaimsWithoutSchedulerWork(t *testing.T) {
	runtime := GetRecallRuntime()
	require.NotNil(t, runtime.Claims)
}
