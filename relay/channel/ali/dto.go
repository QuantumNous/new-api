package ali

import "github.com/QuantumNous/new-api/dto"

type AliMessage struct {
	Content any    `json:"content"`
	Role    string `json:"role"`
}

type AliMediaContent struct {
	Image string `json:"image,omitempty"`
	Text  string `json:"text,omitempty"`
}

type AliInput struct {
	Prompt string `json:"prompt,omitempty"`
	//History []AliMessage `json:"history,omitempty"`
	Messages []AliMessage `json:"messages"`
}

type AliParameters struct {
	TopP              float64 `json:"top_p,omitempty"`
	TopK              int     `json:"top_k,omitempty"`
	Seed              uint64  `json:"seed,omitempty"`
	EnableSearch      bool    `json:"enable_search,omitempty"`
	IncrementalOutput bool    `json:"incremental_output,omitempty"`
}

type AliChatRequest struct {
	Model      string        `json:"model"`
	Input      AliInput      `json:"input,omitempty"`
	Parameters AliParameters `json:"parameters,omitempty"`
}

type AliEmbeddingRequest struct {
	Model string `json:"model"`
	Input struct {
		Texts []string `json:"texts"`
	} `json:"input"`
	Parameters *struct {
		TextType string `json:"text_type,omitempty"`
	} `json:"parameters,omitempty"`
}

type AliEmbedding struct {
	Embedding []float64 `json:"embedding"`
	TextIndex int       `json:"text_index"`
}

type AliEmbeddingResponse struct {
	Output struct {
		Embeddings []AliEmbedding `json:"embeddings"`
	} `json:"output"`
	Usage AliUsage `json:"usage"`
	AliError
}

type AliError struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestId string `json:"request_id"`
}

type AliUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
	TotalTokens  int `json:"total_tokens"`
}

type TaskResult struct {
	B64Image string `json:"b64_image,omitempty"`
	Url      string `json:"url,omitempty"`
	Code     string `json:"code,omitempty"`
	Message  string `json:"message,omitempty"`
}

type AliOutput struct {
	TaskId       string           `json:"task_id,omitempty"`
	TaskStatus   string           `json:"task_status,omitempty"`
	Text         string           `json:"text"`
	FinishReason string           `json:"finish_reason"`
	Message      string           `json:"message,omitempty"`
	Code         string           `json:"code,omitempty"`
	Results      []TaskResult     `json:"results,omitempty"`
	Choices      []map[string]any `json:"choices,omitempty"`
}

type AliResponse struct {
	Output AliOutput `json:"output"`
	Usage  AliUsage  `json:"usage"`
	AliError
}

type AliImageRequest struct {
	Model          string `json:"model"`
	Input          any    `json:"input"`
	Parameters     any    `json:"parameters,omitempty"`
	ResponseFormat string `json:"response_format,omitempty"`
}

type AliImageParameters struct {
	Size      string `json:"size,omitempty"`
	N         int    `json:"n,omitempty"`
	Steps     string `json:"steps,omitempty"`
	Scale     string `json:"scale,omitempty"`
	Watermark *bool  `json:"watermark,omitempty"`
}

type AliImageInput struct {
	Prompt         string       `json:"prompt,omitempty"`
	NegativePrompt string       `json:"negative_prompt,omitempty"`
	Messages       []AliMessage `json:"messages,omitempty"`
}

type WanImageInput struct {
	Prompt         string   `json:"prompt"`                    // 必需：文本提示词，描述生成图像中期望包含的元素和视觉特点
	Images         []string `json:"images"`                    // 必需：图像URL数组，长度不超过2，支持HTTP/HTTPS URL或Base64编码
	NegativePrompt string   `json:"negative_prompt,omitempty"` // 可选：反向提示词，描述不希望在画面中看到的内容
}

type WanImageParameters struct {
	N         int     `json:"n,omitempty"`         // 生成图片数量，取值范围1-4，默认4
	Watermark *bool   `json:"watermark,omitempty"` // 是否添加水印标识，默认false
	Seed      int     `json:"seed,omitempty"`      // 随机数种子，取值范围[0, 2147483647]
	Strength  float64 `json:"strength,omitempty"`  // 修改幅度 0.0-1.0，默认0.5（部分模型支持）
}

type AliRerankParameters struct {
	TopN            *int  `json:"top_n,omitempty"`
	ReturnDocuments *bool `json:"return_documents,omitempty"`
}

type AliRerankInput struct {
	Query     string `json:"query"`
	Documents []any  `json:"documents"`
}

type AliRerankRequest struct {
	Model      string              `json:"model"`
	Input      AliRerankInput      `json:"input"`
	Parameters AliRerankParameters `json:"parameters,omitempty"`
}

type AliRerankResponse struct {
	Output struct {
		Results []dto.RerankResponseResult `json:"results"`
	} `json:"output"`
	Usage     AliUsage `json:"usage"`
	RequestId string   `json:"request_id"`
	AliError
}
