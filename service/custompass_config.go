package service

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"one-api/common"
)

// CustomPassConfig holds all configuration for CustomPass channel
type CustomPassConfig struct {
	// Polling configuration
	PollInterval    time.Duration `json:"poll_interval"`
	TaskTimeout     time.Duration `json:"task_timeout"`
	MaxConcurrent   int           `json:"max_concurrent"`
	TaskMaxLifetime time.Duration `json:"task_max_lifetime"`
	BatchSize       int           `json:"batch_size"`

	// Authentication configuration
	HeaderKey string `json:"header_key"`

	// Status mapping configuration
	StatusSuccess    []string `json:"status_success"`
	StatusFailed     []string `json:"status_failed"`
	StatusProcessing []string `json:"status_processing"`

	// Retry configuration
	MaxRetries    int           `json:"max_retries"`
	RetryInterval time.Duration `json:"retry_interval"`

	// Request configuration
	RequestTimeout time.Duration `json:"request_timeout"`
	MaxRequestSize int64         `json:"max_request_size"`

	// Hot reload support
	lastUpdated time.Time `json:"last_updated"`
	mu          sync.RWMutex
}

// CustomPassStatusMapping represents status mapping configuration
type CustomPassStatusMapping struct {
	Success    []string `json:"success"`
	Failed     []string `json:"failed"`
	Processing []string `json:"processing"`
}

// CustomPassConfigService manages CustomPass configuration
type CustomPassConfigService interface {
	GetConfig() *CustomPassConfig
	ReloadConfig() error
	ValidateConfig(config *CustomPassConfig) error
	GetStatusMapping() *CustomPassStatusMapping
	GetCustomTokenHeader() string
	IsConfigStale() bool
}

// CustomPassConfigServiceImpl implements CustomPassConfigService
type CustomPassConfigServiceImpl struct {
	config *CustomPassConfig
	mu     sync.RWMutex
}

// Global config service instance
var (
	configService     *CustomPassConfigServiceImpl
	configServiceOnce sync.Once
)

// NewCustomPassConfigService creates a new config service instance
func NewCustomPassConfigService() CustomPassConfigService {
	configServiceOnce.Do(func() {
		configService = &CustomPassConfigServiceImpl{}
		configService.loadConfig()
	})
	return configService
}

// GetConfig returns the current configuration
func (s *CustomPassConfigServiceImpl) GetConfig() *CustomPassConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Return a copy to prevent external modification
	configCopy := *s.config
	return &configCopy
}

// ReloadConfig reloads configuration from environment variables
func (s *CustomPassConfigServiceImpl) ReloadConfig() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.loadConfig()
}

// loadConfig loads configuration from environment variables with defaults
func (s *CustomPassConfigServiceImpl) loadConfig() error {
	config := &CustomPassConfig{
		// Polling configuration with defaults
		PollInterval:    parseDurationEnv("CUSTOM_PASS_POLL_INTERVAL", 30*time.Second),
		TaskTimeout:     parseDurationEnv("CUSTOM_PASS_TASK_TIMEOUT", 15*time.Second),
		MaxConcurrent:   common.GetEnvOrDefault("CUSTOM_PASS_MAX_CONCURRENT", 100),
		TaskMaxLifetime: parseDurationEnv("CUSTOM_PASS_TASK_MAX_LIFETIME", 1*time.Hour),
		BatchSize:       common.GetEnvOrDefault("CUSTOM_PASS_BATCH_SIZE", 50),

		// Authentication configuration
		HeaderKey: common.GetEnvOrDefaultString("CUSTOM_PASS_HEADER_KEY", "X-Custom-Token"),

		// Status mapping configuration
		StatusSuccess:    parseStringSliceEnv("CUSTOM_PASS_STATUS_SUCCESS", []string{"completed", "success", "finished"}),
		StatusFailed:     parseStringSliceEnv("CUSTOM_PASS_STATUS_FAILED", []string{"failed", "error", "cancelled"}),
		StatusProcessing: parseStringSliceEnv("CUSTOM_PASS_STATUS_PROCESSING", []string{"processing", "pending", "running"}),

		// Retry configuration
		MaxRetries:    common.GetEnvOrDefault("CUSTOM_PASS_MAX_RETRIES", 3),
		RetryInterval: parseDurationEnv("CUSTOM_PASS_RETRY_INTERVAL", 1*time.Second),

		// Request configuration
		RequestTimeout: parseDurationEnv("CUSTOM_PASS_REQUEST_TIMEOUT", 30*time.Second),
		MaxRequestSize: parseInt64Env("CUSTOM_PASS_MAX_REQUEST_SIZE", 10*1024*1024), // 10MB default

		// Update timestamp
		lastUpdated: time.Now(),
	}

	// Validate configuration
	if err := s.ValidateConfig(config); err != nil {
		return err
	}

	s.config = config
	return nil
}

// ValidateConfig validates the configuration values
func (s *CustomPassConfigServiceImpl) ValidateConfig(config *CustomPassConfig) error {
	if config.PollInterval < time.Second {
		return errors.New("poll interval cannot be less than 1 second")
	}

	if config.TaskTimeout < time.Second {
		return errors.New("task timeout cannot be less than 1 second")
	}

	if config.MaxConcurrent <= 0 || config.MaxConcurrent > 1000 {
		return errors.New("max concurrent must be between 1 and 1000")
	}

	if config.BatchSize <= 0 || config.BatchSize > 1000 {
		return errors.New("batch size must be between 1 and 1000")
	}

	if config.TaskMaxLifetime < time.Minute {
		return errors.New("task max lifetime cannot be less than 1 minute")
	}

	if config.HeaderKey == "" {
		return errors.New("header key cannot be empty")
	}

	if len(config.StatusSuccess) == 0 {
		return errors.New("success status list cannot be empty")
	}

	if len(config.StatusFailed) == 0 {
		return errors.New("failed status list cannot be empty")
	}

	if len(config.StatusProcessing) == 0 {
		return errors.New("processing status list cannot be empty")
	}

	if config.MaxRetries < 0 || config.MaxRetries > 10 {
		return errors.New("max retries must be between 0 and 10")
	}

	if config.RetryInterval < 100*time.Millisecond {
		return errors.New("retry interval cannot be less than 100ms")
	}

	if config.RequestTimeout < time.Second {
		return errors.New("request timeout cannot be less than 1 second")
	}

	if config.MaxRequestSize <= 0 || config.MaxRequestSize > 100*1024*1024 {
		return errors.New("max request size must be between 1 byte and 100MB")
	}

	return nil
}

// GetStatusMapping returns the status mapping configuration
func (s *CustomPassConfigServiceImpl) GetStatusMapping() *CustomPassStatusMapping {
	config := s.GetConfig()
	return &CustomPassStatusMapping{
		Success:    config.StatusSuccess,
		Failed:     config.StatusFailed,
		Processing: config.StatusProcessing,
	}
}

// GetCustomTokenHeader returns the custom token header name
func (s *CustomPassConfigServiceImpl) GetCustomTokenHeader() string {
	config := s.GetConfig()
	return config.HeaderKey
}

// IsConfigStale checks if configuration needs to be reloaded
func (s *CustomPassConfigServiceImpl) IsConfigStale() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Check if config is older than 5 minutes
	return time.Since(s.config.lastUpdated) > 5*time.Minute
}

// Helper functions for parsing environment variables

// parseDurationEnv parses duration from environment variable with default
func parseDurationEnv(envKey string, defaultValue time.Duration) time.Duration {
	envValue := os.Getenv(envKey)
	if envValue == "" {
		return defaultValue
	}

	duration, err := time.ParseDuration(envValue)
	if err != nil {
		common.SysError("Failed to parse duration from " + envKey + ": " + err.Error() + ", using default: " + defaultValue.String())
		return defaultValue
	}

	return duration
}

// parseStringSliceEnv parses comma-separated string slice from environment variable
func parseStringSliceEnv(envKey string, defaultValue []string) []string {
	envValue := os.Getenv(envKey)
	if envValue == "" {
		return defaultValue
	}

	// Split by comma and trim spaces
	parts := strings.Split(envValue, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}

	if len(result) == 0 {
		common.SysError("Empty value parsed from " + envKey + ", using default")
		return defaultValue
	}

	return result
}

// parseInt64Env parses int64 from environment variable with default
func parseInt64Env(envKey string, defaultValue int64) int64 {
	envValue := os.Getenv(envKey)
	if envValue == "" {
		return defaultValue
	}

	value, err := strconv.ParseInt(envValue, 10, 64)
	if err != nil {
		common.SysError("Failed to parse int64 from " + envKey + ": " + err.Error() + ", using default: " + strconv.FormatInt(defaultValue, 10))
		return defaultValue
	}

	return value
}

// ConfigPriorityResolver handles configuration priority resolution
type ConfigPriorityResolver struct {
	configService CustomPassConfigService
}

// NewConfigPriorityResolver creates a new priority resolver
func NewConfigPriorityResolver() *ConfigPriorityResolver {
	return &ConfigPriorityResolver{
		configService: NewCustomPassConfigService(),
	}
}

// GetCustomTokenHeaderWithPriority gets custom token header with priority:
// 1. Channel-specific configuration (if implemented)
// 2. Environment variable
// 3. Default value
func (r *ConfigPriorityResolver) GetCustomTokenHeaderWithPriority(channelConfig map[string]interface{}) string {
	// 1. Check channel-specific configuration first
	if channelConfig != nil {
		if customHeader, exists := channelConfig["custom_token_header"]; exists {
			if headerStr, ok := customHeader.(string); ok && headerStr != "" {
				return headerStr
			}
		}
	}

	// 2. Use global configuration (which includes env var and default)
	return r.configService.GetCustomTokenHeader()
}

// GetStatusMappingWithPriority gets status mapping with priority:
// 1. Channel-specific configuration (if implemented)
// 2. Environment variable
// 3. Default value
func (r *ConfigPriorityResolver) GetStatusMappingWithPriority(channelConfig map[string]interface{}) *CustomPassStatusMapping {
	// 1. Check channel-specific configuration first
	if channelConfig != nil {
		if statusMapping, exists := channelConfig["status_mapping"]; exists {
			if mappingMap, ok := statusMapping.(map[string]interface{}); ok {
				mapping := &CustomPassStatusMapping{}

				if success, ok := mappingMap["success"].([]interface{}); ok {
					mapping.Success = interfaceSliceToStringSlice(success)
				}
				if failed, ok := mappingMap["failed"].([]interface{}); ok {
					mapping.Failed = interfaceSliceToStringSlice(failed)
				}
				if processing, ok := mappingMap["processing"].([]interface{}); ok {
					mapping.Processing = interfaceSliceToStringSlice(processing)
				}

				// Validate that all required fields are present
				if len(mapping.Success) > 0 && len(mapping.Failed) > 0 && len(mapping.Processing) > 0 {
					return mapping
				}
			}
		}
	}

	// 2. Use global configuration (which includes env var and default)
	return r.configService.GetStatusMapping()
}

// interfaceSliceToStringSlice converts []interface{} to []string
func interfaceSliceToStringSlice(slice []interface{}) []string {
	result := make([]string, 0, len(slice))
	for _, item := range slice {
		if str, ok := item.(string); ok && str != "" {
			result = append(result, str)
		}
	}
	return result
}
