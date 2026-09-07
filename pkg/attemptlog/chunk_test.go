package attemptlog

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestClassifyChunk asserts the contract TTFT depends on: a chunk counts as the
// first token only when it carries generated content. The stream openers and
// keep-alives listed here are the false positives that made ttft_ms
// systematically low, and they also fed SentFirstToken into outcome
// classification, so misreading one changes the outcome code too.
func TestClassifyChunk(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		payload string
		want    chunkKind
	}{
		// OpenAI chat completions.
		{
			name:    "openai role only opener",
			payload: `{"choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}`,
			want:    chunkNoContent,
		},
		{
			name:    "openai role opener without content key",
			payload: `{"choices":[{"index":0,"delta":{"role":"assistant"}}]}`,
			want:    chunkNoContent,
		},
		{
			name:    "openai content delta",
			payload: `{"choices":[{"index":0,"delta":{"content":"Hello"}}]}`,
			want:    chunkContent,
		},
		{
			name:    "openai reasoning content delta",
			payload: `{"choices":[{"index":0,"delta":{"reasoning_content":"thinking"}}]}`,
			want:    chunkContent,
		},
		{
			name:    "openai openrouter reasoning delta",
			payload: `{"choices":[{"index":0,"delta":{"reasoning":"thinking"}}]}`,
			want:    chunkContent,
		},
		{
			name:    "openai tool call delta",
			payload: `{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"get_weather"}}]}}]}`,
			want:    chunkContent,
		},
		{
			name:    "openai empty tool call array",
			payload: `{"choices":[{"index":0,"delta":{"tool_calls":[]}}]}`,
			want:    chunkNoContent,
		},
		{
			name:    "openai audio delta",
			payload: `{"choices":[{"index":0,"delta":{"audio":{"data":"AAAA"}}}]}`,
			want:    chunkContent,
		},
		{
			name:    "openai finish reason only",
			payload: `{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
			want:    chunkNoContent,
		},
		{
			name:    "openai null content",
			payload: `{"choices":[{"index":0,"delta":{"content":null}}]}`,
			want:    chunkNoContent,
		},
		{
			name:    "openai usage only chunk with empty choices",
			payload: `{"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":0}}`,
			want:    chunkNoContent,
		},
		{
			name:    "openai content on second choice",
			payload: `{"choices":[{"index":0,"delta":{"role":"assistant"}},{"index":1,"delta":{"content":"hi"}}]}`,
			want:    chunkContent,
		},
		// Legacy completions.
		{
			name:    "legacy completions text",
			payload: `{"choices":[{"index":0,"text":"once upon"}]}`,
			want:    chunkContent,
		},
		{
			name:    "legacy completions empty text",
			payload: `{"choices":[{"index":0,"text":""}]}`,
			want:    chunkNoContent,
		},
		// Anthropic messages.
		{
			name:    "claude ping",
			payload: `{"type":"ping"}`,
			want:    chunkNoContent,
		},
		{
			name:    "claude message_start",
			payload: `{"type":"message_start","message":{"id":"msg_1","role":"assistant","content":[],"usage":{"input_tokens":25,"output_tokens":1}}}`,
			want:    chunkNoContent,
		},
		{
			name:    "claude content_block_start text",
			payload: `{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`,
			want:    chunkNoContent,
		},
		{
			name:    "claude content_block_start tool_use",
			payload: `{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_1","name":"get_weather","input":{}}}`,
			want:    chunkContent,
		},
		{
			name:    "claude content_block_delta text",
			payload: `{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}`,
			want:    chunkContent,
		},
		{
			name:    "claude content_block_delta thinking",
			payload: `{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"let me"}}`,
			want:    chunkContent,
		},
		{
			name:    "claude content_block_delta partial_json",
			payload: `{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"city\":"}}`,
			want:    chunkContent,
		},
		{
			name:    "claude content_block_delta empty text",
			payload: `{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":""}}`,
			want:    chunkNoContent,
		},
		{
			name:    "claude message_delta",
			payload: `{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":15}}`,
			want:    chunkNoContent,
		},
		{
			name:    "claude content_block_stop",
			payload: `{"type":"content_block_stop","index":0}`,
			want:    chunkNoContent,
		},
		// Gemini.
		{
			name:    "gemini text part",
			payload: `{"candidates":[{"content":{"role":"model","parts":[{"text":"Hello"}]}}]}`,
			want:    chunkContent,
		},
		{
			name:    "gemini empty text part",
			payload: `{"candidates":[{"content":{"role":"model","parts":[{"text":""}]}}]}`,
			want:    chunkNoContent,
		},
		{
			name:    "gemini function call part",
			payload: `{"candidates":[{"content":{"role":"model","parts":[{"functionCall":{"name":"get_weather","args":{}}}]}}]}`,
			want:    chunkContent,
		},
		{
			name:    "gemini inline data part",
			payload: `{"candidates":[{"content":{"role":"model","parts":[{"inlineData":{"mimeType":"image/png","data":"AAAA"}}]}}]}`,
			want:    chunkContent,
		},
		{
			name:    "gemini finish reason only",
			payload: `{"candidates":[{"content":{"role":"model","parts":[]},"finishReason":"STOP"}]}`,
			want:    chunkNoContent,
		},
		{
			name:    "gemini usage metadata only",
			payload: `{"candidates":[],"usageMetadata":{"promptTokenCount":10}}`,
			want:    chunkNoContent,
		},
		{
			name:    "gemini prompt feedback block",
			payload: `{"promptFeedback":{"blockReason":"SAFETY"},"candidates":[]}`,
			want:    chunkNoContent,
		},
		// OpenAI Responses and realtime, which share the ".delta" convention.
		{
			name:    "responses created",
			payload: `{"type":"response.created","response":{"id":"resp_1","status":"in_progress"}}`,
			want:    chunkNoContent,
		},
		{
			name:    "responses output_text delta",
			payload: `{"type":"response.output_text.delta","item_id":"msg_1","delta":"Hello"}`,
			want:    chunkContent,
		},
		{
			name:    "responses output_text delta empty",
			payload: `{"type":"response.output_text.delta","item_id":"msg_1","delta":""}`,
			want:    chunkNoContent,
		},
		{
			name:    "responses function call arguments delta",
			payload: `{"type":"response.function_call_arguments.delta","item_id":"fc_1","delta":"{\"city\":"}`,
			want:    chunkContent,
		},
		{
			name:    "responses completed",
			payload: `{"type":"response.completed","response":{"id":"resp_1","usage":{"input_tokens":10}}}`,
			want:    chunkNoContent,
		},
		{
			name:    "realtime audio delta",
			payload: `{"type":"response.audio.delta","response_id":"resp_1","delta":"AAAA"}`,
			want:    chunkContent,
		},
		{
			name:    "realtime session created",
			payload: `{"type":"session.created","session":{"id":"sess_1"}}`,
			want:    chunkNoContent,
		},
		// Unreadable shapes must stay unknown so the caller can fall back
		// rather than report "no content ever arrived".
		{
			name:    "bespoke provider envelope",
			payload: `{"event":"message","answer":"hi","conversation_id":"c1"}`,
			want:    chunkUnknown,
		},
		{
			name:    "baidu style result field",
			payload: `{"result":"hello","is_end":false}`,
			want:    chunkUnknown,
		},
		{
			name:    "malformed json",
			payload: `{"choices":[{"delta":`,
			want:    chunkUnknown,
		},
		{
			name:    "non object payload",
			payload: `"OPENROUTER PROCESSING"`,
			want:    chunkUnknown,
		},
		{
			name:    "numeric type field is not an event envelope",
			payload: `{"type":7,"value":"x"}`,
			want:    chunkUnknown,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tc.want, classifyChunk(tc.payload))
		})
	}
}

func contextWithAttempt(t *testing.T, attempt *Attempt) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	common.SetContextKey(c, constant.ContextKeyRelayAttempt, attempt)
	return c
}

// TestNoteChunkStampsFirstContentOnly is the behavior that fixes the bug: a
// stream that opens with a role-only delta must be timed from the content chunk
// that follows, not from the opener.
func TestNoteChunkStampsFirstContentOnly(t *testing.T) {
	t.Parallel()

	attempt := &Attempt{}
	c := contextWithAttempt(t, attempt)

	NoteChunk(c, `{"choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}`)
	require.False(t, attempt.firstChunkTime.IsZero(), "the opener must still be recorded as a chunk")
	require.True(t, attempt.firstContentTime.IsZero(), "a role-only opener is not the first token")

	NoteChunk(c, `{"choices":[{"index":0,"delta":{"content":"Hello"}}]}`)
	require.False(t, attempt.firstContentTime.IsZero(), "the content chunk is the first token")
	firstContent := attempt.firstContentTime

	NoteChunk(c, `{"choices":[{"index":0,"delta":{"content":" world"}}]}`)
	assert.Equal(t, firstContent, attempt.firstContentTime, "later content must not move the first token time")
	assert.False(t, attempt.sawUnknownChunk)
}

func TestNoteChunkContentFreeStream(t *testing.T) {
	t.Parallel()

	attempt := &Attempt{}
	c := contextWithAttempt(t, attempt)

	NoteChunk(c, `{"type":"message_start","message":{"id":"msg_1","content":[]}}`)
	NoteChunk(c, `{"type":"ping"}`)
	NoteChunk(c, `{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`)

	assert.False(t, attempt.firstChunkTime.IsZero())
	assert.True(t, attempt.firstContentTime.IsZero(), "a stream of openers and pings produced no token")
	assert.False(t, attempt.sawUnknownChunk)
}

func TestNoteChunkFlagsUnknownShape(t *testing.T) {
	t.Parallel()

	attempt := &Attempt{}
	c := contextWithAttempt(t, attempt)

	NoteChunk(c, `{"event":"message","answer":"hi"}`)

	assert.False(t, attempt.firstChunkTime.IsZero())
	assert.True(t, attempt.firstContentTime.IsZero())
	assert.True(t, attempt.sawUnknownChunk, "an unreadable shape must be flagged so the caller can fall back")
}

// TestNoteChunkWithoutAttempt covers the disabled-telemetry path: BeginAttempt
// returns nil and nothing is on the context, so this must not panic.
func TestNoteChunkWithoutAttempt(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)

	NoteChunk(c, `{"choices":[{"delta":{"content":"Hello"}}]}`)
	NoteChunk(nil, `{"choices":[{"delta":{"content":"Hello"}}]}`)
}
