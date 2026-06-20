package generationdebug

type CaptureConfig struct {
	Enabled       bool
	CaptureRaw    bool
	CaptureOutput bool
	MaxBytes      int
	SampleRate    float64
	UserVisible   bool
}

type PromptMessage struct {
	Role            string `json:"role"`
	Content         string `json:"content"`
	EstimatedTokens int    `json:"estimated_tokens"`
	Cached          bool   `json:"cached"`
	Index           int    `json:"index"`
}

type PromptUnit struct {
	Index              int    `json:"index"`
	MessageIndex       int    `json:"message_index"`
	Path               string `json:"path"`
	Role               string `json:"role,omitempty"`
	Kind               string `json:"kind"`
	ContentPreview     string `json:"content_preview,omitempty"`
	EstimatedTokens    int    `json:"estimated_tokens"`
	CumulativeStart    int    `json:"cumulative_start"`
	CumulativeEnd      int    `json:"cumulative_end"`
	CacheOverlapTokens int    `json:"cache_overlap_tokens"`
	CacheStatus        string `json:"cache_status"`
	TokenSource        string `json:"token_source"`
	CacheSource        string `json:"cache_source"`
	Confidence         string `json:"confidence"`
}

type PromptTokenAccounting struct {
	PromptTokens         int    `json:"prompt_tokens"`
	CachedTokens         int    `json:"cached_tokens"`
	CacheWriteTokens     int    `json:"cache_write_tokens"`
	CompletionTokens     int    `json:"completion_tokens"`
	Source               string `json:"source"`
	Confidence           string `json:"confidence"`
	CacheWriteSource     string `json:"cache_write_source,omitempty"`
	CacheWriteConfidence string `json:"cache_write_confidence,omitempty"`
}

type CacheBoundary struct {
	CachedTokens          int     `json:"cached_tokens"`
	PromptTokens          int     `json:"prompt_tokens"`
	CacheHitRate          float64 `json:"cache_hit_rate"`
	EstimatedCachedTokens int     `json:"estimated_cached_tokens"`
	BreakUnitIndex        int     `json:"break_unit_index"`
	BreakUnitPath         string  `json:"break_unit_path,omitempty"`
	BreakUnitRole         string  `json:"break_unit_role,omitempty"`
	BreakOffsetTokens     int     `json:"break_offset_tokens"`
	Source                string  `json:"source"`
	Confidence            string  `json:"confidence"`
}

type PromptDebug struct {
	Messages                     []PromptMessage        `json:"messages,omitempty"`
	UpstreamMessages             []PromptMessage        `json:"upstream_messages,omitempty"`
	Units                        []PromptUnit           `json:"units,omitempty"`
	UpstreamUnits                []PromptUnit           `json:"upstream_units,omitempty"`
	Instructions                 any                    `json:"instructions,omitempty"`
	UpstreamInstructions         any                    `json:"upstream_instructions,omitempty"`
	Tools                        any                    `json:"tools,omitempty"`
	UpstreamTools                any                    `json:"upstream_tools,omitempty"`
	RoleCounts                   map[string]int         `json:"role_counts,omitempty"`
	UpstreamRoleCounts           map[string]int         `json:"upstream_role_counts,omitempty"`
	TotalEstimatedTokens         int                    `json:"total_estimated_tokens"`
	UpstreamTotalEstimatedTokens int                    `json:"upstream_total_estimated_tokens"`
	TokenAccounting              *PromptTokenAccounting `json:"token_accounting,omitempty"`
	CacheBoundary                *CacheBoundary         `json:"cache_boundary,omitempty"`
	Estimated                    bool                   `json:"estimated"`
}

type CompletionDebug struct {
	NormalizedOutput string `json:"normalized_output,omitempty"`
	ReasoningOutput  string `json:"reasoning_output,omitempty"`
	FinishReason     string `json:"finish_reason,omitempty"`
	GenerationID     string `json:"generation_id,omitempty"`
	Truncated        bool   `json:"truncated"`
}

type CacheStats struct {
	CachedTokens     int     `json:"cached_tokens"`
	CacheWriteTokens int     `json:"cache_write_tokens"`
	CacheHitRate     float64 `json:"cache_hit_rate"`
}

type Summary struct {
	Prompt               *PromptDebug     `json:"prompt,omitempty"`
	Completion           *CompletionDebug `json:"completion,omitempty"`
	Cache                CacheStats       `json:"cache"`
	PromptTokens         int              `json:"prompt_tokens"`
	CompletionTokens     int              `json:"completion_tokens"`
	TotalTokens          int              `json:"total_tokens"`
	ProviderLatencyMs    int64            `json:"provider_latency_ms"`
	ThroughputTokensPerS float64          `json:"throughput_tokens_per_second"`
	Cost                 any              `json:"cost,omitempty"`
	ProviderCost         any              `json:"provider_cost,omitempty"`
	ChargedCost          float64          `json:"charged_cost"`
	FinishReason         string           `json:"finish_reason,omitempty"`
	Streaming            bool             `json:"streaming"`
	RequestID            string           `json:"request_id,omitempty"`
	UpstreamRequestID    string           `json:"upstream_request_id,omitempty"`
	GenerationID         string           `json:"generation_id,omitempty"`
}

type RawValue struct {
	Value         any  `json:"value"`
	Truncated     bool `json:"truncated"`
	CapturedBytes int  `json:"captured_bytes"`
}

type RawDebug struct {
	InboundRequest  *RawValue `json:"inbound_request,omitempty"`
	UpstreamRequest *RawValue `json:"upstream_request,omitempty"`
	RawResponse     *RawValue `json:"raw_response,omitempty"`
	RawStream       *RawValue `json:"raw_stream,omitempty"`
}

type ExtractedOutput struct {
	Output       string
	Reasoning    string
	FinishReason string
	GenerationID string
	Truncated    bool
}

type LogMeta struct {
	RequestID                string
	UpstreamRequestID        string
	Streaming                bool
	CacheWriteTokensOverride int
	Quota                    int
	QuotaPerUnit             float64
}
