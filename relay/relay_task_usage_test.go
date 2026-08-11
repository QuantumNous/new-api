package relay

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestInjectUsageFromPrivateData(t *testing.T) {
	mk := func() []byte {
		b, _ := common.Marshal(&dto.OpenAIVideo{ID: "task_x", Object: "video", Status: dto.VideoStatusCompleted})
		return b
	}

	t.Run("injects when tokens present and usage absent", func(t *testing.T) {
		task := &model.Task{PrivateData: model.TaskPrivateData{CompletionTokens: 120, TotalTokens: 120}}
		out := injectUsageFromPrivateData(mk(), task)
		var ov dto.OpenAIVideo
		if err := common.Unmarshal(out, &ov); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if ov.Usage == nil || ov.Usage.CompletionTokens != 120 || ov.Usage.TotalTokens != 120 {
			t.Errorf("usage = %+v, want 120/120", ov.Usage)
		}
	})

	t.Run("no-op when no tokens", func(t *testing.T) {
		in := mk()
		out := injectUsageFromPrivateData(in, &model.Task{})
		var ov dto.OpenAIVideo
		_ = common.Unmarshal(out, &ov)
		if ov.Usage != nil {
			t.Errorf("usage should stay nil, got %+v", ov.Usage)
		}
	})

	t.Run("does not override existing usage", func(t *testing.T) {
		b, _ := common.Marshal(&dto.OpenAIVideo{ID: "task_x", Usage: &dto.OpenAIVideoUsage{CompletionTokens: 5, TotalTokens: 5}})
		task := &model.Task{PrivateData: model.TaskPrivateData{CompletionTokens: 120, TotalTokens: 120}}
		out := injectUsageFromPrivateData(b, task)
		var ov dto.OpenAIVideo
		_ = common.Unmarshal(out, &ov)
		if ov.Usage == nil || ov.Usage.TotalTokens != 5 {
			t.Errorf("existing usage must be preserved, got %+v", ov.Usage)
		}
	})
}

// TaskModel2Dto / TaskModel2DtoAdmin should surface the upstream token usage
// persisted in PrivateData so the generic (/v1/video/generations/:id) query
// format carries `usage`, matching the OpenAI (/v1/videos/:id) format.
func TestTaskModel2Dto_SurfacesUsage(t *testing.T) {
	task := &model.Task{
		TaskID: "task_abc",
		Status: model.TaskStatusSuccess,
		PrivateData: model.TaskPrivateData{
			ResultURL:        "https://host/v1/videos/task_abc/content",
			CompletionTokens: 120,
			TotalTokens:      120,
		},
	}

	d := TaskModel2Dto(task)
	if d.Usage == nil {
		t.Fatal("usage should be populated from PrivateData")
	}
	if d.Usage.CompletionTokens != 120 || d.Usage.TotalTokens != 120 {
		t.Errorf("usage = %+v, want completion=120 total=120", d.Usage)
	}

	// Admin view must also carry usage.
	if da := TaskModel2DtoAdmin(task); da.Usage == nil || da.Usage.TotalTokens != 120 {
		t.Errorf("admin usage = %+v", da.Usage)
	}
}

func TestTaskModel2Dto_NoUsageWhenAbsent(t *testing.T) {
	task := &model.Task{
		TaskID:      "task_abc",
		Status:      model.TaskStatusInProgress,
		PrivateData: model.TaskPrivateData{},
	}
	if d := TaskModel2Dto(task); d.Usage != nil {
		t.Errorf("usage should be nil when no tokens, got %+v", d.Usage)
	}
}

func TestGenerationTasksFetchPathDetection(t *testing.T) {
	if !isGenerationTasksFetchPath("/v1/generation/tasks/task_abc") {
		t.Fatal("generation task fetch path should be detected")
	}
	if isGenerationTasksFetchPath("/v1/generation/tasks") {
		t.Fatal("submit path should not be treated as fetch path")
	}
	if !isOpenAIVideoFetchPath("/v1/videos/task_abc") {
		t.Fatal("OpenAI video fetch path should be detected")
	}
}

func TestGenerationTaskRespBodyMatchesDocs(t *testing.T) {
	task := &model.Task{
		TaskID: "task_abc",
		Status: model.TaskStatusSuccess,
		PrivateData: model.TaskPrivateData{
			ResultURL:        "https://api.example.com/v1/videos/task_abc/content",
			CompletionTokens: 108000,
			TotalTokens:      108000,
		},
	}

	out, err := generationTaskRespBody(task)
	if err != nil {
		t.Fatalf("generationTaskRespBody error: %v", err)
	}

	var got struct {
		ID      string `json:"id"`
		Status  string `json:"status"`
		Content []struct {
			Type     string `json:"type"`
			VideoURL struct {
				URL string `json:"url"`
			} `json:"video_url"`
		} `json:"content"`
		Usage *dto.OpenAIVideoUsage `json:"usage"`
	}
	if err := common.Unmarshal(out, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.ID != "task_abc" || got.Status != "succeeded" {
		t.Fatalf("id/status = %q/%q", got.ID, got.Status)
	}
	if len(got.Content) != 1 || got.Content[0].Type != "video_url" ||
		got.Content[0].VideoURL.URL != "https://api.example.com/v1/videos/task_abc/content" {
		t.Fatalf("content = %+v", got.Content)
	}
	if got.Usage == nil || got.Usage.CompletionTokens != 108000 || got.Usage.TotalTokens != 108000 {
		t.Fatalf("usage = %+v", got.Usage)
	}
}

func TestGenerationTaskRespBodyFailureScrubsError(t *testing.T) {
	out, err := generationTaskRespBody(&model.Task{
		TaskID:     "task_abc",
		Status:     model.TaskStatusFailure,
		FailReason: "chatgpttech.mobi returned failed",
	})
	if err != nil {
		t.Fatalf("generationTaskRespBody error: %v", err)
	}

	var got struct {
		Status string                `json:"status"`
		Error  *dto.OpenAIVideoError `json:"error"`
	}
	if err := common.Unmarshal(out, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.Status != "failed" {
		t.Fatalf("status = %q", got.Status)
	}
	if got.Error == nil || got.Error.Message != "task failed at upstream provider" {
		t.Fatalf("error = %+v", got.Error)
	}
}

func TestModelAPISeedancePrepareTaskAttemptRejectsLegacySubmitPathBeforePricing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", strings.NewReader(
		`{"model":"doubao-seedance-2-5-260628","content":[{"type":"text","text":"hello"}]}`,
	))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("platform", strconv.Itoa(constant.ChannelTypeModelAPISeedance))
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeModelAPISeedance)
	common.SetContextKey(c, constant.ContextKeyChannelKey, "test-key")
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, "https://api.modelapi.co")

	_, taskErr := PrepareTaskAttempt(c, &relaycommon.RelayInfo{
		OriginModelName: "doubao-seedance-2-5-260628",
		UsingGroup:      "default",
		UserGroup:       "default",
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
	})
	if taskErr == nil {
		t.Fatal("legacy submit path was accepted")
	}
	if taskErr.Code != "invalid_request" || taskErr.StatusCode != http.StatusBadRequest {
		t.Fatalf("taskErr = %+v, want invalid_request 400", taskErr)
	}
}

func TestModelAPISeedanceFetchRejectsLegacyRoutesAfterTaskLookup(t *testing.T) {
	setupRelayTaskTestDB(t)
	seedRelayTask(t, &model.Task{
		TaskID:     "task_modelapi",
		UserId:     123,
		Platform:   constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeModelAPISeedance)),
		ChannelId:  111,
		Status:     model.TaskStatusSuccess,
		FailReason: "https://api.modelapi.co/v1/tasks/upstream-secret",
		Properties: model.Properties{OriginModelName: "doubao-seedance-2-5-260628", UpstreamModelName: "modelapi-secret-model"},
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: "upstream-secret",
			ResultURL:      "https://flatkey.example/v1/videos/task_modelapi/content",
		},
		Data: []byte(`{"task_id":"upstream-secret","status":"succeeded"}`),
	})

	for _, path := range []string{
		"/v1/video/generations/task_modelapi",
		"/v1/generation/tasks/task_modelapi",
	} {
		t.Run(path, func(t *testing.T) {
			_, taskErr := fetchTaskByPath(t, path, "task_modelapi")
			if taskErr == nil {
				t.Fatal("legacy fetch path was accepted")
			}
			if taskErr.StatusCode != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", taskErr.StatusCode)
			}
			text := taskErr.Message
			if taskErr.Error != nil {
				text += " " + taskErr.Error.Error()
			}
			for _, marker := range []string{"ModelAPI", "modelapi", "api.modelapi.co", "upstream-secret", "private/result.mp4", "modelapi-secret-model"} {
				if strings.Contains(text, marker) {
					t.Fatalf("legacy fetch error leaked %q in %q", marker, text)
				}
			}
		})
	}

	t.Run("allows standard OpenAI video fetch", func(t *testing.T) {
		body, taskErr := fetchTaskByPath(t, "/v1/videos/task_modelapi", "task_modelapi")
		if taskErr != nil {
			t.Fatalf("standard fetch rejected: %+v", taskErr)
		}
		var got dto.OpenAIVideo
		if err := common.Unmarshal(body, &got); err != nil {
			t.Fatalf("unmarshal OpenAI video response: %v", err)
		}
		if got.ID != "task_modelapi" || got.Metadata["url"] != "https://flatkey.example/v1/videos/task_modelapi/content" {
			t.Fatalf("OpenAI video response = %+v", got)
		}
		for _, marker := range []string{"ModelAPI", "api.modelapi.co", "upstream-secret", "private/result.mp4", "modelapi-secret-model"} {
			if strings.Contains(string(body), marker) {
				t.Fatalf("standard fetch response leaked %q in %s", marker, body)
			}
		}
	})
}

func TestNonModelAPISeedanceLegacyFetchRoutesRemainUsable(t *testing.T) {
	setupRelayTaskTestDB(t)
	seedRelayTask(t, &model.Task{
		TaskID:    "task_doubao",
		UserId:    123,
		Platform:  constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeDoubaoVideo)),
		ChannelId: constant.ChannelTypeDoubaoVideo,
		Status:    model.TaskStatusSuccess,
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://example.com/result.mp4",
		},
	})

	body, taskErr := fetchTaskByPath(t, "/v1/generation/tasks/task_doubao", "task_doubao")
	if taskErr != nil {
		t.Fatalf("non-111 generation task fetch rejected: %+v", taskErr)
	}
	var generation gotGenerationTaskResponse
	if err := common.Unmarshal(body, &generation); err != nil {
		t.Fatalf("unmarshal generation response: %v", err)
	}
	if generation.ID != "task_doubao" || generation.Status != "succeeded" {
		t.Fatalf("generation response = %+v", generation)
	}

	body, taskErr = fetchTaskByPath(t, "/v1/video/generations/task_doubao", "task_doubao")
	if taskErr != nil {
		t.Fatalf("non-111 generic fetch rejected: %+v", taskErr)
	}
	var generic dto.TaskResponse[any]
	if err := common.Unmarshal(body, &generic); err != nil {
		t.Fatalf("unmarshal generic response: %v", err)
	}
	if generic.Code != "success" || generic.Data == nil {
		t.Fatalf("generic response = %+v", generic)
	}
}

type gotGenerationTaskResponse struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

func setupRelayTaskTestDB(t *testing.T) {
	t.Helper()
	oldDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	model.DB = db
	t.Cleanup(func() {
		model.DB = oldDB
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	if err := db.AutoMigrate(&model.Task{}, &model.Channel{}); err != nil {
		t.Fatalf("migrate tasks: %v", err)
	}
}

func seedRelayTask(t *testing.T, task *model.Task) {
	t.Helper()
	if err := model.DB.Create(task).Error; err != nil {
		t.Fatalf("seed task %s: %v", task.TaskID, err)
	}
}

func fetchTaskByPath(t *testing.T, path string, taskID string) ([]byte, *dto.TaskError) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, path, nil)
	c.Set("id", 123)
	c.Params = gin.Params{{Key: "task_id", Value: taskID}, {Key: "id", Value: taskID}}

	taskErr := RelayTaskFetch(c, relayconstant.RelayModeVideoFetchByID)
	return w.Body.Bytes(), taskErr
}
