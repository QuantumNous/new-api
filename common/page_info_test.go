package common

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func pageQueryFor(t *testing.T, rawQuery string) *PageInfo {
	t.Helper()
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodGet, "/?"+rawQuery, nil)
	return GetPageQuery(ctx)
}

func TestGetPageQueryClampsPageAndPageSize(t *testing.T) {
	previousItemsPerPage := ItemsPerPage
	ItemsPerPage = 20
	t.Cleanup(func() {
		ItemsPerPage = previousItemsPerPage
	})

	tests := []struct {
		name     string
		query    string
		wantPage int
		wantSize int
	}{
		{name: "missing parameters use the default page size", query: "", wantPage: 1, wantSize: 20},
		{name: "zero page size falls back to the default", query: "page_size=0", wantPage: 1, wantSize: 20},
		{name: "negative page size falls back to the default", query: "page_size=-25", wantPage: 1, wantSize: 20},
		{name: "negative legacy page size falls back to the default", query: "ps=-5", wantPage: 1, wantSize: 20},
		{name: "negative legacy size falls back to the default", query: "size=-100", wantPage: 1, wantSize: 20},
		{name: "oversized page size is capped", query: "page_size=5000", wantPage: 1, wantSize: 100},
		{name: "valid page size is preserved", query: "page_size=50", wantPage: 1, wantSize: 50},
		{name: "valid legacy page size is preserved", query: "ps=5", wantPage: 1, wantSize: 5},
		{name: "negative page falls back to the first page", query: "p=-3&page_size=10", wantPage: 1, wantSize: 10},
		{name: "valid page is preserved", query: "p=4&page_size=10", wantPage: 4, wantSize: 10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pageInfo := pageQueryFor(t, tt.query)
			assert.Equal(t, tt.wantPage, pageInfo.Page)
			assert.Equal(t, tt.wantSize, pageInfo.PageSize)
			assert.GreaterOrEqual(t, pageInfo.GetStartIdx(), 0)
		})
	}
}
