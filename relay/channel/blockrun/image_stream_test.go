package blockrun

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"

	"github.com/gin-gonic/gin"
)

func TestConvertImageRequestStreamStripped(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	stream := true
	req := dto.ImageRequest{Model: "openai/gpt-image-2", Prompt: "p", Stream: &stream,
		PartialImages: []byte(`2`)}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{}}

	a := &Adaptor{}
	out, err := a.ConvertImageRequest(c, info, req)
	if err != nil {
		t.Fatal(err)
	}
	if !info.IsStream {
		t.Fatal("stream:true must set info.IsStream")
	}
	b, err := common.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	s := string(b)
	if strings.Contains(s, `"stream"`) || strings.Contains(s, `"partial_images"`) {
		t.Fatalf("stream/partial_images must not reach upstream: %s", s)
	}
}

func TestStreamImageResponseCompletedEvent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations, IsStream: true,
		ChannelMeta: &relaycommon.ChannelMeta{}}
	resp := fakeResp(200, `{"created":9,"data":[{"b64_json":"aGk="}]}`, nil)

	usage, apiErr := streamImageResponse(c, resp, info)
	if apiErr != nil {
		t.Fatal(apiErr)
	}
	if usage == nil {
		t.Fatal("usage must be non-nil so ImageHelper bills")
	}
	body := w.Body.String()
	if !strings.Contains(body, "image_generation.completed") || !strings.Contains(body, "aGk=") {
		t.Fatalf("missing completed event: %s", body)
	}
	if !strings.Contains(body, "[DONE]") {
		t.Fatalf("missing [DONE]: %s", body)
	}
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Fatalf("not SSE: %s", ct)
	}
}

func TestStreamImageResponseUrlFallback(t *testing.T) {
	gin.SetMode(gin.TestMode)
	img := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("PNGBYTES"))
	}))
	defer img.Close()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations, IsStream: true,
		ChannelMeta: &relaycommon.ChannelMeta{}}
	resp := fakeResp(200, `{"created":9,"data":[{"url":"`+img.URL+`/a.png"}]}`, nil)

	_, apiErr := streamImageResponse(c, resp, info)
	if apiErr != nil {
		t.Fatal(apiErr)
	}
	// base64("PNGBYTES") = "UE5HQllURVM="
	if !strings.Contains(w.Body.String(), "UE5HQllURVM=") {
		t.Fatalf("url must be downloaded and base64'd: %s", w.Body.String())
	}
}

func TestStreamImageResponseUrlDownloadDegrades(t *testing.T) {
	gin.SetMode(gin.TestMode)
	img := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer img.Close()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations, IsStream: true,
		ChannelMeta: &relaycommon.ChannelMeta{}}
	resp := fakeResp(200, `{"created":9,"data":[{"url":"`+img.URL+`/a.png"}]}`, nil)

	_, apiErr := streamImageResponse(c, resp, info)
	if apiErr != nil {
		t.Fatal("download failure must degrade, not error (settlement committed)")
	}
	if !strings.Contains(w.Body.String(), img.URL) {
		t.Fatalf("degraded event must carry the url: %s", w.Body.String())
	}
}

func TestStreamSlowPathHeartbeatAndErrorEvent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldHB := imageHeartbeatInterval
	imageHeartbeatInterval = 5 * time.Millisecond
	t.Cleanup(func() { imageHeartbeatInterval = oldHB })
	shrinkPoll(t, 60*time.Millisecond)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(202)
		_, _ = w.Write([]byte(`{"status":"queued"}`))
	}))
	defer srv.Close()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	info := imageInfo(srv.URL)
	info.IsStream = true

	_, err := resolveImageResult(c, info, fakeResp(202, `{"poll_url":"`+srv.URL+`/p"}`, nil), "s")
	if err == nil {
		t.Fatal("timeout must still surface an error to the caller")
	}
	body := w.Body.String()
	if !strings.Contains(body, "PING") {
		t.Fatalf("heartbeat missing during poll: %q", body)
	}
	if !strings.Contains(body, "image_generation_error") {
		t.Fatalf("SSE error event missing: %q", body)
	}
}

// TestStreamSlowPathSuccessNoRace locks in the synchronous stop() contract:
// after the slow path returns, no heartbeat write may still be in flight, so
// subsequent streamImageResponse writes are race-free (run with -race).
func TestStreamSlowPathSuccessNoRace(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldHB := imageHeartbeatInterval
	imageHeartbeatInterval = time.Millisecond
	t.Cleanup(func() { imageHeartbeatInterval = oldHB })
	shrinkPoll(t, 2*time.Second)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"created":9,"data":[{"b64_json":"aGk="}]}`))
	}))
	defer srv.Close()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	info := imageInfo(srv.URL)
	info.IsStream = true
	final, err := resolveImageResult(c, info, fakeResp(202, `{"poll_url":"`+srv.URL+`/p"}`, nil), "s")
	if err != nil {
		t.Fatal(err)
	}
	if _, apiErr := streamImageResponse(c, final, info); apiErr != nil {
		t.Fatal(apiErr)
	}
	if !strings.Contains(w.Body.String(), "image_generation.completed") {
		t.Fatalf("missing completed: %s", w.Body.String())
	}
}

func TestStreamImageResponseEditsEventName(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", nil)
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits, IsStream: true,
		ChannelMeta: &relaycommon.ChannelMeta{}}
	resp := fakeResp(200, `{"created":9,"data":[{"b64_json":"eA=="}]}`, nil)
	_, apiErr := streamImageResponse(c, resp, info)
	if apiErr != nil {
		t.Fatal(apiErr)
	}
	if !strings.Contains(w.Body.String(), "image_edit.completed") {
		t.Fatalf("edits must use image_edit.completed: %s", w.Body.String())
	}
}
