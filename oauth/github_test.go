package oauth

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func githubJSONResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     make(http.Header),
	}
}

func TestGitHubGetUserInfoMinimumAccountAge(t *testing.T) {
	originalTransport := http.DefaultTransport
	originalMinimumAge := common.GitHubMinimumAccountAgeYears
	t.Cleanup(func() {
		http.DefaultTransport = originalTransport
		common.GitHubMinimumAccountAgeYears = originalMinimumAge
	})

	tests := []struct {
		name             string
		minimumAgeYears  int
		createdAt        time.Time
		expectAgeRequest bool
		expectAgeError   bool
	}{
		{
			name:             "disabled",
			minimumAgeYears:  0,
			expectAgeRequest: false,
		},
		{
			name:             "old enough",
			minimumAgeYears:  2,
			createdAt:        time.Now().AddDate(-3, 0, 0),
			expectAgeRequest: true,
		},
		{
			name:             "too new",
			minimumAgeYears:  2,
			createdAt:        time.Now().AddDate(-1, 0, 0),
			expectAgeRequest: true,
			expectAgeError:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			common.GitHubMinimumAccountAgeYears = tt.minimumAgeYears
			var paths []string
			http.DefaultTransport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
				paths = append(paths, req.URL.Path)
				switch req.URL.Path {
				case "/user":
					return githubJSONResponse(http.StatusOK, `{"id":1,"login":"test-user","name":"Test User"}`), nil
				case "/users/test-user":
					return githubJSONResponse(http.StatusOK, fmt.Sprintf(`{"id":1,"login":"test-user","created_at":%q}`, tt.createdAt.Format(time.RFC3339))), nil
				default:
					return githubJSONResponse(http.StatusNotFound, `{}`), nil
				}
			})

			user, err := (&GitHubProvider{}).GetUserInfo(context.Background(), &OAuthToken{AccessToken: "token"})
			if tt.expectAgeError {
				var ageErr *AccountAgeError
				require.ErrorAs(t, err, &ageErr)
				require.Equal(t, tt.minimumAgeYears, ageErr.RequiredYears)
				require.Equal(t, tt.createdAt.Unix(), ageErr.CreatedAt.Unix())
				require.Nil(t, user)
			} else {
				require.NoError(t, err)
				require.NotNil(t, user)
			}
			require.Equal(t, tt.expectAgeRequest, len(paths) == 2)
			require.Equal(t, "/user", paths[0])
		})
	}
}
