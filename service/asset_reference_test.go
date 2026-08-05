package service

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAssetReferenceSetRejectsOwnershipMalformedTypeMismatchAndExpiredSources(t *testing.T) {
	tests := []struct {
		name       string
		seed       func(t *testing.T)
		userID     int
		item       dto.SeedanceContentItem
		wantCode   types.ErrorCode
		wantStatus int
	}{
		{
			name: "ownership hidden as not found",
			seed: func(t *testing.T) {
				insertAssetReferenceAsset(t, assetReferenceSeed{UserID: 8, PublicID: "ast_1234567890abcdefABCDEF1234567890", AssetType: "Image", SourceStatus: model.AssetSourceStatusAvailable, SourceExpiresAt: 200})
			},
			userID:     7,
			item:       imageAssetItem("ast_1234567890abcdefABCDEF1234567890"),
			wantCode:   types.ErrorCodeAssetNotFound,
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "malformed media URI",
			seed:       func(t *testing.T) {},
			userID:     7,
			item:       dto.SeedanceContentItem{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "asset://ast_short"}},
			wantCode:   types.ErrorCodeInvalidAssetRequest,
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "type mismatch",
			seed: func(t *testing.T) {
				insertAssetReferenceAsset(t, assetReferenceSeed{UserID: 7, PublicID: "ast_1234567890abcdefABCDEF1234567890", AssetType: "Video", SourceStatus: model.AssetSourceStatusAvailable, SourceExpiresAt: 200})
			},
			userID:     7,
			item:       imageAssetItem("ast_1234567890abcdefABCDEF1234567890"),
			wantCode:   types.ErrorCodeInvalidAssetRequest,
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "expired source without active binding",
			seed: func(t *testing.T) {
				insertAssetReferenceAsset(t, assetReferenceSeed{UserID: 7, PublicID: "ast_1234567890abcdefABCDEF1234567890", AssetType: "Image", SourceStatus: model.AssetSourceStatusExpired, SourceExpiresAt: 10})
			},
			userID:     7,
			item:       imageAssetItem("ast_1234567890abcdefABCDEF1234567890"),
			wantCode:   types.ErrorCodeAssetExpired,
			wantStatus: http.StatusGone,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newAssetReferenceDB(t)
			assetNow = func() time.Time { return time.Unix(100, 0) }
			t.Cleanup(func() { assetNow = time.Now })
			tt.seed(t)

			refs, apiErr := ResolveAssetReferences(newAssetReferenceContext(), tt.userID, &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{tt.item}})
			require.NotNil(t, apiErr)
			require.Equal(t, tt.wantCode, apiErr.GetErrorCode())
			require.Equal(t, tt.wantStatus, apiErr.StatusCode)
			require.False(t, refs.HasReferences())
		})
	}
}

func TestAssetReferenceSetRanksAllActivePartialAndNoBindingReadiness(t *testing.T) {
	newAssetReferenceDB(t)
	assetNow = func() time.Time { return time.Unix(100, 0) }
	t.Cleanup(func() { assetNow = time.Now })

	allBound := insertAssetReferenceAsset(t, assetReferenceSeed{UserID: 7, PublicID: "ast_11111111111111111111111111111111", AssetType: "Image", SourceStatus: model.AssetSourceStatusAvailable, SourceExpiresAt: 200, BindingChannelID: 131, UpstreamID: "upstream-all", BindingStatus: model.AssetStatusActive})
	partial := insertAssetReferenceAsset(t, assetReferenceSeed{UserID: 7, PublicID: "ast_22222222222222222222222222222222", AssetType: "Image", SourceStatus: model.AssetSourceStatusAvailable, SourceExpiresAt: 200, BindingChannelID: 131, UpstreamID: "upstream-partial", BindingStatus: model.AssetStatusActive})
	insertAssetReferenceAsset(t, assetReferenceSeed{UserID: 7, PublicID: "ast_33333333333333333333333333333333", AssetType: "Image", SourceStatus: model.AssetSourceStatusAvailable, SourceExpiresAt: 200})

	allSet, apiErr := ResolveAssetReferences(newAssetReferenceContext(), 7, &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{imageAssetItem(allBound.PublicId)}})
	require.Nil(t, apiErr)
	partialSet, apiErr := ResolveAssetReferences(newAssetReferenceContext(), 7, &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{imageAssetItem(partial.PublicId), imageAssetItem("ast_33333333333333333333333333333333")}})
	require.Nil(t, apiErr)
	noneSet, apiErr := ResolveAssetReferences(newAssetReferenceContext(), 7, &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{imageAssetItem("ast_33333333333333333333333333333333")}})
	require.Nil(t, apiErr)

	bytePlus := &model.Channel{Id: 131, Type: constant.ChannelTypeBytePlus}
	allReadiness, ok := allSet.ReadinessForChannel(bytePlus)
	require.True(t, ok)
	require.Equal(t, AssetReadinessAllBound, allReadiness)
	partialReadiness, ok := partialSet.ReadinessForChannel(bytePlus)
	require.True(t, ok)
	require.Equal(t, AssetReadinessPartialBound, partialReadiness)
	noneReadiness, ok := noneSet.ReadinessForChannel(bytePlus)
	require.True(t, ok)
	require.Equal(t, AssetReadinessRecoverable, noneReadiness)
}

func TestAssetReferenceSetAllowsLegacyAndSourceUnavailableOnlyOnActiveOriginalBinding(t *testing.T) {
	newAssetReferenceDB(t)
	insertLegacyAssetReferenceAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "legacy-upstream", model.BytePlusAssetStatusActive)
	insertAssetReferenceAsset(t, assetReferenceSeed{UserID: 7, PublicID: "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", AssetType: "Image", SourceStatus: model.AssetSourceStatusUnavailable, BindingChannelID: 132, UpstreamID: "migrated-upstream", BindingStatus: model.AssetStatusActive})

	refs, apiErr := ResolveAssetReferences(newAssetReferenceContext(), 7, &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		imageAssetItem("ast_1234567890abcdefABCDEF1234567890"),
		imageAssetItem("ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
	}})
	require.Nil(t, apiErr)

	_, ok := refs.ReadinessForChannel(&model.Channel{Id: 131, Type: constant.ChannelTypeBytePlus})
	require.False(t, ok, "legacy and source-unavailable assets must require one common active binding")
	readiness, ok := refs.ReadinessForChannel(&model.Channel{Id: 132, Type: constant.ChannelTypeBytePlus})
	require.False(t, ok)
	require.Equal(t, AssetReadinessIneligible, readiness)
}

func TestAssetReferenceSetMixesRecoverableGeneralizedSourceWithLegacyBinding(t *testing.T) {
	newAssetReferenceDB(t)
	assetNow = func() time.Time { return time.Unix(100, 0) }
	t.Cleanup(func() { assetNow = time.Now })
	insertAssetReferenceAsset(t, assetReferenceSeed{UserID: 7, PublicID: "ast_1234567890abcdefABCDEF1234567890", AssetType: "Image", SourceStatus: model.AssetSourceStatusAvailable, SourceExpiresAt: 200})
	insertLegacyAssetReferenceAsset(t, 7, 131, "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "legacy-upstream", model.BytePlusAssetStatusActive)

	refs, apiErr := ResolveAssetReferences(newAssetReferenceContext(), 7, &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		imageAssetItem("ast_1234567890abcdefABCDEF1234567890"),
		imageAssetItem("ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
	}})
	require.Nil(t, apiErr)

	readiness, ok := refs.ReadinessForChannel(&model.Channel{Id: 131, Type: constant.ChannelTypeBytePlus})
	require.True(t, ok)
	require.Equal(t, AssetReadinessPartialBound, readiness)
	require.Equal(t, map[string]string{
		"asset://ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": "asset://legacy-upstream",
	}, refs.RewriteMapForChannel(131))

	readiness, ok = refs.ReadinessForChannel(&model.Channel{Id: 132, Type: constant.ChannelTypeBytePlus})
	require.False(t, ok)
	require.Equal(t, AssetReadinessIneligible, readiness)
	require.Nil(t, refs.RewriteMapForChannel(132))
}

func TestAssetReferenceSetRejectsMixedSourceUnavailableBindingsOnDifferentChannels(t *testing.T) {
	newAssetReferenceDB(t)
	insertAssetReferenceAsset(t, assetReferenceSeed{UserID: 7, PublicID: "ast_1234567890abcdefABCDEF1234567890", AssetType: "Image", SourceStatus: model.AssetSourceStatusUnavailable, BindingChannelID: 131, UpstreamID: "generalized-upstream", BindingStatus: model.AssetStatusActive})
	insertLegacyAssetReferenceAsset(t, 7, 132, "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "legacy-upstream", model.BytePlusAssetStatusActive)

	refs, apiErr := ResolveAssetReferences(newAssetReferenceContext(), 7, &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		imageAssetItem("ast_1234567890abcdefABCDEF1234567890"),
		imageAssetItem("ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
	}})
	require.Nil(t, apiErr)

	readiness, ok := refs.ReadinessForChannel(&model.Channel{Id: 131, Type: constant.ChannelTypeBytePlus})
	require.False(t, ok)
	require.Equal(t, AssetReadinessIneligible, readiness)
	readiness, ok = refs.ReadinessForChannel(&model.Channel{Id: 132, Type: constant.ChannelTypeBytePlus})
	require.False(t, ok)
	require.Equal(t, AssetReadinessIneligible, readiness)
}

func TestAssetReferenceSetRequiresOneChannelToConsumeEveryReferencedAsset(t *testing.T) {
	newAssetReferenceDB(t)
	assetNow = func() time.Time { return time.Unix(100, 0) }
	t.Cleanup(func() { assetNow = time.Now })
	insertAssetReferenceAsset(t, assetReferenceSeed{UserID: 7, PublicID: "ast_1234567890abcdefABCDEF1234567890", AssetType: "Image", SourceStatus: model.AssetSourceStatusAvailable, SourceExpiresAt: 200, BindingChannelID: 131, UpstreamID: "image-upstream", BindingStatus: model.AssetStatusActive})
	insertAssetReferenceAsset(t, assetReferenceSeed{UserID: 7, PublicID: "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", AssetType: "Audio", SourceStatus: model.AssetSourceStatusAvailable, SourceExpiresAt: 200})

	refs, apiErr := ResolveAssetReferences(newAssetReferenceContext(), 7, &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		imageAssetItem("ast_1234567890abcdefABCDEF1234567890"),
		audioAssetItem("ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
	}})
	require.Nil(t, apiErr)

	_, ok := refs.ReadinessForChannel(&model.Channel{Id: 131, Type: constant.ChannelTypeOpenAI})
	require.False(t, ok, "OpenAI video route must not be eligible for audio assets")
	readiness, ok := refs.ReadinessForChannel(&model.Channel{Id: 131, Type: constant.ChannelTypeBytePlus})
	require.True(t, ok)
	require.Equal(t, AssetReadinessPartialBound, readiness)
}

func TestCacheGetRandomSatisfiedChannelAssetRankerReadinessOutranksPriority(t *testing.T) {
	newAssetReferenceDB(t)
	assetNow = func() time.Time { return time.Unix(100, 0) }
	t.Cleanup(func() { assetNow = time.Now })
	restoreConcurrency := useMemoryChannelConcurrencyForTest(t)
	defer restoreConcurrency()

	insertAssetReferenceChannel(t, 131, constant.ChannelTypeBytePlus, "default", "seedance-2.0", 10, 1)
	insertAssetReferenceChannel(t, 132, constant.ChannelTypeBytePlus, "default", "seedance-2.0", 100, 1000)
	insertAssetReferenceAsset(t, assetReferenceSeed{UserID: 7, PublicID: "ast_1234567890abcdefABCDEF1234567890", AssetType: "Image", SourceStatus: model.AssetSourceStatusAvailable, SourceExpiresAt: 200, BindingChannelID: 131, UpstreamID: "bound-upstream", BindingStatus: model.AssetStatusActive})
	model.InitChannelCache()

	refs, apiErr := ResolveAssetReferences(newAssetReferenceContext(), 7, &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{imageAssetItem("ast_1234567890abcdefABCDEF1234567890")}})
	require.Nil(t, apiErr)
	c := newAssetReferenceContext()
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	retry := 0

	channel, selectedGroup, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx:           c,
		TokenGroup:    "default",
		ModelName:     "seedance-2.0",
		Retry:         &retry,
		ChannelRanker: refs.ChannelRanker(),
	})
	defer ReleaseChannelConcurrencyForContext(c)

	require.NoError(t, err)
	require.Equal(t, "default", selectedGroup)
	require.NotNil(t, channel)
	require.Equal(t, 131, channel.Id)
}

type assetReferenceSeed struct {
	UserID           int
	PublicID         string
	AssetType        string
	SourceStatus     string
	SourceExpiresAt  int64
	BindingChannelID int
	UpstreamID       string
	BindingStatus    string
}

func newAssetReferenceDB(t *testing.T) {
	t.Helper()
	oldDB := model.DB
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldUsingSQLite := common.UsingSQLite
	oldUsingMySQL := common.UsingMySQL
	oldUsingPostgreSQL := common.UsingPostgreSQL
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Asset{}, &model.AssetBinding{}, &model.BytePlusAsset{}, &model.Channel{}, &model.Ability{}))
	sqlDB, err := db.DB()
	require.NoError(t, err)
	model.DB = db
	common.MemoryCacheEnabled = true
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	t.Cleanup(func() {
		model.DB = oldDB
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		common.UsingSQLite = oldUsingSQLite
		common.UsingMySQL = oldUsingMySQL
		common.UsingPostgreSQL = oldUsingPostgreSQL
		model.InitChannelCache()
		_ = sqlDB.Close()
	})
}

func insertAssetReferenceAsset(t *testing.T, seed assetReferenceSeed) model.Asset {
	t.Helper()
	asset := model.Asset{
		PublicId:        seed.PublicID,
		UserId:          seed.UserID,
		AssetType:       seed.AssetType,
		Status:          model.AssetStatusActive,
		SourceStatus:    seed.SourceStatus,
		StorageBackend:  "gcs",
		StorageBucket:   "bucket",
		ObjectKey:       "assets/" + seed.PublicID,
		SourceExpiresAt: seed.SourceExpiresAt,
		CreatedAt:       100,
		UpdatedAt:       100,
	}
	require.NoError(t, model.DB.Create(&asset).Error)
	if seed.BindingChannelID > 0 {
		status := seed.BindingStatus
		if status == "" {
			status = model.AssetStatusActive
		}
		require.NoError(t, model.DB.Create(&model.AssetBinding{
			AssetId:         asset.Id,
			ChannelId:       seed.BindingChannelID,
			UpstreamAssetId: seed.UpstreamID,
			Status:          status,
			CreatedAt:       100,
			UpdatedAt:       100,
		}).Error)
	}
	return asset
}

func insertLegacyAssetReferenceAsset(t *testing.T, userID, channelID int, publicID, upstreamID, status string) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.BytePlusAsset{
		PublicId:        publicID,
		UserId:          userID,
		ChannelId:       channelID,
		UpstreamAssetId: upstreamID,
		AssetType:       "Image",
		Status:          status,
	}).Error)
}

func insertAssetReferenceChannel(t *testing.T, id int, channelType int, group string, modelName string, priority int64, weight uint) {
	t.Helper()
	ch := &model.Channel{
		Id:       id,
		Type:     channelType,
		Key:      fmt.Sprintf("sk-%d", id),
		Status:   common.ChannelStatusEnabled,
		Name:     fmt.Sprintf("asset-channel-%d", id),
		Group:    group,
		Models:   modelName,
		Priority: &priority,
		Weight:   &weight,
	}
	require.NoError(t, model.DB.Create(ch).Error)
	require.NoError(t, ch.AddAbilities(nil))
}

func imageAssetItem(publicID string) dto.SeedanceContentItem {
	return dto.SeedanceContentItem{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "asset://" + publicID}}
}

func audioAssetItem(publicID string) dto.SeedanceContentItem {
	return dto.SeedanceContentItem{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "asset://" + publicID}}
}
