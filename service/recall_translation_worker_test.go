package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRecallTranslationWorkerQueuedRunningSucceededAcrossRestart(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 29, 9, 0, 0, 0, time.UTC)
	translator := &recallCampaignFakeEmailTranslator{}
	campaignService := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	campaignService.now = func() time.Time { return now }
	campaign, task := seedQueuedRecallTranslationWorkerTask(t, campaignService, now)
	require.Zero(t, translator.callCount())

	firstWorker := NewRecallTranslationWorker(translator, "worker-a")
	firstWorker.now = func() time.Time { return now }
	claimed, err := firstWorker.ClaimOne(context.Background())
	require.NoError(t, err)
	require.NotNil(t, claimed)
	require.Equal(t, model.RecallTranslationTaskRunning, loadServiceRecallTranslationTask(t, task.Id).Status)

	restartedWorker := NewRecallTranslationWorker(translator, "worker-b")
	restartedWorker.now = func() time.Time { return now.Add(2 * recallTranslationLeaseDuration) }
	processed, err := restartedWorker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	storedTask := loadServiceRecallTranslationTask(t, task.Id)
	require.Equal(t, model.RecallTranslationTaskSucceeded, storedTask.Status)
	require.Equal(t, 1, translator.callCount())
	updated, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, campaign.ConfigRevision+1, updated.ConfigRevision)
	require.NotEqual(t, campaign.EmailSequenceConfig, updated.EmailSequenceConfig)
}

func TestRecallTranslationWorkerFailureIsTerminalAndDuplicateSubmitRequeuesSameTask(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 29, 9, 0, 0, 0, time.UTC)
	translator := &recallCampaignFakeEmailTranslator{err: errors.New("provider exploded with raw payload")}
	campaignService := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	campaignService.now = func() time.Time { return now }
	campaign, task := seedQueuedRecallTranslationWorkerTask(t, campaignService, now)
	worker := NewRecallTranslationWorker(translator, "worker-a")
	worker.now = func() time.Time { return now }
	processed, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	failed := loadServiceRecallTranslationTask(t, task.Id)
	require.Equal(t, model.RecallTranslationTaskFailed, failed.Status)
	require.Equal(t, "translation_failed", failed.ErrorCode)
	require.NotContains(t, failed.ErrorMessage, "raw payload")

	translator.err = nil
	duplicate, _, err := model.SubmitRecallTranslationTask(context.Background(), model.RecallTranslationTaskSubmission{
		CampaignID:              campaign.Id,
		RequestedConfigRevision: campaign.ConfigRevision,
		SourceHash:              recallTranslationCanonicalSourceHash(campaign.EmailSequenceConfig),
		SourceSnapshot:          task.SourceSnapshot,
		Now:                     now.Unix(),
	})
	require.NoError(t, err)
	require.Equal(t, task.Id, duplicate.Id)
	require.Equal(t, model.RecallTranslationTaskQueued, duplicate.Status)
}

func TestRecallTranslationWorkerSupersedesChangedCampaignWithoutPartialWrite(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 29, 9, 0, 0, 0, time.UTC)
	translator := &recallCampaignFakeEmailTranslator{}
	campaignService := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	campaignService.now = func() time.Time { return now }
	campaign, task := seedQueuedRecallTranslationWorkerTask(t, campaignService, now)
	require.NoError(t, db.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Updates(map[string]any{
		"email_sequence_config": serviceRecallTranslationTaskEmailSequence(t, "changed"),
		"config_revision":       gorm.Expr("config_revision + ?", 1),
	}).Error)

	worker := NewRecallTranslationWorker(translator, "worker-a")
	worker.now = func() time.Time { return now }
	processed, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	storedTask := loadServiceRecallTranslationTask(t, task.Id)
	require.Equal(t, model.RecallTranslationTaskSuperseded, storedTask.Status)
	updated, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, serviceRecallTranslationTaskEmailSequence(t, "changed"), updated.EmailSequenceConfig)
	require.Equal(t, campaign.ConfigRevision+1, updated.ConfigRevision)
}

func TestRecallMaintenanceTickRunsTranslationWorkerWithoutBlockingOtherMaintenance(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 29, 9, 0, 0, 0, time.UTC)
	translator := &recallCampaignFakeEmailTranslator{}
	campaignService := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	campaignService.now = func() time.Time { return now }
	_, task := seedQueuedRecallTranslationWorkerTask(t, campaignService, now)

	testRuntime := &RecallRuntime{
		Campaigns:    NewRecallCampaignService(NewRecallAudienceSelector(), nil),
		Claims:       NewRecallClaimService(),
		Revocations:  NewRecallPromotionRevocationWorker(nil, "revocation-worker"),
		Recipients:   NewRecallRecipientWorker(nil, NewRecallClaimService(), "recipient-worker"),
		Emails:       NewRecallEmailWorker(nil, NewRecallAudienceSelector(), NewRecallClaimService(), "email-worker"),
		Translations: NewRecallTranslationWorker(translator, "translation-worker"),
		Attribution:  nil,
	}
	testRuntime.Translations.now = func() time.Time { return now }
	setRecallRuntimeForTest(t, testRuntime)

	RunRecallMaintenanceTick(context.Background())

	require.Equal(t, model.RecallTranslationTaskSucceeded, loadServiceRecallTranslationTask(t, task.Id).Status)
}

func seedQueuedRecallTranslationWorkerTask(t *testing.T, campaignService *RecallCampaignService, now time.Time) (*model.RecallCampaign, *model.RecallTranslationTask) {
	t.Helper()
	draft := englishOnlyRecallCampaignDraft(now)
	draft.DeferLocalization = true
	campaign, err := campaignService.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	storedDraft, err := recallCampaignDraftFromModel(campaign)
	require.NoError(t, err)
	sourceSnapshot, err := buildRecallTranslationSourceSnapshot(storedDraft.CampaignType, campaign.Name, storedDraft.Emails, storedDraft.Emails)
	require.NoError(t, err)
	task, created, err := model.SubmitRecallTranslationTask(context.Background(), model.RecallTranslationTaskSubmission{
		CampaignID:              campaign.Id,
		RequestedConfigRevision: campaign.ConfigRevision,
		SourceHash:              recallTranslationCanonicalSourceHash(campaign.EmailSequenceConfig),
		SourceSnapshot:          sourceSnapshot,
		Now:                     now.Unix(),
	})
	require.NoError(t, err)
	require.True(t, created)
	return campaign, task
}

func loadServiceRecallTranslationTask(t *testing.T, id int64) model.RecallTranslationTask {
	t.Helper()
	var task model.RecallTranslationTask
	require.NoError(t, model.DB.First(&task, id).Error)
	return task
}

func serviceRecallTranslationTaskEmailSequence(t *testing.T, value string) string {
	t.Helper()
	payload, err := common.Marshal([]map[string]string{{"value": value}})
	require.NoError(t, err)
	return string(payload)
}
