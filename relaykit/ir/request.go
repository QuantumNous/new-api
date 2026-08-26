package ir

import "encoding/json"

type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleTool      Role = "tool"
)

type ThinkMode string

const (
	ThinkOff     ThinkMode = "off"
	ThinkEnabled ThinkMode = "enabled"
	ThinkAuto    ThinkMode = "auto"
)

type ToolKind string

const (
	ToolFunction      ToolKind = "function"
	ToolWebSearch     ToolKind = "web_search"
	ToolGoogleSearch  ToolKind = "google_search"
	ToolCodeExecution ToolKind = "code_execution"
	ToolMCP           ToolKind = "mcp"
	ToolComputer      ToolKind = "computer"
	ToolImageGen      ToolKind = "image_generation"
	ToolFileSearch    ToolKind = "file_search"
	ToolCustom        ToolKind = "custom"
)

type ToolChoiceMode string

const (
	ToolChoiceAuto     ToolChoiceMode = "auto"
	ToolChoiceRequired ToolChoiceMode = "required"
	ToolChoiceNone     ToolChoiceMode = "none"
	ToolChoiceNamed    ToolChoiceMode = "named"
)

// Request is the protocol-neutral text generation request.
type Request struct {
	Model      string            `json:"model,omitempty"`
	Stream     bool              `json:"stream,omitempty"`
	Messages   []Message         `json:"messages,omitempty"`
	Tools      []Tool            `json:"tools,omitempty"`
	Sample     Sampling          `json:"sample,omitempty"`
	Think      *ThinkConfig      `json:"think,omitempty"`
	ToolChoice *ToolChoice       `json:"tool_choice,omitempty"`
	Format     *ResponseFormat   `json:"format,omitempty"`
	Metadata   map[string]string `json:"metadata,omitempty"`
	Extensions Extensions        `json:"extensions,omitempty"`
}

type Message struct {
	Role   Role            `json:"role"`
	Name   string          `json:"name,omitempty"`
	Blocks []Block         `json:"blocks,omitempty"`
	Extra  json.RawMessage `json:"extra,omitempty"`
}

type Sampling struct {
	Temperature      *float64 `json:"temperature,omitempty"`
	TopP             *float64 `json:"top_p,omitempty"`
	TopK             *int     `json:"top_k,omitempty"`
	MaxOutputTokens  *int     `json:"max_output_tokens,omitempty"`
	Stop             []string `json:"stop,omitempty"`
	Seed             *int64   `json:"seed,omitempty"`
	N                *int     `json:"n,omitempty"`
	FrequencyPenalty *float64 `json:"frequency_penalty,omitempty"`
	PresencePenalty  *float64 `json:"presence_penalty,omitempty"`
}

type ThinkConfig struct {
	Mode    ThinkMode `json:"mode,omitempty"`
	Budget  *int      `json:"budget,omitempty"`
	Level   string    `json:"level,omitempty"`
	Include *bool     `json:"include,omitempty"`
	Display string    `json:"display,omitempty"`
}

type Tool struct {
	Kind         ToolKind        `json:"kind"`
	Name         string          `json:"name,omitempty"`
	Description  string          `json:"description,omitempty"`
	Schema       json.RawMessage `json:"schema,omitempty"`
	Extra        json.RawMessage `json:"extra,omitempty"`
	CacheControl *CacheControl   `json:"cache_control,omitempty"`
}

type ToolChoice struct {
	Mode     ToolChoiceMode `json:"mode"`
	Name     string         `json:"name,omitempty"`
	Parallel *bool          `json:"parallel,omitempty"`
}

type ResponseFormat struct {
	Type   string          `json:"type,omitempty"`
	Name   string          `json:"name,omitempty"`
	Schema json.RawMessage `json:"schema,omitempty"`
	Strict *bool           `json:"strict,omitempty"`
}
