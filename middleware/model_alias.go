// Package middleware provides HTTP middleware for the gateway
// model_alias.go - Configurable model alias mapping for user convenience
package middleware

import (
	"regexp"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"github.com/gin-gonic/gin"
)

// ModelAliasConfig represents a single model alias configuration
type ModelAliasConfig struct {
	// Alias is the user-facing model name
	Alias string `json:"alias"`
	// Target is the actual model name to use
	Target string `json:"target"`
	// Pattern is an optional regex pattern for flexible matching
	Pattern string `json:"pattern,omitempty"`
}

// ModelAliasMapping holds all alias configurations
type ModelAliasMapping struct {
	mu     sync.RWMutex
	config map[string]string // alias -> target
	regex  []*regexp.Regexp  // compiled patterns
}

// globalAliasMapping is the global alias mapping instance
var globalAliasMapping = &ModelAliasMapping{
	config: make(map[string]string),
}

// DefaultModelAliases provides sensible defaults for common naming variations
// These are loaded on startup and can be overridden via configuration
var DefaultModelAliases = []ModelAliasConfig{
	// OpenAI aliases
	{Alias: "gpt4", Target: "gpt-4"},
	{Alias: "gpt4o", Target: "gpt-4o"},
	{Alias: "gpt35", Target: "gpt-3.5-turbo"},
	{Alias: "gpt-3.5", Target: "gpt-3.5-turbo"},
	// Claude aliases
	{Alias: "claude-opus", Target: "claude-opus-4-6"},
	{Alias: "claude-sonnet", Target: "claude-sonnet-4-6"},
	{Alias: "claude-haiku", Target: "claude-haiku-3-5"},
	{Alias: "claude-3.5-sonnet", Target: "claude-sonnet-4-6"},
	{Alias: "claude-3-5-sonnet", Target: "claude-sonnet-4-6"},
	{Alias: "claude-3.5-haiku", Target: "claude-haiku-3-5"},
	{Alias: "claude-3-opus", Target: "claude-opus-4-6"},
	{Alias: "claude-3-sonnet", Target: "claude-sonnet-4-6"},
	// Gemini aliases
	{Alias: "gemini-pro", Target: "gemini-2.5-flash"},
	{Alias: "gemini-flash", Target: "gemini-2.5-flash"},
	// DeepSeek aliases
	{Alias: "deepseek", Target: "deepseek-chat"},
	{Alias: "deepseek-v3", Target: "deepseek-chat"},
}

// InitModelAliases initializes the model alias mapping with defaults and custom config
func InitModelAliases(customAliases []ModelAliasConfig) {
	globalAliasMapping.mu.Lock()
	defer globalAliasMapping.mu.Unlock()

	// Clear existing config
	globalAliasMapping.config = make(map[string]string)
	globalAliasMapping.regex = nil

	// Load defaults
	for _, alias := range DefaultModelAliases {
		globalAliasMapping.config[strings.ToLower(alias.Alias)] = alias.Target
	}

	// Override/add custom aliases
	for _, alias := range customAliases {
		if alias.Pattern != "" {
			if re, err := regexp.Compile(alias.Pattern); err == nil {
				globalAliasMapping.regex = append(globalAliasMapping.regex, re)
			}
		}
		globalAliasMapping.config[strings.ToLower(alias.Alias)] = alias.Target
	}
}

// ResolveModelAlias resolves a model name through alias mapping
// Returns the resolved model name and whether an alias was applied
func ResolveModelAlias(c *gin.Context, modelName string) (string, bool) {
	if modelName == "" {
		return modelName, false
	}

	globalAliasMapping.mu.RLock()
	defer globalAliasMapping.mu.RUnlock()

	// Try exact match (case-insensitive)
	lowerModel := strings.ToLower(modelName)
	if target, ok := globalAliasMapping.config[lowerModel]; ok {
		logger.LogInfo(c, "[ModelAlias] Resolved: %s -> %s", modelName, target)
		return target, true
	}

	// Try pattern matching
	for _, re := range globalAliasMapping.regex {
		if re.MatchString(modelName) {
			// Pattern match would require more complex mapping
			// For now, just log the match
			logger.LogDebug(c, "[ModelAlias] Pattern matched: %s", modelName)
		}
	}

	return modelName, false
}

// AddModelAlias adds or updates a model alias at runtime
func AddModelAlias(alias, target string) {
	globalAliasMapping.mu.Lock()
	defer globalAliasMapping.mu.Unlock()
	globalAliasMapping.config[strings.ToLower(alias)] = target
}

// RemoveModelAlias removes a model alias
func RemoveModelAlias(alias string) {
	globalAliasMapping.mu.Lock()
	defer globalAliasMapping.mu.Unlock()
	delete(globalAliasMapping.config, strings.ToLower(alias))
}

// ListModelAliases returns all current alias mappings
func ListModelAliases() map[string]string {
	globalAliasMapping.mu.RLock()
	defer globalAliasMapping.mu.RUnlock()

	result := make(map[string]string)
	for k, v := range globalAliasMapping.config {
		result[k] = v
	}
	return result
}

// init initializes default aliases on package load
func init() {
	InitModelAliases(nil)
}
