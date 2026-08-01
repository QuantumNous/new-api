package model

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
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
	require.False(t, created)
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
