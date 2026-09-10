package common

import (
	"bytes"
	"os"
	"strings"
)

// Upstream media URL rewriting.
//
// Some deployments front the upstream gateway behind a different public host
// (for example an API gateway that relays to an upstream provider). Media URLs
// embedded in upstream responses then leak the upstream host to end users. When
// both env vars are configured the relay rewrites upstream media URLs to the
// public prefix before writing anything to the client; when unset the relay is
// untouched (default, no behaviour change).
//
//	MEDIA_UPSTREAM_ORIGIN=https://upstream.example.com
//	MEDIA_PUBLIC_ORIGIN=https://public.example.com
//
// The rewrite applies only to the path prefix "/v1/media/".
func MaskPublicMediaURLs(b []byte) []byte {
	upstream := strings.TrimRight(os.Getenv("MEDIA_UPSTREAM_ORIGIN"), "/")
	public := strings.TrimRight(os.Getenv("MEDIA_PUBLIC_ORIGIN"), "/")
	if upstream == "" || public == "" {
		return b
	}
	return maskPublicMediaURLs(b, []byte(upstream+"/v1/media/"), []byte(public+"/v1/media/"))
}

func maskPublicMediaURLs(b, upstream, public []byte) []byte {
	return bytes.ReplaceAll(b, upstream, public)
}
