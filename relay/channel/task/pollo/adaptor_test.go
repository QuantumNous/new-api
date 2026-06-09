package pollo

import (
	"math"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
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

// P1: AdjustBillingOnComplete returns the absolute authoritative quota from the billing
// snapshot (round(TotalTokens)*ModelRatio*GroupRatio) and a positive value, so the service
// settler uses it (priority #1) and skips the OtherRatios-multiplying token path.
func TestAdjustBillingOnComplete(t *testing.T) {
	a := &TaskAdaptor{}
	task := &model.Task{}
	task.PrivateData.BillingContext = &model.TaskBillingContext{
		ModelRatio: 300, GroupRatio: 1,
		OtherRatios: map[string]float64{"pollo_credit": 0.00176}, // must be ignored here
	}
	// TotalTokens = round(4.4*100) = 440  ->  440*300*1 = 132000
	got := a.AdjustBillingOnComplete(task, &relaycommon.TaskInfo{TotalTokens: 440})
	if got != 132000 {
		t.Fatalf("AdjustBillingOnComplete = %d, want 132000 (no OtherRatios applied)", got)
	}
	// matches the precharge formula (TestCreditToOtherRatio_MatchesSettlement) -> delta 0

	// not ratio mode / no billing context -> 0 (let framework keep the hold)
	if v := a.AdjustBillingOnComplete(&model.Task{}, &relaycommon.TaskInfo{TotalTokens: 440}); v != 0 {
		t.Fatalf("no BillingContext should yield 0, got %d", v)
	}
	if v := a.AdjustBillingOnComplete(task, &relaycommon.TaskInfo{TotalTokens: 0}); v != 0 {
		t.Fatalf("zero tokens should yield 0, got %d", v)
	}

	// free group (GroupRatio==0): pre-charge was 0, so settlement must also be 0 —
	// the zero ratio must NOT be coerced to 1 (regression for P2).
	freeTask := &model.Task{}
	freeTask.PrivateData.BillingContext = &model.TaskBillingContext{
		ModelRatio: 300, GroupRatio: 0,
		OtherRatios: map[string]float64{"pollo_credit": 0.00176},
	}
	if v := a.AdjustBillingOnComplete(freeTask, &relaycommon.TaskInfo{TotalTokens: 440}); v != 0 {
		t.Fatalf("free group (GroupRatio=0) must settle to 0, got %d", v)
	}
}

// P3: an error envelope ({"code":"NOT_FOUND"}) must fail, not be treated as queued.
func TestParseTaskResult_ErrorEnvelope(t *testing.T) {
	body := []byte(`{"message":"NOT_FOUND_ERROR","code":"NOT_FOUND"}`)
	a := &TaskAdaptor{}
	info, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if info.Status != model.TaskStatusFailure {
		t.Fatalf("status = %q, want failure (error envelope must not be queued)", info.Status)
	}
	if info.Reason == "" {
		t.Fatalf("expected a failure reason from the error envelope")
	}
}

// The request shape is detected from the payload, not the model name (mirroring
// Doubao's single-model design). A single model serves both shapes:
//   - metadata.refs present  -> /ref2video endpoint + input.duration + refs (no length)
//   - metadata.refs absent    -> base endpoint + input.length + optional image (no duration)
// BuildRequestURL must agree with the body that convertToRequestPayload produced,
// since convertToRequestPayload (run first via BuildRequestBody) sets a.isRef.
func TestRequestShape_RefVsStandard(t *testing.T) {
	t.Run("refs-present -> ref2video shape", func(t *testing.T) {
		info := &relaycommon.RelayInfo{OriginModelName: "seedance-2-0"}
		info.ChannelMeta = &relaycommon.ChannelMeta{UpstreamModelName: "seedance-2-0"}
		a := &TaskAdaptor{baseURL: defaultBaseURL}

		req := &relaycommon.TaskSubmitReq{
			Prompt: "x", Duration: 5,
			Metadata: map[string]interface{}{
				"refs": []map[string]interface{}{{"type": "image", "name": "c", "image": "https://x/y.jpg", "order": 1}},
			},
		}
		body, err := a.convertToRequestPayload(req, info)
		if err != nil {
			t.Fatalf("convertToRequestPayload: %v", err)
		}
		if body.Input.Duration != 5 {
			t.Fatalf("ref body must set duration, got %d", body.Input.Duration)
		}
		if body.Input.Length != 0 {
			t.Fatalf("ref body must NOT set length, got %d", body.Input.Length)
		}
		if len(body.Input.Refs) == 0 {
			t.Fatalf("ref body must carry refs")
		}

		// URL is resolved after the body (a.isRef now set), so it must hit /ref2video.
		url, err := a.BuildRequestURL(info)
		if err != nil {
			t.Fatalf("BuildRequestURL: %v", err)
		}
		if !strings.Contains(url, "/ref2video") {
			t.Fatalf("URL = %q, want a /ref2video endpoint", url)
		}
	})

	t.Run("no-refs -> standard shape", func(t *testing.T) {
		info := &relaycommon.RelayInfo{OriginModelName: "seedance-2-0"}
		info.ChannelMeta = &relaycommon.ChannelMeta{UpstreamModelName: "seedance-2-0"}
		a := &TaskAdaptor{baseURL: defaultBaseURL}

		req := &relaycommon.TaskSubmitReq{Prompt: "x", Duration: 5, Image: "https://x/y.jpg"}
		body, err := a.convertToRequestPayload(req, info)
		if err != nil {
			t.Fatalf("convertToRequestPayload: %v", err)
		}
		if body.Input.Length != 5 {
			t.Fatalf("standard body must set length, got %d", body.Input.Length)
		}
		if body.Input.Duration != 0 {
			t.Fatalf("standard body must NOT set duration, got %d", body.Input.Duration)
		}
		if body.Input.Image != "https://x/y.jpg" {
			t.Fatalf("standard body must carry the i2v image, got %q", body.Input.Image)
		}

		url, err := a.BuildRequestURL(info)
		if err != nil {
			t.Fatalf("BuildRequestURL: %v", err)
		}
		if strings.Contains(url, "/ref2video") {
			t.Fatalf("URL = %q, want the base (non-ref) endpoint", url)
		}
	})

	// An empty refs array is not a ref request — it stays standard.
	t.Run("empty-refs -> standard shape", func(t *testing.T) {
		req := &relaycommon.TaskSubmitReq{
			Prompt:   "x",
			Metadata: map[string]interface{}{"refs": []map[string]interface{}{}},
		}
		if isRefRequest(req) {
			t.Fatalf("empty refs[] must not be treated as a ref request")
		}
	})
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

// TestConvertPayload_ExplicitSeedZeroPreserved guards Rule 6: an explicit metadata.seed:0
// (deterministic seed) must survive to the upstream body, not be dropped by omitempty.
func TestConvertPayload_ExplicitSeedZeroPreserved(t *testing.T) {
	a := &TaskAdaptor{baseURL: defaultBaseURL}
	info := &relaycommon.RelayInfo{OriginModelName: "seedance-2-0"}
	info.ChannelMeta = &relaycommon.ChannelMeta{UpstreamModelName: "seedance-2-0"}
	req := &relaycommon.TaskSubmitReq{
		Prompt: "x", Duration: 5,
		Metadata: map[string]interface{}{"seed": 0},
	}
	body, err := a.convertToRequestPayload(req, info)
	if err != nil {
		t.Fatalf("convertToRequestPayload: %v", err)
	}
	if body.Input.Seed == nil || *body.Input.Seed != 0 {
		t.Fatalf("explicit seed:0 must be preserved, got %v", body.Input.Seed)
	}
	data, err := common.Marshal(body)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if !strings.Contains(string(data), `"seed":0`) {
		t.Fatalf("marshaled body must contain \"seed\":0, got %s", data)
	}
}

// TestConvertPayload_SeedAbsentOmitted confirms an absent seed stays omitted (random upstream).
func TestConvertPayload_SeedAbsentOmitted(t *testing.T) {
	a := &TaskAdaptor{baseURL: defaultBaseURL}
	info := &relaycommon.RelayInfo{OriginModelName: "seedance-2-0"}
	info.ChannelMeta = &relaycommon.ChannelMeta{UpstreamModelName: "seedance-2-0"}
	req := &relaycommon.TaskSubmitReq{Prompt: "x", Duration: 5}
	body, err := a.convertToRequestPayload(req, info)
	if err != nil {
		t.Fatalf("convertToRequestPayload: %v", err)
	}
	if body.Input.Seed != nil {
		t.Fatalf("absent seed must stay nil, got %v", *body.Input.Seed)
	}
	if data, _ := common.Marshal(body); strings.Contains(string(data), `"seed"`) {
		t.Fatalf("marshaled body must omit seed, got %s", data)
	}
}

// TestResolveSeconds_PrecedenceAndPayload guards the Seconds-first/Duration-fallback
// precedence: an OpenAI-compatible `seconds` request (req.Seconds, no req.Duration) must
// build the requested duration upstream, not silently default to 5s.
func TestResolveSeconds_PrecedenceAndPayload(t *testing.T) {
	cases := []struct {
		name     string
		seconds  string
		duration int
		want     int
	}{
		{"seconds-only", "8", 0, 8},          // OpenAI `seconds` field, no duration
		{"seconds-wins-over-duration", "10", 5, 10}, // explicit seconds takes precedence
		{"duration-fallback", "", 6, 6},      // no seconds -> use duration
		{"invalid-seconds-falls-back", "abc", 7, 7}, // unparsable -> duration
		{"both-empty-default-5", "", 0, 5},   // nothing provided -> default 5
		{"zero-seconds-falls-back", "0", 4, 4}, // seconds==0 is not a valid duration
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := &relaycommon.TaskSubmitReq{Prompt: "x", Seconds: tc.seconds, Duration: tc.duration}
			if got := resolveSeconds(req); got != tc.want {
				t.Fatalf("resolveSeconds(seconds=%q,duration=%d) = %d, want %d", tc.seconds, tc.duration, got, tc.want)
			}
		})
	}

	// End-to-end through the payload builder: a non-ref model must set Length from `seconds`.
	a := &TaskAdaptor{baseURL: defaultBaseURL}
	info := &relaycommon.RelayInfo{OriginModelName: "seedance-2-0"}
	info.ChannelMeta = &relaycommon.ChannelMeta{UpstreamModelName: "seedance-2-0"}
	req := &relaycommon.TaskSubmitReq{Prompt: "x", Seconds: "8"}
	body, err := a.convertToRequestPayload(req, info)
	if err != nil {
		t.Fatalf("convertToRequestPayload: %v", err)
	}
	if body.Input.Length != 8 {
		t.Fatalf("non-ref body must honor seconds=8 -> length, got %d", body.Input.Length)
	}
}

// TestParseTaskResult_FlatStatusCredit ensures the flat top-level {credit,generations}
// status shape settles from real usage (credit -> TotalTokens), symmetric with gens().
func TestParseTaskResult_FlatStatusCredit(t *testing.T) {
	body := []byte(`{"code":"SUCCESS","credit":4.4,"generations":[{"id":"g","status":"succeed","url":"https://x/v.mp4","mediaType":"video"}]}`)
	a := &TaskAdaptor{}
	info, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if info.Status != model.TaskStatusSuccess {
		t.Fatalf("status = %q, want success", info.Status)
	}
	want := int(math.Round(4.4 * creditTokenScale))
	if info.TotalTokens != want {
		t.Fatalf("TotalTokens = %d, want %d (flat credit must settle from real usage)", info.TotalTokens, want)
	}
}

// --- Live test against the real Pollo API ------------------------------------
// Submits real, billable jobs. Requires BOTH the API key and an explicit
// opt-in flag so a plain `go test ./...` (with only the key exported) never
// spends credits, e.g.:
//   POLLO_API_KEY=pollo_xxx POLLO_LIVE_TEST=1 go test ./relay/channel/task/pollo/ -run TestLive -v

func TestLiveSubmitAndPoll(t *testing.T) {
	key := os.Getenv("POLLO_API_KEY")
	if key == "" {
		t.Skip("POLLO_API_KEY not set; skipping live test")
	}
	if os.Getenv("POLLO_LIVE_TEST") != "1" {
		t.Skip("POLLO_LIVE_TEST!=1; skipping test that submits real (paid) Pollo jobs")
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
