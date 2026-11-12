package convmeta

import (
	"encoding/json"
	"fmt"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// WebSearch is the protocol-neutral hosted web-search specification decoded
// from the source request.
type WebSearch struct {
	Location          *ApproximateLocation
	AllowedDomains    []string
	BlockedDomains    []string
	SearchContextSize string
	MaxUses           *int
	AllowedCallers    []string
	ResponseInclusion string
	ExternalWebAccess *bool
	ReturnTokenBudget json.RawMessage
}

type ApproximateLocation struct {
	City     string
	Region   string
	Country  string
	Timezone string
}

// WebSearchCall is one hosted web-search definition about to be encoded for
// the target request. Exactly one of Chat, Responses, Claude, Gemini is set;
// the encoder may write top-level fields of that request directly.
type WebSearchCall struct {
	Source types.RelayFormat
	Target types.RelayFormat
	// NativeType is the source tool type, for example web_search_preview,
	// web_search_20250305, or googleSearch.
	NativeType string
	// Index is the position in the source tool list. Chat Completions
	// carries one hosted web search, so a Chat encoder sees only the first
	// definition; the other targets call the encoder once per definition.
	Index int
	// Forced reports that the source tool_choice named the web-search tool.
	Forced bool
	Spec   WebSearch

	Chat      *dto.GeneralOpenAIRequest
	Responses *dto.OpenAIResponsesRequest
	Claude    *dto.ClaudeRequest
	Gemini    *dto.GeminiChatRequest
}

// WebSearchEncoding is what an encoder produced for one WebSearchCall.
type WebSearchEncoding struct {
	// Tool is appended to the target tool list in the target protocol's own
	// shape. A Chat target requires a dto.ToolCallRequest (any other type
	// fails the conversion); the others take a JSON-marshalable value (usually
	// map[string]any). Nil means the encoder wrote top-level request fields
	// instead.
	Tool any
	// Omitted reports that no hosted search reaches the upstream. relaykit
	// records hosted_web_search_omitted (error severity) so ToolLossPolicy
	// can reject it, and appends no tool.
	Omitted bool
	// Diagnostics are merged into the conversion result. Error-severity
	// diagnostics count as semantic loss: under the channel's "safe" or
	// "strict" ToolLossPolicy they reject the request, so return
	// ConversionDiagnosticError only when the search behavior the client
	// asked for is actually lost, and ConversionDiagnosticWarning for tuning
	// that does not change whether or what is searched.
	Diagnostics []types.ConversionDiagnostic
}

// WebSearchEncoder encodes hosted web search for an upstream whose dialect
// differs from the target protocol's default. A nil result keeps relaykit's
// default encoding; an error fails the conversion and is reserved for
// encodings that cannot be produced at all, never for ordinary loss.
type WebSearchEncoder func(call WebSearchCall) (*WebSearchEncoding, error)

// Path is the diagnostic path of the definition in the source tool list.
func (c WebSearchCall) Path() string {
	return fmt.Sprintf("tools[%d]", c.Index)
}

// SemanticLoss builds an error-severity diagnostic for this definition.
func (c WebSearchCall) SemanticLoss(code, message string) types.ConversionDiagnostic {
	return types.ConversionDiagnostic{Code: code, Path: c.Path(), Message: message, Severity: types.ConversionDiagnosticError}
}

// PresentationLoss builds a warning-severity diagnostic for this definition.
func (c WebSearchCall) PresentationLoss(code, message string) types.ConversionDiagnostic {
	return types.ConversionDiagnostic{Code: code, Path: c.Path(), Message: message, Severity: types.ConversionDiagnosticWarning}
}
