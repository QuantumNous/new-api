package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenaiTTSHandlerCommitsSSEHeadersBeforeStreamStatus(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/speech", strings.NewReader("{}"))
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header: http.Header{
			"Content-Type": {"application/octet-stream"},
		},
		Body: io.NopCloser(strings.NewReader("data: [DONE]\n\n")),
	}
	info := &relaycommon.RelayInfo{
		IsStream:    true,
		DisablePing: true,
	}
	info.SetEstimatePromptTokens(1)

	usage := OpenaiTTSHandler(c, resp, info)
	require.NotNil(t, usage)

	committedHeaders := recorder.Result().Header
	assert.Equal(t, "text/event-stream", committedHeaders.Get("Content-Type"))
	assert.Equal(t, "no-cache", committedHeaders.Get("Cache-Control"))
	assert.Equal(t, "no", committedHeaders.Get("X-Accel-Buffering"))
}
