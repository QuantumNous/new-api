package model

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func iqTestDB(t *testing.T) {
	t.Helper()
	previous := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&IQConfig{}, &IQBatch{}, &IQAttempt{}, &IQResult{}, &SystemTask{}, &SystemTaskLock{}))
	t.Cleanup(func() { DB = previous; _ = sqlDB.Close() })
}
func TestIQScheduleAndValidation(t *testing.T) {
	now := time.Date(2026, 11, 9, 15, 59, 0, 0, time.UTC) // Beijing 23:59
	c := defaultIQConfig()
	require.False(t, c.Enabled)
	require.Zero(t, NextIQRun(c, now, 0))
	c.Enabled = true
	c.Targets = []IQTarget{{Group: "g", Models: []string{"m", "m"}}, {Group: "g", Models: []string{"m2"}}}
	require.NoError(t, NormalizeIQConfig(&c))
	require.Len(t, c.Targets, 1)
	require.Len(t, c.Targets[0].Models, 2)
	c.IntervalHours = 2
	require.Equal(t, now.Add(2*time.Hour).Unix(), NextIQRun(c, now, 0))
	anchor := now.Add(-9 * time.Hour).Unix()
	require.Equal(t, now.Add(time.Hour).Unix(), NextIQRun(c, now, anchor))
	c.ScheduleMode = "daily"
	c.DailyTime = "00:00"
	require.Equal(t, now.Add(time.Minute).Unix(), NextIQRun(c, now, 0))
	require.Equal(t, now.Add(24*time.Hour+time.Minute).Unix(), NextIQRun(c, now.Add(time.Minute), 0))
	c.Targets[0].Group = "auto"
	require.Error(t, NormalizeIQConfig(&c))
	c.Targets[0].Group = "g"
	c.Prompt = IQText(strings.Repeat("x", IQMaxPromptBytes+1))
	require.Error(t, NormalizeIQConfig(&c))
	c.Prompt = "valid"
	names := []string{}
	for i := 0; i < IQMaxPairs+1; i++ {
		names = append(names, fmt.Sprintf("model-%d", i))
	}
	c.Targets = []IQTarget{{Group: "g", Models: names}}
	require.Error(t, NormalizeIQConfig(&c))
}
func TestIQPersistenceSingleCheckpointReplacementAndRecovery(t *testing.T) {
	iqTestDB(t)
	cfg, err := GetIQConfig()
	require.NoError(t, err)
	cfg.Targets = []IQTarget{{Group: "g", Models: []string{"m"}}}
	cfg.Prompt = " exact prompt \n"
	cfg, err = SaveIQConfig(*cfg, 1, time.Now())
	require.NoError(t, err)
	_, err = SaveIQConfig(IQConfig{Version: 1, Prompt: cfg.Prompt, Targets: cfg.Targets, ScheduleMode: "interval", IntervalHours: 1, Timezone: "Asia/Shanghai"}, 1, time.Now())
	require.ErrorIs(t, err, ErrIQConflict)
	task, created, err := EnqueueIQBatch(false, time.Now())
	require.NoError(t, err)
	require.True(t, created)
	duplicate, created, err := EnqueueIQBatch(false, time.Now())
	require.NoError(t, err)
	require.False(t, created)
	require.Equal(t, task.TaskID, duplicate.TaskID)
	snapshot, err := GetIQBatch(task.TaskID)
	require.NoError(t, err)
	require.Equal(t, cfg.Prompt, snapshot.Prompt)
	require.NotContains(t, task.Payload, "exact prompt")
	_, claimed, err := ClaimSystemTask(task.ID, SystemTaskTypeIQTest, "r", common.GetTimestamp()+60)
	require.NoError(t, err)
	require.True(t, claimed)
	id := IQPairID("g", "m")
	started, err := StartIQAttempt(task.TaskID, id, "r", common.GetTimestamp())
	require.NoError(t, err)
	require.True(t, started)
	started, err = StartIQAttempt(task.TaskID, id, "r", common.GetTimestamp())
	require.NoError(t, err)
	require.False(t, started)
	r := IQResult{ID: id, Group: "g", Model: "m", TaskID: task.TaskID, ConfigVersion: cfg.Version, Status: "success", Artifact: IQText(strings.Repeat("x", 70<<10)), CompletedAt: common.GetTimestamp()}
	require.NoError(t, CompleteIQAttempt(r, "r"))
	stored, err := GetIQResult(id)
	require.NoError(t, err)
	require.Len(t, stored.Artifact, 70<<10)
	require.NoError(t, FinishSystemTask(task.TaskID, "r", SystemTaskStatusSucceeded, nil, ""))
	next, _, err := EnqueueIQBatch(false, time.Now())
	require.NoError(t, err)
	_, claimed, err = ClaimSystemTask(next.ID, SystemTaskTypeIQTest, "r2", common.GetTimestamp()+60)
	require.NoError(t, err)
	require.True(t, claimed)
	_, err = StartIQAttempt(next.TaskID, id, "r2", common.GetTimestamp())
	require.NoError(t, err)
	require.NoError(t, DB.Model(&SystemTaskLock{}).Where("task_id = ?", next.TaskID).Update("locked_until", common.GetTimestamp()-1).Error)
	require.NoError(t, ExpireStaleSystemTaskLocks(common.GetTimestamp()))
	stored, err = GetIQResult(id)
	require.NoError(t, err)
	require.Equal(t, "interrupted", stored.Status)
	require.Empty(t, stored.Artifact)
	require.ErrorIs(t, CompleteIQAttempt(r, "r"), ErrSystemTaskLockLost)
	attempts, err := GetIQAttempts(next.TaskID)
	require.NoError(t, err)
	require.Equal(t, "interrupted", attempts[0].Status)
	cfg.Targets = []IQTarget{}
	_, err = SaveIQConfig(*cfg, 1, time.Now())
	require.NoError(t, err)
	rows, err := ListIQLatest()
	require.NoError(t, err)
	require.Empty(t, rows)
	oldTask, err := GetSystemTaskByTaskID(task.TaskID)
	require.NoError(t, err)
	require.NotNil(t, oldTask) // artwork cleanup never deletes audit/task traces
}
func TestIQConcurrentBatchAndRunnerClaims(t *testing.T) {
	iqTestDB(t)
	cfg, err := GetIQConfig()
	require.NoError(t, err)
	cfg.Targets = []IQTarget{{Group: "g", Models: []string{"m"}}}
	_, err = SaveIQConfig(*cfg, 1, time.Now())
	require.NoError(t, err)
	type outcome struct {
		task *SystemTask
		won  bool
		err  error
	}
	race := func(action func(int) (*SystemTask, bool, error)) *SystemTask {
		start := make(chan struct{})
		results := make(chan outcome, 2)
		for i := 0; i < 2; i++ {
			go func() {
				<-start
				task, won, err := action(i)
				results <- outcome{task, won, err}
			}()
		}
		close(start)
		winners := 0
		var winner *SystemTask
		for i := 0; i < 2; i++ {
			r := <-results
			require.NoError(t, r.err)
			if r.won {
				winners++
				winner = r.task
			}
		}
		require.Equal(t, 1, winners)
		return winner
	}
	task := race(func(int) (*SystemTask, bool, error) { return EnqueueIQBatch(false, time.Now()) })
	runner := race(func(i int) (*SystemTask, bool, error) {
		return ClaimSystemTask(task.ID, SystemTaskTypeIQTest, fmt.Sprintf("master-%d", i), common.GetTimestamp()+60)
	})
	require.Equal(t, task.TaskID, runner.TaskID)
}

func TestIQDueSlotsSkipOverlapAndManualPreservesCadence(t *testing.T) {
	iqTestDB(t)
	now := time.Now().Truncate(time.Second)
	cfg, err := GetIQConfig()
	require.NoError(t, err)
	cfg.Enabled = true
	cfg.IntervalHours = 2
	cfg.Targets = []IQTarget{{Group: "g", Models: []string{"m"}}}
	cfg, err = SaveIQConfig(*cfg, 1, now)
	require.NoError(t, err)
	task, _, err := EnqueueIQBatch(false, now)
	require.NoError(t, err)
	current, err := GetIQConfig()
	require.NoError(t, err)
	require.Equal(t, cfg.NextRunAt, current.NextRunAt)
	overlap, created, err := EnqueueIQBatch(true, now.Add(9*time.Hour))
	require.NoError(t, err)
	require.False(t, created)
	require.Equal(t, task.TaskID, overlap.TaskID)
	current, err = GetIQConfig()
	require.NoError(t, err)
	require.Equal(t, now.Add(10*time.Hour).Unix(), current.NextRunAt)
	notDue, created, err := EnqueueIQBatch(true, now.Add(9*time.Hour))
	require.NoError(t, err)
	require.False(t, created)
	require.Nil(t, notDue)
	current.Enabled = false
	current, err = SaveIQConfig(*current, 1, now)
	require.NoError(t, err)
	require.Zero(t, current.NextRunAt)
}
