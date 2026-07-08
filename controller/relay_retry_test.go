package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestShouldRetryTaskRelaySkipsForbidden(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)

	retry := shouldRetryTaskRelay(ctx, 19, &dto.TaskError{StatusCode: http.StatusForbidden}, 5)

	require.False(t, retry)
}
