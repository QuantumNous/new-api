package oauth

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidateOAuthEndpointRejectsUnsafeTargets(t *testing.T) {
	for _, endpoint := range []string{
		"http://oauth.example/token",
		"https://127.0.0.1/token",
		"https://localhost/token",
		"https://10.0.0.1/token",
		"https://oauth.example:8443/token",
		"file:///etc/passwd",
	} {
		assert.Error(t, ValidateOAuthEndpoint(endpoint), endpoint)
	}
}

func TestValidateOAuthEndpointAllowsPublicHTTPS(t *testing.T) {
	assert.NoError(t, ValidateOAuthEndpoint("https://8.8.8.8/token"))
}

func TestCheckOAuthRedirectRejectsPrivateTargetAndRedirectLoops(t *testing.T) {
	privateRequest, err := http.NewRequest(http.MethodGet, "https://127.0.0.1/callback", nil)
	assert.NoError(t, err)
	assert.Error(t, checkOAuthRedirect(privateRequest, nil))

	publicRequest, err := http.NewRequest(http.MethodGet, "https://8.8.8.8/callback", nil)
	assert.NoError(t, err)
	assert.Error(t, checkOAuthRedirect(publicRequest, make([]*http.Request, 5)))
}
