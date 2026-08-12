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
