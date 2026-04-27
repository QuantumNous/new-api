package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// runVolcMiddlewareCase sets up a gin router with VolcRequestConvert() and a
// captured-context handler, fires the request, and calls assertCtx with the
// captured gin.Context. The returned *httptest.ResponseRecorder is returned so
// callers can check the HTTP status code as well.
func runVolcMiddlewareCase(
	t *testing.T,
	method, path, routePattern, body string,
	assertCtx func(*testing.T, *gin.Context),
) *httptest.ResponseRecorder {
	t.Helper()
	router := gin.New()

	handler := func(c *gin.Context) {
		assertCtx(t, c)
	}

	switch method {
	case http.MethodPost:
		router.POST(routePattern, VolcRequestConvert(), handler)
	case http.MethodGet:
		router.GET(routePattern, VolcRequestConvert(), handler)
	case http.MethodDelete:
		router.DELETE(routePattern, VolcRequestConvert(), handler)
	default:
		t.Fatalf("unsupported method: %s", method)
	}

	var bodyReader *strings.Reader
	if body != "" {
		bodyReader = strings.NewReader(body)
	} else {
		bodyReader = strings.NewReader("")
	}
	req := httptest.NewRequest(method, path, bodyReader)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

// assertRewrittenBody re-parses the request body from the context (via
// common.UnmarshalBodyReusable) and returns the parsed map.
func assertRewrittenBody(t *testing.T, c *gin.Context) map[string]any {
	t.Helper()
	var req map[string]any
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		t.Fatalf("failed to re-parse rewritten body: %v", err)
	}
	return req
}

// assertKeyRequestBody verifies that c.MustGet(common.KeyRequestBody) is set
// and that its JSON content matches expectedBody.
func assertKeyRequestBody(t *testing.T, c *gin.Context, expectedBody map[string]any) {
	t.Helper()
	raw, exists := c.Get(common.KeyRequestBody)
	if !exists {
		t.Fatalf("KeyRequestBody not set in context")
	}
	rawBytes, ok := raw.([]byte)
	if !ok {
		t.Fatalf("KeyRequestBody is not []byte, got %T", raw)
	}
	var got map[string]any
	if err := json.Unmarshal(rawBytes, &got); err != nil {
		t.Fatalf("KeyRequestBody bytes are not valid JSON: %v", err)
	}
	if !reflect.DeepEqual(got, expectedBody) {
		gotJSON, _ := json.Marshal(got)
		wantJSON, _ := json.Marshal(expectedBody)
		t.Fatalf("KeyRequestBody mismatch:\n  got:  %s\n  want: %s", gotJSON, wantJSON)
	}
}

// ─── Main-path tests ─────────────────────────────────────────────────────────

// TestVolcConvert_ImageGeneration_T2I tests a text-to-image request using the
// realistic doubao-seedream-3-0-t2i-250415 model.
func TestVolcConvert_ImageGeneration_T2I(t *testing.T) {
	const (
		inputBody = `{"model":"doubao-seedream-3-0-t2i-250415","prompt":"a running corgi","size":"1024x1024","watermark":true}`
		wantModel = "doubao-seedream-3-0-t2i-250415"
		wantPrompt = "a running corgi"
	)

	var origReq map[string]any
	_ = json.Unmarshal([]byte(inputBody), &origReq)

	rec := runVolcMiddlewareCase(
		t,
		http.MethodPost,
		"/volc/api/v3/images/generations",
		"/volc/api/v3/images/generations",
		inputBody,
		func(t *testing.T, c *gin.Context) {
			if got := c.Request.URL.Path; got != "/v1/images/generations" {
				t.Errorf("rewritten path: got %q, want %q", got, "/v1/images/generations")
			}

			body := assertRewrittenBody(t, c)

			if body["model"] != wantModel {
				t.Errorf("model: got %#v, want %q", body["model"], wantModel)
			}
			if body["prompt"] != wantPrompt {
				t.Errorf("prompt: got %#v, want %q", body["prompt"], wantPrompt)
			}

			// metadata must deep-equal the entire original request
			meta, ok := body["metadata"].(map[string]any)
			if !ok {
				t.Fatalf("metadata is not a map, got %T", body["metadata"])
			}
			if !reflect.DeepEqual(meta, origReq) {
				t.Errorf("metadata mismatch:\n  got:  %#v\n  want: %#v", meta, origReq)
			}

			wantBody := map[string]any{
				"model":    wantModel,
				"prompt":   wantPrompt,
				"metadata": origReq,
			}
			assertKeyRequestBody(t, c, wantBody)
		},
	)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body: %s", rec.Code, rec.Body.String())
	}
}

// TestVolcConvert_ImageGeneration_I2I tests an image-to-image request with an
// image array, using doubao-seedream-4-5-251128.
func TestVolcConvert_ImageGeneration_I2I(t *testing.T) {
	const (
		inputBody = `{"model":"doubao-seedream-4-5-251128","prompt":"make it sunset","image":["url1","url2"],"size":"2K"}`
		wantModel = "doubao-seedream-4-5-251128"
		wantPrompt = "make it sunset"
	)

	var origReq map[string]any
	_ = json.Unmarshal([]byte(inputBody), &origReq)

	rec := runVolcMiddlewareCase(
		t,
		http.MethodPost,
		"/volc/api/v3/images/generations",
		"/volc/api/v3/images/generations",
		inputBody,
		func(t *testing.T, c *gin.Context) {
			if got := c.Request.URL.Path; got != "/v1/images/generations" {
				t.Errorf("rewritten path: got %q, want %q", got, "/v1/images/generations")
			}

			body := assertRewrittenBody(t, c)

			if body["model"] != wantModel {
				t.Errorf("model: got %#v, want %q", body["model"], wantModel)
			}
			if body["prompt"] != wantPrompt {
				t.Errorf("prompt: got %#v, want %q", body["prompt"], wantPrompt)
			}

			meta, ok := body["metadata"].(map[string]any)
			if !ok {
				t.Fatalf("metadata is not a map, got %T", body["metadata"])
			}
			if !reflect.DeepEqual(meta, origReq) {
				t.Errorf("metadata mismatch:\n  got:  %#v\n  want: %#v", meta, origReq)
			}

			wantBody := map[string]any{
				"model":    wantModel,
				"prompt":   wantPrompt,
				"metadata": origReq,
			}
			assertKeyRequestBody(t, c, wantBody)
		},
	)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body: %s", rec.Code, rec.Body.String())
	}
}

// TestVolcConvert_VideoSubmit_T2V tests text-to-video submission using
// doubao-seedance-2-0-260128. Body has no image field; expects action to be set.
func TestVolcConvert_VideoSubmit_T2V(t *testing.T) {
	const (
		inputBody = `{"model":"doubao-seedance-2-0-260128","content":"a cat playing piano","duration":5,"ratio":"16:9"}`
		wantModel = "doubao-seedance-2-0-260128"
		wantPrompt = "a cat playing piano"
	)

	var origReq map[string]any
	_ = json.Unmarshal([]byte(inputBody), &origReq)

	rec := runVolcMiddlewareCase(
		t,
		http.MethodPost,
		"/volc/api/v3/contents/generations/tasks",
		"/volc/api/v3/contents/generations/tasks",
		inputBody,
		func(t *testing.T, c *gin.Context) {
			if got := c.Request.URL.Path; got != "/v1/video/generations" {
				t.Errorf("rewritten path: got %q, want %q", got, "/v1/video/generations")
			}

			body := assertRewrittenBody(t, c)

			if body["model"] != wantModel {
				t.Errorf("model: got %#v, want %q", body["model"], wantModel)
			}
			if body["prompt"] != wantPrompt {
				t.Errorf("prompt: got %#v, want %q", body["prompt"], wantPrompt)
			}

			// No image field → action must be set to TextGenerate
			if action := c.GetString("action"); action == "" {
				t.Error("action should be set for text-to-video (no image field)")
			}

			meta, ok := body["metadata"].(map[string]any)
			if !ok {
				t.Fatalf("metadata is not a map, got %T", body["metadata"])
			}
			if !reflect.DeepEqual(meta, origReq) {
				t.Errorf("metadata mismatch:\n  got:  %#v\n  want: %#v", meta, origReq)
			}

			wantBody := map[string]any{
				"model":    wantModel,
				"prompt":   wantPrompt,
				"metadata": origReq,
			}
			assertKeyRequestBody(t, c, wantBody)
		},
	)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body: %s", rec.Code, rec.Body.String())
	}
}

// TestVolcConvert_VideoSubmit_I2V tests image-to-video submission. Body contains
// an image field; action should NOT be set (image present means i2v path).
func TestVolcConvert_VideoSubmit_I2V(t *testing.T) {
	const (
		inputBody = `{"model":"doubao-seedance-2-0-260128","content":"zoom in slowly","image":"https://example.com/frame.jpg","duration":5}`
		wantModel = "doubao-seedance-2-0-260128"
		wantPrompt = "zoom in slowly"
	)

	var origReq map[string]any
	_ = json.Unmarshal([]byte(inputBody), &origReq)

	rec := runVolcMiddlewareCase(
		t,
		http.MethodPost,
		"/volc/api/v3/contents/generations/tasks",
		"/volc/api/v3/contents/generations/tasks",
		inputBody,
		func(t *testing.T, c *gin.Context) {
			if got := c.Request.URL.Path; got != "/v1/video/generations" {
				t.Errorf("rewritten path: got %q, want %q", got, "/v1/video/generations")
			}

			body := assertRewrittenBody(t, c)

			if body["model"] != wantModel {
				t.Errorf("model: got %#v, want %q", body["model"], wantModel)
			}
			if body["prompt"] != wantPrompt {
				t.Errorf("prompt: got %#v, want %q", body["prompt"], wantPrompt)
			}

			// Image present → action must NOT be set (i2v branch stays unset)
			action, exists := c.Get("action")
			if exists && action != "" {
				t.Errorf("action should not be set when image is present, got %q", action)
			}

			meta, ok := body["metadata"].(map[string]any)
			if !ok {
				t.Fatalf("metadata is not a map, got %T", body["metadata"])
			}
			if !reflect.DeepEqual(meta, origReq) {
				t.Errorf("metadata mismatch:\n  got:  %#v\n  want: %#v", meta, origReq)
			}

			wantBody := map[string]any{
				"model":    wantModel,
				"prompt":   wantPrompt,
				"metadata": origReq,
			}
			assertKeyRequestBody(t, c, wantBody)
		},
	)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body: %s", rec.Code, rec.Body.String())
	}
}

// TestVolcConvert_VideoFetchByID verifies that a GET /:id request rewrites the
// path, sets task_id, and sets relay_mode = RelayModeVideoFetchByID.
func TestVolcConvert_VideoFetchByID(t *testing.T) {
	rec := runVolcMiddlewareCase(
		t,
		http.MethodGet,
		"/volc/api/v3/contents/generations/tasks/task_abc123",
		"/volc/api/v3/contents/generations/tasks/:id",
		"",
		func(t *testing.T, c *gin.Context) {
			if got := c.Request.URL.Path; got != "/v1/video/generations/task_abc123" {
				t.Errorf("rewritten path: got %q, want %q", got, "/v1/video/generations/task_abc123")
			}
			if taskID := c.GetString("task_id"); taskID != "task_abc123" {
				t.Errorf("task_id: got %q, want %q", taskID, "task_abc123")
			}
			relayMode, ok := c.Get("relay_mode")
			if !ok {
				t.Fatal("relay_mode not set")
			}
			if relayMode != relayconstant.RelayModeVideoFetchByID {
				t.Errorf("relay_mode: got %#v, want %#v", relayMode, relayconstant.RelayModeVideoFetchByID)
			}
		},
	)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body: %s", rec.Code, rec.Body.String())
	}
}

// TestVolcConvert_VideoList verifies that a GET /contents/generations/tasks
// request rewrites the path and sets relay_mode = RelayModeVideoFetchList.
func TestVolcConvert_VideoList(t *testing.T) {
	rec := runVolcMiddlewareCase(
		t,
		http.MethodGet,
		"/volc/api/v3/contents/generations/tasks?page_num=1&page_size=10",
		"/volc/api/v3/contents/generations/tasks",
		"",
		func(t *testing.T, c *gin.Context) {
			if got := c.Request.URL.Path; got != "/v1/video/generations" {
				t.Errorf("rewritten path: got %q, want %q", got, "/v1/video/generations")
			}
			relayMode, ok := c.Get("relay_mode")
			if !ok {
				t.Fatal("relay_mode not set")
			}
			if relayMode != relayconstant.RelayModeVideoFetchList {
				t.Errorf("relay_mode: got %#v, want %#v", relayMode, relayconstant.RelayModeVideoFetchList)
			}
		},
	)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body: %s", rec.Code, rec.Body.String())
	}
}

// TestVolcConvert_VideoDelete_NotImplemented verifies that DELETE requests are
// aborted with 501 before reaching the handler.
func TestVolcConvert_VideoDelete_NotImplemented(t *testing.T) {
	rec := runVolcMiddlewareCase(
		t,
		http.MethodDelete,
		"/volc/api/v3/contents/generations/tasks/task_xyz",
		"/volc/api/v3/contents/generations/tasks/:id",
		"",
		func(t *testing.T, c *gin.Context) {
			t.Fatal("handler should not be reached for DELETE")
		},
	)

	if rec.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501, got %d body: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "not supported") {
		t.Errorf("response body does not mention 'not supported': %s", rec.Body.String())
	}
}

// ─── Table-driven fallback test ───────────────────────────────────────────────

// TestVolcConvert_RequestKeyFallback table-drives the model/prompt field
// fallback chain for both image and video submit endpoints.
func TestVolcConvert_RequestKeyFallback(t *testing.T) {
	type row struct {
		name       string
		endpoint   string
		method     string
		pattern    string
		body       string
		wantModel  string
		wantPrompt string
	}

	rows := []row{
		// ── model field fallback ──
		{
			name:       "image: model field wins over model_name",
			endpoint:   "/volc/api/v3/images/generations",
			method:     http.MethodPost,
			pattern:    "/volc/api/v3/images/generations",
			body:       `{"model":"doubao-seedream-5-0-260128","model_name":"wrong","prompt":"hello"}`,
			wantModel:  "doubao-seedream-5-0-260128",
			wantPrompt: "hello",
		},
		{
			name:       "image: model_name fallback when model missing",
			endpoint:   "/volc/api/v3/images/generations",
			method:     http.MethodPost,
			pattern:    "/volc/api/v3/images/generations",
			body:       `{"model_name":"doubao-seedream-4-0-250828","prompt":"hi"}`,
			wantModel:  "doubao-seedream-4-0-250828",
			wantPrompt: "hi",
		},
		{
			name:       "image: req_key fallback (legacy) when model and model_name missing",
			endpoint:   "/volc/api/v3/images/generations",
			method:     http.MethodPost,
			pattern:    "/volc/api/v3/images/generations",
			body:       `{"req_key":"doubao-seedream-3-0-t2i-250415","prompt":"world"}`,
			wantModel:  "doubao-seedream-3-0-t2i-250415",
			wantPrompt: "world",
		},
		// ── prompt/content field fallback ──
		{
			name:       "video: prompt field wins over content",
			endpoint:   "/volc/api/v3/contents/generations/tasks",
			method:     http.MethodPost,
			pattern:    "/volc/api/v3/contents/generations/tasks",
			body:       `{"model":"doubao-seedance-2-0-260128","prompt":"use prompt","content":"ignore content"}`,
			wantModel:  "doubao-seedance-2-0-260128",
			wantPrompt: "use prompt",
		},
		{
			name:       "video: content fallback when prompt missing",
			endpoint:   "/volc/api/v3/contents/generations/tasks",
			method:     http.MethodPost,
			pattern:    "/volc/api/v3/contents/generations/tasks",
			body:       `{"model":"doubao-seedance-1-5-pro-251215","content":"sunset timelapse"}`,
			wantModel:  "doubao-seedance-1-5-pro-251215",
			wantPrompt: "sunset timelapse",
		},
		{
			name:       "video: model_name fallback for model field",
			endpoint:   "/volc/api/v3/contents/generations/tasks",
			method:     http.MethodPost,
			pattern:    "/volc/api/v3/contents/generations/tasks",
			body:       `{"model_name":"doubao-seedance-2-0-fast-260128","content":"fly over city"}`,
			wantModel:  "doubao-seedance-2-0-fast-260128",
			wantPrompt: "fly over city",
		},
		{
			name:       "video: req_key fallback (legacy) for model field",
			endpoint:   "/volc/api/v3/contents/generations/tasks",
			method:     http.MethodPost,
			pattern:    "/volc/api/v3/contents/generations/tasks",
			body:       `{"req_key":"doubao-seedance-1-0-pro-250528","content":"ocean waves"}`,
			wantModel:  "doubao-seedance-1-0-pro-250528",
			wantPrompt: "ocean waves",
		},
	}

	for _, r := range rows {
		r := r // capture
		t.Run(r.name, func(t *testing.T) {
			rec := runVolcMiddlewareCase(
				t,
				r.method,
				r.endpoint,
				r.pattern,
				r.body,
				func(t *testing.T, c *gin.Context) {
					body := assertRewrittenBody(t, c)
					if body["model"] != r.wantModel {
						t.Errorf("model: got %#v, want %q", body["model"], r.wantModel)
					}
					if body["prompt"] != r.wantPrompt {
						t.Errorf("prompt: got %#v, want %q", body["prompt"], r.wantPrompt)
					}
				},
			)
			if rec.Code != http.StatusOK {
				t.Fatalf("unexpected status: %d body: %s", rec.Code, rec.Body.String())
			}
		})
	}
}

// ─── Negative tests ────────────────────────────────────────────────────────────

// TestVolcConvert_InvalidBody table-drives bad-input cases for both submit
// endpoints and expects 400 responses.
func TestVolcConvert_InvalidBody(t *testing.T) {
	type row struct {
		name       string
		endpoint   string
		body       string
		wantStatus int
		wantErrMsg string
	}

	rows := []row{
		{
			name:       "image: invalid JSON",
			endpoint:   "/volc/api/v3/images/generations",
			body:       `{not json`,
			wantStatus: http.StatusBadRequest,
			wantErrMsg: "Invalid request body",
		},
		{
			name:       "image: empty body",
			endpoint:   "/volc/api/v3/images/generations",
			body:       ``,
			wantStatus: http.StatusBadRequest,
			wantErrMsg: "Invalid request body",
		},
		{
			name:       "video: invalid JSON",
			endpoint:   "/volc/api/v3/contents/generations/tasks",
			body:       `{bad`,
			wantStatus: http.StatusBadRequest,
			wantErrMsg: "Invalid request body",
		},
		{
			name:       "video: empty body",
			endpoint:   "/volc/api/v3/contents/generations/tasks",
			body:       ``,
			wantStatus: http.StatusBadRequest,
			wantErrMsg: "Invalid request body",
		},
	}

	for _, r := range rows {
		r := r
		t.Run(r.name, func(t *testing.T) {
			// Register separate router per row since the pattern is fixed.
			router := gin.New()
			router.POST(r.endpoint, VolcRequestConvert(), func(c *gin.Context) {
				t.Fatal("handler should not be reached for invalid input")
			})

			bodyReader := strings.NewReader(r.body)
			req := httptest.NewRequest(http.MethodPost, r.endpoint, bodyReader)
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			if rec.Code != r.wantStatus {
				t.Errorf("status: got %d, want %d; body: %s", rec.Code, r.wantStatus, rec.Body.String())
			}
			if r.wantErrMsg != "" && !strings.Contains(rec.Body.String(), r.wantErrMsg) {
				t.Errorf("response body %q does not contain expected error %q", rec.Body.String(), r.wantErrMsg)
			}
		})
	}
}
