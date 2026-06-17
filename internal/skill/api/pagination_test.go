package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParsePageParamsDefaults(t *testing.T) {
	c, _ := testContextWithURL("/api/v1/marketplace/skills")

	got, err := ParsePageParams(c)

	require.Nil(t, err)
	assert.Equal(t, PageParams{Page: 1, Limit: 20, Offset: 0}, got)
}

func TestParsePageParamsBounds(t *testing.T) {
	c, _ := testContextWithURL("/api/v1/marketplace/skills?page=3&limit=50")

	got, err := ParsePageParams(c)

	require.Nil(t, err)
	assert.Equal(t, PageParams{Page: 3, Limit: 50, Offset: 100}, got)
}

func TestParsePageParamsRejectsPageBelowOne(t *testing.T) {
	c, _ := testContextWithURL("/api/v1/marketplace/skills?page=0")

	_, err := ParsePageParams(c)

	require.NotNil(t, err)
	assert.Equal(t, "page must be an integer >= 1", err.Message)
}

func TestParsePageParamsRejectsLimitAboveMax(t *testing.T) {
	c, _ := testContextWithURL("/api/v1/marketplace/skills?limit=101")

	_, err := ParsePageParams(c)

	require.NotNil(t, err)
	assert.Equal(t, "limit must be <= 100", err.Message)
}

func TestNewPaginationHasNext(t *testing.T) {
	assert.Equal(t, Pagination{Page: 1, Limit: 20, Total: 21, HasNext: true}, NewPagination(1, 20, 21))
	assert.Equal(t, Pagination{Page: 2, Limit: 20, Total: 40, HasNext: false}, NewPagination(2, 20, 40))
}

func TestValidateSortRejectsUnknownSortKey(t *testing.T) {
	allowed := map[string]struct{}{"created_at": {}, "name": {}}

	assert.Nil(t, ValidateSort("-created_at", allowed))
	err := ValidateSort("rating", allowed)

	require.NotNil(t, err)
	assert.Equal(t, "unsupported sort key \"rating\"", err.Message)
}

func TestValidateFilterRejectsUnsupportedValues(t *testing.T) {
	allowed := map[string]struct{}{"free": {}, "pro": {}}

	assert.Nil(t, ValidateFilter("plan", "pro", allowed))
	err := ValidateFilter("plan", "enterprise", allowed)

	require.NotNil(t, err)
	assert.Equal(t, "unsupported plan filter value \"enterprise\"", err.Message)
}

func TestAbortQueryErrorProducesErrorEnvelopeWith400(t *testing.T) {
	c, w := testContextWithURL("/api/v1/marketplace/skills?sort=bad")
	err := ValidateSort("bad", map[string]struct{}{"name": {}})
	require.NotNil(t, err)

	AbortQueryError(c, err)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), `"request_id":`)
	assert.Contains(t, w.Body.String(), `"code":"INVALID_REQUEST"`)
}

func testContextWithURL(url string) (*gin.Context, *httptest.ResponseRecorder) {
	c, w := testContext()
	c.Request = httptest.NewRequest(http.MethodGet, url, nil)
	return c, w
}
