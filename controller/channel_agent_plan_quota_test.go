package controller

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaychannel "github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type agentPlanTestTransport func(*http.Request) (*http.Response, error)

func (transport agentPlanTestTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	return transport(request)
}

func TestAgentPlanQuotaMonitorDatabaseMatrix(t *testing.T) {
	for _, engine := range []string{"sqlite", "mysql", "postgres", "clickhouse"} {
		t.Run(engine, func(t *testing.T) {
			var dialector gorm.Dialector
			switch engine {
			case "sqlite", "clickhouse":
				dialector = sqlite.Open(":memory:")
			case "mysql":
				dsn := os.Getenv("TEST_AGENT_PLAN_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_AGENT_PLAN_MYSQL_DSN is not configured")
				}
				dialector = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_AGENT_PLAN_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_AGENT_PLAN_POSTGRES_DSN is not configured")
				}
				dialector = postgres.Open(dsn)
			}
			db, err := gorm.Open(dialector, &gorm.Config{})
			require.NoError(t, err)
			connection, err := db.DB()
			require.NoError(t, err)
			connection.SetMaxOpenConns(1)
			originalDB, originalLogDB := model.DB, model.LOG_DB
			originalLogType, originalMaster := common.LogDatabaseType(), common.IsMasterNode
			originalConsume, originalExport, originalRedis := common.LogConsumeEnabled, common.DataExportEnabled, common.RedisEnabled
			model.DB, model.LOG_DB = db, db
			common.LogConsumeEnabled, common.DataExportEnabled, common.RedisEnabled = true, false, false
			t.Cleanup(func() {
				model.DB, model.LOG_DB = originalDB, originalLogDB
				common.SetLogDatabaseType(originalLogType)
				common.IsMasterNode = originalMaster
				common.LogConsumeEnabled, common.DataExportEnabled, common.RedisEnabled = originalConsume, originalExport, originalRedis
				require.NoError(t, connection.Close())
			})
			require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.User{}, &model.SystemTask{}, &model.SystemTaskLock{}))
			if engine == "clickhouse" {
				dsn := os.Getenv("TEST_AGENT_PLAN_CLICKHOUSE_DSN")
				if dsn == "" {
					t.Skip("TEST_AGENT_PLAN_CLICKHOUSE_DSN is not configured")
				}
				t.Setenv("LOG_SQL_DSN", dsn)
				common.IsMasterNode = true
				require.NoError(t, model.InitLogDB())
				logConnection, err := model.LOG_DB.DB()
				require.NoError(t, err)
				t.Cleanup(func() { require.NoError(t, logConnection.Close()) })
			} else {
				common.SetLogDatabaseType(common.DatabaseType(engine))
				require.NoError(t, db.AutoMigrate(&model.Log{}))
			}

			var version string
			versionQuery := "SELECT version()"
			if engine == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			require.NoError(t, model.LOG_DB.Raw(versionQuery).Scan(&version).Error)
			t.Logf("%s version: %s", engine, version)

			planURL := constant.VolcengineTokenPlanBaseURL
			codingURL := constant.VolcengineCodingPlanBaseURL
			codingPreset := constant.VolcengineCodingPlanPreset
			channels := []model.Channel{
				{Type: constant.ChannelTypeVolcEngine, BaseURL: &planURL, Name: "Claude", Key: "secret-personal-key-7F2A"},
				{Type: constant.ChannelTypeVolcEngine, BaseURL: &planURL, Name: "OpenAI", Key: "secret-personal-key-7F2A"},
				{Type: constant.ChannelTypeVolcEngine, BaseURL: &planURL, Name: "Seat A", Key: "secret-team-key-D120"},
				{Type: constant.ChannelTypeVolcEngine, BaseURL: &codingPreset, Name: "Coding preset", Key: "secret-coding-key-Q987"},
				{Type: constant.ChannelTypeVolcEngine, BaseURL: &codingURL, Name: "Coding URL", Key: "secret-coding-key-Q987"},
			}
			if engine == "clickhouse" {
				firstID := int(time.Now().UnixNano()%1_000_000_000) + 1
				for index := range channels {
					channels[index].Id = firstID + index
				}
			}
			require.NoError(t, db.Create(&channels).Error)
			t.Cleanup(func() {
				require.NoError(t, db.Where("type = ?", model.SystemTaskTypeAgentPlanQuota).Delete(&model.SystemTask{}).Error)
				require.NoError(t, db.Delete(&channels).Error)
				if engine != "clickhouse" {
					var ids []int
					for _, channel := range channels {
						ids = append(ids, channel.Id)
					}
					require.NoError(t, db.Where("channel_id IN ?", ids).Delete(&model.Log{}).Error)
				}
			})
			t.Setenv(agentPlanQuotaConfigEnv, fmt.Sprintf(`[
				{"channel_ids":[%d,%d],"expires_at":"2026-12-04T23:59:59+08:00"},
				{"seat_id":"seat-a","channel_ids":[%d]},
				{"seat_id":"seat-b"}]`, channels[0].Id, channels[1].Id, channels[2].Id))
			t.Setenv("VOLCENGINE_AGENT_PLAN_AK", "fixture-ak")
			t.Setenv("VOLCENGINE_AGENT_PLAN_SK", "fixture-sk")
			t.Setenv(codingPlanQuotaConfigEnv, fmt.Sprintf(`[{"channel_ids":[%d,%d]}]`, channels[3].Id, channels[4].Id))
			t.Setenv("VOLCENGINE_CODING_PLAN_AK", "fixture-coding-ak")
			t.Setenv("VOLCENGINE_CODING_PLAN_SK", "fixture-coding-sk")

			relayClient, err := service.GetHttpClientWithProxy("")
			require.NoError(t, err)
			relayTransport := relayClient.Transport
			upstreamStatus := http.StatusOK
			relayClient.Transport = agentPlanTestTransport(func(request *http.Request) (*http.Response, error) {
				assert.Equal(t, "ark.cn-beijing.volces.com", request.URL.Host)
				return &http.Response{StatusCode: upstreamStatus, Body: http.NoBody}, nil
			})
			t.Cleanup(func() { relayClient.Transport = relayTransport })
			recordUsage := func(channel model.Channel, sentKey string, prompt, completion int, metadata map[string]any) {
				ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
				ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", http.NoBody)
				url := channel.GetBaseURL()
				if url == codingPreset {
					url = codingURL
				}
				req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, url+"/chat/completions", http.NoBody)
				require.NoError(t, err)
				req.Header.Set("Authorization", "Bearer "+sentKey)
				info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
					ChannelId: channel.Id, ChannelType: channel.Type, ChannelBaseUrl: channel.GetBaseURL(), ApiKey: channel.Key,
				}}
				response, err := relaychannel.DoRequest(ctx, req, info)
				require.NoError(t, err)
				require.NoError(t, response.Body.Close())
				other := model.NewLogOther()
				other.MergePublic(metadata)
				model.RecordConsumeLog(ctx, 0, model.RecordConsumeLogParams{
					ChannelId: channel.Id, PromptTokens: prompt, CompletionTokens: completion, Other: other,
				})
			}
			recordUsage(channels[0], channels[0].Key, 10, 5, map[string]any{
				"usage_semantic": "anthropic", "cache_tokens": 20, "cache_write_tokens": 3,
			})
			recordUsage(channels[1], channels[1].Key, 15, 5, map[string]any{
				"input_tokens_total": 25, "cache_tokens": 10,
			})
			recordUsage(channels[1], "secret-retired-key-7F2A", 100, 5, nil)
			recordUsage(channels[3], channels[3].Key, 7, 3, nil)
			recordUsage(channels[4], channels[4].Key, 18, 2, nil)
			upstreamStatus = http.StatusTooManyRequests
			recordUsage(channels[1], channels[1].Key, 100, 5, nil)
			now := time.Now().In(time.FixedZone("UTC+8", 8*60*60))
			start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
			keyRef := model.AgentPlanKeyRef(channels[0].Key)
			oldMetadata, err := common.Marshal(map[string]string{"agent_plan_key_ref": keyRef})
			require.NoError(t, err)
			require.NoError(t, model.LOG_DB.Create(&model.Log{
				CreatedAt: start.Unix() - 1, Type: model.LogTypeConsume, ChannelId: channels[0].Id,
				PromptTokens: 500, Other: string(oldMetadata),
			}).Error)
			rootLogs := []*model.Log{{Other: string(oldMetadata)}}
			model.FormatRootLogs(rootLogs)
			assert.NotContains(t, rootLogs[0].Other, keyRef)

			var calledMu sync.Mutex
			calls := map[string]int{}
			limitPersonal := false
			originalTransport := http.DefaultTransport
			http.DefaultTransport = agentPlanTestTransport(func(request *http.Request) (*http.Response, error) {
				action := request.URL.Query().Get("Action")
				calledMu.Lock()
				calls[action]++
				calledMu.Unlock()
				assert.Equal(t, http.MethodPost, request.Method)
				assert.Equal(t, "2024-01-01", request.URL.Query().Get("Version"))
				if action == "GetCodingPlanUsage" {
					assert.Equal(t, "open.volcengineapi.com", request.URL.Host)
					assert.Contains(t, request.Header.Get("Authorization"), "Credential=fixture-coding-ak/")
				} else {
					assert.Equal(t, "ark.cn-beijing.volcengineapi.com", request.URL.Host)
					assert.Contains(t, request.Header.Get("Authorization"), "Credential=fixture-ak/")
				}
				assert.NotEmpty(t, request.Header.Get("X-Content-Sha256"))
				body, readErr := io.ReadAll(request.Body)
				assert.NoError(t, readErr)
				_ = request.Body.Close()
				status := http.StatusOK
				var json string
				switch action {
				case "GetAFPUsage":
					assert.JSONEq(t, `{}`, string(body))
					json = `{"Result":{"AFPFiveHour":{"Quota":"1000","Used":"880.25","ResetTime":1795237320000},"AFPDaily":{"Quota":"0","Used":"0"}}}`
					if limitPersonal {
						status = http.StatusTooManyRequests
					}
				case "GetSeatAFPUsage":
					assert.JSONEq(t, `{"SeatIDs":["seat-a","seat-b"]}`, string(body))
					json = `{"Result":{"SeatAFPUsages":[{"SeatID":"seat-b","AFPMonthly":{"Quota":"50000","Used":"100"}},{"SeatID":"seat-a","AFPWeekly":{"Quota":"10000","Used":"3600"}}]}}`
				case "GetCodingPlanUsage":
					assert.JSONEq(t, `{}`, string(body))
					json = `{"Result":{"QuotaUsage":[{"Level":"session","Percent":15.25,"ResetTimestamp":1795237320},{"Level":"weekly","Percent":0},{"Level":"monthly","Percent":2}]}}`
				default:
					t.Errorf("unexpected upstream action: %s", action)
				}
				return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(json))}, nil
			})
			t.Cleanup(func() { http.DefaultTransport = originalTransport })

			handler := agentPlanQuotaHandler{}
			assert.True(t, handler.Enabled())
			assert.Equal(t, time.Minute, handler.Interval())
			run := func() {
				created, err := model.CreateSystemTask(handler.Type(), nil, nil)
				require.NoError(t, err)
				task, claimed, err := model.ClaimSystemTask(created.ID, handler.Type(), "test-node", time.Now().Add(time.Minute).Unix())
				require.NoError(t, err)
				require.True(t, claimed)
				handler.Run(t.Context(), task, "test-node")
			}
			fetch := func() []agentPlanQuotaView {
				recorder := httptest.NewRecorder()
				ctx, _ := gin.CreateTestContext(recorder)
				ctx.Request = httptest.NewRequest(http.MethodGet, "/", nil)
				GetChannelAgentPlanQuotas(ctx)
				assert.Equal(t, http.StatusOK, recorder.Code)
				assert.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
				assert.NotContains(t, recorder.Body.String(), "secret-")
				assert.NotContains(t, recorder.Body.String(), "fixture-")
				assert.NotContains(t, recorder.Body.String(), keyRef)
				var response struct {
					Success bool
					Data    []agentPlanQuotaView
				}
				require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
				require.True(t, response.Success, recorder.Body.String())
				require.Len(t, response.Data, 4)
				return response.Data
			}
			run()
			// A newly queued run must not hide the last completed snapshot.
			pending, err := model.CreateSystemTask(handler.Type(), nil, nil)
			require.NoError(t, err)
			views := fetch()
			assert.Equal(t, "ok", views[0].Status)
			assert.EqualValues(t, 1796399999, views[0].ExpiresAt)
			require.Len(t, views[0].Keys, 1)
			assert.Equal(t, "••••7F2A", views[0].Keys[0].Label)
			require.Len(t, views[0].Keys[0].Channels, 2)
			personal := views[0].Keys[0]
			assert.Equal(t, channels[0].Id, personal.Channels[0].ID)
			assert.Equal(t, channels[1].Id, personal.Channels[1].ID)
			require.NotNil(t, personal.TodayTokens)
			assert.EqualValues(t, 68, *personal.TodayTokens)
			require.NotNil(t, personal.Channels[0].TodayTokens)
			assert.EqualValues(t, 38, *personal.Channels[0].TodayTokens)
			require.NotNil(t, personal.Channels[1].TodayTokens)
			assert.EqualValues(t, 30, *personal.Channels[1].TodayTokens)
			require.Len(t, views[1].Keys, 1)
			require.NotNil(t, views[1].Keys[0].TodayTokens)
			assert.Zero(t, *views[1].Keys[0].TodayTokens)
			require.Len(t, views[0].Windows, 1)
			require.NotNil(t, views[0].Windows[0].Used)
			assert.Equal(t, 880.25, *views[0].Windows[0].Used)
			assert.EqualValues(t, 1795237320, views[0].Windows[0].ResetAt)
			require.Len(t, views[1].Windows, 1)
			assert.Equal(t, "weekly", views[1].Windows[0].Period)
			require.Len(t, views[2].Windows, 1)
			assert.Equal(t, "monthly", views[2].Windows[0].Period)
			coding := views[3]
			assert.Equal(t, "coding-plan", coding.Product)
			assert.Equal(t, "ok", coding.Status)
			require.Len(t, coding.Windows, 3)
			require.NotNil(t, coding.Windows[0].UsedPercent)
			assert.Equal(t, 15.25, *coding.Windows[0].UsedPercent)
			assert.Nil(t, coding.Windows[0].Quota)
			assert.EqualValues(t, 1795237320, coding.Windows[0].ResetAt)
			require.Len(t, coding.Keys, 1)
			require.Len(t, coding.Keys[0].Channels, 2)
			require.NotNil(t, coding.Keys[0].TodayTokens)
			assert.EqualValues(t, 30, *coding.Keys[0].TodayTokens)
			require.NotNil(t, coding.Keys[0].Channels[0].TodayTokens)
			require.NotNil(t, coding.Keys[0].Channels[1].TodayTokens)
			assert.EqualValues(t, 10, *coding.Keys[0].Channels[0].TodayTokens)
			assert.EqualValues(t, 20, *coding.Keys[0].Channels[1].TodayTokens)

			task, claimed, err := model.ClaimSystemTask(pending.ID, handler.Type(), "test-node", time.Now().Add(time.Minute).Unix())
			require.NoError(t, err)
			require.True(t, claimed)
			limitPersonal = true
			handler.Run(t.Context(), task, "test-node")
			stale := fetch()
			assert.Equal(t, "rate_limited", stale[0].Status)
			assert.Equal(t, views[0].LastSuccessAt, stale[0].LastSuccessAt)
			assert.Equal(t, views[0].Windows, stale[0].Windows)
			assert.Equal(t, "ok", stale[1].Status)
			assert.Equal(t, map[string]int{"GetAFPUsage": 2, "GetSeatAFPUsage": 2, "GetCodingPlanUsage": 2}, calls)
			common.LogConsumeEnabled = false
			assert.Nil(t, fetch()[0].Keys[0].TodayTokens)
		})
	}
}
