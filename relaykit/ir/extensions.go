package ir

import "encoding/json"

// Extensions hold protocol-private fields that are not first-class IR.
// To(X) must write Extensions.X back so X→IR→X is stable. To(Y) does not
// copy X's extras onto Y.
type Extensions struct {
	Claude    *ClaudeExt    `json:"claude,omitempty"`
	Gemini    *GeminiExt    `json:"gemini,omitempty"`
	Chat      *ChatExt      `json:"chat,omitempty"`
	Responses *ResponsesExt `json:"responses,omitempty"`
}

type ClaudeExt struct {
	CacheControl      json.RawMessage `json:"cache_control,omitempty"`
	InferenceGeo      string          `json:"inference_geo,omitempty"`
	Speed             json.RawMessage `json:"speed,omitempty"`
	MCPServers        json.RawMessage `json:"mcp_servers,omitempty"`
	Container         json.RawMessage `json:"container,omitempty"`
	OutputConfig      json.RawMessage `json:"output_config,omitempty"`
	OutputFormat      json.RawMessage `json:"output_format,omitempty"`
	ContextManagement json.RawMessage `json:"context_management,omitempty"`
	Metadata          json.RawMessage `json:"metadata,omitempty"`
	ServiceTier       string          `json:"service_tier,omitempty"`
	Prompt            string          `json:"prompt,omitempty"`
	MaxTokensToSample *uint           `json:"max_tokens_to_sample,omitempty"`
	Usage             json.RawMessage `json:"usage,omitempty"`
	ResponseType      string          `json:"response_type,omitempty"`
	ResponseRole      string          `json:"response_role,omitempty"`
}

type GeminiExt struct {
	SafetySettings json.RawMessage `json:"safety_settings,omitempty"`
	CachedContent  string          `json:"cached_content,omitempty"`
	ToolConfig     json.RawMessage `json:"tool_config,omitempty"`
	Labels         json.RawMessage `json:"labels,omitempty"`
	Raw            json.RawMessage `json:"raw,omitempty"`
}

type ChatExt struct {
	Raw     json.RawMessage `json:"raw,omitempty"`
	Object  string          `json:"object,omitempty"`
	Created json.RawMessage `json:"created,omitempty"`
}

type ResponsesExt struct {
	PreviousResponseID string          `json:"previous_response_id,omitempty"`
	Conversation       json.RawMessage `json:"conversation,omitempty"`
	Prompt             json.RawMessage `json:"prompt,omitempty"`
	Include            json.RawMessage `json:"include,omitempty"`
	Store              json.RawMessage `json:"store,omitempty"`
	Truncation         json.RawMessage `json:"truncation,omitempty"`
	ContextManagement  json.RawMessage `json:"context_management,omitempty"`
	Status             json.RawMessage `json:"status,omitempty"`
	Object             string          `json:"object,omitempty"`
	Raw                json.RawMessage `json:"raw,omitempty"`
}
