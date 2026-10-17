package dto

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// GeminiInteractionRequest is the native request body used by Google's
// Interactions API. The API evolves independently of generateContent, so raw
// JSON fields keep provider additions intact while the gateway still reads and
// updates the routing fields it owns.
type GeminiInteractionRequest struct {
	Model                 string          `json:"model,omitempty"`
	Agent                 string          `json:"agent,omitempty"`
	Input                 json.RawMessage `json:"input"`
	SystemInstruction     string          `json:"system_instruction,omitempty"`
	Tools                 json.RawMessage `json:"tools,omitempty"`
	ResponseFormat        json.RawMessage `json:"response_format,omitempty"`
	ResponseMIMEType      string          `json:"response_mime_type,omitempty"`
	Stream                *bool           `json:"stream,omitempty"`
	Store                 *bool           `json:"store,omitempty"`
	Background            *bool           `json:"background,omitempty"`
	GenerationConfig      json.RawMessage `json:"generation_config,omitempty"`
	AgentConfig           json.RawMessage `json:"agent_config,omitempty"`
	PreviousInteractionID string          `json:"previous_interaction_id,omitempty"`
	ResponseModalities    []string        `json:"response_modalities,omitempty"`
	ServiceTier           string          `json:"service_tier,omitempty"`
	WebhookConfig         json.RawMessage `json:"webhook_config,omitempty"`

	raw                    json.RawMessage
	modelDirty             bool
	systemInstructionDirty bool
}

func (r *GeminiInteractionRequest) UnmarshalJSON(data []byte) error {
	type alias GeminiInteractionRequest
	var decoded alias
	if err := kitutil.Unmarshal(data, &decoded); err != nil {
		return err
	}
	*r = GeminiInteractionRequest(decoded)
	r.raw = bytes.Clone(data)
	return nil
}

func (r GeminiInteractionRequest) MarshalJSON() ([]byte, error) {
	if len(r.raw) > 0 && !r.modelDirty && !r.systemInstructionDirty {
		return bytes.Clone(r.raw), nil
	}
	if len(r.raw) > 0 {
		var fields map[string]json.RawMessage
		if err := kitutil.Unmarshal(r.raw, &fields); err != nil {
			return nil, err
		}
		if r.modelDirty {
			switch {
			case r.Model != "":
				model, err := kitutil.Marshal(r.Model)
				if err != nil {
					return nil, err
				}
				fields["model"] = model
			case r.Agent != "":
				agent, err := kitutil.Marshal(r.Agent)
				if err != nil {
					return nil, err
				}
				delete(fields, "model")
				fields["agent"] = agent
			default:
				delete(fields, "model")
				delete(fields, "agent")
			}
		}
		if r.systemInstructionDirty {
			if r.SystemInstruction == "" {
				delete(fields, "system_instruction")
			} else {
				systemInstruction, err := kitutil.Marshal(r.SystemInstruction)
				if err != nil {
					return nil, err
				}
				fields["system_instruction"] = systemInstruction
			}
		}
		return kitutil.Marshal(fields)
	}

	type aliasWithoutRaw GeminiInteractionRequest
	return kitutil.Marshal(aliasWithoutRaw(r))
}

// Clone makes a retry-safe copy without losing unknown fields from the
// original request body.
func (r *GeminiInteractionRequest) Clone() *GeminiInteractionRequest {
	if r == nil {
		return nil
	}
	clone := *r
	clone.Input = bytes.Clone(r.Input)
	clone.Tools = bytes.Clone(r.Tools)
	clone.ResponseFormat = bytes.Clone(r.ResponseFormat)
	clone.GenerationConfig = bytes.Clone(r.GenerationConfig)
	clone.AgentConfig = bytes.Clone(r.AgentConfig)
	clone.WebhookConfig = bytes.Clone(r.WebhookConfig)
	clone.raw = bytes.Clone(r.raw)
	clone.ResponseModalities = append([]string(nil), r.ResponseModalities...)
	return &clone
}

func (r *GeminiInteractionRequest) GetTokenCountMeta() *types.TokenCountMeta {
	if r == nil {
		return &types.TokenCountMeta{}
	}
	meta := &types.TokenCountMeta{CombineText: string(r.Input)}
	if len(r.GenerationConfig) > 0 {
		var config struct {
			MaxOutputTokens *int `json:"max_output_tokens"`
		}
		if kitutil.Unmarshal(r.GenerationConfig, &config) == nil && config.MaxOutputTokens != nil && *config.MaxOutputTokens > 0 {
			meta.MaxTokens = *config.MaxOutputTokens
		}
	}
	return meta
}

func (r *GeminiInteractionRequest) IsStream(_ *http.Request) bool {
	return r != nil && r.Stream != nil && *r.Stream
}

func (r *GeminiInteractionRequest) SetModelName(modelName string) {
	if r == nil || modelName == "" {
		return
	}
	if r.Model != "" || r.Agent == "" {
		r.Model = modelName
	} else {
		r.Agent = modelName
	}
	r.modelDirty = true
}

func (r *GeminiInteractionRequest) SetSystemInstruction(systemInstruction string) {
	if r == nil {
		return
	}
	r.SystemInstruction = strings.TrimSpace(systemInstruction)
	r.systemInstructionDirty = true
}

func (r *GeminiInteractionRequest) HasInput() bool {
	if r == nil {
		return false
	}
	trimmed := bytes.TrimSpace(r.Input)
	return len(trimmed) > 0 && !bytes.Equal(trimmed, []byte("null"))
}
