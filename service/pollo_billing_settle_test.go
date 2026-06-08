package service

import (
	"context"
	"net/http"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// fakeSettleAdaptor lets us drive settleTaskBillingOnComplete without importing a real
// adaptor (which would create an import cycle: adaptors import the service package).
type fakeSettleAdaptor struct{ adjust int }

func (f *fakeSettleAdaptor) Init(*relaycommon.RelayInfo) {}
func (f *fakeSettleAdaptor) FetchTask(string, string, map[string]any, string) (*http.Response, error) {
	return nil, nil
}
func (f *fakeSettleAdaptor) ParseTaskResult([]byte) (*relaycommon.TaskInfo, error) { return nil, nil }
func (f *fakeSettleAdaptor) AdjustBillingOnComplete(*model.Task, *relaycommon.TaskInfo) int {
	return f.adjust
}

// TestSettleUsesAdjustAndSkipsOtherRatios locks the invariant the Pollo P1 fix relies on:
// when an adaptor's AdjustBillingOnComplete returns >0, the settler uses that exact amount
// (priority #1) and does NOT fall through to the token-recalc path that would re-multiply
// the persisted OtherRatios (e.g. the precharge-only "pollo_credit" ratio). If this
// regresses, Pollo completion billing double-counts again.
func TestSettleUsesAdjustAndSkipsOtherRatios(t *testing.T) {
	common.SQLitePath = filepath.Join(t.TempDir(), "settle.db?_busy_timeout=30000")
	common.IsMasterNode = true
	common.RedisEnabled = false
	if err := model.InitDB(); err != nil {
		t.Fatalf("InitDB: %v", err)
	}
	if err := model.InitLogDB(); err != nil {
		t.Fatalf("InitLogDB: %v", err)
	}
	// configure a ratio so the (wrong) token-recalc path WOULD run if step 1 didn't win
	if err := ratio_setting.UpdateModelRatioByJSONString(`{"seedance-2-0-fast":300}`); err != nil {
		t.Fatalf("set ratio: %v", err)
	}

	const startQuota = 10_000_000
	user := &model.User{Username: "settle_inv", Password: "placeholder", Group: "default", Status: 1, Quota: startQuota}
	if err := model.DB.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	const (
		precharge   = 132000 // credit*scale*modelRatio*group, as EstimateBilling produced
		adjustQuota = 132000 // what Pollo's AdjustBillingOnComplete returns (absolute, correct)
	)
	task := &model.Task{
		TaskID: "task_settle_inv", Platform: "58", UserId: user.Id, ChannelId: 1,
		Group: "default", Quota: precharge, Status: model.TaskStatusSuccess,
		Properties: model.Properties{OriginModelName: "seedance-2-0-fast"},
	}
	task.PrivateData.BillingContext = &model.TaskBillingContext{
		ModelRatio: 300, GroupRatio: 1,
		// precharge-only ratio that MUST NOT be re-applied at settlement
		OtherRatios:     map[string]float64{"pollo_credit": 0.00176},
		OriginModelName: "seedance-2-0-fast",
		PerCallBilling:  false,
	}
	if err := model.DB.Create(task).Error; err != nil {
		t.Fatalf("create task: %v", err)
	}

	// TotalTokens is set (as Pollo's ParseTaskResult does) — proving step 1 still wins over step 2.
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess, TotalTokens: 440}
	settleTaskBillingOnComplete(context.Background(), &fakeSettleAdaptor{adjust: adjustQuota}, task, taskResult)

	u, err := model.GetUserById(user.Id, false)
	if err != nil {
		t.Fatalf("reload user: %v", err)
	}
	deducted := startQuota - u.Quota
	t.Logf("task.Quota=%d, deducted=%d (precharge=%d, adjust=%d)", task.Quota, deducted, precharge, adjustQuota)

	if task.Quota != adjustQuota {
		t.Errorf("task.Quota = %d, want %d (must use AdjustBillingOnComplete, not token*OtherRatios)", task.Quota, adjustQuota)
	}
	if deducted != 0 {
		t.Errorf("deducted = %d, want 0; non-zero means the OtherRatios path ran (double-count)", deducted)
	}
}
