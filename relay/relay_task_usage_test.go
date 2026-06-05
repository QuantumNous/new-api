package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
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
