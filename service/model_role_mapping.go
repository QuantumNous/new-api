package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
)

const OptionKeyModelRoleMappings = "ModelRoleMappings"

type ModelRoleMappings map[string]map[string]string

var (
	allowedOpenAIRoles = map[string]struct{}{
		"system":    {},
		"user":      {},
		"assistant": {},
		"developer": {},
		"tool":      {},
	}

	unknownRoleWarnOnce sync.Map // key: model + "|" + role
)

func ValidateModelRoleMappingsJSON(jsonStr string) error {
	_, err := ParseAndValidateModelRoleMappingsJSON(jsonStr)
	return err
}

func ParseAndValidateModelRoleMappingsJSON(jsonStr string) (ModelRoleMappings, error) {
	if strings.TrimSpace(jsonStr) == "" {
		return ModelRoleMappings{}, nil
	}

	var raw any
	if err := json.Unmarshal([]byte(jsonStr), &raw); err != nil {
		return nil, fmt.Errorf("invalid json: %w", err)
	}

	out, ok := raw.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("expected object: map[modelPrefix]map[fromRole]toRole")
	}

	mappings := ModelRoleMappings{}
	for modelPrefix, v := range out {
		if strings.TrimSpace(modelPrefix) == "" {
			return nil, fmt.Errorf("model prefix cannot be empty")
		}
		roleMapAny, ok := v.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("model %q mapping must be an object", modelPrefix)
		}
		roleMap := map[string]string{}
		for fromRole, toAny := range roleMapAny {
			toRole, ok := toAny.(string)
			if !ok {
				return nil, fmt.Errorf("model %q role %q target must be string", modelPrefix, fromRole)
			}
			fromRole = strings.TrimSpace(fromRole)
			toRole = strings.TrimSpace(toRole)
			if fromRole == "" || toRole == "" {
				return nil, fmt.Errorf("model %q role mapping cannot have empty roles", modelPrefix)
			}
			if !IsAllowedOpenAIRole(fromRole) {
				return nil, fmt.Errorf("model %q has invalid fromRole %q", modelPrefix, fromRole)
			}
			if !IsAllowedOpenAIRole(toRole) {
				return nil, fmt.Errorf("model %q has invalid toRole %q", modelPrefix, toRole)
			}
			roleMap[fromRole] = toRole
		}
		mappings[modelPrefix] = roleMap
	}

	return mappings, nil
}

func IsAllowedOpenAIRole(role string) bool {
	_, ok := allowedOpenAIRoles[role]
	return ok
}

func GetModelRoleMappingsFromOptions(ctx context.Context) (ModelRoleMappings, bool) {
	common.OptionMapRWMutex.RLock()
	raw := common.OptionMap[OptionKeyModelRoleMappings]
	common.OptionMapRWMutex.RUnlock()

	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "{}" {
		return nil, false
	}

	m, err := ParseAndValidateModelRoleMappingsJSON(raw)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("invalid %s: %v", OptionKeyModelRoleMappings, err))
		return nil, false
	}
	if len(m) == 0 {
		return nil, false
	}
	return m, true
}

func ResolveRoleMappingForModel(model string, mappings ModelRoleMappings) (map[string]string, bool) {
	if len(mappings) == 0 || model == "" {
		return nil, false
	}

	var (
		bestPrefix string
		bestMap    map[string]string
	)
	for prefix, roleMap := range mappings {
		if strings.HasPrefix(model, prefix) {
			if len(prefix) > len(bestPrefix) {
				bestPrefix = prefix
				bestMap = roleMap
			}
		}
	}
	if bestMap == nil {
		return nil, false
	}
	return bestMap, true
}

func ApplyModelRoleMappingsToRequest(ctx context.Context, request dto.Request) {
	if request == nil {
		return
	}

	mappings, ok := GetModelRoleMappingsFromOptions(ctx)
	if !ok {
		return
	}

	switch r := request.(type) {
	case *dto.GeneralOpenAIRequest:
		applyToGeneralOpenAIRequest(ctx, r, mappings)
	case *dto.OpenAIResponsesRequest:
		applyToOpenAIResponsesRequest(ctx, r, mappings)
	default:
		return
	}
}

func applyToGeneralOpenAIRequest(ctx context.Context, r *dto.GeneralOpenAIRequest, mappings ModelRoleMappings) {
	roleMap, ok := ResolveRoleMappingForModel(r.Model, mappings)
	if !ok || len(roleMap) == 0 {
		return
	}

	for i := range r.Messages {
		orig := r.Messages[i].Role
		if orig == "" {
			continue
		}
		target, has := roleMap[orig]
		if has {
			r.Messages[i].Role = target
			continue
		}
		if !IsAllowedOpenAIRole(orig) {
			warnUnknownRoleOnce(ctx, r.Model, orig)
		}
	}
}

func applyToOpenAIResponsesRequest(ctx context.Context, r *dto.OpenAIResponsesRequest, mappings ModelRoleMappings) {
	roleMap, ok := ResolveRoleMappingForModel(r.Model, mappings)
	if !ok || len(roleMap) == 0 {
		return
	}
	if len(r.Input) == 0 {
		return
	}

	if common.GetJsonType(r.Input) != "array" {
		return
	}

	var inputs []dto.Input
	if err := common.Unmarshal(r.Input, &inputs); err != nil {
		return
	}

	changed := false
	for i := range inputs {
		orig := strings.TrimSpace(inputs[i].Role)
		if orig == "" {
			continue
		}
		target, has := roleMap[orig]
		if has {
			inputs[i].Role = target
			changed = true
			continue
		}
		if !IsAllowedOpenAIRole(orig) {
			warnUnknownRoleOnce(ctx, r.Model, orig)
		}
	}

	if !changed {
		return
	}
	b, err := common.Marshal(inputs)
	if err != nil {
		return
	}
	r.Input = b
}

func warnUnknownRoleOnce(ctx context.Context, model string, role string) {
	key := model + "|" + role
	if _, loaded := unknownRoleWarnOnce.LoadOrStore(key, struct{}{}); loaded {
		return
	}
	logger.LogWarn(ctx, fmt.Sprintf("unknown role in request (model=%s): %s", model, role))
}