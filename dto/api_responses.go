package dto

// ApiResponse is the standard response wrapper for all API endpoints.
type ApiResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

// LogStatData is the data field for GET /api/log/stat.
type LogStatData struct {
	Quota int64 `json:"quota"`
	RPM   int   `json:"rpm"`
	TPM   int   `json:"tpm"`
}

// SetupData is the data field for GET /api/setup.
type SetupData struct {
	Status       bool   `json:"status"`
	RootInit     bool   `json:"root_init"`
	DatabaseType string `json:"database_type"`
}

// LoginData is the data field for POST /api/user/login (success, no 2FA).
type LoginData struct {
	ID          int    `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Role        int    `json:"role"`
	Status      int    `json:"status"`
	Group       string `json:"group"`
}

// Login2FAData is the data field for POST /api/user/login when 2FA is required.
type Login2FAData struct {
	Require2FA bool `json:"require_2fa"`
}

// --- Partial annotation types for unconvertible routes ---

// MidjourneyErrorResponse is the error shape returned by Midjourney relay endpoints.
type MidjourneyErrorResponse struct {
	Description string `json:"description"`
	Type        string `json:"type"`
	Code        int    `json:"code"`
}

// AnthropicModelList is the response for GET /v1/models (Anthropic format).
type AnthropicModelList struct {
	Data    any    `json:"data"`
	FirstID string `json:"first_id"`
	HasMore bool   `json:"has_more"`
	LastID  string `json:"last_id"`
}

// GeminiModelList is the response for GET /v1/models (Gemini format).
type GeminiModelList struct {
	Models        any `json:"models"`
	NextPageToken any `json:"nextPageToken"`
}

// CreditSummary is the response for GET /api/token/credit_summary.
type CreditSummary struct {
	Object         string `json:"object"`
	TotalGranted   int    `json:"total_granted"`
	TotalUsed      int    `json:"total_used"`
	TotalAvailable int    `json:"total_available"`
	ExpiresAt      int64  `json:"expires_at"`
}

// PasskeyOptionsData is the response for passkey begin routes.
type PasskeyOptionsData struct {
	Options any `json:"options"`
}

// PasskeyStatusData is the response for GET passkey status.
type PasskeyStatusData struct {
	Enabled    bool  `json:"enabled"`
	LastUsedAt any   `json:"last_used_at,omitempty"`
}

// CodexOAuthStartData is the response for codex OAuth start.
type CodexOAuthStartData struct {
	AuthorizeURL string `json:"authorize_url"`
}

// CodexOAuthCompleteData is the response for codex OAuth complete.
type CodexOAuthCompleteData struct {
	ChannelID   int    `json:"channel_id,omitempty"`
	Key         string `json:"key,omitempty"`
	AccountID   string `json:"account_id"`
	Email       string `json:"email"`
	ExpiresAt   string `json:"expires_at"`
	LastRefresh string `json:"last_refresh"`
}

// RelayNotImplementedError is the response for unimplemented relay endpoints.
type RelayNotImplementedError struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error"`
}

// --- Relay success response types (for OpenAPI spec annotation) ---

// ChatCompletionChoice is a single choice in a chat completion response.
type ChatCompletionChoice struct {
	Index        int         `json:"index"`
	Message      ChatMessage `json:"message"`
	FinishReason string      `json:"finish_reason"`
}

// ChatMessage is a message in OpenAI chat format.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// CompletionUsage is token usage info in OpenAI responses.
type CompletionUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// ChatCompletionResponse is the response for POST /v1/chat/completions.
type ChatCompletionResponse struct {
	ID      string                 `json:"id"`
	Object  string                 `json:"object"`
	Created int64                  `json:"created"`
	Model   string                 `json:"model"`
	Choices []ChatCompletionChoice `json:"choices"`
	Usage   CompletionUsage        `json:"usage"`
}

// CompletionResponse is the response for POST /v1/completions.
type CompletionResponse struct {
	ID      string          `json:"id"`
	Object  string          `json:"object"`
	Created int64           `json:"created"`
	Model   string          `json:"model"`
	Choices []any           `json:"choices"`
	Usage   CompletionUsage `json:"usage"`
}

// ClaudeMessageResponse is the response for POST /v1/messages (Anthropic format).
type ClaudeMessageResponse struct {
	ID           string  `json:"id"`
	Type         string  `json:"type"`
	Role         string  `json:"role"`
	Content      []any   `json:"content"`
	Model        string  `json:"model"`
	StopReason   string  `json:"stop_reason"`
	StopSequence *string `json:"stop_sequence"`
	Usage        any     `json:"usage"`
}

// ImageGenerationResponse is the response for POST /v1/images/generations.
type ImageGenerationResponse struct {
	Created int64       `json:"created"`
	Data    []ImageData `json:"data"`
}

// AudioTranscriptionResponse is the response for POST /v1/audio/transcriptions.
type AudioTranscriptionResponse struct {
	Text string `json:"text"`
}

// ModerationResponse is the response for POST /v1/moderations.
type ModerationResponse struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Results []any  `json:"results"`
}

// ResponsesAPIResponse is the response for POST /v1/responses.
type ResponsesAPIResponse struct {
	ID        string `json:"id"`
	Object    string `json:"object"`
	CreatedAt int64  `json:"created_at"`
	Status    string `json:"status"`
	Output    []any  `json:"output"`
	Model     string `json:"model"`
	Usage     any    `json:"usage,omitempty"`
}

// TaskResponseDoc is a simplified task response for OpenAPI documentation.
// The real TaskResponse[T] in task.go is generic and can't be used as a type annotation.
type TaskResponseDoc struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data"`
}
