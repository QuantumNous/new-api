package controller

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const (
	relayRetryBackoffBase = 100 * time.Millisecond
	relayRetryBackoffMax  = 2 * time.Second
	relayRetryAfterMax    = 30 * time.Second
)

func relayRetryDelay(attempt int, retryAfter time.Duration) time.Duration {
	if attempt < 0 {
		attempt = 0
	}
	capDelay := relayRetryBackoffBase
	for i := 0; i < attempt && capDelay < relayRetryBackoffMax; i++ {
		capDelay *= 2
		if capDelay > relayRetryBackoffMax {
			capDelay = relayRetryBackoffMax
		}
	}

	// Equal jitter avoids synchronized retries while retaining a non-zero floor.
	half := capDelay / 2
	delay := half + time.Duration(rand.Int63n(int64(capDelay-half)+1))
	if retryAfter > relayRetryAfterMax {
		retryAfter = relayRetryAfterMax
	}
	if retryAfter > delay {
		delay = retryAfter
	}
	return delay
}

func waitBeforeRelayRetry(c *gin.Context, apiErr *types.NewAPIError, attempt int) bool {
	retryAfter := time.Duration(0)
	if apiErr != nil {
		retryAfter = apiErr.RetryAfter
	}
	delay := relayRetryDelay(attempt, retryAfter)
	logger.LogInfo(c, fmt.Sprintf("retrying relay after %s (attempt=%d)", delay, attempt+1))
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-timer.C:
		return true
	case <-c.Request.Context().Done():
		return false
	}
}
