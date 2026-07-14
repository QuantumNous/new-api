package helper

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestResponseChunkDataDoesNotWriteAfterRequestCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil).WithContext(ctx)

	err := ResponseChunkData(c, dto.ResponsesStreamResponse{Type: "response.output_text.delta"}, `{"delta":"stale"}`)

	require.ErrorIs(t, err, context.Canceled)
	require.Empty(t, recorder.Body.String())
}
