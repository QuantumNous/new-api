package helper

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestClaudeChunkDataDoesNotEmitExtraBlankLine(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	ClaudeChunkData(c, dto.ClaudeResponse{Type: "message_start"}, `{"type":"message_start"}`)
	ClaudeChunkData(c, dto.ClaudeResponse{Type: "content_block_start"}, `{"type":"content_block_start"}`)

	require.Equal(t, strings.Join([]string{
		`event: message_start`,
		`data: {"type":"message_start"}`,
		``,
		`event: content_block_start`,
		`data: {"type":"content_block_start"}`,
		``,
		``,
	}, "\n"), recorder.Body.String())
	require.NotContains(t, recorder.Body.String(), "\n\n\n")
}
