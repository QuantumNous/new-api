package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

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
