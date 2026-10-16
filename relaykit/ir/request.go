package ir

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/QuantumNous/new-api/relaykit/types"
)

type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleTool      Role = "tool"
)

// NormalizeRole converts protocol-specific role spellings into the closed IR
// role set. Developer is an instruction role and model is Gemini's assistant
// spelling; arbitrary role strings are rejected instead of leaking across
// protocol boundaries.
func NormalizeRole(value string) (Role, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "system", "developer":
		return RoleSystem, nil
	case "user", "":
		return RoleUser, nil
	case "assistant", "model":
		return RoleAssistant, nil
	case "tool":
		return RoleTool, nil
	default:
		return "", fmt.Errorf("unsupported message role %q", value)
	}
}

func ValidRole(role Role) bool {
	switch role {
	case RoleSystem, RoleUser, RoleAssistant, RoleTool:
		return true
	default:
		return false
	}
}

type ThinkMode string

const (
	ThinkOff     ThinkMode = "off"
	ThinkEnabled ThinkMode = "enabled"
	ThinkAuto    ThinkMode = "auto"
)

// ThinkDisplayMode is the protocol-neutral visibility requested for model
// thinking. Vendor wire values such as Claude's "summarized" / "omitted"
// must be normalized at protocol boundaries instead of being stored here.
type ThinkDisplayMode string

const (
	ThinkDisplayHidden   ThinkDisplayMode = "hidden"
	ThinkDisplayAuto     ThinkDisplayMode = "auto"
	ThinkDisplayConcise  ThinkDisplayMode = "concise"
	ThinkDisplayDetailed ThinkDisplayMode = "detailed"
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
	Diagnostics []types.ConversionDiagnostic `json:"-"`
	Model       string                       `json:"model,omitempty"`
	StreamSet   bool                         `json:"-"`
	Stream      bool                         `json:"stream,omitempty"`
	Messages    []Message                    `json:"messages,omitempty"`
	Tools       []Tool                       `json:"tools,omitempty"`
	Sample      Sampling                     `json:"sample,omitempty"`
	Think       *ThinkConfig                 `json:"think,omitempty"`
	ToolChoice  *ToolChoice                  `json:"tool_choice,omitempty"`
	Format      *ResponseFormat              `json:"format,omitempty"`
	Metadata    map[string]string            `json:"metadata,omitempty"`
	Extensions  Extensions                   `json:"extensions,omitempty"`
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
	MaxOutputTokens  *uint    `json:"max_output_tokens,omitempty"`
	Stop             []string `json:"stop,omitempty"`
	Seed             *int64   `json:"seed,omitempty"`
	N                *int     `json:"n,omitempty"`
	FrequencyPenalty *float64 `json:"frequency_penalty,omitempty"`
	PresencePenalty  *float64 `json:"presence_penalty,omitempty"`
}

type ThinkConfig struct {
	Source       reasoning.Source `json:"-"`
	BudgetSource reasoning.Source `json:"-"`
	Mode         ThinkMode        `json:"mode,omitempty"`
	Budget       *int             `json:"budget,omitempty"`
	Level        string           `json:"level,omitempty"`
	Include      *bool            `json:"include,omitempty"`
	Display      ThinkDisplayMode `json:"display,omitempty"`
}

// ThinkFromIntent retains both native controls and their precedence across a
// protocol projection. Rendering for a model remains the reasoning package's job.
func ThinkFromIntent(intent reasoning.Intent) *ThinkConfig {
	if intent.IsEmpty() {
		return nil
	}
	cfg := &ThinkConfig{Budget: intent.BudgetTokens, Level: string(intent.Effort), Include: intent.IncludeThoughts, Source: intent.Source, BudgetSource: intent.BudgetSource}
	switch intent.Mode {
	case reasoning.ModeDisabled:
		cfg.Mode = ThinkOff
	case reasoning.ModeAdaptive:
		cfg.Mode = ThinkAuto
	case reasoning.ModeEnabled:
		cfg.Mode = ThinkEnabled
	}
	if intent.IncludeThoughts != nil {
		if *intent.IncludeThoughts {
			cfg.Display = ThinkDisplayAuto
		} else {
			cfg.Display = ThinkDisplayHidden
		}
	}
	return cfg
}

func (cfg *ThinkConfig) Intent() reasoning.Intent {
	if cfg == nil {
		return reasoning.Intent{}
	}
	intent := reasoning.Intent{Effort: reasoning.Effort(cfg.Level), BudgetTokens: cfg.Budget, IncludeThoughts: cfg.Include, Source: cfg.Source, BudgetSource: cfg.BudgetSource}
	switch cfg.Mode {
	case ThinkOff:
		intent.Mode = reasoning.ModeDisabled
	case ThinkAuto:
		intent.Mode = reasoning.ModeAdaptive
	case ThinkEnabled:
		intent.Mode = reasoning.ModeEnabled
	}
	if intent.IncludeThoughts == nil && cfg.Display != "" {
		include := cfg.Display != ThinkDisplayHidden
		intent.IncludeThoughts = &include
	}
	return intent
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
