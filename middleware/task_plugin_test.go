package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"os"
	"strings"
	"testing"
	"testing/iotest"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	appI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	builtinplugins "github.com/QuantumNous/new-api/plugins"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

const genericTaskPluginSource = `
export const meta = {apiVersion: 1, key: "generic-entry-test", name: "Generic", version: "1.0.0", author: {name: "Test"}, models: ["doc"], fetchMode: "per_task"};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`

func TestPrepareTaskPluginSubmitRejectsMissingModel(t *testing.T) {
	_, err := jsplugin.DefaultRegistry.Register(genericTaskPluginSource, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister("generic-entry-test") })
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Params = gin.Params{{Key: "key", Value: "generic-entry-test"}}
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/tasks/generic-entry-test", strings.NewReader(`{"prompt":"x"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	PrepareTaskPluginSubmit()(c)
	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "model is required")
}

func TestPrepareTaskPluginRouteUsesCanonicalContextAndResolvedSubmit(t *testing.T) {
	plugin := compileTaskRoutePlugin(t, `
export const meta = {
  apiVersion: 1, key: "route-submit-test", name: "Submit", version: "1.0.0",
  author: {name: "Test"},
  models: ["resolved-model"], fetchMode: "per_task",
  routes: [{method: "POST", path: "/vendor/jobs/:category", type: "submit", action: "static-action", decode: "decodeJob", render: "jobCreated"}],
};
export const native = {
decodeJob: function(ctx) {
  if (ctx.path !== "/vendor/jobs/video" || ctx.method !== "POST") throw new Error("bad path");
  if (ctx.params.category !== "video") throw new Error("bad params");
  if (ctx.query.tag.length !== 2 || ctx.query.tag[0] !== "first" || ctx.query.tag[1] !== "second") throw new Error("bad query");
  if (ctx.body.kind !== "json" || !Array.isArray(ctx.body.value) || ctx.body.value[0] !== "prompt") throw new Error("bad body");
	return {kind: "submit", model: "resolved-model", action: "resolved-action", requestBody: {prompt: "normalized"}};
},
jobCreated: function(ctx, task) { return task; },
};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`)

	router := gin.New()
	reachedSubmit := false
	router.POST("/vendor/jobs/:category", pinTaskPluginRoute(plugin, 0), PrepareTaskPluginRoute(), func(c *gin.Context) {
		reachedSubmit = true
		requestContext, ok := c.MustGet(jsplugin.ContextKeyRouteRequest).(jsplugin.RouteRequestContext)
		require.True(t, ok)
		assert.Equal(t, map[string]any{"prompt": "normalized"}, requestContext.RequestBody)
		assert.Equal(t, "resolved-model", c.GetString("resolved_task_model"))
		assert.Equal(t, "resolved-action", c.GetString("task_action"))
		assert.Equal(t, "route-submit-test", c.GetString("expected_task_plugin_key"))
		assert.Equal(t, "route-submit-test", c.GetString("task_plugin_key"))
		assert.Equal(t, "route-submit-test", c.GetString("platform"))
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/vendor/jobs/video?tag=first&tag=second", strings.NewReader(`["prompt",2]`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.True(t, reachedSubmit)
	assert.Equal(t, http.StatusNoContent, recorder.Code)
}

// Native routes and the generic submit entry hand a plugin declaring
// json-order@1 the client's member order and keep its decoded requestBody as
// ordered JSON text beside the Go value; other plugins see sorted members.
func TestTaskPluginEntriesKeepJSONOrderForDeclaringPlugins(t *testing.T) {
	source := `
export const meta = {
  apiVersion: 1, key: "route-order-test", name: "Order", version: "1.0.0", author: {name: "Test"},
  models: ["m"], fetchMode: "per_task", requiredCapabilities: ["json-order@1"],
  routes: [{method: "POST", path: "/vendor/eval", type: "submit", decode: "decodeEval", render: "evalDone"}],
};
export const native = {
decodeEval: function(ctx) {
  const state = ctx.body.value.state;
  return {kind: "submit", model: ctx.body.value.model, requestBody: {keys: Object.keys(state), state: state}};
},
evalDone: function(ctx, task) { return task; },
};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`
	cases := []struct {
		name     string
		source   string
		wantText string
		wantKeys []any
	}{
		{name: "declared", source: source, wantText: `{"keys":["zeta","alpha"],"state":{"zeta":1,"alpha":2}}`, wantKeys: []any{"zeta", "alpha"}},
		{name: "undeclared", source: strings.Replace(source, `requiredCapabilities: ["json-order@1"],`, "", 1), wantKeys: []any{"alpha", "zeta"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			plugin := compileTaskRoutePlugin(t, tc.source)
			router := gin.New()
			reached := false
			router.POST("/vendor/eval", pinTaskPluginRoute(plugin, 0), PrepareTaskPluginRoute(), func(c *gin.Context) {
				reached = true
				request, ok := c.MustGet("task_request").(map[string]any)
				require.True(t, ok)
				assert.Equal(t, tc.wantKeys, request["keys"])
				text, exists := c.Get(jsplugin.ContextKeyRequestBodyText)
				if tc.wantText == "" {
					assert.False(t, exists)
				} else {
					assert.Equal(t, json.RawMessage(tc.wantText), text)
				}
				c.Status(http.StatusNoContent)
			})
			request := httptest.NewRequest(http.MethodPost, "/vendor/eval", strings.NewReader(`{"model":"m","state":{"zeta":1,"alpha":2}}`))
			request.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()

			router.ServeHTTP(recorder, request)

			assert.True(t, reached, recorder.Body.String())
		})
	}

	t.Run("generic submit entry", func(t *testing.T) {
		declaring := strings.Replace(genericTaskPluginSource, `fetchMode: "per_task"`, `fetchMode: "per_task", requiredCapabilities: ["json-order@1"]`, 1)
		_, err := jsplugin.DefaultRegistry.Register(declaring, jsplugin.Options{})
		require.NoError(t, err)
		t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister("generic-entry-test") })
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Params = gin.Params{{Key: "key", Value: "generic-entry-test"}}
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/tasks/generic-entry-test", strings.NewReader(`{"model":"doc","zeta":1,"alpha":2}`))
		c.Request.Header.Set("Content-Type", "application/json")

		PrepareTaskPluginSubmit()(c)

		require.False(t, c.IsAborted(), recorder.Body.String())
		text, exists := c.Get(jsplugin.ContextKeyRequestBodyText)
		require.True(t, exists)
		assert.Equal(t, json.RawMessage(`{"model":"doc","zeta":1,"alpha":2}`), text)
	})
}

func TestPrepareTaskPluginNativeRoutePassesMultipartToDecoder(t *testing.T) {
	plugin := compileTaskRoutePlugin(t, `
export const meta = {
  apiVersion: 1, key: "route-multipart-test", name: "Multipart", version: "1.0.0",
  author: {name: "Test"},
  models: ["multipart-model"], fetchMode: "per_task",
  routes: [
    {method: "POST", path: "/vendor/uploads", type: "submit", decode: "decodeUpload", render: "created"},
    {method: "POST", path: "/vendor/scoped", type: "submit", decode: "decodeUpload", render: "created", models: ["multipart-model"]},
  ],
};
export const native = {
  decodeUpload: function(ctx) {
    if (ctx.body.kind !== "multipart") throw new Error("multipart body expected");
    return {kind: "submit", model: "multipart-model", requestBody: {
      caption: ctx.body.fields.caption[0], tags: ctx.body.fields.tag.slice(),
      files: ctx.body.files.map(function(file) { return [file.ref, file.filename, file.size]; }),
    }};
  },
  created: function(ctx, task) { return task; },
};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("caption", "hello"))
	require.NoError(t, writer.WriteField("tag", "one"))
	require.NoError(t, writer.WriteField("tag", "two"))
	file, err := writer.CreateFormFile("media", "clip.bin")
	require.NoError(t, err)
	_, err = file.Write([]byte("opaque-file"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	router := gin.New()
	var taskRequest any
	router.POST("/vendor/uploads", pinTaskPluginRoute(plugin, 0), PrepareTaskPluginRoute(), func(c *gin.Context) {
		taskRequest, _ = c.Get("task_request")
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/vendor/uploads", bytes.NewReader(body.Bytes()))
	request.Header.Set("Content-Type", writer.FormDataContentType())
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusNoContent, recorder.Code, recorder.Body.String())
	assert.Equal(t, map[string]any{
		"caption": "hello",
		"tags":    []any{"one", "two"},
		"files":   []any{[]any{"request_file:media", "clip.bin", int64(11)}},
	}, taskRequest)

	form := httptest.NewRequest(http.MethodPost, "/vendor/uploads", strings.NewReader("caption=hello"))
	form.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, form)
	assert.Equal(t, http.StatusUnsupportedMediaType, recorder.Code, "submit routes still refuse url-encoded forms")

	// A route scoped to models reads the model from a JSON body.
	router.POST("/vendor/scoped", pinTaskPluginRoute(plugin, 1), PrepareTaskPluginRoute(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	scoped := httptest.NewRequest(http.MethodPost, "/vendor/scoped", bytes.NewReader(body.Bytes()))
	scoped.Header.Set("Content-Type", writer.FormDataContentType())
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, scoped)
	assert.Equal(t, http.StatusUnsupportedMediaType, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "this route requires a JSON body")
}

func TestPrepareTaskPluginRouteModelScope(t *testing.T) {
	pluginSource := `
export const meta = {
  apiVersion: 1, key: "route-model-scope-test", name: "Scoped", version: "1.0.0",
  author: {name: "Test"},
  models: ["gpt-5.5", "gpt-5.6"], fetchMode: "per_task",
  routes: [{method: "POST", path: "/vendor/batch", type: "submit", models: ["gpt-5.5"], decode: "decodeBatch", render: "batchCreated"}],
};
export const native = {
  decodeBatch: function(ctx) { return {kind: "submit", model: ctx.body.value.model, requestBody: ctx.body.value}; },
  batchCreated: function(ctx, task) { return task; },
};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`
	tests := []struct {
		name         string
		body         string
		wantStatus   int
		wantResolved bool
	}{
		{name: "listed model passes to decode", body: `{"model":"gpt-5.5","input":"x"}`, wantStatus: http.StatusNoContent, wantResolved: true},
		{name: "unlisted model rejected before JS", body: `{"model":"gpt-5.6","input":"x"}`, wantStatus: http.StatusBadRequest},
		{name: "missing model rejected before JS", body: `{"input":"x"}`, wantStatus: http.StatusBadRequest},
		{name: "non-string model rejected before JS", body: `{"model":7,"input":"x"}`, wantStatus: http.StatusBadRequest},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			decodeRan := false
			source := pluginSource
			if !testCase.wantResolved {
				// The core invariant: rejected requests never reach the JS engine.
				source = strings.Replace(source,
					`decodeBatch: function(ctx) { return {kind: "submit", model: ctx.body.value.model, requestBody: ctx.body.value}; },`,
					`decodeBatch: function() { throw new Error("decoder must not run"); },`, 1)
			}
			plugin := compileTaskRoutePlugin(t, source)
			router := gin.New()
			router.POST("/vendor/batch", pinTaskPluginRoute(plugin, 0), PrepareTaskPluginRoute(), func(c *gin.Context) {
				decodeRan = true
				assert.Equal(t, "gpt-5.5", c.GetString("resolved_task_model"))
				c.Status(http.StatusNoContent)
			})
			request := httptest.NewRequest(http.MethodPost, "/vendor/batch", strings.NewReader(testCase.body))
			request.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()

			router.ServeHTTP(recorder, request)

			assert.Equal(t, testCase.wantStatus, recorder.Code)
			assert.Equal(t, testCase.wantResolved, decodeRan)
		})
	}
}

func TestPrepareTaskPluginRouteRejectsResolvedModelOutsideRouteScope(t *testing.T) {
	plugin := compileTaskRoutePlugin(t, `
export const meta = {
  apiVersion: 1, key: "route-resolved-scope-test", name: "Scoped", version: "1.0.0",
  author: {name: "Test"},
  models: ["gpt-5.5", "gpt-5.6"], fetchMode: "per_task",
  routes: [{method: "POST", path: "/vendor/batch", type: "submit", models: ["gpt-5.5"], decode: "decodeBatch", render: "batchCreated"}],
};
export const native = {
  decodeBatch: function() { return {kind: "submit", model: "gpt-5.6", requestBody: {model: "gpt-5.6"}}; },
  batchCreated: function(ctx, task) { return task; },
};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`)
	reached := false
	router := gin.New()
	router.POST("/vendor/batch", pinTaskPluginRoute(plugin, 0), PrepareTaskPluginRoute(), func(c *gin.Context) {
		reached = true
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/vendor/batch", strings.NewReader(`{"model":"gpt-5.5"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.False(t, reached, "decode may run, but an out-of-scope resolved model must not continue into submit")
}

func TestPrepareTaskPluginRouteWithoutModelScopeIsUnrestricted(t *testing.T) {
	plugin := compileTaskRoutePlugin(t, `
export const meta = {
  apiVersion: 1, key: "route-unscoped-test", name: "Unscoped", version: "1.0.0",
  author: {name: "Test"},
  models: ["gpt-5.5", "gpt-5.6"], fetchMode: "per_task",
  routes: [{method: "POST", path: "/vendor/batch", type: "submit", decode: "decodeBatch", render: "batchCreated"}],
};
export const native = {
  decodeBatch: function(ctx) { return {kind: "submit", model: ctx.body.value.model, requestBody: ctx.body.value}; },
  batchCreated: function(ctx, task) { return task; },
};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`)
	router := gin.New()
	router.POST("/vendor/batch", pinTaskPluginRoute(plugin, 0), PrepareTaskPluginRoute(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/vendor/batch", strings.NewReader(`{"model":"gpt-5.6"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusNoContent, recorder.Code)
}

func TestBuildTaskPluginRouteRequestBodyUnion(t *testing.T) {
	tests := []struct {
		name        string
		contentType string
		body        string
		kind        jsplugin.BodyKind
		assertBody  func(*testing.T, map[string]any)
	}{
		{name: "none", kind: jsplugin.BodyNone},
		{name: "json", contentType: "application/problem+json; charset=utf-8", body: `{"model":"m"}`, kind: jsplugin.BodyJSON, assertBody: func(t *testing.T, body map[string]any) {
			assert.Equal(t, map[string]any{"model": "m"}, body["value"])
		}},
		{name: "form preserves repeated values", contentType: "application/x-www-form-urlencoded", body: "tag=one&tag=two", kind: jsplugin.BodyForm, assertBody: func(t *testing.T, body map[string]any) {
			assert.Equal(t, []string{"one", "two"}, body["fields"].(map[string][]string)["tag"])
		}},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/body", strings.NewReader(testCase.body))
			if testCase.contentType != "" {
				c.Request.Header.Set("Content-Type", testCase.contentType)
			}
			requestContext, err := buildTaskPluginRouteRequest(c)
			require.NoError(t, err)
			decodedBody := requestContext.Body.(map[string]any)
			assert.Equal(t, string(testCase.kind), decodedBody["kind"])
			if testCase.assertBody != nil {
				testCase.assertBody(t, decodedBody)
			}
		})
	}

	var multipartBody bytes.Buffer
	writer := multipart.NewWriter(&multipartBody)
	require.NoError(t, writer.WriteField("tag", "one"))
	require.NoError(t, writer.WriteField("tag", "two"))
	file, err := writer.CreateFormFile("input", "image.png")
	require.NoError(t, err)
	_, err = file.Write([]byte("file bytes stay in Go"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/body", bytes.NewReader(multipartBody.Bytes()))
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	requestContext, err := buildTaskPluginRouteRequest(c)
	require.NoError(t, err)
	decodedBody := requestContext.Body.(map[string]any)
	assert.Equal(t, string(jsplugin.BodyMultipart), decodedBody["kind"])
	assert.Equal(t, []string{"one", "two"}, decodedBody["fields"].(map[string][]string)["tag"])
	files := decodedBody["files"].([]map[string]any)
	require.Len(t, files, 1)
	assert.Equal(t, "image.png", files[0]["filename"])
	assert.NotContains(t, fmt.Sprint(files[0]), "file bytes stay in Go")
}

func TestBuildTaskPluginRouteRequestRejectsUnsafeBodies(t *testing.T) {
	tests := []struct {
		name        string
		contentType string
		body        []byte
		errorText   string
	}{
		{name: "invalid json UTF-8", contentType: "application/json", body: []byte{'{', '"', 'x', '"', ':', '"', 0xff, '"', '}'}, errorText: "valid UTF-8"},
		{name: "invalid form UTF-8", contentType: "application/x-www-form-urlencoded", body: []byte("x=%FF"), errorText: "valid UTF-8"},
		{name: "too many repeated form fields", contentType: "application/x-www-form-urlencoded", body: []byte(strings.Repeat("x=v&", maxTaskPluginFormFields) + "x=v"), errorText: "exceeds 256 fields"},
		{name: "missing multipart boundary", contentType: "multipart/form-data", body: []byte("body"), errorText: "boundary is required"},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/body", bytes.NewReader(testCase.body))
			c.Request.Header.Set("Content-Type", testCase.contentType)
			_, err := buildTaskPluginRouteRequest(c)
			require.ErrorContains(t, err, testCase.errorText)
		})
	}

	t.Run("conflicting Content-Type", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/body", strings.NewReader(`{}`))
		c.Request.Header["Content-Type"] = []string{"application/json", "application/x-www-form-urlencoded"}
		_, err := buildTaskPluginRouteRequest(c)
		require.ErrorContains(t, err, "conflicting Content-Type")
	})

	t.Run("oversized total body", func(t *testing.T) {
		previous := constant.MaxRequestBodyMB
		constant.MaxRequestBodyMB = 1
		t.Cleanup(func() { constant.MaxRequestBodyMB = previous })
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/body", strings.NewReader(strings.Repeat(" ", (1<<20)+1)))
		c.Request.Header.Set("Content-Type", "application/json")
		_, err := buildTaskPluginRouteRequest(c)
		require.ErrorContains(t, err, "request body exceeds 1 MB")
	})

	multipartCases := []struct {
		name      string
		build     func(*testing.T, *multipart.Writer)
		errorText string
	}{
		{name: "too many parts", build: func(t *testing.T, writer *multipart.Writer) {
			for i := 0; i <= maxTaskPluginMultipartParts; i++ {
				require.NoError(t, writer.WriteField("field", "value"))
			}
		}, errorText: "exceeds 256 parts"},
		{name: "too many files", build: func(t *testing.T, writer *multipart.Writer) {
			for i := 0; i <= maxTaskPluginFiles; i++ {
				_, err := writer.CreateFormFile("file", fmt.Sprintf("%d.bin", i))
				require.NoError(t, err)
			}
		}, errorText: "exceeds 32 files"},
		{name: "invalid UTF-8 field", build: func(t *testing.T, writer *multipart.Writer) {
			part, err := writer.CreateFormField("field")
			require.NoError(t, err)
			_, err = part.Write([]byte{0xff})
			require.NoError(t, err)
		}, errorText: "valid UTF-8"},
		{name: "nested multipart", build: func(t *testing.T, writer *multipart.Writer) {
			header := make(textproto.MIMEHeader)
			header.Set("Content-Disposition", `form-data; name="nested"`)
			header.Set("Content-Type", "multipart/mixed; boundary=inner")
			_, err := writer.CreatePart(header)
			require.NoError(t, err)
		}, errorText: "nested multipart"},
		{name: "invalid UTF-8 filename", build: func(t *testing.T, writer *multipart.Writer) {
			header := make(textproto.MIMEHeader)
			header.Set("Content-Disposition", "form-data; name=\"file\"; filename=\""+string([]byte{0xff})+"\"")
			_, err := writer.CreatePart(header)
			require.NoError(t, err)
		}, errorText: "invalid multipart"},
		{name: "injected disposition name", build: func(t *testing.T, writer *multipart.Writer) {
			header := make(textproto.MIMEHeader)
			header.Set("Content-Disposition", "form-data; name=\"prompt"+"\r\n"+"X-Injected: yes\"")
			part, err := writer.CreatePart(header)
			require.NoError(t, err)
			_, err = part.Write([]byte("hello"))
			require.NoError(t, err)
		}, errorText: "invalid multipart field name"},
		{name: "injected disposition filename", build: func(t *testing.T, writer *multipart.Writer) {
			header := make(textproto.MIMEHeader)
			header.Set("Content-Disposition", "form-data; name=\"file\"; filename=\"safe.png"+"\r\n"+"X-Injected: yes\"")
			part, err := writer.CreatePart(header)
			require.NoError(t, err)
			_, err = part.Write([]byte("file"))
			require.NoError(t, err)
		}, errorText: "invalid multipart"},
	}
	for _, testCase := range multipartCases {
		t.Run(testCase.name, func(t *testing.T) {
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			testCase.build(t, writer)
			require.NoError(t, writer.Close())
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/body", bytes.NewReader(body.Bytes()))
			c.Request.Header.Set("Content-Type", writer.FormDataContentType())
			_, err := buildTaskPluginRouteRequest(c)
			require.ErrorContains(t, err, testCase.errorText)
		})
	}

	t.Run("multipart fields are bounded by the request body limit only", func(t *testing.T) {
		previous := constant.MaxRequestBodyMB
		t.Cleanup(func() { constant.MaxRequestBodyMB = previous })
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		// A JSON request sent as a field, larger than the old 1 MiB field cap.
		require.NoError(t, writer.WriteField("request", strings.Repeat("a", 2<<20)))
		require.NoError(t, writer.Close())
		send := func(limitMB int) (map[string]any, error) {
			constant.MaxRequestBodyMB = limitMB
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/body", bytes.NewReader(body.Bytes()))
			c.Request.Header.Set("Content-Type", writer.FormDataContentType())
			request, err := buildTaskPluginRouteRequest(c)
			decoded, _ := request.Body.(map[string]any)
			return decoded, err
		}
		decoded, err := send(4)
		require.NoError(t, err)
		assert.Len(t, decoded["fields"].(map[string][]string)["request"][0], 2<<20)
		_, err = send(1)
		require.ErrorContains(t, err, "request body exceeds 1 MB")
	})

	t.Run("oversized multipart file", func(t *testing.T) {
		previous := constant.MaxFileDownloadMB
		constant.MaxFileDownloadMB = 1
		t.Cleanup(func() { constant.MaxFileDownloadMB = previous })
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		file, err := writer.CreateFormFile("file", "large.bin")
		require.NoError(t, err)
		_, err = file.Write(bytes.Repeat([]byte{'x'}, (1<<20)+1))
		require.NoError(t, err)
		require.NoError(t, writer.Close())
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/body", bytes.NewReader(body.Bytes()))
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())
		_, err = buildTaskPluginRouteRequest(c)
		require.ErrorContains(t, err, "multipart file exceeds 1 MB")
	})
}

func TestPrepareTaskPluginEndpointPinsGenerationBeforeParseAndDistribution(t *testing.T) {
	const key = "endpoint-pin-test"
	firstSource := taskProtocolPluginSource(
		key,
		"1.0.0",
		`["claimed-model"]`,
		"/v1/responses",
		`if (ctx.protocol !== "openai_responses" || ctx.operation !== "create" || ctx.model !== "claimed-model" || ctx.path !== "/v1/responses" || ctx.stream !== false) throw new Error("bad context");
		 if (ctx.query.trace[0] !== "one" || ctx.requestBody.prompt !== "hello") throw new Error("bad request");
		 ctx.requestBody.prompt = "plugin-local-mutation";
		 return {model: ctx.model, action: "first-action", requestBody: {prompt: "normalized"}};`,
	)
	first, err := jsplugin.DefaultRegistry.Register(firstSource, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(key)) })

	router := gin.New()
	reachedDistribution := false
	router.POST(
		"/v1/responses",
		PinTaskPluginEndpoint(),
		func(c *gin.Context) {
			_, updateErr := jsplugin.DefaultRegistry.Register(taskProtocolPluginSource(
				key,
				"2.0.0",
				`["claimed-model"]`,
				"/v1/responses",
				`return {model: ctx.model, action: "second-action"};`,
			), jsplugin.Options{})
			require.NoError(t, updateErr)
			c.Next()
		},
		PrepareTaskPluginEndpoint(),
		func(c *gin.Context) {
			reachedDistribution = true
			pinned := c.MustGet(jsplugin.ContextKeyPinnedEndpoint).(jsplugin.PinnedEndpoint)
			assert.Same(t, first, pinned.Plugin)
			assert.Equal(t, "claimed-model", pinned.Model)
			assert.Equal(t, "first-action", c.GetString("task_action"))
			assert.Equal(t, "claimed-model", c.GetString("resolved_task_model"))
			assert.Equal(t, key, c.GetString("expected_task_plugin_key"))
			assert.Equal(t, key, c.GetString("platform"))

			protocolRequest := c.MustGet(jsplugin.ContextKeyProtocolRequest).(jsplugin.ProtocolRequestContext)
			assert.Equal(t, map[string]any{"kind": "json", "value": map[string]any{"model": "claimed-model", "prompt": "hello"}}, protocolRequest.Body)
			assert.False(t, protocolRequest.Stream)
			routeRequest := c.MustGet(jsplugin.ContextKeyRouteRequest).(jsplugin.RouteRequestContext)
			assert.Equal(t, map[string]any{"prompt": "normalized"}, routeRequest.RequestBody)

			current, found := jsplugin.DefaultRegistry.Get(key)
			require.True(t, found)
			assert.NotSame(t, first, current)
			c.Status(http.StatusNoContent)
		},
	)
	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/responses?trace=one",
		strings.NewReader(`{"model":"claimed-model","prompt":"hello"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.True(t, reachedDistribution)
	assert.Equal(t, http.StatusNoContent, recorder.Code)
}

func TestPrepareTaskPluginEndpointClientDisconnectDoesNotCancelParseHook(t *testing.T) {
	const key = "endpoint-detached-parse-test"
	_, err := jsplugin.DefaultRegistry.Register(taskProtocolPluginSource(
		key,
		"1.0.0",
		`["claimed-model"]`,
		"/v1/responses",
		`return {model: "claimed-model"};`,
	), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(key)) })

	router := gin.New()
	reachedDistribution := false
	router.POST(
		"/v1/responses",
		PinTaskPluginEndpoint(),
		func(c *gin.Context) {
			requestContext, cancel := context.WithCancel(c.Request.Context())
			cancel()
			c.Request = c.Request.WithContext(requestContext)
			c.Next()
		},
		PrepareTaskPluginEndpoint(),
		func(c *gin.Context) {
			reachedDistribution = true
			assert.Equal(t, "claimed-model", c.GetString("resolved_task_model"))
			c.Status(http.StatusNoContent)
		},
	)
	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/responses",
		strings.NewReader(`{"model":"claimed-model"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.True(t, reachedDistribution)
	assert.Equal(t, http.StatusNoContent, recorder.Code)
}

func TestPrepareTaskPluginEndpointUsesStrictOriginalStreamFlag(t *testing.T) {
	const key = "endpoint-stream-test"
	_, err := jsplugin.DefaultRegistry.Register(taskProtocolPluginSource(
		key,
		"1.0.0",
		`["claimed-model"]`,
		"/v1/responses",
		`if (ctx.stream !== true) throw new Error("stream mode was not preserved");
		 return {model: "claimed-model", requestBody: {stream: false}};`,
	), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(key)) })

	router := gin.New()
	reachedDistribution := false
	router.POST(
		"/v1/responses",
		PinTaskPluginEndpoint(),
		PrepareTaskPluginEndpoint(),
		func(c *gin.Context) {
			reachedDistribution = true
			protocolRequest := c.MustGet(jsplugin.ContextKeyProtocolRequest).(jsplugin.ProtocolRequestContext)
			assert.True(t, protocolRequest.Stream)
			normalizedRequest := c.MustGet(jsplugin.ContextKeyRouteRequest).(jsplugin.RouteRequestContext)
			assert.Equal(t, map[string]any{"stream": false}, normalizedRequest.RequestBody)
			c.Status(http.StatusNoContent)
		},
	)
	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/responses",
		strings.NewReader(`{"model":"claimed-model","stream":true}`),
	)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.True(t, reachedDistribution)
	assert.Equal(t, http.StatusNoContent, recorder.Code)

	for _, invalid := range []string{`null`, `"true"`, `1`, `"yes"`} {
		request = httptest.NewRequest(
			http.MethodPost,
			"/v1/responses",
			strings.NewReader(`{"model":"claimed-model","stream":`+invalid+`}`),
		)
		request.Header.Set("Content-Type", "application/json")
		recorder = httptest.NewRecorder()
		router.ServeHTTP(recorder, request)
		assert.Equal(t, http.StatusBadRequest, recorder.Code)
	}
}

func TestTaskPluginEndpointMissPreservesOrdinaryRequestBody(t *testing.T) {
	const key = "endpoint-miss-test"
	_, err := jsplugin.DefaultRegistry.Register(taskProtocolPluginSource(
		key,
		"1.0.0",
		`["claimed-model"]`,
		"/v1/responses",
		`return {model: "claimed-model"};`,
	), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(key)) })

	router := gin.New()
	router.POST(
		"/v1/responses",
		PinTaskPluginEndpoint(),
		PrepareTaskPluginEndpoint(),
		func(c *gin.Context) {
			_, pinned := c.Get(jsplugin.ContextKeyPinnedEndpoint)
			assert.False(t, pinned)
			storage, storageErr := common.GetBodyStorage(c)
			require.NoError(t, storageErr)
			raw, bytesErr := storage.Bytes()
			require.NoError(t, bytesErr)
			assert.Equal(t, []byte(`{"model":"ordinary-model","input":"hello"}`), raw)
			c.Status(http.StatusNoContent)
		},
	)
	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/responses",
		strings.NewReader(`{"model":"ordinary-model","input":"hello"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusNoContent, recorder.Code)
}

func TestTaskPluginEndpointUsesOneCanonicalModelForDuplicateJSONKeys(t *testing.T) {
	require.NoError(t, appI18n.Init())
	const key = "endpoint-duplicate-model-test"
	_, err := jsplugin.DefaultRegistry.Register(taskProtocolPluginSource(
		key,
		"1.0.0",
		`["claimed-model"]`,
		"/v1/responses",
		`if (ctx.requestBody.model !== "claimed-model") throw new Error("noncanonical model");
		 return {model: ctx.requestBody.model};`,
	), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(key)) })

	tests := []struct {
		name string
		body string
	}{
		{
			name: "claimed model first",
			body: `{"model":"claimed-model","model":"ordinary-model"}`,
		},
		{
			name: "claimed model second",
			body: `{"model":"ordinary-model","model":"claimed-model"}`,
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			reachedDownstream := false
			router := gin.New()
			router.POST(
				"/v1/responses",
				PinTaskPluginEndpoint(),
				PrepareTaskPluginEndpoint(),
				func(c *gin.Context) {
					reachedDownstream = true
					c.Status(http.StatusNoContent)
				},
			)
			request := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(testCase.body))
			request.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()

			router.ServeHTTP(recorder, request)

			assert.False(t, reachedDownstream)
			assert.Equal(t, http.StatusBadRequest, recorder.Code)
		})
	}
}

func TestRequestBodyFailuresReportTheirCause(t *testing.T) {
	require.NoError(t, appI18n.Init())
	require.NotNil(t, jsplugin.DefaultRegistry.Generation(), "the built-in plugins keep a routing generation, as in production")
	_, err := jsplugin.DefaultRegistry.Register(genericTaskPluginSource, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { jsplugin.DefaultRegistry.Unregister("generic-entry-test") })
	routePlugin := compileTaskRoutePlugin(t, genericTaskPluginSource)
	previous := constant.MaxRequestBodyMB
	constant.MaxRequestBodyMB = 1
	t.Cleanup(func() { constant.MaxRequestBodyMB = previous })

	reached := func(c *gin.Context) { c.Status(http.StatusNoContent) }
	router := gin.New()
	router.POST("/v1/responses", PinTaskPluginEndpoint(), PrepareTaskPluginEndpoint(), Distribute(), reached)
	router.POST("/v1/video/generations", PinTaskPluginEndpoint(), PrepareTaskPluginEndpoint(), Distribute(), reached)
	router.POST("/v1/chat/completions", Distribute(), reached)
	router.POST("/mj/submit/imagine", Distribute(), reached)
	router.POST("/v1/tasks/:key", PrepareTaskPluginSubmit(), reached)
	router.POST("/vendor/jobs", func(c *gin.Context) {
		c.Set(jsplugin.ContextKeyPinnedRoute, jsplugin.PinnedRoute{Plugin: routePlugin})
	}, PrepareTaskPluginRoute(), reached)
	oversized := `{"model":"gpt-x","prompt":"` + strings.Repeat("a", 1<<20) + `"}`
	tests := []struct {
		name    string
		path    string
		body    io.Reader
		status  int
		message string
	}{
		{
			name:    "oversized body on a plugin protocol path",
			path:    "/v1/responses",
			body:    strings.NewReader(oversized),
			status:  http.StatusRequestEntityTooLarge,
			message: "Invalid request: request body exceeds 1 MB: request body too large",
		},
		{
			name:    "body cut off on a plugin protocol path",
			path:    "/v1/responses",
			body:    io.MultiReader(strings.NewReader(`{"model":"gpt-x","input":"`), iotest.ErrReader(io.ErrUnexpectedEOF)),
			status:  http.StatusBadRequest,
			message: "Invalid request: unexpected EOF",
		},
		{
			// The endpoint check lets this path through and the distributor reads the body again.
			name:    "oversized body on the legacy video path",
			path:    "/v1/video/generations",
			body:    strings.NewReader(oversized),
			status:  http.StatusRequestEntityTooLarge,
			message: "Invalid request: request body exceeds 1 MB: request body too large",
		},
		{
			name:    "oversized Midjourney body",
			path:    "/mj/submit/imagine",
			body:    strings.NewReader(oversized),
			status:  http.StatusRequestEntityTooLarge,
			message: "Invalid request: request body exceeds 1 MB: request body too large",
		},
		{
			name:    "oversized task plugin submission",
			path:    "/v1/tasks/generic-entry-test",
			body:    strings.NewReader(oversized),
			status:  http.StatusRequestEntityTooLarge,
			message: "request body exceeds 1 MB: request body too large",
		},
		{
			name:    "oversized plugin route body",
			path:    "/vendor/jobs",
			body:    strings.NewReader(oversized),
			status:  http.StatusRequestEntityTooLarge,
			message: "request body exceeds 1 MB: request body too large",
		},
		{
			name:    "invalid JSON on an ordinary path",
			path:    "/v1/chat/completions",
			body:    strings.NewReader(`{"model":"gpt-x",`),
			status:  http.StatusBadRequest,
			message: "Invalid request: invalid JSON request body",
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, testCase.path, testCase.body)
			request.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()

			router.ServeHTTP(recorder, request)

			assert.Equal(t, testCase.status, recorder.Code)
			assert.Contains(t, recorder.Body.String(), `"message":"`+testCase.message)
		})
	}
}

func TestTaskPluginEndpointOnlyPreservesConditionalMiddlewareSemantics(t *testing.T) {
	tests := []struct {
		name               string
		claimed            bool
		wrappedAborts      bool
		expectedWrapped    int
		expectedDownstream bool
		expectedStatus     int
	}{
		{
			name:               "unclaimed skips wrapper",
			expectedDownstream: true,
			expectedStatus:     http.StatusNoContent,
		},
		{
			name:               "claimed invokes wrapper",
			claimed:            true,
			expectedWrapped:    1,
			expectedDownstream: true,
			expectedStatus:     http.StatusNoContent,
		},
		{
			name:            "claimed wrapper aborts",
			claimed:         true,
			wrappedAborts:   true,
			expectedWrapped: 1,
			expectedStatus:  http.StatusTooManyRequests,
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			wrappedCalls := 0
			reachedDownstream := false
			router := gin.New()
			router.POST(
				"/v1/videos",
				func(c *gin.Context) {
					if testCase.claimed {
						c.Set(jsplugin.ContextKeyPinnedEndpoint, jsplugin.PinnedEndpoint{})
					}
					c.Next()
				},
				TaskPluginEndpointOnly(func(c *gin.Context) {
					wrappedCalls++
					if testCase.wrappedAborts {
						c.AbortWithStatus(http.StatusTooManyRequests)
						return
					}
					c.Next()
				}),
				func(c *gin.Context) {
					reachedDownstream = true
					c.Status(http.StatusNoContent)
				},
			)
			recorder := httptest.NewRecorder()

			router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/v1/videos", nil))

			assert.Equal(t, testCase.expectedWrapped, wrappedCalls)
			assert.Equal(t, testCase.expectedDownstream, reachedDownstream)
			assert.Equal(t, testCase.expectedStatus, recorder.Code)
		})
	}
}

func TestPrepareTaskPluginEndpointRejectsModelDriftBeforeDistribution(t *testing.T) {
	const key = "endpoint-drift-test"
	_, err := jsplugin.DefaultRegistry.Register(taskProtocolPluginSource(
		key,
		"1.0.0",
		`["claimed-model"]`,
		"/v1/responses",
		`return {model: "outside-model"};`,
	), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(key)) })

	reachedDistribution := false
	router := gin.New()
	router.POST(
		"/v1/responses",
		PinTaskPluginEndpoint(),
		PrepareTaskPluginEndpoint(),
		func(c *gin.Context) {
			reachedDistribution = true
			c.Status(http.StatusNoContent)
		},
	)
	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/responses",
		strings.NewReader(`{"model":"claimed-model"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.False(t, reachedDistribution)
	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	var payload map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	errObj, _ := payload["error"].(map[string]any)
	require.NotNil(t, errObj)
	assert.Contains(t, fmt.Sprint(errObj["message"]), `model "outside-model" is not served by this plugin`)
}

func TestPrepareTaskPluginEndpointAcceptsRegisteredVideoMultipartBody(t *testing.T) {
	const key = "endpoint-multipart-test"
	_, err := jsplugin.DefaultRegistry.Register(taskProtocolPluginSource(
		key,
		"1.0.0",
		`["video-model"]`,
		"/v1/videos",
		`if (ctx.body.kind !== "multipart" || ctx.body.fields.prompt[0] !== "hello") throw new Error("bad prompt");
		 if (ctx.body.files.length !== 1 || ctx.body.files[0].field !== "input_reference") throw new Error("bad file ref");
		 return {model: ctx.model, requestBody: {prompt: ctx.body.fields.prompt[0]}};`,
	), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(key)) })

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "video-model"))
	require.NoError(t, writer.WriteField("prompt", "hello"))
	file, err := writer.CreateFormFile("input_reference", "reference.bin")
	require.NoError(t, err)
	_, err = file.Write([]byte("opaque-video-reference"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	router := gin.New()
	reachedDistribution := false
	router.POST(
		"/v1/videos",
		PinTaskPluginEndpoint(),
		PrepareTaskPluginEndpoint(),
		func(c *gin.Context) {
			reachedDistribution = true
			c.Status(http.StatusNoContent)
		},
	)
	request := httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewReader(body.Bytes()))
	request.Header.Set("Content-Type", writer.FormDataContentType())
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.True(t, reachedDistribution)
	assert.Equal(t, http.StatusNoContent, recorder.Code)
}

// The OpenAI Images edits endpoint accepts multipart uploads. Every file of a
// repeated image[] field is exposed to the decoder with its own ref, and an
// unclaimed model on the shared endpoint still reaches the ordinary relay.
func TestPrepareTaskPluginEndpointExposesIndexedRefsForRepeatedImageFiles(t *testing.T) {
	const key = "endpoint-image-edits-test"
	_, err := jsplugin.DefaultRegistry.Register(taskProtocolPluginSource(
		key,
		"1.0.0",
		`["image-edit-model"]`,
		"/v1/images/edits",
		`if (ctx.body.kind !== "multipart" || ctx.body.fields.prompt[0] !== "watercolor") throw new Error("bad prompt");
		 return {model: ctx.model, action: "image_to_image", requestBody: {prompt: ctx.body.fields.prompt[0], refs: ctx.body.files.map(function(file) { return file.ref; })}};`,
	), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(key)) })

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "image-edit-model"))
	require.NoError(t, writer.WriteField("prompt", "watercolor"))
	for _, name := range []string{"first.png", "second.png"} {
		file, createErr := writer.CreateFormFile("image[]", name)
		require.NoError(t, createErr)
		_, err = file.Write([]byte(name))
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())

	router := gin.New()
	var pinnedProtocol string
	var taskRequest any
	router.POST("/v1/images/edits", PinTaskPluginEndpoint(), PrepareTaskPluginEndpoint(), func(c *gin.Context) {
		if pinned, ok := c.MustGet(jsplugin.ContextKeyPinnedEndpoint).(jsplugin.PinnedEndpoint); ok {
			pinnedProtocol = pinned.Protocol
		}
		taskRequest, _ = c.Get("task_request")
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(body.Bytes()))
	request.Header.Set("Content-Type", writer.FormDataContentType())
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusNoContent, recorder.Code, recorder.Body.String())
	assert.Equal(t, jsplugin.ProtocolOpenAIImage, pinnedProtocol)
	decoded, ok := taskRequest.(map[string]any)
	require.True(t, ok)
	assert.Equal(t, []any{"request_file:image[]", "request_file:image[]#1"}, decoded["refs"])

	unclaimed := gin.New()
	reachedRelay := false
	unclaimed.POST("/v1/images/generations", PinTaskPluginEndpoint(), PrepareTaskPluginEndpoint(), func(c *gin.Context) {
		_, pinned := c.Get(jsplugin.ContextKeyPinnedEndpoint)
		reachedRelay = !pinned
		c.Status(http.StatusNoContent)
	})
	plain := httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(`{"model":"dall-e-3","prompt":"a cat"}`))
	plain.Header.Set("Content-Type", "application/json")
	recorder = httptest.NewRecorder()
	unclaimed.ServeHTTP(recorder, plain)
	assert.Equal(t, http.StatusNoContent, recorder.Code)
	assert.True(t, reachedRelay, "an unclaimed image model keeps the built-in relay")
}

func TestVideoGenerationsIsNotClaimedByOpenAIVideoProtocol(t *testing.T) {
	const key = "endpoint-video-gen-test"
	_, err := jsplugin.DefaultRegistry.Register(taskProtocolPluginSource(
		key,
		"1.0.0",
		`["generation-model"]`,
		"/v1/video/generations",
		`return {model: ctx.requestBody.model, action: "generate"};`,
	), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(key)) })

	router := gin.New()
	reachedDistribution := false
	router.POST(
		"/v1/video/generations",
		PinTaskPluginEndpoint(),
		PrepareTaskPluginEndpoint(),
		func(c *gin.Context) {
			reachedDistribution = true
			c.Status(http.StatusNoContent)
		},
	)
	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/video/generations",
		strings.NewReader(`{"model":"generation-model"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.True(t, reachedDistribution)
	assert.Equal(t, http.StatusNoContent, recorder.Code)
}

func TestPrepareTaskPluginRouteKeepsRawBinaryOpaque(t *testing.T) {
	plugin := compileTaskRoutePlugin(t, `
export const meta = {
  apiVersion: 1, key: "route-binary-test", name: "Binary", version: "1.0.0",
  author: {name: "Test"},
  models: ["binary-model"], fetchMode: "per_task",
  routes: [{method: "POST", path: "/vendor/binary", type: "submit", decode: "decodeBinary", render: "created"}],
};
export const native = {decodeBinary: function() { throw new Error("decoder must not run"); }, created: function(ctx, task) { return task; }};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`)
	router := gin.New()
	router.POST("/vendor/binary", pinTaskPluginRoute(plugin, 0), PrepareTaskPluginRoute(), func(c *gin.Context) {
		body, err := io.ReadAll(c.Request.Body)
		require.NoError(t, err)
		assert.Equal(t, []byte{0, 1, 2, 3}, body)
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/vendor/binary", bytes.NewReader([]byte{0, 1, 2, 3}))
	request.Header.Set("Content-Type", "application/octet-stream")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusUnsupportedMediaType, recorder.Code)
}

func TestPrepareTaskPluginDynamicQueryPreservesOrderAndSkipsNextHandlers(t *testing.T) {
	setupTaskPluginRouteDB(t)
	plugin := compileTaskRoutePlugin(t, `
export const meta = {
  apiVersion: 1, key: "route-query-test", name: "Query", version: "1.0.0",
  author: {name: "Test"},
  models: ["query-model"], fetchMode: "per_task",
  routes: [{method: "POST", path: "/vendor/query", type: "dynamic", decode: "decodeQuery", render: "renderQuery"}],
};
export const native = {
  decodeQuery: function() { return {kind: "query", taskIds: ["task-b", "task-a", "task-b"]}; },
  renderQuery: function(ctx, tasks) {
    return {ids: tasks.map(function(task) { return task.task_id; }), keys: Object.keys(tasks[0]).sort(), data: tasks[0].data};
  },
};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`)
	insertTaskPluginRouteTask(t, &model.Task{
		TaskID: "task-a", UserId: 7, Platform: constant.TaskPlatform("route-query-test"),
		Status: model.TaskStatusSuccess, Progress: "100%", CreatedAt: 10,
	})
	taskData, err := common.Marshal(map[string]any{
		"task_id": "private-upstream-id",
		"nested":  map[string]any{"url": "https://upstream.invalid/tasks/private-upstream-id"},
	})
	require.NoError(t, err)
	insertTaskPluginRouteTask(t, &model.Task{
		TaskID: "task-b", UserId: 7, Platform: constant.TaskPlatform("route-query-test"),
		Status: model.TaskStatusInProgress, Progress: "50%", CreatedAt: 20, Data: taskData,
		ChannelId: 999, Quota: 12345, PrivateData: model.TaskPrivateData{UpstreamTaskID: "private-upstream-id", Key: "secret"},
	})

	nextHandlerCalled := false
	router := gin.New()
	router.POST("/vendor/query",
		pinTaskPluginRoute(plugin, 0),
		func(c *gin.Context) {
			c.Set("id", 7)
			c.Next()
		},
		PrepareTaskPluginRoute(),
		func(c *gin.Context) {
			nextHandlerCalled = true
			c.Status(http.StatusTeapot)
		},
	)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/vendor/query", strings.NewReader(`{}`))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.False(t, nextHandlerCalled)
	var response map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Equal(t, []any{"task-b", "task-a", "task-b"}, response["ids"])
	data, ok := response["data"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "task-b", data["task_id"])
	nested, ok := data["nested"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "https://upstream.invalid/tasks/private-upstream-id", nested["url"])
	keys, ok := response["keys"].([]any)
	require.True(t, ok)
	assert.NotContains(t, keys, "user_id")
	assert.NotContains(t, keys, "channel_id")
	assert.NotContains(t, keys, "quota")
	assert.NotContains(t, keys, "private_data")
	assert.NotContains(t, recorder.Body.String(), "secret")
}

func TestPrepareTaskPluginDynamicDecoderRejectsRendererField(t *testing.T) {
	plugin := compileTaskRoutePlugin(t, `
export const meta = {apiVersion:1,key:"dynamic-renderer",name:"Dynamic",version:"1.0.0",author:{name:"Test"},models:["model"],fetchMode:"per_task",routes:[{method:"POST",path:"/vendor/query",type:"dynamic",decode:"decode",render:"show"}]};
export const native = {decode:function(){return {kind:"query",taskIds:[],renderer:"legacy"};},show:function(){return {};}};
export function buildSubmitRequest(){return {}} export function parseSubmitResponse(){return {taskId:"one"}} export function buildQueryRequest(){return {}} export function parseTaskResult(){return {status:"SUCCESS"}}
`)
	router := gin.New()
	reached := false
	router.POST("/vendor/query", pinTaskPluginRoute(plugin, 0), PrepareTaskPluginRoute(), func(c *gin.Context) { reached = true })
	request := httptest.NewRequest(http.MethodPost, "/vendor/query", strings.NewReader(`{}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.False(t, reached)
	assert.Equal(t, http.StatusBadRequest, recorder.Code)
}

func TestPrepareTaskPluginSubmitDecoderRejectsRendererField(t *testing.T) {
	plugin := compileTaskRoutePlugin(t, `
export const meta = {apiVersion:1,key:"submit-renderer",name:"Submit",version:"1.0.0",author:{name:"Test"},models:["model"],fetchMode:"per_task",routes:[{method:"POST",path:"/vendor/submit",type:"submit",decode:"decode",render:"created"}]};
export const native = {decode:function(){return {kind:"submit",model:"model",requestBody:{},renderer:"legacy"};},created:function(){return {};}};
export function buildSubmitRequest(){return {}} export function parseSubmitResponse(){return {taskId:"one"}} export function buildQueryRequest(){return {}} export function parseTaskResult(){return {status:"SUCCESS"}}
`)
	router := gin.New()
	reached := false
	router.POST("/vendor/submit", pinTaskPluginRoute(plugin, 0), PrepareTaskPluginRoute(), func(c *gin.Context) { reached = true })
	request := httptest.NewRequest(http.MethodPost, "/vendor/submit", strings.NewReader(`{}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.False(t, reached)
	assert.Equal(t, http.StatusBadRequest, recorder.Code)
}

func TestPrepareTaskPluginStaticQueryHidesTaskExistenceAndSanitizesErrors(t *testing.T) {
	setupTaskPluginRouteDB(t)
	plugin := compileTaskRoutePlugin(t, `
export const meta = {
  apiVersion: 1, key: "route-static-query-test", name: "Static Query", version: "1.0.0",
  author: {name: "Test"},
  channelTypes: [651], models: ["query-model"], fetchMode: "per_task",
  routes: [{method: "GET", path: "/vendor/jobs/:id", type: "query", taskIdParam: "id", render: "status"}],
};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
export const native = {status: function(ctx, task) { return {id: task.task_id}; }, error: function(ctx, error) {
	return {vendor_error: {code: error.code, message: error.message, status: error.httpStatus, retryable: error.retryable}};
}};
`)
	insertTaskPluginRouteTask(t, &model.Task{
		TaskID: "foreign-task", UserId: 8, Platform: constant.TaskPlatform("route-static-query-test"),
	})
	insertTaskPluginRouteTask(t, &model.Task{
		TaskID: "wrong-platform", UserId: 7, Platform: constant.TaskPlatform("another-plugin"),
	})
	insertTaskPluginRouteTask(t, &model.Task{
		TaskID: "wrong-legacy-platform", UserId: 7, Platform: constant.TaskPlatform("652"),
	})
	insertTaskPluginRouteTask(t, &model.Task{
		TaskID: "legacy-task", UserId: 7, Platform: constant.TaskPlatform("651"),
	})
	// Submitted through a route with retainResult: false; owned by the caller
	// but not retrievable, so it must be indistinguishable from a missing task.
	insertTaskPluginRouteTask(t, &model.Task{
		TaskID: "discarded-task", UserId: 7, Platform: constant.TaskPlatform("route-static-query-test"),
		Status: model.TaskStatusSuccess, PrivateData: model.TaskPrivateData{ResultDiscarded: true},
	})

	router := gin.New()
	router.GET("/vendor/jobs/:id",
		pinTaskPluginRoute(plugin, 0),
		func(c *gin.Context) {
			c.Set("id", 7)
			c.Next()
		},
		PrepareTaskPluginRoute(),
	)

	legacyRecorder := httptest.NewRecorder()
	router.ServeHTTP(legacyRecorder, httptest.NewRequest(http.MethodGet, "/vendor/jobs/legacy-task", nil))
	assert.Equal(t, http.StatusOK, legacyRecorder.Code)
	assert.JSONEq(t, `{"id":"legacy-task"}`, legacyRecorder.Body.String())

	var firstBody string
	for _, taskID := range []string{"missing-task", "foreign-task", "wrong-platform", "wrong-legacy-platform", "discarded-task"} {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/vendor/jobs/"+taskID, nil))
		assert.Equal(t, http.StatusNotFound, recorder.Code)
		if firstBody == "" {
			firstBody = recorder.Body.String()
		} else {
			assert.JSONEq(t, firstBody, recorder.Body.String())
		}
		assert.Contains(t, recorder.Body.String(), `"code":"task_not_found"`)
		assert.NotContains(t, recorder.Body.String(), taskID)
	}
}

func TestRespondTaskPluginErrorNeverExposesInternalDetails(t *testing.T) {
	plugin := compileTaskRoutePlugin(t, `
export const meta = {
  apiVersion: 1, key: "route-error-test", name: "Error", version: "1.0.0",
  author: {name: "Test"},
  models: ["error-model"], fetchMode: "per_task",
};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
export const native = {error: function(ctx, error) {
	return {path: ctx.path, code: error.code, message: error.message, status: error.httpStatus, retryable: error.retryable, keys: Object.keys(error).sort()};
}};
`)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/vendor/failure", strings.NewReader(`{"credential":"do-not-copy"}`))
	c.Set(jsplugin.ContextKeyPinnedRoute, jsplugin.PinnedRoute{Plugin: plugin})
	c.Set(jsplugin.ContextKeyRouteRequest, jsplugin.RouteRequestContext{
		Path: "/vendor/failure", Method: http.MethodPost, Params: map[string]string{}, Query: map[string][]string{},
	})

	handled := RespondTaskPluginError(c, &dto.TaskError{
		Code:       "upstream_credential_failure",
		Message:    "https://user:password@upstream.invalid?token=secret",
		Data:       map[string]any{"authorization": "Bearer secret"},
		StatusCode: http.StatusBadGateway,
		Error:      assert.AnError,
	})

	assert.True(t, handled)
	assert.Equal(t, http.StatusBadGateway, recorder.Code)
	assert.JSONEq(t, `{
	  "path": "/vendor/failure",
	  "code": "server_error",
	  "message": "Task request failed",
	  "status": 502,
	  "retryable": true,
	  "keys": ["code", "httpStatus", "message", "requestId", "retryable"]
	}`, recorder.Body.String())
	assert.NotContains(t, recorder.Body.String(), "upstream.invalid")
	assert.NotContains(t, recorder.Body.String(), "secret")
	assert.NotContains(t, recorder.Body.String(), "password")
}

func TestTaskPluginErrorFallbackIsSanitized(t *testing.T) {
	for _, testCase := range []struct {
		name       string
		renderHook string
	}{
		{name: "missing hook"},
		{name: "throwing hook", renderHook: `export const native = {error: function() { throw new Error("renderer secret"); }};`},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			plugin := compileTaskRoutePlugin(t, genericTaskPluginSource+"\n"+testCase.renderHook)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/vendor/failure", nil)
			c.Set(common.RequestIdKey, "fallback-req")
			c.Set(jsplugin.ContextKeyPinnedRoute, jsplugin.PinnedRoute{Plugin: plugin})
			c.Set(jsplugin.ContextKeyRouteRequest, jsplugin.RouteRequestContext{
				Path: "/vendor/failure", Method: http.MethodPost,
				Params: map[string]string{}, Query: map[string][]string{},
			})

			abortWithOpenAiMessage(c, http.StatusBadGateway, "https://user:password@upstream.invalid?token=secret")

			assert.Equal(t, http.StatusBadGateway, recorder.Code)
			assert.JSONEq(t, `{"code":"server_error","message":"Task request failed (request id: fallback-req)","data":null}`, recorder.Body.String())
			assert.NotContains(t, recorder.Body.String(), "upstream.invalid")
			assert.NotContains(t, recorder.Body.String(), "renderer secret")
			assert.NotContains(t, recorder.Body.String(), "password")
		})
	}
}

func TestResolvedTaskPluginIDsEnforcesPublicQueryContract(t *testing.T) {
	valid, ok := resolvedTaskPluginIDs([]any{"task-a", "task-b", "task-a"})
	require.True(t, ok)
	assert.Equal(t, []string{"task-a", "task-b", "task-a"}, valid)

	empty, ok := resolvedTaskPluginIDs([]any{})
	require.True(t, ok)
	assert.Empty(t, empty)

	tooMany := make([]any, 101)
	for index := range tooMany {
		tooMany[index] = "task"
	}
	for _, invalid := range []any{
		[]any{"task-a", ""},
		[]any{"task-a", "   "},
		[]any{"task-a", 2},
		tooMany,
		"task-a",
	} {
		_, ok = resolvedTaskPluginIDs(invalid)
		assert.False(t, ok)
	}
}

func TestSunoFetchEmptyIDsReturnsSuccessfulEmptyArray(t *testing.T) {
	source, err := builtinplugins.Source("sunoapi")
	require.NoError(t, err)
	plugin := compileTaskRoutePlugin(t, source)

	nextHandlerCalled := false
	router := gin.New()
	router.POST(
		"/suno/fetch",
		pinTaskPluginRoute(plugin, 1),
		PrepareTaskPluginRoute(),
		func(c *gin.Context) {
			nextHandlerCalled = true
			c.Status(http.StatusTeapot)
		},
	)
	request := httptest.NewRequest(http.MethodPost, "/suno/fetch", strings.NewReader(`{"ids":[]}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.False(t, nextHandlerCalled)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.JSONEq(t, `{"code":"success","message":"","data":[]}`, recorder.Body.String())
}

func TestPrepareTaskPluginRouteSurfacesDecodeHookMessage(t *testing.T) {
	plugin := compileTaskRoutePlugin(t, `
export const meta = {
  apiVersion: 1, key: "route-decode-detail-test", name: "Decode", version: "1.0.0",
  author: {name: "Test"},
  models: ["detail-model"], fetchMode: "per_task",
  routes: [{method: "POST", path: "/vendor/jobs", type: "submit", decode: "createTask", render: "created"}],
};
export const native = {createTask: function() { throw new Error("model is required"); }, created: function(ctx, task) { return task; }};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`)
	router := gin.New()
	router.POST("/vendor/jobs", pinTaskPluginRoute(plugin, 0), PrepareTaskPluginRoute(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/vendor/jobs", strings.NewReader(`{"prompt":"x"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	var body dto.TaskError
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body))
	assert.Equal(t, "invalid_request", body.Code)
	assert.Equal(t, "model is required", body.Message)
}

func TestPrepareTaskPluginRouteNativeErrorReceivesHookMessage(t *testing.T) {
	plugin := compileTaskRoutePlugin(t, `
export const meta = {
  apiVersion: 1, key: "route-error-detail-test", name: "Error", version: "1.0.0",
  author: {name: "Test"},
  models: ["detail-model"], fetchMode: "per_task",
  routes: [{method: "POST", path: "/vendor/jobs", type: "submit", decode: "createTask", render: "created"}],
};
export const native = {
  createTask: function() { throw new Error("model is required"); },
  created: function(ctx, task) { return task; },
  error: function(ctx, error) { return {code: error.code, message: error.message, requestId: error.requestId}; },
};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(common.RequestIdKey, "native-error-req")
		c.Next()
	})
	router.POST("/vendor/jobs", pinTaskPluginRoute(plugin, 0), PrepareTaskPluginRoute(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/vendor/jobs", strings.NewReader(`{"prompt":"x"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.JSONEq(t, `{"code":"invalid_request","message":"model is required","requestId":"native-error-req"}`, recorder.Body.String())
}

func TestPrepareTaskPluginRouteRejectsNonObjectResultWithFixedMessage(t *testing.T) {
	plugin := compileTaskRoutePlugin(t, `
export const meta = {
  apiVersion: 1, key: "route-result-object-test", name: "Result", version: "1.0.0",
  author: {name: "Test"},
  models: ["detail-model"], fetchMode: "per_task",
  routes: [{method: "POST", path: "/vendor/jobs", type: "submit", decode: "createTask", render: "created"}],
};
export const native = {createTask: function() { return "not-an-object"; }, created: function(ctx, task) { return task; }};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`)
	router := gin.New()
	router.POST("/vendor/jobs", pinTaskPluginRoute(plugin, 0), PrepareTaskPluginRoute(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/vendor/jobs", strings.NewReader(`{"model":"detail-model"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	var body dto.TaskError
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body))
	assert.Equal(t, "invalid_request", body.Code)
	assert.Equal(t, "plugin returned an invalid route result", body.Message)
}

func TestPrepareTaskPluginRouteSurfacesRequestDecodeDetail(t *testing.T) {
	plugin := compileTaskRoutePlugin(t, `
export const meta = {
  apiVersion: 1, key: "route-decode-body-test", name: "Decode", version: "1.0.0",
  author: {name: "Test"},
  models: ["detail-model"], fetchMode: "per_task",
  routes: [{method: "POST", path: "/vendor/jobs", type: "submit", decode: "createTask", render: "created"}],
};
export const native = {createTask: function() { throw new Error("decoder must not run"); }, created: function(ctx, task) { return task; }};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`)
	router := gin.New()
	router.POST("/vendor/jobs", pinTaskPluginRoute(plugin, 0), PrepareTaskPluginRoute(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/vendor/jobs", strings.NewReader(`{}`))
	request.Header["Content-Type"] = []string{"application/json", "application/x-www-form-urlencoded"}
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	var body dto.TaskError
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body))
	assert.Equal(t, "invalid_request", body.Code)
	assert.Contains(t, body.Message, "conflicting Content-Type")
}

func TestSanitizedTaskPluginErrorIgnoresDetailOn5xx(t *testing.T) {
	got := sanitizedTaskPluginError(http.StatusInternalServerError, "database secret")
	assert.Equal(t, "server_error", got.Code)
	assert.Equal(t, "Task request failed", got.Message)
	assert.Equal(t, http.StatusInternalServerError, got.HTTPStatus)

	got = sanitizedTaskPluginError(http.StatusBadGateway, "https://user:password@upstream.invalid")
	assert.Equal(t, "server_error", got.Code)
	assert.Equal(t, "Task request failed", got.Message)
}

func TestTaskPluginErrorFallbackMessageIncludesRequestID(t *testing.T) {
	plugin := compileTaskRoutePlugin(t, genericTaskPluginSource)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/vendor/failure", nil)
	c.Set(common.RequestIdKey, "req-fallback-1")
	c.Set(jsplugin.ContextKeyPinnedRoute, jsplugin.PinnedRoute{Plugin: plugin})
	c.Set(jsplugin.ContextKeyRouteRequest, jsplugin.RouteRequestContext{
		Path: "/vendor/failure", Method: http.MethodPost,
		Params: map[string]string{}, Query: map[string][]string{},
	})

	abortTaskPluginRouteErrorDetail(c, http.StatusBadRequest, "model is required")

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	var body dto.TaskError
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body))
	assert.Equal(t, "invalid_request", body.Code)
	assert.Equal(t, "model is required (request id: req-fallback-1)", body.Message)
	assert.True(t, strings.HasSuffix(body.Message, "(request id: req-fallback-1)"))
}

func TestPrepareTaskPluginEndpointSurfacesDecodeHookMessage(t *testing.T) {
	const key = "endpoint-decode-detail-test"
	_, err := jsplugin.DefaultRegistry.Register(taskProtocolPluginSource(
		key,
		"1.0.0",
		`["claimed-model"]`,
		"/v1/responses",
		`throw new Error("model is required");`,
	), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(key)) })

	router := gin.New()
	router.POST("/v1/responses", PinTaskPluginEndpoint(), PrepareTaskPluginEndpoint(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"model":"claimed-model"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "model is required")
	assert.NotContains(t, recorder.Body.String(), "Invalid task protocol request")
}

func TestPinTaskPluginEndpointRejectsUnsupportedRequestForms(t *testing.T) {
	setupTaskPluginRouteDB(t)
	tests := []struct {
		name     string
		key      string
		supports string
		hooks    string
		body     string
		message  string
	}{
		{
			name:     "stream against sync and background",
			key:      "form-gate-final-only",
			supports: `["sync", "background"]`,
			hooks:    `renderFinal: function() { return {}; }`,
			body:     `{"model":"form-gate-model","stream":true}`,
			message:  `Streaming is not supported for this model. Set "stream": false, or use "background": true and retrieve the response later.`,
		},
		{
			name:     "sync against stream only",
			key:      "form-gate-stream-only",
			supports: `["stream"]`,
			hooks:    `renderEvents: function() { return {events: [], done: false}; }`,
			body:     `{"model":"form-gate-model"}`,
			message:  `Synchronous non-streaming requests are not supported for this model. Set "stream": true.`,
		},
		{
			name:     "background against stream and sync",
			key:      "form-gate-no-background",
			supports: `["stream", "sync"]`,
			hooks:    `renderEvents: function() { return {events: [], done: false}; }, renderFinal: function() { return {}; }`,
			body:     `{"model":"form-gate-model","background":true}`,
			message:  `Background mode is not supported for this model. Remove "background": true.`,
		},
		{
			name:     "background plus stream reports stream first",
			key:      "form-gate-no-stream",
			supports: `["sync", "background"]`,
			hooks:    `renderFinal: function() { return {}; }`,
			body:     `{"model":"form-gate-model","stream":true,"background":true}`,
			message:  `Streaming is not supported for this model. Set "stream": false, or use "background": true and retrieve the response later.`,
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := jsplugin.DefaultRegistry.Register(taskResponsesPluginSource(
				testCase.key, 0, `["form-gate-model"]`, testCase.supports, testCase.hooks, `return {model: ctx.model};`,
			), jsplugin.Options{})
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(testCase.key)) })

			reachedPrepare := false
			quotaConsumed := false
			router := gin.New()
			router.POST("/v1/responses", PinTaskPluginEndpoint(), PrepareTaskPluginEndpoint(), func(c *gin.Context) {
				reachedPrepare = true
				quotaConsumed = true
				require.NoError(t, model.DB.Create(&model.Task{TaskID: "should-not-exist", UserId: 1}).Error)
				c.Status(http.StatusNoContent)
			})
			request := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(testCase.body))
			request.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, request)

			assert.Equal(t, http.StatusBadRequest, recorder.Code)
			var payload map[string]any
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
			errObj, ok := payload["error"].(map[string]any)
			require.True(t, ok)
			message, _ := errObj["message"].(string)
			assert.Contains(t, message, testCase.message)
			assert.False(t, reachedPrepare)
			assert.False(t, quotaConsumed)
			var count int64
			require.NoError(t, model.DB.Model(&model.Task{}).Count(&count).Error)
			assert.Zero(t, count)
		})
	}
}

func TestPinTaskPluginEndpointMalformedStreamStillFailsInPrepare(t *testing.T) {
	const key = "form-gate-malformed-stream"
	_, err := jsplugin.DefaultRegistry.Register(taskResponsesPluginSource(
		key, 0, `["form-gate-bool-model"]`, `["sync", "background"]`,
		`renderFinal: function() { return {}; }`,
		`return {model: ctx.model};`,
	), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(key)) })

	reachedNext := false
	router := gin.New()
	router.POST("/v1/responses", PinTaskPluginEndpoint(), PrepareTaskPluginEndpoint(), func(c *gin.Context) {
		reachedNext = true
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"model":"form-gate-bool-model","stream":"yes"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "stream must be a boolean")
	assert.False(t, reachedNext)
}

func TestPinTaskPluginEndpointMovesParserToSurvivingSharedCandidate(t *testing.T) {
	streamOnly, err := jsplugin.DefaultRegistry.Register(taskResponsesPluginSource(
		"alpha-stream", constant.ChannelTypeReplicate, `["shared-form-model"]`, `["stream"]`,
		`renderEvents: function() { return {events: [], done: false}; }`,
		`return {model: ctx.model, action: "stream-parser"};`,
	), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister("alpha-stream")) })
	full, err := jsplugin.DefaultRegistry.Register(taskResponsesPluginSource(
		"bravo-full", constant.ChannelTypeCodex, `["shared-form-model"]`, `["stream", "sync", "background"]`,
		`renderEvents: function() { return {events: [], done: false}; }, renderFinal: function() { return {}; }`,
		`return {model: ctx.model, action: "full-parser"};`,
	), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister("bravo-full")) })

	generation := jsplugin.DefaultRegistry.Generation()
	unfiltered := generation.LookupEndpointCandidates("POST", "/v1/responses", "shared-form-model")
	require.Len(t, unfiltered, 2)
	assert.Equal(t, "alpha-stream", unfiltered[0].Plugin.Meta.Key)

	t.Run("sync moves pin to second candidate", func(t *testing.T) {
		var pinned jsplugin.PinnedEndpoint
		var action string
		router := gin.New()
		router.POST("/v1/responses", PinTaskPluginEndpoint(), PrepareTaskPluginEndpoint(), func(c *gin.Context) {
			pinned = c.MustGet(jsplugin.ContextKeyPinnedEndpoint).(jsplugin.PinnedEndpoint)
			action = c.GetString("task_action")
			c.Status(http.StatusNoContent)
		})
		request := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"model":"shared-form-model"}`))
		request.Header.Set("Content-Type", "application/json")
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, request)

		assert.Equal(t, http.StatusNoContent, recorder.Code)
		assert.Same(t, full, pinned.Plugin)
		require.Len(t, pinned.Candidates, 1)
		assert.Same(t, full, pinned.Candidates[0].Plugin)
		assert.Equal(t, "full-parser", action)
	})

	t.Run("stream keeps first candidate", func(t *testing.T) {
		var pinned jsplugin.PinnedEndpoint
		var action string
		router := gin.New()
		router.POST("/v1/responses", PinTaskPluginEndpoint(), PrepareTaskPluginEndpoint(), func(c *gin.Context) {
			pinned = c.MustGet(jsplugin.ContextKeyPinnedEndpoint).(jsplugin.PinnedEndpoint)
			action = c.GetString("task_action")
			c.Status(http.StatusNoContent)
		})
		request := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"model":"shared-form-model","stream":true}`))
		request.Header.Set("Content-Type", "application/json")
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, request)

		assert.Equal(t, http.StatusNoContent, recorder.Code)
		assert.Same(t, streamOnly, pinned.Plugin)
		require.Len(t, pinned.Candidates, 2)
		assert.Same(t, streamOnly, pinned.Candidates[0].Plugin)
		assert.Equal(t, "stream-parser", action)
	})
}

func compileTaskRoutePlugin(t *testing.T, source string) *jsplugin.LoadedPlugin {
	t.Helper()
	plugin, err := jsplugin.CompilePlugin(source, jsplugin.Options{})
	require.NoError(t, err)
	return plugin
}

func taskResponsesPluginSource(key string, channelType int, models, supports, hooks, parseRequestBody string) string {
	channelField := ""
	if channelType > 0 {
		channelField = fmt.Sprintf("channelTypes: [%d],", channelType)
	}
	return fmt.Sprintf(`
export const meta = {
  apiVersion: 1,
  key: %q,
  name: %q,
  version: "1.0.0",
  author: {name: "Test"},
  %s
  models: %s,
  fetchMode: "per_task",
  protocols: [{name: "openai_responses", supports: %s}],
};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
export function listArtifacts() { return []; }
export function buildContentRequest() { throw new Error("artifact_not_found"); }
export const protocols = {openai_responses: {
  decodeRequest: function(ctx) {
    ctx.requestBody = ctx.body.value;
    const decode = function() { %s };
    const result = decode();
    if (!result.kind) result.kind = "submit";
    return result;
  },
  %s
}};
`, key, key, channelField, models, supports, parseRequestBody, hooks)
}

func taskProtocolPluginSource(key, version, models, endpoint, parseRequestBody string) string {
	protocol := "openai_responses"
	protocolClaim := `{name: "openai_responses", supports: ["stream", "sync", "background"]}`
	presenters := `renderEvents: function() { return {events: [], done: false}; }, renderFinal: function() { return {}; },`
	if endpoint == "/v1/videos" {
		protocol = "openai_video"
		protocolClaim = `"openai_video"`
		presenters = `render: function() { return {}; },`
	}
	if endpoint == "/v1/images/edits" || endpoint == "/v1/images/generations" {
		protocol = "openai_image"
		protocolClaim = `"openai_image"`
		presenters = `render: function() { return {data: []}; },`
	}
	return fmt.Sprintf(`
export const meta = {
  apiVersion: 1,
  key: %q,
  name: %q,
  version: %q,
  author: {name: "Test"},
  models: %s,
  fetchMode: "per_task",
  protocols: [%s],
};
export function buildSubmitRequest() { return {url: "https://example.com"}; }
export function parseSubmitResponse() { return {taskId: "one"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
export function listArtifacts() { return []; }
export function buildContentRequest() { throw new Error("artifact_not_found"); }
export const protocols = {
  %s: {
    decodeRequest: function(ctx) {
      ctx.requestBody = ctx.body.value;
      if (ctx.body.kind === "multipart") {
        ctx.requestBody = {};
        for (const key of Object.keys(ctx.body.fields || {})) ctx.requestBody[key] = ctx.body.fields[key][0];
      }
      const decode = function() { %s };
      const result = decode();
      if (!result.kind) result.kind = "submit";
      return result;
    },
		%s
  },
};
`, key, key, version, models, protocolClaim, protocol, parseRequestBody, presenters)
}

func pinTaskPluginRoute(plugin *jsplugin.LoadedPlugin, routeIndex int) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(jsplugin.ContextKeyPinnedRoute, jsplugin.PinnedRoute{Plugin: plugin, Route: plugin.Meta.Routes[routeIndex]})
		c.Next()
	}
}

func setupTaskPluginRouteDB(t *testing.T) {
	t.Helper()
	previousDB := model.DB
	previousType := common.MainDatabaseType()
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(&model.Task{}))
	model.DB = database
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousType)
	})
}

func insertTaskPluginRouteTask(t *testing.T, task *model.Task) {
	t.Helper()
	require.NoError(t, model.DB.Create(task).Error)
}

func TestPrepareTaskPluginEndpointFiltersEachSharedCandidate(t *testing.T) {
	for _, tc := range []struct {
		name, alpha, beta string
		wantKeys          []string
		wantError         string
	}{
		{name: "first decoder rejects", alpha: `throw new Error("alpha only accepts 720p")`, beta: `return {model:ctx.model,action:"beta",requestBody:{resolution:"1080p"}}`, wantKeys: []string{"decode-beta"}},
		{name: "second decoder rejects", alpha: `return {model:ctx.model,action:"alpha"}`, beta: `throw new Error("beta rejects")`, wantKeys: []string{"decode-alpha"}},
		{name: "both decoders accept", alpha: `return {model:ctx.model,action:"alpha"}`, beta: `return {model:ctx.model,action:"beta"}`, wantKeys: []string{"decode-alpha", "decode-beta"}},
		{name: "all decoders reject", alpha: `throw new Error("alpha rejects first")`, beta: `throw new Error("beta rejects second")`, wantError: "decode-alpha: alpha rejects first; decode-beta: beta rejects second"},
		{name: "duplicate failures are grouped", alpha: `throw new Error("unsupported resolution")`, beta: `throw new Error("unsupported resolution")`, wantError: "decode-alpha, decode-beta: unsupported resolution"},
		{name: "invalid result is excluded", alpha: `return {kind:"query",model:ctx.model}`, beta: `return {model:ctx.model,action:"beta"}`, wantKeys: []string{"decode-beta"}},
		{name: "rewritten model is excluded", alpha: `return {model:"another-model"}`, beta: `return {model:ctx.model,action:"beta"}`, wantKeys: []string{"decode-beta"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, spec := range []struct{ key, decode string }{{"decode-alpha", tc.alpha}, {"decode-beta", tc.beta}} {
				_, err := jsplugin.DefaultRegistry.Register(taskResponsesPluginSource(spec.key, 0, `["decode-shared-model"]`, `["sync"]`, `renderFinal:function(){return {};}`, spec.decode), jsplugin.Options{})
				require.NoError(t, err)
				t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(spec.key)) })
			}
			var gotKeys []string
			router := gin.New()
			router.POST("/v1/responses", PinTaskPluginEndpoint(), PrepareTaskPluginEndpoint(), func(c *gin.Context) {
				pinned := c.MustGet(jsplugin.ContextKeyPinnedEndpoint).(jsplugin.PinnedEndpoint)
				for _, candidate := range pinned.Candidates {
					gotKeys = append(gotKeys, candidate.Plugin.Meta.Key)
				}
				assert.Equal(t, tc.wantKeys[0], pinned.Plugin.Meta.Key)
				assert.Equal(t, tc.wantKeys[0], c.GetString("task_plugin_key"))
				assert.Same(t, pinned.Plugin, c.MustGet(jsplugin.ContextKeyPinnedPlugin).(jsplugin.PinnedPlugin).Plugin)
				assert.Equal(t, tc.wantKeys, service.GetChannelConstraints(c).Filters[0].TaskPluginKeys)
				c.Status(http.StatusNoContent)
			})
			request := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"model":"decode-shared-model","resolution":"1080p"}`))
			request.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, request)
			if tc.wantError != "" {
				assert.Equal(t, http.StatusBadRequest, recorder.Code)
				assert.Contains(t, recorder.Body.String(), tc.wantError)
				assert.Empty(t, gotKeys)
			} else {
				assert.Equal(t, http.StatusNoContent, recorder.Code, recorder.Body.String())
				assert.Equal(t, tc.wantKeys, gotKeys)
			}
		})
	}
}

func TestRouteTaskPluginEndpointUsesSelectedChannel(t *testing.T) {
	require.NoError(t, appI18n.Init())
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			dsn := ""
			if dialect != "sqlite" {
				dsn = os.Getenv("TEST_" + strings.ToUpper(dialect) + "_DSN")
				if dsn == "" {
					t.Skip("database test DSN not configured")
				}
			}
			previousDB, previousMain, previousLog := model.DB, common.MainDatabaseType(), common.LogDatabaseType()
			previousPath, previousMaster := common.SQLitePath, common.IsMasterNode
			previousCache, previousRedis := common.MemoryCacheEnabled, common.RedisEnabled
			common.SQLitePath, common.IsMasterNode = t.TempDir()+"/routing.db", false
			common.RedisEnabled = false
			t.Setenv("SQL_DSN", dsn)
			require.NoError(t, model.InitDB())
			database := model.DB
			// Every table belongs to this run, including when a developer points
			// a test DSN at a database shared with another test suite.
			database.Config.NamingStrategy = schema.NamingStrategy{TablePrefix: "endpoint_route_" + common.GetUUID() + "_"}
			require.NoError(t, database.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.Task{}))
			t.Cleanup(func() {
				for _, table := range []any{&model.Ability{}, &model.Channel{}, &model.Task{}} {
					require.NoError(t, database.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(table).Error)
				}
				common.MemoryCacheEnabled = true
				model.InitChannelCache()
				require.NoError(t, database.Migrator().DropTable(&model.Ability{}, &model.Channel{}, &model.Task{}))
				model.DB = previousDB
				common.SetDatabaseTypes(previousMain, previousLog)
				common.SQLitePath, common.IsMasterNode = previousPath, previousMaster
				common.MemoryCacheEnabled, common.RedisEnabled = previousCache, previousRedis
				if previousDB != nil {
					model.InitChannelCache()
				}
				sqlDB, err := database.DB()
				require.NoError(t, err)
				require.NoError(t, sqlDB.Close())
			})
			query := "SELECT version()"
			if dialect == "sqlite" {
				query = "SELECT sqlite_version()"
			}
			var version string
			require.NoError(t, database.Raw(query).Scan(&version).Error)
			t.Logf("database version: %s", version)

			for _, memoryCache := range []bool{false, true} {
				t.Run(fmt.Sprintf("memory_cache=%t", memoryCache), func(t *testing.T) {
					common.MemoryCacheEnabled = memoryCache
					for _, tc := range []struct {
						name, path, model        string
						pluginType               int
						ordinaryType             int
						ordinaryPriority         int64
						pluginPriority           int64
						pluginOnly, wantPlugin   bool
						multipart, stream        bool
						pinOrdinary, pinPlugin   bool
						wrongGroup, wrongModel   bool
						disabled, unrelated      bool
						decoderRejects, syncOnly bool
						originPin, retry         bool
						legacy, mapped, shared   bool
						wantStatus               int
					}{
						{name: "ordinary images bypass plugin decoder", decoderRejects: true},
						{name: "ordinary images win by priority", ordinaryPriority: 20},
						{name: "plugin images win by priority", pluginPriority: 20, wantPlugin: true},
						{name: "type 61 plugin remains usable", pluginOnly: true, wantPlugin: true},
						{name: "Alibaba legacy channel remains usable", legacy: true, pluginOnly: true, wantPlugin: true},
						{name: "OpenAI can win against Alibaba for qwen-image-3.0", legacy: true, ordinaryPriority: 20},
						{name: "Alibaba can win against OpenAI for qwen-image-3.0", legacy: true, pluginPriority: 20, wantPlugin: true},
						{name: "bound New API uses plugin", pluginType: constant.ChannelTypeNewAPI, pluginPriority: 20, wantPlugin: true},
						{name: "unbound New API uses ordinary relay", ordinaryType: constant.ChannelTypeNewAPI, decoderRejects: true},
						{name: "unrelated type 61 cannot steal request", unrelated: true, pluginPriority: 20},
						{name: "disabled plugin channel is ignored", disabled: true, pluginPriority: 20},
						{name: "plugin in another group is ignored", wrongGroup: true, pluginPriority: 20},
						{name: "plugin without requested model is ignored", wrongModel: true, pluginPriority: 20},
						{name: "ordinary channel pin wins", pinOrdinary: true, pluginPriority: 20},
						{name: "plugin channel pin wins", pinPlugin: true, wantPlugin: true},
						{name: "ordinary model spelling is preserved", model: "CHANNEL-ROUTE-MODEL", decoderRejects: true},
						{name: "mapped plugin alias remains usable", model: "friendly-image", mapped: true, pluginOnly: true, wantPlugin: true},
						{name: "ordinary alias is not rewritten by plugin", model: "friendly-image", mapped: true, decoderRejects: true},
						{name: "ordinary multipart edits are preserved", path: "/v1/images/edits", multipart: true, decoderRejects: true},
						{name: "plugin multipart edits remain usable", path: "/v1/images/edits", multipart: true, pluginOnly: true, wantPlugin: true},
						{name: "ordinary Responses bypass unsupported plugin mode", path: "/v1/responses", stream: true, syncOnly: true},
						{name: "plugin Responses remain usable", path: "/v1/responses", pluginOnly: true, wantPlugin: true},
						{name: "ordinary videos bypass plugin decoder", path: "/v1/videos", multipart: true, decoderRejects: true},
						{name: "plugin videos remain usable", path: "/v1/videos", multipart: true, pluginOnly: true, wantPlugin: true},
						{name: "selected plugin retains validation errors", pluginOnly: true, decoderRejects: true, wantStatus: http.StatusBadRequest},
						{name: "selected plugin retains mode errors", path: "/v1/responses", pluginOnly: true, stream: true, syncOnly: true, wantStatus: http.StatusBadRequest},
						{name: "origin task still pins its channel", pluginOnly: true, originPin: true, wantPlugin: true},
						{name: "ordinary retries stay on ordinary channels", ordinaryPriority: 20, pluginPriority: 10, retry: true},
						{name: "plugin retries stay on plugin channels", pluginPriority: 20, retry: true, wantPlugin: true},
						{name: "rejected shared candidate still allows another plugin", pluginOnly: true, shared: true, decoderRejects: true, pluginPriority: 20, wantPlugin: true},
					} {
						t.Run(tc.name, func(t *testing.T) {
							for _, table := range []any{&model.Ability{}, &model.Channel{}, &model.Task{}} {
								require.NoError(t, database.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(table).Error)
							}
							key := "channel-route-test"
							path := common.GetStringIfEmpty(tc.path, "/v1/images/generations")
							modelName := common.GetStringIfEmpty(tc.model, "channel-route-model")
							if tc.legacy {
								key, modelName = "alibaba", "qwen-image-3.0"
							}
							decode := `return {model: ctx.model, action: "generate", requestBody: {normalized: true}};`
							if tc.decoderRejects {
								decode = `throw new Error("plugin rejected this request");`
							} else if tc.originPin {
								decode = `return {model: ctx.model, originTaskIds: ["task-route-origin"], requestBody: {normalized: true}};`
							}
							source := taskProtocolPluginSource(key, "1.0.0", `["channel-route-model"]`, path, decode)
							if tc.syncOnly {
								source = taskResponsesPluginSource(key, 0, `["channel-route-model"]`, `["sync"]`, `renderFinal: function() { return {}; },`, decode)
							}
							if !tc.legacy {
								_, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
								require.NoError(t, err)
								t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(key)) })
							}
							ordinary := &model.Channel{Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled, Name: "ordinary", Key: "ordinary-key", Group: "route-test", Models: modelName, Priority: common.GetPointer(tc.ordinaryPriority + 1)}
							if tc.ordinaryType != 0 {
								ordinary.Type = tc.ordinaryType
							}
							plugin := &model.Channel{Type: constant.ChannelTypeTaskPlugin, Status: common.ChannelStatusEnabled, Name: "plugin", Key: "plugin-key", Group: "route-test", Models: modelName, Priority: &tc.pluginPriority}
							if tc.pluginType != 0 {
								plugin.Type = tc.pluginType
							}
							plugin.SetSetting(kitdto.ChannelSettings{TaskPluginKey: key})
							if tc.legacy {
								plugin.Type = constant.ChannelTypeAli
							}
							if tc.mapped {
								plugin.ModelMapping = common.GetPointer(`{"friendly-image":"channel-route-model"}`)
							}
							if tc.unrelated {
								plugin.SetSetting(kitdto.ChannelSettings{TaskPluginKey: "unrelated"})
							}
							if tc.wrongGroup {
								plugin.Group = "another-group"
							}
							if tc.wrongModel {
								plugin.Models = "another-model"
							}
							if tc.disabled {
								plugin.Status = common.ChannelStatusManuallyDisabled
							}
							channels := []*model.Channel{plugin}
							if !tc.pluginOnly {
								channels = append(channels, ordinary)
							}
							if tc.originPin || tc.retry || tc.shared {
								alternate := &model.Channel{Type: ordinary.Type, Status: common.ChannelStatusEnabled, Name: "alternate", Key: "alternate-key", Group: "route-test", Models: modelName}
								if tc.wantPlugin {
									alternate.Type = plugin.Type
									alternate.SetSetting(plugin.GetSetting())
								}
								if tc.shared {
									const alternateKey = "channel-route-ztest"
									alternateSource := taskProtocolPluginSource(alternateKey, "1.0.0", `["channel-route-model"]`, path, `return {model: ctx.model, requestBody: {normalized: true}};`)
									_, err := jsplugin.DefaultRegistry.Register(alternateSource, jsplugin.Options{})
									require.NoError(t, err)
									t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(alternateKey)) })
									alternate.SetSetting(kitdto.ChannelSettings{TaskPluginKey: alternateKey})
								}
								channels = append(channels, alternate)
							}
							for _, channel := range channels {
								require.NoError(t, channel.Insert())
							}
							if tc.originPin {
								require.NoError(t, database.Create(&model.Task{TaskID: "task-route-origin", UserId: 7, ChannelId: channels[len(channels)-1].Id, Platform: constant.TaskPlatform(key), Status: model.TaskStatusSuccess}).Error)
							}
							model.InitChannelCache()
							body := []byte(fmt.Sprintf(`{"model":%q,"prompt":"a cat","size":"1024x1024","stream":%t}`, modelName, tc.stream))
							contentType := "application/json"
							if tc.multipart {
								var form bytes.Buffer
								writer := multipart.NewWriter(&form)
								require.NoError(t, writer.WriteField("model", modelName))
								require.NoError(t, writer.WriteField("prompt", "a cat"))
								file, err := writer.CreateFormFile("image", "reference.png")
								require.NoError(t, err)
								_, err = file.Write([]byte("image bytes"))
								require.NoError(t, err)
								require.NoError(t, writer.Close())
								body, contentType = form.Bytes(), writer.FormDataContentType()
							}
							reached := false
							router := gin.New()
							router.POST(path, func(c *gin.Context) {
								common.SetContextKey(c, constant.ContextKeyUsingGroup, "route-test")
								common.SetContextKey(c, constant.ContextKeyUserId, 7)
								if tc.pinOrdinary || tc.pinPlugin {
									id := ordinary.Id
									if tc.pinPlugin {
										id = plugin.Id
									}
									service.GetChannelConstraints(c).AddPin(dto.ChannelPin{ChannelId: id, Source: dto.PinSourceToken, Rank: dto.PinRankToken})
								}
							}, RouteTaskPluginEndpoint(), PrepareTaskPluginEndpoint(), Distribute(), func(c *gin.Context) {
								reached = true
								_, pinned := c.Get(jsplugin.ContextKeyPinnedEndpoint)
								assert.Equal(t, tc.wantPlugin, pinned)
								_, relayEndpoint := c.Get(jsplugin.ContextKeyRelayEndpoint)
								assert.Equal(t, !tc.wantPlugin, relayEndpoint)
								expected := ordinary
								if tc.wantPlugin {
									expected = plugin
									if tc.shared {
										assert.Equal(t, "channel-route-ztest", c.GetString("task_plugin_key"))
									} else {
										assert.Equal(t, key, c.GetString("task_plugin_key"))
									}
									if tc.legacy {
										assert.NotNil(t, c.MustGet("task_request"))
									} else {
										assert.Equal(t, map[string]any{"normalized": true}, c.MustGet("task_request"))
									}
									if tc.mapped {
										assert.Equal(t, "channel-route-model", c.MustGet(jsplugin.ContextKeyPinnedEndpoint).(jsplugin.PinnedEndpoint).MappedModel)
									}
									if tc.originPin || tc.shared {
										expected = channels[len(channels)-1]
									}
								} else {
									assert.Empty(t, c.GetString("expected_task_plugin_key"))
									assert.Empty(t, c.GetString("resolved_task_model"))
									storage, err := common.GetBodyStorage(c)
									require.NoError(t, err)
									got, err := storage.Bytes()
									require.NoError(t, err)
									assert.Equal(t, body, got, "ordinary relay must receive the original body")
								}
								assert.Equal(t, expected.Id, common.GetContextKeyInt(c, constant.ContextKeyChannelId))
								assert.Equal(t, expected.Key, common.GetContextKeyString(c, constant.ContextKeyChannelKey))
								if tc.retry {
									next, _, err := service.CacheGetRandomSatisfiedChannel(&service.RetryParam{Ctx: c, TokenGroup: "route-test", ModelName: modelName, Retry: common.GetPointer(1)})
									require.NoError(t, err)
									require.NotNil(t, next)
									assert.Equal(t, channels[len(channels)-1].Id, next.Id)
								}
								c.Status(http.StatusNoContent)
							})
							request := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
							request.Header.Set("Content-Type", contentType)
							recorder := httptest.NewRecorder()
							router.ServeHTTP(recorder, request)
							status := tc.wantStatus
							if status == 0 {
								status = http.StatusNoContent
							}
							assert.Equal(t, status, recorder.Code, recorder.Body.String())
							assert.Equal(t, status == http.StatusNoContent, reached)
							if tc.decoderRejects && status == http.StatusBadRequest {
								assert.Contains(t, recorder.Body.String(), "plugin rejected this request")
							}
						})
					}
				})
			}
		})
	}
}
