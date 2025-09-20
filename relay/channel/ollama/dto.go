package ollama

import (
	"encoding/json"
)

type OllamaChatMessage struct {
	Role      string            `json:"role"`
	Content   string            `json:"content,omitempty"`
	Images    []string          `json:"images,omitempty"`
	ToolCalls []OllamaToolCall  `json:"tool_calls,omitempty"`
	ToolName  string            `json:"tool_name,omitempty"`
	Thinking  json.RawMessage   `json:"thinking,omitempty"`
}

type OllamaToolFunction struct {
	Name        string      `json:"name"`
	Description string      `json:"description,omitempty"`
	Parameters  interface{} `json:"parameters,omitempty"`
}

type OllamaTool struct {
	Type     string            `json:"type"`
	Function OllamaToolFunction `json:"function"`
}

type OllamaToolCall struct {
	Function struct {
		Name      string      `json:"name"`
		Arguments interface{} `json:"arguments"`
	} `json:"function"`
}

type OllamaChatRequest struct {
	Model     string              `json:"model"`
	Messages  []OllamaChatMessage `json:"messages"`
	Tools     interface{}         `json:"tools,omitempty"`
	Format    interface{}         `json:"format,omitempty"`
	Stream    bool                `json:"stream,omitempty"`
	Options   map[string]any      `json:"options,omitempty"`
	KeepAlive interface{}         `json:"keep_alive,omitempty"`
	Think     json.RawMessage     `json:"think,omitempty"`
}

type OllamaGenerateRequest struct {
	Model     string         `json:"model"`
	Prompt    string         `json:"prompt,omitempty"`
	Suffix    string         `json:"suffix,omitempty"`
	Images    []string       `json:"images,omitempty"`
	Format    interface{}    `json:"format,omitempty"`
	Stream    bool           `json:"stream,omitempty"`
	Options   map[string]any `json:"options,omitempty"`
	KeepAlive interface{}    `json:"keep_alive,omitempty"`
	Think     json.RawMessage `json:"think,omitempty"`
}

type OllamaEmbeddingRequest struct {
	Model     string         `json:"model"`
	Input     interface{}    `json:"input"`
	Options   map[string]any `json:"options,omitempty"`
	Dimensions int            `json:"dimensions,omitempty"`
}

type OllamaEmbeddingResponse struct {
	Error           string        `json:"error,omitempty"`
	Model           string        `json:"model"`
	Embeddings      [][]float64   `json:"embeddings"`
	PromptEvalCount int           `json:"prompt_eval_count,omitempty"`
}

