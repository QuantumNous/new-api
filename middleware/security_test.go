package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func setupSecurityTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	return router
}

func TestSecurityCheck_AllowsWhenDisabled(t *testing.T) {
	_ = os.Setenv("SECURITY_ENABLED", "false")
	defer os.Unsetenv("SECURITY_ENABLED")

	router := setupSecurityTestRouter()
	router.POST("/v1/chat/completions", func(c *gin.Context) {
		c.Set("id", 1)
		c.Next()
	}, SecurityCheck(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	body := `{"messages":[{"role":"user","content":"机密信息"}]}`
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":true`)
}

func TestSecurityCheck_SkipsNonChatEndpoints(t *testing.T) {
	_ = os.Setenv("SECURITY_ENABLED", "true")
	defer os.Unsetenv("SECURITY_ENABLED")

	router := setupSecurityTestRouter()
	router.POST("/v1/embeddings", func(c *gin.Context) {
		c.Set("id", 1)
		c.Next()
	}, SecurityCheck(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	body := `{"input":"机密信息"}`
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/embeddings", bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
}

func TestSecurityCheck_SkipsWhenUserIDMissing(t *testing.T) {
	_ = os.Setenv("SECURITY_ENABLED", "true")
	defer os.Unsetenv("SECURITY_ENABLED")

	router := setupSecurityTestRouter()
	router.POST("/v1/chat/completions", SecurityCheck(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	body := `{"messages":[{"role":"user","content":"hello"}]}`
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
}

func TestSecurityCheckResponse_SkipsNonChatEndpoints(t *testing.T) {
	_ = os.Setenv("SECURITY_ENABLED", "true")
	defer os.Unsetenv("SECURITY_ENABLED")

	router := setupSecurityTestRouter()
	router.POST("/v1/embeddings", func(c *gin.Context) {
		c.Set("id", 1)
		c.Next()
	}, SecurityCheckResponse(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []any{}})
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/embeddings", nil)
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":true`)
}

func TestExtractContentFromRequest(t *testing.T) {
	body := []byte(`{"messages":[{"role":"system","content":"system"},{"role":"user","content":"hello world"}]}`)
	content := extractContentFromRequest(body)
	require.Equal(t, "hello world", content)
}

func TestExtractContentFromRequest_Empty(t *testing.T) {
	body := []byte(`{"model":"gpt-4"}`)
	content := extractContentFromRequest(body)
	require.Equal(t, "", content)
}

func TestExtractContentFromResponse(t *testing.T) {
	body := []byte(`{"choices":[{"message":{"content":"hello"}}]}`)
	content := extractContentFromResponse(body)
	require.Equal(t, "hello", content)
}

func TestExtractContentFromResponse_Delta(t *testing.T) {
	body := []byte(`{"choices":[{"delta":{"content":"stream chunk"}}]}`)
	content := extractContentFromResponse(body)
	require.Equal(t, "stream chunk", content)
}

func TestReplaceContentInRequest(t *testing.T) {
	body := []byte(`{"messages":[{"role":"user","content":"请联系 13800138000"}]}`)
	newBody := replaceContentInRequest(body, "请联系 13800138000", "请联系 1*********0")
	require.Contains(t, string(newBody), "1*********0")
}

func TestReplaceContentInResponse(t *testing.T) {
	body := []byte(`{"choices":[{"message":{"content":"请联系 13800138000"}}]}`)
	newBody := replaceContentInResponse(body, "请联系 13800138000", "请联系 1*********0")
	require.Contains(t, string(newBody), "1*********0")
}

func TestIsChatCompletionEndpoint(t *testing.T) {
	require.True(t, isChatCompletionEndpoint("/v1/chat/completions"))
	require.True(t, isChatCompletionEndpoint("/v1/completions"))
	require.False(t, isChatCompletionEndpoint("/v1/embeddings"))
	require.False(t, isChatCompletionEndpoint("/v1/models"))
}

// ========== 输入验证中间件测试 ==========

func setupSecurityValidationRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	return router
}

func TestSecurityInputValidation_BlocksXSS(t *testing.T) {
	router := setupSecurityValidationRouter()
	router.POST("/api/security/groups", SecurityInputValidation(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	body := `{"name":"<script>alert(1)</script>"}`
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/security/groups", bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, recorder.Body.String(), "非法字符")
}

func TestSecurityInputValidation_BlocksSQLInjection(t *testing.T) {
	router := setupSecurityValidationRouter()
	router.POST("/api/security/rules", SecurityInputValidation(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	body := `{"name":"test'; DROP TABLE users; --"}`
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/security/rules", bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
}

func TestSecurityInputValidation_AllowsSafeContent(t *testing.T) {
	router := setupSecurityValidationRouter()
	router.POST("/api/security/groups", SecurityInputValidation(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	body := `{"name":"敏感词分组","description":"用于过滤机密信息"}`
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/security/groups", bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":true`)
}

func TestSecurityInputValidation_SkipsNonSecurityEndpoints(t *testing.T) {
	router := setupSecurityValidationRouter()
	router.POST("/api/other/groups", SecurityInputValidation(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	body := `{"name":"<script>alert(1)</script>"}`
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/other/groups", bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	// 非安全端点应该放行
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":true`)
}

func TestSecurityInputValidation_SkipsGetRequests(t *testing.T) {
	router := setupSecurityValidationRouter()
	router.GET("/api/security/groups", SecurityInputValidation(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/security/groups", nil)
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":true`)
}

func TestSecurityInputValidation_HandlesNestedPayload(t *testing.T) {
	router := setupSecurityValidationRouter()
	router.POST("/api/security/policies", SecurityInputValidation(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	body := `{"user_id":1,"custom_response":"<iframe src='evil'>"}`
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/security/policies", bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
}
