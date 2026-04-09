package governor

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestClassifyRelayError_UsesRetryAfterForKeyCooldown(t *testing.T) {
	cfg := Config{
		Enabled:                     true,
		KeyCooldownSeconds:          30,
		KeyCooldownOnStatuses:       []int{429},
		RespectRetryAfter:           true,
		ReservationLeaseSeconds:     90,
		ReservationHeartbeatSeconds: 20,
	}

	err := types.NewOpenAIError(
		errors.New("rate limited"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
		types.ErrOptionWithRetryAfter("17"),
	)

	decision := ClassifyRelayError(cfg, err)
	require.True(t, decision.CoolKey)
	require.False(t, decision.CoolChannel)
	require.Equal(t, 17*time.Second, decision.TTL)
}
