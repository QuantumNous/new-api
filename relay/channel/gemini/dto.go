package gemini

import "encoding/json"

type GeminiChatRequest struct {
	Contents           []GeminiChatContent        `json:"contents"`
	SafetySettings     []GeminiChatSafetySettings `json:"safetySettings,omitempty"`
	GenerationConfig   GeminiChatGenerationConfig `json:"generationConfig,omitempty"`
	Tools              []GeminiChatTool           `json:"tools,omitempty"`
	SystemInstructions *GeminiChatContent         `json:"systemInstruction,omitempty"`
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

	if err := json.Unmarshal(data, &aux); err != nil {
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

type FunctionResponse struct {
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
	FunctionResponse    *FunctionResponse              `json:"functionResponse,omitempty"`
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

	if err := json.Unmarshal(data, &aux); err != nil {
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
	Seed               int64                 `json:"seed,omitempty"`
	ResponseModalities []string              `json:"responseModalities,omitempty"`
	ThinkingConfig     *GeminiThinkingConfig `json:"thinkingConfig,omitempty"`
}

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
}

type GeminiChatResponse struct {
	Candidates     []GeminiChatCandidate    `json:"candidates"`
	PromptFeedback GeminiChatPromptFeedback `json:"promptFeedback"`
	UsageMetadata  GeminiUsageMetadata      `json:"usageMetadata"`
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
	Content              GeminiChatContent `json:"content"`
	TaskType             string            `json:"taskType,omitempty"`
	Title                string            `json:"title,omitempty"`
	OutputDimensionality int               `json:"outputDimensionality,omitempty"`
}

type GeminiEmbeddingResponse struct {
	Embedding ContentEmbedding `json:"embedding"`
}

type ContentEmbedding struct {
	Values []float64 `json:"values"`
}
