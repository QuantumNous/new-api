package model

import (
	"encoding/json"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type legacyTaskForTaskIDMigration struct {
	ID          int64           `gorm:"primaryKey;autoIncrement"`
	TaskID      string          `gorm:"type:varchar(191)"`
	PrivateData TaskPrivateData `gorm:"column:private_data;type:json"`
	Status      TaskStatus      `gorm:"type:varchar(20)"`
	CreatedAt   int64
	UpdatedAt   int64
}

func (legacyTaskForTaskIDMigration) TableName() string {
	return "tasks"
}

func TestMain(m *testing.M) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic("failed to open test db: " + err.Error())
	}
	DB = db
	LOG_DB = db

	common.UsingSQLite = true
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
		&TaskAcceptedAccountingLedger{},
		&TaskAcceptedAccountingLogLedger{},
		&User{},
		&Token{},
		&Log{},
		&LogRequestSample{},
		&Channel{},
		&Ability{},
		&TopUp{},
		&StripeBonusClaim{},
		&TopUpBonusClaim{},
		&SubscriptionPlan{},
		&SubscriptionOrder{},
		&UserSubscription{},
		&PerfMetric{},
		&QuotaDataToken{},
		&RecallLifecycleEvent{},
		&QuotaLifecycleState{},
		&Asset{},
		&AssetBinding{},
		&AssetUpload{},
	); err != nil {
		panic("failed to migrate: " + err.Error())
	}

	os.Exit(m.Run())
}

func TestMainDBMigrationIncludesAcceptedAccountingLogLedger(t *testing.T) {
	oldDB := DB
	oldLogDB := LOG_DB
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	LOG_DB = db
	defer func() {
		DB = oldDB
		LOG_DB = oldLogDB
	}()
	require.NoError(t, migrateDBFast())
	require.True(t, DB.Migrator().HasTable(&TaskAcceptedAccountingLogLedger{}), "default LOG_DB=DB startup must migrate accepted log ledger in main DB")
	require.NoError(t, DB.Create(&TaskAcceptedAccountingLogLedger{TaskID: "task_log_ledger_migration", Step: TaskAcceptedAccountingStepLogStats, CreatedAt: 1, UpdatedAt: 1}).Error)
}

func truncateTables(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		DB.Exec("DELETE FROM tasks")
		DB.Exec("DELETE FROM users")
		DB.Exec("DELETE FROM tokens")
		DB.Exec("DELETE FROM logs")
		DB.Exec("DELETE FROM log_request_samples")
		DB.Exec("DELETE FROM channels")
		DB.Exec("DELETE FROM abilities")
		DB.Exec("DELETE FROM top_ups")
		DB.Exec("DELETE FROM stripe_bonus_claims")
		DB.Exec("DELETE FROM top_up_bonus_claims")
		DB.Exec("DELETE FROM subscription_orders")
		DB.Exec("DELETE FROM subscription_plans")
		DB.Exec("DELETE FROM user_subscriptions")
		DB.Exec("DELETE FROM perf_metrics")
		DB.Exec("DELETE FROM quota_data_tokens")
		DB.Exec("DELETE FROM recall_lifecycle_events")
		DB.Exec("DELETE FROM quota_lifecycle_states")
		DB.Exec("DELETE FROM asset_uploads")
		DB.Exec("DELETE FROM asset_bindings")
		DB.Exec("DELETE FROM assets")
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

func TestTaskPrivateDataVideoResultJSONRoundtrip(t *testing.T) {
	privateData := TaskPrivateData{
		ResultURL:         "https://example.com/result.mp4",
		SpecificChannelId: 120,
		VideoResult: &VideoResult{
			Bucket:      "video-results",
			Object:      "tasks/task_1/result.mp4",
			Generation:  123456789,
			ContentType: "video/mp4",
			Size:        42 << 20,
			StoredAt:    1_700_000_000,
			ExpiresAt:   1_700_086_400,
		},
	}

	value, err := privateData.Value()
	require.NoError(t, err)
	require.JSONEq(t, `{
		"result_url":"https://example.com/result.mp4",
		"specific_channel_id":120,
		"video_result":{
			"bucket":"video-results",
			"object":"tasks/task_1/result.mp4",
			"generation":123456789,
			"content_type":"video/mp4",
			"size":44040192,
			"stored_at":1700000000,
			"expires_at":1700086400
		}
	}`, string(value.([]byte)))

	var roundtripped TaskPrivateData
	require.NoError(t, roundtripped.Scan(value))
	require.Equal(t, privateData, roundtripped)
}

func TestTaskPrivateDataGrokVideoResultJSONRoundtrip(t *testing.T) {
	privateData := TaskPrivateData{
		ResultURL: "https://flatkey.example/v1/videos/task_public/content",
		GrokVideoResult: &GrokSubscriptionVideoResult{
			URL:         "https://vidgen.x.ai/private.mp4?token=secret",
			Duration:    6.5,
			Resolution:  "1080p",
			RefreshedAt: 1780000000,
		},
	}

	value, err := privateData.Value()
	require.NoError(t, err)
	require.JSONEq(t, `{
		"result_url":"https://flatkey.example/v1/videos/task_public/content",
		"grok_video_result":{
			"url":"https://vidgen.x.ai/private.mp4?token=secret",
			"duration":6.5,
			"resolution":"1080p",
			"refreshed_at":1780000000
		}
	}`, string(value.([]byte)))

	var roundtripped TaskPrivateData
	require.NoError(t, roundtripped.Scan(value))
	require.Equal(t, privateData, roundtripped)
}

func TestUpdateGrokSubscriptionVideoResultCASGuardsAndPreservesPrivateFields(t *testing.T) {
	truncateTables(t)

	prior := &GrokSubscriptionVideoResult{URL: "https://old.example/video.mp4", Duration: 4, Resolution: "720p", RefreshedAt: 1}
	next := &GrokSubscriptionVideoResult{URL: "https://new.example/video.mp4", Duration: 6, Resolution: "1080p", RefreshedAt: 2}
	task := &Task{
		TaskID:    "task_grok_video_cas",
		Status:    TaskStatusSuccess,
		Platform:  constant.TaskPlatform("113"),
		ChannelId: 11301,
		Quota:     42,
		PrivateData: TaskPrivateData{
			UpstreamTaskID:  "upstream-grok",
			ResultURL:       "https://flatkey.example/v1/videos/task_grok_video_cas/content",
			GrokVideoResult: prior,
			BillingSource:   "subscription",
			SubscriptionId:  77,
			TokenId:         88,
			VideoResult:     &VideoResult{Bucket: "archive", Object: "kept", Generation: 9},
			BillingContext:  &TaskBillingContext{OriginModelName: "grok-imagine", OtherRatios: map[string]float64{"duration": 2}},
			TotalTokens:     11,
		},
		Data: json.RawMessage(`{"redacted":true}`),
	}
	insertTask(t, task)

	won, err := UpdateGrokSubscriptionVideoResultCAS("task_grok_video_cas", "upstream-grok", prior, next, 99)
	require.NoError(t, err)
	require.True(t, won)

	var reloaded Task
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&reloaded).Error)
	require.Equal(t, next, reloaded.PrivateData.GrokVideoResult)
	require.Equal(t, "subscription", reloaded.PrivateData.BillingSource)
	require.Equal(t, 77, reloaded.PrivateData.SubscriptionId)
	require.Equal(t, 88, reloaded.PrivateData.TokenId)
	require.Equal(t, &VideoResult{Bucket: "archive", Object: "kept", Generation: 9}, reloaded.PrivateData.VideoResult)
	require.Equal(t, map[string]float64{"duration": 2}, reloaded.PrivateData.BillingContext.OtherRatios)
	require.Equal(t, 42, reloaded.Quota)

	stale := &GrokSubscriptionVideoResult{URL: "https://stale.example/video.mp4", RefreshedAt: 3}
	won, err = UpdateGrokSubscriptionVideoResultCAS("task_grok_video_cas", "upstream-grok", prior, stale, 100)
	require.NoError(t, err)
	require.False(t, won)
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&reloaded).Error)
	require.Equal(t, next, reloaded.PrivateData.GrokVideoResult)
}

func TestUpdateGrokSubscriptionVideoResultCASDoesNotOverwriteConcurrentWinner(t *testing.T) {
	truncateTables(t)

	prior := &GrokSubscriptionVideoResult{URL: "https://old.example/video.mp4", RefreshedAt: 1}
	winner := &GrokSubscriptionVideoResult{URL: "https://winner.example/video.mp4", RefreshedAt: 2}
	loser := &GrokSubscriptionVideoResult{URL: "https://loser.example/video.mp4", RefreshedAt: 3}
	task := &Task{
		TaskID:    "task_grok_video_cas_race",
		Status:    TaskStatusSuccess,
		Platform:  constant.TaskPlatform("113"),
		ChannelId: 11301,
		PrivateData: TaskPrivateData{
			UpstreamTaskID:  "upstream-grok-race",
			ResultURL:       "https://flatkey.example/v1/videos/task_grok_video_cas_race/content",
			GrokVideoResult: prior,
			BillingSource:   "subscription",
			SubscriptionId:  77,
			VideoResult:     &VideoResult{Bucket: "archive", Object: "kept", Generation: 9},
			TotalTokens:     11,
		},
	}
	insertTask(t, task)

	winnerPrivateData := task.PrivateData
	winnerPrivateData.GrokVideoResult = winner
	callbackName := "task9:grok_video_result_cas_race"
	fired := false
	require.NoError(t, DB.Callback().Update().Before("gorm:update").Register(callbackName, func(db *gorm.DB) {
		if fired || db.Statement == nil || db.Statement.Schema == nil || db.Statement.Schema.Table != "tasks" {
			return
		}
		fired = true
		require.NoError(t, db.Session(&gorm.Session{SkipHooks: true}).Model(&Task{}).
			Where("task_id = ?", task.TaskID).
			Update("private_data", winnerPrivateData).Error)
	}))
	t.Cleanup(func() {
		require.NoError(t, DB.Callback().Update().Remove(callbackName))
	})

	won, err := UpdateGrokSubscriptionVideoResultCAS(task.TaskID, "upstream-grok-race", prior, loser, 99)
	require.NoError(t, err)
	require.False(t, won)
	require.True(t, fired)

	var reloaded Task
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&reloaded).Error)
	require.Equal(t, winner, reloaded.PrivateData.GrokVideoResult)
	require.Equal(t, "subscription", reloaded.PrivateData.BillingSource)
	require.Equal(t, 77, reloaded.PrivateData.SubscriptionId)
	require.Equal(t, &VideoResult{Bucket: "archive", Object: "kept", Generation: 9}, reloaded.PrivateData.VideoResult)
	require.Equal(t, 11, reloaded.PrivateData.TotalTokens)
}

func TestTaskPrivateDataVideoResultZeroValueSerializesStableShape(t *testing.T) {
	privateData := TaskPrivateData{
		VideoResult: &VideoResult{},
	}

	value, err := privateData.Value()
	require.NoError(t, err)
	require.JSONEq(t, `{
		"video_result":{
			"bucket":"",
			"object":"",
			"generation":0,
			"content_type":"",
			"size":0,
			"stored_at":0,
			"expires_at":0
		}
	}`, string(value.([]byte)))
}

func TestTaskPrivateDataVideoResultSnapshotAndCASPreserveMetadata(t *testing.T) {
	truncateTables(t)

	metadata := &VideoResult{
		Bucket:      "video-results",
		Object:      "tasks/task_cas_video_result/result.mp4",
		Generation:  987654321,
		ContentType: "video/mp4",
		Size:        1234,
		StoredAt:    1_700_000_001,
		ExpiresAt:   1_700_086_401,
	}
	task := &Task{
		TaskID:   "task_cas_video_result",
		Status:   TaskStatusInProgress,
		Progress: "50%",
		PrivateData: TaskPrivateData{
			ResultURL:   "https://example.com/original.mp4",
			VideoResult: metadata,
		},
		Data: json.RawMessage(`{}`),
	}
	insertTask(t, task)

	snap := task.Snapshot()
	require.Equal(t, metadata, snap.VideoResult)
	require.NotSame(t, metadata, snap.VideoResult)

	task.Status = TaskStatusSuccess
	task.Progress = "100%"
	won, err := task.UpdateWithStatus(TaskStatusInProgress)
	require.NoError(t, err)
	require.True(t, won)

	var reloaded Task
	require.NoError(t, DB.First(&reloaded, task.ID).Error)
	require.Equal(t, metadata, reloaded.PrivateData.VideoResult)
	require.True(t, task.Snapshot().Equal(reloaded.Snapshot()))
}

func TestTaskPrivateDataVideoResultSnapshotDetectsMetadataMutationAfterSnapshot(t *testing.T) {
	task := &Task{
		Status:   TaskStatusInProgress,
		Progress: "50%",
		PrivateData: TaskPrivateData{
			VideoResult: &VideoResult{
				Bucket:      "video-results",
				Object:      "tasks/task_snapshot_mutation/result.mp4",
				Generation:  1,
				ContentType: "video/mp4",
				Size:        100,
				StoredAt:    200,
				ExpiresAt:   300,
			},
		},
		Data: json.RawMessage(`{}`),
	}

	before := task.Snapshot()
	task.PrivateData.VideoResult.Generation = 2
	after := task.Snapshot()

	require.False(t, before.Equal(after))
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

func TestTaskIDUniqueCAS(t *testing.T) {
	truncateTables(t)

	insertTask(t, &Task{
		TaskID: "task_unique",
		Status: TaskStatusQueued,
		Data:   json.RawMessage(`{}`),
	})

	err := DB.Create(&Task{
		TaskID: "task_unique",
		Status: TaskStatusQueued,
		Data:   json.RawMessage(`{}`),
	}).Error
	require.Error(t, err, "task_id must be unique across router nodes")
}

func TestTaskIDMigrationBackfillsLegacyDuplicatesAndEmptyValues(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&legacyTaskForTaskIDMigration{}))
	require.False(t, db.Migrator().HasIndex(&Task{}, "idx_tasks_task_id_unique"))

	oldTaskIDMigrationPageSize := taskIDMigrationPageSize
	taskIDMigrationPageSize = 3
	t.Cleanup(func() {
		taskIDMigrationPageSize = oldTaskIDMigrationPageSize
	})

	legacyTasks := []legacyTaskForTaskIDMigration{
		{TaskID: "upstream-duplicate", Status: TaskStatusSubmitted},
		{TaskID: "upstream-duplicate", Status: TaskStatusSubmitted},
		{
			TaskID: "upstream-duplicate",
			PrivateData: TaskPrivateData{
				UpstreamTaskID: "already-preserved",
			},
			Status: TaskStatusSubmitted,
		},
		{TaskID: "", Status: TaskStatusQueued},
		{TaskID: "upstream-unique", Status: TaskStatusSubmitted},
	}
	for i := 0; i < taskIDMigrationPageSize+2; i++ {
		legacyTasks = append(legacyTasks, legacyTaskForTaskIDMigration{
			TaskID: "",
			Status: TaskStatusQueued,
		})
	}
	for i := 0; i < taskIDMigrationPageSize+3; i++ {
		legacyTasks = append(legacyTasks, legacyTaskForTaskIDMigration{
			TaskID: "upstream-paged-duplicate",
			Status: TaskStatusSubmitted,
		})
	}
	require.NoError(t, db.Create(&legacyTasks).Error)

	oldDB := DB
	DB = db
	t.Cleanup(func() {
		DB = oldDB
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			_ = sqlDB.Close()
		}
	})

	require.NoError(t, backfillTaskIDsBeforeUniqueIndex())

	var migrated []legacyTaskForTaskIDMigration
	require.NoError(t, db.Order("id ASC").Find(&migrated).Error)
	require.Len(t, migrated, len(legacyTasks))

	seen := make(map[string]struct{}, len(migrated))
	for _, task := range migrated {
		require.NotEmpty(t, task.TaskID)
		_, duplicate := seen[task.TaskID]
		require.False(t, duplicate, "backfilled task IDs must be unique")
		seen[task.TaskID] = struct{}{}
	}
	require.Equal(t, "upstream-duplicate", migrated[0].TaskID, "the first duplicate keeps its public ID")
	require.True(t, strings.HasPrefix(migrated[1].TaskID, "task_"))
	require.Equal(t, "upstream-duplicate", migrated[1].PrivateData.UpstreamTaskID)
	require.True(t, strings.HasPrefix(migrated[2].TaskID, "task_"))
	require.Equal(t, "already-preserved", migrated[2].PrivateData.UpstreamTaskID, "existing upstream identity must not be overwritten")
	require.True(t, strings.HasPrefix(migrated[3].TaskID, "task_"))
	require.Empty(t, migrated[3].PrivateData.UpstreamTaskID, "an empty legacy ID has no upstream identity to preserve")
	require.Equal(t, "upstream-unique", migrated[4].TaskID)
	require.Empty(t, migrated[4].PrivateData.UpstreamTaskID)
	require.Equal(t, "upstream-paged-duplicate", migrated[10].TaskID, "the first row from the paged duplicate group keeps its public ID")
	for i := 5; i <= 9; i++ {
		require.True(t, strings.HasPrefix(migrated[i].TaskID, "task_"))
		require.Empty(t, migrated[i].PrivateData.UpstreamTaskID)
	}
	for i := 11; i < len(migrated); i++ {
		require.True(t, strings.HasPrefix(migrated[i].TaskID, "task_"))
		require.Equal(t, "upstream-paged-duplicate", migrated[i].PrivateData.UpstreamTaskID)
	}

	firstMigration := append([]legacyTaskForTaskIDMigration(nil), migrated...)
	require.NoError(t, backfillTaskIDsBeforeUniqueIndex(), "the preflight must be idempotent")
	migrated = nil
	require.NoError(t, db.Order("id ASC").Find(&migrated).Error)
	require.Equal(t, firstMigration, migrated)

	require.NoError(t, db.AutoMigrate(&Task{}))
	require.True(t, db.Migrator().HasIndex(&Task{}, "idx_tasks_task_id_unique"))
	require.Error(t, db.Create(&Task{
		TaskID: "upstream-duplicate",
		Status: TaskStatusQueued,
		Data:   json.RawMessage(`{}`),
	}).Error)
}

func TestTaskPreparationLeaseTakeover(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID:                   "task_prepare_lease",
		Status:                   TaskStatusQueued,
		Progress:                 "0%",
		NormalizedRequestPayload: json.RawMessage(`{"model":"seedance"}`),
		Data:                     json.RawMessage(`{}`),
	}
	insertTask(t, task)

	claimed, err := ClaimTaskPreparationLease(task.TaskID, "node-a", 0, 100, 160)
	require.NoError(t, err)
	require.True(t, claimed)

	claimed, err = ClaimTaskPreparationLease(task.TaskID, "node-b", 0, 120, 180)
	require.NoError(t, err)
	require.False(t, claimed, "fresh foreign preparation lease must not be stolen")

	claimed, err = ClaimTaskPreparationLease(task.TaskID, "node-a", 1, 130, 190)
	require.NoError(t, err)
	require.False(t, claimed, "a fresh preparation lease must not be claimed again even by the same owner")

	claimed, err = ClaimTaskPreparationLease(task.TaskID, "node-b", 0, 191, 250)
	require.NoError(t, err)
	require.False(t, claimed, "a stale scan must not claim a newer expired preparation generation")

	claimed, err = ClaimTaskPreparationLease(task.TaskID, "node-b", 1, 191, 250)
	require.NoError(t, err)
	require.True(t, claimed, "expired preparation lease can be taken over")

	fenced, err := MarkQueuedTaskSubmitting(task.TaskID, "node-b", 2, 192, 131, constant.TaskPlatform("107"), 246)
	require.NoError(t, err)
	require.True(t, fenced)

	claimed, err = ClaimTaskPreparationLease(task.TaskID, "node-c", 2, 251, 310)
	require.NoError(t, err)
	require.False(t, claimed, "a provider submit fence must never be taken over automatically")

	var stored Task
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.Equal(t, "node-b", stored.PreparationLeaseOwner)
	require.EqualValues(t, 250, stored.PreparationLeaseExpiresAt)
	require.EqualValues(t, 2, stored.PreparationAttemptCount)
	require.Equal(t, TaskPreparationStatusSubmitting, stored.PreparationStatus)
	require.Equal(t, 131, stored.ChannelId)
	require.Equal(t, constant.TaskPlatform("107"), stored.Platform)
	require.Equal(t, 246, stored.AcceptedAccountingActualQuota)
	require.JSONEq(t, `{"model":"seedance"}`, string(stored.NormalizedRequestPayload))
}

func TestGetQueuedAssetPreparationTasksHonorsRetrySchedule(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID:                    "task_prepare_retry_schedule",
		Status:                    TaskStatusQueued,
		PreparationStatus:         TaskPreparationStatusPreparingAssets,
		PreparationLeaseExpiresAt: 121,
		NormalizedRequestPayload:  json.RawMessage(`{"model":"seedance"}`),
		Data:                      json.RawMessage(`{}`),
	}
	insertTask(t, task)

	tasks, err := GetQueuedAssetPreparationTasks(120, 10)
	require.NoError(t, err)
	require.Empty(t, tasks, "a task scheduled for a later asset check must not be claimed early")

	tasks, err = GetQueuedAssetPreparationTasks(121, 10)
	require.NoError(t, err)
	require.Len(t, tasks, 1)
	require.Equal(t, task.TaskID, tasks[0].TaskID)
}

func TestRequeueQueuedTaskForAssetPreparationUsesLeaseFence(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID:                    "task_prepare_requeue",
		Status:                    TaskStatusQueued,
		PreparationStatus:         TaskPreparationStatusPreparing,
		PreparationLeaseOwner:     "node-a",
		PreparationLeaseExpiresAt: 160,
		NormalizedRequestPayload:  json.RawMessage(`{"model":"seedance"}`),
		Data:                      json.RawMessage(`{}`),
	}
	insertTask(t, task)

	updated, err := RequeueQueuedTaskForAssetPreparation(task.TaskID, "node-b", 160, 120, 121)
	require.NoError(t, err)
	require.False(t, updated, "a non-owner must not reschedule asset preparation")

	updated, err = RequeueQueuedTaskForAssetPreparation(task.TaskID, "node-a", 160, 120, 121)
	require.NoError(t, err)
	require.True(t, updated)

	var stored Task
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, TaskStatusQueued, stored.Status)
	require.Equal(t, TaskPreparationStatusPreparingAssets, stored.PreparationStatus)
	require.Empty(t, stored.PreparationLeaseOwner)
	require.EqualValues(t, 121, stored.PreparationLeaseExpiresAt)

	claimed, err := ClaimTaskPreparationLease(task.TaskID, "node-b", stored.PreparationAttemptCount, 120, 180)
	require.NoError(t, err)
	require.False(t, claimed, "the task must not be claimed before its next asset check")

	claimed, err = ClaimTaskPreparationLease(task.TaskID, "node-b", stored.PreparationAttemptCount, 121, 180)
	require.NoError(t, err)
	require.True(t, claimed, "the task becomes claimable when the next asset check is due")
}

func TestTaskQueuedTransitionCAS(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID:                    "task_queued_transition",
		Status:                    TaskStatusQueued,
		Progress:                  "0%",
		PreparationStatus:         TaskPreparationStatusPreparing,
		PreparationLeaseOwner:     "node-a",
		PreparationLeaseExpiresAt: 160,
		Data:                      json.RawMessage(`{}`),
	}
	insertTask(t, task)

	updated, err := MarkQueuedTaskSubmitted(task.TaskID, "node-b", 160, 120, 130)
	require.NoError(t, err)
	require.False(t, updated, "non-owner must not submit a queued task")

	updated, err = MarkQueuedTaskSubmitted(task.TaskID, "node-a", 160, 120, 130)
	require.NoError(t, err)
	require.True(t, updated)

	updated, err = MarkQueuedTaskFailed(task.TaskID, "node-a", 160, "late failure", 121)
	require.NoError(t, err)
	require.False(t, updated, "submitted task must not regress to failure")

	var stored Task
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, TaskStatusSubmitted, stored.Status)
	require.Equal(t, TaskPreparationStatusReady, stored.PreparationStatus)
	require.EqualValues(t, 130, stored.SubmitTime)
	require.Empty(t, stored.PreparationLeaseOwner)
	require.Zero(t, stored.PreparationLeaseExpiresAt)
}

func TestTaskQueuedFailureCAS(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID:                    "task_queued_failure",
		Status:                    TaskStatusQueued,
		Progress:                  "0%",
		PreparationStatus:         TaskPreparationStatusPreparing,
		PreparationLeaseOwner:     "node-a",
		PreparationLeaseExpiresAt: 160,
		Data:                      json.RawMessage(`{}`),
	}
	insertTask(t, task)

	updated, err := MarkQueuedTaskFailed(task.TaskID, "node-b", 160, "wrong owner", 120)
	require.NoError(t, err)
	require.False(t, updated, "non-owner must not fail a queued task")

	updated, err = MarkQueuedTaskFailed(task.TaskID, "node-a", 160, "prepare failed", 130)
	require.NoError(t, err)
	require.True(t, updated)

	updated, err = MarkQueuedTaskSubmitted(task.TaskID, "node-a", 160, 131, 132)
	require.NoError(t, err)
	require.False(t, updated, "failed task must not regress to submitted")

	var stored Task
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, TaskStatusFailure, stored.Status)
	require.Equal(t, TaskPreparationStatusFailed, stored.PreparationStatus)
	require.Equal(t, "prepare failed", stored.FailReason)
	require.EqualValues(t, 130, stored.FinishTime)
	require.Empty(t, stored.PreparationLeaseOwner)
	require.Zero(t, stored.PreparationLeaseExpiresAt)
}

func TestTaskPreparationLeaseGenerationFencesSubmittedCompletion(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID:                   "task_prepare_submit_generation",
		Status:                   TaskStatusQueued,
		PreparationStatus:        TaskPreparationStatusPending,
		NormalizedRequestPayload: json.RawMessage(`{"model":"seedance"}`),
		Data:                     json.RawMessage(`{}`),
	}
	insertTask(t, task)

	claimed, err := ClaimTaskPreparationLease(task.TaskID, "node-a", 0, 100, 160)
	require.NoError(t, err)
	require.True(t, claimed)

	claimed, err = ClaimTaskPreparationLease(task.TaskID, "node-a", 1, 161, 220)
	require.NoError(t, err)
	require.True(t, claimed)

	updated, err := MarkQueuedTaskSubmitted(task.TaskID, "node-a", 160, 170, 180)
	require.NoError(t, err)
	require.False(t, updated, "a stale same-owner lease generation must not submit")

	updated, err = MarkQueuedTaskSubmitted(task.TaskID, "node-a", 220, 170, 180)
	require.NoError(t, err)
	require.True(t, updated, "the latest lease generation may submit")
}

func TestTaskPreparationLeaseGenerationFencesFailureCompletion(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID:                   "task_prepare_failure_generation",
		Status:                   TaskStatusQueued,
		PreparationStatus:        TaskPreparationStatusPending,
		NormalizedRequestPayload: json.RawMessage(`{"model":"seedance"}`),
		Data:                     json.RawMessage(`{}`),
	}
	insertTask(t, task)

	claimed, err := ClaimTaskPreparationLease(task.TaskID, "node-a", 0, 100, 160)
	require.NoError(t, err)
	require.True(t, claimed)

	claimed, err = ClaimTaskPreparationLease(task.TaskID, "node-a", 1, 161, 220)
	require.NoError(t, err)
	require.True(t, claimed)

	updated, err := MarkQueuedTaskFailed(task.TaskID, "node-a", 160, "stale failure", 170)
	require.NoError(t, err)
	require.False(t, updated, "a stale same-owner lease generation must not fail the task")

	updated, err = MarkQueuedTaskFailed(task.TaskID, "node-a", 220, "latest failure", 170)
	require.NoError(t, err)
	require.True(t, updated, "the latest lease generation may fail the task")

	var stored Task
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.Equal(t, "latest failure", stored.FailReason)
}

func TestTaskSubmissionUnknownOutcomeUsesPreparationAttemptGenerationFence(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID:                    "task_prepare_unknown_outcome",
		Status:                    TaskStatusQueued,
		PreparationStatus:         TaskPreparationStatusPreparing,
		PreparationLeaseOwner:     "node-a",
		PreparationLeaseExpiresAt: 220,
		PreparationAttemptCount:   2,
		Quota:                     100,
		Data:                      json.RawMessage(`{}`),
		PrivateData:               TaskPrivateData{TokenId: 11},
	}
	insertTask(t, task)

	updated, err := MarkQueuedTaskSubmissionUnknown(task.TaskID, 1, 130, 130, 131, constant.TaskPlatform("107"), 246, "upstream-stale", []byte(`{"id":"upstream-stale"}`), nil, 130, 500)
	require.NoError(t, err)
	require.False(t, updated, "a stale preparation generation must not quarantine a newer attempt")

	updated, err = MarkQueuedTaskSubmissionUnknown(task.TaskID, 2, 130, 130, 132, constant.TaskPlatform("108"), 246, "upstream-unknown", []byte(`{"id":"upstream-unknown"}`), nil, 130, 500)
	require.NoError(t, err)
	require.True(t, updated)

	var stored Task
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, TaskStatusUnknown, stored.Status)
	require.Equal(t, TaskPreparationStatusUnknownOutcome, stored.PreparationStatus)
	require.Empty(t, stored.PreparationLeaseOwner)
	require.Zero(t, stored.PreparationLeaseExpiresAt)
	require.Equal(t, 132, stored.ChannelId)
	require.Equal(t, constant.TaskPlatform("108"), stored.Platform)
	require.Equal(t, 100, stored.Quota)
	require.Equal(t, 100, stored.AcceptedAccountingReservedQuota)
	require.Equal(t, 246, stored.AcceptedAccountingActualQuota)
	require.Equal(t, "upstream-unknown", stored.PrivateData.UpstreamTaskID)
	require.Equal(t, 11, stored.PrivateData.TokenId)
	require.JSONEq(t, `{"id":"upstream-unknown"}`, string(stored.Data))

	lateAccepted, err := MarkQueuedTaskAccepted(task.TaskID, "node-a", 220, 131, 131, 131, constant.TaskPlatform("107"), 100, "upstream-late", []byte(`{"id":"upstream-late"}`), nil, 131, 500)
	require.NoError(t, err)
	require.False(t, lateAccepted, "a quarantined task must not regress to normal acceptance")
}
