package controller

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCopyVideoProxyResponseHeadersSkipsUpstreamCORS(t *testing.T) {
	dst := make(http.Header)
	dst.Set("Access-Control-Allow-Origin", "*")
	src := http.Header{
		"aCcEsS-cOnTrOl-AlLoW-OrIgIn":  {"https://upstream.example"},
		"Access-Control-Allow-Headers": {"Authorization"},
		"Content-Type":                 {"video/mp4"},
		"X-Upstream-Value":             {"first", "second"},
	}

	copyVideoProxyResponseHeaders(dst, src)

	assert.Equal(t, []string{"*"}, dst.Values("Access-Control-Allow-Origin"))
	assert.Empty(t, dst.Values("Access-Control-Allow-Headers"))
	assert.Equal(t, "video/mp4", dst.Get("Content-Type"))
	assert.Equal(t, []string{"first", "second"}, dst.Values("X-Upstream-Value"))
}
