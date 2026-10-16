package huawei

// MaaSImageRequest is the Huawei Cloud MaaS image generation/editing request
// shape. Editing sends the image as a base64 data URL (or public URL) in the
// `image` field; multiple images are comma-joined. MaaS only accepts
// response_format=b64_json and does not document the n parameter.
type MaaSImageRequest struct {
	Model          string `json:"model"`
	Prompt         string `json:"prompt"`
	Size           string `json:"size,omitempty"`
	ResponseFormat string `json:"response_format,omitempty"`
	Seed           *int   `json:"seed,omitempty"`
	Watermark      *bool  `json:"watermark,omitempty"`
	Image          string `json:"image,omitempty"`
}

type MaaSImageData struct {
	Url     string `json:"url"`
	B64Json string `json:"b64_json"`
}

type MaaSImageResponse struct {
	Model   string          `json:"model"`
	Created int64           `json:"created"`
	Data    []MaaSImageData `json:"data"`
	Usage   struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
		InputTokens      int `json:"input_tokens"`
		OutputTokens     int `json:"output_tokens"`
	} `json:"usage"`
	Error any `json:"error"`
}

// MaaSRerankRequest is the Huawei MaaS rerank request. Only model/query/
// documents are supported upstream; OpenAI rerank options are dropped.
type MaaSRerankRequest struct {
	Model     string `json:"model"`
	Query     string `json:"query"`
	Documents []any  `json:"documents"`
}

type MaaSRerankResult struct {
	Index    int `json:"index"`
	Document struct {
		Text any `json:"text"`
	} `json:"document"`
	RelevanceScore float64 `json:"relevance_score"`
}

type MaaSRerankResponse struct {
	ID      string             `json:"id"`
	Model   string             `json:"model"`
	Results []MaaSRerankResult `json:"results"`
	Usage   struct {
		TotalTokens int `json:"total_tokens"`
	} `json:"usage"`
	Error any `json:"error"`
}
