package coze

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// TestDoRequestRejectsMalformedCreateResponse verifies malformed provider JSON
// stops the non-stream flow before conversation polling begins.
func TestDoRequestRejectsMalformedCreateResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	receivedBody := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		receivedBody <- string(body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `not-json`)
	}))
	defer server.Close()

	service.InitHttpClient()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: server.URL},
	}

	response, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(`{}`))
	require.Nil(t, response)
	require.ErrorContains(t, err, "unmarshal create chat response failed")
	require.JSONEq(t, `{}`, <-receivedBody)
}
