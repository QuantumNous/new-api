package oauth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOIDCProvider_GetName(t *testing.T) {
	settings := system_setting.GetOIDCSettings()
	originalDisplayName := settings.DisplayName
	defer func() { settings.DisplayName = originalDisplayName }()

	p := &OIDCProvider{}

	settings.DisplayName = ""
	assert.Equal(t, "OIDC", p.GetName())

	settings.DisplayName = "  Acme SSO  "
	assert.Equal(t, "Acme SSO", p.GetName())
}

func TestOIDCExchangeTokenPreservesUpstreamErrors(t *testing.T) {
	settings := system_setting.GetOIDCSettings()
	original := *settings
	t.Cleanup(func() { *settings = original })

	for _, test := range []struct {
		name string
		body string
		want string
	}{
		{"OAuth error", `{"error":"invalid_grant","error_description":"redirect_uri mismatch"}`, "redirect_uri mismatch"},
		{"missing token", `{"unexpected":"missing access_token"}`, `{"unexpected":"missing access_token"}`},
	} {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if !assert.NoError(t, r.ParseForm()) {
					return
				}
				assert.Equal(t, "https://public.example.com/oauth/oidc", r.Form.Get("redirect_uri"))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				_, err := w.Write([]byte(test.body))
				assert.NoError(t, err)
			}))
			defer server.Close()
			settings.TokenEndpoint = server.URL
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest("GET", "http://internal/callback", nil)
			c.Request.Header.Set("X-Forwarded-Proto", "https")
			c.Request.Header.Set("X-Forwarded-Host", "public.example.com")

			token, err := (&OIDCProvider{}).ExchangeToken(t.Context(), "test-code", c)
			require.Error(t, err)
			assert.Nil(t, token)
			var oauthError *OAuthError
			require.ErrorAs(t, err, &oauthError)
			assert.Equal(t, test.want, oauthError.RawError)
			assert.Equal(t, msgTokenFailed, oauthError.Message.Key)
		})
	}
}
