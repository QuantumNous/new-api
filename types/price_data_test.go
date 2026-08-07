package types

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPriceDataCloneOwnsOtherRatios(t *testing.T) {
	original := PriceData{
		ModelPrice:        0.16,
		QuotaToPreConsume: 100000,
		GroupRatioInfo: GroupRatioInfo{
			GroupRatio:        1.25,
			GroupSpecialRatio: 1.1,
			HasSpecialRatio:   true,
		},
	}
	original.AddOtherRatio("n", 2)
	original.AddOtherRatio("size", 1.5)

	snapshot := original.Clone()
	original.AddOtherRatio("n", 4)
	original.AddOtherRatio("quality", 3)
	original.ModelPrice = 0.5
	original.GroupRatioInfo.GroupRatio = 2

	require.Equal(t, 0.16, snapshot.ModelPrice)
	require.Equal(t, 100000, snapshot.QuotaToPreConsume)
	require.Equal(t, 1.25, snapshot.GroupRatioInfo.GroupRatio)
	require.Equal(t, 2.0, snapshot.OtherRatios()["n"])
	require.Equal(t, 1.5, snapshot.OtherRatios()["size"])
	require.NotContains(t, snapshot.OtherRatios(), "quality")
}
