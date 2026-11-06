package service

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// hwQualityTestSetup brings the quality tables into the shared test database
// and clears them.
func hwQualityTestSetup(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.AutoMigrate(&model.HwQualityRun{}, &model.HwQualityScore{}))
	require.NoError(t, model.DB.Exec("DELETE FROM hw_quality_scores").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM hw_quality_runs").Error)
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM hw_quality_scores")
		model.DB.Exec("DELETE FROM hw_quality_runs")
	})
}

// TestHwQualityTasksetCoversLanguagesAndKinds guards the embedded set: at
// least ten tasks, Turkish and English, all four kinds, unique ids.
func TestHwQualityTasksetCoversLanguagesAndKinds(t *testing.T) {
	tasks, err := HwQualityTasks()
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(tasks), 10)
	kinds := map[string]bool{}
	languages := map[string]bool{}
	for _, task := range tasks {
		kinds[task.Kind] = true
		languages[task.Language] = true
		assert.NotEmpty(t, task.Criteria)
		assert.NotEmpty(t, task.Prompt)
	}
	for _, kind := range []string{"math", "code", "summary", "translation"} {
		assert.True(t, kinds[kind], "task set must cover kind %s", kind)
	}
	assert.True(t, languages["tr"])
	assert.True(t, languages["en"])
}

// hwQualityFakeGateway doubles the customer route: it answers model calls with
// a fixed answer and token counts, and judge calls with a fixed score. Every
// judge request body is kept so the test can prove the judge is blind.
type hwQualityFakeGateway struct {
	server      *httptest.Server
	mu          sync.Mutex
	judgeBodies []string
	answerCount int
}

func newHwQualityFakeGateway(t *testing.T, judgeScore int, answer string) *hwQualityFakeGateway {
	t.Helper()
	gateway := &hwQualityFakeGateway{}
	gateway.server = hwStartTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		// The handler runs on its own goroutine, so failures are recorded and
		// answered as an error instead of failing the test directly.
		if !assert.Equal(t, "/v1/chat/completions", r.URL.Path) ||
			!assert.Equal(t, "Bearer hw-test-key-not-a-real-secret", r.Header.Get("Authorization")) {
			http.Error(w, "unexpected request", http.StatusBadRequest)
			return
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "read failed", http.StatusBadRequest)
			return
		}
		var request struct {
			Model    string `json:"model"`
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
		}
		if !assert.NoError(t, common.Unmarshal(body, &request)) {
			http.Error(w, "unreadable body", http.StatusBadRequest)
			return
		}
		if request.Model == "hw-test-judge" {
			gateway.mu.Lock()
			gateway.judgeBodies = append(gateway.judgeBodies, string(body))
			gateway.mu.Unlock()
			// The judge answers through the customer route too: a normal chat
			// completion whose content is the JSON verdict.
			verdict, err := common.Marshal(fmt.Sprintf(`{"score": %d}`, judgeScore))
			if err != nil {
				http.Error(w, "marshal failed", http.StatusInternalServerError)
				return
			}
			writeJSON(w, `{"choices":[{"message":{"role":"assistant","content":`+string(verdict)+`}}],`+
				`"usage":{"prompt_tokens":80,"completion_tokens":8}}`)
			return
		}
		gateway.mu.Lock()
		gateway.answerCount++
		count := gateway.answerCount
		gateway.mu.Unlock()
		quoted, err := common.Marshal(answer + fmt.Sprintf("-%d", count))
		if err != nil {
			http.Error(w, "marshal failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, `{"choices":[{"message":{"role":"assistant","content":`+
			string(quoted)+`}}],`+
			`"usage":{"prompt_tokens":100,"completion_tokens":50}}`)
	})
	return gateway
}

func writeJSON(w http.ResponseWriter, body string) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(body))
}

// TestHwQualityRunMeasuresJudgesBlindAndWritesFile runs the whole meter against
// the fake gateway: scores, tokens, and latency per task; a judge that never
// sees the measured model's name; and the JSON measurement file on disk.
func TestHwQualityRunMeasuresJudgesBlindAndWritesFile(t *testing.T) {
	hwQualityTestSetup(t)
	gateway := newHwQualityFakeGateway(t, 7, "hw sample answer")
	outDir := t.TempDir()
	clockStep := int64(0)
	nowFunc := func() time.Time {
		clockStep++
		return time.Date(2026, 10, 20, 8, 0, 0, 0, time.UTC).Add(time.Duration(clockStep) * 7 * time.Millisecond)
	}

	run, err := HwRunQualityMeasurement(context.Background(), HwQualityRunOptions{
		BaseURL:    gateway.server.URL,
		APIKey:     "hw-test-key-not-a-real-secret",
		JudgeModel: "hw-test-judge",
		Models:     []string{"claude-sonnet-5-5", "claude-opus-5-5"},
		OutDir:     outDir,
		Client:     gateway.server.Client(),
		NowFunc:    nowFunc,
	})
	require.NoError(t, err)

	tasks, err := HwQualityTasks()
	require.NoError(t, err)

	var scores []model.HwQualityScore
	require.NoError(t, model.DB.Where("run_id = ?", run.Id).Order("model, task_id").Find(&scores).Error)
	require.Len(t, scores, 2*len(tasks))
	for _, score := range scores {
		assert.Equal(t, 7, score.Score)
		assert.Equal(t, 100, score.TokensIn)
		assert.Equal(t, 50, score.TokensOut)
		assert.Greater(t, score.LatencyMs, int64(0))
		assert.Contains(t, []string{model.HwQualityReferencePending, model.HwQualityReferenceNone}, score.Reference)
		if strings.HasPrefix(score.Model, "claude") {
			assert.Equal(t, model.HwQualityReferencePending, score.Reference)
		} else {
			assert.Equal(t, model.HwQualityReferenceNone, score.Reference)
		}
	}

	// The measurement file exists and carries every score back to disk.
	filePath := filepath.Join(outDir, run.FileName)
	content, err := os.ReadFile(filePath)
	require.NoError(t, err)
	var file struct {
		GeneratedAt    int64  `json:"generated_at"`
		TasksetVersion string `json:"taskset_version"`
		JudgeModel     string `json:"judge_model"`
		SampleNote     string `json:"sample_note"`
		Models         []struct {
			Model     string `json:"model"`
			Reference string `json:"reference"`
			Tasks     []struct {
				TaskId    string `json:"task_id"`
				Score     int    `json:"score"`
				TokensIn  int    `json:"tokens_in"`
				TokensOut int    `json:"tokens_out"`
			} `json:"tasks"`
		} `json:"models"`
	}
	require.NoError(t, common.Unmarshal(content, &file))
	require.Len(t, file.Models, 2)
	for _, measured := range file.Models {
		require.Len(t, measured.Tasks, len(tasks))
		for _, taskResult := range measured.Tasks {
			assert.Equal(t, 7, taskResult.Score)
			assert.Equal(t, 100, taskResult.TokensIn)
			assert.Equal(t, 50, taskResult.TokensOut)
		}
	}
	assert.NotEmpty(t, file.SampleNote)
	assert.NotEmpty(t, file.TasksetVersion)

	// The judge is blind: its requests carry the task and the answer, never
	// the name of the measured model.
	gateway.mu.Lock()
	defer gateway.mu.Unlock()
	require.Len(t, gateway.judgeBodies, 2*len(tasks))
	for _, body := range gateway.judgeBodies {
		lower := strings.ToLower(body)
		assert.NotContains(t, lower, "claude-sonnet-5-5")
		assert.NotContains(t, lower, "claude-opus-5-5")
		assert.Contains(t, body, "hw sample answer")
		assert.Contains(t, body, "Grading criteria")
		// The primary supplier drops customer system messages, so the grading
		// instruction must reach the judge inside the user message.
		assert.NotContains(t, body, `"role":"system"`)
		assert.Contains(t, body, "You are a grader")
	}

	// The public summary aggregates the same run.
	summary, err := HwLatestQualitySummary()
	require.NoError(t, err)
	require.Len(t, summary.Models, 2)
	assert.Equal(t, run.FileName, summary.FileName)
	assert.Equal(t, 7.0, summary.Models[0].AvgScore)
	for _, measured := range summary.Models {
		assert.Len(t, measured.Tasks, len(tasks))
		assert.Greater(t, measured.AvgLatencyMs, int64(0))
	}
	assert.NotEmpty(t, summary.Note)
	assert.NotEmpty(t, summary.NoteEn)
}

// TestHwQualityLatestWithoutRunIsEmpty pins the empty answer: no run, no
// invented values, but the sample note stays.
func TestHwQualityLatestWithoutRunIsEmpty(t *testing.T) {
	hwQualityTestSetup(t)
	summary, err := HwLatestQualitySummary()
	require.NoError(t, err)
	require.NotNil(t, summary.Models)
	assert.Empty(t, summary.Models)
	assert.Equal(t, int64(0), summary.MeasuredAt)
	assert.Empty(t, summary.FileName)
	assert.NotEmpty(t, summary.Note)
}

// TestHwQualityRunRefusesIncompleteConfig keeps the meter from starting with a
// missing endpoint, key, judge, or output directory.
func TestHwQualityRunRefusesIncompleteConfig(t *testing.T) {
	hwQualityTestSetup(t)
	_, err := HwRunQualityMeasurement(context.Background(), HwQualityRunOptions{
		BaseURL: "http://localhost:1",
		APIKey:  "hw-test-key-not-a-real-secret",
	})
	require.Error(t, err)
	var count int64
	require.NoError(t, model.DB.Model(&model.HwQualityRun{}).Count(&count).Error)
	assert.Equal(t, int64(0), count)
}

// hwTrafficTestSetup starts every observed-quality test from an empty log
// table and an empty cache.
func hwTrafficTestSetup(t *testing.T) {
	t.Helper()
	reset := func() {
		model.LOG_DB.Exec("DELETE FROM logs")
		hwQualityTrafficCache.Lock()
		hwQualityTrafficCache.traffic = nil
		hwQualityTrafficCache.builtAt = time.Time{}
		hwQualityTrafficCache.Unlock()
	}
	reset()
	t.Cleanup(reset)
}

// hwTrafficTestLog writes one relay row as the gateway would.
func hwTrafficTestLog(t *testing.T, logType int, modelName string, group string, createdAt int64, useTime int, outputTokens int, requestID string) {
	t.Helper()
	require.NoError(t, model.LOG_DB.Create(&model.Log{
		Type:             logType,
		ModelName:        modelName,
		Group:            group,
		CreatedAt:        createdAt,
		UseTime:          useTime,
		CompletionTokens: outputTokens,
		RequestId:        requestID,
	}).Error)
}

// TestHwQualityTrafficFromCustomerLogs pins the public figures on a known log:
// retried attempts that were served in the end are no failures, a failed
// request counts once however often it was retried, internal groups and unsold
// models stay out, and each window only sees its own days.
func TestHwQualityTrafficFromCustomerLogs(t *testing.T) {
	hwTrafficTestSetup(t)
	now := time.Unix(1_800_000_000, 0)
	recent := now.Unix() - 3600
	const sonnet = "claude-sonnet-5-5"

	// 30 served requests in the last seven days: 20 of 2 s, 8 of 4 s and 2 of
	// 10 s, 100 output tokens each, spread over both customer groups.
	served := 0
	for _, run := range []struct{ count, seconds int }{{20, 2}, {8, 4}, {2, 10}} {
		for range run.count {
			group := model.HwFreeGroupName
			if served%2 == 0 {
				group = model.HwPaidGroupName
			}
			hwTrafficTestLog(t, model.LogTypeConsume, sonnet, group, recent, run.seconds, 100, fmt.Sprintf("served-%d", served))
			served++
		}
	}
	// Two served requests had a failed attempt first: not a failure.
	hwTrafficTestLog(t, model.LogTypeError, sonnet, model.HwPaidGroupName, recent-1, 0, 0, "served-0")
	hwTrafficTestLog(t, model.LogTypeError, sonnet, model.HwPaidGroupName, recent-1, 0, 0, "served-1")
	// Three requests failed on every attempt, two attempts each.
	for i := range 3 {
		id := fmt.Sprintf("failed-%d", i)
		hwTrafficTestLog(t, model.LogTypeError, sonnet, model.HwPaidGroupName, recent, 0, 0, id)
		hwTrafficTestLog(t, model.LogTypeError, sonnet, model.HwPaidGroupName, recent, 1, 0, id)
	}
	// Ten served requests of 1 s ten days ago: only in the thirty-day window.
	for i := range 10 {
		hwTrafficTestLog(t, model.LogTypeConsume, sonnet, model.HwFreeGroupName, now.Unix()-10*24*3600, 1, 50, fmt.Sprintf("old-%d", i))
	}
	// Outside every window, outside the customer groups, or not sold here.
	hwTrafficTestLog(t, model.LogTypeConsume, sonnet, model.HwPaidGroupName, now.Unix()-40*24*3600, 60, 1, "ancient")
	hwTrafficTestLog(t, model.LogTypeConsume, sonnet, "default", recent, 60, 1, "internal")
	hwTrafficTestLog(t, model.LogTypeError, sonnet, "default", recent, 0, 0, "internal-failed")
	hwTrafficTestLog(t, model.LogTypeConsume, "not-sold-model", model.HwPaidGroupName, recent, 1, 1, "unsold")
	// A model with too few requests shows its count and no figures.
	for i := range 5 {
		hwTrafficTestLog(t, model.LogTypeConsume, "claude-haiku-5-5", model.HwFreeGroupName, recent, 3, 10, fmt.Sprintf("haiku-%d", i))
	}

	traffic, err := HwReadQualityTrafficAt(now)
	require.NoError(t, err)
	require.Len(t, traffic.Windows, 2)
	assert.Equal(t, HwQualityTrafficMinRequests, traffic.MinRequests)

	week := traffic.Windows[0]
	assert.Equal(t, 7, week.Days)
	require.Len(t, week.Models, 2)
	sonnetWeek := week.Models[0]
	assert.Equal(t, sonnet, sonnetWeek.Model)
	assert.Equal(t, int64(33), sonnetWeek.Requests)
	assert.Equal(t, int64(3), sonnetWeek.Failed)
	assert.True(t, sonnetWeek.EnoughData)
	require.NotNil(t, sonnetWeek.SuccessPercent)
	assert.InDelta(t, 90.91, *sonnetWeek.SuccessPercent, 1e-9)
	require.NotNil(t, sonnetWeek.MedianSeconds)
	assert.Equal(t, 2, *sonnetWeek.MedianSeconds)
	require.NotNil(t, sonnetWeek.P95Seconds)
	assert.Equal(t, 10, *sonnetWeek.P95Seconds)
	require.NotNil(t, sonnetWeek.OutputTokensPerSecond)
	assert.InDelta(t, 32.6, *sonnetWeek.OutputTokensPerSecond, 1e-9) // 3000 tokens over 92 s

	haikuWeek := week.Models[1]
	assert.Equal(t, "claude-haiku-5-5", haikuWeek.Model)
	assert.Equal(t, int64(5), haikuWeek.Requests)
	assert.False(t, haikuWeek.EnoughData)
	assert.Nil(t, haikuWeek.SuccessPercent)
	assert.Nil(t, haikuWeek.MedianSeconds)
	assert.Nil(t, haikuWeek.P95Seconds)
	assert.Nil(t, haikuWeek.OutputTokensPerSecond)

	month := traffic.Windows[1]
	assert.Equal(t, 30, month.Days)
	require.Len(t, month.Models, 2)
	assert.Equal(t, int64(43), month.Models[0].Requests)
	assert.Equal(t, int64(3), month.Models[0].Failed)
	require.NotNil(t, month.Models[0].MedianSeconds)
	assert.Equal(t, 2, *month.Models[0].MedianSeconds)
}

// TestHwQualityTrafficWithoutLogsIsEmpty pins the honest empty answer: both
// windows are there, without a single model and without made-up figures.
func TestHwQualityTrafficWithoutLogsIsEmpty(t *testing.T) {
	hwTrafficTestSetup(t)
	traffic, err := HwReadQualityTrafficAt(time.Unix(1_800_000_000, 0))
	require.NoError(t, err)
	require.Len(t, traffic.Windows, 2)
	for _, window := range traffic.Windows {
		require.NotNil(t, window.Models)
		assert.Empty(t, window.Models)
	}
}

// TestHwObservedModelQualityEdges covers the shapes a quiet or broken model
// produces: every request failed, every answer under a second, the minimum.
func TestHwObservedModelQualityEdges(t *testing.T) {
	allFailed := HwObservedModelQuality("m", nil, 25)
	assert.True(t, allFailed.EnoughData)
	require.NotNil(t, allFailed.SuccessPercent)
	assert.Equal(t, 0.0, *allFailed.SuccessPercent)
	assert.Nil(t, allFailed.MedianSeconds)
	assert.Nil(t, allFailed.OutputTokensPerSecond)

	subSecond := HwObservedModelQuality("m", []model.HwQualityLatencyBucket{{ModelName: "m", UseTime: 0, Requests: 20, SpeedRequests: 20, SpeedTokens: 400}}, 0)
	require.NotNil(t, subSecond.MedianSeconds)
	assert.Equal(t, 0, *subSecond.MedianSeconds)
	require.NotNil(t, subSecond.SuccessPercent)
	assert.Equal(t, 100.0, *subSecond.SuccessPercent)
	assert.Nil(t, subSecond.OutputTokensPerSecond, "no measurable time, no speed")

	justBelow := HwObservedModelQuality("m", []model.HwQualityLatencyBucket{{ModelName: "m", UseTime: 1, Requests: HwQualityTrafficMinRequests - 1}}, 0)
	assert.False(t, justBelow.EnoughData)
	assert.Equal(t, int64(HwQualityTrafficMinRequests-1), justBelow.Requests)
}

// The speed is the output of the requests that really answered over their
// duration. Pings of a few tokens and answers without output do not count, and
// a window with fewer than HwQualitySpeedMinSamples samples shows no speed.
func TestHwObservedModelQualitySpeedUsesOnlyRealAnswers(t *testing.T) {
	bucket := func(useTime int, requests, speedRequests, speedTokens int64) model.HwQualityLatencyBucket {
		return model.HwQualityLatencyBucket{ModelName: "m", UseTime: useTime, Requests: requests, SpeedRequests: speedRequests, SpeedTokens: speedTokens}
	}

	answered := HwObservedModelQuality("m", []model.HwQualityLatencyBucket{
		bucket(2, 12, 12, 768), // twelve answers of 64 tokens in 2 s
		bucket(9, 40, 0, 0),    // pings of one token
		bucket(3, 5, 0, 0),     // answers without output
	}, 0)
	require.NotNil(t, answered.OutputTokensPerSecond)
	assert.Equal(t, 32.0, *answered.OutputTokensPerSecond, "768 tokens over 24 s, the pings do not drag it down")
	assert.Equal(t, int64(57), answered.Requests, "the pings still count as requests")

	tooFew := HwObservedModelQuality("m", []model.HwQualityLatencyBucket{bucket(2, 30, HwQualitySpeedMinSamples-1, 576)}, 0)
	assert.True(t, tooFew.EnoughData)
	require.NotNil(t, tooFew.MedianSeconds, "latency still shows")
	assert.Nil(t, tooFew.OutputTokensPerSecond, "too few samples show nothing")

	onlyPings := HwObservedModelQuality("m", []model.HwQualityLatencyBucket{bucket(9, 40, 0, 0)}, 0)
	require.NotNil(t, onlyPings.MedianSeconds)
	assert.Nil(t, onlyPings.OutputTokensPerSecond, "no real answer, no speed")

	empty := HwObservedModelQuality("m", nil, 0)
	assert.Nil(t, empty.OutputTokensPerSecond, "an empty window shows nothing")
}

// On the real log path both windows use the same formula over the requests that
// produced output: the internal pings of one token and the rows without output
// leave the figure alone, and the thirty-day window only differs by its traffic.
func TestHwQualityTrafficSpeedLeavesOutPingsAndEmptyAnswers(t *testing.T) {
	hwTrafficTestSetup(t)
	now := time.Unix(1_800_000_000, 0)
	recent := now.Unix() - 3600
	const opus = "claude-opus-5-5"

	for i := range 12 {
		hwTrafficTestLog(t, model.LogTypeConsume, opus, model.HwPaidGroupName, recent, 2, 64, fmt.Sprintf("real-%d", i))
	}
	for i := range 40 {
		hwTrafficTestLog(t, model.LogTypeConsume, opus, model.HwPaidGroupName, recent, 9, 1, fmt.Sprintf("ping-%d", i))
	}
	for i := range 5 {
		hwTrafficTestLog(t, model.LogTypeConsume, opus, model.HwPaidGroupName, recent, 3, 0, fmt.Sprintf("empty-%d", i))
	}
	// Twelve older answers of 90 tokens in 3 s: only in the thirty-day window.
	for i := range 12 {
		hwTrafficTestLog(t, model.LogTypeConsume, opus, model.HwPaidGroupName, now.Unix()-10*24*3600, 3, 90, fmt.Sprintf("old-%d", i))
	}

	traffic, err := HwReadQualityTrafficAt(now)
	require.NoError(t, err)
	require.Len(t, traffic.Windows, 2)

	week := traffic.Windows[0].Models
	require.Len(t, week, 1)
	assert.Equal(t, int64(57), week[0].Requests)
	require.NotNil(t, week[0].OutputTokensPerSecond)
	assert.Equal(t, 32.0, *week[0].OutputTokensPerSecond, "768 tokens over 24 s")

	month := traffic.Windows[1].Models
	require.Len(t, month, 1)
	assert.Equal(t, int64(69), month[0].Requests)
	require.NotNil(t, month[0].OutputTokensPerSecond)
	assert.Equal(t, 30.8, *month[0].OutputTokensPerSecond, "(768 + 1080) tokens over (24 + 36) s")
}

// TestHwQualityTrafficNowRefreshesAfterTenMinutes keeps the public read cheap:
// within the refresh period a new log row does not trigger a new read, after
// it the figures follow the log.
func TestHwQualityTrafficNowRefreshesAfterTenMinutes(t *testing.T) {
	hwTrafficTestSetup(t)
	now := time.Unix(1_800_000_000, 0)
	first, err := HwQualityTrafficNow(now)
	require.NoError(t, err)
	assert.Empty(t, first.Windows[0].Models)

	hwTrafficTestLog(t, model.LogTypeConsume, "claude-sonnet-5-5", model.HwPaidGroupName, now.Unix(), 2, 10, "fresh")

	cached, err := HwQualityTrafficNow(now.Add(9 * time.Minute))
	require.NoError(t, err)
	assert.Empty(t, cached.Windows[0].Models)

	refreshed, err := HwQualityTrafficNow(now.Add(10 * time.Minute))
	require.NoError(t, err)
	require.Len(t, refreshed.Windows[0].Models, 1)
	assert.Equal(t, int64(1), refreshed.Windows[0].Models[0].Requests)
}

// TestHwQualityRunRefusesASecondRunWhileOneRuns keeps a double click or a second
// admin from starting a parallel pass that doubles the gateway spend.
func TestHwQualityRunRefusesASecondRunWhileOneRuns(t *testing.T) {
	hwQualityTestSetup(t)
	started := make(chan struct{})
	release := make(chan struct{})
	var once sync.Once
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		once.Do(func() { close(started) })
		<-release
		http.Error(w, "stopped", http.StatusInternalServerError)
	}))
	t.Cleanup(server.Close)
	opts := HwQualityRunOptions{
		BaseURL:    server.URL,
		APIKey:     "hw-test-key-not-a-real-secret",
		JudgeModel: "hw-test-judge",
		Models:     []string{"claude-sonnet-5-5"},
		OutDir:     t.TempDir(),
		Client:     server.Client(),
	}
	first := make(chan error, 1)
	go func() {
		_, err := HwRunQualityMeasurement(context.Background(), opts)
		first <- err
	}()
	<-started

	_, err := HwRunQualityMeasurement(context.Background(), opts)
	assert.ErrorIs(t, err, ErrHwQualityRunBusy)

	close(release)
	require.Error(t, <-first)
	// The slot is free again once the first run ended.
	_, err = HwRunQualityMeasurement(context.Background(), HwQualityRunOptions{})
	require.Error(t, err)
	assert.NotErrorIs(t, err, ErrHwQualityRunBusy)
}

// The measurement run refuses to start on missing values, so the environment
// reader must trim the text values, keep the key as it was set and leave the
// client to the runner's default.
func TestHwQualityRunOptionsFromEnvTrimsAndLeavesMissingValuesEmpty(t *testing.T) {
	t.Setenv(HwQualityBaseURLEnv, "  https://api.example.test  ")
	t.Setenv(HwQualityAPIKeyEnv, "test-key")
	t.Setenv(HwQualityJudgeModelEnv, " judge-model ")
	t.Setenv(HwQualityOutDirEnv, "")

	options := HwQualityRunOptionsFromEnv()

	assert.Equal(t, "https://api.example.test", options.BaseURL)
	assert.Equal(t, "test-key", options.APIKey)
	assert.Equal(t, "judge-model", options.JudgeModel)
	assert.Empty(t, options.OutDir)
	assert.Empty(t, options.Models)
	assert.Nil(t, options.Client)
	assert.Nil(t, options.NowFunc)
}

// The probe translation is where a refusal becomes "no evidence": 429, 401 and
// 403 are the route refusing us (quota exhausted, key rejected), and so is a
// call that outlives the probe deadline (slow is not down), while a 5xx, an
// empty answer or a network error say the model itself did not answer. Getting this wrong turns an exhausted quota into a false outage of
// the whole offer (HwPurgeFalseIdleOutages exists for that alarm) or hides a
// real 503.
func TestHwToStatusProbeCallsAQuotaRefusalNoEvidence(t *testing.T) {
	cases := []struct {
		name    string
		status  int
		body    string
		network bool
		slow    bool
		want    model.HwStatusProbeOutcome
	}{
		{name: "answered", status: http.StatusOK, body: `{"choices":[{"message":{"role":"assistant","content":"pong"}}]}`, want: model.HwStatusProbeAnswered},
		{name: "quota exhausted", status: http.StatusTooManyRequests, body: `{"error":"rate limited"}`, want: model.HwStatusProbeUnavailable},
		{name: "key rejected", status: http.StatusUnauthorized, body: `{"error":"bad key"}`, want: model.HwStatusProbeUnavailable},
		{name: "key forbidden", status: http.StatusForbidden, body: `{"error":"forbidden"}`, want: model.HwStatusProbeUnavailable},
		{name: "upstream broken", status: http.StatusInternalServerError, body: `{"error":"boom"}`, want: model.HwStatusProbeNoAnswer},
		{name: "upstream unavailable", status: http.StatusServiceUnavailable, body: `{"error":"down"}`, want: model.HwStatusProbeNoAnswer},
		{name: "no answer in the body", status: http.StatusOK, body: `{"choices":[]}`, want: model.HwStatusProbeNoAnswer},
		{name: "network error", network: true, want: model.HwStatusProbeNoAnswer},
		{name: "slower than the deadline", slow: true, want: model.HwStatusProbeUnavailable},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tc.slow {
					// The upstream answers, but later than the probe waits.
					select {
					case <-r.Context().Done():
					case <-time.After(2 * time.Second):
					}
					return
				}
				if tc.network {
					// A hijacked connection closed without an answer is a
					// network error on the client side.
					conn, _, err := w.(http.Hijacker).Hijack()
					require.NoError(t, err)
					conn.Close()
					return
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.body))
			}))
			t.Cleanup(server.Close)

			ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
			defer cancel()
			outcome := hwToStatusProbe(server.Client(), server.URL, "hw-test-key-not-a-real-secret")(
				ctx, "claude-sonnet-5-5",
			)
			assert.Equal(t, tc.want, outcome)
		})
	}
}
