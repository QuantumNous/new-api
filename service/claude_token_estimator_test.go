package service

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestEstimateClaudeInputTokens(t *testing.T) {
	cases := []struct {
		name string
		body string
		want int
	}{
		{
			name: "empty messages",
			body: `{"model":"claude-haiku-4-5","max_tokens":1024,"messages":[]}`,
			want: 0,
		},
		{
			name: "single short user message",
			body: `{"model":"claude-haiku-4-5","max_tokens":1024,"messages":[{"role":"user","content":"count"}]}`,
			want: 4,
		},
		{
			name: "string system + user",
			body: `{"model":"claude-haiku-4-5","max_tokens":1024,"system":"You are helpful.","messages":[{"role":"user","content":"hello"}]}`,
			want: 9,
		},
		{
			name: "CLI-probe shape: trivial message + bash tool schema",
			body: `{"model":"claude-haiku-4-5","max_tokens":1,"messages":[{"role":"user","content":"count"}],"tools":[{"name":"Bash","description":"Execute a shell command on the host","input_schema":{"type":"object","properties":{"command":{"type":"string"}},"required":["command"]}}]}`,
			want: 43,
		},
		{
			name: "system as array of text blocks",
			body: `{"model":"claude-haiku-4-5","max_tokens":1024,"system":[{"type":"text","text":"You are a helpful assistant."}],"messages":[{"role":"user","content":"hi"}]}`,
			want: 12,
		},
		{
			name: "CJK content",
			body: `{"model":"claude-haiku-4-5","max_tokens":1024,"messages":[{"role":"user","content":"你好世界，请用中文回答我的问题"}]}`,
			want: 20,
		},
		{
			name: "tool_use block on assistant turn",
			body: `{"model":"claude-haiku-4-5","max_tokens":1024,"messages":[{"role":"assistant","content":[{"type":"tool_use","id":"toolu_1","name":"Bash","input":{"command":"ls"}}]}]}`,
			want: 10,
		},
		{
			name: "tool_result block on user turn",
			body: `{"model":"claude-haiku-4-5","max_tokens":1024,"messages":[{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_1","content":"file1\nfile2"}]}]}`,
			want: 9,
		},
		{
			name: "web-search tool (different schema, distinguished by type field)",
			body: `{"model":"claude-haiku-4-5","max_tokens":1024,"messages":[{"role":"user","content":"news"}],"tools":[{"type":"web_search_20250305","name":"web_search","max_uses":3}]}`,
			want: 7,
		},
		{
			name: "tools array with already-typed entries (defensive: caller pre-normalized)",
			// Synthesised in-test below via direct ClaudeRequest construction.
			body: "",
			want: 18,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var req dto.ClaudeRequest
			if tc.body != "" {
				if err := json.Unmarshal([]byte(tc.body), &req); err != nil {
					t.Fatalf("unmarshal: %v", err)
				}
			} else {
				// pre-typed tool entry — exercises the early-return arm of
				// normalizeRequestTools.
				req = dto.ClaudeRequest{
					Model: "claude-haiku-4-5",
					Messages: []dto.ClaudeMessage{
						{Role: "user", Content: "list"},
					},
					Tools: []any{
						&dto.Tool{
							Name:        "ListFiles",
							Description: "List directory contents",
							InputSchema: map[string]any{"type": "object"},
						},
					},
				}
			}
			got := EstimateClaudeInputTokens(&req)
			if got != tc.want {
				t.Errorf("EstimateClaudeInputTokens() = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestEstimateClaudeInputTokens_NilSafety(t *testing.T) {
	if got := EstimateClaudeInputTokens(nil); got != 0 {
		t.Errorf("nil request should return 0, got %d", got)
	}

	// Empty model string + no content — should not panic.
	if got := EstimateClaudeInputTokens(&dto.ClaudeRequest{}); got != 0 {
		t.Errorf("zero-value request should return 0, got %d", got)
	}
}

func TestNormalizeRequestTools(t *testing.T) {
	t.Run("nil tools", func(t *testing.T) {
		req := &dto.ClaudeRequest{}
		normalizeRequestTools(req)
		if req.Tools != nil {
			t.Errorf("expected Tools to remain nil, got %v", req.Tools)
		}
	})

	t.Run("non-array tools field is left alone", func(t *testing.T) {
		req := &dto.ClaudeRequest{Tools: "not-an-array"}
		normalizeRequestTools(req)
		if got, ok := req.Tools.(string); !ok || got != "not-an-array" {
			t.Errorf("expected non-array Tools to be preserved, got %v", req.Tools)
		}
	})

	t.Run("malformed tool entry is dropped, others survive", func(t *testing.T) {
		req := &dto.ClaudeRequest{Tools: []any{
			map[string]any{"name": "Good", "description": "ok"},
			map[string]any{"description": "missing name"}, // no Name → dropped
			"a string entry",                              // wrong shape → dropped
		}}
		normalizeRequestTools(req)
		got, ok := req.Tools.([]any)
		if !ok {
			t.Fatalf("expected []any after normalize, got %T", req.Tools)
		}
		if len(got) != 1 {
			t.Errorf("expected 1 surviving tool, got %d (%v)", len(got), got)
		}
	})
}
