// Package volcadapter provides a dedicated task adaptor for ChannelTypeVolcAdapter (58).
//
// It embeds doubao.TaskAdaptor for shared task plumbing (ParseTaskResult, FetchTask,
// BuildRequestURL, BuildRequestHeader, DoRequest, DoResponse, GetModelList,
// ConvertToOpenAIVideo) and overrides the methods that need Volc-native behavior:
//
//   - ValidateRequestAndSetAction — Volc-native body validation (model required)
//   - BuildRequestBody            — byte-identical pass-through + model patching
//   - EstimateBilling             — video_url detection in raw body content[]
//   - EstimateBillingTokens       — Seedance token formula
//   - AdjustBillingOnComplete     — tiered_expr settle via BillingSnapshot
//
// Channel 45 (DoubaoVideo) and 54 (VolcEngine) continue to use doubao.TaskAdaptor
// unchanged. Only channel 58 (VolcAdapter) routes here.
package volcadapter

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/relay/channel/task/doubao"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

// TaskAdaptor is the Volc-native task adaptor for ChannelTypeVolcAdapter.
// It embeds doubao.TaskAdaptor and inherits all methods that do not need
// Volc-specific overrides.
type TaskAdaptor struct {
	doubao.TaskAdaptor
}

// GetChannelName returns the channel name for this adaptor.
func (a *TaskAdaptor) GetChannelName() string {
	return "volc-adapter-task"
}

// ValidateRequestAndSetAction parses a Volc-native body, validates fields,
// and sets action based on content[] presence of image/video items.
// No RelayFormat check is needed — this adaptor is only routed to from VolcAdapter (58).
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return validateVolcNativeTaskRequest(c, info)
}

// BuildRequestBody forwards the Volc-native body byte-identical to upstream.
// If the model is mapped, only the "model" field is patched; all other fields
// (tools, resolution, ratio, duration, etc.) are preserved as-is.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, fmt.Errorf("BuildRequestBody (volc native): read body failed: %w", err)
	}
	if _, err = storage.Seek(0, io.SeekStart); err != nil {
		return nil, fmt.Errorf("BuildRequestBody (volc native): seek body failed: %w", err)
	}
	rawBytes, err := storage.Bytes()
	if err != nil {
		return nil, fmt.Errorf("BuildRequestBody (volc native): read bytes failed: %w", err)
	}
	// If model is mapped, patch just the model field in the JSON.
	if info.IsModelMapped && info.UpstreamModelName != "" {
		rawBytes, err = patchVolcBodyModel(rawBytes, info.UpstreamModelName)
		if err != nil {
			return nil, fmt.Errorf("BuildRequestBody (volc native): patch model failed: %w", err)
		}
	} else {
		// Extract model name from raw body so info.UpstreamModelName is populated.
		if info.UpstreamModelName == "" {
			var bodyMap map[string]json.RawMessage
			if jsonErr := json.Unmarshal(rawBytes, &bodyMap); jsonErr == nil {
				if modelRaw, ok := bodyMap["model"]; ok {
					var m string
					if jsonErr2 := json.Unmarshal(modelRaw, &m); jsonErr2 == nil && m != "" {
						info.UpstreamModelName = m
					}
				}
			}
		}
	}

	// Apply param override after model patch so callers can override any field.
	// This must happen before injectSafetyIdentifier / injectCallbackURL so that
	// compliance-required fields are always appended last and cannot be overridden.
	if len(info.ParamOverride) > 0 {
		overridden, err := relaycommon.ApplyParamOverrideWithRelayInfo(rawBytes, info)
		if err != nil {
			return nil, fmt.Errorf("BuildRequestBody (volc native): apply param override failed: %w", err)
		}
		rawBytes = overridden
	}

	return bytes.NewReader(rawBytes), nil
}

// EstimateBilling reads the raw Volc body and returns a video_input ratio
// when content[] contains a video_url item.
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	return estimateBillingVolcNative(c, info)
}

// EstimateBillingTokens returns a conservative upper-bound token count for
// tiered_expr pre-charge, using the Volc token formula.
func (a *TaskAdaptor) EstimateBillingTokens(c *gin.Context, info *relaycommon.RelayInfo) int64 {
	body, err := readBodyBytes(c)
	if err != nil {
		return 0
	}
	return EstimateSeedanceTokens(info.OriginModelName, body)
}

// AdjustBillingOnComplete implements tiered_expr settlement for Volc tasks.
//
// It is called by task_polling.go:SettleTaskBillingOnComplete BEFORE the
// ratio-based RecalculateTaskQuotaByTokens fallback. Returning a positive
// value causes the caller to use that quota and skip the fallback.
//
// When BillingContext has a TieredSnapshot + TieredVolcFlags, this method:
//  1. Reads resolution/duration/service_tier from TieredVolcFlags first
//     (captured at submit time), falling back to task.Data (Volc fetch
//     response) only when flags are absent
//  2. Reads generate_audio/draft/has_video_input from TieredVolcFlags
//  3. Synthesizes a minimal request body JSON for param() lookups
//  4. Re-runs the billing expression with actual completion tokens
//  5. Returns the computed quota (groupRatio already in snapshot)
//
// Returns 0 if no TieredSnapshot is present (falls through to ratio path).
func (a *TaskAdaptor) AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int {
	bc := task.PrivateData.BillingContext
	if bc == nil || bc.TieredSnapshot == nil {
		return 0
	}
	snap := bc.TieredSnapshot

	// Build a synthesized request body for param() lookups.
	// Fields come from two sources:
	//   - task.Data: the Volc fetch response (has resolution, duration, service_tier)
	//   - TieredVolcFlags: flags captured at submit time (generate_audio, draft, has_video_input)
	synthBody, err := buildSynthesizedBody(task, bc)
	if err != nil {
		// Synthesize failed — fall through to ratio path
		return 0
	}

	// Prefer TotalTokens for the expression variable c because Volc Ark
	// callbacks typically report total_tokens for video tasks and may omit
	// completion_tokens. Fall back to CompletionTokens when only that is set.
	// This mirrors the effectiveTokenCount logic in service/task_polling.go.
	tokens := taskResult.TotalTokens
	if tokens <= 0 {
		tokens = taskResult.CompletionTokens
	}

	requestInput := billingexpr.RequestInput{
		Body: synthBody,
	}
	params := billingexpr.TokenParams{
		C:   float64(tokens),
		Len: float64(tokens),
	}

	cost, trace, err := billingexpr.RunExprByHashWithRequest(snap.ExprString, snap.ExprHash, params, requestInput)
	if err != nil {
		// Expression run failed — fall through to ratio path
		return 0
	}

	quotaBeforeGroup := cost / 1_000_000 * snap.QuotaPerUnit
	actualQuota := billingexpr.QuotaRound(quotaBeforeGroup * snap.GroupRatio)
	_ = trace // TraceResult available for future logging
	return actualQuota
}

// volcFetchResponse is a minimal subset of the Volc task fetch response
// containing only the fields needed for param() lookups at settlement time.
type volcFetchResponse struct {
	Resolution  string `json:"resolution"`
	Duration    int    `json:"duration"`
	ServiceTier string `json:"service_tier"`
}

// buildSynthesizedBody constructs a minimal JSON body for param() lookups.
// Source priority for resolution/duration/service_tier:
//  1. TieredVolcFlags (captured at submit time — works on callback-enabled
//     deployments where task.Data is just {"id":...})
//  2. Volc fetch response in task.Data (polling deployments — covers values
//     the user didn't supply explicitly but Volc filled in, e.g. defaults)
func buildSynthesizedBody(task *model.Task, bc *model.TaskBillingContext) ([]byte, error) {
	// Parse the Volc fetch response from task.Data
	var fetchResp volcFetchResponse
	if len(task.Data) > 0 {
		_ = json.Unmarshal(task.Data, &fetchResp) // best-effort, ignore error
	}

	// Build synthesized body map. Flags first; task.Data fills only the gaps.
	body := map[string]interface{}{}
	flags := bc.TieredVolcFlags

	if flags != nil && flags.Resolution != "" {
		body["resolution"] = flags.Resolution
	} else if fetchResp.Resolution != "" {
		body["resolution"] = fetchResp.Resolution
	}
	if flags != nil && flags.Duration > 0 {
		body["duration"] = flags.Duration
	} else if fetchResp.Duration > 0 {
		body["duration"] = fetchResp.Duration
	}
	if flags != nil && flags.ServiceTier != "" {
		body["service_tier"] = flags.ServiceTier
	} else if fetchResp.ServiceTier != "" {
		body["service_tier"] = fetchResp.ServiceTier
	}

	// Apply Volc-specific flags captured at submit time
	if flags != nil {
		if flags.GenerateAudio != nil {
			body["generate_audio"] = *flags.GenerateAudio
		}
		if flags.Draft != nil {
			body["draft"] = *flags.Draft
		}
		// Synthesize content[] with a video_url item if HasVideoInput is true,
		// so param("content.#.type") and has(param(...), "video_url") expressions work.
		if flags.HasVideoInput {
			body["content"] = []map[string]string{
				{"type": "video_url"},
			}
		}
	}

	return json.Marshal(body)
}
