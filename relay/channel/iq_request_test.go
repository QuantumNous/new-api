package channel

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestIQRequestDeadlineAndNoRedirectReplay(t *testing.T) {
	service.InitHttpClient()
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = io.Copy(io.Discard, r.Body)
		if r.URL.Path == "/redirect" {
			w.Header().Set("Location", "/unexpected")
			w.WriteHeader(307)
			return
		}
		<-r.Context().Done()
	}))
	defer server.Close()
	for _, path := range []string{"/redirect", "/slow"} {
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequestWithContext(ctx, "POST", "/iq", nil)
		c.Set("iq_test", true)
		req, err := http.NewRequest("POST", server.URL+path, bytes.NewBufferString("request"))
		require.NoError(t, err)
		require.NotNil(t, req.GetBody)
		resp, err := doRequest(c, req, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}})
		if path == "/redirect" {
			require.NoError(t, err)
			require.Equal(t, 307, resp.StatusCode)
			_ = resp.Body.Close()
		} else {
			require.Error(t, err)
			require.ErrorIs(t, ctx.Err(), context.DeadlineExceeded)
		}
		cancel()
	}
	require.EqualValues(t, 2, calls.Load())
}
