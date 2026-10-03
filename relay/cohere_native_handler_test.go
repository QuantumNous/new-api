package relay

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel/cohere"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCohereNativePathBodyAndQuery(t *testing.T) {
	service.InitHttpClient()
	t.Cleanup(service.GetHttpClient().CloseIdleConnections)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v2/embed", r.URL.Path)
		require.Equal(t, "tag=original", r.URL.RawQuery)
		require.Equal(t, "Bearer upstream-key", r.Header.Get("Authorization"))
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		require.JSONEq(t, `{"model":"embed-v4.0","texts":["hello"],"input_type":"search_query","output_dimension":256}`, string(body))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"embeddings":{"float":[[1,2]]}}`))
	}))
	defer upstream.Close()

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v2/embed?tag=original", strings.NewReader(`{"model":"embed-v4.0","texts":["hello"],"input_type":"search_query","output_dimension":256}`))
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeCohereNative, RequestURLPath: c.Request.URL.String(), ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: upstream.URL, ApiKey: "upstream-key"}}
	adaptor := &cohere.Adaptor{}
	body, _, err := relaycommon.PassThroughRequestBody(c, info)
	require.NoError(t, err)
	response, err := adaptor.DoRequest(c, info, body)
	require.NoError(t, err)
	resp := response.(*http.Response)
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.JSONEq(t, `{"embeddings":{"float":[[1,2]]}}`, string(data))
}

func TestCohereNativeUsageAndExactSSE(t *testing.T) {
	chat := cohereNativeUsage([]byte(`{"usage":{"tokens":{"input_tokens":12,"output_tokens":4}}}`), "/v2/chat")
	require.Equal(t, 16, chat.TotalTokens)
	embed := cohereNativeUsage([]byte(`{"meta":{"billed_units":{"input_tokens":7}}}`), "/v2/embed")
	require.Equal(t, 7, embed.PromptTokens)

	wire := "event: message-end\r\ndata: {\"type\":\"message-end\",\"delta\":{\"usage\":{\"tokens\":{\"input_tokens\":9,\"output_tokens\":3}}}}\r\n\r\n"
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	usage, err := copyCohereNativeStream(c, strings.NewReader(wire))
	require.NoError(t, err)
	require.Equal(t, wire, recorder.Body.String())
	require.Equal(t, 12, usage.TotalTokens)
}

func TestCohereNativeRejectsOtherChannels(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v2/chat", nil)
	info := &relaycommon.RelayInfo{Request: &dto.CohereNativeRequest{Model: "command-a"}}
	require.NotNil(t, CohereNativeHelper(c, info))
}
