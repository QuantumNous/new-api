package setting

import (
	"math"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsValidWaffoPancakeUnitPrice(t *testing.T) {
	testCases := []struct {
		name      string
		unitPrice float64
		valid     bool
	}{
		{name: "accepts minimum", unitPrice: WaffoPancakeMinUnitPrice, valid: true},
		{name: "accepts ordinary rate", unitPrice: 1, valid: true},
		{name: "rejects below minimum", unitPrice: WaffoPancakeMinUnitPrice / 2},
		{name: "rejects zero"},
		{name: "rejects negative", unitPrice: -1},
		{name: "rejects NaN", unitPrice: math.NaN()},
		{name: "rejects positive infinity", unitPrice: math.Inf(1)},
		{name: "rejects negative infinity", unitPrice: math.Inf(-1)},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.valid, IsValidWaffoPancakeUnitPrice(tc.unitPrice))
		})
	}
}
