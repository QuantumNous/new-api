package blockrun

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// newImageJSONCtx creates a non-stream gin.Context for image generation tests.
func newImageJSONCtx(t *testing.T) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	return c, w
}

// imageJSONInfo returns a non-stream RelayInfo for image generations.
func imageJSONInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeImagesGenerations,
		IsStream:    false,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}
}

func imageJSONInfoWithTempURL(enabled bool) *relaycommon.RelayInfo {
	info := imageJSONInfo()
	info.Request = &dto.ImageRequest{TempUrl: common.GetPointer(enabled)}
	return info
}

// TestImageJSONResponseB64_URLConvertedToB64 asserts that when the upstream
// returns a URL (not b64_json), imageJSONResponseB64 downloads it, converts to
// base64, and clears the url from the response.
func TestImageJSONResponseB64_URLConvertedToB64(t *testing.T) {
	allowLocalDownloads(t)

	imgSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("PNGDATA"))
	}))
	defer imgSrv.Close()

	c, w := newImageJSONCtx(t)
	info := imageJSONInfo()
	// base64("PNGDATA") = "UE5HREFUQQ=="
	body := `{"created":1,"data":[{"url":"` + imgSrv.URL + `/img.png"}]}`
	resp := fakeResp(200, body, http.Header{"Content-Type": []string{"application/json"}})

	usage, apiErr := imageJSONResponseB64(c, resp, info)
	if apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}
	if usage == nil {
		t.Fatal("usage must be non-nil so ImageHelper can bill")
	}
	out := w.Body.String()
	if !strings.Contains(out, "UE5HREFUQQ==") {
		t.Fatalf("url must be downloaded and base64-encoded in response; got: %s", out)
	}
	if strings.Contains(out, imgSrv.URL) {
		t.Fatalf("upstream CDN url must be cleared from response (whitelabel); got: %s", out)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("Content-Type must be application/json, got %q", ct)
	}
}

// TestImageJSONResponseB64_DownloadFailDegrades asserts that when the image
// download fails (upstream 500), the response degrades: the url is kept and
// no error is returned (upstream charge already committed).
func TestImageJSONResponseB64_DownloadFailDegrades(t *testing.T) {
	allowLocalDownloads(t)

	failSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer failSrv.Close()

	c, w := newImageJSONCtx(t)
	info := imageJSONInfo()
	body := `{"created":2,"data":[{"url":"` + failSrv.URL + `/img.png"}]}`
	resp := fakeResp(200, body, http.Header{"Content-Type": []string{"application/json"}})

	usage, apiErr := imageJSONResponseB64(c, resp, info)
	if apiErr != nil {
		t.Fatalf("download failure must degrade, not error (upstream charge committed): %v", apiErr)
	}
	if usage == nil {
		t.Fatal("usage must be non-nil even on degraded path")
	}
	out := w.Body.String()
	if !strings.Contains(out, failSrv.URL) {
		t.Fatalf("degraded response must keep the original url: %s", out)
	}
}

// TestImageJSONResponseB64_EmptyDataErrors asserts that a response with no
// image data returns an error (not a silent empty response).
func TestImageJSONResponseB64_EmptyDataErrors(t *testing.T) {
	c, _ := newImageJSONCtx(t)
	info := imageJSONInfo()
	resp := fakeResp(200, `{"created":3,"data":[]}`,
		http.Header{"Content-Type": []string{"application/json"}})

	_, apiErr := imageJSONResponseB64(c, resp, info)
	if apiErr == nil {
		t.Fatal("empty data[] must return an error")
	}
}

// TestImageJSONResponseB64_B64AlreadyPresent asserts that when the upstream
// already returns b64_json (no url), it is passed through unchanged without any
// download attempt.
func TestImageJSONResponseB64_B64AlreadyPresent(t *testing.T) {
	c, w := newImageJSONCtx(t)
	info := imageJSONInfo()
	resp := fakeResp(200, `{"created":4,"data":[{"b64_json":"aGVsbG8="}]}`,
		http.Header{"Content-Type": []string{"application/json"}})

	_, apiErr := imageJSONResponseB64(c, resp, info)
	if apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}
	if !strings.Contains(w.Body.String(), "aGVsbG8=") {
		t.Fatalf("b64_json must be passed through unchanged: %s", w.Body.String())
	}
}

func TestImageJSONResponseB64_TempURLConvertsToSignedURL(t *testing.T) {
	oldUpload := uploadTempMediaImageForBlockRun
	defer func() { uploadTempMediaImageForBlockRun = oldUpload }()
	uploadTempMediaImageForBlockRun = func(ctx context.Context, request service.TempMediaUploadRequest) (*service.TempMediaUploadResult, error) {
		return &service.TempMediaUploadResult{
			SignedURL: "https://tmp.example/object",
			ExpiresAt: 1700003600,
			ExpiresIn: 3600,
		}, nil
	}

	c, w := newImageJSONCtx(t)
	info := imageJSONInfoWithTempURL(true)
	body := `{"created":6,"data":[{"b64_json":"aGVsbG8="}]}`
	resp := fakeResp(200, body, http.Header{"Content-Type": []string{"application/json"}})

	usage, apiErr := imageJSONResponseB64(c, resp, info)
	if apiErr != nil {
		t.Fatalf("temp_url image conversion should succeed: %v", apiErr)
	}
	if usage == nil {
		t.Fatal("usage must be non-nil")
	}
	var out dto.ImageResponse
	if err := common.Unmarshal([]byte(w.Body.String()), &out); err != nil {
		t.Fatalf("response should be ImageResponse: %v / %s", err, w.Body.String())
	}
	if len(out.Data) != 1 {
		t.Fatalf("expect one image, got %d", len(out.Data))
	}
	if out.Data[0].Url != "https://tmp.example/object" {
		t.Fatalf("temp_url should return signed url, got %+v", out.Data[0])
	}
	if out.Data[0].B64Json != "" {
		t.Fatalf("temp_url should suppress inline b64_json: %v", out.Data[0])
	}
	if out.Data[0].ExpiresAt != 1700003600 {
		t.Fatalf("expected expiresAt set from temp upload result, got %d", out.Data[0].ExpiresAt)
	}
	if out.Data[0].ExpiresIn != 3600 {
		t.Fatalf("expected expiresIn set from temp upload result, got %d", out.Data[0].ExpiresIn)
	}
}

// TestEnsureImageB64_ClearsURLWhenB64Present asserts that when bytes are already
// in hand, any upstream CDN url is blanked so b64 and url never ship together
// (defends the whitelabel invariant against an upstream that returns both).
func TestEnsureImageB64_ClearsURLWhenB64Present(t *testing.T) {
	c, _ := newImageJSONCtx(t)
	item := dto.ImageData{B64Json: "aGk=", Url: "https://cdn.upstream.example/x.png"}

	ensureImageB64(c, imageJSONInfo(), &item)

	if item.Url != "" {
		t.Fatalf("url must be cleared when b64 is already present, got %q", item.Url)
	}
	if item.B64Json != "aGk=" {
		t.Fatalf("b64 must be preserved unchanged, got %q", item.B64Json)
	}
}

// TestImageJSONResponseB64_SSRFBlockedDegrades asserts that when SSRF protection
// blocks the image URL, the response degrades to keeping the url (not an error).
func TestImageJSONResponseB64_SSRFBlockedDegrades(t *testing.T) {
	// SSRF ON — do NOT call allowLocalDownloads.
	imgSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("PNGDATA"))
	}))
	defer imgSrv.Close()

	c, w := newImageJSONCtx(t)
	info := imageJSONInfo()
	body := `{"created":5,"data":[{"url":"` + imgSrv.URL + `/img.png"}]}`
	resp := fakeResp(200, body, http.Header{"Content-Type": []string{"application/json"}})

	_, apiErr := imageJSONResponseB64(c, resp, info)
	if apiErr != nil {
		t.Fatalf("SSRF block must degrade, not error: %v", apiErr)
	}
	if !strings.Contains(w.Body.String(), imgSrv.URL) {
		t.Fatalf("SSRF-blocked response must keep the original url: %s", w.Body.String())
	}
}
