package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newOpenAIStreamTestContext(t *testing.T, body string) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta:        &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"},
		IsStream:           true,
		RelayFormat:        types.RelayFormatOpenAI,
		ShouldIncludeUsage: true,
		DisablePing:        true,
	}
	return c, recorder, resp, info
}

func TestOaiStreamHandlerDoesNotFinalizeOnEOFWithoutFinishReason(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"id":"chatcmpl-test","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"partial"}}]}`,
		``,
		`data: {"id":"chatcmpl-test","created":1710000000,"model":"gpt-test","choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`,
		``,
	}, "\n")
	c, recorder, resp, info := newOpenAIStreamTestContext(t, body)

	usage, err := OaiStreamHandler(c, info, resp)

	require.Nil(t, err)
	require.NotNil(t, usage)
	require.NotNil(t, info.StreamStatus)
	require.Equal(t, relaycommon.StreamEndReasonEOF, info.StreamStatus.EndReason)
	require.True(t, info.StreamStatus.HasErrors())
	require.Contains(t, info.StreamStatus.Errors[0].Message, "finish_reason")

	got := recorder.Body.String()
	require.Contains(t, got, `"content":"partial"`)
	require.NotContains(t, got, `"usage"`)
	require.NotContains(t, got, "data: [DONE]")
}

func TestOaiStreamHandlerDoesNotFinalizeAfterPartialTimeout(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 1
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"id":"chatcmpl-test","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"partial"}}]}`,
		``,
		`data: {"id":"chatcmpl-test","created":1710000000,"model":"gpt-test","choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`,
		``,
	}, "\n")
	c, recorder, resp, info := newOpenAIStreamTestContext(t, "")
	reader, writer := io.Pipe()
	resp.Body = reader
	writerDone := make(chan struct{})
	go func() {
		defer close(writerDone)
		_, _ = io.WriteString(writer, body)
	}()

	usage, err := OaiStreamHandler(c, info, resp)
	_ = writer.Close()
	<-writerDone

	require.Nil(t, err)
	require.NotNil(t, usage)
	require.NotNil(t, info.StreamStatus)
	require.Equal(t, relaycommon.StreamEndReasonTimeout, info.StreamStatus.EndReason)
	require.True(t, info.StreamStatus.HasErrors())
	require.Contains(t, info.StreamStatus.Errors[0].Message, "finish_reason")

	got := recorder.Body.String()
	require.Contains(t, got, `"content":"partial"`)
	require.NotContains(t, got, `"usage"`)
	require.NotContains(t, got, "data: [DONE]")
}

func TestOaiStreamHandlerFinalizesAfterFinishReason(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"id":"chatcmpl-test","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"complete"}}]}`,
		``,
		`data: {"id":"chatcmpl-test","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
		``,
		`data: [DONE]`,
		``,
	}, "\n")
	c, recorder, resp, info := newOpenAIStreamTestContext(t, body)

	_, err := OaiStreamHandler(c, info, resp)

	require.Nil(t, err)
	require.NotNil(t, info.StreamStatus)
	require.Equal(t, relaycommon.StreamEndReasonDone, info.StreamStatus.EndReason)
	require.False(t, info.StreamStatus.HasErrors())

	got := recorder.Body.String()
	require.Contains(t, got, `"content":"complete"`)
	require.Contains(t, got, `"finish_reason":"stop"`)
	require.Contains(t, got, "data: [DONE]")
}

func TestOaiStreamHandlerSynthesizesStopAfterDoneWithoutFinishReason(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"id":"chatcmpl-test","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"complete"},"finish_reason":null}]}`,
		``,
		`data: [DONE]`,
		``,
	}, "\n")
	c, recorder, resp, info := newOpenAIStreamTestContext(t, body)

	_, err := OaiStreamHandler(c, info, resp)

	require.Nil(t, err)
	require.NotNil(t, info.StreamStatus)
	require.Equal(t, relaycommon.StreamEndReasonDone, info.StreamStatus.EndReason)
	require.False(t, info.StreamStatus.HasErrors())

	got := recorder.Body.String()
	require.Contains(t, got, `"content":"complete"`)
	require.Contains(t, got, `"finish_reason":"stop"`)
	require.Less(t, strings.Index(got, `"finish_reason":"stop"`), strings.Index(got, "data: [DONE]"))
}

func TestOaiStreamHandlerSynthesizesFinishReasonBeforeTrailingUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"id":"chatcmpl-test","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"complete"},"finish_reason":null}]}`,
		``,
		`data: {"id":"chatcmpl-test","created":1710000000,"model":"gpt-test","choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`,
		``,
		`data: [DONE]`,
		``,
	}, "\n")
	c, recorder, resp, info := newOpenAIStreamTestContext(t, body)

	_, err := OaiStreamHandler(c, info, resp)

	require.Nil(t, err)
	require.NotNil(t, info.StreamStatus)
	require.Equal(t, relaycommon.StreamEndReasonDone, info.StreamStatus.EndReason)
	require.False(t, info.StreamStatus.HasErrors())

	got := recorder.Body.String()
	finishIndex := strings.Index(got, `"finish_reason":"stop"`)
	usageIndex := strings.Index(got, `"total_tokens":2`)
	doneIndex := strings.Index(got, "data: [DONE]")
	require.NotEqual(t, -1, finishIndex)
	require.NotEqual(t, -1, usageIndex)
	require.NotEqual(t, -1, doneIndex)
	require.Less(t, finishIndex, usageIndex)
	require.Less(t, usageIndex, doneIndex)
}

func TestOaiStreamHandlerSynthesizesToolCallsAfterDone(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"id":"chatcmpl-test","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call-1","type":"function","function":{"name":"lookup","arguments":"{}"}}]},"finish_reason":null}]}`,
		``,
		`data: [DONE]`,
		``,
	}, "\n")
	c, recorder, resp, info := newOpenAIStreamTestContext(t, body)

	_, err := OaiStreamHandler(c, info, resp)

	require.Nil(t, err)
	require.NotNil(t, info.StreamStatus)
	require.Equal(t, relaycommon.StreamEndReasonDone, info.StreamStatus.EndReason)
	require.False(t, info.StreamStatus.HasErrors())

	got := recorder.Body.String()
	require.Contains(t, got, `"finish_reason":"tool_calls"`)
	require.Less(t, strings.Index(got, `"finish_reason":"tool_calls"`), strings.Index(got, "data: [DONE]"))
}

func TestOaiStreamHandlerDoesNotFinalizeEOFWhenAnyChoiceIsIncomplete(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"id":"chatcmpl-test","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"content":"complete"},"finish_reason":"stop"},{"index":1,"delta":{"content":"partial"},"finish_reason":null}]}`,
		``,
	}, "\n")
	c, recorder, resp, info := newOpenAIStreamTestContext(t, body)

	_, err := OaiStreamHandler(c, info, resp)

	require.Nil(t, err)
	require.NotNil(t, info.StreamStatus)
	require.Equal(t, relaycommon.StreamEndReasonEOF, info.StreamStatus.EndReason)
	require.True(t, info.StreamStatus.HasErrors())

	got := recorder.Body.String()
	require.NotContains(t, got, `"finish_reason":"stop"`)
	require.NotContains(t, got, "data: [DONE]")
}

func TestOaiStreamHandlerFinalizesOnEOFAfterFinishReason(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"id":"chatcmpl-test","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"complete"}}]}`,
		``,
		`data: {"id":"chatcmpl-test","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
		``,
	}, "\n")
	c, recorder, resp, info := newOpenAIStreamTestContext(t, body)

	_, err := OaiStreamHandler(c, info, resp)

	require.Nil(t, err)
	require.NotNil(t, info.StreamStatus)
	require.Equal(t, relaycommon.StreamEndReasonEOF, info.StreamStatus.EndReason)
	require.False(t, info.StreamStatus.HasErrors())

	got := recorder.Body.String()
	require.Contains(t, got, `"content":"complete"`)
	require.Contains(t, got, `"finish_reason":"stop"`)
	require.Contains(t, got, "data: [DONE]")
}
