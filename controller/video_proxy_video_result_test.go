package controller

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	tasktechmobi "github.com/QuantumNous/new-api/relay/channel/task/techmobi"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestArchivedTechMobiVideoRedirect(t *testing.T) {
	t.Run("success returns private redirect without cache", func(t *testing.T) {
		resetVideoResultMetricsForControllerTest(t)
		recorder, c := newArchivedVideoProxyContext("task_signed")
		channel := &model.Channel{Type: constant.ChannelTypeTechMobiVideo}
		task := archivedTechMobiTask(time.Now().Add(time.Hour).Unix())
		var called bool
		installArchivedVideoResultSigner(t, func(_ context.Context, taskID string, result *model.VideoResult) (string, error) {
			called = true
			require.Equal(t, "task_signed", taskID)
			require.Same(t, task.PrivateData.VideoResult, result)
			return "https://signed.example/download?X-Goog-Signature=secret", nil
		})

		require.True(t, tryRedirectArchivedTechMobiVideo(c, task, channel))
		require.True(t, called)
		require.Equal(t, http.StatusFound, recorder.Code)
		require.Equal(t, "https://signed.example/download?X-Goog-Signature=secret", recorder.Header().Get("Location"))
		require.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
		require.Equal(t, "no-cache", recorder.Header().Get("Pragma"))
		require.Empty(t, recorder.Body.String())
		text, err := perfmetrics.BuildPrometheusText(context.Background())
		require.NoError(t, err)
		require.Contains(t, text, `newapi_video_result_redirect_total{channel="techmobi",outcome="success"} 1`)
	})

	t.Run("expired returns 410 sanitized error", func(t *testing.T) {
		resetVideoResultMetricsForControllerTest(t)
		recorder, c := newArchivedVideoProxyContext("task_signed")
		channel := &model.Channel{Type: constant.ChannelTypeTechMobiVideo}
		installArchivedVideoResultSigner(t, func(context.Context, string, *model.VideoResult) (string, error) {
			return "", service.ErrVideoResultExpired
		})

		require.True(t, tryRedirectArchivedTechMobiVideo(c, archivedTechMobiTask(time.Now().Add(-time.Hour).Unix()), channel))
		require.Equal(t, http.StatusGone, recorder.Code)
		require.Contains(t, recorder.Body.String(), "video result has expired")
		require.NotContains(t, recorder.Body.String(), "video-bucket")
		require.NotContains(t, recorder.Body.String(), "video-results/")
		text, err := perfmetrics.BuildPrometheusText(context.Background())
		require.NoError(t, err)
		require.Contains(t, text, `newapi_video_result_redirect_total{channel="techmobi",outcome="expired"} 1`)
	})

	t.Run("unavailable returns 502 sanitized error", func(t *testing.T) {
		resetVideoResultMetricsForControllerTest(t)
		recorder, c := newArchivedVideoProxyContext("task_signed")
		channel := &model.Channel{Type: constant.ChannelTypeTechMobiVideo}
		installArchivedVideoResultSigner(t, func(context.Context, string, *model.VideoResult) (string, error) {
			return "", service.ErrVideoResultUnavailable
		})

		require.True(t, tryRedirectArchivedTechMobiVideo(c, archivedTechMobiTask(time.Now().Add(time.Hour).Unix()), channel))
		require.Equal(t, http.StatusBadGateway, recorder.Code)
		require.NotContains(t, recorder.Body.String(), "video-bucket")
		text, err := perfmetrics.BuildPrometheusText(context.Background())
		require.NoError(t, err)
		require.Contains(t, text, `newapi_video_result_redirect_total{channel="techmobi",outcome="unavailable"} 1`)
	})

	t.Run("signing returns 503 sanitized error", func(t *testing.T) {
		resetVideoResultMetricsForControllerTest(t)
		recorder, c := newArchivedVideoProxyContext("task_signed")
		channel := &model.Channel{Type: constant.ChannelTypeTechMobiVideo}
		installArchivedVideoResultSigner(t, func(context.Context, string, *model.VideoResult) (string, error) {
			return "", errors.New("secret https://storage.googleapis.com/video-bucket/object?X-Goog-Signature=abc")
		})

		require.True(t, tryRedirectArchivedTechMobiVideo(c, archivedTechMobiTask(time.Now().Add(time.Hour).Unix()), channel))
		require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
		require.NotContains(t, recorder.Body.String(), "secret")
		require.NotContains(t, recorder.Body.String(), "storage.googleapis.com")
		text, err := perfmetrics.BuildPrometheusText(context.Background())
		require.NoError(t, err)
		require.Contains(t, text, `newapi_video_result_redirect_total{channel="techmobi",outcome="signing-or-other"} 1`)
		require.NotContains(t, text, `outcome="error"`)
	})

	t.Run("nil metadata returns false and does not call signer", func(t *testing.T) {
		_, c := newArchivedVideoProxyContext("task_signed")
		channel := &model.Channel{Type: constant.ChannelTypeTechMobiVideo}
		var called bool
		installArchivedVideoResultSigner(t, func(context.Context, string, *model.VideoResult) (string, error) {
			called = true
			return "", nil
		})
		task := archivedTechMobiTask(time.Now().Add(time.Hour).Unix())
		task.PrivateData.VideoResult = nil

		require.False(t, tryRedirectArchivedTechMobiVideo(c, task, channel))
		require.False(t, called)
	})

	t.Run("other channel returns false", func(t *testing.T) {
		_, c := newArchivedVideoProxyContext("task_signed")
		channel := &model.Channel{Type: constant.ChannelTypeOpenAI}
		var called bool
		installArchivedVideoResultSigner(t, func(context.Context, string, *model.VideoResult) (string, error) {
			called = true
			return "", nil
		})

		require.False(t, tryRedirectArchivedTechMobiVideo(c, archivedTechMobiTask(time.Now().Add(time.Hour).Unix()), channel))
		require.False(t, called)
	})
}

func TestArchivedModelAPIVideoRedirect(t *testing.T) {
	t.Run("success returns private redirect without cache", func(t *testing.T) {
		resetVideoResultMetricsForControllerTest(t)
		recorder, c := newArchivedVideoProxyContext("task_modelapi")
		channel := &model.Channel{Type: constant.ChannelTypeModelAPISeedance}
		task := archivedModelAPITask(time.Now().Add(time.Hour).Unix())
		installArchivedVideoResultSigner(t, func(_ context.Context, taskID string, result *model.VideoResult) (string, error) {
			require.Equal(t, "task_modelapi", taskID)
			require.Same(t, task.PrivateData.VideoResult, result)
			return "https://signed.example/download?X-Goog-Signature=secret", nil
		})

		require.True(t, tryRedirectArchivedVideoResult(c, task, channel))
		require.Equal(t, http.StatusFound, recorder.Code)
		require.Equal(t, "https://signed.example/download?X-Goog-Signature=secret", recorder.Header().Get("Location"))
		require.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
		require.Equal(t, "no-cache", recorder.Header().Get("Pragma"))
		require.Empty(t, recorder.Body.String())
		text, err := perfmetrics.BuildPrometheusText(context.Background())
		require.NoError(t, err)
		require.Contains(t, text, `newapi_video_result_redirect_total{channel="modelapi",outcome="success"} 1`)
	})

	errorCases := []struct {
		name          string
		signErr       error
		wantStatus    int
		wantBody      string
		wantMetric    string
		secretSnippet string
	}{
		{
			name:       "expired returns 410 sanitized error",
			signErr:    service.ErrVideoResultExpired,
			wantStatus: http.StatusGone,
			wantBody:   "video result has expired",
			wantMetric: `newapi_video_result_redirect_total{channel="modelapi",outcome="expired"} 1`,
		},
		{
			name:       "unavailable returns 502 sanitized error",
			signErr:    service.ErrVideoResultUnavailable,
			wantStatus: http.StatusBadGateway,
			wantBody:   "video result is unavailable",
			wantMetric: `newapi_video_result_redirect_total{channel="modelapi",outcome="unavailable"} 1`,
		},
		{
			name:          "signing returns 503 sanitized error",
			signErr:       errors.New("secret https://storage.googleapis.com/video-bucket/object?X-Goog-Signature=abc"),
			wantStatus:    http.StatusServiceUnavailable,
			wantBody:      "video result is temporarily unavailable",
			wantMetric:    `newapi_video_result_redirect_total{channel="modelapi",outcome="signing-or-other"} 1`,
			secretSnippet: "storage.googleapis.com",
		},
	}
	for _, tc := range errorCases {
		t.Run(tc.name, func(t *testing.T) {
			resetVideoResultMetricsForControllerTest(t)
			recorder, c := newArchivedVideoProxyContext("task_modelapi")
			channel := &model.Channel{Type: constant.ChannelTypeModelAPISeedance}
			installArchivedVideoResultSigner(t, func(context.Context, string, *model.VideoResult) (string, error) {
				return "", tc.signErr
			})

			require.True(t, tryRedirectArchivedVideoResult(c, archivedModelAPITask(time.Now().Add(time.Hour).Unix()), channel))
			require.Equal(t, tc.wantStatus, recorder.Code)
			require.Contains(t, recorder.Body.String(), tc.wantBody)
			require.NotContains(t, recorder.Body.String(), "video-bucket")
			if tc.secretSnippet != "" {
				require.NotContains(t, recorder.Body.String(), tc.secretSnippet)
			}
			text, err := perfmetrics.BuildPrometheusText(context.Background())
			require.NoError(t, err)
			require.Contains(t, text, tc.wantMetric)
		})
	}
}

func TestModelAPIVideoProxyWithoutArchiveDoesNotFetchUpstream(t *testing.T) {
	restore := useVideoProxyDBForTest(t)
	defer restore()
	gin.SetMode(gin.TestMode)

	var upstreamHits int
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		upstreamHits++
		w.Header().Set("Content-Type", "video/mp4")
		_, _ = w.Write([]byte("upstream bytes"))
	}))
	defer upstream.Close()

	channel := &model.Channel{
		Id:      11101,
		Type:    constant.ChannelTypeModelAPISeedance,
		Key:     "modelapi-key",
		Name:    "modelapi",
		BaseURL: common.GetPointer(upstream.URL),
	}
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, model.DB.Create(&model.Task{
		TaskID:    "task_modelapi_no_archive",
		Status:    model.TaskStatusSuccess,
		ChannelId: channel.Id,
		Data:      []byte(`{"status":"succeeded","content":[{"type":"video_url","video_url":{"url":"` + upstream.URL + `/output.mp4"}}]}`),
	}).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Params = gin.Params{{Key: "task_id", Value: "task_modelapi_no_archive"}}
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/videos/task_modelapi_no_archive/content", nil)

	VideoProxy(c)

	require.Equal(t, http.StatusBadGateway, recorder.Code)
	require.Contains(t, recorder.Body.String(), "video result is unavailable")
	require.Equal(t, 0, upstreamHits)
}

func TestLegacyTechMobiVideoProxyUsesExtractorWhenMetadataNil(t *testing.T) {
	_, c := newArchivedVideoProxyContext("task_legacy")
	channel := &model.Channel{Type: constant.ChannelTypeTechMobiVideo}
	var called bool
	installArchivedVideoResultSigner(t, func(context.Context, string, *model.VideoResult) (string, error) {
		called = true
		return "", nil
	})
	task := &model.Task{
		TaskID:      "task_legacy",
		Status:      model.TaskStatusSuccess,
		PrivateData: model.TaskPrivateData{},
		Data:        []byte(`{"status":"succeeded","content":[{"type":"video_url","video_url":{"url":"https://cdn.example.com/output.mp4"}}]}`),
	}

	require.False(t, tryRedirectArchivedTechMobiVideo(c, task, channel))
	require.False(t, called)
	require.Equal(t, "https://cdn.example.com/output.mp4", tasktechmobi.ExtractUpstreamVideoURL(task.Data))
}

func resetVideoResultMetricsForControllerTest(t *testing.T) {
	t.Helper()
	perfmetrics.ResetVideoResultMetricsForTest()
	t.Cleanup(perfmetrics.ResetVideoResultMetricsForTest)
}

func newArchivedVideoProxyContext(taskID string) (*httptest.ResponseRecorder, *gin.Context) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Params = gin.Params{{Key: "task_id", Value: taskID}}
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/videos/"+taskID+"/content", nil)
	return recorder, c
}

func archivedTechMobiTask(expiresAt int64) *model.Task {
	return &model.Task{
		TaskID: "task_signed",
		Status: model.TaskStatusSuccess,
		PrivateData: model.TaskPrivateData{
			VideoResult: &model.VideoResult{
				Bucket:      "video-bucket",
				Object:      "video-results/20260806/task_signed.mp4",
				Generation:  7,
				ContentType: "video/mp4",
				Size:        42,
				ExpiresAt:   expiresAt,
			},
		},
		Data: []byte(`{"status":"succeeded","content":[{"type":"video_url","video_url":{"url":"https://cdn.example.com/output.mp4"}}]}`),
	}
}

func archivedModelAPITask(expiresAt int64) *model.Task {
	return &model.Task{
		TaskID: "task_modelapi",
		Status: model.TaskStatusSuccess,
		PrivateData: model.TaskPrivateData{
			VideoResult: &model.VideoResult{
				Bucket:      "video-bucket",
				Object:      "video-results/20260806/task_modelapi.mp4",
				Generation:  7,
				ContentType: "video/mp4",
				Size:        42,
				ExpiresAt:   expiresAt,
			},
		},
	}
}

func installArchivedVideoResultSigner(t *testing.T, signer func(context.Context, string, *model.VideoResult) (string, error)) {
	t.Helper()
	original := signArchivedVideoResultDownload
	signArchivedVideoResultDownload = signer
	t.Cleanup(func() { signArchivedVideoResultDownload = original })
}

func useVideoProxyDBForTest(t *testing.T) func() {
	t.Helper()
	originalDB := model.DB
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Task{}))
	model.DB = db
	common.MemoryCacheEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	return func() {
		model.DB = originalDB
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
	}
}
