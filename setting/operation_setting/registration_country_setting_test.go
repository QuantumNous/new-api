package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRegistrationCountrySettingNormalizesAndDeduplicates(t *testing.T) {
	s := RegistrationCountrySetting{
		Enabled:              true,
		BlockedCountries:     []string{" ma ", "MA", "us"},
		AutoDisableCountries: []string{"br", " BR "},
	}
	require.NoError(t, s.NormalizeAndValidate())
	require.Equal(t, []string{"MA", "US"}, s.BlockedCountries)
	require.Equal(t, []string{"BR"}, s.AutoDisableCountries)
}

func TestRegistrationCountrySettingRejectsInvalidCode(t *testing.T) {
	s := RegistrationCountrySetting{BlockedCountries: []string{"MOR"}}
	require.Error(t, s.NormalizeAndValidate())
}

func TestRegistrationCountrySettingRejectsOverlappingRules(t *testing.T) {
	s := RegistrationCountrySetting{
		BlockedCountries:     []string{"MA"},
		AutoDisableCountries: []string{"ma"},
	}
	require.Error(t, s.NormalizeAndValidate())
}

func TestMoroccoIsBlockedByDefault(t *testing.T) {
	require.True(t, IsCountryBlocked("ma"))
	require.False(t, IsCountryAutoDisabled("MA"))
}
