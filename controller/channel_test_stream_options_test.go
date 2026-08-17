package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
)

// TestBuildTestRequest_UsesNativeAnthropicRequest guards the channel-test fix:
// /v1/messages must use ClaudeRequest so the channel test invokes the native
// Claude converter instead of the OpenAI chat converter.
func TestBuildTestRequest_UsesNativeAnthropicRequest(t *testing.T) {
	req := buildTestRequest("claude-opus-4.8", string(constant.EndpointTypeAnthropic), nil, true)
	claudeReq, ok := req.(*dto.ClaudeRequest)
	if !ok {
		t.Fatalf("expected *dto.ClaudeRequest, got %T", req)
	}
	if claudeReq.Model != "claude-opus-4.8" || claudeReq.Stream == nil || !*claudeReq.Stream {
		t.Fatalf("unexpected Anthropic test request: %+v", claudeReq)
	}
	if claudeReq.MaxTokens == nil || *claudeReq.MaxTokens != 16 {
		t.Fatalf("MaxTokens = %v, want 16", claudeReq.MaxTokens)
	}
	if len(claudeReq.Messages) != 1 || claudeReq.Messages[0].Role != "user" || claudeReq.Messages[0].Content != "hi" {
		t.Fatalf("unexpected Anthropic messages: %+v", claudeReq.Messages)
	}
}

// TestBuildTestRequest_StreamOptionsOnlyForOpenAI guards the channel-test fix:
// stream_options is an OpenAI Chat Completions field. The native Anthropic
// (/v1/messages) and Gemini endpoints reject it ("stream_options: Extra inputs
// are not permitted"), which broke streaming connectivity tests for
// native-passthrough channels (e.g. BlockRun) that forward the body verbatim.
// Only the OpenAI endpoint test request may carry stream_options.
func TestBuildTestRequest_StreamOptionsOnlyForOpenAI(t *testing.T) {
	cases := []struct {
		endpoint       string
		wantStreamOpts bool
	}{
		{string(constant.EndpointTypeOpenAI), true},
		{string(constant.EndpointTypeGemini), false},
	}
	for _, tc := range cases {
		t.Run(tc.endpoint, func(t *testing.T) {
			req := buildTestRequest("claude-sonnet-4-6", tc.endpoint, nil, true /* isStream */)
			gReq, ok := req.(*dto.GeneralOpenAIRequest)
			if !ok {
				t.Fatalf("endpoint %s: expected *dto.GeneralOpenAIRequest, got %T", tc.endpoint, req)
			}
			gotStreamOpts := gReq.StreamOptions != nil
			if gotStreamOpts != tc.wantStreamOpts {
				t.Fatalf("endpoint %s (isStream=true): StreamOptions set=%v, want %v",
					tc.endpoint, gotStreamOpts, tc.wantStreamOpts)
			}
		})
	}

	// Non-stream OpenAI must not set StreamOptions either.
	if req := buildTestRequest("gpt-4o", string(constant.EndpointTypeOpenAI), nil, false); func() bool {
		g, ok := req.(*dto.GeneralOpenAIRequest)
		return ok && g.StreamOptions != nil
	}() {
		t.Fatal("non-stream OpenAI endpoint must not set StreamOptions")
	}
}
