package relay

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
)

func TestRecalcQuotaFromRatiosPerCallKeepsBaseQuota(t *testing.T) {
	info := &relaycommon.RelayInfo{
		PriceData: types.PriceData{
			Quota: 390,
			OtherRatios: map[string]float64{
				"seconds": 4,
			},
		},
	}

	quota := recalcQuotaFromRatios(info, map[string]float64{
		"seconds": 10,
		"size":    1,
	}, true)

	assert.Equal(t, 390, quota)
}

func TestRecalcQuotaFromRatiosNonPerCallAppliesAdjustedRatios(t *testing.T) {
	info := &relaycommon.RelayInfo{
		PriceData: types.PriceData{
			Quota: 156,
			OtherRatios: map[string]float64{
				"seconds": 4,
			},
		},
	}

	quota := recalcQuotaFromRatios(info, map[string]float64{
		"seconds": 10,
		"size":    1,
	}, false)

	assert.Equal(t, 390, quota)
}
