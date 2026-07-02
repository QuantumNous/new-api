package openai

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func setupResponsesStreamHandlerTest(t *testing.T, body string) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(body)),
	}
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:         12,
			UpstreamModelName: "gpt-5",
		},
	}

	return c, recorder, resp, info
}

func TestOaiResponsesStreamHandlerDefersTerminalFailureBeforeWriting(t *testing.T) {
	c, recorder, resp, info := setupResponsesStreamHandlerTest(t, strings.Join([]string{
		`event: response.failed`,
		`data: {"type":"response.failed","response":{"error":{"message":"The encrypted content gAAA...as53 could not be verified. Reason: Encrypted content could not be decrypted or parsed.","type":"invalid_request_error","param":"","code":"thinking_signature_invalid"}}}`,
		``,
	}, "\n"))

	usage, newAPIError := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, newAPIError)
	require.Equal(t, "thinking_signature_invalid", string(newAPIError.GetErrorCode()))
	require.Empty(t, recorder.Body.String())
	require.False(t, c.Writer.Written())
}

func TestOaiResponsesStreamHandlerPassesTerminalFailureAfterWriting(t *testing.T) {
	c, recorder, resp, info := setupResponsesStreamHandlerTest(t, strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"partial"}`,
		`data: {"type":"response.failed","response":{"error":{"message":"upstream failed","type":"server_error","param":"","code":"server_error"}}}`,
		``,
	}, "\n"))

	usage, newAPIError := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, newAPIError)
	require.Equal(t, "server_error", string(newAPIError.GetErrorCode()))
	body := recorder.Body.String()
	require.Contains(t, body, "event: response.output_text.delta")
	require.Contains(t, body, "event: response.failed")
	require.Contains(t, body, `"code":"server_error"`)
}

func TestOaiResponsesStreamHandlerDefersReplayableFailureBeforeWriting(t *testing.T) {
	c, recorder, resp, info := setupResponsesStreamHandlerTest(t, strings.Join([]string{
		`data: {"type":"response.created","response":{"id":"resp_1"}}`,
		`data: {"type":"response.failed","response":{"error":{"message":"code: invalid_encrypted_content; message: The encrypted content gAAA...V2ln could not be verified. Reason: Encrypted content could not be decrypted or parsed.","type":"invalid_request_error","param":"","code":"-4003"}}}`,
		``,
	}, "\n"))
	info.ResponsesTranscriptReplay = &relaycommon.ResponsesTranscriptReplayState{
		RequestBody: []byte(`{"input":[{"type":"reasoning","encrypted_content":"bad-ciphertext","summary":[]}]}`),
	}

	usage, newAPIError := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, newAPIError)
	require.Equal(t, "-4003", string(newAPIError.GetErrorCode()))
	require.Empty(t, recorder.Body.String())
	require.False(t, c.Writer.Written())
}

func TestOaiResponsesStreamHandlerFlushesBufferedPreludeOnNormalStream(t *testing.T) {
	c, recorder, resp, info := setupResponsesStreamHandlerTest(t, strings.Join([]string{
		`data: {"type":"response.created","response":{"id":"resp_1"}}`,
		`data: {"type":"response.output_text.delta","delta":"hi"}`,
		`data: {"type":"response.completed","response":{"usage":{"input_tokens":2,"output_tokens":1,"total_tokens":3}}}`,
		`data: [DONE]`,
		``,
	}, "\n"))
	info.ResponsesTranscriptReplay = &relaycommon.ResponsesTranscriptReplayState{}

	usage, newAPIError := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	require.Equal(t, 2, usage.PromptTokens)
	require.Equal(t, 1, usage.CompletionTokens)
	require.Equal(t, 3, usage.TotalTokens)
	require.Equal(t, relaycommon.StreamEndReasonDone, info.StreamStatus.EndReason)

	body := recorder.Body.String()
	require.Contains(t, body, "event: response.created")
	require.Contains(t, body, "event: response.output_text.delta")
}

func TestOaiResponsesStreamHandlerDefersEOFBeforeCompletedBeforeWriting(t *testing.T) {
	c, recorder, resp, info := setupResponsesStreamHandlerTest(t, strings.Join([]string{
		`data: {"type":"response.created","response":{"id":"resp_1"}}`,
		`data: {"type":"response.in_progress","response":{"id":"resp_1"}}`,
		``,
	}, "\n"))
	info.ResponsesTranscriptReplay = &relaycommon.ResponsesTranscriptReplayState{}

	usage, newAPIError := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, newAPIError)
	require.Equal(t, "bad_response", string(newAPIError.GetErrorCode()))
	require.Contains(t, newAPIError.Error(), "completion event")
	require.Empty(t, recorder.Body.String())
	require.False(t, c.Writer.Written())
}

func TestOaiResponsesStreamHandlerEmitsFailureWhenEOFBeforeCompletedAfterWriting(t *testing.T) {
	c, recorder, resp, info := setupResponsesStreamHandlerTest(t, strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"partial"}`,
		``,
	}, "\n"))

	usage, newAPIError := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, newAPIError)
	require.Equal(t, "bad_response", string(newAPIError.GetErrorCode()))
	require.Contains(t, newAPIError.Error(), "completion event")
	body := recorder.Body.String()
	require.Contains(t, body, "event: response.output_text.delta")
	require.Contains(t, body, "event: response.failed")
	require.Contains(t, body, "responses stream closed before completion event")
	require.NotContains(t, body, `"object":""`)
}

func TestOaiResponsesStreamHandlerAllowsCompletedStreamWithoutDone(t *testing.T) {
	c, recorder, resp, info := setupResponsesStreamHandlerTest(t, strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"hi"}`,
		`data: {"type":"response.completed","response":{"usage":{"input_tokens":2,"output_tokens":1,"total_tokens":3}}}`,
		``,
	}, "\n"))

	usage, newAPIError := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	require.Equal(t, 2, usage.PromptTokens)
	require.Equal(t, 1, usage.CompletionTokens)
	require.Equal(t, 3, usage.TotalTokens)
	require.Equal(t, relaycommon.StreamEndReasonDone, info.StreamStatus.EndReason)
	require.NotContains(t, recorder.Body.String(), "event: response.failed")
}

func TestResponsesStreamOpenAIErrorFallsBackForEmptyPayload(t *testing.T) {
	openAIError := responsesStreamOpenAIError(dto.ResponsesStreamResponse{Type: responsesStreamEventError})

	require.Equal(t, "bad_response", openAIError.Code)
	require.Contains(t, openAIError.Message, "response.error")
}

func TestResponsesStreamOpenAIErrorFallbackIncludesResponseStatus(t *testing.T) {
	openAIError := responsesStreamOpenAIError(dto.ResponsesStreamResponse{
		Type: responsesStreamEventFailed,
		Response: &dto.OpenAIResponsesResponse{
			Status: json.RawMessage(`"failed"`),
			IncompleteDetails: &dto.IncompleteDetails{
				Reason: "upstream stopped",
			},
		},
	})

	require.Equal(t, "bad_response", openAIError.Code)
	require.Contains(t, openAIError.Message, "status=failed")
	require.Contains(t, openAIError.Message, "upstream stopped")
}

func TestResponsesStreamOpenAIErrorUsesTopLevelError(t *testing.T) {
	openAIError := responsesStreamOpenAIError(dto.ResponsesStreamResponse{
		Type: responsesStreamEventFailed,
		Error: map[string]interface{}{
			"message": "code: invalid_encrypted_content; message: could not verify",
			"type":    "invalid_request_error",
			"code":    "-4003",
		},
	})

	require.Equal(t, "-4003", openAIError.Code)
	require.Equal(t, "invalid_request_error", openAIError.Type)
	require.Contains(t, openAIError.Message, "invalid_encrypted_content")
}
