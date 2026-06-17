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

func TestChannelMonitorRunnerScheduleAndInFlightGuards(t *testing.T) {
	runner := newChannelMonitorRunner()
	disabled := &model.ChannelMonitor{Id: 1, Enabled: false, IntervalSeconds: 15}
	runner.Schedule(disabled)
	require.Empty(t, runner.entries)

	enabled := &model.ChannelMonitor{Id: 1, Enabled: true, IntervalSeconds: 15}
	runner.Schedule(enabled)
	require.Len(t, runner.entries, 1)
	t.Cleanup(func() {
		runner.Unschedule(1)
	})

	require.True(t, runner.tryEnter(1))
	require.False(t, runner.tryEnter(1))
	runner.leave(1)
	require.True(t, runner.tryEnter(1))
	runner.leave(1)
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
