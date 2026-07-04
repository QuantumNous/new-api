package happyhorse

import "encoding/json"

const ChannelName = "HappyHorse"

// API Endpoints
const (
	TextToVideoEndpoint = "/v1/videos/generations"
	QueryTaskEndpoint   = "/v1/videos/generations"
)

// Task Status
const (
	TaskStatusPending   = "PENDING"
	TaskStatusRunning   = "running"
	TaskStatusSucceeded = "succeeded"
	TaskStatusFailed    = "failed"
)

// Resolution
const (
	Resolution720P  = "720P"
	Resolution1080P = "1080P"
)

// Default values
const (
	DefaultDuration = 5
)

// ModelList 支持的模型列表
var ModelList = []string{
	"happyhorse-1.0-t2v",
	"happyhorse-1.0-i2v",
	"happyhorse-1.0-r2v",
	"happyhorse-1.1-t2v",
	"happyhorse-1.1-i2v",
	"happyhorse-1.1-r2v",
	"wan2.7-t2v",
	"wan2.7-i2v",
	"wan2.7-r2v",
	"wan2.7-image",
	"wan2.7-image-pro",
}

// ResolutionRatios 分辨率倍率（相对于 720P 基准价）
var ResolutionRatios = map[string]float64{
	Resolution720P:  1.0,         // 720P: ¥0.90/秒 (基准)
	Resolution1080P: 1.60 / 0.90, // 1080P: ¥1.60/秒 (≈1.778)
}

// MediaItem 媒体条目（I2V/R2V）
type MediaItem struct {
	Type string `json:"type"`
	URL  string `json:"url"`
}

// VideoRequest 视频生成请求
type VideoRequest struct {
	Model      string      `json:"model"`
	Prompt     string      `json:"prompt"`
	Resolution string      `json:"resolution,omitempty"`
	Ratio      string      `json:"ratio,omitempty"`
	Duration   int         `json:"duration,omitempty"`
	Media      []MediaItem `json:"media,omitempty"`
}

// VideoResponse 视频生成响应 (SiliEvo 格式)
type VideoResponse struct {
	Success bool               `json:"success"`
	Data    *VideoResponseData `json:"data,omitempty"`
}

type VideoResponseData struct {
	TaskID string `json:"task_id"`
	Model  string `json:"model"`
	Status string `json:"status,omitempty"`
}

// QueryTaskResponse 查询任务响应 (SiliEvo 格式)
type QueryTaskResponse struct {
	ID     string              `json:"id"`
	Object string              `json:"object"`
	Model  string              `json:"model"`
	Status string              `json:"status"`
	Data   []json.RawMessage   `json:"data"`
	Error  *QueryTaskError     `json:"error,omitempty"`
}

type QueryTaskError struct {
	Message string `json:"message"`
	Code    string `json:"code"`
}
