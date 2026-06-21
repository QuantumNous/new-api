package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRewriteImageResponseBodyTaskPoll(t *testing.T) {
	body := []byte(`{
		"code": 200,
		"data": {
			"status": "completed",
			"result": {
				"images": [{
					"url": ["https://upstream.example/out.png"]
				}]
			}
		}
	}`)

	orig := cacheImageLocallyImpl
	cacheImageLocallyImpl = func(string) string { return "https://apimaster.ai/imgs/test.png" }
	t.Cleanup(func() { cacheImageLocallyImpl = orig })

	out := RewriteImageResponseBody(body)
	require.Contains(t, string(out), "https://apimaster.ai/imgs/test.png")
	require.NotContains(t, string(out), "upstream.example")
}

func TestRewriteImageResponseBodySkipsPending(t *testing.T) {
	body := []byte(`{
		"code": 200,
		"data": {
			"status": "processing",
			"result": {
				"images": [{
					"url": ["https://upstream.example/out.png"]
				}]
			}
		}
	}`)

	out := RewriteImageResponseBody(body)
	require.Equal(t, string(body), string(out))
}

func TestRewriteImageResponseBodySyncData(t *testing.T) {
	body := []byte(`{
		"created": 1,
		"data": [{"url": "https://upstream.example/sync.png"}]
	}`)

	orig := cacheImageLocallyImpl
	cacheImageLocallyImpl = func(u string) string {
		require.Equal(t, "https://upstream.example/sync.png", u)
		return "https://apimaster.ai/imgs/sync.png"
	}
	t.Cleanup(func() { cacheImageLocallyImpl = orig })

	out := RewriteImageResponseBody(body)
	require.Contains(t, string(out), "https://apimaster.ai/imgs/sync.png")
}
