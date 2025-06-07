package huggingface

// HuggingFaceTEIRerankRequest represents the request structure for Hugging Face TEI rerank API
type HuggingFaceTEIRerankRequest struct {
	Query     string   `json:"query"`
	Texts     []string `json:"texts"`
	Truncate  bool     `json:"truncate,omitempty"`
	RawScores bool     `json:"raw_scores,omitempty"`
}

// HuggingFaceTEIRerankResponse represents the response structure from Hugging Face TEI rerank API
type HuggingFaceTEIRerankResponse []HuggingFaceTEIRerankResult

// HuggingFaceTEIRerankResult represents a single rerank result
type HuggingFaceTEIRerankResult struct {
	Index int     `json:"index"`
	Score float64 `json:"score"`
}

// HuggingFaceEmbeddingRequest represents the request structure for Hugging Face TEI embedding API
type HuggingFaceEmbeddingRequest struct {
	Inputs    []string `json:"inputs"`
	Truncate  bool     `json:"truncate,omitempty"`
	Normalize bool     `json:"normalize,omitempty"`
}

// HuggingFaceEmbeddingResponse represents the response structure from Hugging Face TEI embedding API
type HuggingFaceEmbeddingResponse [][]float64
