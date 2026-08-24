package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestShouldRetryStopsAfterResponseWritten(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	_, _ = c.Writer.WriteString("data: partial\n\n")
	err := types.NewError(errors.New("channel failure"), types.ErrorCodeChannelNoAvailableKey)

	assert.False(t, shouldRetry(c, err, 1))
}

func TestWriteRelayErrorDoesNotAppendJSONAfterResponseWritten(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	_, _ = c.Writer.WriteString("data: partial\n\n")
	before := rec.Body.String()

	writeRelayError(c, types.RelayFormatOpenAI, nil,
		types.NewOpenAIError(errors.New("failed"), types.ErrorCodeBadResponse, http.StatusInternalServerError))

	assert.Equal(t, before, rec.Body.String())
}

func TestWriteRelayErrorWritesOpenAIJSONBeforeResponseCommit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)

	writeRelayError(c, types.RelayFormatOpenAI, nil,
		types.NewOpenAIError(errors.New("failed"), types.ErrorCodeBadResponse, http.StatusInternalServerError))

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.Contains(t, rec.Body.String(), `"error"`)
	assert.Contains(t, rec.Body.String(), `"message":"failed"`)
}
