package dto

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// OpenAIDecisionsRequest uses the native Decisions protocol, not Responses
// structured outputs. Input retains the string/message union on the wire.
type OpenAIDecisionsRequest struct {
	Model            string             `json:"model"`
	Input            json.RawMessage    `json:"input"`
	Questions        []DecisionQuestion `json:"questions"`
	SafetyIdentifier *string            `json:"safety_identifier,omitempty"`
	Stream           *bool              `json:"stream,omitempty"`
}

type DecisionQuestion struct {
	Type         string           `json:"type"`
	Name         *string          `json:"name,omitempty"`
	Instructions *string          `json:"instructions"`
	Choices      []DecisionChoice `json:"choices,omitempty"`
	Levels       []DecisionLevel  `json:"levels,omitempty"`
}

type DecisionChoice struct {
	Value       json.RawMessage `json:"value"`
	Description *string         `json:"description,omitempty"`
}

type DecisionLevel struct {
	Label       *string `json:"label"`
	Description *string `json:"description,omitempty"`
}

func (r *OpenAIDecisionsRequest) Validate() error {
	if r.Model == "" {
		return errors.New("model is required")
	}
	if r.Stream != nil && *r.Stream {
		return errors.New("Decisions does not support streaming")
	}
	if r.SafetyIdentifier != nil && utf8.RuneCountInString(*r.SafetyIdentifier) > 128 {
		return errors.New("safety_identifier must not exceed 128 characters")
	}
	if err := validateDecisionInput(r.Input); err != nil {
		return err
	}
	if len(r.Questions) == 0 {
		return errors.New("questions is required")
	}
	for i, q := range r.Questions {
		if q.Instructions == nil {
			return fmt.Errorf("questions[%d].instructions is required", i)
		}
		switch q.Type {
		case "predicate":
			if len(q.Choices) > 0 || len(q.Levels) > 0 {
				return errors.New("predicate questions cannot contain choices or levels")
			}
		case "choice":
			if len(q.Choices) < 2 || len(q.Choices) > 255 || len(q.Levels) > 0 {
				return errors.New("choice questions require 2 to 255 choices and no levels")
			}
			seen := make(map[any]bool, len(q.Choices))
			for _, choice := range q.Choices {
				var value any
				if err := kitutil.Unmarshal(choice.Value, &value); err != nil {
					return errors.New("choice.value must be a string or boolean")
				}
				switch value.(type) {
				case string, bool:
				default:
					return errors.New("choice.value must be a string or boolean")
				}
				if seen[value] {
					return errors.New("choice values must be unique")
				}
				seen[value] = true
			}
		case "score":
			if len(q.Levels) == 0 || len(q.Choices) > 0 {
				return errors.New("score questions require levels and no choices")
			}
			for _, level := range q.Levels {
				if level.Label == nil {
					return errors.New("level.label is required")
				}
			}
		default:
			return fmt.Errorf("questions[%d].type must be predicate, choice, or score", i)
		}
	}
	return nil
}

func validateDecisionInput(input json.RawMessage) error {
	if kitutil.GetJsonType(input) == "string" {
		return nil
	}
	var messages []struct {
		Role    string          `json:"role"`
		Type    *string         `json:"type"`
		Content json.RawMessage `json:"content"`
	}
	if err := kitutil.Unmarshal(input, &messages); err != nil || len(messages) == 0 {
		return errors.New("input must be a string or an array of user messages")
	}
	images := 0
	for _, message := range messages {
		if message.Role != "user" || message.Type != nil && *message.Type != "message" {
			return errors.New("Decisions input only supports user messages")
		}
		if kitutil.GetJsonType(message.Content) == "string" {
			continue
		}
		var parts []struct {
			Type     string  `json:"type"`
			Text     *string `json:"text"`
			ImageURL *string `json:"image_url"`
			FileID   *string `json:"file_id"`
			Detail   *string `json:"detail"`
		}
		if err := kitutil.Unmarshal(message.Content, &parts); err != nil || parts == nil {
			return errors.New("message.content must be a string or an array of input parts")
		}
		for _, part := range parts {
			switch part.Type {
			case "input_text":
				if part.Text == nil {
					return errors.New("input_text.text is required")
				}
			case "input_image":
				images++
				if images > 128 {
					return errors.New("Decisions supports at most 128 images per request")
				}
				if part.ImageURL == nil || part.FileID != nil {
					return errors.New("input_image requires image_url; file_id is unsupported")
				}
				u, err := url.Parse(*part.ImageURL)
				if err != nil || !((u.Scheme == "http" || u.Scheme == "https") && u.Host != "" ||
					strings.HasPrefix(*part.ImageURL, "data:image/") && strings.Contains(*part.ImageURL, ";base64,")) {
					return errors.New("image_url must be an HTTP(S) URL or base64 image data URL")
				}
				if part.Detail != nil {
					switch *part.Detail {
					case "low", "high", "auto", "original":
					default:
						return errors.New("invalid image detail")
					}
				}
			default:
				return errors.New("Decisions only supports input_text and input_image parts")
			}
		}
	}
	return nil
}

func (r *OpenAIDecisionsRequest) GetTokenCountMeta() *types.TokenCountMeta {
	meta := (&OpenAIResponsesRequest{Input: r.Input}).GetTokenCountMeta()
	questions, _ := kitutil.Marshal(r.Questions)
	meta.CombineText += "\n" + string(questions)
	meta.TokenType = types.TokenTypeTokenizer
	return meta
}

func (r *OpenAIDecisionsRequest) IsStream(_ *http.Request) bool { return false }

func (r *OpenAIDecisionsRequest) SetModelName(model string) { r.Model = model }

// DecodeDecisionUsage validates billing quantities before any response is
// committed. Only documented usage fields are trusted, never internal billing
// metadata supplied by an upstream server.
func DecodeDecisionUsage(body []byte, questions []DecisionQuestion) (*Usage, string, error) {
	var response struct {
		Model   string `json:"model"`
		Answers []struct {
			Type          string            `json:"type"`
			Name          *string           `json:"name"`
			Probability   *float64          `json:"probability"`
			Choice        json.RawMessage   `json:"choice"`
			Score         *float64          `json:"score"`
			Confidence    *float64          `json:"confidence"`
			Probabilities []json.RawMessage `json:"probabilities"`
		} `json:"answers"`
		Usage *struct {
			Input        *int64 `json:"input_tokens"`
			Output       *int64 `json:"output_tokens"`
			Total        *int64 `json:"total_tokens"`
			InputDetails struct {
				Cached int64 `json:"cached_tokens"`
				Write  int64 `json:"cache_write_tokens"`
			} `json:"input_tokens_details"`
			OutputDetails struct {
				Reasoning int64 `json:"reasoning_tokens"`
			} `json:"output_tokens_details"`
		} `json:"usage"`
	}
	if err := kitutil.Unmarshal(body, &response); err != nil {
		return nil, "", errors.New("invalid Decisions response JSON")
	}
	if response.Model == "" || len(response.Answers) != len(questions) {
		return nil, "", errors.New("invalid Decisions response envelope")
	}
	for i, answer := range response.Answers {
		question := questions[i]
		if (answer.Name == nil) != (question.Name == nil) || answer.Name != nil && *answer.Name != *question.Name {
			return nil, "", errors.New("Decisions answer name does not match the question")
		}
		if answer.Type != "refusal" && answer.Type != questions[i].Type {
			return nil, "", errors.New("invalid Decisions answer type")
		}
		switch answer.Type {
		case "predicate":
			if answer.Probability == nil || *answer.Probability < 0 || *answer.Probability > 1 {
				return nil, "", errors.New("invalid Decisions predicate probability")
			}
		case "choice":
			valueType := kitutil.GetJsonType(answer.Choice)
			if (valueType != "string" && valueType != "boolean") || answer.Confidence == nil || len(answer.Probabilities) != len(question.Choices) {
				return nil, "", errors.New("invalid Decisions choice answer")
			}
		case "score":
			if answer.Score == nil || answer.Confidence == nil || len(answer.Probabilities) != len(question.Levels) {
				return nil, "", errors.New("invalid Decisions score answer")
			}
		}
	}
	u := response.Usage
	if u == nil || u.Input == nil || u.Output == nil || u.Total == nil {
		return nil, "", errors.New("missing Decisions usage")
	}
	for _, n := range []int64{*u.Input, *u.Output, *u.Total, u.InputDetails.Cached, u.InputDetails.Write, u.OutputDetails.Reasoning} {
		if n < 0 || n > math.MaxInt32 {
			return nil, "", errors.New("invalid Decisions token count")
		}
	}
	if *u.Total != *u.Input+*u.Output || u.InputDetails.Cached > *u.Input || u.InputDetails.Write > *u.Input || u.OutputDetails.Reasoning > *u.Output {
		return nil, "", errors.New("inconsistent Decisions usage")
	}
	return &Usage{
		PromptTokens: int(*u.Input), CompletionTokens: int(*u.Output), TotalTokens: int(*u.Total),
		PromptTokensDetails:    InputTokenDetails{CachedTokens: int(u.InputDetails.Cached), CacheWriteTokens: int(u.InputDetails.Write)},
		CompletionTokenDetails: OutputTokenDetails{ReasoningTokens: int(u.OutputDetails.Reasoning)},
	}, response.Model, nil
}
