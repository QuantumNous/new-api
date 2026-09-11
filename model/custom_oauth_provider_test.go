package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateCustomOAuthProviderIdentitySources(t *testing.T) {
	base := func() *CustomOAuthProvider {
		return &CustomOAuthProvider{
			Name: "Test Provider", Slug: "test-provider", ClientId: "client-id",
			AuthorizationEndpoint: "https://provider.example/authorize", TokenEndpoint: "https://provider.example/token",
			UserInfoEndpoint: "https://provider.example/userinfo",
		}
	}

	t.Run("legacy defaults to userinfo", func(t *testing.T) {
		provider := base()
		require.NoError(t, validateCustomOAuthProvider(provider))
		assert.Equal(t, CustomOAuthIdentitySourceUserInfo, provider.IdentitySource)
	})
	t.Run("id token requires valid issuer and jwks uri", func(t *testing.T) {
		provider := base()
		provider.IdentitySource = CustomOAuthIdentitySourceIDToken
		provider.UserInfoEndpoint = ""
		provider.Issuer = "https://issuer.example"
		provider.JWKSURI = "https://issuer.example/jwks"
		require.NoError(t, validateCustomOAuthProvider(provider))
	})
	t.Run("id token rejects insecure jwks uri", func(t *testing.T) {
		provider := base()
		provider.IdentitySource = CustomOAuthIdentitySourceIDToken
		provider.Issuer = "https://issuer.example"
		provider.JWKSURI = "http://issuer.example/jwks"
		require.Error(t, validateCustomOAuthProvider(provider))
	})
	t.Run("rejects unknown identity source", func(t *testing.T) {
		provider := base()
		provider.IdentitySource = "claims"
		require.Error(t, validateCustomOAuthProvider(provider))
	})
}
