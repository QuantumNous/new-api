package doubao

import "testing"

func TestResolveVolcVideoAPIStyle(t *testing.T) {
	tests := []struct {
		name            string
		baseURL         string
		configuredStyle string
		wantOfficial    bool
	}{
		{
			name:            "explicit official",
			baseURL:         "https://proxy.example.com",
			configuredStyle: VolcVideoAPIStyleOfficial,
			wantOfficial:    true,
		},
		{
			name:            "explicit openai",
			baseURL:         "https://ark.cn-beijing.volces.com",
			configuredStyle: VolcVideoAPIStyleOpenAI,
			wantOfficial:    false,
		},
		{
			name:            "auto ark domain",
			baseURL:         "https://ark.cn-beijing.volces.com",
			configuredStyle: VolcVideoAPIStyleAuto,
			wantOfficial:    true,
		},
		{
			name:            "auto visual domain",
			baseURL:         "https://visual.volcengineapi.com",
			configuredStyle: "",
			wantOfficial:    true,
		},
		{
			name:            "auto api v3 suffix",
			baseURL:         "https://sd-proxy.spadesdk.com/api/v3",
			configuredStyle: VolcVideoAPIStyleAuto,
			wantOfficial:    true,
		},
		{
			name:            "auto custom proxy default openai",
			baseURL:         "https://sd-proxy.spadesdk.com",
			configuredStyle: VolcVideoAPIStyleAuto,
			wantOfficial:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ResolveVolcVideoAPIStyle(tt.baseURL, tt.configuredStyle)
			isOfficial := got == volcVideoStyleOfficial
			if isOfficial != tt.wantOfficial {
				t.Fatalf("ResolveVolcVideoAPIStyle(%q, %q) official=%v, want official=%v", tt.baseURL, tt.configuredStyle, isOfficial, tt.wantOfficial)
			}
		})
	}
}

func TestBuildVideoSubmitURL(t *testing.T) {
	tests := []struct {
		name            string
		baseURL         string
		configuredStyle string
		want            string
	}{
		{
			name:            "official ark domain",
			baseURL:         "https://ark.cn-beijing.volces.com",
			configuredStyle: VolcVideoAPIStyleAuto,
			want:            "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks",
		},
		{
			name:            "official proxy with api v3 suffix",
			baseURL:         "https://sd-proxy.spadesdk.com/api/v3",
			configuredStyle: VolcVideoAPIStyleAuto,
			want:            "https://sd-proxy.spadesdk.com/api/v3/contents/generations/tasks",
		},
		{
			name:            "official forced on custom domain",
			baseURL:         "https://sd-proxy.spadesdk.com",
			configuredStyle: VolcVideoAPIStyleOfficial,
			want:            "https://sd-proxy.spadesdk.com/api/v3/contents/generations/tasks",
		},
		{
			name:            "openai compat",
			baseURL:         "https://proxy.example.com",
			configuredStyle: VolcVideoAPIStyleAuto,
			want:            "https://proxy.example.com/v1/video/generations",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := BuildVideoSubmitURL(tt.baseURL, tt.configuredStyle)
			if got != tt.want {
				t.Fatalf("BuildVideoSubmitURL() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestBuildVideoFetchURL(t *testing.T) {
	got := BuildVideoFetchURL("https://sd-proxy.spadesdk.com/api/v3", VolcVideoAPIStyleAuto, "task_123")
	want := "https://sd-proxy.spadesdk.com/api/v3/contents/generations/tasks/task_123"
	if got != want {
		t.Fatalf("BuildVideoFetchURL() = %q, want %q", got, want)
	}

	got = BuildVideoFetchURL("https://proxy.example.com", VolcVideoAPIStyleAuto, "task_123")
	want = "https://proxy.example.com/v1/video/generations/task_123"
	if got != want {
		t.Fatalf("BuildVideoFetchURL() = %q, want %q", got, want)
	}
}
