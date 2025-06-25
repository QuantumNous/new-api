package dto

import (
	"encoding/json"
	"fmt"
	"strings"

	"one-api/common"
)

type ResponseFormat struct {
	Type       string            `json:"type,omitempty"`
	JsonSchema *FormatJsonSchema `json:"json_schema,omitempty"`
}

type FormatJsonSchema struct {
	Description string `json:"description,omitempty"`
	Name        string `json:"name"`
	Schema      any    `json:"schema,omitempty"`
	Strict      any    `json:"strict,omitempty"`
}

type GeneralOpenAIRequest struct {
	Model               string            `json:"model,omitempty"`
	Messages            []Message         `json:"messages,omitempty"`
	Prompt              any               `json:"prompt,omitempty"`
	Prefix              any               `json:"prefix,omitempty"`
	Suffix              any               `json:"suffix,omitempty"`
	Stream              bool              `json:"stream,omitempty"`
	StreamOptions       *StreamOptions    `json:"stream_options,omitempty"`
	MaxTokens           uint              `json:"max_tokens,omitempty"`
	MaxCompletionTokens uint              `json:"max_completion_tokens,omitempty"`
	ReasoningEffort     string            `json:"reasoning_effort,omitempty"`
	Temperature         *float64          `json:"temperature,omitempty"`
	TopP                float64           `json:"top_p,omitempty"`
	TopK                int               `json:"top_k,omitempty"`
	Stop                any               `json:"stop,omitempty"`
	N                   int               `json:"n,omitempty"`
	Input               any               `json:"input,omitempty"`
	Instruction         string            `json:"instruction,omitempty"`
	Size                string            `json:"size,omitempty"`
	Functions           any               `json:"functions,omitempty"`
	FrequencyPenalty    float64           `json:"frequency_penalty,omitempty"`
	PresencePenalty     float64           `json:"presence_penalty,omitempty"`
	ResponseFormat      *ResponseFormat   `json:"response_format,omitempty"`
	EncodingFormat      any               `json:"encoding_format,omitempty"`
	Seed                float64           `json:"seed,omitempty"`
	LogitBias           map[string]int    `json:"logit_bias,omitempty"`
	Tools               []ToolCallRequest `json:"tools,omitempty"`
	ToolChoice          any               `json:"tool_choice,omitempty"`
	User                string            `json:"user,omitempty"`
	LogProbs            bool              `json:"logprobs,omitempty"`
	TopLogProbs         int               `json:"top_logprobs,omitempty"`
	Dimensions          int               `json:"dimensions,omitempty"`
	Modalities          any               `json:"modalities,omitempty"`
	Audio               any               `json:"audio,omitempty"`
	ExtraBody           any               `json:"extra_body,omitempty"`
	Thinking            *ThinkingOptions  `json:"thinking,omitempty"`
	ThinkingConfig      *ThinkingConfigs  `json:"thinking_config,omitempty"`
}

type ThinkingConfigs struct {
	Enable bool `json:"enable,omitempty"`
}

type ThinkingOptions struct {
	Type         string `json:"type"`
	BudgetTokens int    `json:"budget_tokens"`
}

type ToolCallRequest struct {
	ID       string          `json:"id,omitempty"`
	Type     string          `json:"type"`
	Function FunctionRequest `json:"function"`
}

type FunctionRequest struct {
	Description string `json:"description,omitempty"`
	Name        string `json:"name"`
	Parameters  any    `json:"parameters,omitempty"`
	Arguments   string `json:"arguments,omitempty"`
}

type StreamOptions struct {
	IncludeUsage bool `json:"include_usage,omitempty"`
}

func (r GeneralOpenAIRequest) GetMaxTokens() int {
	return int(r.MaxTokens)
}

func (r GeneralOpenAIRequest) ParseInput() []string {
	if r.Input == nil {
		return nil
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

type Message struct {
	Role                string          `json:"role"`
	Content             json.RawMessage `json:"content"`
	Name                *string         `json:"name,omitempty"`
	Prefix              *bool           `json:"prefix,omitempty"`
	ReasoningContent    string          `json:"reasoning_content,omitempty"`
	Reasoning           string          `json:"reasoning,omitempty"`
	ToolCalls           json.RawMessage `json:"tool_calls,omitempty"`
	ToolCallId          string          `json:"tool_call_id,omitempty"`
	parsedContent       []MediaContent
	parsedStringContent *string
}

type MediaContent struct {
	Type       string `json:"type"`
	Text       string `json:"text,omitempty"`
	ImageUrl   any    `json:"image_url,omitempty"`
	InputAudio any    `json:"input_audio,omitempty"`
}

type MessageImageUrl struct {
	Url    string `json:"url"`
	Detail string `json:"detail"`
	Format string `json:"format,omitempty"`
}

type MessageInputAudio struct {
	Data   string  `json:"data"` //base64
	Format string  `json:"format"`
	Fps    float64 `json:"fps,omitempty"`
	Url    string  `json:"url,omitempty"`
}

const (
	ContentTypeText       = "text"
	ContentTypeImageURL   = "image_url"
	ContentTypeInputAudio = "input_audio"
	ContentTypeVideoURL   = "video_url"
	ContentTypeYoutube    = "youtube"
)

func (m *Message) GetPrefix() bool {
	if m.Prefix == nil {
		return false
	}
	return *m.Prefix
}

func (m *Message) SetPrefix(prefix bool) {
	m.Prefix = &prefix
}

func (m *Message) ParseToolCalls() []ToolCallRequest {
	if m.ToolCalls == nil {
		return nil
	}
	var toolCalls []ToolCallRequest
	if err := json.Unmarshal(m.ToolCalls, &toolCalls); err == nil {
		return toolCalls
	}
	return toolCalls
}

func (m *Message) SetToolCalls(toolCalls any) {
	toolCallsJson, _ := json.Marshal(toolCalls)
	m.ToolCalls = toolCallsJson
}

func (m *Message) StringContent() string {
	if m.parsedStringContent != nil {
		return *m.parsedStringContent
	}

	var stringContent string
	if err := json.Unmarshal(m.Content, &stringContent); err == nil {
		m.parsedStringContent = &stringContent
		return stringContent
	}

	contentStr := new(strings.Builder)
	arrayContent := m.ParseContent()
	for _, content := range arrayContent {
		if content.Type == ContentTypeText {
			contentStr.WriteString(content.Text)
		}
	}
	stringContent = contentStr.String()
	m.parsedStringContent = &stringContent

	return stringContent
}

func (m *Message) SetStringContent(content string) {
	jsonContent, _ := json.Marshal(content)
	m.Content = jsonContent
	m.parsedStringContent = &content
	m.parsedContent = nil
}

func (m *Message) SetMediaContent(content []MediaContent) {
	jsonContent, _ := json.Marshal(content)
	m.Content = jsonContent
	m.parsedContent = nil
	m.parsedStringContent = nil
}

func (m *Message) IsStringContent() bool {
	if m.parsedStringContent != nil {
		return true
	}
	var stringContent string
	if err := json.Unmarshal(m.Content, &stringContent); err == nil {
		m.parsedStringContent = &stringContent
		return true
	}
	return false
}

func (m *Message) ParseContent() []MediaContent {
	if m.parsedContent != nil {
		return m.parsedContent
	}

	var contentList []MediaContent

	// 先尝试解析为字符串
	var stringContent string
	if err := json.Unmarshal(m.Content, &stringContent); err == nil {
		contentList = []MediaContent{{
			Type: ContentTypeText,
			Text: stringContent,
		}}
		m.parsedContent = contentList
		return contentList
	}

	// 尝试解析为数组
	var arrayContent []map[string]interface{}
	if err := json.Unmarshal(m.Content, &arrayContent); err == nil {
		for _, contentItem := range arrayContent {
			contentType, ok := contentItem["type"].(string)
			if !ok {
				continue
			}

			switch contentType {
			case ContentTypeText:
				if text, ok := contentItem["text"].(string); ok {
					contentList = append(contentList, MediaContent{
						Type: ContentTypeText,
						Text: text,
					})
				}

			case ContentTypeImageURL:
				imageUrl := contentItem["image_url"]
				switch v := imageUrl.(type) {
				case string:
					contentList = append(contentList, MediaContent{
						Type: ContentTypeImageURL,
						ImageUrl: MessageImageUrl{
							Url:    v,
							Detail: "high",
							Format: "url",
						},
					})
				case map[string]interface{}:
					url, ok1 := v["url"].(string)
					detail, ok2 := v["detail"].(string)
					format, ok3 := v["format"].(string)
					if !ok2 {
						detail = "high"
					}
					if !ok3 {
						format = "url"
					}
					if ok1 {
						contentList = append(contentList, MediaContent{
							Type: ContentTypeImageURL,
							ImageUrl: MessageImageUrl{
								Url:    url,
								Detail: detail,
								Format: format,
							},
						})
					}
				}

			case ContentTypeInputAudio:
				if audioData, ok := contentItem["input_audio"].(map[string]interface{}); ok {
					data, ok1 := audioData["data"].(string)
					format, ok2 := audioData["format"].(string)
					url, ok3 := audioData["url"].(string)
					fps, ok3 := audioData["fps"].(float64)
					if !ok2 {
						if mimeType, ok3 := audioData["mime_type"].(string); ok3 {
							format = mimeType
							ok2 = true
						}
					}
					if !ok3 {
						fps = 0
					}
					common.SysLog(fmt.Sprintf("Parsing audio content: data_ok=%v, format_ok=%v, format=%s, data_length=%d", ok1, ok2, format, len(data)))
					if ok1 && ok2 {
						contentList = append(contentList, MediaContent{
							Type: ContentTypeInputAudio,
							InputAudio: MessageInputAudio{
								Data:   data,
								Format: format,
								Fps:    fps,
								Url:    url,
							},
						})
					}
				}
			case ContentTypeVideoURL:
				if videoData, ok := contentItem["video_url"].(map[string]interface{}); ok {
					url, ok1 := videoData["url"].(string)
					format, ok2 := videoData["format"].(string)
					fps, ok3 := videoData["fps"].(float64)
					if !ok2 {
						format = "url"
					}
					if !ok3 {
						fps = 0
					}
					common.SysLog(fmt.Sprintf("Parsing video content: url_ok=%v, format_ok=%v, format=%s, url=%s", ok1, ok2, format, url))
					if ok1 {
						contentList = append(contentList, MediaContent{
							Type: ContentTypeVideoURL,
							InputAudio: MessageInputAudio{
								Url:    url,
								Format: format,
								Fps:    fps,
							},
						})
					}
				}
			case ContentTypeYoutube:
				mimetype, ok1 := contentItem["mimetype"].(string)
				url, ok2 := contentItem["url"].(string)
				if ok1 && ok2 {
					contentList = append(contentList, MediaContent{
						Type: ContentTypeYoutube,
						Text: mimetype,
						ImageUrl: MessageImageUrl{
							Url:    url,
							Detail: "high",
						},
					})
				}
			}
		}
	}

	if len(contentList) > 0 {
		m.parsedContent = contentList
	}
	return contentList
}
