package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupOptionControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	originalRedisEnabled := common.RedisEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalLogConsumeEnabled := common.LogConsumeEnabled
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	common.RedisEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	common.OptionMapRWMutex.Lock()
	originalOptionMap := common.OptionMap
	originalCompanyLogRoutingEnabled := "false"
	if value, ok := originalOptionMap[model.OptionKeyCompanyLogRoutingEnabled]; ok {
		originalCompanyLogRoutingEnabled = value
	}
	common.OptionMap = map[string]string{}
	common.OptionMapRWMutex.Unlock()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	model.DB = db
	model.LOG_DB = db
	if err := db.AutoMigrate(&model.Option{}); err != nil {
		t.Fatalf("failed to migrate option table: %v", err)
	}
	t.Cleanup(func() {
		require.NoError(t, model.UpdateOption(model.OptionKeyCompanyLogRoutingEnabled, originalCompanyLogRoutingEnabled))
		common.RedisEnabled = originalRedisEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.LogConsumeEnabled = originalLogConsumeEnabled
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptionMap
		common.OptionMapRWMutex.Unlock()
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func newOptionRequestContext(t *testing.T, body any) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	payload, err := common.Marshal(body)
	if err != nil {
		t.Fatalf("failed to marshal request body: %v", err)
	}
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/option/bulk", bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	return ctx, recorder
}

func TestUpdateOptionsBulkPersistsSidebarAndPlaygroundModelAtomically(t *testing.T) {
	db := setupOptionControllerTestDB(t)

	ctx, recorder := newOptionRequestContext(t, map[string]any{
		"options": []map[string]any{
			{"key": "SidebarModulesAdmin", "value": `{"chat":{"enabled":true,"playground":true}}`},
			{"key": "PlaygroundDefaultModel", "value": "gemini-2.5-flash"},
		},
	})
	UpdateOptions(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected bulk option update to succeed, got message: %s", response.Message)
	}

	var sidebar model.Option
	if err := db.First(&sidebar, "key = ?", "SidebarModulesAdmin").Error; err != nil {
		t.Fatalf("failed to load sidebar option: %v", err)
	}
	if sidebar.Value != `{"chat":{"enabled":true,"playground":true}}` {
		t.Fatalf("unexpected sidebar value: %q", sidebar.Value)
	}

	var playground model.Option
	if err := db.First(&playground, "key = ?", model.OptionKeyPlaygroundDefaultModel).Error; err != nil {
		t.Fatalf("failed to load playground default model option: %v", err)
	}
	if playground.Value != "gemini-2.5-flash" {
		t.Fatalf("unexpected playground default model: %q", playground.Value)
	}

	common.OptionMapRWMutex.RLock()
	optionMapModel := common.OptionMap[model.OptionKeyPlaygroundDefaultModel]
	common.OptionMapRWMutex.RUnlock()
	if optionMapModel != "gemini-2.5-flash" {
		t.Fatalf("expected in-memory option map to update, got %q", optionMapModel)
	}
}

func TestUpdateOptionsBulkPersistsLogSettingsAtomically(t *testing.T) {
	db := setupOptionControllerTestDB(t)

	ctx, recorder := newOptionRequestContext(t, map[string]any{
		"options": []map[string]any{
			{"key": "LogConsumeEnabled", "value": "false"},
			{"key": model.OptionKeyCompanyLogRoutingEnabled, "value": "false"},
		},
	})
	UpdateOptions(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected bulk log option update to succeed, got message: %s", response.Message)
	}

	for _, key := range []string{"LogConsumeEnabled", model.OptionKeyCompanyLogRoutingEnabled} {
		var option model.Option
		if err := db.First(&option, "key = ?", key).Error; err != nil {
			t.Fatalf("failed to load %s: %v", key, err)
		}
		if option.Value != "false" {
			t.Fatalf("unexpected %s value: %q", key, option.Value)
		}
	}
}

func TestUpdateOptionsBulkPersistsCodexIdentitySettingsAtomically(t *testing.T) {
	db := setupOptionControllerTestDB(t)

	ctx, recorder := newOptionRequestContext(t, map[string]any{
		"options": []map[string]any{
			{"key": "CodexClientUserAgent", "value": "codex-cli/0.145.0 linux-x64"},
			{"key": "CodexClientVersion", "value": "0.145.0"},
			{"key": "CodexAutoSyncClientVersion", "value": "false"},
			{"key": "CodexEnforceClientIdentity", "value": "true"},
		},
	})
	UpdateOptions(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected bulk Codex identity update to succeed, got message: %s", response.Message)
	}

	want := map[string]string{
		"CodexClientUserAgent":       "codex-cli/0.145.0 linux-x64",
		"CodexClientVersion":         "0.145.0",
		"CodexAutoSyncClientVersion": "false",
		"CodexEnforceClientIdentity": "true",
	}
	for key, value := range want {
		var option model.Option
		if err := db.First(&option, "key = ?", key).Error; err != nil {
			t.Fatalf("failed to load %s: %v", key, err)
		}
		if option.Value != value {
			t.Fatalf("unexpected %s value: %q", key, option.Value)
		}
	}
}

func TestUpdateOptionsBulkRejectsUnsupportedKeysWithoutPartialWrite(t *testing.T) {
	db := setupOptionControllerTestDB(t)

	ctx, recorder := newOptionRequestContext(t, map[string]any{
		"options": []map[string]any{
			{"key": "SidebarModulesAdmin", "value": `{"chat":{"enabled":true,"playground":true}}`},
			{"key": "theme.frontend", "value": "default"},
		},
	})
	UpdateOptions(ctx)

	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatalf("expected unsupported bulk option key to fail")
	}

	var count int64
	if err := db.Model(&model.Option{}).Where("key = ?", "SidebarModulesAdmin").Count(&count).Error; err != nil {
		t.Fatalf("failed to count sidebar option rows: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no partial sidebar option write, got %d rows", count)
	}
}

func TestUpdateOptionsBulkRejectsNonStringValuesWithoutPartialWrite(t *testing.T) {
	db := setupOptionControllerTestDB(t)

	ctx, recorder := newOptionRequestContext(t, map[string]any{
		"options": []map[string]any{
			{"key": "SidebarModulesAdmin", "value": `{"chat":{"enabled":true,"playground":true}}`},
			{"key": "PlaygroundDefaultModel", "value": 123},
		},
	})
	UpdateOptions(ctx)

	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatalf("expected non-string bulk option value to fail")
	}

	var count int64
	if err := db.Model(&model.Option{}).Where("key = ?", "SidebarModulesAdmin").Count(&count).Error; err != nil {
		t.Fatalf("failed to count sidebar option rows: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no partial sidebar option write, got %d rows", count)
	}
}

func TestUpdateOptionRejectsNullInviterRewardLimit(t *testing.T) {
	db := setupOptionControllerTestDB(t)

	ctx, recorder := newOptionRequestContext(t, map[string]any{
		"key":   "QuotaForInviterMaxCount",
		"value": nil,
	})
	UpdateOption(ctx)

	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatalf("expected null inviter reward limit to fail")
	}

	var count int64
	if err := db.Model(&model.Option{}).Where("key = ?", "QuotaForInviterMaxCount").Count(&count).Error; err != nil {
		t.Fatalf("failed to count inviter reward limit option rows: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected rejected inviter reward limit not to persist, got %d rows", count)
	}
}

func TestGetOptionsOmitsRetiredInviteRewardUnlockDelay(t *testing.T) {
	setupOptionControllerTestDB(t)
	common.OptionMapRWMutex.Lock()
	common.OptionMap["InviteRewardUnlockDelaySeconds"] = "1"
	common.OptionMap["InviteFirstSubDiscountUSD"] = "5"
	common.OptionMapRWMutex.Unlock()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/option/", nil)
	GetOptions(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected option response to succeed, got message: %s", response.Message)
	}
	rawData, err := json.Marshal(response.Data)
	if err != nil {
		t.Fatalf("failed to marshal option response data: %v", err)
	}
	var options []model.Option
	if err := json.Unmarshal(rawData, &options); err != nil {
		t.Fatalf("failed to unmarshal option response data: %v", err)
	}
	keys := make(map[string]string, len(options))
	for _, option := range options {
		keys[option.Key] = option.Value
	}
	if _, ok := keys["InviteRewardUnlockDelaySeconds"]; ok {
		t.Fatalf("expected retired unlock delay option to be omitted from GET response")
	}
	if keys["InviteFirstSubDiscountUSD"] != "5" {
		t.Fatalf("expected unrelated invite subscription discount option to remain visible")
	}
}

func TestGetOptionsRedactsLowercaseTokenKeys(t *testing.T) {
	setupOptionControllerTestDB(t)
	common.OptionMapRWMutex.Lock()
	common.OptionMap["recall_campaign_setting.smtp_token"] = "activity-secret"
	common.OptionMap["legacy_token"] = "legacy-secret"
	common.OptionMap["WorkerValidKey"] = "worker-secret"
	common.OptionMap["StripeWebhookSecret"] = "stripe-secret"
	common.OptionMap["VisibleOption"] = "visible"
	common.OptionMapRWMutex.Unlock()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/option/", nil)
	GetOptions(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected option response to succeed, got message: %s", response.Message)
	}
	rawData, err := json.Marshal(response.Data)
	if err != nil {
		t.Fatalf("failed to marshal option response data: %v", err)
	}
	var options []model.Option
	if err := json.Unmarshal(rawData, &options); err != nil {
		t.Fatalf("failed to unmarshal option response data: %v", err)
	}
	keys := make(map[string]string, len(options))
	for _, option := range options {
		keys[option.Key] = option.Value
	}
	if _, ok := keys["recall_campaign_setting.smtp_token"]; ok {
		t.Fatalf("expected activity SMTP token option to be omitted from GET response")
	}
	if _, ok := keys["legacy_token"]; ok {
		t.Fatalf("expected lowercase _token option to be omitted from GET response")
	}
	if _, ok := keys["WorkerValidKey"]; ok {
		t.Fatalf("expected existing Key suffix redaction to remain")
	}
	if _, ok := keys["StripeWebhookSecret"]; ok {
		t.Fatalf("expected existing Secret suffix redaction to remain")
	}
	if keys["VisibleOption"] != "visible" {
		t.Fatalf("expected unrelated visible option to remain visible")
	}
}

func TestUpdateOptionRejectsRetiredInviteRewardUnlockDelay(t *testing.T) {
	db := setupOptionControllerTestDB(t)
	originalDelay := common.InviteRewardUnlockDelaySeconds
	common.InviteRewardUnlockDelaySeconds = 604800
	t.Cleanup(func() {
		common.InviteRewardUnlockDelaySeconds = originalDelay
	})

	ctx, recorder := newOptionRequestContext(t, map[string]any{
		"key":   "InviteRewardUnlockDelaySeconds",
		"value": "1",
	})
	UpdateOption(ctx)

	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatalf("expected retired unlock delay update to fail")
	}
	if !strings.Contains(response.Message, "retired") {
		t.Fatalf("expected retired option failure, got message: %s", response.Message)
	}
	var count int64
	if err := db.Model(&model.Option{}).Where("key = ?", "InviteRewardUnlockDelaySeconds").Count(&count).Error; err != nil {
		t.Fatalf("failed to count retired unlock delay option rows: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected retired unlock delay option not to persist, got %d rows", count)
	}
	if common.InviteRewardUnlockDelaySeconds != 604800 {
		t.Fatalf("expected retired unlock delay update not to change global, got %d", common.InviteRewardUnlockDelaySeconds)
	}
}

func TestUpdateOptionGuardsInviteFirstSubscriptionDiscountByPaymentCompliance(t *testing.T) {
	db := setupOptionControllerTestDB(t)
	paymentSetting := operation_setting.GetPaymentSetting()
	originalComplianceConfirmed := paymentSetting.ComplianceConfirmed
	originalComplianceTermsVersion := paymentSetting.ComplianceTermsVersion
	originalInviteFirstSubDiscountUSD := common.InviteFirstSubDiscountUSD
	t.Cleanup(func() {
		paymentSetting.ComplianceConfirmed = originalComplianceConfirmed
		paymentSetting.ComplianceTermsVersion = originalComplianceTermsVersion
		common.InviteFirstSubDiscountUSD = originalInviteFirstSubDiscountUSD
	})

	paymentSetting.ComplianceConfirmed = false
	paymentSetting.ComplianceTermsVersion = ""
	common.InviteFirstSubDiscountUSD = 3.75

	ctx, recorder := newOptionRequestContext(t, map[string]any{
		"key":   "InviteFirstSubDiscountUSD",
		"value": "5.25",
	})
	UpdateOption(ctx)

	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatalf("expected positive invitee subscription discount to require payment compliance")
	}
	var count int64
	if err := db.Model(&model.Option{}).Where("key = ?", "InviteFirstSubDiscountUSD").Count(&count).Error; err != nil {
		t.Fatalf("failed to count invitee subscription discount option rows: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected rejected invitee subscription discount not to persist, got %d rows", count)
	}
	if common.InviteFirstSubDiscountUSD != 3.75 {
		t.Fatalf("expected rejected update not to change global discount, got %v", common.InviteFirstSubDiscountUSD)
	}

	zeroCtx, zeroRecorder := newOptionRequestContext(t, map[string]any{
		"key":   "InviteFirstSubDiscountUSD",
		"value": "0",
	})
	UpdateOption(zeroCtx)

	zeroResponse := decodeAPIResponse(t, zeroRecorder)
	if !zeroResponse.Success {
		t.Fatalf("expected zero invitee subscription discount to remain allowed, got message: %s", zeroResponse.Message)
	}
	var zeroOption model.Option
	if err := db.First(&zeroOption, "key = ?", "InviteFirstSubDiscountUSD").Error; err != nil {
		t.Fatalf("failed to load zero invitee subscription discount option: %v", err)
	}
	if zeroOption.Value != "0" {
		t.Fatalf("unexpected zero invitee subscription discount value: %q", zeroOption.Value)
	}
	if common.InviteFirstSubDiscountUSD != 0 {
		t.Fatalf("expected zero update to change global discount to 0, got %v", common.InviteFirstSubDiscountUSD)
	}

	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	positiveCtx, positiveRecorder := newOptionRequestContext(t, map[string]any{
		"key":   "InviteFirstSubDiscountUSD",
		"value": "6.25",
	})
	UpdateOption(positiveCtx)

	positiveResponse := decodeAPIResponse(t, positiveRecorder)
	if !positiveResponse.Success {
		t.Fatalf("expected confirmed positive invitee subscription discount to succeed, got message: %s", positiveResponse.Message)
	}
	var positiveOption model.Option
	if err := db.First(&positiveOption, "key = ?", "InviteFirstSubDiscountUSD").Error; err != nil {
		t.Fatalf("failed to load positive invitee subscription discount option: %v", err)
	}
	if positiveOption.Value != "6.25" {
		t.Fatalf("unexpected positive invitee subscription discount value: %q", positiveOption.Value)
	}
	if common.InviteFirstSubDiscountUSD != 6.25 {
		t.Fatalf("expected confirmed update to change global discount to 6.25, got %v", common.InviteFirstSubDiscountUSD)
	}
}

func TestUpdateOptionRejectsInvalidGroupModelRatioAtController(t *testing.T) {
	db := setupOptionControllerTestDB(t)

	ctx, recorder := newOptionRequestContext(t, map[string]any{
		"key":   "GroupModelRatio",
		"value": `{"plg":{"gpt-5.5":-0.1}}`,
	})
	UpdateOption(ctx)

	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatalf("expected invalid group model ratio to fail")
	}

	var count int64
	if err := db.Model(&model.Option{}).Where("key = ?", "GroupModelRatio").Count(&count).Error; err != nil {
		t.Fatalf("failed to count group model ratio option rows: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected rejected group model ratio not to persist, got %d rows", count)
	}
}
