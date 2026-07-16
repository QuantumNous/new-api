package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type pricingAPIResponse struct {
	Success bool                        `json:"success"`
	Message string                      `json:"message"`
	Data    *AdjustModelPricingResponse `json:"data"`
}

type providerModelsAPIResponse struct {
	Success bool                        `json:"success"`
	Message string                      `json:"message"`
	Data    *ListProviderModelsResponse `json:"data"`
}

func openPricingControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.Option{}); err != nil {
		t.Fatalf("migrate option: %v", err)
	}
	model.DB = db
	model.LOG_DB = db

	common.OptionMap = make(map[string]string)
	ratio_setting.InitRatioSettings()

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func newPricingContext(t *testing.T, method, target string, body any) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		payload, err := common.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(payload)
	} else {
		reader = bytes.NewReader(nil)
	}
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, reader)
	if body != nil {
		ctx.Request.Header.Set("Content-Type", "application/json")
	}
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleRootUser)
	return ctx, recorder
}

func decodePricingResponse(t *testing.T, recorder *httptest.ResponseRecorder) pricingAPIResponse {
	t.Helper()
	var resp pricingAPIResponse
	if err := common.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v body=%s", err, recorder.Body.String())
	}
	return resp
}

// ---------- AdjustModelPricing ----------

func TestAdjustModelPricing_HappyPath_DefaultScopes(t *testing.T) {
	openPricingControllerTestDB(t)
	beforeRatio := ratio_setting.GetModelRatioCopy()["gpt-4o"]
	if beforeRatio == 0 {
		t.Skip("gpt-4o not in defaults; skipping")
	}

	req := AdjustModelPricingRequest{
		Models:     []string{"gpt-4o"},
		Multiplier: 1.10,
	}
	ctx, rec := newPricingContext(t, http.MethodPost, "/api/option/pricing/adjust", req)
	AdjustModelPricing(ctx)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200 body=%s", rec.Code, rec.Body.String())
	}
	resp := decodePricingResponse(t, rec)
	if !resp.Success || resp.Data == nil {
		t.Fatalf("expected success: %+v", resp)
	}
	if len(resp.Data.Applied) == 0 {
		t.Fatalf("expected at least one applied entry, got %+v", resp.Data)
	}

	afterRatio := ratio_setting.GetModelRatioCopy()["gpt-4o"]
	expected := beforeRatio * 1.10
	if abs(afterRatio-expected) > 1e-9 {
		t.Errorf("memory map not updated: got %v want %v", afterRatio, expected)
	}

	// Persisted in DB
	var opt model.Option
	if err := model.DB.First(&opt, "key = ?", "ModelRatio").Error; err != nil {
		t.Fatalf("read back ModelRatio option: %v", err)
	}
	if !strings.Contains(opt.Value, "gpt-4o") {
		t.Errorf("persisted ModelRatio missing gpt-4o: %s", opt.Value)
	}
}

func TestAdjustModelPricing_Discount(t *testing.T) {
	openPricingControllerTestDB(t)
	before := ratio_setting.GetModelRatioCopy()["gpt-4o"]
	if before == 0 {
		t.Skip("gpt-4o not in defaults")
	}
	req := AdjustModelPricingRequest{
		Models:     []string{"gpt-4o"},
		Multiplier: 0.5,
	}
	ctx, rec := newPricingContext(t, http.MethodPost, "/api/option/pricing/adjust", req)
	AdjustModelPricing(ctx)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body=%s", rec.Code, rec.Body.String())
	}
	after := ratio_setting.GetModelRatioCopy()["gpt-4o"]
	if abs(after-before*0.5) > 1e-9 {
		t.Errorf("discount not applied: before=%v after=%v", before, after)
	}
}

func TestAdjustModelPricing_ExplicitScopes(t *testing.T) {
	openPricingControllerTestDB(t)
	beforeR := ratio_setting.GetModelRatioCopy()["gpt-4o"]
	beforeP := ratio_setting.GetModelPriceCopy()["dall-e-3"]
	if beforeR == 0 || beforeP == 0 {
		t.Skip("required defaults missing")
	}

	req := AdjustModelPricingRequest{
		Models:     []string{"gpt-4o", "dall-e-3"},
		Multiplier: 2.0,
		Scopes:     []string{"model_ratio"}, // only ratio — price should NOT change
	}
	ctx, rec := newPricingContext(t, http.MethodPost, "/api/option/pricing/adjust", req)
	AdjustModelPricing(ctx)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	resp := decodePricingResponse(t, rec)
	if len(resp.Data.OptionKeysWritten) != 1 || resp.Data.OptionKeysWritten[0] != "ModelRatio" {
		t.Errorf("only ModelRatio should be written, got %v", resp.Data.OptionKeysWritten)
	}
	if got := ratio_setting.GetModelPriceCopy()["dall-e-3"]; got != beforeP {
		t.Errorf("ModelPrice for dall-e-3 should remain %v, got %v", beforeP, got)
	}
	if got := ratio_setting.GetModelRatioCopy()["gpt-4o"]; abs(got-beforeR*2.0) > 1e-9 {
		t.Errorf("ModelRatio for gpt-4o should double: before=%v got=%v", beforeR, got)
	}
}

func TestAdjustModelPricing_MissingModelSkipped(t *testing.T) {
	openPricingControllerTestDB(t)
	req := AdjustModelPricingRequest{
		Models:     []string{"this-model-does-not-exist-xyz"},
		Multiplier: 1.10,
	}
	ctx, rec := newPricingContext(t, http.MethodPost, "/api/option/pricing/adjust", req)
	AdjustModelPricing(ctx)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body=%s", rec.Code, rec.Body.String())
	}
	resp := decodePricingResponse(t, rec)
	if len(resp.Data.Applied) != 0 {
		t.Errorf("expected 0 applied, got %+v", resp.Data.Applied)
	}
	if len(resp.Data.Skipped) == 0 {
		t.Errorf("expected at least one skip entry, got 0")
	}
	for _, s := range resp.Data.Skipped {
		if s.Reason != "no_entry" {
			t.Errorf("unexpected skip reason: %+v", s)
		}
	}
	if len(resp.Data.OptionKeysWritten) != 0 {
		t.Errorf("no option keys should be written when all skipped, got %v", resp.Data.OptionKeysWritten)
	}
	// DB should not have ModelRatio row written
	var count int64
	model.DB.Model(&model.Option{}).Where("key = ?", "ModelRatio").Count(&count)
	if count != 0 {
		t.Errorf("ModelRatio option row should not exist when nothing applied")
	}
}

func TestAdjustModelPricing_EmptyModels(t *testing.T) {
	openPricingControllerTestDB(t)
	req := AdjustModelPricingRequest{Models: []string{}, Multiplier: 1.10}
	ctx, rec := newPricingContext(t, http.MethodPost, "/api/option/pricing/adjust", req)
	AdjustModelPricing(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400", rec.Code)
	}
}

func TestAdjustModelPricing_BatchTooLarge(t *testing.T) {
	openPricingControllerTestDB(t)
	models := make([]string, adjustPricingMaxModels+1)
	for i := range models {
		models[i] = fmt.Sprintf("m%d", i)
	}
	req := AdjustModelPricingRequest{Models: models, Multiplier: 1.10}
	ctx, rec := newPricingContext(t, http.MethodPost, "/api/option/pricing/adjust", req)
	AdjustModelPricing(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400", rec.Code)
	}
}

func TestAdjustModelPricing_InvalidMultiplier(t *testing.T) {
	openPricingControllerTestDB(t)
	for _, bad := range []float64{0, -1, -0.01} {
		req := AdjustModelPricingRequest{Models: []string{"gpt-4o"}, Multiplier: bad}
		ctx, rec := newPricingContext(t, http.MethodPost, "/api/option/pricing/adjust", req)
		AdjustModelPricing(ctx)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("multiplier=%v: status got %d want 400", bad, rec.Code)
		}
	}
}

func TestAdjustModelPricing_UnknownScope(t *testing.T) {
	openPricingControllerTestDB(t)
	req := AdjustModelPricingRequest{
		Models:     []string{"gpt-4o"},
		Multiplier: 1.10,
		Scopes:     []string{"model_ratio", "not_a_real_scope"},
	}
	ctx, rec := newPricingContext(t, http.MethodPost, "/api/option/pricing/adjust", req)
	AdjustModelPricing(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

func TestAdjustModelPricing_DuplicateScopesDeduped(t *testing.T) {
	openPricingControllerTestDB(t)
	before := ratio_setting.GetModelRatioCopy()["gpt-4o"]
	if before == 0 {
		t.Skip("gpt-4o missing")
	}
	req := AdjustModelPricingRequest{
		Models:     []string{"gpt-4o"},
		Multiplier: 1.10,
		Scopes:     []string{"model_ratio", "model_ratio", "model_ratio"},
	}
	ctx, rec := newPricingContext(t, http.MethodPost, "/api/option/pricing/adjust", req)
	AdjustModelPricing(ctx)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	after := ratio_setting.GetModelRatioCopy()["gpt-4o"]
	if abs(after-before*1.10) > 1e-9 {
		t.Errorf("expected single application: before=%v after=%v expected=%v", before, after, before*1.10)
	}
}

// ---------- ListProviderModels ----------

func TestListProviderModels_OpenAI(t *testing.T) {
	openPricingControllerTestDB(t)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet,
		fmt.Sprintf("/api/option/pricing/models/%d", constant.ChannelTypeOpenAI), nil)
	ctx.Params = gin.Params{{Key: "channel_type", Value: fmt.Sprintf("%d", constant.ChannelTypeOpenAI)}}
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleRootUser)
	ListProviderModels(ctx)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status %d body=%s", recorder.Code, recorder.Body.String())
	}
	var resp providerModelsAPIResponse
	if err := common.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !resp.Success || resp.Data == nil {
		t.Fatalf("expected success: %+v", resp)
	}
	if resp.Data.ChannelType != constant.ChannelTypeOpenAI {
		t.Errorf("channel_type mismatch: got %d", resp.Data.ChannelType)
	}
	if len(resp.Data.Models) == 0 {
		t.Errorf("expected non-empty models for OpenAI")
	}
	foundGPT := false
	for _, m := range resp.Data.Models {
		if strings.HasPrefix(m, "gpt-") {
			foundGPT = true
			break
		}
	}
	if !foundGPT {
		t.Errorf("expected at least one gpt-* model in OpenAI list, got %v", resp.Data.Models)
	}
}

func TestListProviderModels_InvalidChannelType(t *testing.T) {
	openPricingControllerTestDB(t)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/option/pricing/models/9999", nil)
	ctx.Params = gin.Params{{Key: "channel_type", Value: "9999"}}
	ListProviderModels(ctx)
	if recorder.Code != http.StatusNotFound {
		t.Errorf("status: got %d want 404", recorder.Code)
	}
}

func TestListProviderModels_NonNumericParam(t *testing.T) {
	openPricingControllerTestDB(t)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/option/pricing/models/abc", nil)
	ctx.Params = gin.Params{{Key: "channel_type", Value: "abc"}}
	ListProviderModels(ctx)
	if recorder.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", recorder.Code)
	}
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}
