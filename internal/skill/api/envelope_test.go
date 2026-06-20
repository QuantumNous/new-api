package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSuccessEnvelopeIncludesRequestID(t *testing.T) {
	c, w := testContext()
	c.Set(common.RequestIdKey, "req_123")

	Success(c, gin.H{"id": "skill_1"})

	require.Equal(t, http.StatusOK, w.Code)
	var got SuccessEnvelope
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	assert.Equal(t, "req_123", got.Meta.RequestID)
	assert.Equal(t, map[string]any{"id": "skill_1"}, got.Data)
}

func TestSuccessEnvelopeGeneratesRequestIDWhenMissing(t *testing.T) {
	c, w := testContext()

	Success(c, gin.H{"ok": true})

	require.Equal(t, http.StatusOK, w.Code)
	var got SuccessEnvelope
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	assert.NotEmpty(t, got.Meta.RequestID)
	assert.Equal(t, got.Meta.RequestID, w.Header().Get(common.RequestIdKey))
	assert.Equal(t, got.Meta.RequestID, c.GetString(common.RequestIdKey))
}

func TestListEnvelopeIncludesPaginationAndRequestID(t *testing.T) {
	c, w := testContext()
	c.Set(common.RequestIdKey, "req_list")

	List(c, []string{"a", "b"}, NewPagination(2, 20, 45))

	require.Equal(t, http.StatusOK, w.Code)
	var got struct {
		Data       []string   `json:"data"`
		Pagination Pagination `json:"pagination"`
		Meta       Meta       `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	assert.Equal(t, []string{"a", "b"}, got.Data)
	assert.Equal(t, Pagination{Page: 2, Limit: 20, Total: 45, HasNext: true}, got.Pagination)
	assert.Equal(t, "req_list", got.Meta.RequestID)
}

func TestListEnvelopeNormalizesNilSliceToEmptyArray(t *testing.T) {
	c, w := testContext()
	var data []string

	List(c, data, NewPagination(1, 20, 0))

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"data":[]`)
}

func TestErrorEnvelopeIncludesRequestIDAndNullRetryAfter(t *testing.T) {
	c, w := testContext()
	c.Set(common.RequestIdKey, "req_err")

	Error(c, errcodes.ErrSkillPlanRequired, "plan required", "upgrade")

	require.Equal(t, http.StatusForbidden, w.Code)
	var got ErrorEnvelope
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	assert.Equal(t, errcodes.ErrSkillPlanRequired, got.Error.Code)
	assert.Equal(t, "plan required", got.Error.Message)
	assert.Equal(t, "upgrade", got.Error.Detail)
	assert.Equal(t, "req_err", got.Error.RequestID)
	assert.Nil(t, got.Error.RetryAfter)
	assert.Contains(t, w.Body.String(), `"retry_after":null`)
}

func TestErrorEnvelopeOmitsNilDetail(t *testing.T) {
	c, w := testContext()

	Error(c, errcodes.ErrSkillNotFound, "not found", nil)

	require.Equal(t, http.StatusNotFound, w.Code)
	assert.NotContains(t, w.Body.String(), `"detail"`)
	assert.Contains(t, w.Body.String(), `"retry_after":null`)
}

func TestRateLimitedErrorSetsRetryAfterHeaderAndBody(t *testing.T) {
	c, w := testContext()
	retryAfter := 30

	ErrorWithRetryAfter(c, errcodes.ErrSkillRateLimited, "rate limited", nil, &retryAfter)

	require.Equal(t, http.StatusTooManyRequests, w.Code)
	assert.Equal(t, "30", w.Header().Get("Retry-After"))
	var got ErrorEnvelope
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.NotNil(t, got.Error.RetryAfter)
	assert.Equal(t, 30, *got.Error.RetryAfter)
	assert.NotEmpty(t, got.Error.RequestID)
}

func testContext() (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	return c, w
}
