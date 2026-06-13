// Package service — per-tenant billing webhook dispatch.
//
// This file is the 4th sanctioned upstream-adjacent file (ADR-0006). It owns
// the orchestration layer between the relay completion path and the leaf
// package internal/billing:
//
//   - Reads gin.Context for tenant identity and request metadata.
//   - Applies guard conditions (metered completion, webhook configured).
//   - Constructs the billing.Event from relay + usage data.
//   - Fires the HTTP dispatch asynchronously via gopool so the relay response
//     path is never blocked.
//
// Architecture contract (internal/billing/README.md):
//   - internal/billing is a leaf package (stdlib + common/json only).
//   - All upstream-type access (gin.Context, relaycommon.RelayInfo, model.User)
//     must stay in this file, not in internal/billing.
//
// Spec: DeepRouter PRD §7.3, PLAN.md Phase 2, DR-25.
package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/billing"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

// channelTypeToProviderID maps channel types to stable, lowercase wire-format
// provider identifiers used in billing.Event.Provider (PRD §7.3).
//
// These are machine-readable identifiers for routing, analytics, and billing —
// NOT the human-facing display names returned by constant.GetChannelTypeName().
// For example: "anthropic" not "Anthropic", "openai" not "OpenAI".
// Falls back to strings.ToLower(GetChannelTypeName()) for unmapped channel types.
var channelTypeToProviderID = map[int]string{
	constant.ChannelTypeOpenAI:      "openai",
	constant.ChannelTypeAnthropic:   "anthropic",
	constant.ChannelTypeAzure:       "azure",
	constant.ChannelTypeGemini:      "gemini",
	constant.ChannelTypeAws:         "aws",
	constant.ChannelTypeDeepSeek:    "deepseek",
	constant.ChannelTypeMistral:     "mistral",
	constant.ChannelTypeOpenRouter:  "openrouter",
	constant.ChannelTypeCohere:      "cohere",
	constant.ChannelTypeVertexAi:    "vertex",
	constant.ChannelTypeXai:         "xai",
	constant.ChannelTypeOllama:      "ollama",
	constant.ChannelTypePerplexity:  "perplexity",
	constant.ChannelTypeSiliconFlow: "siliconflow",
	constant.ChannelTypeVolcEngine:  "volcengine",
	constant.ChannelTypeBaidu:       "baidu",
	constant.ChannelTypeBaiduV2:     "baidu",
	constant.ChannelTypeAli:         "ali",
	constant.ChannelTypeMiniMax:     "minimax",
	constant.ChannelTypeZhipu:       "zhipu",
	constant.ChannelTypeZhipu_v4:    "zhipu",
	constant.ChannelTypeMoonshot:    "moonshot",
}

// channelTypeProviderID returns the stable, lowercase wire-format provider ID
// for billing.Event.Provider (PRD §7.3). Covers the most common providers
// explicitly; falls back to strings.ToLower(GetChannelTypeName()) for the rest.
func channelTypeProviderID(channelType int) string {
	if id, ok := channelTypeToProviderID[channelType]; ok {
		return id
	}
	return strings.ToLower(constant.GetChannelTypeName(channelType))
}

// virtualModelAuto is the model name that triggers smart-router routing.
// Declared here to avoid importing middleware (would create a cycle) while
// keeping the string centralised and documented.
// Source: middleware/smart_router.go VirtualModelAuto constant.
const virtualModelAuto = "deeprouter-auto"

// dispatchAirbotixBilling fires a billing webhook for a completed, metered
// relay request. It is called by PostTextConsumeQuota immediately after
// SettleBilling, so quota reflects the final settled amount.
//
// The function is a no-op (returns immediately) when:
//   - relayInfo or usage is nil (upstream returned no metadata)
//   - PromptTokens + CompletionTokens == 0 (no measurable token usage —
//     e.g. upstream timeout or empty response). Zero-cost models with real
//     token counts are NOT filtered here; token accounting still applies.
//   - The tenant has no BillingWebhookURL or WebhookSecret configured.
//   - WebhookSecret is blank or whitespace-only (would produce a trivially
//     guessable HMAC key).
//
// On dispatch, the function:
//  1. Extracts all needed values from the gin.Context before entering the
//     goroutine (gin contexts must not be shared across goroutine boundaries).
//  2. Fires a gopool goroutine that POSTs the signed billing.Event.
//  3. Logs a warning on failure; errors are never propagated to the caller.
//
// Idempotency: relayInfo.RequestId is stable across retries (set once in
// GenRelayInfo from common.RequestIdKey). Receivers deduplicate by this field.
func dispatchAirbotixBilling(c *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.Usage, quota int) {
	// ── Guard 1: nil checks ───────────────────────────────────────────────
	// Both relayInfo and usage are required to build a meaningful event.
	// nil usage means the upstream returned no token counts at all.
	// ChannelMeta is embedded as a pointer; guard against the unlikely case
	// where InitChannelMeta was never called (e.g. test scaffolding gaps).
	if relayInfo == nil || relayInfo.ChannelMeta == nil || usage == nil {
		return
	}

	// ── Guard 2: metered completion check ────────────────────────────────
	// Dispatch only when the upstream returned real token usage.
	// Design decision (DR-25 §4.5): we guard on token count, not quota.
	// This ensures zero-cost models with real usage still fire the webhook
	// for token accounting purposes (cost_usd will be 0 in those cases).
	if usage.PromptTokens+usage.CompletionTokens == 0 {
		return
	}

	// ── Guard 3: tenant webhook configuration ────────────────────────────
	// ContextKeyAirbotixUser is a legacy fork name populated for authenticated
	// /v1/* tenant requests. Requests without authenticated tenant context, or
	// tenants without BillingWebhookURL/WebhookSecret, silently pass through.
	raw, ok := common.GetContextKey(c, constant.ContextKeyAirbotixUser)
	if !ok || raw == nil {
		return
	}
	user, ok := raw.(*model.User)
	// TrimSpace guards against whitespace-only secrets that would pass the
	// empty-string check but produce a trivially guessable HMAC key.
	if !ok || user == nil || user.BillingWebhookURL == "" || strings.TrimSpace(user.WebhookSecret) == "" {
		return
	}

	// ── Build billing.Event (PRD §7.3) ───────────────────────────────────
	finishedAt := time.Now().UTC()

	event := &billing.Event{
		// RequestID is the per-request idempotency key. Stable across relay
		// retries (set once in GenRelayInfo). Receivers deduplicate on this.
		RequestID: relayInfo.RequestId,

		// TenantID is the tenant identifier (= User.Username).
		TenantID: user.Username,

		// Provider is the stable, lowercase wire-format identifier (PRD §7.3).
		// Uses channelTypeProviderID() not GetChannelTypeName() (display names).
		Provider: channelTypeProviderID(relayInfo.ChannelType),

		// Model is the concrete upstream model that was actually invoked.
		// For deeprouter-auto requests this is the smart-router's resolved
		// model (e.g. "claude-haiku-4-5"), not the virtual name.
		Model: relayInfo.OriginModelName,

		PromptTokens:     usage.PromptTokens,
		CompletionTokens: usage.CompletionTokens,

		// CostUSD = settled quota converted to USD.
		// Calculated AFTER SettleBilling so it reflects the final amount.
		// QuotaPerUnit = 500000 units per $1 USD.
		CostUSD: float64(quota) / common.QuotaPerUnit,

		// PolicyViolations must be a non-nil slice per PRD §7.3 so receivers
		// can range/len without nil-checking. Phase 4 content moderation will
		// populate this; V0 always sends an empty slice.
		PolicyViolations: []string{},

		// StartedAt: relay request start time from RelayInfo.
		StartedAt: relayInfo.StartTime.UTC().Format(time.RFC3339),

		// FinishedAt: time.Now() at the point of dispatch (after token tally).
		FinishedAt: finishedAt.Format(time.RFC3339),
	}

	// ── RoutedFrom: deeprouter-auto routing attribution ──────────────────
	// Set only when the smart-router performed Layer-1 routing (i.e. the
	// client sent "deeprouter-auto" and the sidecar resolved it to a concrete
	// model). Direct model requests leave this field empty.
	//
	// IMPORTANT: ContextKeyAliasResolvedFrom is also set by distributor.go
	// for ordinary SimpleMode alias rewrites (e.g. "deeprouter-coding").
	// We must match the exact virtual model name, not any non-empty value,
	// to avoid incorrectly attributing ordinary aliases as smart-router routing.
	if aliasFrom := common.GetContextKeyString(c, constant.ContextKeyAliasResolvedFrom); aliasFrom == virtualModelAuto {
		event.RoutedFrom = aliasFrom
	}

	// KidProfileID: trim whitespace so a whitespace-only X-Tenant-User header
	// (e.g. "   ") is treated as absent and correctly omitted via omitempty,
	// matching the behavior of a missing header.
	if kidProfileID := strings.TrimSpace(c.GetHeader("X-Tenant-User")); kidProfileID != "" {
		event.KidProfileID = kidProfileID
	}

	// ── Async dispatch ───────────────────────────────────────────────────
	// Extract all values from gin.Context BEFORE crossing the goroutine
	// boundary. gin.Context must not be read from a different goroutine;
	// c.Copy() creates a snapshot safe for async use (gin docs).
	url := user.BillingWebhookURL
	// TrimSpace here mirrors the guard above so the HMAC key is always the
	// normalised secret even when the admin stored it with surrounding whitespace.
	secret := []byte(strings.TrimSpace(user.WebhookSecret))
	asyncCtx := c.Copy()

	gopool.Go(func() {
		dispatcher := billing.NewDispatcher()
		status, err := dispatcher.Send(url, secret, event)
		if err != nil {
			logger.LogWarn(asyncCtx, fmt.Sprintf(
				"tenant billing webhook failed request_id=%s tenant=%s status=%d err=%s",
				event.RequestID, event.TenantID, status, err.Error(),
			))
		}
	})
}
