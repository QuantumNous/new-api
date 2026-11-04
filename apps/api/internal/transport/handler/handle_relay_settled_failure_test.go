package handler

import (
	"net/http"
	"testing"

	catalog "github.com/QuantumNous/new-api/internal/catalog"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSettledUpstreamFailureErrorClassifiesAsFatal is the health-accounting
// contract for a partial answer whose charge billing already settled. The
// synthesized error never reaches the client; it only has to land on the fatal
// rung of both ledgers, so the truncating channel loses score instead of
// keeping the success that newAPIError == nil implies.
func TestSettledUpstreamFailureErrorClassifiesAsFatal(t *testing.T) {
	err := settledUpstreamFailureError()
	require.NotNil(t, err)
	require.Equal(t, http.StatusBadGateway, err.StatusCode)

	assert.Equal(t, catalog.UnitFatal, catalog.ClassifyUnitOutcome(err, 1))
	assert.Equal(t, routeStatsFatal, classifyRouteStatsOutcome(err))
}
