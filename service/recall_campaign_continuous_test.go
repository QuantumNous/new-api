package service

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func validRecallContinuousDraft() RecallCampaignDraft {
	draft := RecallCampaignDraft{
		CampaignType:      model.RecallCampaignTypeContentOnly,
		Name:              "Quota low lifecycle notice",
		DeliveryPolicy:    model.RecallDeliveryPolicyService,
		LifecycleTrigger:  model.RecallLifecycleTriggerQuotaLow,
		ExecutionMode:     "continuous",
		EnrollmentLimit:   100,
		WorkerConcurrency: 2,
		Emails: []RecallEmailStage{{
			StageNo:      1,
			DelaySeconds: 0,
			Templates: map[string]RecallEmailTemplate{
				"en": {Subject: "Quota notice", BodyText: "Your quota is low."},
			},
		}},
	}
	english := draft.Emails[0].Templates["en"]
	for _, language := range recallEmailTranslationLanguages {
		draft.Emails[0].Templates[language] = RecallEmailTemplate{
			Subject:  language + ":" + english.Subject,
			BodyText: language + ":" + english.BodyText,
		}
	}
	return draft
}

func TestRecallCampaignContinuousRequiresLifecycleCollectionMarker(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))

	_, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())

	require.ErrorContains(t, err, "lifecycle event collection marker")
	var count int64
	require.NoError(t, model.DB.Model(&model.Option{}).
		Where("key = ?", model.OptionKeyRecallLifecycleEventCollectionStartedAt).
		Count(&count).Error)
	require.Zero(t, count)
}

func TestRecallCampaignContinuousPreviewAndActivationRequireLifecycleCollectionMarker(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	campaign, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())
	require.NoError(t, err)
	require.NoError(t, model.DB.Where("key = ?", model.OptionKeyRecallLifecycleEventCollectionStartedAt).Delete(&model.Option{}).Error)

	_, _, err = service.Preview(context.Background(), campaign.Id, 10)
	require.ErrorContains(t, err, "lifecycle event collection marker")
	assertRecallLifecycleCollectionMarkerAbsent(t)

	err = service.Activate(context.Background(), 7, campaign.Id)
	require.ErrorContains(t, err, "lifecycle event collection marker")
	assertRecallLifecycleCollectionMarkerAbsent(t)
	var ownedSlots int64
	require.NoError(t, model.DB.Model(&model.RecallContinuousTriggerSlot{}).
		Where("trigger = ? AND campaign_id <> 0", model.RecallLifecycleTriggerQuotaLow).
		Count(&ownedSlots).Error)
	require.Zero(t, ownedSlots)
}

func TestRecallCampaignContinuousActivationClaimsSlotAndUsesDBTimeForFromNow(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	beforeDB, err := model.GetDBTimestampWithContext(context.Background())
	require.NoError(t, err)

	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return time.Unix(beforeDB+86400, 0) }
	campaign, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())
	require.NoError(t, err)
	require.Zero(t, campaign.PromotionValidSeconds)

	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))

	afterDB, err := model.GetDBTimestampWithContext(context.Background())
	require.NoError(t, err)
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignRunning, stored.Status)
	require.Equal(t, "continuous", stored.ExecutionMode)
	require.Equal(t, model.RecallLifecycleTriggerQuotaLow, stored.LifecycleTrigger)
	require.Equal(t, model.RecallDeliveryPolicyService, stored.DeliveryPolicy)
	require.Zero(t, stored.PromotionValidSeconds)
	require.GreaterOrEqual(t, stored.ProcessingStartAt, beforeDB)
	require.LessOrEqual(t, stored.ProcessingStartAt, afterDB)
	require.NotEqual(t, service.now().Unix(), stored.ProcessingStartAt)

	var slot model.RecallContinuousTriggerSlot
	require.NoError(t, model.DB.First(&slot, "trigger = ?", model.RecallLifecycleTriggerQuotaLow).Error)
	require.Equal(t, campaign.Id, slot.CampaignId)
}

func TestRecallCampaignContinuousBlankDeliveryPolicyCanonicalizesToTriggerPolicy(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	draft := validRecallContinuousDraft()
	draft.DeliveryPolicy = ""

	campaign, err := service.SaveDraft(context.Background(), 7, draft)

	require.NoError(t, err)
	require.Equal(t, model.RecallDeliveryPolicyService, campaign.DeliveryPolicy)
}

func TestRecallCampaignContinuousBlankDeliveryPolicyCanonicalizesEngagementTrigger(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	draft := validRecallContinuousDraft()
	draft.DeliveryPolicy = ""
	draft.LifecycleTrigger = model.RecallLifecycleTriggerPaymentPending

	campaign, err := service.SaveDraft(context.Background(), 7, draft)

	require.NoError(t, err)
	require.Equal(t, model.RecallDeliveryPolicyEngagement, campaign.DeliveryPolicy)
}

func TestRecallCampaignContinuousSlotRaceAdmitsOneCampaign(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))

	first, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())
	require.NoError(t, err)
	second, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())
	require.NoError(t, err)

	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for _, id := range []int64{first.Id, second.Id} {
		wg.Add(1)
		go func(campaignID int64) {
			defer wg.Done()
			errs <- service.Activate(context.Background(), 7, campaignID)
		}(id)
	}
	wg.Wait()
	close(errs)

	var successCount, ownedCount int
	for activateErr := range errs {
		if activateErr == nil {
			successCount++
			continue
		}
		if strings.Contains(activateErr.Error(), "already owned") {
			ownedCount++
			continue
		}
		require.NoError(t, activateErr)
	}
	require.Equal(t, 1, successCount)
	require.Equal(t, 1, ownedCount)

	var campaigns []model.RecallCampaign
	require.NoError(t, model.DB.Where("id IN ?", []int64{first.Id, second.Id}).Find(&campaigns).Error)
	var runningCount, draftCount int
	for _, campaign := range campaigns {
		if campaign.Status == model.RecallCampaignRunning {
			runningCount++
		}
		if campaign.Status == model.RecallCampaignDraft {
			draftCount++
		}
	}
	require.Equal(t, 1, runningCount)
	require.Equal(t, 1, draftCount)
}

func TestRecallCampaignContinuousRejectsNonZeroPromotionValidSeconds(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	draft := validRecallContinuousDraft()
	draft.PromotionValidSeconds = 60

	_, err = service.SaveDraft(context.Background(), 7, draft)

	require.ErrorContains(t, err, "promotion config validity")
}

func TestRecallCampaignContinuousSlotClaimDoesNotSurviveLostTransition(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))

	campaign, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).
		Where("id = ?", campaign.Id).
		Update("config_revision", campaign.ConfigRevision+1).Error)

	won, err := service.activateContinuousCampaign(context.Background(), campaign, validRecallContinuousDraft(), map[string]any{})

	require.NoError(t, err)
	require.False(t, won)
	var slot model.RecallContinuousTriggerSlot
	require.NoError(t, model.DB.First(&slot, "trigger = ?", model.RecallLifecycleTriggerQuotaLow).Error)
	require.Zero(t, slot.CampaignId)

	fresh, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).
		Where("id = ?", campaign.Id).
		Updates(map[string]any{"status": model.RecallCampaignPaused, "config_revision": fresh.ConfigRevision}).Error)
	paused := *fresh
	paused.Status = model.RecallCampaignPaused
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).
		Where("id = ?", campaign.Id).
		Update("status", model.RecallCampaignCancelled).Error)

	won, err = service.resumeContinuousCampaign(context.Background(), &paused)

	require.NoError(t, err)
	require.False(t, won)
	require.NoError(t, model.DB.First(&slot, "trigger = ?", model.RecallLifecycleTriggerQuotaLow).Error)
	require.Zero(t, slot.CampaignId)
}

func TestRecallCampaignContinuousPauseRetainsCancelReleasesAndResumeRepairsOwnership(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	campaign, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))

	require.NoError(t, service.Pause(context.Background(), 7, campaign.Id))
	var slot model.RecallContinuousTriggerSlot
	require.NoError(t, model.DB.First(&slot, "trigger = ?", model.RecallLifecycleTriggerQuotaLow).Error)
	require.Equal(t, campaign.Id, slot.CampaignId)

	require.NoError(t, model.DB.Model(&model.RecallContinuousTriggerSlot{}).
		Where("trigger = ?", model.RecallLifecycleTriggerQuotaLow).
		Update("campaign_id", 0).Error)
	require.NoError(t, service.Resume(context.Background(), 7, campaign.Id))
	require.NoError(t, model.DB.First(&slot, "trigger = ?", model.RecallLifecycleTriggerQuotaLow).Error)
	require.Equal(t, campaign.Id, slot.CampaignId)

	require.NoError(t, service.Cancel(context.Background(), 7, campaign.Id))
	require.NoError(t, model.DB.First(&slot, "trigger = ?", model.RecallLifecycleTriggerQuotaLow).Error)
	require.Zero(t, slot.CampaignId)
}

func TestRecallCampaignContinuousRejectsWrongPolicyAudiencePromotionAndBoundaries(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	marker, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))

	for _, test := range []struct {
		name   string
		mutate func(*RecallCampaignDraft)
		want   string
	}{
		{name: "wrong policy", mutate: func(d *RecallCampaignDraft) { d.DeliveryPolicy = model.RecallDeliveryPolicyEngagement }, want: "delivery policy"},
		{name: "audience", mutate: func(d *RecallCampaignDraft) {
			d.AudienceTemplate = "specified_users"
			d.Audience.SpecifiedEmails = []string{"person@example.com"}
		}, want: "audience"},
		{name: "promotion", mutate: func(d *RecallCampaignDraft) {
			d.CouponSource = "automatic"
			d.Discount.Type = "percent"
			d.Discount.PercentOff = 10
		}, want: "promotion"},
		{name: "too early", mutate: func(d *RecallCampaignDraft) { d.ProcessingStartAt = marker - 1 }, want: "processing start"},
		{name: "future", mutate: func(d *RecallCampaignDraft) { d.ProcessingStartAt = time.Now().Add(time.Hour).Unix() }, want: "processing start"},
		{name: "extra stage", mutate: func(d *RecallCampaignDraft) {
			d.Emails = append(d.Emails, RecallEmailStage{StageNo: 2, DelaySeconds: 60, Templates: map[string]RecallEmailTemplate{"en": {Subject: "Again", BodyText: "Again."}}})
		}, want: "one email stage"},
	} {
		t.Run(test.name, func(t *testing.T) {
			draft := validRecallContinuousDraft()
			test.mutate(&draft)
			_, err := service.SaveDraft(context.Background(), 7, draft)
			require.ErrorContains(t, err, test.want)
		})
	}
}

func TestRecallCampaignContinuousActivationImmutableFields(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	campaign, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	current, err := recallCampaignDraftFromModel(stored)
	require.NoError(t, err)

	for _, test := range []struct {
		name   string
		mutate func(*RecallCampaignDraft)
	}{
		{name: "delivery policy", mutate: func(d *RecallCampaignDraft) { d.DeliveryPolicy = model.RecallDeliveryPolicyEngagement }},
		{name: "lifecycle trigger", mutate: func(d *RecallCampaignDraft) { d.LifecycleTrigger = model.RecallLifecycleTriggerPaymentPending }},
		{name: "processing start", mutate: func(d *RecallCampaignDraft) { d.ProcessingStartAt++ }},
	} {
		t.Run(test.name, func(t *testing.T) {
			changed := current
			test.mutate(&changed)

			_, err = service.UpdateDraft(context.Background(), 7, campaign.Id, changed)

			require.ErrorContains(t, err, "immutable")
		})
	}
}

func assertRecallLifecycleCollectionMarkerAbsent(t *testing.T) {
	t.Helper()
	var count int64
	require.NoError(t, model.DB.Model(&model.Option{}).
		Where("key = ?", model.OptionKeyRecallLifecycleEventCollectionStartedAt).
		Count(&count).Error)
	require.Zero(t, count)
}
