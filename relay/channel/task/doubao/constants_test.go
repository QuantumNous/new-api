package doubao

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetVideoBillingRatio(t *testing.T) {
	ratio, ok := GetVideoBillingRatio("doubao-seedance-2-0-260128", "1080p", false)
	assert.True(t, ok)
	assert.InDelta(t, 1, ratio, 1e-9)

	_, ok = GetVideoBillingRatio("custom-seedance", "1080p", false)
	assert.False(t, ok)
}

func TestModelListIncludesSeedance25(t *testing.T) {
	assert.Contains(t, ModelList, "doubao-seedance-2-5-260628")
}
