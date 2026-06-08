package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestUpdateOptionMapLogRetentionDays(t *testing.T) {
	originalRetentionDays := common.LogRetentionDays
	originalOptionMap := common.OptionMap
	t.Cleanup(func() {
		common.LogRetentionDays = originalRetentionDays
		common.OptionMap = originalOptionMap
	})

	common.OptionMap = map[string]string{"LogRetentionDays": "30"}
	common.LogRetentionDays = 30

	require.NoError(t, updateOptionMap("LogRetentionDays", " 60 "))
	require.Equal(t, 60, common.LogRetentionDays)
	require.Equal(t, "60", common.OptionMap["LogRetentionDays"])

	require.Error(t, updateOptionMap("LogRetentionDays", "-1"))
	require.Equal(t, 60, common.LogRetentionDays)
	require.Equal(t, "60", common.OptionMap["LogRetentionDays"])
}
