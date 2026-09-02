package service

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
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

// The hint only stays trustworthy if it cannot outlive the Refresh Cookie, so
// every write must carry the same expiry and every clear must expire both.
func TestSessionHintCookieTracksRefreshCookieLifetime(t *testing.T) {
	previousSecure := common.SessionCookieSecure
	common.SessionCookieSecure = true
	t.Cleanup(func() { common.SessionCookieSecure = previousSecure })

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	WriteRefreshCookie(ctx, "session-id.refresh-secret")

	refresh := responseCookie(t, rec, RefreshCookieName)
	hint := responseCookie(t, rec, SessionHintCookieName)
	require.NotNil(t, refresh)
	require.NotNil(t, hint)

	assert.Equal(t, SessionHintCookieValue, hint.Value)
	assert.Equal(t, refresh.MaxAge, hint.MaxAge)
	assert.Equal(t, refresh.Expires.Unix(), hint.Expires.Unix())
	assert.Equal(t, refresh.Secure, hint.Secure)
	assert.Equal(t, refresh.SameSite, hint.SameSite)

	// The hint must be readable from any page, while the credential stays
	// confined to the endpoint that consumes it.
	assert.Equal(t, "/", hint.Path)
	assert.False(t, hint.HttpOnly)
	assert.Equal(t, "/api/user/auth", refresh.Path)
	assert.True(t, refresh.HttpOnly)

	// The hint must never carry the credential it advertises.
	assert.NotContains(t, hint.Value, "refresh-secret")
	assert.NotContains(t, hint.Value, "session-id")
}

func TestClearRefreshCookieAlsoExpiresSessionHint(t *testing.T) {
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ClearRefreshCookie(ctx)

	refresh := responseCookie(t, rec, RefreshCookieName)
	hint := responseCookie(t, rec, SessionHintCookieName)
	require.NotNil(t, refresh)
	require.NotNil(t, hint)

	assert.Equal(t, "", hint.Value)
	assert.Equal(t, refresh.MaxAge, hint.MaxAge)
	assert.Equal(t, -1, hint.MaxAge)
	assert.Equal(t, "/", hint.Path)
}

// The hint's own presence must never authorize a rotation: it is a routing
// optimization, and the credential remains the sole input.
func TestSessionHintCookieIsNotAcceptedAsARefreshToken(t *testing.T) {
	_, ok := RefreshTokenSID(SessionHintCookieValue)
	assert.False(t, ok)
}
