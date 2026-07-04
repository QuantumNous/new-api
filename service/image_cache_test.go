package service

import (
	"os"
	"strings"
	"testing"
)

func TestExtractFirstImageURLFromResponse_syncData(t *testing.T) {
	body := []byte(`{"created":1,"data":[{"url":"https://apimaster.ai/imgs/abc.png"}]}`)
	if got := ExtractFirstImageURLFromResponse(body); got != "https://apimaster.ai/imgs/abc.png" {
		t.Fatalf("got %q", got)
	}
}

func TestExtractFirstImageURLFromResponse_asyncPoll(t *testing.T) {
	body := []byte(`{"data":{"status":"succeeded","result":{"images":[{"url":"https://apimaster.ai/imgs/def.jpg"}]}}}`)
	if got := ExtractFirstImageURLFromResponse(body); got != "https://apimaster.ai/imgs/def.jpg" {
		t.Fatalf("got %q", got)
	}
}

func TestRewriteImageResponseBodyWithHeaders(t *testing.T) {
	orig := cacheImageLocallyImpl
	defer func() { cacheImageLocallyImpl = orig }()
	var gotHeaders map[string]string
	cacheImageLocallyImpl = func(imageURL string, headers imageCacheHeaders) string {
		gotHeaders = map[string]string(headers)
		return "https://apimaster.ai/imgs/cached.png"
	}

	body := []byte(`{"created":1,"data":[{"url":"https://api.romaapi.com/v1/images/task_x/content"}]}`)
	out := RewriteImageResponseBodyWithHeaders(body, map[string]string{"Authorization": "Bearer test"})

	if got := ExtractFirstImageURLFromResponse(out); got != "https://apimaster.ai/imgs/cached.png" {
		t.Fatalf("got %q", got)
	}
	if gotHeaders["Authorization"] != "Bearer test" {
		t.Fatalf("Authorization header not passed through: %#v", gotHeaders)
	}
}

func TestRewriteImageResponseBodyCachesB64JSON(t *testing.T) {
	oldDir := imageCacheDir
	oldBase := imageCachePublicBase
	tmp := t.TempDir()
	imageCacheDir = tmp
	imageCachePublicBase = "https://apimaster.ai/imgs/"
	defer func() {
		imageCacheDir = oldDir
		imageCachePublicBase = oldBase
	}()

	body := []byte(`{"created":1,"data":[{"b64_json":"aGVsbG8="}]}`)
	out := RewriteImageResponseBody(body)
	got := ExtractFirstImageURLFromResponse(out)
	if !strings.HasPrefix(got, imageCachePublicBase) {
		t.Fatalf("got %q", got)
	}
	entries, err := os.ReadDir(tmp)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("cached file count = %d, want 1", len(entries))
	}
	if !strings.Contains(string(out), `"b64_json":"aGVsbG8="`) {
		t.Fatalf("b64_json should be preserved: %s", out)
	}
}

func TestIsValidMediaResultURL(t *testing.T) {
	cases := []struct {
		url  string
		want bool
	}{
		{"https://apimaster.ai/imgs/abc.png", true},
		{"http://example.com/a.jpg", true},
		{"upstream task failed", false},
		{"", false},
		{"not-a-url", false},
	}
	for _, c := range cases {
		if got := IsValidMediaResultURL(c.url); got != c.want {
			t.Errorf("IsValidMediaResultURL(%q) = %v, want %v", c.url, got, c.want)
		}
	}
}
