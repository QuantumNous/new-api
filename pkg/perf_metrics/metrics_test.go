package perfmetrics

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	settingconfig "github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setMetricsEnabled(t *testing.T, enabled bool) {
	t.Helper()
	previous := perf_metrics_setting.GetSetting().Enabled
	require.NoError(t, settingconfig.GlobalConfig.LoadFromDB(map[string]string{
		"perf_metrics_setting.enabled": boolString(enabled),
	}))
	t.Cleanup(func() {
		require.NoError(t, settingconfig.GlobalConfig.LoadFromDB(map[string]string{
			"perf_metrics_setting.enabled": boolString(previous),
		}))
	})
}

func boolString(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func TestQueriesHideHistoricalMetricsWhenDisabled(t *testing.T) {
	setMetricsEnabled(t, false)

	result, err := Query(QueryParams{Model: "video-model", Hours: 24})
	require.NoError(t, err)
	assert.False(t, result.Enabled)
	assert.Equal(t, "video-model", result.ModelName)
	assert.Empty(t, result.Groups)

	summary, err := QuerySummaryAll(24, nil)
	require.NoError(t, err)
	assert.False(t, summary.Enabled)
	assert.Empty(t, summary.Models)
}

func TestTaskTerminalSample(t *testing.T) {
	tests := []struct {
		name        string
		task        *model.Task
		now         int64
		wantOK      bool
		wantModel   string
		wantGroup   string
		wantMs      int64
		wantSuccess bool
	}{
		{
			name: "successful video task",
			task: &model.Task{
				Platform:   constant.TaskPlatform("kling"),
				Status:     model.TaskStatusSuccess,
				Group:      "video",
				SubmitTime: 100,
				FinishTime: 112,
				Properties: model.Properties{OriginModelName: "video-public"},
			},
			now:         120,
			wantOK:      true,
			wantModel:   "video-public",
			wantGroup:   "video",
			wantMs:      12_000,
			wantSuccess: true,
		},
		{
			name: "failed task uses billing model and current finish time",
			task: &model.Task{
				Platform:  constant.TaskPlatform("kling"),
				Status:    model.TaskStatusFailure,
				CreatedAt: 200,
				PrivateData: model.TaskPrivateData{BillingContext: &model.TaskBillingContext{
					OriginModelName: "billing-model",
				}},
			},
			now:       209,
			wantOK:    true,
			wantModel: "billing-model",
			wantMs:    9_000,
		},
		{
			name: "upstream model fallback",
			task: &model.Task{
				Platform:   constant.TaskPlatform("kling"),
				Status:     model.TaskStatusSuccess,
				SubmitTime: 300,
				FinishTime: 304,
				Properties: model.Properties{UpstreamModelName: "upstream-model"},
			},
			now:         310,
			wantOK:      true,
			wantModel:   "upstream-model",
			wantMs:      4_000,
			wantSuccess: true,
		},
		{
			name:   "non-terminal task",
			task:   &model.Task{Platform: constant.TaskPlatform("kling"), Status: model.TaskStatusInProgress},
			now:    100,
			wantOK: false,
		},
		{
			name:   "suno is not a video task",
			task:   &model.Task{Platform: constant.TaskPlatformSuno, Status: model.TaskStatusSuccess, Properties: model.Properties{OriginModelName: "suno"}},
			now:    100,
			wantOK: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sample, ok := taskTerminalSample(tt.task, tt.now)
			assert.Equal(t, tt.wantOK, ok)
			if !tt.wantOK {
				return
			}
			assert.Equal(t, tt.wantModel, sample.Model)
			assert.Equal(t, tt.wantGroup, sample.Group)
			assert.Equal(t, tt.wantMs, sample.LatencyMs)
			assert.Equal(t, tt.wantMs, sample.GenerationMs)
			assert.Equal(t, tt.wantSuccess, sample.Success)
			assert.False(t, sample.HasTtft)
			assert.Zero(t, sample.OutputTokens)
		})
	}
}

func TestSupportsOnlyAsyncVideo(t *testing.T) {
	assert.False(t, supportsOnlyAsyncVideo(nil))
	assert.True(t, supportsOnlyAsyncVideo([]constant.EndpointType{constant.EndpointTypeOpenAIVideo}))
	assert.False(t, supportsOnlyAsyncVideo([]constant.EndpointType{
		constant.EndpointTypeOpenAIVideo,
		constant.EndpointTypeOpenAI,
	}))
	assert.False(t, supportsOnlyAsyncVideo([]constant.EndpointType{constant.EndpointTypeOpenAI}))
}
