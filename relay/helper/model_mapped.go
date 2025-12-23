package helper

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// matchWildcard checks if modelName matches the pattern with wildcard support.
//
// Supported patterns:
//   - Exact match: "gpt-4" matches only "gpt-4"
//   - Universal wildcard: "*" matches any model name
//   - Prefix wildcard: "gpt-*" matches "gpt-4", "gpt-4-turbo", etc.
//   - Suffix wildcard: "*-turbo" matches "gpt-4-turbo", "claude-turbo", etc.
//   - Contains wildcard: "*deepseek*" matches any name containing "deepseek"
//
// Parameters:
//   - pattern: The pattern to match against (may contain wildcards)
//   - modelName: The model name to check
//
// Returns:
//   - true if modelName matches the pattern, false otherwise
func matchWildcard(pattern, modelName string) bool {
	if pattern == modelName {
		return true
	}

	// Check for wildcard patterns
	if !strings.Contains(pattern, "*") {
		return false
	}

	// Handle different wildcard patterns
	if pattern == "*" {
		return true // Single "*" matches everything
	}

	if strings.HasPrefix(pattern, "*") && strings.HasSuffix(pattern, "*") && len(pattern) > 2 {
		// *contains* pattern (e.g., *deepseek*)
		middle := pattern[1 : len(pattern)-1]
		return strings.Contains(modelName, middle)
	} else if strings.HasPrefix(pattern, "*") {
		// *suffix pattern
		suffix := pattern[1:]
		return strings.HasSuffix(modelName, suffix)
	} else if strings.HasSuffix(pattern, "*") {
		// prefix* pattern
		prefix := pattern[:len(pattern)-1]
		return strings.HasPrefix(modelName, prefix)
	}

	return false
}

// findMappedModel looks up the mapped model name using order-preserving pattern matching.
//
// This function implements sequential pattern matching in JSON key order:
//  1. Exact matches are checked first (highest priority)
//  2. Wildcard patterns are matched in the order they appear in the JSON configuration
//  3. The first matching pattern wins (allows user-controlled priority)
//
// This approach gives users full control over matching priority by simply
// ordering their patterns in the JSON configuration.
//
// Parameters:
//   - jsonStr: The raw JSON string containing the model mapping configuration
//   - modelName: The model name to look up
//
// Returns:
//   - The mapped model name (with wildcard replacements applied if applicable)
//   - A boolean indicating whether a match was found
func findMappedModel(jsonStr string, modelName string) (string, bool) {
	result := gjson.Parse(jsonStr)
	var matchedPattern, matchedTarget string
	var exactMatchTarget string
	exactMatchFound := false

	// Iterate through patterns in JSON order (preserves user-defined priority)
	result.ForEach(func(key, value gjson.Result) bool {
		pattern := key.String()

		// Skip array values (handled by tryArrayMapping)
		if value.Type != gjson.String {
			return true // continue
		}

		target := value.String()
		if target == "" {
			return true // continue
		}

		// Check for exact match (highest priority, but don't return yet - just record it)
		if pattern == modelName && !exactMatchFound {
			exactMatchTarget = target
			exactMatchFound = true
			return true // continue to preserve order checking
		}

		// For wildcards, use first match in JSON order
		if strings.Contains(pattern, "*") && matchedPattern == "" {
			if matchWildcard(pattern, modelName) {
				matchedPattern = pattern
				matchedTarget = target
				// Don't return false yet - continue to check for exact match
			}
		}

		return true // continue
	})

	// Exact match always takes priority
	if exactMatchFound {
		return exactMatchTarget, true
	}

	// Otherwise use first wildcard match
	if matchedPattern != "" {
		return applyWildcardReplacement(matchedPattern, modelName, matchedTarget), true
	}

	return "", false
}


// applyWildcardReplacement handles * replacement in target model name.
// If target contains *, it gets replaced with the matched wildcard portion from the source model name.
//
// This enables dynamic model name transformation, such as:
//   - "Pro/*": "*" transforms "Pro/deepseek-ai/DeepSeek-R1" to "deepseek-ai/DeepSeek-R1"
//   - "*-preview": "*-stable" transforms "gpt-4-preview" to "gpt-4-stable"
//
// Parameters:
//   - pattern: The wildcard pattern that matched (e.g., "Pro/*", "*-preview")
//   - modelName: The original model name that matched the pattern
//   - target: The target model name template (may contain * for replacement)
//
// Returns:
//   - The target model name with * replaced by the matched portion, or target unchanged if no * present
func applyWildcardReplacement(pattern, modelName, target string) string {
	if !strings.Contains(target, "*") {
		return target
	}

	// Extract the matched part based on pattern type
	var matchedPart string
	if pattern == "*" {
		// Universal wildcard - entire model name is the matched part
		matchedPart = modelName
	} else if strings.HasPrefix(pattern, "*") && strings.HasSuffix(pattern, "*") && len(pattern) > 2 {
		// *contains* pattern - the entire model name is used as the replacement
		// since we can't meaningfully extract "what matched the *" in a contains pattern
		matchedPart = modelName
	} else if strings.HasPrefix(pattern, "*") {
		// *suffix pattern - matched part is the prefix (what the * matched)
		suffix := pattern[1:]
		matchedPart = strings.TrimSuffix(modelName, suffix)
	} else if strings.HasSuffix(pattern, "*") {
		// prefix* pattern - matched part is the suffix (what the * matched)
		prefix := pattern[:len(pattern)-1]
		matchedPart = strings.TrimPrefix(modelName, prefix)
	}

	return strings.Replace(target, "*", matchedPart, 1)
}

// ModelMappedHelper processes model name mapping for API requests.
//
// This function handles the transformation of client-requested model names to upstream
// provider model names based on channel configuration. It supports three mapping modes:
//
// 1. Direct mapping: "source": "target" - maps source model to target
// 2. Wildcard mapping: "prefix*": "target" - maps all models matching pattern to target
// 3. Array (reverse) mapping: "target": ["source1", "source2"] - maps multiple sources to one target
//
// The function also supports:
//   - Chain resolution: If A→B and B→C, requesting A will resolve to C
//   - Cycle detection: Prevents infinite loops in chain mappings
//   - Wildcard replacement: "Pro/*": "*" strips the "Pro/" prefix
//   - Order-preserving matching: Wildcard patterns are matched in JSON key order,
//     giving users full control over priority by ordering their configuration
//
// Parameters:
//   - c: Gin context containing the "model_mapping" configuration string
//   - info: RelayInfo struct to update with mapping results (IsModelMapped, UpstreamModelName)
//   - request: The API request object whose model name should be updated
//
// Returns:
//   - nil on success
//   - error if JSON parsing fails or a mapping cycle is detected
func ModelMappedHelper(c *gin.Context, info *common.RelayInfo, request dto.Request) error {
	modelMapping := c.GetString("model_mapping")
	if modelMapping == "" || modelMapping == "{}" {
		if request != nil {
			request.SetModelName(info.UpstreamModelName)
		}
		return nil
	}

	// Validate JSON format
	if !gjson.Valid(modelMapping) {
		return fmt.Errorf("unmarshal_model_mapping_failed")
	}

	// Parse mapping for array handling (order doesn't matter for arrays)
	modelMap := make(map[string]interface{})
	if err := json.Unmarshal([]byte(modelMapping), &modelMap); err != nil {
		return fmt.Errorf("unmarshal_model_mapping_failed")
	}

	// Phase 1: Check array (reverse) mappings first
	// Format: "target": ["source1", "source2", "pattern*"]
	if mapped := tryArrayMapping(modelMapping, modelMap, info); mapped {
		if request != nil {
			request.SetModelName(info.UpstreamModelName)
		}
		return nil
	}

	// Phase 2: Resolve chain mappings with cycle detection (order-preserving)
	if err := resolveChainMapping(modelMapping, info); err != nil {
		return err
	}

	if request != nil {
		request.SetModelName(info.UpstreamModelName)
	}
	return nil
}

// tryArrayMapping attempts to match the model name against array-valued mappings.
// Array mappings are "reverse" mappings where multiple source patterns map to one target.
//
// This function preserves the JSON key order when checking array mappings,
// so the first matching array in configuration order wins.
//
// Format: "target-model": ["source1", "source2", "prefix*"]
//
// Parameters:
//   - jsonStr: The raw JSON configuration string (for order-preserving iteration)
//   - modelMap: The parsed map (for accessing array values)
//   - info: RelayInfo struct to update with mapping results
//
// Returns true if a match was found and info was updated.
func tryArrayMapping(jsonStr string, modelMap map[string]interface{}, info *common.RelayInfo) bool {
	result := gjson.Parse(jsonStr)
	matched := false

	result.ForEach(func(key, value gjson.Result) bool {
		if !value.IsArray() {
			return true // continue
		}

		target := key.String()
		for _, item := range value.Array() {
			if item.Type != gjson.String {
				continue
			}
			strItem := item.String()

			// Check exact match
			if strItem == info.OriginModelName {
				info.IsModelMapped = true
				info.UpstreamModelName = target
				matched = true
				return false // stop iteration
			}
			// Check wildcard match
			if strings.Contains(strItem, "*") && matchWildcard(strItem, info.OriginModelName) {
				info.IsModelMapped = true
				info.UpstreamModelName = applyWildcardReplacement(strItem, info.OriginModelName, target)
				matched = true
				return false // stop iteration
			}
		}
		return true // continue
	})

	return matched
}

// resolveChainMapping resolves chain mappings (A→B→C) with cycle detection.
// Follows the mapping chain until no further mapping is found or a cycle is detected.
//
// This function uses order-preserving pattern matching (via findMappedModel) to ensure
// that when multiple patterns match, the first one in JSON configuration order wins.
//
// Parameters:
//   - jsonStr: The raw JSON configuration string (for order-preserving matching)
//   - info: RelayInfo struct to update with mapping results
//
// Returns an error if a cycle is detected (other than self-mapping at the start).
func resolveChainMapping(jsonStr string, info *common.RelayInfo) error {
	currentModel := info.OriginModelName
	visitedModels := map[string]bool{currentModel: true}

	for {
		mappedModel, found := findMappedModel(jsonStr, currentModel)
		if !found {
			break
		}

		// Cycle detection
		if visitedModels[mappedModel] {
			// Self-mapping at start means no mapping needed
			if mappedModel == currentModel && currentModel == info.OriginModelName {
				info.IsModelMapped = false
				return nil
			}
			// Self-mapping after chain is valid (stop here)
			if mappedModel == currentModel {
				info.IsModelMapped = true
				break
			}
			// True cycle detected
			return errors.New("model_mapping_contains_cycle")
		}

		visitedModels[mappedModel] = true
		currentModel = mappedModel
		info.IsModelMapped = true
	}

	if info.IsModelMapped {
		info.UpstreamModelName = currentModel
	}
	return nil
}
