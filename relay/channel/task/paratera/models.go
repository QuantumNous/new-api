package paratera

import "github.com/QuantumNous/new-api/relay/channel/task/hailuo"

// 复用 hailuo 包的请求/响应结构与分辨率/状态码常量，
// 并行平台的 body / 状态语义与 MiniMax 官方完全一致，只是端点路径多 /p004。

type (
	VideoRequest         = hailuo.VideoRequest
	VideoResponse        = hailuo.VideoResponse
	QueryTaskResponse    = hailuo.QueryTaskResponse
	RetrieveFileResponse = hailuo.RetrieveFileResponse
	ModelConfig          = hailuo.ModelConfig
)

const (
	StatusSuccess = hailuo.StatusSuccess

	TaskStatusPreparing  = hailuo.TaskStatusPreparing
	TaskStatusQueueing   = hailuo.TaskStatusQueueing
	TaskStatusProcessing = hailuo.TaskStatusProcessing
	TaskStatusSuccess    = hailuo.TaskStatusSuccess
	TaskStatusFailed     = hailuo.TaskStatusFailed

	Resolution720P  = hailuo.Resolution720P
	Resolution768P  = hailuo.Resolution768P
	Resolution1080P = hailuo.Resolution1080P

	DefaultDuration   = hailuo.DefaultDuration
	DefaultResolution = hailuo.DefaultResolution
)

// modelConfigs 是并行平台支持的 6 个 MiniMax 视频模型的默认参数表，
// 仅用于 adaptor 内部决定缺省 resolution 等。具体分辨率 / 时长 / 价格以
// 后台模型表与渠道配置为准。
var modelConfigs = map[string]ModelConfig{
	"MiniMax-T2V-01": {
		Name:                 "MiniMax-T2V-01",
		DefaultResolution:    Resolution720P,
		SupportedDurations:   []int{6},
		SupportedResolutions: []string{Resolution720P},
		HasPromptOptimizer:   true,
	},
	"MiniMax-T2V-01-Director": {
		Name:                 "MiniMax-T2V-01-Director",
		DefaultResolution:    Resolution720P,
		SupportedDurations:   []int{6},
		SupportedResolutions: []string{Resolution720P, Resolution1080P},
		HasPromptOptimizer:   true,
	},
	"MiniMax-Hailuo-02": {
		Name:                 "MiniMax-Hailuo-02",
		DefaultResolution:    Resolution768P,
		SupportedDurations:   []int{6, 10},
		SupportedResolutions: []string{Resolution768P, Resolution1080P},
		HasPromptOptimizer:   true,
		HasFastPretreatment:  true,
	},
	"MiniMax-I2V-01": {
		Name:                 "MiniMax-I2V-01",
		DefaultResolution:    Resolution720P,
		SupportedDurations:   []int{6},
		SupportedResolutions: []string{Resolution720P},
		HasPromptOptimizer:   true,
	},
	"MiniMax-I2V-01-Live": {
		Name:                 "MiniMax-I2V-01-Live",
		DefaultResolution:    Resolution720P,
		SupportedDurations:   []int{6},
		SupportedResolutions: []string{Resolution720P},
		HasPromptOptimizer:   true,
	},
	"MiniMax-I2V-01-Director": {
		Name:                 "MiniMax-I2V-01-Director",
		DefaultResolution:    Resolution720P,
		SupportedDurations:   []int{6},
		SupportedResolutions: []string{Resolution720P, Resolution1080P},
		HasPromptOptimizer:   true,
	},
}

func GetModelConfig(model string) ModelConfig {
	if cfg, ok := modelConfigs[model]; ok {
		return cfg
	}
	return ModelConfig{
		Name:                 model,
		DefaultResolution:    DefaultResolution,
		SupportedDurations:   []int{DefaultDuration},
		SupportedResolutions: []string{DefaultResolution},
		HasPromptOptimizer:   true,
	}
}
