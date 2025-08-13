package custompass

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"one-api/common"
)

// CustomPassLogger provides structured logging for CustomPass operations
type CustomPassLogger struct{}

// NewCustomPassLogger creates a new CustomPass logger
func NewCustomPassLogger() *CustomPassLogger {
	return &CustomPassLogger{}
}

// LogEntry represents a structured log entry for CustomPass operations
type LogEntry struct {
	RequestID       string        `json:"request_id"`
	UserID          int           `json:"user_id"`
	ChannelID       int           `json:"channel_id"`
	Model           string        `json:"model"`
	Mode            string        `json:"mode"` // sync/async
	TaskID          string        `json:"task_id,omitempty"`
	PrechargeAmount int64         `json:"precharge_amount"`
	ActualAmount    int64         `json:"actual_amount"`
	RefundAmount    int64         `json:"refund_amount,omitempty"`
	ProcessTime     time.Duration `json:"process_time"`
	Status          string        `json:"status"`
	Error           string        `json:"error,omitempty"`
	UpstreamURL     string        `json:"upstream_url,omitempty"`
	HTTPStatus      int           `json:"http_status,omitempty"`
	Timestamp       time.Time     `json:"timestamp"`
}

// LogRequest logs the start of a request
func (l *CustomPassLogger) LogRequest(entry *LogEntry) {
	ctx := l.buildContext(entry)
	msg := l.buildLogMessage("request started", entry)
	common.LogInfo(ctx, msg)
}

// LogResponse logs the completion of a request
func (l *CustomPassLogger) LogResponse(entry *LogEntry) {
	ctx := l.buildContext(entry)

	if entry.Error != "" {
		msg := l.buildLogMessage("request failed", entry)
		common.LogError(ctx, msg)
	} else {
		msg := l.buildLogMessage("request completed", entry)
		common.LogInfo(ctx, msg)
	}
}

// LogPrecharge logs precharge operations
func (l *CustomPassLogger) LogPrecharge(entry *LogEntry) {
	ctx := l.buildContext(entry)

	if entry.Error != "" {
		msg := l.buildLogMessage("precharge failed", entry)
		common.LogError(ctx, msg)
	} else {
		msg := l.buildLogMessage("precharge completed", entry)
		common.LogInfo(ctx, msg)
	}
}

// LogBilling logs billing operations
func (l *CustomPassLogger) LogBilling(entry *LogEntry) {
	ctx := l.buildContext(entry)

	if entry.Error != "" {
		msg := l.buildLogMessage("billing failed", entry)
		common.LogError(ctx, msg)
	} else {
		msg := l.buildLogMessage("billing completed", entry)
		common.LogInfo(ctx, msg)
	}
}

// LogTaskSubmission logs async task submissions
func (l *CustomPassLogger) LogTaskSubmission(entry *LogEntry) {
	ctx := l.buildContext(entry)

	if entry.Error != "" {
		msg := l.buildLogMessage("task submission failed", entry)
		common.LogError(ctx, msg)
	} else {
		msg := l.buildLogMessage("task submitted", entry)
		common.LogInfo(ctx, msg)
	}
}

// LogTaskCompletion logs async task completions
func (l *CustomPassLogger) LogTaskCompletion(entry *LogEntry) {
	ctx := l.buildContext(entry)

	if entry.Error != "" {
		msg := l.buildLogMessage("task completion failed", entry)
		common.LogError(ctx, msg)
	} else {
		msg := l.buildLogMessage("task completed", entry)
		common.LogInfo(ctx, msg)
	}
}

// LogPolling logs task polling operations
func (l *CustomPassLogger) LogPolling(batchSize int, processedTasks int, errors []error) {
	ctx := context.Background()

	msg := fmt.Sprintf("CustomPass polling - BatchSize: %d, ProcessedTasks: %d, ErrorCount: %d",
		batchSize, processedTasks, len(errors))

	if len(errors) > 0 {
		errorMessages := make([]string, len(errors))
		for i, err := range errors {
			errorMessages[i] = err.Error()
		}
		msg += fmt.Sprintf(", Errors: %v", errorMessages)
		common.LogWarn(ctx, msg)
	} else {
		common.LogInfo(ctx, msg)
	}
}

// LogUpstreamRequest logs upstream API requests
func (l *CustomPassLogger) LogUpstreamRequest(requestID, method, url string, headers map[string]string, body []byte) {
	ctx := context.Background()
	if requestID != "" {
		ctx = context.WithValue(ctx, common.RequestIdKey, requestID)
	}

	// Log headers (excluding sensitive information)
	safeHeaders := make(map[string]string)
	for k, v := range headers {
		if k == "Authorization" || k == "X-Custom-Token" {
			safeHeaders[k] = "[REDACTED]"
		} else {
			safeHeaders[k] = v
		}
	}

	msg := fmt.Sprintf("CustomPass upstream request - Method: %s, URL: %s, Headers: %v",
		method, url, safeHeaders)

	// Log body size instead of content for privacy
	if body != nil {
		msg += fmt.Sprintf(", BodySize: %d", len(body))
	}

	common.LogInfo(ctx, msg)
}

// LogUpstreamResponse logs upstream API responses
func (l *CustomPassLogger) LogUpstreamResponse(requestID string, statusCode int, responseTime time.Duration, body []byte) {
	ctx := context.Background()
	if requestID != "" {
		ctx = context.WithValue(ctx, common.RequestIdKey, requestID)
	}

	msg := fmt.Sprintf("CustomPass upstream response - StatusCode: %d, ResponseTime: %v",
		statusCode, responseTime)

	// Log response size instead of content for privacy
	if body != nil {
		msg += fmt.Sprintf(", ResponseSize: %d", len(body))
	}

	if statusCode >= 400 {
		common.LogWarn(ctx, msg)
	} else {
		common.LogInfo(ctx, msg)
	}
}

// LogConfigUpdate logs configuration updates
func (l *CustomPassLogger) LogConfigUpdate(configType string, oldValue, newValue interface{}) {
	ctx := context.Background()
	msg := fmt.Sprintf("CustomPass configuration updated - Type: %s, OldValue: %v, NewValue: %v",
		configType, oldValue, newValue)
	common.LogInfo(ctx, msg)
}

// LogMetrics logs performance metrics
func (l *CustomPassLogger) LogMetrics(metrics *PerformanceMetrics) {
	ctx := context.Background()
	msg := fmt.Sprintf("CustomPass metrics - TotalRequests: %d, SuccessfulRequests: %d, FailedRequests: %d, AvgResponseTime: %v, MaxResponseTime: %v, TotalPrechargeAmount: %d, TotalActualAmount: %d, TotalRefundAmount: %d",
		metrics.TotalRequests, metrics.SuccessfulRequests, metrics.FailedRequests,
		metrics.AvgResponseTime, metrics.MaxResponseTime,
		metrics.TotalPrechargeAmount, metrics.TotalActualAmount, metrics.TotalRefundAmount)
	common.LogInfo(ctx, msg)
}

// buildContext creates a context with request ID for logging
func (l *CustomPassLogger) buildContext(entry *LogEntry) context.Context {
	ctx := context.Background()
	if entry.RequestID != "" {
		ctx = context.WithValue(ctx, common.RequestIdKey, entry.RequestID)
	}
	return ctx
}

// buildLogMessage builds a structured log message from LogEntry
func (l *CustomPassLogger) buildLogMessage(operation string, entry *LogEntry) string {
	msg := fmt.Sprintf("CustomPass %s", operation)

	if entry.UserID > 0 {
		msg += fmt.Sprintf(", UserID: %d", entry.UserID)
	}
	if entry.ChannelID > 0 {
		msg += fmt.Sprintf(", ChannelID: %d", entry.ChannelID)
	}
	if entry.Model != "" {
		msg += fmt.Sprintf(", Model: %s", entry.Model)
	}
	if entry.Mode != "" {
		msg += fmt.Sprintf(", Mode: %s", entry.Mode)
	}
	if entry.TaskID != "" {
		msg += fmt.Sprintf(", TaskID: %s", entry.TaskID)
	}
	if entry.PrechargeAmount > 0 {
		msg += fmt.Sprintf(", PrechargeAmount: %d", entry.PrechargeAmount)
	}
	if entry.ActualAmount > 0 {
		msg += fmt.Sprintf(", ActualAmount: %d", entry.ActualAmount)
	}
	if entry.RefundAmount > 0 {
		msg += fmt.Sprintf(", RefundAmount: %d", entry.RefundAmount)
	}
	if entry.ProcessTime > 0 {
		msg += fmt.Sprintf(", ProcessTime: %v", entry.ProcessTime)
	}
	if entry.Status != "" {
		msg += fmt.Sprintf(", Status: %s", entry.Status)
	}
	if entry.Error != "" {
		msg += fmt.Sprintf(", Error: %s", entry.Error)
	}
	if entry.UpstreamURL != "" {
		msg += fmt.Sprintf(", UpstreamURL: %s", entry.UpstreamURL)
	}
	if entry.HTTPStatus > 0 {
		msg += fmt.Sprintf(", HTTPStatus: %d", entry.HTTPStatus)
	}

	return msg
}

// PerformanceMetrics represents performance metrics for CustomPass
type PerformanceMetrics struct {
	TotalRequests        int64         `json:"total_requests"`
	SuccessfulRequests   int64         `json:"successful_requests"`
	FailedRequests       int64         `json:"failed_requests"`
	AvgResponseTime      time.Duration `json:"avg_response_time"`
	MaxResponseTime      time.Duration `json:"max_response_time"`
	TotalPrechargeAmount int64         `json:"total_precharge_amount"`
	TotalActualAmount    int64         `json:"total_actual_amount"`
	TotalRefundAmount    int64         `json:"total_refund_amount"`
}

// ToJSON converts LogEntry to JSON string
func (entry *LogEntry) ToJSON() string {
	data, err := json.Marshal(entry)
	if err != nil {
		return "{\"error\":\"failed to marshal log entry\"}"
	}
	return string(data)
}

// NewLogEntry creates a new log entry with timestamp
func NewLogEntry() *LogEntry {
	return &LogEntry{
		Timestamp: time.Now(),
	}
}

// WithRequestID sets the request ID
func (entry *LogEntry) WithRequestID(requestID string) *LogEntry {
	entry.RequestID = requestID
	return entry
}

// WithUser sets the user ID
func (entry *LogEntry) WithUser(userID int) *LogEntry {
	entry.UserID = userID
	return entry
}

// WithChannel sets the channel ID
func (entry *LogEntry) WithChannel(channelID int) *LogEntry {
	entry.ChannelID = channelID
	return entry
}

// WithModel sets the model name
func (entry *LogEntry) WithModel(model string) *LogEntry {
	entry.Model = model
	return entry
}

// WithMode sets the operation mode
func (entry *LogEntry) WithMode(mode string) *LogEntry {
	entry.Mode = mode
	return entry
}

// WithTask sets the task ID
func (entry *LogEntry) WithTask(taskID string) *LogEntry {
	entry.TaskID = taskID
	return entry
}

// WithPrecharge sets the precharge amount
func (entry *LogEntry) WithPrecharge(amount int64) *LogEntry {
	entry.PrechargeAmount = amount
	return entry
}

// WithActual sets the actual amount
func (entry *LogEntry) WithActual(amount int64) *LogEntry {
	entry.ActualAmount = amount
	return entry
}

// WithRefund sets the refund amount
func (entry *LogEntry) WithRefund(amount int64) *LogEntry {
	entry.RefundAmount = amount
	return entry
}

// WithProcessTime sets the process time
func (entry *LogEntry) WithProcessTime(duration time.Duration) *LogEntry {
	entry.ProcessTime = duration
	return entry
}

// WithStatus sets the status
func (entry *LogEntry) WithStatus(status string) *LogEntry {
	entry.Status = status
	return entry
}

// WithError sets the error message
func (entry *LogEntry) WithError(err error) *LogEntry {
	if err != nil {
		entry.Error = err.Error()
	}
	return entry
}

// WithUpstreamURL sets the upstream URL
func (entry *LogEntry) WithUpstreamURL(url string) *LogEntry {
	entry.UpstreamURL = url
	return entry
}

// WithHTTPStatus sets the HTTP status code
func (entry *LogEntry) WithHTTPStatus(status int) *LogEntry {
	entry.HTTPStatus = status
	return entry
}

// GetLogLevel returns the appropriate log level based on the entry content
func (entry *LogEntry) GetLogLevel() string {
	if entry.Error != "" {
		return "ERROR"
	}
	if entry.HTTPStatus >= 400 {
		return "WARN"
	}
	return "INFO"
}
