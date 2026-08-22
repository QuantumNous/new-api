package common

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newRestoreContext(t *testing.T, origin string, upstream string) *gin.Context {
	t.Helper()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	SetModelRestore(c, origin, upstream)
	return c
}

func TestRestoreModelName(t *testing.T) {
	tests := []struct {
		name     string
		origin   string
		upstream string
		model    string
		want     string
	}{
		{"exact upstream is restored", "gpt-5.5", "deepseek-v4-flash", "deepseek-v4-flash", "gpt-5.5"},
		{"dated upstream variant is restored", "gpt-5.5", "deepseek-v4-flash", "deepseek-v4-flash-2026-08-01", "gpt-5.5"},
		{"adaptor-stripped suffix is restored", "gpt-5.5", "deepseek-v4-flash-thinking", "deepseek-v4-flash", "gpt-5.5"},
		{"origin name is left alone", "gpt-5.5", "deepseek-v4-flash", "gpt-5.5", "gpt-5.5"},
		{"unrelated model is left alone", "gpt-5.5", "deepseek-v4-flash", "claude-fable-5", "claude-fable-5"},
		{"empty model is left alone", "gpt-5.5", "deepseek-v4-flash", "", ""},
		{"self mapping records nothing", "gpt-5.5", "gpt-5.5", "gpt-5.5", "gpt-5.5"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newRestoreContext(t, tt.origin, tt.upstream)
			assert.Equal(t, tt.want, RestoreModelName(c, tt.model))
		})
	}
}

func TestRestoreModelNameWithoutMapping(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	assert.Equal(t, "deepseek-v4-flash", RestoreModelName(c, "deepseek-v4-flash"))
	assert.Equal(t, `{"model":"deepseek-v4-flash"}`, string(RestoreModelNameInJSON(c, []byte(`{"model":"deepseek-v4-flash"}`))))
}

func TestClearModelRestore(t *testing.T) {
	c := newRestoreContext(t, "gpt-5.5", "deepseek-v4-flash")
	require.Equal(t, "gpt-5.5", RestoreModelName(c, "deepseek-v4-flash"))
	ClearModelRestore(c)
	assert.Equal(t, "deepseek-v4-flash", RestoreModelName(c, "deepseek-v4-flash"))
}

func TestRestoreModelNameInJSON(t *testing.T) {
	tests := []struct {
		name string
		body string
		want string
	}{
		{
			"openai chat completion",
			`{"id":"chatcmpl-1","model":"deepseek-v4-flash","choices":[]}`,
			`{"id":"chatcmpl-1","model":"gpt-5.5","choices":[]}`,
		},
		{
			"claude message_start nests model",
			`{"type":"message_start","message":{"id":"msg_1","model":"deepseek-v4-flash"}}`,
			`{"type":"message_start","message":{"id":"msg_1","model":"gpt-5.5"}}`,
		},
		{
			"openai responses nests model",
			`{"type":"response.created","response":{"id":"resp_1","model":"deepseek-v4-flash"}}`,
			`{"type":"response.created","response":{"id":"resp_1","model":"gpt-5.5"}}`,
		},
		{
			"gemini uses modelVersion",
			`{"candidates":[],"modelVersion":"deepseek-v4-flash"}`,
			`{"candidates":[],"modelVersion":"gpt-5.5"}`,
		},
		{
			"unrelated model is preserved",
			`{"model":"claude-fable-5"}`,
			`{"model":"claude-fable-5"}`,
		},
		{
			"model appearing only in content is preserved",
			`{"model":"gpt-5.5","choices":[{"delta":{"content":"deepseek-v4-flash"}}]}`,
			`{"model":"gpt-5.5","choices":[{"delta":{"content":"deepseek-v4-flash"}}]}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newRestoreContext(t, "gpt-5.5", "deepseek-v4-flash")
			assert.JSONEq(t, tt.want, string(RestoreModelNameInJSON(c, []byte(tt.body))))
		})
	}
}

func TestRestoreModelNameInStringPassesThroughNonJSON(t *testing.T) {
	c := newRestoreContext(t, "gpt-5.5", "deepseek-v4-flash")
	assert.Equal(t, "[DONE]", RestoreModelNameInString(c, "[DONE]"))
	assert.Equal(t, "", RestoreModelNameInString(c, ""))
	assert.Equal(t, "not json deepseek-v4-flash", RestoreModelNameInString(c, "not json deepseek-v4-flash"))
}

func TestRestoreModelNameInStringRewritesStreamChunk(t *testing.T) {
	c := newRestoreContext(t, "gpt-5.5", "deepseek-v4-flash")
	chunk := `{"id":"chatcmpl-1","object":"chat.completion.chunk","model":"deepseek-v4-flash","choices":[{"delta":{"content":"hi"}}]}`
	assert.JSONEq(t,
		`{"id":"chatcmpl-1","object":"chat.completion.chunk","model":"gpt-5.5","choices":[{"delta":{"content":"hi"}}]}`,
		RestoreModelNameInString(c, chunk))
}
