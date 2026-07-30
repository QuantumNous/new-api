package oauth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGenericExchangeTokenIncludesCodeVerifierWhenPresent(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name     string
		verifier string
	}{
		{name: "with verifier", verifier: "test-code-verifier"},
		{name: "without verifier"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var form url.Values
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				require.NoError(t, r.ParseForm())
				form = r.PostForm
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"access_token":"token","token_type":"Bearer"}`))
			}))
			defer server.Close()

			provider := NewGenericOAuthProvider(&model.CustomOAuthProvider{
				Name:          "Test Provider",
				Slug:          "test-provider",
				ClientId:      "client-id",
				ClientSecret:  "client-secret",
				TokenEndpoint: server.URL,
				AuthStyle:     AuthStyleInParams,
			})
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			if test.verifier != "" {
				ctx.Set("code_verifier", test.verifier)
			}

			token, err := provider.ExchangeToken(context.Background(), "auth-code", ctx)
			require.NoError(t, err)
			require.Equal(t, "token", token.AccessToken)
			require.Equal(t, test.verifier, form.Get("code_verifier"))
		})
	}
}
