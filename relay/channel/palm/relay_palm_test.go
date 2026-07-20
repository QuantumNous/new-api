package palm

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type closeNotifyRecorder struct {
	*httptest.ResponseRecorder
	closed chan bool
}

func (r *closeNotifyRecorder) CloseNotify() <-chan bool {
	return r.closed
}

func TestPalmStreamHandlerRecordsCurrentAttemptFirstResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := &closeNotifyRecorder{
		ResponseRecorder: httptest.NewRecorder(),
		closed:           make(chan bool),
	}
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(`{"candidates":[{"author":"ai","content":"hello"}]}`)),
	}
	info := &relaycommon.RelayInfo{IsStream: true}
	attemptStart := info.BeginChannelAttempt()

	apiErr, responseText := palmStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.Equal(t, "hello", responseText)
	require.Contains(t, recorder.Body.String(), "hello")
	require.False(t, info.FirstResponseTimeForAttempt(attemptStart).IsZero())
}
