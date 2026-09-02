package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func responseCookie(t *testing.T, rec *httptest.ResponseRecorder, name string) *http.Cookie {
	t.Helper()
	for _, cookie := range (&http.Response{Header: rec.Header()}).Cookies() {
		if cookie.Name == name {
			return cookie
		}
	}
	return nil
}

// A hint that outlives its Refresh Cookie would otherwise keep sending the
// visitor back for a refresh that can only 401, spending a slot of the IP-keyed
// CriticalRateLimit budget every cold boot. The rejection has to erase it, which
// makes the wasted request self-correcting instead of permanent.
func TestRefreshAuthWithoutCredentialErasesStaleSessionHint(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/auth/refresh", nil)
	// The exact state of a visitor whose hint survived its credential.
	c.Request.AddCookie(&http.Cookie{
		Name:  service.SessionHintCookieName,
		Value: service.SessionHintCookieValue,
	})

	RefreshAuth(c)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)

	hint := responseCookie(t, rec, service.SessionHintCookieName)
	require.NotNil(t, hint, "a rejected refresh must expire the session hint")
	assert.Equal(t, -1, hint.MaxAge)
	assert.Equal(t, "", hint.Value)
	assert.Equal(t, "/", hint.Path)

	// The credential cookie is cleared in the same response, so the two cannot
	// drift apart.
	refresh := responseCookie(t, rec, service.RefreshCookieName)
	require.NotNil(t, refresh)
	assert.Equal(t, -1, refresh.MaxAge)
}
