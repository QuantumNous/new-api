package billingexpr

import (
	"crypto/sha256"
	"fmt"
)

type RequestInput struct {
	Headers map[string]string
	Body    []byte
}

// TokenParams holds all token dimensions passed into an Expr evaluation.
// Fields beyond P and C are optional — when absent they default to 0,
// which means cache-unaware expressions keep working unchanged.
type TokenParams struct {
	P    float64 // prompt tokens (text) — auto-excludes sub-categories priced separately
	C    float64 // completion tokens (text) — auto-excludes sub-categories priced separately
	Len  float64 // total input context length for tier conditions (non-Claude: raw prompt_tokens; Claude: text + cache read + cache creation)
	CR   float64 // cache read (hit) tokens
	CC   float64 // cache creation tokens (5-min TTL for Claude, generic for others)
	CC1h float64 // cache creation tokens — 1-hour TTL (Claude only)
	Img  float64 // image input tokens
	ImgO float64 // image output tokens
	AI   float64 // audio input tokens
	AO   float64 // audio output tokens
}

// TraceResult holds side-channel info captured by the tier() function
// during Expr execution. This replaces the old Breakdown mechanism —
// the Expr itself is the single source of truth for billing logic.
type TraceResult struct {
	MatchedTier string  `json:"matched_tier"`
	Cost        float64 `json:"cost"`
}

// BillingSnapshot captures the billing rule state frozen at pre-consume time.
// It is fully serializable and contains no compiled program pointers.
type BillingSnapshot struct {
	BillingMode               string  `json:"billing_mode"`
	ModelName                 string  `json:"model_name"`
	ExprString                string  `json:"expr_string"`
	ExprHash                  string  `json:"expr_hash"`
	GroupRatio                float64 `json:"group_ratio"`
	EstimatedPromptTokens     int     `json:"estimated_prompt_tokens"`
	EstimatedCompletionTokens int     `json:"estimated_completion_tokens"`
	EstimatedQuotaBeforeGroup float64 `json:"estimated_quota_before_group"`
	EstimatedQuotaAfterGroup  int     `json:"estimated_quota_after_group"`
	EstimatedTier             string  `json:"estimated_tier"`
	QuotaPerUnit              float64 `json:"quota_per_unit"`
	ExprVersion               int     `json:"expr_version"`
}

// TieredResult holds everything needed after running tiered settlement.
type TieredResult struct {
	ActualQuotaBeforeGroup float64 `json:"actual_quota_before_group"`
	ActualQuotaAfterGroup  int     `json:"actual_quota_after_group"`
	MatchedTier            string  `json:"matched_tier"`
	CrossedTier            bool    `json:"crossed_tier"`
}

// ExprHashString returns the SHA-256 hex digest of an expression string.
func ExprHashString(expr string) string {
	h := sha256.Sum256([]byte(expr))
	return fmt.Sprintf("%x", h)
}
