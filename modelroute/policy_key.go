package modelroute

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// MakePolicyKey builds a stable PolicyKey for channel × requested_model (PRD §2.1).
func MakePolicyKey(channelID int64, requestedModel string) model.PolicyKey {
	return model.PolicyKey{ChannelID: channelID, RequestedModel: requestedModel}
}

// MakeMetricsKey builds a stable MetricsKey for channel × effective_model (PRD §2.2).
func MakeMetricsKey(channelID int64, effectiveModel string) model.MetricsKey {
	return model.MetricsKey{ChannelID: channelID, EffectiveModel: effectiveModel}
}

// ParseModelMapping unmarshals channel model_mapping JSON into source→target map.
func ParseModelMapping(raw string) (map[string]string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "{}" {
		return nil, nil
	}
	out := make(map[string]string)
	if err := common.UnmarshalJsonStr(raw, &out); err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, nil
	}
	return out, nil
}

// ResolveEffectiveModel applies chained model_mapping (PRD §2.3 / existing ModelMappedHelper semantics).
// Returns effective model, whether any mapping hop applied, and cycle errors.
func ResolveEffectiveModel(requestedModel string, modelMappingJSON string) (effective string, mapped bool, err error) {
	requestedModel = strings.TrimSpace(requestedModel)
	if requestedModel == "" {
		return "", false, errors.New("empty requested model")
	}
	modelMap, err := ParseModelMapping(modelMappingJSON)
	if err != nil {
		return "", false, err
	}
	if modelMap == nil {
		return requestedModel, false, nil
	}

	current := requestedModel
	visited := map[string]bool{current: true}
	for {
		next, ok := modelMap[current]
		if !ok || next == "" {
			break
		}
		if visited[next] {
			if next == current {
				// self-map: treat as not mapped when origin, else stop at current
				if current == requestedModel {
					return requestedModel, false, nil
				}
				return current, true, nil
			}
			return "", false, errors.New("model_mapping_contains_cycle")
		}
		visited[next] = true
		current = next
		mapped = true
	}
	return current, mapped, nil
}

// ResolveMetricsKeyFromPolicy derives MetricsKey from Policy + channel mapping (PRD §2.3).
func ResolveMetricsKeyFromPolicy(policy *model.ChannelModelPolicy, modelMappingJSON string) (model.MetricsKey, string, error) {
	if policy == nil {
		return model.MetricsKey{}, "", errors.New("nil policy")
	}
	effective, _, err := ResolveEffectiveModel(policy.RequestedModel, modelMappingJSON)
	if err != nil {
		return model.MetricsKey{}, "", err
	}
	return MakeMetricsKey(policy.ChannelID, effective), effective, nil
}
