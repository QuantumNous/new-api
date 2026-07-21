package model

import (
	"context"
	"math"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type imageTaskBillingLogOtherSnapshot struct {
	TaskInfo struct {
		Version int        `json:"version"`
		Kind    string     `json:"kind"`
		Status  TaskStatus `json:"status"`
		Request struct {
			Operation         string `json:"operation"`
			Prompt            string `json:"prompt"`
			Size              string `json:"size"`
			Quality           string `json:"quality"`
			N                 int    `json:"n"`
			OutputFormat      string `json:"output_format"`
			InputImageCount   int    `json:"input_image_count"`
			HasMask           bool   `json:"has_mask"`
			WebhookConfigured bool   `json:"webhook_configured"`
		} `json:"request"`
		Result struct {
			PublicBase string `json:"public_base"`
			Images     []struct {
				URL           string `json:"url"`
				RevisedPrompt string `json:"revised_prompt"`
			} `json:"images"`
			Count int `json:"count"`
		} `json:"result"`
		Timing struct {
			SubmittedAt int64 `json:"submitted_at"`
			CompletedAt int64 `json:"completed_at"`
			TotalMS     int64 `json:"total_ms"`
		} `json:"timing"`
	} `json:"task_info"`
}

func TestImageTaskBillingLogRequestIDDoesNotTruncateLongTaskIdentity(t *testing.T) {
	prefix := strings.Repeat("provider-task-prefix-", 8)
	first := imageTaskBillingLogRequestID(prefix + "first")
	second := imageTaskBillingLogRequestID(prefix + "second")

	assert.Len(t, first, billingAdjustmentRequestIDMax)
	assert.Len(t, second, billingAdjustmentRequestIDMax)
	assert.NotEqual(t, first, second)
}

func TestFinalizeImageTaskEnqueuesAndDeliversBillingLogIdempotently(t *testing.T) {
	truncateTables(t)
	user, token, _, task := seedImageTaskBillingState(t, "billing-outbox", 100)
	task.Properties.OriginModelName = "gpt-image-2"
	require.NoError(t, DB.Model(task).Update("properties", task.Properties).Error)

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)
	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)

	var outbox ImageTaskBillingLogOutbox
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&outbox).Error)
	assert.Equal(t, imageTaskBillingLogPending, outbox.Status)
	assert.Equal(t, user.Id, outbox.UserID)
	assert.Equal(t, token.Id, outbox.TokenID)

	require.NoError(t, DeliverImageTaskBillingLogOutbox(task.TaskID))
	var delivered ImageTaskBillingLogOutbox
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&delivered).Error)
	assert.Equal(t, imageTaskBillingLogDelivered, delivered.Status)
	var logs []Log
	require.NoError(t, DB.Where("request_id = ?", outbox.RequestID).Find(&logs).Error)
	assert.Len(t, logs, 1)
	require.NoError(t, DeliverImageTaskBillingLogOutbox(task.TaskID))
	require.NoError(t, DB.Where("request_id = ?", outbox.RequestID).Find(&logs).Error)
	assert.Len(t, logs, 1)
}

func TestFinalizeImageTaskBillingLogSnapshotsTaskInfo(t *testing.T) {
	truncateTables(t)
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "false")
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "https://cdn.example")
	_, _, _, task := seedImageTaskBillingState(t, "billing-log-task-info", 100)
	task.SubmitTime = common.GetTimestamp() - 9
	task.Properties.OriginModelName = "gpt-image-2"
	task.PrivateData.ResultURL = "https://cdn.example/images/first.png"
	task.PrivateData.BillingContext = &TaskBillingContext{
		OriginModelName: "gpt-image-2",
		BillingRequestInput: &billingexpr.RequestInput{Body: []byte(`{
			"model": "gpt-image-2",
			"prompt": "A serene koi pond at sunset",
			"size": "1024x1024",
			"quality": "high",
			"n": 2,
			"output_format": "png"
		}`)},
	}
	task.Data = []byte(`{
		"created": 123,
		"data": [
			{"url": "https://cdn.example/images/first.png", "revised_prompt": "revised first prompt"},
			{"url": "https://cdn.example/images/second.webp"}
		],
		"model": "gpt-image-2",
		"output_format": "png",
		"quality": "high",
		"size": "1024x1024",
		"usage": {"prompt_tokens": 12, "completion_tokens": 7, "total_tokens": 19}
	}`)
	require.NoError(t, DB.Model(task).
		Select("submit_time", "properties", "private_data", "data").
		Updates(task).Error)
	require.NoError(t, DB.Create(&TaskWebhook{
		TaskID: task.TaskID,
		URL:    "https://private.example/webhooks/images",
		Secret: "webhook-secret-must-not-leak",
	}).Error)

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 100)
	require.NoError(t, err)
	require.True(t, won)
	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)

	var outbox ImageTaskBillingLogOutbox
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&outbox).Error)
	var other imageTaskBillingLogOtherSnapshot
	require.NoError(t, common.Unmarshal([]byte(outbox.Other), &other))
	assert.Equal(t, 1, other.TaskInfo.Version)
	assert.Equal(t, "image_generation", other.TaskInfo.Kind)
	assert.Equal(t, TaskStatus(TaskStatusSuccess), other.TaskInfo.Status)
	assert.Equal(t, "generation", other.TaskInfo.Request.Operation)
	assert.Equal(t, "A serene koi pond at sunset", other.TaskInfo.Request.Prompt)
	assert.Equal(t, "1024x1024", other.TaskInfo.Request.Size)
	assert.Equal(t, "high", other.TaskInfo.Request.Quality)
	assert.Equal(t, 2, other.TaskInfo.Request.N)
	assert.Equal(t, "png", other.TaskInfo.Request.OutputFormat)
	assert.Zero(t, other.TaskInfo.Request.InputImageCount)
	assert.False(t, other.TaskInfo.Request.HasMask)
	assert.True(t, other.TaskInfo.Request.WebhookConfigured)
	assert.Equal(t, task.SubmitTime, other.TaskInfo.Timing.SubmittedAt)
	assert.Equal(t, finalized.Task.FinishTime, other.TaskInfo.Timing.CompletedAt)
	assert.Equal(t, (finalized.Task.FinishTime-task.SubmitTime)*1000, other.TaskInfo.Timing.TotalMS)
	assert.Equal(t, 2, other.TaskInfo.Result.Count)
	assert.Equal(t, "https://cdn.example", other.TaskInfo.Result.PublicBase)
	require.Len(t, other.TaskInfo.Result.Images, 2)
	assert.Equal(t, "https://cdn.example/images/first.png", other.TaskInfo.Result.Images[0].URL)
	assert.Equal(t, "revised first prompt", other.TaskInfo.Result.Images[0].RevisedPrompt)
	assert.Equal(t, "https://cdn.example/images/second.webp", other.TaskInfo.Result.Images[1].URL)

	require.NoError(t, DeliverImageTaskBillingLogOutbox(task.TaskID))
	var deliveredOutbox ImageTaskBillingLogOutbox
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&deliveredOutbox).Error)
	assert.Empty(t, deliveredOutbox.Other)
	assert.Empty(t, deliveredOutbox.Content)
	var deliveredLog Log
	require.NoError(t, LOG_DB.Where("request_id = ?", deliveredOutbox.RequestID).First(&deliveredLog).Error)
	assert.Contains(t, deliveredLog.Other, "A serene koi pond at sunset")
	assert.Contains(t, deliveredLog.Other, "https://cdn.example/images/first.png")
}

func TestImageTaskBillingLogOutboxSnapshotsEndToEndUseTime(t *testing.T) {
	truncateTables(t)
	_, _, _, task := seedImageTaskBillingState(t, "billing-log-outbox-use-time", 100)
	task.SubmitTime = common.GetTimestamp() - 8
	require.NoError(t, DB.Model(task).Update("submit_time", task.SubmitTime).Error)

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 100)
	require.NoError(t, err)
	require.True(t, won)
	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)

	var outbox struct {
		UseTime int `gorm:"column:use_time"`
	}
	require.NoError(t, DB.Model(&ImageTaskBillingLogOutbox{}).
		Select("use_time").
		Where("task_id = ?", task.TaskID).
		Scan(&outbox).Error)
	assert.Equal(t, int(finalized.Task.FinishTime-task.SubmitTime), outbox.UseTime)
}

func TestImageTaskBillingLogDeliveryWritesEndToEndUseTime(t *testing.T) {
	truncateTables(t)
	_, _, _, task := seedImageTaskBillingState(t, "billing-log-delivery-use-time", 100)
	task.SubmitTime = common.GetTimestamp() - 7
	require.NoError(t, DB.Model(task).Update("submit_time", task.SubmitTime).Error)

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 100)
	require.NoError(t, err)
	require.True(t, won)
	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)
	require.NoError(t, DeliverImageTaskBillingLogOutbox(task.TaskID))

	var log Log
	require.NoError(t, LOG_DB.Where("request_id = ?", imageTaskBillingLogRequestID(task.TaskID)).First(&log).Error)
	assert.Equal(t, int(finalized.Task.FinishTime-task.SubmitTime), log.UseTime)
}

func TestFinalizeZeroQuotaFailedImageTaskEnqueuesErrorLog(t *testing.T) {
	truncateTables(t)
	_, _, _, task := seedImageTaskBillingState(t, "billing-log-zero-quota-failure", 0)
	task.SubmitTime = common.GetTimestamp() - 5
	task.FailReason = "provider returned no generated image"
	require.NoError(t, DB.Model(task).
		Select("submit_time", "fail_reason").
		Updates(task).Error)

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusFailure, 0)
	require.NoError(t, err)
	require.True(t, won)
	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)

	var outbox ImageTaskBillingLogOutbox
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&outbox).Error)
	assert.Equal(t, LogTypeError, outbox.LogType)
	assert.Zero(t, outbox.Quota)
	var other imageTaskBillingLogOtherSnapshot
	require.NoError(t, common.Unmarshal([]byte(outbox.Other), &other))
	assert.Equal(t, TaskStatus(TaskStatusFailure), other.TaskInfo.Status)

	require.NoError(t, DeliverImageTaskBillingLogOutbox(task.TaskID))
	var log Log
	require.NoError(t, LOG_DB.Where("request_id = ?", outbox.RequestID).First(&log).Error)
	assert.Equal(t, LogTypeError, log.Type)
}

func TestImageTaskBillingLogDoesNotLeakPrivateTaskData(t *testing.T) {
	truncateTables(t)
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "false")
	_, _, _, task := seedImageTaskBillingState(t, "billing-log-private-data", 100)
	task.Data = []byte(`{"data":[{"url":"https://cdn.example/images/safe.png"}]}`)
	task.CheckpointData = []byte(`{
		"webhook_url": "https://private.example/webhooks/images",
		"webhook_secret": "webhook-secret-must-not-leak",
		"provider_payload": "private-provider-payload-must-not-leak"
	}`)
	task.PrivateData.Key = "private-channel-key-must-not-leak"
	task.PrivateData.ResultURL = "https://cdn.example/images/safe.png"
	task.PrivateData.BillingContext = &TaskBillingContext{
		OriginModelName: "gpt-image-2",
		BillingRequestInput: &billingexpr.RequestInput{
			Headers: map[string]string{"Authorization": "Bearer billing-header-secret-must-not-leak"},
			Body: []byte(`{
				"prompt": "ordinary prompt may be logged",
				"size": "1024x1024",
				"quality": "standard",
				"n": 1,
				"output_format": "png",
				"images": [
					"https://private.example/input-image.png",
					"data:image/png;base64,raw-input-image-base64-must-not-leak"
				],
				"mask": "data:image/png;base64,raw-mask-base64-must-not-leak"
			}`),
		},
	}
	require.NoError(t, DB.Model(task).
		Select("data", "checkpoint_data", "private_data").
		Updates(task).Error)
	require.NoError(t, DB.Create(&TaskWebhook{
		TaskID: task.TaskID,
		URL:    "https://private.example/webhooks/images",
		Secret: "webhook-secret-must-not-leak",
	}).Error)

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 100)
	require.NoError(t, err)
	require.True(t, won)
	_, err = FinalizeImageTask(task.TaskID)
	require.NoError(t, err)

	var outbox ImageTaskBillingLogOutbox
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&outbox).Error)
	var other imageTaskBillingLogOtherSnapshot
	require.NoError(t, common.Unmarshal([]byte(outbox.Other), &other))
	assert.Equal(t, "edit", other.TaskInfo.Request.Operation)
	assert.Equal(t, "ordinary prompt may be logged", other.TaskInfo.Request.Prompt)
	assert.Equal(t, 2, other.TaskInfo.Request.InputImageCount)
	assert.True(t, other.TaskInfo.Request.HasMask)
	assert.True(t, other.TaskInfo.Request.WebhookConfigured)
	assert.NotContains(t, outbox.Other, "webhook_url")
	assert.NotContains(t, outbox.Other, "https://private.example/webhooks/images")
	assert.NotContains(t, outbox.Other, "webhook-secret-must-not-leak")
	assert.NotContains(t, outbox.Other, "private-provider-payload-must-not-leak")
	assert.NotContains(t, outbox.Other, "private-channel-key-must-not-leak")
	assert.NotContains(t, outbox.Other, "billing-header-secret-must-not-leak")
	assert.NotContains(t, outbox.Other, "https://private.example/input-image.png")
	assert.NotContains(t, outbox.Other, "raw-input-image-base64-must-not-leak")
	assert.NotContains(t, outbox.Other, "raw-mask-base64-must-not-leak")
}

func TestImageTaskLogResultSnapshotPreservesDuplicateOutputCount(t *testing.T) {
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "https://cdn.example")
	task := &Task{Status: TaskStatusSuccess}
	result := imageTaskLogResultSnapshot(task, []dto.ImageData{
		{Url: "https://cdn.example/images/same.png"},
		{Url: "https://cdn.example/images/same.png"},
	})

	require.NotNil(t, result)
	assert.Equal(t, 2, result.Count)
	assert.Len(t, result.Images, 1)
}

func TestImageTaskLogResultSnapshotRestrictsConfiguredPublicBase(t *testing.T) {
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "https://cdn.example/generated")
	task := &Task{Status: TaskStatusSuccess}
	result := imageTaskLogResultSnapshot(task, []dto.ImageData{
		{Url: "https://cdn.example/generated/ok.png"},
		{Url: "https://cdn.example/other.png"},
		{Url: "https://cdn.example/generated/tracked.png?token=secret"},
		{Url: "https://127.0.0.1.nip.io/generated/ssrf.png"},
	})

	require.NotNil(t, result)
	assert.Equal(t, "https://cdn.example/generated", result.PublicBase)
	assert.Equal(t, 4, result.Count)
	require.Len(t, result.Images, 1)
	assert.Equal(t, "https://cdn.example/generated/ok.png", result.Images[0].URL)
}

func TestImageTaskLogResultSnapshotFailsClosedWithoutPublicBase(t *testing.T) {
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "")
	task := &Task{Status: TaskStatusSuccess}
	result := imageTaskLogResultSnapshot(task, []dto.ImageData{{
		Url: "https://provider.example/generated.png",
	}})

	require.NotNil(t, result)
	assert.Empty(t, result.PublicBase)
	assert.Equal(t, 1, result.Count)
	assert.Empty(t, result.Images)
}

func TestImageTaskBillingLogOutboxStaleLeaseCannotOverwriteReclaimedLease(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	outbox := &ImageTaskBillingLogOutbox{
		TaskID:        "billing-outbox-stale-lease",
		RequestID:     imageTaskBillingLogRequestID("billing-outbox-stale-lease"),
		Status:        imageTaskBillingLogPending,
		NextAttemptAt: now,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	require.NoError(t, DB.Create(outbox).Error)

	firstClaim, claimed, err := claimImageTaskBillingLogOutbox(outbox.TaskID, now)
	require.NoError(t, err)
	require.True(t, claimed)
	require.NotEmpty(t, firstClaim.LeaseToken)
	staleClaim := *firstClaim

	secondClaim, claimed, err := claimImageTaskBillingLogOutbox(outbox.TaskID, firstClaim.LeaseUntil+1)
	require.NoError(t, err)
	require.True(t, claimed)
	require.NotEmpty(t, secondClaim.LeaseToken)
	assert.NotEqual(t, staleClaim.LeaseToken, secondClaim.LeaseToken)

	require.ErrorIs(t, markImageTaskBillingLogOutboxRetry(&staleClaim, assert.AnError), gorm.ErrRecordNotFound)
	require.ErrorIs(t, markImageTaskBillingLogOutboxDelivered(&staleClaim), gorm.ErrRecordNotFound)

	var stored ImageTaskBillingLogOutbox
	require.NoError(t, DB.First(&stored, outbox.ID).Error)
	assert.Equal(t, imageTaskBillingLogDelivering, stored.Status)
	assert.Equal(t, secondClaim.LeaseToken, stored.LeaseToken)
	require.NoError(t, markImageTaskBillingLogOutboxDelivered(secondClaim))
	require.NoError(t, DB.First(&stored, outbox.ID).Error)
	assert.Equal(t, imageTaskBillingLogDelivered, stored.Status)
	assert.Empty(t, stored.LeaseToken)
}

func TestCompensatePermanentImageTaskFinalizationRefundsActiveReservation(t *testing.T) {
	truncateTables(t)
	user, token, _, task := seedImageTaskBillingState(t, "permanent-compensation", 100)
	reservation := &ImageBillingReservation{
		TaskID:         task.TaskID,
		UserID:         user.Id,
		TokenID:        token.Id,
		ExpectedQuota:  100,
		FundingSource:  "wallet",
		WalletReserved: 100,
		TokenRequired:  true,
		TokenReserved:  100,
		Status:         ImageBillingReservationActive,
	}
	require.NoError(t, DB.Create(reservation).Error)
	task.Status = TaskStatusFinalizing
	task.PrivateData.BillingFinalStatus = TaskStatusSuccess
	task.PrivateData.BillingActualQuota = common.MaxQuota + 1
	require.NoError(t, DB.Model(task).Select("status", "private_data").Updates(task).Error)

	compensated, err := CompensatePermanentImageTaskFinalization(task.TaskID, "invalid final quota")
	require.NoError(t, err)
	require.NotNil(t, compensated)
	assert.True(t, compensated.Applied)
	assert.Equal(t, TaskStatus(TaskStatusFailure), compensated.Task.Status)
	assert.Equal(t, -100, compensated.Delta)

	var storedTask Task
	require.NoError(t, DB.First(&storedTask, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusFailure), storedTask.Status)
	assert.Equal(t, 0, storedTask.Quota)
	var storedReservation ImageBillingReservation
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&storedReservation).Error)
	assert.Equal(t, ImageBillingReservationRefunded, storedReservation.Status)
	assert.Zero(t, storedReservation.WalletReserved)
	assert.Zero(t, storedReservation.TokenReserved)
	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Equal(t, 0, token.UsedQuota)

	var outbox ImageTaskBillingLogOutbox
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&outbox).Error)
	assert.Equal(t, LogTypeRefund, outbox.LogType)
}

func TestCompensatePermanentImageTaskFinalizationRefundsLegacyActiveReservation(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)
	user, token, _, task := seedImageTaskBillingState(t, "legacy-permanent-compensation", 100)
	legacyBalance := common.MaxQuota + 100_000
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("quota", legacyBalance-100).Error)
	require.NoError(t, DB.Model(&Token{}).Where("id = ?", token.Id).Updates(map[string]any{
		"remain_quota": legacyBalance - 100,
		"used_quota":   100,
	}).Error)
	user.Quota = legacyBalance
	token.RemainQuota = legacyBalance
	token.UsedQuota = 0
	require.NoError(t, populateUserCache(*user))
	require.NoError(t, cacheSetToken(*token))
	redisServer.SetTTL(getUserCacheKey(user.Id), time.Minute)
	tokenHMAC := common.GenerateHMAC(token.Key)
	redisServer.SetTTL("token:"+tokenHMAC, time.Minute)
	applied, legacyDebit, err := applyImageReservationCacheDebitWithMode(
		getUserCacheKey(user.Id),
		imageTaskUserQuotaPinsKey(user.Id),
		"Quota",
		"",
		task.TaskID,
		100,
	)
	require.NoError(t, err)
	require.True(t, applied)
	require.True(t, legacyDebit)
	applied, legacyDebit, err = applyImageReservationCacheDebitWithMode(
		"token:"+tokenHMAC,
		imageTaskTokenQuotaPinsKey(tokenHMAC),
		constant.TokenFiledRemainQuota,
		"UnlimitedQuota",
		task.TaskID,
		100,
	)
	require.NoError(t, err)
	require.True(t, applied)
	require.True(t, legacyDebit)
	require.NoError(t, DB.Create(&ImageBillingReservation{
		TaskID:            task.TaskID,
		UserID:            user.Id,
		TokenID:           token.Id,
		ExpectedQuota:     100,
		FundingSource:     "wallet",
		WalletReserved:    100,
		WalletLegacyDebit: true,
		TokenRequired:     true,
		TokenReserved:     100,
		TokenLegacyDebit:  true,
		QuotaModeVersion:  imageBillingReservationQuotaModeVersion,
		Status:            ImageBillingReservationActive,
	}).Error)
	task.Status = TaskStatusFinalizing
	task.PrivateData.BillingFinalStatus = TaskStatusSuccess
	task.PrivateData.BillingActualQuota = common.MaxQuota + 1
	require.NoError(t, DB.Model(task).Select("status", "private_data").Updates(task).Error)

	compensated, err := CompensatePermanentImageTaskFinalization(task.TaskID, "invalid legacy final quota")
	require.NoError(t, err)
	require.NotNil(t, compensated)
	require.True(t, compensated.Applied)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, legacyBalance, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, legacyBalance, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
	var reservation ImageBillingReservation
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&reservation).Error)
	assert.Equal(t, ImageBillingReservationRefunded, reservation.Status)
	assert.Zero(t, reservation.WalletReserved)
	assert.True(t, reservation.WalletLegacyDebit)
	assert.Zero(t, reservation.TokenReserved)
	assert.True(t, reservation.TokenLegacyDebit)
	assert.Positive(t, reservation.CacheReconciledAt)

	recovered, err := RecoverStaleImageBillingReservations(common.GetTimestamp(), 10, "retry permanent compensation cache reconciliation")
	require.NoError(t, err)
	assert.Zero(t, recovered)
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&reservation).Error)
	assert.Positive(t, reservation.CacheReconciledAt)
	assert.Empty(t, redisServer.HGet(getUserCacheKey(user.Id), imageReservationCacheField(task.TaskID)))
	assert.Empty(t, redisServer.HGet("token:"+tokenHMAC, imageReservationCacheField(task.TaskID)))
	assert.False(t, redisServer.Exists(imageTaskUserQuotaPinsKey(user.Id)))
	assert.False(t, redisServer.Exists(imageTaskTokenQuotaPinsKey(tokenHMAC)))
	cachedUser, err := GetUserCache(user.Id)
	require.NoError(t, err)
	assert.Equal(t, legacyBalance, cachedUser.Quota)
	cachedToken, err := GetTokenByKey(token.Key, false)
	require.NoError(t, err)
	assert.Equal(t, legacyBalance, cachedToken.RemainQuota)
}

func TestCompensatePermanentImageTaskFinalizationRecoversLegacyCacheWithoutMarkerMode(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)
	user, token, _, task := seedImageTaskBillingState(t, "legacy-cache-marker", 100)
	legacyBalance := common.MaxQuota + 100_000
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("quota", legacyBalance-100).Error)
	require.NoError(t, DB.Model(&Token{}).Where("id = ?", token.Id).Updates(map[string]any{
		"remain_quota": legacyBalance - 100,
		"used_quota":   100,
	}).Error)
	require.NoError(t, populateUserCache(*user))
	require.NoError(t, cacheSetToken(*token))
	redisServer.SetTTL(getUserCacheKey(user.Id), time.Minute)
	redisServer.SetTTL("token:"+common.GenerateHMAC(token.Key), time.Minute)
	require.NoError(t, DB.Model(user).Update("request_count", math.MaxInt).Error)
	require.NoError(t, DB.Create(&ImageBillingReservation{
		TaskID:            task.TaskID,
		UserID:            user.Id,
		TokenID:           token.Id,
		ExpectedQuota:     100,
		FundingSource:     "wallet",
		WalletReserved:    100,
		WalletLegacyDebit: true,
		TokenRequired:     true,
		TokenReserved:     100,
		TokenLegacyDebit:  true,
		Status:            ImageBillingReservationActive,
	}).Error)
	task.Status = TaskStatusFinalizing
	task.PrivateData.BillingFinalStatus = TaskStatusSuccess
	task.PrivateData.BillingActualQuota = 140
	require.NoError(t, DB.Model(task).Select("status", "private_data").Updates(task).Error)

	_, err := FinalizeImageTask(task.TaskID)
	permanent, ok := IsPermanentImageTaskFinalizationError(err)
	require.True(t, ok)
	require.False(t, permanent.BillingDBApplied)
	markerKey := "billing:image-task-cache:" + task.TaskID
	assert.Equal(t, "prepared", redisServer.HGet(markerKey, "state"))
	require.NoError(t, common.RDB.HDel(context.Background(), markerKey, "wallet_legacy_debit", "token_legacy_debit").Err())

	compensated, err := CompensatePermanentImageTaskFinalization(task.TaskID, "recover legacy cache marker")
	require.NoError(t, err)
	require.NotNil(t, compensated)
	require.True(t, compensated.Applied)
	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, legacyBalance, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, legacyBalance, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
	assert.False(t, redisServer.Exists(markerKey))
}

func TestCompensatePermanentImageTaskFinalizationRollsBackPreparedRedisCache(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)
	user, token, _, task := seedImageTaskBillingState(t, "prepared-cache-compensation", 100)
	require.NoError(t, DB.Model(user).Update("request_count", math.MaxInt).Error)
	require.NoError(t, DB.Create(&ImageBillingReservation{
		TaskID:         task.TaskID,
		UserID:         user.Id,
		TokenID:        token.Id,
		ExpectedQuota:  100,
		FundingSource:  "wallet",
		WalletReserved: 100,
		TokenRequired:  true,
		TokenReserved:  100,
		Status:         ImageBillingReservationActive,
	}).Error)
	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)

	_, err = FinalizeImageTask(task.TaskID)
	permanent, ok := IsPermanentImageTaskFinalizationError(err)
	require.True(t, ok)
	assert.False(t, permanent.BillingDBApplied)
	markerKey := "billing:image-task-cache:" + task.TaskID
	assert.Equal(t, "prepared", redisServer.HGet(markerKey, "state"))
	userPinned, err := redisServer.SIsMember(imageTaskUserQuotaPinsKey(user.Id), task.TaskID)
	require.NoError(t, err)
	assert.True(t, userPinned)
	tokenPinned, err := redisServer.SIsMember(imageTaskTokenQuotaPinsKey(common.GenerateHMAC(token.Key)), task.TaskID)
	require.NoError(t, err)
	assert.True(t, tokenPinned)

	compensated, err := CompensatePermanentImageTaskFinalization(task.TaskID, "invalid billing state")
	require.NoError(t, err)
	require.NotNil(t, compensated)
	assert.True(t, compensated.Applied)
	assert.Equal(t, TaskStatus(TaskStatusFailure), compensated.Task.Status)
	assert.False(t, redisServer.Exists(markerKey))
	assert.False(t, redisServer.Exists(imageTaskUserQuotaPinsKey(user.Id)))
	assert.False(t, redisServer.Exists(imageTaskTokenQuotaPinsKey(common.GenerateHMAC(token.Key))))
	assert.False(t, redisServer.Exists(getUserCacheKey(user.Id)))
	assert.False(t, redisServer.Exists("token:"+common.GenerateHMAC(token.Key)))

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	assert.Zero(t, user.UsedQuota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
}

func TestCompensatePermanentImageTaskFinalizationRefundsSurvivingPinnedLedger(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)
	user, token, _, task := seedImageTaskBillingState(t, "prepared-cache-compensation-with-peer", 100)
	require.NoError(t, DB.Model(user).Update("request_count", math.MaxInt).Error)
	require.NoError(t, DB.Create(&ImageBillingReservation{
		TaskID:         task.TaskID,
		UserID:         user.Id,
		TokenID:        token.Id,
		ExpectedQuota:  100,
		FundingSource:  "wallet",
		WalletReserved: 100,
		TokenRequired:  true,
		TokenReserved:  100,
		Status:         ImageBillingReservationActive,
	}).Error)
	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)

	_, err = FinalizeImageTask(task.TaskID)
	permanent, ok := IsPermanentImageTaskFinalizationError(err)
	require.True(t, ok)
	assert.False(t, permanent.BillingDBApplied)

	const peerTaskID = "task_image_finalize_compensation_peer"
	require.NoError(t, prepareImageTaskCacheAdjustment(imageTaskCacheAdjustment{
		taskID:     peerTaskID,
		userID:     user.Id,
		userDelta:  -25,
		tokenKey:   token.Key,
		tokenDelta: -25,
	}, user, token))

	compensated, err := CompensatePermanentImageTaskFinalization(task.TaskID, "invalid billing state")
	require.NoError(t, err)
	require.NotNil(t, compensated)
	assert.True(t, compensated.Applied)

	rawUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 975, rawUser.Quota)
	rawToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 975, rawToken.RemainQuota)
	userPeerPinned, err := redisServer.SIsMember(imageTaskUserQuotaPinsKey(user.Id), peerTaskID)
	require.NoError(t, err)
	assert.True(t, userPeerPinned)
	tokenPeerPinned, err := redisServer.SIsMember(imageTaskTokenQuotaPinsKey(common.GenerateHMAC(token.Key)), peerTaskID)
	require.NoError(t, err)
	assert.True(t, tokenPeerPinned)
	userCompensationPinned, err := redisServer.SIsMember(imageTaskUserQuotaPinsKey(user.Id), task.TaskID)
	require.NoError(t, err)
	assert.False(t, userCompensationPinned)
	tokenCompensationPinned, err := redisServer.SIsMember(imageTaskTokenQuotaPinsKey(common.GenerateHMAC(token.Key)), task.TaskID)
	require.NoError(t, err)
	assert.False(t, tokenCompensationPinned)
	assert.False(t, redisServer.Exists("billing:image-task-cache:"+task.TaskID))
	assert.True(t, redisServer.Exists("billing:image-task-cache:"+peerTaskID))

	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 1000, storedUser.Quota)
	var storedToken Token
	require.NoError(t, DB.First(&storedToken, token.Id).Error)
	assert.Equal(t, 1000, storedToken.RemainQuota)
	assert.Zero(t, storedToken.UsedQuota)
}

func TestCompensatePermanentImageTaskFinalizationRefundsSoftDeletedToken(t *testing.T) {
	truncateTables(t)
	user, token, _, task := seedImageTaskBillingState(t, "soft-deleted-token-compensation", 100)
	reservation := &ImageBillingReservation{
		TaskID:         task.TaskID,
		UserID:         user.Id,
		TokenID:        token.Id,
		ExpectedQuota:  100,
		FundingSource:  "wallet",
		WalletReserved: 100,
		TokenRequired:  true,
		TokenReserved:  100,
		Status:         ImageBillingReservationActive,
	}
	require.NoError(t, DB.Create(reservation).Error)
	task.Status = TaskStatusFinalizing
	task.PrivateData.BillingFinalStatus = TaskStatusSuccess
	task.PrivateData.BillingActualQuota = common.MaxQuota + 1
	require.NoError(t, DB.Model(task).Select("status", "private_data").Updates(task).Error)
	require.NoError(t, DB.Delete(token).Error)

	compensated, err := CompensatePermanentImageTaskFinalization(task.TaskID, "invalid final quota")
	require.NoError(t, err)
	require.NotNil(t, compensated)
	assert.True(t, compensated.Applied)

	var storedToken Token
	require.NoError(t, DB.Unscoped().First(&storedToken, token.Id).Error)
	assert.True(t, storedToken.DeletedAt.Valid)
	assert.Equal(t, 1000, storedToken.RemainQuota)
	assert.Zero(t, storedToken.UsedQuota)
}

func TestCompensatePermanentImageTaskFinalizationRefundsSoftDeletedUser(t *testing.T) {
	truncateTables(t)
	user, token, _, task := seedImageTaskBillingState(t, "soft-deleted-user-compensation", 100)
	require.NoError(t, DB.Create(&ImageBillingReservation{
		TaskID:         task.TaskID,
		UserID:         user.Id,
		TokenID:        token.Id,
		ExpectedQuota:  100,
		FundingSource:  "wallet",
		WalletReserved: 100,
		TokenRequired:  true,
		TokenReserved:  100,
		Status:         ImageBillingReservationActive,
	}).Error)
	task.Status = TaskStatusFinalizing
	task.PrivateData.BillingFinalStatus = TaskStatusSuccess
	task.PrivateData.BillingActualQuota = common.MaxQuota + 1
	require.NoError(t, DB.Model(task).Select("status", "private_data").Updates(task).Error)
	require.NoError(t, DB.Delete(user).Error)

	compensated, err := CompensatePermanentImageTaskFinalization(task.TaskID, "invalid final quota")
	require.NoError(t, err)
	require.NotNil(t, compensated)
	assert.True(t, compensated.Applied)

	var storedUser User
	require.NoError(t, DB.Unscoped().First(&storedUser, user.Id).Error)
	assert.True(t, storedUser.DeletedAt.Valid)
	assert.Equal(t, 1000, storedUser.Quota)
}

func TestCompensatePermanentImageTaskFinalizationNeverRefundsAppliedBilling(t *testing.T) {
	truncateTables(t)
	user, token, _, task := seedImageTaskBillingState(t, "applied-no-refund", 100)
	task.Status = TaskStatusFinalizing
	task.PrivateData.BillingDBApplied = true
	require.NoError(t, DB.Model(task).Select("status", "private_data").Updates(task).Error)
	reservation := &ImageBillingReservation{
		TaskID:         task.TaskID,
		UserID:         user.Id,
		TokenID:        token.Id,
		ExpectedQuota:  100,
		FundingSource:  "wallet",
		WalletReserved: 100,
		TokenRequired:  true,
		TokenReserved:  100,
		Status:         ImageBillingReservationActive,
	}
	require.NoError(t, DB.Create(reservation).Error)

	_, err := CompensatePermanentImageTaskFinalization(task.TaskID, "corrupt state after billing")
	require.Error(t, err)
	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 900, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 900, token.RemainQuota)
	var storedTask Task
	require.NoError(t, DB.First(&storedTask, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusFinalizing), storedTask.Status)
	assert.True(t, storedTask.PrivateData.BillingDBApplied)
}
