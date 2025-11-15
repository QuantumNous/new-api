package ratio_setting

import (
	"encoding/json"
	"sort"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// SegmentRule defines a token range and its associated multipliers
type SegmentRule struct {
	// Input token constraints (in tokens, not 1K tokens)
	InputMin          int   `json:"input_min"`                     // Minimum input tokens, 0 means no lower bound
	InputMax          int   `json:"input_max"`                     // Maximum input tokens, 0 means no upper bound
	InputMinExclusive *bool `json:"input_min_exclusive,omitempty"` // Whether InputMin is exclusive (>), default false (inclusive >=)
	InputMaxExclusive *bool `json:"input_max_exclusive,omitempty"` // Whether InputMax is exclusive (<), default false (inclusive <=)

	// Output token constraints (in tokens, not 1K tokens)
	OutputMin          int   `json:"output_min"`                     // Minimum output tokens, 0 means no lower bound
	OutputMax          int   `json:"output_max"`                     // Maximum output tokens, 0 means no upper bound
	OutputMinExclusive *bool `json:"output_min_exclusive,omitempty"` // Whether OutputMin is exclusive (>), default false (inclusive >=)
	OutputMaxExclusive *bool `json:"output_max_exclusive,omitempty"` // Whether OutputMax is exclusive (<), default false (inclusive <=)

	// Multipliers for this segment
	ModelRatio      float64 `json:"model_ratio"`      // Model/input token multiplier
	CompletionRatio float64 `json:"completion_ratio"` // Completion/output token multiplier

	// Optional priority for rule ordering (higher = evaluated first)
	// If not specified, rules are evaluated in the order they appear
	Priority int `json:"priority,omitempty"`
}

// SegmentedRatioConfig holds all segmented pricing rules for a model
type SegmentedRatioConfig struct {
	ModelName string        `json:"model_name"`
	Rules     []SegmentRule `json:"rules"`
	Enabled   bool          `json:"enabled"` // Whether to use segmented pricing for this model
}

// Global storage for segmented ratio configurations
var (
	segmentedRatioMap      = make(map[string]*SegmentedRatioConfig)
	segmentedRatioMapMutex sync.RWMutex
)

// InitSegmentedRatio initializes the segmented ratio map
func InitSegmentedRatio() {
	segmentedRatioMapMutex.Lock()
	defer segmentedRatioMapMutex.Unlock()
	segmentedRatioMap = make(map[string]*SegmentedRatioConfig)
}

// SetSegmentedRatio sets or updates the segmented ratio configuration for a model
func SetSegmentedRatio(modelName string, config *SegmentedRatioConfig) {
	segmentedRatioMapMutex.Lock()
	defer segmentedRatioMapMutex.Unlock()

	// Sort rules by priority (descending) for efficient evaluation
	sortedRules := make([]SegmentRule, len(config.Rules))
	copy(sortedRules, config.Rules)
	sort.SliceStable(sortedRules, func(i, j int) bool {
		return sortedRules[i].Priority > sortedRules[j].Priority
	})

	config.Rules = sortedRules
	segmentedRatioMap[modelName] = config
	InvalidateExposedDataCache()
}

// GetSegmentedRatio retrieves the segmented ratio configuration for a model
func GetSegmentedRatio(modelName string) (*SegmentedRatioConfig, bool) {
	segmentedRatioMapMutex.RLock()
	defer segmentedRatioMapMutex.RUnlock()
	config, exists := segmentedRatioMap[modelName]
	return config, exists
}

// DeleteSegmentedRatio removes the segmented ratio configuration for a model
func DeleteSegmentedRatio(modelName string) {
	segmentedRatioMapMutex.Lock()
	defer segmentedRatioMapMutex.Unlock()
	delete(segmentedRatioMap, modelName)
	InvalidateExposedDataCache()
}

// GetSegmentedRatioCopy returns a deep copy of all segmented ratio configurations
func GetSegmentedRatioCopy() map[string]*SegmentedRatioConfig {
	segmentedRatioMapMutex.RLock()
	defer segmentedRatioMapMutex.RUnlock()

	copyMap := make(map[string]*SegmentedRatioConfig, len(segmentedRatioMap))
	for k, v := range segmentedRatioMap {
		configCopy := &SegmentedRatioConfig{
			ModelName: v.ModelName,
			Enabled:   v.Enabled,
			Rules:     make([]SegmentRule, len(v.Rules)),
		}
		copy(configCopy.Rules, v.Rules)
		copyMap[k] = configCopy
	}
	return copyMap
}

// SegmentedRatio2JSONString converts all segmented ratio configs to JSON
func SegmentedRatio2JSONString() string {
	segmentedRatioMapMutex.RLock()
	defer segmentedRatioMapMutex.RUnlock()

	jsonBytes, err := json.Marshal(segmentedRatioMap)
	if err != nil {
		common.SysError("error marshalling segmented ratio: " + err.Error())
		return "{}"
	}
	return string(jsonBytes)
}

// UpdateSegmentedRatioByJSONString updates segmented ratio configurations from JSON
func UpdateSegmentedRatioByJSONString(jsonStr string) error {
	tmp := make(map[string]*SegmentedRatioConfig)
	if err := json.Unmarshal([]byte(jsonStr), &tmp); err != nil {
		return err
	}

	// Sort rules for each config
	for _, config := range tmp {
		sort.SliceStable(config.Rules, func(i, j int) bool {
			return config.Rules[i].Priority > config.Rules[j].Priority
		})
	}

	segmentedRatioMapMutex.Lock()
	segmentedRatioMap = tmp
	segmentedRatioMapMutex.Unlock()

	InvalidateExposedDataCache()
	return nil
}

// EvaluateSegmentedRatio determines the appropriate model and completion ratios
// based on input and output token counts
func EvaluateSegmentedRatio(modelName string, inputTokens, outputTokens int) (modelRatio, completionRatio float64, matched bool) {
	segmentedRatioMapMutex.RLock()
	defer segmentedRatioMapMutex.RUnlock()

	config, exists := segmentedRatioMap[modelName]
	if !exists || !config.Enabled || len(config.Rules) == 0 {
		return 0, 0, false
	}

	// Iterate through rules in priority order
	for _, rule := range config.Rules {
		if matchesSegmentRule(rule, inputTokens, outputTokens) {
			return rule.ModelRatio, rule.CompletionRatio, true
		}
	}

	return 0, 0, false
}

// matchesSegmentRule checks if the given token counts match a segment rule
func matchesSegmentRule(rule SegmentRule, inputTokens, outputTokens int) bool {
	// Check input token constraints
	if rule.InputMin > 0 {
		// Check if exclusive (>) or inclusive (>=), default is inclusive
		isExclusive := rule.InputMinExclusive != nil && *rule.InputMinExclusive
		if isExclusive {
			// Exclusive (>)
			if inputTokens <= rule.InputMin {
				return false
			}
		} else {
			// Inclusive (>=)
			if inputTokens < rule.InputMin {
				return false
			}
		}
	}

	if rule.InputMax > 0 {
		// Check if exclusive (<) or inclusive (<=), default is inclusive
		isExclusive := rule.InputMaxExclusive != nil && *rule.InputMaxExclusive
		if isExclusive {
			// Exclusive (<)
			if inputTokens >= rule.InputMax {
				return false
			}
		} else {
			// Inclusive (<=)
			if inputTokens > rule.InputMax {
				return false
			}
		}
	}

	// Check output token constraints
	if rule.OutputMin > 0 {
		isExclusive := rule.OutputMinExclusive != nil && *rule.OutputMinExclusive
		if isExclusive {
			if outputTokens <= rule.OutputMin {
				return false
			}
		} else {
			if outputTokens < rule.OutputMin {
				return false
			}
		}
	}

	if rule.OutputMax > 0 {
		isExclusive := rule.OutputMaxExclusive != nil && *rule.OutputMaxExclusive
		if isExclusive {
			if outputTokens >= rule.OutputMax {
				return false
			}
		} else {
			if outputTokens > rule.OutputMax {
				return false
			}
		}
	}

	return true
}

// GetAllSegmentedRatioModels returns a list of all models with segmented pricing
func GetAllSegmentedRatioModels() []string {
	segmentedRatioMapMutex.RLock()
	defer segmentedRatioMapMutex.RUnlock()

	models := make([]string, 0, len(segmentedRatioMap))
	for modelName, config := range segmentedRatioMap {
		if config.Enabled {
			models = append(models, modelName)
		}
	}
	return models
}

// IsSegmentedRatioEnabled checks if a model has segmented pricing enabled
func IsSegmentedRatioEnabled(modelName string) bool {
	config, exists := GetSegmentedRatio(modelName)
	return exists && config.Enabled
}
