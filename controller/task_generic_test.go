package controller

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaychannel "github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupGenericTaskTest(t *testing.T) *model.Task {
	t.Helper()
	originalDB := model.DB
	previousRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	// The dialect harness lets the same fixture run against MySQL and
	// PostgreSQL when TEST_TASK_DB_DIALECT selects them; SQLite stays the default.
	database, _ := openTaskDialectDatabase(t, &model.Task{}, &model.Channel{}, &model.User{})
	model.DB = database
	t.Cleanup(func() {
		model.DB = originalDB
		common.RedisEnabled = previousRedisEnabled
	})

	require.NoError(t, database.Create(&model.User{
		Id: 7, Username: "artifact-owner", Status: common.UserStatusEnabled,
		Role: common.RoleCommonUser, Group: "default",
	}).Error)
	baseURL := "https://example.com"
	require.NoError(t, database.Create(&model.Channel{
		Id: 1, Name: "artifact", Key: "key", BaseURL: &baseURL, Status: common.ChannelStatusEnabled,
	}).Error)
	task := &model.Task{
		TaskID: "task_generic", Platform: "document", UserId: 7, ChannelId: 1,
		Status: model.TaskStatusSuccess, Progress: "100%", SubmitTime: 10, FinishTime: 20,
	}
	require.NoError(t, database.Create(task).Error)
	return task
}

func allowPrivateTaskMediaTest(t *testing.T) {
	t.Helper()
	originalFetchSetting := *system_setting.GetFetchSetting()
	system_setting.GetFetchSetting().EnableSSRFProtection = true
	system_setting.GetFetchSetting().AllowPrivateIp = true
	system_setting.GetFetchSetting().AllowedPorts = []string{"1-65535"}
	t.Cleanup(func() { *system_setting.GetFetchSetting() = originalFetchSetting })
	service.InitHttpClient()
}

func TestGetTaskDoesNotProjectArtifacts(t *testing.T) {
	task := setupGenericTaskTest(t)
	task.FailReason = "https://stale-upstream.invalid/video.mp4"
	task.PrivateData = model.TaskPrivateData{
		ResultURL: "https://private-upstream.invalid/video.mp4",
		Execution: &model.TaskExecutionSnapshot{
			TaskPlugin: &model.TaskPluginSnapshot{Key: "missing-plugin", Name: "Missing"},
		},
	}
	require.NoError(t, model.DB.Save(task).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", 7)
	c.Params = gin.Params{{Key: "key", Value: task.TaskID}}
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/tasks/"+task.TaskID, nil)

	GetTask(c)

	assert.Equal(t, http.StatusOK, recorder.Code)
	var response map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Equal(t, task.TaskID, response["task_id"])
	assert.NotContains(t, response, "artifacts")
	assert.NotContains(t, recorder.Body.String(), "upstream.invalid")
}

func TestGetTaskArtifactsReturnsEmptyForLegacyTask(t *testing.T) {
	task := setupGenericTaskTest(t)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", task.UserId)
	c.Params = gin.Params{{Key: "key", Value: task.TaskID}}
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/tasks/"+task.TaskID+"/artifacts", nil)

	GetTaskArtifacts(c)

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "private, no-store", recorder.Header().Get("Cache-Control"))
	var response struct {
		TaskID    string                 `json:"task_id"`
		Artifacts []taskArtifactResponse `json:"artifacts"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Equal(t, task.TaskID, response.TaskID)
	assert.Empty(t, response.Artifacts)
}

func TestTaskArtifactAuthorizationKeepsForeignTasksHidden(t *testing.T) {
	task := setupGenericTaskTest(t)

	commonUser, _ := gin.CreateTestContext(httptest.NewRecorder())
	commonUser.Set("id", 8)
	commonUser.Set("role", common.RoleCommonUser)
	_, exists, err := getTaskForArtifactRequest(commonUser, task.TaskID)
	require.NoError(t, err)
	assert.False(t, exists)

	admin, _ := gin.CreateTestContext(httptest.NewRecorder())
	admin.Set("id", 8)
	admin.Set("role", common.RoleAdminUser)
	found, exists, err := getTaskForArtifactRequest(admin, task.TaskID)
	require.NoError(t, err)
	require.True(t, exists)
	assert.Equal(t, task.TaskID, found.TaskID)

	apiToken, _ := gin.CreateTestContext(httptest.NewRecorder())
	apiToken.Set("id", 8)
	apiToken.Set("role", common.RoleRootUser)
	apiToken.Set("token_id", 99)
	_, exists, err = getTaskForArtifactRequest(apiToken, task.TaskID)
	require.NoError(t, err)
	assert.False(t, exists)
}

func TestDashboardTaskArtifactsReturnsLegacyCapabilityWithoutUpstreamURL(t *testing.T) {
	task := setupGenericTaskTest(t)
	previousSecret := common.CryptoSecret
	previousPublicAddress := system_setting.TaskPublicAddress
	common.CryptoSecret = "controller-task-artifact-access-secret"
	system_setting.TaskPublicAddress = "https://gateway.example/prefix"
	t.Cleanup(func() {
		common.CryptoSecret = previousSecret
		system_setting.TaskPublicAddress = previousPublicAddress
	})
	task.Action = constant.TaskActionTextToVideo
	task.FailReason = "https://upstream.invalid/private-video.mp4?signature=secret"
	require.NoError(t, model.DB.Save(task).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", task.UserId)
	c.Set("role", common.RoleCommonUser)
	c.Params = gin.Params{{Key: "task_id", Value: task.TaskID}}
	c.Request = httptest.NewRequest(http.MethodGet, "/api/task/"+task.TaskID+"/artifacts", nil)

	GetDashboardTaskArtifacts(c)

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "private, no-store", recorder.Header().Get("Cache-Control"))
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			Artifacts        []taskArtifactResponse `json:"artifacts"`
			LegacyContentURL string                 `json:"legacy_content_url"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Empty(t, response.Data.Artifacts)
	contentURL, err := url.Parse(response.Data.LegacyContentURL)
	require.NoError(t, err)
	assert.Equal(t, "/prefix/v1/tasks/"+task.TaskID+"/artifacts/video/content", contentURL.Path)
	assert.True(t, service.VerifyTaskArtifactAccess(
		contentURL.Query().Get(service.TaskArtifactAccessQueryParameter),
		task.TaskID,
		"video",
	))
	assert.NotContains(t, recorder.Body.String(), "upstream.invalid")
	assert.NotContains(t, recorder.Body.String(), "signature=secret")
}

// Task lists no longer carry the persisted snapshot, so the dashboard reads a
// legacy Suno task's playable clips from the artifacts endpoint instead.
func TestDashboardTaskArtifactsProjectsLegacySunoAudioClips(t *testing.T) {
	task := setupGenericTaskTest(t)
	task.Platform = constant.TaskPlatformSuno
	task.Action = "MUSIC"
	task.Data = []byte(`[{"id":"clip-1","title":"Song","audio_url":"https://cdn.example/a.mp3","metadata":{"tags":"pop","duration":30},"lyric":"private"},{"id":"clip-2","title":"No audio"}]`)
	require.NoError(t, model.DB.Save(task).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", task.UserId)
	c.Set("role", common.RoleCommonUser)
	c.Params = gin.Params{{Key: "task_id", Value: task.TaskID}}
	c.Request = httptest.NewRequest(http.MethodGet, "/api/task/"+task.TaskID+"/artifacts", nil)

	GetDashboardTaskArtifacts(c)

	assert.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			Artifacts        []taskArtifactResponse `json:"artifacts"`
			LegacyAudioClips []map[string]any       `json:"legacy_audio_clips"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Empty(t, response.Data.Artifacts)
	require.Len(t, response.Data.LegacyAudioClips, 1)
	assert.Equal(t, "https://cdn.example/a.mp3", response.Data.LegacyAudioClips[0]["audio_url"])
	assert.Equal(t, "Song", response.Data.LegacyAudioClips[0]["title"])
	assert.NotContains(t, recorder.Body.String(), "private")
}

// Task lists omit the data column; the API DTO keeps the key as null so shape
// checks survive while the payload no longer travels with every row.
func TestTaskListsOmitPersistedSnapshot(t *testing.T) {
	task := setupGenericTaskTest(t)
	task.Data = []byte(`{"data":[{"url":"https://cdn.example/a.png"}]}`)
	require.NoError(t, model.DB.Save(task).Error)

	userTasks := model.TaskGetAllUserTask(task.UserId, 0, 10, model.SyncTaskQueryParams{})
	require.Len(t, userTasks, 1)
	assert.Empty(t, userTasks[0].Data)
	adminTasks := model.TaskGetAllTasks(0, 10, model.SyncTaskQueryParams{})
	require.Len(t, adminTasks, 1)
	assert.Empty(t, adminTasks[0].Data)
	assert.Equal(t, task.TaskID, adminTasks[0].TaskID)

	encoded, err := common.Marshal(tasksToDto(adminTasks, false, common.RoleAdminUser)[0])
	require.NoError(t, err)
	assert.Contains(t, string(encoded), `"data":null`)
	assert.NotContains(t, string(encoded), `"result_discarded"`)

	adminTasks[0].PrivateData.ResultDiscarded = true
	encoded, err = common.Marshal(tasksToDto(adminTasks, false, common.RoleAdminUser)[0])
	require.NoError(t, err)
	assert.Contains(t, string(encoded), `"result_discarded":true`, "task lists tell the UI that an inline result was not retained")

	stored, exists, err := model.GetByTaskId(task.UserId, task.TaskID)
	require.NoError(t, err)
	require.True(t, exists)
	assert.JSONEq(t, string(task.Data), string(stored.Data), "single-task lookups keep the snapshot")
}

func TestTaskArtifactAccessRequiresActiveOwner(t *testing.T) {
	task := setupGenericTaskTest(t)
	task.Action = constant.TaskActionTextToVideo
	task.FailReason = "https://upstream.invalid/private-video.mp4"
	require.NoError(t, model.DB.Save(task).Error)
	require.NoError(t, model.DB.Model(&model.User{}).
		Where("id = ?", task.UserId).
		Update("status", common.UserStatusDisabled).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set(middleware.TaskArtifactAccessContextKey, true)
	c.Params = gin.Params{
		{Key: "key", Value: task.TaskID},
		{Key: "artifact_key", Value: "video"},
	}
	c.Request = httptest.NewRequest(
		http.MethodGet,
		"/v1/tasks/"+task.TaskID+"/artifacts/video/content",
		nil,
	)

	TaskArtifactContent(c)

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Equal(t, "private, no-store", recorder.Header().Get("Cache-Control"))
}

func TestTaskArtifactAccessRejectsAmbiguousHistoricalTaskID(t *testing.T) {
	task := setupGenericTaskTest(t)
	task.Action = constant.TaskActionTextToVideo
	task.FailReason = "https://first-upstream.invalid/video.mp4"
	require.NoError(t, model.DB.Save(task).Error)
	require.NoError(t, model.DB.Create(&model.User{
		Id: 8, Username: "other-artifact-owner", Status: common.UserStatusEnabled,
		Role: common.RoleCommonUser, Group: "default", AffCode: "artifact-owner-8",
	}).Error)
	require.NoError(t, model.DB.Create(&model.Task{
		TaskID: task.TaskID, Platform: task.Platform, UserId: 8, ChannelId: task.ChannelId,
		Action: constant.TaskActionTextToVideo, Status: model.TaskStatusSuccess,
		FailReason: "https://second-upstream.invalid/video.mp4",
	}).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set(middleware.TaskArtifactAccessContextKey, true)
	c.Params = gin.Params{
		{Key: "key", Value: task.TaskID},
		{Key: "artifact_key", Value: "video"},
	}
	c.Request = httptest.NewRequest(
		http.MethodGet,
		"/v1/tasks/"+task.TaskID+"/artifacts/video/content",
		nil,
	)

	TaskArtifactContent(c)

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.NotContains(t, recorder.Body.String(), "upstream.invalid")
}

func TestLegacyVideoArtifactContentUsesGetResultURL(t *testing.T) {
	task := setupGenericTaskTest(t)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "bytes=0-3", r.Header.Get("Range"))
		w.Header().Set("Content-Type", "video/mp4")
		w.Header().Set("Content-Range", "bytes 0-3/4")
		w.WriteHeader(http.StatusPartialContent)
		_, _ = w.Write([]byte("data"))
	}))
	defer upstream.Close()
	allowPrivateTaskMediaTest(t)

	task.Action = constant.TaskActionTextToVideo
	task.PrivateData.ResultURL = upstream.URL
	task.FailReason = "https://stale.invalid/legacy-fallback.mp4"
	require.NoError(t, model.DB.Save(task).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set(middleware.TaskArtifactAccessContextKey, true)
	c.Params = gin.Params{
		{Key: "key", Value: task.TaskID},
		{Key: "artifact_key", Value: "video"},
	}
	c.Request = httptest.NewRequest(
		http.MethodGet,
		"/v1/tasks/"+task.TaskID+"/artifacts/video/content",
		nil,
	)
	c.Request.Header.Set("Range", "bytes=0-3")

	TaskArtifactContent(c)

	assert.Equal(t, http.StatusPartialContent, recorder.Code)
	assert.Equal(t, "data", recorder.Body.String())
	assert.Equal(t, "bytes 0-3/4", recorder.Header().Get("Content-Range"))
}

func TestDisabledArtifactStorePreservesPluginUpstreamContent(t *testing.T) {
	task := setupGenericTaskTest(t)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "provider-key", r.Header.Get("x-goog-api-key"))
		assert.Equal(t, "provider-key", r.Header.Get("X-API-Key"), "channel header overrides reach credentialed downloads")
		assert.NotEqual(t, "ignored.example", r.Host)
		assert.Equal(t, "bytes=0-13", r.Header.Get("Range"))
		w.Header().Set("Content-Type", "video/mp4")
		w.Header().Set("Content-Range", "bytes 0-13/14")
		w.WriteHeader(http.StatusPartialContent)
		_, _ = w.Write([]byte("artifact-bytes"))
	}))
	defer upstream.Close()
	allowPrivateTaskMediaTest(t)
	previousMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = previousMemoryCache })

	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", task.ChannelId).Updates(map[string]any{
		"type":            constant.ChannelTypeGemini,
		"key":             "provider-key",
		"base_url":        upstream.URL,
		"header_override": `{"X-API-Key":"{api_key}","Host":"ignored.example"}`,
	}).Error)
	task.Platform = constant.TaskPlatform("google")
	task.PrivateData.Execution = &model.TaskExecutionSnapshot{TaskPlugin: &model.TaskPluginSnapshot{
		Key: "google", Name: "Google Veo (Gemini API)", Version: "1.0.0", APIVersion: 1,
	}}
	task.SetData(map[string]any{"response": map[string]any{
		"generateVideoResponse": map[string]any{
			"generatedVideos": []any{map[string]any{"video": map[string]any{"uri": upstream.URL}}},
		},
	}})
	require.NoError(t, model.DB.Save(task).Error)
	require.False(t, service.GetTaskArtifactStore().Enabled())

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set(middleware.TaskArtifactAccessContextKey, true)
	c.Params = gin.Params{
		{Key: "key", Value: task.TaskID},
		{Key: "artifact_key", Value: "video"},
	}
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/tasks/"+task.TaskID+"/artifacts/video/content", nil)
	c.Request.Header.Set("Range", "bytes=0-13")

	TaskArtifactContent(c)

	assert.Equal(t, http.StatusPartialContent, recorder.Code)
	assert.Equal(t, "artifact-bytes", recorder.Body.String())
	assert.Equal(t, "video/mp4", recorder.Header().Get("Content-Type"))
	assert.Equal(t, "bytes 0-13/14", recorder.Header().Get("Content-Range"))
}

// hailuo looks the MiniMax download link up with utils.fetch; the signed OSS
// link then gets a plain GET without the channel key, even for HEAD clients.
func TestTaskArtifactContentFollowsHailuoRetrieveLink(t *testing.T) {
	task := setupGenericTaskTest(t)
	var mu sync.Mutex
	var ossRequests []string
	var upstream *httptest.Server
	upstream = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/files/retrieve":
			assert.Equal(t, "Bearer provider-key", r.Header.Get("Authorization"))
			if r.URL.Query().Get("file_id") == "login-fail" {
				_, _ = w.Write([]byte(`{"base_resp":{"status_code":1004,"status_msg":"login fail"}}`))
				return
			}
			_, _ = w.Write([]byte(`{"file":{"download_url":"` + upstream.URL + `/oss/video.mp4?Expires=1&Signature=sig"},"base_resp":{"status_code":0}}`))
		case "/oss/video.mp4":
			mu.Lock()
			ossRequests = append(ossRequests, r.Method+" range="+r.Header.Get("Range")+" authorization="+r.Header.Get("Authorization"))
			mu.Unlock()
			w.Header().Set("Content-Type", "video/mp4")
			if r.Header.Get("Range") != "" {
				w.Header().Set("Content-Range", "bytes 0-3/10")
				w.WriteHeader(http.StatusPartialContent)
				_, _ = w.Write([]byte("mp4!"))
				return
			}
			_, _ = w.Write([]byte("mp4!video!"))
		default:
			t.Errorf("unexpected upstream request %s", r.URL.Path)
		}
	}))
	defer upstream.Close()
	allowPrivateTaskMediaTest(t)
	previousMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = previousMemoryCache })

	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", task.ChannelId).Updates(map[string]any{
		"type":     constant.ChannelTypeMiniMax,
		"key":      "provider-key",
		"base_url": upstream.URL,
		// Neither utils.fetch nor the credentialless OSS link gets overrides.
		"header_override": `{"Authorization":"Bearer override"}`,
	}).Error)
	task.Platform = constant.TaskPlatform("hailuo")
	task.PrivateData.Execution = &model.TaskExecutionSnapshot{TaskPlugin: &model.TaskPluginSnapshot{
		Key: "hailuo", Name: "Hailuo", Version: "1.2.0", APIVersion: 1,
	}}
	request := func(method, fileID string) *httptest.ResponseRecorder {
		task.SetData(map[string]any{"file_id": fileID})
		require.NoError(t, model.DB.Save(task).Error)
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Set("id", 7)
		c.Params = gin.Params{{Key: "key", Value: task.TaskID}, {Key: "artifact_key", Value: "video"}}
		c.Request = httptest.NewRequest(method, "/v1/tasks/"+task.TaskID+"/artifacts/video/content", nil)
		if method == http.MethodGet {
			c.Request.Header.Set("Range", "bytes=0-3")
		}
		TaskArtifactContent(c)
		return recorder
	}

	ranged := request(http.MethodGet, "file-1")
	assert.Equal(t, http.StatusPartialContent, ranged.Code)
	assert.Equal(t, "mp4!", ranged.Body.String())
	assert.Equal(t, "bytes 0-3/10", ranged.Header().Get("Content-Range"))

	head := request(http.MethodHead, "file-1")
	assert.Equal(t, http.StatusOK, head.Code)
	assert.Empty(t, head.Body.String())
	assert.Equal(t, "video/mp4", head.Header().Get("Content-Type"))

	failed := request(http.MethodGet, "login-fail")
	assert.Equal(t, http.StatusInternalServerError, failed.Code)
	assert.Contains(t, failed.Body.String(), "artifact_plugin_error")

	mu.Lock()
	defer mu.Unlock()
	assert.Equal(t, []string{"GET range=bytes=0-3 authorization=", "GET range= authorization="}, ossRequests)
}

func TestProjectedTaskArtifactValidationRejectsAmbiguousIdentity(t *testing.T) {
	validated, err := validateProjectedTaskArtifacts([]relaychannel.TaskArtifact{
		{Key: "video-main", Type: "video", MimeType: "video/mp4"},
		{Key: "cover.main", Type: "image", MimeType: "image/png"},
	})
	require.NoError(t, err)
	require.Len(t, validated, 2)
	assert.Equal(t, "video-main", validated[0].Key)

	for _, artifacts := range [][]relaychannel.TaskArtifact{
		{{Key: "../video", Type: "video"}},
		{{Key: "video/0", Type: "video"}},
		{{Key: "video-main", Type: "video"}, {Key: "video-main", Type: "image"}},
		{{Key: "video-main", Type: "unknown"}},
		{{Key: "video-main", Type: "video", MimeType: "video/mp4\r\nX-Test: injected"}},
	} {
		_, err := validateProjectedTaskArtifacts(artifacts)
		assert.ErrorIs(t, err, errTaskArtifactPlugin)
	}
}

func TestProxyTaskMediaForwardsRangeAndFiltersResponseHeaders(t *testing.T) {
	task := setupGenericTaskTest(t)
	var receivedRange, receivedAuthorization string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedRange = r.Header.Get("Range")
		receivedAuthorization = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "video/mp4")
		w.Header().Set("Content-Range", "bytes 0-3/10")
		w.Header().Set("Accept-Ranges", "bytes")
		w.Header().Set("Set-Cookie", "provider=secret")
		w.Header().Set("WWW-Authenticate", "Bearer provider")
		w.Header().Set("X-Provider-Secret", "hidden")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		w.WriteHeader(http.StatusPartialContent)
		_, _ = w.Write([]byte("data"))
	}))
	defer upstream.Close()

	allowPrivateTaskMediaTest(t)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/tasks/task_generic/artifacts/video-main/content", nil)
	c.Request.Header.Set("Range", "bytes=0-3")

	err := proxyTaskMedia(c, task, &relaychannel.TaskContentRequest{
		URL:     upstream.URL,
		Method:  http.MethodGet,
		Headers: map[string]string{"Authorization": "Bearer provider-secret"},
	})

	require.NoError(t, err)
	assert.Equal(t, http.StatusPartialContent, recorder.Code)
	assert.Equal(t, "data", recorder.Body.String())
	assert.Equal(t, "bytes=0-3", receivedRange)
	assert.Equal(t, "Bearer provider-secret", receivedAuthorization)
	assert.Equal(t, "bytes 0-3/10", recorder.Header().Get("Content-Range"))
	assert.Equal(t, "bytes", recorder.Header().Get("Accept-Ranges"))
	assert.Equal(t, "private, no-store", recorder.Header().Get("Cache-Control"))
	assert.Equal(t, "sandbox; default-src 'none'", recorder.Header().Get("Content-Security-Policy"))
	assert.Equal(t, "no-referrer", recorder.Header().Get("Referrer-Policy"))
	assert.Equal(t, "nosniff", recorder.Header().Get("X-Content-Type-Options"))
	assert.Empty(t, recorder.Header().Get("Set-Cookie"))
	assert.Empty(t, recorder.Header().Get("WWW-Authenticate"))
	assert.Empty(t, recorder.Header().Get("X-Provider-Secret"))
}

func TestProxyTaskMediaPassesThroughUnsatisfiedRange(t *testing.T) {
	task := setupGenericTaskTest(t)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Range", "bytes */10")
		w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
	}))
	defer upstream.Close()

	allowPrivateTaskMediaTest(t)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/content", nil)

	require.NoError(t, proxyTaskMedia(c, task, &relaychannel.TaskContentRequest{
		URL: upstream.URL, Method: http.MethodGet,
	}))
	assert.Equal(t, http.StatusRequestedRangeNotSatisfiable, recorder.Code)
	assert.Equal(t, "bytes */10", recorder.Header().Get("Content-Range"))
	assert.Equal(t, "private, no-store", recorder.Header().Get("Cache-Control"))
}

func TestTaskMediaResponseHeaderTimeoutDoesNotTruncateBody(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "video/mp4")
		w.WriteHeader(http.StatusOK)
		w.(http.Flusher).Flush()
		time.Sleep(75 * time.Millisecond)
		_, _ = w.Write([]byte("complete-body"))
	}))
	defer upstream.Close()

	request, err := http.NewRequest(http.MethodGet, upstream.URL, nil)
	require.NoError(t, err)
	response, err := doTaskMediaRequest(upstream.Client(), request, 20*time.Millisecond)
	require.NoError(t, err)
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	require.NoError(t, err)
	assert.Equal(t, "complete-body", string(body))
}

func TestTaskMediaResponseHeaderTimeoutCancelsBeforeHeaders(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(75 * time.Millisecond)
		_, _ = w.Write([]byte("late"))
	}))
	defer upstream.Close()

	request, err := http.NewRequest(http.MethodGet, upstream.URL, nil)
	require.NoError(t, err)
	_, err = doTaskMediaRequest(upstream.Client(), request, 10*time.Millisecond)
	assert.ErrorIs(t, err, context.DeadlineExceeded)
}

func TestWriteVideoDataURLStreamsAndSupportsHead(t *testing.T) {
	const dataURL = "data:video/mp4;base64,Y29tcGxldGUtYm9keQ=="

	getRecorder := httptest.NewRecorder()
	getContext, _ := gin.CreateTestContext(getRecorder)
	getContext.Request = httptest.NewRequest(http.MethodGet, "/content", nil)
	require.NoError(t, writeVideoDataURL(getContext, dataURL))
	assert.Equal(t, http.StatusOK, getRecorder.Code)
	assert.Equal(t, "complete-body", getRecorder.Body.String())
	assert.Equal(t, "13", getRecorder.Header().Get("Content-Length"))

	headRecorder := httptest.NewRecorder()
	headContext, _ := gin.CreateTestContext(headRecorder)
	headContext.Request = httptest.NewRequest(http.MethodHead, "/content", nil)
	require.NoError(t, writeVideoDataURL(headContext, dataURL))
	assert.Equal(t, http.StatusOK, headRecorder.Code)
	assert.Empty(t, headRecorder.Body.String())
	assert.Equal(t, "13", headRecorder.Header().Get("Content-Length"))
}

func TestWriteVideoDataURLRejectsOversizedPayloadBeforeDecode(t *testing.T) {
	previousLimit := taskMediaDataURLMaxEncodedBytes
	taskMediaDataURLMaxEncodedBytes = 32
	t.Cleanup(func() { taskMediaDataURLMaxEncodedBytes = previousLimit })

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/content", nil)

	err := writeVideoDataURL(c, "data:video/mp4;base64,"+strings.Repeat("A", 64))

	assert.ErrorIs(t, err, errTaskMediaRequestRejected)
	assert.Empty(t, recorder.Header().Get("Content-Type"))
}

func TestProxyTaskMediaAllowsOnlyCredentiallessCrossOriginRedirect(t *testing.T) {
	task := setupGenericTaskTest(t)
	var destinationAuthorization, destinationRange string
	destination := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		destinationAuthorization = r.Header.Get("Authorization")
		destinationRange = r.Header.Get("Range")
		_, _ = w.Write([]byte("redirected"))
	}))
	defer destination.Close()
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, destination.URL, http.StatusFound)
	}))
	defer source.Close()
	allowPrivateTaskMediaTest(t)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/content", nil)
	c.Request.Header.Set("Range", "bytes=0-3")

	err := proxyTaskMedia(c, task, &relaychannel.TaskContentRequest{
		URL: source.URL, Method: http.MethodGet, Credentialless: true,
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "redirected", recorder.Body.String())
	assert.Empty(t, destinationAuthorization)
	assert.Equal(t, "bytes=0-3", destinationRange)

	destinationRange = ""
	rejectedRecorder := httptest.NewRecorder()
	rejectedContext, _ := gin.CreateTestContext(rejectedRecorder)
	rejectedContext.Request = httptest.NewRequest(http.MethodGet, "/content", nil)
	err = proxyTaskMedia(rejectedContext, task, &relaychannel.TaskContentRequest{
		URL: source.URL, Method: http.MethodGet,
		Headers: map[string]string{"Authorization": "Bearer provider-secret"},
	})
	var proxyErr *taskMediaProxyError
	require.ErrorAs(t, err, &proxyErr)
	assert.Equal(t, "artifact_request_rejected", proxyErr.code)
	assert.Empty(t, destinationRange)
}

func TestTaskMediaRequestHeaderPolicy(t *testing.T) {
	header := http.Header{}
	require.NoError(t, applyTaskMediaRequestHeaders(header, map[string]string{
		"Authorization": "Bearer provider-secret",
		"X-Signature":   "signed",
	}))
	assert.Equal(t, "Bearer provider-secret", header.Get("Authorization"))
	assert.Equal(t, "signed", header.Get("X-Signature"))

	for _, name := range []string{"Host", "Content-Length", "Accept-Encoding", "Connection", "Proxy-Authorization", "Transfer-Encoding"} {
		t.Run(name, func(t *testing.T) {
			assert.ErrorIs(t, applyTaskMediaRequestHeaders(http.Header{}, map[string]string{name: "bad"}), errTaskMediaRequestRejected)
		})
	}
	assert.ErrorIs(t, applyTaskMediaRequestHeaders(http.Header{}, map[string]string{"X-Test": "bad\r\ninjected"}), errTaskMediaRequestRejected)
}

func TestCredentiallessTaskMediaDescriptorRejectsCredentialsAndBody(t *testing.T) {
	task := setupGenericTaskTest(t)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/content", nil)

	for _, descriptor := range []*relaychannel.TaskContentRequest{
		{URL: "https://example.com/video", Method: http.MethodPost, Credentialless: true},
		{URL: "https://example.com/video", Method: http.MethodGet, Body: []byte("secret"), Credentialless: true},
		{URL: "https://example.com/video", Method: http.MethodGet, Headers: map[string]string{"X-Key": "secret"}, Credentialless: true},
	} {
		err := proxyTaskMedia(c, task, descriptor)
		var proxyErr *taskMediaProxyError
		require.ErrorAs(t, err, &proxyErr)
		assert.Equal(t, "artifact_request_rejected", proxyErr.code)
	}
}

func TestSelfTaskMediaURLGuard(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "https://gateway.example/v1/videos/task-1/content", nil)
	c.Request.Host = "gateway.example"

	selfURL, err := url.Parse("https://gateway.example/v1/videos/task-1/content")
	require.NoError(t, err)
	assert.True(t, isSelfTaskMediaURL(c, selfURL))

	remoteURL, err := url.Parse("https://cdn.example/v1/videos/task-1/content")
	require.NoError(t, err)
	assert.False(t, isSelfTaskMediaURL(c, remoteURL))
	assert.True(t, isTaskMediaFallbackLoop(remoteURL.String(), "task-1"))
	assert.False(t, isTaskMediaFallbackLoop(remoteURL.String(), "task-2"))
}

func setupImageProxyDownloadTest(t *testing.T) {
	t.Helper()
	require.NoError(t, i18n.Init())
	setupGenericTaskTest(t)
	allowPrivateTaskMediaTest(t)
	previousSecret := common.CryptoSecret
	previousPublicAddress := system_setting.TaskPublicAddress
	previousMemoryCache := common.MemoryCacheEnabled
	common.CryptoSecret = "image-proxy-download-test-secret"
	t.Setenv("CRYPTO_SECRET", common.CryptoSecret)
	system_setting.TaskPublicAddress = "https://gateway.example"
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		common.CryptoSecret = previousSecret
		system_setting.TaskPublicAddress = previousPublicAddress
		common.MemoryCacheEnabled = previousMemoryCache
	})
}

func imageProxyDownloadContext(t *testing.T, method, rawURL string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	proxyURL, err := service.BuildImageProxyURL(rawURL, 1)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(method, proxyURL, nil)
	return c, recorder
}

func TestImageProxyPublicDownloadFiltersHeadersAndCredentials(t *testing.T) {
	setupImageProxyDownloadTest(t)
	image := imageProxyTestPNG
	received := make(chan *http.Request, 2)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received <- r.Clone(r.Context())
		if r.Method == http.MethodHead {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", `image/png; name="https://hidden-provider.invalid/image.png"`)
		w.Header().Set("Content-Length", strconv.Itoa(len(image)))
		w.Header().Set("Location", "https://hidden-provider.invalid/image.png")
		w.Header().Set("Content-Location", "https://hidden-provider.invalid/image.png")
		w.Header().Set("Link", "<https://hidden-provider.invalid/image.png>")
		w.Header().Set("Content-Disposition", `inline; filename="https://hidden-provider.invalid/image.png"`)
		w.Header().Set("Set-Cookie", "provider=secret")
		w.Header().Set("ETag", "https://hidden-provider.invalid/image.png")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		_, _ = io.WriteString(w, image)
	}))
	defer upstream.Close()

	for _, method := range []string{http.MethodGet, http.MethodHead} {
		t.Run(method, func(t *testing.T) {
			c, recorder := imageProxyDownloadContext(t, method, upstream.URL+"/image.png?signature=upstream-secret")
			for _, header := range []string{"Authorization", "Cookie", "Referer", "Proxy-Authorization", "Origin"} {
				c.Request.Header.Set(header, "client-secret")
			}
			ImageProxy(c)
			assert.Equal(t, http.StatusOK, recorder.Code)
			assert.Equal(t, "image/png", recorder.Header().Get("Content-Type"))
			assert.Equal(t, strconv.Itoa(len(image)), recorder.Header().Get("Content-Length"))
			assert.Equal(t, "private, no-store", recorder.Header().Get("Cache-Control"))
			assert.Equal(t, "sandbox; default-src 'none'", recorder.Header().Get("Content-Security-Policy"))
			assert.Equal(t, "no-referrer", recorder.Header().Get("Referrer-Policy"))
			assert.Equal(t, "nosniff", recorder.Header().Get("X-Content-Type-Options"))
			for _, header := range []string{"Location", "Content-Location", "Link", "Content-Disposition", "Set-Cookie", "ETag"} {
				assert.Empty(t, recorder.Header().Get(header))
			}
			if method == http.MethodHead {
				assert.Empty(t, recorder.Body.String())
			} else {
				assert.Equal(t, image, recorder.Body.String())
			}
			request := <-received
			assert.Equal(t, http.MethodGet, request.Method)
			assert.Equal(t, "/image.png?signature=upstream-secret", request.URL.String())
			for _, header := range []string{"Authorization", "Cookie", "Referer", "Proxy-Authorization", "Origin"} {
				assert.Empty(t, request.Header.Get(header))
			}
		})
	}
}

func TestImageProxyFollowsRedirectsWithoutCredentialsOrReferer(t *testing.T) {
	setupImageProxyDownloadTest(t)
	received := make(chan http.Header, 3)
	imageServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received <- r.Header.Clone()
		w.Header().Set("Content-Type", "image/png")
		_, _ = io.WriteString(w, imageProxyTestPNG)
	}))
	defer imageServer.Close()
	redirectServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received <- r.Header.Clone()
		if r.URL.Path == "/start" {
			w.Header().Set("Set-Cookie", "provider=secret")
			http.Redirect(w, r, "/step", http.StatusFound)
			return
		}
		http.Redirect(w, r, imageServer.URL+"/final.webp?signature=hidden", http.StatusFound)
	}))
	defer redirectServer.Close()
	c, recorder := imageProxyDownloadContext(t, http.MethodGet, redirectServer.URL+"/start")
	c.Request.Header.Set("Authorization", "Bearer client-secret")
	c.Request.Header.Set("Cookie", "session=client-secret")
	c.Request.Header.Set("Referer", "https://gateway.example/private")
	ImageProxy(c)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, imageProxyTestPNG, recorder.Body.String())
	assert.Empty(t, recorder.Header().Get("Location"))
	assert.Empty(t, recorder.Header().Get("Set-Cookie"))
	for range 3 {
		header := <-received
		assert.Empty(t, header.Get("Authorization"))
		assert.Empty(t, header.Get("Cookie"))
		assert.Empty(t, header.Get("Referer"))
	}
}

func TestImageProxyRejectsInvalidCapabilitiesBeforeFetch(t *testing.T) {
	setupImageProxyDownloadTest(t)
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		w.Header().Set("Content-Type", "image/png")
	}))
	defer upstream.Close()
	validURL, err := service.BuildImageProxyURL(upstream.URL+"/image.png", 1)
	require.NoError(t, err)
	parsed, err := url.Parse(validURL)
	require.NoError(t, err)
	query := parsed.Query()
	query.Set("token", query.Get("token")+"a")
	parsed.RawQuery = query.Encode()

	engine := gin.New()
	engine.Any("/v1/images/proxy", ImageProxy)
	for _, test := range []struct {
		name, method, requestURL, message string
		status                            int
	}{
		{"missing", http.MethodGet, "/v1/images/proxy", "Image link is invalid", http.StatusForbidden},
		{"raw URL", http.MethodGet, "/v1/images/proxy?url=" + url.QueryEscape(upstream.URL), "Image link is invalid", http.StatusForbidden},
		{"tampered", http.MethodGet, parsed.String(), "Image link is invalid", http.StatusForbidden},
		{"head invalid", http.MethodHead, parsed.String(), "", http.StatusForbidden},
		{"post", http.MethodPost, validURL, "Image download requires GET or HEAD", http.StatusMethodNotAllowed},
	} {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, httptest.NewRequest(test.method, test.requestURL, nil))
			assert.Equal(t, test.status, recorder.Code)
			assert.Contains(t, recorder.Header().Get("Cache-Control"), "no-store")
			if test.method == http.MethodHead {
				assert.Empty(t, recorder.Body.String())
			} else {
				assert.Contains(t, recorder.Body.String(), test.message)
			}
			assert.NotContains(t, recorder.Body.String(), upstream.URL)
		})
	}
	assert.Zero(t, calls.Load())
}

func TestImageProxyRejectsUpstreamErrorsAndActiveContent(t *testing.T) {
	setupImageProxyDownloadTest(t)
	for _, test := range []struct {
		name, mediaType, message string
		status                   int
	}{
		{"upstream error", "image/png", "Image download failed", http.StatusForbidden},
		{"upstream image expired", "image/png", "Image download failed", http.StatusGone},
		{"HTML", "text/html", "Image response is not a supported image", http.StatusOK},
		{"SVG", "image/svg+xml", "Image response is not a supported image", http.StatusOK},
		{"invalid type", "image/png; bad parameter", "Image response is not a supported image", http.StatusOK},
	} {
		t.Run(test.name, func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", test.mediaType)
				w.Header().Set("Location", "https://hidden-provider.invalid/image.png")
				w.Header().Set("Set-Cookie", "provider=secret")
				w.WriteHeader(test.status)
				_, _ = io.WriteString(w, `<script>https://hidden-provider.invalid/provider-secret</script>`)
			}))
			defer upstream.Close()
			c, recorder := imageProxyDownloadContext(t, http.MethodGet, upstream.URL)
			ImageProxy(c)
			assert.Equal(t, http.StatusBadGateway, recorder.Code)
			assert.Contains(t, recorder.Body.String(), test.message)
			assert.NotContains(t, recorder.Body.String(), "hidden-provider.invalid")
			assert.NotContains(t, recorder.Body.String(), "provider-secret")
			assert.Empty(t, recorder.Header().Get("Location"))
			assert.Empty(t, recorder.Header().Get("Set-Cookie"))
		})
	}
}

func TestImageProxyChecksSSRFAndRedirectTargets(t *testing.T) {
	setupImageProxyDownloadTest(t)
	var downloads atomic.Int32
	imageServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		downloads.Add(1)
		w.Header().Set("Content-Type", "image/png")
		_, _ = io.WriteString(w, imageProxyTestPNG)
	}))
	defer imageServer.Close()
	fetch := system_setting.GetFetchSetting()
	fetch.AllowPrivateIp = false
	c, recorder := imageProxyDownloadContext(t, http.MethodGet, imageServer.URL)
	ImageProxy(c)
	assert.Equal(t, http.StatusBadGateway, recorder.Code)
	assert.Zero(t, downloads.Load())

	fetch.AllowPrivateIp = true
	var proxyLoops atomic.Int32
	redirectServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/loop" {
			http.Redirect(w, r, "/v1/images/proxy?token=nested-secret", http.StatusFound)
		} else if r.URL.Path == "/v1/images/proxy" {
			proxyLoops.Add(1)
		} else {
			http.Redirect(w, r, imageServer.URL, http.StatusFound)
		}
	}))
	defer redirectServer.Close()
	parsedRedirect, err := url.Parse(redirectServer.URL)
	require.NoError(t, err)
	fetch.AllowedPorts = []string{parsedRedirect.Port()}
	system_setting.TaskPublicAddress = redirectServer.URL
	for _, path := range []string{"/redirect", "/loop"} {
		c, recorder = imageProxyDownloadContext(t, http.MethodGet, redirectServer.URL+path)
		ImageProxy(c)
		assert.Equal(t, http.StatusBadGateway, recorder.Code)
		assert.NotContains(t, recorder.Body.String(), redirectServer.URL)
		assert.NotContains(t, recorder.Body.String(), "nested-secret")
	}
	assert.Zero(t, downloads.Load())
	assert.Zero(t, proxyLoops.Load())
}

func TestImageProxyUsesOriginatingChannelProxy(t *testing.T) {
	setupImageProxyDownloadTest(t)
	received := make(chan *http.Request, 1)
	proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received <- r.Clone(r.Context())
		w.Header().Set("Content-Type", "image/png")
		_, _ = io.WriteString(w, imageProxyTestPNG)
	}))
	defer proxy.Close()
	t.Cleanup(func() { service.InvalidateProxyClient(proxy.URL) })
	settings, err := common.Marshal(map[string]string{"proxy": proxy.URL})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("setting", string(settings)).Error)
	c, recorder := imageProxyDownloadContext(t, http.MethodGet, "http://8.8.8.8/image.png?signature=hidden")
	ImageProxy(c)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, imageProxyTestPNG, recorder.Body.String())
	request := <-received
	assert.Equal(t, "http://8.8.8.8/image.png?signature=hidden", request.URL.String())
	assert.Empty(t, request.Header.Get("Authorization"))
	assert.Empty(t, request.Header.Get("Referer"))
}

const imageProxyTestPNG = "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x01\x00\x00\x00\x01\x08\x04\x00\x00\x00\xb5\x1c\x0c\x02\x00\x00\x00\x0b\x49\x44\x41\x54\x78\xda\x63\xfc\xff\x1f\x00\x03\x03\x02\x00\xef\x9a\xee\xdd\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82"

func TestImageProxySniffsRasterImagesAndPreservesTheStream(t *testing.T) {
	setupImageProxyDownloadTest(t)
	image := imageProxyTestPNG + strings.Repeat("png-trailer", 100)
	for _, test := range []struct {
		name, mediaType, body string
		status                int
	}{
		{"binary PNG", "application/octet-stream", image, http.StatusOK},
		{"untyped PNG", "", image, http.StatusOK},
		{"binary HTML", "application/octet-stream", "<html>https://hidden-provider.invalid/error</html>", http.StatusBadGateway},
		{"untyped HTML", "", "<html>https://hidden-provider.invalid/error</html>", http.StatusBadGateway},
		{"mislabeled HTML", "image/png", "<html>https://hidden-provider.invalid/error</html>", http.StatusBadGateway},
		{"mislabeled SVG", "image/png", `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`, http.StatusBadGateway},
	} {
		t.Run(test.name, func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				if test.mediaType == "" {
					w.Header()["Content-Type"] = nil
				} else {
					w.Header().Set("Content-Type", test.mediaType)
				}
				_, _ = io.WriteString(w, test.body)
			}))
			defer upstream.Close()
			c, recorder := imageProxyDownloadContext(t, http.MethodGet, upstream.URL)
			ImageProxy(c)
			assert.Equal(t, test.status, recorder.Code)
			if test.status == http.StatusOK {
				assert.Equal(t, "image/png", recorder.Header().Get("Content-Type"))
				assert.Equal(t, test.body, recorder.Body.String())
			} else {
				assert.Contains(t, recorder.Body.String(), "Image response is not a supported image")
				assert.NotContains(t, recorder.Body.String(), "hidden-provider.invalid")
				assert.NotContains(t, recorder.Body.String(), "<svg")
			}
		})
	}
}

func TestImageProxyAllowsOtherOriginImageProxies(t *testing.T) {
	setupImageProxyDownloadTest(t)
	var downloads atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		downloads.Add(1)
		assert.Equal(t, "/v1/images/proxy", r.URL.Path)
		assert.Equal(t, "upstream-capability", r.URL.Query().Get("token"))
		w.Header().Set("Content-Type", "image/png")
		_, _ = io.WriteString(w, imageProxyTestPNG)
	}))
	defer upstream.Close()
	rawURL := upstream.URL + "/v1/images/proxy?token=upstream-capability"
	redirect := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, rawURL, http.StatusFound)
	}))
	defer redirect.Close()
	for _, targetURL := range []string{rawURL, redirect.URL} {
		c, recorder := imageProxyDownloadContext(t, http.MethodGet, targetURL)
		ImageProxy(c)
		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, imageProxyTestPNG, recorder.Body.String())
		assert.Empty(t, recorder.Header().Get("Location"))
	}
	assert.Equal(t, int32(2), downloads.Load())

	system_setting.TaskPublicAddress = upstream.URL
	c, recorder := imageProxyDownloadContext(t, http.MethodGet, rawURL)
	ImageProxy(c)
	assert.Equal(t, http.StatusBadGateway, recorder.Code)
	assert.Equal(t, int32(2), downloads.Load(), "a URL back to this site's proxy must not be fetched")
}

func TestImageProxyErrorsUseClientLanguage(t *testing.T) {
	require.NoError(t, i18n.Init())
	engine := gin.New()
	engine.GET("/v1/images/proxy", ImageProxy)
	for _, tc := range []struct{ language, message string }{
		{"en", "Image link is invalid"},
		{"zh-CN", "图片链接无效"},
		{"zh-TW", "圖片連結無效"},
	} {
		t.Run(tc.language, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/v1/images/proxy", nil)
			request.Header.Set("Accept-Language", tc.language)
			engine.ServeHTTP(recorder, request)
			assert.Equal(t, http.StatusForbidden, recorder.Code)
			assert.Contains(t, recorder.Body.String(), tc.message)
		})
	}
}
