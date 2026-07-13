package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInitDefaultVendorMapping_MiniMaxM3(t *testing.T) {
	const minimaxVendorID = 99

	metaMap := make(map[string]*Model)
	vendorMap := map[int]*Vendor{
		minimaxVendorID: {Id: minimaxVendorID, Name: "MiniMax"},
	}

	abilities := []AbilityWithChannel{
		{Ability: Ability{Model: "MiniMax-M3"}, ChannelType: 1},
	}

	initDefaultVendorMapping(metaMap, vendorMap, abilities)

	m := metaMap["MiniMax-M3"]
	require.NotNil(t, m, "MiniMax-M3 should be in metaMap")
	assert.Equal(t, minimaxVendorID, m.VendorID, "MiniMax-M3 should resolve to the preloaded MiniMax vendor")
	assert.Equal(t, NameRuleExact, m.NameRule, "NameRule should be Exact")
}
