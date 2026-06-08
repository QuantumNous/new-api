package pollo

import (
	"math"
	"os"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
)

func TestMain(m *testing.M) {
	service.InitHttpClient()
	os.Exit(m.Run())
}

// --- Deterministic tests against captured real Pollo payloads -----------------

func TestParseSubmitResponse_RealEnvelope(t *testing.T) {
	// Real body observed from POST .../seedance-2-0-fast
	body := []byte(`{"code":"SUCCESS","message":"success","data":{"taskId":"cmq52pkgk02qsnnvpdngk49zx","status":"waiting"}}`)
	var r polloSubmitResponse
	if err := common.Unmarshal(body, &r); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if r.failed() {
		t.Fatalf("expected success, got code=%q", r.Code)
	}
	if got := r.taskID(); got != "cmq52pkgk02qsnnvpdngk49zx" {
		t.Fatalf("taskID() = %q, want cmq52pkgk02qsnnvpdngk49zx", got)
	}
}

func TestParseSubmitResponse_Error(t *testing.T) {
	body := []byte(`{"message":"NOT_FOUND_ERROR","code":"NOT_FOUND"}`)
	var r polloSubmitResponse
	if err := common.Unmarshal(body, &r); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if !r.failed() {
		t.Fatalf("expected failed() for code=%q", r.Code)
	}
}

func TestParseTaskResult_Processing(t *testing.T) {
	body := []byte(`{"code":"SUCCESS","message":"success","data":{"taskId":"t","credit":4.4,"generations":[{"id":"g","status":"processing","failMsg":null,"url":"","mediaType":"video"}]}}`)
	a := &TaskAdaptor{}
	info, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if info.Status != model.TaskStatusInProgress {
		t.Fatalf("status = %q, want in-progress", info.Status)
	}
}

func TestParseTaskResult_Success(t *testing.T) {
	body := []byte(`{"code":"SUCCESS","message":"success","data":{"taskId":"t","credit":4.4,"generations":[{"id":"g","status":"succeed","failMsg":null,"url":"https://cdn.pollo.ai/out.mp4","mediaType":"video"}]}}`)
	a := &TaskAdaptor{}
	info, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if info.Status != model.TaskStatusSuccess {
		t.Fatalf("status = %q, want success", info.Status)
	}
	if info.Url != "https://cdn.pollo.ai/out.mp4" {
		t.Fatalf("url = %q", info.Url)
	}
	// credit 4.4 -> tokens ceil(4.4*100) = 440 for the generic billing pipeline
	if info.TotalTokens != 440 || info.CompletionTokens != 440 {
		t.Fatalf("tokens = (total=%d, completion=%d), want 440/440", info.TotalTokens, info.CompletionTokens)
	}
}

// creditToOtherRatio must make the pre-charge equal the eventual token settlement:
//
//	base * ratio  ==  ceil(credit*scale) * ModelRatio * groupRatio
func TestCreditToOtherRatio_MatchesSettlement(t *testing.T) {
	const (
		quotaPerUnit = 500000.0
		modelRatio   = 300.0 // $0.06/credit, no markup: 0.06 * 500000 / 100
		groupRatio   = 1.0
		credit       = 15.0
	)
	// ratio-mode base quota = modelRatio/2 * QuotaPerUnit * groupRatio
	base := int(modelRatio / 2 * quotaPerUnit * groupRatio)
	pd := types.PriceData{
		Quota:          base,
		ModelRatio:     modelRatio,
		GroupRatioInfo: types.GroupRatioInfo{GroupRatio: groupRatio},
	}

	ratio := creditToOtherRatio(credit, pd)
	preCharge := float64(base) * ratio
	settlement := math.Ceil(credit*creditTokenScale) * modelRatio * groupRatio

	if math.Abs(preCharge-settlement) > 1 {
		t.Fatalf("preCharge=%.0f settlement=%.0f (ratio=%g)", preCharge, settlement, ratio)
	}
	// sanity: 15 credit * $0.06 = $0.90 = 450000 quota
	if math.Abs(settlement-450000) > 1 {
		t.Fatalf("settlement=%.0f, want 450000 ($0.90)", settlement)
	}
}

func TestParseValidateResponse(t *testing.T) {
	body := []byte(`{"code":"SUCCESS","data":{"cost":15,"totalCost":15}}`)
	var r polloValidateResponse
	if err := common.Unmarshal(body, &r); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if r.credit() != 15 {
		t.Fatalf("credit() = %v, want 15", r.credit())
	}
}

func TestParseTaskResult_Failed(t *testing.T) {
	body := []byte(`{"code":"SUCCESS","message":"success","data":{"generations":[{"id":"g","status":"failed","failMsg":"bad prompt","url":"","mediaType":"video"}]}}`)
	a := &TaskAdaptor{}
	info, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if info.Status != model.TaskStatusFailure {
		t.Fatalf("status = %q, want failure", info.Status)
	}
	if info.Reason != "bad prompt" {
		t.Fatalf("reason = %q", info.Reason)
	}
}

// --- Live test against the real Pollo API ------------------------------------
// Runs only when POLLO_API_KEY is set, e.g.:
//   POLLO_API_KEY=pollo_xxx go test ./relay/channel/task/pollo/ -run TestLive -v

func TestLiveSubmitAndPoll(t *testing.T) {
	key := os.Getenv("POLLO_API_KEY")
	if key == "" {
		t.Skip("POLLO_API_KEY not set; skipping live test")
	}

	a := &TaskAdaptor{apiKey: key, baseURL: defaultBaseURL, ChannelType: 58}

	// Build the request body via the adaptor's own conversion logic.
	req := &reqStub
	body, err := a.convertToRequestPayload(req, infoFor("seedance-2-0-fast"))
	if err != nil {
		t.Fatalf("convertToRequestPayload: %v", err)
	}
	raw, _ := common.Marshal(body)
	t.Logf("request body: %s", raw)

	// Submit via raw HTTP using the adaptor base URL + header convention.
	taskID := liveSubmit(t, key, "bytedance/seedance-2-0-fast", raw)
	t.Logf("submitted upstream taskID = %s", taskID)

	// Poll using the adaptor's FetchTask + ParseTaskResult.
	deadline := time.Now().Add(3 * time.Minute)
	for {
		resp, err := a.FetchTask(defaultBaseURL, key, map[string]any{"task_id": taskID}, "")
		if err != nil {
			t.Fatalf("FetchTask: %v", err)
		}
		b := readAll(t, resp)
		info, err := a.ParseTaskResult(b)
		if err != nil {
			t.Fatalf("ParseTaskResult: %v (body=%s)", err, b)
		}
		t.Logf("status=%s progress=%s url=%s", info.Status, info.Progress, info.Url)
		if info.Status == model.TaskStatusSuccess {
			if info.Url == "" {
				t.Fatalf("success but empty url; body=%s", b)
			}
			t.Logf("SUCCESS video url: %s", info.Url)
			return
		}
		if info.Status == model.TaskStatusFailure {
			t.Fatalf("generation failed: %s", info.Reason)
		}
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for generation (last status=%s)", info.Status)
		}
		time.Sleep(10 * time.Second)
	}
}
