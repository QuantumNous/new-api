package oauth

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
)

func TestOIDCProviderNameUsesConfiguredDisplayName(t *testing.T) {
	settings := system_setting.GetOIDCSettings()
	original := settings.DisplayName
	t.Cleanup(func() { settings.DisplayName = original })
	provider := &OIDCProvider{}

	settings.DisplayName = ""
	assert.Equal(t, "OIDC", provider.GetName())
	settings.DisplayName = "  Company SSO  "
	assert.Equal(t, "Company SSO", provider.GetName())
}
