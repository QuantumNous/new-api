package helper

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestHasWrittenUpstreamResponseIgnoresHeadersAndSyntheticPings distinguishes
// committed headers and keepalives from actual upstream response bytes.
func TestHasWrittenUpstreamResponseIgnoresHeadersAndSyntheticPings(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	c.Writer.Flush()
	require.True(t, c.Writer.Written())
	assert.Zero(t, c.Writer.Size())
	assert.False(t, HasWrittenUpstreamResponse(c))

	require.NoError(t, PingData(c))
	assert.False(t, HasWrittenUpstreamResponse(c))

	require.NoError(t, ObjectData(c, map[string]string{"content": "answer"}))
	assert.True(t, HasWrittenUpstreamResponse(c))
}
