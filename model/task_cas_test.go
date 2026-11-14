package model

import (
	"context"
	"encoding/json"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
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
		&UserAccessToken{},
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
		DB.Exec("DELETE FROM user_access_tokens")
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

func TestUnfinishedTaskQueriesDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(":memory:")
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_MYSQL_DSN is not configured")
				}
				driver = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_POSTGRES_DSN is not configured")
				}
				driver = postgres.Open(dsn)
			}
			db, err := gorm.Open(driver, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "task_polling_test_"}})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			previousDB := DB
			DB = db
			t.Cleanup(func() {
				DB = previousDB
				assert.NoError(t, db.Migrator().DropTable(&Task{}))
				assert.NoError(t, sqlDB.Close())
			})
			require.NoError(t, db.AutoMigrate(&Task{}))
			var version string
			versionQuery := "SELECT version()"
			if dialect == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
			t.Logf("database version: %s", version)
			assert.False(t, HasUnfinishedSyncTasks())

			const cutoff int64 = 1_800_000_000
			for _, status := range []TaskStatus{TaskStatusNotStart, TaskStatusSubmitted, TaskStatusQueued, TaskStatusInProgress, TaskStatusSuccess, TaskStatusFailure} {
				for _, progress := range []string{"99%", "100%"} {
					t.Run(string(status)+"/"+progress, func(t *testing.T) {
						task := &Task{TaskID: "query_candidate", Status: status, Progress: progress, SubmitTime: cutoff - 1}
						insertTask(t, task)
						t.Cleanup(func() { assert.NoError(t, db.Delete(task).Error) })
						unfinished := status != TaskStatusSuccess && status != TaskStatusFailure
						assert.Equal(t, unfinished, HasUnfinishedSyncTasks())
						if unfinished {
							require.Len(t, GetAllUnFinishSyncTasks(1), 1)
							assert.Equal(t, task.ID, GetAllUnFinishSyncTasks(1)[0].ID)
							require.Len(t, GetTimedOutUnfinishedTasks(cutoff, 1), 1)
							assert.Equal(t, task.ID, GetTimedOutUnfinishedTasks(cutoff, 1)[0].ID)
						} else {
							assert.Empty(t, GetAllUnFinishSyncTasks(1))
							assert.Empty(t, GetTimedOutUnfinishedTasks(cutoff, 1))
						}
						require.NoError(t, db.Model(task).Update("submit_time", cutoff).Error)
						assert.Empty(t, GetTimedOutUnfinishedTasks(cutoff, 1), "the timeout cutoff is exclusive")
						assert.Equal(t, unfinished, HasUnfinishedSyncTasks())
					})
				}
			}
		})
	}
}

func TestGetTaskForProtocolObservationScopesOwnerAndPlatform(t *testing.T) {
	truncateTables(t)
	task := &Task{
		TaskID:   "task_protocol_scope",
		UserId:   7,
		Platform: "plugin-a",
		Status:   TaskStatusInProgress,
	}
	insertTask(t, task)

	got, exists, err := GetTaskForProtocolObservation(context.Background(), 7, "plugin-a", task.TaskID)
	require.NoError(t, err)
	require.True(t, exists)
	assert.Equal(t, task.ID, got.ID)

	for _, query := range []struct {
		userID   int
		platform string
	}{
		{userID: 8, platform: "plugin-a"},
		{userID: 7, platform: "plugin-b"},
	} {
		got, exists, err = GetTaskForProtocolObservation(context.Background(), query.userID, constant.TaskPlatform(query.platform), task.TaskID)
		require.NoError(t, err)
		assert.False(t, exists)
		assert.Nil(t, got)
	}

	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	_, _, err = GetTaskForProtocolObservation(cancelled, 7, "plugin-a", task.TaskID)
	require.ErrorIs(t, err, context.Canceled)
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

func TestSnapshotEqual_PluginStateAndPollFailures(t *testing.T) {
	base := taskSnapshot{
		Status:       TaskStatusInProgress,
		PluginState:  json.RawMessage(`{"req_key":"a"}`),
		PollFailures: 2,
	}
	assert.True(t, base.Equal(taskSnapshot{
		Status:       TaskStatusInProgress,
		PluginState:  json.RawMessage(`{"req_key":"a"}`),
		PollFailures: 2,
	}))
	assert.False(t, base.Equal(taskSnapshot{
		Status:       TaskStatusInProgress,
		PluginState:  json.RawMessage(`{"req_key":"b"}`),
		PollFailures: 2,
	}))
	assert.False(t, base.Equal(taskSnapshot{
		Status:       TaskStatusInProgress,
		PluginState:  json.RawMessage(`{"req_key":"a"}`),
		PollFailures: 3,
	}))
}

func TestSnapshot_Roundtrip(t *testing.T) {
	task := &Task{
		Status:     TaskStatusInProgress,
		Progress:   "42%",
		StartTime:  1234,
		FinishTime: 5678,
		FailReason: "timeout",
		PrivateData: TaskPrivateData{
			ResultURL:    "https://example.com/result.mp4",
			PluginState:  json.RawMessage(`{"req_key":"keep"}`),
			PollFailures: 3,
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
	assert.Equal(t, task.PrivateData.PluginState, snap.PluginState)
	assert.Equal(t, task.PrivateData.PollFailures, snap.PollFailures)
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

	for i := range goroutines {
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

func TestUpdateWithStatus_PersistsPluginStateAndPollFailures(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID: "task_cas_plugin_state",
		Status: TaskStatusInProgress,
		Data:   json.RawMessage(`{}`),
		PrivateData: TaskPrivateData{
			PluginState:  json.RawMessage(`{"req_key":"old"}`),
			PollFailures: 1,
		},
	}
	insertTask(t, task)

	task.PrivateData.PluginState = json.RawMessage(`{"req_key":"new"}`)
	task.PrivateData.PollFailures = 4
	won, err := task.UpdateWithStatus(TaskStatusInProgress)
	require.NoError(t, err)
	require.True(t, won)

	var reloaded Task
	require.NoError(t, DB.First(&reloaded, task.ID).Error)
	assert.EqualValues(t, TaskStatusInProgress, reloaded.Status)
	assert.JSONEq(t, `{"req_key":"new"}`, string(reloaded.PrivateData.PluginState))
	assert.Equal(t, 4, reloaded.PrivateData.PollFailures)
}
