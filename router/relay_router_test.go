package router

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestListModelsSupportsOpenAIAndGeminiAuthentication(t *testing.T) {
	setupRelayRouterTestDB(t)

	user := model.User{
		Username: "models-user",
		Status:   common.UserStatusEnabled,
		Group:    "default",
		Quota:    100,
	}
	require.NoError(t, model.DB.Create(&user).Error)
	require.NoError(t, model.DB.Create(&model.Token{
		UserId:         user.Id,
		Key:            "modelstestkey",
		Status:         common.TokenStatusEnabled,
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}).Error)

	engine := gin.New()
	SetRelayRouter(engine)

	tests := []struct {
		name           string
		path           string
		headerName     string
		expectedObject string
		expectedField  string
	}{
		{
			name:           "OpenAI bearer token",
			path:           "/v1/models",
			headerName:     "Authorization",
			expectedObject: "list",
			expectedField:  "data",
		},
		{
			name:          "Gemini API key header",
			path:          "/v1/models",
			headerName:    "x-goog-api-key",
			expectedField: "models",
		},
		{
			name:          "Gemini API key query",
			path:          "/v1/models?key=modelstestkey",
			expectedField: "models",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			if test.headerName != "" {
				value := "modelstestkey"
				if test.headerName == "Authorization" {
					value = "Bearer " + value
				}
				request.Header.Set(test.headerName, value)
			}

			engine.ServeHTTP(recorder, request)

			require.Equal(t, http.StatusOK, recorder.Code)
			var payload map[string]any
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
			assert.Contains(t, payload, test.expectedField)
			assert.NotContains(t, payload, "error")
			if test.expectedObject != "" {
				assert.Equal(t, test.expectedObject, payload["object"])
			}
		})
	}
}

func setupRelayRouterTestDB(t *testing.T) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	originalIsMasterNode := common.IsMasterNode
	originalRedisEnabled := common.RedisEnabled
	originalSQLitePath := common.SQLitePath
	originalMainDatabaseType := common.MainDatabaseType()
	originalLogDatabaseType := common.LogDatabaseType()
	originalSQLDSN, hadSQLDSN := os.LookupEnv("SQL_DSN")

	common.IsMasterNode = false
	common.RedisEnabled = false
	common.SQLitePath = fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	require.NoError(t, os.Setenv("SQL_DSN", "local"))
	require.NoError(t, model.InitDB())
	model.LOG_DB = model.DB
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.Token{}, &model.Ability{}))

	t.Cleanup(func() {
		if sqlDB, err := model.DB.DB(); err == nil {
			_ = sqlDB.Close()
		}
		common.IsMasterNode = originalIsMasterNode
		common.RedisEnabled = originalRedisEnabled
		common.SQLitePath = originalSQLitePath
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
		if hadSQLDSN {
			require.NoError(t, os.Setenv("SQL_DSN", originalSQLDSN))
		} else {
			require.NoError(t, os.Unsetenv("SQL_DSN"))
		}
	})
}

func TestVertexStorageRoutesAreExact(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetRelayRouter(engine)

	want := map[string]bool{
		"POST /vertexai/upload/storage/v1/b/:bucket/o":    true,
		"PUT /vertexai/upload/storage/v1/b/:bucket/o":     true,
		"GET /vertexai/storage/v1/b/:bucket/o":            true,
		"GET /vertexai/storage/v1/b/:bucket/o/*object":    true,
		"DELETE /vertexai/storage/v1/b/:bucket/o/*object": true,
	}
	got := make(map[string]bool, len(want))
	for _, route := range engine.Routes() {
		if strings.HasPrefix(route.Path, "/vertexai/") {
			got[route.Method+" "+route.Path] = true
		}
	}

	assert.Equal(t, want, got)
}

func TestVertexStorageOpenAPIContract(t *testing.T) {
	openAPIBytes, err := os.ReadFile("../docs/openapi/relay.json")
	require.NoError(t, err)
	var document struct {
		Tags  []map[string]any          `json:"tags"`
		Paths map[string]map[string]any `json:"paths"`
	}
	require.NoError(t, common.Unmarshal(openAPIBytes, &document))

	const tag = "文件/Vertex AI Cloud Storage"
	tagFound := false
	for _, item := range document.Tags {
		if item["name"] == tag {
			tagFound = true
			break
		}
	}
	assert.True(t, tagFound)

	expected := map[string][]string{
		"/vertexai/upload/storage/v1/b/{bucket}/o":   {"post", "put"},
		"/vertexai/storage/v1/b/{bucket}/o":          {"get"},
		"/vertexai/storage/v1/b/{bucket}/o/{object}": {"get", "delete"},
	}
	vertexPathCount := 0
	for path, pathItem := range document.Paths {
		if !strings.HasPrefix(path, "/vertexai/") {
			continue
		}
		vertexPathCount++
		methods, ok := expected[path]
		require.True(t, ok, "unexpected Vertex Storage path %s", path)
		for _, method := range methods {
			operation, ok := pathItem[method].(map[string]any)
			require.True(t, ok, "%s %s", method, path)
			assert.Equal(t, []any{tag}, operation["tags"])
			security, ok := operation["security"].([]any)
			require.True(t, ok)
			require.NotEmpty(t, security)
			securityItem, ok := security[0].(map[string]any)
			require.True(t, ok)
			assert.Contains(t, securityItem, "BearerAuth")

			parameters, ok := operation["parameters"].([]any)
			require.True(t, ok)
			assertOpenAPIRequiredPathParameter(t, parameters, "bucket")
			if strings.Contains(path, "{object}") {
				assertOpenAPIRequiredPathParameter(t, parameters, "object")
			}
			if strings.Contains(path, "/upload/") {
				assertOpenAPIParameter(t, parameters, "uploadType", "query")
				assertOpenAPIParameter(t, parameters, "name", "query")
				requestBody, ok := operation["requestBody"].(map[string]any)
				require.True(t, ok)
				content, ok := requestBody["content"].(map[string]any)
				require.True(t, ok)
				assert.Contains(t, content, "application/octet-stream")
				if method == "put" {
					assertOpenAPIParameter(t, parameters, "Content-Range", "header")
				}
			}
			if strings.Contains(path, "{object}") && method == "get" {
				assertOpenAPIParameter(t, parameters, "alt", "query")
				assertOpenAPIParameter(t, parameters, "generation", "query")
				assertOpenAPIParameter(t, parameters, "Range", "header")
			}
			responses, ok := operation["responses"].(map[string]any)
			require.True(t, ok)
			for _, status := range []string{"400", "403", "502", "default"} {
				assert.Contains(t, responses, status)
			}
		}
	}
	assert.Equal(t, len(expected), vertexPathCount)
}

func assertOpenAPIRequiredPathParameter(t *testing.T, parameters []any, name string) {
	t.Helper()
	for _, raw := range parameters {
		parameter, ok := raw.(map[string]any)
		require.True(t, ok)
		if parameter["name"] == name && parameter["in"] == "path" {
			assert.Equal(t, true, parameter["required"])
			return
		}
	}
	assert.Fail(t, "missing required path parameter", name)
}

func assertOpenAPIParameter(t *testing.T, parameters []any, name, location string) {
	t.Helper()
	for _, raw := range parameters {
		parameter, ok := raw.(map[string]any)
		require.True(t, ok)
		if parameter["name"] == name && parameter["in"] == location {
			return
		}
	}
	assert.Fail(t, "missing OpenAPI parameter", name+" in "+location)
}
