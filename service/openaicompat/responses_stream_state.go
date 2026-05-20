// Package openaicompat exposes shape translators between the OpenAI Responses,
// Chat-Completions, and Anthropic Messages surfaces.
package openaicompat

// ResponsesStreamFuncCall holds per-tool-call streaming state used by
// ChatCompletionsStreamToResponsesEvents.
type ResponsesStreamFuncCall struct {
	ID        string
	Name      string
	ArgsBuf   string
	ItemIndex int
	Done      bool
}

// ResponsesStreamState holds the per-stream bookkeeping required by the
// ChatCompletions -> Responses streaming translator. It is intentionally
// agnostic of the SSE transport.
type ResponsesStreamState struct {
	// seq is the running sequence-number counter; NextSeq returns the next
	// value, starting from 1.
	seq int64

	// ResponseID is the Responses-API response.id ("resp_..." prefix).
	ResponseID string
	// CreatedAt is the Unix timestamp captured on the first usable chunk.
	CreatedAt int64

	// Started indicates we've already emitted response.created.
	Started bool
	// InProgressSent indicates we've already emitted response.in_progress.
	InProgressSent bool
	// CompletedSent indicates we've already emitted response.completed.
	CompletedSent bool

	// Message output_item lifecycle.
	MessageItemOpen        bool
	MessageItemIndex       int
	MessageContentPartOpen bool
	MessageOutputIndex     int

	// Reasoning output_item lifecycle.
	ReasoningItemOpen        bool
	ReasoningItemIndex       int
	ReasoningSummaryPartOpen bool

	// FuncCalls is keyed by the chunk tool_call index.
	FuncCalls map[int]*ResponsesStreamFuncCall

	// InThinkInlineTag is true while reasoning is being routed via the
	// inline <think>...</think> marker.
	InThinkInlineTag bool

	// Usage accumulates the latest usage seen on stream completion.
	Usage *ResponsesUsageSnapshot

	// Model is the upstream model echoed back to the client.
	Model string

	// FinalFinishReason is the last finish_reason observed on the chat stream.
	FinalFinishReason string

	// ErrorEmitted ensures the error chunk path is idempotent.
	ErrorEmitted bool

	// ItemIndex is a running output_index counter for output_item.added/done.
	ItemIndex int
}

// ResponsesUsageSnapshot is a light wrapper to preserve cross-hop usage state.
type ResponsesUsageSnapshot struct {
	PromptTokens         int
	CompletionTokens     int
	TotalTokens          int
	CachedTokens         int
	CacheCreationTokens  int
	ReasoningTokens      int
}

// NewResponsesStreamState constructs a state with safe zero defaults.
// seq begins at 0 so the first call to NextSeq returns 1.
func NewResponsesStreamState() *ResponsesStreamState {
	return &ResponsesStreamState{
		FuncCalls: map[int]*ResponsesStreamFuncCall{},
		Usage:     &ResponsesUsageSnapshot{},
	}
}

// NextSeq increments the sequence counter and returns the new value.
func (s *ResponsesStreamState) NextSeq() int64 {
	s.seq++
	return s.seq
}
