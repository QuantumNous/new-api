package oauth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGenericOAuthProviderExchangeTokenSendsPKCEVerifier(t *testing.T) {
	var received url.Values
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		received = r.PostForm
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"access-token","token_type":"Bearer"}`))
	}))
	t.Cleanup(server.Close)

	previousAddress := system_setting.ServerAddress
	system_setting.ServerAddress = "https://dashboard.example.test"
	t.Cleanup(func() { system_setting.ServerAddress = previousAddress })

	provider := NewGenericOAuthProvider(&model.CustomOAuthProvider{
		Name:          "Example SSO",
		Slug:          "example-sso",
		ClientId:      "client-id",
		ClientSecret:  "client-secret",
		TokenEndpoint: server.URL,
		PKCEEnabled:   true,
	})
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	SetPKCEVerifier(c, "verifier-value")

	token, err := provider.ExchangeToken(context.Background(), "authorization-code", c)
	require.NoError(t, err)
	require.Equal(t, "access-token", token.AccessToken)
	require.Equal(t, "verifier-value", received.Get("code_verifier"))
	require.Equal(t, "authorization-code", received.Get("code"))
	require.Equal(t, "https://dashboard.example.test/oauth/example-sso", received.Get("redirect_uri"))
}

func TestGenericOAuthProviderExchangeTokenRequiresPKCEVerifier(t *testing.T) {
	called := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))
	t.Cleanup(server.Close)

	provider := NewGenericOAuthProvider(&model.CustomOAuthProvider{
		Name:          "Example SSO",
		Slug:          "example-sso",
		ClientId:      "client-id",
		ClientSecret:  "client-secret",
		TokenEndpoint: server.URL,
		PKCEEnabled:   true,
	})
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	_, err := provider.ExchangeToken(context.Background(), "authorization-code", c)
	require.Error(t, err)
	require.False(t, called)
}
