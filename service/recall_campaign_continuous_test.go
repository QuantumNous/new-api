package service

import (
	"context"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
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

func TestRecallCampaignContinuousDraftSaveAndUpdateDoNotRequireLifecycleCollectionMarker(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	draft := validRecallContinuousDraft()
	draft.ProcessingStartAt = time.Now().Add(time.Hour).Unix()

	campaign, err := service.SaveDraft(context.Background(), 7, draft)

	require.NoError(t, err)
	require.Equal(t, draft.ProcessingStartAt, campaign.ProcessingStartAt)
	assertRecallLifecycleCollectionMarkerAbsent(t)

	updatedDraft := validRecallContinuousDraft()
	updatedDraft.Name = "Updated quota low lifecycle notice"
	updatedDraft.ProcessingStartAt = draft.ProcessingStartAt + 60
	updated, err := service.UpdateDraft(context.Background(), 7, campaign.Id, updatedDraft)

	require.NoError(t, err)
	require.Equal(t, updatedDraft.Name, updated.Name)
	require.Equal(t, updatedDraft.ProcessingStartAt, updated.ProcessingStartAt)
	assertRecallLifecycleCollectionMarkerAbsent(t)
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

func TestRecallCampaignContinuousActivateTransitionsCampaignBeforeClaimingSlot(t *testing.T) {
	source, err := os.ReadFile("recall_campaign.go")
	require.NoError(t, err)
	body := string(source)
	start := strings.Index(body, "func (s *RecallCampaignService) activateContinuousCampaign")
	require.NotEqual(t, -1, start)
	end := strings.Index(body[start+1:], "\nfunc ")
	require.NotEqual(t, -1, end)
	fn := body[start : start+1+end]

	transitionIndex := strings.Index(fn, "model.TransitionRecallCampaignRevisionTx")
	claimIndex := strings.Index(fn, "model.ClaimRecallContinuousTriggerSlotOwnershipTx")
	require.NotEqual(t, -1, transitionIndex)
	require.NotEqual(t, -1, claimIndex)
	require.Less(t, transitionIndex, claimIndex)
}

func TestRecallCampaignContinuousResumeTransitionsCampaignBeforeClaimingSlot(t *testing.T) {
	source, err := os.ReadFile("recall_campaign.go")
	require.NoError(t, err)
	body := string(source)
	start := strings.Index(body, "func (s *RecallCampaignService) resumeContinuousCampaign")
	require.NotEqual(t, -1, start)
	end := strings.Index(body[start+1:], "\nfunc ")
	require.NotEqual(t, -1, end)
	fn := body[start : start+1+end]

	transitionIndex := strings.Index(fn, "model.TransitionRecallCampaignTx")
	claimIndex := strings.Index(fn, "model.ClaimRecallContinuousTriggerSlotOwnershipTx")
	require.NotEqual(t, -1, transitionIndex)
	require.NotEqual(t, -1, claimIndex)
	require.Less(t, transitionIndex, claimIndex)
}

func TestRecallCampaignContinuousSlotConflictRollsBackTransitionAndAudit(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	setValidRecallActivitySMTP(t, common.SMTPConfig{Server: "smtp.activity.example.com", Port: 587, Account: "activity@example.com", From: "campaigns@example.com", Token: "secret"})
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	first, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())
	require.NoError(t, err)
	second, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())
	require.NoError(t, err)

	require.NoError(t, service.Activate(context.Background(), 7, first.Id))
	secondCtx := context.WithValue(context.Background(), common.RequestIdKey, "activate-conflicting-slot")
	err = service.Activate(secondCtx, 7, second.Id)

	require.ErrorContains(t, err, "already owned")
	stored, err := model.GetRecallCampaignByID(second.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignDraft, stored.Status)
	var failedEvents int64
	require.NoError(t, model.DB.Model(&model.RecallEvent{}).
		Where("campaign_id = ? AND source = ?", second.Id, "admin").
		Count(&failedEvents).Error)
	require.Zero(t, failedEvents)
}

func TestRecallCampaignContinuousResumeSlotConflictRollsBackTransitionAndAudit(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	setValidRecallActivitySMTP(t, common.SMTPConfig{Server: "smtp.activity.example.com", Port: 587, Account: "activity@example.com", From: "campaigns@example.com", Token: "secret"})
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	first, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())
	require.NoError(t, err)
	second, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, first.Id))
	require.NoError(t, service.Pause(context.Background(), 7, first.Id))
	require.NoError(t, model.DB.Model(&model.RecallContinuousTriggerSlot{}).
		Where("trigger = ?", model.RecallLifecycleTriggerQuotaLow).
		Update("campaign_id", second.Id).Error)
	resumeCtx := context.WithValue(context.Background(), common.RequestIdKey, "resume-conflicting-slot")

	err = service.Resume(resumeCtx, 7, first.Id)

	require.ErrorContains(t, err, "already owned")
	stored, err := model.GetRecallCampaignByID(first.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignPaused, stored.Status)
	var slot model.RecallContinuousTriggerSlot
	require.NoError(t, model.DB.First(&slot, "trigger = ?", model.RecallLifecycleTriggerQuotaLow).Error)
	require.Equal(t, second.Id, slot.CampaignId)
	var resumeEvents int64
	require.NoError(t, model.DB.Model(&model.RecallEvent{}).
		Where("campaign_id = ? AND source = ? AND event_type = ?", first.Id, "admin", "campaign_resumed").
		Count(&resumeEvents).Error)
	require.Zero(t, resumeEvents)
}

func TestRecallCampaignContinuousActivateWritesAtomicAdminEvent(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	setValidRecallActivitySMTP(t, common.SMTPConfig{Server: "smtp.activity.example.com", Port: 587, Account: "activity@example.com", From: "campaigns@example.com", Token: "secret"})
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return time.Unix(recallEmailTestNow, 0).UTC() }
	campaign, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())
	require.NoError(t, err)
	activateCtx := context.WithValue(context.Background(), common.RequestIdKey, "activate-request")

	require.NoError(t, service.Activate(activateCtx, 7, campaign.Id))

	var events []model.RecallEvent
	require.NoError(t, model.DB.Where("campaign_id = ? AND source = ?", campaign.Id, "admin").Find(&events).Error)
	require.Len(t, events, 1)
	require.Equal(t, "campaign_activated", events[0].EventType)
	require.Equal(t, recallAdminSourceEventID(activateCtx, "activate", "unused"), events[0].SourceEventId)
	require.Contains(t, events[0].EventData, `"actor_id":7`)
	require.Contains(t, events[0].EventData, `"action":"activate"`)
	require.Contains(t, events[0].EventData, `"previous_state":"draft"`)
	require.Equal(t, int64(recallEmailTestNow), events[0].CreatedAt)
	var slot model.RecallContinuousTriggerSlot
	require.NoError(t, model.DB.First(&slot, "trigger = ?", model.RecallLifecycleTriggerQuotaLow).Error)
	require.Equal(t, campaign.Id, slot.CampaignId)
}

func TestRecallCampaignContinuousActivationAuditConflictRollsBackCampaignAndSlot(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	setValidRecallActivitySMTP(t, common.SMTPConfig{Server: "smtp.activity.example.com", Port: 587, Account: "activity@example.com", From: "campaigns@example.com", Token: "secret"})
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	campaign, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())
	require.NoError(t, err)
	activateCtx := context.WithValue(context.Background(), common.RequestIdKey, "activate-collision")
	require.NoError(t, model.DB.Create(&model.RecallEvent{CampaignId: campaign.Id, EventType: "preexisting_admin_event", Source: "admin", SourceEventId: recallAdminSourceEventID(activateCtx, "activate", "unused"), EventData: `{}`}).Error)

	err = service.Activate(activateCtx, 7, campaign.Id)

	require.ErrorContains(t, err, "audit")
	stored, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignDraft, stored.Status)
	var ownedSlots int64
	require.NoError(t, model.DB.Model(&model.RecallContinuousTriggerSlot{}).
		Where("trigger = ? AND campaign_id <> 0", model.RecallLifecycleTriggerQuotaLow).
		Count(&ownedSlots).Error)
	require.Zero(t, ownedSlots)
}

func TestRecallCampaignContinuousPreviewAndActivationRejectProcessingStartOutsideCollectionBoundary(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	marker, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	dbNow, err := model.GetDBTimestampWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))

	for _, test := range []struct {
		name              string
		processingStartAt int64
	}{
		{name: "too early", processingStartAt: marker - 1},
		{name: "future", processingStartAt: dbNow + 86400},
	} {
		t.Run(test.name, func(t *testing.T) {
			draft := validRecallContinuousDraft()
			draft.ProcessingStartAt = test.processingStartAt

			campaign, err := service.SaveDraft(context.Background(), 7, draft)
			require.NoError(t, err)
			require.Equal(t, test.processingStartAt, campaign.ProcessingStartAt)

			_, _, err = service.Preview(context.Background(), campaign.Id, 10)
			require.ErrorContains(t, err, "processing start")

			err = service.Activate(context.Background(), 7, campaign.Id)

			require.ErrorContains(t, err, "processing start")
			var ownedSlots int64
			require.NoError(t, model.DB.Model(&model.RecallContinuousTriggerSlot{}).
				Where("trigger = ? AND campaign_id <> 0", model.RecallLifecycleTriggerQuotaLow).
				Count(&ownedSlots).Error)
			require.Zero(t, ownedSlots)
		})
	}
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

	won, err := service.activateContinuousCampaign(context.Background(), campaign, validRecallContinuousDraft(), map[string]any{}, model.RecallEvent{})

	require.NoError(t, err)
	require.False(t, won)
	var ownedSlots int64
	require.NoError(t, model.DB.Model(&model.RecallContinuousTriggerSlot{}).
		Where("trigger = ? AND campaign_id <> 0", model.RecallLifecycleTriggerQuotaLow).
		Count(&ownedSlots).Error)
	require.Zero(t, ownedSlots)

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

	won, err = service.resumeContinuousCampaign(context.Background(), &paused, model.RecallEvent{})

	require.NoError(t, err)
	require.False(t, won)
	require.NoError(t, model.DB.Model(&model.RecallContinuousTriggerSlot{}).
		Where("trigger = ? AND campaign_id <> 0", model.RecallLifecycleTriggerQuotaLow).
		Count(&ownedSlots).Error)
	require.Zero(t, ownedSlots)
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

func TestRecallCampaignContinuousPauseResumeWriteDeterministicAdminEventsAndKeepSlot(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	setValidRecallActivitySMTP(t, common.SMTPConfig{Server: "smtp.activity.example.com", Port: 587, Account: "activity@example.com", From: "campaigns@example.com", Token: "secret"})
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	service.now = func() time.Time { return time.Unix(recallEmailTestNow, 0).UTC() }
	campaign, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))

	pauseCtx := context.WithValue(context.Background(), common.RequestIdKey, "pause-request")
	require.NoError(t, service.Pause(pauseCtx, 7, campaign.Id))
	require.NoError(t, service.Pause(pauseCtx, 7, campaign.Id))
	var slot model.RecallContinuousTriggerSlot
	require.NoError(t, model.DB.First(&slot, "trigger = ?", model.RecallLifecycleTriggerQuotaLow).Error)
	require.Equal(t, campaign.Id, slot.CampaignId)

	resumeCtx := context.WithValue(context.Background(), common.RequestIdKey, "resume-request")
	require.NoError(t, service.Resume(resumeCtx, 7, campaign.Id))
	require.NoError(t, service.Resume(resumeCtx, 7, campaign.Id))
	require.NoError(t, model.DB.First(&slot, "trigger = ?", model.RecallLifecycleTriggerQuotaLow).Error)
	require.Equal(t, campaign.Id, slot.CampaignId)

	var events []model.RecallEvent
	require.NoError(t, model.DB.Where("campaign_id = ? AND source = ?", campaign.Id, "admin").Order("id ASC").Find(&events).Error)
	require.Len(t, events, 3)
	require.Equal(t, "campaign_activated", events[0].EventType)
	require.Contains(t, events[0].EventData, `"actor_id":7`)
	require.Contains(t, events[0].EventData, `"action":"activate"`)
	require.Contains(t, events[0].EventData, `"previous_state":"draft"`)
	require.Equal(t, "campaign_paused", events[1].EventType)
	require.Equal(t, recallAdminSourceEventID(pauseCtx, "pause", "unused"), events[1].SourceEventId)
	require.Contains(t, events[1].EventData, `"actor_id":7`)
	require.Contains(t, events[1].EventData, `"action":"pause"`)
	require.Contains(t, events[1].EventData, `"previous_state":"running"`)
	require.Equal(t, "campaign_resumed", events[2].EventType)
	require.Equal(t, recallAdminSourceEventID(resumeCtx, "resume", "unused"), events[2].SourceEventId)
	require.Contains(t, events[2].EventData, `"actor_id":7`)
	require.Contains(t, events[2].EventData, `"action":"resume"`)
	require.Contains(t, events[2].EventData, `"previous_state":"paused"`)
}

func TestRecallCampaignPauseResumeRollbackWhenAuditIdentityAlreadyExists(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	setValidRecallActivitySMTP(t, common.SMTPConfig{Server: "smtp.activity.example.com", Port: 587, Account: "activity@example.com", From: "campaigns@example.com", Token: "secret"})
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	campaign, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())
	require.NoError(t, err)
	require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))

	pauseCtx := context.WithValue(context.Background(), common.RequestIdKey, "pause-collision")
	require.NoError(t, model.DB.Create(&model.RecallEvent{CampaignId: campaign.Id, EventType: "preexisting_admin_event", Source: "admin", SourceEventId: recallAdminSourceEventID(pauseCtx, "pause", "unused"), EventData: `{}`}).Error)
	err = service.Pause(pauseCtx, 7, campaign.Id)
	require.ErrorContains(t, err, "audit")
	stored, err := model.GetRecallCampaignByIDWithContext(context.Background(), campaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignRunning, stored.Status)
	var slot model.RecallContinuousTriggerSlot
	require.NoError(t, model.DB.First(&slot, "trigger = ?", model.RecallLifecycleTriggerQuotaLow).Error)
	require.Equal(t, campaign.Id, slot.CampaignId)

	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Update("status", model.RecallCampaignPaused).Error)
	resumeCtx := context.WithValue(context.Background(), common.RequestIdKey, "resume-collision")
	require.NoError(t, model.DB.Create(&model.RecallEvent{CampaignId: campaign.Id, EventType: "preexisting_admin_event", Source: "admin", SourceEventId: recallAdminSourceEventID(resumeCtx, "resume", "unused"), EventData: `{}`}).Error)
	err = service.Resume(resumeCtx, 7, campaign.Id)
	require.ErrorContains(t, err, "audit")
	stored, err = model.GetRecallCampaignByIDWithContext(context.Background(), campaign.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignPaused, stored.Status)
	require.NoError(t, model.DB.First(&slot, "trigger = ?", model.RecallLifecycleTriggerQuotaLow).Error)
	require.Equal(t, campaign.Id, slot.CampaignId)
}

func TestRecallCampaignContinuousRejectsCompleteWithoutReleasingSlot(t *testing.T) {
	for _, test := range []struct {
		name       string
		pauseFirst bool
		wantStatus string
	}{
		{name: "running", wantStatus: model.RecallCampaignRunning},
		{name: "paused", pauseFirst: true, wantStatus: model.RecallCampaignPaused},
	} {
		t.Run(test.name, func(t *testing.T) {
			setupRecallCampaignTestDB(t)
			setRecallCampaignEnabled(t, true)
			_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
			require.NoError(t, err)
			service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
			campaign, err := service.SaveDraft(context.Background(), 7, validRecallContinuousDraft())
			require.NoError(t, err)
			require.NoError(t, service.Activate(context.Background(), 7, campaign.Id))
			if test.pauseFirst {
				require.NoError(t, service.Pause(context.Background(), 7, campaign.Id))
			}

			err = service.Complete(context.Background(), 7, campaign.Id)

			require.ErrorContains(t, err, "continuous recall campaign")
			stored, err := model.GetRecallCampaignByID(campaign.Id)
			require.NoError(t, err)
			require.Equal(t, test.wantStatus, stored.Status)
			var completedEvents int64
			require.NoError(t, model.DB.Model(&model.RecallEvent{}).
				Where("campaign_id = ? AND event_type = ?", campaign.Id, "campaign_completed").
				Count(&completedEvents).Error)
			require.Zero(t, completedEvents)
			var slot model.RecallContinuousTriggerSlot
			require.NoError(t, model.DB.First(&slot, "trigger = ?", model.RecallLifecycleTriggerQuotaLow).Error)
			require.Equal(t, campaign.Id, slot.CampaignId)

			require.NoError(t, service.Cancel(context.Background(), 7, campaign.Id))
			require.NoError(t, model.DB.First(&slot, "trigger = ?", model.RecallLifecycleTriggerQuotaLow).Error)
			require.Zero(t, slot.CampaignId)
		})
	}
}

func TestRecallCampaignContinuousRejectsWrongPolicyAudiencePromotionAndStageShape(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
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

func TestRecallCampaignContinuousTemplateVariablesAreTriggerScoped(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))

	draft := validRecallContinuousDraft()
	draft.LifecycleTrigger = model.RecallLifecycleTriggerPaymentSucceeded
	draft.DeliveryPolicy = model.RecallDeliveryPolicyService
	for language := range draft.Emails[0].Templates {
		draft.Emails[0].Templates[language] = RecallEmailTemplate{
			Subject:  "Payment complete",
			BodyHTML: `<!doctype html><html><body><p>Trade {{.trade_no}}</p><p>{{.amount}} {{.currency}}</p><p>{{.completed_at}}</p></body></html>`,
		}
	}

	campaign, err := service.SaveDraft(context.Background(), 7, draft)

	require.NoError(t, err)
	require.Equal(t, model.RecallLifecycleTriggerPaymentSucceeded, campaign.LifecycleTrigger)

	wrongTrigger := draft
	wrongTrigger.Emails = append([]RecallEmailStage(nil), draft.Emails...)
	wrongTrigger.Emails[0].Templates = map[string]RecallEmailTemplate{}
	for language := range draft.Emails[0].Templates {
		wrongTrigger.Emails[0].Templates[language] = RecallEmailTemplate{
			Subject:  "Payment complete",
			BodyHTML: `<!doctype html><html><body><p>{{.payment_url}}</p></body></html>`,
		}
	}

	_, err = service.SaveDraft(context.Background(), 7, wrongTrigger)

	require.ErrorContains(t, err, `unsupported template field "payment_url"`)
}

func TestRecallCampaignContinuousSaveDraftTranslatesWithLifecycleContext(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	translator := &recallDeliveryAwareFakeEmailTranslator{}
	service := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}), translator)

	draft := validRecallContinuousDraft()
	draft.LifecycleTrigger = model.RecallLifecycleTriggerPaymentSucceeded
	draft.DeliveryPolicy = model.RecallDeliveryPolicyService
	draft.Emails[0].Templates = map[string]RecallEmailTemplate{
		"en": {
			Subject:  "Payment complete",
			BodyHTML: `<!doctype html><html><body><p>Trade {{.trade_no}}</p><p>{{.amount}} {{.currency}}</p><p>{{.completed_at}}</p></body></html>`,
		},
	}

	campaign, err := service.SaveDraft(context.Background(), 7, draft)

	require.NoError(t, err)
	require.Equal(t, []string{model.RecallCampaignTypeContentOnly}, translator.campaignTypes)
	require.Equal(t, []string{model.RecallDeliveryPolicyService}, translator.deliveryPolicies)
	require.Equal(t, []string{model.RecallLifecycleTriggerPaymentSucceeded}, translator.lifecycleTriggers)
	var stages []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(campaign.EmailSequenceConfig), &stages))
	requireRecallCampaignCanonicalLanguages(t, stages)
	require.Contains(t, stages[0].Templates["ja"].BodyHTML, "ja:delivery:Trade ")
}

func TestRecallCampaignContinuousUpdateDraftReusesLifecycleTranslations(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	translator := &recallDeliveryAwareFakeEmailTranslator{}
	service := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}), translator)

	draft := validRecallContinuousDraft()
	draft.LifecycleTrigger = model.RecallLifecycleTriggerPaymentSucceeded
	draft.DeliveryPolicy = model.RecallDeliveryPolicyService
	draft.Emails[0].Templates = map[string]RecallEmailTemplate{
		"en": {
			Subject:  "Payment complete",
			BodyHTML: `<!doctype html><html><body><p>Trade {{.trade_no}}</p><p>{{.amount}} {{.currency}}</p><p>{{.completed_at}}</p></body></html>`,
		},
	}
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)

	draft.Name = "Renamed payment complete"
	updated, err := service.UpdateDraft(context.Background(), 7, campaign.Id, draft)

	require.NoError(t, err)
	require.Len(t, translator.lifecycleTriggers, 1, "unchanged lifecycle English HTML must reuse stored localized HTML")
	var stages []RecallEmailStage
	require.NoError(t, common.Unmarshal([]byte(updated.EmailSequenceConfig), &stages))
	require.Contains(t, stages[0].Templates["ja"].BodyHTML, "ja:delivery:Trade ")
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
