package common

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveRoutePrefix(t *testing.T) {
	cases := []struct {
		name    string
		env     string
		set     bool
		want    string
		wantLog bool
	}{
		{name: "empty disables prefix", env: "", set: true, want: ""},
		{name: "single slash disables prefix", env: "/", set: true, want: ""},
		{name: "simple prefix", env: "/proxy", set: true, want: "/proxy"},
		{name: "trailing slash is trimmed", env: "/proxy/", set: true, want: "/proxy"},
		{name: "nested prefix", env: "/api/new-api", set: true, want: "/api/new-api"},
		{name: "whitespace around value trimmed", env: "  /proxy  ", set: true, want: "/proxy"},
		{name: "consecutive slashes collapsed", env: "/proxy//v1", set: true, want: "/proxy/v1"},
		{name: "missing leading slash rejected", env: "proxy", set: true, want: ""},
		{name: "question mark rejected", env: "/proxy?x=1", set: true, want: ""},
		{name: "hash rejected", env: "/proxy#frag", set: true, want: ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ResetRoutePrefixForTest()
			if tc.set {
				require.NoError(t, os.Setenv(routePrefixEnv, tc.env))
				defer os.Unsetenv(routePrefixEnv)
			}
			assert.Equal(t, tc.want, ResolveRoutePrefix())
		})
	}
	ResetRoutePrefixForTest()
}

func TestStripRoutePrefix(t *testing.T) {
	t.Run("with prefix", func(t *testing.T) {
		ResetRoutePrefixForTest()
		require.NoError(t, os.Setenv(routePrefixEnv, "/proxy"))
		defer func() {
			os.Unsetenv(routePrefixEnv)
			ResetRoutePrefixForTest()
		}()
		ResolveRoutePrefix()

		assert.Equal(t, "/api/status", StripRoutePrefix("/proxy/api/status"))
		assert.Equal(t, "/", StripRoutePrefix("/proxy"))
		assert.Equal(t, "/v1/chat/completions", StripRoutePrefix("/proxy/v1/chat/completions"))
		assert.Equal(t, "/other", StripRoutePrefix("/other"))
		assert.Equal(t, "/api/status", StripRoutePrefix("/api/status"))
	})
	t.Run("without prefix", func(t *testing.T) {
		ResetRoutePrefixForTest()
		os.Unsetenv(routePrefixEnv)
		ResolveRoutePrefix()
		assert.Equal(t, "", ResolveRoutePrefix())
		assert.Equal(t, "/api/status", StripRoutePrefix("/api/status"))
		assert.Equal(t, "/proxy/x", StripRoutePrefix("/proxy/x"))
	})
}

func TestIsUnderRoutePrefix(t *testing.T) {
	t.Run("with prefix", func(t *testing.T) {
		ResetRoutePrefixForTest()
		require.NoError(t, os.Setenv(routePrefixEnv, "/proxy"))
		defer func() {
			os.Unsetenv(routePrefixEnv)
			ResetRoutePrefixForTest()
		}()
		ResolveRoutePrefix()

		assert.True(t, IsUnderRoutePrefix("/proxy/v1/chat/completions", "/v1/chat/completions"))
		assert.True(t, IsUnderRoutePrefix("/proxy/v1", "/v1"))
		assert.True(t, IsUnderRoutePrefix("/proxy/v1/chat/completions?stream=true", "/v1/chat/completions"))
		assert.False(t, IsUnderRoutePrefix("/api/status", "/v1"))
		assert.False(t, IsUnderRoutePrefix("/other", "/v1"))
	})
}

func TestContainsUnderRoutePrefix(t *testing.T) {
	t.Run("with prefix", func(t *testing.T) {
		ResetRoutePrefixForTest()
		require.NoError(t, os.Setenv(routePrefixEnv, "/proxy"))
		defer func() {
			os.Unsetenv(routePrefixEnv)
			ResetRoutePrefixForTest()
		}()
		ResolveRoutePrefix()

		assert.True(t, ContainsUnderRoutePrefix("/proxy/mj/submit/imagine", "/mj/"))
		assert.True(t, ContainsUnderRoutePrefix("/proxy/v1/videos/abc/remix", "/v1/videos/"))
		assert.False(t, ContainsUnderRoutePrefix("/v1/videos/abc/remix", "/mj/"))
	})
}

func TestJoinRoutePrefix(t *testing.T) {
	t.Run("without prefix", func(t *testing.T) {
		ResetRoutePrefixForTest()
		os.Unsetenv(routePrefixEnv)
		ResolveRoutePrefix()
		assert.Equal(t, "/api/status", JoinRoutePrefix("/api/status"))
		assert.Equal(t, "/api/status", JoinRoutePrefix("api/status"))
	})
	t.Run("with prefix", func(t *testing.T) {
		ResetRoutePrefixForTest()
		require.NoError(t, os.Setenv(routePrefixEnv, "/proxy"))
		defer func() {
			os.Unsetenv(routePrefixEnv)
			ResetRoutePrefixForTest()
		}()
		ResolveRoutePrefix()

		assert.Equal(t, "/proxy/api/status", JoinRoutePrefix("/api/status"))
		assert.Equal(t, "/proxy/api/status", JoinRoutePrefix("api/status"))
		assert.Equal(t, "/proxy/api/status", JoinRoutePrefix("//api/status"))
		assert.Equal(t, "/proxy", JoinRoutePrefix(""))
	})
}

func TestStaticServePath(t *testing.T) {
	t.Run("without prefix", func(t *testing.T) {
		ResetRoutePrefixForTest()
		os.Unsetenv(routePrefixEnv)
		ResolveRoutePrefix()
		assert.Equal(t, "/", StaticServePath())
	})
	t.Run("with prefix", func(t *testing.T) {
		ResetRoutePrefixForTest()
		require.NoError(t, os.Setenv(routePrefixEnv, "/proxy"))
		defer func() {
			os.Unsetenv(routePrefixEnv)
			ResetRoutePrefixForTest()
		}()
		ResolveRoutePrefix()
		assert.Equal(t, "/proxy/", StaticServePath())
	})
}
