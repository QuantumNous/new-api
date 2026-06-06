package doubao

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestParseCreateTaskID(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		body    string
		want    string
		wantErr bool
	}{
		{
			name: "native volc",
			body: `{"id":"cgt-20260526171350-mwcrj","status":"running"}`,
			want: "cgt-20260526171350-mwcrj",
		},
		{
			name: "gateway wrapper",
			body: `{"id":33,"request_id":"gw_1","upstream_task_id":"cgt-20260526171350-mwcrj","upstream_response":{"id":"cgt-20260526171350-mwcrj"}}`,
			want: "cgt-20260526171350-mwcrj",
		},
		{
			name: "nested upstream_response only",
			body: `{"id":12,"upstream_response":{"id":"cgt-abc"}}`,
			want: "cgt-abc",
		},
		{
			name:    "numeric id only",
			body:    `{"id":33}`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := parseCreateTaskID([]byte(tt.body))
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got id %q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("parseCreateTaskID: %v", err)
			}
			if got != tt.want {
				t.Fatalf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestParseTaskResultNumericID(t *testing.T) {
	t.Parallel()

	body := `{"id":33,"upstream_task_id":"cgt-20260526194039-p5wmw","status":"running","content":{}}`
	ti, err := (&TaskAdaptor{}).ParseTaskResult([]byte(body))
	if err != nil {
		t.Fatalf("ParseTaskResult: %v", err)
	}
	if ti.Status != model.TaskStatusInProgress {
		t.Fatalf("got status %q, want in_progress", ti.Status)
	}
}

func TestHasVideoInput(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		req  relaycommon.TaskSubmitReq
		want bool
	}{
		{
			name: "top-level content video_url",
			req: relaycommon.TaskSubmitReq{
				Content: []map[string]interface{}{
					{"type": "video_url", "video_url": map[string]interface{}{"url": "https://example.com/in.mp4"}},
				},
			},
			want: true,
		},
		{
			name: "top-level content text only",
			req: relaycommon.TaskSubmitReq{
				Content: []map[string]interface{}{
					{"type": "text", "text": "prompt"},
				},
			},
			want: false,
		},
		{
			name: "metadata content video_url",
			req: relaycommon.TaskSubmitReq{
				Metadata: map[string]interface{}{
					"content": []interface{}{
						map[string]interface{}{
							"type":      "video_url",
							"video_url": map[string]interface{}{"url": "https://example.com/in.mp4"},
						},
					},
				},
			},
			want: true,
		},
		{
			name: "image only",
			req: relaycommon.TaskSubmitReq{
				Content: []map[string]interface{}{
					{"type": "image_url", "image_url": map[string]interface{}{"url": "https://example.com/in.png"}},
				},
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := hasVideoInput(&tt.req); got != tt.want {
				t.Fatalf("hasVideoInput() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestParseTaskResultGatewayWrapper(t *testing.T) {
	t.Parallel()

	body := `{"id":33,"upstream_response":{"id":"cgt-abc","status":"succeeded","content":{"video_url":"https://example.com/v.mp4"},"usage":{"completion_tokens":1,"total_tokens":2}}}`
	ti, err := (&TaskAdaptor{}).ParseTaskResult([]byte(body))
	if err != nil {
		t.Fatalf("ParseTaskResult: %v", err)
	}
	if ti.Status != model.TaskStatusSuccess {
		t.Fatalf("got status %q, want success", ti.Status)
	}
	if ti.Url != "https://example.com/v.mp4" {
		t.Fatalf("got url %q", ti.Url)
	}
}
