package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
)

func TestMergeManagedUserSettingsClearsExplicitEmptyGroupRatioOverrides(t *testing.T) {
	origin := dto.UserSetting{
		AllowedModelGroups:  []string{"vip"},
		GroupRatioOverrides: map[string]float64{"vip": 2},
	}
	updated := dto.UserSetting{GroupRatioOverrides: map[string]float64{}}

	result := mergeManagedUserSettings(origin, nil, false, updated, true)

	assert.Equal(t, []string{"vip"}, result.AllowedModelGroups)
	assert.Nil(t, result.GroupRatioOverrides)
}

func TestMergeManagedUserSettingsPreservesGroupRatioOverridesWhenSettingOmitted(t *testing.T) {
	origin := dto.UserSetting{
		AllowedModelGroups:  []string{"vip"},
		GroupRatioOverrides: map[string]float64{"vip": 2},
	}

	result := mergeManagedUserSettings(origin, []string{"hidden"}, true, dto.UserSetting{}, false)

	assert.Equal(t, []string{"hidden"}, result.AllowedModelGroups)
	assert.Equal(t, map[string]float64{"vip": 2}, result.GroupRatioOverrides)
}
