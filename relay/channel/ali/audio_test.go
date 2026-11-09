package ali

import (
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAliTTSRequest(t *testing.T) {
	for _, tc := range []struct {
		name, extra, voice, language string
		invalid                      bool
	}{
		{name: "automatic language", voice: "Cherry", language: "Auto"},
		{name: "English and default speed", extra: `,"language":"en","speed":1`, voice: "Cherry", language: "English"},
		{name: "native voice", extra: `,"voice":"Ethan","language":"Japanese"`, voice: "Ethan", language: "Japanese"},
		{name: "mapped male voice", extra: `,"voice":"echo"`, voice: "Ethan", language: "Auto"},
		{name: "mapped nova", extra: `,"voice":"nova"`, voice: "Chelsie", language: "Auto"},
		{name: "explicit PCM", extra: `,"response_format":"pcm","stream_format":"audio"`, voice: "Cherry", language: "Auto"},
		{name: "empty input", extra: `,"input":" "`, invalid: true},
		{name: "missing voice", extra: `,"voice":""`, invalid: true},
		{name: "invalid language", extra: `,"language":"xx"`, invalid: true},
		{name: "non-string language", extra: `,"language":false`, invalid: true},
		{name: "unsupported MP3", extra: `,"response_format":"mp3"`, invalid: true},
		{name: "unsupported SSE", extra: `,"stream_format":"sse"`, invalid: true},
		{name: "unsupported speed", extra: `,"speed":1.2`, invalid: true},
		{name: "explicit zero speed", extra: `,"speed":0`, invalid: true},
		{name: "unsupported instructions", extra: `,"instructions":"whisper"`, invalid: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var request dto.AudioRequest
			require.NoError(t, common.UnmarshalJsonStr(`{"model":"qwen3-tts-flash","input":"Hello 世界","voice":"alloy"`+tc.extra+`}`, &request))
			info := &relaycommon.RelayInfo{RelayMode: constant.RelayModeAudioSpeech}
			body, err := (&Adaptor{}).ConvertAudioRequest(nil, info, request)
			if tc.invalid {
				var apiErr *types.NewAPIError
				require.ErrorAs(t, err, &apiErr)
				assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
				assert.Nil(t, body)
				return
			}
			require.NoError(t, err)
			wire, err := io.ReadAll(body)
			require.NoError(t, err)
			assert.JSONEq(t, fmt.Sprintf(`{"model":"qwen3-tts-flash","input":{"text":"Hello 世界","voice":%q,"language_type":%q}}`, tc.voice, tc.language), string(wire))
		})
	}
	for _, n := range []int{600, 601} {
		_, err := convertOpenAITTSRequestToAli(dto.AudioRequest{Model: "qwen3-tts-flash", Input: strings.Repeat("中", n), Voice: "Cherry"})
		if n == 600 {
			require.NoError(t, err)
		} else {
			require.Error(t, err)
		}
	}
}

// Four PCM bytes representing two samples, in a standard 24 kHz mono WAV.
const aliTestWAVHex = "524946462800000057415645666d74201000000001000100c05d000080bb000002001000646174610400000000000100"

type aliTestBody struct {
	io.Reader
	fail, closed bool
}

func (b *aliTestBody) Read(p []byte) (int, error) {
	if b.fail {
		return 0, io.ErrUnexpectedEOF
	}
	return b.Reader.Read(p)
}

func (b *aliTestBody) Close() error { b.closed = true; return nil }

func TestAliTTSResponseAndBilling(t *testing.T) {
	wav, err := hex.DecodeString(aliTestWAVHex)
	require.NoError(t, err)
	for _, tc := range []struct {
		name, body, format string
		status, count      int
		fail               bool
	}{
		{name: "base64 to WAV", body: `{"output":{"audio":{"data":"AAABAA=="}},"usage":{"characters":17}}`, status: 200, count: 17},
		{name: "base64 to PCM", body: `{"output":{"audio":{"data":"AAABAA=="}},"usage":{"characters":17}}`, format: "pcm", status: 200, count: 17},
		{name: "missing usage uses actual characters", body: `{"output":{"audio":{"data":"AAABAA=="}}}`, status: 200, count: 2},
		{name: "negative usage uses actual characters", body: `{"output":{"audio":{"data":"AAABAA=="}},"usage":{"characters":-50}}`, status: 200, count: 2},
		{name: "huge count saturates", body: `{"output":{"audio":{"data":"AAABAA=="}},"usage":{"characters":9223372036854775807}}`, status: 200, count: common.MaxQuota},
		{name: "upstream rate limit", body: `{"error":{"message":"slow down","type":"rate_limit"}}`, status: 429},
		{name: "upstream unavailable", body: `gateway unavailable`, status: 503},
		{name: "invalid JSON", body: `broken`, status: 200},
		{name: "error envelope", body: `{"code":"InvalidParameter","message":"invalid voice"}`, status: 200},
		{name: "empty audio", body: `{"output":{"audio":{}}}`, status: 200},
		{name: "invalid base64", body: `{"output":{"audio":{"data":"???"}}}`, status: 200},
		{name: "incomplete sample", body: `{"output":{"audio":{"data":"AA=="}}}`, status: 200},
		{name: "read failure closes body", status: 200, fail: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/speech", nil)
			info := &relaycommon.RelayInfo{Request: &dto.AudioRequest{Input: "中文", ResponseFormat: tc.format}, RelayMode: constant.RelayModeAudioSpeech}
			info.SetEstimatePromptTokens(999)
			body := &aliTestBody{Reader: strings.NewReader(tc.body), fail: tc.fail}
			usage, apiErr := (&Adaptor{}).DoResponse(c, &http.Response{StatusCode: tc.status, Body: body, Header: http.Header{}}, info)
			assert.True(t, body.closed)
			if tc.count == 0 {
				require.NotNil(t, apiErr)
				assert.Nil(t, usage)
				assert.False(t, c.Writer.Written())
				if tc.status != 200 {
					assert.Equal(t, tc.status, apiErr.StatusCode)
				}
				return
			}
			require.Nil(t, apiErr)
			assert.Equal(t, &dto.Usage{PromptTokens: tc.count, TotalTokens: tc.count}, usage)
			if tc.format == "pcm" {
				assert.Equal(t, []byte{0, 0, 1, 0}, w.Body.Bytes())
				assert.Equal(t, "audio/pcm", w.Header().Get("Content-Type"))
			} else {
				assert.Equal(t, wav, w.Body.Bytes())
				assert.Equal(t, "audio/wav", w.Header().Get("Content-Type"))
			}
			if tc.count == common.MaxQuota {
				require.NotNil(t, info.QuotaClamp)
				assert.Equal(t, common.QuotaClampOverflow, info.QuotaClamp.Kind)
			}
		})
	}
}

func TestAliTTSAudioDownload(t *testing.T) {
	wav, err := hex.DecodeString(aliTestWAVHex)
	require.NoError(t, err)
	fetch := system_setting.GetFetchSetting()
	saved := *fetch
	t.Cleanup(func() { *fetch = saved; service.InitHttpClient() })
	*fetch = system_setting.FetchSetting{EnableSSRFProtection: true, AllowPrivateIp: true, AllowedPorts: []string{"1-65535"}}
	service.InitHttpClient()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Empty(t, r.Header.Get("Authorization"))
		switch r.URL.Path {
		case "/redirect":
			http.Redirect(w, r, "/audio", http.StatusFound)
		case "/audio":
			w.Header().Set("Content-Type", "audio/mpeg")
			_, _ = w.Write(wav)
		case "/broken":
			_, _ = w.Write([]byte("not audio"))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()
	for _, tc := range []struct {
		path, format     string
		block, wantError bool
	}{
		{path: "/audio"}, {path: "/redirect", format: "pcm"}, {path: "/broken", wantError: true},
		{path: "/missing", wantError: true}, {path: "/audio", block: true, wantError: true},
	} {
		t.Run(tc.path+tc.format+fmt.Sprint(tc.block), func(t *testing.T) {
			fetch.AllowPrivateIp = !tc.block
			body, err := common.Marshal(map[string]any{"output": map[string]any{"audio": map[string]string{"url": server.URL + tc.path}}, "usage": map[string]int{"characters": 4}})
			require.NoError(t, err)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/speech", nil)
			info := &relaycommon.RelayInfo{Request: &dto.AudioRequest{ResponseFormat: tc.format}}
			usage, apiErr := handleAliTTSResponse(c, &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(body)))}, info)
			if tc.wantError {
				require.NotNil(t, apiErr)
				assert.Nil(t, usage)
				assert.False(t, c.Writer.Written())
				return
			}
			require.Nil(t, apiErr)
			assert.Equal(t, 200, w.Code)
			assert.Empty(t, w.Header().Get("Location"))
			if tc.format == "pcm" {
				assert.Equal(t, []byte{0, 0, 1, 0}, w.Body.Bytes())
			} else {
				assert.Equal(t, wav, w.Body.Bytes())
			}
		})
	}
}

type aliTestBilling struct {
	reserved int
	targets  []int
	fail     bool
}

func (b *aliTestBilling) Settle(int) error         { return nil }
func (b *aliTestBilling) Refund(*gin.Context)      {}
func (b *aliTestBilling) NeedsRefund() bool        { return false }
func (b *aliTestBilling) GetPreConsumedQuota() int { return b.reserved }
func (b *aliTestBilling) Reserve(int) error        { return errors.New("realtime must check available funds") }
func (b *aliTestBilling) ReserveBeforeSubmit(target int) error {
	if b.fail {
		return errors.New("insufficient quota")
	}
	b.targets = append(b.targets, target)
	b.reserved = max(b.reserved, target)
	return nil
}

const aliTestRealtimeUsage = `{"total_tokens":377,"input_tokens":336,"output_tokens":41,"input_tokens_details":{"text_tokens":228,"audio_tokens":108},"output_tokens_details":{"text_tokens":9,"audio_tokens":32}}`

func TestAliRealtimeUsageAccounting(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	billing := &aliTestBilling{}
	info := &relaycommon.RelayInfo{OriginModelName: "voice-alias", Billing: billing, PriceData: hosttypes.PriceData{
		ModelRatio: 1, CompletionRatio: 3, AudioRatio: 2, AudioCompletionRatio: 4, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1},
	}}
	s := &aliRealtimeSession{info: info, responses: make(map[string]struct{}), toolCounts: make(map[string]int)}
	for _, id := range []string{"first", "first", "second"} {
		require.NoError(t, s.account(c, []byte(`{"type":"response.done","response":{"id":"`+id+`","status":"completed","usage":`+aliTestRealtimeUsage+`}}`)))
	}
	assert.Equal(t, []int{727, 1454}, billing.targets)
	assert.Equal(t, 1454, info.FinalPreConsumedQuota)
	assert.Equal(t, dto.RealtimeUsage{TotalTokens: 754, InputTokens: 672, OutputTokens: 82, InputTokenDetails: dto.InputTokenDetails{TextTokens: 456, AudioTokens: 216}, OutputTokenDetails: dto.OutputTokenDetails{TextTokens: 18, AudioTokens: 64}}, s.usage)
	require.NoError(t, s.account(c, []byte(`{"type":"response.done","response":{"id":"cancelled","status":"cancelled"}}`)))
	assert.Len(t, billing.targets, 2)
	for _, raw := range []string{
		`{"type":"response.done"}`,
		`{"type":"response.done","response":{"id":"missing","status":"completed"}}`,
		`{"type":"response.done","response":{"id":"negative","usage":{"input_tokens":-1}}}`,
		`{"type":"response.done","response":{"id":"huge","usage":{"input_tokens":9223372036854775807}}}`,
		`{"type":"response.done","response":{"id":"mismatch","usage":{"total_tokens":2,"input_tokens":1}}}`,
	} {
		require.Error(t, s.account(c, []byte(raw)))
		assert.Equal(t, 754, s.usage.TotalTokens)
	}
	billing.fail = true
	require.ErrorContains(t, s.account(c, []byte(`{"type":"response.done","response":{"id":"unfunded","usage":`+aliTestRealtimeUsage+`}}`)), "insufficient quota")
	assert.Equal(t, 1131, s.usage.TotalTokens, "completed turns must remain billable when the next reservation fails")
}

func TestAliRealtimeEventValidation(t *testing.T) {
	for _, raw := range []string{
		`{"type":"session.update","session":{"turn_detection":null,"speech_rate":0.5,"enable_speech_emotion":false,"tools":[{"type":"function","function":{"name":"weather"}}]}}`,
		`{"type":"session.update","session":{"input_audio_format":"pcm","output_audio_format":"pcm","speech_rate":2}}`,
		`{"type":"response.create","response":{"max_response_output_tokens":1024}}`,
		`{"type":"input_audio_buffer.append","audio":"AAABAA=="}`,
		`{"type":"conversation.item.create","item":{"type":"function_call_output","call_id":"a","output":"sunny"}}`,
	} {
		require.NoError(t, validateAliRealtimeEvent([]byte(raw)), raw)
	}
	for _, raw := range []string{
		`null`, `not JSON`, `{}`,
		`{"type":"session.update","session":{"model":"expensive-other-model"}}`,
		`{"type":"session.update","session":{"input_audio_format":"pcm16"}}`,
		`{"type":"session.update","session":{"speech_rate":0}}`,
		`{"type":"session.update","session":{"max_response_output_tokens":18446744073709551615}}`,
		`{"type":"response.create","response":{"max_output_tokens":-1}}`,
	} {
		require.Error(t, validateAliRealtimeEvent([]byte(raw)), raw)
	}
}

func TestAliRealtimeSearchUsage(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{Billing: &aliTestBilling{}}
	s := &aliRealtimeSession{info: info, responses: make(map[string]struct{}), toolCounts: make(map[string]int)}
	for _, event := range []string{
		`{"type":"response.done","response":{"id":"one","usage":{"plugins":{"search":{"count":2,"strategy":"turbo"}}}}}`,
		`{"type":"response.done","response":{"id":"one","usage":{"plugins":{"search":{"count":2,"strategy":"turbo"}}}}}`,
		`{"type":"response.done","response":{"id":"two","usage":{},"plugins":{"search":{"count":1,"strategy":"turbo"}}}}`,
	} {
		require.NoError(t, s.account(c, []byte(event)))
	}
	require.NotNil(t, info.ResponsesUsageInfo)
	assert.Equal(t, 3, info.ResponsesUsageInfo.BuiltInTools["search_strategy_turbo"].CallCount)
	for _, search := range []string{`{"count":-1,"strategy":"turbo"}`, `{"count":9223372036854775807,"strategy":"turbo"}`, `{"count":1,"strategy":"unknown"}`} {
		require.Error(t, s.account(c, []byte(`{"type":"response.done","response":{"id":"invalid","usage":{"plugins":{"search":`+search+`}}}}`)))
		assert.Equal(t, 3, info.ResponsesUsageInfo.BuiltInTools["search_strategy_turbo"].CallCount)
	}
}

func TestAliRealtimeWebsocketRelay(t *testing.T) {
	upgrader := websocket.Upgrader{}
	clientEvent := `{"type":"session.update","session":{"input_audio_format":"pcm","output_audio_format":"pcm","turn_detection":{"type":"smart_turn_v2"},"enable_speech_emotion":false,"future":{"preserve":0}}}`
	serverEvents := []string{
		`{"type":"session.created","session":{"id":"session1","input_audio_format":"pcm"}}`,
		`{"type":"response.audio.delta","delta":"AAABAA==","future":false}`,
		`{"type":"response.done","response":{"id":"cancelled","status":"cancelled"}}`,
		`{"type":"response.done","response":{"id":"done1","status":"completed","usage":` + aliTestRealtimeUsage + `}}`,
	}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api-ws/v1/realtime", r.URL.Path)
		assert.Equal(t, "qwen-audio-3.1-realtime-plus", r.URL.Query().Get("model"))
		assert.Equal(t, "Bearer upstream-test-key", r.Header.Get("Authorization"))
		assert.Empty(t, r.Header.Get("X-DashScope-SSE"))
		conn, err := upgrader.Upgrade(w, r, nil)
		if !assert.NoError(t, err) {
			return
		}
		defer conn.Close()
		_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
		_, received, err := conn.ReadMessage()
		if !assert.NoError(t, err) {
			return
		}
		assert.Equal(t, clientEvent, string(received))
		for _, event := range serverEvents {
			if !assert.NoError(t, conn.WriteMessage(websocket.TextMessage, []byte(event))) {
				return
			}
		}
		_, _, _ = conn.ReadMessage()
	}))
	defer upstream.Close()
	type result struct {
		usage   any
		err     *types.NewAPIError
		targets []int
	}
	finished := make(chan result, 1)
	gateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		client, err := upgrader.Upgrade(w, r, nil)
		if !assert.NoError(t, err) {
			return
		}
		defer client.Close()
		c, _ := gin.CreateTestContext(w)
		c.Request = r
		c.Set("model_mapping", `{"voice-alias":"qwen-audio-3.1-realtime-plus"}`)
		billing := &aliTestBilling{}
		info := &relaycommon.RelayInfo{ClientWs: client, IsStream: true, OriginModelName: "voice-alias", RelayMode: constant.RelayModeRealtime,
			ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: upstream.URL, UpstreamModelName: "voice-alias", ApiKey: "upstream-test-key"},
			Billing:     billing, PriceData: hosttypes.PriceData{ModelRatio: 1, CompletionRatio: 3, AudioRatio: 2, AudioCompletionRatio: 4, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}},
		}
		adaptor := &Adaptor{}
		target, err := adaptor.DoRequest(c, info, nil)
		if !assert.NoError(t, err) {
			return
		}
		info.TargetWs = target.(*websocket.Conn)
		usage, apiErr := adaptor.DoResponse(c, nil, info)
		finished <- result{usage: usage, err: apiErr, targets: billing.targets}
	}))
	defer gateway.Close()
	client, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(gateway.URL, "http"), nil)
	require.NoError(t, err)
	defer client.Close()
	_ = client.SetReadDeadline(time.Now().Add(5 * time.Second))
	require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(`{"type":"session.update","session":{"speech_rate":0}}`)))
	_, invalid, err := client.ReadMessage()
	require.NoError(t, err)
	var validationEvent dto.RealtimeEvent
	require.NoError(t, common.Unmarshal(invalid, &validationEvent))
	assert.Equal(t, "error", validationEvent.Type)
	require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(clientEvent)))
	for _, event := range serverEvents {
		_, received, err := client.ReadMessage()
		require.NoError(t, err)
		assert.Equal(t, event, string(received))
	}
	require.NoError(t, client.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(time.Second)))
	select {
	case got := <-finished:
		require.Nil(t, got.err)
		assert.Equal(t, 377, got.usage.(*dto.RealtimeUsage).TotalTokens)
		assert.Equal(t, []int{727}, got.targets)
	case <-time.After(5 * time.Second):
		t.Fatal("realtime relay did not stop after disconnect")
	}
}

func TestAliRealtimeHandshakeAndURL(t *testing.T) {
	for _, base := range []string{"https://dashscope.aliyuncs.com", "https://workspace.cn-beijing.maas.aliyuncs.com/", "wss://workspace.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime"} {
		info := &relaycommon.RelayInfo{RelayMode: constant.RelayModeRealtime, ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: base, UpstreamModelName: "qwen & model"}}
		endpoint, err := (&Adaptor{}).GetRequestURL(info)
		require.NoError(t, err)
		assert.Contains(t, endpoint, "/api-ws/v1/realtime?model=qwen+%26+model")
		assert.Equal(t, base, info.ChannelBaseUrl)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusTooManyRequests) }))
	defer server.Close()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/realtime", nil)
	info := &relaycommon.RelayInfo{RelayMode: constant.RelayModeRealtime, ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: server.URL}}
	_, err := (&Adaptor{}).DoRequest(c, info, nil)
	var apiErr *types.NewAPIError
	require.ErrorAs(t, err, &apiErr)
	assert.Equal(t, 429, apiErr.StatusCode)
}

func TestAliRealtimeUsageSaturation(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{Billing: &aliTestBilling{}}
	s := &aliRealtimeSession{info: info, usage: dto.RealtimeUsage{TotalTokens: math.MaxInt32 - 1, InputTokens: math.MaxInt32 - 1, InputTokenDetails: dto.InputTokenDetails{TextTokens: math.MaxInt32 - 1}}, responses: make(map[string]struct{}), toolCounts: make(map[string]int)}
	err := s.account(c, []byte(`{"type":"response.done","response":{"id":"overflow","usage":`+aliTestRealtimeUsage+`}}`))
	require.Error(t, err)
	require.NotNil(t, info.QuotaClamp)
	assert.Equal(t, common.MaxQuota, s.usage.TotalTokens)
	assert.GreaterOrEqual(t, s.usage.OutputTokens, 0)
}
