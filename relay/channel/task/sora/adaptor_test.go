package sora

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	"github.com/tidwall/gjson"
)

func TestSyncVideoDurationFields(t *testing.T) {
	t.Run("duration fills seconds", func(t *testing.T) {
		m := map[string]interface{}{"duration": float64(15)}
		syncVideoDurationFields(m)
		if m["seconds"] != "15" {
			t.Fatalf("seconds = %v, want \"15\"", m["seconds"])
		}
		if m["duration"] != float64(15) {
			t.Fatalf("duration changed: %v", m["duration"])
		}
	})
	t.Run("seconds fills duration", func(t *testing.T) {
		m := map[string]interface{}{"seconds": "12"}
		syncVideoDurationFields(m)
		if m["duration"] != 12 {
			t.Fatalf("duration = %v, want 12", m["duration"])
		}
	})
	t.Run("keeps both when present", func(t *testing.T) {
		m := map[string]interface{}{"duration": float64(15), "seconds": "8"}
		syncVideoDurationFields(m)
		if m["seconds"] != "8" || m["duration"] != float64(15) {
			t.Fatalf("unexpected rewrite: %#v", m)
		}
	})
}

func TestIsAuthGatedVideoContentURL(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"https://59aiapi.com/v1/videos/task_up/content", true},
		{"https://api.openai.com/v1/videos/video_abc/content", true},
		{"https://59aiapi.com/v1/videos/task_up/content?download=1", true},
		{"https://cdn.example.com/a.mp4", false},
		{"https://cdn.example.com/videos/task_up/file.mp4", false},
		{"https://example.com/v1/videos/task_up", false},
		{"", false},
		{"not-a-url", false},
	}
	for _, tc := range cases {
		if got := isAuthGatedVideoContentURL(tc.in); got != tc.want {
			t.Fatalf("isAuthGatedVideoContentURL(%q) = %v, want %v", tc.in, got, tc.want)
		}
	}
}

func TestConvertToOpenAIVideoRewritesAuthContentURLs(t *testing.T) {
	publicID := "task_public123"
	raw := []byte(`{
		"id":"task_upstream",
		"task_id":"task_upstream",
		"object":"video",
		"model":"seedance2.0",
		"status":"completed",
		"progress":100,
		"url":"https://59aiapi.com/v1/videos/task_upstream/content",
		"video_url":"https://59aiapi.com/v1/videos/task_upstream/content",
		"content_url":"https://59aiapi.com/v1/videos/task_upstream/content",
		"metadata":{
			"url":"https://59aiapi.com/v1/videos/task_upstream/content",
			"video_url":"https://59aiapi.com/v1/videos/task_upstream/content",
			"content_url":"https://59aiapi.com/v1/videos/task_upstream/content"
		}
	}`)

	a := &TaskAdaptor{}
	out, err := a.ConvertToOpenAIVideo(&model.Task{TaskID: publicID, Data: raw})
	if err != nil {
		t.Fatal(err)
	}

	proxy := taskcommon.BuildProxyURL(publicID)
	if got := gjson.GetBytes(out, "id").String(); got != publicID {
		t.Fatalf("id = %q, want %q", got, publicID)
	}
	if got := gjson.GetBytes(out, "task_id").String(); got != publicID {
		t.Fatalf("task_id = %q, want %q", got, publicID)
	}
	for _, path := range authGatedVideoContentURLPaths {
		if got := gjson.GetBytes(out, path).String(); got != proxy {
			t.Fatalf("%s = %q, want proxy %q", path, got, proxy)
		}
	}
	if !strings.Contains(proxy, "/v1/videos/"+publicID+"/content") {
		t.Fatalf("unexpected proxy URL: %s", proxy)
	}
}

func TestParseTaskResultExtractsCDNURL(t *testing.T) {
	raw := []byte(`{
		"id":"task_up",
		"status":"completed",
		"progress":100,
		"url":"https://tos.example.com/out.mp4",
		"metadata":{"url":"https://tos.example.com/out.mp4"}
	}`)
	a := &TaskAdaptor{}
	ti, err := a.ParseTaskResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if ti.Status != model.TaskStatusSuccess {
		t.Fatalf("status = %q, want SUCCESS", ti.Status)
	}
	if ti.Url != "https://tos.example.com/out.mp4" {
		t.Fatalf("url = %q", ti.Url)
	}
	if ti.Progress != "100%" {
		t.Fatalf("progress = %q", ti.Progress)
	}
}

func TestParseTaskResultUnknownKeepsPolling(t *testing.T) {
	raw := []byte(`{
		"id":"task_up",
		"object":"video",
		"status":"unknown",
		"progress":0,
		"created_at":1785675970
	}`)
	a := &TaskAdaptor{}
	ti, err := a.ParseTaskResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if ti.Status != model.TaskStatusQueued {
		t.Fatalf("status = %q, want QUEUED (keep polling)", ti.Status)
	}
}

func TestParseTaskResultUnknownWithURLIsSuccess(t *testing.T) {
	raw := []byte(`{
		"id":"task_up",
		"status":"unknown",
		"progress":0,
		"url":"https://tos.example.com/out.mp4"
	}`)
	a := &TaskAdaptor{}
	ti, err := a.ParseTaskResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if ti.Status != model.TaskStatusSuccess {
		t.Fatalf("status = %q, want SUCCESS", ti.Status)
	}
	if ti.Url != "https://tos.example.com/out.mp4" {
		t.Fatalf("url = %q", ti.Url)
	}
}

func TestConvertToOpenAIVideoKeepsCDNURLs(t *testing.T) {
	publicID := "task_public456"
	cdn := "https://cdn.example.com/out.mp4"
	raw := []byte(`{
		"id":"task_upstream",
		"status":"completed",
		"url":"` + cdn + `",
		"metadata":{"url":"` + cdn + `"}
	}`)

	a := &TaskAdaptor{}
	out, err := a.ConvertToOpenAIVideo(&model.Task{TaskID: publicID, Data: raw})
	if err != nil {
		t.Fatal(err)
	}
	if got := gjson.GetBytes(out, "url").String(); got != cdn {
		t.Fatalf("url rewritten unexpectedly: %q", got)
	}
	if got := gjson.GetBytes(out, "metadata.url").String(); got != cdn {
		t.Fatalf("metadata.url rewritten unexpectedly: %q", got)
	}
	if got := gjson.GetBytes(out, "id").String(); got != publicID {
		t.Fatalf("id = %q, want %q", got, publicID)
	}
}
