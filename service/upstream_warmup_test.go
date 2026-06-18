package service

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/http/httptrace"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestParseUpstreamWarmupURLs(t *testing.T) {
	raw := " https://a.example/v1/models,https://b.example ;\nhttps://c.example\t https://d.example "
	got := parseUpstreamWarmupURLs(raw)
	want := []string{
		"https://a.example/v1/models",
		"https://b.example",
		"https://c.example",
		"https://d.example",
	}
	if len(got) != len(want) {
		t.Fatalf("expected %d urls, got %d: %#v", len(want), len(got), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("url %d: expected %q, got %q", i, want[i], got[i])
		}
	}

	if got := parseUpstreamWarmupURLs(" \n\t ; , "); len(got) != 0 {
		t.Fatalf("expected empty urls for blank input, got %#v", got)
	}
}

func TestParseUpstreamWarmupDuration(t *testing.T) {
	const envName = "TEST_UPSTREAM_WARMUP_DURATION"
	fallback := 30 * time.Second

	t.Setenv(envName, "")
	if got := parseUpstreamWarmupDuration(envName, fallback); got != fallback {
		t.Fatalf("blank env: expected %s, got %s", fallback, got)
	}

	t.Setenv(envName, "25")
	if got := parseUpstreamWarmupDuration(envName, fallback); got != 25*time.Second {
		t.Fatalf("numeric env: expected 25s, got %s", got)
	}

	t.Setenv(envName, "1m")
	if got := parseUpstreamWarmupDuration(envName, fallback); got != time.Minute {
		t.Fatalf("duration env: expected 1m, got %s", got)
	}

	t.Setenv(envName, "not-a-duration")
	if got := parseUpstreamWarmupDuration(envName, fallback); got != fallback {
		t.Fatalf("invalid env: expected fallback %s, got %s", fallback, got)
	}
}

func TestParseUpstreamWarmupJitter(t *testing.T) {
	const envName = "TEST_UPSTREAM_WARMUP_JITTER"
	fallback := 0.2

	t.Setenv(envName, "")
	if got := parseUpstreamWarmupJitter(envName, fallback); got != fallback {
		t.Fatalf("blank env: expected %.2f, got %.2f", fallback, got)
	}

	t.Setenv(envName, "0.35")
	if got := parseUpstreamWarmupJitter(envName, fallback); got != 0.35 {
		t.Fatalf("valid env: expected 0.35, got %.2f", got)
	}

	for _, value := range []string{"-0.1", "0.6", "invalid"} {
		t.Setenv(envName, value)
		if got := parseUpstreamWarmupJitter(envName, fallback); got != fallback {
			t.Fatalf("invalid env %q: expected %.2f, got %.2f", value, fallback, got)
		}
	}
}

func TestParseUpstreamWarmupConcurrency(t *testing.T) {
	const envName = "TEST_UPSTREAM_WARMUP_CONCURRENCY"

	t.Setenv(envName, "")
	if got := parseUpstreamWarmupConcurrency(envName, 8); got != 8 {
		t.Fatalf("blank env: expected fallback 8, got %d", got)
	}

	t.Setenv(envName, "16")
	if got := parseUpstreamWarmupConcurrency(envName, 8); got != 16 {
		t.Fatalf("valid env: expected 16, got %d", got)
	}

	t.Setenv(envName, "0")
	if got := parseUpstreamWarmupConcurrency(envName, 8); got != minUpstreamWarmupConcurrency {
		t.Fatalf("low env: expected min %d, got %d", minUpstreamWarmupConcurrency, got)
	}

	t.Setenv(envName, "64")
	if got := parseUpstreamWarmupConcurrency(envName, 8); got != maxUpstreamWarmupConcurrency {
		t.Fatalf("high env: expected max %d, got %d", maxUpstreamWarmupConcurrency, got)
	}

	t.Setenv(envName, "invalid")
	if got := parseUpstreamWarmupConcurrency(envName, 8); got != 8 {
		t.Fatalf("invalid env: expected fallback 8, got %d", got)
	}
}

func TestMakeTargetFromURL_Dedup(t *testing.T) {
	seen := make(map[string]bool)

	first, ok := makeTargetFromURL("https://api.example.com/v1/models", "", seen)
	if !ok {
		t.Fatal("expected first target to be accepted")
	}
	if first.key != "https://api.example.com|" || first.host != "api.example.com" || first.proxy != "" {
		t.Fatalf("unexpected first target: %#v", first)
	}

	if _, ok := makeTargetFromURL("https://api.example.com/anything", "", seen); ok {
		t.Fatal("expected duplicate scheme/host/proxy target to be rejected")
	}

	proxied, ok := makeTargetFromURL("https://api.example.com/v1/models", "http://proxy.example:8080", seen)
	if !ok {
		t.Fatal("expected same host with different proxy to be accepted")
	}
	if proxied.key != "https://api.example.com|http://proxy.example:8080" || proxied.proxy != "http://proxy.example:8080" {
		t.Fatalf("unexpected proxied target: %#v", proxied)
	}
}

func TestMakeTargetFromURL_ForbiddenPath(t *testing.T) {
	seen := make(map[string]bool)
	for _, rawURL := range []string{
		"https://api.example.com/v1/chat/completions",
		"https://api.example.com/v1/responses",
		"https://api.example.com/v1/images/generations",
	} {
		if _, ok := makeTargetFromURL(rawURL, "", seen); ok {
			t.Fatalf("expected billable path %q to be rejected", rawURL)
		}
	}
}

func TestJoinWarmupPath(t *testing.T) {
	tests := []struct {
		name string
		base string
		path string
		want string
	}{
		{name: "both clean", base: "https://api.example.com", path: "v1/models", want: "https://api.example.com/v1/models"},
		{name: "base trailing slash", base: "https://api.example.com/", path: "v1/models", want: "https://api.example.com/v1/models"},
		{name: "path leading slash", base: "https://api.example.com", path: "/v1/models", want: "https://api.example.com/v1/models"},
		{name: "both slashes", base: "https://api.example.com/", path: "/v1/models", want: "https://api.example.com/v1/models"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := joinWarmupPath(tt.base, tt.path); got != tt.want {
				t.Fatalf("expected %q, got %q", tt.want, got)
			}
		})
	}
}

func TestWithJitter(t *testing.T) {
	d := 30 * time.Second
	if got := withJitter(d, 0); got != d {
		t.Fatalf("frac=0: expected %s, got %s", d, got)
	}

	frac := 0.2
	min := time.Duration(float64(d) * (1 - frac))
	max := time.Duration(float64(d) * (1 + frac))
	for i := 0; i < 100; i++ {
		got := withJitter(d, frac)
		if got < min || got > max {
			t.Fatalf("jitter result %s out of range [%s, %s]", got, min, max)
		}
	}
}

func TestWarmTargets_DrainsLargeBodyAndReusesConnection(t *testing.T) {
	resetWarmupStatusForTest()
	body := make([]byte, 2<<20)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(body)
	}))
	defer server.Close()

	client := server.Client()
	target := warmupTarget{
		key:    "test-large-body",
		url:    server.URL,
		host:   "example.test",
		client: client,
	}

	warmTargets([]warmupTarget{target}, time.Second)

	status := loadOrInitWarmupStatus(target)
	if status.ConnectSuccessCount != 1 {
		t.Fatalf("ConnectSuccessCount = %d, want 1", status.ConnectSuccessCount)
	}
	if status.ReusableSuccessCount != 1 {
		t.Fatalf("ReusableSuccessCount = %d, want 1", status.ReusableSuccessCount)
	}
	if status.DrainFailureCount != 0 {
		t.Fatalf("DrainFailureCount = %d, want 0", status.DrainFailureCount)
	}

	reused := false
	req, err := http.NewRequest(http.MethodGet, server.URL, nil)
	if err != nil {
		t.Fatal(err)
	}
	req = req.WithContext(httptrace.WithClientTrace(req.Context(), &httptrace.ClientTrace{
		GotConn: func(info httptrace.GotConnInfo) {
			reused = info.Reused
		},
	}))
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("follow-up request failed: %v", err)
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	_ = resp.Body.Close()
	if !reused {
		t.Fatal("follow-up request did not reuse the drained warmup connection")
	}
}

func TestWarmTargets_DrainFailureIsNotReusableSuccess(t *testing.T) {
	resetWarmupStatusForTest()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		if flusher, ok := w.(http.Flusher); ok {
			_, _ = w.Write([]byte("partial"))
			flusher.Flush()
		}
		time.Sleep(200 * time.Millisecond)
	}))
	defer server.Close()

	target := warmupTarget{
		key:    "test-drain-failure",
		url:    server.URL,
		host:   "example.test",
		client: server.Client(),
	}
	warmTargets([]warmupTarget{target}, 20*time.Millisecond)

	status := loadOrInitWarmupStatus(target)
	if status.ConnectSuccessCount != 1 {
		t.Fatalf("ConnectSuccessCount = %d, want 1", status.ConnectSuccessCount)
	}
	if status.ReusableSuccessCount != 0 {
		t.Fatalf("ReusableSuccessCount = %d, want 0", status.ReusableSuccessCount)
	}
	if status.DrainFailureCount != 1 {
		t.Fatalf("DrainFailureCount = %d, want 1", status.DrainFailureCount)
	}
	if status.LastError == "" {
		t.Fatal("LastError is empty after drain failure")
	}
}

func TestWarmTargets_ReusableConnectionCanHave4xxBusinessStatus(t *testing.T) {
	resetWarmupStatusForTest()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte("forbidden but drained"))
	}))
	defer server.Close()

	target := warmupTarget{
		key:    "test-4xx-reusable",
		url:    server.URL,
		host:   "example.test",
		client: server.Client(),
	}
	warmTargets([]warmupTarget{target}, time.Second)

	// Business 4xx is separate from transport reuse: a fully drained response still leaves a reusable connection.
	status := loadOrInitWarmupStatus(target)
	if status.ConnectSuccessCount != 1 {
		t.Fatalf("ConnectSuccessCount = %d, want 1", status.ConnectSuccessCount)
	}
	if status.ReusableSuccessCount != 1 {
		t.Fatalf("ReusableSuccessCount = %d, want 1", status.ReusableSuccessCount)
	}
	if status.LastError != "" {
		t.Fatalf("LastError = %q, want empty", status.LastError)
	}
	if status.LastStatusCode != http.StatusForbidden {
		t.Fatalf("LastStatusCode = %d, want %d", status.LastStatusCode, http.StatusForbidden)
	}
}

func TestUpstreamWarmupUserAgentDefault(t *testing.T) {
	t.Setenv("UPSTREAM_WARMUP_UA", "")
	if got := upstreamWarmupUserAgent(); got != defaultUpstreamWarmupUA {
		t.Fatalf("default User-Agent = %q, want %q", got, defaultUpstreamWarmupUA)
	}
}

func TestWarmTargets_UsesConfiguredUserAgent(t *testing.T) {
	resetWarmupStatusForTest()
	t.Setenv("UPSTREAM_WARMUP_UA", "custom-warmup-agent")

	var gotUA string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUA = r.Header.Get("User-Agent")
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	warmTargets([]warmupTarget{{
		key:    "test-ua",
		url:    server.URL,
		host:   "example.test",
		client: server.Client(),
	}}, time.Second)

	if gotUA != "custom-warmup-agent" {
		t.Fatalf("User-Agent = %q, want custom-warmup-agent", gotUA)
	}
}

func TestWarmTargets_RunsTargetsConcurrently(t *testing.T) {
	resetWarmupStatusForTest()
	t.Setenv("UPSTREAM_WARMUP_CONCURRENCY", "2")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(150 * time.Millisecond)
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	targets := []warmupTarget{
		{key: "concurrent-1", url: server.URL, host: "one.test", client: server.Client()},
		{key: "concurrent-2", url: server.URL, host: "two.test", client: server.Client()},
	}
	start := time.Now()
	warmTargets(targets, time.Second)
	elapsed := time.Since(start)

	if elapsed >= 250*time.Millisecond {
		t.Fatalf("warmTargets took %s, expected concurrent execution below 250ms", elapsed)
	}
}

func TestWarmTargets_PeakConcurrencyDoesNotExceedLimit(t *testing.T) {
	resetWarmupStatusForTest()
	const concurrencyLimit = 2
	t.Setenv("UPSTREAM_WARMUP_CONCURRENCY", "2")

	var inflight atomic.Int64
	var peak atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		current := inflight.Add(1)
		defer inflight.Add(-1)
		for {
			observedPeak := peak.Load()
			if current <= observedPeak || peak.CompareAndSwap(observedPeak, current) {
				break
			}
		}
		time.Sleep(80 * time.Millisecond)
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	targets := make([]warmupTarget, 0, 8)
	for i := 0; i < 8; i++ {
		targets = append(targets, warmupTarget{
			key:    "peak-concurrency-" + strconv.Itoa(i),
			url:    server.URL,
			host:   "example.test",
			client: server.Client(),
		})
	}
	warmTargets(targets, time.Second)

	if got := peak.Load(); got > concurrencyLimit {
		t.Fatalf("peak concurrency = %d, want <= %d", got, concurrencyLimit)
	}
}

func TestRunUpstreamWarmupTick_RecoversTargetBuilderPanic(t *testing.T) {
	resetWarmupStatusForTest()
	originalEnabledHook := upstreamWarmupEnabledHook
	upstreamWarmupEnabledHook = func() bool { return true }
	originalHook := buildWarmupTargetsHook
	buildWarmupTargetsHook = func() []warmupTarget {
		panic("target builder panic")
	}
	t.Cleanup(func() {
		upstreamWarmupEnabledHook = originalEnabledHook
		buildWarmupTargetsHook = originalHook
	})

	runUpstreamWarmupTick(time.Millisecond)
}

func TestWarmTargets_H1UsesConfiguredConnectionCountAfterProtocolCache(t *testing.T) {
	resetWarmupStatusForTest()
	t.Setenv("UPSTREAM_WARMUP_H1_CONNECTIONS", "3")

	var requests atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	target := warmupTarget{
		key:    "h1-target",
		url:    server.URL,
		host:   "h1.example.test",
		client: server.Client(),
	}
	warmTargets([]warmupTarget{target}, time.Second)
	if got := requests.Load(); got != 1 {
		t.Fatalf("first unknown-protocol tick requests = %d, want 1", got)
	}

	warmTargets([]warmupTarget{target}, time.Second)
	if got := requests.Load(); got != 4 {
		t.Fatalf("second cached-h1 tick total requests = %d, want 4", got)
	}

	status := loadOrInitWarmupStatus(target)
	if status.ConnectSuccessCount != 4 {
		t.Fatalf("ConnectSuccessCount = %d, want 4", status.ConnectSuccessCount)
	}
}

func TestWarmTargets_H2DoesNotUseH1ConnectionCount(t *testing.T) {
	resetWarmupStatusForTest()
	t.Setenv("UPSTREAM_WARMUP_H1_CONNECTIONS", "3")

	var requests atomic.Int64
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		_, _ = w.Write([]byte("ok"))
	}))
	server.EnableHTTP2 = true
	server.StartTLS()
	defer server.Close()

	target := warmupTarget{
		key:    "h2-target",
		url:    server.URL,
		host:   "h2.example.test",
		client: server.Client(),
	}
	warmTargets([]warmupTarget{target}, time.Second)
	warmTargets([]warmupTarget{target}, time.Second)

	if got := requests.Load(); got != 2 {
		t.Fatalf("h2 total requests = %d, want one per tick", got)
	}
	if protoMajor, ok := cachedWarmupProto(target); !ok || protoMajor != 2 {
		t.Fatalf("cached proto = %d, ok=%t; want h2 proto major 2", protoMajor, ok)
	}
}

func TestWarmTargets_WorkerPanicRecordedAsFailure(t *testing.T) {
	resetWarmupStatusForTest()
	t.Setenv("UPSTREAM_WARMUP_CONCURRENCY", "1")
	panicTarget := warmupTarget{
		key:    "panic-target",
		url:    "https://example.test",
		host:   "example.test",
		client: &http.Client{Transport: panicRoundTripper{}},
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()
	okTarget := warmupTarget{
		key:    "ok-after-panic",
		url:    server.URL,
		host:   "ok.example.test",
		client: server.Client(),
	}

	warmTargets([]warmupTarget{panicTarget, okTarget}, time.Second)

	status := loadOrInitWarmupStatus(panicTarget)
	if status.FailureCount != 1 {
		t.Fatalf("FailureCount = %d, want 1", status.FailureCount)
	}
	if status.LastError == "" {
		t.Fatal("LastError is empty after worker panic")
	}

	okStatus := loadOrInitWarmupStatus(okTarget)
	if okStatus.ReusableSuccessCount != 1 {
		t.Fatalf("ok target ReusableSuccessCount = %d, want 1", okStatus.ReusableSuccessCount)
	}
}

type panicRoundTripper struct{}

func (panicRoundTripper) RoundTrip(*http.Request) (*http.Response, error) {
	panic("boom")
}

func resetWarmupStatusForTest() {
	warmupStatusMu.Lock()
	defer warmupStatusMu.Unlock()
	warmupStatusStore = sync.Map{}
	warmupProtoStore = sync.Map{}
}
