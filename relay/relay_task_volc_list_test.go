package relay

import (
	"net/http"
	"net/http/httptest"
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

func insertVolcTask(t *testing.T, userID int, taskID string, status model.TaskStatus, modelName string) {
	t.Helper()
	now := time.Now().Unix()
	task := &model.Task{
		TaskID:     taskID,
		UserId:     userID,
		Platform:   constant.TaskPlatform("45"),
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
