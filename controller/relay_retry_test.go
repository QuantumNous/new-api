package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestShouldRetrySkipsAfterResponseWritten(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	c.String(http.StatusOK, "partial stream")
	err := types.NewOpenAIError(errors.New("upstream stream failed"), types.ErrorCodeBadResponse, http.StatusBadGateway)

	require.False(t, shouldRetry(c, err, 1))
}
