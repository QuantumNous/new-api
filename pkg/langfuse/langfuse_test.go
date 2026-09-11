package langfuse

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReporterSendsGenerationBatch(t *testing.T) {
	var got batchPayload
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/public/ingestion", r.URL.Path)
		user, password, ok := r.BasicAuth()
		assert.True(t, ok)
		assert.Equal(t, "public", user)
		assert.Equal(t, "secret", password)
		require.NoError(t, common.DecodeJson(r.Body, &got))
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	reporter := NewReporter(Config{Enabled: true, Host: server.URL, PublicKey: "public", SecretKey: "secret", SampleRate: 1, QueueSize: 2, BatchSize: 1, HTTPClient: server.Client()})
	reporter.Publish(Event{RequestID: "req-1", TraceID: "trace-1", Model: "gpt-test", InputTokens: 10, OutputTokens: 5, TotalTokens: 15, Quota: 20, DurationMS: 125, Status: "success"})
	require.NoError(t, reporter.Flush(context.Background()))
	assert.Len(t, got.Batch, 1)
	assert.Equal(t, "generation-create", got.Batch[0].Type)
	assert.Equal(t, "gpt-test", got.Batch[0].Body.Name)
	assert.Equal(t, 10, got.Batch[0].Body.Usage.Input)
	assert.Equal(t, 5, got.Batch[0].Body.Usage.Output)
}

func TestLoadConfigDefaultsToDisabled(t *testing.T) {
	for _, key := range []string{"LANGFUSE_ENABLED", "LANGFUSE_HOST", "LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY", "LANGFUSE_SAMPLE_RATE"} {
		t.Setenv(key, "")
	}
	assert.False(t, LoadConfig().Enabled)
}

func TestPublishDoesNotBlockWhenQueueIsFull(t *testing.T) {
	reporter := newQueueOnlyReporter(1)
	reporter.Publish(Event{RequestID: "first"})
	started := time.Now()
	reporter.Publish(Event{RequestID: "second"})
	assert.Less(t, time.Since(started), 100*time.Millisecond)
}

func TestHTTPFailureDoesNotReturnApplicationError(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "failed", http.StatusInternalServerError)
	}))
	defer server.Close()
	reporter := NewReporter(Config{Enabled: true, Host: server.URL, PublicKey: "p", SecretKey: "s", SampleRate: 1, QueueSize: 1, BatchSize: 1, HTTPClient: server.Client()})
	reporter.Publish(Event{RequestID: "failed-request"})
	assert.NoError(t, reporter.Flush(context.Background()))
}

func TestCapturedContentIsTruncated(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload batchPayload
		require.NoError(t, common.DecodeJson(r.Body, &payload))
		content, ok := payload.Batch[0].Body.Input.(map[string]any)
		require.True(t, ok)
		assert.Equal(t, true, content["truncated"])
		assert.Equal(t, float64(22), content["original_bytes"])
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()
	reporter := NewReporter(Config{Enabled: true, Host: server.URL, PublicKey: "p", SecretKey: "s", SampleRate: 1, QueueSize: 1, BatchSize: 1, CaptureContent: true, ContentMaxBytes: 8, HTTPClient: server.Client()})
	reporter.Publish(Event{RequestID: "content", Input: "01234567890123456789"})
	require.NoError(t, reporter.Flush(context.Background()))
}

func TestReporterTracksDroppedAndSentEvents(t *testing.T) {
	reporter := newQueueOnlyReporter(1)
	reporter.Publish(Event{RequestID: "one"})
	reporter.Publish(Event{RequestID: "two"})
	assert.Equal(t, uint64(1), reporter.Stats().Dropped)
}

func TestReporterRejectsInsecureHost(t *testing.T) {
	reporter := NewReporter(Config{Enabled: true, Host: "http://127.0.0.1:1", PublicKey: "p", SecretKey: "s", SampleRate: 1})
	err := reporter.send(context.Background(), []Event{{RequestID: "insecure"}})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "HTTPS")
}

func TestReporterRejectsHTTPRedirectBeforeSendingCredentials(t *testing.T) {
	var targetCalled bool
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		targetCalled = true
		assert.Empty(t, r.Header.Get("Authorization"))
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	source := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL, http.StatusFound)
	}))
	defer source.Close()

	reporter := NewReporter(Config{Enabled: true, Host: source.URL, PublicKey: "p", SecretKey: "s", SampleRate: 1, HTTPClient: source.Client()})
	err := reporter.send(context.Background(), []Event{{RequestID: "redirect"}})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "non-HTTPS Langfuse redirect")
	assert.False(t, targetCalled)
}

func TestReporterCloseIsIdempotent(t *testing.T) {
	reporter := NewReporter(Config{Enabled: true, Host: "https://127.0.0.1:1", PublicKey: "p", SecretKey: "s", SampleRate: 1, QueueSize: 1, BatchSize: 1})
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	assert.NoError(t, reporter.Close(ctx))
	assert.NoError(t, reporter.Close(ctx))
}

func newQueueOnlyReporter(queueSize int) *Reporter {
	return &Reporter{
		config: Config{Enabled: true, PublicKey: "p", SecretKey: "s", SampleRate: 1},
		queue:  make(chan Event, queueSize),
	}
}
