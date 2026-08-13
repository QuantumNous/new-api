package yksd

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func TestResolveUpstreamModel(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"seedance2.0-yk-special", "sd_2.0_special"},
		{"seedance2.0-yk-discount", "sd_2.0_discount"},
		{"sd_2.0_special", "sd_2.0_special"},
		{"sd_2.0_discount", "sd_2.0_discount"},
		{"custom-x", "custom-x"},
	}
	for _, tt := range cases {
		if got := resolveUpstreamModel(tt.in); got != tt.want {
			t.Fatalf("resolveUpstreamModel(%q)=%q want %q", tt.in, got, tt.want)
		}
	}
}

func TestAPIOrigin_StripsSuffix(t *testing.T) {
	cases := map[string]string{
		"https://zcbservice.aizfw.cn/kyyReactApiServer":                       "https://zcbservice.aizfw.cn/kyyReactApiServer",
		"https://zcbservice.aizfw.cn/kyyReactApiServer/v2/model-center/tasks": "https://zcbservice.aizfw.cn/kyyReactApiServer",
		"https://zcbservice.aizfw.cn/kyyReactApiServer/asset/seedance2":       "https://zcbservice.aizfw.cn/kyyReactApiServer",
		"": "https://zcbservice.aizfw.cn/kyyReactApiServer",
	}
	for in, want := range cases {
		if got := apiOrigin(in); got != want {
			t.Fatalf("apiOrigin(%q)=%q want %q", in, got, want)
		}
	}
}

func TestNormalizeCreateBody_KeepsWatermarkAndValidatesResolution(t *testing.T) {
	body := map[string]interface{}{
		"model":     "seedance2.0-yk-special",
		"prompt":    "hi",
		"seconds":   "8",
		"ratio":     "16:9",
		"images":    []interface{}{"https://example.com/a.png"},
		"watermark": true,
		"seed":      -1,
		"resolution": "720p",
	}
	if err := normalizeCreateBody(body, "seedance2.0-yk-special"); err != nil {
		t.Fatal(err)
	}
	if body["model"] != "sd_2.0_special" {
		t.Fatalf("model=%v", body["model"])
	}
	if body["duration"] != 8 {
		t.Fatalf("duration=%v", body["duration"])
	}
	if body["watermark"] != true {
		t.Fatalf("watermark should be kept, got %#v", body["watermark"])
	}
	if body["seed"] != -1 {
		t.Fatalf("seed=%v", body["seed"])
	}

	bad := map[string]interface{}{"resolution": "480p"}
	if err := normalizeCreateBody(bad, "sd_2.0_special"); err == nil {
		t.Fatal("expected resolution error for special+480p")
	}
	bad2 := map[string]interface{}{"resolution": "2k"}
	if err := normalizeCreateBody(bad2, "sd_2.0_discount"); err == nil {
		t.Fatal("expected resolution error for discount+2k")
	}
}

func TestNormalizeVolcOfficialInBodyMap(t *testing.T) {
	raw := []byte(`{
		"model":"seedance2.0-yk-discount",
		"content":[
			{"type":"text","text":"羽毛飘落"},
			{"type":"image_url","image_url":{"url":"https://example.com/first.jpg"},"role":"first_frame"},
			{"type":"image_url","image_url":{"url":"https://example.com/ref.jpg"}},
			{"type":"video_url","video_url":{"url":"https://example.com/a.mp4"}},
			{"type":"audio_url","audio_url":{"url":"https://example.com/a.mp3"}}
		]
	}`)
	var body map[string]interface{}
	if err := common.Unmarshal(raw, &body); err != nil {
		t.Fatal(err)
	}
	if !normalizeVolcOfficialInBodyMap(body, raw) {
		t.Fatal("expected normalize")
	}
	if body["prompt"] != "羽毛飘落" {
		t.Fatalf("prompt=%v", body["prompt"])
	}
	if body["first_image"] != "https://example.com/first.jpg" {
		t.Fatalf("first_image=%v", body["first_image"])
	}
}

func TestForceAssets_HTTPURLToAssetID(t *testing.T) {
	var uploads int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		switch {
		case strings.HasSuffix(r.URL.Path, "/asset/seedance2/assetUpload"):
			atomic.AddInt32(&uploads, 1)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"assetId":"asset-1","status":"PROCESSING","errorMessage":null}`))
		case strings.HasSuffix(r.URL.Path, "/asset/seedance2/assetDetail"):
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"assetId":"asset-1","status":"ACTIVE","errorMessage":null}`))
		default:
			t.Fatalf("unexpected path %s body=%s", r.URL.Path, body)
		}
	}))
	defer srv.Close()

	client := newAssetClient(srv.URL, "test-key")
	client.httpClient = srv.Client()
	client.pollEvery = time.Millisecond
	client.pollLimit = time.Second
	client.sleep = func(time.Duration) {}

	body := map[string]interface{}{
		"reference_images": []string{"https://example.com/a.png"},
		"first_image":      "https://example.com/first.png",
		"reference_videos": []string{"https://example.com/a.mp4"},
		"reference_audios": []string{"https://example.com/a.mp3"},
	}
	if err := forceAssetsInBody(client, body); err != nil {
		t.Fatal(err)
	}
	if atomic.LoadInt32(&uploads) != 4 {
		t.Fatalf("uploads=%d want 4", uploads)
	}
	imgs := body["reference_images"].([]string)
	if imgs[0] != "assetId://asset-1" {
		t.Fatalf("reference_images=%v", imgs)
	}
	if body["first_image"] != "assetId://asset-1" {
		t.Fatalf("first_image=%v", body["first_image"])
	}
}

func TestForceAssets_ExistingAssetIDSkipsUpload(t *testing.T) {
	var uploads int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/asset/seedance2/assetUpload") {
			atomic.AddInt32(&uploads, 1)
			http.Error(w, "should not upload", 500)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"assetId":"asset-9","status":"ACTIVE"}`))
	}))
	defer srv.Close()

	client := newAssetClient(srv.URL, "k")
	client.httpClient = srv.Client()
	client.pollEvery = time.Millisecond
	client.sleep = func(time.Duration) {}

	body := map[string]interface{}{
		"reference_images": []string{"assetId://asset-9"},
	}
	if err := forceAssetsInBody(client, body); err != nil {
		t.Fatal(err)
	}
	if atomic.LoadInt32(&uploads) != 0 {
		t.Fatalf("uploads=%d", uploads)
	}
	if body["reference_images"].([]string)[0] != "assetId://asset-9" {
		t.Fatalf("%v", body["reference_images"])
	}
}

func TestForceAssets_FailedStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "assetUpload") {
			_, _ = w.Write([]byte(`{"assetId":"asset-x","status":"PROCESSING"}`))
			return
		}
		_, _ = w.Write([]byte(`{"assetId":"asset-x","status":"FAILED","errorMessage":"审核未通过"}`))
	}))
	defer srv.Close()
	client := newAssetClient(srv.URL, "k")
	client.httpClient = srv.Client()
	client.pollEvery = time.Millisecond
	client.sleep = func(time.Duration) {}

	err := forceAssetsInBody(client, map[string]interface{}{
		"reference_images": []string{"https://example.com/a.png"},
	})
	if err == nil || !strings.Contains(err.Error(), "审核未通过") {
		t.Fatalf("err=%v", err)
	}
}

func TestForceAssets_NoMediaSkipped(t *testing.T) {
	if err := forceAssetsInBody(newAssetClient("http://example", "k"), map[string]interface{}{
		"prompt": "text only",
	}); err != nil {
		t.Fatal(err)
	}
}

func TestParseTaskResult_Completed(t *testing.T) {
	a := &TaskAdaptor{}
	info, err := a.ParseTaskResult([]byte(`{
		"status":"completed","progress":100,
		"video_url":"https://example.com/v.mp4","result_url":"https://example.com/r.mp4",
		"actualDuration":5
	}`))
	if err != nil {
		t.Fatal(err)
	}
	if info.Status != model.TaskStatusSuccess || info.Url != "https://example.com/v.mp4" {
		t.Fatalf("%+v", info)
	}
}

func TestGetChannelName(t *testing.T) {
	a := &TaskAdaptor{}
	if a.GetChannelName() != "yk-sd" {
		t.Fatalf("%q", a.GetChannelName())
	}
}
