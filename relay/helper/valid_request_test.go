package helper

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"github.com/QuantumNous/new-api/types"
)

func newClaudeCtx(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	return ctx
}

func TestGetAndValidateClaudeRequest_ThinkingTypeRequired(t *testing.T) {
	base := `"model":"claude-opus-4-8","max_tokens":50,"messages":[{"role":"user","content":"hi"}]`

	// requireBadRequest asserts not just the 400 status but that the rendered
	// Claude error has the Anthropic-shaped type and an uncorrupted message that
	// names the field — guarding against the masking/wrong-type regressions and
	// against the predicate being weakened so the 400 comes from another path.
	requireBadRequest := func(t *testing.T, err error) {
		t.Helper()
		require.Error(t, err)
		var apiErr *types.NewAPIError
		require.ErrorAs(t, err, &apiErr)
		require.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
		ce := apiErr.ToClaudeError()
		require.Equal(t, "invalid_request_error", ce.Type)
		require.Contains(t, ce.Message, "thinking")
		require.NotContains(t, ce.Message, "***")
	}

	t.Run("invalid thinking.enable (no type) -> 400", func(t *testing.T) {
		_, err := GetAndValidateClaudeRequest(newClaudeCtx("{" + base + `,"thinking":{"enable":true}}`))
		requireBadRequest(t, err)
	})

	t.Run("empty thinking object -> 400", func(t *testing.T) {
		_, err := GetAndValidateClaudeRequest(newClaudeCtx("{" + base + `,"thinking":{}}`))
		requireBadRequest(t, err)
	})

	t.Run("explicit empty type -> 400", func(t *testing.T) {
		_, err := GetAndValidateClaudeRequest(newClaudeCtx("{" + base + `,"thinking":{"type":""}}`))
		requireBadRequest(t, err)
	})

	t.Run("valid thinking type=enabled -> ok", func(t *testing.T) {
		req, err := GetAndValidateClaudeRequest(newClaudeCtx("{" + base + `,"thinking":{"type":"enabled","budget_tokens":2000}}`))
		require.NoError(t, err)
		require.NotNil(t, req)
		require.Equal(t, "enabled", req.Thinking.Type)
	})

	t.Run("valid thinking type=adaptive -> ok", func(t *testing.T) {
		req, err := GetAndValidateClaudeRequest(newClaudeCtx("{" + base + `,"thinking":{"type":"adaptive"}}`))
		require.NoError(t, err)
		require.NotNil(t, req)
	})

	t.Run("no thinking field -> ok", func(t *testing.T) {
		req, err := GetAndValidateClaudeRequest(newClaudeCtx("{" + base + "}"))
		require.NoError(t, err)
		require.NotNil(t, req)
	})

	t.Run("thinking null -> ok", func(t *testing.T) {
		req, err := GetAndValidateClaudeRequest(newClaudeCtx("{" + base + `,"thinking":null}`))
		require.NoError(t, err)
		require.NotNil(t, req)
		require.Nil(t, req.Thinking)
	})

	// Regression guard: effort-suffix models get thinking.type synthesized by the
	// native handler later, so an empty-type thinking object must NOT be rejected
	// here (it worked before this validation was added).
	t.Run("effort-suffix model + empty thinking -> ok (handler synthesizes type)", func(t *testing.T) {
		body := `{"model":"claude-opus-4-8-high","max_tokens":50,"messages":[{"role":"user","content":"hi"}],"thinking":{}}`
		req, err := GetAndValidateClaudeRequest(newClaudeCtx(body))
		require.NoError(t, err)
		require.NotNil(t, req)
	})
}
