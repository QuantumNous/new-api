package blockrunseedance

import (
	"context"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	blockrunSDK "github.com/BlockRunAI/blockrun-llm-go"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// Compile-time guarantee that the adaptor satisfies the full polling +
// video-output surface of the channel package.
var (
	_ channel.TaskAdaptor          = (*TaskAdaptor)(nil)
	_ channel.OpenAIVideoConverter = (*TaskAdaptor)(nil)
)

func TestParseTaskResult_Statuses(t *testing.T) {
	a := &TaskAdaptor{}

	// queued
	info, err := a.ParseTaskResult([]byte(`{"status":"queued"}`))
	if err != nil {
		t.Fatalf("queued: unexpected err: %v", err)
	}
	if info.Status != model.TaskStatusQueued {
		t.Fatalf("queued: status mismatch: %q", info.Status)
	}

	// in_progress
	info, err = a.ParseTaskResult([]byte(`{"status":"in_progress"}`))
	if err != nil {
		t.Fatalf("in_progress: unexpected err: %v", err)
	}
	if info.Status != model.TaskStatusInProgress {
		t.Fatalf("in_progress: status mismatch: %q", info.Status)
	}

	// failed -> failure
	info, err = a.ParseTaskResult([]byte(`{"status":"failed","error":"boom"}`))
	if err != nil {
		t.Fatalf("failed: unexpected err: %v", err)
	}
	if info.Status != model.TaskStatusFailure {
		t.Fatalf("failed: status mismatch: %q", info.Status)
	}

	// completed: empty status with data[].url -> success and url surfaced
	info, err = a.ParseTaskResult([]byte(`{"status":"","data":[{"url":"https://up/v.mp4"}]}`))
	if err != nil {
		t.Fatalf("completed: unexpected err: %v", err)
	}
	if info.Status != model.TaskStatusSuccess {
		t.Fatalf("completed: status mismatch: %q", info.Status)
	}
	if info.Url != "https://up/v.mp4" {
		t.Fatalf("completed: url mismatch: %q", info.Url)
	}

	// completed with no url and no error -> still in progress (don't drop)
	info, err = a.ParseTaskResult([]byte(`{"status":"","data":[]}`))
	if err != nil {
		t.Fatalf("pending: unexpected err: %v", err)
	}
	if info.Status != model.TaskStatusInProgress {
		t.Fatalf("pending: status mismatch: %q", info.Status)
	}
}

func TestExtractUpstreamVideoURL(t *testing.T) {
	if got := ExtractUpstreamVideoURL(nil); got != "" {
		t.Fatalf("nil should yield empty, got %q", got)
	}
	if got := ExtractUpstreamVideoURL([]byte(`not-json`)); got != "" {
		t.Fatalf("bad json should yield empty, got %q", got)
	}
	got := ExtractUpstreamVideoURL([]byte(`{"data":[{"url":"https://up/host/v.mp4"}]}`))
	if got != "https://up/host/v.mp4" {
		t.Fatalf("url mismatch: %q", got)
	}
}

// TestNormalizeAcceptedStatus verifies the 202->200 normalization that lets the
// generic orchestrator (which rejects any non-200 before DoResponse) reach our
// DoResponse on the x402 signed-submit leg.
func TestNormalizeAcceptedStatus(t *testing.T) {
	cases := []struct {
		in   int
		want int
	}{
		{http.StatusAccepted, http.StatusOK},                             // 202 -> 200
		{http.StatusOK, http.StatusOK},                                   // 200 -> 200
		{http.StatusInternalServerError, http.StatusInternalServerError}, // 500 -> 500
	}
	for _, c := range cases {
		resp := &http.Response{StatusCode: c.in}
		normalizeAcceptedStatus(resp)
		if resp.StatusCode != c.want {
			t.Fatalf("normalizeAcceptedStatus(%d) = %d, want %d", c.in, resp.StatusCode, c.want)
		}
	}
	// nil-safe: must not panic.
	normalizeAcceptedStatus(nil)
}

func TestSignedRequestHonorsContextCancellation(t *testing.T) {
	service.InitHttpClient()
	requestStarted := make(chan struct{})
	releaseHandler := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(requestStarted)
		select {
		case <-r.Context().Done():
		case <-releaseHandler:
		}
	}))
	defer server.Close()
	defer close(releaseHandler)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	result := make(chan error, 1)
	go func() {
		_, err := (&TaskAdaptor{}).signedRequest(ctx, http.MethodPost, server.URL, []byte(`{}`), "test-signature", "")
		result <- err
	}()

	select {
	case <-requestStarted:
	case <-time.After(time.Second):
		t.Fatal("signed request did not reach the test server")
	}
	cancel()

	select {
	case err := <-result:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("signedRequest error = %v, want context.Canceled", err)
		}
	case <-time.After(time.Second):
		t.Fatal("signedRequest did not stop after context cancellation")
	}
}

func TestSignedPollHonorsContextCancellation(t *testing.T) {
	type contextTaskFetcher interface {
		FetchTaskWithContext(context.Context, string, string, map[string]any, string) (*http.Response, error)
	}
	fetcher, ok := any(&TaskAdaptor{}).(contextTaskFetcher)
	if !ok {
		t.Fatal("BlockRun Seedance adaptor does not support context-aware task polling")
	}

	service.InitHttpClient()
	signedRequestStarted := make(chan struct{})
	releaseHandler := make(chan struct{})
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		if requestCount == 1 {
			w.Header().Set("Payment-Required", blockRunSeedancePaymentRequiredHeader(t, r.URL.String()))
			w.WriteHeader(http.StatusPaymentRequired)
			return
		}
		close(signedRequestStarted)
		select {
		case <-r.Context().Done():
		case <-releaseHandler:
		}
	}))
	defer server.Close()
	defer close(releaseHandler)
	t.Cleanup(service.ResetProxyClientCache)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	result := make(chan error, 1)
	go func() {
		_, err := fetcher.FetchTaskWithContext(ctx, "", "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", map[string]any{
			"task_id": server.URL,
		}, "")
		result <- err
	}()

	select {
	case <-signedRequestStarted:
	case <-time.After(time.Second):
		t.Fatal("signed poll request did not reach the test server")
	}
	cancel()

	select {
	case err := <-result:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("FetchTaskWithContext error = %v, want context.Canceled", err)
		}
	case <-time.After(time.Second):
		t.Fatal("signed poll request did not stop after context cancellation")
	}
}

func blockRunSeedancePaymentRequiredHeader(t *testing.T, resourceURL string) string {
	t.Helper()
	requirement := blockrunSDK.PaymentRequirement{
		X402Version: 2,
		Accepts: []blockrunSDK.PaymentOption{
			{
				Scheme:            "exact",
				Network:           "eip155:8453",
				Amount:            "3000",
				Asset:             "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
				PayTo:             "0x000000000000000000000000000000000000dEaD",
				MaxTimeoutSeconds: 300,
				Extra:             map[string]any{"name": "USD Coin", "version": "2"},
			},
		},
		Resource: blockrunSDK.ResourceInfo{
			URL:         resourceURL,
			Description: "BlockRun Seedance poll context test",
			MimeType:    "application/json",
		},
	}
	data, err := common.Marshal(requirement)
	if err != nil {
		t.Fatalf("marshal payment requirement: %v", err)
	}
	return base64.StdEncoding.EncodeToString(data)
}

// TestAbsoluteURL covers absolute, root-relative, relative, and scheme-relative
// poll_url forms resolved against the channel base URL.
func TestAbsoluteURL(t *testing.T) {
	cases := []struct {
		name    string
		baseURL string
		pollURL string
		want    string
	}{
		{
			name:    "absolute stays",
			baseURL: "https://blockrun.ai/api",
			pollURL: "https://h/p",
			want:    "https://h/p",
		},
		{
			name:    "root-relative resolves against origin",
			baseURL: "https://blockrun.ai/api",
			pollURL: "/v1/x",
			want:    "https://blockrun.ai/v1/x",
		},
		{
			name:    "relative resolves under base path",
			baseURL: "https://blockrun.ai/api/",
			pollURL: "poll/x",
			want:    "https://blockrun.ai/api/poll/x",
		},
		{
			name:    "scheme-relative inherits base scheme",
			baseURL: "https://blockrun.ai/api",
			pollURL: "//cdn/x",
			want:    "https://cdn/x",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			a := &TaskAdaptor{baseURL: c.baseURL}
			got, err := a.absoluteURL(c.pollURL)
			if err != nil {
				t.Fatalf("%s: unexpected err: %v", c.name, err)
			}
			if got != c.want {
				t.Fatalf("%s: absoluteURL(%q) = %q, want %q", c.name, c.pollURL, got, c.want)
			}
		})
	}
}

func newTestGinContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/v1/videos/generations", nil)
	c.Request = req
	return c
}

// TestDoResponse_PollURLPresent: a 200 body carrying poll_url must return the
// absolutised poll_url as the upstream task id (the only success path).
func TestDoResponse_PollURLPresent(t *testing.T) {
	a := &TaskAdaptor{baseURL: "https://blockrun.ai/api"}
	c := newTestGinContext()
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "public-123"}}

	resp := &http.Response{
		StatusCode: http.StatusOK, // already normalized from 202
		Body:       io.NopCloser(strings.NewReader(`{"id":"abc","status":"queued","poll_url":"/v1/videos/poll/abc"}`)),
	}
	taskID, taskData, taskErr := a.DoResponse(c, resp, info)
	if taskErr != nil {
		t.Fatalf("expected no task error, got %+v", taskErr)
	}
	if taskID != "https://blockrun.ai/v1/videos/poll/abc" {
		t.Fatalf("taskID = %q, want absolutised poll_url", taskID)
	}
	if len(taskData) == 0 {
		t.Fatalf("expected taskData to carry the submit body")
	}
}

// TestDoResponse_NoPollURL: a body WITHOUT poll_url must return a non-nil
// *dto.TaskError (StatusBadGateway) so quota is refunded and no stuck task is
// created. The old sentinel-task-id behaviour is gone.
func TestDoResponse_NoPollURL(t *testing.T) {
	a := &TaskAdaptor{baseURL: "https://blockrun.ai/api"}
	c := newTestGinContext()
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "public-123"}}

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(`{"id":"abc","status":"queued"}`)),
	}
	taskID, _, taskErr := a.DoResponse(c, resp, info)
	if taskErr == nil {
		t.Fatalf("expected a non-nil *dto.TaskError when poll_url is missing")
	}
	if taskErr.StatusCode != http.StatusBadGateway {
		t.Fatalf("taskErr.StatusCode = %d, want %d", taskErr.StatusCode, http.StatusBadGateway)
	}
	if taskID != "" {
		t.Fatalf("expected empty taskID on missing poll_url, got %q (no sentinel)", taskID)
	}
}
