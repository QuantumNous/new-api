package dto

import (
	"bytes"
	"encoding/json"
)

// ModelRoleMappingsField supports both object form and "json string" form:
//
// 1) Object: { "gpt-4o": { "system": "developer" } }
// 2) String: "{\"gpt-4o\":{\"system\":\"developer\"}}"
//
// It also tolerates legacy object: { "system": "developer" } which will be treated as wildcard prefix "*".
type ModelRoleMappingsField map[string]map[string]string

func (m *ModelRoleMappingsField) UnmarshalJSON(data []byte) error {
	data = bytes.TrimSpace(data)
	if len(data) == 0 || bytes.Equal(data, []byte("null")) {
		*m = nil
		return nil
	}

	// If it's a JSON string, parse the inner JSON.
	if len(data) > 0 && data[0] == '"' {
		var s string
		if err := json.Unmarshal(data, &s); err != nil {
			return err
		}
		sBytes := bytes.TrimSpace([]byte(s))
		if len(sBytes) == 0 {
			*m = nil
			return nil
		}
		return m.UnmarshalJSON(sBytes)
	}

	// First try the desired shape: map[string]map[string]string
	var nested map[string]map[string]string
	if err := json.Unmarshal(data, &nested); err == nil {
		*m = ModelRoleMappingsField(nested)
		return nil
	}

	// Then try legacy shape: map[string]string (apply to all models via wildcard "*")
	var flat map[string]string
	if err := json.Unmarshal(data, &flat); err == nil {
		*m = ModelRoleMappingsField(map[string]map[string]string{
			"*": flat,
		})
		return nil
	}

	// Return the original error for better diagnostics
	return json.Unmarshal(data, &nested)
}

func (m ModelRoleMappingsField) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]map[string]string(m))
}

type ChannelSettings struct {
	ForceFormat            bool   `json:"force_format,omitempty"`
	ThinkingToContent      bool   `json:"thinking_to_content,omitempty"`
	Proxy                  string `json:"proxy"`
	PassThroughBodyEnabled bool   `json:"pass_through_body_enabled,omitempty"`
	SystemPrompt           string `json:"system_prompt,omitempty"`
	SystemPromptOverride   bool   `json:"system_prompt_override,omitempty"`

	// per-channel role mapping: { [modelPrefix]: { [fromRole]: toRole } }
	ModelRoleMappings ModelRoleMappingsField `json:"model_role_mappings,omitempty"`
}

type VertexKeyType string

const (
	VertexKeyTypeJSON   VertexKeyType = "json"
	VertexKeyTypeAPIKey VertexKeyType = "api_key"
)

type AwsKeyType string

const (
	AwsKeyTypeAKSK   AwsKeyType = "ak_sk" // 默认
	AwsKeyTypeApiKey AwsKeyType = "api_key"
)

type ChannelOtherSettings struct {
	AzureResponsesVersion string        `json:"azure_responses_version,omitempty"`
	VertexKeyType         VertexKeyType `json:"vertex_key_type,omitempty"` // "json" or "api_key"
	OpenRouterEnterprise  *bool         `json:"openrouter_enterprise,omitempty"`
	AllowServiceTier      bool          `json:"allow_service_tier,omitempty"`      // 是否允许 service_tier 透传（默认过滤以避免额外计费）
	DisableStore          bool          `json:"disable_store,omitempty"`           // 是否禁用 store 透传（默认允许透传，禁用后可能导致 Codex 无法使用）
	AllowSafetyIdentifier bool          `json:"allow_safety_identifier,omitempty"` // 是否允许 safety_identifier 透传（默认过滤以保护用户隐私）
	AwsKeyType            AwsKeyType    `json:"aws_key_type,omitempty"`
}

func (s *ChannelOtherSettings) IsOpenRouterEnterprise() bool {
	if s == nil || s.OpenRouterEnterprise == nil {
		return false
	}
	return *s.OpenRouterEnterprise
}
