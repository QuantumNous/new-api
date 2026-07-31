package controller

import (
	"net/http"
	"reflect"
	"testing"
)

func TestCopyVideoProxyResponseHeadersSkipsUpstreamCORS(t *testing.T) {
	dst := make(http.Header)
	dst.Set("Access-Control-Allow-Origin", "*")
	src := http.Header{
		"Access-Control-Allow-Origin":  {"https://upstream.example"},
		"Access-Control-Allow-Headers": {"Authorization"},
		"Content-Type":                 {"video/mp4"},
		"X-Upstream-Value":             {"first", "second"},
	}

	copyVideoProxyResponseHeaders(dst, src)

	if got := dst.Values("Access-Control-Allow-Origin"); !reflect.DeepEqual(got, []string{"*"}) {
		t.Fatalf("Access-Control-Allow-Origin = %v, want existing middleware value", got)
	}
	if got := dst.Values("Access-Control-Allow-Headers"); len(got) != 0 {
		t.Fatalf("Access-Control-Allow-Headers = %v, want no copied upstream values", got)
	}
	if got := dst.Get("Content-Type"); got != "video/mp4" {
		t.Fatalf("Content-Type = %q, want video/mp4", got)
	}
	if got := dst.Values("X-Upstream-Value"); !reflect.DeepEqual(got, []string{"first", "second"}) {
		t.Fatalf("X-Upstream-Value = %v, want both upstream values", got)
	}
}
