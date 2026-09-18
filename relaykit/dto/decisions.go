package dto

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// DecisionsRequest is the native decisions protocol used by TypeSafe. State is shared
// across questions; it must not be expanded into one chat request per question.
type DecisionsRequest struct {
	Model     string                       `json:"model"`
	State     json.RawMessage              `json:"state"`
	Questions map[string]DecisionsQuestion `json:"questions"`
	Stream    *bool                        `json:"stream,omitempty"`
}

type DecisionsQuestion struct {
	Type         string          `json:"type"`
	Instructions json.RawMessage `json:"instructions"`
	Criteria     json.RawMessage `json:"criteria,omitempty"`
}

func (r *DecisionsRequest) IsStream(*http.Request) bool { return false }

func (r *DecisionsRequest) SetModelName(model string) { r.Model = model }

func (r *DecisionsRequest) GetTokenCountMeta() *types.TokenCountMeta {
	questions, _ := kitutil.Marshal(r.Questions)
	return &types.TokenCountMeta{
		TokenType:   types.TokenTypeTokenizer,
		CombineText: string(r.State) + "\n" + string(questions),
	}
}

func (r *DecisionsRequest) Validate() error {
	if r == nil || strings.TrimSpace(r.Model) == "" {
		return errors.New("model is required")
	}
	if r.Stream != nil && *r.Stream {
		return errors.New("decisions do not support streaming")
	}
	switch kitutil.GetJsonType(r.State) {
	case "string", "object", "array":
	default:
		return errors.New("state must be a string, object or array")
	}
	if len(r.Questions) == 0 {
		return errors.New("questions must not be empty")
	}
	for _, q := range r.Questions {
		switch kitutil.GetJsonType(q.Instructions) {
		case "string", "object", "array":
		default:
			return errors.New("question instructions must be a string, object or array")
		}
		switch q.Type {
		case "noul":
			if len(q.Criteria) == 0 {
				continue
			}
			var criteria map[string]*string
			if kitutil.Unmarshal(q.Criteria, &criteria) != nil || criteria == nil {
				return errors.New("noul criteria must be an object of descriptions")
			}
			for key, description := range criteria {
				if description == nil {
					return errors.New("noul criteria descriptions must be strings")
				}
				if key != "true" && key != "false" {
					return errors.New("noul criteria keys must be true or false")
				}
			}
		case "choice":
			var criteria map[string]*string
			if kitutil.Unmarshal(q.Criteria, &criteria) != nil || len(criteria) == 0 {
				return errors.New("choice criteria must be a nonempty object of string or null descriptions")
			}
		case "score":
			var criteria []*string
			if kitutil.Unmarshal(q.Criteria, &criteria) != nil || len(criteria) < 2 {
				return errors.New("score criteria must contain at least two string levels")
			}
			for _, level := range criteria {
				if level == nil {
					return errors.New("score criteria levels must be strings")
				}
			}
		default:
			return errors.New("unsupported question type; expected noul, choice or score")
		}
	}
	return nil
}

type DecisionsResponse struct {
	Model   string                     `json:"model"`
	Answers map[string]json.RawMessage `json:"answers"`
	Usage   *DecisionsUsage            `json:"usage"`
}

type DecisionsUsage struct {
	InputTokens  *int64 `json:"input_tokens"`
	OutputTokens *int64 `json:"output_tokens"`
}
