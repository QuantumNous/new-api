package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

func setupFlatkeyUtilityControllerTest(t *testing.T) {
	t.Helper()

	db := setupInitialTokenControllerTestDB(t)
	originalQuotaPerUnit := common.QuotaPerUnit
	originalDisplayType := operation_setting.GetQuotaDisplayType()
	t.Cleanup(func() {
		common.QuotaPerUnit = originalQuotaPerUnit
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalDisplayType
	})

	common.QuotaPerUnit = 100
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	if err := db.Create(&model.User{
		Id:        901,
		Username:  "flatkey-cli",
		Quota:     4200,
		UsedQuota: 800,
		Status:    1,
	}).Error; err != nil {
		t.Fatalf("failed to seed user: %v", err)
	}
}

func TestGetFlatkeyCreditsReturnsRawAccountCredits(t *testing.T) {
	setupFlatkeyUtilityControllerTest(t)

	ctx, recorder := flatkeyUtilityContext(http.MethodGet, "/v1/credits")
	GetFlatkeyCredits(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	var body flatkeyCreditsResponse
	if err := common.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body.Remaining != 42 || body.Used != 8 {
		t.Fatalf("credits=%+v, want remaining=42 used=8", body)
	}
}

func TestGetFlatkeyStatusReturnsRawOkStatus(t *testing.T) {
	setupFlatkeyUtilityControllerTest(t)

	ctx, recorder := flatkeyUtilityContext(http.MethodGet, "/v1/status")
	GetFlatkeyStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	var body struct {
		Status    string  `json:"status"`
		Remaining float64 `json:"remaining"`
		Used      float64 `json:"used"`
	}
	if err := common.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body.Status != "ok" || body.Remaining != 42 || body.Used != 8 {
		t.Fatalf("status body=%+v, want ok with remaining=42 used=8", body)
	}
}

func flatkeyUtilityContext(method string, target string) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, nil)
	ctx.Set("id", 901)
	return ctx, recorder
}
