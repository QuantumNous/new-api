package xaigrok

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// TestBuildXaiVideoRequest_TextOnly verifies a prompt-only request maps to the
// upstream body with no image and no duration.
func TestBuildXaiVideoRequest_TextOnly(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		Model:  ModelGrokImagineVideo,
		Prompt: "a cat surfing",
	}
	body := buildXaiVideoRequest(req, ModelGrokImagineVideo15)

	if body.Model != ModelGrokImagineVideo15 {
		t.Fatalf("model = %q, want %q (upstream model wins)", body.Model, ModelGrokImagineVideo15)
	}
	if body.Prompt != "a cat surfing" {
		t.Fatalf("prompt = %q", body.Prompt)
	}
	if body.Image != nil {
		t.Fatalf("image = %+v, want nil", body.Image)
	}
	if body.Duration != nil {
		t.Fatalf("duration = %v, want nil", *body.Duration)
	}

	// Optional pointer fields must be omitted (not sent as zero) when absent.
	data, err := common.MarshalNoHTMLEscape(body)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if strings.Contains(string(data), "image") || strings.Contains(string(data), "duration") {
		t.Fatalf("marshaled body should omit absent optional fields: %s", data)
	}
}

// TestBuildXaiVideoRequest_ImageAndDuration verifies image-to-video mapping and
// that duration is forwarded from either the numeric or the string field.
func TestBuildXaiVideoRequest_ImageAndDuration(t *testing.T) {
	cases := []struct {
		name string
		req  relaycommon.TaskSubmitReq
	}{
		{
			name: "singular image + numeric duration",
			req: relaycommon.TaskSubmitReq{
				Model:    ModelGrokImagineVideo15,
				Prompt:   "pan across a city",
				Image:    "https://example.com/a.png?x=1&y=2",
				Duration: 6,
			},
		},
		{
			name: "images[] + seconds string",
			req: relaycommon.TaskSubmitReq{
				Model:   ModelGrokImagineVideo15,
				Prompt:  "pan across a city",
				Images:  []string{"https://example.com/a.png?x=1&y=2"},
				Seconds: "6",
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body := buildXaiVideoRequest(tc.req, ModelGrokImagineVideo15)
			if body.Image == nil || body.Image.URL != "https://example.com/a.png?x=1&y=2" {
				t.Fatalf("image = %+v", body.Image)
			}
			if body.Duration == nil || *body.Duration != 6 {
				t.Fatalf("duration = %v, want 6", body.Duration)
			}
			// '&' in the image URL must survive marshaling un-escaped.
			data, err := common.MarshalNoHTMLEscape(body)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			if !strings.Contains(string(data), "x=1&y=2") {
				t.Fatalf("image URL '&' was escaped: %s", data)
			}
		})
	}
}

// TestParseTaskResult_Submit ensures the submit response request_id parses.
func TestParseTaskResult_SubmitResponse(t *testing.T) {
	var resp xaiSubmitResponse
	if err := common.Unmarshal([]byte(`{"request_id":"req_abc123"}`), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.RequestID != "req_abc123" {
		t.Fatalf("request_id = %q", resp.RequestID)
	}
}

// TestParseTaskResult_Poll covers the status → TaskInfo mapping.
func TestParseTaskResult_Poll(t *testing.T) {
	a := &TaskAdaptor{}

	t.Run("done maps to SUCCESS with url and usage", func(t *testing.T) {
		body := []byte(`{"status":"done","video":{"url":"https://vidgen.x.ai/out.mp4"},"model":"grok-imagine-video-1.5","progress":100,"usage":{"completion_tokens":12,"total_tokens":34}}`)
		info, err := a.ParseTaskResult(body)
		if err != nil {
			t.Fatalf("parse: %v", err)
		}
		if info.Status != model.TaskStatusSuccess {
			t.Fatalf("status = %q, want %q", info.Status, model.TaskStatusSuccess)
		}
		if info.Url != "https://vidgen.x.ai/out.mp4" {
			t.Fatalf("url = %q", info.Url)
		}
		if info.CompletionTokens != 12 || info.TotalTokens != 34 {
			t.Fatalf("usage = %d/%d", info.CompletionTokens, info.TotalTokens)
		}
	})

	t.Run("pending maps to IN_PROGRESS", func(t *testing.T) {
		info, err := a.ParseTaskResult([]byte(`{"status":"pending","progress":30}`))
		if err != nil {
			t.Fatalf("parse: %v", err)
		}
		if info.Status != model.TaskStatusInProgress {
			t.Fatalf("status = %q, want %q", info.Status, model.TaskStatusInProgress)
		}
		if info.Progress != "30%" {
			t.Fatalf("progress = %q, want 30%%", info.Progress)
		}
	})

	t.Run("expired maps to FAILURE", func(t *testing.T) {
		info, err := a.ParseTaskResult([]byte(`{"status":"expired"}`))
		if err != nil {
			t.Fatalf("parse: %v", err)
		}
		if info.Status != model.TaskStatusFailure {
			t.Fatalf("status = %q, want %q", info.Status, model.TaskStatusFailure)
		}
	})

	t.Run("failed reason is brand-scrubbed", func(t *testing.T) {
		// Upstream failure text mentioning the provider must not leak.
		body := []byte(`{"status":"failed","error":{"message":"grok video job rejected by x.ai vidgen.x.ai"}}`)
		info, err := a.ParseTaskResult(body)
		if err != nil {
			t.Fatalf("parse: %v", err)
		}
		if info.Status != model.TaskStatusFailure {
			t.Fatalf("status = %q", info.Status)
		}
		if taskcommon.ContainsBrandKeyword(info.Reason) {
			t.Fatalf("reason leaked brand keyword: %q", info.Reason)
		}
	})
}

// TestExtractUpstreamVideoURL verifies server-side URL resolution from task.Data.
func TestExtractUpstreamVideoURL(t *testing.T) {
	body := []byte(`{"status":"done","video":{"url":"https://vidgen.x.ai/out.mp4"}}`)
	if got := ExtractUpstreamVideoURL(body); got != "https://vidgen.x.ai/out.mp4" {
		t.Fatalf("url = %q", got)
	}
	if got := ExtractUpstreamVideoURL([]byte(`{"status":"pending"}`)); got != "" {
		t.Fatalf("url = %q, want empty when no video", got)
	}
	if got := ExtractUpstreamVideoURL(nil); got != "" {
		t.Fatalf("url = %q, want empty for nil", got)
	}
}

// TestWhitelabelRegistration asserts the channel is on the whitelabel list and
// that provider brand keywords are scrubbed.
func TestWhitelabelRegistration(t *testing.T) {
	if !taskcommon.ShouldWhitelabelChannelType(constant.ChannelTypeXaiGrokVideo) {
		t.Fatalf("ChannelTypeXaiGrokVideo must be a whitelabel channel")
	}
	for _, s := range []string{
		"generated by grok",
		"fetch from vidgen.x.ai failed",
		"xAI upstream error",
		"api.x.ai timeout",
	} {
		if !taskcommon.ContainsBrandKeyword(s) {
			t.Fatalf("expected brand keyword detected in %q", s)
		}
		if taskcommon.ScrubBrandedText(s) == s {
			t.Fatalf("expected %q to be scrubbed", s)
		}
	}
}

// TestResolveDuration covers the per-second billing input: EstimateBilling bills
// the requested duration, so parsing it correctly (and defaulting to 0 so the
// caller can apply defaultBillingSeconds) matters for not under/over-charging.
func TestResolveDuration(t *testing.T) {
	cases := []struct {
		name string
		req  relaycommon.TaskSubmitReq
		want int
	}{
		{"duration field", relaycommon.TaskSubmitReq{Duration: 8}, 8},
		{"seconds string", relaycommon.TaskSubmitReq{Seconds: "12"}, 12},
		{"duration wins over seconds", relaycommon.TaskSubmitReq{Duration: 6, Seconds: "12"}, 6},
		{"neither yields 0", relaycommon.TaskSubmitReq{}, 0},
		{"non-numeric seconds yields 0", relaycommon.TaskSubmitReq{Seconds: "abc"}, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := resolveDuration(tc.req); got != tc.want {
				t.Fatalf("resolveDuration = %d, want %d", got, tc.want)
			}
		})
	}
}
