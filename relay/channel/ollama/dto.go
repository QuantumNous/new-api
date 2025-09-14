package ollama

import (
	"encoding/json"
	"one-api/dto"
)

type OllamaRequest struct {
	Model            string                `json:"model,omitempty"`
	Messages         []dto.Message         `json:"messages,omitempty"`
	Stream           bool                  `json:"stream,omitempty"`
	Temperature      *float64              `json:"temperature,omitempty"`
	Seed             float64               `json:"seed,omitempty"`
	Topp             float64               `json:"top_p,omitempty"`
	TopK             int                   `json:"top_k,omitempty"`
	Stop             any                   `json:"stop,omitempty"`
	MaxTokens        uint                  `json:"max_tokens,omitempty"`
	Tools            []dto.ToolCallRequest `json:"tools,omitempty"`
	ResponseFormat   any                   `json:"response_format,omitempty"`
	FrequencyPenalty float64               `json:"frequency_penalty,omitempty"`
	PresencePenalty  float64               `json:"presence_penalty,omitempty"`
	Suffix           any                   `json:"suffix,omitempty"`
	StreamOptions    *dto.StreamOptions    `json:"stream_options,omitempty"`
	Prompt           any                   `json:"prompt,omitempty"`
	Think            json.RawMessage       `json:"think,omitempty"`
}

type Options struct {
	Seed             int      `json:"seed,omitempty"`
	Temperature      *float64 `json:"temperature,omitempty"`
	TopK             int      `json:"top_k,omitempty"`
	TopP             float64  `json:"top_p,omitempty"`
	FrequencyPenalty float64  `json:"frequency_penalty,omitempty"`
	PresencePenalty  float64  `json:"presence_penalty,omitempty"`
	NumPredict       int      `json:"num_predict,omitempty"`
	NumCtx           int      `json:"num_ctx,omitempty"`
}

type OllamaEmbeddingRequest struct {
	Model   string   `json:"model,omitempty"`
	Input   []string `json:"input"`
	Options *Options `json:"options,omitempty"`
}

type OllamaEmbeddingResponse struct {
	Error     string      `json:"error,omitempty"`
	Model     string      `json:"model"`
	Embedding [][]float64 `json:"embeddings,omitempty"`
}

// Ollama Tags API 响应结构
type OllamaTagsResponse struct {
	Models []OllamaModel `json:"models"`
}

type OllamaModel struct {
	Name       string            `json:"name"`
	Size       int64             `json:"size"`
	Digest     string            `json:"digest,omitempty"`
	ModifiedAt string            `json:"modified_at"`
	Details    OllamaModelDetail `json:"details,omitempty"`
}

type OllamaModelDetail struct {
	ParentModel       string   `json:"parent_model,omitempty"`
	Format            string   `json:"format,omitempty"`
	Family            string   `json:"family,omitempty"`
	Families          []string `json:"families,omitempty"`
	ParameterSize     string   `json:"parameter_size,omitempty"`
	QuantizationLevel string   `json:"quantization_level,omitempty"`
}

// Ollama Pull API 请求结构
type OllamaPullRequest struct {
	Name   string `json:"name"`
	Stream bool   `json:"stream,omitempty"`
}

// Ollama Pull API 响应结构 (流式)
type OllamaPullResponse struct {
	Status    string `json:"status"`
	Digest    string `json:"digest,omitempty"`
	Total     int64  `json:"total,omitempty"`
	Completed int64  `json:"completed,omitempty"`
}

// Ollama Delete API 请求结构
type OllamaDeleteRequest struct {
	Name string `json:"name"`
}
