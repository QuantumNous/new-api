package controller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
)

// Upstream engines may advertise their maximum context window in the OpenAI
// /v1/models payload: vLLM and SGLang include a `max_model_len` field on each
// entry. Clients such as Claude Code rely on it to auto-configure context
// management (see QuantumNous/new-api#5847). A scheduled system task probes
// every enabled vLLM/SGLang channel, caches the advertised context per user
// model name, and buildOpenAIModel surfaces it on the user-facing /v1/models
// listing. Failures are silent per channel: an unresponsive upstream must not
// degrade the models listing.

const (
	// upstreamContextMaxResponseBytes bounds one /v1/models response, mirroring
	// the channel status probe (controller/channel_inference.go).
	upstreamContextMaxResponseBytes = 4 << 20
	// upstreamContextProbeConcurrency caps concurrent upstream requests per
	// sync pass so a large channel fleet cannot spike memory or connections.
	upstreamContextProbeConcurrency = 8
	// upstreamContextProbeTimeout bounds one upstream request.
	upstreamContextProbeTimeout = 10 * time.Second
	// defaultUpstreamContextSyncSeconds is the sync cadence when
	// UPSTREAM_CONTEXT_SYNC_FREQUENCY is unset (0 explicitly disables).
	defaultUpstreamContextSyncSeconds = 60
)

var (
	upstreamContextLock    sync.RWMutex
	upstreamContextByModel = map[string]int64{}
)

// GetUpstreamModelContextLength returns the cached max_model_len advertised by
// an upstream for the given user model name, or false when unknown.
func GetUpstreamModelContextLength(modelName string) (int64, bool) {
	upstreamContextLock.RLock()
	defer upstreamContextLock.RUnlock()
	length, ok := upstreamContextByModel[modelName]
	return length, ok
}

// seedUpstreamContextsForTest replaces the cache wholesale; test-only helper
// standing in for a completed sync pass.
func seedUpstreamContextsForTest(modelLengths map[string]int64) {
	upstreamContextLock.Lock()
	defer upstreamContextLock.Unlock()
	upstreamContextByModel = modelLengths
}

// upstreamModelContextEntry mirrors the subset of the OpenAI models payload we
// care about. vLLM/SGLang entries look like:
// {"id":"GLM-5.3-Flash","object":"model",...,"max_model_len":1048576}
type upstreamModelContextEntry struct {
	ID          string `json:"id"`
	MaxModelLen *int64 `json:"max_model_len"`
}

type upstreamModelContextResponse struct {
	Data []upstreamModelContextEntry `json:"data"`
}

// upstreamContextProbe describes one channel to probe during a sync pass.
type upstreamContextProbe struct {
	channel *model.Channel
	baseURL string
}

// channelsEligibleForContextProbe lists enabled channels whose upstream speaks
// the OpenAI models protocol AND reports max_model_len. Only the engine
// channel types do today (vLLM, SGLang); probing other providers would spam
// their /v1/models with signed requests that never carry the field.
func channelsEligibleForContextProbe() []upstreamContextProbe {
	abilities, err := model.GetAllEnableAbilityWithChannels()
	if err != nil {
		common.SysLog(fmt.Sprintf("upstream context probe: load abilities error: %v", err))
		return nil
	}
	seen := make(map[int]struct{})
	probes := make([]upstreamContextProbe, 0, len(abilities))
	for _, ability := range abilities {
		switch ability.ChannelType {
		case constant.ChannelTypeVLLM, constant.ChannelTypeSGLang:
		default:
			continue
		}
		if _, ok := seen[ability.ChannelId]; ok {
			continue
		}
		channel, err := model.CacheGetChannel(ability.ChannelId)
		if err != nil || channel == nil || channel.Status != common.ChannelStatusEnabled {
			continue
		}
		baseURL := strings.TrimRight(strings.TrimSpace(channel.GetBaseURL()), "/")
		if baseURL == "" {
			continue
		}
		if _, err := validateUpstreamContextBaseURL(baseURL); err != nil {
			continue
		}
		seen[ability.ChannelId] = struct{}{}
		probes = append(probes, upstreamContextProbe{channel: channel, baseURL: baseURL})
	}
	return probes
}

// validateUpstreamContextBaseURL applies the same URL safety rules as the
// channel status probe: http(s) only, non-empty host, no userinfo, no query,
// no fragment. This keeps operator-configured base URLs from becoming an SSRF
// or credential-leak vector when the probe attaches the channel key.
func validateUpstreamContextBaseURL(baseURL string) (*url.URL, error) {
	parsedURL, err := url.Parse(baseURL)
	if err != nil || parsedURL.Host == "" || parsedURL.User != nil || parsedURL.RawQuery != "" || parsedURL.Fragment != "" || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		return nil, errors.New("invalid inference server address")
	}
	return parsedURL, nil
}

// probeChannelUpstreamContext fetches GET {base}/v1/models on one channel. A
// nil error means the upstream answered with a well-formed models list — even
// if it advertised no max_model_len at all (limits may still be empty).
func probeChannelUpstreamContext(ctx context.Context, probe upstreamContextProbe) (map[string]int64, error) {
	channel := probe.channel
	key, _, keyErr := channel.GetNextEnabledKey()
	if keyErr != nil {
		return nil, keyErr
	}
	key = strings.TrimSpace(key)
	parsedURL, err := validateUpstreamContextBaseURL(probe.baseURL)
	if err != nil {
		return nil, err
	}
	// Engine channels use an empty key or EMPTY for unauthenticated access.
	// Never send a real channel credential over plaintext HTTP.
	if key != "" && key != "EMPTY" && parsedURL.Scheme != "https" {
		return nil, errors.New("upstream context probes with credentials require HTTPS")
	}

	headers, err := buildFetchModelsHeaders(channel, key)
	if err != nil {
		return nil, err
	}
	if (key == "" || key == "EMPTY") && headers.Get("Authorization") == "Bearer "+key {
		headers.Del("Authorization")
	}

	settings := channel.GetSetting()
	client, err := service.GetHttpClientWithProxySettings(settings.Proxy, settings)
	if err != nil {
		return nil, err
	}
	// Do not mutate the shared client or forward channel credentials on
	// redirects (mirrors the channel status probe).
	statusClient := *client
	statusClient.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}

	requestCtx, cancel := context.WithTimeout(ctx, upstreamContextProbeTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(requestCtx, http.MethodGet, probe.baseURL+"/v1/models", nil)
	if err != nil {
		return nil, err
	}
	req.Header = headers.Clone()
	if host := headers.Get("Host"); host != "" {
		req.Host = host
	}
	resp, err := statusClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status code: %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, upstreamContextMaxResponseBytes+1))
	if err != nil {
		return nil, err
	}
	if len(body) > upstreamContextMaxResponseBytes {
		return nil, errors.New("response_too_large")
	}
	var payload upstreamModelContextResponse
	if err := common.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	collected := make(map[string]int64)
	for _, entry := range payload.Data {
		name := strings.TrimSpace(entry.ID)
		if name == "" || entry.MaxModelLen == nil || *entry.MaxModelLen <= 0 {
			continue
		}
		// Duplicated engine IDs keep the smallest advertised bound.
		if existing, ok := collected[name]; !ok || *entry.MaxModelLen < existing {
			collected[name] = *entry.MaxModelLen
		}
	}
	return collected, nil
}

// engineModelToUserNames maps one engine-side model name back to every
// user-facing name that can route to it on this channel: the engine name
// itself (when the channel serves it directly) plus every model_mapping
// source that targets it. Without this, a channel configured with
// model_mapping would never surface a context length.
func engineModelToUserNames(channel *model.Channel, engineName string) []string {
	names := map[string]struct{}{}
	for _, served := range channel.GetModels() {
		served = strings.TrimSpace(served)
		if served == "" {
			continue
		}
		if served == engineName {
			names[served] = struct{}{}
			continue
		}
		// Walk the channel's mapping chain from this served name; if it lands
		// on the engine name, the served name routes to it. Cycle-safe: only
		// follow each name once.
		current := served
		visited := map[string]struct{}{current: {}}
		for hops := 0; hops < 8; hops++ {
			mapping := normalizeChannelModelMapping(channel)
			if mapping == nil {
				break
			}
			next, ok := mapping[current]
			if !ok || next == "" {
				break
			}
			if _, seen := visited[next]; seen {
				break
			}
			visited[next] = struct{}{}
			current = next
			if current == engineName {
				names[served] = struct{}{}
				break
			}
		}
	}
	result := make([]string, 0, len(names))
	for name := range names {
		result = append(result, name)
	}
	return result
}

// SyncUpstreamModelContexts probes every eligible enabled channel once with a
// bounded worker pool and swaps the cache afterwards, so readers never see a
// half-updated map. When several channels serve the same user model, the
// smallest advertised value wins: it is the only bound every serving channel
// can honour. A sync pass only replaces the cache when it observed at least
// one healthy engine; if every probe failed (or the channel list could not be
// loaded), the previous cache stays as last-known-good instead of going dark.
// Individual failed channels simply drop out of the fresh map.
func SyncUpstreamModelContexts(ctx context.Context) {
	probes := channelsEligibleForContextProbe()
	fresh := make(map[string]int64)
	healthy := 0
	var mu sync.Mutex
	var wg sync.WaitGroup
	// Buffered channel as a semaphore: at most N probes in flight.
	sem := make(chan struct{}, upstreamContextProbeConcurrency)
	for _, probe := range probes {
		wg.Add(1)
		go func(probe upstreamContextProbe) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			collected, err := probeChannelUpstreamContext(ctx, probe)
			if err != nil {
				return
			}
			mu.Lock()
			defer mu.Unlock()
			// A well-formed reply counts as healthy even when it advertises
			// no limits: the engine dropped the field, so the fresh cache
			// must drop the stale values for this channel's models.
			healthy++
			for engineName, length := range collected {
				for _, userName := range engineModelToUserNames(probe.channel, engineName) {
					if existing, ok := fresh[userName]; !ok || length < existing {
						fresh[userName] = length
					}
				}
			}
		}(probe)
	}
	wg.Wait()

	if len(probes) > 0 && healthy == 0 {
		// Every upstream failed: likely a transient outage. Keep serving the
		// previously observed limits rather than withdrawing them.
		return
	}

	upstreamContextLock.Lock()
	defer upstreamContextLock.Unlock()
	upstreamContextByModel = fresh
	if len(fresh) > 0 {
		common.SysLog(fmt.Sprintf("upstream context sync: %d model(s) with advertised max_model_len", len(fresh)))
	}
}

// upstreamContextSystemTaskHandler runs the context sync inside the scheduled
// system task framework: the DB lease dedups execution across master nodes
// and the runner provides cancellable contexts, so no bespoke background
// goroutine or shutdown wiring is needed.
type upstreamContextSystemTaskHandler struct{}

func (upstreamContextSystemTaskHandler) Type() string { return model.SystemTaskTypeUpstreamContext }

// Enabled defaults to on (one sync per minute); UPSTREAM_CONTEXT_SYNC_FREQUENCY=0
// disables the sync task entirely.
func (upstreamContextSystemTaskHandler) Enabled() bool {
	return common.GetEnvOrDefault("UPSTREAM_CONTEXT_SYNC_FREQUENCY", defaultUpstreamContextSyncSeconds) > 0
}

// Interval: one sync pass per minute by default, overridable via env (seconds).
func (upstreamContextSystemTaskHandler) Interval() time.Duration {
	seconds := common.GetEnvOrDefault("UPSTREAM_CONTEXT_SYNC_FREQUENCY", defaultUpstreamContextSyncSeconds)
	if seconds < 5 {
		seconds = 5
	}
	return time.Duration(seconds) * time.Second
}

func (upstreamContextSystemTaskHandler) NewPayload() any { return nil }

func (upstreamContextSystemTaskHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	SyncUpstreamModelContexts(ctx)
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, nil, nil)
}
