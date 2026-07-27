package common

import (
	"testing"

	basecommon "github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRealtimeTranscriptionState(t *testing.T) {
	info := &RelayInfo{}
	info.InitRealtimeTranscriptionState()
	info.SetRealtimeTranscriptionModel("gpt-4o-transcribe")
	info.SetRealtimeTranscriptionModel("")
	info.AddRealtimeTranscriptionQuota(10)
	info.AddRealtimeTranscriptionQuota(20)

	hasUsage, quota, clamp := info.GetRealtimeTranscriptionBilling()

	require.True(t, hasUsage)
	assert.Equal(t, "gpt-4o-transcribe", info.GetRealtimeTranscriptionModel())
	assert.Equal(t, 30, quota)
	assert.Nil(t, clamp)
}

func TestRealtimeTranscriptionQuotaSaturatesForFinalStatistics(t *testing.T) {
	info := &RelayInfo{}
	info.InitRealtimeTranscriptionState()
	info.AddRealtimeTranscriptionQuota(basecommon.MaxQuota)
	info.AddRealtimeTranscriptionQuota(1)

	hasUsage, quota, clamp := info.GetRealtimeTranscriptionBilling()

	require.True(t, hasUsage)
	assert.Equal(t, basecommon.MaxQuota, quota)
	require.NotNil(t, clamp)
	assert.Equal(t, basecommon.QuotaClampOverflow, clamp.Kind)
}
