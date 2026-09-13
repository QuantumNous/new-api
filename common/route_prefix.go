package common

import (
	"os"
	"strings"
	"sync"
)

var (
	routePrefixOnce sync.Once
	routePrefix     string
)

const routePrefixEnv = "NEW_API_ROUTE_PREFIX"

// ResolveRoutePrefix reads NEW_API_ROUTE_PREFIX from the environment and
// caches the normalized form. The empty value disables the prefix and is the
// backward-compatible default. Invalid values fall back to empty and emit a
// SysError so a typo never silently misroutes traffic.
func ResolveRoutePrefix() string {
	routePrefixOnce.Do(func() {
		raw := strings.TrimSpace(os.Getenv(routePrefixEnv))
		if raw == "" || raw == "/" {
			routePrefix = ""
			return
		}
		if !strings.HasPrefix(raw, "/") {
			SysError(routePrefixEnv + " must start with '/', ignoring: " + raw)
			return
		}
		if strings.ContainsAny(raw, " \t\n\r?#") {
			SysError(routePrefixEnv + " contains an invalid character, ignoring: " + raw)
			return
		}
		collapsed := collapseSlashes(raw)
		collapsed = strings.TrimRight(collapsed, "/")
		if collapsed == "" || collapsed == "/" {
			routePrefix = ""
			return
		}
		routePrefix = collapsed
		if collapsed != raw {
			SysLog(routePrefixEnv + " normalized to " + collapsed)
		}
	})
	return routePrefix
}

// RoutePrefix returns the cached normalized prefix. Call ResolveRoutePrefix
// once during startup; later reads are lock-free.
func RoutePrefix() string {
	return routePrefix
}

// ResetRoutePrefixForTest clears the cached prefix so the next call to
// ResolveRoutePrefix re-reads the environment. It is intended for tests that
// exercise both prefixed and unprefixed behaviour in the same process.
func ResetRoutePrefixForTest() {
	routePrefixOnce = sync.Once{}
	routePrefix = ""
}

func collapseSlashes(s string) string {
	for strings.Contains(s, "//") {
		s = strings.ReplaceAll(s, "//", "/")
	}
	return s
}

// HasRoutePrefix reports whether the request path begins with the configured
// prefix (or equals the prefix exactly). An empty prefix always returns true
// so the existing routes keep working.
func HasRoutePrefix(path string) bool {
	p := ResolveRoutePrefix()
	if p == "" {
		return true
	}
	if path == p {
		return true
	}
	return strings.HasPrefix(path, p+"/")
}

// StripRoutePrefix removes the leading prefix segment from path. Paths that
// are not under the prefix are returned unchanged.
func StripRoutePrefix(path string) string {
	p := ResolveRoutePrefix()
	if p == "" {
		return path
	}
	if path == p {
		return "/"
	}
	if strings.HasPrefix(path, p+"/") {
		return strings.TrimPrefix(path, p)
	}
	return path
}

// JoinRoutePrefix concatenates the prefix with a suffix, normalizing slashes
// so the result is a clean absolute path. An empty prefix yields the suffix
// unchanged (with a leading slash guaranteed).
func JoinRoutePrefix(suffix string) string {
	p := ResolveRoutePrefix()
	suffix = strings.TrimSpace(suffix)
	if suffix == "" {
		if p == "" {
			return "/"
		}
		return p
	}
	if !strings.HasPrefix(suffix, "/") {
		suffix = "/" + suffix
	}
	if p == "" {
		return suffix
	}
	return p + suffix
}

// IsUnderRoutePrefix returns true when path resolves under prefix+suffix
// after stripping the configured NEW_API_ROUTE_PREFIX. It is the prefix-aware
// replacement for hand-written strings.HasPrefix(path, "/v1/...") checks.
func IsUnderRoutePrefix(path, suffix string) bool {
	stripped := StripRoutePrefix(path)
	if suffix == "" {
		return stripped != ""
	}
	if !strings.HasPrefix(suffix, "/") {
		suffix = "/" + suffix
	}
	if stripped == suffix {
		return true
	}
	return strings.HasPrefix(stripped, suffix+"/") || strings.HasPrefix(stripped, suffix+"?")
}

// ContainsUnderRoutePrefix is the prefix-aware replacement for
// strings.Contains(path, "/v1/...") used by the auth middleware.
func ContainsUnderRoutePrefix(path, needle string) bool {
	stripped := StripRoutePrefix(path)
	return strings.Contains(stripped, needle)
}

// StaticServePath returns the prefix-relative root path used as the second
// argument of static.Serve.
func StaticServePath() string {
	p := ResolveRoutePrefix()
	if p == "" {
		return "/"
	}
	return p + "/"
}