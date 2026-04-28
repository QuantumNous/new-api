package relay

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupVolcListTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	model.DB = db
	common.UsingSQLite = true
	if err := db.AutoMigrate(&model.Task{}); err != nil {
		t.Fatalf("failed to migrate task table: %v", err)
	}
}

// volcAdapterPlatform is the TaskPlatform string for ChannelTypeVolcAdapter tasks
// (used by the /api/v3/contents/generations/tasks list endpoint filter).
var volcAdapterPlatform = constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeVolcAdapter))

func insertVolcTask(t *testing.T, userID int, taskID string, status model.TaskStatus, modelName string) {
	t.Helper()
	insertTaskWithPlatform(t, userID, taskID, status, modelName, volcAdapterPlatform)
}

func insertTaskWithPlatform(t *testing.T, userID int, taskID string, status model.TaskStatus, modelName string, platform constant.TaskPlatform) {
	t.Helper()
	now := time.Now().Unix()
	task := &model.Task{
		TaskID:     taskID,
		UserId:     userID,
		Platform:   platform,
		Status:     status,
		CreatedAt:  now,
		UpdatedAt:  now,
		Properties: model.Properties{OriginModelName: modelName},
	}
	if err := model.DB.Create(task).Error; err != nil {
		t.Fatalf("failed to insert task: %v", err)
	}
}

func TestVideoFetchListRespBuilder_FilterAndMapping(t *testing.T) {
	setupVolcListTestDB(t)
	insertVolcTask(t, 1001, "task_a", model.TaskStatusQueued, "doubao-seedance-2-0-260128")
	insertVolcTask(t, 1001, "task_b", model.TaskStatusSuccess, "doubao-seedance-1-5-pro-251215")
	insertVolcTask(t, 1001, "task_c", model.TaskStatusInProgress, "doubao-seedance-2-0-fast-260128")
	insertVolcTask(t, 1002, "task_other_user", model.TaskStatusSuccess, "doubao-seedance-2-0-260128")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(
		http.MethodGet,
		"/api/v3/contents/generations/tasks?page_num=1&page_size=10&filter.status=succeeded&filter.model=doubao-seedance-1-5-pro-251215&filter.task_ids=task_b,task_x&filter.task_ids=task_c",
		nil,
	)
	c.Request = req
	c.Set("id", 1001)

	respBody, taskErr := videoFetchListRespBodyBuilder(c)
	if taskErr != nil {
		t.Fatalf("unexpected taskErr: %+v", taskErr)
	}

	var resp volcVideoTaskListResponse
	if err := common.Unmarshal(respBody, &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Items))
	}
	if resp.Items[0].ID != "task_b" {
		t.Fatalf("expected task_b, got %s", resp.Items[0].ID)
	}
	if resp.Items[0].Status != "succeeded" {
		t.Fatalf("expected succeeded status, got %s", resp.Items[0].Status)
	}
	if resp.Total != 1 {
		t.Fatalf("expected total=1, got %d", resp.Total)
	}
}

func TestVideoFetchListRespBuilder_InvalidStatus(t *testing.T) {
	setupVolcListTestDB(t)
	insertVolcTask(t, 1001, "task_a", model.TaskStatusQueued, "doubao-seedance-2-0-260128")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(
		http.MethodGet,
		"/api/v3/contents/generations/tasks?filter.status=unknown_status",
		nil,
	)
	c.Request = req
	c.Set("id", 1001)

	respBody, taskErr := videoFetchListRespBodyBuilder(c)
	if taskErr != nil {
		t.Fatalf("unexpected taskErr: %+v", taskErr)
	}

	var resp volcVideoTaskListResponse
	if err := common.Unmarshal(respBody, &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(resp.Items) != 0 {
		t.Fatalf("expected empty items, got %d", len(resp.Items))
	}
	if resp.Total != 0 {
		t.Fatalf("expected total=0, got %d", resp.Total)
	}
}

// TestVideoFetchListRespBuilder_RejectsSpoofedUserID verifies that the list
// endpoint ignores any attempt to inject a different user ID via a query
// parameter.  The handler derives the owner exclusively from c.GetInt("id")
// (the token-derived user ID set by auth middleware), so even if a caller
// appends ?filter.user_id=<other> or ?filter.user=<other> the response MUST
// only contain tasks belonging to the authenticated user.
//
// Security invariant: user 1001 MUST NOT see user 1002's tasks regardless of
// any query-string manipulation.
func TestVideoFetchListRespBuilder_RejectsSpoofedUserID(t *testing.T) {
	setupVolcListTestDB(t)
	// Insert tasks for two different users.
	insertVolcTask(t, 1001, "u1_task_a", model.TaskStatusSuccess, "doubao-seedance-2-0-260128")
	insertVolcTask(t, 1001, "u1_task_b", model.TaskStatusQueued, "doubao-seedance-2-0-260128")
	insertVolcTask(t, 1002, "u2_task_secret", model.TaskStatusSuccess, "doubao-seedance-2-0-260128")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	// Authenticated as user 1001 — the token-derived identity.
	c.Set("id", 1001)

	// Attempt to spoof user 1002 via query params.  The handler does not
	// recognise either of these param names; both should be silently ignored.
	req := httptest.NewRequest(
		http.MethodGet,
		"/api/v3/contents/generations/tasks?filter.user_id=1002&filter.user=1002",
		nil,
	)
	c.Request = req

	respBody, taskErr := videoFetchListRespBodyBuilder(c)
	if taskErr != nil {
		t.Fatalf("unexpected taskErr: %+v", taskErr)
	}

	var resp volcVideoTaskListResponse
	if err := common.Unmarshal(respBody, &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	// Must see ONLY user 1001's tasks.
	for _, item := range resp.Items {
		if item.ID == "u2_task_secret" {
			t.Errorf("security violation: user 1001 can see user 1002's task %q via spoofed query param", item.ID)
		}
	}
	if resp.Total != 2 {
		t.Errorf("expected total=2 (user 1001 owns 2 tasks), got %d", resp.Total)
	}
	if len(resp.Items) != 2 {
		t.Errorf("expected 2 items, got %d", len(resp.Items))
	}
}

// TestVideoFetchListRespBuilder_PlatformCoexistence verifies that tasks stored
// under legacy platform 45 (DoubaoVideo / VolcEngine) do NOT appear in the
// /api/v3/contents/generations/tasks list endpoint, while VolcAdapter tasks do.
// This is the regression guard for the platform-filter migration.
func TestVideoFetchListRespBuilder_PlatformCoexistence(t *testing.T) {
	setupVolcListTestDB(t)

	// Insert a VolcAdapter task — should be visible.
	insertTaskWithPlatform(t, 2001, "va_task_1", model.TaskStatusSuccess, "doubao-seedance-2-0-260128", volcAdapterPlatform)

	// Insert a legacy platform-45 task — should NOT appear in the volc list.
	legacyPlatform := constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeVolcEngine))
	insertTaskWithPlatform(t, 2001, "legacy_task_1", model.TaskStatusSuccess, "doubao-seedance-2-0-260128", legacyPlatform)

	// Insert a DoubaoVideo (54) platform task — should NOT appear in the volc list.
	doubaoPlatform := constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeDoubaoVideo))
	insertTaskWithPlatform(t, 2001, "doubao_task_1", model.TaskStatusSuccess, "doubao-seedance-2-0-260128", doubaoPlatform)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodGet, "/api/v3/contents/generations/tasks", nil)
	c.Request = req
	c.Set("id", 2001)

	respBody, taskErr := videoFetchListRespBodyBuilder(c)
	if taskErr != nil {
		t.Fatalf("unexpected taskErr: %+v", taskErr)
	}

	var resp volcVideoTaskListResponse
	if err := common.Unmarshal(respBody, &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	// Only the VolcAdapter task should appear.
	if resp.Total != 1 {
		t.Fatalf("expected total=1 (only VolcAdapter tasks), got %d", resp.Total)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Items))
	}
	if resp.Items[0].ID != "va_task_1" {
		t.Fatalf("expected va_task_1, got %s", resp.Items[0].ID)
	}
}
