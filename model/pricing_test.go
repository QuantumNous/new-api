package model

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
)

func TestFixedPriceQuotaTypeSeedanceUsesTaskPricePatch(t *testing.T) {
	original := constant.TaskPricePatches
	t.Cleanup(func() {
		constant.TaskPricePatches = original
	})

	constant.TaskPricePatches = []string{"seedance-720p-c37"}

	assert.Equal(t, 1, fixedPriceQuotaType("seedance-720p-c37", "video,seedance,??"))
	assert.Equal(t, 2, fixedPriceQuotaType("seedance-480p-fast-c13", "video,seedance,??"))
}

func TestFixedPriceQuotaTypeTagsStillSupportPerSecond(t *testing.T) {
	assert.Equal(t, 2, fixedPriceQuotaType("custom-video-model", "video,按秒"))
	assert.Equal(t, 1, fixedPriceQuotaType("custom-video-model", "video"))
}
