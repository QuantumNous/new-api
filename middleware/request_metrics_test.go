package middleware

import (
	"bytes"
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuditResponseSuccessUsesBusinessSuccessField(t *testing.T) {
	if auditResponseSuccess(200, []byte(`{"success":false,"message":"validation failed"}`)) {
		t.Fatal("expected HTTP 200 response with success=false to count as a failure")
	}
	if !auditResponseSuccess(200, []byte(`{"success":true,"data":{}}`)) {
		t.Fatal("expected HTTP 200 response with success=true to count as a success")
	}
}

func TestRequestMetricsWrappersCountApplicationBytes(t *testing.T) {
	body := &countingReadCloser{ReadCloser: io.NopCloser(strings.NewReader("request payload"))}
	input := make([]byte, len("request payload"))
	_, err := io.ReadFull(body, input)
	require.NoError(t, err)
	assert.Equal(t, int64(len(input)), body.BytesRead())

	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	writer := &auditResponseWriter{ResponseWriter: context.Writer, body: new(bytes.Buffer), maxSize: 64 * 1024}
	_, err = writer.Write([]byte("response payload"))
	require.NoError(t, err)
	assert.Equal(t, int64(len("response payload")), writer.BytesWritten())
}
