package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

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

func TestNormalizeChannelModelMapping(t *testing.T) {
	modelMapping := `{
		" alias-model ": " upstream-model ",
		"": "invalid",
		"invalid-target": ""
	}`
	channel := &model.Channel{
		ModelMapping: &modelMapping,
	}

	result := normalizeChannelModelMapping(channel)
	require.Equal(t, map[string]string{
		"alias-model": "upstream-model",
	}, result)
}

func TestCollectPendingUpstreamModelChangesFromModels_WithModelMapping(t *testing.T) {
	pendingAddModels, pendingRemoveModels := collectPendingUpstreamModelChangesFromModels(
		[]string{"alias-model", "gpt-4o", "stale-model"},
		[]string{"gpt-4o", "gpt-4.1", "mapped-target"},
		[]string{"gpt-4.1"},
		map[string]string{
			"alias-model": "mapped-target",
		},
	)

	require.Equal(t, []string{}, pendingAddModels)
	require.Equal(t, []string{"stale-model"}, pendingRemoveModels)
}

func TestCollectPendingUpstreamModelChangesFromModels_WithIgnoredRegexPatterns(t *testing.T) {
	pendingAddModels, pendingRemoveModels := collectPendingUpstreamModelChangesFromModels(
		[]string{"gpt-4o"},
		[]string{"gpt-4o", "claude-3-5-sonnet", "sora-video", "gpt-4.1"},
		[]string{"regex:^sora-.*$", "gpt-4.1"},
		nil,
	)

	require.Equal(t, []string{"claude-3-5-sonnet"}, pendingAddModels)
	require.Equal(t, []string{}, pendingRemoveModels)
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

func TestShouldSendUpstreamModelUpdateNotification(t *testing.T) {
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
	db := setupModelListControllerTestDB(t)
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

func TestCollectPendingUpstreamModelChangesFromModels_CaseInsensitiveIdentity(t *testing.T) {
	// Local uses mixed-case provider IDs; upstream returns lowercased same IDs.
	// Must not report remove+add churn for the same logical models.
	pendingAdd, pendingRemove := collectPendingUpstreamModelChangesFromModels(
		[]string{"DeepSeek-V3.1", "Meta-Llama-3.3-70B-Instruct", "gemma-4-31B-it"},
		[]string{"deepseek-v3.1", "meta-llama-3.3-70b-instruct", "gemma-4-31b-it"},
		nil,
		map[string]string{
			"deepseek-v3.1": "DeepSeek-V3.1",
			"llama-3.3-70b":  "Meta-Llama-3.3-70B-Instruct",
			"gemma-4-31b":    "gemma-4-31B-it",
		},
	)

	require.Empty(t, pendingAdd)
	require.Empty(t, pendingRemove)
}

func TestCollectPendingUpstreamModelChangesFromModels_MappingSourceNotRemoved(t *testing.T) {
	// Standard client names live only via mapping; upstream never lists them.
	pendingAdd, pendingRemove := collectPendingUpstreamModelChangesFromModels(
		[]string{"deepseek-v3.1", "DeepSeek-V3.1", "stale-gone"},
		[]string{"DeepSeek-V3.1", "new-upstream"},
		nil,
		map[string]string{
			"deepseek-v3.1": "DeepSeek-V3.1",
		},
	)

	require.Equal(t, []string{"new-upstream"}, pendingAdd)
	require.Equal(t, []string{"stale-gone"}, pendingRemove)
}

func TestCollectPendingUpstreamModelChangesFromModels_MappingTargetCoversUpstream(t *testing.T) {
	// models list only has standard names; mapping targets cover upstream IDs.
	pendingAdd, pendingRemove := collectPendingUpstreamModelChangesFromModels(
		[]string{"llama-3.3-70b", "gemma-4-31b"},
		[]string{"Meta-Llama-3.3-70B-Instruct", "gemma-4-31B-it"},
		nil,
		map[string]string{
			"llama-3.3-70b": "Meta-Llama-3.3-70B-Instruct",
			"gemma-4-31b":   "gemma-4-31B-it",
		},
	)

	require.Empty(t, pendingAdd)
	require.Empty(t, pendingRemove)
}

func TestEnsureModelsIncludeMappingSources(t *testing.T) {
	result := ensureModelsIncludeMappingSources(
		[]string{"DeepSeek-V3.1"},
		map[string]string{
			"deepseek-v3.1": "DeepSeek-V3.1",
			"llama-3.3-70b":  "Meta-Llama-3.3-70B-Instruct",
		},
	)
	require.ElementsMatch(t, []string{"DeepSeek-V3.1", "deepseek-v3.1", "llama-3.3-70b"}, result)
}

func TestRewriteMappingTargetsForCaseDrift(t *testing.T) {
	mapping := map[string]string{
		"deepseek-v3.1": "DeepSeek-V3.1",
		"gemma-4-31b":   "gemma-4-31B-it",
	}
	next, changed := rewriteMappingTargetsForCaseDrift(
		mapping,
		[]string{"DeepSeek-V3.1", "gemma-4-31B-it"},
		[]string{"deepseek-v3.1", "gemma-4-31b-it"},
	)
	require.True(t, changed)
	require.Equal(t, "deepseek-v3.1", next["deepseek-v3.1"])
	require.Equal(t, "gemma-4-31b-it", next["gemma-4-31b"])
}

func TestModelIdentityKey(t *testing.T) {
	require.Equal(t, "deepseek-v3.1", modelIdentityKey(" DeepSeek-V3.1 "))
	require.Equal(t, modelIdentityKey("GPT-OSS-120B"), modelIdentityKey("gpt-oss-120b"))
}
