package openai

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeOpenAIResponseModelUsesRequestedIdentity(t *testing.T) {
	info := &relaycommon.RelayInfo{OriginModelName: "requested", ExecutionModelName: "cheap", RelayFormat: types.RelayFormatOpenAI}
	got, err := normalizeOpenAIResponseModel([]byte(`{"id":"x","model":"cheap","choices":[]}`), info)
	require.NoError(t, err)
	assert.JSONEq(t, `{"id":"x","model":"requested","choices":[]}`, string(got))
}

func TestNormalizeOpenAIResponseModelLeavesOrdinaryResponseUntouched(t *testing.T) {
	body := []byte(`{"model":"requested"}`)
	got, err := normalizeOpenAIResponseModel(body, &relaycommon.RelayInfo{OriginModelName: "requested"})
	require.NoError(t, err)
	assert.Equal(t, body, got)
}

func TestNormalizeResponsesAPIModelUsesRequestedIdentity(t *testing.T) {
	info := &relaycommon.RelayInfo{OriginModelName: "requested", ExecutionModelName: "cheap", RelayFormat: types.RelayFormatOpenAIResponses}
	got, err := normalizeOpenAIResponseModel([]byte(`{"model":"cheap","output":[]}`), info)
	require.NoError(t, err)
	assert.JSONEq(t, `{"model":"requested","output":[]}`, string(got))
}
