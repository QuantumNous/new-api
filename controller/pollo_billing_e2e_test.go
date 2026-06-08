package controller

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// TestPolloBillingE2E drives the real settlement path (updateVideoSingleTask) against a
// real Pollo generation and asserts the actual quota deduction.
//
//	submit (real) -> poll (real) -> settle (DB) -> assert user quota delta
//
// Gated on POLLO_API_KEY; consumes ~4.4 credits (fast 480p/4s). Run with:
//
//	POLLO_API_KEY=pollo_xxx go test ./controller/ -run TestPolloBillingE2E -v -timeout 6m
func TestPolloBillingE2E(t *testing.T) {
	key := os.Getenv("POLLO_API_KEY")
	if key == "" {
		t.Skip("POLLO_API_KEY not set; skipping live billing test")
	}

	// --- 1. temp SQLite DB + minimal init ---------------------------------
	common.SQLitePath = filepath.Join(t.TempDir(), "e2e.db?_busy_timeout=30000")
	common.IsMasterNode = true
	common.RedisEnabled = false // no Redis in test; skip the async cache-quota path
	service.InitHttpClient()
	if err := model.InitDB(); err != nil {
		t.Fatalf("InitDB: %v", err)
	}
	if err := model.InitLogDB(); err != nil {
		t.Fatalf("InitLogDB: %v", err)
	}

	// --- 2. configure model ratio: $0.06/credit, no markup ----------------
	// ModelRatio = pricePerCredit * QuotaPerUnit / creditTokenScale = 0.06 * 500000 / 100 = 300
	const modelRatio = 300.0
	if err := ratio_setting.UpdateModelRatioByJSONString(`{"seedance-2-0-fast":300}`); err != nil {
		t.Fatalf("set model ratio: %v", err)
	}

	// --- 3. seed a user with quota ----------------------------------------
	const startQuota = 10_000_000 // $20
	user := &model.User{Username: "pollo_e2e", Password: "placeholder", Group: "default", Status: 1, Quota: startQuota}
	if err := model.DB.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	// --- 4. submit a real Pollo task (cheapest: fast 480p/4s) -------------
	upstreamID := submitPolloFast(t, key)
	t.Logf("submitted upstream task id = %s", upstreamID)

	// --- 5. insert the corresponding task (pre-charge = 0 so the delta == full charge) ---
	task := &model.Task{
		TaskID:     "task_e2e_pollo",
		Platform:   constant.TaskPlatform(fmt.Sprintf("%d", constant.ChannelTypePollo)), // "58"
		UserId:     user.Id,
		ChannelId:  1,
		Group:      "default",
		Quota:      0,
		Action:     constant.TaskActionGenerate,
		Status:     model.TaskStatusSubmitted,
		SubmitTime: time.Now().Unix(),
		Properties: model.Properties{OriginModelName: "seedance-2-0-fast"},
	}
	task.PrivateData.UpstreamTaskID = upstreamID
	if err := model.DB.Create(task).Error; err != nil {
		t.Fatalf("create task: %v", err)
	}

	// --- 6. build channel + adaptor and poll to completion ----------------
	channel := &model.Channel{Type: constant.ChannelTypePollo, Key: key}
	adaptor := relay.GetTaskAdaptor(task.Platform)
	if adaptor == nil {
		t.Fatal("pollo task adaptor not found")
	}
	info := &relaycommon.RelayInfo{}
	info.ChannelMeta = &relaycommon.ChannelMeta{ChannelBaseUrl: "https://pollo.ai/api/platform", ApiKey: key}
	info.ApiKey = key
	adaptor.Init(info)

	// Production keys taskM by the UPSTREAM task id and passes it to the updater
	// (service/task_polling.go), which forwards it to FetchTask as body["task_id"].
	taskM := map[string]*model.Task{upstreamID: task}
	ctx := context.Background()

	deadline := time.Now().Add(5 * time.Minute)
	for {
		if err := updateVideoSingleTask(ctx, adaptor, channel, upstreamID, taskM); err != nil {
			t.Fatalf("updateVideoSingleTask: %v", err)
		}
		t.Logf("status=%s progress=%s quota=%d", task.Status, task.Progress, task.Quota)
		if task.Status == model.TaskStatusSuccess {
			break
		}
		if task.Status == model.TaskStatusFailure {
			t.Fatalf("generation failed: %s", task.FailReason)
		}
		if time.Now().After(deadline) {
			t.Fatalf("timed out (last status=%s)", task.Status)
		}
		time.Sleep(10 * time.Second)
	}

	// --- 7. assert the real quota deduction -------------------------------
	// Allow the async cache decrement goroutine to settle; the DB write is synchronous.
	u, err := model.GetUserById(user.Id, false)
	if err != nil {
		t.Fatalf("reload user: %v", err)
	}
	deducted := startQuota - u.Quota
	t.Logf("user quota: %d -> %d (deducted %d = $%.4f); task.Quota=%d",
		startQuota, u.Quota, deducted, float64(deducted)/common.QuotaPerUnit, task.Quota)

	// Expected: ceil/round(credit*100) * modelRatio * groupRatio(=1).
	// fast 480p/4s = 4.4 credit -> 440 tokens -> 440*300 = 132000 quota = $0.264.
	const wantTokens = 440
	const wantQuota = wantTokens * int(modelRatio) // 132000

	if task.Quota != wantQuota {
		t.Errorf("task.Quota = %d, want %d", task.Quota, wantQuota)
	}
	if deducted != wantQuota {
		t.Errorf("deducted = %d, want %d", deducted, wantQuota)
	}
	if deducted == wantQuota {
		t.Logf("✅ settlement correct: 4.4 credit -> %d quota ($%.4f) deducted from user",
			deducted, float64(deducted)/common.QuotaPerUnit)
	}
}

func submitPolloFast(t *testing.T, key string) string {
	t.Helper()
	body := []byte(`{"input":{"prompt":"a corgi running on the beach, cinematic","resolution":"480p","length":4,"aspectRatio":"16:9"}}`)
	req, _ := http.NewRequest(http.MethodPost,
		"https://pollo.ai/api/platform/generation/bytedance/seedance-2-0-fast", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", key)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("submit: %v", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	var r struct {
		Code string `json:"code"`
		Data struct {
			TaskId string `json:"taskId"`
		} `json:"data"`
	}
	if err := common.Unmarshal(b, &r); err != nil {
		t.Fatalf("parse submit resp: %v (body=%s)", err, b)
	}
	if r.Data.TaskId == "" {
		t.Fatalf("no taskId in submit response: %s", b)
	}
	return r.Data.TaskId
}
