package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/bytedance/gopkg/util/gopool"
)

const (
	// Tick frequency: same trade-off as auto_detect — per-model interval is the
	// real cadence, this just determines the minimum granularity.
	uptimeTickInterval   = 1 * time.Minute
	uptimeRequestTimeout = 30 * time.Second
	uptimeProbePrompt    = "hi"
	uptimeProbeMaxTokens = 1500 // needs headroom for thinking models (DeepSeek, o-series)
)

// urlSuffixes mirrors Flask's _URL_SUFFIXES — these are appended to the site root
// when generating candidate base URLs.
var urlSuffixes = []string{"", "/api", "/v1", "/api/v1"}

// ModelIDCandidates mirrors Flask's _MODEL_ID_CANDIDATES — when a provider returns
// model_not_found for the canonical name, fall back to these alternatives.
// First successful call wins. Add entries here as providers diverge on naming.
// Exported so other packages (e.g. controller/model_data.go) can match a canonical
// model name against all known variants when querying pricing/detect-log tables.
var ModelIDCandidates = map[string][]string{
	"claude-haiku-4-5":               {"claude-haiku-4-5-20251001", "anthropic/claude-haiku-4.5"},
	"claude-sonnet-5":                {"anthropic/claude-sonnet-5", "claude-sonnet-5-20260601"},
	"claude-sonnet-4-6":              {"anthropic/claude-sonnet-4.6"},
	"claude-opus-4-7":                {"anthropic/claude-opus-4.7"},
	"claude-opus-4-8":                {"anthropic/claude-opus-4.8", "claude-opus-4-8-20260528"},
	"claude-fable-5":                 {"anthropic/claude-fable-5", "claude-fable-5-20260601"},
	"claude-sonnet-4-5":              {"anthropic/claude-sonnet-4.5"},
	"claude-opus-4-6":                {"anthropic/claude-opus-4.6"},
	"claude-opus-4-5":                {"anthropic/claude-opus-4.5"},
	"gpt-5.4-mini":                   {"openai/gpt-5.4-mini"},
	"minimax-m3":                     {"MiniMax-M3", "MiniMax-M3-20260301", "minimax/minimax-m3"},
	"kimi-k2.7-code":                 {"moonshotai/kimi-k2.7-code", "kimi-k2-7-code"},
	"mimo-v2.5-pro":                  {"xiaomi/mimo-v2.5-pro", "mimo-v2-5-pro"},
	"mimo-v2.5":                      {"xiaomi/mimo-v2.5", "mimo-v2-5"},
	"qwen3.7-max":                    {"qwen3-7-max", "Qwen3.7-Max"},
	"qwen3.7-plus":                   {"qwen3-7-plus", "Qwen3.7-Plus"},
	"doubao-seed-2-1-pro-260628":     {"doubao-seed-2-1-pro"},
	"doubao-seed-2-1-turbo-260628":   {"doubao-seed-2-1-turbo"},
	"sora":                           {"sora-2"},
	"gemini-3.1-flash-image-preview": {"nano-banana2-preview", "gemini-2.5-flash-image"},
}

// ModelNameCandidates returns the canonical name plus all known aliases.
// Useful for IN (...) queries against channel_model_pricings or channel_detect_logs
// when channels store provider-specific variants like "claude-haiku-4-5-20251001".
func ModelNameCandidates(canonical string) []string {
	out := []string{canonical}
	out = append(out, ModelIDCandidates[canonical]...)
	return out
}

var uptimeOnce sync.Once

// StartUptimeCheckTask periodically sends a tiny probe ("hi") to each enabled
// (channel × model) pair where uptime_enabled=true. A non-empty response = pass;
// any error = notcomplete. Results are stored in channel_detect_logs with
// source='uptime' so they're separable from fingerprint runs in the UI.
func StartUptimeCheckTask() {
	uptimeOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("uptime-check task started (tick=%s)", uptimeTickInterval))
			ticker := time.NewTicker(uptimeTickInterval)
			defer ticker.Stop()
			runUptimeCheckOnce()
			for range ticker.C {
				runUptimeCheckOnce()
			}
		})
	})
}

func runUptimeCheckOnce() {
	ctx := context.Background()

	var channels []model.Channel
	// Same rule as auto_detect: probe AutoDisabled (3) too so we keep observing them;
	// uptime alone doesn't drive recovery (only fingerprint pass count does), but
	// surfacing latency / pass-rate while a channel is down is still useful.
	if err := model.DB.Where("status IN (1, 3) AND base_url != '' AND base_url IS NOT NULL").Find(&channels).Error; err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("uptime-check: failed to list channels: %v", err))
		return
	}

	configuredModels := LoadAllConfiguredModels()
	if len(configuredModels) == 0 {
		return
	}

	now := time.Now().Unix()

	for _, ch := range channels {
		if ch.BaseURL == nil || *ch.BaseURL == "" {
			continue
		}
		channelModels := splitChannelModels(ch.Models)
		for _, m := range configuredModels {
			if !channelModels[m] {
				continue
			}
			cfg := LoadDetectConfig(m)
			if !cfg.UptimeEnabled {
				continue
			}

			intervalSec := int64(cfg.UptimeIntervalMinutes) * 60
			if intervalSec < 60 {
				intervalSec = 60
			}

			lastTime := lastUptimeTime(ch.Id, m)
			if now-lastTime < intervalSec {
				continue
			}

			probeOneChannel(ctx, &ch, m)
		}
	}
}

// lastUptimeTime returns the most recent uptime probe time for this channel×model.
func lastUptimeTime(channelId int, modelName string) int64 {
	var row struct{ DetectTime int64 }
	model.DB.Table("channel_detect_logs").
		Select("detect_time").
		Where("channel_id = ? AND claimed_model = ? AND source = ?", channelId, modelName, "uptime").
		Order("detect_time DESC").
		Limit(1).
		Scan(&row)
	return row.DetectTime
}

// probeOneChannel sends a minimal chat completion ("hi", max_tokens=5) and records
// the result. Pass = HTTP 200 with non-empty content; everything else = notcomplete.
//
// Mirrors Flask's resolve_base_url + resolve_target_model: tries multiple URL
// candidates (raw, site root + suffixes, api.<domain> variant) and falls back to
// alternate model IDs on model_not_found. First combo that returns content wins.
func probeOneChannel(ctx context.Context, ch *model.Channel, targetModel string) {
	baseURL := strings.TrimRight(*ch.BaseURL, "/")
	apiKey := ch.Key
	if idx := strings.IndexByte(apiKey, '\n'); idx >= 0 {
		apiKey = strings.TrimSpace(apiKey[:idx])
	}
	if apiKey == "" || baseURL == "" {
		return
	}

	urlCandidates := baseURLCandidates(baseURL)
	modelCandidates := ModelNameCandidates(targetModel)

	client := &http.Client{Timeout: uptimeRequestTimeout}
	var lastErr string
	var lastLatency float64

	// Outer loop: URL candidates. Inner: model ID candidates.
	// Skip to next URL candidate on 404 / "no chat endpoint" errors.
	// Skip to next model on model_not_found.
	// Any other error → record and stop.
	seenEndpoints := map[string]bool{}
	for _, candidate := range urlCandidates {
		endpoint := buildChatCompletionsURL(candidate)
		if seenEndpoints[endpoint] {
			continue
		}
		seenEndpoints[endpoint] = true

		urlStillBad := false
		for _, m := range modelCandidates {
			result, err := sendUptimeProbe(ctx, client, endpoint, apiKey, m)
			lastLatency = result.LatencyMs
			if err != nil {
				switch err.kind {
				case probeErrURL:
					// 404 / wrong host — try next URL candidate
					lastErr = err.msg
					urlStillBad = true
				case probeErrModel:
					// model_not_found — try next model ID with same URL
					lastErr = err.msg
					continue
				case probeErrClaudeCliOnly:
					// CC-only relay — delegate to Flask, which spawns the real
					// claude binary (not available in this container). Definitive
					// signal: don't try other URL/model candidates.
					st, lat, note := claudeCliUptimeProbe(ctx, baseURL, apiKey, m)
					recordUptimeResult(ch, targetModel, baseURL, st, lat, note)
					return
				default:
					// Auth / network / decode / etc — record and bail.
					recordUptimeResult(ch, targetModel, baseURL, "notcomplete", result.LatencyMs, err.msg)
					return
				}
				if urlStillBad {
					break // next URL
				}
			} else {
				// Success.
				recordUptimeResult(ch, targetModel, baseURL, "pass", result.LatencyMs, "")
				return
			}
		}
	}

	if lastErr == "" {
		lastErr = "no working endpoint found"
	}
	recordUptimeResult(ch, targetModel, baseURL, "notcomplete", lastLatency, lastErr)
}

// probeErrKind classifies failures so the caller can decide what to retry.
type probeErrKind int

const (
	probeErrOther         probeErrKind = iota
	probeErrURL                        // 404, HTML response — try next URL candidate
	probeErrModel                      // model_not_found — try next model ID
	probeErrClaudeCliOnly              // 403 — relay only accepts the real Claude Code CLI
)

type probeError struct {
	kind probeErrKind
	msg  string
}

func (e *probeError) Error() string { return e.msg }

type probeResult struct {
	LatencyMs float64
}

// sendUptimeProbe performs one HTTP request. Returns nil error on success.
func sendUptimeProbe(ctx context.Context, client *http.Client, endpoint, apiKey, modelName string) (probeResult, *probeError) {
	body, err := common.Marshal(map[string]any{
		"model":      modelName,
		"messages":   []map[string]string{{"role": "user", "content": uptimeProbePrompt}},
		"max_tokens": uptimeProbeMaxTokens,
		"stream":     false,
	})
	if err != nil {
		return probeResult{}, &probeError{kind: probeErrOther, msg: fmt.Sprintf("marshal: %v", err)}
	}

	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return probeResult{}, &probeError{kind: probeErrOther, msg: fmt.Sprintf("build request: %v", err)}
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "python-requests/2.31.0")

	resp, err := client.Do(req)
	latencyMs := float64(time.Since(start).Milliseconds())
	if err != nil {
		return probeResult{LatencyMs: latencyMs}, &probeError{kind: probeErrOther, msg: fmt.Sprintf("network: %v", err)}
	}
	defer resp.Body.Close()

	// 404 + HTML body → wrong host/path. Caller will try next URL candidate.
	if resp.StatusCode == 404 {
		return probeResult{LatencyMs: latencyMs}, &probeError{kind: probeErrURL, msg: fmt.Sprintf("HTTP 404 at %s", endpoint)}
	}

	if resp.StatusCode >= 400 {
		// Read body once so we can both attempt JSON-decode AND fall back to raw text
		// when the upstream returns HTML / plain text (Cloudflare 5xx, nginx pages, …).
		// Without this fallback the operator-facing note degrades to just "HTTP 503".
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
		var errBody struct {
			Error struct {
				Code    string `json:"code"`
				Type    string `json:"type"`
				Message string `json:"message"`
			} `json:"error"`
		}
		_ = common.Unmarshal(bodyBytes, &errBody)
		code := strings.ToLower(errBody.Error.Code)
		if code == "" {
			code = strings.ToLower(errBody.Error.Type)
		}
		msg := strings.ToLower(errBody.Error.Message)
		if strings.Contains(code, "model_not_found") ||
			strings.Contains(msg, "model not found") ||
			strings.Contains(msg, "无可用渠道") ||
			strings.Contains(msg, "invalid model") {
			return probeResult{LatencyMs: latencyMs}, &probeError{kind: probeErrModel, msg: fmt.Sprintf("model not found: %s", modelName)}
		}
		// CC-only relays reject plain HTTP — mirror Flask's openai_compat detection.
		// packy:     403 "only accessible via the official claude cli"
		// rightcode: 400 "请选择使用正确的 Claude Code 客户端"
		// nekocode:  200 HTML (caught separately as non-JSON below)
		ccOnlyMarkers := []string{
			"only accessible via the official claude cli",
			"claude code 客户端",
			"correct claude code client",
		}
		isCCOnly := false
		for _, m := range ccOnlyMarkers {
			if strings.Contains(msg, m) {
				isCCOnly = true
				break
			}
		}
		if !isCCOnly && strings.Contains(code, "access_denied") && strings.Contains(msg, "访问被拒") {
			isCCOnly = true
		}
		if (resp.StatusCode == 400 || resp.StatusCode == 403) && isCCOnly {
			return probeResult{LatencyMs: latencyMs}, &probeError{kind: probeErrClaudeCliOnly, msg: "relay requires Claude Code CLI"}
		}
		detail := errBody.Error.Message
		if detail == "" {
			// Non-JSON body (e.g. HTML error page) — keep the first chunk so the operator
			// can tell if it's a Cloudflare/nginx page vs an upstream gateway error.
			detail = compactForNote(string(bodyBytes))
		}
		if len(detail) > 500 {
			detail = detail[:500] + "…"
		}
		ct := resp.Header.Get("Content-Type")
		ctTag := ""
		if ct != "" && !strings.Contains(strings.ToLower(ct), "json") {
			ctTag = fmt.Sprintf(" [%s]", strings.SplitN(ct, ";", 2)[0])
		}
		if detail == "" {
			return probeResult{LatencyMs: latencyMs}, &probeError{kind: probeErrOther, msg: fmt.Sprintf("HTTP %d%s (empty body)", resp.StatusCode, ctTag)}
		}
		return probeResult{LatencyMs: latencyMs}, &probeError{kind: probeErrOther, msg: fmt.Sprintf("HTTP %d%s: %s", resp.StatusCode, ctTag, detail)}
	}

	// 2xx — verify content is non-empty.
	bodyBytes2xx, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
	// HTML on 2xx means CDN/WAF (e.g. Cloudflare) blocked the request — try next URL candidate.
	ct2xx := strings.ToLower(resp.Header.Get("Content-Type"))
	if strings.Contains(ct2xx, "text/html") || (len(bodyBytes2xx) > 0 && bodyBytes2xx[0] == '<') {
		return probeResult{LatencyMs: latencyMs}, &probeError{kind: probeErrURL, msg: fmt.Sprintf("HTTP 200 returned HTML at %s (CDN block?)", endpoint)}
	}
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := common.Unmarshal(bodyBytes2xx, &parsed); err != nil {
		return probeResult{LatencyMs: latencyMs}, &probeError{kind: probeErrOther, msg: fmt.Sprintf("decode: %v", err)}
	}
	if len(parsed.Choices) == 0 || strings.TrimSpace(parsed.Choices[0].Message.Content) == "" {
		return probeResult{LatencyMs: latencyMs}, &probeError{kind: probeErrOther, msg: "empty content"}
	}
	return probeResult{LatencyMs: latencyMs}, nil
}

// compactForNote turns a raw error body (often an HTML error page) into a
// single-line snippet readable in the dot-grid tooltip. Strips tags + collapses
// whitespace; the caller still applies a length cap.
func compactForNote(body string) string {
	if body == "" {
		return ""
	}
	// Drop everything between < and >.
	var sb strings.Builder
	sb.Grow(len(body))
	inTag := false
	for _, r := range body {
		switch {
		case r == '<':
			inTag = true
		case r == '>':
			inTag = false
		case !inTag:
			sb.WriteRune(r)
		}
	}
	// Collapse whitespace runs.
	out := strings.Join(strings.Fields(sb.String()), " ")
	return strings.TrimSpace(out)
}

// stripKnownAPIPath returns the site root for common OpenAI-compatible API paths.
// Mirrors Flask's _strip_known_api_path.
func stripKnownAPIPath(baseURL string) string {
	u, err := url.Parse(baseURL)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return strings.TrimRight(baseURL, "/")
	}
	path := strings.TrimRight(u.Path, "/")
	lower := strings.ToLower(path)
	for _, suffix := range []string{
		"/api/v1/chat/completions",
		"/v1/chat/completions",
		"/chat/completions",
		"/api/v1",
		"/v1",
		"/api",
	} {
		if strings.HasSuffix(lower, suffix) {
			path = path[:len(path)-len(suffix)]
			path = strings.TrimRight(path, "/")
			break
		}
	}
	u.Path = path
	u.RawQuery = ""
	u.Fragment = ""
	return strings.TrimRight(u.String(), "/")
}

// baseURLCandidates generates compatible base URL candidates from user input.
// Mirrors Flask's _base_url_candidates exactly.
func baseURLCandidates(baseURL string) []string {
	raw := strings.TrimRight(baseURL, "/")
	root := stripKnownAPIPath(raw)

	roots := []string{root}
	if u, err := url.Parse(root); err == nil && u.Scheme != "" && u.Host != "" && !strings.HasPrefix(u.Host, "api.") {
		altU := *u
		altU.Host = "api." + u.Host
		roots = append(roots, strings.TrimRight(altU.String(), "/"))
	}

	out := []string{}
	seen := map[string]bool{}
	add := func(s string) {
		if s != "" && !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}

	// Raw input first (in case user explicitly chose an unusual path).
	add(raw)
	// Then site_root + each suffix, for each root variant.
	for _, r := range roots {
		for _, suffix := range urlSuffixes {
			add(r + suffix)
		}
	}
	return out
}

// buildChatCompletionsURL appends /chat/completions if not already present.
func buildChatCompletionsURL(baseURL string) string {
	b := strings.TrimRight(baseURL, "/")
	switch {
	case strings.HasSuffix(b, "/chat/completions"):
		return b
	case strings.HasSuffix(b, "/v1"), strings.HasSuffix(b, "/api/v1"):
		return b + "/chat/completions"
	default:
		return b + "/v1/chat/completions"
	}
}

// claudeCliUptimeProbe delegates a liveness probe to the Flask backend's
// /internal/uptime-probe endpoint, which runs the real claude CLI. Used for
// CC-only relays that reject plain HTTP. Returns (status, latencyMs, note).
func claudeCliUptimeProbe(ctx context.Context, baseURL, apiKey, modelName string) (string, float64, string) {
	flaskURL := os.Getenv("APIMASTER_FLASK_URL")
	if flaskURL == "" {
		flaskURL = autoDetectDefaultFlaskURL
	}
	reqBody, err := common.Marshal(map[string]string{
		"base_url": baseURL,
		"api_key":  apiKey,
		"model":    modelName,
	})
	if err != nil {
		return "notcomplete", 0, fmt.Sprintf("claude-cli probe marshal: %v", err)
	}
	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, flaskURL+"/internal/uptime-probe", bytes.NewReader(reqBody))
	if err != nil {
		return "notcomplete", 0, fmt.Sprintf("claude-cli probe build: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// claude CLI cold-start + inference runs slower than plain HTTP.
	client := &http.Client{Timeout: 3 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return "notcomplete", float64(time.Since(start).Milliseconds()), fmt.Sprintf("claude-cli probe: %v", err)
	}
	defer resp.Body.Close()

	var r struct {
		Ok        bool    `json:"ok"`
		LatencyMs float64 `json:"latency_ms"`
		Error     string  `json:"error"`
	}
	if err := common.DecodeJson(resp.Body, &r); err != nil {
		return "notcomplete", float64(time.Since(start).Milliseconds()), fmt.Sprintf("claude-cli probe decode: %v", err)
	}
	lat := r.LatencyMs
	if lat <= 0 {
		lat = float64(time.Since(start).Milliseconds())
	}
	if r.Ok {
		return "pass", lat, ""
	}
	return "notcomplete", lat, "claude-cli: " + r.Error
}

func recordUptimeResult(ch *model.Channel, targetModel, baseURL, status string, latencyMs float64, note string) {
	now := time.Now().Unix()
	logEntry := model.ChannelDetectLog{
		ChannelId:     ch.Id,
		Source:        "uptime",
		Status:        status,
		BaseURL:       baseURL,
		ClaimedModel:  targetModel,
		LatencyMeanMs: latencyMs,
		Note:          note,
		DetectTime:    now,
	}
	model.DB.Create(&logEntry)
}

// RunChannelUptimeNow triggers a single uptime (运行状态) probe for the given
// channel+model on-demand. Used by the "手动 ping" button in model-data UI.
// Reuses probeOneChannel verbatim (source='uptime'), so the result lands in
// channel_detect_logs identically to the scheduled uptime tick.
// Synchronous — callers should run in a goroutine.
func RunChannelUptimeNow(ch *model.Channel, targetModel string) {
	if ch == nil || ch.BaseURL == nil || *ch.BaseURL == "" {
		return
	}
	probeOneChannel(context.Background(), ch, targetModel)
}
