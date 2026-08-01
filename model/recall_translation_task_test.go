package model

import (
	"context"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRecallTranslationTaskQueuedRunningSucceededLifecycle(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	ctx := context.Background()
	campaign := seedRecallTranslationCampaign(t, 7, "draft", recallTranslationTaskSource("hello"))

	task, created, err := SubmitRecallTranslationTask(ctx, RecallTranslationTaskSubmission{
		CampaignID:              campaign.Id,
		RequestedConfigRevision: campaign.ConfigRevision,
		SourceHash:              recallTranslationTaskSourceHash(campaign.EmailSequenceConfig),
		SourceSnapshot:          recallTranslationTaskSource("hello"),
		Now:                     100,
	})
	require.NoError(t, err)
	require.True(t, created)
	require.Equal(t, RecallTranslationTaskQueued, task.Status)

	claimed, won, err := ClaimDueRecallTranslationTask(ctx, task.Id, "worker-a", 120, 180)
	require.NoError(t, err)
	require.True(t, won)
	require.Equal(t, RecallTranslationTaskRunning, claimed.Status)
	require.Equal(t, int64(1), claimed.LeaseEpoch)
	require.Equal(t, 1, claimed.AttemptCount)

	success, err := CompleteRecallTranslationTaskSuccess(ctx, RecallTranslationTaskCompletion{
		TaskID:         task.Id,
		Owner:          "worker-a",
		LeaseEpoch:     claimed.LeaseEpoch,
		ResultSnapshot: recallTranslationTaskResult("translated"),
		EmailSequence:  recallTranslationTaskEmailSequence("translated"),
		FinishedAt:     150,
	})
	require.NoError(t, err)
	require.Equal(t, RecallTranslationTaskCompletionSucceeded, success)

	stored := loadRecallTranslationTask(t, task.Id)
	require.Equal(t, RecallTranslationTaskSucceeded, stored.Status)
	require.Equal(t, campaign.ConfigRevision+1, stored.ResultConfigRevision)
	require.Equal(t, recallTranslationTaskResult("translated"), stored.ResultSnapshot)
	updated, err := GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, campaign.ConfigRevision+1, updated.ConfigRevision)
	require.Equal(t, recallTranslationTaskEmailSequence("translated"), updated.EmailSequenceConfig)
}

func TestRecallTranslationTaskTerminalFailureDuplicateAndConditionalRequeue(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	ctx := context.Background()
	campaign := seedRecallTranslationCampaign(t, 7, "draft", recallTranslationTaskSource("hello"))
	submission := RecallTranslationTaskSubmission{
		CampaignID:              campaign.Id,
		RequestedConfigRevision: campaign.ConfigRevision,
		SourceHash:              recallTranslationTaskSourceHash(campaign.EmailSequenceConfig),
		SourceSnapshot:          recallTranslationTaskSource("hello"),
		Now:                     100,
	}

	first, created, err := SubmitRecallTranslationTask(ctx, submission)
	require.NoError(t, err)
	require.True(t, created)
	duplicate, created, err := SubmitRecallTranslationTask(ctx, submission)
	require.NoError(t, err)
	require.False(t, created)
	require.Equal(t, first.Id, duplicate.Id)

	claimed, won, err := ClaimDueRecallTranslationTask(ctx, first.Id, "worker-a", 110, 170)
	require.NoError(t, err)
	require.True(t, won)
	won, err = FailRecallTranslationTask(ctx, RecallTranslationTaskFailure{
		TaskID:     first.Id,
		Owner:      "worker-a",
		LeaseEpoch: claimed.LeaseEpoch,
		ErrorCode:  "provider_error",
		FinishedAt: 120,
	})
	require.NoError(t, err)
	require.True(t, won)
	require.Equal(t, RecallTranslationTaskFailed, loadRecallTranslationTask(t, first.Id).Status)

	requeued, created, err := SubmitRecallTranslationTask(ctx, submission)
	require.NoError(t, err)
	require.True(t, created)
	require.Equal(t, first.Id, requeued.Id)
	require.Equal(t, RecallTranslationTaskQueued, requeued.Status)
	require.Equal(t, 1, requeued.AttemptCount)

	claimed, won, err = ClaimDueRecallTranslationTask(ctx, first.Id, "worker-b", 130, 190)
	require.NoError(t, err)
	require.True(t, won)
	won, err = FailRecallTranslationTask(ctx, RecallTranslationTaskFailure{
		TaskID:     first.Id,
		Owner:      "worker-b",
		LeaseEpoch: claimed.LeaseEpoch,
		ErrorCode:  "provider_error",
		FinishedAt: 140,
	})
	require.NoError(t, err)
	require.True(t, won)
	require.NoError(t, DB.Model(&RecallCampaign{}).Where("id = ?", campaign.Id).Update("config_revision", campaign.ConfigRevision+1).Error)
	_, _, err = SubmitRecallTranslationTask(ctx, submission)
	require.ErrorIs(t, err, ErrRecallTranslationTaskSourceChanged)
}

func TestRecallTranslationTaskFailedRequeueRejectsConcurrentCampaignChange(t *testing.T) {
	setupRecallRepositoryFileDB(t)
	ctx := context.Background()
	campaign := seedRecallTranslationCampaign(t, 7, "draft", recallTranslationTaskSource("hello"))
	submission := RecallTranslationTaskSubmission{
		CampaignID:              campaign.Id,
		RequestedConfigRevision: campaign.ConfigRevision,
		SourceHash:              recallTranslationTaskSourceHash(campaign.EmailSequenceConfig),
		SourceSnapshot:          recallTranslationTaskSource("hello"),
		Now:                     100,
	}
	task, _, err := SubmitRecallTranslationTask(ctx, submission)
	require.NoError(t, err)
	claimed, won, err := ClaimDueRecallTranslationTask(ctx, task.Id, "worker-a", 110, 170)
	require.NoError(t, err)
	require.True(t, won)
	won, err = FailRecallTranslationTask(ctx, RecallTranslationTaskFailure{
		TaskID: task.Id, Owner: "worker-a", LeaseEpoch: claimed.LeaseEpoch, ErrorCode: "provider_error", FinishedAt: 120,
	})
	require.NoError(t, err)
	require.True(t, won)

	mutated := false
	callbackName := "recall_translation_requeue_race_" + t.Name()
	require.NoError(t, DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if mutated || tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "RecallTranslationTask" {
			return
		}
		mutated = true
		if err := tx.Session(&gorm.Session{NewDB: true}).Model(&RecallCampaign{}).
			Where("id = ?", campaign.Id).
			Updates(map[string]any{
				"config_revision":       campaign.ConfigRevision + 1,
				"email_sequence_config": recallTranslationTaskSource("changed"),
			}).Error; err != nil {
			tx.AddError(err)
		}
	}))
	t.Cleanup(func() { _ = DB.Callback().Update().Remove(callbackName) })

	_, _, err = SubmitRecallTranslationTask(ctx, submission)

	require.ErrorIs(t, err, ErrRecallTranslationTaskSourceChanged)
	require.True(t, mutated)
	stored := loadRecallTranslationTask(t, task.Id)
	require.Equal(t, RecallTranslationTaskFailed, stored.Status)
}

func TestRecallTranslationTaskLeaseExpiryReclaimRenewalAndStaleEpochFence(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	ctx := context.Background()
	campaign := seedRecallTranslationCampaign(t, 7, "draft", recallTranslationTaskSource("hello"))
	task, _, err := SubmitRecallTranslationTask(ctx, RecallTranslationTaskSubmission{
		CampaignID:              campaign.Id,
		RequestedConfigRevision: campaign.ConfigRevision,
		SourceHash:              recallTranslationTaskSourceHash(campaign.EmailSequenceConfig),
		SourceSnapshot:          recallTranslationTaskSource("hello"),
		Now:                     100,
	})
	require.NoError(t, err)

	first, won, err := ClaimDueRecallTranslationTask(ctx, task.Id, "worker-a", 110, 120)
	require.NoError(t, err)
	require.True(t, won)
	won, err = RenewRecallTranslationTaskLease(ctx, task.Id, "worker-a", first.LeaseEpoch, 125)
	require.NoError(t, err)
	require.True(t, won)
	stored := loadRecallTranslationTask(t, task.Id)
	require.Equal(t, int64(125), stored.LeaseExpiresAt)
	require.Equal(t, first.LeaseEpoch, stored.LeaseEpoch)

	_, won, err = ClaimDueRecallTranslationTask(ctx, task.Id, "worker-b", 124, 180)
	require.NoError(t, err)
	require.False(t, won)
	second, won, err := ClaimDueRecallTranslationTask(ctx, task.Id, "worker-b", 126, 190)
	require.NoError(t, err)
	require.True(t, won)
	require.Equal(t, int64(2), second.LeaseEpoch)
	require.Equal(t, 2, second.AttemptCount)

	result, err := CompleteRecallTranslationTaskSuccess(ctx, RecallTranslationTaskCompletion{
		TaskID:         task.Id,
		Owner:          "worker-a",
		LeaseEpoch:     first.LeaseEpoch,
		ResultSnapshot: recallTranslationTaskResult("late"),
		EmailSequence:  recallTranslationTaskEmailSequence("late"),
		FinishedAt:     130,
	})
	require.NoError(t, err)
	require.Equal(t, RecallTranslationTaskCompletionLeaseLost, result)
	require.Equal(t, RecallTranslationTaskRunning, loadRecallTranslationTask(t, task.Id).Status)
	updated, err := GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, campaign.EmailSequenceConfig, updated.EmailSequenceConfig)
}

func TestRecallTranslationTaskCompletionSupersedesWhenCampaignRevisionOrSourceChanged(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	ctx := context.Background()
	campaign := seedRecallTranslationCampaign(t, 7, "draft", recallTranslationTaskSource("hello"))
	task, _, err := SubmitRecallTranslationTask(ctx, RecallTranslationTaskSubmission{
		CampaignID:              campaign.Id,
		RequestedConfigRevision: campaign.ConfigRevision,
		SourceHash:              recallTranslationTaskSourceHash(campaign.EmailSequenceConfig),
		SourceSnapshot:          recallTranslationTaskSource("hello"),
		Now:                     100,
	})
	require.NoError(t, err)
	claimed, won, err := ClaimDueRecallTranslationTask(ctx, task.Id, "worker-a", 110, 170)
	require.NoError(t, err)
	require.True(t, won)
	require.NoError(t, DB.Model(&RecallCampaign{}).Where("id = ?", campaign.Id).Updates(map[string]any{
		"email_sequence_config": recallTranslationTaskEmailSequence("changed"),
	}).Error)

	result, err := CompleteRecallTranslationTaskSuccess(ctx, RecallTranslationTaskCompletion{
		TaskID:         task.Id,
		Owner:          "worker-a",
		LeaseEpoch:     claimed.LeaseEpoch,
		ResultSnapshot: recallTranslationTaskResult("translated"),
		EmailSequence:  recallTranslationTaskEmailSequence("translated"),
		FinishedAt:     140,
	})
	require.NoError(t, err)
	require.Equal(t, RecallTranslationTaskCompletionSuperseded, result)

	stored := loadRecallTranslationTask(t, task.Id)
	require.Equal(t, RecallTranslationTaskSuperseded, stored.Status)
	updated, err := GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, recallTranslationTaskEmailSequence("changed"), updated.EmailSequenceConfig)
	require.Equal(t, campaign.ConfigRevision, updated.ConfigRevision)
}

func TestRecallTranslationTaskGetByIDIsScopedToCampaign(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	ctx := context.Background()
	firstCampaign := seedRecallTranslationCampaign(t, 7, "draft", recallTranslationTaskSource("first"))
	secondCampaign := seedRecallTranslationCampaign(t, 7, "draft", recallTranslationTaskSource("second"))
	task, _, err := SubmitRecallTranslationTask(ctx, RecallTranslationTaskSubmission{
		CampaignID:              firstCampaign.Id,
		RequestedConfigRevision: firstCampaign.ConfigRevision,
		SourceHash:              recallTranslationTaskSourceHash(firstCampaign.EmailSequenceConfig),
		SourceSnapshot:          recallTranslationTaskSource("first"),
		Now:                     100,
	})
	require.NoError(t, err)

	scoped, err := GetRecallTranslationTaskByCampaignAndID(ctx, firstCampaign.Id, task.Id)
	require.NoError(t, err)
	require.Equal(t, task.Id, scoped.Id)
	require.Equal(t, firstCampaign.Id, scoped.CampaignId)

	_, err = GetRecallTranslationTaskByCampaignAndID(ctx, secondCampaign.Id, task.Id)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func TestRecallTranslationTaskLatestIsScopedAndDeterministicallyOrdered(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	ctx := context.Background()
	firstCampaign := seedRecallTranslationCampaign(t, 7, "draft", recallTranslationTaskSource("first"))
	secondCampaign := seedRecallTranslationCampaign(t, 7, "draft", recallTranslationTaskSource("second"))
	oldTask, _, err := SubmitRecallTranslationTask(ctx, RecallTranslationTaskSubmission{
		CampaignID:              firstCampaign.Id,
		RequestedConfigRevision: firstCampaign.ConfigRevision,
		SourceHash:              recallTranslationTaskSourceHash(firstCampaign.EmailSequenceConfig),
		SourceSnapshot:          recallTranslationTaskSource("first"),
		Now:                     100,
	})
	require.NoError(t, err)
	newTask := RecallTranslationTask{
		CampaignId:              firstCampaign.Id,
		RequestedConfigRevision: firstCampaign.ConfigRevision + 1,
		SourceHash:              strings.Repeat("a", 64),
		IdempotencyKey:          strings.Repeat("b", 64),
		Status:                  RecallTranslationTaskQueued,
		NextAttemptAt:           200,
		SourceSnapshot:          recallTranslationTaskSource("new"),
		CreatedAt:               oldTask.CreatedAt,
	}
	require.NoError(t, DB.Create(&newTask).Error)
	otherCampaignTask := RecallTranslationTask{
		CampaignId:              secondCampaign.Id,
		RequestedConfigRevision: secondCampaign.ConfigRevision,
		SourceHash:              strings.Repeat("c", 64),
		IdempotencyKey:          strings.Repeat("d", 64),
		Status:                  RecallTranslationTaskQueued,
		NextAttemptAt:           300,
		SourceSnapshot:          recallTranslationTaskSource("other"),
		CreatedAt:               newTask.CreatedAt + 1,
	}
	require.NoError(t, DB.Create(&otherCampaignTask).Error)

	latest, err := GetLatestRecallTranslationTaskForCampaign(ctx, firstCampaign.Id)
	require.NoError(t, err)
	require.Equal(t, newTask.Id, latest.Id)
	require.Equal(t, firstCampaign.Id, latest.CampaignId)

	_, err = GetLatestRecallTranslationTaskForCampaign(ctx, firstCampaign.Id+secondCampaign.Id+1000)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func seedRecallTranslationCampaign(t *testing.T, revision int64, status string, emailSequence string) RecallCampaign {
	t.Helper()
	campaign := RecallCampaign{
		CampaignType:        RecallCampaignTypePromotion,
		Name:                "translation campaign",
		Status:              status,
		AudienceTemplate:    "inactive_users",
		AudienceConfig:      `{}`,
		ExecutionMode:       "manual",
		CouponSource:        "stripe",
		DiscountConfig:      `{}`,
		ProductScope:        `{}`,
		EmailSequenceConfig: emailSequence,
		ConfigRevision:      revision,
	}
	require.NoError(t, CreateRecallCampaign(&campaign))
	return campaign
}

func loadRecallTranslationTask(t *testing.T, id int64) RecallTranslationTask {
	t.Helper()
	var task RecallTranslationTask
	require.NoError(t, DB.First(&task, id).Error)
	return task
}

func recallTranslationTaskSource(value string) string {
	payload, err := common.Marshal(map[string]string{"source": value})
	if err != nil {
		panic(err)
	}
	return string(payload)
}

func recallTranslationTaskResult(value string) string {
	payload, err := common.Marshal(map[string]string{"result": value})
	if err != nil {
		panic(err)
	}
	return string(payload)
}

func recallTranslationTaskEmailSequence(value string) string {
	payload, err := common.Marshal([]map[string]string{{"value": value}})
	if err != nil {
		panic(err)
	}
	return string(payload)
}
