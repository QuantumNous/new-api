package service

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestShouldCopyUpstreamHeaderBlocksBlockRunOrganization(t *testing.T) {
	t.Parallel()

	for _, testCase := range []struct {
		header string
		value  string
	}{
		{header: "OpenAI-Organization", value: "blockrunai"},
		{header: "openai-organization", value: "BlockRunAI"},
		{header: "OPENAI-ORGANIZATION", value: " blockrunai "},
	} {
		if ShouldCopyUpstreamHeader(nil, testCase.header, []string{testCase.value}) {
			t.Fatalf("ShouldCopyUpstreamHeader(%q, %q) = true, want false", testCase.header, testCase.value)
		}
	}
}

func TestShouldCopyUpstreamHeaderBlocksToken360Router(t *testing.T) {
	t.Parallel()

	for _, header := range []string{
		"X-Token360-Router",
		"x-token360-router",
		"X-TOKEN360-ROUTER",
	} {
		if ShouldCopyUpstreamHeader(nil, header, []string{"go"}) {
			t.Fatalf("ShouldCopyUpstreamHeader(%q) = true, want false", header)
		}
	}
}

func TestShouldCopyUpstreamHeaderKeepsUnrelatedHeaders(t *testing.T) {
	t.Parallel()

	for _, header := range []string{
		"Content-Type",
		"OpenAI-Processing-Ms",
		"X-RateLimit-Remaining-Requests",
	} {
		if !ShouldCopyUpstreamHeader(nil, header, []string{"value"}) {
			t.Fatalf("ShouldCopyUpstreamHeader(%q) = false, want true", header)
		}
	}

	if !ShouldCopyUpstreamHeader(nil, "OpenAI-Organization", []string{"org-flatkey"}) {
		t.Fatal("non-BlockRun OpenAI-Organization header should be preserved")
	}
}

func TestIOCopyBytesGracefullyDoesNotExposeUpstreamIdentityHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	upstream := &http.Response{
		StatusCode: http.StatusOK,
		Header: http.Header{
			"Content-Type":        []string{"application/json"},
			"OpenAI-Organization": []string{"blockrunai"},
			"X-Token360-Router":   []string{"go"},
		},
		Body: io.NopCloser(strings.NewReader(`{"ok":true}`)),
	}

	IOCopyBytesGracefully(ctx, upstream, []byte(`{"ok":true}`))

	if got := recorder.Header().Get("OpenAI-Organization"); got != "" {
		t.Fatalf("OpenAI-Organization leaked to client: %q", got)
	}
	if got := recorder.Header().Get("X-Token360-Router"); got != "" {
		t.Fatalf("X-Token360-Router leaked to client: %q", got)
	}
	if got := recorder.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("Content-Type = %q, want application/json", got)
	}
}
