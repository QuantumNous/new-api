package helper

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"github.com/QuantumNous/new-api/types"
)

func newClaudeCtx(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	return ctx
}

func newOpenAIImageJSONCtx(t *testing.T, path, body string) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	return ctx
}

func newOpenAIImageMultipartCtx(t *testing.T, path string, fields map[string]string, files map[string][]byte) *gin.Context {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for key, value := range fields {
		require.NoError(t, writer.WriteField(key, value))
	}
	for field, data := range files {
		part, err := writer.CreateFormFile(field, field+".png")
		require.NoError(t, err)
		_, err = part.Write(data)
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, path, &body)
	ctx.Request.Header.Set("Content-Type", writer.FormDataContentType())
	return ctx
}

func TestGetAndValidOpenAIImageRequest_JSONBindsGrokScalarsAndRejectedFieldPresence(t *testing.T) {
	body := `{"model":"grok-imagine-image-2.0","prompt":"paint","n":2,"response_format":"b64_json","resolution":"2k","quality":"medium","aspect_ratio":"16:9","image":"https://example.com/a.png","mask":"data:image/png;base64,AAAA","user":"u","file_id":"file-1","storage_options":{"store":true}}`
	req, err := GetAndValidOpenAIImageRequest(newOpenAIImageJSONCtx(t, "/v1/images/edits", body), relayconstant.RelayModeImagesEdits)
	require.NoError(t, err)
	require.Equal(t, "grok-imagine-image-2.0", req.Model)
	require.Equal(t, "paint", req.Prompt)
	require.NotNil(t, req.N)
	require.Equal(t, uint(2), *req.N)
	require.Equal(t, "b64_json", req.ResponseFormat)
	require.Equal(t, "2k", req.Resolution)
	require.Equal(t, "medium", req.Quality)
	require.Equal(t, "16:9", req.AspectRatio)
	require.JSONEq(t, `"https://example.com/a.png"`, string(req.Image))
	require.NotEmpty(t, req.Mask)
	require.NotEmpty(t, req.User)
	require.Contains(t, req.Extra, "file_id")
	require.Contains(t, req.Extra, "storage_options")
}

func TestGetAndValidOpenAIImageRequest_MultipartBindsGrokScalarsAndFiles(t *testing.T) {
	req, err := GetAndValidOpenAIImageRequest(newOpenAIImageMultipartCtx(t, "/v1/images/edits", map[string]string{
		"model":           "grok-imagine-image-2.0",
		"prompt":          "edit",
		"n":               "3",
		"response_format": "url",
		"resolution":      "1k",
		"quality":         "low",
		"aspect_ratio":    "auto",
		"mask":            "present",
		"user":            "u",
		"file_id":         "file-1",
		"storage_options": `{"store":true}`,
	}, map[string][]byte{
		"image":    []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'},
		"image[]":  []byte{0xff, 0xd8, 0xff, 0xdb},
		"image[2]": []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'},
	}), relayconstant.RelayModeImagesEdits)
	require.NoError(t, err)
	require.Equal(t, "grok-imagine-image-2.0", req.Model)
	require.Equal(t, "edit", req.Prompt)
	require.NotNil(t, req.N)
	require.Equal(t, uint(3), *req.N)
	require.Equal(t, "url", req.ResponseFormat)
	require.Equal(t, "1k", req.Resolution)
	require.Equal(t, "low", req.Quality)
	require.Equal(t, "auto", req.AspectRatio)
	require.NotEmpty(t, req.Mask)
	require.NotEmpty(t, req.User)
	require.Contains(t, req.Extra, "file_id")
	require.Contains(t, req.Extra, "storage_options")
	require.Len(t, req.Extra, 2)
	require.NotNil(t, req)
}

func TestGetAndValidateClaudeRequest_ThinkingTypeRequired(t *testing.T) {
	base := `"model":"claude-opus-4-8","max_tokens":50,"messages":[{"role":"user","content":"hi"}]`

	// requireBadRequest asserts not just the 400 status but that the rendered
	// Claude error has the Anthropic-shaped type and an uncorrupted message that
	// names the field — guarding against the masking/wrong-type regressions and
	// against the predicate being weakened so the 400 comes from another path.
	requireBadRequest := func(t *testing.T, err error) {
		t.Helper()
		require.Error(t, err)
		var apiErr *types.NewAPIError
		require.ErrorAs(t, err, &apiErr)
		require.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
		ce := apiErr.ToClaudeError()
		require.Equal(t, "invalid_request_error", ce.Type)
		require.Contains(t, ce.Message, "thinking")
		require.NotContains(t, ce.Message, "***")
	}

	t.Run("invalid thinking.enable (no type) -> 400", func(t *testing.T) {
		_, err := GetAndValidateClaudeRequest(newClaudeCtx("{" + base + `,"thinking":{"enable":true}}`))
		requireBadRequest(t, err)
	})

	t.Run("empty thinking object -> 400", func(t *testing.T) {
		_, err := GetAndValidateClaudeRequest(newClaudeCtx("{" + base + `,"thinking":{}}`))
		requireBadRequest(t, err)
	})

	t.Run("explicit empty type -> 400", func(t *testing.T) {
		_, err := GetAndValidateClaudeRequest(newClaudeCtx("{" + base + `,"thinking":{"type":""}}`))
		requireBadRequest(t, err)
	})

	t.Run("valid thinking type=enabled -> ok", func(t *testing.T) {
		req, err := GetAndValidateClaudeRequest(newClaudeCtx("{" + base + `,"thinking":{"type":"enabled","budget_tokens":2000}}`))
		require.NoError(t, err)
		require.NotNil(t, req)
		require.Equal(t, "enabled", req.Thinking.Type)
	})

	t.Run("valid thinking type=adaptive -> ok", func(t *testing.T) {
		req, err := GetAndValidateClaudeRequest(newClaudeCtx("{" + base + `,"thinking":{"type":"adaptive"}}`))
		require.NoError(t, err)
		require.NotNil(t, req)
	})

	t.Run("no thinking field -> ok", func(t *testing.T) {
		req, err := GetAndValidateClaudeRequest(newClaudeCtx("{" + base + "}"))
		require.NoError(t, err)
		require.NotNil(t, req)
	})

	t.Run("thinking null -> ok", func(t *testing.T) {
		req, err := GetAndValidateClaudeRequest(newClaudeCtx("{" + base + `,"thinking":null}`))
		require.NoError(t, err)
		require.NotNil(t, req)
		require.Nil(t, req.Thinking)
	})

	// Regression guard: effort-suffix models get thinking.type synthesized by the
	// native handler later, so an empty-type thinking object must NOT be rejected
	// here (it worked before this validation was added).
	t.Run("effort-suffix model + empty thinking -> ok (handler synthesizes type)", func(t *testing.T) {
		body := `{"model":"claude-opus-4-8-high","max_tokens":50,"messages":[{"role":"user","content":"hi"}],"thinking":{}}`
		req, err := GetAndValidateClaudeRequest(newClaudeCtx(body))
		require.NoError(t, err)
		require.NotNil(t, req)
	})
}
