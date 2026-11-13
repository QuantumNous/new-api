package dto

import (
	"net/http"
	"strings"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
)

type EmbeddingOptions struct {
	Seed             int      `json:"seed,omitempty"`
	Temperature      *float64 `json:"temperature,omitempty"`
	TopK             int      `json:"top_k,omitempty"`
	TopP             *float64 `json:"top_p,omitempty"`
	FrequencyPenalty *float64 `json:"frequency_penalty,omitempty"`
	PresencePenalty  *float64 `json:"presence_penalty,omitempty"`
	NumPredict       int      `json:"num_predict,omitempty"`
	NumCtx           int      `json:"num_ctx,omitempty"`
}

type EmbeddingRequest struct {
	Model          string `json:"model"`
	Input          any    `json:"input"`
	EncodingFormat string `json:"encoding_format,omitempty"`
	Dimensions     *int   `json:"dimensions,omitempty"`
	// InputType is read from client JSON but never marshaled, so adaptors that
	// forward the request unchanged do not send it to upstreams that reject it.
	InputType        *string  `json:"-"`
	User             string   `json:"user,omitempty"`
	Seed             *float64 `json:"seed,omitempty"`
	Temperature      *float64 `json:"temperature,omitempty"`
	TopP             *float64 `json:"top_p,omitempty"`
	FrequencyPenalty *float64 `json:"frequency_penalty,omitempty"`
	PresencePenalty  *float64 `json:"presence_penalty,omitempty"`
}

// UnmarshalJSON reads input_type, which has no JSON tag on the struct.
func (r *EmbeddingRequest) UnmarshalJSON(data []byte) error {
	type plain EmbeddingRequest
	aux := struct {
		*plain
		InputType *string `json:"input_type"`
	}{plain: (*plain)(r)}
	if err := kitutil.Unmarshal(data, &aux); err != nil {
		return err
	}
	r.InputType = aux.InputType
	return nil
}

func (r *EmbeddingRequest) GetTokenCountMeta() *types.TokenCountMeta {
	texts := r.ParseInput()
	var files []*types.FileMeta
	// Chat-style parts count like chat message content: text parts as text,
	// image and video parts as files. A {"content": [...]} object groups the
	// parts of one input, and a single part object is one input.
	var items []any
	switch input := r.Input.(type) {
	case []any:
		items = input
	case map[string]any:
		items = []any{input}
	}
	for _, item := range items {
		fields, ok := item.(map[string]any)
		if !ok {
			continue
		}
		parts, grouped := fields["content"].([]any)
		if !grouped {
			parts = []any{fields}
		}
		for _, part := range parts {
			switch value := part.(type) {
			case string:
				if grouped {
					texts = append(texts, value)
				}
			case map[string]any:
				partType, _ := value["type"].(string)
				fileType := types.FileTypeImage
				switch partType {
				case ContentTypeText:
					text, _ := value[ContentTypeText].(string)
					texts = append(texts, text)
					continue
				case ContentTypeImageURL, "image_base64":
				case ContentTypeVideoUrl, "video_base64":
					fileType = types.FileTypeVideo
				default:
					continue
				}
				// The media is a string or an object with a url.
				var data, detail string
				switch media := value[partType].(type) {
				case string:
					data = media
				case map[string]any:
					data, _ = media["url"].(string)
					detail, _ = media["detail"].(string)
				}
				if data != "" {
					files = append(files, &types.FileMeta{FileType: fileType, Source: types.NewFileSourceFromData(data, ""), Detail: detail})
				}
			}
		}
	}

	return &types.TokenCountMeta{
		CombineText: strings.Join(texts, "\n"),
		Files:       files,
	}
}

func (r *EmbeddingRequest) IsStream(c *http.Request) bool {
	return false
}

func (r *EmbeddingRequest) SetModelName(modelName string) {
	if modelName != "" {
		r.Model = modelName
	}
}

func (r *EmbeddingRequest) ParseInput() []string {
	if r.Input == nil {
		return make([]string, 0)
	}
	var input []string
	switch r.Input.(type) {
	case string:
		input = []string{r.Input.(string)}
	case []any:
		input = make([]string, 0, len(r.Input.([]any)))
		for _, item := range r.Input.([]any) {
			if str, ok := item.(string); ok {
				input = append(input, str)
			}
		}
	}
	return input
}

type EmbeddingResponseItem struct {
	Object    string    `json:"object"`
	Index     int       `json:"index"`
	Embedding []float64 `json:"embedding"`
}

type EmbeddingResponse struct {
	Object string                  `json:"object"`
	Data   []EmbeddingResponseItem `json:"data"`
	Model  string                  `json:"model"`
	Usage  `json:"usage"`
}
