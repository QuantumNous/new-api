package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/QuantumNous/new-api/relaykit/types"
)

// TestClassifyRouteStatsOutcome_ClientCancelIsNeutral is the route-EWMA half of
// the client-cancel fix: the disconnect arrives as a status-500 OpenAI error
// wrapping context.Canceled, and derating the soft route signal for a request
// the caller abandoned blames a healthy route.
func TestClassifyRouteStatsOutcome_ClientCancelIsNeutral(t *testing.T) {
	// The same chain as production: doRequest wraps the transport error in a
	// NewAPIError (keeping the sentinel), DoApiRequest wraps it again, and the
	// relay handler re-wraps it as an OpenAI error carrying status 500.
	canceled := types.NewOpenAIError(
		fmt.Errorf("do request failed: %w", types.NewError(context.Canceled,
			types.ErrorCodeDoRequestFailed, types.ErrOptionWithStatusCode(http.StatusInternalServerError))),
		types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	require.ErrorIs(t, canceled, context.Canceled)
	require.Equal(t, http.StatusInternalServerError, canceled.StatusCode,
		"sanity: the cancel carries the same 500 the upstream-failure branch matches")

	cases := []struct {
		name string
		err  *types.NewAPIError
		want routeStatsOutcome
	}{
		{"wrapped client cancel is neutral", canceled, routeStatsNeutral},
		{"real upstream 500 stays fatal",
			types.NewOpenAIError(errors.New("upstream exploded"), types.ErrorCodeBadResponseStatusCode,
				http.StatusInternalServerError),
			routeStatsFatal},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, classifyRouteStatsOutcome(tc.err))
		})
	}
}
