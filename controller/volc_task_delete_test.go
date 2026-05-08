package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// newDeleteContext creates a gin.Context for DELETE .../tasks/:id.
func newDeleteContext(t *testing.T, userID int, taskID string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodDelete,
		"/api/v3/contents/generations/tasks/"+taskID, nil)
	c.Set("id", userID)
	c.Params = gin.Params{{Key: "id", Value: taskID}}
	return c, w
}

// TestVolcTaskDelete_MissingTaskID verifies that an empty task ID returns 400
// (pure validation — no DB access needed).
func TestVolcTaskDelete_MissingTaskID(t *testing.T) {
	c, w := newDeleteContext(t, 1, "")
	// Force empty param
	c.Params = gin.Params{{Key: "id", Value: ""}}

	VolcTaskDelete(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for empty task ID, got %d", w.Code)
	}
}

// ─────────────────────────────────────────────────────────
// buildVolcDeleteResp unit tests
// ─────────────────────────────────────────────────────────

func TestBuildVolcDeleteResp_Cancelled(t *testing.T) {
	task := &model.Task{
		TaskID:     "task_abc",
		Status:     model.TaskStatusFailure,
		FailReason: "cancelled",
		Properties: model.Properties{OriginModelName: "doubao-seedance-1-0"},
	}
	resp := buildVolcDeleteResp(task)
	if len(resp) == 0 {
		t.Fatal("expected non-empty response")
	}
	// Should contain "cancelled" as the ark status
	if !containsString(string(resp), "cancelled") {
		t.Errorf("response should contain 'cancelled', got: %s", string(resp))
	}
}

func TestBuildVolcDeleteResp_AlreadySucceeded(t *testing.T) {
	task := &model.Task{
		TaskID: "task_xyz",
		Status: model.TaskStatusSuccess,
		Properties: model.Properties{OriginModelName: "doubao-seedance-2-0"},
	}
	resp := buildVolcDeleteResp(task)
	if !containsString(string(resp), "succeeded") {
		t.Errorf("response should contain 'succeeded', got: %s", string(resp))
	}
}

func TestBuildVolcDeleteResp_AlreadyFailed(t *testing.T) {
	task := &model.Task{
		TaskID:     "task_fail",
		Status:     model.TaskStatusFailure,
		FailReason: "upstream error",
	}
	resp := buildVolcDeleteResp(task)
	if !containsString(string(resp), "failed") {
		t.Errorf("response should contain 'failed', got: %s", string(resp))
	}
}

// ─────────────────────────────────────────────────────────
// volcDeleteMapStatus unit tests
// ─────────────────────────────────────────────────────────

func TestVolcDeleteMapStatus(t *testing.T) {
	cases := []struct {
		status     model.TaskStatus
		failReason string
		expected   string
	}{
		{model.TaskStatusSuccess, "", "succeeded"},
		{model.TaskStatusFailure, "cancelled", "cancelled"},
		{model.TaskStatusFailure, "upstream error", "failed"},
		{model.TaskStatusInProgress, "", "running"},
		{model.TaskStatusQueued, "", "queued"},
		{model.TaskStatusNotStart, "", "queued"},
	}
	for _, tc := range cases {
		got := volcDeleteMapStatus(tc.status, tc.failReason)
		if got != tc.expected {
			t.Errorf("volcDeleteMapStatus(%s, %q) = %q, want %q",
				tc.status, tc.failReason, got, tc.expected)
		}
	}
}

// containsString checks whether substr is present in s.
func containsString(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
