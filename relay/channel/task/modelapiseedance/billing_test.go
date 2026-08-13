package modelapiseedance

import (
	"io"
	"math"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/types"
)

func modelAPIBillingInfo(modelPrice float64) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		OriginModelName: "client-seedance",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: UpstreamModel,
		},
		PriceData: types.PriceData{
			UsePrice:   true,
			ModelPrice: modelPrice,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}
}

func assertModelAPIBillableUnits(t *testing.T, got map[string]float64, want float64) {
	t.Helper()
	if len(got) != 1 {
		t.Fatalf("EstimateBilling() = %#v, want only billable_units", got)
	}
	if math.Abs(got[modelAPIBillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("billable_units = %.12f, want %.12f", got[modelAPIBillingUnitsKey], want)
	}
}

func TestEstimateBillingUsesSeedanceDefaultsAndResolutionPricing(t *testing.T) {
	tests := []struct {
		name    string
		body    string
		wantUSD float64
	}{
		{
			name:    "defaults to 5s 720p without video",
			body:    `{"model":"client","content":[{"type":"text","text":"make it cinematic"}]}`,
			wantUSD: 0.314 * 5,
		},
		{
			name:    "explicit 480p without video",
			body:    `{"model":"client","duration":4,"resolution":"480p","content":[{"type":"text","text":"make it cinematic"}]}`,
			wantUSD: 0.140 * 4,
		},
		{
			name:    "explicit 720p without video",
			body:    `{"model":"client","duration":10,"resolution":"720p","content":[{"type":"text","text":"make it cinematic"}]}`,
			wantUSD: 0.314 * 10,
		},
		{
			name:    "explicit 480p with video uses 30s fallback",
			body:    `{"model":"client","duration":4,"resolution":"480p","content":[{"type":"video_url","video_url":{"url":"https://example.com/ref.mp4"}}]}`,
			wantUSD: 0.084 * 30,
		},
		{
			name:    "explicit 720p with video uses 30s fallback",
			body:    `{"model":"client","duration":4,"resolution":"720p","content":[{"type":"video_url","video_url":{"url":"https://example.com/ref.mp4"}}]}`,
			wantUSD: 0.188 * 30,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			c, _ := newModelAPITestContext(test.body)
			got := (&TaskAdaptor{}).EstimateBilling(c, modelAPIBillingInfo(modelAPIBaseModelPrice))
			assertModelAPIBillableUnits(t, got, test.wantUSD/modelAPIBaseModelPrice)
		})
	}
}

func TestValidateTaskPriceDataRequiresFiniteFixedModelPrice(t *testing.T) {
	tests := []struct {
		name string
		info *relaycommon.RelayInfo
	}{
		{name: "nil info", info: nil},
		{name: "not fixed price", info: func() *relaycommon.RelayInfo {
			info := modelAPIBillingInfo(modelAPIBaseModelPrice)
			info.PriceData.UsePrice = false
			return info
		}()},
		{name: "zero model price", info: modelAPIBillingInfo(0)},
		{name: "negative model price", info: modelAPIBillingInfo(-0.14)},
		{name: "nan model price", info: modelAPIBillingInfo(math.NaN())},
		{name: "infinite model price", info: modelAPIBillingInfo(math.Inf(1))},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			taskErr := (&TaskAdaptor{}).ValidateTaskPriceData(test.info)
			if taskErr == nil {
				t.Fatal("ValidateTaskPriceData() = nil, want local model_price_error")
			}
			if taskErr.Code != "model_price_error" || taskErr.StatusCode != http.StatusBadRequest || !taskErr.LocalError {
				t.Fatalf("TaskError = %+v, want local model_price_error/400", taskErr)
			}
		})
	}

	if taskErr := (&TaskAdaptor{}).ValidateTaskPriceData(modelAPIBillingInfo(modelAPIBaseModelPrice)); taskErr != nil {
		t.Fatalf("valid fixed price rejected: %+v", taskErr)
	}
}

func TestEstimateBillingReturnsNilForInvalidFixedPriceData(t *testing.T) {
	c, _ := newModelAPITestContext(`{"model":"client","content":[{"type":"text","text":"make it cinematic"}]}`)
	tests := []*relaycommon.RelayInfo{
		nil,
		func() *relaycommon.RelayInfo {
			info := modelAPIBillingInfo(modelAPIBaseModelPrice)
			info.PriceData.UsePrice = false
			return info
		}(),
		modelAPIBillingInfo(0),
		modelAPIBillingInfo(-0.14),
		modelAPIBillingInfo(math.NaN()),
		modelAPIBillingInfo(math.Inf(1)),
	}
	for i, info := range tests {
		if got := (&TaskAdaptor{}).EstimateBilling(c, info); len(got) != 0 {
			t.Fatalf("case %d EstimateBilling() = %#v, want nil", i, got)
		}
	}
}

func TestDoResponsePersistsPrivateEstimateAndAdjustsSubmitBilling(t *testing.T) {
	a := &TaskAdaptor{}
	info := modelAPIBillingInfo(modelAPIBaseModelPrice)
	c, w := newModelAPITestContext(`{}`)
	resp := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{
		"task_id":"upstream-secret",
		"status":"pending",
		"usage":{"estimated_usd":1.57},
		"result":{"assets":[{"type":"video","url":"https://cdn.modelapi.co/private.mp4"}]}
	}`))}

	taskID, taskData, taskErr := a.DoResponse(c, resp, info)
	if taskErr != nil {
		t.Fatalf("DoResponse error: %+v", taskErr)
	}
	if taskID != "upstream-secret" {
		t.Fatalf("taskID = %q, want upstream id returned only internally", taskID)
	}
	var snapshot struct {
		Status       string   `json:"status"`
		EstimatedUSD *float64 `json:"estimated_usd,omitempty"`
	}
	if err := common.Unmarshal(taskData, &snapshot); err != nil {
		t.Fatalf("taskData is invalid JSON: %v", err)
	}
	if snapshot.Status != "pending" || snapshot.EstimatedUSD == nil || *snapshot.EstimatedUSD != 1.57 {
		t.Fatalf("taskData snapshot = %s, want private status and estimated_usd", taskData)
	}
	public := w.Body.String()
	for _, leaked := range []string{"estimated_usd", "upstream-secret", "cdn.modelapi.co", "private.mp4"} {
		if strings.Contains(public, leaked) {
			t.Fatalf("public response leaked %q: %s", leaked, public)
		}
	}

	adjusted := a.AdjustBillingOnSubmit(info, taskData)
	assertModelAPIBillableUnits(t, adjusted, 1.57/modelAPIBaseModelPrice)
}

func TestDoResponseKeepsFallbackReservationWhenEstimateIsInvalidOrAbsent(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "missing usage", body: `{"task_id":"upstream","status":"pending"}`},
		{name: "usage null", body: `{"task_id":"upstream","status":"pending","usage":null}`},
		{name: "estimate null", body: `{"task_id":"upstream","status":"pending","usage":{"estimated_usd":null}}`},
		{name: "estimate zero", body: `{"task_id":"upstream","status":"pending","usage":{"estimated_usd":0}}`},
		{name: "estimate negative", body: `{"task_id":"upstream","status":"pending","usage":{"estimated_usd":-1}}`},
		{name: "estimate string nan", body: `{"task_id":"upstream","status":"pending","usage":{"estimated_usd":"NaN"}}`},
		{name: "estimate overflow", body: `{"task_id":"upstream","status":"pending","usage":{"estimated_usd":1e999}}`},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			c, w := newModelAPITestContext(`{}`)
			resp := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(test.body))}
			taskID, taskData, taskErr := (&TaskAdaptor{}).DoResponse(c, resp, modelAPIBillingInfo(modelAPIBaseModelPrice))
			if taskErr != nil {
				t.Fatalf("DoResponse error: %+v", taskErr)
			}
			if taskID != "upstream" {
				t.Fatalf("taskID = %q, want upstream", taskID)
			}
			if strings.Contains(string(taskData), "estimated_usd") {
				t.Fatalf("invalid estimate persisted in taskData: %s", taskData)
			}
			if got := (&TaskAdaptor{}).AdjustBillingOnSubmit(modelAPIBillingInfo(modelAPIBaseModelPrice), taskData); len(got) != 0 {
				t.Fatalf("AdjustBillingOnSubmit() = %#v, want nil fallback", got)
			}
			if strings.Contains(w.Body.String(), "estimated_usd") {
				t.Fatalf("public response exposed invalid estimate: %s", w.Body.String())
			}
		})
	}
}

func TestAdjustBillingOnSubmitKeepsReservationForInvalidSnapshotOrPrice(t *testing.T) {
	validData := []byte(`{"status":"pending","estimated_usd":1.57}`)
	tests := []struct {
		name string
		info *relaycommon.RelayInfo
		data []byte
	}{
		{name: "malformed taskData", info: modelAPIBillingInfo(modelAPIBaseModelPrice), data: []byte(`{"status":`)},
		{name: "missing estimate", info: modelAPIBillingInfo(modelAPIBaseModelPrice), data: []byte(`{"status":"pending"}`)},
		{name: "estimate zero", info: modelAPIBillingInfo(modelAPIBaseModelPrice), data: []byte(`{"status":"pending","estimated_usd":0}`)},
		{name: "estimate negative", info: modelAPIBillingInfo(modelAPIBaseModelPrice), data: []byte(`{"status":"pending","estimated_usd":-1}`)},
		{name: "nil info", info: nil, data: validData},
		{name: "non fixed price", info: func() *relaycommon.RelayInfo {
			info := modelAPIBillingInfo(modelAPIBaseModelPrice)
			info.PriceData.UsePrice = false
			return info
		}(), data: validData},
		{name: "invalid model price", info: modelAPIBillingInfo(math.Inf(1)), data: validData},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := (&TaskAdaptor{}).AdjustBillingOnSubmit(test.info, test.data); len(got) != 0 {
				t.Fatalf("AdjustBillingOnSubmit() = %#v, want nil fallback", got)
			}
		})
	}
}

func TestResolveBillingDimensions(t *testing.T) {
	tests := []struct {
		name       string
		resolution string
		hasVideo   bool
		want       map[string]string
	}{
		{"720p no video", "720p", false,
			map[string]string{"resolution": "720p", "has_video": "false"}},
		{"480p with video", "480p", true,
			map[string]string{"resolution": "480p", "has_video": "true"}},
		{"uppercase folds", "720P", false,
			map[string]string{"resolution": "720p", "has_video": "false"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := resolveDimensions(tc.resolution, tc.hasVideo)
			if !ok {
				t.Fatal("expected dimensions to resolve")
			}
			for k, want := range tc.want {
				if got[k] != want {
					t.Fatalf("dims[%q] = %q, want %q", k, got[k], want)
				}
			}
		})
	}
}

func TestResolveBillingDimensions_RejectsUnknownResolution(t *testing.T) {
	if _, ok := resolveDimensions("banana", false); ok {
		t.Fatal("unknown resolution must not resolve")
	}
}

func TestSecondBillingRatios_UsesConfiguredPrice(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"resolution": "720p", "has_video": "false"}
	a.secondBillingSeconds = 5
	a.secondBillingModelPrice = 0.14
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.314, Basis: billing_setting.BasisOutputDuration},
	}

	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := 0.314 * 5 / 0.14
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

func TestSecondBillingRatios_NotCapturedIsNoOp(t *testing.T) {
	// EstimateBilling never ran, or the model is unconfigured.
	a := &TaskAdaptor{}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil ratios, got %v", got)
	}
}

func TestSecondBillingRatios_ConfiguredButUnmatchedErrors(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"resolution": "4k", "has_video": "false"}
	a.secondBillingSeconds = 5
	a.secondBillingModelPrice = 0.14
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.314, Basis: billing_setting.BasisOutputDuration},
	}

	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// installModelAPIVideoPriceRules loads a rule set into the live config and
// restores the previous configuration afterwards. It exercises the real
// GetVideoPriceRules path rather than hand-setting adapter fields, so a test
// using it proves EstimateBilling actually consults the configured table.
func installModelAPIVideoPriceRules(t *testing.T, rulesJSON string) {
	t.Helper()
	saved := map[string]string{}
	if err := config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}); err != nil {
		t.Fatalf("snapshot config: %v", err)
	}
	t.Cleanup(func() {
		if err := config.GlobalConfig.LoadFromDB(saved); err != nil {
			t.Fatalf("restore config: %v", err)
		}
	})
	if err := config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting_video.video_price_rules": rulesJSON,
	}); err != nil {
		t.Fatalf("install video price rules: %v", err)
	}
	if len(billing_setting.GetVideoPriceRules()) == 0 {
		t.Fatal("video price rules did not load; the config module name or key is wrong")
	}
}

// A configured model returns nil from EstimateBilling, so its legacy USD
// estimate never applies -- per-second is the whole price. When the request
// cannot be priced, returning no ratios therefore bills the bare ModelPrice
// with no seconds multiplier, charging a 30-second render as a single unit. It
// has to fail instead, so relay_task rejects before submitting upstream and the
// request costs nothing.
//
// The length is never in doubt on this channel: an omitted duration defaults to
// 5 and this upstream has no `frames` field, so an unclassifiable resolution is
// the only way a request goes unpriced.
//
// That shape is NOT reachable through the production path -- see
// TestModelAPIUnpriceableResolutionIsUnreachableInProduction, which pins why.
// This test drives EstimateBilling directly to pin the contract anyway, because
// reachability rests on two lists that agree only by convention:
// supportedModelAPIResolutions (480p/720p) happens to be a subset of the shared
// vocabulary NormalizeResolution knows. Widening the validator without widening
// the vocabulary would make it reachable, and the failure mode it guards
// against is silent -- every request at the new tier billed as one unit.
func TestModelAPIEstimateBillingConfiguredButUnpriceableErrors(t *testing.T) {
	installModelAPIVideoPriceRules(t, `[
		{"model":"client-seedance","match":{"resolution":"720p"},"price_per_second":0.314,"basis":"output_duration"}
	]`)

	c, _ := newModelAPITestContext(
		`{"model":"client","resolution":"banana","duration":5,"content":[{"type":"text","text":"hi"}]}`)
	a := &TaskAdaptor{}
	if ratios := a.EstimateBilling(c, modelAPIBillingInfo(modelAPIBaseModelPrice)); len(ratios) != 0 {
		t.Fatalf("configured model must not use legacy ratios: %v", ratios)
	}
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured but unpriceable request must return an error")
	}
}

// The mirror image: an UNCONFIGURED model keeps today's behaviour exactly.
// modelAPIEstimatedUSD prices only 480p and 720p, so an unclassifiable
// resolution already yielded no ratios here -- the point is that it must not
// start erroring either, since a request the gateway never priced per second
// has nothing to reject.
func TestModelAPIEstimateBillingUnconfiguredModelStaysOnLegacyPathWhenUnpriceable(t *testing.T) {
	installModelAPIVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"720p"},"price_per_second":0.314,"basis":"output_duration"}
	]`)

	c, _ := newModelAPITestContext(
		`{"model":"client","resolution":"banana","duration":5,"content":[{"type":"text","text":"hi"}]}`)
	a := &TaskAdaptor{}
	if ratios := a.EstimateBilling(c, modelAPIBillingInfo(modelAPIBaseModelPrice)); len(ratios) != 0 {
		t.Fatalf("legacy path prices only 480p/720p; got %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("an unconfigured model must never fail pricing: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("unconfigured model produced per-second units: %v", got)
	}
}

// A tier the shared vocabulary classifies but this channel's legacy table does
// not price (1080p) must still reach the legacy path for an unconfigured model
// and still return nothing -- capture succeeds, so no error is recorded.
func TestModelAPIEstimateBillingUnconfiguredModelKeepsLegacyPricingForKnownTiers(t *testing.T) {
	installModelAPIVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"720p"},"price_per_second":0.314,"basis":"output_duration"}
	]`)

	c, _ := newModelAPITestContext(
		`{"model":"client","resolution":"480p","duration":4,"content":[{"type":"text","text":"hi"}]}`)
	a := &TaskAdaptor{}
	got := a.EstimateBilling(c, modelAPIBillingInfo(modelAPIBaseModelPrice))
	assertModelAPIBillableUnits(t, got, 0.140*4/modelAPIBaseModelPrice)
	if _, err := a.SecondBillingRatios(); err != nil {
		t.Fatalf("an unconfigured model must never fail pricing: %v", err)
	}
}

// Unlike its sibling channels, this one cannot actually reach the unpriceable
// branch in production. It implements ValidateRequestAfterModelMapping, and
// relay_task's prepareTaskSubmit runs that BEFORE EstimateBilling (step 2.5
// precedes step 5), so validateModelAPISeedanceRequest has already rejected any
// resolution outside 480p/720p with a 400. Both values are in the shared
// vocabulary, so whatever survives validation always classifies.
//
// This test pins that ordering rather than the adaptor's own logic. If a future
// change lets arbitrary resolution text through to pricing -- by dropping the
// post-mapping validator, reordering the relay, or widening the whitelist --
// this test fails and says so, and the guard the sibling tests exercise starts
// carrying real traffic instead of merely being defensive.
func TestModelAPIUnpriceableResolutionIsUnreachableInProduction(t *testing.T) {
	// The exact request the unpriceable-branch test drives directly.
	c, _ := newModelAPITestContext(
		`{"model":"client","resolution":"banana","duration":5,"content":[{"type":"text","text":"hi"}]}`)
	a := &TaskAdaptor{}

	taskErr := a.ValidateRequestAfterModelMapping(c, modelAPIBillingInfo(modelAPIBaseModelPrice))
	if taskErr == nil {
		t.Fatal("an unclassifiable resolution now reaches EstimateBilling; " +
			"the per-second guard is live and this test's premise is stale")
	}
	if taskErr.StatusCode != http.StatusBadRequest {
		t.Fatalf("rejection status = %d, want %d", taskErr.StatusCode, http.StatusBadRequest)
	}

	// Every resolution that DOES survive validation must classify, or a
	// configured request would be rejected at submit time for a value the
	// channel officially supports.
	for resolution := range supportedModelAPIResolutions {
		if _, ok := taskcommon.NormalizeResolution(resolution); !ok {
			t.Fatalf("supported resolution %q does not classify; a configured "+
				"model would be refused for a value this channel accepts", resolution)
		}
	}
}
