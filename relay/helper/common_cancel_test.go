package helper

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type failingReadCloser struct {
	err error
}

func (f failingReadCloser) Read([]byte) (int, error) { return 0, f.err }
func (f failingReadCloser) Close() error             { return nil }

func TestReadResponseBodyClientCancellation(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("client canceled returns 499 request_cancelled with skipRetry", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		reqCtx, cancel := context.WithCancel(context.Background())
		cancel()
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil).WithContext(reqCtx)

		resp := &http.Response{
			StatusCode: http.StatusOK,
			Body:       failingReadCloser{err: context.Canceled},
		}
		_, apiErr := ReadResponseBody(c, resp, types.ErrorCodeReadResponseBodyFailed)
		require.NotNil(t, apiErr)
		assert.Equal(t, types.ErrorCodeRequestCancelled, apiErr.GetErrorCode())
		assert.Equal(t, 499, apiErr.StatusCode)
		assert.True(t, types.IsSkipRetryError(apiErr))
	})

	t.Run("upstream body error keeps caller error code and 500", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

		resp := &http.Response{
			StatusCode: http.StatusOK,
			Body:       failingReadCloser{err: io.ErrUnexpectedEOF},
		}
		_, apiErr := ReadResponseBody(c, resp, types.ErrorCodeReadResponseBodyFailed)
		require.NotNil(t, apiErr)
		assert.Equal(t, types.ErrorCodeReadResponseBodyFailed, apiErr.GetErrorCode())
		assert.Equal(t, http.StatusInternalServerError, apiErr.StatusCode)
		assert.False(t, types.IsSkipRetryError(apiErr))
		assert.Contains(t, apiErr.Error(), io.ErrUnexpectedEOF.Error())
	})
}
