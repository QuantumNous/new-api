package controller

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type marketplaceAPIResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		Items []model.MarketplaceModel `json:"items"`
		Total int                      `json:"total"`
	} `json:"data"`
}

type marketplaceDetailAPIResponse struct {
	Success bool                         `json:"success"`
	Message string                       `json:"message"`
	Data    model.MarketplaceModelDetail `json:"data"`
}

func TestMarketplacePublicUserOnlySeesListedModels(t *testing.T) {
	db := setupMarketplaceControllerTestDB(t)
	provider := seedMarketplaceProvider(t, db, 101)
	listed := model.MarketplaceModel{ProviderId: provider.Id, Name: "listed-model", Status: model.MarketplaceModelStatusListed}
	draft := model.MarketplaceModel{ProviderId: provider.Id, Name: "draft-model", Status: model.MarketplaceModelStatusDraft}
	require.NoError(t, db.Create(&listed).Error)
	require.NoError(t, db.Create(&draft).Error)

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/marketplace-models/?page_size=20", nil, 201)
	ctx.Set("role", common.RoleCommonUser)

	ListMarketplaceModels(ctx)

	var response marketplaceAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Len(t, response.Data.Items, 1)
	assert.Equal(t, listed.Id, response.Data.Items[0].Id)
	assert.Equal(t, 1, response.Data.Total)
}

func TestMarketplacePublicDetailHidesManagementData(t *testing.T) {
	db := setupMarketplaceControllerTestDB(t)
	t.Setenv("MODEL_KEY_ENCRYPTION_SECRET", "controller-secret")
	provider := seedMarketplaceProvider(t, db, 102)
	item := model.MarketplaceModel{ProviderId: provider.Id, Name: "public-model", Status: model.MarketplaceModelStatusListed}
	require.NoError(t, db.Create(&item).Error)
	config := model.ModelApiConfig{ModelId: item.Id, BaseUrl: "https://upstream.example", Protocol: "openai", Status: "active"}
	require.NoError(t, db.Create(&config).Error)
	key := model.ModelKey{ModelId: item.Id, Name: "primary", Status: "active"}
	require.NoError(t, model.SetModelKeyPlaintext(&key, "sk-public-secret"))
	require.NoError(t, db.Create(&key).Error)

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/marketplace-models/"+strconv.Itoa(item.Id), nil, 202)
	ctx.Set("role", common.RoleCommonUser)
	ctx.Params = append(ctx.Params, ginParam("id", strconv.Itoa(item.Id)))

	GetMarketplaceModel(ctx)

	var response marketplaceDetailAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	assert.Equal(t, item.Id, response.Data.Id)
	assert.Empty(t, response.Data.ApiConfigs)
	assert.Empty(t, response.Data.Keys)
	assert.Empty(t, response.Data.Reviews)
	assert.Nil(t, response.Data.Wallet)
	assert.Nil(t, response.Data.Settlement)
	assert.NotContains(t, recorder.Body.String(), "sk-public-secret")
	assert.NotContains(t, recorder.Body.String(), "upstream.example")
}

func setupMarketplaceControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db := openTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Log{},
		&model.Role{},
		&model.Permission{},
		&model.UserRole{},
		&model.RolePermission{},
		&model.ProviderProfile{},
		&model.ProviderWallet{},
		&model.ProviderSettlementConfig{},
		&model.MarketplaceModel{},
		&model.ModelApiConfig{},
		&model.ModelKey{},
		&model.ModelPricing{},
		&model.ModelReviewRecord{},
	))
	require.NoError(t, model.EnsureBuiltinRBAC())
	return db
}

func seedMarketplaceProvider(t *testing.T, db *gorm.DB, userId int) model.ProviderProfile {
	t.Helper()

	require.NoError(t, db.Create(&model.User{
		Id:       userId,
		Username: "provider-" + strconv.Itoa(userId),
		Password: "password",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}).Error)
	provider := model.ProviderProfile{UserId: userId, Name: "provider-" + strconv.Itoa(userId)}
	require.NoError(t, db.Create(&provider).Error)
	return provider
}

func ginParam(key string, value string) gin.Param {
	return gin.Param{Key: key, Value: value}
}
