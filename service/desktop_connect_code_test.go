package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIssueAndExchangeDesktopConnectCodeHappyPath(t *testing.T) {
	useTestSessionSecret(t)
	user := setupAuthSessionTestDB(t)
	useDesktopAuthorizationRedis(t)

	view, err := IssueDesktopConnectCode(user.Id, user.AuthVersion, "https://yeschoy.com", "", "")
	require.NoError(t, err)
	assert.Len(t, view.Code, 48)
	assert.Equal(t, "https://yeschoy.com", view.Origin)
	assert.Equal(t, DesktopConnectCodeTTLSeconds, view.TTLSeconds)
	assert.Greater(t, view.ExpiresAt, time.Now().Unix())

	bundle, err := ExchangeDesktopConnectCode(view.Code, "yeschoy.com", "127.0.0.1", "yeschoy-desktop/0.4.30")
	require.NoError(t, err)
	assert.NotEmpty(t, bundle.AccessToken)
	assert.Equal(t, DesktopLoginMethod, bundle.Session.LoginMethod)

	_, err = ExchangeDesktopConnectCode(view.Code, "yeschoy.com", "127.0.0.1", "yeschoy-desktop/0.4.30")
	var flowErr *DesktopConnectCodeError
	require.ErrorAs(t, err, &flowErr)
	assert.Equal(t, "connect_code_already_used", flowErr.Code)
}

func TestExchangeDesktopConnectCodeOriginMismatch(t *testing.T) {
	useTestSessionSecret(t)
	user := setupAuthSessionTestDB(t)
	useDesktopAuthorizationRedis(t)

	view, err := IssueDesktopConnectCode(user.Id, user.AuthVersion, "https://yeschoy.com", "", "")
	require.NoError(t, err)

	_, err = ExchangeDesktopConnectCode(view.Code, "evil.example", "127.0.0.1", "desktop")
	var flowErr *DesktopConnectCodeError
	require.ErrorAs(t, err, &flowErr)
	assert.Equal(t, "connect_origin_mismatch", flowErr.Code)
}

func TestIssueDesktopConnectCodeRejectsInvalidOrigin(t *testing.T) {
	useTestSessionSecret(t)
	user := setupAuthSessionTestDB(t)
	useDesktopAuthorizationRedis(t)

	_, err := IssueDesktopConnectCode(user.Id, user.AuthVersion, "http://yeschoy.com", "", "")
	var flowErr *DesktopConnectCodeError
	require.ErrorAs(t, err, &flowErr)
	assert.Equal(t, "connect_origin_invalid", flowErr.Code)
}

func TestCanonicalDesktopConnectHTTPSOrigin(t *testing.T) {
	origin, ok := canonicalDesktopConnectHTTPSOrigin("https://yeschoy.com")
	assert.True(t, ok)
	assert.Equal(t, "https://yeschoy.com", origin)

	_, ok = canonicalDesktopConnectHTTPSOrigin("https://127.0.0.1")
	assert.False(t, ok)
}
