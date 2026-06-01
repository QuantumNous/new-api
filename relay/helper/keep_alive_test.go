package helper

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type processingRecorder struct {
	header  http.Header
	codes   []int
	body    bytes.Buffer
	flushed int
}

func (r *processingRecorder) Header() http.Header {
	if r.header == nil {
		r.header = http.Header{}
	}
	return r.header
}

func (r *processingRecorder) WriteHeader(code int) {
	r.codes = append(r.codes, code)
}

func (r *processingRecorder) Write(data []byte) (int, error) {
	if len(r.codes) == 0 {
		r.WriteHeader(http.StatusOK)
	}
	return r.body.Write(data)
}

func (r *processingRecorder) Flush() {
	r.flushed++
}

func TestWriteProcessingDoesNotCommitGinWriter(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := &processingRecorder{}
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	require.NoError(t, WriteProcessing(c))
	require.False(t, c.Writer.Written())
	require.Equal(t, []int{http.StatusProcessing}, recorder.codes)
	require.Equal(t, 1, recorder.flushed)

	c.String(http.StatusOK, "ok")

	require.True(t, c.Writer.Written())
	require.Equal(t, []int{http.StatusProcessing, http.StatusOK}, recorder.codes)
	require.Equal(t, "ok", recorder.body.String())
}
