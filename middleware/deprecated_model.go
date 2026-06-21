// Package middleware provides HTTP middleware for the gateway
// deprecated_model.go - Deprecated model forwarding for smooth migration
package middleware

import (
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/logger"

	"github.com/gin-gonic/gin"
)

// DeprecatedModelConfig represents a deprecated model and its replacement
type DeprecatedModelConfig struct {
	// Deprecated is the old model name that will be forwarded
	Deprecated string `json:"deprecated"`
	// Replacement is the new model to use instead
	Replacement string `json:"replacement"`
	// Reason explains why the model was deprecated (optional)
	Reason string `json:"reason,omitempty"`
	// CutoffDate is when requests for this model will be rejected (optional)
	CutoffDate string `json:"cutoff_date,omitempty"`
}

// DeprecatedModelMapping holds all deprecated model configurations
type DeprecatedModelMapping struct {
	mu     sync.RWMutex
	config map[string]DeprecatedModelConfig // deprecated -> config
}

// globalDeprecatedMapping is the global deprecated model mapping instance
var globalDeprecatedMapping = &DeprecatedModelMapping{
	config: make(map[string]DeprecatedModelConfig),
}

// DefaultDeprecatedModels provides the default list of deprecated models
// These are models that have been discontinued by their providers
var DefaultDeprecatedModels = []DeprecatedModelConfig{
	// Claude v2 series (discontinued)
	{Deprecated: "claude-2", Replacement: "claude-sonnet-4-6", Reason: "Claude 2 series discontinued by Anthropic"},
	{Deprecated: "claude-2.0", Replacement: "claude-sonnet-4-6", Reason: "Claude 2 series discontinued by Anthropic"},
	{Deprecated: "claude-2.1", Replacement: "claude-sonnet-4-6", Reason: "Claude 2 series discontinued by Anthropic"},
	{Deprecated: "claude-instant-1", Replacement: "claude-haiku-3-5", Reason: "Claude Instant discontinued by Anthropic"},
	// OpenAI legacy models
	{Deprecated: "gpt-4-0314", Replacement: "gpt-4-turbo", Reason: "Legacy GPT-4 snapshot"},
	{Deprecated: "gpt-4-0613", Replacement: "gpt-4-turbo", Reason: "Legacy GPT-4 snapshot"},
	{Deprecated: "gpt-3.5-turbo-0301", Replacement: "gpt-3.5-turbo", Reason: "Legacy GPT-3.5 snapshot"},
	{Deprecated: "gpt-3.5-turbo-0613", Replacement: "gpt-3.5-turbo", Reason: "Legacy GPT-3.5 snapshot"},
	{Deprecated: "gpt-3.5-turbo-instruct", Replacement: "gpt-3.5-turbo", Reason: "Instruct variant discontinued"},
	// Gemini legacy
	{Deprecated: "gemini-1.0-pro", Replacement: "gemini-2.5-flash", Reason: "Legacy Gemini Pro"},
}

// InitDeprecatedModels initializes the deprecated model mapping with defaults and custom config
func InitDeprecatedModels(customModels []DeprecatedModelConfig) {
	globalDeprecatedMapping.mu.Lock()
	defer globalDeprecatedMapping.mu.Unlock()

	// Clear existing config
	globalDeprecatedMapping.config = make(map[string]DeprecatedModelConfig)

	// Load defaults
	for _, dm := range DefaultDeprecatedModels {
		globalDeprecatedMapping.config[strings.ToLower(dm.Deprecated)] = dm
	}

	// Override/add custom deprecated models
	for _, dm := range customModels {
		globalDeprecatedMapping.config[strings.ToLower(dm.Deprecated)] = dm
	}
}

// GetReplacementForDeprecated checks if a model is deprecated and returns its replacement
// Returns: replacement model, whether it was deprecated, and the reason
func GetReplacementForDeprecated(c *gin.Context, modelName string) (string, bool, string) {
	if modelName == "" {
		return modelName, false, ""
	}

	globalDeprecatedMapping.mu.RLock()
	defer globalDeprecatedMapping.mu.RUnlock()

	lowerModel := strings.ToLower(modelName)
	if config, ok := globalDeprecatedMapping.config[lowerModel]; ok {
		logger.LogInfo(c, "[DeprecatedModel] Forwarding deprecated model: %s -> %s (%s)",
			modelName, config.Replacement, config.Reason)
		return config.Replacement, true, config.Reason
	}

	return modelName, false, ""
}

// AddDeprecatedModel adds or updates a deprecated model mapping at runtime
func AddDeprecatedModel(deprecated, replacement, reason string) {
	globalDeprecatedMapping.mu.Lock()
	defer globalDeprecatedMapping.mu.Unlock()
	globalDeprecatedMapping.config[strings.ToLower(deprecated)] = DeprecatedModelConfig{
		Deprecated:  deprecated,
		Replacement: replacement,
		Reason:      reason,
	}
}

// RemoveDeprecatedModel removes a deprecated model mapping
func RemoveDeprecatedModel(deprecated string) {
	globalDeprecatedMapping.mu.Lock()
	defer globalDeprecatedMapping.mu.Unlock()
	delete(globalDeprecatedMapping.config, strings.ToLower(deprecated))
}

// ListDeprecatedModels returns all current deprecated model mappings
func ListDeprecatedModels() map[string]DeprecatedModelConfig {
	globalDeprecatedMapping.mu.RLock()
	defer globalDeprecatedMapping.mu.RUnlock()

	result := make(map[string]DeprecatedModelConfig)
	for k, v := range globalDeprecatedMapping.config {
		result[k] = v
	}
	return result
}

// init initializes default deprecated models on package load
func init() {
	InitDeprecatedModels(nil)
}
