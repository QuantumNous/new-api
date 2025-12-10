package helper

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

// matchWildcard checks if modelName matches the pattern with wildcard support
// Supports: "*suffix", "prefix*", "*contains*", and exact match
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

// findMappedModel looks up the mapped model name supporting both exact match and wildcard patterns
// Returns the mapped model name and whether a match was found
// Supports mapping values as either string or array of strings (for reverse mapping)
func findMappedModel(modelMap map[string]interface{}, modelName string) (string, bool) {
	// First, try exact match
	if value, exists := modelMap[modelName]; exists {
		if strValue, ok := value.(string); ok && strValue != "" {
			return strValue, true
		}
	}

	// Then, try wildcard patterns (only string values, not arrays)
	for pattern, value := range modelMap {
		if !strings.Contains(pattern, "*") {
			continue
		}
		if matchWildcard(pattern, modelName) {
			if strValue, ok := value.(string); ok && strValue != "" {
				// Support replacing * with matched parts
				return applyWildcardReplacement(pattern, modelName, strValue), true
			}
		}
	}

	return "", false
}

// applyWildcardReplacement handles * replacement in target model name
// If target contains *, replace it with the matched wildcard part from source
func applyWildcardReplacement(pattern, modelName, target string) string {
	if !strings.Contains(target, "*") {
		return target
	}

	// Extract the matched part based on pattern type
	var matchedPart string
	if strings.HasPrefix(pattern, "*") && strings.HasSuffix(pattern, "*") {
		// *contains* pattern - extract the matching portion
		middle := pattern[1 : len(pattern)-1]
		if middle == "" {
			matchedPart = modelName
		} else {
			// Find where the middle pattern matches and extract surrounding context
			matchedPart = modelName
		}
	} else if strings.HasPrefix(pattern, "*") {
		// *suffix pattern - matched part is the prefix
		suffix := pattern[1:]
		matchedPart = strings.TrimSuffix(modelName, suffix)
	} else if strings.HasSuffix(pattern, "*") {
		// prefix* pattern - matched part is the suffix
		prefix := pattern[:len(pattern)-1]
		matchedPart = strings.TrimPrefix(modelName, prefix)
	}

	return strings.Replace(target, "*", matchedPart, 1)
}

func ModelMappedHelper(c *gin.Context, info *common.RelayInfo, request dto.Request) error {
	// map model name
	modelMapping := c.GetString("model_mapping")
	if modelMapping != "" && modelMapping != "{}" {
		// First try to unmarshal as map[string]interface{} to support both string and array values
		modelMap := make(map[string]interface{})
		err := json.Unmarshal([]byte(modelMapping), &modelMap)
		if err != nil {
			return fmt.Errorf("unmarshal_model_mapping_failed")
		}

		// Check for reverse mapping first (array values like ["model1", "model2"]: "target")
		// This is stored as "target": ["model1", "model2"] in JSON
		for target, value := range modelMap {
			if arr, ok := value.([]interface{}); ok {
				for _, item := range arr {
					if strItem, ok := item.(string); ok {
						// Check exact match
						if strItem == info.OriginModelName {
							info.IsModelMapped = true
							info.UpstreamModelName = target
							if request != nil {
								request.SetModelName(info.UpstreamModelName)
							}
							return nil
						}
						// Check wildcard match
						if strings.Contains(strItem, "*") && matchWildcard(strItem, info.OriginModelName) {
							info.IsModelMapped = true
							// Apply wildcard replacement if target contains *
							info.UpstreamModelName = applyWildcardReplacement(strItem, info.OriginModelName, target)
							if request != nil {
								request.SetModelName(info.UpstreamModelName)
							}
							return nil
						}
					}
				}
			}
		}

		// 支持链式模型重定向，最终使用链尾的模型
		currentModel := info.OriginModelName
		visitedModels := map[string]bool{
			currentModel: true,
		}
		for {
			if mappedModel, found := findMappedModel(modelMap, currentModel); found {
				// 模型重定向循环检测，避免无限循环
				if visitedModels[mappedModel] {
					if mappedModel == currentModel {
						if currentModel == info.OriginModelName {
							info.IsModelMapped = false
							return nil
						} else {
							info.IsModelMapped = true
							break
						}
					}
					return errors.New("model_mapping_contains_cycle")
				}
				visitedModels[mappedModel] = true
				currentModel = mappedModel
				info.IsModelMapped = true
			} else {
				break
			}
		}
		if info.IsModelMapped {
			info.UpstreamModelName = currentModel
		}
	}
	if request != nil {
		request.SetModelName(info.UpstreamModelName)
	}
	return nil
}
