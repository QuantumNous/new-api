package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// useNodeSync installs a database with the sync tables (TEST_TASK_DB_DIALECT
// selects it, see useProviderPluginDatabase) and an empty topic registry.
func useNodeSync(t *testing.T) *gorm.DB {
	t.Helper()
	database := useProviderPluginDatabase(t)
	tables := []any{&model.SystemTask{}, &model.SystemInstance{}, &model.Option{}}
	require.NoError(t, database.AutoMigrate(tables...))
	t.Cleanup(func() { require.NoError(t, database.Migrator().DropTable(tables...)) })
	previousRegistry, previousNodeName := nodeSync, common.NodeName
	nodeSync = newNodeSyncRegistry()
	t.Cleanup(func() { nodeSync, common.NodeName = previousRegistry, previousNodeName })
	return database
}

// storedSyncTopics is the id of the newest sync task of each topic.
func storedSyncTopics(t *testing.T) map[string]int64 {
	t.Helper()
	revisions, err := model.GetLatestSyncRevisions()
	require.NoError(t, err)
	return revisions
}

// Every bump adds its own pending task, none of them deduplicated against
// the active ones, so no write is lost.
func TestBumpSyncTopicAddsAPendingTask(t *testing.T) {
	useNodeSync(t)
	common.NodeName = "node-a"
	model.BumpSyncTopic("alpha")
	model.BumpSyncTopic("beta")
	first := storedSyncTopics(t)
	require.Len(t, first, 2)

	common.NodeName = "node-b"
	model.BumpSyncTopic("alpha")
	second := storedSyncTopics(t)
	assert.Greater(t, second["alpha"], first["alpha"])
	assert.Equal(t, first["beta"], second["beta"])

	var tasks []model.SystemTask
	require.NoError(t, model.DB.Order("id").Find(&tasks).Error)
	require.Len(t, tasks, 3)
	for index, want := range []struct{ taskType, node string }{{"sync_alpha", "node-a"}, {"sync_beta", "node-a"}, {"sync_alpha", "node-b"}} {
		assert.Equal(t, want.taskType, tasks[index].Type)
		assert.Equal(t, model.SystemTaskStatusPending, tasks[index].Status)
		assert.Nil(t, tasks[index].ActiveKey)
		assert.JSONEq(t, `{"node":"`+want.node+`"}`, tasks[index].Payload)
	}
}

func TestNodeSyncReloadsTopicsWhoseRevisionChanged(t *testing.T) {
	useNodeSync(t)
	ctx := context.Background()
	reloads := map[string]int{}
	var betaErr error
	bumpDuringAlpha := false
	RegisterSyncTopic("alpha", func(context.Context) error {
		reloads["alpha"]++
		if bumpDuringAlpha {
			bumpDuringAlpha = false
			model.BumpSyncTopic("alpha")
		}
		return nil
	})
	RegisterSyncTopic("beta", func(context.Context) error {
		reloads["beta"]++
		return betaErr
	})

	// Topics never applied load on the first tick; then nothing changed.
	require.True(t, syncNodeTopics(ctx))
	require.False(t, syncNodeTopics(ctx))
	assert.Equal(t, map[string]int{"alpha": 1, "beta": 1}, reloads)

	model.BumpSyncTopic("alpha")
	require.True(t, syncNodeTopics(ctx))
	require.False(t, syncNodeTopics(ctx))
	assert.Equal(t, map[string]int{"alpha": 2, "beta": 1}, reloads)
	assert.Equal(t, storedSyncTopics(t)["alpha"], NodeSyncStates()["alpha"].Revision)

	// A failed reload keeps the revision applied before, records the error and
	// runs again on the next tick.
	applied := NodeSyncStates()["beta"]
	betaErr = errors.New("database is down")
	model.BumpSyncTopic("beta")
	require.True(t, syncNodeTopics(ctx))
	failed := NodeSyncStates()["beta"]
	assert.Equal(t, applied.Revision, failed.Revision)
	assert.Equal(t, applied.AppliedAt, failed.AppliedAt)
	assert.Equal(t, "database is down", failed.Error)
	require.True(t, syncNodeTopics(ctx))
	assert.Equal(t, 3, reloads["beta"])
	betaErr = nil
	require.True(t, syncNodeTopics(ctx))
	require.False(t, syncNodeTopics(ctx))
	recovered := NodeSyncStates()["beta"]
	assert.Equal(t, storedSyncTopics(t)["beta"], recovered.Revision)
	assert.Empty(t, recovered.Error)

	// A write during the reload runs it again on the next tick.
	bumpDuringAlpha = true
	model.BumpSyncTopic("alpha")
	require.True(t, syncNodeTopics(ctx))
	require.True(t, syncNodeTopics(ctx))
	require.False(t, syncNodeTopics(ctx))
	assert.Equal(t, 4, reloads["alpha"])
}

func TestNodeSyncAppliesAnOptionAnotherNodeWrote(t *testing.T) {
	database := useNodeSync(t)
	originalOptions := common.OptionMap
	common.OptionMap = map[string]string{}
	originalInstances, err := common.Marshal(request_plugin_setting.GetInstances())
	require.NoError(t, err)
	t.Cleanup(func() {
		common.OptionMap = originalOptions
		require.NoError(t, config.UpdateConfigFromMap(config.GlobalConfig.Get("request_plugin_setting"), map[string]string{"instances": string(originalInstances)}))
	})
	RegisterSyncTopic(model.SyncTopicOptions, func(context.Context) error { return model.LoadOptionsFromDatabase() })
	require.True(t, syncNodeTopics(context.Background()))

	// Another node saves a request plugin instance and bumps the topic.
	instances := `[{"id":"rp_remote","name":"Remote","plugin":"request-filter","enabled":true,"global":true,"groups":[],"models":[],"config":{}}]`
	require.NoError(t, database.Create(&model.Option{Key: request_plugin_setting.InstancesOption, Value: instances}).Error)
	model.BumpSyncTopic(model.SyncTopicOptions)

	require.True(t, syncNodeTopics(context.Background()))
	applied := request_plugin_setting.GetInstances()
	require.Len(t, applied, 1)
	assert.Equal(t, "rp_remote", applied[0].ID)
	assert.Equal(t, instances, common.OptionMap[request_plugin_setting.InstancesOption])
}

// Each node is judged by the topics it keeps: the status lists those of this
// node and of every online node, and a node that reports other topics but not
// one reads that data straight from the database, so it is synced.
func TestNodeSyncStatusComparesEveryNodeWithTheLatestRevision(t *testing.T) {
	useNodeSync(t)
	noop := func(context.Context) error { return nil }
	RegisterSyncTopic("beta", noop)
	RegisterSyncTopic("alpha", noop)
	require.NoError(t, model.DB.Create(&[]model.SystemTask{
		{ID: 10, TaskID: "alpha-old", Type: "sync_alpha", Status: model.SystemTaskStatusSucceeded, Payload: `{"node":"node-b"}`, CreatedAt: 90},
		{ID: 20, TaskID: "alpha", Type: "sync_alpha", Status: model.SystemTaskStatusPending, Payload: `{"node":"node-a"}`, CreatedAt: 100},
		{ID: 30, TaskID: "gamma", Type: "sync_gamma", Status: model.SystemTaskStatusPending, Payload: `{"node":"node-b"}`, CreatedAt: 110},
	}).Error)
	now := common.GetTimestamp()
	require.NoError(t, model.UpsertSystemInstance("node-b", map[string]any{"sync": map[string]NodeSyncTopicState{
		"alpha": {Revision: 20, AppliedAt: 50},
		"beta":  {Revision: 0, AppliedAt: 60},
		"gamma": {Revision: 10, AppliedAt: 70},
	}}, now, now))
	require.NoError(t, model.UpsertSystemInstance("node-a", map[string]any{"sync": map[string]NodeSyncTopicState{
		"alpha": {Revision: 10, AppliedAt: 40, Error: "reload failed", Errors: map[string]string{"incho": "compile error"}},
	}}, now, now))
	require.NoError(t, model.UpsertSystemInstance("node-c", map[string]any{"schema_version": 1}, now-200, now-model.SystemInstanceStaleAfterSeconds-1))
	// An offline node's topics are not listed.
	require.NoError(t, model.UpsertSystemInstance("node-d", map[string]any{"sync": map[string]NodeSyncTopicState{
		"delta": {Revision: 40, AppliedAt: 80},
	}}, now-200, now-model.SystemInstanceStaleAfterSeconds-1))

	status, err := GetNodeSyncStatus()
	require.NoError(t, err)
	assert.Equal(t, []NodeSyncTopic{
		{Topic: "alpha", Revision: 20, UpdatedAt: 100, UpdatedBy: "node-a"},
		{Topic: "beta"},
		{Topic: "gamma", Revision: 30, UpdatedAt: 110, UpdatedBy: "node-b"},
	}, status.Topics)
	none := map[string]string{}
	assert.Equal(t, []NodeSyncNode{
		{NodeName: "node-a", Online: true, Topics: map[string]NodeSyncNodeTopic{
			"alpha": {AppliedAt: 40, Error: "reload failed", Errors: map[string]string{"incho": "compile error"}},
			"beta":  {Synced: true, Errors: none},
			"gamma": {Synced: true, Errors: none},
		}},
		{NodeName: "node-b", Online: true, Topics: map[string]NodeSyncNodeTopic{
			"alpha": {Synced: true, AppliedAt: 50, Errors: none},
			"beta":  {Synced: true, AppliedAt: 60, Errors: none},
			"gamma": {AppliedAt: 70, Errors: none},
		}},
		{NodeName: "node-c", Online: false, Topics: map[string]NodeSyncNodeTopic{
			"alpha": {Errors: none},
			"beta":  {Errors: none},
			"gamma": {Errors: none},
		}},
		{NodeName: "node-d", Online: false, Topics: map[string]NodeSyncNodeTopic{
			"alpha": {Synced: true, Errors: none},
			"beta":  {Synced: true, Errors: none},
			"gamma": {Synced: true, Errors: none},
		}},
	}, status.Nodes)
	encoded, err := common.Marshal(status.Nodes[2].Topics["beta"])
	require.NoError(t, err)
	assert.JSONEq(t, `{"synced":false,"applied_at":0,"error":"","errors":{}}`, string(encoded))
}

// The master marks a topic's sync tasks done once every online node that
// keeps the topic has applied them. The newest waiting task shows how many
// have, and the error of a node whose reload fails; a topic no online node
// keeps waits for nobody.
func TestMasterFinishesSyncTasksEveryOnlineNodeApplied(t *testing.T) {
	useNodeSync(t)
	for _, topic := range []string{"alpha", "alpha", "alpha", "beta", "gamma"} {
		model.BumpSyncTopic(topic)
	}
	_, err := model.CreateSystemTask(model.SystemTaskTypeChannelTest, nil, nil)
	require.NoError(t, err)
	var created []model.SystemTask
	require.NoError(t, model.DB.Order("id").Find(&created).Error)
	require.Len(t, created, 6)
	alpha, gamma := []int64{created[0].ID, created[1].ID, created[2].ID}, created[4].ID
	now := common.GetTimestamp()
	report := func(node string, lastSeen int64, sync map[string]NodeSyncTopicState) {
		require.NoError(t, model.UpsertSystemInstance(node, map[string]any{"sync": sync}, now, lastSeen))
	}
	report("node-a", now, map[string]NodeSyncTopicState{"alpha": {Revision: alpha[2], AppliedAt: now}})
	report("node-b", now, map[string]NodeSyncTopicState{"alpha": {Revision: alpha[1], AppliedAt: now}, "gamma": {Error: "database is down"}})
	// An offline node waits for nothing.
	report("node-c", now-model.SystemInstanceStaleAfterSeconds-1, map[string]NodeSyncTopicState{"alpha": {AppliedAt: now}, "beta": {AppliedAt: now}})
	type view struct {
		status model.SystemTaskStatus
		state  string
		error  string
	}
	requireTasks := func(want []view) {
		t.Helper()
		var tasks []model.SystemTask
		require.NoError(t, model.DB.Order("id").Find(&tasks).Error)
		require.Len(t, tasks, len(want))
		for index, task := range tasks {
			assert.Equal(t, want[index].status, task.Status, task.Type)
			assert.Equal(t, want[index].error, task.Error, task.Type)
			if want[index].state == "" {
				assert.Empty(t, task.State, task.Type)
			} else {
				assert.JSONEq(t, want[index].state, task.State, task.Type)
			}
		}
	}

	finishAppliedSyncTasks()
	requireTasks([]view{
		{model.SystemTaskStatusSucceeded, `{"total":2,"processed":2,"progress":100}`, ""},
		{model.SystemTaskStatusSucceeded, `{"total":2,"processed":2,"progress":100}`, ""},
		{model.SystemTaskStatusPending, `{"total":2,"processed":1,"progress":50}`, ""},
		{model.SystemTaskStatusSucceeded, `{"total":0,"processed":0,"progress":100}`, ""},
		{model.SystemTaskStatusPending, `{"total":1,"processed":0,"progress":0}`, "node-b: database is down"},
		{model.SystemTaskStatusPending, "", ""},
	})

	report("node-b", now, map[string]NodeSyncTopicState{"alpha": {Revision: alpha[2], AppliedAt: now}, "gamma": {Revision: gamma, AppliedAt: now}})
	finishAppliedSyncTasks()
	requireTasks([]view{
		{model.SystemTaskStatusSucceeded, `{"total":2,"processed":2,"progress":100}`, ""},
		{model.SystemTaskStatusSucceeded, `{"total":2,"processed":2,"progress":100}`, ""},
		{model.SystemTaskStatusSucceeded, `{"total":2,"processed":2,"progress":100}`, ""},
		{model.SystemTaskStatusSucceeded, `{"total":0,"processed":0,"progress":100}`, ""},
		{model.SystemTaskStatusSucceeded, `{"total":1,"processed":1,"progress":100}`, ""},
		{model.SystemTaskStatusPending, "", ""},
	})
}

// A topic whose startup load failed is not marked applied at startup: the
// node reports the error and the first tick loads the topic again.
func TestNodeSyncReloadsATopicWhoseStartupLoadFailed(t *testing.T) {
	useNodeSync(t)
	reloads := map[string]int{}
	for _, topic := range []string{"alpha", "beta"} {
		RegisterSyncTopic(topic, func(context.Context) error {
			reloads[topic]++
			return nil
		})
		model.BumpSyncTopic(topic)
	}
	ReadStartupSyncRevisions()
	SyncTopicLoadFailed("beta", errors.New("database is down"))
	applyStartupSyncRevisions()

	states := NodeSyncStates()
	stored := storedSyncTopics(t)
	assert.Equal(t, stored["alpha"], states["alpha"].Revision)
	assert.NotZero(t, states["alpha"].AppliedAt)
	assert.Zero(t, states["beta"].AppliedAt)
	assert.Equal(t, "database is down", states["beta"].Error)

	require.True(t, syncNodeTopics(context.Background()))
	assert.Equal(t, map[string]int{"beta": 1}, reloads)
	recovered := NodeSyncStates()["beta"]
	assert.Equal(t, stored["beta"], recovered.Revision)
	assert.NotZero(t, recovered.AppliedAt)
	assert.Empty(t, recovered.Error)
}

// Without the startup revisions every registered topic stays unapplied, and
// the node reports each one as not synced until the first tick loads it.
func TestNodeSyncWithoutStartupRevisionsReportsEveryTopicUnapplied(t *testing.T) {
	useNodeSync(t)
	RegisterSyncTopic("alpha", func(context.Context) error { return nil })
	applyStartupSyncRevisions()

	state, ok := NodeSyncStates()["alpha"]
	require.True(t, ok)
	assert.Zero(t, state.AppliedAt)
	require.True(t, syncNodeTopics(context.Background()))
	assert.NotZero(t, NodeSyncStates()["alpha"].AppliedAt)
}

// An OAuth provider write and its topic bump share a transaction, as nothing
// else reloads the providers on other nodes: a write whose bump fails is not
// stored.
func TestOAuthProviderWritesBumpTheirTopicInTheSameTransaction(t *testing.T) {
	database := useNodeSync(t)
	tables := []any{&model.CustomOAuthProvider{}, &model.UserOAuthBinding{}}
	require.NoError(t, database.AutoMigrate(tables...))
	t.Cleanup(func() { require.NoError(t, database.Migrator().DropTable(tables...)) })
	revision := func() int64 { return storedSyncTopics(t)[model.SyncTopicOAuthProviders] }
	provider := &model.CustomOAuthProvider{
		Name: "Example", Slug: "example", ClientId: "client", ClientSecret: "secret",
		AuthorizationEndpoint: "https://id.example.com/authorize", TokenEndpoint: "https://id.example.com/token",
		UserInfoEndpoint: "https://id.example.com/userinfo",
	}

	require.NoError(t, model.CreateCustomOAuthProvider(provider))
	created := revision()
	assert.NotZero(t, created)
	provider.Name = "Renamed"
	require.NoError(t, model.UpdateCustomOAuthProvider(provider))
	updated := revision()
	assert.NotEqual(t, created, updated)
	require.NoError(t, model.DeleteCustomOAuthProvider(provider.Id))
	assert.NotEqual(t, updated, revision())

	require.NoError(t, database.Migrator().DropTable(&model.SystemTask{}))
	failing := &model.CustomOAuthProvider{
		Name: "Lost", Slug: "lost", ClientId: "client", ClientSecret: "secret",
		AuthorizationEndpoint: "https://id.example.com/authorize", TokenEndpoint: "https://id.example.com/token",
		UserInfoEndpoint: "https://id.example.com/userinfo",
	}
	require.Error(t, model.CreateCustomOAuthProvider(failing))
	require.NoError(t, database.AutoMigrate(&model.SystemTask{}))
	var count int64
	require.NoError(t, database.Model(&model.CustomOAuthProvider{}).Where("slug = ?", "lost").Count(&count).Error)
	assert.Zero(t, count, "a provider whose bump failed is not stored")
}

func TestNodeSyncCapsWhatTheRegistryRowCarries(t *testing.T) {
	useNodeSync(t)
	common.NodeName = "node-caps"
	long := strings.Repeat("é", 400)
	loadErrors := map[string]string{}
	for i := range 60 {
		loadErrors[fmt.Sprintf("plugin-%02d", i)] = long
	}
	SetSyncTopicErrors(model.SyncTopicPlugins, loadErrors)
	RegisterSyncTopic(model.SyncTopicPlugins, func(context.Context) error { return errors.New(long) })
	require.True(t, syncNodeTopics(context.Background()))
	require.NoError(t, ReportCurrentSystemInstance())

	instances, err := model.ListSystemInstances()
	require.NoError(t, err)
	require.Len(t, instances, 1)
	var info SystemInstanceInfo
	require.NoError(t, common.UnmarshalJsonStr(instances[0].Info, &info))
	state := info.Sync[model.SyncTopicPlugins]
	assert.Zero(t, state.AppliedAt)
	assert.Equal(t, 300, utf8.RuneCountInString(state.Error))
	require.Len(t, state.Errors, 50)
	assert.Contains(t, state.Errors, "plugin-49")
	assert.NotContains(t, state.Errors, "plugin-50")
	for _, message := range state.Errors {
		assert.Equal(t, 300, utf8.RuneCountInString(message))
	}
}
