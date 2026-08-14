package controller

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func completeSystemStatus() common.SystemStatus {
	return common.SystemStatus{
		SampledAt:               1_786_700_000,
		CPUUsage:                34.2,
		CPUAvailable:            true,
		MemoryUsed:              5_583_457_484,
		MemoryTotal:             17_179_869_184,
		MemoryAvailable:         true,
		DiskUsed:                234_075_717_632,
		DiskTotal:               549_755_813_888,
		DiskAvailable:           true,
		NetworkTxBytesPerSecond: 2_202_000,
		NetworkRxBytesPerSecond: 13_002_300,
		NetworkAvailable:        true,
		NetworkSeries: []common.NetworkThroughputSample{{
			Timestamp: 1_786_699_970, TxBytesPerSecond: 1_800_000, RxBytesPerSecond: 11_000_000,
		}},
	}
}

func TestBuildNextDashboardSystemReturnsOnlineSafeContract(t *testing.T) {
	previousVersion := common.Version
	common.Version = "v1.0.0-test"
	t.Cleanup(func() { common.Version = previousVersion })
	rate := 99.7

	response := buildNextDashboardSystem(completeSystemStatus(), &rate, nil)
	assert.Equal(t, nextDashboardSystemOnline, response.Status)
	assert.Equal(t, currentNodeScope, response.Scope)
	assert.Equal(t, int64(1_786_700_000), response.SampledAt)
	require.NotNil(t, response.CPUPercent)
	assert.InDelta(t, 34.2, *response.CPUPercent, 0.001)
	require.NotNil(t, response.NetworkTxBytesPerSecond)
	assert.Equal(t, "v1.0.0-test", response.Version)
	require.Len(t, response.NetworkSeries, 1)

	encoded, err := common.Marshal(response)
	require.NoError(t, err)
	var fields map[string]interface{}
	require.NoError(t, common.Unmarshal(encoded, &fields))
	for _, forbidden := range []string{"hostname", "ip", "path", "threshold", "container", "go_heap", "config"} {
		assert.NotContains(t, fields, forbidden)
	}
}

func TestBuildNextDashboardSystemKeepsPartialMetricsAndMarksDegraded(t *testing.T) {
	status := completeSystemStatus()
	status.CPUAvailable = false
	status.NetworkAvailable = false

	response := buildNextDashboardSystem(status, nil, errors.New("log database unavailable"))
	assert.Equal(t, nextDashboardSystemDegraded, response.Status)
	assert.Nil(t, response.CPUPercent)
	assert.Nil(t, response.NetworkTxBytesPerSecond)
	require.NotNil(t, response.MemoryUsedBytes)
	require.NotNil(t, response.DiskUsedBytes)
	assert.Nil(t, response.APISuccessRate24h)
}

func TestBuildNextDashboardSystemEmptyRequestWindowDoesNotDegradeNode(t *testing.T) {
	response := buildNextDashboardSystem(completeSystemStatus(), nil, nil)
	assert.Equal(t, nextDashboardSystemOnline, response.Status)
	assert.Nil(t, response.APISuccessRate24h)
}
