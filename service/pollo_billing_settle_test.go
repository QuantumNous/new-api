package service

import (
	"context"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// fakeSettleAdaptor lets us drive settleTaskBillingOnComplete without importing a real
// adaptor (which would create an import cycle: adaptors import the service package).
type fakeSettleAdaptor struct {
	taskcommon.UnsupportedAssets // GCS 转存钩子（本测试不涉及，沿用 no-op 实现）
	adjust                       int
}

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
	// Reuse the package-wide in-memory DB from TestMain and clean up rows after the
	// test (via truncate's t.Cleanup). Do NOT call model.InitDB() here — it would
	// overwrite the shared global DB with a temp-file DB that disappears when t.TempDir()
	// is removed, breaking every later test in the package with readonly/unique errors.
	truncate(t)
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

// TestSettleZeroGroupRatioStaysFree locks the P2 zero-group-ratio fix: a task pre-charged 0
// because its submit-time group ratio was 0 (free/special group) must settle to 0 even when
// the LIVE group ratio diverges to a nonzero value (admin raised it mid-task, or the special
// per-user ratio can't be reproduced by the settle-time GetGroupGroupRatio key). The adaptor
// returns 0 from AdjustBillingOnComplete (the >0 gate skips it), so the token-recalc fallback
// runs — and it must honor the persisted bc.GroupRatio==0 rather than re-deriving a live ratio.
func TestSettleZeroGroupRatioStaysFree(t *testing.T) {
	truncate(t)
	// A nonzero model ratio so the token-recalc path is active; the only thing forcing the
	// result to 0 must be the snapshot group ratio.
	if err := ratio_setting.UpdateModelRatioByJSONString(`{"seedance-2-0-fast":300}`); err != nil {
		t.Fatalf("set ratio: %v", err)
	}

	const startQuota = 10_000_000
	// Group "freegrp" is NOT configured to 0 in live settings, so GetGroupRatio falls back to
	// the default (nonzero) — exactly the live/snapshot divergence the fix must neutralize.
	user := &model.User{Username: "settle_free", Password: "placeholder", Group: "freegrp", Status: 1, Quota: startQuota}
	if err := model.DB.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	task := &model.Task{
		TaskID: "task_settle_free", Platform: "58", UserId: user.Id, ChannelId: 1,
		Group: "freegrp", Quota: 0, Status: model.TaskStatusSuccess, // pre-charged 0 (free)
		Properties: model.Properties{OriginModelName: "seedance-2-0-fast"},
	}
	task.PrivateData.BillingContext = &model.TaskBillingContext{
		ModelRatio: 300, GroupRatio: 0, // submit-time snapshot: free
		OriginModelName: "seedance-2-0-fast",
		PerCallBilling:  false,
	}
	if err := model.DB.Create(task).Error; err != nil {
		t.Fatalf("create task: %v", err)
	}

	// Adaptor returns 0 (free), so the settler falls through to token recalc with TotalTokens>0.
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess, TotalTokens: 440}
	settleTaskBillingOnComplete(context.Background(), &fakeSettleAdaptor{adjust: 0}, task, taskResult)

	u, err := model.GetUserById(user.Id, false)
	if err != nil {
		t.Fatalf("reload user: %v", err)
	}
	deducted := startQuota - u.Quota
	t.Logf("task.Quota=%d, deducted=%d (want 0 — free task must stay free)", task.Quota, deducted)

	if task.Quota != 0 {
		t.Errorf("task.Quota = %d, want 0 (free task must settle to 0, snapshot group ratio honored)", task.Quota)
	}
	if deducted != 0 {
		t.Errorf("deducted = %d, want 0; non-zero means settlement re-derived a live group ratio and charged a free task", deducted)
	}
}
