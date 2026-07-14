package service

import (
	"os"
	"strings"
	"testing"
)

func TestConvertImageResponseFormatB64ToURL(t *testing.T) {
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
	out := ConvertImageResponseFormat(body, "url", nil)

	if strings.Contains(string(out), "b64_json") {
		t.Fatalf("b64_json should be dropped for url format: %s", out)
	}
	got := ExtractFirstImageURLFromResponse(out)
	if !strings.HasPrefix(got, imageCachePublicBase) {
		t.Fatalf("expected cached url, got %q", got)
	}
	entries, err := os.ReadDir(tmp)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("cached file count = %d, want 1", len(entries))
	}
}

func TestConvertImageResponseFormatURLAlreadySatisfied(t *testing.T) {
	// Client wants url and upstream already returned a url → unchanged body.
	body := []byte(`{"data":[{"url":"https://x/y.png"}]}`)
	out := ConvertImageResponseFormat(body, "url", nil)
	if string(out) != string(body) {
		t.Fatalf("body should be unchanged, got %s", out)
	}
}

func TestConvertImageResponseFormatUnsupportedFormatNoop(t *testing.T) {
	body := []byte(`{"data":[{"b64_json":"aGVsbG8="}]}`)
	if out := ConvertImageResponseFormat(body, "", nil); string(out) != string(body) {
		t.Fatalf("empty format must be a no-op")
	}
	if out := ConvertImageResponseFormat(body, "png", nil); string(out) != string(body) {
		t.Fatalf("unknown format must be a no-op")
	}
}

func TestConvertImageResponseFormatB64AlreadySatisfied(t *testing.T) {
	// Client wants b64_json and upstream already returned it → drop url only.
	body := []byte(`{"data":[{"b64_json":"aGVsbG8="}]}`)
	out := ConvertImageResponseFormat(body, "b64_json", nil)
	if !strings.Contains(string(out), `"b64_json":"aGVsbG8="`) {
		t.Fatalf("b64_json should be preserved: %s", out)
	}
}
