package dto

import (
	"encoding/json"
	"one-api/common"
	"strings"
)

type ResponseFormat struct {
	Type       string          `json:"type,omitempty"`
	JsonSchema json.RawMessage `json:"json_schema,omitempty"`
}

type FormatJsonSchema struct {
	Description string          `json:"description,omitempty"`
	Name        string          `json:"name"`
	Schema      any             `json:"schema,omitempty"`
	Strict      json.RawMessage `json:"strict,omitempty"`
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
	Verbosity           json.RawMessage   `json:"verbosity,omitempty"` // gpt-5
	Temperature         *float64          `json:"temperature,omitempty"`
	TopP                float64           `json:"top_p,omitempty"`
	TopK                int               `json:"top_k,omitempty"`
	Stop                any               `json:"stop,omitempty"`
	N                   int               `json:"n,omitempty"`
	Input               any               `json:"input,omitempty"`
	Instruction         string            `json:"instruction,omitempty"`
	Size                string            `json:"size,omitempty"`
	Functions           json.RawMessage   `json:"functions,omitempty"`
	FrequencyPenalty    float64           `json:"frequency_penalty,omitempty"`
	PresencePenalty     float64           `json:"presence_penalty,omitempty"`
	ResponseFormat      *ResponseFormat   `json:"response_format,omitempty"`
	EncodingFormat      json.RawMessage   `json:"encoding_format,omitempty"`
	Seed                float64           `json:"seed,omitempty"`
	ParallelTooCalls    *bool             `json:"parallel_tool_calls,omitempty"`
	Tools               []ToolCallRequest `json:"tools,omitempty"`
	ToolChoice          any               `json:"tool_choice,omitempty"`
	User                string            `json:"user,omitempty"`
	LogProbs            bool              `json:"logprobs,omitempty"`
	TopLogProbs         int               `json:"top_logprobs,omitempty"`
	Dimensions          int               `json:"dimensions,omitempty"`
	Modalities          json.RawMessage   `json:"modalities,omitempty"`
	Audio               json.RawMessage   `json:"audio,omitempty"`
	EnableThinking      any               `json:"enable_thinking,omitempty"` // ali
	THINKING            json.RawMessage   `json:"thinking,omitempty"`        // doubao,zhipu_v4
	ExtraBody           json.RawMessage   `json:"extra_body,omitempty"`
	SearchParameters    any               `json:"search_parameters,omitempty"` //xai
	WebSearchOptions    *WebSearchOptions `json:"web_search_options,omitempty"`
	// OpenRouter Params
	Usage     json.RawMessage `json:"usage,omitempty"`
	Reasoning json.RawMessage `json:"reasoning,omitempty"`
	// Ali Qwen Params
	VlHighResolutionImages json.RawMessage `json:"vl_high_resolution_images,omitempty"`
	// 用匿名参数接收额外参数，例如ollama的think参数在此接收
	Extra map[string]json.RawMessage `json:"-"`
}

func (r *GeneralOpenAIRequest) ToMap() map[string]any {
	result := make(map[string]any)
	data, _ := common.Marshal(r)
	_ = common.Unmarshal(data, &result)
	return result
}

func (r *GeneralOpenAIRequest) GetSystemRoleName() string {
	if strings.HasPrefix(r.Model, "o") {
		if !strings.HasPrefix(r.Model, "o1-mini") && !strings.HasPrefix(r.Model, "o1-preview") {
			return "developer"
		}
	} else if strings.HasPrefix(r.Model, "gpt-5") {
		return "developer"
	}
	return "system"
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

func (r *GeneralOpenAIRequest) GetMaxTokens() uint {
	if r.MaxCompletionTokens != 0 {
		return r.MaxCompletionTokens
	}
	return r.MaxTokens
}

func (r *GeneralOpenAIRequest) ParseInput() []string {
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
	Role             string          `json:"role"`
	Content          any             `json:"content"`
	Name             *string         `json:"name,omitempty"`
	Prefix           *bool           `json:"prefix,omitempty"`
	ReasoningContent string          `json:"reasoning_content,omitempty"`
	Reasoning        string          `json:"reasoning,omitempty"`
	ToolCalls        json.RawMessage `json:"tool_calls,omitempty"`
	ToolCallId       string          `json:"tool_call_id,omitempty"`
	parsedContent    []MediaContent
	//parsedStringContent *string
}

type MediaContent struct {
	Type       string `json:"type"`
	Text       string `json:"text,omitempty"`
	ImageUrl   any    `json:"image_url,omitempty"`
	InputAudio any    `json:"input_audio,omitempty"`
	File       any    `json:"file,omitempty"`
	VideoUrl   any    `json:"video_url,omitempty"`
	// OpenRouter Params
	CacheControl json.RawMessage `json:"cache_control,omitempty"`
}

func (m *MediaContent) GetImageMedia() *MessageImageUrl {
	if m.ImageUrl != nil {
		if _, ok := m.ImageUrl.(*MessageImageUrl); ok {
			return m.ImageUrl.(*MessageImageUrl)
		}
		if itemMap, ok := m.ImageUrl.(map[string]any); ok {
			out := &MessageImageUrl{
				Url:      common.Interface2String(itemMap["url"]),
				Detail:   common.Interface2String(itemMap["detail"]),
				MimeType: common.Interface2String(itemMap["mime_type"]),
			}
			return out
		}
	}
	return nil
}

func (m *MediaContent) GetInputAudio() *MessageInputAudio {
	if m.InputAudio != nil {
		if _, ok := m.InputAudio.(*MessageInputAudio); ok {
			return m.InputAudio.(*MessageInputAudio)
		}
		if itemMap, ok := m.InputAudio.(map[string]any); ok {
			out := &MessageInputAudio{
				Data:   common.Interface2String(itemMap["data"]),
				Format: common.Interface2String(itemMap["format"]),
			}
			return out
		}
	}
	return nil
}

func (m *MediaContent) GetFile() *MessageFile {
	if m.File != nil {
		if _, ok := m.File.(*MessageFile); ok {
			return m.File.(*MessageFile)
		}
		if itemMap, ok := m.File.(map[string]any); ok {
			out := &MessageFile{
				FileName: common.Interface2String(itemMap["file_name"]),
				FileData: common.Interface2String(itemMap["file_data"]),
				FileId:   common.Interface2String(itemMap["file_id"]),
			}
			return out
		}
	}
	return nil
}

type MessageImageUrl struct {
	Url      string `json:"url"`
	Detail   string `json:"detail"`
	MimeType string
}

func (m *MessageImageUrl) IsRemoteImage() bool {
	return strings.HasPrefix(m.Url, "http")
}

type MessageInputAudio struct {
	Data   string `json:"data"` //base64
	Format string `json:"format"`
}

type MessageFile struct {
	FileName string `json:"filename,omitempty"`
	FileData string `json:"file_data,omitempty"`
	FileId   string `json:"file_id,omitempty"`
}

type MessageVideoUrl struct {
	Url string `json:"url"`
}

const (
	ContentTypeText       = "text"
	ContentTypeImageURL   = "image_url"
	ContentTypeInputAudio = "input_audio"
	ContentTypeFile       = "file"
	ContentTypeVideoUrl   = "video_url" // 阿里百炼视频识别
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
	switch m.Content.(type) {
	case string:
		return m.Content.(string)
	case []any:
		var contentStr string
		for _, contentItem := range m.Content.([]any) {
			contentMap, ok := contentItem.(map[string]any)
			if !ok {
				continue
			}
			if contentMap["type"] == ContentTypeText {
				if subStr, ok := contentMap["text"].(string); ok {
					contentStr += subStr
				}
			}
		}
		return contentStr
	}

	return ""
}

func (m *Message) SetNullContent() {
	m.Content = nil
	m.parsedContent = nil
}

func (m *Message) SetStringContent(content string) {
	m.Content = content
	m.parsedContent = nil
}

func (m *Message) SetMediaContent(content []MediaContent) {
	m.Content = content
	m.parsedContent = content
}

func (m *Message) IsStringContent() bool {
	_, ok := m.Content.(string)
	if ok {
		return true
	}
	return false
}

func (m *Message) ParseContent() []MediaContent {
	if m.Content == nil {
		return nil
	}
	if len(m.parsedContent) > 0 {
		return m.parsedContent
	}

	var contentList []MediaContent
	// 先尝试解析为字符串
	content, ok := m.Content.(string)
	if ok {
		contentList = []MediaContent{{
			Type: ContentTypeText,
			Text: content,
		}}
		m.parsedContent = contentList
		return contentList
	}

	// 尝试解析为数组
	//var arrayContent []map[string]interface{}

	arrayContent, ok := m.Content.([]any)
	if !ok {
		return contentList
	}

	for _, contentItemAny := range arrayContent {
		mediaItem, ok := contentItemAny.(MediaContent)
		if ok {
			contentList = append(contentList, mediaItem)
			continue
		}

		contentItem, ok := contentItemAny.(map[string]any)
		if !ok {
			continue
		}
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
			temp := &MessageImageUrl{
				Detail: "high",
			}
			switch v := imageUrl.(type) {
			case string:
				temp.Url = v
			case map[string]interface{}:
				url, ok1 := v["url"].(string)
				detail, ok2 := v["detail"].(string)
				if ok2 {
					temp.Detail = detail
				}
				if ok1 {
					temp.Url = url
				}
			}
			contentList = append(contentList, MediaContent{
				Type:     ContentTypeImageURL,
				ImageUrl: temp,
			})

		case ContentTypeInputAudio:
			if audioData, ok := contentItem["input_audio"].(map[string]interface{}); ok {
				data, ok1 := audioData["data"].(string)
				format, ok2 := audioData["format"].(string)
				if ok1 && ok2 {
					temp := &MessageInputAudio{
						Data:   data,
						Format: format,
					}
					contentList = append(contentList, MediaContent{
						Type:       ContentTypeInputAudio,
						InputAudio: temp,
					})
				}
			}
		case ContentTypeFile:
			if fileData, ok := contentItem["file"].(map[string]interface{}); ok {
				fileId, ok3 := fileData["file_id"].(string)
				if ok3 {
					contentList = append(contentList, MediaContent{
						Type: ContentTypeFile,
						File: &MessageFile{
							FileId: fileId,
						},
					})
				} else {
					fileName, ok1 := fileData["filename"].(string)
					fileDataStr, ok2 := fileData["file_data"].(string)
					if ok1 && ok2 {
						contentList = append(contentList, MediaContent{
							Type: ContentTypeFile,
							File: &MessageFile{
								FileName: fileName,
								FileData: fileDataStr,
							},
						})
					}
				}
			}
		case ContentTypeVideoUrl:
			if videoUrl, ok := contentItem["video_url"].(string); ok {
				contentList = append(contentList, MediaContent{
					Type: ContentTypeVideoUrl,
					VideoUrl: &MessageVideoUrl{
						Url: videoUrl,
					},
				})
			}
		}
	}

	if len(contentList) > 0 {
		m.parsedContent = contentList
	}
	return contentList
}

// old code
/*func (m *Message) StringContent() string {
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

func (m *Message) SetNullContent() {
	m.Content = nil
	m.parsedStringContent = nil
	m.parsedContent = nil
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
				temp := &MessageImageUrl{
					Detail: "high",
				}
				switch v := imageUrl.(type) {
				case string:
					temp.Url = v
				case map[string]interface{}:
					url, ok1 := v["url"].(string)
					detail, ok2 := v["detail"].(string)
					if ok2 {
						temp.Detail = detail
					}
					if ok1 {
						temp.Url = url
					}
				}
				contentList = append(contentList, MediaContent{
					Type:     ContentTypeImageURL,
					ImageUrl: temp,
				})

			case ContentTypeInputAudio:
				if audioData, ok := contentItem["input_audio"].(map[string]interface{}); ok {
					data, ok1 := audioData["data"].(string)
					format, ok2 := audioData["format"].(string)
					if ok1 && ok2 {
						temp := &MessageInputAudio{
							Data:   data,
							Format: format,
						}
						contentList = append(contentList, MediaContent{
							Type:       ContentTypeInputAudio,
							InputAudio: temp,
						})
					}
				}
			case ContentTypeFile:
				if fileData, ok := contentItem["file"].(map[string]interface{}); ok {
					fileId, ok3 := fileData["file_id"].(string)
					if ok3 {
						contentList = append(contentList, MediaContent{
							Type: ContentTypeFile,
							File: &MessageFile{
								FileId: fileId,
							},
						})
					} else {
						fileName, ok1 := fileData["filename"].(string)
						fileDataStr, ok2 := fileData["file_data"].(string)
						if ok1 && ok2 {
							contentList = append(contentList, MediaContent{
								Type: ContentTypeFile,
								File: &MessageFile{
									FileName: fileName,
									FileData: fileDataStr,
								},
							})
						}
					}
				}
			case ContentTypeVideoUrl:
				if videoUrl, ok := contentItem["video_url"].(string); ok {
					contentList = append(contentList, MediaContent{
						Type: ContentTypeVideoUrl,
						VideoUrl: &MessageVideoUrl{
							Url: videoUrl,
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
}*/

type WebSearchOptions struct {
	SearchContextSize string          `json:"search_context_size,omitempty"`
	UserLocation      json.RawMessage `json:"user_location,omitempty"`
}

// https://platform.openai.com/docs/api-reference/responses/create
type OpenAIResponsesRequest struct {
	Model              string           `json:"model"`
	Input              json.RawMessage  `json:"input,omitempty"`
	Include            json.RawMessage  `json:"include,omitempty"`
	Instructions       json.RawMessage  `json:"instructions,omitempty"`
	MaxOutputTokens    uint             `json:"max_output_tokens,omitempty"`
	Metadata           json.RawMessage  `json:"metadata,omitempty"`
	ParallelToolCalls  bool             `json:"parallel_tool_calls,omitempty"`
	PreviousResponseID string           `json:"previous_response_id,omitempty"`
	Reasoning          *Reasoning       `json:"reasoning,omitempty"`
	ServiceTier        string           `json:"service_tier,omitempty"`
	Store              bool             `json:"store,omitempty"`
	Stream             bool             `json:"stream,omitempty"`
	Temperature        float64          `json:"temperature,omitempty"`
	Text               json.RawMessage  `json:"text,omitempty"`
	ToolChoice         json.RawMessage  `json:"tool_choice,omitempty"`
	Tools              []map[string]any `json:"tools,omitempty"` // 需要处理的参数很少，MCP 参数太多不确定，所以用 map
	TopP               float64          `json:"top_p,omitempty"`
	Truncation         string           `json:"truncation,omitempty"`
	User               string           `json:"user,omitempty"`
	MaxToolCalls       uint             `json:"max_tool_calls,omitempty"`
	Prompt             json.RawMessage  `json:"prompt,omitempty"`
}

type Reasoning struct {
	Effort  string `json:"effort,omitempty"`
	Summary string `json:"summary,omitempty"`
}

//type ResponsesToolsCall struct {
//	Type string `json:"type"`
//	// Web Search
//	UserLocation      json.RawMessage `json:"user_location,omitempty"`
//	SearchContextSize string          `json:"search_context_size,omitempty"`
//	// File Search
//	VectorStoreIds []string        `json:"vector_store_ids,omitempty"`
//	MaxNumResults  uint            `json:"max_num_results,omitempty"`
//	Filters        json.RawMessage `json:"filters,omitempty"`
//	// Computer Use
//	DisplayWidth  uint   `json:"display_width,omitempty"`
//	DisplayHeight uint   `json:"display_height,omitempty"`
//	Environment   string `json:"environment,omitempty"`
//	// Function
//	Name        string          `json:"name,omitempty"`
//	Description string          `json:"description,omitempty"`
//	Parameters  json.RawMessage `json:"parameters,omitempty"`
//	Function    json.RawMessage `json:"function,omitempty"`
//	Container   json.RawMessage `json:"container,omitempty"`
//}
