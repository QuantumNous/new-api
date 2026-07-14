package oauth

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCallbackRedirectURIUsesForwardedPublicOrigin(t *testing.T) {
	req := httptest.NewRequest("GET", "http://internal:3000/api/oauth/google", nil)
	req.Header.Set("X-Forwarded-Proto", "https")
	req.Header.Set("X-Forwarded-Host", "www.modelsphere.net")

	c := &gin.Context{Request: req}

	require.Equal(t, "https://www.modelsphere.net/oauth/google", callbackRedirectURI(c, "/oauth/google"))
}

func TestCallbackRedirectURIUsesRequestOrigin(t *testing.T) {
	req := httptest.NewRequest("GET", "https://www.modelsphere.net/api/oauth/google", nil)
	c := &gin.Context{Request: req}

	require.Equal(t, "https://www.modelsphere.net/oauth/google", callbackRedirectURI(c, "/oauth/google"))
}
