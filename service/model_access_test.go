package service

import (
	"fmt"
	"os"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type modelAccessTestSettings struct {
	modelRatios      string
	modelPrices      string
	groupRatios      string
	groupModelRatios string
	usable           string
	autoGroups       string
	billing          map[string]string
	selfUse          bool
}

func setupServiceModelAccessDB(t *testing.T) (*gorm.DB, *atomic.Int64) {
	t.Helper()
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalIsMaster := common.IsMasterNode
	originalSQLitePath := common.SQLitePath
	originalRedis := common.RedisEnabled
	originalSQLite := common.UsingSQLite
	originalMySQL := common.UsingMySQL
	originalPostgreSQL := common.UsingPostgreSQL
	originalDSN, hadDSN := os.LookupEnv("SQL_DSN")

	settings := modelAccessTestSettings{
		modelRatios:      ratio_setting.ModelRatio2JSONString(),
		modelPrices:      ratio_setting.ModelPrice2JSONString(),
		groupRatios:      ratio_setting.GroupRatio2JSONString(),
		groupModelRatios: ratio_setting.GroupModelRatio2JSONString(),
		usable:           setting.UserUsableGroups2JSONString(),
		autoGroups:       setting.AutoGroups2JsonString(),
		billing:          map[string]string{},
		selfUse:          operation_setting.SelfUseModeEnabled,
	}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		if strings.HasPrefix(key, "billing_setting.") {
			settings.billing[key] = value
		}
		return nil
	}))

	common.IsMasterNode = false
	common.SQLitePath = fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	common.RedisEnabled = false
	common.UsingSQLite = false
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	require.NoError(t, os.Setenv("SQL_DSN", "local"))
	require.NoError(t, model.InitDB())
	db := model.DB
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.Model{}, &model.Vendor{}, &model.ModelAvailabilityState{}))

	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{}`))
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":2,"plg":0.9}`))
	require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(`{}`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP","auto":"Auto"}`))
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["default","vip"]`))
	operation_setting.SelfUseModeEnabled = false

	var queryCount atomic.Int64
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register("service_model_access_test:count", func(*gorm.DB) {
		queryCount.Add(1)
	}))
	require.NoError(t, db.Callback().Row().Before("gorm:row").Register("service_model_access_test:count_row", func(*gorm.DB) {
		queryCount.Add(1)
	}))

	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(settings.modelRatios))
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(settings.modelPrices))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(settings.groupRatios))
		require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(settings.groupModelRatios))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(settings.usable))
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(settings.autoGroups))
		require.NoError(t, config.GlobalConfig.LoadFromDB(settings.billing))
		operation_setting.SelfUseModeEnabled = settings.selfUse
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.IsMasterNode = originalIsMaster
		common.SQLitePath = originalSQLitePath
		common.RedisEnabled = originalRedis
		common.UsingSQLite = originalSQLite
		common.UsingMySQL = originalMySQL
		common.UsingPostgreSQL = originalPostgreSQL
		if hadDSN {
			require.NoError(t, os.Setenv("SQL_DSN", originalDSN))
		} else {
			require.NoError(t, os.Unsetenv("SQL_DSN"))
		}
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})
	return db, &queryCount
}

func seedModelAccessScope(t *testing.T, db *gorm.DB, channelID int, group string, channelType int, modelNames ...string) {
	t.Helper()
	priority := int64(0)
	weight := uint(100)
	require.NoError(t, db.Create(&model.Channel{
		Id: channelID, Type: channelType, Status: common.ChannelStatusEnabled, Key: fmt.Sprintf("key-%d", channelID),
		Models: strings.Join(modelNames, ","), Group: group, Priority: &priority, Weight: &weight,
	}).Error)
	abilities := make([]model.Ability, 0, len(modelNames))
	for _, modelName := range modelNames {
		abilities = append(abilities, model.Ability{Group: group, Model: modelName, ChannelId: channelID, Enabled: true, Priority: &priority, Weight: weight})
	}
	require.NoError(t, db.Create(&abilities).Error)
}

func setModelAccessBilling(t *testing.T, ratios map[string]float64, modes, expressions map[string]string) {
	t.Helper()
	ratioJSON, err := common.Marshal(ratios)
	require.NoError(t, err)
	modeJSON, err := common.Marshal(modes)
	require.NoError(t, err)
	exprJSON, err := common.Marshal(expressions)
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(ratioJSON)))
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": string(modeJSON),
		"billing_setting.billing_expr": string(exprJSON),
	}))
}

func TestTokenAllowsModelUsesCanonicalMatching(t *testing.T) {
	require.True(t, TokenAllowsModel(map[string]bool{"gpt-4-gizmo-*": true}, "gpt-4-gizmo-customer"))
	require.True(t, TokenAllowsModel(map[string]bool{"gemini-2.5-pro-thinking-*": true}, "gemini-2.5-pro-thinking-8192"))
	require.False(t, TokenAllowsModel(map[string]bool{"gpt-4-gizmo-*": false}, "gpt-4-gizmo-customer"))
	require.False(t, TokenAllowsModel(nil, "gpt-5.5"))
	require.False(t, TokenAllowsModel(map[string]bool{"gpt-5.5": true}, " gpt-5.5"))
	require.False(t, TokenAllowsModel(map[string]bool{"gpt-5.5": true}, "gpt-5.5 "))
	require.False(t, TokenAllowsModel(map[string]bool{"gpt-4-gizmo-*": true}, " gpt-4-gizmo-customer"))
}

func TestUserAcceptsUnpricedModelsHonorsUserOptIn(t *testing.T) {
	original := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = false
	t.Cleanup(func() { operation_setting.SelfUseModeEnabled = original })
	settingJSON, err := common.Marshal(dto.UserSetting{AcceptUnsetRatioModel: true})
	require.NoError(t, err)
	require.True(t, UserAcceptsUnpricedModels(&model.UserBase{Setting: string(settingJSON)}))
	require.False(t, UserAcceptsUnpricedModels(&model.UserBase{}))
}

func TestResolveTokenModelAccessOrdinaryAutoPLGAndAllowlist(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	seedModelAccessScope(t, db, 101, "default", constant.ChannelTypeOpenAI, "shared", "default-only", "gpt-4-gizmo-customer")
	seedModelAccessScope(t, db, 102, "vip", constant.ChannelTypeAnthropic, "shared", "vip-only")
	seedModelAccessScope(t, db, 103, "plg", constant.ChannelTypeGemini, "plg-only")
	setModelAccessBilling(t, map[string]float64{
		"shared": 1, "default-only": 1, "gpt-4-gizmo-*": 1, "vip-only": 1, "plg-only": 1,
	}, nil, nil)

	ordinary, err := ResolveTokenModelAccess(TokenModelAccessInput{IdentityGroup: "default", TokenGroup: "default"})
	require.NoError(t, err)
	require.Equal(t, []string{"default-only", "gpt-4-gizmo-customer", "shared"}, ordinary.ModelIDs)

	auto, err := ResolveTokenModelAccess(TokenModelAccessInput{IdentityGroup: "default", TokenGroup: "auto"})
	require.NoError(t, err)
	require.Equal(t, []string{"default-only", "gpt-4-gizmo-customer", "shared", "vip-only"}, auto.ModelIDs)
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))
	unauthorizedAuto, err := ResolveTokenModelAccess(TokenModelAccessInput{IdentityGroup: "default", TokenGroup: "auto"})
	require.NoError(t, err)
	require.Empty(t, unauthorizedAuto.ModelIDs, "auto must not expand scope unless auto is explicitly usable")

	plg, err := ResolveTokenModelAccess(TokenModelAccessInput{IdentityGroup: "plg", TokenGroup: "vip"})
	require.NoError(t, err)
	require.Equal(t, []string{"plg-only"}, plg.ModelIDs)

	limited, err := ResolveTokenModelAccess(TokenModelAccessInput{
		IdentityGroup: "default", TokenGroup: "default", ModelLimitsEnabled: true,
		ModelLimits: map[string]bool{"gpt-4-gizmo-*": true},
	})
	require.NoError(t, err)
	require.Equal(t, []string{"gpt-4-gizmo-customer"}, limited.ModelIDs)

	empty, err := ResolveTokenModelAccess(TokenModelAccessInput{
		IdentityGroup: "default", TokenGroup: "default", ModelLimitsEnabled: true, ModelLimits: map[string]bool{},
	})
	require.NoError(t, err)
	require.Empty(t, empty.ModelIDs)
}

func TestResolveStrictModelAccessBillingVisibilityVendorAndStableDedup(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	seedModelAccessScope(t, db, 201, "default", constant.ChannelTypeOpenAI,
		"ratio-model", "tiered-model", "tiered-empty", "missing", "vendor-model", "custom-model")
	seedModelAccessScope(t, db, 202, "default", constant.ChannelTypeAnthropic, "vendor-model")
	setModelAccessBilling(t,
		map[string]float64{"ratio-model": 1, "vendor-model": 1, "custom-model": 1},
		map[string]string{"tiered-model": "tiered_expr", "tiered-empty": "tiered_expr"},
		map[string]string{"tiered-model": `tier("base", p + c)`, "tiered-empty": "   "},
	)
	vendor := model.Vendor{Name: "Public Vendor", Icon: "public", Status: 1}
	require.NoError(t, db.Create(&vendor).Error)
	require.NoError(t, db.Create(&model.Model{ModelName: "vendor-model", VendorID: vendor.Id, Status: 1}).Error)

	strict, err := ResolveTokenModelAccess(TokenModelAccessInput{IdentityGroup: "default", TokenGroup: "default"})
	require.NoError(t, err)
	require.Equal(t, []string{"custom-model", "ratio-model", "tiered-model", "vendor-model"}, strict.ModelIDs)
	require.Len(t, strict.Models, 4)
	byID := make(map[string]ModelAccessModel, len(strict.Models))
	for _, item := range strict.Models {
		byID[item.ID] = item
	}
	require.Equal(t, "Public Vendor", byID["vendor-model"].Vendor.Name)
	require.Nil(t, byID["custom-model"].Vendor)
	require.ElementsMatch(t, []constant.EndpointType{constant.EndpointTypeAnthropic, constant.EndpointTypeOpenAI}, byID["vendor-model"].SupportedEndpointTypes)

	selfUse, err := ResolveTokenModelAccess(TokenModelAccessInput{IdentityGroup: "default", TokenGroup: "default", AcceptUnpriced: true})
	require.NoError(t, err)
	require.Contains(t, selfUse.ModelIDs, "missing")
	require.Contains(t, selfUse.ModelIDs, "tiered-empty")
}

func TestResolveUserModelAccessIdentityOnlyAndPLG(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"plg":0}`))
	require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(`{
		"private":{"gpt-4-gizmo-*":0,"private-inaccessible":8},
		"plg":{"plg-only":0.7,"plg-inaccessible":9}
	}`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{}`))
	seedModelAccessScope(t, db, 301, "private", constant.ChannelTypeOpenAI, "gpt-4-gizmo-customer", "identity-only")
	seedModelAccessScope(t, db, 302, "plg", constant.ChannelTypeOpenAI, "plg-only")
	setModelAccessBilling(t, map[string]float64{"gpt-4-gizmo-*": 1, "identity-only": 1, "plg-only": 1}, nil, nil)

	identity, err := ResolveUserModelAccess(&model.UserBase{Id: 1, Group: "private"})
	require.NoError(t, err)
	require.Equal(t, ModelAccessScopeSelectableGroup, identity.ScopeMode)
	require.Equal(t, "private", *identity.IdentityScope)
	require.Equal(t, []string{"gpt-4-gizmo-customer", "identity-only"}, identity.IdentityModelIDs)
	require.Equal(t, map[string]float64{"gpt-4-gizmo-customer": 0}, identity.IdentityModelRatios)
	require.NotNil(t, identity.IdentityDefaultRatio)
	require.Equal(t, 1.0, *identity.IdentityDefaultRatio)
	require.Empty(t, identity.AccountModelRatios)
	require.Nil(t, identity.AccountDefaultRatio)
	require.Empty(t, identity.Groups, "identity scope must not be injected into selectable groups")
	require.Nil(t, identity.CreateDefaultScope)
	require.Equal(t, []string{"gpt-4-gizmo-customer", "identity-only"}, modelAccessModelIDs(identity.Models))
	require.NotContains(t, identity.IdentityModelRatios, "private-inaccessible")

	plg, err := ResolveUserModelAccess(&model.UserBase{Id: 2, Group: "plg"})
	require.NoError(t, err)
	require.Equal(t, ModelAccessScopeFixedAccount, plg.ScopeMode)
	require.Nil(t, plg.IdentityScope)
	require.Empty(t, plg.IdentityModelRatios)
	require.Nil(t, plg.IdentityDefaultRatio)
	require.Empty(t, plg.Groups)
	require.Equal(t, []string{"plg-only"}, plg.AccountModelIDs)
	require.Equal(t, map[string]float64{"plg-only": 0.7}, plg.AccountModelRatios)
	require.NotNil(t, plg.AccountDefaultRatio)
	require.Zero(t, *plg.AccountDefaultRatio)
	require.NotContains(t, plg.AccountModelRatios, "plg-inaccessible")
}

func TestResolveUserModelAccessSelectableRatiosAreScopeLocalAndAutoIsEmpty(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":0,"vip":2,"plg":0.9}`))
	require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(`{
		"default":{"shared":0.4},
		"vip":{"vip-only":0.6,"inaccessible":7},
		"auto":{"shared":9}
	}`))
	seedModelAccessScope(t, db, 321, "default", constant.ChannelTypeOpenAI, "shared")
	seedModelAccessScope(t, db, 322, "vip", constant.ChannelTypeOpenAI, "shared", "vip-only")
	setModelAccessBilling(t, map[string]float64{"shared": 1, "vip-only": 1}, nil, nil)

	access, err := ResolveUserModelAccess(&model.UserBase{Id: 3, Group: "default"})
	require.NoError(t, err)
	require.Equal(t, map[string]float64{"shared": 0.4}, access.IdentityModelRatios)
	require.Zero(t, *access.IdentityDefaultRatio)
	require.Empty(t, access.AccountModelRatios)
	require.Nil(t, access.AccountDefaultRatio)

	byID := make(map[string]ModelAccessScope, len(access.Groups))
	for _, scope := range access.Groups {
		byID[scope.ID] = scope
	}
	require.Equal(t, map[string]float64{"shared": 0.4}, byID["default"].ModelRatios)
	require.Equal(t, map[string]float64{"vip-only": 0.6}, byID["vip"].ModelRatios)
	require.NotContains(t, byID["vip"].ModelRatios, "inaccessible")
	require.Empty(t, byID["auto"].ModelRatios)
	require.Nil(t, byID["auto"].Ratio)
	require.Empty(t, explicitGroupModelRatios("removed", []string{"shared"}))

	nilAccess, err := ResolveUserModelAccess(nil)
	require.NoError(t, err)
	require.NotNil(t, nilAccess.IdentityModelRatios)
	require.NotNil(t, nilAccess.AccountModelRatios)
	require.Nil(t, nilAccess.IdentityDefaultRatio)
	require.Nil(t, nilAccess.AccountDefaultRatio)
}

func TestResolveUserModelAccessEmptyIdentityMatchesLegacyPLGAccountWithoutLeakingGroup(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	seedModelAccessScope(t, db, 331, "plg", constant.ChannelTypeOpenAI, "legacy-account-model")
	setModelAccessBilling(t, map[string]float64{"legacy-account-model": 1}, nil, nil)

	access, err := ResolveUserModelAccess(&model.UserBase{Id: 4, Group: ""})
	require.NoError(t, err)
	require.Equal(t, ModelAccessScopeFixedAccount, access.ScopeMode)
	require.Nil(t, access.IdentityScope)
	require.Empty(t, access.IdentityModelIDs)
	require.Empty(t, access.Groups)
	require.Equal(t, []string{"legacy-account-model"}, access.AccountModelIDs)
	require.Equal(t, []string{"legacy-account-model"}, modelAccessModelIDs(access.Models))
	encoded, err := common.Marshal(access)
	require.NoError(t, err)
	require.NotContains(t, string(encoded), `"plg"`)
}

func TestResolveUserModelAccessPreservesUserSpecificGroupDescriptions(t *testing.T) {
	db, _ := setupServiceModelAccessDB(t)
	seedModelAccessScope(t, db, 351, "vip", constant.ChannelTypeOpenAI, "vip-model")
	setModelAccessBilling(t, map[string]float64{"vip-model": 1}, nil, nil)
	special := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup
	original := special.ReadAll()
	special.Set("company", map[string]string{"vip": "Dedicated VIP"})
	t.Cleanup(func() {
		special.Clear()
		special.AddAll(original)
	})

	access, err := ResolveUserModelAccess(&model.UserBase{Id: 3, Group: "company"})
	require.NoError(t, err)
	descriptions := make(map[string]string, len(access.Groups))
	for _, group := range access.Groups {
		descriptions[group.ID] = group.Description
	}
	require.Equal(t, "Dedicated VIP", descriptions["vip"])
	require.Equal(t, "Auto", descriptions["auto"])
}

func TestResolveStrictModelAccessQueryCountIsCardinalityIndependent(t *testing.T) {
	db, queryCount := setupServiceModelAccessDB(t)
	models := make([]string, 100)
	ratios := make(map[string]float64, len(models))
	for i := range models {
		models[i] = fmt.Sprintf("model-%03d", i)
		ratios[models[i]] = 1
	}
	seedModelAccessScope(t, db, 401, "default", constant.ChannelTypeOpenAI, models...)
	setModelAccessBilling(t, ratios, nil, nil)

	queryCount.Store(0)
	_, err := ResolveTokenModelAccess(TokenModelAccessInput{IdentityGroup: "default", TokenGroup: "default", ModelLimitsEnabled: true, ModelLimits: map[string]bool{models[0]: true}})
	require.NoError(t, err)
	oneModelQueries := queryCount.Load()

	queryCount.Store(0)
	all, err := ResolveTokenModelAccess(TokenModelAccessInput{IdentityGroup: "default", TokenGroup: "default"})
	require.NoError(t, err)
	require.Len(t, all.ModelIDs, len(models))
	allModelQueries := queryCount.Load()

	require.Equal(t, oneModelQueries, allModelQueries)
	require.LessOrEqual(t, allModelQueries, int64(4), "strict resolution must use a fixed number of batched queries")
	t.Logf("strict resolver query count: one model=%d, 100 models=%d", oneModelQueries, allModelQueries)
}

func modelAccessModelIDs(models []ModelAccessModel) []string {
	ids := make([]string, len(models))
	for i, item := range models {
		ids[i] = item.ID
	}
	return ids
}
