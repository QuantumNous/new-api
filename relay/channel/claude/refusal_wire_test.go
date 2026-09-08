package claude

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// handleClaudeBody runs one upstream response body through the non-streaming
// handler exactly as the relay does, and returns what settlement would see.
func handleClaudeBody(t *testing.T, body string) (*gin.Context, *dto.Usage) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude}
	claudeInfo := &ClaudeResponseInfo{Usage: &dto.Usage{}}

	require.Nil(t, HandleClaudeResponseData(ctx, info, claudeInfo, nil, []byte(body)))
	return ctx, claudeInfo.Usage
}

// The refusal body published in Anthropic's refusals-and-fallback docs.
const refusalResponseBody = `{
  "id": "msg_01XFUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "model": "claude-fable-5",
  "content": [],
  "stop_reason": "refusal",
  "stop_details": {
    "type": "refusal",
    "category": "cyber",
    "explanation": "This request was declined because it could enable cyber harm."
  },
  "usage": {"input_tokens": 412, "output_tokens": 0}
}`

func TestHandleClaudeResponseDataMarksRefusalAndReportsTokens(t *testing.T) {
	ctx, usage := handleClaudeBody(t, refusalResponseBody)

	assert.True(t, common.GetContextKeyBool(ctx, constant.ContextKeyUpstreamRefusal))
	// Tokens are still reported to the client and the log; only the charge goes.
	assert.Equal(t, 412, usage.PromptTokens)
	assert.Equal(t, 0, usage.CompletionTokens)
	require.NotNil(t, usage.BillingUsage)
	assert.Empty(t, usage.BillingUsage.ClaudeUsage.BillableIterations())
}

// The server-side fallback body published in the same docs.
const fallbackResponseBody = `{
  "id": "msg_01XFUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "model": "claude-opus-4-8",
  "content": [
    {"type": "fallback", "from": {"model": "claude-fable-5"}, "to": {"model": "claude-opus-4-8"}},
    {"type": "text", "text": "Hi! How can I help you today?"}
  ],
  "stop_reason": "end_turn",
  "stop_details": null,
  "usage": {
    "input_tokens": 412,
    "output_tokens": 264,
    "cache_read_input_tokens": 0,
    "cache_creation_input_tokens": 0,
    "iterations": [
      {"type": "message", "model": "claude-fable-5", "input_tokens": 535, "output_tokens": 0,
       "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0},
      {"type": "fallback_message", "model": "claude-opus-4-8", "input_tokens": 412, "output_tokens": 264,
       "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0}
    ]
  }
}`

func TestHandleClaudeResponseDataCarriesFallbackIterationsToSettlement(t *testing.T) {
	ctx, usage := handleClaudeBody(t, fallbackResponseBody)

	// A served fallback is not a refusal: a model answered the request.
	assert.False(t, common.GetContextKeyBool(ctx, constant.ContextKeyUpstreamRefusal))

	// Top-level counts describe only the serving attempt.
	assert.Equal(t, 412, usage.PromptTokens)
	assert.Equal(t, 264, usage.CompletionTokens)

	require.NotNil(t, usage.BillingUsage)
	require.Len(t, usage.BillingUsage.ClaudeUsage.Iterations, 2)

	// The refused hop emitted no output, so only the serving hop is billable.
	billable := usage.BillingUsage.ClaudeUsage.BillableIterations()
	require.Len(t, billable, 1)
	assert.Equal(t, "claude-opus-4-8", billable[0].Model)
	assert.Equal(t, 264, billable[0].OutputTokens)
}

// When every model in the chain refuses, the response is the last refusal and
// nothing is billable.
func TestHandleClaudeResponseDataFullyRefusedFallbackChainIsNotBillable(t *testing.T) {
	body := `{
	  "id": "msg_1", "type": "message", "role": "assistant", "model": "claude-opus-4-8",
	  "content": [], "stop_reason": "refusal",
	  "stop_details": {"type": "refusal", "category": "bio", "explanation": "declined"},
	  "usage": {
	    "input_tokens": 412, "output_tokens": 0,
	    "iterations": [
	      {"type": "message", "model": "claude-fable-5", "input_tokens": 535, "output_tokens": 0},
	      {"type": "fallback_message", "model": "claude-opus-4-8", "input_tokens": 412, "output_tokens": 0}
	    ]
	  }
	}`

	ctx, usage := handleClaudeBody(t, body)

	assert.True(t, common.GetContextKeyBool(ctx, constant.ContextKeyUpstreamRefusal))
	assert.Empty(t, usage.BillingUsage.ClaudeUsage.BillableIterations())
}
