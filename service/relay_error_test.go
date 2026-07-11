package service

import (
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func TestShouldRetryRelayErrorSpecificChannelSkipsChannelError(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("specific_channel_id", "1")
	err := types.NewError(errors.New("channel failed"), types.ErrorCodeChannelNoAvailableKey)

	if ShouldRetryRelayError(c, err, 1) {
		t.Fatal("specific channel channel error should not retry")
	}
}
