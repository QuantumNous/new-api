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
	tables := []any{&model.SystemSyncTopic{}, &model.SystemInstance{}, &model.Option{}}
	require.NoError(t, database.AutoMigrate(tables...))
	t.Cleanup(func() { require.NoError(t, database.Migrator().DropTable(tables...)) })
	previousRegistry, previousNodeName := nodeSync, common.NodeName
	nodeSync = newNodeSyncRegistry()
	t.Cleanup(func() { nodeSync, common.NodeName = previousRegistry, previousNodeName })
	return database
}

func storedSyncTopics(t *testing.T) map[string]model.SystemSyncTopic {
	t.Helper()
	rows, err := model.ListSyncTopics()
	require.NoError(t, err)
	topics := make(map[string]model.SystemSyncTopic, len(rows))
	for _, row := range rows {
		topics[row.Topic] = row
	}
	return topics
}

func TestBumpSyncTopicReplacesTheRevision(t *testing.T) {
	useNodeSync(t)
	common.NodeName = "node-a"
	model.BumpSyncTopic("alpha")
	model.BumpSyncTopic("beta")
	first := storedSyncTopics(t)
	require.Len(t, first, 2)
	assert.NotEmpty(t, first["alpha"].Revision)
	assert.NotEqual(t, first["alpha"].Revision, first["beta"].Revision)

	common.NodeName = "node-b"
	model.BumpSyncTopic("alpha")
	second := storedSyncTopics(t)
	require.Len(t, second, 2)
	assert.NotEqual(t, first["alpha"].Revision, second["alpha"].Revision)
	assert.Equal(t, "node-b", second["alpha"].UpdatedBy)
	assert.NotZero(t, second["alpha"].UpdatedAt)
	assert.Equal(t, first["beta"], second["beta"])
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
	assert.Equal(t, storedSyncTopics(t)["alpha"].Revision, NodeSyncStates()["alpha"].Revision)

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
	assert.Equal(t, storedSyncTopics(t)["beta"].Revision, recovered.Revision)
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

func TestNodeSyncStatusComparesEveryNodeWithTheLatestRevision(t *testing.T) {
	useNodeSync(t)
	noop := func(context.Context) error { return nil }
	RegisterSyncTopic("beta", noop)
	RegisterSyncTopic("alpha", noop)
	require.NoError(t, model.DB.Create(&model.SystemSyncTopic{Topic: "alpha", Revision: "r-alpha", UpdatedBy: "node-a", UpdatedAt: 100}).Error)
	now := common.GetTimestamp()
	require.NoError(t, model.UpsertSystemInstance("node-b", map[string]any{"sync": map[string]NodeSyncTopicState{
		"alpha": {Revision: "r-alpha", AppliedAt: 50},
		"beta":  {Revision: "", AppliedAt: 60},
	}}, now, now))
	require.NoError(t, model.UpsertSystemInstance("node-a", map[string]any{"sync": map[string]NodeSyncTopicState{
		"alpha": {Revision: "r-old", AppliedAt: 40, Error: "reload failed", Errors: map[string]string{"incho": "compile error"}},
	}}, now, now))
	require.NoError(t, model.UpsertSystemInstance("node-c", map[string]any{"schema_version": 1}, now-200, now-model.SystemInstanceStaleAfterSeconds-1))

	status, err := GetNodeSyncStatus()
	require.NoError(t, err)
	assert.Equal(t, []NodeSyncTopic{{Topic: "alpha", Revision: "r-alpha", UpdatedAt: 100, UpdatedBy: "node-a"}, {Topic: "beta"}}, status.Topics)
	none := map[string]string{}
	assert.Equal(t, []NodeSyncNode{
		{NodeName: "node-a", Online: true, Topics: map[string]NodeSyncNodeTopic{
			"alpha": {AppliedAt: 40, Error: "reload failed", Errors: map[string]string{"incho": "compile error"}},
			"beta":  {Errors: none},
		}},
		{NodeName: "node-b", Online: true, Topics: map[string]NodeSyncNodeTopic{
			"alpha": {Synced: true, AppliedAt: 50, Errors: none},
			"beta":  {Synced: true, AppliedAt: 60, Errors: none},
		}},
		{NodeName: "node-c", Online: false, Topics: map[string]NodeSyncNodeTopic{
			"alpha": {Errors: none},
			"beta":  {Errors: none},
		}},
	}, status.Nodes)
	encoded, err := common.Marshal(status.Nodes[2].Topics["beta"])
	require.NoError(t, err)
	assert.JSONEq(t, `{"synced":false,"applied_at":0,"error":"","errors":{}}`, string(encoded))
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
