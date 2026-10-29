package openai

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
	"gorm.io/gorm"
)

func TestObserveStreamChoicesDedupesFunctionCallNames(t *testing.T) {
	info := &relaycommon.RelayInfo{StreamStatus: relaycommon.NewStreamStatus()}
	seen := make(map[string]struct{})
	var names []string

	chunks := []string{
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function","function":{"name":"get_weather","arguments":""}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"q\":"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"x\"}"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"id":"c2","type":"function","function":{"name":"get_time","arguments":""}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"function":{"arguments":"{}"}}]}}]}`,
	}
	for _, chunk := range chunks {
		observeStreamChoices(info, chunk, seen, &names)
	}

	require.Len(t, names, 2)
	assert.Equal(t, []string{"get_weather", "get_time"}, names)
	assert.Empty(t, info.StreamStatus.ResponseOutcome(), "tool call deltas carry no finish reason")

	observeStreamChoices(info, `{"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`, seen, &names)
	assert.Equal(t, "completed", info.StreamStatus.ResponseOutcome())
	assert.False(t, info.PerformanceBusinessRejection)

	filtered := &relaycommon.RelayInfo{StreamStatus: relaycommon.NewStreamStatus()}
	observeStreamChoices(filtered, `{"choices":[{"index":0,"delta":{},"finish_reason":"content_filter"}]}`, map[string]struct{}{}, &names)
	assert.True(t, filtered.PerformanceBusinessRejection)
}

func realtimeBillingTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "realtime.db")), &gorm.Config{})
	require.NoError(t, err)
	oldDB, oldType := model.DB, common.MainDatabaseType()
	oldRedis, oldLog, oldBatch := common.RedisEnabled, common.LogConsumeEnabled, common.BatchUpdateEnabled
	common.RedisEnabled, common.LogConsumeEnabled, common.BatchUpdateEnabled = false, false, false
	t.Cleanup(func() {
		common.RedisEnabled, common.LogConsumeEnabled, common.BatchUpdateEnabled = oldRedis, oldLog, oldBatch
	})
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		require.Eventually(t, func() bool { return gopool.WorkerCount() == 0 }, 3*time.Second, 5*time.Millisecond, "wait for asynchronous quota/cache work before restoring globals")
		model.DB = oldDB
		common.SetMainDatabaseType(oldType)
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	})
	require.NoError(t, i18n.Init())
	require.NoError(t, db.AutoMigrate(&model.SubscriptionPlan{}, &model.UserSubscription{}, &model.SubscriptionPreConsumeRecord{}, &model.SubscriptionQuotaWindow{}, &model.User{}, &model.Channel{}, &model.Token{}))
	require.NoError(t, db.Create(&model.User{Id: 9001, Username: "realtime-quotas"}).Error)
	require.NoError(t, db.Create(&model.Channel{Id: 9001, Name: "realtime", Key: "test"}).Error)
	return db
}

func TestRealtimeGenerationStopsAtSubscriptionPeriodLimit(t *testing.T) {
	db := realtimeBillingTestDB(t)
	plan := model.SubscriptionPlan{Title: "One generation", DailyLimit: 1}
	require.NoError(t, db.Create(&plan).Error)
	now := model.GetDBTimestamp()
	sub := model.UserSubscription{UserId: 9001, PlanId: plan.Id, Status: "active", StartTime: now, EndTime: now + 86400}
	require.NoError(t, db.Create(&sub).Error)
	upgrader := websocket.Upgrader{}
	upstreamRequests := make(chan string, 2)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				return
			}
			upstreamRequests <- string(message)
			_ = conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.created","response":{"id":"resp-1"}}`))
			_ = conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.done","response":{"id":"resp-1","usage":{"total_tokens":1,"input_tokens":1,"output_tokens":0,"input_token_details":{"text_tokens":1}}}}`))
		}
	}))
	defer upstream.Close()
	finished := make(chan struct{})
	gateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer close(finished)
		client, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer client.Close()
		target, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(upstream.URL, "http"), nil)
		if err != nil {
			return
		}
		defer target.Close()
		c, _ := gin.CreateTestContext(w)
		c.Request = r
		info := &relaycommon.RelayInfo{ClientWs: client, TargetWs: target, UserId: sub.UserId, ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 9001}, RequestId: "first-realtime-generation", IsPlayground: true, ForcePreConsume: true, StartTime: time.Now(), UserSetting: dto.UserSetting{BillingPreference: "subscription_only"}, PriceData: hosttypes.PriceData{UsePrice: true, ModelPrice: 1 / common.QuotaPerUnit, QuotaToPreConsume: 1, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}}}
		if apiErr := service.PreConsumeBilling(c, 1, info); apiErr != nil {
			return
		}
		_, _ = OpenaiRealtimeHandler(c, info)
	}))
	defer gateway.Close()
	client, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(gateway.URL, "http"), nil)
	require.NoError(t, err)
	defer client.Close()
	require.NoError(t, client.SetReadDeadline(time.Now().Add(5*time.Second)))
	require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.create"}`)))
	_, _, err = client.ReadMessage()
	require.NoError(t, err)
	_, message, err := client.ReadMessage()
	require.NoError(t, err)
	assert.Contains(t, string(message), "response.done")
	assert.Contains(t, <-upstreamRequests, "response.create")
	require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.create"}`)))
	_, message, err = client.ReadMessage()
	require.NoError(t, err)
	assert.Contains(t, string(message), `"type":"error"`)
	select {
	case <-finished:
	case <-time.After(5 * time.Second):
		t.Fatal("gateway did not close after admission rejection")
	}
	assert.Empty(t, upstreamRequests, "a rejected generation cannot reach the provider")
	require.NoError(t, db.First(&sub, sub.Id).Error)
	assert.EqualValues(t, 1, sub.AmountUsed)
	var receipts []model.SubscriptionPreConsumeRecord
	require.NoError(t, db.Find(&receipts).Error)
	require.Len(t, receipts, 1)
	assert.Positive(t, receipts[0].SettledAt)
}

// The local provider callback keeps these regressions at the websocket boundary.
func realtimeBillingTestClient(t *testing.T, info *relaycommon.RelayInfo, responseFrames func([]byte) []string) (*websocket.Conn, <-chan string, <-chan struct{}) {
	t.Helper()
	upgrader := websocket.Upgrader{}
	received := make(chan string, 8)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				return
			}
			received <- string(message)
			for _, frame := range responseFrames(message) {
				if err := conn.WriteMessage(websocket.TextMessage, []byte(frame)); err != nil {
					return
				}
			}
		}
	}))
	finished := make(chan struct{})
	gateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer close(finished)
		client, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer client.Close()
		target, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(upstream.URL, "http"), nil)
		if err != nil {
			return
		}
		defer target.Close()
		c, _ := gin.CreateTestContext(w)
		c.Request = r
		info.ClientWs, info.TargetWs = client, target
		if apiErr := service.PreConsumeBilling(c, info.PriceData.QuotaToPreConsume, info); apiErr != nil {
			return
		}
		_, _ = OpenaiRealtimeHandler(c, info)
	}))
	client, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(gateway.URL, "http"), nil)
	require.NoError(t, err)
	require.NoError(t, client.SetReadDeadline(time.Now().Add(5*time.Second)))
	t.Cleanup(func() {
		_ = client.Close()
		select {
		case <-finished:
		case <-time.After(5 * time.Second):
			t.Error("realtime worker did not stop")
		}
		gateway.Close()
		upstream.Close()
		// Cancellation currently refunds asynchronously; keep its database alive.
		require.Eventually(t, func() bool {
			var pending int64
			err := model.DB.Model(&model.SubscriptionPreConsumeRecord{}).Where("status <> ? AND settled_at = 0", "refunded").Count(&pending).Error
			return err == nil && pending == 0
		}, 3*time.Second, 5*time.Millisecond)
	})
	return client, received, finished
}

func TestRealtimeFiniteTokenAdmissionWithZeroEstimate(t *testing.T) {
	for _, remaining := range []int{0, 1} {
		t.Run(fmt.Sprint(remaining), func(t *testing.T) {
			db := realtimeBillingTestDB(t)
			token := model.Token{Id: 9001, UserId: 9001, Key: "realtime-finite", RemainQuota: remaining}
			require.NoError(t, db.Create(&token).Error)
			require.NoError(t, db.Model(&model.User{}).Where("id = ?", 9001).Update("quota", 100).Error)
			info := &relaycommon.RelayInfo{UserId: 9001, TokenId: token.Id, TokenKey: token.Key, ForcePreConsume: true, ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 9001}, RequestId: "zero-estimate-token", StartTime: time.Now(), UserSetting: dto.UserSetting{BillingPreference: "wallet_only"}, PriceData: hosttypes.PriceData{ModelRatio: 1, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}}}
			client, received, _ := realtimeBillingTestClient(t, info, func([]byte) []string {
				return []string{`{"type":"response.created","response":{"id":"token-generation"}}`, `{"type":"response.done","response":{"id":"token-generation","usage":{"total_tokens":1,"input_tokens":1,"input_token_details":{"text_tokens":1}}}}`}
			})
			request := []byte(`{"type":"response.create","event_id":"first"}`)
			require.NoError(t, client.WriteMessage(websocket.TextMessage, request))
			_, message, err := client.ReadMessage()
			require.NoError(t, err)
			if remaining > 0 {
				require.Equal(t, "response.created", gjson.GetBytes(message, "type").String())
				_, message, err = client.ReadMessage()
				require.NoError(t, err)
				require.Equal(t, "response.done", gjson.GetBytes(message, "type").String())
				require.NoError(t, db.First(&token, token.Id).Error)
				assert.Zero(t, token.RemainQuota)
				require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.create","event_id":"second"}`)))
				_, message, err = client.ReadMessage()
				require.NoError(t, err)
			}
			assert.Equal(t, "error", gjson.GetBytes(message, "type").String(), "an exhausted finite token must not start another generation")
			assert.Len(t, received, remaining)
		})
	}
}

func TestRealtimeRejectedCreateReusesReservation(t *testing.T) {
	for _, scenario := range []string{"client_event_id", "generated_event_id", "response_param_without_event_id", "unrelated_error", "unrelated_param_without_event_id"} {
		t.Run(scenario, func(t *testing.T) {
			db := realtimeBillingTestDB(t)
			plan := model.SubscriptionPlan{Title: "One reservation", DailyLimit: 1}
			require.NoError(t, db.Create(&plan).Error)
			now := model.GetDBTimestamp()
			sub := model.UserSubscription{UserId: 9001, PlanId: plan.Id, Status: "active", StartTime: now, EndTime: now + 86400}
			require.NoError(t, db.Create(&sub).Error)
			info := &relaycommon.RelayInfo{UserId: sub.UserId, IsPlayground: true, ForcePreConsume: true, ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 9001}, RequestId: "rejected-realtime-create", StartTime: time.Now(), UserSetting: dto.UserSetting{BillingPreference: "subscription_only"}, PriceData: hosttypes.PriceData{UsePrice: true, ModelPrice: 1 / common.QuotaPerUnit, QuotaToPreConsume: 1, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}}}
			count := 0
			client, received, _ := realtimeBillingTestClient(t, info, func(message []byte) []string {
				count++
				if count == 1 {
					eventID := gjson.GetBytes(message, "event_id").String()
					if scenario == "unrelated_error" {
						eventID = "different-client-event"
					}
					detail := gin.H{"type": "invalid_request_error", "event_id": eventID, "message": "Invalid response parameter"}
					if scenario == "response_param_without_event_id" {
						delete(detail, "event_id")
						detail["param"] = "response.modalities"
					}
					if scenario == "unrelated_param_without_event_id" {
						delete(detail, "event_id")
						detail["param"] = "session.voice"
					}
					data, _ := common.Marshal(gin.H{"type": "error", "error": detail})
					return []string{string(data)}
				}
				return []string{`{"type":"response.created","response":{"id":"accepted-retry"}}`, `{"type":"response.done","response":{"id":"accepted-retry","usage":{"total_tokens":1,"input_tokens":1,"input_token_details":{"text_tokens":1}}}}`}
			})
			first := []byte(`{"type":"response.create","event_id":"invalid-create"}`)
			if scenario == "generated_event_id" {
				first = []byte(`{"type":"response.create"}`)
			}
			require.NoError(t, client.WriteMessage(websocket.TextMessage, first))
			_, message, err := client.ReadMessage()
			require.NoError(t, err)
			require.Equal(t, "error", gjson.GetBytes(message, "type").String())
			require.NoError(t, db.First(&sub, sub.Id).Error)
			assert.EqualValues(t, 1, sub.AmountUsed, "the original reservation remains available for a corrected retry")
			require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.create","event_id":"corrected-create"}`)))
			_, message, err = client.ReadMessage()
			require.NoError(t, err)
			if scenario == "unrelated_error" || scenario == "unrelated_param_without_event_id" {
				assert.Equal(t, "error", gjson.GetBytes(message, "type").String())
				assert.Len(t, received, 1, "unrelated errors cannot release a pending generation")
				return
			}
			require.Equal(t, "response.created", gjson.GetBytes(message, "type").String(), "corrected request must reuse its reservation")
			_, message, err = client.ReadMessage()
			require.NoError(t, err)
			assert.Equal(t, "response.done", gjson.GetBytes(message, "type").String())
			assert.Len(t, received, 2)
			require.NoError(t, db.First(&sub, sub.Id).Error)
			assert.EqualValues(t, 1, sub.AmountUsed)
			var receipts []model.SubscriptionPreConsumeRecord
			require.NoError(t, db.Find(&receipts).Error)
			require.Len(t, receipts, 1)
			assert.EqualValues(t, 1, receipts[0].AccountedAmount)
		})
	}
}

func TestRealtimeTurnRejectsNegativeEstimate(t *testing.T) {
	db := realtimeBillingTestDB(t)
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", 9001).Update("quota", 100).Error)
	token := model.Token{Id: 9001, UserId: 9001, Key: "negative-estimate-token", RemainQuota: 1}
	require.NoError(t, db.Create(&token).Error)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/realtime", nil)
	info := &relaycommon.RelayInfo{UserId: 9001, TokenId: token.Id, TokenKey: token.Key, UserSetting: dto.UserSetting{BillingPreference: "wallet_only"}, PriceData: hosttypes.PriceData{QuotaToPreConsume: -1}}
	_, apiErr := reserveRealtimeTurn(c, info)
	require.NotNil(t, apiErr, "zero estimates get a minimum reservation, negative estimates stay invalid")
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	require.NoError(t, db.First(&token, token.Id).Error)
	assert.Equal(t, 1, token.RemainQuota)
}

func TestRealtimeTextInputBeforeResponseUsesFallbackBilling(t *testing.T) {
	for _, scenario := range []struct {
		name               string
		authoritativeUsage bool
		precedingResponse  bool
	}{
		{name: "fallback"},
		{name: "authoritative", authoritativeUsage: true},
		{name: "input_during_previous_response", precedingResponse: true},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			db := realtimeBillingTestDB(t)
			plan := model.SubscriptionPlan{Title: "Text fallback", DailyLimit: 100}
			require.NoError(t, db.Create(&plan).Error)
			sub := model.UserSubscription{UserId: 9001, PlanId: plan.Id, Status: "active", EndTime: model.GetDBTimestamp() + 86400}
			require.NoError(t, db.Create(&sub).Error)
			info := &relaycommon.RelayInfo{UserId: sub.UserId, IsPlayground: true, ForcePreConsume: true, ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 9001, UpstreamModelName: "gpt-4o-realtime-preview"}, RequestId: "text-before-response", StartTime: time.Now(), UserSetting: dto.UserSetting{BillingPreference: "subscription_only"}, PriceData: hosttypes.PriceData{ModelRatio: 1, QuotaToPreConsume: 1, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}}}
			client, _, _ := realtimeBillingTestClient(t, info, func(message []byte) []string {
				if gjson.GetBytes(message, "event_id").String() == "preceding" {
					return []string{`{"type":"response.created","response":{"id":"preceding-response"}}`}
				}
				if gjson.GetBytes(message, "type").String() == "conversation.item.create" {
					frames := []string{`{"type":"conversation.item.created","item":{"id":"input-1","type":"message","role":"user","content":[{"type":"input_text","text":"hello world"}]}}`}
					if scenario.precedingResponse {
						frames = append(frames, `{"type":"response.done","response":{"id":"preceding-response"}}`)
					}
					return frames
				}
				done := `{"type":"response.done","response":{"id":"text-response"}}`
				if scenario.authoritativeUsage {
					done = `{"type":"response.done","response":{"id":"text-response","usage":{"total_tokens":3,"input_tokens":3,"input_token_details":{"text_tokens":3}}}}`
				}
				return []string{`{"type":"response.created","response":{"id":"text-response"}}`, done}
			})
			if scenario.precedingResponse {
				require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.create","event_id":"preceding"}`)))
				_, frame, err := client.ReadMessage()
				require.NoError(t, err)
				require.Equal(t, "response.created", gjson.GetBytes(frame, "type").String())
			}
			require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(`{"type":"conversation.item.create","item":{"type":"message","role":"user","content":[{"type":"input_text","text":"hello world"}]}}`)))
			_, frame, err := client.ReadMessage()
			require.NoError(t, err)
			require.Equal(t, "conversation.item.created", gjson.GetBytes(frame, "type").String())
			if scenario.precedingResponse {
				_, frame, err = client.ReadMessage()
				require.NoError(t, err)
				require.Equal(t, "response.done", gjson.GetBytes(frame, "type").String())
				require.NoError(t, db.First(&sub, sub.Id).Error)
				assert.Zero(t, sub.AmountUsed, "next input is not output of the preceding response")
			}
			require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.create"}`)))
			for _, event := range []string{"response.created", "response.done"} {
				_, frame, err = client.ReadMessage()
				require.NoError(t, err)
				require.Equal(t, event, gjson.GetBytes(frame, "type").String())
			}
			expected := service.CountTokenInput("hello world", info.UpstreamModelName)
			if scenario.authoritativeUsage {
				expected = 3
			}
			require.Positive(t, expected)
			require.NoError(t, db.First(&sub, sub.Id).Error)
			assert.EqualValues(t, expected, sub.AmountUsed, "server-confirmed input must be retained for fallback, without adding it to authoritative usage")
		})
	}
}

func TestRealtimePipelinedRejectedCreateKeepsAcceptedReservation(t *testing.T) {
	db := realtimeBillingTestDB(t)
	plan := model.SubscriptionPlan{Title: "Two reservations", DailyLimit: 2}
	require.NoError(t, db.Create(&plan).Error)
	sub := model.UserSubscription{UserId: 9001, PlanId: plan.Id, Status: "active", EndTime: model.GetDBTimestamp() + 86400}
	require.NoError(t, db.Create(&sub).Error)
	info := &relaycommon.RelayInfo{UserId: sub.UserId, IsPlayground: true, ForcePreConsume: true, ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 9001}, RequestId: "pipeline-first", StartTime: time.Now(), UserSetting: dto.UserSetting{BillingPreference: "subscription_only"}, PriceData: hosttypes.PriceData{UsePrice: true, ModelPrice: 1 / common.QuotaPerUnit, QuotaToPreConsume: 1, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}}}
	client, _, _ := realtimeBillingTestClient(t, info, func(message []byte) []string {
		switch gjson.GetBytes(message, "event_id").String() {
		case "a":
			return nil // Hold A until B is also waiting for acceptance.
		case "b":
			return []string{`{"type":"error","error":{"type":"invalid_request_error","event_id":"a","param":"response.modalities","message":"Rejected A"}}`, `{"type":"response.created","response":{"id":"accepted-b"}}`, `{"type":"response.done","response":{"id":"accepted-b","usage":{"total_tokens":1,"input_tokens":1,"input_token_details":{"text_tokens":1}}}}`}
		default:
			return []string{`{"type":"response.created","response":{"id":"accepted-c"}}`, `{"type":"response.done","response":{"id":"accepted-c","usage":{"total_tokens":1,"input_tokens":1,"input_token_details":{"text_tokens":1}}}}`}
		}
	})
	for _, id := range []string{"a", "b"} {
		require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"type":"response.create","event_id":%q}`, id))))
	}
	for _, event := range []string{"error", "response.created", "response.done"} {
		_, frame, err := client.ReadMessage()
		require.NoError(t, err)
		require.Equal(t, event, gjson.GetBytes(frame, "type").String())
	}
	var receipts []model.SubscriptionPreConsumeRecord
	require.NoError(t, db.Order("id").Find(&receipts).Error)
	require.Len(t, receipts, 2)
	assert.Zero(t, receipts[0].SettledAt, "A remains reusable after its rejection")
	assert.Positive(t, receipts[1].SettledAt, "B must settle its own reservation")
	require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.create","event_id":"c"}`)))
	for _, event := range []string{"response.created", "response.done"} {
		_, frame, err := client.ReadMessage()
		require.NoError(t, err)
		require.Equal(t, event, gjson.GetBytes(frame, "type").String(), "C must reuse the rejected reservation rather than require additional quota")
	}
	require.NoError(t, db.Order("id").Find(&receipts).Error)
	require.Len(t, receipts, 2)
	for _, receipt := range receipts {
		assert.Positive(t, receipt.SettledAt)
		assert.EqualValues(t, 1, receipt.AccountedAmount)
	}
	require.NoError(t, db.First(&sub, sub.Id).Error)
	assert.EqualValues(t, 2, sub.AmountUsed)
}

func TestRealtimeAudioBufferDoesNotReserveAnotherResponse(t *testing.T) {
	db := realtimeBillingTestDB(t)
	plan := model.SubscriptionPlan{Title: "One active response", DailyLimit: 1}
	require.NoError(t, db.Create(&plan).Error)
	now := model.GetDBTimestamp()
	sub := model.UserSubscription{UserId: 9001, PlanId: plan.Id, Status: "active", StartTime: now, EndTime: now + 86400}
	require.NoError(t, db.Create(&sub).Error)
	info := &relaycommon.RelayInfo{UserId: sub.UserId, IsPlayground: true, ForcePreConsume: true, InputAudioFormat: "pcm16", ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 9001}, RequestId: "continuous-audio", StartTime: time.Now(), UserSetting: dto.UserSetting{BillingPreference: "subscription_only"}, PriceData: hosttypes.PriceData{UsePrice: true, ModelPrice: 1 / common.QuotaPerUnit, QuotaToPreConsume: 1, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}}}
	client, received, _ := realtimeBillingTestClient(t, info, func(message []byte) []string {
		switch gjson.GetBytes(message, "type").String() {
		case "response.create":
			return []string{`{"type":"response.created","response":{"id":"still-generating"}}`}
		case "input_audio_buffer.append":
			return []string{`{"type":"input_audio_buffer.speech_stopped"}`}
		case "input_audio_buffer.commit":
			return []string{`{"type":"input_audio_buffer.committed"}`, `{"type":"response.done","response":{"id":"still-generating","usage":{"total_tokens":1,"input_tokens":1,"input_token_details":{"text_tokens":1}}}}`}
		}
		return nil
	})
	require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.create"}`)))
	_, frame, err := client.ReadMessage()
	require.NoError(t, err)
	require.Equal(t, "response.created", gjson.GetBytes(frame, "type").String())
	for _, event := range []struct{ payload, acknowledgement string }{
		{`{"type":"input_audio_buffer.append","audio":"AAAAAA=="}`, "input_audio_buffer.speech_stopped"},
		{`{"type":"input_audio_buffer.commit"}`, "input_audio_buffer.committed"},
	} {
		require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(event.payload)))
		_, frame, err = client.ReadMessage()
		require.NoError(t, err)
		require.Equal(t, event.acknowledgement, gjson.GetBytes(frame, "type").String(), "buffering audio must not interrupt an admitted response")
	}
	_, frame, err = client.ReadMessage()
	require.NoError(t, err)
	assert.Equal(t, "response.done", gjson.GetBytes(frame, "type").String())
	var receipts []model.SubscriptionPreConsumeRecord
	require.NoError(t, db.Find(&receipts).Error)
	require.Len(t, receipts, 1)
	assert.EqualValues(t, 1, receipts[0].AccountedAmount)
	require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.create","event_id":"next-response"}`)))
	_, frame, err = client.ReadMessage()
	require.NoError(t, err)
	assert.Equal(t, "error", gjson.GetBytes(frame, "type").String(), "a subsequent response still needs its own quota")
	assert.Len(t, received, 3)
}

func TestRealtimeClearedAudioDoesNotEnterFallbackUsage(t *testing.T) {
	db := realtimeBillingTestDB(t)
	plan := model.SubscriptionPlan{Title: "Cleared input", DailyLimit: 1}
	require.NoError(t, db.Create(&plan).Error)
	sub := model.UserSubscription{UserId: 9001, PlanId: plan.Id, Status: "active", EndTime: model.GetDBTimestamp() + 86400}
	require.NoError(t, db.Create(&sub).Error)
	info := &relaycommon.RelayInfo{UserId: sub.UserId, IsPlayground: true, ForcePreConsume: true, InputAudioFormat: "pcm16", ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 9001}, RequestId: "cleared-audio", StartTime: time.Now(), UserSetting: dto.UserSetting{BillingPreference: "subscription_only"}, PriceData: hosttypes.PriceData{UsePrice: true, ModelPrice: 1 / common.QuotaPerUnit, QuotaToPreConsume: 1, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}}}
	client, _, _ := realtimeBillingTestClient(t, info, func(message []byte) []string {
		switch gjson.GetBytes(message, "type").String() {
		case "input_audio_buffer.append":
			return []string{`{"type":"input_audio_buffer.speech_stopped"}`}
		case "input_audio_buffer.clear":
			return []string{`{"type":"input_audio_buffer.cleared"}`}
		default:
			return []string{`{"type":"response.created","response":{"id":"empty"}}`, `{"type":"response.done","response":{"id":"empty"}}`}
		}
	})
	for _, payload := range []string{`{"type":"input_audio_buffer.append","audio":"AAAAAA=="}`, `{"type":"input_audio_buffer.clear"}`, `{"type":"response.create"}`} {
		require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(payload)))
		_, _, err := client.ReadMessage()
		require.NoError(t, err)
	}
	_, message, err := client.ReadMessage()
	require.NoError(t, err)
	assert.Equal(t, "response.done", gjson.GetBytes(message, "type").String())
	require.NoError(t, db.First(&sub, sub.Id).Error)
	assert.Zero(t, sub.AmountUsed)
}

func TestRealtimeRecordsFirstResponseForEachGeneration(t *testing.T) {
	db := realtimeBillingTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	previousLogDB, previousLogType := model.LOG_DB, common.LogDatabaseType()
	model.LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	common.LogConsumeEnabled = true
	t.Cleanup(func() {
		model.LOG_DB = previousLogDB
		common.SetLogDatabaseType(previousLogType)
	})
	plan := model.SubscriptionPlan{Title: "Realtime timing", DailyLimit: 10}
	require.NoError(t, db.Create(&plan).Error)
	now := model.GetDBTimestamp()
	sub := model.UserSubscription{UserId: 9001, PlanId: plan.Id, Status: "active", EndTime: now + 86400}
	require.NoError(t, db.Create(&sub).Error)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/realtime", nil)
	info := relaycommon.GenRelayInfoWs(c, nil)
	info.UserId, info.IsPlayground, info.ForcePreConsume = sub.UserId, true, true
	info.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: 9001}
	info.UserSetting.BillingPreference = "subscription_only"
	info.PriceData = hosttypes.PriceData{UsePrice: true, ModelPrice: 1 / common.QuotaPerUnit, QuotaToPreConsume: 1, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}}
	client, _, _ := realtimeBillingTestClient(t, info, func(message []byte) []string {
		id := gjson.GetBytes(message, "event_id").String()
		return []string{
			fmt.Sprintf(`{"type":"response.created","response":{"id":%q}}`, id),
			fmt.Sprintf(`{"type":"response.done","response":{"id":%q,"usage":{"total_tokens":1,"input_tokens":1,"input_token_details":{"text_tokens":1}}}}`, id),
		}
	})
	for i := range 2 {
		require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"type":"response.create","event_id":"turn-%d"}`, i))))
		_, _, err := client.ReadMessage()
		require.NoError(t, err)
		_, message, err := client.ReadMessage()
		require.NoError(t, err)
		require.Equal(t, "response.done", gjson.GetBytes(message, "type").String())
	}
	var logs []model.Log
	require.NoError(t, db.Where("type = ?", model.LogTypeConsume).Order("id").Find(&logs).Error)
	require.Len(t, logs, 2)
	for i, log := range logs {
		frt := gjson.Get(log.Other, "frt")
		require.True(t, frt.Exists())
		assert.GreaterOrEqual(t, frt.Int(), int64(0), "generation %d must have its own first-response timestamp", i)
	}
}
