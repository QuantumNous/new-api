package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

type dashboardRangeResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func newDashboardRangeTestContext(t *testing.T, target string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, target, nil)
	return ctx, recorder
}

func decodeDashboardRangeResponse(t *testing.T, recorder *httptest.ResponseRecorder) dashboardRangeResponse {
	t.Helper()

	var response dashboardRangeResponse
	if err := common.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode dashboard response: %v", err)
	}
	return response
}

func TestGetUserQuotaDatesRejectsRangesOverOneMonth(t *testing.T) {
	ctx, recorder := newDashboardRangeTestContext(
		t,
		"/api/data/self?start_timestamp=0&end_timestamp=2592001",
	)
	ctx.Set("id", 1)

	GetUserQuotaDates(ctx)

	response := decodeDashboardRangeResponse(t, recorder)
	if response.Success {
		t.Fatal("expected self quota request to be rejected")
	}
	if response.Message != "时间跨度不能超过 1 个月" {
		t.Fatalf("unexpected self quota range message: %q", response.Message)
	}
}

func TestGetUserChannelQuotaDatesRejectsRangesOverOneMonth(t *testing.T) {
	ctx, recorder := newDashboardRangeTestContext(
		t,
		"/api/data/self/channels?start_timestamp=0&end_timestamp=2592001",
	)
	ctx.Set("id", 1)

	GetUserChannelQuotaDates(ctx)

	response := decodeDashboardRangeResponse(t, recorder)
	if response.Success {
		t.Fatal("expected self channel quota request to be rejected")
	}
	if response.Message != "时间跨度不能超过 1 个月" {
		t.Fatalf("unexpected self channel range message: %q", response.Message)
	}
}

func TestGetAllChannelQuotaDatesRejectsRangesOverThreeMonths(t *testing.T) {
	ctx, recorder := newDashboardRangeTestContext(
		t,
		"/api/data/channels?start_timestamp=0&end_timestamp=7776001",
	)

	GetAllChannelQuotaDates(ctx)

	response := decodeDashboardRangeResponse(t, recorder)
	if response.Success {
		t.Fatal("expected admin channel quota request to be rejected")
	}
	if response.Message != "时间跨度不能超过 3 个月" {
		t.Fatalf("unexpected admin channel range message: %q", response.Message)
	}
}
