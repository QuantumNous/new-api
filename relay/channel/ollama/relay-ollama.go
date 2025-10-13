package ollama

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
	relaycommon "one-api/relay/common"
	"one-api/service"
	"one-api/types"
	"strings"

	"github.com/gin-gonic/gin"
)

func openAIChatToOllamaChat(c *gin.Context, r *dto.GeneralOpenAIRequest) (*OllamaChatRequest, error) {
	chatReq := &OllamaChatRequest{
		Model:   r.Model,
		Stream:  r.Stream,
		Options: map[string]any{},
		Think:   r.Think,
	}
	if r.ResponseFormat != nil {
		if r.ResponseFormat.Type == "json" {
			chatReq.Format = "json"
		} else if r.ResponseFormat.Type == "json_schema" {
			if len(r.ResponseFormat.JsonSchema) > 0 {
				var schema any
				_ = json.Unmarshal(r.ResponseFormat.JsonSchema, &schema)
				chatReq.Format = schema
			}
		}
	}

	// options mapping
	if r.Temperature != nil {
		chatReq.Options["temperature"] = r.Temperature
	}
	if r.TopP != 0 {
		chatReq.Options["top_p"] = r.TopP
	}
	if r.TopK != 0 {
		chatReq.Options["top_k"] = r.TopK
	}
	if r.FrequencyPenalty != 0 {
		chatReq.Options["frequency_penalty"] = r.FrequencyPenalty
	}
	if r.PresencePenalty != 0 {
		chatReq.Options["presence_penalty"] = r.PresencePenalty
	}
	if r.Seed != 0 {
		chatReq.Options["seed"] = int(r.Seed)
	}
	if mt := r.GetMaxTokens(); mt != 0 {
		chatReq.Options["num_predict"] = int(mt)
	}

	if r.Stop != nil {
		switch v := r.Stop.(type) {
		case string:
			chatReq.Options["stop"] = []string{v}
		case []string:
			chatReq.Options["stop"] = v
		case []any:
			arr := make([]string, 0, len(v))
			for _, i := range v {
				if s, ok := i.(string); ok {
					arr = append(arr, s)
				}
			}
			if len(arr) > 0 {
				chatReq.Options["stop"] = arr
			}
		}
	}

	if len(r.Tools) > 0 {
		tools := make([]OllamaTool, 0, len(r.Tools))
		for _, t := range r.Tools {
			tools = append(tools, OllamaTool{Type: "function", Function: OllamaToolFunction{Name: t.Function.Name, Description: t.Function.Description, Parameters: t.Function.Parameters}})
		}
		chatReq.Tools = tools
	}

	chatReq.Messages = make([]OllamaChatMessage, 0, len(r.Messages))
	for _, m := range r.Messages {
		var textBuilder strings.Builder
		var images []string
		if m.IsStringContent() {
			textBuilder.WriteString(m.StringContent())
		} else {
			parts := m.ParseContent()
			for _, part := range parts {
				if part.Type == dto.ContentTypeImageURL {
					img := part.GetImageMedia()
					if img != nil && img.Url != "" {
						var base64Data string
						if strings.HasPrefix(img.Url, "http") {
							fileData, err := service.GetFileBase64FromUrl(c, img.Url, "fetch image for ollama chat")
							if err != nil {
								return nil, err
							}
							base64Data = fileData.Base64Data
						} else if strings.HasPrefix(img.Url, "data:") {
							if idx := strings.Index(img.Url, ","); idx != -1 && idx+1 < len(img.Url) {
								base64Data = img.Url[idx+1:]
							}
						} else {
							base64Data = img.Url
						}
						if base64Data != "" {
							images = append(images, base64Data)
						}
					}
				} else if part.Type == dto.ContentTypeText {
					textBuilder.WriteString(part.Text)
				}
			}
		}
		cm := OllamaChatMessage{Role: m.Role, Content: textBuilder.String()}
		if len(images) > 0 {
			cm.Images = images
		}
		if m.Role == "tool" && m.Name != nil {
			cm.ToolName = *m.Name
		}
		if m.ToolCalls != nil && len(m.ToolCalls) > 0 {
			parsed := m.ParseToolCalls()
			if len(parsed) > 0 {
				calls := make([]OllamaToolCall, 0, len(parsed))
				for _, tc := range parsed {
					var args interface{}
					if tc.Function.Arguments != "" {
						_ = json.Unmarshal([]byte(tc.Function.Arguments), &args)
					}
					if args == nil {
						args = map[string]any{}
					}
					oc := OllamaToolCall{}
					oc.Function.Name = tc.Function.Name
					oc.Function.Arguments = args
					calls = append(calls, oc)
				}
				cm.ToolCalls = calls
			}
		}
		chatReq.Messages = append(chatReq.Messages, cm)
	}
	return chatReq, nil
}

// openAIToGenerate converts OpenAI completions request to Ollama generate
func openAIToGenerate(c *gin.Context, r *dto.GeneralOpenAIRequest) (*OllamaGenerateRequest, error) {
	gen := &OllamaGenerateRequest{
		Model:   r.Model,
		Stream:  r.Stream,
		Options: map[string]any{},
		Think:   r.Think,
	}
	// Prompt may be in r.Prompt (string or []any)
	if r.Prompt != nil {
		switch v := r.Prompt.(type) {
		case string:
			gen.Prompt = v
		case []any:
			var sb strings.Builder
			for _, it := range v {
				if s, ok := it.(string); ok {
					sb.WriteString(s)
				}
			}
			gen.Prompt = sb.String()
		default:
			gen.Prompt = fmt.Sprintf("%v", r.Prompt)
		}
	}
	if r.Suffix != nil {
		if s, ok := r.Suffix.(string); ok {
			gen.Suffix = s
		}
	}
	if r.ResponseFormat != nil {
		if r.ResponseFormat.Type == "json" {
			gen.Format = "json"
		} else if r.ResponseFormat.Type == "json_schema" {
			var schema any
			_ = json.Unmarshal(r.ResponseFormat.JsonSchema, &schema)
			gen.Format = schema
		}
	}
	if r.Temperature != nil {
		gen.Options["temperature"] = r.Temperature
	}
	if r.TopP != 0 {
		gen.Options["top_p"] = r.TopP
	}
	if r.TopK != 0 {
		gen.Options["top_k"] = r.TopK
	}
	if r.FrequencyPenalty != 0 {
		gen.Options["frequency_penalty"] = r.FrequencyPenalty
	}
	if r.PresencePenalty != 0 {
		gen.Options["presence_penalty"] = r.PresencePenalty
	}
	if r.Seed != 0 {
		gen.Options["seed"] = int(r.Seed)
	}
	if mt := r.GetMaxTokens(); mt != 0 {
		gen.Options["num_predict"] = int(mt)
	}
	if r.Stop != nil {
		switch v := r.Stop.(type) {
		case string:
			gen.Options["stop"] = []string{v}
		case []string:
			gen.Options["stop"] = v
		case []any:
			arr := make([]string, 0, len(v))
			for _, i := range v {
				if s, ok := i.(string); ok {
					arr = append(arr, s)
				}
			}
			if len(arr) > 0 {
				gen.Options["stop"] = arr
			}
		}
	}
	return gen, nil
}

func requestOpenAI2Embeddings(r dto.EmbeddingRequest) *OllamaEmbeddingRequest {
	opts := map[string]any{}
	if r.Temperature != nil {
		opts["temperature"] = r.Temperature
	}
	if r.TopP != 0 {
		opts["top_p"] = r.TopP
	}
	if r.FrequencyPenalty != 0 {
		opts["frequency_penalty"] = r.FrequencyPenalty
	}
	if r.PresencePenalty != 0 {
		opts["presence_penalty"] = r.PresencePenalty
	}
	if r.Seed != 0 {
		opts["seed"] = int(r.Seed)
	}
	if r.Dimensions != 0 {
		opts["dimensions"] = r.Dimensions
	}
	input := r.ParseInput()
	if len(input) == 1 {
		return &OllamaEmbeddingRequest{Model: r.Model, Input: input[0], Options: opts, Dimensions: r.Dimensions}
	}
	return &OllamaEmbeddingRequest{Model: r.Model, Input: input, Options: opts, Dimensions: r.Dimensions}
}

func ollamaEmbeddingHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	var oResp OllamaEmbeddingResponse
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)
	if err = common.Unmarshal(body, &oResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if oResp.Error != "" {
		return nil, types.NewOpenAIError(fmt.Errorf("ollama error: %s", oResp.Error), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	data := make([]dto.OpenAIEmbeddingResponseItem, 0, len(oResp.Embeddings))
	for i, emb := range oResp.Embeddings {
		data = append(data, dto.OpenAIEmbeddingResponseItem{Index: i, Object: "embedding", Embedding: emb})
	}
	usage := &dto.Usage{PromptTokens: oResp.PromptEvalCount, CompletionTokens: 0, TotalTokens: oResp.PromptEvalCount}
	embResp := &dto.OpenAIEmbeddingResponse{Object: "list", Data: data, Model: info.UpstreamModelName, Usage: *usage}
	out, _ := common.Marshal(embResp)
	service.IOCopyBytesGracefully(c, resp, out)
	return usage, nil
}
