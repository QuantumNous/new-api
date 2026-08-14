package helper

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupResponseValidationTest(t *testing.T) *gin.Context {
	t.Helper()

	oldEnabled := operation_setting.EmptyResponseRetryEnabled
	oldKeywords := operation_setting.ResponseBlacklistKeywords
	t.Cleanup(func() {
		operation_setting.EmptyResponseRetryEnabled = oldEnabled
		operation_setting.ResponseBlacklistKeywords = oldKeywords
	})
	operation_setting.EmptyResponseRetryEnabled = false
	operation_setting.ResponseBlacklistKeywords = nil

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return c
}

func TestCheckModelOutputDisabledByDefault(t *testing.T) {
	c := setupResponseValidationTest(t)

	assert.Nil(t, CheckModelOutput(c, "", false))
	assert.Nil(t, CheckModelOutput(c, "Internal Server Error", true))
}

func TestCheckModelOutputEmptyResponse(t *testing.T) {
	c := setupResponseValidationTest(t)
	operation_setting.EmptyResponseRetryEnabled = true

	tests := []struct {
		name      string
		text      string
		hasOutput bool
		wantErr   bool
	}{
		{name: "empty output", text: "", hasOutput: false, wantErr: true},
		{name: "reasoning only counts as empty", text: "let me think...", hasOutput: false, wantErr: true},
		{name: "content present", text: "hello", hasOutput: true, wantErr: false},
		{name: "tool calls only", text: "", hasOutput: true, wantErr: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := CheckModelOutput(c, tt.text, tt.hasOutput)
			if tt.wantErr {
				require.NotNil(t, err)
				assert.Equal(t, types.ErrorCodeEmptyResponse, err.GetErrorCode())
				assert.Equal(t, http.StatusBadGateway, err.StatusCode)
			} else {
				assert.Nil(t, err)
			}
		})
	}
}

func TestCheckModelOutputBlacklist(t *testing.T) {
	c := setupResponseValidationTest(t)
	operation_setting.ResponseBlacklistKeywordsFromString("Internal Server Error\n上游服务异常")

	tests := []struct {
		name      string
		text      string
		hasOutput bool
		wantErr   bool
	}{
		{name: "match case insensitive", text: "oops: internal server error occurred", hasOutput: true, wantErr: true},
		{name: "match unicode keyword", text: "抱歉，上游服务异常，请稍后再试", hasOutput: true, wantErr: true},
		{name: "no match", text: "here is a normal answer", hasOutput: true, wantErr: false},
		{name: "whitespace only text is not matched", text: "   ", hasOutput: false, wantErr: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := CheckModelOutput(c, tt.text, tt.hasOutput)
			if tt.wantErr {
				require.NotNil(t, err)
				assert.Equal(t, types.ErrorCodeBlacklistedResponse, err.GetErrorCode())
				assert.Equal(t, http.StatusBadGateway, err.StatusCode)
			} else {
				assert.Nil(t, err)
			}
		})
	}
}

func TestCheckModelOutputBlacklistWinsOverEmpty(t *testing.T) {
	c := setupResponseValidationTest(t)
	operation_setting.EmptyResponseRetryEnabled = true
	operation_setting.ResponseBlacklistKeywordsFromString("rate limit")

	err := CheckModelOutput(c, "Rate Limit exceeded", true)
	require.NotNil(t, err)
	assert.Equal(t, types.ErrorCodeBlacklistedResponse, err.GetErrorCode())
}

func TestResponseValidationActive(t *testing.T) {
	setupResponseValidationTest(t)

	assert.False(t, ResponseValidationActive())

	operation_setting.EmptyResponseRetryEnabled = true
	assert.True(t, ResponseValidationActive())

	operation_setting.EmptyResponseRetryEnabled = false
	operation_setting.ResponseBlacklistKeywordsFromString("error")
	assert.True(t, ResponseValidationActive())
}
