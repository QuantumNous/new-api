package oauth

import (
	"testing"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/stretchr/testify/require"
)

func TestParseGoogleUserInfo_OK(t *testing.T) {
	body := []byte(`{"sub":"123","email":"jjcc1024byte@gmail.com","email_verified":true,"name":"Alice","picture":"http://x/y.png"}`)
	u, err := parseGoogleUserInfo(body)
	require.NoError(t, err)
	require.Equal(t, "123", u.ProviderUserID)
	require.Equal(t, "jjcc1024byte@gmail.com", u.Email)
	require.Equal(t, "Alice", u.DisplayName)
	// Username is derived from the email local part with a google_ prefix.
	require.Equal(t, "google_jjcc1024byte", u.Username)
}

func TestGoogleUsernameFromEmail(t *testing.T) {
	cases := map[string]string{
		"jjcc1024byte@gmail.com": "google_jjcc1024byte",
		"Foo.Bar_1@example.com":  "google_foo.bar_1", // lowercased, dot/underscore kept
		"john+spam@gmail.com":    "google_johnspam",  // disallowed char dropped
		"@bad.com":               "",                 // empty local part -> empty (caller falls back)
	}
	for email, want := range cases {
		require.Equal(t, want, googleUsernameFromEmail(email), "email=%s", email)
	}
}

func TestParseGoogleUserInfo_EmailNotVerified(t *testing.T) {
	body := []byte(`{"sub":"123","email":"a@b.com","email_verified":false,"name":"Alice"}`)
	_, err := parseGoogleUserInfo(body)
	require.Error(t, err)
	oErr, ok := err.(*OAuthError)
	require.True(t, ok)
	require.Equal(t, i18n.MsgOAuthEmailNotVerified, oErr.MsgKey)
}

func TestParseGoogleUserInfo_EmptySub(t *testing.T) {
	body := []byte(`{"sub":"","email":"a@b.com","email_verified":true}`)
	_, err := parseGoogleUserInfo(body)
	require.Error(t, err)
	oErr, ok := err.(*OAuthError)
	require.True(t, ok)
	require.Equal(t, i18n.MsgOAuthUserInfoEmpty, oErr.MsgKey)
}

func TestParseGoogleUserInfo_EmptyEmail(t *testing.T) {
	body := []byte(`{"sub":"123","email":"","email_verified":true}`)
	_, err := parseGoogleUserInfo(body)
	require.Error(t, err)
	oErr, ok := err.(*OAuthError)
	require.True(t, ok)
	require.Equal(t, i18n.MsgOAuthUserInfoEmpty, oErr.MsgKey)
}

func TestParseGoogleUserInfo_EmailVerifiedAsString(t *testing.T) {
	// Google legacy/ID-token claims may return email_verified as the string "true".
	body := []byte(`{"sub":"123","email":"a@b.com","email_verified":"true","name":"Alice"}`)
	u, err := parseGoogleUserInfo(body)
	require.NoError(t, err)
	require.Equal(t, "123", u.ProviderUserID)
}

func TestParseGoogleUserInfo_EmailVerifiedAbsent(t *testing.T) {
	// Missing email_verified must fail-closed (treated as not verified).
	body := []byte(`{"sub":"123","email":"a@b.com","name":"Alice"}`)
	_, err := parseGoogleUserInfo(body)
	require.Error(t, err)
	oErr, ok := err.(*OAuthError)
	require.True(t, ok)
	require.Equal(t, i18n.MsgOAuthEmailNotVerified, oErr.MsgKey)
}

func TestParseGoogleUserInfo_InvalidJSON(t *testing.T) {
	_, err := parseGoogleUserInfo([]byte(`not json`))
	require.Error(t, err)
}
