package service

import (
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func TestGenerationCaptureStreamsAndKeepsBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	capture := CaptureGenerationResponse(c)
	c.JSON(200, gin.H{"data": []gin.H{{"url": "https://example.com/a.png"}}})

	if recorder.Code != 200 {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), "a.png") {
		t.Fatalf("browser body was not written: %q", recorder.Body.String())
	}
	if !strings.Contains(string(capture.Body()), "a.png") {
		t.Fatalf("captured body is empty: %q", string(capture.Body()))
	}
	if capture.StatusCode() != 200 {
		t.Fatalf("captured status = %d, want 200", capture.StatusCode())
	}
}

func TestExtractGenerationMediaRefsFromImageResponse(t *testing.T) {
	body := []byte(`{"created":1,"data":[{"url":"https://x.test/y.png"},{"b64_json":"aGk="},{"url":"https://x.test/y.png"}]}`)
	refs := ExtractGenerationMediaRefs(body)
	if len(refs) != 2 {
		t.Fatalf("refs = %d, want 2 after de-duplication: %+v", len(refs), refs)
	}
	if refs[0].Kind != "url" || refs[0].Value != "https://x.test/y.png" {
		t.Fatalf("unexpected first ref: %+v", refs[0])
	}
	if refs[1].Kind != "base64" || refs[1].Value != "aGk=" {
		t.Fatalf("unexpected second ref: %+v", refs[1])
	}
}

func TestExtractGenerationTaskStateFromPoll(t *testing.T) {
	body := []byte(`{"code":"success","data":{"task_id":"task_x","status":"SUCCESS","progress":"100%","data":{"content":{"video_url":"https://ark.test/b.mp4"}}}}`)
	state := ExtractGenerationTaskState(body)
	if state.TaskID != "task_x" {
		t.Fatalf("task id = %q", state.TaskID)
	}
	if state.Status != GenerationStatusSuccess {
		t.Fatalf("status = %q", state.Status)
	}
	found := false
	for _, ref := range state.Refs {
		if ref.Value == "https://ark.test/b.mp4" {
			found = true
		}
	}
	if !found {
		t.Fatalf("nested video url was not collected: %+v", state.Refs)
	}
}

func TestExtractGenerationTaskStateFromFailure(t *testing.T) {
	body := []byte(`{"code":"success","data":{"task_id":"task_y","status":"FAILURE","fail_reason":"upstream refused"}}`)
	state := ExtractGenerationTaskState(body)
	if state.Status != GenerationStatusFailure || state.FailReason != "upstream refused" {
		t.Fatalf("unexpected state: %+v", state)
	}
}

func TestNormalizeGenerationStatus(t *testing.T) {
	cases := map[string]string{
		"SUCCESS":     GenerationStatusSuccess,
		"completed":   GenerationStatusSuccess,
		"FAILURE":     GenerationStatusFailure,
		"IN_PROGRESS": GenerationStatusRunning,
		"queued":      GenerationStatusQueued,
		"":            "",
	}
	for raw, want := range cases {
		if got := NormalizeGenerationStatus(raw); got != want {
			t.Fatalf("NormalizeGenerationStatus(%q) = %q, want %q", raw, got, want)
		}
	}
}

func TestGenerationMediaRoundTrip(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv(generationMediaDirEnv, t.TempDir())
	previousSecret := common.CryptoSecret
	common.CryptoSecret = "generation-media-test-secret"
	defer func() { common.CryptoSecret = previousSecret }()

	png := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")
	rel, size, err := SaveGenerationMedia(7, strings.NewReader(string(png)), "image/png")
	if err != nil {
		t.Fatalf("save failed: %v", err)
	}
	if size != int64(len(png)) {
		t.Fatalf("size = %d, want %d", size, len(png))
	}
	if !strings.HasSuffix(rel, ".png") || !strings.HasPrefix(rel, "u7/") {
		t.Fatalf("unexpected stored path %q", rel)
	}

	url := BuildGenerationMediaURL(rel)
	if !strings.HasPrefix(url, "/api/generation/media/u7/") || !strings.Contains(url, "access=") {
		t.Fatalf("unexpected media url %q", url)
	}
	access := url[strings.Index(url, "access=")+len("access="):]

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("GET", url, nil)
	if !ServeGenerationMedia(c, rel, access) {
		t.Fatal("serve did not answer the request")
	}
	if recorder.Code != 200 {
		t.Fatalf("signed request status = %d, want 200", recorder.Code)
	}
	if got := recorder.Body.Len(); got != len(png) {
		t.Fatalf("served %d bytes, want %d", got, len(png))
	}

	rejected := httptest.NewRecorder()
	bad, _ := gin.CreateTestContext(rejected)
	bad.Request = httptest.NewRequest("GET", url, nil)
	ServeGenerationMedia(bad, rel, "not-a-signature")
	// An empty 403 is written by gin at the end of the chain, so the status is
	// read from the writer rather than the recorder.
	if status := bad.Writer.Status(); status != 403 {
		t.Fatalf("bad signature status = %d, want 403", status)
	}
}

func TestPersistGenerationMediaFromBase64(t *testing.T) {
	t.Setenv(generationMediaDirEnv, t.TempDir())
	refs := []GenerationMediaRef{{Kind: "base64", Value: "aGVsbG8=", MimeType: "image/png"}}
	stored := PersistGenerationMedia(3, refs)
	if len(stored) != 1 {
		t.Fatalf("stored = %d, want 1: %+v", len(stored), stored)
	}
	if !strings.HasPrefix(stored[0], "u3/") {
		t.Fatalf("unexpected stored path %q", stored[0])
	}
	content, err := readStoredGenerationMedia(t, stored[0])
	if err != nil {
		t.Fatalf("stored file is unreadable: %v", err)
	}
	if content != "hello" {
		t.Fatalf("stored content = %q, want hello", content)
	}
}

func readStoredGenerationMedia(t *testing.T, rel string) (string, error) {
	t.Helper()
	full, err := generationMediaAbsolutePath(rel)
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(full)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
