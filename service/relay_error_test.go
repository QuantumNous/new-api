package service

import (
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestShouldRetryRelayErrorPrecedence(t *testing.T) {
	tests := []struct {
		name          string
		err           *types.NewAPIError
		retryTimes    int
		affinitySkip  bool
		specific      bool
		expectedRetry bool
	}{
		{
			name:          "affinity failure skips channel error",
			err:           types.NewError(errors.New("channel failed"), types.ErrorCodeChannelNoAvailableKey),
			retryTimes:    1,
			affinitySkip:  true,
			expectedRetry: false,
		},
		{
			name:          "specific channel skips channel error",
			err:           types.NewError(errors.New("channel failed"), types.ErrorCodeChannelNoAvailableKey),
			retryTimes:    1,
			specific:      true,
			expectedRetry: false,
		},
		{
			name:          "channel error precedes skip retry option",
			err:           types.NewError(errors.New("channel failed"), types.ErrorCodeChannelNoAvailableKey, types.ErrOptionWithSkipRetry()),
			retryTimes:    1,
			expectedRetry: true,
		},
		{
			name:          "skip retry option rejects ordinary error",
			err:           types.NewErrorWithStatusCode(errors.New("upstream failed"), types.ErrorCodeInvalidRequest, 500, types.ErrOptionWithSkipRetry()),
			retryTimes:    1,
			expectedRetry: false,
		},
		{
			name:          "exhausted retries reject retryable status",
			err:           types.NewErrorWithStatusCode(errors.New("upstream failed"), types.ErrorCodeInvalidRequest, 500),
			retryTimes:    0,
			expectedRetry: false,
		},
		{
			name:          "successful status is not retried",
			err:           types.NewErrorWithStatusCode(errors.New("unexpected response"), types.ErrorCodeInvalidRequest, 204),
			retryTimes:    1,
			expectedRetry: false,
		},
		{
			name:          "out of range status is retried",
			err:           types.NewErrorWithStatusCode(errors.New("invalid status"), types.ErrorCodeInvalidRequest, 700),
			retryTimes:    1,
			expectedRetry: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			if test.affinitySkip {
				c.Set(ginKeyChannelAffinitySkipRetry, true)
			}
			if test.specific {
				c.Set("specific_channel_id", "1")
			}
			assert.Equal(t, test.expectedRetry, ShouldRetryRelayError(c, test.err, test.retryTimes))
		})
	}
}
