package service

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
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
		SourceHash:              recallTranslationCanonicalSourceHash(task.SourceSnapshot),
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

func TestRecallTranslationWorkerPreservesManualLocales(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 29, 9, 0, 0, 0, time.UTC)
	translator := &recallCampaignFakeEmailTranslator{}
	campaignService := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	campaignService.now = func() time.Time { return now }
	draft := englishOnlyRecallCampaignDraft(now)
	draft.DeferLocalization = true
	draft.Emails[0].Templates["es"] = RecallEmailTemplate{Subject: "Manual ES", BodyText: "Manual body"}
	draft.Emails[0].ManualLocales = []string{"es"}
	campaign, err := campaignService.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	storedDraft, err := recallCampaignDraftFromModel(campaign)
	require.NoError(t, err)
	sourceSnapshot, err := buildRecallTranslationSourceSnapshot(storedDraft.CampaignType, campaign.Name, storedDraft.Emails, storedDraft.Emails)
	require.NoError(t, err)
	_, _, err = model.SubmitRecallTranslationTask(context.Background(), model.RecallTranslationTaskSubmission{
		CampaignID: campaign.Id, RequestedConfigRevision: campaign.ConfigRevision,
		SourceHash: recallTranslationCanonicalSourceHash(sourceSnapshot), SourceSnapshot: sourceSnapshot, Now: now.Unix(),
	})
	require.NoError(t, err)

	worker := NewRecallTranslationWorker(translator, "worker-a")
	worker.now = func() time.Time { return now }
	processed, err := worker.RunBatch(context.Background(), 1)

	require.NoError(t, err)
	require.Equal(t, 1, processed)
	updated, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	updatedDraft, err := recallCampaignDraftFromModel(updated)
	require.NoError(t, err)
	require.Equal(t, []string{"es"}, updatedDraft.Emails[0].ManualLocales)
	require.Equal(t, RecallEmailTemplate{Subject: "Manual ES", BodyText: "Manual body"}, updatedDraft.Emails[0].Templates["es"])
	require.Equal(t, "fr:"+storedDraft.Emails[0].Templates["en"].Subject, updatedDraft.Emails[0].Templates["fr"].Subject)
}

func TestRecallTranslationWorkerHeartbeatsDuringBlockedTranslate(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 29, 9, 0, 0, 0, time.UTC)
	translator := newBlockingRecallTranslationTestTranslator()
	campaignService := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	campaignService.now = func() time.Time { return now }
	_, task := seedQueuedRecallTranslationWorkerTask(t, campaignService, now)
	worker := NewRecallTranslationWorker(translator, "worker-a")
	worker.now = func() time.Time { return now }
	worker.leaseDuration = 2 * time.Second
	worker.heartbeatInterval = 5 * time.Millisecond
	var renewUpdates atomic.Int32
	callbackName := "recall_translation_heartbeat_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "RecallTranslationTask" {
			return
		}
		updates, ok := tx.Statement.Dest.(map[string]any)
		if !ok {
			return
		}
		if _, exists := updates["lease_expires_at"]; exists {
			renewUpdates.Add(1)
		}
	}))
	t.Cleanup(func() { _ = model.DB.Callback().Update().Remove(callbackName) })

	done := make(chan error, 1)
	go func() {
		_, err := worker.RunBatch(context.Background(), 1)
		done <- err
	}()
	translator.waitStarted(t)
	require.Eventually(t, func() bool {
		return renewUpdates.Load() > 0
	}, time.Second, 10*time.Millisecond)
	translator.release()

	require.NoError(t, <-done)
	require.Equal(t, model.RecallTranslationTaskSucceeded, loadServiceRecallTranslationTask(t, task.Id).Status)
}

func TestRecallTranslationWorkerRenewalLossCancelsAndDoesNotWrite(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 29, 9, 0, 0, 0, time.UTC)
	translator := newBlockingRecallTranslationTestTranslator()
	campaignService := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	campaignService.now = func() time.Time { return now }
	campaign, task := seedQueuedRecallTranslationWorkerTask(t, campaignService, now)
	worker := NewRecallTranslationWorker(translator, "worker-a")
	worker.now = func() time.Time { return now }
	worker.leaseDuration = 2 * time.Second
	worker.heartbeatInterval = 5 * time.Millisecond

	done := make(chan error, 1)
	go func() {
		_, err := worker.RunBatch(context.Background(), 1)
		done <- err
	}()
	translator.waitStarted(t)
	_, won, err := model.ClaimDueRecallTranslationTask(context.Background(), task.Id, "worker-b", now.Add(3*time.Second).Unix(), now.Add(5*time.Second).Unix())
	require.NoError(t, err)
	require.True(t, won)
	translator.release()

	require.NoError(t, <-done)
	stored := loadServiceRecallTranslationTask(t, task.Id)
	require.Equal(t, model.RecallTranslationTaskRunning, stored.Status)
	require.Equal(t, "worker-b", stored.LeaseOwner)
	updated, err := model.GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, campaign.EmailSequenceConfig, updated.EmailSequenceConfig)
}

func TestRecallTranslationWorkerUsesProtectedTranslatorPipeline(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	allowRecallEmailTranslationTestServer(t)
	now := time.Date(2026, 7, 29, 9, 0, 0, 0, time.UTC)
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		var request map[string]any
		require.NoError(t, common.DecodeJson(r.Body, &request))
		requestJSON, err := common.Marshal(request)
		require.NoError(t, err)
		requestText := string(requestJSON)
		require.NotContains(t, requestText, "{{.ClaimURL}}")
		stages := recallEmailTranslationRequestStages(t, request)
		writeRecallEmailTranslationResponse(t, w, recallEmailTranslationSegmentsResult(map[int][]string{
			1: recallEmailTranslationRequestBodySegments(t, stages[0]),
		}))
	}))
	defer server.Close()
	translator := newRecallEmailTranslationTestTranslator(server, RecallEmailTranslatorOptions{})
	campaignService := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	campaignService.now = func() time.Time { return now }
	draft := englishOnlyRecallCampaignDraft(now)
	draft.DeferLocalization = true
	draft.Emails[0].Templates["en"] = RecallEmailTemplate{Subject: "Protected offer", BodyText: "Open {{.ClaimURL}}"}
	campaign, err := campaignService.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	storedDraft, err := recallCampaignDraftFromModel(campaign)
	require.NoError(t, err)
	sourceSnapshot, err := buildRecallTranslationSourceSnapshot(storedDraft.CampaignType, campaign.Name, storedDraft.Emails, storedDraft.Emails)
	require.NoError(t, err)
	task, _, err := model.SubmitRecallTranslationTask(context.Background(), model.RecallTranslationTaskSubmission{
		CampaignID: campaign.Id, RequestedConfigRevision: campaign.ConfigRevision,
		SourceHash: recallTranslationCanonicalSourceHash(sourceSnapshot), SourceSnapshot: sourceSnapshot, Now: now.Unix(),
	})
	require.NoError(t, err)

	worker := NewRecallTranslationWorker(translator, "worker-a")
	worker.now = func() time.Time { return now }
	processed, err := worker.RunBatch(context.Background(), 1)

	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 1, requests.Load())
	require.Equal(t, model.RecallTranslationTaskSucceeded, loadServiceRecallTranslationTask(t, task.Id).Status)
}

func TestRecallTranslationWorkerLogsRedactedObservability(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 29, 9, 0, 0, 0, time.UTC)
	translator := &recallCampaignFakeEmailTranslator{err: errors.New("provider leaked secret@example.com body {{.ClaimURL}}")}
	campaignService := NewRecallCampaignServiceWithTranslator(NewRecallAudienceSelector(), nil, translator)
	campaignService.now = func() time.Time { return now }
	_, task := seedQueuedRecallTranslationWorkerTask(t, campaignService, now)
	var logOutput bytes.Buffer
	common.LogWriterMu.Lock()
	originalErrorWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logOutput
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = originalErrorWriter
		common.LogWriterMu.Unlock()
	})

	worker := NewRecallTranslationWorker(translator, "worker-a")
	worker.now = func() time.Time { return now }
	processed, err := worker.RunBatch(context.Background(), 1)

	require.NoError(t, err)
	require.Equal(t, 1, processed)
	logged := logOutput.String()
	require.Contains(t, logged, "recall translation task")
	require.Contains(t, logged, "task_id=")
	require.Contains(t, logged, "campaign_id=")
	require.Contains(t, logged, "error_class=translation_failed")
	for _, secret := range []string{"secret@example.com", "{{.ClaimURL}}", "body"} {
		require.NotContains(t, logged, secret)
	}
	require.Equal(t, model.RecallTranslationTaskFailed, loadServiceRecallTranslationTask(t, task.Id).Status)
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
		SourceHash:              recallTranslationCanonicalSourceHash(sourceSnapshot),
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

type blockingRecallTranslationTestTranslator struct {
	started       chan struct{}
	releaseCh     chan struct{}
	once          sync.Once
	contextChecks atomic.Int32
}

func newBlockingRecallTranslationTestTranslator() *blockingRecallTranslationTestTranslator {
	return &blockingRecallTranslationTestTranslator{
		started:   make(chan struct{}),
		releaseCh: make(chan struct{}),
	}
}

func (t *blockingRecallTranslationTestTranslator) Translate(ctx context.Context, stages []RecallEmailStage) (map[int]map[string]RecallEmailTemplate, error) {
	t.once.Do(func() { close(t.started) })
	ticker := time.NewTicker(time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			t.contextChecks.Add(1)
			return nil, ctx.Err()
		case <-t.releaseCh:
			return recallCampaignTestTranslations(stages), nil
		case <-ticker.C:
			if ctx.Err() != nil {
				t.contextChecks.Add(1)
				return nil, ctx.Err()
			}
		}
	}
}

func (t *blockingRecallTranslationTestTranslator) waitStarted(tb testing.TB) {
	tb.Helper()
	select {
	case <-t.started:
	case <-time.After(time.Second):
		tb.Fatal("translator did not start")
	}
}

func (t *blockingRecallTranslationTestTranslator) release() {
	close(t.releaseCh)
}

var _ RecallEmailTranslator = (*blockingRecallTranslationTestTranslator)(nil)
