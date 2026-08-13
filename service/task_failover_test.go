package service

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func TestHandleAsyncTaskFailure_AuditTerminal(t *testing.T) {
	task := &model.Task{TaskID: "t1"}
	handled, _, err := HandleAsyncTaskFailure(context.Background(), nil, nil, task, "审核不通过")
	if err != nil || handled {
		t.Fatalf("handled=%v err=%v", handled, err)
	}
}

func TestHandleAsyncTaskFailure_CrossDisabledNoAdaptor(t *testing.T) {
	prev := operation_setting.TaskCrossChannelFailoverEnabled
	operation_setting.TaskCrossChannelFailoverEnabled = false
	t.Cleanup(func() { operation_setting.TaskCrossChannelFailoverEnabled = prev })

	task := &model.Task{
		TaskID: "t2",
		PrivateData: model.TaskPrivateData{
			RequestBody:           `{}`,
			ClientRequestBody:     `{}`,
			SameChannelMaxRetries: 2,
		},
	}
	handled, _, err := HandleAsyncTaskFailure(context.Background(), &model.Channel{Id: 1}, nil, task, "timeout")
	if err != nil || handled {
		t.Fatalf("expected not handled without adaptor/cross, got handled=%v err=%v", handled, err)
	}
}

func TestHandleAsyncTaskFailure_BalanceNeedsRecreateWired(t *testing.T) {
	prevFn := TaskFailoverRecreateFunc
	TaskFailoverRecreateFunc = nil
	t.Cleanup(func() { TaskFailoverRecreateFunc = prevFn })

	prev := operation_setting.TaskCrossChannelFailoverEnabled
	operation_setting.TaskCrossChannelFailoverEnabled = true
	t.Cleanup(func() { operation_setting.TaskCrossChannelFailoverEnabled = prev })

	task := &model.Task{
		TaskID:    "t3",
		ChannelId: 1,
		Group:     "default",
		PrivateData: model.TaskPrivateData{
			ClientRequestBody:  `{"model":"x"}`,
			FailoverChannelIDs: []int{1, 2},
			TriedChannelIDs:    []int{1},
		},
	}
	handled, _, err := HandleAsyncTaskFailure(context.Background(), &model.Channel{Id: 1}, nil, task, "余额不足")
	if err != nil || handled {
		t.Fatalf("without recreate func expect not handled, got handled=%v err=%v", handled, err)
	}
}

func TestApplyCrossChannelFailoverResult_UpdatesPlatform(t *testing.T) {
	task := &model.Task{
		TaskID:    "t_platform",
		ChannelId: 12,
		Platform:  "1",
		Status:    model.TaskStatusFailure,
		PrivateData: model.TaskPrivateData{
			TriedChannelIDs: []int{12},
		},
	}
	next := &model.Channel{Id: 26, Type: 69}
	result := &TaskFailoverRecreateResult{
		UpstreamTaskID: "mcp_new",
		UpstreamBody:   `{"model":"videos_933_c1"}`,
		TaskData:       []byte(`{"id":"mcp_new","status":"queued"}`),
		Platform:       "69",
	}
	applyCrossChannelFailoverResult(task, next, result, []int{12, 26})
	if task.ChannelId != 26 {
		t.Fatalf("channel=%d", task.ChannelId)
	}
	if string(task.Platform) != "69" {
		t.Fatalf("platform=%q want 69", task.Platform)
	}
	if task.Status != model.TaskStatusQueued {
		t.Fatalf("status=%v", task.Status)
	}
	if task.PrivateData.UpstreamTaskID != "mcp_new" {
		t.Fatalf("upstream=%q", task.PrivateData.UpstreamTaskID)
	}

	task2 := &model.Task{Platform: "1"}
	applyCrossChannelFailoverResult(task2, next, &TaskFailoverRecreateResult{UpstreamTaskID: "x"}, []int{26})
	if string(task2.Platform) != "69" {
		t.Fatalf("fallback platform=%q want 69 from channel type", task2.Platform)
	}
}
