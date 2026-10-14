package controller

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
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

type taskSubmissionTestBilling struct {
	events     *[]string
	settleErr  error
	reserveErr error
	onSettle   func()
	refunds    int
}

func (b *taskSubmissionTestBilling) Settle(int) error {
	*b.events = append(*b.events, "settle")
	if b.onSettle != nil {
		b.onSettle()
	}
	return b.settleErr
}

func (b *taskSubmissionTestBilling) Refund(*gin.Context) {
	*b.events = append(*b.events, "refund")
	b.refunds++
}

func (b *taskSubmissionTestBilling) NeedsRefund() bool        { return b.refunds == 0 }
func (b *taskSubmissionTestBilling) GetPreConsumedQuota() int { return 0 }
func (b *taskSubmissionTestBilling) Reserve(int) error {
	*b.events = append(*b.events, "reserve")
	return b.reserveErr
}

func TestPresentTaskSubmissionUsesNativePresenterAfterPersistence(t *testing.T) {
	plugin, err := pluginruntime.CompilePlugin(`
export const meta = {apiVersion:1,key:"presenter-test",name:"Presenter",version:"1.0.0",author:{name:"Test"},models:["model"],fetchMode:"per_task",routes:[{method:"POST",path:"/vendor/jobs",type:"submit",decode:"decode",render:"created"}]};
export const native = {decode:function(ctx){return {kind:"submit",model:"model",requestBody:ctx.body.value};},created:function(ctx,task){return {data:{task_id:task.task_id},upstream:task.data};}};
export function buildSubmitRequest(){return {}} export function parseSubmitResponse(){return {taskId:"upstream"}} export function buildQueryRequest(){return {}} export function parseTaskResult(){return {status:"SUCCESS"}}
`, pluginruntime.Options{})
	require.NoError(t, err)
	priceData := types.PriceData{}
	priceData.AddOtherRatio("seconds", 5)
	task := &model.Task{TaskID: "task_public", SubmitTime: 123}
	task.SetData(map[string]any{"task_id": "upstream_private"})
	outcome := &taskSubmissionOutcome{
		Result:    &relay.TaskSubmitResult{},
		Task:      task,
		RelayInfo: &relaycommon.RelayInfo{PriceData: priceData},
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/vendor/jobs", strings.NewReader(`{"model":"model"}`))
	c.Set(pluginruntime.ContextKeyPinnedRoute, pluginruntime.PinnedRoute{Plugin: plugin, Route: plugin.Meta.Routes[0]})
	c.Set(pluginruntime.ContextKeyRouteRequest, pluginruntime.RouteRequestContext{Path: "/vendor/jobs", Method: http.MethodPost, Body: map[string]any{"kind": "json", "value": map[string]any{"model": "model"}}})

	presentTaskSubmission(c, outcome)

	assert.JSONEq(t, `{
		"data":{"task_id":"task_public"},
		"upstream":{"task_id":"upstream_private"}
	}`, recorder.Body.String())
	assert.JSONEq(t, `{"seconds":5}`, recorder.Header().Get("X-New-Api-Other-Ratios"))
}

func TestPresentTaskSubmissionFallbackUsesPersistedPublicID(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	outcome := &taskSubmissionOutcome{
		Result:    &relay.TaskSubmitResult{},
		Task:      &model.Task{TaskID: "task_persisted", SubmitTime: 456},
		RelayInfo: &relaycommon.RelayInfo{OriginModelName: "video-model"},
	}

	presentTaskSubmission(c, outcome)

	assert.JSONEq(t, `{
		"id":"task_persisted",
		"task_id":"task_persisted",
		"status":"queued",
		"model":"video-model",
		"created_at":456
	}`, recorder.Body.String())
}

func TestPresentTaskSubmissionUsesHostOpenAIVideoCreateReceipt(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set(pluginruntime.ContextKeyPinnedEndpoint, pluginruntime.PinnedEndpoint{
		Protocol:  "openai_video",
		Operation: pluginruntime.HostProtocolOperation{Name: "create"},
	})
	task := &model.Task{
		TaskID:     "task_public",
		Status:     model.TaskStatusSubmitted,
		Progress:   "0%",
		CreatedAt:  456,
		Properties: model.Properties{OriginModelName: "video-model"},
	}
	outcome := &taskSubmissionOutcome{Result: &relay.TaskSubmitResult{}, Task: task, RelayInfo: &relaycommon.RelayInfo{}}

	presentTaskSubmission(c, outcome)

	assert.JSONEq(t, `{"id":"task_public","object":"video","model":"video-model","status":"queued","progress":0,"created_at":456}`, recorder.Body.String())
	assert.NotContains(t, recorder.Body.String(), "task_id")
}

func TestExecuteAppTaskSubmissionMapsProjectionStorageFailureToServiceUnavailable(t *testing.T) {
	events := []string{}
	database := setupTaskSubmissionDatabase(t, true, &events)
	const privateDetail = "private projection storage detail"
	require.NoError(t, database.Callback().Query().Before("gorm:query").
		Register("test:app-task-projection-storage-failure", func(tx *gorm.DB) {
			if tx.Statement.Table == "tasks" {
				tx.AddError(errors.New(privateDetail))
			}
		}))
	t.Cleanup(func() {
		require.NoError(t, database.Callback().Query().Remove("test:app-task-projection-storage-failure"))
	})
	c := taskSubmissionTestContext()
	info := taskSubmissionRelayInfo(&taskSubmissionTestBilling{events: &events})
	info.AppSubject = &types.AppRelaySubject{GrantID: "grant"}

	outcome, taskErr := executeAppTaskSubmission(c, info, func(
		*gin.Context, *relaycommon.RelayInfo,
	) (*relay.TaskSubmitResult, *dto.TaskError) {
		return &relay.TaskSubmitResult{AppExecution: &model.AppTaskExecution{
			TaskID: "task_public", UserID: 1,
		}}, nil
	})

	assert.Nil(t, outcome)
	require.NotNil(t, taskErr)
	assert.Equal(t, "service_unavailable", taskErr.Code)
	assert.Equal(t, http.StatusServiceUnavailable, taskErr.StatusCode)
	assert.NotContains(t, taskErr.Message, privateDetail)
}

func TestExecuteTaskSubmissionRefundsWhenInsertFails(t *testing.T) {
	events := make([]string, 0, 3)
	database := setupTaskSubmissionDatabase(t, false, &events)
	_ = database
	billing := &taskSubmissionTestBilling{events: &events}
	c := taskSubmissionTestContext()
	info := taskSubmissionRelayInfo(billing)

	outcome, taskErr := executeTaskSubmissionWith(c, info, func(*gin.Context, *relaycommon.RelayInfo) (*relay.TaskSubmitResult, *dto.TaskError) {
		return &relay.TaskSubmitResult{
			UpstreamTaskID: "upstream_private",
			Platform:       constant.TaskPlatform("plugin"),
		}, nil
	})

	assert.Nil(t, outcome)
	require.NotNil(t, taskErr)
	assert.Equal(t, "task_insert_failed", taskErr.Code)
	assert.Equal(t, []string{"reserve", "insert", "refund"}, events)
	assert.Equal(t, 1, billing.refunds)
	assert.False(t, c.Writer.Written())
}

func TestExecuteTaskSubmissionAcceptedResultDoesNotRefundWhenInsertFails(t *testing.T) {
	events := make([]string, 0, 2)
	setupTaskSubmissionDatabase(t, false, &events)
	billing := &taskSubmissionTestBilling{events: &events}
	c := taskSubmissionTestContext()
	info := taskSubmissionRelayInfo(billing)

	outcome, taskErr := executeTaskSubmissionWith(c, info, func(*gin.Context, *relaycommon.RelayInfo) (*relay.TaskSubmitResult, *dto.TaskError) {
		return &relay.TaskSubmitResult{
			UpstreamTaskID:   "upstream_private",
			Platform:         constant.TaskPlatform("plugin"),
			ProviderAccepted: true,
		}, nil
	})

	assert.Nil(t, outcome)
	require.NotNil(t, taskErr)
	assert.Equal(t, "task_insert_failed", taskErr.Code)
	assert.True(t, taskErr.NoRetry)
	assert.True(t, taskErr.ProviderAccepted)
	assert.Equal(t, []string{"reserve", "insert"}, events)
	assert.Zero(t, billing.refunds)
	assert.False(t, c.Writer.Written())
}

func TestExecuteTaskSubmissionSettlementFailureStaysDurableAndWritesNothing(t *testing.T) {
	events := make([]string, 0, 3)
	database := setupTaskSubmissionDatabase(t, true, &events)
	billing := &taskSubmissionTestBilling{events: &events, settleErr: errors.New("settlement failed")}
	c := taskSubmissionTestContext()
	info := taskSubmissionRelayInfo(billing)

	outcome, taskErr := executeTaskSubmissionWith(c, info, func(*gin.Context, *relaycommon.RelayInfo) (*relay.TaskSubmitResult, *dto.TaskError) {
		return &relay.TaskSubmitResult{
			UpstreamTaskID: "upstream_private",
			Platform:       constant.TaskPlatform("plugin"),
		}, nil
	})

	assert.Nil(t, outcome)
	require.NotNil(t, taskErr)
	assert.Equal(t, "task_billing_settlement_failed", taskErr.Code)
	assert.Equal(t, []string{"reserve", "insert", "settle"}, events)
	assert.Zero(t, billing.refunds)
	var count int64
	require.NoError(t, database.Model(&model.Task{}).Where("task_id = ?", "task_public").Count(&count).Error)
	assert.Equal(t, int64(1), count)
	assert.False(t, c.Writer.Written())
}

func TestExecuteTaskSubmissionPersistsPinnedPluginProvenance(t *testing.T) {
	events := make([]string, 0, 3)
	database := setupTaskSubmissionDatabase(t, true, &events)
	previousLogConsumeEnabled := common.LogConsumeEnabled
	common.LogConsumeEnabled = false
	t.Cleanup(func() { common.LogConsumeEnabled = previousLogConsumeEnabled })

	c := taskSubmissionTestContext()
	c.Set(common.RequestIdKey, "request-public")
	c.Set(pluginruntime.ContextKeyPinnedPlugin, pluginruntime.PinnedPlugin{
		Generation: &pluginruntime.RoutingGeneration{Number: 42},
		Plugin: &pluginruntime.LoadedPlugin{Meta: pluginruntime.Meta{
			Key:        "document-parser",
			Name:       "Document Parser",
			Version:    "1.2.3",
			APIVersion: 1,
			Author: pluginruntime.AuthorMeta{
				Name: "Community Author",
				URL:  "https://plugins.example/author",
			},
		}},
	})
	billing := &taskSubmissionTestBilling{events: &events}
	info := taskSubmissionRelayInfo(billing)

	outcome, taskErr := executeTaskSubmissionWith(c, info, func(*gin.Context, *relaycommon.RelayInfo) (*relay.TaskSubmitResult, *dto.TaskError) {
		return &relay.TaskSubmitResult{
			UpstreamTaskID: "upstream-private",
			Platform:       constant.TaskPlatform("document-parser"),
		}, nil
	})

	require.Nil(t, taskErr)
	require.NotNil(t, outcome)
	require.NotNil(t, outcome.Task.PrivateData.Execution)
	require.NotNil(t, outcome.Task.PrivateData.Execution.TaskPlugin)
	assert.Equal(t, "request-public", outcome.Task.PrivateData.Execution.RequestID)
	assert.Equal(t, "/plugin/submit", outcome.Task.PrivateData.Execution.RequestPath)
	assert.Equal(t, "1.2.3", outcome.Task.PrivateData.Execution.TaskPlugin.Version)
	assert.Equal(t, uint64(42), outcome.Task.PrivateData.Execution.TaskPlugin.Generation)
	require.NotNil(t, outcome.Task.PrivateData.Execution.TaskPlugin.Author)
	assert.Equal(t, "Community Author", outcome.Task.PrivateData.Execution.TaskPlugin.Author.Name)
	assert.Equal(t, "https://plugins.example/author", outcome.Task.PrivateData.Execution.TaskPlugin.Author.URL)

	var stored model.Task
	require.NoError(t, database.Where("task_id = ?", "task_public").First(&stored).Error)
	require.NotNil(t, stored.PrivateData.Execution)
	require.NotNil(t, stored.PrivateData.Execution.TaskPlugin)
	assert.Equal(t, "document-parser", stored.PrivateData.Execution.TaskPlugin.Key)
	require.NotNil(t, stored.PrivateData.Execution.TaskPlugin.Author)
	assert.Equal(t, "Community Author", stored.PrivateData.Execution.TaskPlugin.Author.Name)
	assert.Equal(t, "upstream-private", stored.PrivateData.UpstreamTaskID)
}

// A submit route declaring retainResult: false persists the task row for
// billing but never writes the upstream snapshot for an immediate terminal
// result, while the in-memory task still carries it for the presenter. An
// asynchronous result on the same route is retained because polling and
// retrieval depend on it.
func TestExecuteTaskSubmissionHonorsRouteRetainResult(t *testing.T) {
	retainFalse := false
	for _, tc := range []struct {
		name          string
		immediate     *relaycommon.TaskInfo
		wantDiscarded bool
	}{
		{"immediate success is discarded", &relaycommon.TaskInfo{Status: model.TaskStatusSuccess, Progress: "100%"}, true},
		{"immediate failure is discarded", &relaycommon.TaskInfo{Status: model.TaskStatusFailure, Reason: "rejected"}, true},
		{"asynchronous result is retained", nil, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			events := make([]string, 0, 3)
			database, _ := openTaskDialectDatabase(t, &model.Task{}, &model.User{}, &model.Channel{})
			previousDB := model.DB
			model.DB = database
			t.Cleanup(func() { model.DB = previousDB })
			previousLogConsumeEnabled := common.LogConsumeEnabled
			common.LogConsumeEnabled = false
			t.Cleanup(func() { common.LogConsumeEnabled = previousLogConsumeEnabled })

			c := taskSubmissionTestContext()
			c.Set(pluginruntime.ContextKeyPinnedRoute, pluginruntime.PinnedRoute{
				Plugin: &pluginruntime.LoadedPlugin{Meta: pluginruntime.Meta{Key: "sync-images"}},
				Route:  pluginruntime.Route{Method: http.MethodPost, Path: "/sync/images", Type: pluginruntime.RouteTypeSubmit, RetainResult: &retainFalse},
			})
			info := taskSubmissionRelayInfo(&taskSubmissionTestBilling{events: &events})
			upstream := []byte(`{"data":[{"url":"https://cdn.example/a.png"}]}`)

			outcome, taskErr := executeTaskSubmissionWith(c, info, func(*gin.Context, *relaycommon.RelayInfo) (*relay.TaskSubmitResult, *dto.TaskError) {
				return &relay.TaskSubmitResult{
					UpstreamTaskID: "task_public",
					Platform:       constant.TaskPlatform("sync-images"),
					TaskData:       upstream,
					Immediate:      tc.immediate,
				}, nil
			})
			require.Nil(t, taskErr)
			require.NotNil(t, outcome)
			assert.JSONEq(t, string(upstream), string(outcome.Task.Data), "presenter keeps the in-memory snapshot")
			assert.Equal(t, tc.wantDiscarded, outcome.Task.PrivateData.ResultDiscarded)
			assert.Equal(t, !tc.wantDiscarded, outcome.Task.ResultRetrievable())

			var stored model.Task
			require.NoError(t, database.Where("task_id = ?", "task_public").First(&stored).Error)
			assert.Equal(t, tc.wantDiscarded, stored.PrivateData.ResultDiscarded)
			var nullCount int64
			require.NoError(t, database.Model(&model.Task{}).Where("task_id = ? AND data IS NULL", "task_public").Count(&nullCount).Error)
			if tc.wantDiscarded {
				assert.Equal(t, int64(1), nullCount, "snapshot column must stay NULL")
				artifacts, err := projectTaskArtifacts(&stored)
				require.NoError(t, err)
				assert.Empty(t, artifacts)
			} else {
				assert.Equal(t, int64(0), nullCount)
				assert.JSONEq(t, string(upstream), string(stored.Data))
			}
			listed := model.TaskGetAllUserTask(1, 0, 10, model.SyncTaskQueryParams{})
			require.Len(t, listed, 1)
			assert.Empty(t, listed[0].Data, "task lists never select the snapshot column")
		})
	}
}

func TestExecuteTaskSubmissionRefundsCancellationBeforeDurableBarrier(t *testing.T) {
	events := make([]string, 0, 2)
	setupTaskSubmissionDatabase(t, true, &events)
	billing := &taskSubmissionTestBilling{events: &events}
	c := taskSubmissionTestContext()
	requestContext, cancel := context.WithCancel(c.Request.Context())
	c.Request = c.Request.WithContext(requestContext)
	info := taskSubmissionRelayInfo(billing)

	outcome, taskErr := executeTaskSubmissionWith(c, info, func(*gin.Context, *relaycommon.RelayInfo) (*relay.TaskSubmitResult, *dto.TaskError) {
		cancel()
		return &relay.TaskSubmitResult{
			UpstreamTaskID: "upstream_private",
			Platform:       constant.TaskPlatform("plugin"),
		}, nil
	})

	assert.Nil(t, outcome)
	require.NotNil(t, taskErr)
	assert.Equal(t, "request_cancelled", taskErr.Code)
	assert.Equal(t, []string{"refund"}, events)
	assert.Equal(t, 1, billing.refunds)
	assert.False(t, c.Writer.Written())
}

func TestExecuteTaskSubmissionAcceptedResultDoesNotRefundOnCancellation(t *testing.T) {
	events := make([]string, 0, 1)
	setupTaskSubmissionDatabase(t, true, &events)
	billing := &taskSubmissionTestBilling{events: &events}
	c := taskSubmissionTestContext()
	requestContext, cancel := context.WithCancel(c.Request.Context())
	c.Request = c.Request.WithContext(requestContext)
	info := taskSubmissionRelayInfo(billing)

	outcome, taskErr := executeTaskSubmissionWith(c, info, func(*gin.Context, *relaycommon.RelayInfo) (*relay.TaskSubmitResult, *dto.TaskError) {
		cancel()
		return &relay.TaskSubmitResult{
			UpstreamTaskID:   "upstream_private",
			Platform:         constant.TaskPlatform("plugin"),
			ProviderAccepted: true,
		}, nil
	})

	assert.Nil(t, outcome)
	require.NotNil(t, taskErr)
	assert.Equal(t, "request_cancelled", taskErr.Code)
	assert.True(t, taskErr.NoRetry)
	assert.True(t, taskErr.ProviderAccepted)
	assert.Empty(t, events)
	assert.Zero(t, billing.refunds)
	assert.False(t, c.Writer.Written())
}

func TestExecuteTaskSubmissionDisconnectBeforeUpstreamAcceptanceSkipsSubmitAndRefunds(t *testing.T) {
	events := make([]string, 0, 1)
	setupTaskSubmissionDatabase(t, true, &events)
	billing := &taskSubmissionTestBilling{events: &events}
	c := taskSubmissionTestContext()
	requestContext, cancel := context.WithCancel(c.Request.Context())
	cancel()
	c.Request = c.Request.WithContext(requestContext)
	info := taskSubmissionRelayInfo(billing)
	submitted := false

	outcome, taskErr := executeTaskSubmissionWith(c, info, func(*gin.Context, *relaycommon.RelayInfo) (*relay.TaskSubmitResult, *dto.TaskError) {
		submitted = true
		return nil, nil
	})

	assert.Nil(t, outcome)
	require.NotNil(t, taskErr)
	assert.Equal(t, "request_cancelled", taskErr.Code)
	assert.False(t, submitted)
	assert.Equal(t, []string{"refund"}, events)
	assert.Equal(t, 1, billing.refunds)
	assert.False(t, c.Writer.Written())
}

func TestExecuteTaskSubmissionCallerCancellationDuringSubmitRefundsBeforeDurableBarrier(t *testing.T) {
	events := make([]string, 0, 1)
	setupTaskSubmissionDatabase(t, true, &events)
	billing := &taskSubmissionTestBilling{events: &events}
	c := taskSubmissionTestContext()
	requestContext, cancel := context.WithCancel(c.Request.Context())
	c.Request = c.Request.WithContext(requestContext)
	info := taskSubmissionRelayInfo(billing)
	submitStarted := make(chan struct{})
	done := make(chan struct{})
	var outcome *taskSubmissionOutcome
	var taskErr *dto.TaskError

	go func() {
		defer close(done)
		outcome, taskErr = executeTaskSubmissionWith(c, info, func(c *gin.Context, _ *relaycommon.RelayInfo) (*relay.TaskSubmitResult, *dto.TaskError) {
			close(submitStarted)
			<-c.Request.Context().Done()
			return nil, service.TaskErrorWrapperLocal(c.Request.Context().Err(), "do_request_failed", http.StatusInternalServerError)
		})
	}()
	select {
	case <-submitStarted:
	case <-time.After(2 * time.Second):
		require.FailNow(t, "submission did not start")
	}
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		require.FailNow(t, "submission did not stop after disconnect")
	}

	assert.Nil(t, outcome)
	require.NotNil(t, taskErr)
	assert.Equal(t, "request_cancelled", taskErr.Code)
	assert.Equal(t, []string{"refund"}, events)
	assert.Equal(t, 1, billing.refunds)
	assert.False(t, c.Writer.Written())
}

func TestExecuteTaskSubmissionDisconnectAfterDurableInsertDoesNotRefund(t *testing.T) {
	events := make([]string, 0, 3)
	database := setupTaskSubmissionDatabase(t, true, &events)
	previousLogConsumeEnabled := common.LogConsumeEnabled
	common.LogConsumeEnabled = false
	t.Cleanup(func() { common.LogConsumeEnabled = previousLogConsumeEnabled })
	c := taskSubmissionTestContext()
	requestContext, cancel := context.WithCancel(c.Request.Context())
	c.Request = c.Request.WithContext(requestContext)
	billing := &taskSubmissionTestBilling{
		events:   &events,
		onSettle: cancel,
	}
	info := taskSubmissionRelayInfo(billing)

	outcome, taskErr := executeTaskSubmissionWith(c, info, func(*gin.Context, *relaycommon.RelayInfo) (*relay.TaskSubmitResult, *dto.TaskError) {
		return &relay.TaskSubmitResult{
			UpstreamTaskID: "upstream_private",
			Platform:       constant.TaskPlatform("plugin"),
		}, nil
	})

	require.Nil(t, taskErr)
	require.NotNil(t, outcome)
	assert.Equal(t, "task_public", outcome.Task.TaskID)
	assert.Equal(t, []string{"reserve", "insert", "settle"}, events)
	assert.Zero(t, billing.refunds)
	var count int64
	require.NoError(t, database.Model(&model.Task{}).Where("task_id = ?", "task_public").Count(&count).Error)
	assert.Equal(t, int64(1), count)
	assert.False(t, c.Writer.Written())
}

// setupTaskSubmissionDatabase opens the dialect selected by
// TEST_TASK_DB_DIALECT (SQLite in memory by default) and records every task
// INSERT in events so tests can assert the reserve → insert → settle order.
// Without migrate the task table does not exist and inserts fail.
func setupTaskSubmissionDatabase(t *testing.T, migrate bool, events *[]string, additionalModels ...any) *gorm.DB {
	t.Helper()
	previousDB := model.DB
	previousType := common.MainDatabaseType()
	models := append([]any(nil), additionalModels...)
	if migrate {
		models = append(models, &model.Task{})
	}
	database, dialect := openTaskDialectDatabase(t, models...)
	require.NoError(t, database.Callback().Create().Before("gorm:create").Register("test:task-submit-order", func(*gorm.DB) {
		*events = append(*events, "insert")
	}))
	model.DB = database
	common.SetMainDatabaseType(dialect)
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousType)
		if common.MemoryCacheEnabled && previousDB != nil &&
			previousDB.Migrator().HasTable(&model.Channel{}) &&
			previousDB.Migrator().HasTable(&model.Ability{}) {
			model.InitChannelCache()
		}
	})
	return database
}

func taskSubmissionTestContext() *gin.Context {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/plugin/submit", strings.NewReader(`{}`))
	return c
}

func taskSubmissionRelayInfo(billing relaycommon.BillingSettler) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		UserId:          1,
		UsingGroup:      "default",
		OriginModelName: "plugin-model",
		Billing:         billing,
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			PublicTaskID:  "task_public",
			LockedChannel: &model.Channel{Id: 1, Type: constant.ChannelTypeTaskPlugin, Name: "plugin"},
		},
		ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 1, ChannelType: constant.ChannelTypeTaskPlugin},
	}
}

// Uses the real submit adaptor, expression evaluator, BillingSession, task row
// and consume log. Set TEST_TASK_DB_DIALECT plus TEST_MYSQL_DSN or
// TEST_POSTGRES_DSN, or use the repository database-matrix runner.
// Unique table prefixes keep the fixture isolated from all existing tables.
// openTaskDialectDatabase opens the engine selected by TEST_TASK_DB_DIALECT
// (default SQLite in memory; MySQL and PostgreSQL through TEST_MYSQL_DSN and
// TEST_POSTGRES_DSN) with a unique table prefix, migrates the given models and
// drops them on cleanup. It logs the engine version so database verification
// runs leave a record.
func openTaskDialectDatabase(t *testing.T, models ...any) (*gorm.DB, common.DatabaseType) {
	t.Helper()
	dialectName := os.Getenv("TEST_TASK_DB_DIALECT")
	dsn := ""
	if dialectName == "" {
		dialectName = os.Getenv("APP_PLUGIN_TEST_DIALECT")
		dsn = os.Getenv("APP_PLUGIN_TEST_DSN")
	}
	dialect := common.DatabaseType(dialectName)
	var driver gorm.Dialector
	switch dialect {
	case "", common.DatabaseTypeSQLite:
		dialect = common.DatabaseTypeSQLite
		if dsn == "" {
			dsn = ":memory:"
		}
		driver = sqlite.Open(dsn)
	case common.DatabaseTypeMySQL:
		if dsn == "" {
			dsn = os.Getenv("TEST_MYSQL_DSN")
		}
		require.NotEmpty(t, dsn)
		driver = mysql.Open(dsn)
	case common.DatabaseTypePostgreSQL:
		if dsn == "" {
			dsn = os.Getenv("TEST_POSTGRES_DSN")
		}
		require.NotEmpty(t, dsn)
		driver = postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
	default:
		t.Fatalf("unsupported test dialect %q", dialect)
	}
	db, err := gorm.Open(driver, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: fmt.Sprintf("tsubmit_%d_", time.Now().UnixNano())}})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, db.AutoMigrate(models...))
	t.Cleanup(func() { require.NoError(t, db.Migrator().DropTable(models...)) })
	var version string
	if dialect == common.DatabaseTypeSQLite {
		require.NoError(t, db.Raw("SELECT sqlite_version()").Scan(&version).Error)
	} else {
		require.NoError(t, db.Raw("SELECT version()").Scan(&version).Error)
	}
	t.Logf("database: %s %s", dialect, version)
	return db, dialect
}

func TestImmediateTaskSettlementDatabase(t *testing.T) {
	db, dialect := openTaskDialectDatabase(t, &model.User{}, &model.Channel{}, &model.Task{}, &model.Log{})
	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldMain, oldLog := common.MainDatabaseType(), common.LogDatabaseType()
	oldRedis, oldMemory, oldBatch, oldConsume, oldExport := common.RedisEnabled, common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled, common.DataExportEnabled
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(dialect, dialect)
	common.RedisEnabled, common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled, common.DataExportEnabled = false, false, false, true, false
	t.Cleanup(func() {
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.SetDatabaseTypes(oldMain, oldLog)
		common.RedisEnabled, common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled, common.DataExportEnabled = oldRedis, oldMemory, oldBatch, oldConsume, oldExport
	})

	const expression = `u("units") == 7 ? tier("missing", u("missing") * 1.0) : u("units") == 8 ? tier("invalid", -1.0) : u("units") > 3 ? tier("bulk", u("units") * 0.01) : tier("small", u("units") * 0.01)`
	withTieredBillingConfig(t, map[string]string{"document-model": "tiered_expr"}, map[string]string{"document-model": expression})
	const source = `
export const meta={apiVersion:1,key:"generic-settlement",name:"Generic settlement",version:"1.0.0",author:{name:"Test"},models:["document-model"],fetchMode:"per_task",usageSchema:{units:{type:"number",unit:"count"}}};
export function buildSubmitRequest(ctx){return {url:ctx.baseUrl+"/compile",body:ctx.requestBody};}
export function parseSubmitResponse(ctx,resp){return {taskId:"vendor-job",taskData:resp.body,immediate:{status:resp.body.status,reason:"provider rejected job"}};}
export function extractUsage(){return {units:4};}
export function extractUsageOnComplete(ctx,result,body){return body.usage;}
export function parseTaskResult(){throw new Error("completed submissions must not poll");}
export function buildQueryRequest(){throw new Error("completed submissions must not poll");}
`
	plugin, err := pluginruntime.CompilePlugin(source, pluginruntime.Options{})
	require.NoError(t, err)
	for index, tc := range []struct {
		name, status string
		actual       any
		count        float64
	}{
		{"partial", "SUCCESS", 2, 2}, {"zero", "SUCCESS", 0, 0}, {"larger", "SUCCESS", 6, 6},
		{"invalid usage", "SUCCESS", -1, 4}, {"expression failure", "SUCCESS", 7, 4}, {"negative result", "SUCCESS", 8, 4}, {"missing usage", "SUCCESS", nil, 4}, {"failed", "FAILURE", 9, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				body := map[string]any{"status": tc.status}
				if tc.actual != nil {
					body["usage"] = map[string]any{"units": tc.actual}
				}
				encoded, err := common.Marshal(body)
				if err != nil {
					panic(err)
				}
				_, _ = w.Write(encoded)
			}))
			defer server.Close()
			initial := int(20 * common.QuotaPerUnit)
			user := model.User{Username: fmt.Sprintf("task_user_%d", index), AffCode: fmt.Sprintf("task_aff_%d", index), Quota: initial}
			require.NoError(t, db.Create(&user).Error)
			ch := model.Channel{Name: "test provider", Type: constant.ChannelTypeTaskPlugin}
			require.NoError(t, db.Create(&ch).Error)
			c := taskSubmissionTestContext()
			c.Set("group", "default")
			c.Set("username", user.Username)
			c.Set("task_request", map[string]any{"model": "document-model"})
			c.Set(pluginruntime.ContextKeyPinnedPlugin, pluginruntime.PinnedPlugin{Plugin: plugin})
			common.SetContextKey(c, constant.ContextKeyOriginalModel, "document-model")
			common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, server.URL)
			common.SetContextKey(c, constant.ContextKeyChannelId, ch.Id)
			common.SetContextKey(c, constant.ContextKeyChannelType, ch.Type)
			info := taskSubmissionRelayInfo(nil)
			info.UserId = user.Id
			info.OriginModelName = "document-model"
			info.UserGroup = "default"
			info.UsingGroup = "default"
			info.IsPlayground = true
			info.UserSetting.BillingPreference = "wallet_only"
			info.PublicTaskID = model.GenerateTaskID()
			info.LockedChannel = &ch
			outcome, taskErr := executeTaskSubmission(c, info)
			require.Nil(t, taskErr)
			require.NotNil(t, outcome)
			want := common.QuotaRound(tc.count * 0.01 * common.QuotaPerUnit)
			assert.Equal(t, want, outcome.Result.Quota)
			assert.Equal(t, want, info.PriceData.Quota)
			var stored model.Task
			require.NoError(t, db.Where("task_id = ?", info.PublicTaskID).First(&stored).Error)
			assert.Equal(t, want, stored.Quota)
			assert.Equal(t, model.TaskStatus(tc.status), stored.Status)
			assert.Positive(t, stored.FinishTime)
			assert.Equal(t, float64(4), info.TieredBillingSnapshot.EstimatedQuotaBeforeGroup/(0.01*common.QuotaPerUnit))
			if tc.status == "SUCCESS" {
				assert.Equal(t, tc.count, stored.PrivateData.BillingContext.TieredSnapshot.UsageFacts["units"])
			}
			var updated model.User
			require.NoError(t, db.First(&updated, user.Id).Error)
			assert.Equal(t, initial-want, updated.Quota)
			assert.Equal(t, want, updated.UsedQuota)
			var logs []model.Log
			require.NoError(t, db.Where("user_id = ?", user.Id).Find(&logs).Error)
			require.Len(t, logs, 1)
			assert.Equal(t, want, logs[0].Quota)
			var other map[string]any
			require.NoError(t, common.UnmarshalJsonStr(logs[0].Other, &other))
			if tc.status == "SUCCESS" {
				assert.Equal(t, tc.count, other["usage_facts"].(map[string]any)["units"])
			}
			assert.False(t, c.Writer.Written(), "presentation must follow persistence and settlement")
			require.NoError(t, info.Billing.Settle(want))
			info.Billing.Refund(c)
			require.NoError(t, db.First(&updated, user.Id).Error)
			assert.Equal(t, initial-want, updated.Quota, "terminal settlement is idempotent")
		})
	}
}

func TestManagedTaskHealthPersistenceFailureStopsRetry(t *testing.T) {
	for _, failingTable := range []string{"upstream_managed_routes", "channels", "abilities"} {
		t.Run(failingTable, func(t *testing.T) {
			testManagedTaskHealthPersistenceFailureStopsRetry(t, failingTable)
		})
	}
}

func testManagedTaskHealthPersistenceFailureStopsRetry(t *testing.T, failingTable string) {
	events := []string{}
	database := setupTaskSubmissionDatabase(t, true, &events,
		&model.Channel{},
		&model.Ability{},
		&model.UpstreamManagedRoute{},
	)

	previousRetries := common.RetryTimes
	previousErrorLog := constant.ErrorLogEnabled
	common.RetryTimes = 1
	constant.ErrorLogEnabled = false
	t.Cleanup(func() {
		common.RetryTimes = previousRetries
		constant.ErrorLogEnabled = previousErrorLog
	})
	updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
		setting.Enabled = true
		setting.FailureThreshold = 3
	})

	autoBan := 1
	channel := model.Channel{
		Name: "managed-task", Key: "fixture-key", Type: constant.ChannelTypeTaskPlugin,
		Status: common.ChannelStatusEnabled, Group: "default", Models: "plugin-model",
		AutoBan: &autoBan,
	}
	require.NoError(t, database.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(database))
	route := model.UpstreamManagedRoute{
		SourceID: 1, ExternalGroupID: "managed-task", Platform: "task",
		Protocol: model.UpstreamProtocolOpenAI, ChannelID: channel.Id,
		State: model.UpstreamRouteStateActive,
	}
	require.NoError(t, database.Create(&route).Error)

	controlContext := taskSubmissionTestContext()
	common.SetContextKey(controlContext, constant.ContextKeyChannelId, channel.Id)
	common.SetContextKey(controlContext, constant.ContextKeyOriginalModel, "plugin-model")
	controlInfo := taskSubmissionRelayInfo(nil)
	controlInfo.LockedChannel = &channel
	controlAttempts := 0
	controlOutcome, controlErr := executeTaskSubmissionWith(controlContext, controlInfo, func(
		*gin.Context,
		*relaycommon.RelayInfo,
	) (*relay.TaskSubmitResult, *dto.TaskError) {
		controlAttempts++
		return nil, service.TaskErrorWrapper(
			errors.New("managed task upstream failed"),
			"managed_task_upstream_failed",
			http.StatusInternalServerError,
		)
	})
	assert.Nil(t, controlOutcome)
	require.NotNil(t, controlErr)
	assert.Equal(t, 2, controlAttempts, "fixture must exercise a non-zero retry budget")
	assert.False(t, common.GetContextKeyBool(controlContext, constant.ContextKeyManagedHealthPersistenceUncertain))
	require.NoError(t, database.Model(&model.UpstreamManagedRoute{}).
		Where("id = ?", route.ID).
		Updates(map[string]any{
			"state":                 model.UpstreamRouteStateActive,
			"consecutive_failures":  0,
			"consecutive_successes": 0,
			"failure_window_start":  0,
			"last_failure_at":       0,
			"last_reason":           "",
			"recovery_attempts":     0,
			"next_probe_at":         0,
		}).Error)
	updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
		setting.FailureThreshold = 1
	})

	injected := errors.New("injected managed task health persistence failure")
	const callbackName = "test:managed_task_health_persistence_failure"
	require.NoError(t, database.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == failingTable || strings.HasSuffix(tx.Statement.Table, "_"+failingTable) {
			tx.AddError(injected)
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, database.Callback().Update().Remove(callbackName))
	})

	c := taskSubmissionTestContext()
	common.SetContextKey(c, constant.ContextKeyChannelId, channel.Id)
	common.SetContextKey(c, constant.ContextKeyOriginalModel, "plugin-model")
	info := taskSubmissionRelayInfo(nil)
	info.LockedChannel = &channel
	attempts := 0

	outcome, taskErr := executeTaskSubmissionWith(c, info, func(
		*gin.Context,
		*relaycommon.RelayInfo,
	) (*relay.TaskSubmitResult, *dto.TaskError) {
		attempts++
		return nil, service.TaskErrorWrapper(
			errors.New("managed task upstream failed"),
			"managed_task_upstream_failed",
			http.StatusInternalServerError,
		)
	})

	assert.Nil(t, outcome)
	require.NotNil(t, taskErr)
	assert.Equal(t, 1, attempts)
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeyManagedHealthPersistenceUncertain))
	var storedChannel model.Channel
	require.NoError(t, database.First(&storedChannel, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusEnabled, storedChannel.Status)
	var storedAbility model.Ability
	require.NoError(t, database.Where("channel_id = ?", channel.Id).First(&storedAbility).Error)
	assert.True(t, storedAbility.Enabled)
	var storedRoute model.UpstreamManagedRoute
	require.NoError(t, database.First(&storedRoute, route.ID).Error)
	assert.Equal(t, model.UpstreamRouteStateActive, storedRoute.State)
	assert.Zero(t, storedRoute.ConsecutiveFailures)
}

func TestManagedTaskSubmissionUsesSharedFailoverBudget(t *testing.T) {
	for _, tc := range []struct {
		name                 string
		orchestrationEnabled bool
		managedRoutes        bool
		requestAttemptLimit  int
		retryTimes           int
		budgetSeconds        int
		delays               []time.Duration
		terminalAttempt      int
		wantAttempts         int
		wantFallbackReason   string
	}{
		{
			name:                 "first attempt exhausts shared budget",
			orchestrationEnabled: true,
			managedRoutes:        true,
			requestAttemptLimit:  5,
			retryTimes:           1,
			budgetSeconds:        1,
			delays:               []time.Duration{1100 * time.Millisecond},
			wantAttempts:         1,
			wantFallbackReason:   "failover_budget_exhausted",
		},
		{
			name:                 "retry remains within shared budget",
			orchestrationEnabled: true,
			managedRoutes:        true,
			requestAttemptLimit:  5,
			retryTimes:           1,
			budgetSeconds:        2,
			delays:               []time.Duration{0, 0},
			terminalAttempt:      2,
			wantAttempts:         2,
		},
		{
			name:                 "all managed attempts share one deadline",
			orchestrationEnabled: true,
			managedRoutes:        true,
			requestAttemptLimit:  5,
			retryTimes:           1,
			budgetSeconds:        1,
			delays:               []time.Duration{600 * time.Millisecond, 600 * time.Millisecond},
			wantAttempts:         2,
			wantFallbackReason:   "failover_budget_exhausted",
		},
		{
			name:                 "ordinary task path uses adaptive attempts",
			orchestrationEnabled: true,
			managedRoutes:        true,
			requestAttemptLimit:  5,
			retryTimes:           1,
			budgetSeconds:        10,
			delays:               []time.Duration{0, 0, 0},
			wantAttempts:         3,
		},
		{
			name:                 "unmanaged retry count remains compatible",
			orchestrationEnabled: false,
			requestAttemptLimit:  5,
			retryTimes:           1,
			budgetSeconds:        1,
			delays:               []time.Duration{0, 0},
			terminalAttempt:      2,
			wantAttempts:         2,
		},
		{
			name:                 "enabled orchestration does not expand unmanaged retries",
			orchestrationEnabled: true,
			requestAttemptLimit:  5,
			retryTimes:           0,
			budgetSeconds:        10,
			wantAttempts:         1,
		},
		{
			name:                 "managed request attempt limit caps adaptive retries",
			orchestrationEnabled: true,
			managedRoutes:        true,
			requestAttemptLimit:  1,
			retryTimes:           1,
			budgetSeconds:        10,
			wantAttempts:         1,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			events := []string{}
			database := setupTaskSubmissionDatabase(t, true, &events,
				&model.Channel{},
				&model.Ability{},
				&model.UpstreamManagedRoute{},
			)

			previousMemoryCache := common.MemoryCacheEnabled
			previousRetries := common.RetryTimes
			previousErrorLog := constant.ErrorLogEnabled
			common.MemoryCacheEnabled = true
			common.RetryTimes = tc.retryTimes
			constant.ErrorLogEnabled = false
			t.Cleanup(func() {
				common.MemoryCacheEnabled = previousMemoryCache
				common.RetryTimes = previousRetries
				constant.ErrorLogEnabled = previousErrorLog
			})
			updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
				setting.Enabled = tc.orchestrationEnabled
				setting.RequestAttemptLimit = tc.requestAttemptLimit
				setting.FailoverBudgetSeconds = tc.budgetSeconds
			})

			for index, priority := range []int64{30, 20, 10} {
				channel := model.Channel{
					Name: fmt.Sprintf("managed-task-budget-%d", index), Key: "fixture-key",
					Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled,
					Group: "default", Models: "plugin-model", Priority: &priority,
				}
				require.NoError(t, database.Create(&channel).Error)
				require.NoError(t, channel.AddAbilities(database))
				if tc.managedRoutes {
					require.NoError(t, database.Create(&model.UpstreamManagedRoute{
						SourceID: int64(index + 1), ExternalGroupID: fmt.Sprintf("budget-%d", index),
						Platform: "task", Protocol: model.UpstreamProtocolOpenAI,
						ChannelID: channel.Id, State: model.UpstreamRouteStateActive,
					}).Error)
				}
			}
			model.InitChannelCache()

			c := taskSubmissionTestContext()
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/tasks/test", strings.NewReader(`{}`))
			info := taskSubmissionRelayInfo(nil)
			info.LockedChannel = nil
			info.TokenGroup = "default"
			attempts := 0

			outcome, taskErr := executeTaskSubmissionWith(c, info, func(
				*gin.Context,
				*relaycommon.RelayInfo,
			) (*relay.TaskSubmitResult, *dto.TaskError) {
				if attempts < len(tc.delays) && tc.delays[attempts] > 0 {
					time.Sleep(tc.delays[attempts])
				}
				attempts++
				if attempts == tc.terminalAttempt {
					return nil, service.TaskErrorWrapper(
						errors.New("managed task request rejected"),
						"managed_task_request_rejected",
						http.StatusBadRequest,
					)
				}
				return nil, service.TaskErrorWrapper(
					errors.New("managed task upstream failed"),
					"managed_task_upstream_failed",
					http.StatusBadGateway,
				)
			})

			assert.Nil(t, outcome)
			require.NotNil(t, taskErr)
			assert.Equal(t, tc.wantAttempts, attempts)
			assert.Equal(t, tc.wantFallbackReason, c.GetString("channel_fallback_reason"))
		})
	}
}

func TestManagedTaskProviderDispatchRetryAndRefund(t *testing.T) {
	for _, tc := range []struct {
		name               string
		firstError         func() *dto.TaskError
		wantSuccess        bool
		wantAttempts       int
		wantRefunds        int
		wantWriteUncertain bool
	}{
		{
			name: "unknown provider write stops without refund",
			firstError: func() *dto.TaskError {
				taskErr := service.TaskErrorWrapper(
					errors.New("connection reset after request dispatch"),
					"do_request_failed",
					http.StatusInternalServerError,
				)
				taskErr.NoRetry = true
				taskErr.ProviderWriteUncertain = true
				return taskErr
			},
			wantAttempts:       1,
			wantWriteUncertain: true,
		},
		{
			name: "provider request not started retries",
			firstError: func() *dto.TaskError {
				return service.TaskErrorWrapper(
					channel.ErrProviderRequestNotStarted,
					"do_request_failed",
					http.StatusInternalServerError,
				)
			},
			wantSuccess:  true,
			wantAttempts: 2,
		},
		{
			name: "explicit provider 5xx retries",
			firstError: func() *dto.TaskError {
				return service.TaskErrorWrapper(
					errors.New("provider returned 502"),
					"fail_to_fetch_task",
					http.StatusBadGateway,
				)
			},
			wantSuccess:  true,
			wantAttempts: 2,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			events := []string{}
			database := setupTaskSubmissionDatabase(t, true, &events,
				&model.Channel{},
				&model.Ability{},
				&model.UpstreamManagedRoute{},
				&model.UpstreamSource{},
				&model.UpstreamGroup{},
				&model.User{},
			)

			previousMemoryCache := common.MemoryCacheEnabled
			previousRedis := common.RedisEnabled
			previousBatchUpdate := common.BatchUpdateEnabled
			previousLogConsume := common.LogConsumeEnabled
			previousRetries := common.RetryTimes
			previousErrorLog := constant.ErrorLogEnabled
			common.MemoryCacheEnabled = true
			common.RedisEnabled = false
			common.BatchUpdateEnabled = false
			common.LogConsumeEnabled = false
			common.RetryTimes = 0
			constant.ErrorLogEnabled = false
			t.Cleanup(func() {
				common.MemoryCacheEnabled = previousMemoryCache
				common.RedisEnabled = previousRedis
				common.BatchUpdateEnabled = previousBatchUpdate
				common.LogConsumeEnabled = previousLogConsume
				common.RetryTimes = previousRetries
				constant.ErrorLogEnabled = previousErrorLog
			})
			updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
				setting.Enabled = true
				setting.FailoverBudgetSeconds = 10
			})
			require.NoError(t, database.Create(&model.User{
				Id: 1, Username: "managed-dispatch-user", Status: common.UserStatusEnabled,
			}).Error)

			autoBan := 0
			for index, priority := range []int64{20, 10} {
				sourceID := int64(index + 1)
				externalGroupID := fmt.Sprintf("dispatch-%d", index)
				require.NoError(t, database.Create(&model.UpstreamSource{
					ID: sourceID, Key: fmt.Sprintf("dispatch-source-%d", index),
					Name: "Dispatch Source", ConsoleURL: "https://example.com",
				}).Error)
				require.NoError(t, database.Create(&model.UpstreamGroup{
					SourceID: sourceID, ExternalID: externalGroupID,
					Name: "Dispatch Group", Platform: "task",
				}).Error)
				channel := model.Channel{
					Name: fmt.Sprintf("managed-dispatch-%d", index), Key: "fixture-key",
					Type: constant.ChannelTypeTaskPlugin, Status: common.ChannelStatusEnabled,
					Group: "default", Models: "plugin-model", Priority: &priority,
					AutoBan: &autoBan,
				}
				require.NoError(t, database.Create(&channel).Error)
				require.NoError(t, channel.AddAbilities(database))
				require.NoError(t, database.Create(&model.UpstreamManagedRoute{
					SourceID: sourceID, ExternalGroupID: externalGroupID,
					Platform: "task", Protocol: model.UpstreamProtocolOpenAI,
					ChannelID: channel.Id, State: model.UpstreamRouteStateActive,
				}).Error)
			}
			model.InitChannelCache()
			events = nil

			c := taskSubmissionTestContext()
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/tasks/test", strings.NewReader(`{}`))
			billing := &taskSubmissionTestBilling{events: &events}
			info := taskSubmissionRelayInfo(billing)
			info.LockedChannel = nil
			info.TokenGroup = "default"
			retryBudget := service.AdaptiveRetryTimes(&service.RetryParam{
				Ctx: c, TokenGroup: info.TokenGroup, ModelName: info.OriginModelName,
			})
			require.GreaterOrEqual(t, retryBudget, 1, "fixture must provide a real retry budget")
			attempts := 0

			outcome, taskErr := executeTaskSubmissionWith(c, info, func(
				*gin.Context,
				*relaycommon.RelayInfo,
			) (*relay.TaskSubmitResult, *dto.TaskError) {
				attempts++
				if attempts == 1 {
					return nil, tc.firstError()
				}
				return &relay.TaskSubmitResult{
					UpstreamTaskID:   "upstream-private",
					Platform:         constant.TaskPlatform("plugin"),
					ProviderAccepted: true,
				}, nil
			})

			assert.Equal(t, tc.wantAttempts, attempts)
			assert.Equal(t, tc.wantRefunds, billing.refunds)
			if tc.wantSuccess {
				require.Nil(t, taskErr)
				require.NotNil(t, outcome)
				assert.Equal(t, []string{"reserve", "insert", "settle"}, events)
				return
			}
			assert.Nil(t, outcome)
			require.NotNil(t, taskErr)
			assert.True(t, taskErr.NoRetry)
			assert.Equal(t, tc.wantWriteUncertain, taskErr.ProviderWriteUncertain)
			assert.False(t, taskErr.ProviderAccepted)
			assert.Empty(t, events)
			policyEvents := service.RequestPolicy(c).Events()
			require.NotEmpty(t, policyEvents)
			assert.Equal(t, service.PolicyDecision{
				Action: "stop", Reason: "provider_write_uncertain", Source: "system",
			}, policyEvents[len(policyEvents)-1].Decision)
		})
	}
}

func TestManagedLockedTaskUsesConfiguredRetryBudget(t *testing.T) {
	for _, tc := range []struct {
		name         string
		configure    func(*gin.Context, int)
		wantAttempts int
	}{
		{
			name: "same-channel pin retries",
			configure: func(c *gin.Context, channelID int) {
				service.GetChannelConstraints(c).AddPin(dto.ChannelPin{
					ChannelId: channelID,
					Source:    dto.PinSourceOriginTask,
					Rank:      dto.PinRankOriginTask,
					RetryMode: dto.PinRetrySameChannel,
				})
			},
			wantAttempts: 2,
		},
		{
			name: "single-attempt pin stays single",
			configure: func(c *gin.Context, channelID int) {
				service.GetChannelConstraints(c).AddPin(dto.ChannelPin{
					ChannelId: channelID,
					Source:    dto.PinSourceToken,
					Rank:      dto.PinRankToken,
					RetryMode: dto.PinRetrySingleAttempt,
				})
			},
			wantAttempts: 1,
		},
		{
			name: "strict session stays single",
			configure: func(c *gin.Context, _ int) {
				c.Set("channel_affinity_skip_retry_on_failure", true)
				service.RequestPolicy(c).SessionModeSource = "global"
			},
			wantAttempts: 1,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			events := []string{}
			database := setupTaskSubmissionDatabase(t, true, &events,
				&model.Channel{},
				&model.Ability{},
				&model.UpstreamManagedRoute{},
			)

			previousRetries := common.RetryTimes
			previousErrorLog := constant.ErrorLogEnabled
			common.RetryTimes = 1
			constant.ErrorLogEnabled = false
			t.Cleanup(func() {
				common.RetryTimes = previousRetries
				constant.ErrorLogEnabled = previousErrorLog
			})
			updateUpstreamOrchestrationForTest(t, func(setting *operation_setting.UpstreamOrchestrationSetting) {
				setting.Enabled = true
				setting.FailoverBudgetSeconds = 10
			})

			autoBan := 0
			channel := model.Channel{
				Name: "managed-locked-task", Key: "fixture-key",
				Type: constant.ChannelTypeTaskPlugin, Status: common.ChannelStatusEnabled,
				Group: "default", Models: "plugin-model", AutoBan: &autoBan,
			}
			require.NoError(t, database.Create(&channel).Error)
			require.NoError(t, channel.AddAbilities(database))
			require.NoError(t, database.Create(&model.UpstreamManagedRoute{
				SourceID: 1, ExternalGroupID: "managed-locked-task",
				Platform: "task", Protocol: model.UpstreamProtocolOpenAI,
				ChannelID: channel.Id, State: model.UpstreamRouteStateActive,
			}).Error)

			c := taskSubmissionTestContext()
			tc.configure(c, channel.Id)
			info := taskSubmissionRelayInfo(nil)
			info.LockedChannel = &channel
			attempts := 0

			outcome, taskErr := executeTaskSubmissionWith(c, info, func(
				*gin.Context,
				*relaycommon.RelayInfo,
			) (*relay.TaskSubmitResult, *dto.TaskError) {
				attempts++
				return nil, service.TaskErrorWrapper(
					errors.New("retryable provider response"),
					"fail_to_fetch_task",
					http.StatusBadGateway,
				)
			})

			assert.Nil(t, outcome)
			require.NotNil(t, taskErr)
			assert.Equal(t, tc.wantAttempts, attempts)
			wantChannels := make([]string, tc.wantAttempts)
			for index := range wantChannels {
				wantChannels[index] = fmt.Sprintf("%d", channel.Id)
			}
			assert.Equal(t, wantChannels, c.GetStringSlice("use_channel"))
		})
	}
}

func TestAcceptedSubmitStreamNeverRetries(t *testing.T) {
	c := taskSubmissionTestContext()
	assert.Equal(t, service.PolicyDecision{Action: "stop", Reason: "task_accepted", Source: "system"}, decideTaskRetry(c, &dto.TaskError{StatusCode: 502, LocalError: true, NoRetry: true}, 3))
}

func TestExecuteTaskSubmissionLocalNoRetryFailureStillRefunds(t *testing.T) {
	events := make([]string, 0, 1)
	setupTaskSubmissionDatabase(t, true, &events)
	billing := &taskSubmissionTestBilling{events: &events}
	c := taskSubmissionTestContext()
	info := taskSubmissionRelayInfo(billing)

	outcome, taskErr := executeTaskSubmissionWith(c, info, func(*gin.Context, *relaycommon.RelayInfo) (*relay.TaskSubmitResult, *dto.TaskError) {
		localErr := service.TaskErrorWrapperLocal(errors.New("local failure"), "local_failure", http.StatusBadRequest)
		localErr.NoRetry = true
		return nil, localErr
	})

	assert.Nil(t, outcome)
	require.NotNil(t, taskErr)
	assert.True(t, taskErr.NoRetry)
	assert.False(t, taskErr.ProviderAccepted)
	assert.Equal(t, []string{"refund"}, events)
	assert.Equal(t, 1, billing.refunds)
	assert.False(t, c.Writer.Written())
}

// Local task rejections carry a message but no cause; the response and the
// decision record must still be produced.
func TestRespondTaskSubmissionErrorWithoutCause(t *testing.T) {
	previousErrorLog := constant.ErrorLogEnabled
	constant.ErrorLogEnabled = false
	t.Cleanup(func() { constant.ErrorLogEnabled = previousErrorLog })
	c := taskSubmissionTestContext()
	taskErr := &dto.TaskError{Code: "get_channel_failed", Message: "no channel", StatusCode: http.StatusServiceUnavailable, LocalError: true}
	require.NotPanics(t, func() { respondTaskSubmissionError(c, taskErr) })
	assert.Equal(t, http.StatusServiceUnavailable, c.Writer.Status())
	events := service.RequestPolicy(c).Events()
	require.Len(t, events, 1)
	assert.Equal(t, service.PolicyDecision{Action: "stop", Reason: "request_failed", Source: "system"}, events[0].Decision)
	assert.Equal(t, http.StatusServiceUnavailable, events[0].Status)
	assert.Equal(t, service.PolicyDecision{Action: "stop", Reason: "local_rejection", Source: "system"}, decideTaskRetry(c, &dto.TaskError{StatusCode: http.StatusForbidden, LocalError: true, Message: "billing"}, 2), "local errors stop once the status rules do not force a retry")
}

func TestExecuteTaskSubmissionRefundsWhenFinalReserveFails(t *testing.T) {
	events := []string{}
	setupTaskSubmissionDatabase(t, true, &events)
	billing := &taskSubmissionTestBilling{events: &events, reserveErr: errors.New("insufficient funds")}
	c := taskSubmissionTestContext()
	info := taskSubmissionRelayInfo(billing)
	outcome, taskErr := executeTaskSubmissionWith(c, info, func(*gin.Context, *relaycommon.RelayInfo) (*relay.TaskSubmitResult, *dto.TaskError) {
		return &relay.TaskSubmitResult{Platform: "plugin", Quota: 600, Immediate: &relaycommon.TaskInfo{Status: "SUCCESS"}}, nil
	})
	require.Nil(t, outcome)
	require.NotNil(t, taskErr)
	assert.Equal(t, http.StatusForbidden, taskErr.StatusCode)
	assert.Equal(t, []string{"reserve", "refund"}, events)
	assert.Equal(t, 1, billing.refunds)
	assert.False(t, c.Writer.Written())
}

func TestExecuteTaskSubmissionAcceptedResultDoesNotRefundWhenFinalReserveFails(t *testing.T) {
	events := []string{}
	setupTaskSubmissionDatabase(t, true, &events)
	billing := &taskSubmissionTestBilling{events: &events, reserveErr: errors.New("insufficient funds")}
	c := taskSubmissionTestContext()
	info := taskSubmissionRelayInfo(billing)

	outcome, taskErr := executeTaskSubmissionWith(c, info, func(*gin.Context, *relaycommon.RelayInfo) (*relay.TaskSubmitResult, *dto.TaskError) {
		return &relay.TaskSubmitResult{
			Platform:         "plugin",
			Quota:            600,
			Immediate:        &relaycommon.TaskInfo{Status: "SUCCESS"},
			ProviderAccepted: true,
		}, nil
	})

	require.Nil(t, outcome)
	require.NotNil(t, taskErr)
	assert.Equal(t, http.StatusForbidden, taskErr.StatusCode)
	assert.True(t, taskErr.NoRetry)
	assert.True(t, taskErr.ProviderAccepted)
	assert.Equal(t, []string{"reserve"}, events)
	assert.Zero(t, billing.refunds)
	assert.False(t, c.Writer.Written())
}
