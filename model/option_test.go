package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestUpdateInvitationRebateOptionsPersistNormalizedValues(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Option{}))

	keys := []string{"InvitationRebateRatioBps", "InvitationRebateMinQuota"}
	require.NoError(t, DB.Where("key IN ?", keys).Delete(&Option{}).Error)

	oldRatioBps := common.InvitationRebateRatioBps
	oldMinQuota := common.InvitationRebateMinQuota
	common.OptionMapRWMutex.Lock()
	oldOptionMap := common.OptionMap
	common.OptionMap = map[string]string{}
	common.OptionMapRWMutex.Unlock()

	t.Cleanup(func() {
		_ = DB.Where("key IN ?", keys).Delete(&Option{}).Error
		common.InvitationRebateRatioBps = oldRatioBps
		common.InvitationRebateMinQuota = oldMinQuota
		common.OptionMapRWMutex.Lock()
		common.OptionMap = oldOptionMap
		common.OptionMapRWMutex.Unlock()
	})

	tests := []struct {
		name     string
		key      string
		value    string
		expected string
	}{
		{
			name:     "ratio above max",
			key:      "InvitationRebateRatioBps",
			value:    "12000",
			expected: "10000",
		},
		{
			name:     "ratio below min",
			key:      "InvitationRebateRatioBps",
			value:    "-5",
			expected: "0",
		},
		{
			name:     "min quota below min",
			key:      "InvitationRebateMinQuota",
			value:    "-10",
			expected: "0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.NoError(t, UpdateOption(tt.key, tt.value))

			var option Option
			require.NoError(t, DB.Where("key = ?", tt.key).First(&option).Error)
			require.Equal(t, tt.expected, option.Value)

			common.OptionMapRWMutex.RLock()
			optionMapValue := common.OptionMap[tt.key]
			common.OptionMapRWMutex.RUnlock()
			require.Equal(t, tt.expected, optionMapValue)
		})
	}
}
