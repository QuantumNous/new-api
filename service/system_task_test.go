package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func withModelCostFXServiceDialect(t *testing.T) {
	t.Helper()
	dialect := os.Getenv("FX_TEST_DIALECT")
	if dialect == "" {
		dialect = "sqlite"
	}
	var db *gorm.DB
	var err error
	previousDB := model.DB
	previousType := common.MainDatabaseType()
	ownsDB := false
	// Keep one database per process/dialect so the in-memory FX cache and the
	// optimistic-lock row remain aligned across -count iterations.
	switch dialect {
	case "sqlite":
		db = model.DB
		common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	case "mysql":
		dsn := os.Getenv("TEST_MYSQL_DSN")
		require.NotEmpty(t, dsn, "TEST_MYSQL_DSN is required for FX_TEST_DIALECT=mysql")
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
		common.SetMainDatabaseType(common.DatabaseTypeMySQL)
		ownsDB = true
	case "postgres":
		dsn := os.Getenv("TEST_POSTGRES_DSN")
		require.NotEmpty(t, dsn, "TEST_POSTGRES_DSN is required for FX_TEST_DIALECT=postgres")
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		common.SetMainDatabaseType(common.DatabaseTypePostgreSQL)
		ownsDB = true
	default:
		t.Fatalf("unsupported FX_TEST_DIALECT %q", dialect)
	}
	require.NoError(t, err)
	model.DB = db
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousType)
		if ownsDB {
			sqlDB, closeErr := db.DB()
			if closeErr == nil {
				_ = sqlDB.Close()
			}
		}
	})
	require.NoError(t, db.AutoMigrate(&model.ModelCostFXRow{}, &model.SystemTask{}, &model.SystemTaskLock{}))
	t.Logf("FX_TEST_DIALECT=%s", dialect)
}

// withSystemTaskRegistry swaps the package registry for the given handlers for
// the duration of a test and restores the original registry afterward.
func withSystemTaskRegistry(t *testing.T, handlers ...SystemTaskHandler) {
	t.Helper()
	systemTaskHandlersMu.Lock()
	saved := systemTaskHandlers
	systemTaskHandlers = map[string]SystemTaskHandler{}
	for _, h := range handlers {
		systemTaskHandlers[h.Type()] = h
	}
	systemTaskHandlersMu.Unlock()
	t.Cleanup(func() {
		systemTaskHandlersMu.Lock()
		systemTaskHandlers = saved
		systemTaskHandlersMu.Unlock()
	})
}

func seedModelCostFXServiceTest(t *testing.T) model.ModelCostFXSnapshot {
	t.Helper()
	require.NoError(t, model.DB.AutoMigrate(&model.ModelCostFXRow{}))
	// Synchronize the process cache with the dialect-specific row left by an
	// earlier count iteration before deriving the next optimistic-lock version.
	_ = model.LoadModelCostFX(context.Background(), modelCostFXSource)
	var row model.ModelCostFXRow
	err := model.DB.Where("source = ?", modelCostFXSource).First(&row).Error
	require.True(t, err == nil || errors.Is(err, gorm.ErrRecordNotFound))
	effective := row.EffectiveAt + 1
	if effective <= 1 {
		effective = 100
	}
	fetched := time.Now().Unix() - 60
	snapshot := model.ModelCostFXSnapshot{Source: modelCostFXSource, EffectiveAt: effective, FetchedAt: fetched, Rates: map[string]float64{"USD": 90}}
	require.NoError(t, model.SaveModelCostFX(context.Background(), snapshot, row.Version))
	loaded, err := model.CurrentModelCostFX(modelCostFXSource)
	require.NoError(t, err)
	return loaded
}

func TestModelCostFXRefreshNormalizesUSDNominal(t *testing.T) {
	withModelCostFXServiceDialect(t)
	truncate(t)
	seed := seedModelCostFXServiceTest(t)
	publicationDate := time.Unix(seed.EffectiveAt+1, 0).UTC().Format(time.RFC3339)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"Date":"%s","Valute":{"USD":{"CharCode":"USD","Value":900,"Nominal":10}}}`, publicationDate)
	}))
	defer server.Close()
	previousEndpoint := modelCostFXEndpoint
	modelCostFXEndpoint = server.URL
	t.Cleanup(func() { modelCostFXEndpoint = previousEndpoint })

	result, err := refreshModelCostFX(context.Background())
	require.NoError(t, err)
	assert.GreaterOrEqual(t, result.Version, int64(1))
	snapshot, err := model.CurrentModelCostFX(modelCostFXSource)
	require.NoError(t, err)
	assert.Equal(t, 90.0, snapshot.Rates["USD"])
	second, err := refreshModelCostFX(context.Background())
	require.NoError(t, err)
	assert.Equal(t, result.Version, second.Version)
	assert.Equal(t, result.FetchedAt, second.FetchedAt)
}

func TestModelCostFXRefreshFailureRetainsLastGood(t *testing.T) {
	withModelCostFXServiceDialect(t)
	require.NoError(t, model.DB.AutoMigrate(&model.ModelCostFXRow{}))
	truncate(t)
	baselineSnapshot := seedModelCostFXServiceTest(t)
	baselineVersion := baselineSnapshot.Version
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"Date":"not-a-date","Valute":{}}`))
	}))
	defer server.Close()
	previousEndpoint := modelCostFXEndpoint
	modelCostFXEndpoint = server.URL
	t.Cleanup(func() { modelCostFXEndpoint = previousEndpoint })

	_, err := refreshModelCostFX(context.Background())
	require.Error(t, err)
	snapshot, err := model.CurrentModelCostFX(modelCostFXSource)
	require.NoError(t, err)
	assert.Equal(t, baselineVersion, snapshot.Version)
	assert.Equal(t, baselineSnapshot.Rates["USD"], snapshot.Rates["USD"])
}

func TestModelCostFXRefreshRejectsInvalidProviderResponses(t *testing.T) {
	withModelCostFXServiceDialect(t)
	cases := []struct {
		name   string
		status int
		body   string
	}{
		{"non200", http.StatusBadGateway, `{}`},
		{"missing usd", http.StatusOK, `{"Date":"2026-09-08T11:30:00+03:00","Valute":{}}`},
		{"zero nominal", http.StatusOK, `{"Date":"2026-09-08T11:30:00+03:00","Valute":{"USD":{"CharCode":"USD","Value":90,"Nominal":0}}}`},
		{"zero value", http.StatusOK, `{"Date":"2026-09-08T11:30:00+03:00","Valute":{"USD":{"CharCode":"USD","Value":0,"Nominal":1}}}`},
		{"invalid json", http.StatusOK, `{"Date":`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			baseline := seedModelCostFXServiceTest(t)
			baselineVersion := baseline.Version
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.body))
			}))
			defer server.Close()
			previousEndpoint := modelCostFXEndpoint
			modelCostFXEndpoint = server.URL
			t.Cleanup(func() { modelCostFXEndpoint = previousEndpoint })
			_, err := refreshModelCostFX(context.Background())
			require.Error(t, err)
			current, currentErr := model.CurrentModelCostFX(modelCostFXSource)
			require.NoError(t, currentErr)
			assert.Equal(t, baselineVersion, current.Version)
		})
	}
}

func TestModelCostFXRefreshCancellationFailsBeforeFetch(t *testing.T) {
	withModelCostFXServiceDialect(t)
	require.NoError(t, model.DB.AutoMigrate(&model.ModelCostFXRow{}))
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := refreshModelCostFX(ctx)
	require.ErrorIs(t, err, context.Canceled)
}

func TestModelCostFXRefreshRejectsConcurrentWinnerWithoutRetry(t *testing.T) {
	withModelCostFXServiceDialect(t)
	require.NoError(t, model.DB.AutoMigrate(&model.ModelCostFXRow{}))
	var existing model.ModelCostFXRow
	if err := model.DB.Where("source = ?", modelCostFXSource).First(&existing).Error; err != nil {
		require.NoError(t, model.SaveModelCostFX(context.Background(), model.ModelCostFXSnapshot{Source: modelCostFXSource, EffectiveAt: 100, FetchedAt: 200, Rates: map[string]float64{"USD": 90}}, 0))
	}
	require.NoError(t, model.LoadModelCostFX(context.Background(), modelCostFXSource))
	baseline, err := model.CurrentModelCostFX(modelCostFXSource)
	require.NoError(t, err)
	started := make(chan struct{})
	release := make(chan struct{})
	var requests int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests++
		close(started)
		<-release
		_, _ = w.Write([]byte(`{"Date":"2026-09-08T11:30:00+03:00","Valute":{"USD":{"CharCode":"USD","Value":91,"Nominal":1}}}`))
	}))
	defer server.Close()
	defer func() {
		select {
		case <-release:
		default:
			close(release)
		}
	}()
	previousEndpoint := modelCostFXEndpoint
	modelCostFXEndpoint = server.URL
	t.Cleanup(func() { modelCostFXEndpoint = previousEndpoint })

	resultCh := make(chan error, 1)
	go func() {
		_, err := refreshModelCostFX(context.Background())
		resultCh <- err
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("refresh did not start HTTP")
	}
	require.NoError(t, model.SaveModelCostFX(context.Background(), model.ModelCostFXSnapshot{Source: modelCostFXSource, EffectiveAt: baseline.EffectiveAt + 100, FetchedAt: baseline.FetchedAt + 100, Rates: map[string]float64{"USD": 91}}, baseline.Version))
	close(release)
	select {
	case result := <-resultCh:
		require.ErrorIs(t, result, model.ErrModelCostFXVersionConflict)
	case <-time.After(time.Second):
		t.Fatal("refresh did not finish")
	}
	assert.Equal(t, 1, requests)
	row := model.ModelCostFXRow{}
	require.NoError(t, model.DB.Where("source = ?", modelCostFXSource).First(&row).Error)
	assert.Equal(t, baseline.Version+1, row.Version)
	snapshot, err := model.CurrentModelCostFX(modelCostFXSource)
	require.NoError(t, err)
	assert.Equal(t, baseline.Version+1, snapshot.Version)
	assert.Equal(t, 91.0, snapshot.Rates["USD"])
}

func TestModelCostFXTaskRunSuccessAndFailure(t *testing.T) {
	withModelCostFXServiceDialect(t)
	for _, tc := range []struct {
		name   string
		status int
		body   string
		want   model.SystemTaskStatus
	}{
		{"success", http.StatusOK, `{"Date":"%s","Valute":{"USD":{"CharCode":"USD","Value":92,"Nominal":1}}}`, model.SystemTaskStatusSucceeded},
		{"failure", http.StatusBadGateway, `{}`, model.SystemTaskStatusFailed},
	} {
		t.Run(tc.name, func(t *testing.T) {
			seed := seedModelCostFXServiceTest(t)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
				body := tc.body
				if strings.Contains(body, "%s") {
					body = fmt.Sprintf(body, time.Unix(seed.EffectiveAt+1, 0).UTC().Format(time.RFC3339))
				}
				_, _ = w.Write([]byte(body))
			}))
			defer server.Close()
			previousEndpoint := modelCostFXEndpoint
			modelCostFXEndpoint = server.URL
			t.Cleanup(func() { modelCostFXEndpoint = previousEndpoint })
			task, err := model.CreateSystemTask(modelCostFXTaskType, nil, nil)
			require.NoError(t, err)
			claimed, ok, err := model.ClaimSystemTask(task.ID, modelCostFXTaskType, "fx-test", common.GetTimestamp()+60)
			require.NoError(t, err)
			require.True(t, ok)
			modelCostFXTaskHandler{}.Run(context.Background(), claimed, "fx-test")
			latest, err := model.GetLatestSystemTask(modelCostFXTaskType)
			require.NoError(t, err)
			assert.Equal(t, tc.want, latest.Status)
			current, err := model.CurrentModelCostFX(modelCostFXSource)
			require.NoError(t, err)
			wantRate := 90.0
			if tc.want == model.SystemTaskStatusSucceeded {
				wantRate = 92
			}
			assert.Equal(t, wantRate, current.Rates["USD"])
		})
	}
}

func TestModelCostFXTaskKeepsCommittedFXWhenFinishLosesLease(t *testing.T) {
	withModelCostFXServiceDialect(t)
	truncate(t)
	_ = model.DB.Where("type = ?", modelCostFXTaskType).Delete(&model.SystemTask{})
	_ = model.DB.Where("type = ?", modelCostFXTaskType).Delete(&model.SystemTaskLock{})
	seed := seedModelCostFXServiceTest(t)
	started := make(chan struct{})
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		close(started)
		<-release
		_, _ = w.Write([]byte(fmt.Sprintf(`{"Date":"%s","Valute":{"USD":{"CharCode":"USD","Value":93,"Nominal":1}}}`, time.Unix(seed.EffectiveAt+1, 0).UTC().Format(time.RFC3339))))
	}))
	defer server.Close()
	defer func() {
		select {
		case <-release:
		default:
			close(release)
		}
	}()
	previousEndpoint := modelCostFXEndpoint
	modelCostFXEndpoint = server.URL
	t.Cleanup(func() { modelCostFXEndpoint = previousEndpoint })
	task, err := model.CreateSystemTask(modelCostFXTaskType, nil, nil)
	require.NoError(t, err)
	claimed, ok, err := model.ClaimSystemTask(task.ID, modelCostFXTaskType, "fx-test", common.GetTimestamp()+60)
	require.NoError(t, err)
	require.True(t, ok)
	done := make(chan struct{})
	go func() { modelCostFXTaskHandler{}.Run(context.Background(), claimed, "fx-test"); close(done) }()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("refresh did not start HTTP")
	}
	require.NoError(t, model.DB.Model(&model.SystemTask{}).Where("task_id = ?", task.TaskID).Update("locked_by", "other").Error)
	require.NoError(t, model.DB.Model(&model.SystemTaskLock{}).Where("task_id = ?", task.TaskID).Update("locked_by", "other").Error)
	close(release)
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("handler did not finish")
	}
	current, err := model.CurrentModelCostFX(modelCostFXSource)
	require.NoError(t, err)
	assert.Equal(t, 93.0, current.Rates["USD"])
	var latest model.SystemTask
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&latest).Error)
	assert.NotEqual(t, model.SystemTaskStatusSucceeded, latest.Status)
}

func TestModelCostFXReplicaReloadKeepsAndRefreshesLastGood(t *testing.T) {
	withModelCostFXServiceDialect(t)
	seed := seedModelCostFXServiceTest(t)
	var before model.ModelCostFXRow
	require.NoError(t, model.DB.Where("source = ?", modelCostFXSource).First(&before).Error)
	loadModelCostFXFromDatabase()
	var unchanged model.ModelCostFXRow
	require.NoError(t, model.DB.Where("source = ?", modelCostFXSource).First(&unchanged).Error)
	assert.Equal(t, before.Version, unchanged.Version)
	assert.Equal(t, before.FetchedAt, unchanged.FetchedAt)

	nextRates := `{"USD":91}`
	require.NoError(t, model.DB.Model(&model.ModelCostFXRow{}).Where("source = ?", modelCostFXSource).Updates(map[string]any{
		"effective_at": seed.EffectiveAt + 1, "fetched_at": seed.FetchedAt + 1, "version": seed.Version + 1, "rates_json": nextRates,
	}).Error)
	loadModelCostFXFromDatabase()
	current, err := model.CurrentModelCostFX(modelCostFXSource)
	require.NoError(t, err)
	assert.Equal(t, seed.Version+1, current.Version)
	assert.Equal(t, 91.0, current.Rates["USD"])

	var valid model.ModelCostFXRow
	require.NoError(t, model.DB.Where("source = ?", modelCostFXSource).First(&valid).Error)
	require.NoError(t, model.DB.Model(&model.ModelCostFXRow{}).Where("source = ?", modelCostFXSource).Update("rates_json", "{bad").Error)
	loadModelCostFXFromDatabase()
	retained, err := model.CurrentModelCostFX(modelCostFXSource)
	require.NoError(t, err)
	assert.Equal(t, current.Version, retained.Version)
	assert.Equal(t, 91.0, retained.Rates["USD"])
	require.NoError(t, model.DB.Model(&model.ModelCostFXRow{}).Where("source = ?", modelCostFXSource).Updates(map[string]any{"rates_json": valid.RatesJSON}).Error)
}

type stubScheduledHandler struct {
	taskType string
	enabled  bool
	interval time.Duration
	onRun    func(ctx context.Context, task *model.SystemTask, runnerID string)
}

type stubSystemTaskRunResult struct {
	taskID   string
	taskType string
	err      error
}

func (h *stubScheduledHandler) Type() string { return h.taskType }

func (h *stubScheduledHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	if h.onRun != nil {
		h.onRun(ctx, task, runnerID)
	}
}

func (h *stubScheduledHandler) Enabled() bool           { return h.enabled }
func (h *stubScheduledHandler) Interval() time.Duration { return h.interval }
func (h *stubScheduledHandler) NewPayload() any         { return nil }

func countSystemTasks(t *testing.T, taskType string) int64 {
	t.Helper()
	var count int64
	require.NoError(t, model.DB.Model(&model.SystemTask{}).Where("type = ?", taskType).Count(&count).Error)
	return count
}

func TestSystemTaskSchedulerCreatesWhenDueAndDedups(t *testing.T) {
	truncate(t)

	handler := &stubScheduledHandler{taskType: "test_scheduled", enabled: true, interval: time.Minute}
	withSystemTaskRegistry(t, handler)

	runSystemTaskScheduler()
	require.Equal(t, int64(1), countSystemTasks(t, handler.taskType))

	// An active (pending) row already exists, so a second pass must not create
	// another row.
	runSystemTaskScheduler()
	require.Equal(t, int64(1), countSystemTasks(t, handler.taskType))

	// Finish the run; with a fresh updated_at the next run is not due yet.
	latest, err := model.GetLatestSystemTask(handler.taskType)
	require.NoError(t, err)
	require.NotNil(t, latest)
	_, claimed, err := model.ClaimSystemTask(latest.ID, handler.taskType, "runner-a", common.GetTimestamp()+60)
	require.NoError(t, err)
	require.True(t, claimed)
	require.NoError(t, model.FinishSystemTask(latest.TaskID, "runner-a", model.SystemTaskStatusSucceeded, nil, ""))

	runSystemTaskScheduler()
	require.Equal(t, int64(1), countSystemTasks(t, handler.taskType))

	// Backdate the finished row beyond the interval -> the job becomes due again.
	require.NoError(t, model.DB.Model(&model.SystemTask{}).
		Where("task_id = ?", latest.TaskID).
		Update("updated_at", common.GetTimestamp()-120).Error)

	runSystemTaskScheduler()
	require.Equal(t, int64(2), countSystemTasks(t, handler.taskType))
}

func TestSystemTaskSchedulerSkipsDisabled(t *testing.T) {
	truncate(t)

	handler := &stubScheduledHandler{taskType: "test_disabled", enabled: false, interval: time.Minute}
	withSystemTaskRegistry(t, handler)

	runSystemTaskScheduler()
	assert.Equal(t, int64(0), countSystemTasks(t, handler.taskType))
}

func TestSystemTaskClaimPassDispatchesByType(t *testing.T) {
	truncate(t)

	ran := make(chan stubSystemTaskRunResult, 1)
	handler := &stubScheduledHandler{
		taskType: "test_dispatch",
		enabled:  true,
		interval: time.Minute,
		onRun: func(_ context.Context, task *model.SystemTask, runnerID string) {
			ran <- stubSystemTaskRunResult{
				taskType: task.Type,
				err:      model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusSucceeded, nil, ""),
			}
		},
	}
	withSystemTaskRegistry(t, handler)

	_, err := model.CreateSystemTask(handler.taskType, nil, nil)
	require.NoError(t, err)

	runSystemTaskClaimPass("runner-dispatch")

	select {
	case got := <-ran:
		require.NoError(t, got.err)
		assert.Equal(t, handler.taskType, got.taskType)
	case <-time.After(2 * time.Second):
		t.Fatal("claimed task was not dispatched to its handler")
	}

	require.Eventually(t, func() bool {
		latest, err := model.GetLatestSystemTask(handler.taskType)
		return err == nil && latest != nil && latest.Status == model.SystemTaskStatusSucceeded
	}, 2*time.Second, 20*time.Millisecond)
}

func TestSystemTaskClaimPassDispatchesEarliestPendingByType(t *testing.T) {
	truncate(t)

	ran := make(chan stubSystemTaskRunResult, 2)
	handlerA := &stubScheduledHandler{
		taskType: "test_dispatch_a",
		enabled:  true,
		interval: time.Minute,
		onRun: func(_ context.Context, task *model.SystemTask, runnerID string) {
			ran <- stubSystemTaskRunResult{
				taskID: task.TaskID,
				err:    model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusSucceeded, nil, ""),
			}
		},
	}
	handlerB := &stubScheduledHandler{
		taskType: "test_dispatch_b",
		enabled:  true,
		interval: time.Minute,
		onRun: func(_ context.Context, task *model.SystemTask, runnerID string) {
			ran <- stubSystemTaskRunResult{
				taskID: task.TaskID,
				err:    model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusSucceeded, nil, ""),
			}
		},
	}
	withSystemTaskRegistry(t, handlerA, handlerB)

	firstA, err := model.CreateSystemTask(handlerA.taskType, nil, nil)
	require.NoError(t, err)
	secondTaskID, err := model.GenerateSystemTaskID()
	require.NoError(t, err)
	secondA := &model.SystemTask{
		TaskID: secondTaskID,
		Type:   handlerA.taskType,
		Status: model.SystemTaskStatusPending,
	}
	require.NoError(t, model.DB.Create(secondA).Error)
	firstB, err := model.CreateSystemTask(handlerB.taskType, nil, nil)
	require.NoError(t, err)

	runSystemTaskClaimPass("runner-dispatch")

	got := map[string]bool{}
	for range 2 {
		select {
		case result := <-ran:
			require.NoError(t, result.err)
			got[result.taskID] = true
		case <-time.After(2 * time.Second):
			t.Fatal("claimed tasks were not dispatched to their handlers")
		}
	}

	assert.True(t, got[firstA.TaskID])
	assert.True(t, got[firstB.TaskID])
	assert.False(t, got[secondA.TaskID])

	require.Eventually(t, func() bool {
		reloaded, err := model.GetSystemTaskByTaskID(secondA.TaskID)
		return err == nil && reloaded != nil && reloaded.Status == model.SystemTaskStatusPending
	}, 2*time.Second, 20*time.Millisecond)
}

func TestEnqueueSystemTaskReportsCreatedAndExistingActive(t *testing.T) {
	truncate(t)

	first, created, err := EnqueueSystemTask("test_enqueue", map[string]bool{"manual": true})
	require.NoError(t, err)
	require.True(t, created)
	require.NotNil(t, first)

	existing, created, err := EnqueueSystemTask("test_enqueue", nil)
	require.NoError(t, err)
	require.False(t, created)
	require.NotNil(t, existing)
	assert.Equal(t, first.TaskID, existing.TaskID)

	_, claimed, err := model.ClaimSystemTask(first.ID, first.Type, "runner-a", common.GetTimestamp()+60)
	require.NoError(t, err)
	require.True(t, claimed)
	require.NoError(t, model.FinishSystemTask(first.TaskID, "runner-a", model.SystemTaskStatusSucceeded, nil, ""))

	second, created, err := EnqueueSystemTask("test_enqueue", nil)
	require.NoError(t, err)
	require.True(t, created)
	require.NotNil(t, second)
	assert.NotEqual(t, first.TaskID, second.TaskID)
}
