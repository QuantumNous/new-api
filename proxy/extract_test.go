package main

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestExtractRequestFacts pins the extraction contract for every relay format
// new-api accepts, including the guarantee that multimodal media payloads never
// reach the audit record.
func TestExtractRequestFacts(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantModel  string
		wantStream bool
		wantPrompt string
	}{
		{
			name:       "openai chat system and user",
			body:       `{"model":"gpt-4o","stream":true,"messages":[{"role":"system","content":"be brief"},{"role":"user","content":"hello"}]}`,
			wantModel:  "gpt-4o",
			wantStream: true,
			wantPrompt: "system: be brief\nuser: hello",
		},
		{
			name:       "openai multimodal drops base64 image",
			body:       `{"model":"gpt-4o","messages":[{"role":"user","content":[{"type":"text","text":"what is this"},{"type":"image_url","image_url":{"url":"data:image/png;base64,AAAA"}}]}]}`,
			wantModel:  "gpt-4o",
			wantPrompt: "user: what is this",
		},
		{
			name:       "claude system string with block content",
			body:       `{"model":"claude-sonnet-4","system":"you are terse","messages":[{"role":"user","content":[{"type":"text","text":"ping"}]}]}`,
			wantModel:  "claude-sonnet-4",
			wantPrompt: "system: you are terse\nuser: ping",
		},
		{
			name:       "gemini contents with system instruction",
			body:       `{"systemInstruction":{"parts":[{"text":"stay factual"}]},"contents":[{"role":"user","parts":[{"text":"why is the sky blue"}]}]}`,
			wantPrompt: "system: stay factual\nuser: why is the sky blue",
		},
		{
			name:       "gemini inline data is skipped",
			body:       `{"contents":[{"role":"user","parts":[{"text":"describe"},{"inlineData":{"mimeType":"image/png","data":"AAAA"}}]}]}`,
			wantPrompt: "user: describe",
		},
		{
			name:      "embeddings string array input",
			body:      `{"model":"text-embedding-3-small","input":["alpha","beta"]}`,
			wantModel: "text-embedding-3-small",
			// Bare strings carry no role, so they are attributed to the user: they
			// are the caller's input in this format.
			wantPrompt: "user: alpha\nuser: beta",
		},
		{
			name:       "image generation prompt",
			body:       `{"model":"dall-e-3","prompt":"a red bicycle"}`,
			wantModel:  "dall-e-3",
			wantPrompt: "user: a red bicycle",
		},
		{
			name:       "responses api instructions and input",
			body:       `{"model":"gpt-5","instructions":"answer in one word","input":[{"role":"user","content":[{"type":"input_text","text":"capital of France"}]}]}`,
			wantModel:  "gpt-5",
			wantPrompt: "system: answer in one word\nuser: capital of France",
		},
		{
			name:       "rerank query and documents",
			body:       `{"model":"rerank-1","query":"best laptop","documents":["thinkpad","macbook"]}`,
			wantModel:  "rerank-1",
			wantPrompt: "user: best laptop\nuser: thinkpad\nuser: macbook",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			facts := extractRequestFacts([]byte(tc.body), 4096, PromptScopeAll)
			require.True(t, facts.Parsed)
			assert.Equal(t, tc.wantModel, facts.Model)
			assert.Equal(t, tc.wantStream, facts.IsStream)
			assert.Equal(t, tc.wantPrompt, facts.PromptText)
		})
	}
}

// TestPromptScopeTrimsAgentScaffolding covers the reason prompt_scope exists: an
// agent client resends its whole system prompt and history every turn, so the
// default scope must keep only what the user actually submitted this turn.
func TestPromptScopeTrimsAgentScaffolding(t *testing.T) {
	// Shaped like a real Codex /v1/responses turn: a large developer prompt, the
	// full prior conversation, and one new user message.
	body := []byte(`{
		"model": "gpt-5.6-luna",
		"instructions": "You are Codex, an agent based on GPT-5. Long scaffolding follows.",
		"input": [
			{"role": "developer", "content": "You are Codex. Tooling docs, personality, policies."},
			{"role": "user", "content": "first question"},
			{"role": "assistant", "content": "first answer"},
			{"role": "user", "content": [{"type": "input_text", "text": "hello"}]}
		]
	}`)

	tests := []struct {
		scope string
		want  string
	}{
		{PromptScopeLastUser, "hello"},
		{PromptScopeUserOnly, "first question\nhello"},
		{PromptScopeAll, "system: You are Codex, an agent based on GPT-5. Long scaffolding follows.\n" +
			"developer: You are Codex. Tooling docs, personality, policies.\n" +
			"user: first question\nassistant: first answer\nuser: hello"},
	}

	for _, tc := range tests {
		t.Run(tc.scope, func(t *testing.T) {
			facts := extractRequestFacts(body, 60000, tc.scope)
			require.True(t, facts.Parsed)
			assert.Equal(t, tc.want, facts.PromptText)
		})
	}

	// An unknown scope must never silently discard data.
	facts := extractRequestFacts(body, 60000, "")
	assert.Contains(t, facts.PromptText, "developer:", "an unset scope must behave like all, not like a filter")
}

// TestPromptScopeKeepsWholeUserMessage reproduces a real miss: the ChatGPT/Codex
// client splits one user turn into several text parts and wraps an attached image
// in <image>…</image> marker parts. Taking the last *part* recorded only
// "</image>"; the unit has to be the last user *message*.
func TestPromptScopeKeepsWholeUserMessage(t *testing.T) {
	body := []byte(`{
		"model": "gpt-5.6-luna",
		"input": [
			{"role": "user", "content": "an earlier turn"},
			{"role": "user", "content": [
				{"type": "input_text", "text": "what is in this picture"},
				{"type": "input_image", "image_url": "data:image/png;base64,AAAAAAAA"},
				{"type": "input_text", "text": "<image>"},
				{"type": "input_text", "text": "</image>"}
			]}
		]
	}`)

	facts := extractRequestFacts(body, 60000, PromptScopeLastUser)
	require.True(t, facts.Parsed)
	assert.Contains(t, facts.PromptText, "what is in this picture",
		"every text part of the last user message must be kept, not only the final part")
	assert.NotContains(t, facts.PromptText, "an earlier turn", "only the last user message")
	assert.NotContains(t, facts.PromptText, "base64", "image payloads must never be recorded")
}

// TestPromptScopeExcludesAnthropicToolResults covers the one client shape where
// role alone is misleading: Anthropic's format returns tool results as
// `role: "user"` messages, so an agent's command output would otherwise be
// recorded as the prompt the user typed.
func TestPromptScopeExcludesAnthropicToolResults(t *testing.T) {
	// A Claude Code style agent loop: the user asked once, everything after that
	// is the agent feeding results back through user-role messages.
	body := []byte(`{
		"model": "claude-sonnet-4",
		"system": [{"type": "text", "text": "You are Claude Code."}],
		"messages": [
			{"role": "user", "content": "find the bug in main.go"},
			{"role": "assistant", "content": [{"type": "tool_use", "name": "read", "input": {"path": "main.go"}}]},
			{"role": "user", "content": [
				{"type": "tool_result", "tool_use_id": "t1",
				 "content": [{"type": "text", "text": "package main\nfunc main() { panic(1) }"}]}
			]}
		]
	}`)

	lastUser := extractRequestFacts(body, 60000, PromptScopeLastUser)
	require.True(t, lastUser.Parsed)
	assert.Equal(t, "find the bug in main.go", lastUser.PromptText,
		"a tool result carried in a user message must not be mistaken for the user's input")

	userOnly := extractRequestFacts(body, 60000, PromptScopeUserOnly)
	assert.Equal(t, "find the bug in main.go", userOnly.PromptText)
	assert.NotContains(t, userOnly.PromptText, "panic")

	// Forensic scope still keeps the tool traffic, attributed to the tool.
	all := extractRequestFacts(body, 60000, PromptScopeAll)
	assert.Contains(t, all.PromptText, "tool: package main")
	assert.Contains(t, all.PromptText, "system: You are Claude Code.")
}

// TestPromptScopeExcludesResponsesToolOutput checks the OpenAI Responses agent
// shape, where tool output arrives as a roleless function_call_output item.
func TestPromptScopeExcludesResponsesToolOutput(t *testing.T) {
	body := []byte(`{
		"model": "gpt-5",
		"input": [
			{"role": "user", "content": "list the files"},
			{"type": "function_call", "name": "ls", "arguments": "{}"},
			{"type": "function_call_output", "call_id": "c1", "content": "main.go go.mod"}
		]
	}`)

	lastUser := extractRequestFacts(body, 60000, PromptScopeLastUser)
	assert.Equal(t, "list the files", lastUser.PromptText)
	assert.NotContains(t, lastUser.PromptText, "go.mod")
}

// TestPromptScopeKeepsRolelessUserInput guards the seed roles: formats where the
// user's input carries no role at all must still survive the restrictive scopes.
func TestPromptScopeKeepsRolelessUserInput(t *testing.T) {
	image := extractRequestFacts([]byte(`{"model":"dall-e-3","prompt":"a red bicycle"}`), 4096, PromptScopeLastUser)
	assert.Equal(t, "a red bicycle", image.PromptText)

	embedding := extractRequestFacts([]byte(`{"model":"e5","input":["alpha","beta"]}`), 4096, PromptScopeUserOnly)
	assert.Equal(t, "alpha\nbeta", embedding.PromptText)

	// A request with no user-authored text yields nothing under last_user rather
	// than falling back to the system prompt.
	systemOnly := extractRequestFacts([]byte(`{"model":"m","instructions":"be terse"}`), 4096, PromptScopeLastUser)
	assert.Empty(t, systemOnly.PromptText)
}

func TestExtractRequestFactsOnNonJSONBody(t *testing.T) {
	facts := extractRequestFacts([]byte("--boundary\r\nContent-Disposition: form-data"), 1024, PromptScopeAll)
	assert.False(t, facts.Parsed)
	assert.Empty(t, facts.PromptText)
	assert.Empty(t, facts.Model)
}

// TestTruncateUTF8RespectsByteBudget pins the limit that actually matters: the
// database column is bounded in bytes, so a multi-byte prompt must be cut to fit
// in bytes and must never be cut mid-character.
func TestTruncateUTF8RespectsByteBudget(t *testing.T) {
	assert.Equal(t, "你好", truncateUTF8("你好", 6), "exactly at the budget is kept intact")
	assert.Equal(t, "hello", truncateUTF8("hello", 64))

	// The marker is 14 bytes, so a 20-byte budget leaves 6 bytes — exactly two
	// 3-byte characters — out of this 24-byte input.
	out := truncateUTF8("你好世界你好世界", 20)
	assert.LessOrEqual(t, len(out), 20)
	assert.True(t, utf8.ValidString(out), "must not split a multi-byte character")
	assert.Equal(t, "你好"+truncationMarker, out)

	// A long CJK string must come back within budget — the rune-based cap this
	// replaced would have produced roughly three times the bytes.
	long := strings.Repeat("审计", 40000)
	out = truncateUTF8(long, 60000)
	assert.LessOrEqual(t, len(out), 60000)
	assert.True(t, utf8.ValidString(out))

	assert.Empty(t, truncateUTF8("你好世界", 4), "a budget too small for the marker yields nothing")
}

// TestExtractRequestFactsDecodesCompressedBodies covers clients that compress
// request bodies — new-api decompresses them itself, so the audit proxy must too
// or every compressed request would record an empty prompt.
func TestExtractRequestFactsDecodesCompressedBodies(t *testing.T) {
	payload := `{"model":"gpt-4o","messages":[{"role":"user","content":"compressed hello"}]}`

	var buf bytes.Buffer
	writer := gzip.NewWriter(&buf)
	_, err := writer.Write([]byte(payload))
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	gzipped := buf.Bytes()

	t.Run("gzip is decoded", func(t *testing.T) {
		facts := extractRequestFacts(decodeRequestBody("gzip", gzipped), 4096, PromptScopeAll)
		require.True(t, facts.Parsed)
		assert.Equal(t, "gpt-4o", facts.Model)
		assert.Equal(t, "user: compressed hello", facts.PromptText)
	})

	t.Run("undecodable body is passed through unchanged", func(t *testing.T) {
		assert.Equal(t, gzipped, decodeRequestBody("br", gzipped), "unsupported encoding is left alone")
		assert.Equal(t, []byte(payload), decodeRequestBody("", []byte(payload)))
		// A gzip header that does not decompress must not lose the original bytes.
		assert.Equal(t, gzipped[:10], decodeRequestBody("gzip", gzipped[:10]))
	})
}

func TestRedactorMasksConfiguredPatterns(t *testing.T) {
	redactor, err := NewRedactor([]string{`sk-[A-Za-z0-9]{16,}`})
	require.NoError(t, err)
	assert.Equal(t, "my key is [REDACTED] ok", redactor.Apply("my key is sk-abcdefghijklmnopqrst ok"))

	_, err = NewRedactor([]string{`([`})
	require.Error(t, err)
}

// TestExtractAPIKey locks the key normalisation to what new-api's TokenAuth does
// (middleware/auth.go): drop "Bearer ", drop "sk-", keep the segment before the
// first "-". Divergence here would silently mis-attribute every audit record.
func TestExtractAPIKey(t *testing.T) {
	tests := []struct {
		name    string
		target  string
		headers map[string]string
		want    string
	}{
		{
			name:    "bearer with sk prefix",
			target:  "/v1/chat/completions",
			headers: map[string]string{"Authorization": "Bearer sk-abc123"},
			want:    "abc123",
		},
		{
			name:    "lowercase bearer",
			target:  "/v1/chat/completions",
			headers: map[string]string{"Authorization": "bearer sk-abc123"},
			want:    "abc123",
		},
		{
			name:    "channel selecting suffix is stripped",
			target:  "/v1/chat/completions",
			headers: map[string]string{"Authorization": "Bearer sk-abc123-7"},
			want:    "abc123",
		},
		{
			name:    "claude x-api-key",
			target:  "/v1/messages",
			headers: map[string]string{"x-api-key": "sk-claudekey"},
			want:    "claudekey",
		},
		{
			name:    "gemini header",
			target:  "/v1beta/models/gemini-2.0-flash:generateContent",
			headers: map[string]string{"x-goog-api-key": "sk-geminikey"},
			want:    "geminikey",
		},
		{
			name:   "gemini query parameter",
			target: "/v1beta/models/gemini-2.0-flash:generateContent?key=sk-querykey",
			want:   "querykey",
		},
		{
			name:   "no credentials",
			target: "/v1/chat/completions",
			want:   "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, tc.target, nil)
			for name, value := range tc.headers {
				request.Header.Set(name, value)
			}
			assert.Equal(t, tc.want, extractAPIKey(request))
		})
	}
}

// TestCaptureBodyForwardsEveryByte is the proxy's core safety invariant: whatever
// the client sent must reach the upstream unchanged, including the part beyond
// the inspection cap.
func TestCaptureBodyForwardsEveryByte(t *testing.T) {
	payload := []byte(`{"model":"gpt-4o","messages":[{"role":"user","content":"0123456789abcdef"}]}`)

	t.Run("body under the cap", func(t *testing.T) {
		proxy := &Proxy{cfg: &Config{Capture: CaptureConfig{MaxBodyBytes: int64(len(payload))}}}
		request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", bytes.NewReader(payload))

		captured, truncated := proxy.captureBody(request)
		assert.False(t, truncated)
		assert.Equal(t, payload, captured)

		forwarded, err := io.ReadAll(request.Body)
		require.NoError(t, err)
		assert.Equal(t, payload, forwarded)
	})

	t.Run("body over the cap", func(t *testing.T) {
		const limit = 16
		proxy := &Proxy{cfg: &Config{Capture: CaptureConfig{MaxBodyBytes: limit}}}
		request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", bytes.NewReader(payload))

		captured, truncated := proxy.captureBody(request)
		assert.True(t, truncated)
		assert.Equal(t, payload[:limit], captured)

		forwarded, err := io.ReadAll(request.Body)
		require.NoError(t, err)
		assert.Equal(t, payload, forwarded, "upstream must still receive the complete body")
	})
}

func TestShouldCaptureMatchesPrefixPatterns(t *testing.T) {
	capture := CaptureConfig{Paths: []string{"/v1/chat/completions", "/v1beta/models/*"}}

	assert.True(t, capture.shouldCapture("/v1/chat/completions"))
	assert.True(t, capture.shouldCapture("/v1beta/models/gemini-2.0-flash:generateContent"))
	assert.False(t, capture.shouldCapture("/v1/chat/completions/extra"))
	assert.False(t, capture.shouldCapture("/v1/audio/transcriptions"))
}

// TestRecordsBeforeStreamFinishes locks the contract whose absence caused audit
// records to go missing in production: a relay response can stay open for a long
// time — an agent client holds the SSE stream for a whole turn — so the record
// must be enqueued when the upstream response headers arrive, never after the
// body has finished relaying.
func TestRecordsBeforeStreamFinishes(t *testing.T) {
	releaseStream := make(chan struct{})
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		w.Header().Set(upstreamRequestIdHeader, "req-123")
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		w.(http.Flusher).Flush()
		<-releaseStream // hold the response open, as a streaming relay does
		_, _ = w.Write([]byte("data: [DONE]\n\n"))
	}))
	defer upstream.Close()

	// The store is deliberately not Start()ed, so enqueued records stay in the
	// channel where the test can observe them.
	store, err := NewStore(nil, StoreConfig{
		BufferSize: 8, BatchSize: 10, FlushIntervalMs: 1000,
		SpoolDir: t.TempDir(), SpoolReplaySecond: 60,
	})
	require.NoError(t, err)

	proxy, err := NewProxy(&Config{
		Upstream: upstream.URL,
		Capture: CaptureConfig{
			Paths:           []string{"/v1/responses"},
			MaxBodyBytes:    1 << 20,
			StorePromptText: true,
			MaxPromptBytes:  60000,
		},
	}, store, nil, nil)
	require.NoError(t, err)

	front := httptest.NewServer(proxy)
	defer front.Close()

	go func() {
		resp, err := http.Post(front.URL+"/v1/responses", "application/json",
			strings.NewReader(`{"model":"m","input":[{"role":"user","content":"hi"}]}`))
		if err == nil {
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
		}
	}()

	require.Eventually(t, func() bool { return len(store.records) == 1 }, 5*time.Second, 20*time.Millisecond,
		"the audit record must exist while the upstream stream is still open")

	record := <-store.records
	assert.Equal(t, http.StatusOK, record.StatusCode)
	assert.Equal(t, "req-123", record.RequestId, "request id must come from the upstream response header")
	assert.Equal(t, "user: hi", record.PromptText)

	close(releaseStream)
}

func TestModelFromPath(t *testing.T) {
	assert.Equal(t, "gemini-2.0-flash", modelFromPath("/v1beta/models/gemini-2.0-flash:generateContent"))
	assert.Equal(t, "gemini-pro", modelFromPath("/v1beta/models/gemini-pro"))
	assert.Empty(t, modelFromPath("/v1/chat/completions"))
}
