package kuaizi

import "testing"

func TestExtractUpstreamVideoURL(t *testing.T) {
	tests := []struct {
		name string
		body string
		want string
	}{
		{
			name: "envelope with video_url",
			body: `{"code":0,"message":"","data":{"task_id":"kz-cgt-1","status":"succeeded","video_url":"https://x.tos-cn-beijing.volces.com/foo.mp4"}}`,
			want: "https://x.tos-cn-beijing.volces.com/foo.mp4",
		},
		{
			name: "envelope without url field",
			body: `{"code":0,"message":"","data":{"task_id":"kz-cgt-2","status":"running"}}`,
			want: "",
		},
		{
			name: "envelope with nested result.url",
			body: `{"code":0,"data":{"result":{"url":"https://example.com/v.mp4"}}}`,
			want: "https://example.com/v.mp4",
		},
		{
			name: "empty body",
			body: "",
			want: "",
		},
		{
			name: "invalid json",
			body: "not-json",
			want: "",
		},
		{
			name: "envelope with null data",
			body: `{"code":0,"data":null}`,
			want: "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ExtractUpstreamVideoURL([]byte(tt.body)); got != tt.want {
				t.Errorf("ExtractUpstreamVideoURL(%q) = %q, want %q", tt.body, got, tt.want)
			}
		})
	}
}

func TestModelToMode(t *testing.T) {
	tests := []struct {
		model    string
		wantMode string
		wantOK   bool
	}{
		{ModelLizhenFast, ModeFast, true},
		{ModelLizhenPro, ModePro, true},
		{"unknown-model", "", false},
		{"", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			gotMode, gotOK := ModelToMode(tt.model)
			if gotMode != tt.wantMode || gotOK != tt.wantOK {
				t.Errorf("ModelToMode(%q) = (%q, %v), want (%q, %v)",
					tt.model, gotMode, gotOK, tt.wantMode, tt.wantOK)
			}
		})
	}
}
