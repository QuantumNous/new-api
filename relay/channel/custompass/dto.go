package custompass

import (
	"encoding/json"
	"errors"
	"strings"
)

// UpstreamResponse represents the unified response format from upstream APIs
type UpstreamResponse struct {
	Code    interface{} `json:"code"`              // int or string, 0 means success
	Message string      `json:"message,omitempty"` // possible message field
	Msg     string      `json:"msg,omitempty"`     // possible msg field
	Data    interface{} `json:"data"`              // response data, can be any type
	Type    string      `json:"type,omitempty"`    // response type, "precharge" for precharge
	Usage   *Usage      `json:"usage,omitempty"`   // token usage information
}

// GetMessage returns error message, prioritizing message field over msg field
func (r *UpstreamResponse) GetMessage() string {
	if r.Message != "" {
		return r.Message
	}
	if r.Msg != "" {
		return r.Msg
	}
	return "未知错误" // default value when both fields are missing
}

// IsSuccess checks if the response indicates success
func (r *UpstreamResponse) IsSuccess() bool {
	switch code := r.Code.(type) {
	case int:
		return code == 0
	case float64:
		return code == 0
	case string:
		return code == "0"
	default:
		return false
	}
}

// IsPrecharge checks if this is a precharge response
func (r *UpstreamResponse) IsPrecharge() bool {
	return r.Type == "precharge"
}

// Usage represents token usage information
type Usage struct {
	// Required fields - for basic billing
	PromptTokens     int `json:"prompt_tokens"`     // required: input token count
	CompletionTokens int `json:"completion_tokens"` // required: output token count
	TotalTokens      int `json:"total_tokens"`      // required: total token count

	// Optional fields - for advanced billing strategies
	PromptCacheHitTokens    int                      `json:"prompt_cache_hit_tokens,omitempty"`
	PromptTokensDetails     *PromptTokensDetails     `json:"prompt_tokens_details,omitempty"`
	CompletionTokensDetails *CompletionTokensDetails `json:"completion_tokens_details,omitempty"`

	// Compatibility fields - support other formats
	InputTokens  int     `json:"input_tokens,omitempty"`  // compatible with input_tokens format
	OutputTokens int     `json:"output_tokens,omitempty"` // compatible with output_tokens format
	Cost         float64 `json:"cost,omitempty"`          // third-party platform cost information
}

type PromptTokensDetails struct {
	CachedTokens int `json:"cached_tokens"` // cached token count
	TextTokens   int `json:"text_tokens"`   // text token count
	AudioTokens  int `json:"audio_tokens"`  // audio token count
	ImageTokens  int `json:"image_tokens"`  // image token count
}

type CompletionTokensDetails struct {
	TextTokens      int `json:"text_tokens"`      // text output token count
	AudioTokens     int `json:"audio_tokens"`     // audio output token count
	ReasoningTokens int `json:"reasoning_tokens"` // reasoning token count
}

// Validate validates the usage information
func (u *Usage) Validate() error {
	if u.PromptTokens < 0 || u.CompletionTokens < 0 || u.TotalTokens < 0 {
		return errors.New("token数量不能为负数")
	}

	if u.TotalTokens != u.PromptTokens+u.CompletionTokens {
		return errors.New("总token数量与输入输出token数量之和不匹配")
	}

	return nil
}

// GetInputTokens returns compatible input token count
func (u *Usage) GetInputTokens() int {
	if u.InputTokens > 0 {
		return u.InputTokens
	}
	return u.PromptTokens
}

// GetOutputTokens returns compatible output token count
func (u *Usage) GetOutputTokens() int {
	if u.OutputTokens > 0 {
		return u.OutputTokens
	}
	return u.CompletionTokens
}

// SyncResponse represents synchronous interface response
type SyncResponse struct {
	UpstreamResponse
	// Data field contains actual business data, format determined by upstream API
	// Can be string, object, array or null
}

// TaskSubmitResponse represents task submission response
type TaskSubmitResponse struct {
	UpstreamResponse
	Data *TaskSubmitData `json:"data"`
}

type TaskSubmitData struct {
	TaskID   string `json:"task_id"`  // required: unique task identifier
	Status   string `json:"status"`   // required: task status
	Progress string `json:"progress"` // optional: task progress, like "0%"
}

// TaskQueryRequest represents task query request
type TaskQueryRequest struct {
	TaskIDs []string `json:"task_ids"` // required: list of task IDs to query
}

// TaskQueryResponse represents task query response
type TaskQueryResponse struct {
	UpstreamResponse
	Data []*TaskInfo `json:"data"` // required: array of task information
}

// GetTaskList returns the task list from the response
func (r *TaskQueryResponse) GetTaskList() []*TaskInfo {
	if r.Data == nil {
		return []*TaskInfo{}
	}
	return r.Data
}

type TaskInfo struct {
	TaskID   string      `json:"task_id"`  // required: unique task identifier
	Status   string      `json:"status"`   // required: task status
	Progress string      `json:"progress"` // optional: task progress percentage
	Error    string      `json:"error"`    // optional: error message (when failed)
	Result   interface{} `json:"result"`   // optional: task result (when completed)
	Usage    *Usage      `json:"usage"`    // optional: actual usage (when completed)
}

// CustomPassStatusMapping represents status mapping configuration
type CustomPassStatusMapping struct {
	Success    []string // completed,success,finished
	Failed     []string // failed,error,cancelled
	Processing []string // processing,pending,running
}

// MapUpstreamStatus maps upstream status to system TaskStatus
func MapUpstreamStatus(upstreamStatus string, mapping *CustomPassStatusMapping) string {
	// Check success status
	for _, status := range mapping.Success {
		if strings.EqualFold(upstreamStatus, status) {
			return "SUCCESS"
		}
	}

	// Check failed status
	for _, status := range mapping.Failed {
		if strings.EqualFold(upstreamStatus, status) {
			return "FAILURE"
		}
	}

	// Check processing status
	for _, status := range mapping.Processing {
		if strings.EqualFold(upstreamStatus, status) {
			return "IN_PROGRESS"
		}
	}

	// Default return unknown status
	return "UNKNOWN"
}

// Note: CustomPassError and error codes are defined in errors.go

// CustomPassConfig represents CustomPass configuration
type CustomPassConfig struct {
	// Polling configuration
	PollInterval    int `json:"poll_interval"`     // polling interval in seconds
	TaskTimeout     int `json:"task_timeout"`      // query timeout in seconds
	MaxConcurrent   int `json:"max_concurrent"`    // maximum concurrent queries
	TaskMaxLifetime int `json:"task_max_lifetime"` // task maximum lifetime in seconds
	BatchSize       int `json:"batch_size"`        // batch query size

	// Authentication configuration
	HeaderKey string `json:"header_key"` // custom token header name

	// Status mapping configuration
	StatusSuccess    []string `json:"status_success"`    // success status list
	StatusFailed     []string `json:"status_failed"`     // failed status list
	StatusProcessing []string `json:"status_processing"` // processing status list
}

// GetDefaultConfig returns default CustomPass configuration
func GetDefaultConfig() *CustomPassConfig {
	return &CustomPassConfig{
		PollInterval:     30,
		TaskTimeout:      15,
		MaxConcurrent:    100,
		TaskMaxLifetime:  3600,
		BatchSize:        50,
		HeaderKey:        "X-Custom-Token",
		StatusSuccess:    []string{"completed", "success", "finished"},
		StatusFailed:     []string{"failed", "error", "cancelled"},
		StatusProcessing: []string{"processing", "pending", "running"},
	}
}

// ParseUpstreamResponse parses raw response data into UpstreamResponse
func ParseUpstreamResponse(data []byte) (*UpstreamResponse, error) {
	var response UpstreamResponse
	if err := json.Unmarshal(data, &response); err != nil {
		return nil, NewCustomPassErrorWithCause(ErrCodeUpstreamError, "解析上游响应失败", err)
	}
	return &response, nil
}

// ValidateResponse validates the upstream response structure
func (r *UpstreamResponse) ValidateResponse() error {
	// Check if code field exists
	if r.Code == nil {
		return NewCustomPassError(ErrCodeUpstreamResponse, "上游响应缺少code字段")
	}

	// For error responses, message or msg field should exist
	if !r.IsSuccess() && r.Message == "" && r.Msg == "" {
		return NewCustomPassError(ErrCodeUpstreamResponse, "上游错误响应缺少message或msg字段")
	}

	// Validate usage if present
	if r.Usage != nil {
		if err := r.Usage.Validate(); err != nil {
			return NewCustomPassErrorWithCause(ErrCodeUpstreamResponse, "上游响应usage字段无效", err)
		}
	}

	return nil
}

// ExtractTaskID extracts task ID from task submission response
func (r *TaskSubmitResponse) ExtractTaskID() (string, error) {
	if r.Data == nil {
		return "", NewCustomPassError(ErrCodeUpstreamResponse, "任务提交响应缺少data字段")
	}

	if r.Data.TaskID == "" {
		return "", NewCustomPassError(ErrCodeUpstreamResponse, "任务提交响应缺少task_id字段")
	}

	return r.Data.TaskID, nil
}

// ValidateTaskInfo validates task information
func (t *TaskInfo) ValidateTaskInfo() error {
	if t.TaskID == "" {
		return NewCustomPassError(ErrCodeUpstreamResponse, "任务信息缺少task_id字段")
	}

	if t.Status == "" {
		return NewCustomPassError(ErrCodeUpstreamResponse, "任务信息缺少status字段")
	}

	// Validate usage if present
	if t.Usage != nil {
		if err := t.Usage.Validate(); err != nil {
			return NewCustomPassErrorWithCause(ErrCodeUpstreamResponse, "任务信息usage字段无效", err)
		}
	}

	return nil
}

// IsCompleted checks if task is completed
func (t *TaskInfo) IsCompleted(mapping *CustomPassStatusMapping) bool {
	mappedStatus := MapUpstreamStatus(t.Status, mapping)
	return mappedStatus == "SUCCESS"
}

// IsFailed checks if task is failed
func (t *TaskInfo) IsFailed(mapping *CustomPassStatusMapping) bool {
	mappedStatus := MapUpstreamStatus(t.Status, mapping)
	return mappedStatus == "FAILURE"
}

// IsProcessing checks if task is still processing
func (t *TaskInfo) IsProcessing(mapping *CustomPassStatusMapping) bool {
	mappedStatus := MapUpstreamStatus(t.Status, mapping)
	return mappedStatus == "IN_PROGRESS"
}

// GetStatusMapping creates status mapping from configuration
func (c *CustomPassConfig) GetStatusMapping() *CustomPassStatusMapping {
	return &CustomPassStatusMapping{
		Success:    c.StatusSuccess,
		Failed:     c.StatusFailed,
		Processing: c.StatusProcessing,
	}
}

// ValidateConfig validates CustomPass configuration
func (c *CustomPassConfig) ValidateConfig() error {
	if c.PollInterval <= 0 {
		return NewCustomPassError(ErrCodeConfigError, "轮询间隔必须大于0")
	}

	if c.TaskTimeout <= 0 {
		return NewCustomPassError(ErrCodeConfigError, "任务超时时间必须大于0")
	}

	if c.MaxConcurrent <= 0 {
		return NewCustomPassError(ErrCodeConfigError, "最大并发数必须大于0")
	}

	if c.BatchSize <= 0 || c.BatchSize > 1000 {
		return NewCustomPassError(ErrCodeConfigError, "批量大小必须在1-1000之间")
	}

	if c.HeaderKey == "" {
		return NewCustomPassError(ErrCodeConfigError, "自定义token头名称不能为空")
	}

	return nil
}
