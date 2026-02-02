package dto

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
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

// GeneralOpenAIRequest represents a general request structure for OpenAI-compatible APIs.
// 参数增加规范：无引用的参数必须使用json.RawMessage类型，并添加omitempty标签
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
	// 安全标识符，用于帮助 OpenAI 检测可能违反使用政策的应用程序用户
	// 注意：此字段会向 OpenAI 发送用户标识信息，默认过滤以保护用户隐私
	SafetyIdentifier string `json:"safety_identifier,omitempty"`
	// Whether or not to store the output of this chat completion request for use in our model distillation or evals products.
	// 是否存储此次请求数据供 OpenAI 用于评估和优化产品
	// 注意：默认过滤此字段以保护用户隐私，但过滤后可能导致 Codex 无法正常使用
	Store json.RawMessage `json:"store,omitempty"`
	// Used by OpenAI to cache responses for similar requests to optimize your cache hit rates. Replaces the user field
	PromptCacheKey       string          `json:"prompt_cache_key,omitempty"`
	PromptCacheRetention json.RawMessage `json:"prompt_cache_retention,omitempty"`
	LogitBias            json.RawMessage `json:"logit_bias,omitempty"`
	Metadata             json.RawMessage `json:"metadata,omitempty"`
	Prediction           json.RawMessage `json:"prediction,omitempty"`
	// gemini
	ExtraBody json.RawMessage `json:"extra_body,omitempty"`
	//xai
	SearchParameters json.RawMessage `json:"search_parameters,omitempty"`
	// claude
	WebSearchOptions *WebSearchOptions `json:"web_search_options,omitempty"`
	// OpenRouter Params
	Usage     json.RawMessage `json:"usage,omitempty"`
	Reasoning json.RawMessage `json:"reasoning,omitempty"`
	// Ali Qwen Params
	VlHighResolutionImages json.RawMessage `json:"vl_high_resolution_images,omitempty"`
	EnableThinking         json.RawMessage `json:"enable_thinking,omitempty"`
	ChatTemplateKwargs     json.RawMessage `json:"chat_template_kwargs,omitempty"`
	EnableSearch           json.RawMessage `json:"enable_search,omitempty"`
	// ollama Params
	Think json.RawMessage `json:"think,omitempty"`
	// baidu v2
	WebSearch json.RawMessage `json:"web_search,omitempty"`
	// doubao,zhipu_v4
	THINKING json.RawMessage `json:"thinking,omitempty"`
	// pplx Params
	SearchDomainFilter     json.RawMessage `json:"search_domain_filter,omitempty"`
	SearchRecencyFilter    string          `json:"search_recency_filter,omitempty"`
	ReturnImages           bool            `json:"return_images,omitempty"`
	ReturnRelatedQuestions bool            `json:"return_related_questions,omitempty"`
	SearchMode             string          `json:"search_mode,omitempty"`
}

func (r *GeneralOpenAIRequest) GetTokenCountMeta() *types.TokenCountMeta {
	var tokenCountMeta types.TokenCountMeta
	var texts = make([]string, 0)
	var fileMeta = make([]*types.FileMeta, 0)

	if r.Prompt != nil {
		switch v := r.Prompt.(type) {
		case string:
			texts = append(texts, v)
		case []any:
			for _, item := range v {
				if str, ok := item.(string); ok {
					texts = append(texts, str)
				}
			}
		default:
			texts = append(texts, fmt.Sprintf("%v", r.Prompt))
		}
	}

	if r.Input != nil {
		inputs := r.ParseInput()
		texts = append(texts, inputs...)
	}

	if r.MaxCompletionTokens > r.MaxTokens {
		tokenCountMeta.MaxTokens = int(r.MaxCompletionTokens)
	} else {
		tokenCountMeta.MaxTokens = int(r.MaxTokens)
	}

	for _, message := range r.Messages {
		tokenCountMeta.MessagesCount++
		texts = append(texts, message.Role)
		if message.Content != nil {
			if message.Name != nil {
				tokenCountMeta.NameCount++
				texts = append(texts, *message.Name)
			}
			arrayContent := message.ParseContent()
			for _, m := range arrayContent {
				if m.Type == ContentTypeImageURL {
					imageUrl := m.GetImageMedia()
					if imageUrl != nil {
						if imageUrl.Url != "" {
							meta := &types.FileMeta{
								FileType: types.FileTypeImage,
							}
							meta.OriginData = imageUrl.Url
							meta.Detail = imageUrl.Detail
							fileMeta = append(fileMeta, meta)
						}
					}
				} else if m.Type == ContentTypeInputAudio {
					inputAudio := m.GetInputAudio()
					if inputAudio != nil {
						meta := &types.FileMeta{
							FileType: types.FileTypeAudio,
						}
						meta.OriginData = inputAudio.Data
						fileMeta = append(fileMeta, meta)
					}
				} else if m.Type == ContentTypeFile {
					file := m.GetFile()
					if file != nil {
						meta := &types.FileMeta{
							FileType: types.FileTypeFile,
						}
						meta.OriginData = file.FileData
						fileMeta = append(fileMeta, meta)
					}
				} else if m.Type == ContentTypeVideoUrl {
					videoUrl := m.GetVideoUrl()
					if videoUrl != nil && videoUrl.Url != "" {
						meta := &types.FileMeta{
							FileType: types.FileTypeVideo,
						}
						meta.OriginData = videoUrl.Url
						fileMeta = append(fileMeta, meta)
					}
				} else {
					texts = append(texts, m.Text)
				}
			}
		}
	}

	if r.Tools != nil {
		openaiTools := r.Tools
		for _, tool := range openaiTools {
			tokenCountMeta.ToolsCount++
			texts = append(texts, tool.Function.Name)
			if tool.Function.Description != "" {
				texts = append(texts, tool.Function.Description)
			}
			if tool.Function.Parameters != nil {
				texts = append(texts, fmt.Sprintf("%v", tool.Function.Parameters))
			}
		}
		//toolTokens := CountTokenInput(countStr, request.Model)
		//tkm += 8
		//tkm += toolTokens
	}
	tokenCountMeta.CombineText = strings.Join(texts, "\n")
	tokenCountMeta.Files = fileMeta
	return &tokenCountMeta
}

func (r *GeneralOpenAIRequest) IsStream(c *gin.Context) bool {
	return r.Stream
}

func (r *GeneralOpenAIRequest) SetModelName(modelName string) {
	if modelName != "" {
		r.Model = modelName
	}
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

const CustomType = "custom"

type ToolCallRequest struct {
	ID       string          `json:"id,omitempty"`
	Type     string          `json:"type"`
	Function FunctionRequest `json:"function,omitempty"`
	Custom   json.RawMessage `json:"custom,omitempty"`
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

func (m *MediaContent) GetVideoUrl() *MessageVideoUrl {
	if m.VideoUrl != nil {
		if _, ok := m.VideoUrl.(*MessageVideoUrl); ok {
			return m.VideoUrl.(*MessageVideoUrl)
		}
		if itemMap, ok := m.VideoUrl.(map[string]any); ok {
			out := &MessageVideoUrl{
				Url: common.Interface2String(itemMap["url"]),
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
	//ContentTypeAudioUrl   = "audio_url"
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
	Model              string          `json:"model"`
	Input              json.RawMessage `json:"input,omitempty"`
	Include            json.RawMessage `json:"include,omitempty"`
	Instructions       json.RawMessage `json:"instructions,omitempty"`
	MaxOutputTokens    uint            `json:"max_output_tokens,omitempty"`
	Metadata           json.RawMessage `json:"metadata,omitempty"`
	ParallelToolCalls  json.RawMessage `json:"parallel_tool_calls,omitempty"`
	PreviousResponseID string          `json:"previous_response_id,omitempty"`
	Reasoning          *Reasoning      `json:"reasoning,omitempty"`
	// 服务层级字段，用于指定 API 服务等级。允许透传可能导致实际计费高于预期，默认应过滤
	ServiceTier          string          `json:"service_tier,omitempty"`
	Store                json.RawMessage `json:"store,omitempty"`
	PromptCacheKey       json.RawMessage `json:"prompt_cache_key,omitempty"`
	PromptCacheRetention json.RawMessage `json:"prompt_cache_retention,omitempty"`
	Stream               bool            `json:"stream,omitempty"`
	Temperature          *float64        `json:"temperature,omitempty"`
	Text                 json.RawMessage `json:"text,omitempty"`
	ToolChoice           json.RawMessage `json:"tool_choice,omitempty"`
	Tools                json.RawMessage `json:"tools,omitempty"` // 需要处理的参数很少，MCP 参数太多不确定，所以用 map
	TopP                 *float64        `json:"top_p,omitempty"`
	Truncation           string          `json:"truncation,omitempty"`
	User                 string          `json:"user,omitempty"`
	MaxToolCalls         uint            `json:"max_tool_calls,omitempty"`
	Prompt               json.RawMessage `json:"prompt,omitempty"`
	// qwen
	EnableThinking json.RawMessage `json:"enable_thinking,omitempty"`
	// perplexity
	Preset json.RawMessage `json:"preset,omitempty"`
}

func (r *OpenAIResponsesRequest) GetTokenCountMeta() *types.TokenCountMeta {
	var fileMeta = make([]*types.FileMeta, 0)
	var texts = make([]string, 0)

	if r.Input != nil {
		inputs := r.ParseInput()
		for _, input := range inputs {
			if input.Type == "input_image" {
				if input.ImageUrl != "" {
					fileMeta = append(fileMeta, &types.FileMeta{
						FileType:   types.FileTypeImage,
						OriginData: input.ImageUrl,
						Detail:     input.Detail,
					})
				}
			} else if input.Type == "input_file" {
				if input.FileUrl != "" {
					fileMeta = append(fileMeta, &types.FileMeta{
						FileType:   types.FileTypeFile,
						OriginData: input.FileUrl,
					})
				}
			} else {
				texts = append(texts, input.Text)
			}
		}
	}

	if len(r.Instructions) > 0 {
		texts = append(texts, string(r.Instructions))
	}

	if len(r.Metadata) > 0 {
		texts = append(texts, string(r.Metadata))
	}

	if len(r.Text) > 0 {
		texts = append(texts, string(r.Text))
	}

	if len(r.ToolChoice) > 0 {
		texts = append(texts, string(r.ToolChoice))
	}

	if len(r.Prompt) > 0 {
		texts = append(texts, string(r.Prompt))
	}

	if len(r.Tools) > 0 {
		texts = append(texts, string(r.Tools))
	}

	return &types.TokenCountMeta{
		CombineText: strings.Join(texts, "\n"),
		Files:       fileMeta,
		MaxTokens:   int(r.MaxOutputTokens),
	}
}

func (r *OpenAIResponsesRequest) IsStream(c *gin.Context) bool {
	return r.Stream
}

func (r *OpenAIResponsesRequest) SetModelName(modelName string) {
	if modelName != "" {
		r.Model = modelName
	}
}

func (r *OpenAIResponsesRequest) GetToolsMap() []map[string]any {
	var toolsMap []map[string]any
	if len(r.Tools) > 0 {
		_ = common.Unmarshal(r.Tools, &toolsMap)
	}
	return toolsMap
}

type Reasoning struct {
	Effort  string `json:"effort,omitempty"`
	Summary string `json:"summary,omitempty"`
}

type Input struct {
	Type    string          `json:"type,omitempty"`
	Role    string          `json:"role,omitempty"`
	Content json.RawMessage `json:"content,omitempty"`
}

type MediaInput struct {
	Type     string `json:"type"`
	Text     string `json:"text,omitempty"`
	FileUrl  string `json:"file_url,omitempty"`
	ImageUrl string `json:"image_url,omitempty"`
	Detail   string `json:"detail,omitempty"` // 仅 input_image 有效
}

// ParseInput parses the Responses API `input` field into a normalized slice of MediaInput.
// Reference implementation mirrors Message.ParseContent:
//   - input can be a string, treated as an input_text item
//   - input can be an array of objects with a `type` field
//     supported types: input_text, input_image, input_file
func (r *OpenAIResponsesRequest) ParseInput() []MediaInput {
	if r.Input == nil {
		return nil
	}

	var mediaInputs []MediaInput

	// Try string first
	// if str, ok := common.GetJsonType(r.Input); ok {
	// 	inputs = append(inputs, MediaInput{Type: "input_text", Text: str})
	// 	return inputs
	// }
	if common.GetJsonType(r.Input) == "string" {
		var str string
		_ = common.Unmarshal(r.Input, &str)
		mediaInputs = append(mediaInputs, MediaInput{Type: "input_text", Text: str})
		return mediaInputs
	}

	// Try array of parts
	if common.GetJsonType(r.Input) == "array" {
		var inputs []Input
		_ = common.Unmarshal(r.Input, &inputs)
		for _, input := range inputs {
			if common.GetJsonType(input.Content) == "string" {
				var str string
				_ = common.Unmarshal(input.Content, &str)
				mediaInputs = append(mediaInputs, MediaInput{Type: "input_text", Text: str})
			}

			if common.GetJsonType(input.Content) == "array" {
				var array []any
				_ = common.Unmarshal(input.Content, &array)
				for _, itemAny := range array {
					// Already parsed MediaContent
					if media, ok := itemAny.(MediaInput); ok {
						mediaInputs = append(mediaInputs, media)
						continue
					}

					// Generic map
					item, ok := itemAny.(map[string]any)
					if !ok {
						continue
					}

					typeVal, ok := item["type"].(string)
					if !ok {
						continue
					}
					switch typeVal {
					case "input_text":
						text, _ := item["text"].(string)
						mediaInputs = append(mediaInputs, MediaInput{Type: "input_text", Text: text})
					case "input_image":
						// image_url may be string or object with url field
						var imageUrl string
						switch v := item["image_url"].(type) {
						case string:
							imageUrl = v
						case map[string]any:
							if url, ok := v["url"].(string); ok {
								imageUrl = url
							}
						}
						mediaInputs = append(mediaInputs, MediaInput{Type: "input_image", ImageUrl: imageUrl})
					case "input_file":
						// file_url may be string or object with url field
						var fileUrl string
						switch v := item["file_url"].(type) {
						case string:
							fileUrl = v
						case map[string]any:
							if url, ok := v["url"].(string); ok {
								fileUrl = url
							}
						}
						mediaInputs = append(mediaInputs, MediaInput{Type: "input_file", FileUrl: fileUrl})
					}
				}
			}
		}
	}

	return mediaInputs
}
