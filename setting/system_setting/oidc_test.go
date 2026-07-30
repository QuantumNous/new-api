package system_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOIDCSettingsEffectiveDisplayName(t *testing.T) {
	tests := []struct {
		name        string
		displayName string
		want        string
	}{
		{name: "empty fallback", want: "OIDC"},
		{name: "whitespace fallback", displayName: "   ", want: "OIDC"},
		{name: "custom trimmed", displayName: "  Company SSO  ", want: "Company SSO"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			settings := &OIDCSettings{DisplayName: test.displayName}
			assert.Equal(t, test.want, settings.GetEffectiveDisplayName())
		})
	}
}

func TestOIDCDisplayNamePersistenceRoundTrip(t *testing.T) {
	settings := &OIDCSettings{DisplayName: "  Company SSO  "}
	manager := config.NewConfigManager()
	manager.Register("oidc", settings)
	saved := map[string]string{}
	require.NoError(t, manager.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	assert.Equal(t, "  Company SSO  ", saved["oidc.display_name"])

	settings.DisplayName = ""
	require.NoError(t, manager.LoadFromDB(saved))
	assert.Equal(t, "  Company SSO  ", settings.DisplayName)
	assert.Equal(t, "Company SSO", settings.GetEffectiveDisplayName())
}
