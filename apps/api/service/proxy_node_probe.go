package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/model"
)

const (
	ProxyNodeHealthFloor       = 0.05
	// ProxyNodeHealthyThreshold is the minimum health for a node to count as
	// healthy in the pool report. The decay floor (0.05) is deliberately below
	// it so a failing node stops counting as healthy while remaining recoverable.
	ProxyNodeHealthyThreshold  = 0.5
	proxyNodeHealthStep        = 0.1
	proxyNodeHealthDecay       = 0.7
	proxyNodeProbeCooldownBase = time.Second
	ProxyNodeProbeCooldownMax  = 16 * time.Second
	proxyNodeProbeTimeout      = 15 * time.Second
)

type ProxyNodeProbeResult struct {
	Node       model.ProxyNodePublic `json:"node"`
	Success    bool                  `json:"success"`
	DurationMS int64                 `json:"duration_ms"`
	Error      string                `json:"error,omitempty"`
}

type ProxyNodeProbeStats struct {
	Total   int64 `json:"total"`
	Success int64 `json:"success"`
	Active  int64 `json:"active"`
}

var proxyNodeProbeStats struct {
	total   atomic.Int64
	success atomic.Int64
	active  atomic.Int64
}

type proxyNodeProbeCounter struct {
	total   atomic.Int64
	success atomic.Int64
}

var (
	proxyNodeProbeCountersMu sync.RWMutex
	proxyNodeProbeCounters   = make(map[uint]*proxyNodeProbeCounter)
)

func getProxyNodeProbeCounter(id uint) *proxyNodeProbeCounter {
	proxyNodeProbeCountersMu.RLock()
	counter := proxyNodeProbeCounters[id]
	proxyNodeProbeCountersMu.RUnlock()
	if counter != nil {
		return counter
	}
	proxyNodeProbeCountersMu.Lock()
	defer proxyNodeProbeCountersMu.Unlock()
	if counter = proxyNodeProbeCounters[id]; counter == nil {
		counter = &proxyNodeProbeCounter{}
		proxyNodeProbeCounters[id] = counter
	}
	return counter
}

func GetProxyNodeProbeStatsFor(id uint) ProxyNodeProbeStats {
	counter := getProxyNodeProbeCounter(id)
	return ProxyNodeProbeStats{Total: counter.total.Load(), Success: counter.success.Load()}
}

func ResetProxyNodeProbeStatsFor(id uint) {
	proxyNodeProbeCountersMu.Lock()
	delete(proxyNodeProbeCounters, id)
	proxyNodeProbeCountersMu.Unlock()
}
func GetProxyNodeProbeStats() ProxyNodeProbeStats {
	return ProxyNodeProbeStats{
		Total:   proxyNodeProbeStats.total.Load(),
		Success: proxyNodeProbeStats.success.Load(),
		Active:  proxyNodeProbeStats.active.Load(),
	}
}

func ResetProxyNodeProbeStats() {
	proxyNodeProbeStats.total.Store(0)
	proxyNodeProbeStats.success.Store(0)
	proxyNodeProbeStats.active.Store(0)
}

func beginProxyNodeProbe() {
	proxyNodeProbeStats.total.Add(1)
	proxyNodeProbeStats.active.Add(1)
}

func recordProxyNodeProbeResult(success bool) {
	if success {
		proxyNodeProbeStats.success.Add(1)
	}
	proxyNodeProbeStats.active.Add(-1)
}

func ApplyProxyNodeProbeSuccess(node *model.ProxyNode, now time.Time) {
	node.Health = min(1, node.Health+proxyNodeHealthStep)
	node.FailureCount = 0
	node.CooldownUntil = nil
	node.LastError = ""
	node.LastProbeAt = &now
}

func ApplyProxyNodeProbeFailure(node *model.ProxyNode, now time.Time, probeError string) {
	node.Health = max(ProxyNodeHealthFloor, node.Health*proxyNodeHealthDecay)
	node.FailureCount++
	cooldown := now.Add(proxyNodeProbeCooldown(node.FailureCount))
	node.CooldownUntil = &cooldown
	node.LastError = redactProxyNodeProbeError(probeError)
	node.LastProbeAt = &now
}

func proxyNodeProbeCooldown(failureCount int) time.Duration {
	if failureCount < 1 {
		return 0
	}
	return min(ProxyNodeProbeCooldownMax, proxyNodeProbeCooldownBase<<min(failureCount-1, 4))
}

func ProbeProxyNode(ctx context.Context, node *model.ProxyNode) (*ProxyNodeProbeResult, error) {
	if node == nil {
		return nil, fmt.Errorf("proxy node is nil")
	}
	if model.DB == nil {
		return nil, fmt.Errorf("proxy node database is unavailable")
	}

	beginProxyNodeProbe()
	probeSucceeded := false
	counter := getProxyNodeProbeCounter(node.ID)
	counter.total.Add(1)
	defer func() {
		recordProxyNodeProbeResult(probeSucceeded)
		if probeSucceeded {
			counter.success.Add(1)
		}
	}()

	startedAt := time.Now()
	now := startedAt.UTC()
	result := &ProxyNodeProbeResult{Node: node.Public()}
	parsed, err := DecryptProxyNodeConfig(node)
	if err != nil {
		return persistProxyNodeProbeFailure(node, now, startedAt, result, err)
	}

	dialer, err := BuildSingBoxDialer(json.RawMessage(parsed.OutboundJSON))
	if err != nil {
		return persistProxyNodeProbeFailure(node, now, startedAt, result, err)
	}
	defer dialer.Close()

	probeCtx, cancel := context.WithTimeout(ctx, proxyNodeProbeTimeout)
	defer cancel()
	transport := &http.Transport{
		DialContext:         dialer.DialContext,
		TLSHandshakeTimeout: proxyNodeProbeTimeout,
		DisableKeepAlives:   true,
	}
	client := &http.Client{Transport: transport}
	defer transport.CloseIdleConnections()

	request, err := http.NewRequestWithContext(probeCtx, http.MethodHead, "https://www.gstatic.com/generate_204", nil)
	if err == nil {
		response, requestErr := client.Do(request)
		if response != nil {
			_, _ = io.Copy(io.Discard, response.Body)
			_ = response.Body.Close()
		}
		err = requestErr
	}
	if err != nil {
		return persistProxyNodeProbeFailure(node, now, startedAt, result, err)
	}

	ApplyProxyNodeProbeSuccess(node, now)
	if err := model.DB.Save(node).Error; err != nil {
		return nil, fmt.Errorf("persist proxy node probe success: %w", err)
	}
	result.Node = node.Public()
	result.Success = true
	result.DurationMS = time.Since(startedAt).Milliseconds()
	probeSucceeded = true
	return result, nil
}

func persistProxyNodeProbeFailure(node *model.ProxyNode, now, startedAt time.Time, result *ProxyNodeProbeResult, probeErr error) (*ProxyNodeProbeResult, error) {
	ApplyProxyNodeProbeFailure(node, now, probeErr.Error())
	if err := model.DB.Save(node).Error; err != nil {
		return nil, fmt.Errorf("persist proxy node probe failure: %w", err)
	}
	result.Node = node.Public()
	result.DurationMS = time.Since(startedAt).Milliseconds()
	result.Error = node.LastError
	return result, nil
}

func redactProxyNodeProbeError(probeError string) string {
	lower := strings.ToLower(probeError)
	switch {
	case strings.Contains(lower, "timeout"), strings.Contains(lower, "deadline"):
		return "probe timed out"
	case strings.Contains(lower, "tls"), strings.Contains(lower, "certificate"):
		return "TLS handshake failed"
	case strings.Contains(lower, "dial"), strings.Contains(lower, "connect"), strings.Contains(lower, "network"), strings.Contains(lower, "connection"):
		return "network connection failed"
	default:
		return "proxy handshake failed"
	}
}
