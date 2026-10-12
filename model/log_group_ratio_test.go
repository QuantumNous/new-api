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
