package channel_test

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/relay/channel/cloudflare"
	"github.com/QuantumNous/new-api/relay/channel/cohere"
	"github.com/QuantumNous/new-api/relay/channel/coze"
	"github.com/QuantumNous/new-api/relay/channel/palm"
	"github.com/QuantumNous/new-api/relay/channel/tencent"
	"github.com/QuantumNous/new-api/relay/channel/zhipu"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type trackedResponseBody struct {
	reader bytes.Reader
	reads  atomic.Int32
	closed atomic.Bool
}

func (b *trackedResponseBody) Read(p []byte) (int, error) {
	b.reads.Add(1)
	return b.reader.Read(p)
}

func (b *trackedResponseBody) Close() error {
	b.closed.Store(true)
	return nil
}

func TestSpecialStreamHandlersCloseBodyWithoutStartingProducerWhenHeaderCommitFails(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		doResponse func(*gin.Context, *http.Response, *relaycommon.RelayInfo) *types.NewAPIError
	}{
		{
			name: "cloudflare",
			doResponse: func(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) *types.NewAPIError {
				_, err := (&cloudflare.Adaptor{}).DoResponse(c, resp, info)
				return err
			},
		},
		{
			name: "cohere",
			doResponse: func(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) *types.NewAPIError {
				_, err := (&cohere.Adaptor{}).DoResponse(c, resp, info)
				return err
			},
		},
		{
			name: "coze",
			doResponse: func(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) *types.NewAPIError {
				_, err := (&coze.Adaptor{}).DoResponse(c, resp, info)
				return err
			},
		},
		{
			name: "palm",
			doResponse: func(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) *types.NewAPIError {
				_, err := (&palm.Adaptor{}).DoResponse(c, resp, info)
				return err
			},
		},
		{
			name: "tencent",
			doResponse: func(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) *types.NewAPIError {
				_, err := (&tencent.Adaptor{}).DoResponse(c, resp, info)
				return err
			},
		},
		{
			name: "zhipu",
			doResponse: func(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) *types.NewAPIError {
				_, err := (&zhipu.Adaptor{}).DoResponse(c, resp, info)
				return err
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			requestContext, cancel := context.WithCancel(context.Background())
			cancel()

			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil).WithContext(requestContext)
			body := &trackedResponseBody{reader: *bytes.NewReader([]byte("data: test\n"))}
			resp := &http.Response{StatusCode: http.StatusOK, Body: body}
			info := &relaycommon.RelayInfo{
				IsStream:  true,
				RelayMode: relayconstant.RelayModeChatCompletions,
				ChannelMeta: &relaycommon.ChannelMeta{
					UpstreamModelName: "test-model",
				},
			}

			err := test.doResponse(c, resp, info)

			require.NotNil(t, err)
			assert.True(t, body.closed.Load(), "upstream response body must be closed")
			assert.Zero(t, body.reads.Load(), "upstream producer must not start before headers commit")
		})
	}
}

var _ io.ReadCloser = (*trackedResponseBody)(nil)
