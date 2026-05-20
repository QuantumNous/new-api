package armsotel

import (
	"context"
	"net/http"
	"testing"

	"go.opentelemetry.io/otel/trace"
)

type contextKey string

func TestDetachedContextKeepsValuesWithoutCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.WithValue(context.Background(), contextKey("request_id"), "req-1"))
	cancel()

	detached := DetachedContext(ctx)

	if detached.Err() != nil {
		t.Fatalf("detached context err = %v", detached.Err())
	}
	if got := detached.Value(contextKey("request_id")); got != "req-1" {
		t.Fatalf("detached context value = %v", got)
	}
}

func TestWrapTransportInjectsTraceparent(t *testing.T) {
	traceID, err := trace.TraceIDFromHex("0123456789abcdef0123456789abcdef")
	if err != nil {
		t.Fatal(err)
	}
	spanID, err := trace.SpanIDFromHex("0123456789abcdef")
	if err != nil {
		t.Fatal(err)
	}
	ctx := trace.ContextWithRemoteSpanContext(context.Background(), trace.NewSpanContext(trace.SpanContextConfig{
		TraceID:    traceID,
		SpanID:     spanID,
		TraceFlags: trace.FlagsSampled,
		Remote:     true,
	}))
	var got string
	client := &http.Client{Transport: WrapTransport(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		got = req.Header.Get("traceparent")
		return &http.Response{StatusCode: http.StatusOK, Body: http.NoBody, Header: http.Header{}}, nil
	}))}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://upstream.example.com/v1/models", nil)
	if err != nil {
		t.Fatal(err)
	}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	if got != "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01" {
		t.Fatalf("traceparent = %q", got)
	}
}

func TestWrapTransportClosesBaseIdleConnections(t *testing.T) {
	base := &closeIdleTransport{}
	transport := WrapTransport(base)
	closer, ok := transport.(interface{ CloseIdleConnections() })
	if !ok {
		t.Fatal("wrapped transport does not expose CloseIdleConnections")
	}

	closer.CloseIdleConnections()

	if !base.closed {
		t.Fatal("base idle connections were not closed")
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

type closeIdleTransport struct {
	closed bool
}

func (t *closeIdleTransport) RoundTrip(*http.Request) (*http.Response, error) {
	return &http.Response{StatusCode: http.StatusOK, Body: http.NoBody, Header: http.Header{}}, nil
}

func (t *closeIdleTransport) CloseIdleConnections() {
	t.closed = true
}
