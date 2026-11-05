package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// Supplier behaviour of a fake upstream. Every fake deliberately leaks supplier
// traces in headers, body fields and error texts, so a test that reads the
// customer response proves the masking instead of trusting it.
type hwFakeMode int

const (
	hwFakeOK hwFakeMode = iota
	hwFakeTimeout
	hwFakeStatus500
	hwFakeStatus429
	hwFakeCutStream
	hwFakeCutEarly
	hwFakeEmptyStream
)

// hwFakeSupplier is one upstream supplier double. It answers both the OpenAI and
// the Anthropic wire format, counts calls per API family and can be switched
// between modes while a test runs.
type hwFakeSupplier struct {
	label  string
	server *httptest.Server

	mu     sync.Mutex
	order  *hwCallOrder
	mode   hwFakeMode
	calls  int
	chat   int
	claude int
	// toolCall makes the next answer carry a tool call / tool_use block.
	toolCall bool
	// leakField adds a field the structural masking does not know about, so a
	// test can prove the last-resort word scan works on its own.
	leakField bool
}

// hwCallOrder records which supplier answered in which sequence, so a test can
// prove the routing order instead of only counting calls.
type hwCallOrder struct {
	mu      sync.Mutex
	entries []string
}

func (o *hwCallOrder) add(label string) {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.entries = append(o.entries, label)
}

func (o *hwCallOrder) snapshot() []string {
	o.mu.Lock()
	defer o.mu.Unlock()
	return append([]string(nil), o.entries...)
}

func newHWFakeSupplier(t *testing.T, label string, leak string, order *hwCallOrder) *hwFakeSupplier {
	t.Helper()
	supplier := &hwFakeSupplier{label: label, order: order}
	supplier.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		supplier.serve(t, r, w, leak)
	}))
	t.Cleanup(supplier.server.Close)
	return supplier
}

func (s *hwFakeSupplier) setMode(mode hwFakeMode) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.mode = mode
}

func (s *hwFakeSupplier) currentMode() hwFakeMode {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.mode
}

func (s *hwFakeSupplier) callCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.calls
}

func (s *hwFakeSupplier) chatCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.chat
}

func (s *hwFakeSupplier) claudeCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.claude
}

func (s *hwFakeSupplier) resetCounters() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls, s.chat, s.claude = 0, 0, 0
}

func (s *hwFakeSupplier) enableToolCall(enabled bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.toolCall = enabled
}

func (s *hwFakeSupplier) enableLeakField(enabled bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.leakField = enabled
}

func (s *hwFakeSupplier) wantsLeakField() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.leakField
}

func (s *hwFakeSupplier) wantsToolCall() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.toolCall
}

// serve implements the double. Both wire formats share the leak headers.
func (s *hwFakeSupplier) serve(t *testing.T, r *http.Request, w http.ResponseWriter, leak string) {
	isClaude := strings.Contains(r.URL.Path, "/messages")
	stream := false
	body, _ := readAllLimited(r)
	if len(body) > 0 {
		var payload map[string]any
		if err := common.Unmarshal(body, &payload); err == nil {
			if flag, ok := payload["stream"].(bool); ok {
				stream = flag
			}
		}
	}

	if s.order != nil {
		s.order.add(s.label)
	}
	s.mu.Lock()
	s.calls++
	if isClaude {
		s.claude++
	} else {
		s.chat++
	}
	mode := s.mode
	toolCall := s.toolCall
	leakField := s.leakField
	s.mu.Unlock()

	w.Header().Set("X-OpenRouter-Id", "gen-"+leak+"-id")
	w.Header().Set("X-Powered-By", leak)
	w.Header().Set("Server", leak+"-edge")
	w.Header().Set("X-Provider-Slug", leak)

	switch mode {
	case hwFakeEmptyStream:
		// A supplier accepts the request, announces an event stream and closes it
		// without a single event, the way a crashing upstream behaves.
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		return
	case hwFakeTimeout:
		// Longer than the configured relay timeout, so the client aborts first.
		select {
		case <-r.Context().Done():
		case <-time.After(3 * time.Second):
		}
		return
	case hwFakeStatus500:
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":{"message":"` + leak + ` upstream failed","type":"provider_error","code":"` + leak + `_internal"}}`))
		return
	case hwFakeStatus429:
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"error":{"message":"` + leak + ` rate limited","type":"rate_limit_error","code":"` + leak + `_rate"}}`))
		return
	}

	if mode == hwFakeCutEarly {
		abortUpstreamConnection(w)
		return
	}
	if isClaude {
		s.serveClaude(w, r, leak, stream, toolCall, mode, leakField)
		return
	}
	s.serveOpenAI(w, r, leak, stream, toolCall, mode, leakField)
}

func (s *hwFakeSupplier) serveOpenAI(w http.ResponseWriter, r *http.Request, leak string, stream bool, toolCall bool, mode hwFakeMode, leakField bool) {
	if !stream {
		w.Header().Set("Content-Type", "application/json")
		message := `{"role":"assistant","content":"hello from the supplier"}`
		finish := "stop"
		if toolCall {
			message = `{"role":"assistant","content":null,"tool_calls":[{"id":"call_abc","type":"function","function":{"name":"get_weather","arguments":"{\"city\":\"Ankara\"}"}}]}`
			finish = "tool_calls"
		}
		extra := ``
		if leakField {
			extra = `,"note":"served by ` + hwMixedCaseLeak(leak) + `"`
		}
		_, _ = w.Write([]byte(`{"id":"gen-` + leak + `","object":"chat.completion","created":1700000000,"model":"` +
			leak + `-model","provider":"` + leak + `","choices":[{"index":0,"message":` + message +
			`,"finish_reason":"` + finish + `"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}` + extra + `}`))
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.WriteHeader(http.StatusOK)
	flusher, _ := w.(http.Flusher)
	writeChunk := func(payload string) bool {
		if _, err := w.Write([]byte("data: " + payload + "\n\n")); err != nil {
			return false
		}
		if flusher != nil {
			flusher.Flush()
		}
		return true
	}
	extra := ``
	if leakField {
		extra = `,"note":"served by ` + hwMixedCaseLeak(leak) + `"`
	}
	first := `{"id":"gen-` + leak + `","object":"chat.completion.chunk","created":1700000000,"model":"` + leak +
		`-model","provider":"` + leak + `","choices":[{"index":0,"delta":{"role":"assistant","content":"Hel"}}]` + extra + `}`
	second := `{"id":"gen-` + leak + `","object":"chat.completion.chunk","created":1700000000,"model":"` + leak +
		`-model","choices":[{"index":0,"delta":{"content":"lo"}}]}`
	if toolCall {
		first = `{"id":"gen-` + leak + `","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_abc","type":"function","function":{"name":"get_weather","arguments":""}}]}}]}`
		second = `{"id":"gen-` + leak + `","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"city\":\"Ankara\"}"}}]}}]}`
	}
	if !writeChunk(first) {
		return
	}
	if !writeChunk(second) {
		return
	}
	if mode == hwFakeCutStream {
		// Abort the connection while the customer is reading, before the
		// terminal event.
		abortUpstreamConnection(w)
		return
	}
	finish := "stop"
	if toolCall {
		finish = "tool_calls"
	}
	writeChunk(`{"id":"gen-` + leak + `","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"` + finish +
		`"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`)
	_, _ = w.Write([]byte("data: [DONE]\n\n"))
	if flusher != nil {
		flusher.Flush()
	}
}

func (s *hwFakeSupplier) serveClaude(w http.ResponseWriter, r *http.Request, leak string, stream bool, toolCall bool, mode hwFakeMode, leakField bool) {
	content := `[{"type":"text","text":"hello from the supplier"}]`
	stopReason := "end_turn"
	if toolCall {
		content = `[{"type":"tool_use","id":"toolu_abc","name":"get_weather","input":{"city":"Ankara"}}]`
		stopReason = "tool_use"
	}
	if !stream {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"msg_gen-` + leak + `","type":"message","role":"assistant","model":"` + leak +
			`-model","provider":"` + leak + `","content":` + content + `,"stop_reason":"` + stopReason +
			`","usage":{"input_tokens":10,"output_tokens":5}}`))
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.WriteHeader(http.StatusOK)
	flusher, _ := w.(http.Flusher)
	writeEvent := func(name, payload string) bool {
		if _, err := w.Write([]byte("event: " + name + "\ndata: " + payload + "\n\n")); err != nil {
			return false
		}
		if flusher != nil {
			flusher.Flush()
		}
		return true
	}
	start := `{"type":"message_start","message":{"id":"msg_gen-` + leak + `","type":"message","role":"assistant","model":"` + leak +
		`-model","provider":"` + leak + `","content":[],"usage":{"input_tokens":10,"output_tokens":1}}}`
	delta := `{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hel"}}`
	if toolCall {
		delta = `{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"city\":\"Ankara\"}"}}`
	}
	if !writeEvent("message_start", start) {
		return
	}
	if !writeEvent("content_block_delta", delta) {
		return
	}
	if mode == hwFakeCutStream {
		abortUpstreamConnection(w)
		return
	}
	writeEvent("message_stop", `{"type":"message_stop"}`)
	if flusher != nil {
		flusher.Flush()
	}
}

func readAllLimited(r *http.Request) ([]byte, error) {
	if r.Body == nil {
		return nil, nil
	}
	var buffer bytes.Buffer
	_, err := buffer.ReadFrom(http.MaxBytesReader(nil, r.Body, 1<<20))
	return buffer.Bytes(), err
}

// hwEnv is one isolated gateway: a SQLite database, a paying or free customer,
// supplier channels pointing at the doubles and a router shaped like the real
// relay router (token auth, masking, distribution).
type hwEnv struct {
	t        *testing.T
	engine   *gin.Engine
	calls    hwCallOrder
	db       *gorm.DB
	user     *model.User
	token    *model.Token
	supplier map[string]*hwFakeSupplier
}

// hwNewEnv builds a gateway with one customer in group and the given channels.
func hwNewEnv(t *testing.T, group string, quota int) *hwEnv {
	t.Helper()
	gin.SetMode(gin.TestMode)
	require.NoError(t, i18n.Init())

	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedis := common.RedisEnabled
	previousMainType, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()
	previousMemoryCache := common.MemoryCacheEnabled
	previousMaster := common.IsMasterNode
	previousSQLitePath := common.SQLitePath
	previousRetryDelay := common.HwLumiaRetryPauseMs
	previousCooldown := common.HwLumiaCooldownMs
	previousRelayTimeout := common.RelayTimeout
	previousStreamingTimeout := constant.StreamingTimeout
	previousModelRatios := ratio_setting.GetModelRatioCopy()
	previousCompletionRatios := ratio_setting.GetCompletionRatioCopy()

	common.MemoryCacheEnabled = false
	common.RedisEnabled = false
	common.IsMasterNode = false
	common.SQLitePath = filepath.Join(t.TempDir(), "hw.db")
	// The stream scanner builds a ticker from this value; production sets it
	// while loading options, a test binary does not.
	constant.StreamingTimeout = 30
	common.HwLumiaRetryPauseMs = 5
	// The Lumia cooldown is process-wide and these route tests reuse channel
	// ids across environments, so it stays off here; service/ covers it.
	common.HwLumiaCooldownMs = 0
	common.RelayTimeout = 1
	// The shared HTTP client snapshots the relay timeout, so it must be built
	// after the override to make the timeout path real.
	service.InitHttpClient()
	t.Setenv("SQL_DSN", "")
	t.Setenv("LOG_SQL_DSN", "")

	hwSetTestPrices(t)
	require.NoError(t, model.InitDB())
	require.NoError(t, model.InitLogDB())
	database := model.DB
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, database.AutoMigrate(&model.User{}, &model.Token{}, &model.Channel{}, &model.Ability{}, &model.Log{}, &model.AuditLog{}, &model.Option{}, &model.SubscriptionPlan{}, &model.UserSubscription{}, &model.TopUp{}))

	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedis
		common.SetDatabaseTypes(previousMainType, previousLogType)
		common.MemoryCacheEnabled = previousMemoryCache
		common.IsMasterNode = previousMaster
		common.SQLitePath = previousSQLitePath
		common.HwLumiaRetryPauseMs = previousRetryDelay
		common.HwLumiaCooldownMs = previousCooldown
		common.RelayTimeout = previousRelayTimeout
		constant.StreamingTimeout = previousStreamingTimeout
		hwRestoreRatios(t, previousModelRatios, previousCompletionRatios)
		require.NoError(t, sqlDB.Close())
	})

	env := &hwEnv{t: t, db: database, supplier: map[string]*hwFakeSupplier{}}
	env.user = &model.User{
		Username: "hw-" + group,
		Status:   common.UserStatusEnabled,
		Group:    group,
		Quota:    quota,
		AffCode:  "hwaff" + group,
	}
	require.NoError(t, database.Create(env.user).Error)
	env.token = &model.Token{
		UserId:         env.user.Id,
		Key:            "hwtesttoken" + hwKeySafe(group),
		Name:           "hw-test-token",
		Status:         common.TokenStatusEnabled,
		ExpiredTime:    -1,
		RemainQuota:    0,
		UnlimitedQuota: true,
	}
	require.NoError(t, database.Create(env.token).Error)
	t.Cleanup(func() {
		_ = database.Unscoped().Delete(&model.Token{}, env.token.Id).Error
		_ = database.Unscoped().Delete(&model.User{}, env.user.Id).Error
	})

	env.engine = gin.New()
	env.engine.Use(middleware.RequestId())
	distributed := env.engine.Group("/v1")
	distributed.Use(middleware.TokenAuth(), middleware.HwMask(), middleware.Distribute())
	distributed.POST("/chat/completions", func(c *gin.Context) { Relay(c, types.RelayFormatOpenAI) })
	distributed.POST("/messages", func(c *gin.Context) { Relay(c, types.RelayFormatClaude) })
	return env
}

// supplier returns (and lazily creates) the named fake upstream.
func (e *hwEnv) fake(name string) *hwFakeSupplier {
	if supplier, ok := e.supplier[name]; ok {
		return supplier
	}
	supplier := newHWFakeSupplier(e.t, name, name, &e.calls)
	e.supplier[name] = supplier
	return supplier
}

// addChannel creates one supplier channel plus its ability row. The model name
// is the customer-facing one the channel serves: the tests a free account runs
// need the Haiku class, because the free-group model gate refuses every other
// class before a channel is chosen. priority follows the production
// convention: Lumia 0, the emergency supplier 1.
func (e *hwEnv) addChannel(name, group, tag, modelName string, priority int64, supplier *hwFakeSupplier) *model.Channel {
	e.t.Helper()
	baseURL := supplier.server.URL
	channelTag := tag
	weight := uint(1)
	channel := &model.Channel{
		Name:     name,
		Type:     constant.ChannelTypeOpenAI,
		Key:      "sk-fake-" + tag,
		Status:   common.ChannelStatusEnabled,
		BaseURL:  &baseURL,
		Group:    group,
		Models:   modelName,
		Priority: &priority,
		Weight:   &weight,
		Tag:      &channelTag,
		AutoBan:  common.GetPointer(0),
	}
	require.NoError(e.t, e.db.Create(channel).Error)
	require.NoError(e.t, e.db.Create(&model.Ability{
		Group:     group,
		Model:     modelName,
		ChannelId: channel.Id,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
		Tag:       &channelTag,
	}).Error)
	return channel
}

// addUntaggedChannel registers a supplier channel without a tag, so a test can
// prove that the supplier role is recognised from the channel type too.
func (e *hwEnv) addUntaggedChannel(name, group string, channelType int, modelName string, priority int64, supplier *hwFakeSupplier) *model.Channel {
	e.t.Helper()
	baseURL := supplier.server.URL
	weight := uint(1)
	channel := &model.Channel{
		Name:     name,
		Type:     channelType,
		Key:      "sk-fake-untagged",
		Status:   common.ChannelStatusEnabled,
		BaseURL:  &baseURL,
		Group:    group,
		Models:   modelName,
		Priority: &priority,
		Weight:   &weight,
		AutoBan:  common.GetPointer(0),
	}
	require.NoError(e.t, e.db.Create(channel).Error)
	require.NoError(e.t, e.db.Create(&model.Ability{
		Group:     group,
		Model:     modelName,
		ChannelId: channel.Id,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
	return channel
}

// post sends one relay request through the customer-facing router.
func (e *hwEnv) post(path string, payload map[string]any) *httptest.ResponseRecorder {
	e.t.Helper()
	return e.postWithHeaders(path, payload, nil)
}

// postWithHeaders sends one relay request with extra request headers, so a test
// can prove that a header the customer controls cannot influence the mask.
func (e *hwEnv) postWithHeaders(path string, payload map[string]any, headers map[string]string) *httptest.ResponseRecorder {
	e.t.Helper()
	body, err := common.Marshal(payload)
	require.NoError(e.t, err)
	request := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer sk-"+e.token.Key)
	if strings.Contains(path, "/messages") {
		request.Header.Set("anthropic-version", "2023-06-01")
	}
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	recorder := httptest.NewRecorder()
	e.engine.ServeHTTP(recorder, request)
	return recorder
}

// chatRequest is the smallest OpenAI chat request for model.
func hwChatRequest(modelName string, stream bool) map[string]any {
	return map[string]any{
		"model":    modelName,
		"stream":   stream,
		"messages": []map[string]any{{"role": "user", "content": "hello"}},
	}
}

// claudeRequest is the smallest Anthropic message request for model.
func hwClaudeRequest(modelName string, stream bool) map[string]any {
	return map[string]any{
		"model":      modelName,
		"stream":     stream,
		"max_tokens": 64,
		"messages":   []map[string]any{{"role": "user", "content": "hello"}},
	}
}

// hwGrantTokenGroup lets an account of userGroup use tokenGroup, the way an
// administrator grants the paid group to a free account through the special
// usable-group setting. The settings are restored when the test ends.
func hwGrantTokenGroup(t *testing.T, userGroup, tokenGroup string) {
	t.Helper()
	groupSetting := ratio_setting.GetGroupRatioSetting()
	previousSpecial := groupSetting.GroupSpecialUsableGroup.ReadAll()
	previousRatios := groupSetting.GroupRatio.ReadAll()
	t.Cleanup(func() {
		groupSetting.GroupSpecialUsableGroup.Clear()
		groupSetting.GroupSpecialUsableGroup.AddAll(previousSpecial)
		groupSetting.GroupRatio.Clear()
		groupSetting.GroupRatio.AddAll(previousRatios)
	})
	groupSetting.GroupSpecialUsableGroup.Set(userGroup, map[string]string{tokenGroup: "Granted group"})
	groupSetting.GroupRatio.Set(tokenGroup, 1)
}

func hwResetGroupRatios(t *testing.T) {
	t.Helper()
	previous := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previous))
	})
}

// hwSetTestPrices gives the test models a price so pre-consume billing behaves
// like production instead of rejecting an unconfigured model.
func hwSetTestPrices(t *testing.T) {
	t.Helper()
	modelRatios := ratio_setting.GetModelRatioCopy()
	completionRatios := ratio_setting.GetCompletionRatioCopy()
	for _, name := range []string{"claude-sonnet-5-5", "claude-haiku-5-5", "gpt-4o-mini"} {
		modelRatios[name] = 3
		completionRatios[name] = 5
	}
	encoded, err := common.Marshal(modelRatios)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(encoded)))
	encoded, err = common.Marshal(completionRatios)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateCompletionRatioByJSONString(string(encoded)))
}

func hwRestoreRatios(t *testing.T, modelRatios, completionRatios map[string]float64) {
	t.Helper()
	encoded, err := common.Marshal(modelRatios)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(encoded)))
	encoded, err = common.Marshal(completionRatios)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateCompletionRatioByJSONString(string(encoded)))
}

// hwKeySafe keeps a group name usable inside an API key: token auth splits the
// key on '-' and only reads the first part.
func hwKeySafe(group string) string {
	replacer := strings.NewReplacer("-", "", "_", "", " ", "")
	return replacer.Replace(group)
}

// abortUpstreamConnection drops the supplier connection without a terminal
// event, the way a crashed upstream behaves.
func abortUpstreamConnection(w http.ResponseWriter) {
	if hijacker, ok := w.(http.Hijacker); ok {
		conn, _, err := hijacker.Hijack()
		if err == nil {
			_ = conn.Close()
			return
		}
	}
	panic(http.ErrAbortHandler)
}

// hwMixedCaseLeak varies the letter case so a case-insensitive check is needed.
func hwMixedCaseLeak(label string) string {
	return strings.ToUpper(label[:1]) + label[1:]
}
