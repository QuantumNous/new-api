package service

import (
	"context"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/bytedance/gopkg/util/gopool"
)

const (
	defaultUpstreamWarmupInterval    = 30 * time.Second
	defaultUpstreamWarmupTimeout     = 10 * time.Second
	minUpstreamWarmupInterval        = 5 * time.Second
	defaultUpstreamWarmupPath        = "/v1/models"
	defaultUpstreamWarmupUA          = "new-api-upstream-warmup/1.0"
	defaultUpstreamWarmupConcurrency = 8
	defaultUpstreamWarmupH1Conns     = 1
	minUpstreamWarmupConcurrency     = 1
	maxUpstreamWarmupConcurrency     = 32
)

var warmupForbiddenSubpaths = []string{
	"/chat/completions", "/responses", "/images/generations",
	"/embeddings", "/audio/", "/moderations", "/completions",
}

var (
	warmupProtoStore          sync.Map
	buildWarmupTargetsHook    = buildWarmupTargets
	upstreamWarmupEnabledHook = upstreamWarmupEnabled
)

type warmupTarget struct {
	key    string
	url    string
	host   string
	proxy  string
	client *http.Client
}

func StartUpstreamWarmupTask() {
	interval := parseUpstreamWarmupDuration("UPSTREAM_WARMUP_INTERVAL", defaultUpstreamWarmupInterval)
	if interval < minUpstreamWarmupInterval {
		interval = minUpstreamWarmupInterval
	}
	timeout := parseUpstreamWarmupDuration("UPSTREAM_WARMUP_TIMEOUT", defaultUpstreamWarmupTimeout)
	jitter := parseUpstreamWarmupJitter("UPSTREAM_WARMUP_JITTER", 0.2)

	common.SysLog(fmt.Sprintf(
		"upstream warmup task started: enabled=%t interval=%s timeout=%s jitter=%.2f concurrency=%d h1_connections=%d user_agent=%q",
		upstreamWarmupEnabled(),
		interval,
		timeout,
		jitter,
		upstreamWarmupConcurrency(),
		upstreamWarmupH1Connections(),
		upstreamWarmupUserAgent(),
	))
	gopool.Go(func() {
		for {
			runUpstreamWarmupTick(timeout)
			time.Sleep(withJitter(interval, jitter))
		}
	})
}

// runUpstreamWarmupTick executes a single warmup round. Panic recovery is scoped
// to one tick so an occasional panic cannot permanently kill the warmup loop.
func runUpstreamWarmupTick(timeout time.Duration) {
	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("upstream warmup tick panic recovered: %v", r))
		}
	}()
	if !upstreamWarmupEnabledHook() {
		return
	}
	targets := buildWarmupTargetsHook()
	pruneWarmupStatus(targets)
	if len(targets) > 0 {
		warmTargets(targets, timeout)
	}
}

func buildWarmupTargets() []warmupTarget {
	seen := make(map[string]bool)
	var targets []warmupTarget

	for _, raw := range parseUpstreamWarmupURLs(os.Getenv("UPSTREAM_WARMUP_URLS")) {
		if target, ok := makeTargetFromURL(raw, "", seen); ok {
			targets = append(targets, target)
		}
	}

	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		common.SysError(fmt.Sprintf("upstream warmup: load channels failed: %v", err))
		return targets
	}
	for _, channel := range channels {
		if channel.Status != common.ChannelStatusEnabled {
			continue
		}
		if !channel.GetOtherSettings().UpstreamWarmupEnabled {
			continue
		}

		base := channel.GetBaseURL()
		if base == "" && channel.Type >= 0 && channel.Type < len(constant.ChannelBaseURLs) {
			base = constant.ChannelBaseURLs[channel.Type]
		}
		if base == "" {
			continue
		}

		warmURL := joinWarmupPath(base, warmupPath())
		if target, ok := makeTargetFromURL(warmURL, channel.GetSetting().Proxy, seen); ok {
			targets = append(targets, target)
		}
	}
	return targets
}

func makeTargetFromURL(rawURL, proxy string, seen map[string]bool) (warmupTarget, bool) {
	rawURL = strings.TrimSpace(rawURL)
	u, err := url.Parse(rawURL)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return warmupTarget{}, false
	}

	lowerPath := strings.ToLower(u.Path)
	for _, bad := range warmupForbiddenSubpaths {
		if strings.Contains(lowerPath, bad) {
			common.SysError(fmt.Sprintf("upstream warmup: refuse billable path %q", rawURL))
			return warmupTarget{}, false
		}
	}

	key := u.Scheme + "://" + u.Host + "|" + proxy
	if seen[key] {
		return warmupTarget{}, false
	}
	seen[key] = true

	var client *http.Client
	if proxy == "" {
		client = GetHttpClient()
	} else {
		client, err = NewProxyHttpClient(proxy)
		if err != nil {
			common.SysError(fmt.Sprintf("upstream warmup: proxy client failed for %q: %v", proxy, err))
			return warmupTarget{}, false
		}
	}
	if client == nil {
		client = http.DefaultClient
	}

	return warmupTarget{key: key, url: rawURL, host: u.Host, proxy: proxy, client: client}, true
}

func warmTargets(targets []warmupTarget, timeout time.Duration) {
	concurrency := upstreamWarmupConcurrency()
	if concurrency > len(targets) {
		concurrency = len(targets)
	}
	if concurrency < minUpstreamWarmupConcurrency {
		concurrency = minUpstreamWarmupConcurrency
	}

	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	for _, target := range targets {
		attempts := warmupAttemptCount(target)
		for i := 0; i < attempts; i++ {
			target := target
			wg.Add(1)
			sem <- struct{}{}
			gopool.Go(func() {
				defer wg.Done()
				defer func() {
					<-sem
				}()
				defer func() {
					if r := recover(); r != nil {
						recordWarmupFailure(target, 0, fmt.Errorf("warmup worker panic: %v", r))
					}
				}()
				warmOneTarget(target, timeout)
			})
		}
	}
	wg.Wait()
}

func warmupAttemptCount(target warmupTarget) int {
	if protoMajor, ok := cachedWarmupProto(target); ok && protoMajor == 1 {
		return upstreamWarmupH1Connections()
	}
	return 1
}

func warmOneTarget(target warmupTarget, timeout time.Duration) {
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target.url, nil)
	if err != nil {
		recordWarmupFailure(target, 0, err)
		return
	}

	req.Header.Set("Accept", "*/*")
	req.Header.Set("User-Agent", upstreamWarmupUserAgent())

	client := target.client
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		recordWarmupFailure(target, 0, err)
		return
	}
	recordWarmupProto(target, resp.ProtoMajor)

	bytesRead, drainErr := io.Copy(io.Discard, resp.Body)
	closeErr := resp.Body.Close()
	latency := time.Since(start)
	if drainErr != nil || closeErr != nil {
		recordWarmupDrainFailure(target, resp.StatusCode, latency, bytesRead, drainErr, closeErr)
		return
	}
	recordWarmupReusableSuccess(target, resp.StatusCode, latency)
}

func parseUpstreamWarmupURLs(raw string) []string {
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == ';' || r == '\n' || r == '\r' || r == '\t' || r == ' '
	})

	urls := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			urls = append(urls, part)
		}
	}
	return urls
}

func parseUpstreamWarmupDuration(envName string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(envName))
	if raw == "" {
		return fallback
	}

	if seconds, err := strconv.Atoi(raw); err == nil {
		return time.Duration(seconds) * time.Second
	}

	duration, err := time.ParseDuration(raw)
	if err != nil {
		common.SysError(fmt.Sprintf("invalid %s=%q, using %s", envName, raw, fallback))
		return fallback
	}
	return duration
}

func warmupPath() string {
	if path := strings.TrimSpace(os.Getenv("UPSTREAM_WARMUP_PATH")); path != "" {
		return path
	}
	return defaultUpstreamWarmupPath
}

func joinWarmupPath(base, path string) string {
	return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(path, "/")
}

func withJitter(d time.Duration, frac float64) time.Duration {
	if frac <= 0 {
		return d
	}
	delta := float64(d) * frac
	return time.Duration(float64(d) - delta + rand.Float64()*2*delta)
}

func parseUpstreamWarmupJitter(envName string, fallback float64) float64 {
	raw := strings.TrimSpace(os.Getenv(envName))
	if raw == "" {
		return fallback
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil || value < 0 || value > 0.5 {
		return fallback
	}
	return value
}

func upstreamWarmupConcurrency() int {
	return parseUpstreamWarmupConcurrency("UPSTREAM_WARMUP_CONCURRENCY", defaultUpstreamWarmupConcurrency)
}

func parseUpstreamWarmupConcurrency(envName string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(envName))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		common.SysError(fmt.Sprintf("invalid %s=%q, using %d", envName, raw, fallback))
		return fallback
	}
	if value < minUpstreamWarmupConcurrency {
		return minUpstreamWarmupConcurrency
	}
	if value > maxUpstreamWarmupConcurrency {
		return maxUpstreamWarmupConcurrency
	}
	return value
}

func upstreamWarmupH1Connections() int {
	return parseUpstreamWarmupConcurrency("UPSTREAM_WARMUP_H1_CONNECTIONS", defaultUpstreamWarmupH1Conns)
}

func upstreamWarmupUserAgent() string {
	if ua := strings.TrimSpace(os.Getenv("UPSTREAM_WARMUP_UA")); ua != "" {
		return ua
	}
	return defaultUpstreamWarmupUA
}

func recordWarmupProto(target warmupTarget, protoMajor int) {
	if protoMajor > 0 {
		warmupProtoStore.Store(target.key, protoMajor)
	}
}

func cachedWarmupProto(target warmupTarget) (int, bool) {
	value, ok := warmupProtoStore.Load(target.key)
	if !ok {
		return 0, false
	}
	protoMajor, ok := value.(int)
	return protoMajor, ok
}

func upstreamWarmupEnabled() bool {
	return common.UpstreamWarmupEnabled.Load()
}
