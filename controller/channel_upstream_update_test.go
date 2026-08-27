package controller

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func stubChannelUpstreamModelFetch(t *testing.T, fetch func(*model.Channel) ([]string, error)) {
	t.Helper()

	originalFetch := fetchChannelUpstreamModelIDsFn
	fetchChannelUpstreamModelIDsFn = fetch
	t.Cleanup(func() {
		fetchChannelUpstreamModelIDsFn = originalFetch
	})
}

func preserveChannelUpstreamModelNotifyState(t *testing.T) {
	t.Helper()

	channelUpstreamModelUpdateNotifyState.Lock()
	originalLastNotifiedAt := channelUpstreamModelUpdateNotifyState.lastNotifiedAt
	originalChangedChannels := channelUpstreamModelUpdateNotifyState.lastChangedChannels
	originalFailedChannels := channelUpstreamModelUpdateNotifyState.lastFailedChannels
	channelUpstreamModelUpdateNotifyState.Unlock()

	t.Cleanup(func() {
		channelUpstreamModelUpdateNotifyState.Lock()
		channelUpstreamModelUpdateNotifyState.lastNotifiedAt = originalLastNotifiedAt
		channelUpstreamModelUpdateNotifyState.lastChangedChannels = originalChangedChannels
		channelUpstreamModelUpdateNotifyState.lastFailedChannels = originalFailedChannels
		channelUpstreamModelUpdateNotifyState.Unlock()
	})
}

func setupChannelUpstreamUpdateTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalMainDatabaseType := common.MainDatabaseType()
	originalLogDatabaseType := common.LogDatabaseType()
	originalRedisEnabled := common.RedisEnabled
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalRequestInterval := common.RequestInterval
	originalDebugEnabled := common.DebugEnabled

	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.MemoryCacheEnabled = false
	common.RequestInterval = 0
	common.DebugEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))

	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
		common.RedisEnabled = originalRedisEnabled
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		common.RequestInterval = originalRequestInterval
		common.DebugEnabled = originalDebugEnabled
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func createChannelUpstreamUpdateTestChannel(
	t *testing.T,
	db *gorm.DB,
	models string,
	mapping map[string]string,
	settings dto.ChannelOtherSettings,
) *model.Channel {
	t.Helper()

	mappingBytes, err := common.Marshal(mapping)
	require.NoError(t, err)
	settingsBytes, err := common.Marshal(settings)
	require.NoError(t, err)
	baseURL := "https://upstream.example"
	channel := &model.Channel{
		Type:          constant.ChannelTypeOpenRouter,
		Key:           "test-key",
		Status:        common.ChannelStatusEnabled,
		Name:          "upstream-sync-test",
		BaseURL:       &baseURL,
		Models:        models,
		Group:         "default",
		ModelMapping:  common.GetPointer(string(mappingBytes)),
		OtherSettings: string(settingsBytes),
	}
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, channel.UpdateAbilities(nil))
	return channel
}

func loadChannelUpstreamUpdateTestState(t *testing.T, db *gorm.DB, channelID int) (*model.Channel, []model.Ability) {
	t.Helper()

	var channel model.Channel
	require.NoError(t, db.First(&channel, channelID).Error)
	var abilities []model.Ability
	require.NoError(t, db.Where("channel_id = ?", channelID).Order("model asc").Find(&abilities).Error)
	return &channel, abilities
}

func TestNormalizeModelNames(t *testing.T) {
	result := normalizeModelNames([]string{
		" gpt-4o ",
		"",
		"gpt-4o",
		"gpt-4.1",
		"   ",
	})

	require.Equal(t, []string{"gpt-4o", "gpt-4.1"}, result)
}

func TestMergeModelNames(t *testing.T) {
	result := mergeModelNames(
		[]string{"gpt-4o", "gpt-4.1"},
		[]string{"gpt-4.1", " gpt-4.1-mini ", "gpt-4o"},
	)

	require.Equal(t, []string{"gpt-4o", "gpt-4.1", "gpt-4.1-mini"}, result)
}

func TestSubtractModelNames(t *testing.T) {
	result := subtractModelNames(
		[]string{"gpt-4o", "gpt-4.1", "gpt-4.1-mini"},
		[]string{"gpt-4.1", "not-exists"},
	)

	require.Equal(t, []string{"gpt-4o", "gpt-4.1-mini"}, result)
}

func TestIntersectModelNames(t *testing.T) {
	result := intersectModelNames(
		[]string{"gpt-4o", "gpt-4.1", "gpt-4.1", "not-exists"},
		[]string{"gpt-4.1", "gpt-4o-mini", "gpt-4o"},
	)

	require.Equal(t, []string{"gpt-4o", "gpt-4.1"}, result)
}

func TestApplySelectedModelChanges(t *testing.T) {
	t.Run("add and remove together", func(t *testing.T) {
		result := applySelectedModelChanges(
			[]string{"gpt-4o", "gpt-4.1", "claude-3"},
			[]string{"gpt-4.1-mini"},
			[]string{"claude-3"},
		)

		require.Equal(t, []string{"gpt-4o", "gpt-4.1", "gpt-4.1-mini"}, result)
	})

	t.Run("add wins when conflict with remove", func(t *testing.T) {
		result := applySelectedModelChanges(
			[]string{"gpt-4o"},
			[]string{"gpt-4.1"},
			[]string{"gpt-4.1"},
		)

		require.Equal(t, []string{"gpt-4o", "gpt-4.1"}, result)
	})
}

func TestCollectPendingApplyUpstreamModelChanges(t *testing.T) {
	settings := dto.ChannelOtherSettings{
		UpstreamModelUpdateLastDetectedModels: []string{" gpt-4o ", "gpt-4o", "gpt-4.1"},
		UpstreamModelUpdateLastRemovedModels:  []string{" old-model ", "", "old-model"},
	}

	pendingAddModels, pendingRemoveModels := collectPendingApplyUpstreamModelChanges(settings)

	require.Equal(t, []string{"gpt-4o", "gpt-4.1"}, pendingAddModels)
	require.Equal(t, []string{"old-model"}, pendingRemoveModels)
}

func TestNormalizeChannelModelMappingPreservesExactStrings(t *testing.T) {
	modelMapping := `{
		" alias-model ": " upstream-model "
	}`
	channel := &model.Channel{
		ModelMapping: &modelMapping,
	}

	result, err := normalizeChannelModelMapping(channel)
	require.NoError(t, err)
	require.Equal(t, map[string]string{
		" alias-model ": " upstream-model ",
	}, result)
}

func TestNormalizeChannelModelMappingRejectsInvalidJSON(t *testing.T) {
	modelMapping := `{"alias-model":`
	channel := &model.Channel{ModelMapping: &modelMapping}

	_, err := normalizeChannelModelMapping(channel)
	require.Error(t, err)
}

func TestNormalizeChannelModelMappingRejectsInvalidEntry(t *testing.T) {
	tests := []struct {
		name        string
		mapping     string
		expectedErr error
	}{
		{name: "empty target", mapping: `{"alias-model":""}`, expectedErr: model.ErrModelMappingTargetEmpty},
		{name: "whitespace target", mapping: `{"alias-model":"   "}`, expectedErr: model.ErrModelMappingTargetEmpty},
		{name: "whitespace source", mapping: `{"   ":"upstream-model"}`, expectedErr: model.ErrModelMappingSourceEmpty},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			channel := &model.Channel{ModelMapping: &tt.mapping}

			_, err := normalizeChannelModelMapping(channel)
			require.ErrorIs(t, err, tt.expectedErr)
		})
	}
}

func TestCollectPendingUpstreamModelChangesFromModels_WithModelMapping(t *testing.T) {
	pendingAddModels, pendingRemoveModels, err := collectPendingUpstreamModelChangesFromModels(
		[]string{"alias-model", "gpt-4o", "stale-model"},
		[]string{"gpt-4o", "gpt-4.1", "mapped-target"},
		[]string{"gpt-4.1"},
		map[string]string{
			"alias-model": "mapped-target",
		},
	)

	require.NoError(t, err)
	require.Equal(t, []string{}, pendingAddModels)
	require.Equal(t, []string{"stale-model"}, pendingRemoveModels)
}

func TestCollectPendingUpstreamModelChangesFromModels_WithIgnoredRegexPatterns(t *testing.T) {
	pendingAddModels, pendingRemoveModels, err := collectPendingUpstreamModelChangesFromModels(
		[]string{"gpt-4o"},
		[]string{"gpt-4o", "claude-3-5-sonnet", "sora-video", "gpt-4.1"},
		[]string{"regex:^sora-.*$", "gpt-4.1"},
		nil,
	)

	require.NoError(t, err)
	require.Equal(t, []string{"claude-3-5-sonnet"}, pendingAddModels)
	require.Equal(t, []string{}, pendingRemoveModels)
}

func TestCollectPendingUpstreamModelChangesFromModels_Canonical(t *testing.T) {
	tests := []struct {
		name           string
		localModels    []string
		upstreamModels []string
		mapping        map[string]string
		wantAdd        []string
		wantRemove     []string
		wantErr        error
	}{
		{
			name:           "terminal target covers active canonical model",
			localModels:    []string{"claude-fable-5"},
			upstreamModels: []string{"anthropic/claude-fable-5"},
			mapping: map[string]string{
				"claude-fable-5":            "openrouter/claude-fable-5",
				"openrouter/claude-fable-5": "anthropic/claude-fable-5",
			},
			wantAdd:    []string{},
			wantRemove: []string{},
		},
		{
			name:           "missing terminal removes canonical source",
			localModels:    []string{"claude-fable-5"},
			upstreamModels: []string{},
			mapping: map[string]string{
				"claude-fable-5": "anthropic/claude-fable-5",
			},
			wantAdd:    []string{},
			wantRemove: []string{"claude-fable-5"},
		},
		{
			name:           "inactive stale mapping does not cover addition",
			localModels:    []string{"gpt-4o"},
			upstreamModels: []string{"gpt-4o", "anthropic/claude-fable-5"},
			mapping: map[string]string{
				"stale-alias": "anthropic/claude-fable-5",
			},
			wantAdd:    []string{"anthropic/claude-fable-5"},
			wantRemove: []string{},
		},
		{
			name:           "mapping keys and targets are matched exactly",
			localModels:    []string{"alias-model"},
			upstreamModels: []string{"upstream-model"},
			mapping: map[string]string{
				" alias-model ": " upstream-model ",
			},
			wantAdd:    []string{"upstream-model"},
			wantRemove: []string{"alias-model"},
		},
		{
			name:           "self mapping terminates",
			localModels:    []string{"gpt-4o"},
			upstreamModels: []string{"gpt-4o"},
			mapping: map[string]string{
				"gpt-4o": "gpt-4o",
			},
			wantAdd:    []string{},
			wantRemove: []string{},
		},
		{
			name:           "cycle returns error",
			localModels:    []string{"model-a"},
			upstreamModels: []string{"model-a"},
			mapping: map[string]string{
				"model-a": "model-b",
				"model-b": "model-a",
			},
			wantErr: model.ErrModelMappingCycle,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pendingAdd, pendingRemove, err := collectPendingUpstreamModelChangesFromModels(
				tt.localModels,
				tt.upstreamModels,
				nil,
				tt.mapping,
			)
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.wantAdd, pendingAdd)
			require.Equal(t, tt.wantRemove, pendingRemove)
		})
	}
}

func TestBuildChannelUpstreamModelFetchFingerprintExcludesPollingIndex(t *testing.T) {
	channel := &model.Channel{
		Type: constant.ChannelTypeOpenRouter,
		Key:  "key-a\nkey-b",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:             true,
			MultiKeySize:           2,
			MultiKeyStatusList:     map[int]int{0: common.ChannelStatusEnabled, 1: common.ChannelStatusEnabled},
			MultiKeyDisabledReason: map[int]string{},
			MultiKeyDisabledTime:   map[int]int64{},
			MultiKeyPollingIndex:   0,
			MultiKeyMode:           constant.MultiKeyModePolling,
		},
	}

	before, err := buildChannelUpstreamModelFetchFingerprint(channel)
	require.NoError(t, err)
	channel.ChannelInfo.MultiKeyPollingIndex = 1
	afterPolling, err := buildChannelUpstreamModelFetchFingerprint(channel)
	require.NoError(t, err)
	require.Equal(t, before, afterPolling)

	channel.ChannelInfo.MultiKeyStatusList[1] = common.ChannelStatusManuallyDisabled
	afterStableChange, err := buildChannelUpstreamModelFetchFingerprint(channel)
	require.NoError(t, err)
	require.NotEqual(t, before, afterStableChange)
}

func TestApplyChannelUpstreamModelUpdates_CanonicalAddAndRemove(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	channel := createChannelUpstreamUpdateTestChannel(
		t,
		db,
		"gpt-4o,legacy-model",
		map[string]string{"manual-alias": "manual-target"},
		dto.ChannelOtherSettings{
			UpstreamModelUpdateLastDetectedModels: []string{"anthropic/claude-fable-5"},
			UpstreamModelUpdateLastRemovedModels:  []string{"legacy-model"},
		},
	)
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		return []string{"gpt-4o", "anthropic/claude-fable-5"}, nil
	})

	added, removed, remainingAdd, remainingRemove, changed, err := applyChannelUpstreamModelUpdates(
		channel,
		[]string{"anthropic/claude-fable-5"},
		nil,
		[]string{"legacy-model"},
	)

	require.NoError(t, err)
	require.True(t, changed)
	require.Equal(t, []string{"anthropic/claude-fable-5"}, added)
	require.Equal(t, []string{"legacy-model"}, removed)
	require.Empty(t, remainingAdd)
	require.Empty(t, remainingRemove)

	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, "gpt-4o,claude-fable-5", persisted.Models)
	require.Equal(t, []string{"claude-fable-5", "gpt-4o"}, []string{abilities[0].Model, abilities[1].Model})

	persistedMapping := map[string]string{}
	require.NoError(t, common.UnmarshalJsonStr(persisted.GetModelMapping(), &persistedMapping))
	require.Equal(t, "anthropic/claude-fable-5", persistedMapping["claude-fable-5"])
	require.Equal(t, "manual-target", persistedMapping["manual-alias"])
	require.Empty(t, persisted.GetOtherSettings().UpstreamModelUpdateLastDetectedModels)
	require.Empty(t, persisted.GetOtherSettings().UpstreamModelUpdateLastRemovedModels)
}

func TestApplyChannelUpstreamModelUpdates_CanonicalPersistsMappingOnlyTransition(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	channel := createChannelUpstreamUpdateTestChannel(
		t,
		db,
		"foo",
		nil,
		dto.ChannelOtherSettings{
			UpstreamModelUpdateLastDetectedModels: []string{"anthropic/foo"},
			UpstreamModelUpdateLastRemovedModels:  []string{"foo"},
		},
	)
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		return []string{"anthropic/foo"}, nil
	})

	added, removed, remainingAdd, remainingRemove, modelsChanged, err := applyChannelUpstreamModelUpdates(
		channel,
		[]string{"anthropic/foo"},
		nil,
		[]string{"foo"},
	)

	require.NoError(t, err)
	require.False(t, modelsChanged)
	require.Equal(t, []string{"anthropic/foo"}, added)
	require.Equal(t, []string{"foo"}, removed)
	require.Empty(t, remainingAdd)
	require.Empty(t, remainingRemove)

	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, "foo", persisted.Models)
	persistedMapping := map[string]string{}
	require.NoError(t, common.UnmarshalJsonStr(persisted.GetModelMapping(), &persistedMapping))
	require.Equal(t, map[string]string{"foo": "anthropic/foo"}, persistedMapping)
	require.Len(t, abilities, 1)
	require.Equal(t, "foo", abilities[0].Model)
	require.Empty(t, persisted.GetOtherSettings().UpstreamModelUpdateLastDetectedModels)
	require.Empty(t, persisted.GetOtherSettings().UpstreamModelUpdateLastRemovedModels)
}

func TestApplyChannelUpstreamModelUpdates_CanonicalFetchesAndRecomputesPending(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	channel := createChannelUpstreamUpdateTestChannel(
		t,
		db,
		"gpt-4o",
		nil,
		dto.ChannelOtherSettings{
			UpstreamModelUpdateLastDetectedModels: []string{"stale-upstream-model"},
		},
	)
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		return []string{"gpt-4o", "anthropic/fresh-model"}, nil
	})

	added, removed, remainingAdd, remainingRemove, changed, err := applyChannelUpstreamModelUpdates(
		channel,
		[]string{"anthropic/fresh-model", "stale-upstream-model"},
		nil,
		nil,
	)

	require.NoError(t, err)
	require.True(t, changed)
	require.Equal(t, []string{"anthropic/fresh-model"}, added)
	require.Empty(t, removed)
	require.Empty(t, remainingAdd)
	require.Empty(t, remainingRemove)
	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, "gpt-4o,fresh-model", persisted.Models)
	require.Equal(t, []string{"fresh-model", "gpt-4o"}, []string{abilities[0].Model, abilities[1].Model})
}

func TestApplyChannelUpstreamModelUpdates_CanonicalRejectsStaleManualFetchSnapshot(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	settings := dto.ChannelOtherSettings{
		UpstreamModelUpdateLastDetectedModels: []string{"anthropic/fresh-model"},
	}
	channel := createChannelUpstreamUpdateTestChannel(t, db, "gpt-4o", nil, settings)
	originalSettings := channel.OtherSettings
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("key", "fresh-key").Error)
		return []string{"gpt-4o", "anthropic/fresh-model"}, nil
	})

	_, _, _, _, _, err := applyChannelUpstreamModelUpdates(
		channel,
		[]string{"anthropic/fresh-model"},
		nil,
		nil,
	)

	require.ErrorContains(t, err, "channel fetch configuration changed")
	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, "fresh-key", persisted.Key)
	require.Equal(t, "gpt-4o", persisted.Models)
	require.JSONEq(t, originalSettings, persisted.OtherSettings)
	require.Len(t, abilities, 1)
	require.Equal(t, "gpt-4o", abilities[0].Model)
}

func TestApplyChannelUpstreamModelUpdates_CanonicalRemovesMissingMappedTerminal(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	channel := createChannelUpstreamUpdateTestChannel(
		t,
		db,
		"gpt-4o,claude-fable-5",
		map[string]string{"claude-fable-5": "anthropic/claude-fable-5"},
		dto.ChannelOtherSettings{},
	)
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		return []string{"gpt-4o"}, nil
	})

	added, removed, remainingAdd, remainingRemove, changed, err := applyChannelUpstreamModelUpdates(
		channel,
		nil,
		nil,
		[]string{"claude-fable-5"},
	)

	require.NoError(t, err)
	require.True(t, changed)
	require.Empty(t, added)
	require.Equal(t, []string{"claude-fable-5"}, removed)
	require.Empty(t, remainingAdd)
	require.Empty(t, remainingRemove)
	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, "gpt-4o", persisted.Models)
	require.Len(t, abilities, 1)
	require.Equal(t, "gpt-4o", abilities[0].Model)
}

func TestApplyChannelUpstreamModelUpdates_MalformedSettingsDoNotWrite(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	channel := createChannelUpstreamUpdateTestChannel(t, db, "gpt-4o", nil, dto.ChannelOtherSettings{})
	const malformedSettings = `{"upstream_model_update_check_enabled":`
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("settings", malformedSettings).Error)
	channel.OtherSettings = malformedSettings
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		return []string{"gpt-4o", "anthropic/fresh-model"}, nil
	})

	_, _, _, _, _, err := applyChannelUpstreamModelUpdates(
		channel,
		[]string{"anthropic/fresh-model"},
		nil,
		nil,
	)

	require.ErrorContains(t, err, "invalid channel other settings")
	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, malformedSettings, persisted.OtherSettings)
	require.Equal(t, "gpt-4o", persisted.Models)
	require.Len(t, abilities, 1)
	require.Equal(t, "gpt-4o", abilities[0].Model)
}

func TestApplyChannelUpstreamModelUpdates_CanonicalConflictDoesNotWrite(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	settings := dto.ChannelOtherSettings{
		UpstreamModelUpdateLastDetectedModels: []string{"anthropic/claude-fable-5"},
	}
	channel := createChannelUpstreamUpdateTestChannel(
		t,
		db,
		"gpt-4o",
		map[string]string{"claude-fable-5": "manual/claude-fable-5"},
		settings,
	)
	originalSettings := channel.OtherSettings
	originalMapping := channel.GetModelMapping()
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		return []string{"gpt-4o", "anthropic/claude-fable-5"}, nil
	})

	_, _, _, _, _, err := applyChannelUpstreamModelUpdates(
		channel,
		[]string{"anthropic/claude-fable-5"},
		nil,
		nil,
	)
	require.ErrorIs(t, err, model.ErrModelMappingConflict)

	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, "gpt-4o", persisted.Models)
	require.Equal(t, originalMapping, persisted.GetModelMapping())
	require.JSONEq(t, originalSettings, persisted.OtherSettings)
	require.Len(t, abilities, 1)
	require.Equal(t, "gpt-4o", abilities[0].Model)
}

func TestApplyChannelUpstreamModelUpdates_CanonicalSameNameReplacementConflictsAtomically(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	settings := dto.ChannelOtherSettings{
		UpstreamModelUpdateLastDetectedModels: []string{"foo"},
		UpstreamModelUpdateLastRemovedModels:  []string{"foo"},
	}
	channel := createChannelUpstreamUpdateTestChannel(
		t,
		db,
		"foo",
		map[string]string{"foo": "anthropic/foo"},
		settings,
	)
	originalSettings := channel.OtherSettings
	originalMapping := channel.GetModelMapping()
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		return []string{"foo"}, nil
	})

	_, _, _, _, _, err := applyChannelUpstreamModelUpdates(
		channel,
		[]string{"foo"},
		nil,
		[]string{"foo"},
	)
	require.ErrorIs(t, err, model.ErrModelMappingConflict)

	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, "foo", persisted.Models)
	require.Equal(t, originalMapping, persisted.GetModelMapping())
	require.JSONEq(t, originalSettings, persisted.OtherSettings)
	require.Len(t, abilities, 1)
	require.Equal(t, "foo", abilities[0].Model)
}

func TestApplyChannelUpstreamModelUpdates_CanonicalRollsBackAllState(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	settings := dto.ChannelOtherSettings{
		UpstreamModelUpdateLastDetectedModels: []string{"anthropic/claude-fable-5"},
	}
	channel := createChannelUpstreamUpdateTestChannel(
		t,
		db,
		"gpt-4o",
		map[string]string{"manual-alias": "manual-target"},
		settings,
	)
	originalSettings := channel.OtherSettings
	originalMapping := channel.GetModelMapping()
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		return []string{"gpt-4o", "anthropic/claude-fable-5"}, nil
	})
	require.NoError(t, db.Exec(`
		CREATE TRIGGER fail_canonical_ability_insert
		BEFORE INSERT ON abilities
		WHEN NEW.model = 'claude-fable-5'
		BEGIN
			SELECT RAISE(ABORT, 'forced ability insert failure');
		END;
	`).Error)

	_, _, _, _, _, err := applyChannelUpstreamModelUpdates(
		channel,
		[]string{"anthropic/claude-fable-5"},
		nil,
		nil,
	)
	require.ErrorContains(t, err, "forced ability insert failure")

	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, "gpt-4o", persisted.Models)
	require.Equal(t, originalMapping, persisted.GetModelMapping())
	require.JSONEq(t, originalSettings, persisted.OtherSettings)
	require.Len(t, abilities, 1)
	require.Equal(t, "gpt-4o", abilities[0].Model)
}

func TestApplyChannelUpstreamModelUpdates_CanonicalRejectsStaleFetchSnapshot(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	settings := dto.ChannelOtherSettings{UpstreamModelUpdateCheckEnabled: true}
	channel := createChannelUpstreamUpdateTestChannel(t, db, "gpt-4o", nil, settings)
	originalSettings := channel.OtherSettings

	originalFetch := fetchChannelUpstreamModelIDsFn
	fetchChannelUpstreamModelIDsFn = func(_ *model.Channel) ([]string, error) {
		require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("key", "fresh-key").Error)
		return []string{"gpt-4o", "anthropic/claude-fable-5"}, nil
	}
	t.Cleanup(func() {
		fetchChannelUpstreamModelIDsFn = originalFetch
	})

	_, _, err := checkAndPersistChannelUpstreamModelUpdates(channel, &settings, true, false, false)
	require.ErrorContains(t, err, "channel fetch configuration changed")

	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, "fresh-key", persisted.Key)
	require.Equal(t, "gpt-4o", persisted.Models)
	require.JSONEq(t, originalSettings, persisted.OtherSettings)
	require.Len(t, abilities, 1)
	require.Equal(t, "gpt-4o", abilities[0].Model)
}

func TestApplyChannelUpstreamModelUpdates_CanonicalRecomputesFromFreshState(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	settings := dto.ChannelOtherSettings{UpstreamModelUpdateCheckEnabled: true}
	channel := createChannelUpstreamUpdateTestChannel(t, db, "stale-model", nil, settings)

	originalFetch := fetchChannelUpstreamModelIDsFn
	fetchChannelUpstreamModelIDsFn = func(_ *model.Channel) ([]string, error) {
		freshMappingBytes, err := common.Marshal(map[string]string{
			"fresh-model":  "fresh-upstream-model",
			"manual-alias": "manual-target",
		})
		require.NoError(t, err)
		freshSettingsBytes, err := common.Marshal(dto.ChannelOtherSettings{
			UpstreamModelUpdateCheckEnabled:  true,
			UpstreamModelUpdateIgnoredModels: []string{"anthropic/ignored-model"},
			AllowSpeed:                       true,
		})
		require.NoError(t, err)
		require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Updates(map[string]interface{}{
			"models":        "gpt-4o,fresh-model",
			"model_mapping": string(freshMappingBytes),
			"settings":      string(freshSettingsBytes),
		}).Error)
		var concurrentChannel model.Channel
		require.NoError(t, db.First(&concurrentChannel, channel.Id).Error)
		require.NoError(t, concurrentChannel.UpdateAbilities(nil))
		return []string{
			"gpt-4o",
			"fresh-upstream-model",
			"anthropic/claude-fable-5",
			"anthropic/ignored-model",
		}, nil
	}
	t.Cleanup(func() {
		fetchChannelUpstreamModelIDsFn = originalFetch
	})

	changed, autoAdded, err := checkAndPersistChannelUpstreamModelUpdates(channel, &settings, true, false, false)
	require.NoError(t, err)
	require.False(t, changed)
	require.Zero(t, autoAdded)

	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, "gpt-4o,fresh-model", persisted.Models)
	require.Equal(t, []string{"fresh-model", "gpt-4o"}, []string{abilities[0].Model, abilities[1].Model})
	persistedMapping := map[string]string{}
	require.NoError(t, common.UnmarshalJsonStr(persisted.GetModelMapping(), &persistedMapping))
	require.Equal(t, "fresh-upstream-model", persistedMapping["fresh-model"])
	require.Equal(t, "manual-target", persistedMapping["manual-alias"])
	persistedSettings := persisted.GetOtherSettings()
	require.True(t, persistedSettings.AllowSpeed)
	require.Equal(t, []string{"anthropic/ignored-model"}, persistedSettings.UpstreamModelUpdateIgnoredModels)
	require.Equal(t, []string{"anthropic/claude-fable-5"}, persistedSettings.UpstreamModelUpdateLastDetectedModels)
	require.Empty(t, persistedSettings.UpstreamModelUpdateLastRemovedModels)
}

func TestApplyChannelUpstreamModelUpdates_CanonicalScheduledAutoSyncIsAddOnly(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	channel := createChannelUpstreamUpdateTestChannel(
		t,
		db,
		"gpt-4o,removed-upstream-model",
		nil,
		dto.ChannelOtherSettings{
			UpstreamModelUpdateCheckEnabled:    true,
			UpstreamModelUpdateAutoSyncEnabled: true,
		},
	)

	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		return []string{"gpt-4o", "anthropic/claude-fable-5"}, nil
	})

	preserveChannelUpstreamModelNotifyState(t)
	channelUpstreamModelUpdateNotifyState.Lock()
	channelUpstreamModelUpdateNotifyState.lastNotifiedAt = common.GetTimestamp()
	channelUpstreamModelUpdateNotifyState.lastChangedChannels = 1
	channelUpstreamModelUpdateNotifyState.lastFailedChannels = 0
	channelUpstreamModelUpdateNotifyState.Unlock()

	summary := runChannelUpstreamModelUpdateTaskOnce(context.Background(), false, true, nil)
	require.Equal(t, 1, summary.AutoAddedModels)
	require.Equal(t, 1, summary.DetectedRemoveModels)

	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, "gpt-4o,removed-upstream-model,claude-fable-5", persisted.Models)
	require.Equal(t, []string{"claude-fable-5", "gpt-4o", "removed-upstream-model"}, []string{
		abilities[0].Model,
		abilities[1].Model,
		abilities[2].Model,
	})
	persistedMapping := map[string]string{}
	require.NoError(t, common.UnmarshalJsonStr(persisted.GetModelMapping(), &persistedMapping))
	require.Equal(t, "anthropic/claude-fable-5", persistedMapping["claude-fable-5"])
	require.Equal(t, []string{"removed-upstream-model"}, persisted.GetOtherSettings().UpstreamModelUpdateLastRemovedModels)
}

func TestApplyChannelUpstreamModelUpdates_CanonicalScheduledRechecksFreshEnablement(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	settings := dto.ChannelOtherSettings{
		UpstreamModelUpdateCheckEnabled:    true,
		UpstreamModelUpdateAutoSyncEnabled: true,
	}
	channel := createChannelUpstreamUpdateTestChannel(t, db, "gpt-4o", nil, settings)
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		freshSettingsBytes, err := common.Marshal(dto.ChannelOtherSettings{
			UpstreamModelUpdateCheckEnabled:    false,
			UpstreamModelUpdateAutoSyncEnabled: true,
			AllowSpeed:                         true,
		})
		require.NoError(t, err)
		require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("settings", string(freshSettingsBytes)).Error)
		return []string{"gpt-4o", "anthropic/fresh-model"}, nil
	})

	changed, autoAdded, err := checkAndPersistChannelUpstreamModelUpdates(channel, &settings, false, true, true)

	require.NoError(t, err)
	require.False(t, changed)
	require.Zero(t, autoAdded)
	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, "gpt-4o", persisted.Models)
	persistedSettings := persisted.GetOtherSettings()
	require.False(t, persistedSettings.UpstreamModelUpdateCheckEnabled)
	require.True(t, persistedSettings.UpstreamModelUpdateAutoSyncEnabled)
	require.True(t, persistedSettings.AllowSpeed)
	require.Zero(t, persistedSettings.UpstreamModelUpdateLastCheckTime)
	require.Empty(t, persistedSettings.UpstreamModelUpdateLastDetectedModels)
	require.Len(t, abilities, 1)
	require.Equal(t, "gpt-4o", abilities[0].Model)
}

func TestApplyChannelUpstreamModelUpdates_CanonicalScheduledSkipsFreshlyDisabledChannel(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	settings := dto.ChannelOtherSettings{
		UpstreamModelUpdateCheckEnabled:    true,
		UpstreamModelUpdateAutoSyncEnabled: true,
	}
	channel := createChannelUpstreamUpdateTestChannel(t, db, "gpt-4o", nil, settings)
	originalSettings := channel.OtherSettings
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("status", common.ChannelStatusManuallyDisabled).Error)
		return []string{"gpt-4o", "anthropic/fresh-model"}, nil
	})

	changed, autoAdded, err := checkAndPersistChannelUpstreamModelUpdates(channel, &settings, false, true, true)

	require.NoError(t, err)
	require.False(t, changed)
	require.Zero(t, autoAdded)
	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, common.ChannelStatusManuallyDisabled, persisted.Status)
	require.Equal(t, "gpt-4o", persisted.Models)
	require.JSONEq(t, originalSettings, persisted.OtherSettings)
	require.Len(t, abilities, 1)
	require.Equal(t, "gpt-4o", abilities[0].Model)
}

func TestApplyChannelUpstreamModelUpdates_CanonicalDetectAllSkipsFreshlyDisabledChannel(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	settings := dto.ChannelOtherSettings{UpstreamModelUpdateCheckEnabled: true}
	channel := createChannelUpstreamUpdateTestChannel(t, db, "gpt-4o", nil, settings)
	originalSettings := channel.OtherSettings
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("status", common.ChannelStatusManuallyDisabled).Error)
		return []string{"gpt-4o", "anthropic/fresh-model"}, nil
	})

	summary := runChannelUpstreamModelUpdateTaskOnce(context.Background(), true, false, nil)

	require.Equal(t, 1, summary.CheckedChannels)
	require.Zero(t, summary.ChangedChannels)
	require.Zero(t, summary.FailedChannels)
	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, common.ChannelStatusManuallyDisabled, persisted.Status)
	require.Equal(t, "gpt-4o", persisted.Models)
	require.JSONEq(t, originalSettings, persisted.OtherSettings)
	require.Len(t, abilities, 1)
	require.Equal(t, "gpt-4o", abilities[0].Model)
}

func TestDetectChannelUpstreamModelUpdatesInspectsDisabledChannel(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	channel := createChannelUpstreamUpdateTestChannel(t, db, "gpt-4o", nil, dto.ChannelOtherSettings{})
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("status", common.ChannelStatusManuallyDisabled).Error)
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		return []string{"gpt-4o", "anthropic/fresh-model"}, nil
	})

	body := []byte(fmt.Sprintf(`{"id":%d}`, channel.Id))
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/upstream_updates/detect", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	DetectChannelUpstreamModelUpdates(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			AddModels     []string `json:"add_models"`
			LastCheckTime int64    `json:"last_check_time"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Equal(t, []string{"anthropic/fresh-model"}, response.Data.AddModels)
	require.NotZero(t, response.Data.LastCheckTime)

	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, common.ChannelStatusManuallyDisabled, persisted.Status)
	require.Equal(t, "gpt-4o", persisted.Models)
	require.Equal(t, []string{"anthropic/fresh-model"}, persisted.GetOtherSettings().UpstreamModelUpdateLastDetectedModels)
	require.Len(t, abilities, 1)
	require.Equal(t, "gpt-4o", abilities[0].Model)
}

func TestApplyChannelUpstreamModelUpdates_CanonicalScheduledSameNameReplacementFailsAtomically(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	settings := dto.ChannelOtherSettings{
		UpstreamModelUpdateCheckEnabled:    true,
		UpstreamModelUpdateAutoSyncEnabled: true,
	}
	channel := createChannelUpstreamUpdateTestChannel(
		t,
		db,
		"foo",
		map[string]string{"foo": "anthropic/foo"},
		settings,
	)
	originalSettings := channel.OtherSettings
	originalMapping := channel.GetModelMapping()
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		return []string{"foo"}, nil
	})
	preserveChannelUpstreamModelNotifyState(t)
	channelUpstreamModelUpdateNotifyState.Lock()
	channelUpstreamModelUpdateNotifyState.lastNotifiedAt = common.GetTimestamp()
	channelUpstreamModelUpdateNotifyState.lastChangedChannels = 0
	channelUpstreamModelUpdateNotifyState.lastFailedChannels = 1
	channelUpstreamModelUpdateNotifyState.Unlock()

	summary := runChannelUpstreamModelUpdateTaskOnce(context.Background(), false, true, nil)

	require.Equal(t, 1, summary.CheckedChannels)
	require.Equal(t, 1, summary.FailedChannels)
	require.Zero(t, summary.ChangedChannels)
	require.Zero(t, summary.AutoAddedModels)
	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, "foo", persisted.Models)
	require.Equal(t, originalMapping, persisted.GetModelMapping())
	require.JSONEq(t, originalSettings, persisted.OtherSettings)
	require.Len(t, abilities, 1)
	require.Equal(t, "foo", abilities[0].Model)
}

func TestScheduledUpstreamModelUpdateMalformedSettingsDoNotOverwritePartialRow(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	channel := createChannelUpstreamUpdateTestChannel(t, db, "gpt-4o", nil, dto.ChannelOtherSettings{})
	organization := "preserve-organization"
	const malformedSettings = `{"upstream_model_update_check_enabled":`
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Updates(map[string]interface{}{
		"settings":             malformedSettings,
		"open_ai_organization": organization,
	}).Error)
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		t.Fatal("malformed settings must fail before fetching")
		return nil, nil
	})
	preserveChannelUpstreamModelNotifyState(t)
	channelUpstreamModelUpdateNotifyState.Lock()
	channelUpstreamModelUpdateNotifyState.lastNotifiedAt = common.GetTimestamp()
	channelUpstreamModelUpdateNotifyState.lastChangedChannels = 0
	channelUpstreamModelUpdateNotifyState.lastFailedChannels = 1
	channelUpstreamModelUpdateNotifyState.Unlock()

	summary := runChannelUpstreamModelUpdateTaskOnce(context.Background(), false, true, nil)

	require.Equal(t, 1, summary.FailedChannels)
	var persisted model.Channel
	require.NoError(t, db.First(&persisted, channel.Id).Error)
	require.Equal(t, malformedSettings, persisted.OtherSettings)
	require.NotNil(t, persisted.OpenAIOrganization)
	require.Equal(t, organization, *persisted.OpenAIOrganization)
	require.Equal(t, "gpt-4o", persisted.Models)
}

func TestFetchChannelUpstreamModelIDsDoesNotPersistPollingSelection(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)

	channel := createChannelUpstreamUpdateTestChannel(t, db, "gpt-4o", nil, dto.ChannelOtherSettings{})
	channel.Key = "key-a\nkey-b"
	channel.BaseURL = common.GetPointer("http://127.0.0.1:1")
	channel.ChannelInfo = model.ChannelInfo{
		IsMultiKey:             true,
		MultiKeySize:           2,
		MultiKeyStatusList:     map[int]int{0: common.ChannelStatusEnabled, 1: common.ChannelStatusEnabled},
		MultiKeyDisabledReason: map[int]string{},
		MultiKeyDisabledTime:   map[int]int64{},
		MultiKeyPollingIndex:   0,
		MultiKeyMode:           constant.MultiKeyModePolling,
	}
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Updates(map[string]interface{}{
		"key":          channel.Key,
		"base_url":     *channel.BaseURL,
		"channel_info": channel.ChannelInfo,
	}).Error)

	staleSnapshot := *channel
	freshInfo := channel.ChannelInfo
	freshInfo.MultiKeyStatusList = map[int]int{0: common.ChannelStatusEnabled, 1: common.ChannelStatusManuallyDisabled}
	freshInfo.MultiKeyPollingIndex = 1
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("channel_info", freshInfo).Error)

	_, err := fetchChannelUpstreamModelIDs(&staleSnapshot)

	require.Error(t, err)
	var persisted model.Channel
	require.NoError(t, db.First(&persisted, channel.Id).Error)
	require.Equal(t, freshInfo.MultiKeyStatusList, persisted.ChannelInfo.MultiKeyStatusList)
	require.Equal(t, freshInfo.MultiKeyPollingIndex, persisted.ChannelInfo.MultiKeyPollingIndex)
}

func TestBuildUpstreamModelUpdateTaskNotificationContent_OmitOverflowDetails(t *testing.T) {
	channelSummaries := make([]upstreamModelUpdateChannelSummary, 0, 12)
	for i := 0; i < 12; i++ {
		channelSummaries = append(channelSummaries, upstreamModelUpdateChannelSummary{
			ChannelName: "channel-" + string(rune('A'+i)),
			AddCount:    i + 1,
			RemoveCount: i,
		})
	}

	content := buildUpstreamModelUpdateTaskNotificationContent(
		24,
		12,
		56,
		21,
		9,
		[]int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12},
		channelSummaries,
		[]string{
			"gpt-4.1", "gpt-4.1-mini", "o3", "o4-mini", "gemini-2.5-pro", "claude-3.7-sonnet",
			"qwen-max", "deepseek-r1", "llama-3.3-70b", "mistral-large", "command-r-plus", "doubao-pro-32k",
			"hunyuan-large",
		},
		[]string{
			"gpt-3.5-turbo", "claude-2.1", "gemini-1.5-pro", "mixtral-8x7b", "qwen-plus", "glm-4",
			"yi-large", "moonshot-v1", "doubao-lite",
		},
	)

	require.Contains(t, content, "其余 4 个渠道已省略")
	require.Contains(t, content, "其余 1 个已省略")
	require.Contains(t, content, "失败渠道 ID（展示 10/12）")
	require.Contains(t, content, "其余 2 个已省略")
}

func TestApplyAllChannelUpstreamModelUpdatesFetchesFreshPending(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	channel := createChannelUpstreamUpdateTestChannel(
		t,
		db,
		"gpt-4o",
		nil,
		dto.ChannelOtherSettings{
			UpstreamModelUpdateCheckEnabled:       true,
			UpstreamModelUpdateLastDetectedModels: []string{"stale-upstream-model"},
		},
	)
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		return []string{"gpt-4o", "anthropic/fresh-model"}, nil
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/upstream_updates/apply_all", nil)
	ApplyAllChannelUpstreamModelUpdates(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			ProcessedChannels int   `json:"processed_channels"`
			AddedModels       int   `json:"added_models"`
			FailedChannelIDs  []int `json:"failed_channel_ids"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Equal(t, 1, response.Data.ProcessedChannels)
	require.Equal(t, 1, response.Data.AddedModels)
	require.Empty(t, response.Data.FailedChannelIDs)

	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, "gpt-4o,fresh-model", persisted.Models)
	require.Equal(t, []string{"fresh-model", "gpt-4o"}, []string{abilities[0].Model, abilities[1].Model})
	require.NotContains(t, persisted.Models, "stale-upstream-model")
}

func TestApplyAllChannelUpstreamModelUpdatesRejectsStaleFetchSnapshot(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	settings := dto.ChannelOtherSettings{
		UpstreamModelUpdateCheckEnabled:       true,
		UpstreamModelUpdateLastDetectedModels: []string{"anthropic/fresh-model"},
	}
	channel := createChannelUpstreamUpdateTestChannel(t, db, "gpt-4o", nil, settings)
	originalSettings := channel.OtherSettings
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("key", "fresh-key").Error)
		return []string{"gpt-4o", "anthropic/fresh-model"}, nil
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/upstream_updates/apply_all", nil)
	ApplyAllChannelUpstreamModelUpdates(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Data struct {
			ProcessedChannels int   `json:"processed_channels"`
			FailedChannelIDs  []int `json:"failed_channel_ids"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.Zero(t, response.Data.ProcessedChannels)
	require.Equal(t, []int{channel.Id}, response.Data.FailedChannelIDs)
	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, "fresh-key", persisted.Key)
	require.Equal(t, "gpt-4o", persisted.Models)
	require.JSONEq(t, originalSettings, persisted.OtherSettings)
	require.Len(t, abilities, 1)
	require.Equal(t, "gpt-4o", abilities[0].Model)
}

func TestApplyAllChannelUpstreamModelUpdatesSameNameReplacementFailsAtomically(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	settings := dto.ChannelOtherSettings{
		UpstreamModelUpdateCheckEnabled:       true,
		UpstreamModelUpdateLastDetectedModels: []string{"foo"},
		UpstreamModelUpdateLastRemovedModels:  []string{"foo"},
	}
	channel := createChannelUpstreamUpdateTestChannel(
		t,
		db,
		"foo",
		map[string]string{"foo": "anthropic/foo"},
		settings,
	)
	originalSettings := channel.OtherSettings
	originalMapping := channel.GetModelMapping()
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		return []string{"foo"}, nil
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/upstream_updates/apply_all", nil)
	ApplyAllChannelUpstreamModelUpdates(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			ProcessedChannels int   `json:"processed_channels"`
			AddedModels       int   `json:"added_models"`
			RemovedModels     int   `json:"removed_models"`
			FailedChannelIDs  []int `json:"failed_channel_ids"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Zero(t, response.Data.ProcessedChannels)
	require.Zero(t, response.Data.AddedModels)
	require.Zero(t, response.Data.RemovedModels)
	require.Equal(t, []int{channel.Id}, response.Data.FailedChannelIDs)

	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, "foo", persisted.Models)
	require.Equal(t, originalMapping, persisted.GetModelMapping())
	require.JSONEq(t, originalSettings, persisted.OtherSettings)
	require.Len(t, abilities, 1)
	require.Equal(t, "foo", abilities[0].Model)
}

func TestApplyAllChannelUpstreamModelUpdatesSkipsFreshlyDisabledChannel(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	settings := dto.ChannelOtherSettings{
		UpstreamModelUpdateCheckEnabled: true,
	}
	channel := createChannelUpstreamUpdateTestChannel(t, db, "gpt-4o", nil, settings)
	originalSettings := channel.OtherSettings
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("status", common.ChannelStatusManuallyDisabled).Error)
		return []string{"gpt-4o", "anthropic/fresh-model"}, nil
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/upstream_updates/apply_all", nil)
	ApplyAllChannelUpstreamModelUpdates(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			ProcessedChannels int   `json:"processed_channels"`
			AddedModels       int   `json:"added_models"`
			FailedChannelIDs  []int `json:"failed_channel_ids"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Zero(t, response.Data.ProcessedChannels)
	require.Zero(t, response.Data.AddedModels)
	require.Empty(t, response.Data.FailedChannelIDs)

	persisted, abilities := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, common.ChannelStatusManuallyDisabled, persisted.Status)
	require.Equal(t, "gpt-4o", persisted.Models)
	require.JSONEq(t, originalSettings, persisted.OtherSettings)
	require.Len(t, abilities, 1)
	require.Equal(t, "gpt-4o", abilities[0].Model)
}

func TestApplyChannelUpstreamModelUpdatesReturnsFreshIgnoredModels(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	channel := createChannelUpstreamUpdateTestChannel(
		t,
		db,
		"gpt-4o",
		nil,
		dto.ChannelOtherSettings{
			UpstreamModelUpdateLastDetectedModels: []string{"stale-ignore-model"},
		},
	)
	stubChannelUpstreamModelFetch(t, func(_ *model.Channel) ([]string, error) {
		return []string{"gpt-4o", "fresh-ignore-model"}, nil
	})

	body := []byte(fmt.Sprintf(`{"id":%d,"ignore_models":["fresh-ignore-model"]}`, channel.Id))
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/upstream_updates/apply", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ApplyChannelUpstreamModelUpdates(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			IgnoredModels   []string `json:"ignored_models"`
			RemainingModels []string `json:"remaining_models"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Equal(t, []string{"fresh-ignore-model"}, response.Data.IgnoredModels)
	require.Empty(t, response.Data.RemainingModels)
	persisted, _ := loadChannelUpstreamUpdateTestState(t, db, channel.Id)
	require.Equal(t, []string{"fresh-ignore-model"}, persisted.GetOtherSettings().UpstreamModelUpdateIgnoredModels)
}

func TestShouldSendUpstreamModelUpdateNotification(t *testing.T) {
	preserveChannelUpstreamModelNotifyState(t)
	channelUpstreamModelUpdateNotifyState.Lock()
	channelUpstreamModelUpdateNotifyState.lastNotifiedAt = 0
	channelUpstreamModelUpdateNotifyState.lastChangedChannels = 0
	channelUpstreamModelUpdateNotifyState.lastFailedChannels = 0
	channelUpstreamModelUpdateNotifyState.Unlock()

	baseTime := int64(2000000)

	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime, 6, 0))
	require.False(t, shouldSendUpstreamModelUpdateNotification(baseTime+3600, 6, 0))
	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime+3600, 7, 0))
	require.False(t, shouldSendUpstreamModelUpdateNotification(baseTime+7200, 7, 0))
	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime+8000, 0, 3))
	require.False(t, shouldSendUpstreamModelUpdateNotification(baseTime+9000, 0, 3))
	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime+10000, 0, 4))
	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime+90000, 7, 0))
	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime+90001, 0, 0))
}

func TestDetectAllChannelUpstreamModelUpdatesRejectsExistingActiveTask(t *testing.T) {
	db := setupChannelUpstreamUpdateTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.SystemTask{}, &model.SystemTaskLock{}))

	existing, err := model.CreateSystemTask(model.SystemTaskTypeModelUpdate, nil, nil)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/upstream-models/detect-all", nil)

	DetectAllChannelUpstreamModelUpdates(ctx)

	require.Equal(t, http.StatusConflict, recorder.Code)
	require.Contains(t, recorder.Body.String(), existing.TaskID)
	require.Contains(t, recorder.Body.String(), "已有模型更新任务正在运行或等待中")
}
