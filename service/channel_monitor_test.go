package service

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestChannelMonitorSecretEncryptionAndMasking(t *testing.T) {
	originalSecret := common.CryptoSecret
	t.Cleanup(func() {
		common.CryptoSecret = originalSecret
	})

	common.CryptoSecret = "channel-monitor-secret-a"
	encrypted, err := common.EncryptSecret("sk-test-secret")
	require.NoError(t, err)
	require.NotContains(t, encrypted, "sk-test-secret")

	plain, err := common.DecryptSecret(encrypted)
	require.NoError(t, err)
	require.Equal(t, "sk-test-secret", plain)
	require.Equal(t, "sk-t***", MaskChannelMonitorAPIKey(plain))
	require.Equal(t, "***", MaskChannelMonitorAPIKey("abc"))

	common.CryptoSecret = "channel-monitor-secret-b"
	_, err = common.DecryptSecret(encrypted)
	require.Error(t, err)

	_, err = common.DecryptSecret("legacy-plain-secret")
	require.Error(t, err)
}

func TestValidateMonitorEndpointRejectsUnsafeTargets(t *testing.T) {
	tests := []struct {
		name     string
		endpoint string
		wantErr  error
	}{
		{name: "http scheme", endpoint: "http://api.example.com", wantErr: ErrChannelMonitorEndpointScheme},
		{name: "path", endpoint: "https://api.example.com/v1", wantErr: ErrChannelMonitorEndpointPath},
		{name: "query", endpoint: "https://api.example.com?key=1", wantErr: ErrChannelMonitorEndpointPath},
		{name: "localhost", endpoint: "https://localhost", wantErr: ErrChannelMonitorEndpointPrivate},
		{name: "private ipv4", endpoint: "https://10.1.2.3", wantErr: ErrChannelMonitorEndpointPrivate},
		{name: "link local", endpoint: "https://169.254.169.254", wantErr: ErrChannelMonitorEndpointPrivate},
		{name: "metadata host", endpoint: "https://metadata.google.internal", wantErr: ErrChannelMonitorEndpointPrivate},
		{name: "ipv6 loopback", endpoint: "https://[::1]", wantErr: ErrChannelMonitorEndpointPrivate},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.ErrorIs(t, validateMonitorEndpoint(tt.endpoint), tt.wantErr)
		})
	}
}

func TestValidateMonitorIntervalAndJitter(t *testing.T) {
	require.NoError(t, validateMonitorInterval(15))
	require.NoError(t, validateMonitorJitter(0, 15))
	require.NoError(t, validateMonitorJitter(45, 60))
	require.ErrorIs(t, validateMonitorInterval(14), ErrChannelMonitorInvalidInterval)
	require.ErrorIs(t, validateMonitorJitter(-1, 60), ErrChannelMonitorInvalidJitter)
	require.ErrorIs(t, validateMonitorJitter(46, 60), ErrChannelMonitorInvalidJitter)
}

func TestChannelMonitorCheckerProviders(t *testing.T) {
	server := newChannelMonitorCheckerServer(t, func(r *http.Request, answer string) (int, string) {
		switch r.URL.Path {
		case providerOpenAIPath:
			return http.StatusOK, fmt.Sprintf(`{"choices":[{"message":{"content":"%s"}}]}`, answer)
		case providerOpenAIResponsesPath:
			return http.StatusOK, fmt.Sprintf(`{"output":[{"type":"message","content":[{"type":"output_text","text":"%s"}]}]}`, answer)
		case providerAnthropicPath:
			return http.StatusOK, fmt.Sprintf(`{"content":[{"type":"text","text":"%s"}]}`, answer)
		case "/v1beta/models/gemini-1.5-flash:generateContent":
			return http.StatusOK, fmt.Sprintf(`{"candidates":[{"content":{"parts":[{"text":"%s"}]}}]}`, answer)
		default:
			return http.StatusNotFound, `{"error":"not found"}`
		}
	})

	tests := []struct {
		name     string
		provider string
		apiMode  string
		model    string
	}{
		{name: "openai chat completions", provider: MonitorProviderOpenAI, apiMode: MonitorAPIModeChatCompletions, model: "gpt-4o-mini"},
		{name: "openai responses", provider: MonitorProviderOpenAI, apiMode: MonitorAPIModeResponses, model: "gpt-4.1"},
		{name: "anthropic", provider: MonitorProviderAnthropic, apiMode: MonitorAPIModeChatCompletions, model: "claude-3-5-sonnet"},
		{name: "gemini", provider: MonitorProviderGemini, apiMode: MonitorAPIModeChatCompletions, model: "gemini-1.5-flash"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := runChannelMonitorCheckForModel(context.Background(), tt.provider, tt.apiMode, server.URL, "test-key", tt.model)
			require.Equal(t, MonitorStatusOperational, result.Status)
			require.Empty(t, result.Message)
			require.NotNil(t, result.LatencyMs)
		})
	}
}

func TestChannelMonitorCheckerFailureModes(t *testing.T) {
	t.Run("non 2xx is error", func(t *testing.T) {
		server := newChannelMonitorCheckerServer(t, func(r *http.Request, answer string) (int, string) {
			return http.StatusServiceUnavailable, `{"error":"down"}`
		})
		result := runChannelMonitorCheckForModel(context.Background(), MonitorProviderOpenAI, MonitorAPIModeChatCompletions, server.URL, "test-key", "gpt-test")
		require.Equal(t, MonitorStatusError, result.Status)
		require.Contains(t, result.Message, "upstream HTTP 503")
	})

	t.Run("empty response is failed", func(t *testing.T) {
		server := newChannelMonitorCheckerServer(t, func(r *http.Request, answer string) (int, string) {
			return http.StatusOK, `{}`
		})
		result := runChannelMonitorCheckForModel(context.Background(), MonitorProviderOpenAI, MonitorAPIModeChatCompletions, server.URL, "test-key", "gpt-test")
		require.Equal(t, MonitorStatusFailed, result.Status)
		require.Contains(t, result.Message, "challenge mismatch")
	})

	t.Run("challenge mismatch is failed", func(t *testing.T) {
		server := newChannelMonitorCheckerServer(t, func(r *http.Request, answer string) (int, string) {
			return http.StatusOK, `{"choices":[{"message":{"content":"99999"}}]}`
		})
		result := runChannelMonitorCheckForModel(context.Background(), MonitorProviderOpenAI, MonitorAPIModeChatCompletions, server.URL, "test-key", "gpt-test")
		require.Equal(t, MonitorStatusFailed, result.Status)
		require.Contains(t, result.Message, "challenge mismatch")
	})

	t.Run("slow response is degraded", func(t *testing.T) {
		server := newChannelMonitorCheckerServer(t, func(r *http.Request, answer string) (int, string) {
			time.Sleep(monitorDegradedThreshold + 100*time.Millisecond)
			return http.StatusOK, fmt.Sprintf(`{"choices":[{"message":{"content":"%s"}}]}`, answer)
		})
		result := runChannelMonitorCheckForModel(context.Background(), MonitorProviderOpenAI, MonitorAPIModeChatCompletions, server.URL, "test-key", "gpt-test")
		require.Equal(t, MonitorStatusDegraded, result.Status)
		require.Contains(t, result.Message, "slow response")
	})
}

func TestChannelMonitorAggregationWithSQLite(t *testing.T) {
	setupChannelMonitorServiceTestDB(t)
	now := time.Now().UTC()
	monitor := model.ChannelMonitor{
		Name:            "monitor",
		Provider:        MonitorProviderOpenAI,
		APIMode:         MonitorAPIModeChatCompletions,
		Endpoint:        "https://api.example.com",
		APIKeyEncrypted: "encrypted",
		PrimaryModel:    "gpt-primary",
		ExtraModels:     "[]",
		Enabled:         true,
		UserVisible:     boolPtr(true),
		IntervalSeconds: 60,
		CreatedBy:       1,
	}
	require.NoError(t, model.DB.Create(&monitor).Error)

	latency100 := 100
	latency200 := 200
	latency400 := 400
	require.NoError(t, model.DB.Create(&[]model.ChannelMonitorHistory{
		{MonitorID: monitor.Id, Model: "gpt-primary", Status: MonitorStatusOperational, LatencyMs: &latency100, CheckedAt: now.Add(-1 * time.Hour)},
		{MonitorID: monitor.Id, Model: "gpt-primary", Status: MonitorStatusDegraded, LatencyMs: &latency200, CheckedAt: now.Add(-2 * time.Hour)},
		{MonitorID: monitor.Id, Model: "gpt-primary", Status: MonitorStatusFailed, LatencyMs: &latency400, CheckedAt: now.Add(-3 * time.Hour)},
		{MonitorID: monitor.Id, Model: "gpt-primary", Status: MonitorStatusError, CheckedAt: now.AddDate(0, 0, -20)},
		{MonitorID: monitor.Id, Model: "gpt-extra", Status: MonitorStatusOperational, LatencyMs: &latency100, CheckedAt: now.Add(-30 * time.Minute)},
	}).Error)

	latest, err := model.ListLatestChannelMonitorHistoryForIDs([]int64{monitor.Id})
	require.NoError(t, err)
	require.Len(t, latest[monitor.Id], 2)
	require.Equal(t, MonitorStatusOperational, latestSliceToMap(latest[monitor.Id])["gpt-extra"].Status)

	availability7, err := model.ComputeChannelMonitorAvailabilityForIDs([]int64{monitor.Id}, 7)
	require.NoError(t, err)
	byModel := availabilitySliceToMap(availability7[monitor.Id])
	require.InDelta(t, 66.66, byModel["gpt-primary"].AvailabilityPct, 0.5)
	require.Equal(t, 233, *byModel["gpt-primary"].AvgLatencyMs)

	availability30, err := model.ComputeChannelMonitorAvailabilityForIDs([]int64{monitor.Id}, 30)
	require.NoError(t, err)
	byModel = availabilitySliceToMap(availability30[monitor.Id])
	require.InDelta(t, 50.0, byModel["gpt-primary"].AvailabilityPct, 0.1)
}

func TestChannelMonitorSummaryUsesAvailabilityHealth(t *testing.T) {
	setupChannelMonitorServiceTestDB(t)
	now := time.Now().UTC()
	monitor := createChannelMonitorTestRecord(t, "availability-health", true, true)

	rows := make([]model.ChannelMonitorHistory, 0, 6)
	for i := 1; i <= 5; i++ {
		rows = append(rows, model.ChannelMonitorHistory{
			MonitorID: monitor.Id,
			Model:     monitor.PrimaryModel,
			Status:    MonitorStatusOperational,
			CheckedAt: now.Add(time.Duration(-i) * time.Hour),
		})
	}
	rows = append(rows, model.ChannelMonitorHistory{
		MonitorID: monitor.Id,
		Model:     monitor.PrimaryModel,
		Status:    MonitorStatusFailed,
		CheckedAt: now.Add(-1 * time.Minute),
	})
	require.NoError(t, model.DB.Create(&rows).Error)

	summaries := BatchChannelMonitorStatusSummary(context.Background(), []*model.ChannelMonitor{&monitor})
	summary := summaries[monitor.Id]

	require.InDelta(t, 83.33, summary.Availability7d, 0.1)
	require.Equal(t, MonitorStatusOperational, summary.PrimaryStatus)
}

func TestChannelMonitorSummaryDegradesWhenAvailabilityIsLow(t *testing.T) {
	setupChannelMonitorServiceTestDB(t)
	now := time.Now().UTC()
	monitor := createChannelMonitorTestRecord(t, "availability-low", true, true)

	require.NoError(t, model.DB.Create(&[]model.ChannelMonitorHistory{
		{MonitorID: monitor.Id, Model: monitor.PrimaryModel, Status: MonitorStatusOperational, CheckedAt: now.Add(-2 * time.Hour)},
		{MonitorID: monitor.Id, Model: monitor.PrimaryModel, Status: MonitorStatusFailed, CheckedAt: now.Add(-1 * time.Hour)},
		{MonitorID: monitor.Id, Model: monitor.PrimaryModel, Status: MonitorStatusFailed, CheckedAt: now.Add(-1 * time.Minute)},
	}).Error)

	summaries := BatchChannelMonitorStatusSummary(context.Background(), []*model.ChannelMonitor{&monitor})
	summary := summaries[monitor.Id]

	require.InDelta(t, 33.33, summary.Availability7d, 0.1)
	require.Equal(t, MonitorStatusDegraded, summary.PrimaryStatus)
}

func TestChannelMonitorDetailUsesAvailabilityHealth(t *testing.T) {
	setupChannelMonitorServiceTestDB(t)
	now := time.Now().UTC()
	monitor := createChannelMonitorTestRecord(t, "detail-health", true, true)
	latestLatency := 30005

	require.NoError(t, model.DB.Create(&[]model.ChannelMonitorHistory{
		{MonitorID: monitor.Id, Model: monitor.PrimaryModel, Status: MonitorStatusOperational, CheckedAt: now.Add(-3 * time.Hour)},
		{MonitorID: monitor.Id, Model: monitor.PrimaryModel, Status: MonitorStatusOperational, CheckedAt: now.Add(-2 * time.Hour)},
		{MonitorID: monitor.Id, Model: monitor.PrimaryModel, Status: MonitorStatusOperational, CheckedAt: now.Add(-1 * time.Hour)},
		{MonitorID: monitor.Id, Model: monitor.PrimaryModel, Status: MonitorStatusError, LatencyMs: &latestLatency, CheckedAt: now.Add(-1 * time.Minute)},
	}).Error)

	detail, err := GetUserChannelMonitorDetail(context.Background(), monitor.Id, true)
	require.NoError(t, err)
	require.Len(t, detail.Models, 1)
	require.InDelta(t, 75.0, detail.Models[0].Availability7d, 0.1)
	require.Equal(t, MonitorStatusDegraded, detail.Models[0].LatestStatus)
	require.Equal(t, 30005, *detail.Models[0].LatestLatencyMs)
}

func TestChannelMonitorUserVisibilityFilteringWithSQLite(t *testing.T) {
	setupChannelMonitorServiceTestDB(t)
	visible := createChannelMonitorTestRecord(t, "visible", true, true)
	hidden := createChannelMonitorTestRecord(t, "hidden", true, false)
	disabled := createChannelMonitorTestRecord(t, "disabled", false, true)

	enabled, err := model.ListEnabledChannelMonitors()
	require.NoError(t, err)
	require.ElementsMatch(t, []int64{visible.Id, hidden.Id}, channelMonitorIDs(enabled))

	userVisible, err := model.ListUserVisibleChannelMonitors()
	require.NoError(t, err)
	require.Equal(t, []int64{visible.Id}, channelMonitorIDs(userVisible))

	views, err := ListUserChannelMonitorViews(context.Background(), false)
	require.NoError(t, err)
	require.Len(t, views, 1)
	require.Equal(t, visible.Id, views[0].ID)
	require.False(t, views[0].AdminOnly)

	adminViews, err := ListUserChannelMonitorViews(context.Background(), true)
	require.NoError(t, err)
	require.ElementsMatch(t, []int64{visible.Id, hidden.Id}, userMonitorViewIDs(adminViews))
	visibleView := userMonitorViewByID(adminViews, visible.Id)
	require.NotNil(t, visibleView)
	require.False(t, visibleView.AdminOnly)
	hiddenView := userMonitorViewByID(adminViews, hidden.Id)
	require.NotNil(t, hiddenView)
	require.True(t, hiddenView.AdminOnly)

	_, err = GetUserChannelMonitorDetail(context.Background(), hidden.Id, false)
	require.ErrorIs(t, err, ErrChannelMonitorNotFound)
	adminDetail, err := GetUserChannelMonitorDetail(context.Background(), hidden.Id, true)
	require.NoError(t, err)
	require.True(t, adminDetail.AdminOnly)
	_, err = GetUserChannelMonitorDetail(context.Background(), disabled.Id, true)
	require.ErrorIs(t, err, ErrChannelMonitorNotFound)
}

func TestChannelMonitorRunnerScheduleImmediateFire(t *testing.T) {
	runner := newChannelMonitorRunner()
	calls := make(chan int64, 4)
	runner.checkFunc = func(_ context.Context, id int64) ([]*CheckResult, error) {
		calls <- id
		return nil, nil
	}
	runner.reloadFunc = nil

	enabled := &model.ChannelMonitor{Id: 1, Enabled: true, IntervalSeconds: 15}
	runner.Schedule(enabled)
	t.Cleanup(runner.Stop)

	require.Eventually(t, func() bool {
		return channelMonitorRunnerTaskCount(runner) == 1
	}, time.Second, 10*time.Millisecond)

	select {
	case id := <-calls:
		require.EqualValues(t, 1, id)
	case <-time.After(time.Second):
		t.Fatal("expected immediate channel monitor check")
	}
}

func TestChannelMonitorRunnerScheduleReplaceAndUnschedule(t *testing.T) {
	runner := newChannelMonitorRunner()
	runner.checkFunc = func(_ context.Context, _ int64) ([]*CheckResult, error) {
		return nil, nil
	}
	runner.reloadFunc = nil
	t.Cleanup(runner.Stop)

	disabled := &model.ChannelMonitor{Id: 1, Enabled: false, IntervalSeconds: 15}
	runner.Schedule(disabled)
	require.Empty(t, channelMonitorRunnerTaskCount(runner))

	enabled := &model.ChannelMonitor{Id: 1, Enabled: true, IntervalSeconds: 15}
	runner.Schedule(enabled)
	require.Eventually(t, func() bool {
		return channelMonitorRunnerTaskCount(runner) == 1
	}, time.Second, 10*time.Millisecond)
	first := channelMonitorRunnerTask(runner, 1)
	require.NotNil(t, first)

	runner.Schedule(enabled)
	second := channelMonitorRunnerTask(runner, 1)
	require.NotNil(t, second)
	require.NotSame(t, first, second)

	runner.Unschedule(1)
	require.Eventually(t, func() bool {
		return channelMonitorRunnerTaskCount(runner) == 0
	}, time.Second, 10*time.Millisecond)
}

func TestChannelMonitorRunnerStopCancelsInFlightCheck(t *testing.T) {
	runner := newChannelMonitorRunner()
	started := make(chan struct{}, 1)
	runner.checkFunc = func(ctx context.Context, _ int64) ([]*CheckResult, error) {
		started <- struct{}{}
		<-ctx.Done()
		return nil, ctx.Err()
	}
	runner.reloadFunc = nil

	runner.Schedule(&model.ChannelMonitor{Id: 1, Enabled: true, IntervalSeconds: 15})
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("expected immediate channel monitor check")
	}

	done := make(chan struct{})
	go func() {
		runner.Stop()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("expected Stop to cancel in-flight channel monitor check")
	}
}

func TestChannelMonitorRunnerInFlightGuards(t *testing.T) {
	runner := newChannelMonitorRunner()
	t.Cleanup(runner.Stop)

	require.True(t, runner.tryEnter(1))
	require.False(t, runner.tryEnter(1))
	runner.leave(1)
	require.True(t, runner.tryEnter(1))
	runner.leave(1)
}

func channelMonitorRunnerTaskCount(runner *channelMonitorRunner) int {
	runner.mu.Lock()
	defer runner.mu.Unlock()
	return len(runner.tasks)
}

func channelMonitorRunnerTask(runner *channelMonitorRunner, id int64) *channelMonitorTask {
	runner.mu.Lock()
	defer runner.mu.Unlock()
	return runner.tasks[id]
}

type channelMonitorTestResponder func(r *http.Request, answer string) (status int, body string)

func newChannelMonitorCheckerServer(t *testing.T, responder channelMonitorTestResponder) *httptest.Server {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		answer := answerMonitorChallengeFromBody(t, body)
		status, responseBody := responder(r, answer)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(responseBody))
	}))

	oldHTTPClient := monitorHTTPClient
	monitorHTTPClient = server.Client()
	t.Cleanup(func() {
		monitorHTTPClient = oldHTTPClient
		server.Close()
	})

	return server
}

var monitorChallengeBodyRegex = regexp.MustCompile(`Q: (\d+) ([+-]) (\d+) = \?`)

func answerMonitorChallengeFromBody(t *testing.T, body []byte) string {
	t.Helper()
	matches := monitorChallengeBodyRegex.FindAllSubmatch(body, -1)
	require.NotEmpty(t, matches)
	last := matches[len(matches)-1]
	left, err := strconv.Atoi(string(last[1]))
	require.NoError(t, err)
	right, err := strconv.Atoi(string(last[3]))
	require.NoError(t, err)
	switch string(last[2]) {
	case "+":
		return strconv.Itoa(left + right)
	case "-":
		return strconv.Itoa(left - right)
	default:
		t.Fatalf("unexpected operator %q", string(last[2]))
		return ""
	}
}

func setupChannelMonitorServiceTestDB(t *testing.T) {
	t.Helper()
	oldDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	require.NoError(t, db.AutoMigrate(&model.ChannelMonitor{}, &model.ChannelMonitorHistory{}))
	t.Cleanup(func() {
		model.DB = oldDB
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
}

func createChannelMonitorTestRecord(t *testing.T, name string, enabled bool, userVisible bool) model.ChannelMonitor {
	t.Helper()
	monitor := model.ChannelMonitor{
		Name:            name,
		Provider:        MonitorProviderOpenAI,
		APIMode:         MonitorAPIModeChatCompletions,
		Endpoint:        "https://api.example.com",
		APIKeyEncrypted: "encrypted",
		PrimaryModel:    "gpt-primary",
		ExtraModels:     "[]",
		Enabled:         enabled,
		UserVisible:     boolPtr(userVisible),
		IntervalSeconds: 60,
		CreatedBy:       1,
	}
	require.NoError(t, model.DB.Create(&monitor).Error)
	if !enabled {
		require.NoError(t, model.DB.Model(&monitor).Update("enabled", false).Error)
		monitor.Enabled = false
	}
	require.NotNil(t, monitor.UserVisible)
	require.Equal(t, userVisible, *monitor.UserVisible)
	return monitor
}

func channelMonitorIDs(items []*model.ChannelMonitor) []int64 {
	ids := make([]int64, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.Id)
	}
	return ids
}

func userMonitorViewIDs(items []*UserMonitorView) []int64 {
	ids := make([]int64, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.ID)
	}
	return ids
}

func userMonitorViewByID(items []*UserMonitorView, id int64) *UserMonitorView {
	for _, item := range items {
		if item.ID == id {
			return item
		}
	}
	return nil
}
