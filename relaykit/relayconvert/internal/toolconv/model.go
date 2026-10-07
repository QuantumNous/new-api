package toolconv

import (
	"encoding/json"

	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/types"
)

type Kind string

const (
	KindFunction      Kind = "function"
	KindWebSearch     Kind = "web_search"
	KindFileSearch    Kind = "file_search"
	KindWebFetch      Kind = "web_fetch"
	KindCodeExecution Kind = "code_execution"
	KindComputerUse   Kind = "computer_use"
	KindURLContext    Kind = "url_context"
	KindMCP           Kind = "mcp"
	KindImage         Kind = "image_generation"
	KindNative        Kind = "native"
)

type Execution string

const (
	ExecutionClient Execution = "client"
	ExecutionServer Execution = "server"
)

type Function struct {
	Name        string
	Description string
	Parameters  any
	Strict      *bool
	// OpenAPISchema marks Parameters written in Gemini's OpenAPI schema
	// subset (uppercase type names, nullable, propertyOrdering) rather than
	// JSON Schema.
	OpenAPISchema bool
}

// ApproximateLocation and WebSearch are the convmeta types, so a host
// web-search encoder receives the decoded specification unchanged.
type (
	ApproximateLocation = convmeta.ApproximateLocation
	WebSearch           = convmeta.WebSearch
)

type Definition struct {
	Kind       Kind
	Execution  Execution
	NativeType string
	Name       string
	Function   *Function
	WebSearch  *WebSearch
	Raw        json.RawMessage
	Group      int
	// Namespace is the Responses tool namespace the definition was declared
	// in. Name and Function.Name already hold the flattened upstream name.
	Namespace string
}

type ChoiceMode string

const (
	ChoiceAuto     ChoiceMode = "auto"
	ChoiceNone     ChoiceMode = "none"
	ChoiceRequired ChoiceMode = "required"
	ChoiceNamed    ChoiceMode = "named"
	ChoiceOpaque   ChoiceMode = "opaque"
)

type Choice struct {
	Mode                   ChoiceMode
	Kind                   Kind
	Name                   string
	AllowedNames           []string
	NativeType             string
	DisableParallelToolUse *bool
	Raw                    json.RawMessage
}

type Set struct {
	Source           types.RelayFormat
	Definitions      []Definition
	Choice           *Choice
	ParallelAllowed  *bool
	NativeToolConfig json.RawMessage
	History          []HostedHistoryItem
	// Diagnostics reports losses found while extracting the definitions; they
	// are returned with the attach diagnostics.
	Diagnostics []types.ConversionDiagnostic
}

func (s Set) Empty() bool {
	return len(s.Definitions) == 0 && s.Choice == nil && s.ParallelAllowed == nil && len(s.NativeToolConfig) == 0 && len(s.History) == 0 && len(s.Diagnostics) == 0
}

type HostedHistoryItem struct {
	Kind              Kind
	NativeType        string
	Role              string
	MessageIndex      int
	BlockIndex        int
	MessageHasRegular bool
	Sequence          int
	ID                string
	CallID            string
	Name              string
	ServerName        string
	Status            string
	Action            json.RawMessage
	Results           json.RawMessage
	Caller            json.RawMessage
	Raw               json.RawMessage
}
