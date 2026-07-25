package controller

import (
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type userModelAccessResponse struct {
	Success bool                    `json:"success"`
	Message string                  `json:"message"`
	Data    service.UserModelAccess `json:"data"`
}

func withControllerModelAccessGroups(t *testing.T, groupRatios map[string]float64, usable map[string]string, autoGroups []string) {
	t.Helper()
	originalGroupRatios := ratio_setting.GroupRatio2JSONString()
	originalDefaultAuto := setting.DefaultUseAutoGroup
	groupRatioJSON, err := common.Marshal(groupRatios)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(string(groupRatioJSON)))
	withModelListGroupSettings(t, usable, autoGroups)
	setting.DefaultUseAutoGroup = false
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatios))
		setting.DefaultUseAutoGroup = originalDefaultAuto
	})
}

func withControllerGroupModelRatios(t *testing.T, ratios map[string]map[string]float64) {
	t.Helper()
	original := ratio_setting.GroupModelRatio2JSONString()
	ratioJSON, err := common.Marshal(ratios)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(string(ratioJSON)))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(original))
	})
}

func requestUserModelAccess(t *testing.T, userID int) (*httptest.ResponseRecorder, userModelAccessResponse) {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/model-access", nil)
	ctx.Set("id", userID)
	GetUserModelAccess(ctx)

	var payload userModelAccessResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success, recorder.Body.String())
	return recorder, payload
}

func TestGetUserModelAccessOrdinaryAutoUnionAndPublicMetadata(t *testing.T) {
	withSelfUseModeEnabled(t)
	withControllerModelAccessGroups(t,
		map[string]float64{"default": 0, "vip": 2, "plg": 0.9},
		map[string]string{"default": "Default", "vip": "VIP", "auto": "Automatic"},
		[]string{"default", "vip"},
	)
	withControllerGroupModelRatios(t, map[string]map[string]float64{
		"default": {"public-model": 0, "inaccessible-model": 8},
		"vip":     {"vip-model": 0.6},
		"auto":    {"shared-model": 9},
	})
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.ModelAvailabilityState{}))
	require.NoError(t, db.Create(&model.User{Id: 501, Username: "ordinary-model-access", Password: "password", Group: "default", Status: common.UserStatusEnabled}).Error)
	createAvailableModelFixture(t, db, 501, common.ChannelStatusEnabled, map[string][]string{
		"default": {"public-model", "shared-model"},
		"vip":     {"shared-model", "vip-model"},
	})
	vendor := model.Vendor{Name: "Public Vendor", Icon: "public", Status: 1}
	require.NoError(t, db.Create(&vendor).Error)
	require.NoError(t, db.Create(&model.Model{ModelName: "public-model", VendorID: vendor.Id, Status: 1}).Error)

	recorder, payload := requestUserModelAccess(t, 501)
	access := payload.Data
	require.Equal(t, service.ModelAccessScopeSelectableGroup, access.ScopeMode)
	require.NotNil(t, access.IdentityScope)
	require.Equal(t, "default", *access.IdentityScope)
	require.Equal(t, []string{"public-model", "shared-model"}, access.IdentityModelIDs)
	require.Equal(t, map[string]float64{"public-model": 0}, access.IdentityModelRatios)
	require.NotNil(t, access.IdentityDefaultRatio)
	require.Zero(t, *access.IdentityDefaultRatio)
	require.NotContains(t, access.IdentityModelRatios, "inaccessible-model")
	require.Empty(t, access.AccountModelIDs)
	require.Empty(t, access.AccountModelRatios)
	require.Nil(t, access.AccountDefaultRatio)
	require.Equal(t, []string{"auto", "default", "vip"}, modelAccessScopeIDs(access.Groups))
	require.NotNil(t, access.CreateDefaultScope)
	require.Equal(t, "default", *access.CreateDefaultScope)
	require.Equal(t, []string{"public-model", "shared-model", "vip-model"}, referencedModelAccessIDs(access))
	require.Equal(t, referencedModelAccessIDs(access), modelAccessIDs(access.Models))
	for _, scope := range access.Groups {
		if scope.ID == "auto" {
			require.Nil(t, scope.Ratio)
			require.Empty(t, scope.ModelRatios)
		}
		if scope.ID == "vip" {
			require.Equal(t, map[string]float64{"vip-model": 0.6}, scope.ModelRatios)
		}
	}

	metadata := make(map[string]service.ModelAccessModel, len(access.Models))
	for _, item := range access.Models {
		metadata[item.ID] = item
	}
	require.Equal(t, "Public Vendor", metadata["public-model"].Vendor.Name)
	require.Nil(t, metadata["vip-model"].Vendor)
	require.Equal(t, "public-model", metadata["public-model"].AllowlistMatchKey)
	require.Equal(t, []constant.EndpointType{constant.EndpointTypeOpenAI}, metadata["public-model"].SupportedEndpointTypes)
	require.Equal(t, service.ModelAvailabilityUnknown, metadata["public-model"].AvailabilityStatus)

	var raw map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &raw))
	requireExactJSONKeys(t, raw, "success", "message", "data")
	rawData := raw["data"].(map[string]any)
	requireExactJSONKeys(t, rawData,
		"scope_mode", "identity_scope", "identity_model_ids", "identity_model_ratios", "identity_default_ratio",
		"create_default_scope", "groups", "account_model_ids", "account_model_ratios", "account_default_ratio", "models",
	)
	require.IsType(t, "", rawData["scope_mode"])
	require.IsType(t, "", rawData["identity_scope"])
	require.IsType(t, []any{}, rawData["identity_model_ids"])
	require.IsType(t, map[string]any{}, rawData["identity_model_ratios"])
	require.Equal(t, float64(0), rawData["identity_default_ratio"])
	require.IsType(t, "", rawData["create_default_scope"])
	require.IsType(t, []any{}, rawData["groups"])
	require.IsType(t, []any{}, rawData["account_model_ids"])
	require.IsType(t, map[string]any{}, rawData["account_model_ratios"])
	require.Empty(t, rawData["account_model_ratios"])
	require.Nil(t, rawData["account_default_ratio"])
	require.IsType(t, []any{}, rawData["models"])
	rawGroups := rawData["groups"].([]any)
	require.NotEmpty(t, rawGroups)
	requireExactJSONKeys(t, rawGroups[0].(map[string]any), "id", "label", "description", "ratio", "model_ids", "model_ratios")
	for _, rawGroup := range rawGroups {
		group := rawGroup.(map[string]any)
		require.IsType(t, map[string]any{}, group["model_ratios"])
		if group["id"] == "auto" {
			require.Nil(t, group["ratio"])
			require.Empty(t, group["model_ratios"])
		}
	}
	rawModels := rawData["models"].([]any)
	require.NotEmpty(t, rawModels)
	requireExactJSONKeys(t, rawModels[0].(map[string]any),
		"id", "allowlist_match_key", "vendor", "supported_endpoint_types", "availability_status",
	)
	for _, rawModel := range rawModels {
		item := rawModel.(map[string]any)
		require.IsType(t, "", item["id"])
		require.IsType(t, "", item["allowlist_match_key"])
		require.IsType(t, []any{}, item["supported_endpoint_types"])
		require.IsType(t, "", item["availability_status"])
		if item["vendor"] != nil {
			requireExactJSONKeys(t, item["vendor"].(map[string]any), "id", "name", "icon")
		}
	}
	require.NotContains(t, recorder.Body.String(), "contract-test")
	require.NotContains(t, recorder.Body.String(), "Internal Supplier")
}

func TestGetUserModelAccessPLGUsesPrivateFixedAccountShape(t *testing.T) {
	withSelfUseModeEnabled(t)
	withControllerModelAccessGroups(t,
		map[string]float64{"default": 1, "plg": 0},
		map[string]string{"default": "Default", "auto": "Automatic"},
		[]string{"default"},
	)
	withControllerGroupModelRatios(t, map[string]map[string]float64{
		"plg": {"account-model": 0.7, "private-model": 9},
	})
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.ModelAvailabilityState{}))
	require.NoError(t, db.Create(&model.User{Id: 502, Username: "fixed-model-access", Password: "password", Group: "plg", Status: common.UserStatusEnabled}).Error)
	priority := int64(0)
	weight := uint(100)
	require.NoError(t, db.Create(&model.Channel{
		Id: 502, Name: "Internal Supplier", Key: "internal-secret", Type: constant.ChannelTypeOpenAI,
		Status: common.ChannelStatusEnabled, Models: "account-model", Group: "plg", Priority: &priority, Weight: &weight,
	}).Error)
	require.NoError(t, db.Create(&model.Ability{Group: "plg", Model: "account-model", ChannelId: 502, Enabled: true, Priority: &priority, Weight: weight}).Error)
	vendor := model.Vendor{Name: "Account Vendor", Icon: "account", Status: 1}
	require.NoError(t, db.Create(&vendor).Error)
	require.NoError(t, db.Create(&model.Model{ModelName: "account-model", VendorID: vendor.Id, Status: 1}).Error)

	recorder, payload := requestUserModelAccess(t, 502)
	access := payload.Data
	require.Equal(t, service.ModelAccessScopeFixedAccount, access.ScopeMode)
	require.Nil(t, access.IdentityScope)
	require.Empty(t, access.IdentityModelIDs)
	require.Empty(t, access.IdentityModelRatios)
	require.Nil(t, access.IdentityDefaultRatio)
	require.Nil(t, access.CreateDefaultScope)
	require.Empty(t, access.Groups)
	require.Equal(t, []string{"account-model"}, access.AccountModelIDs)
	require.Equal(t, map[string]float64{"account-model": 0.7}, access.AccountModelRatios)
	require.NotNil(t, access.AccountDefaultRatio)
	require.Zero(t, *access.AccountDefaultRatio)
	require.NotContains(t, access.AccountModelRatios, "private-model")
	require.Equal(t, []string{"account-model"}, modelAccessIDs(access.Models))
	require.Equal(t, "Account Vendor", access.Models[0].Vendor.Name)
	require.Equal(t, []constant.EndpointType{constant.EndpointTypeOpenAI}, access.Models[0].SupportedEndpointTypes)
	require.Equal(t, service.ModelAvailabilityUnknown, access.Models[0].AvailabilityStatus)
	var raw map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &raw))
	requireExactJSONKeys(t, raw, "success", "message", "data")
	rawData := raw["data"].(map[string]any)
	requireExactJSONKeys(t, rawData,
		"scope_mode", "identity_scope", "identity_model_ids", "identity_model_ratios", "identity_default_ratio",
		"create_default_scope", "groups", "account_model_ids", "account_model_ratios", "account_default_ratio", "models",
	)
	require.Nil(t, rawData["identity_scope"])
	require.Nil(t, rawData["create_default_scope"])
	require.IsType(t, []any{}, rawData["identity_model_ids"])
	require.IsType(t, map[string]any{}, rawData["identity_model_ratios"])
	require.Empty(t, rawData["identity_model_ratios"])
	require.Nil(t, rawData["identity_default_ratio"])
	require.IsType(t, []any{}, rawData["groups"])
	require.IsType(t, []any{}, rawData["account_model_ids"])
	require.IsType(t, map[string]any{}, rawData["account_model_ratios"])
	require.Equal(t, float64(0.7), rawData["account_model_ratios"].(map[string]any)["account-model"])
	require.Equal(t, float64(0), rawData["account_default_ratio"])
	require.IsType(t, []any{}, rawData["models"])
	rawModel := rawData["models"].([]any)[0].(map[string]any)
	requireExactJSONKeys(t, rawModel,
		"id", "allowlist_match_key", "vendor", "supported_endpoint_types", "availability_status",
	)
	requireExactJSONKeys(t, rawModel["vendor"].(map[string]any), "id", "name", "icon")
	require.NotContains(t, recorder.Body.String(), `"plg"`)
	assertNoInternalModelAccessFields(t, recorder.Body.String())
	require.NotContains(t, recorder.Body.String(), "Internal Supplier")
	require.NotContains(t, recorder.Body.String(), "internal-secret")
}

func TestGetUserModelAccessIdentityOnlyDoesNotExpandSelectableScopes(t *testing.T) {
	withSelfUseModeEnabled(t)
	withControllerModelAccessGroups(t,
		map[string]float64{"default": 1, "plg": 0.9},
		map[string]string{},
		[]string{"default"},
	)
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.ModelAvailabilityState{}))
	require.NoError(t, db.Create(&model.User{Id: 503, Username: "identity-only-model-access", Password: "password", Group: "private", Status: common.UserStatusEnabled}).Error)
	createAvailableModelFixture(t, db, 503, common.ChannelStatusEnabled, map[string][]string{"private": {"identity-model"}})

	_, payload := requestUserModelAccess(t, 503)
	access := payload.Data
	require.Equal(t, service.ModelAccessScopeSelectableGroup, access.ScopeMode)
	require.Equal(t, []string{"identity-model"}, access.IdentityModelIDs)
	require.Empty(t, access.Groups)
	require.Nil(t, access.CreateDefaultScope)
	require.Equal(t, []string{"identity-model"}, modelAccessIDs(access.Models))
}

func TestAvailableModelsUsesOnlyAuthenticatedContextAndFailsClosedOnInvalidAllowlist(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)
	createAvailableModelFixture(t, db, 504, common.ChannelStatusEnabled, map[string][]string{"default": {"context-model"}})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/available_models", nil)
	ctx.Set("id", 999999)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimit, "invalid-map-type")

	AvailableModels(ctx)
	var payload availableModelsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success, recorder.Body.String())
	require.Empty(t, payload.Data, "enabled invalid allowlist context must fail closed")
}

func modelAccessScopeIDs(scopes []service.ModelAccessScope) []string {
	ids := make([]string, len(scopes))
	for i, scope := range scopes {
		ids[i] = scope.ID
	}
	return ids
}

func modelAccessIDs(models []service.ModelAccessModel) []string {
	ids := make([]string, len(models))
	for i, item := range models {
		ids[i] = item.ID
	}
	sort.Strings(ids)
	return ids
}

func referencedModelAccessIDs(access service.UserModelAccess) []string {
	set := make(map[string]struct{})
	for _, id := range access.IdentityModelIDs {
		set[id] = struct{}{}
	}
	for _, id := range access.AccountModelIDs {
		set[id] = struct{}{}
	}
	for _, scope := range access.Groups {
		for _, id := range scope.ModelIDs {
			set[id] = struct{}{}
		}
	}
	ids := make([]string, 0, len(set))
	for id := range set {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func assertNoInternalModelAccessFields(t *testing.T, body string) {
	t.Helper()
	for _, forbidden := range []string{"channel", "adapter", "adaptor", "supplier"} {
		require.False(t, strings.Contains(strings.ToLower(body), forbidden), body)
	}
}
