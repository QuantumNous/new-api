package doubao

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestConvertToRequestPayloadDurationPrefersDurationField(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:    "doubao-seedance-2.0",
		Prompt:   "a cute girl dancing",
		Duration: 7,
		Seconds:  "10",
	}

	payload, err := adaptor.convertToRequestPayload(&req)

	require.NoError(t, err)
	require.NotNil(t, payload.Duration)
	require.Equal(t, 7, int(*payload.Duration))
}

func TestConvertToRequestPayloadDurationFallsBackToSeconds(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:   "doubao-seedance-2.0",
		Prompt:  "a cute girl dancing",
		Seconds: "7",
	}

	payload, err := adaptor.convertToRequestPayload(&req)

	require.NoError(t, err)
	require.NotNil(t, payload.Duration)
	require.Equal(t, 7, int(*payload.Duration))
}

func TestConvertToRequestPayloadDurationEmptyLeavesUnset(t *testing.T) {
	adaptor := &TaskAdaptor{}
	req := relaycommon.TaskSubmitReq{
		Model:  "doubao-seedance-2.0",
		Prompt: "a cute girl dancing",
	}

	payload, err := adaptor.convertToRequestPayload(&req)

	require.NoError(t, err)
	require.Nil(t, payload.Duration)
}
