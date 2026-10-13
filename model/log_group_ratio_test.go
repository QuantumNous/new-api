package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// groupRatioFromOther reads the group_ratio billing already wrote into the
// consume log's "other" column. GenerateXOtherInfo helpers always write it as
// a float64, but JSON round-trips (e.g. a value decoded from the stored log)
// come back as float64 too — the int/float32 cases exist for defensiveness,
// not because any current writer produces them.
func TestGroupRatioFromOther(t *testing.T) {
	require.Equal(t, 0.0, groupRatioFromOther(nil))
	require.Equal(t, 0.0, groupRatioFromOther(map[string]interface{}{}))
	require.Equal(t, 0.0, groupRatioFromOther(map[string]interface{}{"group_ratio": "not-a-number"}))

	require.Equal(t, 0.5, groupRatioFromOther(map[string]interface{}{"group_ratio": 0.5}))
	require.Equal(t, 1.0, groupRatioFromOther(map[string]interface{}{"group_ratio": float32(1.0)}))
	require.Equal(t, 2.0, groupRatioFromOther(map[string]interface{}{"group_ratio": 2}))
}

// chargeUSDMicrosFromOther reads the billing path's own real USD settlement
// back out of the nested cost_reconciliation object, where
// BuildCostReconciliationSnapshot already wrote it as an int64. JSON
// round-trips decode it as float64, hence that case being exercised too.
func TestChargeUSDMicrosFromOther(t *testing.T) {
	require.Equal(t, int64(0), chargeUSDMicrosFromOther(nil))
	require.Equal(t, int64(0), chargeUSDMicrosFromOther(map[string]interface{}{}))
	require.Equal(t, int64(0), chargeUSDMicrosFromOther(map[string]interface{}{
		"cost_reconciliation": "not-a-map",
	}))
	require.Equal(t, int64(0), chargeUSDMicrosFromOther(map[string]interface{}{
		"cost_reconciliation": map[string]interface{}{"user_charge_usd_micros": "not-a-number"},
	}))

	require.Equal(t, int64(1875), chargeUSDMicrosFromOther(map[string]interface{}{
		"cost_reconciliation": map[string]interface{}{"user_charge_usd_micros": int64(1875)},
	}))
	// JSON-decoded numbers come back as float64, not int64 — this is the shape
	// a value re-read from the stored log would actually have.
	require.Equal(t, int64(1875), chargeUSDMicrosFromOther(map[string]interface{}{
		"cost_reconciliation": map[string]interface{}{"user_charge_usd_micros": float64(1875)},
	}))
}

