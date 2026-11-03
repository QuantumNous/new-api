package channel

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/internal/egress"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestDoRequestPreservesClientCancelSentinel is the origin half of the
// client-cancel accounting fix: the health and route-stats classifiers decide
// by errors.Is(err, context.Canceled), but the generic transport-error path
// masks the message with ErrOptionWithHideErrMsg, which replaces the whole
// error chain. A canceled request must keep its sentinel or every classifier
// downstream sees a plain 500 and blames the channel.
func TestDoRequestPreservesClientCancelSentinel(t *testing.T) {
	egress.InitHttpClient()
	ctxW, _ := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, "/relay", nil))

	// Cancelling before the call makes the client fail immediately, without
	// dialing the (unreachable) address.
	reqCtx, cancel := context.WithCancel(context.Background())
	cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, "http://127.0.0.1:1/", nil)
	require.NoError(t, err)

	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}
	_, err = doRequest(ctxW, req, info)
	require.Error(t, err)
	assert.ErrorIs(t, err, context.Canceled,
		"the cancellation sentinel must survive for the health/route classifiers")
}
