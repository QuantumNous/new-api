package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDefaultSeedanceRatiosUseBaseListPrice(t *testing.T) {
	assert.InDelta(t, 0.046*RMB, defaultModelRatio["doubao-seedance-2-0-260128"], 1e-12)
	assert.InDelta(t, 0.037*RMB, defaultModelRatio["doubao-seedance-2-0-fast-260128"], 1e-12)
	assert.InDelta(t, 0.070*RMB, defaultModelRatio["doubao-seedance-2-5-260628"], 1e-12)
}
