package channel

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/transport/middleware/status_code"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// TestClassifyChannelOutcome_ClientCancelIsNeutral is the channel-ledger half
// of the client-cancel fix: the cancel rides a status-500 wrapper, and the
// ledger's status switch recorded it as OutcomeFatal — derating the channel
// EWMA, feeding the cooldown threshold, and (through ExcludesChannel) even
// excluding the route for the rest of a task submission.
func TestClassifyChannelOutcome_ClientCancelIsNeutral(t *testing.T) {
	const channelID = 9931

	canceled := types.NewError(context.Canceled, types.ErrorCodeDoRequestFailed,
		types.ErrOptionWithStatusCode(http.StatusInternalServerError))
	require.Equal(t, http.StatusInternalServerError, canceled.StatusCode,
		"sanity: the cancel carries the same 500 the status switch matches")
	require.ErrorIs(t, canceled, context.Canceled)

	assert.Equal(t, OutcomeNeutral, ClassifyChannelOutcome(canceled, channelID))
	assert.Equal(t, OutcomeNeutral, fallbackClassifyChannelOutcomeUnlocked(
		&ChannelHealthState{EwmaScore: DefaultScore}, canceled),
		"the model-only fallback mirror applies the same rule")
	assert.Equal(t, OutcomeFatal,
		ClassifyChannelOutcome(upstreamError(types.ErrorCodeBadResponseStatusCode, 500), channelID),
		"a real upstream 500 stays fatal")
}

// TestClassifyChannelOutcome_CancelDoesNotResetUnauthorizedRun pins that the
// cancel guard is inert with respect to the 401 escalation run: a canceling
// client must not be able to mask a dead credential by resetting the run.
func TestClassifyChannelOutcome_CancelDoesNotResetUnauthorizedRun(t *testing.T) {
	const channelID = 9932

	first401 := upstreamError(types.ErrorCodeBadResponseStatusCode, http.StatusUnauthorized)
	require.Equal(t, OutcomeNeutral, ClassifyChannelOutcome(first401, channelID),
		"the first 401 starts the run")

	require.Equal(t, OutcomeNeutral, ClassifyChannelOutcome(
		types.NewError(context.Canceled, types.ErrorCodeDoRequestFailed), channelID))

	assert.Equal(t, OutcomeNeutral, ClassifyChannelOutcome(first401, channelID),
		"the run continues where the cancel left it")
	assert.Equal(t, OutcomeFatal, ClassifyChannelOutcome(first401, channelID),
		"the sustained run still escalates at the threshold")
}

// TestShouldDisableChannel_ClientCancelNeverDisables pins the autoban guard:
// with auto-disable on and an admin 5xx range, a client cancel must not
// disable the channel — while a genuine 500 still does.
func TestShouldDisableChannel_ClientCancelNeverDisables(t *testing.T) {
	previousEnabled := common.AutomaticDisableChannelEnabled
	previousRanges := status_code.AutomaticDisableStatusCodeRanges
	require.NoError(t, status_code.AutomaticDisableStatusCodesFromString("401-401,500-599"))
	common.AutomaticDisableChannelEnabled = true
	t.Cleanup(func() {
		common.AutomaticDisableChannelEnabled = previousEnabled
		status_code.AutomaticDisableStatusCodeRanges = previousRanges
	})

	canceled := types.NewError(context.Canceled, types.ErrorCodeDoRequestFailed,
		types.ErrOptionWithStatusCode(http.StatusInternalServerError))
	assert.False(t, ShouldDisableChannel(canceled),
		"a client cancel must never trigger the autoban")

	real500 := types.NewOpenAIError(errors.New("upstream exploded"),
		types.ErrorCodeBadResponseStatusCode, http.StatusInternalServerError)
	assert.True(t, ShouldDisableChannel(real500),
		"the guard must not weaken the configured 5xx range")
}
