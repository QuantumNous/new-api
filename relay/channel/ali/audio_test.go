package ali

import (
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
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

// TestAliTTSRequest covers supported native fields and rejects unsupported
// codecs, controls and invalid text before an upstream request can be billed.
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
		{name: "implicit MP3", extra: `,"response_format":""`, invalid: true},
		{name: "unsupported SSE", extra: `,"stream_format":"sse"`, invalid: true},
		{name: "unsupported speed", extra: `,"speed":1.2`, invalid: true},
		{name: "explicit zero speed", extra: `,"speed":0`, invalid: true},
		{name: "unsupported instructions", extra: `,"instructions":"whisper"`, invalid: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var request dto.AudioRequest
			require.NoError(t, common.UnmarshalJsonStr(`{"model":"qwen3-tts-flash","input":"Hello 世界","voice":"alloy","response_format":"wav"`+tc.extra+`}`, &request))
			info := &relaycommon.RelayInfo{RelayMode: constant.RelayModeAudioSpeech, OriginModelName: request.Model, Request: &request}
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
		_, err := convertOpenAITTSRequestToAli(dto.AudioRequest{Model: "qwen3-tts-flash", Input: strings.Repeat("中", n), Voice: "Cherry", ResponseFormat: "wav"})
		if n == 600 {
			require.NoError(t, err)
		} else {
			require.Error(t, err)
		}
	}
}

// TestAliTTSBillingUnits prevents character quantities from being charged as
// tokens when channel mapping selects a Qwen TTS upstream.
func TestAliTTSBillingUnits(t *testing.T) {
	for _, tc := range []struct {
		name, alias, billingName, expr string
		perRequest, invalid            bool
	}{
		{name: "native character ratio", alias: "qwen3-tts-flash"},
		{name: "OpenAI character ratio", alias: "tts-1-hd"},
		{name: "resolved character ratio", alias: "qwen3-tts-flash@thinking:off", billingName: "qwen3-tts-flash"},
		{name: "non-GPT token alias", alias: "o1@thinking:off", billingName: "o1", invalid: true},
		{name: "custom alias with unknown unit", alias: "voice-alias", invalid: true},
		{name: "custom fixed price", alias: "voice-alias", perRequest: true},
		{name: "tokenized alias", alias: "gpt-4o-mini-tts", invalid: true},
		{name: "token expression", alias: "qwen3-tts-flash", expr: `tier("tokens", p * 2 + ao * 10)`, invalid: true},
		{name: "fixed alias", alias: "gpt-4o-mini-tts", perRequest: true},
		{name: "fixed expression", alias: "gpt-4o-mini-tts", expr: `tier("request", fixed(0.01))`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{RelayMode: constant.RelayModeAudioSpeech,
				OriginModelName: tc.alias, BillingModelName: tc.billingName, Request: &dto.AudioRequest{Model: tc.alias},
				PriceData: hosttypes.PriceData{UsePrice: tc.perRequest}}
			if tc.expr != "" {
				info.TieredBillingSnapshot = &billingexpr.BillingSnapshot{ExprString: tc.expr, ExprHash: billingexpr.ExprHashString(tc.expr)}
			}
			body, err := (&Adaptor{}).ConvertAudioRequest(nil, info, dto.AudioRequest{Model: "qwen3-tts-flash", Voice: "Cherry", Input: "你好", ResponseFormat: "wav"})
			if tc.invalid {
				var apiErr *types.NewAPIError
				require.ErrorAs(t, err, &apiErr)
				assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
				assert.Nil(t, body, "reject before an upstream request is made")
			} else {
				require.NoError(t, err)
				require.NotNil(t, body)
			}
		})
	}
}

// Four PCM bytes representing two samples, in a standard 24 kHz mono WAV.
const aliTestWAVHex = "524946462800000057415645666d74201000000001000100c05d000080bb000002001000646174610400000000000100"

type aliTestBody struct {
	io.Reader
	fail, closed bool
}

// Read simulates a broken upstream body as well as normal audio delivery.
func (b *aliTestBody) Read(p []byte) (int, error) {
	if b.fail {
		return 0, io.ErrUnexpectedEOF
	}
	return b.Reader.Read(p)
}

func (b *aliTestBody) Close() error { b.closed = true; return nil }

// TestAliTTSResponseAndBilling checks decoded audio, character accounting and
// failure handling before a successful binary response is committed.
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

// TestAliTTSAudioDownload rejects unsafe URLs and redirects without forwarding
// channel credentials or contacting forbidden destinations.
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
	t.Run("redirect destination is validated", func(t *testing.T) {
		var received atomic.Int32
		forbidden := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			received.Add(1)
			_, _ = w.Write(wav)
		}))
		defer forbidden.Close()
		allowed := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, forbidden.URL, http.StatusFound)
		}))
		defer allowed.Close()
		endpoint, err := url.Parse(allowed.URL)
		require.NoError(t, err)
		fetch.AllowPrivateIp = true
		fetch.AllowedPorts = []string{endpoint.Port()}
		body, err := common.Marshal(map[string]any{"output": map[string]any{"audio": map[string]string{"url": allowed.URL}}})
		require.NoError(t, err)
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/speech", nil)
		_, apiErr := handleAliTTSResponse(c, &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(body)))}, &relaycommon.RelayInfo{})
		require.NotNil(t, apiErr)
		assert.Zero(t, received.Load(), "the forbidden redirect must not receive a request")
	})
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

// ReserveBeforeSubmit records the cumulative target or simulates depleted funds.
func (b *aliTestBilling) ReserveBeforeSubmit(target int) error {
	if b.fail {
		return errors.New("insufficient quota")
	}
	b.targets = append(b.targets, target)
	b.reserved = max(b.reserved, target)
	return nil
}

const aliTestRealtimeUsage = `{"total_tokens":377,"input_tokens":336,"output_tokens":41,"input_tokens_details":{"text_tokens":228,"audio_tokens":108},"output_tokens_details":{"text_tokens":9,"audio_tokens":32}}`

// TestAliRealtimeUsageAccounting deduplicates completed responses, preserves
// usage on reservation failure, and excludes only audio's companion text.
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
	assert.Equal(t, []int{700, 1400}, billing.targets)
	assert.Equal(t, 1400, info.FinalPreConsumedQuota)
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
	billing.fail = false
	require.NoError(t, s.account(c, []byte(`{"type":"response.done","response":{"id":"text-only","usage":{"total_tokens":60,"input_tokens":30,"output_tokens":30,"input_tokens_details":{"text_tokens":30},"output_tokens_details":{"text_tokens":30}}}}`)))
	assert.Equal(t, 2220, info.FinalPreConsumedQuota, "text-only output is charged even in a session with earlier audio output")
	assert.Equal(t, 1191, s.usage.TotalTokens, "raw usage retains the companion text for logs")
}

// TestAliRealtimeEventValidation bounds client billing quantities and enforces
// native sample-rate requirements without dropping valid extension fields.
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

// TestAliRealtimeResponseTiers uses each turn's context length and excludes
// companion text before pricing, while duplicated terminal events stay free.
func TestAliRealtimeResponseTiers(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	expression := `len <= 400 ? tier("short", p * 2 + ai * 10 + c * 4 + ao * 20) : tier("long", p * 100 + ai * 100 + c * 100 + ao * 100)`
	billing := &aliTestBilling{}
	info := &relaycommon.RelayInfo{Billing: billing,
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{BillingMode: "tiered_expr", ExprString: expression,
			ExprHash: billingexpr.ExprHashString(expression), GroupRatio: 1, QuotaPerUnit: common.QuotaPerUnit}}
	s := &aliRealtimeSession{info: info, responses: make(map[string]struct{}), toolCounts: make(map[string]int)}
	for _, id := range []string{"first", "first", "second"} {
		require.NoError(t, s.account(c, []byte(`{"type":"response.done","response":{"id":"`+id+`","usage":`+aliTestRealtimeUsage+`}}`)))
	}
	assert.Equal(t, []int{1088, 2176}, billing.targets)
	assert.Equal(t, 754, s.usage.TotalTokens)
	assert.Equal(t, 672, s.usage.InputTokens, "cumulative context is retained for logs, not tier selection")
	require.Len(t, info.RealtimeBilling.ResponseBilling.Turns, 2)
	for _, turn := range info.RealtimeBilling.ResponseBilling.Turns {
		assert.Equal(t, "short", turn.Pricing.MatchedTier)
		assert.Zero(t, turn.Usage.OutputTokenDetails.TextTokens)
	}
}

// TestAliRealtimeSearchUsage accumulates the provider's supported search
// strategies and rejects unknown strategies or unsafe call counts.
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
	for i, search := range []string{`{"count":-1,"strategy":"turbo"}`, `{"count":9223372036854775807,"strategy":"turbo"}`, `{"count":1,"strategy":"unknown"}`} {
		require.Error(t, s.account(c, []byte(fmt.Sprintf(`{"type":"response.done","response":{"id":"invalid%d","usage":{"plugins":{"search":%s}}}}`, i, search))))
		assert.Equal(t, 3, info.ResponsesUsageInfo.BuiltInTools["search_strategy_turbo"].CallCount)
	}
}

// TestAliRealtimeWebsocketRelay exercises mapping, authentication, validation,
// event forwarding and cumulative reservations through real local sockets.
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
		assert.Equal(t, []int{700}, got.targets)
	case <-time.After(5 * time.Second):
		require.FailNow(t, "realtime relay did not stop after disconnect")
	}
}

// TestAliRealtimeHandshakeAndURL preserves configured endpoints and exposes
// upstream handshake status codes such as rate limiting to the caller.
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

// TestAliRealtimeUsageSaturation keeps cumulative quantities nonnegative and
// auditable when an upstream session exceeds the supported quota range.
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

// TestAliRealtimePCMOutputCompatibility preserves extension fields while
// translating only the compatible 24 kHz output codec label.
func TestAliRealtimePCMOutputCompatibility(t *testing.T) {
	s := &aliRealtimeSession{outputPCM16: true}
	client := []byte(`{"type":"session.update","session":{"input_audio_format":"pcm","output_audio_format":"pcm16","future":{"n":9007199254740993,"enabled":false}}}`)
	forwarded, err := s.translateFormats(client, false)
	require.NoError(t, err)
	require.NoError(t, validateAliRealtimeEvent(forwarded))
	assert.JSONEq(t, `{"type":"session.update","session":{"input_audio_format":"pcm","output_audio_format":"pcm","future":{"n":9007199254740993,"enabled":false}}}`, string(forwarded))
	var decoded struct {
		Session struct {
			Future struct {
				N int64 `json:"n"`
			} `json:"future"`
		} `json:"session"`
	}
	require.NoError(t, common.Unmarshal(forwarded, &decoded))
	assert.Equal(t, int64(9007199254740993), decoded.Session.Future.N)
	server, err := s.translateFormats([]byte(`{"type":"session.updated","session":{"output_audio_format":"pcm","future":0}}`), true)
	require.NoError(t, err)
	assert.JSONEq(t, `{"type":"session.updated","session":{"output_audio_format":"pcm16","future":0}}`, string(server))
	wrongRate, err := s.translateFormats([]byte(`{"type":"session.update","session":{"input_audio_format":"pcm16","output_audio_format":"pcm16"}}`), false)
	require.NoError(t, err)
	require.ErrorContains(t, validateAliRealtimeEvent(wrongRate), "16 kHz input")
}

// TestAliRealtimeSearchLimitKeepsCompletedUsage prevents an invalid plugin
// counter from discarding already validated audio and text usage.
func TestAliRealtimeSearchLimitKeepsCompletedUsage(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{Billing: &aliTestBilling{}}
	s := &aliRealtimeSession{info: info, responses: make(map[string]struct{}), toolCounts: map[string]int{"search_strategy_turbo": relaycommon.MaxBillableToolCallCount}}
	usage := strings.TrimSuffix(aliTestRealtimeUsage, "}") + `,"plugins":{"search":{"count":1,"strategy":"turbo"}}}`
	require.ErrorContains(t, s.account(c, []byte(`{"type":"response.done","response":{"id":"last","usage":`+usage+`}}`)), "search count")
	assert.Equal(t, 377, s.usage.TotalTokens)
	assert.Equal(t, 108, s.usage.InputTokenDetails.AudioTokens)
	assert.Equal(t, 32, s.usage.OutputTokenDetails.AudioTokens)
}

type aliRealtimeResult struct {
	usage *dto.RealtimeUsage
	info  *relaycommon.RelayInfo
	err   *types.NewAPIError
}

// aliRealtimeFixture connects real local WebSocket peers so timeout, close and
// final-usage tests exercise network lifecycle rather than mocked readers.
func aliRealtimeFixture(t *testing.T, upstreamHandler func(*websocket.Conn), timeouts aliRealtimeTimeouts) (*websocket.Conn, <-chan aliRealtimeResult) {
	t.Helper()
	upgrader := websocket.Upgrader{}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		require.NoError(t, err)
		defer conn.Close()
		upstreamHandler(conn)
	}))
	t.Cleanup(upstream.Close)
	finished := make(chan aliRealtimeResult, 1)
	gateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		client, err := upgrader.Upgrade(w, r, nil)
		require.NoError(t, err)
		defer client.Close()
		target, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(upstream.URL, "http"), nil)
		require.NoError(t, err)
		defer target.Close()
		c, _ := gin.CreateTestContext(w)
		c.Request = r
		info := &relaycommon.RelayInfo{ClientWs: client, TargetWs: target, Billing: &aliTestBilling{},
			FinalPreConsumedQuota: 100, PriceData: hosttypes.PriceData{ModelRatio: 1, CompletionRatio: 3, AudioRatio: 2, AudioCompletionRatio: 4, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}}}
		usage, apiErr := relayAliRealtime(c, info, timeouts)
		finished <- aliRealtimeResult{usage: usage.(*dto.RealtimeUsage), info: info, err: apiErr}
	}))
	t.Cleanup(gateway.Close)
	client, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(gateway.URL, "http"), nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = client.Close() })
	_ = client.SetReadDeadline(time.Now().Add(5 * time.Second))
	return client, finished
}

// TestAliRealtimeDisconnectReconciliation holds the terminal event until the
// relay probes the upstream after losing its client, exposing premature closes.
func TestAliRealtimeDisconnectReconciliation(t *testing.T) {
	for _, terminal := range []string{"valid", "missing", "malformed"} {
		t.Run(terminal, func(t *testing.T) {
			client, finished := aliRealtimeFixture(t, func(upstream *websocket.Conn) {
				upstream.SetPingHandler(func(data string) error {
					if terminal == "valid" {
						return upstream.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.done","response":{"id":"last","usage":`+aliTestRealtimeUsage+`}}`))
					}
					if terminal == "malformed" {
						return upstream.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.done","response":{"id":"last","usage":{"input_tokens":-1}}}`))
					}
					return upstream.WriteControl(websocket.PongMessage, []byte(data), time.Now().Add(time.Second))
				})
				require.NoError(t, upstream.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.created","response":{"id":"last"}}`)))
				require.NoError(t, upstream.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.audio.delta","delta":"AAABAA=="}`)))
				_, _, _ = upstream.ReadMessage()
			}, aliRealtimeTimeouts{time.Second, 3 * time.Second, 50 * time.Millisecond})
			for range 2 {
				_, _, err := client.ReadMessage()
				require.NoError(t, err)
			}
			require.NoError(t, client.Close())
			select {
			case result := <-finished:
				require.Nil(t, result.err)
				if terminal == "valid" {
					assert.Equal(t, 377, result.usage.TotalTokens)
					assert.Equal(t, 700, result.info.FinalPreConsumedQuota)
					assert.False(t, result.info.RealtimeBilling.UsageIncomplete)
				} else {
					assert.True(t, result.info.RealtimeBilling.UsageIncomplete)
					assert.Equal(t, 100, result.info.FinalPreConsumedQuota)
				}
			case <-time.After(5 * time.Second):
				require.FailNow(t, "relay did not complete bounded usage reconciliation")
			}
		})
	}
}

// TestAliRealtimeHeartbeatAndCloseStatus detects silent clients and preserves
// the upstream close reason instead of exposing an abnormal 1006 close.
func TestAliRealtimeHeartbeatAndCloseStatus(t *testing.T) {
	t.Run("silent client", func(t *testing.T) {
		_, finished := aliRealtimeFixture(t, func(upstream *websocket.Conn) {
			_, _, _ = upstream.ReadMessage()
		}, aliRealtimeTimeouts{10 * time.Millisecond, 50 * time.Millisecond, 50 * time.Millisecond})
		// No client reader is running, so Gorilla cannot answer incoming pings.
		select {
		case result := <-finished:
			require.Nil(t, result.err)
			assert.Zero(t, result.usage.TotalTokens)
			assert.False(t, result.info.RealtimeBilling.UsageIncomplete)
		case <-time.After(5 * time.Second):
			require.FailNow(t, "silent client was not disconnected")
		}
	})
	t.Run("upstream close code", func(t *testing.T) {
		client, finished := aliRealtimeFixture(t, func(upstream *websocket.Conn) {
			require.NoError(t, upstream.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "session expired"), time.Now().Add(time.Second)))
			_, _, _ = upstream.ReadMessage()
		}, aliRealtimeTimeouts{time.Second, 3 * time.Second, 50 * time.Millisecond})
		_, _, err := client.ReadMessage()
		var closed *websocket.CloseError
		require.ErrorAs(t, err, &closed)
		assert.Equal(t, websocket.ClosePolicyViolation, closed.Code)
		assert.Equal(t, "session expired", closed.Text)
		select {
		case <-finished:
		case <-time.After(5 * time.Second):
			require.FailNow(t, "relay did not stop after upstream close")
		}
	})
}

// TestAliRealtimeLaterTurnSurvivesDisconnect reconciles B even when its input
// precedes A's terminal event and B's response.created has not arrived yet.
func TestAliRealtimeLaterTurnSurvivesDisconnect(t *testing.T) {
	client, finished := aliRealtimeFixture(t, func(upstream *websocket.Conn) {
		require.NoError(t, upstream.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.created","response":{"id":"first"}}`)))
		_, input, err := upstream.ReadMessage()
		require.NoError(t, err)
		assert.Contains(t, string(input), "input_audio_buffer.append")
		require.NoError(t, upstream.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.done","response":{"id":"first","usage":`+aliTestRealtimeUsage+`}}`)))
		upstream.SetPingHandler(func(string) error {
			if err := upstream.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.created","response":{"id":"second"}}`)); err != nil {
				return err
			}
			return upstream.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.done","response":{"id":"second","usage":`+aliTestRealtimeUsage+`}}`))
		})
		_, _, _ = upstream.ReadMessage()
	}, aliRealtimeTimeouts{time.Second, 3 * time.Second, time.Second})
	_, _, err := client.ReadMessage()
	require.NoError(t, err)
	require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(`{"type":"input_audio_buffer.append","audio":"AAABAA=="}`)))
	_, _, err = client.ReadMessage()
	require.NoError(t, err)
	require.NoError(t, client.Close())
	select {
	case result := <-finished:
		require.Nil(t, result.err)
		assert.Equal(t, 754, result.usage.TotalTokens)
		assert.Equal(t, 1400, result.info.FinalPreConsumedQuota)
		assert.False(t, result.info.RealtimeBilling.UsageIncomplete)
	case <-time.After(5 * time.Second):
		require.FailNow(t, "later turn was not reconciled after disconnect")
	}
}

// TestAliRealtimeManualAudioDoesNotStartInference keeps cleared or committed
// push-to-talk audio refundable until the client explicitly requests inference.
func TestAliRealtimeManualAudioDoesNotStartInference(t *testing.T) {
	for _, action := range []string{"clear", "commit"} {
		t.Run(action, func(t *testing.T) {
			client, finished := aliRealtimeFixture(t, func(upstream *websocket.Conn) {
				for range 3 {
					_, _, err := upstream.ReadMessage()
					require.NoError(t, err)
				}
				ack := "cleared"
				if action == "commit" {
					ack = "committed"
				}
				require.NoError(t, upstream.WriteMessage(websocket.TextMessage, []byte(`{"type":"input_audio_buffer.`+ack+`"}`)))
				_, _, _ = upstream.ReadMessage()
			}, aliRealtimeTimeouts{time.Second, 3 * time.Second, 50 * time.Millisecond})
			for _, message := range []string{
				`{"type":"session.update","session":{"turn_detection":null}}`,
				`{"type":"input_audio_buffer.append","audio":"AAABAA=="}`,
				`{"type":"input_audio_buffer.` + action + `"}`,
			} {
				require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(message)))
			}
			_, _, err := client.ReadMessage()
			require.NoError(t, err)
			require.NoError(t, client.Close())
			select {
			case result := <-finished:
				require.Nil(t, result.err)
				assert.Zero(t, result.usage.TotalTokens)
				assert.False(t, result.info.RealtimeBilling.UsageIncomplete)
			case <-time.After(5 * time.Second):
				require.FailNow(t, "unused manual audio session did not close")
			}
		})
	}
}

// TestAliRealtimeVADReconciliation distinguishes silence and invalid turns
// from confirmed speech, including VAD events that arrive after disconnect.
func TestAliRealtimeVADReconciliation(t *testing.T) {
	started := `{"type":"input_audio_buffer.speech_started","item_id":"speech"}`
	stopped := `{"type":"input_audio_buffer.speech_stopped","item_id":"speech"}`
	completed := []string{
		`{"type":"response.created","response":{"id":"last"}}`,
		`{"type":"response.done","response":{"id":"last","usage":` + aliTestRealtimeUsage + `}}`,
	}
	for _, tc := range []struct {
		name          string
		before, after []string
		tokens        int
		incomplete    bool
	}{
		{name: "silence"},
		{name: "invalid smart turn", before: []string{started, `{"type":"input_audio_buffer.speech_stopped","item_id":"speech","reason":"turn_invalid"}`}},
		{name: "valid stopped turn", before: []string{started, stopped}, after: completed, tokens: 377},
		{name: "confirmed speech missing usage", before: []string{started, stopped}, incomplete: true},
		{name: "delayed speech confirmation", after: append([]string{started, stopped}, completed...), tokens: 377},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client, finished := aliRealtimeFixture(t, func(upstream *websocket.Conn) {
				_, _, err := upstream.ReadMessage()
				require.NoError(t, err)
				for _, event := range tc.before {
					require.NoError(t, upstream.WriteMessage(websocket.TextMessage, []byte(event)))
				}
				// Acknowledge receipt without claiming that silence triggered speech.
				require.NoError(t, upstream.WriteMessage(websocket.TextMessage, []byte(`{"type":"session.updated","session":{}}`)))
				upstream.SetPingHandler(func(string) error {
					for _, event := range tc.after {
						if err := upstream.WriteMessage(websocket.TextMessage, []byte(event)); err != nil {
							return err
						}
					}
					return nil
				})
				_, _, _ = upstream.ReadMessage()
			}, aliRealtimeTimeouts{time.Second, 3 * time.Second, 50 * time.Millisecond})
			require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(`{"type":"input_audio_buffer.append","audio":"AAAAAA=="}`)))
			for range len(tc.before) + 1 {
				_, _, err := client.ReadMessage()
				require.NoError(t, err)
			}
			require.NoError(t, client.Close())
			select {
			case result := <-finished:
				require.Nil(t, result.err)
				assert.Equal(t, tc.tokens, result.usage.TotalTokens)
				assert.Equal(t, tc.incomplete, result.info.RealtimeBilling.UsageIncomplete)
				if tc.tokens != 0 {
					assert.Equal(t, 700, result.info.FinalPreConsumedQuota)
				}
			case <-time.After(5 * time.Second):
				require.FailNow(t, "VAD session did not finish reconciliation")
			}
		})
	}
}
