package cohere

import (
	"encoding/json"

	"github.com/QuantumNous/new-api/dto"
)

type CohereChatRequest struct {
	Model            string                `json:"model"`
	Messages         []CohereChatMessage   `json:"messages"`
	Stream           bool                  `json:"stream"`
	MaxTokens        *uint                 `json:"max_tokens,omitempty"`
	Temperature      *float64              `json:"temperature,omitempty"`
	P                *float64              `json:"p,omitempty"`
	K                *int                  `json:"k,omitempty"`
	StopSequences    []string              `json:"stop_sequences,omitempty"`
	FrequencyPenalty *float64              `json:"frequency_penalty,omitempty"`
	PresencePenalty  *float64              `json:"presence_penalty,omitempty"`
	Seed             *uint64               `json:"seed,omitempty"`
	ResponseFormat   *dto.ResponseFormat   `json:"response_format,omitempty"`
	SafetyMode       string                `json:"safety_mode,omitempty"`
	Thinking         *CohereThinking       `json:"thinking,omitempty"`
	Tools            []dto.ToolCallRequest `json:"tools,omitempty"`
	ToolChoice       string                `json:"tool_choice,omitempty"`
}

type CohereThinking struct {
	Type string `json:"type"`
}

type CohereChatMessage struct {
	Role       string            `json:"role"`
	Content    any               `json:"content,omitempty"`
	ToolCallId string            `json:"tool_call_id,omitempty"`
	ToolCalls  []CohereToolCall  `json:"tool_calls,omitempty"`
	ToolPlan   string            `json:"tool_plan,omitempty"`
	Citations  []json.RawMessage `json:"citations,omitempty"`
}

type CohereContentBlock struct {
	Type     string                 `json:"type"`
	Text     string                 `json:"text,omitempty"`
	Thinking string                 `json:"thinking,omitempty"`
	ImageURL *CohereImageURL        `json:"image_url,omitempty"`
	Document *CohereDocumentContent `json:"document,omitempty"`
}

type CohereImageURL struct {
	URL    string `json:"url"`
	Detail string `json:"detail,omitempty"`
}

type CohereDocumentContent struct {
	ID   string `json:"id,omitempty"`
	Data any    `json:"data"`
}

type CohereToolCall struct {
	ID       string               `json:"id,omitempty"`
	Type     string               `json:"type,omitempty"`
	Function dto.FunctionResponse `json:"function"`
}

type CohereChatResponse struct {
	ID           string                `json:"id"`
	FinishReason string                `json:"finish_reason"`
	Message      CohereResponseMessage `json:"message"`
	Usage        CohereUsage           `json:"usage"`
}

type CohereResponseMessage struct {
	Role      string               `json:"role"`
	Content   []CohereContentBlock `json:"content"`
	ToolCalls []CohereToolCall     `json:"tool_calls,omitempty"`
	ToolPlan  string               `json:"tool_plan,omitempty"`
}

type CohereStreamEvent struct {
	Type  string `json:"type"`
	ID    string `json:"id,omitempty"`
	Index *int   `json:"index,omitempty"`
	Delta struct {
		FinishReason string      `json:"finish_reason,omitempty"`
		Usage        CohereUsage `json:"usage,omitempty"`
		Message      struct {
			Role      string             `json:"role,omitempty"`
			Content   CohereContentBlock `json:"content,omitempty"`
			ToolCalls json.RawMessage    `json:"tool_calls,omitempty"`
			ToolPlan  string             `json:"tool_plan,omitempty"`
		} `json:"message,omitempty"`
	} `json:"delta,omitempty"`
}

type CohereRerankRequest struct {
	Documents []any  `json:"documents"`
	Query     string `json:"query"`
	Model     string `json:"model"`
	TopN      int    `json:"top_n,omitempty"`
}

type CohereRerankResponseResult struct {
	Results []dto.RerankResponseResult `json:"results"`
	ID      string                     `json:"id,omitempty"`
	Meta    CohereMeta                 `json:"meta"`
}

type CohereEmbeddingRequest struct {
	Model           string   `json:"model"`
	Texts           []string `json:"texts,omitempty"`
	InputType       string   `json:"input_type"`
	EmbeddingTypes  []string `json:"embedding_types,omitempty"`
	OutputDimension *int     `json:"output_dimension,omitempty"`
	Truncate        string   `json:"truncate,omitempty"`
}

type CohereEmbeddingResponse struct {
	ID         string `json:"id"`
	Embeddings struct {
		Float [][]float64 `json:"float"`
	} `json:"embeddings"`
	Meta CohereMeta `json:"meta"`
}

type CohereModelsResponse struct {
	Models []struct {
		Name string `json:"name"`
	} `json:"models"`
	NextPageToken string `json:"next_page_token"`
}

type CohereMeta struct {
	BilledUnits CohereBilledUnits `json:"billed_units"`
	Tokens      CohereTokens      `json:"tokens"`
}

type CohereUsage struct {
	BilledUnits CohereBilledUnits `json:"billed_units"`
	Tokens      CohereTokens      `json:"tokens"`
}

type CohereBilledUnits struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
	SearchUnits  int `json:"search_units,omitempty"`
}

type CohereTokens struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}
