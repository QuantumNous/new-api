package dto

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type GeminiChatRequest struct {
	Requests           []GeminiChatRequest        `json:"requests,omitempty"` // For batch requests
	Contents           []GeminiChatContent        `json:"contents"`
	SafetySettings     []GeminiChatSafetySettings `json:"safetySettings,omitempty"`
	GenerationConfig   GeminiChatGenerationConfig `json:"generationConfig,omitempty"`
	Tools              json.RawMessage            `json:"tools,omitempty"`
	ToolConfig         *ToolConfig                `json:"toolConfig,omitempty"`
	SystemInstructions *GeminiChatContent         `json:"systemInstruction,omitempty"`
	CachedContent      string                     `json:"cachedContent,omitempty"`
}

type ToolConfig struct {
	FunctionCallingConfig *FunctionCallingConfig `json:"functionCallingConfig,omitempty"`
	RetrievalConfig       *RetrievalConfig       `json:"retrievalConfig,omitempty"`
}

type FunctionCallingConfig struct {
	Mode                 FunctionCallingConfigMode `json:"mode,omitempty"`
	AllowedFunctionNames []string                  `json:"allowedFunctionNames,omitempty"`
}
type FunctionCallingConfigMode string

type RetrievalConfig struct {
	LatLng       *LatLng `json:"latLng,omitempty"`
	LanguageCode string  `json:"languageCode,omitempty"`
}

type LatLng struct {
	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`
}

func (r *GeminiChatRequest) GetTokenCountMeta() *types.TokenCountMeta {
	var files []*types.FileMeta = make([]*types.FileMeta, 0)

	var maxTokens int

	if r.GenerationConfig.MaxOutputTokens > 0 {
		maxTokens = int(r.GenerationConfig.MaxOutputTokens)
	}

	var inputTexts []string
	for _, content := range r.Contents {
		for _, part := range content.Parts {
			if part.Text != "" {
				inputTexts = append(inputTexts, part.Text)
			}
			if part.InlineData != nil && part.InlineData.Data != "" {
				if strings.HasPrefix(part.InlineData.MimeType, "image/") {
					files = append(files, &types.FileMeta{
						FileType:   types.FileTypeImage,
						OriginData: part.InlineData.Data,
					})
				} else if strings.HasPrefix(part.InlineData.MimeType, "audio/") {
					files = append(files, &types.FileMeta{
						FileType:   types.FileTypeAudio,
						OriginData: part.InlineData.Data,
					})
				} else if strings.HasPrefix(part.InlineData.MimeType, "video/") {
					files = append(files, &types.FileMeta{
						FileType:   types.FileTypeVideo,
						OriginData: part.InlineData.Data,
					})
				} else {
					files = append(files, &types.FileMeta{
						FileType:   types.FileTypeFile,
						OriginData: part.InlineData.Data,
					})
				}
			}
		}
	}

	inputText := strings.Join(inputTexts, "\n")
	return &types.TokenCountMeta{
		CombineText: inputText,
		Files:       files,
		MaxTokens:   maxTokens,
	}
}

func (r *GeminiChatRequest) IsStream(c *gin.Context) bool {
	if c.Query("alt") == "sse" {
		return true
	}
	return false
}

func (r *GeminiChatRequest) SetModelName(modelName string) {
	// GeminiChatRequest does not have a model field, so this method does nothing.
}

func (r *GeminiChatRequest) GetTools() []GeminiChatTool {
	var tools []GeminiChatTool
	if strings.HasSuffix(string(r.Tools), "[") {
		// is array
		if err := common.Unmarshal(r.Tools, &tools); err != nil {
			logger.LogError(nil, "error_unmarshalling_tools: "+err.Error())
			return nil
		}
	} else if strings.HasPrefix(string(r.Tools), "{") {
		// is object
		singleTool := GeminiChatTool{}
		if err := common.Unmarshal(r.Tools, &singleTool); err != nil {
			logger.LogError(nil, "error_unmarshalling_single_tool: "+err.Error())
			return nil
		}
		tools = []GeminiChatTool{singleTool}
	}
	return tools
}

func (r *GeminiChatRequest) SetTools(tools []GeminiChatTool) {
	if len(tools) == 0 {
		r.Tools = json.RawMessage("[]")
		return
	}

	// Marshal the tools to JSON
	data, err := common.Marshal(tools)
	if err != nil {
		logger.LogError(nil, "error_marshalling_tools: "+err.Error())
		return
	}
	r.Tools = data
}

type GeminiThinkingConfig struct {
	IncludeThoughts bool `json:"includeThoughts,omitempty"`
	ThinkingBudget  *int `json:"thinkingBudget,omitempty"`
}

func (c *GeminiThinkingConfig) SetThinkingBudget(budget int) {
	c.ThinkingBudget = &budget
}

type GeminiInlineData struct {
	MimeType string `json:"mimeType"`
	Data     string `json:"data"`
}

// UnmarshalJSON custom unmarshaler for GeminiInlineData to support snake_case and camelCase for MimeType
func (g *GeminiInlineData) UnmarshalJSON(data []byte) error {
	type Alias GeminiInlineData // Use type alias to avoid recursion
	var aux struct {
		Alias
		MimeTypeSnake string `json:"mime_type"`
	}

	if err := common.Unmarshal(data, &aux); err != nil {
		return err
	}

	*g = GeminiInlineData(aux.Alias) // Copy other fields if any in future

	// Prioritize snake_case if present
	if aux.MimeTypeSnake != "" {
		g.MimeType = aux.MimeTypeSnake
	} else if aux.MimeType != "" { // Fallback to camelCase from Alias
		g.MimeType = aux.MimeType
	}
	// g.Data would be populated by aux.Alias.Data
	return nil
}

type FunctionCall struct {
	FunctionName string `json:"name"`
	Arguments    any    `json:"args"`
}

type GeminiFunctionResponse struct {
	Name     string                 `json:"name"`
	Response map[string]interface{} `json:"response"`
}

type GeminiPartExecutableCode struct {
	Language string `json:"language,omitempty"`
	Code     string `json:"code,omitempty"`
}

type GeminiPartCodeExecutionResult struct {
	Outcome string `json:"outcome,omitempty"`
	Output  string `json:"output,omitempty"`
}

type GeminiFileData struct {
	MimeType string `json:"mimeType,omitempty"`
	FileUri  string `json:"fileUri,omitempty"`
}

type GeminiPart struct {
	Text                string                         `json:"text,omitempty"`
	Thought             bool                           `json:"thought,omitempty"`
	InlineData          *GeminiInlineData              `json:"inlineData,omitempty"`
	FunctionCall        *FunctionCall                  `json:"functionCall,omitempty"`
	FunctionResponse    *GeminiFunctionResponse        `json:"functionResponse,omitempty"`
	FileData            *GeminiFileData                `json:"fileData,omitempty"`
	ExecutableCode      *GeminiPartExecutableCode      `json:"executableCode,omitempty"`
	CodeExecutionResult *GeminiPartCodeExecutionResult `json:"codeExecutionResult,omitempty"`
}

// UnmarshalJSON custom unmarshaler for GeminiPart to support snake_case and camelCase for InlineData
func (p *GeminiPart) UnmarshalJSON(data []byte) error {
	// Alias to avoid recursion during unmarshalling
	type Alias GeminiPart
	var aux struct {
		Alias
		InlineDataSnake *GeminiInlineData `json:"inline_data,omitempty"` // snake_case variant
	}

	if err := common.Unmarshal(data, &aux); err != nil {
		return err
	}

	// Assign fields from alias
	*p = GeminiPart(aux.Alias)

	// Prioritize snake_case for InlineData if present
	if aux.InlineDataSnake != nil {
		p.InlineData = aux.InlineDataSnake
	} else if aux.InlineData != nil { // Fallback to camelCase from Alias
		p.InlineData = aux.InlineData
	}
	// Other fields like Text, FunctionCall etc. are already populated via aux.Alias

	return nil
}

type GeminiChatContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []GeminiPart `json:"parts"`
}

type GeminiChatSafetySettings struct {
	Category  string `json:"category"`
	Threshold string `json:"threshold"`
}

type GeminiChatTool struct {
	GoogleSearch          any `json:"googleSearch,omitempty"`
	GoogleSearchRetrieval any `json:"googleSearchRetrieval,omitempty"`
	CodeExecution         any `json:"codeExecution,omitempty"`
	FunctionDeclarations  any `json:"functionDeclarations,omitempty"`
	URLContext            any `json:"urlContext,omitempty"`
}

type GeminiChatGenerationConfig struct {
	Temperature        *float64              `json:"temperature,omitempty"`
	TopP               float64               `json:"topP,omitempty"`
	TopK               float64               `json:"topK,omitempty"`
	MaxOutputTokens    uint                  `json:"maxOutputTokens,omitempty"`
	CandidateCount     int                   `json:"candidateCount,omitempty"`
	StopSequences      []string              `json:"stopSequences,omitempty"`
	ResponseMimeType   string                `json:"responseMimeType,omitempty"`
	ResponseSchema     any                   `json:"responseSchema,omitempty"`
	ResponseJsonSchema json.RawMessage       `json:"responseJsonSchema,omitempty"`
	PresencePenalty    *float32              `json:"presencePenalty,omitempty"`
	FrequencyPenalty   *float32              `json:"frequencyPenalty,omitempty"`
	ResponseLogprobs   bool                  `json:"responseLogprobs,omitempty"`
	Logprobs           *int32                `json:"logprobs,omitempty"`
	MediaResolution    MediaResolution       `json:"mediaResolution,omitempty"`
	Seed               int64                 `json:"seed,omitempty"`
	ResponseModalities []string              `json:"responseModalities,omitempty"`
	ThinkingConfig     *GeminiThinkingConfig `json:"thinkingConfig,omitempty"`
	SpeechConfig       json.RawMessage       `json:"speechConfig,omitempty"` // RawMessage to allow flexible speech config
	ImageConfig        json.RawMessage       `json:"imageConfig,omitempty"`  // RawMessage to allow flexible image config
}

type MediaResolution string

type GeminiChatCandidate struct {
	Content       GeminiChatContent        `json:"content"`
	FinishReason  *string                  `json:"finishReason"`
	Index         int64                    `json:"index"`
	SafetyRatings []GeminiChatSafetyRating `json:"safetyRatings"`
}

type GeminiChatSafetyRating struct {
	Category    string `json:"category"`
	Probability string `json:"probability"`
}

type GeminiChatPromptFeedback struct {
	SafetyRatings []GeminiChatSafetyRating `json:"safetyRatings"`
	BlockReason   *string                  `json:"blockReason,omitempty"`
}

type GeminiChatResponse struct {
	Candidates     []GeminiChatCandidate     `json:"candidates"`
	PromptFeedback *GeminiChatPromptFeedback `json:"promptFeedback,omitempty"`
	UsageMetadata  GeminiUsageMetadata       `json:"usageMetadata"`
}

type GeminiUsageMetadata struct {
	PromptTokenCount     int                         `json:"promptTokenCount"`
	CandidatesTokenCount int                         `json:"candidatesTokenCount"`
	TotalTokenCount      int                         `json:"totalTokenCount"`
	ThoughtsTokenCount   int                         `json:"thoughtsTokenCount"`
	PromptTokensDetails  []GeminiPromptTokensDetails `json:"promptTokensDetails"`
}

type GeminiPromptTokensDetails struct {
	Modality   string `json:"modality"`
	TokenCount int    `json:"tokenCount"`
}

// Imagen related structs
type GeminiImageRequest struct {
	Instances  []GeminiImageInstance `json:"instances"`
	Parameters GeminiImageParameters `json:"parameters"`
}

type GeminiImageInstance struct {
	Prompt string `json:"prompt"`
}

type GeminiImageParameters struct {
	SampleCount      int    `json:"sampleCount,omitempty"`
	AspectRatio      string `json:"aspectRatio,omitempty"`
	PersonGeneration string `json:"personGeneration,omitempty"`
	ImageSize        string `json:"imageSize,omitempty"`
}

type GeminiImageResponse struct {
	Predictions []GeminiImagePrediction `json:"predictions"`
}

type GeminiImagePrediction struct {
	MimeType           string `json:"mimeType"`
	BytesBase64Encoded string `json:"bytesBase64Encoded"`
	RaiFilteredReason  string `json:"raiFilteredReason,omitempty"`
	SafetyAttributes   any    `json:"safetyAttributes,omitempty"`
}

// Embedding related structs
type GeminiEmbeddingRequest struct {
	Model                string            `json:"model,omitempty"`
	Content              GeminiChatContent `json:"content"`
	TaskType             string            `json:"taskType,omitempty"`
	Title                string            `json:"title,omitempty"`
	OutputDimensionality int               `json:"outputDimensionality,omitempty"`
}

func (r *GeminiEmbeddingRequest) IsStream(c *gin.Context) bool {
	// Gemini embedding requests are not streamed
	return false
}

func (r *GeminiEmbeddingRequest) GetTokenCountMeta() *types.TokenCountMeta {
	var inputTexts []string
	for _, part := range r.Content.Parts {
		if part.Text != "" {
			inputTexts = append(inputTexts, part.Text)
		}
	}
	inputText := strings.Join(inputTexts, "\n")
	return &types.TokenCountMeta{
		CombineText: inputText,
	}
}

func (r *GeminiEmbeddingRequest) SetModelName(modelName string) {
	if modelName != "" {
		r.Model = modelName
	}
}

type GeminiBatchEmbeddingRequest struct {
	Requests []*GeminiEmbeddingRequest `json:"requests"`
}

func (r *GeminiBatchEmbeddingRequest) IsStream(c *gin.Context) bool {
	// Gemini batch embedding requests are not streamed
	return false
}

func (r *GeminiBatchEmbeddingRequest) GetTokenCountMeta() *types.TokenCountMeta {
	var inputTexts []string
	for _, request := range r.Requests {
		meta := request.GetTokenCountMeta()
		if meta != nil && meta.CombineText != "" {
			inputTexts = append(inputTexts, meta.CombineText)
		}
	}
	inputText := strings.Join(inputTexts, "\n")
	return &types.TokenCountMeta{
		CombineText: inputText,
	}
}

func (r *GeminiBatchEmbeddingRequest) SetModelName(modelName string) {
	if modelName != "" {
		for _, req := range r.Requests {
			req.SetModelName(modelName)
		}
	}
}

type GeminiEmbeddingResponse struct {
	Embedding ContentEmbedding `json:"embedding"`
}

type GeminiBatchEmbeddingResponse struct {
	Embeddings []*ContentEmbedding `json:"embeddings"`
}

type ContentEmbedding struct {
	Values []float64 `json:"values"`
}
