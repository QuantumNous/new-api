package dto

import "github.com/QuantumNous/new-api/constant"

// 这里不好动就不动了，本来想独立出来的（
type OpenAIModels struct {
	Id                     string                  `json:"id"`
	Object                 string                  `json:"object"`
	Created                int                     `json:"created"`
	OwnedBy                string                  `json:"owned_by"`
	SupportedEndpointTypes []constant.EndpointType `json:"supported_endpoint_types"`
}

type AnthropicModel struct {
	ID          string `json:"id"`
	CreatedAt   string `json:"created_at"`
	DisplayName string `json:"display_name"`
	Type        string `json:"type"`
}

type GeminiModel struct {
	Name                       string   `json:"name,omitempty"`
	BaseModelId                string   `json:"baseModelId,omitempty"`
	Version                    string   `json:"version,omitempty"`
	DisplayName                string   `json:"displayName,omitempty"`
	Description                string   `json:"description,omitempty"`
	InputTokenLimit            any      `json:"inputTokenLimit,omitempty"`
	OutputTokenLimit           any      `json:"outputTokenLimit,omitempty"`
	SupportedGenerationMethods []string `json:"supportedGenerationMethods,omitempty"`
	Thinking                   any      `json:"thinking,omitempty"`
	Temperature                any      `json:"temperature,omitempty"`
	MaxTemperature             any      `json:"maxTemperature,omitempty"`
	TopP                       any      `json:"topP,omitempty"`
	TopK                       any      `json:"topK,omitempty"`
}
