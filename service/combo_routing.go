package service

import (
	"errors"
	"math/rand"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/tidwall/sjson"

	"github.com/gin-gonic/gin"
)

// ErrComboNoSatisfiedChannel is returned when no model in the combo
// has an available channel for the given group.
var ErrComboNoSatisfiedChannel = errors.New("combo: no available channel for any model in the combo")

// ErrComboEmpty is returned when the combo has no models configured.
var ErrComboEmpty = errors.New("combo: no models configured")

// ComboRoutingResult holds the result of combo routing.
type ComboRoutingResult struct {
	ResolvedModel string         // The actual model name to use
	Channel       *model.Channel // Non-nil only if the strategy resolved a channel (fallback)
	Group         string         // The auto group that was selected (set during fallback + auto)
}

// ResolveComboModel performs combo routing and returns the resolved model name
// (and optionally a channel for fallback strategy).
//
// For fallback: iterates combo models in order, picks the first that has an
// available channel in the given group, and returns both model and channel.
//
// For random/weighted/round_robin: picks a model by strategy, returns only the
// model name — channel selection proceeds normally via Distribute().
func ResolveComboModel(c *gin.Context, combo *model.Combo, tokenGroup string) (*ComboRoutingResult, error) {
	if combo == nil {
		return nil, errors.New("combo is nil")
	}
	if combo.Status != 1 {
		return nil, errors.New("combo is disabled")
	}

	models := parseComboModels(combo.Models)
	if len(models) == 0 {
		return nil, ErrComboEmpty
	}

	switch combo.Strategy {
	case "fallback":
		return resolveFallback(c, combo, models, tokenGroup)
	case "random":
		return resolveRandom(combo, models), nil
	case "weighted":
		return resolveWeighted(combo, models), nil
	case "round_robin":
		return resolveRoundRobin(combo, models), nil
	default:
		// Default to first model
		return &ComboRoutingResult{ResolvedModel: models[0]}, nil
	}
}

// parseComboModels splits a CSV model string and trims whitespace.
func parseComboModels(modelsStr string) []string {
	parts := strings.Split(modelsStr, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// resolveFallback iterates models in order, trying to find a channel for each.
// Returns the first model that has an available channel.
func resolveFallback(c *gin.Context, combo *model.Combo, models []string, tokenGroup string) (*ComboRoutingResult, error) {
	userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)

	if tokenGroup == "auto" {
		if len(setting.GetAutoGroups()) == 0 {
			return nil, errors.New("auto groups is not enabled")
		}
		autoGroups := GetUserAutoGroup(userGroup)

		for _, g := range autoGroups {
			for _, modelName := range models {
				channel, err := model.GetChannel(g, modelName, 0)
				if err == nil && channel != nil {
					logger.LogDebug(c, "Combo fallback: selected model %s in group %s (channel %d)", modelName, g, channel.Id)
					return &ComboRoutingResult{
						ResolvedModel: modelName,
						Channel:       channel,
						Group:         g,
					}, nil
				}
			}
		}
	} else {
		for _, modelName := range models {
			channel, err := model.GetChannel(tokenGroup, modelName, 0)
			if err == nil && channel != nil {
				logger.LogDebug(c, "Combo fallback: selected model %s in group %s (channel %d)", modelName, tokenGroup, channel.Id)
				return &ComboRoutingResult{
					ResolvedModel: modelName,
					Channel:       channel,
				}, nil
			}
		}
	}

	return nil, ErrComboNoSatisfiedChannel
}

// resolveRandom picks a model uniformly at random.
func resolveRandom(combo *model.Combo, models []string) *ComboRoutingResult {
	selected := models[rand.Intn(len(models))]
	return &ComboRoutingResult{ResolvedModel: selected}
}

// resolveWeighted picks a model based on weights JSON.
func resolveWeighted(combo *model.Combo, models []string) *ComboRoutingResult {
	weights := parseWeights(combo.Weights, models)

	totalWeight := 0
	for _, w := range weights {
		totalWeight += w
	}
	if totalWeight <= 0 {
		// Fall back to uniform random
		return resolveRandom(combo, models)
	}

	r := rand.Intn(totalWeight)
	cumulative := 0
	for _, modelName := range models {
		cumulative += weights[modelName]
		if r < cumulative {
			return &ComboRoutingResult{ResolvedModel: modelName}
		}
	}

	// Fallback (shouldn't happen)
	return &ComboRoutingResult{ResolvedModel: models[len(models)-1]}
}

// parseWeights parses the weights JSON string, ensuring all combo models have a weight.
// Missing models get weight 1.
func parseWeights(weightsStr string, models []string) map[string]int {
	parsed := make(map[string]int)
	if weightsStr != "" && weightsStr != "{}" {
	if err := common.Unmarshal([]byte(weightsStr), &parsed); err != nil {
		// Invalid JSON — ignore, all models get default weight
		parsed = make(map[string]int)
	}
	}

	// Ensure all models have a weight
	modelSet := make(map[string]bool, len(models))
	for _, m := range models {
		modelSet[m] = true
		if _, exists := parsed[m]; !exists {
			parsed[m] = 1
		}
	}

	// Remove weights for models not in the combo
	for k := range parsed {
		if !modelSet[k] {
			delete(parsed, k)
		}
	}

	return parsed
}

var (
	comboRoundRobinMutex            sync.Mutex
	comboRoundRobinCounters = make(map[int]int) // combo ID → next index
)

// resolveRoundRobin cycles through models using an in-memory counter.
func resolveRoundRobin(combo *model.Combo, models []string) *ComboRoutingResult {
	comboRoundRobinMutex.Lock()
	defer comboRoundRobinMutex.Unlock()

	idx := comboRoundRobinCounters[combo.Id] % len(models)
	comboRoundRobinCounters[combo.Id]++
	return &ComboRoutingResult{ResolvedModel: models[idx]}
}

// GetComboFallbackChannel is used by the distributor when a combo with fallback
// strategy needs to pre-select a channel. It tries each model in the combo until
// one succeeds.
func GetComboFallbackChannel(c *gin.Context, combo *model.Combo, tokenGroup string) (*model.Channel, string, error) {
	result, err := ResolveComboModel(c, combo, tokenGroup)
	if err != nil {
		return nil, "", err
	}
	if result.Channel == nil {
		return nil, result.ResolvedModel, errors.New("combo fallback: no channel resolved")
	}
	return result.Channel, result.ResolvedModel, nil
}

// RewriteRequestBodyModel replaces the "model" field in the request body JSON with resolvedModel.
// This ensures downstream code sees the actual model name, not "combo:xxx".
func RewriteRequestBodyModel(c *gin.Context, resolvedModel string) error {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return err
	}

	body, err := storage.Bytes()
	if err != nil {
		return err
	}

	// Close old storage to release resources
	_ = storage.Close()

	newBody := replaceModelFieldInJSON(body, resolvedModel)

	// Create a new body storage with replaced content
	newStorage, err := common.CreateBodyStorage(newBody)
	if err != nil {
		return err
	}

	// Set the request body to the new storage
	c.Request.Body = newStorage

	// Update the body storage in context so downstream code uses the new body
	c.Set(common.KeyBodyStorage, newStorage)

	// Also set the old-style byte cache for backward compat
	c.Set(common.KeyRequestBody, newBody)

	return nil
}

// replaceModelFieldInJSON parses the JSON body and replaces the "model" field value.
// It uses sjson (already a project dependency) for safe JSON manipulation.
func replaceModelFieldInJSON(body []byte, newModel string) []byte {
	// Use sjson.Set to replace the "model" field at the top level.
	// sjson handles all edge cases (escaped strings, nested objects, etc.).
	jsonStr := string(body)
	result, err := sjson.Set(jsonStr, "model", newModel)
	if err != nil {
		// If sjson fails, return original body unchanged
		return body
	}
	return []byte(result)
}
