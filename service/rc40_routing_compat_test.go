package service

import (
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRC40ManagedRouteWithMultiTaskPluginBinding(t *testing.T) {
	t.Run("aliases collapse to one actual model", func(t *testing.T) {
		aliases := map[string]string{"gpt-public": "gpt-actual"}
		models := uniqueSortedStrings([]string{
			canonicalManagedModelName("gpt-public", aliases),
			canonicalManagedModelName("gpt-actual", aliases),
		})
		assert.Equal(t, []string{"gpt-actual"}, models)
	})

	t.Run("empty alias target isolates only that model", func(t *testing.T) {
		setupUpstreamOrchestrationTest(t)
		now := time.Unix(1_788_320_000, 0)
		originalModelRatios := ratio_setting.ModelRatio2JSONString()
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"gpt-4.1":1}`))
		t.Cleanup(func() {
			require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(originalModelRatios))
		})
		policy, err := operation_setting.NormalizeUpstreamRoutingPolicy(
			operation_setting.UpstreamRoutingPolicy{
				TargetGroups:            []string{"default"},
				ModelAliases:            map[string]string{" public-model ": " "},
				ModelExclusions:         map[string][]string{},
				ProtocolModelExclusions: map[string][]string{},
			},
		)
		require.NoError(t, err)

		source := model.UpstreamSource{
			Key: "source", Name: "Source", SelectedEndpoint: "https://api.example",
			Status: model.UpstreamHealthOperational, Enabled: true, LastSnapshotAt: now.Unix(),
		}
		require.NoError(t, model.DB.Create(&source).Error)
		group := model.UpstreamGroup{
			SourceID: source.ID, ExternalID: "group", Name: "Group", Platform: "openai",
			Models: `["public-model","gpt-4.1"]`, EffectiveMultiplier: 0.2,
			HealthStatus: model.UpstreamHealthOperational, ObservedAt: now.Unix(),
		}
		require.NoError(t, model.DB.Create(&group).Error)

		candidates, err := buildUpstreamRouteCandidates(
			[]model.UpstreamSource{source},
			[]model.UpstreamGroup{group},
			now,
			&operation_setting.UpstreamOrchestrationSetting{
				SyncIntervalHours:     4,
				MaxUpstreamMultiplier: 1,
				CandidateLimit:        5,
				ModelAliases:          policy.ModelAliases,
				ModelExclusions:       policy.ModelExclusions,
			},
		)

		require.NoError(t, err)
		require.Len(t, candidates, 1)
		assert.Equal(t, []string{"gpt-4.1"}, candidates[0].models)
	})

	t.Run("candidate set caps at five with source diversity", func(t *testing.T) {
		candidates := []upstreamRouteCandidate{
			rc40ManagedCandidate(1, "a-cheap", 0.01),
			rc40ManagedCandidate(1, "a-second", 0.02),
			rc40ManagedCandidate(2, "b", 0.03),
			rc40ManagedCandidate(3, "c", 0.04),
			rc40ManagedCandidate(4, "d", 0.05),
			rc40ManagedCandidate(5, "e", 0.06),
			rc40ManagedCandidate(6, "f", 0.07),
		}

		selected := selectUpstreamCandidateGroups(candidates, 5)

		require.Len(t, selected, 5)
		sources := make(map[int64]struct{}, len(selected))
		for _, candidate := range selected {
			sources[candidate.source.ID] = struct{}{}
		}
		assert.Len(t, sources, 5)
	})

	t.Run("New API binding admits only a verified plugin route", func(t *testing.T) {
		previousMemoryCache := common.MemoryCacheEnabled
		t.Cleanup(func() {
			common.MemoryCacheEnabled = previousMemoryCache
			if previousMemoryCache {
				model.InitChannelCache()
			}
		})
		setupUpstreamOrchestrationTest(t)
		common.MemoryCacheEnabled = true
		require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Ability{}))
		setting := `{"task_extend_plugin_keys":["alpha","gamma"]}`
		channel := model.Channel{
			Id: 940001, Type: constant.ChannelTypeNewAPI, Status: common.ChannelStatusEnabled,
			Name: "managed-gateway", Models: "gpt-verified", Group: "default",
			Setting: &setting,
		}
		require.NoError(t, channel.Insert())
		model.InitChannelCache()

		for _, testCase := range []struct {
			name      string
			modelName string
			pluginKey string
			want      bool
		}{
			{name: "bound plugin verified model", modelName: "gpt-verified", pluginKey: "alpha", want: true},
			{name: "unbound plugin verified model", modelName: "gpt-verified", pluginKey: "beta"},
			{name: "bound plugin unverified model", modelName: "gpt-unverified", pluginKey: "alpha"},
		} {
			t.Run(testCase.name, func(t *testing.T) {
				selected, err := model.GetRandomSatisfiedChannel("default", testCase.modelName, 0, []dto.ChannelFilter{{
					Kind:          dto.FilterTaskPluginIdentity,
					TaskPluginKey: testCase.pluginKey,
				}})
				require.NoError(t, err)
				if testCase.want {
					require.NotNil(t, selected)
					assert.Equal(t, channel.Id, selected.Id)
					return
				}
				assert.Nil(t, selected)
			})
		}
	})

	t.Run("native protocol ranks before converted", func(t *testing.T) {
		setupUpstreamOrchestrationTest(t)
		require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Ability{}))
		now := time.Unix(1_788_320_000, 0)
		source := model.UpstreamSource{
			Key: "source", Name: "Source", SelectedEndpoint: "https://api.example",
			Status: model.UpstreamHealthOperational, Enabled: true, LastSnapshotAt: now.Unix(),
		}
		require.NoError(t, model.DB.Create(&source).Error)

		groups := []model.UpstreamGroup{
			{SourceID: source.ID, ExternalID: "native", Name: "Native", Platform: "openai", EffectiveMultiplier: 0.2, HealthStatus: model.UpstreamHealthOperational, ObservedAt: now.Unix()},
			{SourceID: source.ID, ExternalID: "converted", Name: "Converted", Platform: "openai", EffectiveMultiplier: 0.1, HealthStatus: model.UpstreamHealthOperational, ObservedAt: now.Unix()},
		}
		for i := range groups {
			require.NoError(t, model.DB.Create(&groups[i]).Error)
		}
		channels := []model.Channel{
			rc40ManagedChannel("native", `{"advanced_custom":{"advanced_routes":[{"incoming_path":"/v1/responses","upstream_path":"/v1/responses","converter":"none"}]}}`),
			rc40ManagedChannel("converted", `{"advanced_custom":{"advanced_routes":[{"incoming_path":"/v1/responses","upstream_path":"/v1/chat/completions","converter":"openai_responses_to_openai_chat_completions"}]}}`),
		}
		for i := range channels {
			require.NoError(t, model.DB.Create(&channels[i]).Error)
			require.NoError(t, channels[i].AddAbilities(nil))
			require.NoError(t, model.DB.Create(&model.UpstreamManagedRoute{
				SourceID: source.ID, ExternalGroupID: groups[i].ExternalID,
				Platform: "openai", Protocol: model.UpstreamProtocolOpenAI,
				ChannelID: channels[i].Id, State: model.UpstreamRouteStateActive,
			}).Error)
		}
		candidates := []upstreamRouteCandidate{
			{source: source, group: groups[0], models: []string{"gpt-actual"}},
			{source: source, group: groups[1], models: []string{"gpt-actual"}},
		}

		result, err := rankManagedRoutes(now, []model.UpstreamSource{source}, groups, candidates,
			&operation_setting.UpstreamOrchestrationSetting{SyncIntervalHours: 4})
		require.NoError(t, err)
		assert.Equal(t, 2, result.prioritiesUpdated)
		var native, converted model.Channel
		require.NoError(t, model.DB.First(&native, channels[0].Id).Error)
		require.NoError(t, model.DB.First(&converted, channels[1].Id).Error)
		assert.Greater(t, native.GetPriority(), converted.GetPriority())
	})

	t.Run("stale snapshot retains the last verified route", func(t *testing.T) {
		now := time.Unix(1_788_320_000, 0)
		state, reason := desiredManagedRouteState(
			model.UpstreamManagedRoute{State: model.UpstreamRouteStateActive, LastReason: "last verified"},
			model.UpstreamSource{Enabled: true, LastSnapshotAt: now.Add(-6 * time.Hour).Unix()},
			model.UpstreamGroup{HealthStatus: model.UpstreamHealthOperational, ObservedAt: now.Add(-6 * time.Hour).Unix()},
			now,
			&operation_setting.UpstreamOrchestrationSetting{SyncIntervalHours: 4},
		)
		assert.Equal(t, model.UpstreamRouteStateActive, state)
		assert.Equal(t, "last verified", reason)
	})

	t.Run("unsupported isolation removes only that model", func(t *testing.T) {
		remaining, removed := removeManagedModel("gpt-failed,gpt-stable,gpt-spare", "gpt-failed")
		assert.True(t, removed)
		assert.Equal(t, []string{"gpt-stable", "gpt-spare"}, remaining)
	})
}

func rc40ManagedCandidate(sourceID int64, groupID string, multiplier float64) upstreamRouteCandidate {
	return upstreamRouteCandidate{
		source: model.UpstreamSource{ID: sourceID, Key: strings.Split(groupID, "-")[0]},
		group: model.UpstreamGroup{
			SourceID: sourceID, ExternalID: groupID, Platform: "openai",
			EffectiveMultiplier: multiplier,
		},
		models: []string{"gpt-actual"},
	}
}

func rc40ManagedChannel(name, otherSettings string) model.Channel {
	priority := int64(0)
	weight := uint(100)
	baseURL := "https://api.example"
	return model.Channel{
		Type: constant.ChannelTypeAdvancedCustom, Status: common.ChannelStatusEnabled,
		Name: name, Models: "gpt-actual", Group: "default",
		Priority: &priority, Weight: &weight, BaseURL: &baseURL, OtherSettings: otherSettings,
	}
}
