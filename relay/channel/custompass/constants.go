package custompass

const (
	ChannelName = "CustomPass"
)

// ModelList is empty for CustomPass since models are dynamically configured
var ModelList = []string{}

// Default configuration constants
const (
	DefaultPollInterval    = 30   // seconds
	DefaultTaskTimeout     = 15   // seconds
	DefaultMaxConcurrent   = 100  // max concurrent requests
	DefaultTaskMaxLifetime = 3600 // seconds (1 hour)
	DefaultBatchSize       = 50   // batch query size
	DefaultHeaderKey       = "X-Custom-Token"
)

// Environment variable keys
const (
	EnvPollInterval     = "CUSTOM_PASS_POLL_INTERVAL"
	EnvTaskTimeout      = "CUSTOM_PASS_TASK_TIMEOUT"
	EnvMaxConcurrent    = "CUSTOM_PASS_MAX_CONCURRENT"
	EnvTaskMaxLifetime  = "CUSTOM_PASS_TASK_MAX_LIFETIME"
	EnvBatchSize        = "CUSTOM_PASS_BATCH_SIZE"
	EnvHeaderKey        = "CUSTOM_PASS_HEADER_KEY"
	EnvStatusSuccess    = "CUSTOM_PASS_STATUS_SUCCESS"
	EnvStatusFailed     = "CUSTOM_PASS_STATUS_FAILED"
	EnvStatusProcessing = "CUSTOM_PASS_STATUS_PROCESSING"
)

// Default status mappings
var (
	DefaultStatusSuccess    = []string{"completed", "success", "finished"}
	DefaultStatusFailed     = []string{"failed", "error", "cancelled", "not_found"}
	DefaultStatusProcessing = []string{"processing", "pending", "running", "submitted"}
)
