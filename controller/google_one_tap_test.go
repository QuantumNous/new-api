package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/oauth"
	"github.com/stretchr/testify/require"
	"google.golang.org/api/idtoken"
)

func TestGoogleOneTapOAuthUser(t *testing.T) {
	payload := &idtoken.Payload{
		Subject: "google-subject",
		Claims: map[string]any{
			"email":          " user@example.com ",
			"email_verified": true,
			"name":           "Jane Doe",
		},
	}

	user, err := googleOneTapOAuthUser(payload)

	require.NoError(t, err)
	require.Equal(t, "google-subject", user.ProviderUserID)
	require.Equal(t, "google_user", user.Username)
	require.Equal(t, "user@example.com", user.Email)
	require.Equal(t, "Jane Doe", user.DisplayName)
}

func TestGoogleOneTapOAuthUserAcceptsStringEmailVerified(t *testing.T) {
	payload := &idtoken.Payload{
		Claims: map[string]any{
			"sub":            "claim-subject",
			"email":          "user@example.com",
			"email_verified": "true",
		},
	}

	user, err := googleOneTapOAuthUser(payload)

	require.NoError(t, err)
	require.Equal(t, "claim-subject", user.ProviderUserID)
}

func TestGoogleOneTapOAuthUserRejectsInvalidPayload(t *testing.T) {
	tests := []struct {
		name    string
		payload *idtoken.Payload
	}{
		{name: "nil payload"},
		{
			name: "missing subject",
			payload: &idtoken.Payload{
				Claims: map[string]any{
					"email":          "user@example.com",
					"email_verified": true,
				},
			},
		},
		{
			name: "missing email",
			payload: &idtoken.Payload{
				Subject: "google-subject",
				Claims: map[string]any{
					"email_verified": true,
				},
			},
		},
		{
			name: "unverified email",
			payload: &idtoken.Payload{
				Subject: "google-subject",
				Claims: map[string]any{
					"email":          "user@example.com",
					"email_verified": false,
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := googleOneTapOAuthUser(tt.payload)

			require.Error(t, err)
			var oauthErr *oauth.OAuthError
			require.ErrorAs(t, err, &oauthErr)
		})
	}
}
