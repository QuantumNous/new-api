package model

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm/schema"
)

func TestAsyncModelsBelongToTask(t *testing.T) {
	models := map[string]any{
		"async job":  &AsyncJob{},
		"artifact":   &Artifact{},
		"task event": &TaskEvent{},
	}
	for name, value := range models {
		t.Run(name, func(t *testing.T) {
			parsed, err := schema.Parse(value, &sync.Map{}, schema.NamingStrategy{})
			require.NoError(t, err)
			relation := parsed.Relationships.Relations["Task"]
			require.NotNil(t, relation)
			assert.Equal(t, schema.BelongsTo, relation.Type)
			require.Len(t, relation.References, 1)
			assert.Equal(t, "task_id", relation.References[0].ForeignKey.DBName)
			assert.Equal(t, "id", relation.References[0].PrimaryKey.DBName)
		})
	}
}

func createAsyncFixture(t *testing.T, suffix string) (*Task, *AsyncJob) {
	t.Helper()
	task := &Task{
		TaskID:    "task_async_" + suffix,
		Platform:  constant.TaskPlatformAsyncImage,
		UserId:    1,
		ChannelId: 2,
		Status:    TaskStatusQueued,
		Progress:  "0%",
		Data:      json.RawMessage(`{"model":"image-model"}`),
	}
	job := &AsyncJob{
		TokenID:          3,
		ChannelID:        2,
		EndpointType:     AsyncEndpointImageGeneration,
		RequestPayload:   []byte("encrypted"),
		RequestHash:      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
		IdempotencyKey:   "idem-" + suffix,
		ExecutionStatus:  AsyncStatusQueued,
		BillingStatus:    AsyncBillingReserved,
		BillingRequestID: "req-" + suffix,
	}
	require.NoError(t, CreateAsyncTask(task, job))
	return task, job
}

func TestValidateAsyncTransition(t *testing.T) {
	valid := [][2]AsyncExecutionStatus{
		{AsyncStatusQueued, AsyncStatusRunning},
		{AsyncStatusQueued, AsyncStatusCancelled},
		{AsyncStatusRunning, AsyncStatusSuccess},
		{AsyncStatusRunning, AsyncStatusFailure},
		{AsyncStatusRunning, AsyncStatusUncertain},
		{AsyncStatusFailure, AsyncStatusQueued},
		{AsyncStatusUncertain, AsyncStatusQueued},
	}
	for _, transition := range valid {
		require.NoError(t, ValidateAsyncTransition(transition[0], transition[1]))
	}
	require.ErrorIs(t, ValidateAsyncTransition(AsyncStatusSuccess, AsyncStatusQueued), ErrInvalidAsyncTransition)
	require.ErrorIs(t, ValidateAsyncTransition(AsyncStatusRunning, AsyncStatusCancelled), ErrInvalidAsyncTransition)
}

func TestAsyncIdempotencyUniquePerToken(t *testing.T) {
	truncateTables(t)
	_, first := createAsyncFixture(t, "unique")
	duplicateTask := &Task{TaskID: "task_async_duplicate", Platform: constant.TaskPlatformAsyncImage, Status: TaskStatusQueued, Data: json.RawMessage(`{}`)}
	duplicate := *first
	duplicate.ID = 0
	duplicate.TaskID = 0
	require.Error(t, CreateAsyncTask(duplicateTask, &duplicate))

	loaded, err := GetAsyncJobByTokenAndKey(context.Background(), first.TokenID, first.IdempotencyKey)
	require.NoError(t, err)
	require.NotNil(t, loaded)
	assert.Equal(t, first.RequestHash, loaded.RequestHash)
	assert.Equal(t, "task_async_unique", loaded.Task.TaskID)
}

func TestAsyncClaimHasSingleWinnerAndRenewsLease(t *testing.T) {
	truncateTables(t)
	_, job := createAsyncFixture(t, "claim")

	const workers = 5
	wins := make([]bool, workers)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, claimed, err := ClaimAsyncJob(context.Background(), job.ID, "worker", time.Now().Add(time.Minute).Unix())
			if err == nil {
				wins[i] = claimed
			}
		}(i)
	}
	wg.Wait()
	winnerCount := 0
	for _, won := range wins {
		if won {
			winnerCount++
		}
	}
	assert.Equal(t, 1, winnerCount)

	renewed, err := RenewAsyncJobLease(context.Background(), job.ID, "worker", time.Now().Add(2*time.Minute).Unix())
	require.NoError(t, err)
	assert.True(t, renewed)
	renewed, err = RenewAsyncJobLease(context.Background(), job.ID, "other-worker", time.Now().Add(3*time.Minute).Unix())
	require.NoError(t, err)
	assert.False(t, renewed)
}

func TestRecoverExpiredAsyncJobs(t *testing.T) {
	truncateTables(t)
	_, beforeSend := createAsyncFixture(t, "recover-before")
	_, claimed, err := ClaimAsyncJob(context.Background(), beforeSend.ID, "worker-a", time.Now().Add(-time.Minute).Unix())
	require.NoError(t, err)
	require.True(t, claimed)

	_, afterSend := createAsyncFixture(t, "recover-after")
	_, claimed, err = ClaimAsyncJob(context.Background(), afterSend.ID, "worker-b", time.Now().Add(-time.Minute).Unix())
	require.NoError(t, err)
	require.True(t, claimed)
	marked, err := MarkAsyncRequestSent(context.Background(), afterSend.ID, "worker-b", time.Now().Add(-2*time.Minute).Unix())
	require.NoError(t, err)
	require.True(t, marked)

	summary, err := RecoverExpiredAsyncJobs(context.Background(), time.Now().Unix(), 10)
	require.NoError(t, err)
	assert.Equal(t, 1, summary.Requeued)
	assert.Equal(t, 1, summary.Uncertain)

	var requeued, uncertain AsyncJob
	require.NoError(t, DB.First(&requeued, beforeSend.ID).Error)
	require.NoError(t, DB.First(&uncertain, afterSend.ID).Error)
	assert.Equal(t, AsyncStatusQueued, requeued.ExecutionStatus)
	assert.Equal(t, AsyncStatusUncertain, uncertain.ExecutionStatus)
}

func TestCancelQueuedAsyncJob(t *testing.T) {
	truncateTables(t)
	task, _ := createAsyncFixture(t, "cancel")

	job, changed, err := CancelQueuedAsyncJob(context.Background(), task.TaskID, 3)
	require.NoError(t, err)
	require.True(t, changed)
	assert.Equal(t, AsyncStatusCancelled, job.ExecutionStatus)
	assert.EqualValues(t, TaskStatusCancelled, job.Task.Status)

	_, changed, err = CancelQueuedAsyncJob(context.Background(), task.TaskID, 3)
	require.NoError(t, err)
	assert.False(t, changed)
}

func TestAsyncBillingRefundIsIdempotent(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{Id: 11, Username: "async-user", Quota: 900, Status: common.UserStatusEnabled}).Error)
	require.NoError(t, DB.Create(&Token{Id: 12, UserId: 11, Key: "async-token", Name: "async", Status: common.TokenStatusEnabled, RemainQuota: 900, UsedQuota: 100}).Error)
	require.NoError(t, DB.Create(&Channel{Id: 13, Name: "async-channel", Status: common.ChannelStatusEnabled}).Error)

	task := &Task{
		TaskID:    "task_async_refund",
		Platform:  constant.TaskPlatformAsyncImage,
		UserId:    11,
		ChannelId: 13,
		Quota:     100,
		Status:    TaskStatusQueued,
		Progress:  "0%",
		PrivateData: TaskPrivateData{
			BillingSource: "wallet",
			TokenId:       12,
		},
		Data: json.RawMessage(`{}`),
	}
	job := &AsyncJob{TokenID: 12, ChannelID: 13, EndpointType: AsyncEndpointImageGeneration, RequestPayload: []byte("encrypted"), RequestHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", IdempotencyKey: "refund-once", ExecutionStatus: AsyncStatusQueued, BillingStatus: AsyncBillingReserved}
	require.NoError(t, CreateAsyncTask(task, job))
	_, changed, err := CancelQueuedAsyncJob(context.Background(), task.TaskID, 12)
	require.NoError(t, err)
	require.True(t, changed)

	refunded, err := RefundAsyncJobBilling(context.Background(), job.ID)
	require.NoError(t, err)
	require.True(t, refunded)
	refunded, err = RefundAsyncJobBilling(context.Background(), job.ID)
	require.NoError(t, err)
	assert.False(t, refunded)

	var user User
	var token Token
	require.NoError(t, DB.First(&user, 11).Error)
	require.NoError(t, DB.First(&token, 12).Error)
	assert.Equal(t, 1000, user.Quota)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Equal(t, 0, token.UsedQuota)
}

func TestAsyncBillingSettlementIsIdempotent(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{Id: 21, Username: "settle-user", Quota: 900, Status: common.UserStatusEnabled}).Error)
	require.NoError(t, DB.Create(&Token{Id: 22, UserId: 21, Key: "settle-token", Name: "async", Status: common.TokenStatusEnabled, RemainQuota: 900, UsedQuota: 100}).Error)
	require.NoError(t, DB.Create(&Channel{Id: 23, Name: "settle-channel", Status: common.ChannelStatusEnabled}).Error)

	task := &Task{TaskID: "task_async_settle", Platform: constant.TaskPlatformAsyncImage, UserId: 21, ChannelId: 23, Quota: 100, Status: TaskStatusQueued, Progress: "0%", PrivateData: TaskPrivateData{BillingSource: "wallet", TokenId: 22}, Data: json.RawMessage(`{}`)}
	job := &AsyncJob{TokenID: 22, ChannelID: 23, EndpointType: AsyncEndpointImageGeneration, RequestPayload: []byte("encrypted"), RequestHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", IdempotencyKey: "settle-once", ExecutionStatus: AsyncStatusQueued, BillingStatus: AsyncBillingReserved}
	require.NoError(t, CreateAsyncTask(task, job))
	_, claimed, err := ClaimAsyncJob(context.Background(), job.ID, "worker", time.Now().Add(time.Minute).Unix())
	require.NoError(t, err)
	require.True(t, claimed)
	completed, err := CompleteAsyncJob(context.Background(), job.ID, "worker", AsyncStatusSuccess, json.RawMessage(`{"data":[]}`), "", "", "", false)
	require.NoError(t, err)
	require.True(t, completed)

	settled, err := SettleAsyncJobBilling(context.Background(), job.ID)
	require.NoError(t, err)
	require.True(t, settled)
	settled, err = SettleAsyncJobBilling(context.Background(), job.ID)
	require.NoError(t, err)
	assert.False(t, settled)

	var user User
	var channel Channel
	require.NoError(t, DB.First(&user, 21).Error)
	require.NoError(t, DB.First(&channel, 23).Error)
	assert.Equal(t, 100, user.UsedQuota)
	assert.Equal(t, 1, user.RequestCount)
	assert.Equal(t, int64(100), channel.UsedQuota)
}

func TestUncertainAsyncBillingReconciliationSettlesExactlyOnce(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{Id: 24, Username: "uncertain-settle-user", Quota: 900, Status: common.UserStatusEnabled}).Error)
	require.NoError(t, DB.Create(&Token{Id: 25, UserId: 24, Key: "uncertain-settle-token", Name: "async", Status: common.TokenStatusEnabled, RemainQuota: 900, UsedQuota: 100}).Error)
	require.NoError(t, DB.Create(&Channel{Id: 26, Name: "uncertain-settle-channel", Status: common.ChannelStatusEnabled}).Error)

	task := &Task{TaskID: "task_async_uncertain_settle", Platform: constant.TaskPlatformAsyncImage, UserId: 24, ChannelId: 26, Quota: 100, Status: TaskStatusUncertain, Progress: "0%", FinishTime: time.Now().Unix(), PrivateData: TaskPrivateData{BillingSource: "wallet", TokenId: 25}, Data: json.RawMessage(`{}`)}
	job := &AsyncJob{TokenID: 25, ChannelID: 26, EndpointType: AsyncEndpointImageGeneration, RequestPayload: []byte("encrypted"), RequestHash: "abababababababababababababababababababababababababababababababab", IdempotencyKey: "uncertain-settle-once", ExecutionStatus: AsyncStatusUncertain, BillingStatus: AsyncBillingReserved, RequestSentAt: time.Now().Unix()}
	require.NoError(t, CreateAsyncTask(task, job))

	processed, err := ReconcileAsyncBilling(context.Background(), 10)
	require.NoError(t, err)
	assert.Equal(t, 1, processed)
	processed, err = ReconcileAsyncBilling(context.Background(), 10)
	require.NoError(t, err)
	assert.Zero(t, processed)

	var user User
	var channel Channel
	var loadedJob AsyncJob
	require.NoError(t, DB.First(&user, 24).Error)
	require.NoError(t, DB.First(&channel, 26).Error)
	require.NoError(t, DB.First(&loadedJob, job.ID).Error)
	assert.Equal(t, 100, user.UsedQuota)
	assert.Equal(t, 1, user.RequestCount)
	assert.Equal(t, int64(100), channel.UsedQuota)
	assert.Equal(t, AsyncBillingSettled, loadedJob.BillingStatus)
}

func TestManualRetryReservesRefundedFailureAgain(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{Id: 31, Username: "retry-user", Quota: 1000, Status: common.UserStatusEnabled}).Error)
	require.NoError(t, DB.Create(&Token{Id: 32, UserId: 31, Key: "retry-token", Name: "async", Status: common.TokenStatusEnabled, RemainQuota: 1000}).Error)
	require.NoError(t, DB.Create(&Channel{Id: 33, Name: "retry-channel", Status: common.ChannelStatusEnabled}).Error)
	task := &Task{TaskID: "task_async_retry_failure", Platform: constant.TaskPlatformAsyncImage, UserId: 31, ChannelId: 33, Quota: 100, Status: TaskStatusFailure, Progress: "0%", FinishTime: time.Now().Unix(), PrivateData: TaskPrivateData{BillingSource: "wallet", TokenId: 32}, Data: json.RawMessage(`{}`)}
	job := &AsyncJob{TokenID: 32, ChannelID: 33, EndpointType: AsyncEndpointImageGeneration, RequestPayload: []byte("encrypted"), RequestHash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc", IdempotencyKey: "retry-refunded", ExecutionStatus: AsyncStatusFailure, BillingStatus: AsyncBillingRefunded, RefundEligible: true}
	require.NoError(t, CreateAsyncTask(task, job))

	retried, changed, err := RetryAsyncJob(context.Background(), job.ID, 99)
	require.NoError(t, err)
	require.True(t, changed)
	assert.Equal(t, AsyncStatusQueued, retried.ExecutionStatus)
	assert.Equal(t, AsyncBillingReserved, retried.BillingStatus)
	assert.EqualValues(t, TaskStatusQueued, retried.Task.Status)

	var user User
	var token Token
	require.NoError(t, DB.First(&user, 31).Error)
	require.NoError(t, DB.First(&token, 32).Error)
	assert.Equal(t, 900, user.Quota)
	assert.Equal(t, 900, token.RemainQuota)
	assert.Equal(t, 100, token.UsedQuota)
}

func TestManualRetryUncertainSettlesPriorAndReservesNextAttempt(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{Id: 41, Username: "uncertain-user", Quota: 900, Status: common.UserStatusEnabled}).Error)
	require.NoError(t, DB.Create(&Token{Id: 42, UserId: 41, Key: "uncertain-token", Name: "async", Status: common.TokenStatusEnabled, RemainQuota: 900, UsedQuota: 100}).Error)
	require.NoError(t, DB.Create(&Channel{Id: 43, Name: "uncertain-channel", Status: common.ChannelStatusEnabled}).Error)
	task := &Task{TaskID: "task_async_retry_uncertain", Platform: constant.TaskPlatformAsyncImage, UserId: 41, ChannelId: 43, Quota: 100, Status: TaskStatusUncertain, Progress: "0%", FinishTime: time.Now().Unix(), PrivateData: TaskPrivateData{BillingSource: "wallet", TokenId: 42}, Data: json.RawMessage(`{}`)}
	job := &AsyncJob{TokenID: 42, ChannelID: 43, EndpointType: AsyncEndpointImageGeneration, RequestPayload: []byte("encrypted"), RequestHash: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", IdempotencyKey: "retry-uncertain", ExecutionStatus: AsyncStatusUncertain, BillingStatus: AsyncBillingReserved, RequestSentAt: time.Now().Unix()}
	require.NoError(t, CreateAsyncTask(task, job))

	retried, changed, err := RetryAsyncJob(context.Background(), job.ID, 99)
	require.NoError(t, err)
	require.True(t, changed)
	assert.Equal(t, AsyncStatusQueued, retried.ExecutionStatus)
	assert.Zero(t, retried.RequestSentAt)

	var user User
	var token Token
	var channel Channel
	require.NoError(t, DB.First(&user, 41).Error)
	require.NoError(t, DB.First(&token, 42).Error)
	require.NoError(t, DB.First(&channel, 43).Error)
	assert.Equal(t, 800, user.Quota)
	assert.Equal(t, 100, user.UsedQuota)
	assert.Equal(t, 1, user.RequestCount)
	assert.Equal(t, 800, token.RemainQuota)
	assert.Equal(t, 200, token.UsedQuota)
	assert.Equal(t, int64(100), channel.UsedQuota)

	_, changed, err = RetryAsyncJob(context.Background(), job.ID, 99)
	require.NoError(t, err)
	assert.False(t, changed)
}

func TestAsyncChannelSelectionSkipsNonYunwuOptIn(t *testing.T) {
	truncateTables(t)
	t.Setenv("ASYNC_YUNWU_ALLOWED_BASE_URLS", "https://yunwu.ai")
	archive := true
	invalidBase := "https://example.com"
	validBase := "https://yunwu.ai"
	invalid := &Channel{Id: 51, Name: "invalid-async-origin", BaseURL: &invalidBase, Status: common.ChannelStatusEnabled, Models: "image-model", Group: "default"}
	valid := &Channel{Id: 52, Name: "valid-yunwu-origin", BaseURL: &validBase, Status: common.ChannelStatusEnabled, Models: "image-model", Group: "default"}
	setting := dto.ChannelSettings{AsyncImageEnabled: true, AsyncImageModels: []string{"image-model"}, AsyncAutoArchive: &archive}
	invalid.SetSetting(setting)
	valid.SetSetting(setting)
	require.NoError(t, DB.Create(invalid).Error)
	require.NoError(t, DB.Create(valid).Error)
	invalidPriority := int64(100)
	validPriority := int64(10)
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: "image-model", ChannelId: invalid.Id, Enabled: true, Priority: &invalidPriority, Weight: 1}).Error)
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: "image-model", ChannelId: valid.Id, Enabled: true, Priority: &validPriority, Weight: 1}).Error)

	selected, err := GetAsyncImageChannel("default", "image-model")
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, valid.Id, selected.Id)
}

func TestAsyncChannelSelectionAcceptsAllowedGRSAIProvider(t *testing.T) {
	truncateTables(t)
	t.Setenv("ASYNC_GRSAI_ALLOWED_BASE_URLS", "https://grsaiapi.com")
	archive := true
	baseURL := "https://grsaiapi.com/v1"
	channel := &Channel{Id: 53, Name: "valid-grsai-origin", BaseURL: &baseURL, Status: common.ChannelStatusEnabled, Models: "nano-banana-2", Group: "default"}
	channel.SetSetting(dto.ChannelSettings{AsyncImageEnabled: true, AsyncImageModels: []string{"nano-banana-2"}, AsyncAutoArchive: &archive})
	require.NoError(t, DB.Create(channel).Error)
	priority := int64(20)
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: "nano-banana-2", ChannelId: channel.Id, Enabled: true, Priority: &priority, Weight: 1}).Error)

	selected, err := GetAsyncImageChannel("default", "nano-banana-2")
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, channel.Id, selected.Id)
}
