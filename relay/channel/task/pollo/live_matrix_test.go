package pollo

import (
	"bytes"
	"net/http"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

const testImage = "https://images.pexels.com/photos/45201/kitty-cat-kitten-pet-45201.jpeg?w=512"

type submitOutcome struct {
	httpStatus int
	code       string
	message    string
	taskID     string
}

// buildAndSubmit drives the real adaptor code (convertToRequestPayload +
// BuildRequestURL) and POSTs to the live Pollo API. It does NOT poll — a
// 200 + non-empty taskId means the request format was accepted by Pollo.
func buildAndSubmit(t *testing.T, a *TaskAdaptor, modelName string, req relaycommon.TaskSubmitReq) (string, submitOutcome) {
	t.Helper()
	info := infoFor(modelName)

	body, err := a.convertToRequestPayload(&req, info)
	if err != nil {
		t.Fatalf("[%s] convertToRequestPayload: %v", modelName, err)
	}
	raw, err := common.Marshal(body)
	if err != nil {
		t.Fatalf("[%s] marshal: %v", modelName, err)
	}

	url, err := a.BuildRequestURL(info)
	if err != nil {
		t.Fatalf("[%s] BuildRequestURL: %v", modelName, err)
	}

	httpReq, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(raw))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", a.apiKey)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		t.Fatalf("[%s] POST %s: %v", modelName, url, err)
	}
	b := readAll(t, resp)

	var pr polloSubmitResponse
	_ = common.Unmarshal(b, &pr)
	out := submitOutcome{httpStatus: resp.StatusCode, code: pr.Code, message: pr.Message, taskID: pr.taskID()}
	t.Logf("[%s] URL=%s\n  req=%s\n  -> HTTP %d code=%q msg=%q taskId=%q",
		modelName, url, raw, out.httpStatus, out.code, out.message, out.taskID)
	return string(raw), out
}

func TestLiveParamMatrix(t *testing.T) {
	key := os.Getenv("POLLO_API_KEY")
	if key == "" {
		t.Skip("POLLO_API_KEY not set; skipping live test")
	}
	if os.Getenv("POLLO_LIVE_TEST") != "1" {
		t.Skip("POLLO_LIVE_TEST!=1; skipping test that submits real (paid) Pollo jobs")
	}
	a := &TaskAdaptor{apiKey: key, baseURL: defaultBaseURL, ChannelType: 58}

	cases := []struct {
		name         string
		model        string
		req          relaycommon.TaskSubmitReq
		expectAccept bool
	}{
		{
			name:  "standard/t2v/full-params-1080p",
			model: "seedance-2-0",
			req: relaycommon.TaskSubmitReq{
				Prompt:   "a corgi running on the beach at sunset, cinematic",
				Duration: 8,
				Metadata: map[string]interface{}{
					"resolution":    "1080p",
					"aspectRatio":   "9:16",
					"seed":          42,
					"generateAudio": true,
					"webSearch":     true,
				},
			},
			expectAccept: true,
		},
		{
			name:         "fast/t2v/minimal",
			model:        "seedance-2-0-fast",
			req:          relaycommon.TaskSubmitReq{Prompt: "a timelapse of clouds over mountains"},
			expectAccept: true,
		},
		{
			name:  "fast/i2v/image+prompt",
			model: "seedance-2-0-fast",
			req: relaycommon.TaskSubmitReq{
				Prompt:   "the cat slowly blinks and turns its head",
				Image:    testImage,
				Duration: 5,
				Metadata: map[string]interface{}{"resolution": "720p", "aspectRatio": "1:1"},
			},
			expectAccept: true,
		},
		{
			name:  "standard/i2v/with-imageTail",
			model: "seedance-2-0",
			req: relaycommon.TaskSubmitReq{
				Prompt:   "smooth transition between the two frames",
				Image:    testImage,
				Duration: 5,
				Metadata: map[string]interface{}{"imageTail": testImage, "resolution": "480p"},
			},
			expectAccept: true,
		},
		{
			// refs in metadata => merged model auto-routes to the /ref2video endpoint.
			name:  "ref/ref2video/image-ref",
			model: "seedance-2-0",
			req: relaycommon.TaskSubmitReq{
				Prompt:   "the character waves hello",
				Duration: 5,
				Metadata: map[string]interface{}{
					"resolution":  "720p",
					"aspectRatio": "16:9",
					"refs": []map[string]interface{}{
						{"type": "image", "name": "cat", "image": testImage, "order": 1},
					},
				},
			},
			expectAccept: true,
		},
		{
			name:  "fast-ref/ref2video/image-ref",
			model: "seedance-2-0-fast",
			req: relaycommon.TaskSubmitReq{
				Prompt:   "the character jumps with joy",
				Duration: 5,
				Metadata: map[string]interface{}{
					"resolution":    "480p",
					"aspectRatio":   "9:16",
					"generateAudio": false,
					"videoNum":      1,
					"refs": []map[string]interface{}{
						{"type": "image", "name": "cat", "image": testImage, "order": 1},
					},
				},
			},
			expectAccept: true,
		},

		// ── error / validation cases (should be REJECTED by Pollo) ──────────
		{
			name:  "ERR/fast/1080p-not-allowed",
			model: "seedance-2-0-fast",
			req: relaycommon.TaskSubmitReq{
				Prompt:   "x",
				Metadata: map[string]interface{}{"resolution": "1080p"},
			},
			expectAccept: false,
		},
		{
			name:         "ERR/standard/empty-prompt",
			model:        "seedance-2-0",
			req:          relaycommon.TaskSubmitReq{Prompt: ""},
			expectAccept: false,
		},
	}

	pass, fail := 0, 0
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, out := buildAndSubmit(t, a, tc.model, tc.req)
			accepted := out.httpStatus == http.StatusOK && out.code == codeSuccess && out.taskID != ""
			if accepted != tc.expectAccept {
				fail++
				t.Errorf("expectAccept=%v but accepted=%v (HTTP %d, code=%q, msg=%q)",
					tc.expectAccept, accepted, out.httpStatus, out.code, out.message)
				return
			}
			pass++
			if accepted {
				t.Logf("✅ accepted, taskId=%s", out.taskID)
			} else {
				t.Logf("✅ correctly rejected: HTTP %d code=%q msg=%q", out.httpStatus, out.code, out.message)
			}
		})
	}
	t.Logf("matrix summary: %d passed, %d failed", pass, fail)
}

// liveValidate drives the new billing path's network piece: a.validateURL +
// a.convertToRequestPayload + parse polloValidateResponse. /validate is FREE (no charge).
func liveValidate(t *testing.T, a *TaskAdaptor, modelName string, req relaycommon.TaskSubmitReq) (float64, int) {
	t.Helper()
	info := infoFor(modelName)
	url, ok := a.validateURL(info)
	if !ok {
		t.Fatalf("[%s] no validate url", modelName)
	}
	body, err := a.convertToRequestPayload(&req, info)
	if err != nil {
		t.Fatalf("[%s] convert: %v", modelName, err)
	}
	raw, _ := common.Marshal(body)

	httpReq, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(raw))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", a.apiKey)
	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		t.Fatalf("[%s] validate POST: %v", modelName, err)
	}
	b := readAll(t, resp)
	var vr polloValidateResponse
	_ = common.Unmarshal(b, &vr)
	t.Logf("[%s] validate %s -> HTTP %d body=%s", modelName, url, resp.StatusCode, b)
	return vr.credit(), resp.StatusCode
}

// TestLiveValidate confirms the free /validate endpoint returns a usable credit quote
// for every model family — this is what EstimateBilling relies on for the pre-charge.
func TestLiveValidate(t *testing.T) {
	key := os.Getenv("POLLO_API_KEY")
	if key == "" {
		t.Skip("POLLO_API_KEY not set; skipping live test")
	}
	if os.Getenv("POLLO_LIVE_TEST") != "1" {
		t.Skip("POLLO_LIVE_TEST!=1; skipping live test that makes real network calls to Pollo")
	}
	a := &TaskAdaptor{apiKey: key, baseURL: defaultBaseURL, ChannelType: 58}

	cases := []struct {
		name  string
		model string
		req   relaycommon.TaskSubmitReq
	}{
		{"std-480p-5s", "seedance-2-0", relaycommon.TaskSubmitReq{
			Prompt: "a cat", Duration: 5,
			Metadata: map[string]interface{}{"resolution": "480p", "aspectRatio": "16:9"}}},
		{"fast-720p-5s", "seedance-2-0-fast", relaycommon.TaskSubmitReq{
			Prompt: "a cat", Duration: 5,
			Metadata: map[string]interface{}{"resolution": "720p", "aspectRatio": "16:9"}}},
		{"ref-720p-5s", "seedance-2-0", relaycommon.TaskSubmitReq{
			Prompt: "a cat", Duration: 5,
			Metadata: map[string]interface{}{"resolution": "720p", "aspectRatio": "16:9",
				"refs": []map[string]interface{}{{"type": "image", "name": "c", "image": testImage, "order": 1}}}}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			credit, status := liveValidate(t, a, tc.model, tc.req)
			if status != http.StatusOK || credit <= 0 {
				t.Errorf("validate failed: HTTP %d, credit=%v", status, credit)
				return
			}
			t.Logf("✅ %s validate credit = %v", tc.model, credit)
		})
	}
}
