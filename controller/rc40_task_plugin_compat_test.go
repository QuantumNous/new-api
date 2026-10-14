package controller

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	gormmysql "gorm.io/driver/mysql"
	gormpostgres "gorm.io/driver/postgres"
	"gorm.io/gorm"
)

const rc40TaskPluginSourceLimit = 8 << 20

func TestRC40TaskPluginUploadBoundary(t *testing.T) {
	rc40SnapshotTaskPluginRuntime(t)
	const sentinelKey = "rc40-upload-boundary-sentinel"
	_, err := jsplugin.DefaultRegistry.Register(taskPluginControllerTestSource(sentinelKey, "1.0.0"), jsplugin.Options{})
	require.NoError(t, err)

	upload := func(t *testing.T, source string) *httptest.ResponseRecorder {
		t.Helper()
		body, err := common.Marshal(map[string]any{"source": source})
		require.NoError(t, err)
		recorder := httptest.NewRecorder()
		context, _ := gin.CreateTestContext(recorder)
		context.Request = httptest.NewRequest(http.MethodPost, "/api/plugin/task", bytes.NewReader(body))
		context.Request.Header.Set("Content-Type", "application/json")
		UploadTaskPlugin(context)
		return recorder
	}

	t.Run("accepts exactly eight MiB", func(t *testing.T) {
		rc40SnapshotTaskPluginRuntime(t)
		setupTaskPluginControllerTest(t)
		const key = "rc40-eight-mib"
		cleanupTaskPluginControllerRuntime(t, key)
		source := rc40TaskPluginSourceWithSize(t, key, rc40TaskPluginSourceLimit)

		recorder := upload(t, source)

		require.Contains(t, recorder.Body.String(), `"success":true`)
		stored, err := model.GetTaskPluginVersion(key, "1.0.0")
		require.NoError(t, err)
		assert.Equal(t, source, string(stored.Source))
	})

	t.Run("rejects eight MiB plus one before persistence", func(t *testing.T) {
		rc40SnapshotTaskPluginRuntime(t)
		setupTaskPluginControllerTest(t)
		const key = "rc40-over-eight-mib"
		cleanupTaskPluginControllerRuntime(t, key)
		source := rc40TaskPluginSourceWithSize(t, key, rc40TaskPluginSourceLimit+1)

		recorder := upload(t, source)

		assert.Contains(t, recorder.Body.String(), `"success":false`)
		assert.Contains(t, recorder.Body.String(), "plugin source exceeds 8 MiB")
		_, err := model.GetTaskPluginVersion(key, "1.0.0")
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})

	_, sentinelPresent := jsplugin.DefaultRegistry.Get(sentinelKey)
	assert.True(t, sentinelPresent, "boundary subtests must restore unrelated task plugins")
}

func TestRC40TaskPluginStorageAndSyncContract(t *testing.T) {
	t.Run("payload column types are portable", func(t *testing.T) {
		databases := map[string]*gorm.DB{
			"mysql": rc40OpenDryRunDatabase(t, gormmysql.New(gormmysql.Config{
				DSN:                       "gorm:gorm@tcp(127.0.0.1:9910)/gorm?charset=utf8&parseTime=True&loc=Local",
				SkipInitializeWithVersion: true,
			})),
			"postgres": rc40OpenDryRunDatabase(t, gormpostgres.New(gormpostgres.Config{
				DSN:                  "host=127.0.0.1 user=gorm password=gorm dbname=gorm port=9920 sslmode=disable",
				PreferSimpleProtocol: true,
			})),
			"sqlite": rc40OpenDryRunDatabase(t, sqlite.Open(":memory:")),
		}
		want := map[string]string{
			"mysql":    "LONGTEXT",
			"postgres": "TEXT",
			"sqlite":   "TEXT",
		}

		for dialect, database := range databases {
			t.Run(dialect, func(t *testing.T) {
				statement := &gorm.Statement{DB: database}
				require.NoError(t, statement.Parse(&model.TaskPlugin{}))
				for _, fieldName := range []string{"Source", "Icon"} {
					field := statement.Schema.LookUpField(fieldName)
					require.NotNil(t, field)
					dataType := strings.ToUpper(strings.Fields(database.Migrator().FullDataTypeOf(field).SQL)[0])
					assert.Equal(t, want[dialect], dataType, fieldName)
				}
			})
		}
	})
	t.Run("changed hash loads omitted source by immutable row id", rc40AssertTaskPluginSyncQuery)
}

func rc40AssertTaskPluginSyncQuery(t *testing.T) {
	rc40SnapshotTaskPluginRuntime(t)
	setupTaskPluginControllerTest(t)
	const key = "rc40-sync-row"
	const oldSource = `
export const meta = {apiVersion: 1, key: "rc40-sync-row", name: "Test", version: "1.0.0", author: {name: "Test"}, models: ["doc-1"], fetchMode: "per_task"};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {status: "SUCCESS", marker: "old"}; }
`
	const newSource = `
export const meta = {apiVersion: 1, key: "rc40-sync-row", name: "Test", version: "1.0.0", author: {name: "Test"}, models: ["doc-1"], fetchMode: "per_task"};
export function buildSubmitRequest() { return {}; }
export function parseSubmitResponse() { return {}; }
export function buildQueryRequest() { return {}; }
export function parseTaskResult() { return {status: "SUCCESS", marker: "new"}; }
`
	require.NoError(t, jsplugin.DefaultRegistry.Unregister(key))
	cleanupTaskPluginControllerRuntime(t, key)
	incumbent, err := jsplugin.DefaultRegistry.Register(oldSource, jsplugin.Options{})
	require.NoError(t, err)
	oldResult, err := incumbent.Engine.Call(context.Background(), "parseTaskResult")
	require.NoError(t, err)
	oldObject, ok := oldResult.(map[string]any)
	require.True(t, ok)
	require.Equal(t, "old", oldObject["marker"])
	taskPluginSyncState.Lock()
	taskPluginSyncState.hashes[key] = "old-hash"
	delete(taskPluginSyncState.errors, key)
	taskPluginSyncState.Unlock()

	plugin := model.TaskPlugin{
		Key: key, APIVersion: 1, Version: "1.0.0",
		Source: newSource, SourceHash: "new-hash", Icon: "data:image/png;base64,AA==", Enabled: true,
	}
	require.NoError(t, model.SaveTaskPlugin(&plugin))

	snapshot, err := model.GetTaskPluginSyncSnapshot()
	require.NoError(t, err)
	require.Len(t, snapshot.Plugins, 1)
	assert.Equal(t, plugin.Id, snapshot.Plugins[0].Id)
	assert.Equal(t, plugin.SourceHash, snapshot.Plugins[0].SourceHash)
	assert.Empty(t, snapshot.Plugins[0].Source)
	assert.Empty(t, snapshot.Plugins[0].Icon)

	type queryRecord struct {
		sql  string
		vars []any
	}
	queries := make([]queryRecord, 0, 2)
	const callback = "test:rc40-task-plugin-source-query"
	require.NoError(t, model.DB.Callback().Query().After("gorm:query").Register(callback, func(tx *gorm.DB) {
		queries = append(queries, queryRecord{
			sql:  strings.ToLower(tx.Statement.SQL.String()),
			vars: append([]any(nil), tx.Statement.Vars...),
		})
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Query().Remove(callback))
	})

	require.NoError(t, syncTaskPluginsOnce())

	immutableSourceLoads := 0
	for _, query := range queries {
		if strings.Contains(query.sql, "select `source`") &&
			strings.Contains(query.sql, "`id` = ?") &&
			len(query.vars) > 0 && query.vars[0] == plugin.Id {
			immutableSourceLoads++
		}
	}
	assert.Equal(t, 1, immutableSourceLoads, "changed source must be loaded exactly once by immutable row id; queries=%v", queries)
	loaded, ok := jsplugin.DefaultRegistry.Get(key)
	require.True(t, ok)
	assert.Equal(t, "1.0.0", loaded.Meta.Version)
	newResult, err := loaded.Engine.Call(context.Background(), "parseTaskResult")
	require.NoError(t, err)
	newObject, ok := newResult.(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "new", newObject["marker"])
}

func TestRC40TaskPluginAcceptedParseFailureDoesNotRefund(t *testing.T) {
	service.InitHttpClient()
	withTieredBillingConfig(
		t,
		map[string]string{"declared-model": "tiered_expr"},
		map[string]string{"declared-model": `tier("flat", 3)`},
	)

	events := make([]string, 0, 1)
	setupTaskSubmissionDatabase(t, true, &events)
	var requests atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"job-42"}`))
	}))
	defer upstream.Close()

	const source = `
export const meta = {apiVersion:1,key:"rc40-parse-refund",name:"RC40 Parse Refund",version:"1.0.0",author:{name:"Test"},models:["declared-model"],fetchMode:"per_task"};
export function buildSubmitRequest(ctx){return {url:ctx.baseUrl+"/submit",method:"POST",body:{model:ctx.model},action:"text_to_video"}}
export function parseSubmitResponse(){throw new Error("rc40 parse failure")}
export function buildQueryRequest(ctx){return {url:ctx.baseUrl+"/query"}}
export function parseTaskResult(){return {status:"SUCCESS"}}
`
	plugin, err := jsplugin.NewRegistry().Register(source, jsplugin.Options{})
	require.NoError(t, err)

	context := taskSubmissionTestContext()
	context.Set("group", "default")
	context.Set("task_request", map[string]any{"prompt": "p"})
	context.Set(jsplugin.ContextKeyPinnedPlugin, jsplugin.PinnedPlugin{Plugin: plugin})
	common.SetContextKey(context, constant.ContextKeyOriginalModel, "declared-model")
	common.SetContextKey(context, constant.ContextKeyChannelBaseUrl, upstream.URL)
	common.SetContextKey(context, constant.ContextKeyChannelId, 1)
	common.SetContextKey(context, constant.ContextKeyChannelType, constant.ChannelTypeTaskPlugin)

	billing := &taskSubmissionTestBilling{events: &events}
	info := taskSubmissionRelayInfo(billing)
	info.UserGroup, info.UsingGroup = "default", "default"
	info.OriginModelName = "declared-model"

	outcome, taskErr := executeTaskSubmission(context, info)

	assert.EqualValues(t, 1, requests.Load())
	assert.Nil(t, outcome)
	require.NotNil(t, taskErr)
	assert.Equal(t, "plugin_submit_response_failed", taskErr.Code)
	assert.True(t, taskErr.NoRetry)
	assert.True(t, taskErr.ProviderAccepted)
	assert.Empty(t, events)
	assert.Zero(t, billing.refunds)
}

func TestRC40TaskPluginAcceptedPersistenceFailureIsNonRetryable(t *testing.T) {
	service.InitHttpClient()
	withTieredBillingConfig(
		t,
		map[string]string{"declared-model": "tiered_expr"},
		map[string]string{"declared-model": `tier("flat", 3)`},
	)

	events := make([]string, 0, 3)
	database := setupTaskSubmissionDatabase(t, true, &events)
	const callback = "test:rc40-task-persist-failure"
	require.NoError(t, database.Callback().Create().Before("gorm:create").Register(callback, func(tx *gorm.DB) {
		if tx.Statement.Schema != nil && tx.Statement.Schema.Name == "Task" {
			tx.AddError(errors.New("injected task persistence failure"))
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, database.Callback().Create().Remove(callback))
	})

	var requests atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"job-42"}`))
	}))
	defer upstream.Close()

	const source = `
export const meta = {apiVersion:1,key:"rc40-persist",name:"RC40 Persist",version:"1.0.0",author:{name:"Test"},models:["declared-model"],fetchMode:"per_task"};
export function buildSubmitRequest(ctx){return {url:ctx.baseUrl+"/submit",method:"POST",body:{model:ctx.model},action:"text_to_video"}}
export function parseSubmitResponse(ctx,response){return {taskId:response.body.id,taskData:{accepted:true}}}
export function buildQueryRequest(ctx){return {url:ctx.baseUrl+"/query"}}
export function parseTaskResult(){return {status:"SUCCESS"}}
`
	plugin, err := jsplugin.NewRegistry().Register(source, jsplugin.Options{})
	require.NoError(t, err)

	context := taskSubmissionTestContext()
	context.Set("group", "default")
	context.Set("task_request", map[string]any{"prompt": "p"})
	context.Set(jsplugin.ContextKeyPinnedPlugin, jsplugin.PinnedPlugin{Plugin: plugin})
	common.SetContextKey(context, constant.ContextKeyOriginalModel, "declared-model")
	common.SetContextKey(context, constant.ContextKeyChannelBaseUrl, upstream.URL)
	common.SetContextKey(context, constant.ContextKeyChannelId, 1)
	common.SetContextKey(context, constant.ContextKeyChannelType, constant.ChannelTypeTaskPlugin)

	billing := &taskSubmissionTestBilling{events: &events}
	info := taskSubmissionRelayInfo(billing)
	info.UserGroup, info.UsingGroup = "default", "default"
	info.OriginModelName = "declared-model"

	outcome, taskErr := executeTaskSubmission(context, info)

	assert.EqualValues(t, 1, requests.Load())
	assert.Nil(t, outcome)
	require.NotNil(t, taskErr)
	assert.Equal(t, "task_insert_failed", taskErr.Code)
	assert.True(t, taskErr.NoRetry, "an accepted provider operation must not be submitted again")
	assert.True(t, taskErr.ProviderAccepted)
	assert.Equal(t, []string{"reserve", "insert"}, events)
	assert.Zero(t, billing.refunds)
	var persisted int64
	require.NoError(t, database.Model(&model.Task{}).Count(&persisted).Error)
	assert.Zero(t, persisted)
}

func rc40SnapshotTaskPluginRuntime(t *testing.T) {
	t.Helper()
	previousOverridesByKey := jsplugin.DefaultRegistry.OverridePlugins()
	previousOverrides := make([]*jsplugin.LoadedPlugin, 0, len(previousOverridesByKey))
	for _, plugin := range previousOverridesByKey {
		previousOverrides = append(previousOverrides, plugin)
	}

	taskPluginSyncState.Lock()
	previousHashes := maps.Clone(taskPluginSyncState.hashes)
	previousErrors := maps.Clone(taskPluginSyncState.errors)
	previousLastRebuild := taskPluginSyncState.lastRebuild
	taskPluginSyncState.Unlock()

	t.Cleanup(func() {
		restoreRegistryErr := jsplugin.DefaultRegistry.ReplaceOverrides(previousOverrides)
		taskPluginSyncState.Lock()
		taskPluginSyncState.hashes = previousHashes
		taskPluginSyncState.errors = previousErrors
		taskPluginSyncState.lastRebuild = previousLastRebuild
		taskPluginSyncState.Unlock()
		require.NoError(t, restoreRegistryErr)
	})
}

func rc40TaskPluginSourceWithSize(t *testing.T, key string, size int) string {
	t.Helper()
	prefix := fmt.Sprintf(`
export const meta = {apiVersion:1,key:%q,name:"RC40",version:"1.0.0",author:{name:"Test"},models:["doc"],fetchMode:"per_task"};
export function buildSubmitRequest(){return {}}
export function parseSubmitResponse(){return {taskId:"1"}}
export function buildQueryRequest(){return {}}
export function parseTaskResult(){return {status:"SUCCESS"}}
/*`, key)
	const suffix = "*/"
	require.GreaterOrEqual(t, size, len(prefix)+len(suffix))
	return prefix + strings.Repeat("x", size-len(prefix)-len(suffix)) + suffix
}

func rc40OpenDryRunDatabase(t *testing.T, dialector gorm.Dialector) *gorm.DB {
	t.Helper()
	database, err := gorm.Open(dialector, &gorm.Config{
		DryRun:               true,
		DisableAutomaticPing: true,
	})
	require.NoError(t, err)
	return database
}
