package model

import (
	"encoding/json"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestMain(m *testing.M) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic("failed to open test db: " + err.Error())
	}
	DB = db
	LOG_DB = db

	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.LogConsumeEnabled = true
	initCol()

	sqlDB, err := db.DB()
	if err != nil {
		panic("failed to get sql.DB: " + err.Error())
	}
	sqlDB.SetMaxOpenConns(1)

	if err := db.AutoMigrate(
		&Task{},
		&User{},
		&UserSession{},
		&AuthFlow{},
		&ExternalIdentityClaim{},
		&Token{},
		&PasskeyCredential{},
		&TwoFA{},
		&TwoFABackupCode{},
		&Log{},
		&Channel{},
		&QuotaData{},
		&Ability{},
		&TopUp{},
		&SubscriptionPlan{},
		&SubscriptionOrder{},
		&UserSubscription{},
		&UserOAuthBinding{},
		&PerfMetric{},
		&SystemInstance{},
		&SystemTask{},
		&SystemTaskLock{},
	); err != nil {
		panic("failed to migrate: " + err.Error())
	}

	os.Exit(m.Run())
}

func truncateTables(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		DB.Exec("DELETE FROM tasks")
		DB.Exec("DELETE FROM auth_flows")
		DB.Exec("DELETE FROM external_identity_claims")
		DB.Exec("DELETE FROM user_sessions")
		DB.Exec("DELETE FROM passkey_credentials")
		DB.Exec("DELETE FROM two_fa_backup_codes")
		DB.Exec("DELETE FROM two_fas")
		DB.Exec("DELETE FROM tokens")
		DB.Exec("DELETE FROM user_oauth_bindings")
		DB.Exec("DELETE FROM users")
		DB.Exec("DELETE FROM logs")
		DB.Exec("DELETE FROM channels")
		DB.Exec("DELETE FROM quota_data")
		DB.Exec("DELETE FROM abilities")
		DB.Exec("DELETE FROM top_ups")
		DB.Exec("DELETE FROM subscription_orders")
		DB.Exec("DELETE FROM subscription_plans")
		DB.Exec("DELETE FROM user_subscriptions")
		DB.Exec("DELETE FROM perf_metrics")
		DB.Exec("DELETE FROM system_instances")
		DB.Exec("DELETE FROM system_task_locks")
		DB.Exec("DELETE FROM system_tasks")
	})
}

func insertTask(t *testing.T, task *Task) {
	t.Helper()
	task.CreatedAt = time.Now().Unix()
	task.UpdatedAt = time.Now().Unix()
	require.NoError(t, DB.Create(task).Error)
}

// ---------------------------------------------------------------------------
// Snapshot / Equal — pure logic tests (no DB)
// ---------------------------------------------------------------------------

func TestSnapshotEqual_Same(t *testing.T) {
	s := taskSnapshot{
		Status:     TaskStatusInProgress,
		Progress:   "50%",
		StartTime:  1000,
		FinishTime: 0,
		FailReason: "",
		ResultURL:  "",
		Data:       json.RawMessage(`{"key":"value"}`),
	}
	assert.True(t, s.Equal(s))
}

func TestSnapshotEqual_DifferentStatus(t *testing.T) {
	a := taskSnapshot{Status: TaskStatusInProgress, Data: json.RawMessage(`{}`)}
	b := taskSnapshot{Status: TaskStatusSuccess, Data: json.RawMessage(`{}`)}
	assert.False(t, a.Equal(b))
}

func TestSnapshotEqual_DifferentProgress(t *testing.T) {
	a := taskSnapshot{Status: TaskStatusInProgress, Progress: "30%", Data: json.RawMessage(`{}`)}
	b := taskSnapshot{Status: TaskStatusInProgress, Progress: "60%", Data: json.RawMessage(`{}`)}
	assert.False(t, a.Equal(b))
}

func TestSnapshotEqual_DifferentData(t *testing.T) {
	a := taskSnapshot{Status: TaskStatusInProgress, Data: json.RawMessage(`{"a":1}`)}
	b := taskSnapshot{Status: TaskStatusInProgress, Data: json.RawMessage(`{"a":2}`)}
	assert.False(t, a.Equal(b))
}

func TestSnapshotEqual_NilVsEmpty(t *testing.T) {
	a := taskSnapshot{Status: TaskStatusInProgress, Data: nil}
	b := taskSnapshot{Status: TaskStatusInProgress, Data: json.RawMessage{}}
	// bytes.Equal(nil, []byte{}) == true
	assert.True(t, a.Equal(b))
}

func TestSnapshot_Roundtrip(t *testing.T) {
	task := &Task{
		Status:     TaskStatusInProgress,
		Progress:   "42%",
		StartTime:  1234,
		FinishTime: 5678,
		FailReason: "timeout",
		PrivateData: TaskPrivateData{
			ResultURL: "https://example.com/result.mp4",
		},
		Data: json.RawMessage(`{"model":"test-model"}`),
	}
	snap := task.Snapshot()
	assert.Equal(t, task.Status, snap.Status)
	assert.Equal(t, task.Progress, snap.Progress)
	assert.Equal(t, task.StartTime, snap.StartTime)
	assert.Equal(t, task.FinishTime, snap.FinishTime)
	assert.Equal(t, task.FailReason, snap.FailReason)
	assert.Equal(t, task.PrivateData.ResultURL, snap.ResultURL)
	assert.JSONEq(t, string(task.Data), string(snap.Data))
}

// ---------------------------------------------------------------------------
// UpdateWithStatus CAS — DB integration tests
// ---------------------------------------------------------------------------

func TestUpdateWithStatus_Win(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID:   "task_cas_win",
		Status:   TaskStatusInProgress,
		Progress: "50%",
		Data:     json.RawMessage(`{}`),
	}
	insertTask(t, task)

	task.Status = TaskStatusSuccess
	task.Progress = "100%"
	won, err := task.UpdateWithStatus(TaskStatusInProgress)
	require.NoError(t, err)
	assert.True(t, won)

	var reloaded Task
	require.NoError(t, DB.First(&reloaded, task.ID).Error)
	assert.EqualValues(t, TaskStatusSuccess, reloaded.Status)
	assert.Equal(t, "100%", reloaded.Progress)
}

func TestUpdateWithStatus_Lose(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID: "task_cas_lose",
		Status: TaskStatusFailure,
		Data:   json.RawMessage(`{}`),
	}
	insertTask(t, task)

	task.Status = TaskStatusSuccess
	won, err := task.UpdateWithStatus(TaskStatusInProgress) // wrong fromStatus
	require.NoError(t, err)
	assert.False(t, won)

	var reloaded Task
	require.NoError(t, DB.First(&reloaded, task.ID).Error)
	assert.EqualValues(t, TaskStatusFailure, reloaded.Status) // unchanged
}

func TestUpdateWithStatus_ConcurrentWinner(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID: "task_cas_race",
		Status: TaskStatusInProgress,
		Quota:  1000,
		Data:   json.RawMessage(`{}`),
	}
	insertTask(t, task)

	const goroutines = 5
	wins := make([]bool, goroutines)
	var wg sync.WaitGroup
	wg.Add(goroutines)

	for i := 0; i < goroutines; i++ {
		go func(idx int) {
			defer wg.Done()
			t := &Task{}
			*t = Task{
				ID:       task.ID,
				TaskID:   task.TaskID,
				Status:   TaskStatusSuccess,
				Progress: "100%",
				Quota:    task.Quota,
				Data:     json.RawMessage(`{}`),
			}
			t.CreatedAt = task.CreatedAt
			t.UpdatedAt = time.Now().Unix()
			won, err := t.UpdateWithStatus(TaskStatusInProgress)
			if err == nil {
				wins[idx] = won
			}
		}(i)
	}
	wg.Wait()

	winCount := 0
	for _, w := range wins {
		if w {
			winCount++
		}
	}
	assert.Equal(t, 1, winCount, "exactly one goroutine should win the CAS")
}

func TestClaimQuotaForRefund_OnlyOneClaimSucceeds(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID: "task_refund_claim",
		Status: TaskStatusFailure,
		Quota:  1000,
		Data:   json.RawMessage(`{}`),
	}
	insertTask(t, task)

	claimed, err := ClaimQuotaForRefund(task.ID, task.Quota)
	require.NoError(t, err)
	assert.True(t, claimed)

	claimed, err = ClaimQuotaForRefund(task.ID, task.Quota)
	require.NoError(t, err)
	assert.False(t, claimed)

	var reloaded Task
	require.NoError(t, DB.First(&reloaded, task.ID).Error)
	assert.Zero(t, reloaded.Quota)
}

func TestGetUnrefundedFailedTasks_FiltersAndLimits(t *testing.T) {
	truncateTables(t)

	tasks := []*Task{
		{TaskID: "failed_refundable_1", Status: TaskStatusFailure, Quota: 100, SubmitTime: TaskRefundLegacyCutoff, Data: json.RawMessage(`{}`)},
		{TaskID: "failed_refundable_2", Status: TaskStatusFailure, Quota: 200, SubmitTime: TaskRefundLegacyCutoff + 1, Data: json.RawMessage(`{}`)},
		{TaskID: "legacy_failed", Status: TaskStatusFailure, Quota: 400, SubmitTime: TaskRefundLegacyCutoff - 1, Data: json.RawMessage(`{}`)},
		{TaskID: "failed_without_quota", Status: TaskStatusFailure, Quota: 0, Data: json.RawMessage(`{}`)},
		{TaskID: "successful_with_quota", Status: TaskStatusSuccess, Quota: 300, Data: json.RawMessage(`{}`)},
	}
	for _, task := range tasks {
		insertTask(t, task)
	}

	updatedBefore := time.Now().Unix() + 1
	found := GetUnrefundedFailedTasks(updatedBefore, 1)
	require.Len(t, found, 1)
	assert.Equal(t, tasks[0].ID, found[0].ID)

	found = GetUnrefundedFailedTasks(updatedBefore, 10)
	require.Len(t, found, 2)
	assert.Equal(t, []int64{tasks[0].ID, tasks[1].ID}, []int64{found[0].ID, found[1].ID})

	assert.Empty(t, GetUnrefundedFailedTasks(updatedBefore, 0))
}

func TestRestoreQuotaAfterFailedRefund_OnlyRestoresClaimedMarker(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID: "task_refund_restore",
		Status: TaskStatusFailure,
		Quota:  750,
		Data:   json.RawMessage(`{}`),
	}
	insertTask(t, task)

	claimed, err := ClaimQuotaForRefund(task.ID, task.Quota)
	require.NoError(t, err)
	require.True(t, claimed)

	restored, err := RestoreQuotaAfterFailedRefund(task.ID, task.Quota)
	require.NoError(t, err)
	assert.True(t, restored)

	restored, err = RestoreQuotaAfterFailedRefund(task.ID, task.Quota)
	require.NoError(t, err)
	assert.False(t, restored)

	var reloaded Task
	require.NoError(t, DB.First(&reloaded, task.ID).Error)
	assert.Equal(t, task.Quota, reloaded.Quota)
}

func TestHasTaskPollingWork_IncludesOnlyRefundableFailedTasks(t *testing.T) {
	truncateTables(t)
	assert.False(t, HasTaskPollingWork())

	legacy := &Task{
		TaskID:     "legacy_failed_work",
		Status:     TaskStatusFailure,
		Progress:   "100%",
		Quota:      500,
		SubmitTime: TaskRefundLegacyCutoff - 1,
		Data:       json.RawMessage(`{}`),
	}
	insertTask(t, legacy)
	assert.False(t, HasTaskPollingWork())

	refundable := &Task{
		TaskID:     "refundable_failed_work",
		Status:     TaskStatusFailure,
		Progress:   "100%",
		Quota:      500,
		SubmitTime: TaskRefundLegacyCutoff,
		Data:       json.RawMessage(`{}`),
	}
	insertTask(t, refundable)
	assert.True(t, HasTaskPollingWork())
}
