package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/oauth"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"google.golang.org/api/idtoken"
)

func TestGoogleOneTapSuccessStartsFreshSameOriginNavigation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/oauth/google/one-tap?return_to=%2Fdashboard",
		nil,
	)

	respondGoogleOneTapSuccess(context, gin.H{"id": 42, "username": "one-tap-user"})

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Empty(t, recorder.Header().Get("Location"))
	require.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
	require.Contains(t, recorder.Body.String(), "localStorage.setItem('user'")
	require.Contains(t, recorder.Body.String(), "localStorage.setItem('uid'")
	require.Contains(t, recorder.Body.String(), "eyJpZCI6NDIsInVzZXJuYW1lIjoib25lLXRhcC11c2VyIn0=")
	require.Contains(t, recorder.Body.String(), "L2Rhc2hib2FyZA==")
}

func TestGoogleOneTapAlreadyLoggedInPreservesStoredUser(t *testing.T) {
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/oauth/google/one-tap?return_to=%2Fdashboard",
		nil,
	)

	respondGoogleOneTapAlreadyLoggedIn(context)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
	require.NotContains(t, recorder.Body.String(), "localStorage.setItem('user'")
	require.NotContains(t, recorder.Body.String(), "localStorage.setItem('uid'")
	require.NotContains(t, recorder.Body.String(), "already_logged_in")
	require.Contains(t, recorder.Body.String(), "location.replace")
	require.Contains(t, recorder.Body.String(), "L2Rhc2hib2FyZA==")
}

func TestGoogleOneTapSuccessEscapesReturnPath(t *testing.T) {
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/oauth/google/one-tap?return_to=%2Fdashboard%3Fa%3D1%26next%3D%2522%253E%253Cscript%253E",
		nil,
	)

	respondGoogleOneTapSuccess(context, gin.H{
		"id":       42,
		"username": "</script><script>alert(1)</script>",
	})

	require.False(t, strings.Contains(recorder.Body.String(), "alert(1)"))
	require.Equal(t, 1, strings.Count(recorder.Body.String(), "<script>"))
	require.Contains(t, recorder.Body.String(), "&amp;")
}

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
