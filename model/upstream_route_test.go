package model

import (
	"slices"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupUpstreamRouteTest(t *testing.T) {
	t.Helper()
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&UpstreamManagedRoute{}))
	DB = db
	t.Cleanup(func() {
		DB = originalDB
	})
}

func TestManagedUpstreamOrchestrationSettingConcurrentReadAndOptionUpdate(t *testing.T) {
	original, err := config.ConfigToMap(operation_setting.GetUpstreamOrchestrationSetting())
	require.NoError(t, err)
	originalOptions := make(map[string]string, len(original))
	for key, value := range original {
		originalOptions["upstream_orchestration."+key] = value
	}
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(originalOptions))
	})

	start := make(chan struct{})
	handled := make(chan bool, 100)
	var workers sync.WaitGroup
	workers.Go(func() {
		<-start
		for i := range 100 {
			value := `{"public-a":"actual-a"}`
			if i%2 == 1 {
				value = `{"public-b":"actual-b"}`
			}
			handled <- handleConfigUpdate("upstream_orchestration.model_aliases", value)
		}
	})
	workers.Go(func() {
		<-start
		for range 100 {
			setting := operation_setting.GetUpstreamOrchestrationSetting()
			for key, value := range setting.ModelAliases {
				_, _ = key, value
			}
			_ = slices.Clone(setting.TargetGroups)
		}
	})
	close(start)
	workers.Wait()
	close(handled)
	for result := range handled {
		assert.True(t, result)
	}
}

func TestRecordUpstreamRouteFailure(t *testing.T) {
	setupUpstreamRouteTest(t)
	route := UpstreamManagedRoute{
		SourceID:        1,
		ExternalGroupID: "group",
		Platform:        "openai",
		Protocol:        UpstreamProtocolOpenAI,
		ChannelID:       101,
		State:           UpstreamRouteStateActive,
	}
	require.NoError(t, DB.Create(&route).Error)

	t.Run("quarantines only after two failures inside five minutes", func(t *testing.T) {
		first, quarantined, err := RecordUpstreamRouteFailure(101, 1000, 300, 2, "first")
		require.NoError(t, err)
		assert.False(t, quarantined)
		assert.Equal(t, 1, first.ConsecutiveFailures)
		assert.Equal(t, UpstreamRouteStateActive, first.State)

		second, quarantined, err := RecordUpstreamRouteFailure(101, 1299, 300, 2, "second")
		require.NoError(t, err)
		assert.True(t, quarantined)
		assert.Equal(t, 2, second.ConsecutiveFailures)
		assert.Equal(t, UpstreamRouteStateQuarantined, second.State)
	})
}

func TestRecordUpstreamRouteSuccess(t *testing.T) {
	setupUpstreamRouteTest(t)
	route := UpstreamManagedRoute{
		SourceID:            1,
		ExternalGroupID:     "group",
		Platform:            "openai",
		Protocol:            UpstreamProtocolOpenAI,
		ChannelID:           102,
		State:               UpstreamRouteStateActive,
		ConsecutiveFailures: 1,
		FailureWindowStart:  1000,
	}
	require.NoError(t, DB.Create(&route).Error)

	updated, err := RecordUpstreamRouteSuccess(102, 1100, 1250)
	require.NoError(t, err)
	require.NotNil(t, updated)
	assert.Zero(t, updated.ConsecutiveFailures)
	assert.Zero(t, updated.FailureWindowStart)
	assert.Equal(t, int64(1250), updated.LastLatencyMS)
}

func TestRecordUpstreamRouteFailureRestartsOutsideWindow(t *testing.T) {
	setupUpstreamRouteTest(t)
	route := UpstreamManagedRoute{
		SourceID:        2,
		ExternalGroupID: "window-reset",
		Platform:        "openai",
		Protocol:        UpstreamProtocolOpenAI,
		ChannelID:       103,
		State:           UpstreamRouteStateActive,
	}
	require.NoError(t, DB.Create(&route).Error)

	_, quarantined, err := RecordUpstreamRouteFailure(103, 1000, 300, 2, "first")
	require.NoError(t, err)
	assert.False(t, quarantined)

	updated, quarantined, err := RecordUpstreamRouteFailure(103, 1301, 300, 2, "outside window")
	require.NoError(t, err)
	assert.False(t, quarantined)
	assert.Equal(t, 1, updated.ConsecutiveFailures)
	assert.Equal(t, int64(1301), updated.FailureWindowStart)
	assert.Equal(t, UpstreamRouteStateActive, updated.State)
}
