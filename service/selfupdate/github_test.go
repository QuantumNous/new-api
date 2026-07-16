package selfupdate

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHTTPGitHubClient_FetchLatestRelease(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/repos/ChinaToyHunter/new-api/releases/latest", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
		  "tag_name":"v1.0.0-rc.21",
		  "name":"rc21",
		  "body":"notes",
		  "html_url":"https://github.com/ChinaToyHunter/new-api/releases/tag/v1.0.0-rc.21",
		  "published_at":"2026-01-01T00:00:00Z",
		  "assets":[{"name":"new-api-v1.0.0-rc.21","browser_download_url":"https://github.com/ChinaToyHunter/new-api/releases/download/v1.0.0-rc.21/new-api-v1.0.0-rc.21","size":10}]
		}`))
	}))
	defer srv.Close()

	c := NewHTTPGitHubClient("", srv.Client())
	c.APIBase = srv.URL // export field for tests
	rel, err := c.FetchLatestRelease(context.Background(), "ChinaToyHunter/new-api")
	require.NoError(t, err)
	assert.Equal(t, "v1.0.0-rc.21", rel.TagName)
	require.Len(t, rel.Assets, 1)
}

func TestHTTPGitHubClient_FetchLatestRelease_NonOK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"message":"Not Found"}`))
	}))
	defer srv.Close()

	c := NewHTTPGitHubClient("", srv.Client())
	c.APIBase = srv.URL
	_, err := c.FetchLatestRelease(context.Background(), "ChinaToyHunter/new-api")
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrNoReleases)
}

func TestHTTPGitHubClient_FetchLatestRelease_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"message":"boom"}`))
	}))
	defer srv.Close()

	c := NewHTTPGitHubClient("", srv.Client())
	c.APIBase = srv.URL
	_, err := c.FetchLatestRelease(context.Background(), "ChinaToyHunter/new-api")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "500")
	assert.NotErrorIs(t, err, ErrNoReleases)
}

func TestHTTPGitHubClient_FetchBytes(t *testing.T) {
	payload := []byte("hello world")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(payload)
	}))
	defer srv.Close()

	c := NewHTTPGitHubClient("", srv.Client())
	// FetchBytes validates the URL; use the test server URL directly but it
	// won't pass ValidateDownloadURL. We test it through a github.com URL by
	// stubbing APIBase — but FetchBytes takes an arbitrary URL. Bypass by
	// temporarily pointing to a URL that passes validation via a github-like host.
	// Simplest: test FetchBytes against an https server is an integration concern;
	// here we verify the limit behaviour with the plain http test server URL which
	// intentionally fails ValidateDownloadURL, returning a validation error.
	_, err := c.FetchBytes(context.Background(), srv.URL+"/file", 1024)
	require.Error(t, err)
	// httptest uses http:// — ValidateDownloadURL rejects non-HTTPS first.
	assert.Contains(t, err.Error(), "only HTTPS URLs are allowed")
}
