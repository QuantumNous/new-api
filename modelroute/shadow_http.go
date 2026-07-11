package modelroute

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// ShadowHTTPDoer is the minimal HTTP client used by shadow probes (PRD §12: independent, no user response).
type ShadowHTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

// ShadowHTTPClient is injectable; nil falls back to a timeout client (not the shared relay pool).
var ShadowHTTPClient ShadowHTTPDoer

func shadowHTTP() ShadowHTTPDoer {
	if ShadowHTTPClient != nil {
		return ShadowHTTPClient
	}
	return &http.Client{Timeout: time.Duration(model.DefaultShadowProbeTimeoutSec) * time.Second}
}

// EnsureDefaultShadowWiring installs OpenAI-compatible HTTP executor on GlobalShadowDispatcher when missing.
func EnsureDefaultShadowWiring() {
	if GlobalShadowDispatcher == nil {
		GlobalShadowDispatcher = &ShadowDispatcher{Builder: TextShadowBuilder{}}
	}
	if GlobalShadowDispatcher.Builder == nil {
		GlobalShadowDispatcher.Builder = TextShadowBuilder{}
	}
	if GlobalShadowDispatcher.Executor == nil {
		GlobalShadowDispatcher.Executor = OpenAICompatibleShadowExecutor
	}
}

// OpenAICompatibleShadowExecutor probes channel via POST {base}/v1/chat/completions (PRD §12/§13).
// No billing, no tools, stream=false, small max_tokens; never writes to user response.
func OpenAICompatibleShadowExecutor(ctx context.Context, req *ShadowRequest) ShadowResult {
	out := ShadowResult{BuildResult: ShadowTransportFailure, TransportOK: false}
	if req == nil || req.ChannelID <= 0 {
		return out
	}
	ch, err := loadChannelForShadow(int(req.ChannelID))
	if err != nil || ch == nil {
		return out
	}
	if ch.Status != common.ChannelStatusEnabled {
		return out
	}
	key, err := shadowChannelKey(ch)
	if err != nil || key == "" {
		return out
	}
	url := joinBasePath(ch.GetBaseURL(), "/v1/chat/completions")
	body, err := common.Marshal(buildShadowChatBody(req))
	if err != nil {
		return out
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return out
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+key)
	// mark non-billable internal probe for any upstream that cares
	httpReq.Header.Set("X-New-Api-Shadow-Probe", "1")

	start := time.Now()
	resp, err := shadowHTTP().Do(httpReq)
	if err != nil {
		return out
	}
	defer resp.Body.Close()
	// drain limited body to free connection; ignore content
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64*1024))
	lat := time.Since(start)
	out.StatusCode = resp.StatusCode
	out.TotalLatency = lat
	out.TTFT = lat // non-stream: first usable response ≈ total
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		out.TransportOK = true
		out.BuildResult = ShadowBuildOK
		return out
	}
	// 4xx/5xx still "reached transport"; treat as transport fail for learning weight path
	out.TransportOK = false
	out.BuildResult = ShadowTransportFailure
	return out
}

func loadChannelForShadow(id int) (*model.Channel, error) {
	if common.MemoryCacheEnabled {
		if ch, err := model.CacheGetChannel(id); err == nil && ch != nil {
			return ch, nil
		}
	}
	return model.GetChannelById(id, true)
}

// shadowChannelKey picks a key without advancing multi-key polling cursor when possible.
func shadowChannelKey(ch *model.Channel) (string, error) {
	if ch == nil {
		return "", fmt.Errorf("nil channel")
	}
	if !ch.ChannelInfo.IsMultiKey {
		return ch.Key, nil
	}
	keys := ch.GetKeys()
	if len(keys) == 0 {
		return "", fmt.Errorf("no keys")
	}
	statusList := ch.ChannelInfo.MultiKeyStatusList
	for i, k := range keys {
		st := common.ChannelStatusEnabled
		if statusList != nil {
			if s, ok := statusList[i]; ok {
				st = s
			}
		}
		if st == common.ChannelStatusEnabled && strings.TrimSpace(k) != "" {
			return k, nil
		}
	}
	// fallback first non-empty
	for _, k := range keys {
		if strings.TrimSpace(k) != "" {
			return k, nil
		}
	}
	return "", fmt.Errorf("no enabled keys")
}

func joinBasePath(base, path string) string {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	if base == "" {
		base = "https://api.openai.com"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	// if base already ends with /v1, avoid double
	if strings.HasSuffix(base, "/v1") && strings.HasPrefix(path, "/v1/") {
		return base + strings.TrimPrefix(path, "/v1")
	}
	return base + path
}

func buildShadowChatBody(req *ShadowRequest) map[string]any {
	modelName := req.EffectiveModel
	if modelName == "" {
		modelName = req.RequestedModel
	}
	maxTok := req.MaxTokens
	if maxTok <= 0 {
		maxTok = model.DefaultShadowProbeMaxTokens
	}
	msgs := make([]map[string]string, 0, len(req.Messages))
	for _, m := range req.Messages {
		role := m.Role
		if role == "" {
			role = "user"
		}
		msgs = append(msgs, map[string]string{"role": role, "content": m.Text})
	}
	if len(msgs) == 0 {
		msgs = append(msgs, map[string]string{"role": "user", "content": "ping"})
	}
	// no tools — PRD §12
	return map[string]any{
		"model":      modelName,
		"messages":   msgs,
		"max_tokens": maxTok,
		"stream":     false,
	}
}

// OpenAICompatibleEmergencyTry is an EmergencyTryFunc using the same HTTP probe as shadow.
func OpenAICompatibleEmergencyTry(ctx context.Context, c model.ResolvedRouteCandidate) BufferedAttemptResult {
	req := &ShadowRequest{
		ChannelID:      c.ChannelID,
		RequestedModel: c.RequestedModel,
		EffectiveModel: c.EffectiveModel,
		MaxTokens:      model.DefaultShadowProbeMaxTokens,
		Messages:       []ShadowMessage{{Role: "user", Text: "ping"}},
	}
	res := OpenAICompatibleShadowExecutor(ctx, req)
	ok := res.TransportOK && res.StatusCode >= 200 && res.StatusCode < 300
	return BufferedAttemptResult{
		Success:            ok,
		IsRetryableFailure: !ok && (res.StatusCode == 0 || res.StatusCode == 429 || res.StatusCode >= 500),
		StatusCode:         res.StatusCode,
		FirstChunk:         []byte("ok"),
	}
}

// RunEmergencyRecoveryForModel ranks standby candidates and runs Leader emergency probe (PRD §28).
// Returns recovered candidate when a probe succeeds.
func RunEmergencyRecoveryForModel(ctx context.Context, requestedModel string, excludeChannelIDs map[int64]struct{}) (model.ResolvedRouteCandidate, bool) {
	if !IsModelPriorityMode() || requestedModel == "" {
		return model.ResolvedRouteCandidate{}, false
	}
	all, err := BuildAllCandidatesForRequestedModel(requestedModel)
	if err != nil || len(all) == 0 {
		return model.ResolvedRouteCandidate{}, false
	}
	var filtered []model.ResolvedRouteCandidate
	for _, c := range all {
		if excludeChannelIDs != nil {
			if _, skip := excludeChannelIDs[c.ChannelID]; skip {
				continue
			}
		}
		// advance cooldown so RATE_LIMITED/OPEN may enter PROBING
		if c.Metrics != nil {
			MaybeAdvanceCooldown(c.Metrics)
		}
		filtered = append(filtered, c)
	}
	ranked := BuildEmergencyCandidates(filtered, false)
	if len(ranked) == 0 {
		return model.ResolvedRouteCandidate{}, false
	}
	cands := make([]model.ResolvedRouteCandidate, 0, len(ranked))
	for _, r := range ranked {
		cands = append(cands, r.Candidate)
	}
	if ctx == nil {
		ctx = context.Background()
	}
	out := GlobalEmergency.RunEmergency(ctx, requestedModel, cands, OpenAICompatibleEmergencyTry, true)
	if out.Err != nil || out.RecoveredCandidate == nil {
		// also check store (leader may have set recovered)
		if c, ok := GlobalEmergency.GetRecovered(requestedModel); ok {
			return c, true
		}
		return model.ResolvedRouteCandidate{}, false
	}
	return *out.RecoveredCandidate, true
}
