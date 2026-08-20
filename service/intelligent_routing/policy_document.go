package intelligent_routing

import (
	"crypto/sha256"
	"fmt"
	"sort"

	"github.com/QuantumNous/new-api/common"
	routingsetting "github.com/QuantumNous/new-api/setting/intelligent_routing_setting"
)

type ValidationIssue struct {
	Code    string `json:"code"`
	Field   string `json:"field"`
	Message string `json:"message"`
}

type ValidatedPolicy struct {
	Config   routingsetting.Config
	JSON     string
	Checksum string
}

func ValidatePolicyDocument(raw string) (ValidatedPolicy, []ValidationIssue) {
	if len(raw) > routingsetting.MaxPolicyDocumentBytes {
		return ValidatedPolicy{}, []ValidationIssue{{Code: "policy.too_large", Field: "policy", Message: "Policy document is too large"}}
	}
	var input routingsetting.Config
	if err := common.UnmarshalJsonStr(raw, &input); err != nil {
		return ValidatedPolicy{}, []ValidationIssue{{Code: "policy.invalid_json", Field: "policy", Message: "Policy document is not valid JSON"}}
	}
	if input.MaxAttempts > routingsetting.MaxAttempts || input.MaxAttempts < 0 {
		return ValidatedPolicy{}, []ValidationIssue{{Code: "max_attempts.out_of_range", Field: "max_attempts", Message: "Maximum attempts is out of range"}}
	}
	if input.MaxEndpointsPerModel > routingsetting.MaxEndpointsPerModel || input.MaxEndpointsPerModel < 0 {
		return ValidatedPolicy{}, []ValidationIssue{{Code: "max_endpoints_per_model.out_of_range", Field: "max_endpoints_per_model", Message: "Maximum endpoints per model is out of range"}}
	}
	allowedCapabilities := map[string]struct{}{
		string(CapabilityTools): {}, string(CapabilityJSONSchema): {}, string(CapabilityVision): {}, string(CapabilityAudio): {},
	}
	for modelIndex, policy := range input.Models {
		for capabilityIndex, capability := range policy.Capabilities {
			if _, ok := allowedCapabilities[capability]; !ok {
				return ValidatedPolicy{}, []ValidationIssue{{
					Code: "models.capability.unknown", Field: fmt.Sprintf("models[%d].capabilities[%d]", modelIndex, capabilityIndex),
					Message: "Model capability is unknown",
				}}
			}
		}
	}

	normalized, err := routingsetting.Normalize(input)
	if err != nil {
		return ValidatedPolicy{}, []ValidationIssue{{Code: "policy.invalid", Field: "policy", Message: "Policy document contains invalid values"}}
	}
	canonical, err := CanonicalPolicyJSON(normalized)
	if err != nil {
		return ValidatedPolicy{}, []ValidationIssue{{Code: "policy.canonicalization_failed", Field: "policy", Message: "Policy document could not be canonicalized"}}
	}
	sum := sha256.Sum256([]byte(canonical))
	return ValidatedPolicy{Config: normalized, JSON: canonical, Checksum: fmt.Sprintf("%x", sum)}, nil
}

func CanonicalPolicyJSON(config routingsetting.Config) (string, error) {
	config.Models = append([]routingsetting.ModelPolicy(nil), config.Models...)
	for index := range config.Models {
		config.Models[index].Capabilities = append([]string(nil), config.Models[index].Capabilities...)
		sort.Strings(config.Models[index].Capabilities)
	}
	sort.Slice(config.Models, func(i, j int) bool {
		return config.Models[i].Model < config.Models[j].Model
	})
	data, err := common.Marshal(config)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
