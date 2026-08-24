package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetWebsitePricingV2RejectsNonPLGGroupBeforeReadingPricing(t *testing.T) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/website/pricing/v2?group=internal", nil)

	GetWebsitePricingV2(ctx)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
	require.JSONEq(t, `{"success":false,"message":"unsupported website pricing group"}`, recorder.Body.String())
}

func TestGetWebsitePricingV2SetsPublicCacheHeader(t *testing.T) {
	previousBuilder := buildWebsitePricingV2Payload
	buildWebsitePricingV2Payload = func(group string, _ time.Time) (service.WebsitePricingV2, error) {
		require.Equal(t, "plg", group)
		return service.WebsitePricingV2{Success: true, SchemaVersion: "website-public-plg-v2", Group: group}, nil
	}
	t.Cleanup(func() { buildWebsitePricingV2Payload = previousBuilder })

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/website/pricing/v2?group=plg", nil)

	GetWebsitePricingV2(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "public, max-age=30, must-revalidate", recorder.Header().Get("Cache-Control"))
}

func TestGetWebsitePricingV2ReturnsServiceUnavailableWhenPricingCannotBeBuilt(t *testing.T) {
	previousBuilder := buildWebsitePricingV2Payload
	buildWebsitePricingV2Payload = func(string, time.Time) (service.WebsitePricingV2, error) {
		return service.WebsitePricingV2{}, errors.New("invalid internal ratio")
	}
	t.Cleanup(func() { buildWebsitePricingV2Payload = previousBuilder })

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/website/pricing/v2?group=plg", nil)

	GetWebsitePricingV2(ctx)

	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	require.JSONEq(t, `{"success":false,"message":"pricing temporarily unavailable"}`, recorder.Body.String())
	require.NotContains(t, recorder.Body.String(), "internal ratio")
}
