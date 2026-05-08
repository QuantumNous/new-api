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
	insertTaskWithFailReason(t, userID, taskID, status, modelName, platform, "")
}

func insertTaskWithFailReason(t *testing.T, userID int, taskID string, status model.TaskStatus, modelName string, platform constant.TaskPlatform, failReason string) {
	t.Helper()
	now := time.Now().Unix()
	task := &model.Task{
		TaskID:     taskID,
		UserId:     userID,
		Platform:   platform,
		Status:     status,
		FailReason: failReason,
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

// TestVideoFetchListRespBuilder_FilteredPagination verifies that when a model
// filter is active and matching rows are sparse, the list endpoint still
// returns a correct page of matching items rather than an under-filled page.
//
// Scenario: 100 tasks seeded for user 3001, only 5 have model="rare-model".
// A request for page 1 size 10 with filter.model=rare-model must return all 5
// and total=5 (not a partial page caused by filtering a pre-fetched 10-row
// chunk that may contain zero matching rows).
func TestVideoFetchListRespBuilder_FilteredPagination(t *testing.T) {
	setupVolcListTestDB(t)

	const userID = 3001
	const rareModel = "rare-model"
	const commonModel = "doubao-seedance-2-0-260128"

	// Seed 100 tasks: every 20th has rareModel, the rest commonModel.
	for i := 0; i < 100; i++ {
		m := commonModel
		if i%20 == 0 {
			m = rareModel
		}
		insertVolcTask(t, userID, "fp_task_"+strconv.Itoa(i), model.TaskStatusQueued, m)
	}

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(
		http.MethodGet,
		"/api/v3/contents/generations/tasks?page_num=1&page_size=10&filter.model="+rareModel,
		nil,
	)
	c.Request = req
	c.Set("id", userID)

	respBody, taskErr := videoFetchListRespBodyBuilder(c)
	if taskErr != nil {
		t.Fatalf("unexpected taskErr: %+v", taskErr)
	}

	var resp volcVideoTaskListResponse
	if err := common.Unmarshal(respBody, &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	// 5 tasks match (indices 0, 20, 40, 60, 80); all must be returned.
	if resp.Total != 5 {
		t.Errorf("expected total=5, got %d", resp.Total)
	}
	if len(resp.Items) != 5 {
		t.Errorf("expected 5 items, got %d: %v", len(resp.Items), resp.Items)
	}
	for _, item := range resp.Items {
		if item.Model != rareModel {
			t.Errorf("item model mismatch: got %q, want %q", item.Model, rareModel)
		}
	}
}

// TestListFilteredVolcVideoTasks_Cap verifies that listFilteredVolcVideoTasks
// stops scanning at listScanCap rows even when all tasks match the filter.
// The cap prevents unbounded memory consumption on very large task sets.
func TestListFilteredVolcVideoTasks_Cap(t *testing.T) {
	setupVolcListTestDB(t)

	const userID = 8888
	// Seed listScanCap+1 tasks so the cap is definitely hit.
	total := listScanCap + 1
	for i := 0; i < total; i++ {
		insertVolcTask(t, userID, "lsc_task_"+strconv.Itoa(i), model.TaskStatusQueued, "cap-model")
	}

	queryParams := model.SyncTaskQueryParams{
		Platform: volcAdapterPlatform,
	}

	page, count := listFilteredVolcVideoTasks(userID, queryParams, "cap-model", nil, "", 0, 10)

	// count must not exceed listScanCap (scan was bounded).
	if count > int64(listScanCap) {
		t.Errorf("count=%d exceeds listScanCap=%d — scan was not bounded", count, listScanCap)
	}
	// Page slice must be at most pageSize=10.
	if len(page) > 10 {
		t.Errorf("page len %d exceeds pageSize=10", len(page))
	}
}

// TestVideoFetchListRespBuilder_FailReasonFilter verifies that filter.status
// "cancelled" and "expired" apply a secondary in-memory filter on FailReason,
// since both map to the same internal TaskStatusFailure at the DB layer.
//
// Scenario: 3 failure tasks seeded — FailReason "", "cancelled", "expired".
//   - filter.status=cancelled → only task with FailReason="cancelled"
//   - filter.status=expired   → only task with FailReason="expired"
//   - filter.status=failed    → only task with FailReason="" (genuine failure)
func TestVideoFetchListRespBuilder_FailReasonFilter(t *testing.T) {
	setupVolcListTestDB(t)

	const userID = 9001
	insertTaskWithFailReason(t, userID, "fail_generic", model.TaskStatusFailure, "doubao-seedance-2-0-260128", volcAdapterPlatform, "")
	insertTaskWithFailReason(t, userID, "fail_cancelled", model.TaskStatusFailure, "doubao-seedance-2-0-260128", volcAdapterPlatform, "cancelled")
	insertTaskWithFailReason(t, userID, "fail_expired", model.TaskStatusFailure, "doubao-seedance-2-0-260128", volcAdapterPlatform, "expired")

	gin.SetMode(gin.TestMode)

	callList := func(filterStatus string) volcVideoTaskListResponse {
		t.Helper()
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		req := httptest.NewRequest(http.MethodGet,
			"/api/v3/contents/generations/tasks?filter.status="+filterStatus, nil)
		c.Request = req
		c.Set("id", userID)
		body, taskErr := videoFetchListRespBodyBuilder(c)
		if taskErr != nil {
			t.Fatalf("filter.status=%q: unexpected taskErr: %+v", filterStatus, taskErr)
		}
		var resp volcVideoTaskListResponse
		if err := common.Unmarshal(body, &resp); err != nil {
			t.Fatalf("filter.status=%q: unmarshal failed: %v", filterStatus, err)
		}
		return resp
	}

	// filter.status=cancelled must return only the cancelled task.
	if resp := callList("cancelled"); resp.Total != 1 || len(resp.Items) != 1 || resp.Items[0].ID != "fail_cancelled" {
		t.Errorf("filter.status=cancelled: expected 1 item (fail_cancelled), got total=%d items=%v", resp.Total, resp.Items)
	}

	// filter.status=expired must return only the expired task.
	if resp := callList("expired"); resp.Total != 1 || len(resp.Items) != 1 || resp.Items[0].ID != "fail_expired" {
		t.Errorf("filter.status=expired: expected 1 item (fail_expired), got total=%d items=%v", resp.Total, resp.Items)
	}

	// filter.status=failed must return only the generic failure (no FailReason).
	if resp := callList("failed"); resp.Total != 1 || len(resp.Items) != 1 || resp.Items[0].ID != "fail_generic" {
		t.Errorf("filter.status=failed: expected 1 item (fail_generic), got total=%d items=%v", resp.Total, resp.Items)
	}
}

// TestMatchesVolcListFilter_FailReasonLogic is a unit test for matchesVolcListFilter
// that covers all FailReason secondary-filter branches without DB setup.
func TestMatchesVolcListFilter_FailReasonLogic(t *testing.T) {
	makeTask := func(failReason string) *model.Task {
		return &model.Task{
			TaskID:     "t1",
			Status:     model.TaskStatusFailure,
			FailReason: failReason,
			Properties: model.Properties{OriginModelName: "doubao-seedance-2-0-260128"},
		}
	}

	cases := []struct {
		rawStatus  string
		failReason string
		want       bool
	}{
		{"cancelled", "cancelled", true},
		{"cancelled", "expired", false},
		{"cancelled", "", false},
		{"expired", "expired", true},
		{"expired", "cancelled", false},
		{"expired", "", false},
		{"failed", "", true},
		{"failed", "cancelled", false},
		{"failed", "expired", false},
		// No secondary filter for other statuses.
		{"succeeded", "", true},
		{"", "", true},
	}

	for _, tc := range cases {
		got := matchesVolcListFilter(makeTask(tc.failReason), "", nil, tc.rawStatus)
		if got != tc.want {
			t.Errorf("matchesVolcListFilter(failReason=%q, rawStatus=%q): got %v, want %v",
				tc.failReason, tc.rawStatus, got, tc.want)
		}
	}
}

// TestBuildVolcNativeTaskFetchResp_JSONInjection verifies that task IDs containing
// JSON-special characters do not produce malformed JSON in the fallback path.
func TestBuildVolcNativeTaskFetchResp_JSONInjection(t *testing.T) {
	specialIDs := []string{
		`task_"inject"`,
		`task_\backslash`,
		"task_\x00null",
		"task_\nnewline",
	}

	for _, id := range specialIDs {
		task := &model.Task{
			TaskID: id,
			Status: model.TaskStatusQueued,
			Properties: model.Properties{OriginModelName: "doubao-seedance-2-0-260128"},
		}
		resp := buildVolcNativeTaskFetchResp(task)

		// Response must be parseable JSON.
		var parsed map[string]interface{}
		if err := common.Unmarshal(resp, &parsed); err != nil {
			t.Errorf("task ID %q: response is not valid JSON: %v\nBody: %s", id, err, resp)
			continue
		}
		// The "id" field must round-trip back to the original string.
		gotID, ok := parsed["id"].(string)
		if !ok {
			t.Errorf("task ID %q: 'id' field missing or not a string in response: %s", id, resp)
			continue
		}
		if gotID != id {
			t.Errorf("task ID %q: round-trip failed, got %q", id, gotID)
		}
	}
}
