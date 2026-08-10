package zzdh

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestNormalizeCreateBodyMapsImageWithRoles(t *testing.T) {
	body := map[string]interface{}{
		"prompt": "hello",
		"image_with_roles": []interface{}{
			map[string]interface{}{"url": "https://cdn.example.com/a.png", "role": "reference_image"},
		},
		"seconds": "8",
		"ratio":   "21:9",
	}
	if err := normalizeCreateBody(body, "zzdh-Minimax-h3-1080p"); err != nil {
		t.Fatal(err)
	}
	if _, ok := body["image_with_roles"]; ok {
		t.Fatal("image_with_roles should be removed")
	}
	refs, ok := body["reference_images"].([]interface{})
	if !ok || len(refs) != 1 {
		t.Fatalf("reference_images = %#v", body["reference_images"])
	}
	if body["duration"] != 8 && body["duration"] != float64(8) && body["duration"] != "8" {
		// asPositiveInt from string seconds sets int
		if asPositiveInt(body["duration"]) != 8 {
			t.Fatalf("duration = %#v", body["duration"])
		}
	}
	if body["aspect_ratio"] != "21:9" {
		t.Fatalf("aspect_ratio = %#v", body["aspect_ratio"])
	}
	if body["model"] != "zzdh-Minimax-h3-1080p" {
		t.Fatalf("model = %#v", body["model"])
	}
	if _, has := body["resolution"]; has {
		t.Fatalf("resolution should be omitted, got %#v", body["resolution"])
	}
}

func TestNormalizeCreateBodyRejectsMismatchedResolution(t *testing.T) {
	body := map[string]interface{}{
		"prompt":     "x",
		"resolution": "720P",
	}
	err := normalizeCreateBody(body, "zzdh-Minimax-h3-480p")
	if err == nil {
		t.Fatal("expected resolution mismatch error")
	}
}

func TestNormalizeCreateBodyAcceptsMatchingResolution(t *testing.T) {
	body := map[string]interface{}{
		"prompt":     "x",
		"resolution": "2k",
		"duration":   10,
	}
	if err := normalizeCreateBody(body, "zzdh-Minimax-h3-2k"); err != nil {
		t.Fatal(err)
	}
	if body["resolution"] != "2K" {
		t.Fatalf("resolution = %#v", body["resolution"])
	}
}

func TestNormalizeCreateBodyRejectsBadFPS(t *testing.T) {
	body := map[string]interface{}{
		"prompt": "x",
		"fps":    30,
	}
	if err := normalizeCreateBody(body, "zzdh-Minimax-h3-720p"); err == nil {
		t.Fatal("expected fps error")
	}
}

func TestResolutionFromModel(t *testing.T) {
	cases := map[string]string{
		"zzdh-Minimax-h3-480p":  "480P",
		"zzdh-Minimax-h3-720p":  "720P",
		"zzdh-Minimax-h3-1080p": "1080P",
		"zzdh-Minimax-h3-2k":    "2K",
	}
	for model, want := range cases {
		if got := resolutionFromModel(model); got != want {
			t.Fatalf("%s => %q, want %q", model, got, want)
		}
	}
}

func TestParseCreateTask(t *testing.T) {
	id, status, err := parseCreateTask([]byte(`{"task_id":"a1b2","status":"QUEUED"}`))
	if err != nil {
		t.Fatal(err)
	}
	if id != "a1b2" || !strings.EqualFold(status, "QUEUED") {
		t.Fatalf("id=%q status=%q", id, status)
	}
}

func TestParseTaskResultCompleted(t *testing.T) {
	a := &TaskAdaptor{}
	ti, err := a.ParseTaskResult([]byte(`{"task_id":"x","status":"completed"}`))
	if err != nil {
		t.Fatal(err)
	}
	if ti.Status != model.TaskStatusSuccess {
		t.Fatalf("status=%v", ti.Status)
	}
	if ti.Url != "" {
		t.Fatalf("url should be empty for content proxy, got %q", ti.Url)
	}
}

func TestGetModelList(t *testing.T) {
	a := &TaskAdaptor{}
	list := a.GetModelList()
	want := map[string]bool{
		"zzdh-Minimax-h3-480p":  true,
		"zzdh-Minimax-h3-720p":  true,
		"zzdh-Minimax-h3-1080p": true,
		"zzdh-Minimax-h3-2k":    true,
	}
	if len(list) != len(want) {
		t.Fatalf("list=%v", list)
	}
	for _, m := range list {
		if !want[m] {
			t.Fatalf("unexpected model %q", m)
		}
	}
}

func TestApiOrigin(t *testing.T) {
	if got := apiOrigin("https://www.zizidonghua.com/v8/videos/generations"); got != "https://www.zizidonghua.com" {
		t.Fatalf("got %q", got)
	}
}
