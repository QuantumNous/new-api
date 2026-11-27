package channel

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type cancelTestAdaptor struct {
	requestURL string
}

func (a *cancelTestAdaptor) Init(*relaycommon.RelayInfo) {}
func (a *cancelTestAdaptor) GetRequestURL(*relaycommon.RelayInfo) (string, error) {
	return a.requestURL, nil
}
func (a *cancelTestAdaptor) SetupRequestHeader(*gin.Context, *http.Header, *relaycommon.RelayInfo) error {
	return nil
}
func (a *cancelTestAdaptor) ConvertOpenAIRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeneralOpenAIRequest) (any, error) {
	return nil, nil
}
func (a *cancelTestAdaptor) ConvertRerankRequest(*gin.Context, int, dto.RerankRequest) (any, error) {
	return nil, nil
}
func (a *cancelTestAdaptor) ConvertEmbeddingRequest(*gin.Context, *relaycommon.RelayInfo, dto.EmbeddingRequest) (any, error) {
	return nil, nil
}
func (a *cancelTestAdaptor) ConvertAudioRequest(*gin.Context, *relaycommon.RelayInfo, dto.AudioRequest) (io.Reader, error) {
	return nil, nil
}
func (a *cancelTestAdaptor) ConvertImageRequest(*gin.Context, *relaycommon.RelayInfo, dto.ImageRequest) (any, error) {
	return nil, nil
}
func (a *cancelTestAdaptor) ConvertOpenAIResponsesRequest(*gin.Context, *relaycommon.RelayInfo, dto.OpenAIResponsesRequest) (any, error) {
	return nil, nil
}
func (a *cancelTestAdaptor) DoRequest(*gin.Context, *relaycommon.RelayInfo, io.Reader) (any, error) {
	return nil, nil
}
func (a *cancelTestAdaptor) DoResponse(*gin.Context, *http.Response, *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	return nil, nil
}
func (a *cancelTestAdaptor) GetModelList() []string { return nil }
func (a *cancelTestAdaptor) GetChannelName() string { return "cancel-test" }
func (a *cancelTestAdaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	return nil, nil
}
func (a *cancelTestAdaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	return nil, nil
}

func TestDoApiAndFormRequestPropagateClientCancellation(t *testing.T) {
	service.InitHttpClient()
	gin.SetMode(gin.TestMode)

	for _, tc := range []struct {
		name string
		send func(Adaptor, *gin.Context, *relaycommon.RelayInfo, io.Reader) (*http.Response, error)
	}{
		{name: "DoApiRequest", send: DoApiRequest},
		{name: "DoFormRequest", send: DoFormRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			started := make(chan struct{}, 1)
			upstreamCanceled := make(chan struct{})
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, _ = io.Copy(io.Discard, r.Body)
				started <- struct{}{}
				select {
				case <-r.Context().Done():
					close(upstreamCanceled)
				case <-time.After(500 * time.Millisecond):
					w.WriteHeader(http.StatusInternalServerError)
				}
			}))
			defer upstream.Close()

			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			reqCtx, cancel := context.WithCancel(context.Background())
			defer cancel()
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil).WithContext(reqCtx)
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}

			type result struct {
				resp *http.Response
				err  error
			}
			done := make(chan result, 1)
			go func() {
				resp, err := tc.send(&cancelTestAdaptor{requestURL: upstream.URL}, c, info, strings.NewReader(`{}`))
				done <- result{resp: resp, err: err}
			}()

			<-started
			cancel()

			res := <-done
			if res.resp != nil && res.resp.Body != nil {
				_ = res.resp.Body.Close()
			}
			select {
			case <-upstreamCanceled:
			case <-time.After(time.Second):
				t.Fatal("upstream request context was not canceled when client canceled")
			}
			require.Error(t, res.err)
			var apiErr *types.NewAPIError
			require.ErrorAs(t, res.err, &apiErr)
			assert.Equal(t, types.ErrorCodeRequestCancelled, apiErr.GetErrorCode())
			assert.Equal(t, 499, apiErr.StatusCode)
			assert.True(t, types.IsSkipRetryError(apiErr))
			assert.NotContains(t, apiErr.ToOpenAIError().Message, upstream.URL)
		})
	}
}

func TestDoRequestUpstreamFailureRemainsDoRequestFailedWhenClientConnected(t *testing.T) {
	service.InitHttpClient()
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	upstreamURL := upstream.URL
	upstream.Close()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}

	_, err := DoApiRequest(&cancelTestAdaptor{requestURL: upstreamURL}, c, info, strings.NewReader(`{}`))
	require.Error(t, err)
	var apiErr *types.NewAPIError
	require.ErrorAs(t, err, &apiErr)
	assert.Equal(t, types.ErrorCodeDoRequestFailed, apiErr.GetErrorCode())
	assert.Equal(t, http.StatusInternalServerError, apiErr.StatusCode)
	assert.False(t, types.IsSkipRetryError(apiErr))
}

func TestDoWssRequestClientCancellationReturns499SkipRetry(t *testing.T) {
	gin.SetMode(gin.TestMode)
	started := make(chan struct{}, 1)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started <- struct{}{}
		select {
		case <-r.Context().Done():
		case <-time.After(300 * time.Millisecond):
			w.WriteHeader(http.StatusInternalServerError)
		}
	}))
	defer upstream.Close()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	reqCtx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/responses", nil).WithContext(reqCtx)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}

	errCh := make(chan error, 1)
	go func() {
		conn, err := DoWssRequest(&cancelTestAdaptor{requestURL: upstream.URL}, c, info, nil)
		if conn != nil {
			_ = conn.Close()
		}
		errCh <- err
	}()

	<-started
	cancel()

	err := <-errCh
	require.Error(t, err)
	var apiErr *types.NewAPIError
	require.True(t, errors.As(err, &apiErr))
	assert.Equal(t, types.ErrorCodeRequestCancelled, apiErr.GetErrorCode())
	assert.Equal(t, 499, apiErr.StatusCode)
	assert.True(t, types.IsSkipRetryError(apiErr))
}
