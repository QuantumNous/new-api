package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func validCustomOAuthProvider() *CustomOAuthProvider {
	return &CustomOAuthProvider{
		Name:                  "Example SSO",
		Slug:                  "Example-SSO",
		ClientId:              "client-id",
		AuthorizationEndpoint: "https://sso.example.test/authorize",
		TokenEndpoint:         "https://sso.example.test/token",
		UserInfoEndpoint:      "https://sso.example.test/userinfo",
		PKCEEnabled:           true,
	}
}

func TestValidateCustomOAuthProviderAppliesDefaults(t *testing.T) {
	provider := validCustomOAuthProvider()

	require.NoError(t, validateCustomOAuthProvider(provider))
	require.Equal(t, "example-sso", provider.Slug)
	require.Equal(t, "openid profile email", provider.Scopes)
	require.Equal(t, "sub", provider.UserIdField)
	require.Equal(t, "preferred_username", provider.UsernameField)
	require.Equal(t, "name", provider.DisplayNameField)
	require.Equal(t, "email", provider.EmailField)
	require.True(t, provider.PKCEEnabled)
}

func TestValidateCustomOAuthProviderRejectsInvalidAccessPolicy(t *testing.T) {
	provider := validCustomOAuthProvider()
	provider.AccessPolicy = `{"logic":"and","conditions":[{"field":"email","op":"unsupported","value":"x"}]}`

	err := validateCustomOAuthProvider(provider)
	require.Error(t, err)
	require.ErrorContains(t, err, "access_policy is invalid")
}
