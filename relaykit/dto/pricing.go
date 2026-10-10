package dto

import "github.com/QuantumNous/new-api/relaykit/types"

// 这里不好动就不动了，本来想独立出来的（
type OpenAIModels struct {
	Id                     string               `json:"id"`
	Object                 string               `json:"object"`
	Created                int                  `json:"created"`
	OwnedBy                string               `json:"owned_by"`
	SupportedEndpointTypes []types.EndpointType `json:"supported_endpoint_types"`
	// MaxModelLen is the maximum context window advertised by the upstream
	// serving engine (vLLM/SGLang report it as max_model_len). Zero means
	// unknown and is omitted from the JSON payload so non-probing channels
	// keep the exact same response shape as before.
	MaxModelLen int64 `json:"max_model_len,omitempty"`
}

type AnthropicModel struct {
	ID          string `json:"id"`
	CreatedAt   string `json:"created_at"`
	DisplayName string `json:"display_name"`
	Type        string `json:"type"`
}

type GeminiModel struct {
	Name                       any   `json:"name"`
	BaseModelId                any   `json:"baseModelId"`
	Version                    any   `json:"version"`
	DisplayName                any   `json:"displayName"`
	Description                any   `json:"description"`
	InputTokenLimit            any   `json:"inputTokenLimit"`
	OutputTokenLimit           any   `json:"outputTokenLimit"`
	SupportedGenerationMethods []any `json:"supportedGenerationMethods"`
	Thinking                   any   `json:"thinking"`
	Temperature                any   `json:"temperature"`
	MaxTemperature             any   `json:"maxTemperature"`
	TopP                       any   `json:"topP"`
	TopK                       any   `json:"topK"`
}
