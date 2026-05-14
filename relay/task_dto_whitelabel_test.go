package relay

import (
	"encoding/json"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

// kuaiziPlatform is the stringified channel type used as task.Platform for
// kuaizi video tasks (see relay.GetTaskPlatform).
var kuaiziPlatform = constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeKuaiziLizhen))

func newKuaiziSuccessTask() *model.Task {
	return &model.Task{
		ID:       42,
		TaskID:   "task_abc",
		Platform: kuaiziPlatform,
		Status:   model.TaskStatusSuccess,
		Properties: model.Properties{
			UpstreamModelName: "kuaizi-lizhen-fast",
			OriginModelName:   "video-fast",
		},
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://api.example.com/v1/videos/task_abc/content",
		},
		FailReason: "",
		Data:       json.RawMessage(`{"code":0,"data":{"video_url":"https://x.volces.com/a.mp4","tos_key":"ai-open/x"}}`),
	}
}

func TestTaskModel2Dto_WhitelabelStripsEnvelopeAndUpstreamModel(t *testing.T) {
	task := newKuaiziSuccessTask()
	d := TaskModel2Dto(task)

	if d.Data != nil {
		t.Errorf("expected Data to be nil for whitelabel task, got %s", string(d.Data))
	}
	props, ok := d.Properties.(model.Properties)
	if !ok {
		t.Fatalf("expected Properties to be model.Properties, got %T", d.Properties)
	}
	if props.UpstreamModelName != "" {
		t.Errorf("expected UpstreamModelName stripped, got %q", props.UpstreamModelName)
	}
	if props.OriginModelName != "video-fast" {
		t.Errorf("OriginModelName must be preserved (customer-supplied), got %q", props.OriginModelName)
	}
	if d.ResultURL != "https://api.example.com/v1/videos/task_abc/content" {
		t.Errorf("ResultURL should be the proxy URL, got %q", d.ResultURL)
	}
}

func TestTaskModel2Dto_WhitelabelFailureScrubsFailReasonAndSkipsResultURLFallback(t *testing.T) {
	task := newKuaiziSuccessTask()
	task.Status = model.TaskStatusFailure
	task.PrivateData.ResultURL = ""
	task.FailReason = "kuaizi upstream code=500 message=internal"

	d := TaskModel2Dto(task)

	if d.ResultURL != "" {
		t.Errorf("ResultURL must not fall back to FailReason for whitelabel, got %q", d.ResultURL)
	}
	if d.FailReason == task.FailReason {
		t.Errorf("FailReason must be scrubbed, still contains branded text: %q", d.FailReason)
	}
	if d.FailReason != "task failed at upstream provider" {
		t.Errorf("unexpected scrubbed FailReason: %q", d.FailReason)
	}
}

func TestTaskModel2Dto_WhitelabelFailureKeepsCleanFailReason(t *testing.T) {
	task := newKuaiziSuccessTask()
	task.Status = model.TaskStatusFailure
	task.PrivateData.ResultURL = ""
	task.FailReason = "prompt rejected by safety filter"

	d := TaskModel2Dto(task)
	if d.FailReason != "prompt rejected by safety filter" {
		t.Errorf("clean FailReason must pass through, got %q", d.FailReason)
	}
}

func TestTaskModel2Dto_NonWhitelabelPlatformLeavesDataIntact(t *testing.T) {
	task := newKuaiziSuccessTask()
	task.Platform = constant.TaskPlatform("1") // pretend OpenAI

	d := TaskModel2Dto(task)
	if d.Data == nil {
		t.Error("non-whitelabel task should keep Data intact")
	}
	props := d.Properties.(model.Properties)
	if props.UpstreamModelName != "kuaizi-lizhen-fast" {
		t.Errorf("non-whitelabel must preserve UpstreamModelName, got %q", props.UpstreamModelName)
	}
}

func TestTaskModel2DtoAdmin_AlwaysReturnsFullPayload(t *testing.T) {
	task := newKuaiziSuccessTask()
	d := TaskModel2DtoAdmin(task)

	if d.Data == nil {
		t.Error("admin DTO must keep raw upstream Data for debugging")
	}
	props := d.Properties.(model.Properties)
	if props.UpstreamModelName != "kuaizi-lizhen-fast" {
		t.Errorf("admin DTO must keep UpstreamModelName, got %q", props.UpstreamModelName)
	}
}
