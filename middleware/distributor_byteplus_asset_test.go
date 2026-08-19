package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	_ "unsafe"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	backendi18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

//go:linkname middlewareModelCommonGroupCol github.com/QuantumNous/new-api/model.commonGroupCol
var middlewareModelCommonGroupCol string

type middlewareAssetMaterializer struct {
	createErr error
	calls     *int
	input     *service.AssetMaterializeInput
	inputs    *[]service.AssetMaterializeInput
}

func (m middlewareAssetMaterializer) CreateAsset(ctx context.Context, input service.AssetMaterializeInput) (service.AssetMaterializeResult, error) {
	if m.calls != nil {
		*m.calls = *m.calls + 1
	}
	if m.createErr != nil {
		return service.AssetMaterializeResult{}, m.createErr
	}
	if m.input != nil {
		*m.input = input
	}
	if m.inputs != nil {
		*m.inputs = append(*m.inputs, input)
	}
	return service.AssetMaterializeResult{
		UpstreamGroupID: "group-" + fmt.Sprint(input.Channel.Id),
		UpstreamAssetID: "upstream-" + input.Asset.PublicId,
		Status:          model.AssetStatusActive,
	}, nil
}

func (m middlewareAssetMaterializer) GetAsset(ctx context.Context, input service.AssetMaterializeInput, upstreamAssetID string) (service.AssetMaterializeResult, error) {
	if m.calls != nil {
		*m.calls = *m.calls + 1
	}
	return service.AssetMaterializeResult{UpstreamAssetID: upstreamAssetID, Status: model.AssetStatusActive}, nil
}

func TestTechMobiAssetMaterializationUsesMappedModelAndSelectedKey(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()

	priority := int64(1)
	weight := uint(1)
	mapping := `{"seedance2.0-pro":"doubao/doubao-seedance-2-0-260128"}`
	channel := middlewareBytePlusAssetChannel(106, constant.ChannelTypeTechMobiVideo, "default", common.ChannelStatusEnabled, priority, weight)
	channel.Key = "techmobi-selected-key"
	channel.Models = "seedance2.0-pro"
	channel.ModelMapping = &mapping
	require.NoError(t, model.DB.Create(&channel).Error)
	insertMiddlewareAbility(t, 106, "default", "seedance2.0-pro", true, priority, weight)
	publicID := "ast_1234567890abcdefABCDEF1234567890"
	insertMiddlewareGeneralizedAsset(t, 7, publicID, "Image", model.AssetSourceStatusAvailable, time.Now().Add(time.Hour).Unix())

	var captured service.AssetMaterializeInput
	restoreMaterializer := service.RegisterAssetMaterializer(
		constant.ChannelTypeTechMobiVideo,
		middlewareAssetMaterializer{input: &captured},
	)
	defer restoreMaterializer()
	model.InitChannelCache()

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		require.Equal(t, "doubao/doubao-seedance-2-0-260128", captured.Model)
		require.Equal(t, "techmobi-selected-key", captured.APIKey)
		rewriteMap, ok := common.GetContextKeyType[map[string]string](c, constant.ContextKeyAssetRewriteMap)
		require.True(t, ok)
		require.Equal(t, "asset://upstream-"+publicID, rewriteMap["asset://"+publicID])
		c.Status(http.StatusOK)
	})

	recorder := performBytePlusAssetDistributorRequestWithMaterialize(router, "", `{
		"model":"seedance2.0-pro",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
}

func TestTechMobiAssetBindingReusesOriginalEnabledKeyScope(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()

	priority := int64(1)
	weight := uint(1)
	mapping := `{"seedance2.0-pro":"doubao/doubao-seedance-2-0-260128"}`
	channel := middlewareBytePlusAssetChannel(106, constant.ChannelTypeTechMobiVideo, "default", common.ChannelStatusEnabled, priority, weight)
	channel.Key = "techmobi-key-a\ntechmobi-key-b"
	channel.Models = "seedance2.0-pro"
	channel.ModelMapping = &mapping
	channel.ChannelInfo = model.ChannelInfo{
		IsMultiKey:           true,
		MultiKeySize:         2,
		MultiKeyMode:         constant.MultiKeyModePolling,
		MultiKeyPollingIndex: 0,
	}
	require.NoError(t, model.DB.Create(&channel).Error)
	insertMiddlewareAbility(t, 106, "default", "seedance2.0-pro", true, priority, weight)
	publicID := "ast_abcdefabcdefabcdefabcdefabcdefab"
	insertMiddlewareGeneralizedAsset(t, 7, publicID, "Image", model.AssetSourceStatusAvailable, time.Now().Add(time.Hour).Unix())

	createCalls := 0
	inputs := make([]service.AssetMaterializeInput, 0, 2)
	restoreMaterializer := service.RegisterAssetMaterializer(
		constant.ChannelTypeTechMobiVideo,
		middlewareAssetMaterializer{calls: &createCalls, inputs: &inputs},
	)
	defer restoreMaterializer()
	model.InitChannelCache()

	selectedKeys := make([]string, 0, 2)
	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		selectedKeys = append(selectedKeys, common.GetContextKeyString(c, constant.ContextKeyChannelKey))
		c.Status(http.StatusOK)
	})
	body := `{
		"model":"seedance2.0-pro",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_abcdefabcdefabcdefabcdefabcdefab"},"role":"reference_image"}]
	}`

	first := performBytePlusAssetDistributorRequestWithMaterialize(router, "", body)
	second := performBytePlusAssetDistributorRequestWithMaterialize(router, "", body)

	require.Equal(t, http.StatusOK, first.Code, first.Body.String())
	require.Equal(t, http.StatusOK, second.Code, second.Body.String())
	require.Equal(t, []string{"techmobi-key-a", "techmobi-key-a"}, selectedKeys)
	require.Equal(t, 1, createCalls, "the active binding must be reused instead of uploaded under another account")
	require.Len(t, inputs, 1)
	require.Equal(t, "techmobi-key-a", inputs[0].APIKey)
}

func TestTechMobiAssetBindingCreatesIndependentMappedModelScope(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()

	priority := int64(1)
	weight := uint(1)
	mapping := `{"seedance2.0-pro":"doubao/seedance-pro","seedance2.0-lite":"doubao/seedance-lite"}`
	channel := middlewareBytePlusAssetChannel(106, constant.ChannelTypeTechMobiVideo, "default", common.ChannelStatusEnabled, priority, weight)
	channel.Key = "techmobi-key"
	channel.Models = "seedance2.0-pro,seedance2.0-lite"
	channel.ModelMapping = &mapping
	require.NoError(t, model.DB.Create(&channel).Error)
	insertMiddlewareAbility(t, 106, "default", "seedance2.0-pro", true, priority, weight)
	insertMiddlewareAbility(t, 106, "default", "seedance2.0-lite", true, priority, weight)
	publicID := "ast_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	asset := insertMiddlewareGeneralizedAsset(t, 7, publicID, "Image", model.AssetSourceStatusAvailable, time.Now().Add(time.Hour).Unix())

	inputs := make([]service.AssetMaterializeInput, 0, 2)
	restoreMaterializer := service.RegisterAssetMaterializer(
		constant.ChannelTypeTechMobiVideo,
		middlewareAssetMaterializer{inputs: &inputs},
	)
	defer restoreMaterializer()
	model.InitChannelCache()

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) { c.Status(http.StatusOK) })
	requestForModel := func(modelName string) *httptest.ResponseRecorder {
		return performBytePlusAssetDistributorRequestWithMaterialize(router, "", fmt.Sprintf(`{
			"model":%q,
			"content":[{"type":"image_url","image_url":{"url":"asset://%s"},"role":"reference_image"}]
		}`, modelName, publicID))
	}

	first := requestForModel("seedance2.0-pro")
	second := requestForModel("seedance2.0-lite")

	require.Equal(t, http.StatusOK, first.Code, first.Body.String())
	require.Equal(t, http.StatusOK, second.Code, second.Body.String())
	require.Len(t, inputs, 2)
	require.Equal(t, "doubao/seedance-pro", inputs[0].Model)
	require.Equal(t, "doubao/seedance-lite", inputs[1].Model)
	var bindingCount int64
	require.NoError(t, model.DB.Model(&model.AssetBinding{}).Where("asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Count(&bindingCount).Error)
	require.EqualValues(t, 2, bindingCount)
}

func TestTechMobiAssetBindingRematerializesWhenBoundKeyIsDisabled(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()

	priority := int64(1)
	weight := uint(1)
	mapping := `{"seedance2.0-pro":"doubao/doubao-seedance-2-0-260128"}`
	channel := middlewareBytePlusAssetChannel(106, constant.ChannelTypeTechMobiVideo, "default", common.ChannelStatusEnabled, priority, weight)
	channel.Key = "techmobi-key-a\ntechmobi-key-b"
	channel.Models = "seedance2.0-pro"
	channel.ModelMapping = &mapping
	channel.ChannelInfo = model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2, MultiKeyMode: constant.MultiKeyModePolling}
	require.NoError(t, model.DB.Create(&channel).Error)
	insertMiddlewareAbility(t, 106, "default", "seedance2.0-pro", true, priority, weight)
	publicID := "ast_cccccccccccccccccccccccccccccccc"
	asset := insertMiddlewareGeneralizedAsset(t, 7, publicID, "Image", model.AssetSourceStatusAvailable, time.Now().Add(time.Hour).Unix())

	inputs := make([]service.AssetMaterializeInput, 0, 2)
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeTechMobiVideo, middlewareAssetMaterializer{inputs: &inputs})
	defer restoreMaterializer()
	model.InitChannelCache()

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) { c.Status(http.StatusOK) })
	body := `{
		"model":"seedance2.0-pro",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_cccccccccccccccccccccccccccccccc"},"role":"reference_image"}]
	}`
	first := performBytePlusAssetDistributorRequestWithMaterialize(router, "", body)
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())

	channel.ChannelInfo.MultiKeyStatusList = map[int]int{0: common.ChannelStatusManuallyDisabled}
	channel.ChannelInfo.MultiKeyPollingIndex = 1
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("channel_info", channel.ChannelInfo).Error)
	model.InitChannelCache()
	second := performBytePlusAssetDistributorRequestWithMaterialize(router, "", body)

	require.Equal(t, http.StatusOK, second.Code, second.Body.String())
	require.Len(t, inputs, 2)
	require.Equal(t, "techmobi-key-a", inputs[0].APIKey)
	require.Equal(t, "techmobi-key-b", inputs[1].APIKey)
	var bindingCount int64
	require.NoError(t, model.DB.Model(&model.AssetBinding{}).Where("asset_id = ? AND channel_id = ?", asset.Id, channel.Id).Count(&bindingCount).Error)
	require.EqualValues(t, 2, bindingCount)
}

func TestTechMobiAssetBindingRejectsUnrecoverableMixedScopes(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()

	priority := int64(1)
	weight := uint(1)
	mapping := `{"seedance2.0-pro":"doubao/doubao-seedance-2-0-260128"}`
	channel := middlewareBytePlusAssetChannel(106, constant.ChannelTypeTechMobiVideo, "default", common.ChannelStatusEnabled, priority, weight)
	channel.Key = "techmobi-key-a\ntechmobi-key-b"
	channel.Models = "seedance2.0-pro"
	channel.ModelMapping = &mapping
	channel.ChannelInfo = model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2, MultiKeyMode: constant.MultiKeyModePolling}
	require.NoError(t, model.DB.Create(&channel).Error)
	insertMiddlewareAbility(t, 106, "default", "seedance2.0-pro", true, priority, weight)
	firstID := "ast_dddddddddddddddddddddddddddddddd"
	secondID := "ast_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
	insertMiddlewareGeneralizedAsset(t, 7, firstID, "Image", model.AssetSourceStatusAvailable, time.Now().Add(time.Hour).Unix())
	insertMiddlewareGeneralizedAsset(t, 7, secondID, "Image", model.AssetSourceStatusAvailable, time.Now().Add(time.Hour).Unix())

	createCalls := 0
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeTechMobiVideo, middlewareAssetMaterializer{calls: &createCalls})
	defer restoreMaterializer()
	model.InitChannelCache()

	handlerCalls := 0
	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		handlerCalls++
		c.Status(http.StatusOK)
	})
	singleAssetBody := func(publicID string) string {
		return fmt.Sprintf(`{
			"model":"seedance2.0-pro",
			"content":[{"type":"image_url","image_url":{"url":"asset://%s"},"role":"reference_image"}]
		}`, publicID)
	}
	require.Equal(t, http.StatusOK, performBytePlusAssetDistributorRequestWithMaterialize(router, "", singleAssetBody(firstID)).Code)
	require.Equal(t, http.StatusOK, performBytePlusAssetDistributorRequestWithMaterialize(router, "", singleAssetBody(secondID)).Code)
	require.Equal(t, 2, createCalls)

	require.NoError(t, model.DB.Model(&model.Asset{}).
		Where("public_id IN ?", []string{firstID, secondID}).
		Updates(map[string]any{"source_status": model.AssetSourceStatusExpired, "source_expires_at": time.Now().Add(-time.Hour).Unix()}).Error)
	mixed := performBytePlusAssetDistributorRequestWithMaterialize(router, "", fmt.Sprintf(`{
		"model":"seedance2.0-pro",
		"content":[
			{"type":"image_url","image_url":{"url":"asset://%s"},"role":"reference_image"},
			{"type":"image_url","image_url":{"url":"asset://%s"},"role":"reference_image"}
		]
	}`, firstID, secondID))

	require.Equal(t, http.StatusServiceUnavailable, mixed.Code, mixed.Body.String())
	require.Contains(t, mixed.Body.String(), "asset_channel_unavailable")
	require.Equal(t, 2, handlerCalls, "mixed scopes must be rejected before the relay handler")
	require.Equal(t, 2, createCalls, "unrecoverable sources must not be re-uploaded")
}

func TestTechMobiAssetScopeMismatchRoutesToCompatibleBytePlusBinding(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()

	techMobiPriority := int64(100)
	bytePlusPriority := int64(1)
	weight := uint(1)
	mapping := `{"seedance2.0-pro":"doubao/seedance-pro","seedance2.0-lite":"doubao/seedance-lite"}`
	techMobiChannel := middlewareBytePlusAssetChannel(106, constant.ChannelTypeTechMobiVideo, "default", common.ChannelStatusEnabled, techMobiPriority, weight)
	techMobiChannel.Key = "techmobi-key"
	techMobiChannel.Models = "seedance2.0-pro,seedance2.0-lite"
	techMobiChannel.ModelMapping = &mapping
	require.NoError(t, model.DB.Create(&techMobiChannel).Error)
	insertMiddlewareAbility(t, techMobiChannel.Id, "default", "seedance2.0-pro", true, techMobiPriority, weight)
	insertMiddlewareAbility(t, techMobiChannel.Id, "default", "seedance2.0-lite", true, techMobiPriority, weight)

	publicID := "ast_ffffffffffffffffffffffffffffffff"
	asset := insertMiddlewareGeneralizedAsset(t, 7, publicID, "Image", model.AssetSourceStatusAvailable, time.Now().Add(time.Hour).Unix())
	restoreTechMobiMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeTechMobiVideo, middlewareAssetMaterializer{})
	defer restoreTechMobiMaterializer()
	model.InitChannelCache()

	selectedChannels := make([]int, 0, 2)
	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		selectedChannels = append(selectedChannels, common.GetContextKeyInt(c, constant.ContextKeyChannelId))
		c.Status(http.StatusOK)
	})
	requestForModel := func(modelName string) *httptest.ResponseRecorder {
		return performBytePlusAssetDistributorRequestWithMaterialize(router, "", fmt.Sprintf(`{
			"model":%q,
			"content":[{"type":"image_url","image_url":{"url":"asset://%s"},"role":"reference_image"}]
		}`, modelName, publicID))
	}

	first := requestForModel("seedance2.0-pro")
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())

	bytePlusChannel := middlewareBytePlusAssetChannel(131, constant.ChannelTypeBytePlus, "default", common.ChannelStatusEnabled, bytePlusPriority, weight)
	bytePlusChannel.Models = "seedance2.0-lite"
	require.NoError(t, model.DB.Create(&bytePlusChannel).Error)
	insertMiddlewareAbility(t, bytePlusChannel.Id, "default", "seedance2.0-lite", true, bytePlusPriority, weight)
	insertMiddlewareGeneralizedAssetBinding(t, asset.Id, bytePlusChannel.Id, "byteplus-upstream", model.AssetStatusActive)
	require.NoError(t, model.DB.Model(&model.Asset{}).Where("id = ?", asset.Id).Updates(map[string]any{
		"source_status":     model.AssetSourceStatusExpired,
		"source_expires_at": time.Now().Add(-time.Hour).Unix(),
	}).Error)
	model.InitChannelCache()

	second := requestForModel("seedance2.0-lite")

	require.Equal(t, http.StatusOK, second.Code, second.Body.String())
	require.Equal(t, []int{techMobiChannel.Id, bytePlusChannel.Id}, selectedChannels)
}

func TestTechMobiSpecificChannelRejectsExpiredAssetBoundToDifferentModelScope(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()

	priority := int64(1)
	weight := uint(1)
	mapping := `{"seedance2.0-pro":"doubao/seedance-pro","seedance2.0-lite":"doubao/seedance-lite"}`
	channel := middlewareBytePlusAssetChannel(106, constant.ChannelTypeTechMobiVideo, "default", common.ChannelStatusEnabled, priority, weight)
	channel.Key = "techmobi-key"
	channel.Models = "seedance2.0-pro,seedance2.0-lite"
	channel.ModelMapping = &mapping
	require.NoError(t, model.DB.Create(&channel).Error)
	insertMiddlewareAbility(t, channel.Id, "default", "seedance2.0-pro", true, priority, weight)
	insertMiddlewareAbility(t, channel.Id, "default", "seedance2.0-lite", true, priority, weight)

	publicID := "ast_12121212121212121212121212121212"
	asset := insertMiddlewareGeneralizedAsset(t, 7, publicID, "Image", model.AssetSourceStatusAvailable, time.Now().Add(time.Hour).Unix())
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeTechMobiVideo, middlewareAssetMaterializer{})
	defer restoreMaterializer()
	model.InitChannelCache()

	handlerCalls := 0
	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		handlerCalls++
		c.Status(http.StatusOK)
	})
	requestBody := func(modelName string) string {
		return fmt.Sprintf(`{
			"model":%q,
			"content":[{"type":"image_url","image_url":{"url":"asset://%s"},"role":"reference_image"}]
		}`, modelName, publicID)
	}

	first := performBytePlusAssetDistributorRequestWithMaterialize(router, "106", requestBody("seedance2.0-pro"))
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())
	require.NoError(t, model.DB.Model(&model.Asset{}).Where("id = ?", asset.Id).Updates(map[string]any{
		"source_status":     model.AssetSourceStatusExpired,
		"source_expires_at": time.Now().Add(-time.Hour).Unix(),
	}).Error)

	second := performBytePlusAssetDistributorRequest(router, "106", requestBody("seedance2.0-lite"))

	require.Equal(t, http.StatusServiceUnavailable, second.Code, second.Body.String())
	require.Contains(t, second.Body.String(), "asset_channel_unavailable")
	require.Equal(t, 1, handlerCalls)
}

func TestTechMobiMaterializeDisabledDoesNotRewriteFromDifferentKeyScope(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()

	priority := int64(1)
	weight := uint(1)
	mapping := `{"seedance2.0-pro":"doubao/seedance-pro"}`
	channel := middlewareBytePlusAssetChannel(106, constant.ChannelTypeTechMobiVideo, "default", common.ChannelStatusEnabled, priority, weight)
	channel.Key = "techmobi-key-a\ntechmobi-key-b"
	channel.Models = "seedance2.0-pro"
	channel.ModelMapping = &mapping
	channel.ChannelInfo = model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2, MultiKeyMode: constant.MultiKeyModePolling}
	require.NoError(t, model.DB.Create(&channel).Error)
	insertMiddlewareAbility(t, channel.Id, "default", "seedance2.0-pro", true, priority, weight)

	publicID := "ast_13131313131313131313131313131313"
	insertMiddlewareGeneralizedAsset(t, 7, publicID, "Image", model.AssetSourceStatusAvailable, time.Now().Add(time.Hour).Unix())
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeTechMobiVideo, middlewareAssetMaterializer{})
	defer restoreMaterializer()
	model.InitChannelCache()

	handlerCalls := 0
	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		handlerCalls++
		if handlerCalls == 2 {
			require.Equal(t, "techmobi-key-b", common.GetContextKeyString(c, constant.ContextKeyChannelKey))
			rewriteMap, _ := common.GetContextKeyType[map[string]string](c, constant.ContextKeyAssetRewriteMap)
			require.NotContains(t, rewriteMap, "asset://"+publicID)
		}
		c.Status(http.StatusOK)
	})
	body := fmt.Sprintf(`{
		"model":"seedance2.0-pro",
		"content":[{"type":"image_url","image_url":{"url":"asset://%s"},"role":"reference_image"}]
	}`, publicID)

	first := performBytePlusAssetDistributorRequestWithMaterialize(router, "", body)
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())
	channel.ChannelInfo.MultiKeyStatusList = map[int]int{0: common.ChannelStatusManuallyDisabled}
	channel.ChannelInfo.MultiKeyPollingIndex = 1
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("channel_info", channel.ChannelInfo).Error)
	model.InitChannelCache()

	second := performBytePlusAssetDistributorRequest(router, "", body)

	require.Equal(t, http.StatusOK, second.Code, second.Body.String())
	require.Equal(t, 2, handlerCalls)
}

func TestBytePlusAssetPinnedChannelOverridesRandomSelectionAndStoresRewrite(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	insertMiddlewareBytePlusAssetChannel(t, 132, "default", common.ChannelStatusEnabled, 1000, 1000)
	insertMiddlewareBytePlusAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusActive)
	model.InitChannelCache()

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		if got := common.GetContextKeyInt(c, constant.ContextKeyChannelId); got != 131 {
			c.String(http.StatusInternalServerError, "selected channel = %d, want pinned 131", got)
			return
		}
		if got := common.GetContextKeyString(c, constant.ContextKeyChannelKey); got != structuredMiddlewareBytePlusKey("test-api-131") {
			c.String(http.StatusInternalServerError, "selected key = %q", got)
			return
		}
		rewriteMap, ok := common.GetContextKeyType[map[string]string](c, constant.ContextKeyBytePlusAssetRewriteMap)
		if !ok || rewriteMap["asset://ast_1234567890abcdefABCDEF1234567890"] != "asset://upstream-image" {
			c.String(http.StatusInternalServerError, "rewrite map = %#v ok=%v", rewriteMap, ok)
			return
		}
		c.Status(http.StatusOK)
	})

	recorder := performBytePlusAssetDistributorRequest(router, "", `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
}

func TestBytePlusAssetSpecificChannelMustMatchPinnedChannel(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	insertMiddlewareBytePlusAssetChannel(t, 132, "default", common.ChannelStatusEnabled, 1, 1)
	insertMiddlewareBytePlusAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusActive)
	model.InitChannelCache()

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	recorder := performBytePlusAssetDistributorRequest(router, "132", `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`)
	require.Equal(t, http.StatusConflict, recorder.Code, recorder.Body.String())
	require.Contains(t, recorder.Body.String(), string(constant.ContextKeyBytePlusAssetPinnedChannelID)[:0]+`asset_channel_conflict`)
}

func TestBytePlusAssetSpecificChannelConflictWinsOverOwnedAssetResolutionErrors(t *testing.T) {
	tests := []struct {
		name      string
		status    string
		assetType string
		body      string
	}{
		{
			name:      "processing",
			status:    model.BytePlusAssetStatusProcessing,
			assetType: "Image",
			body: `{
				"model":"seedance-2.0",
				"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
			}`,
		},
		{
			name:      "failed",
			status:    model.BytePlusAssetStatusFailed,
			assetType: "Image",
			body: `{
				"model":"seedance-2.0",
				"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
			}`,
		},
		{
			name:      "type mismatch",
			status:    model.BytePlusAssetStatusActive,
			assetType: "Video",
			body: `{
				"model":"seedance-2.0",
				"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
			}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
			defer restoreDB()
			insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
			insertMiddlewareBytePlusAssetChannel(t, 132, "default", common.ChannelStatusEnabled, 1, 1)
			insertMiddlewareBytePlusAssetWithType(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", tt.status, tt.assetType)
			model.InitChannelCache()

			router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
				c.String(http.StatusInternalServerError, "handler should not run")
			})
			recorder := performBytePlusAssetDistributorRequest(router, "132", tt.body)
			require.Equal(t, http.StatusConflict, recorder.Code, recorder.Body.String())
			require.Contains(t, recorder.Body.String(), "asset_channel_conflict")
			require.NotContains(t, recorder.Body.String(), "asset_not_ready")
			require.NotContains(t, recorder.Body.String(), "asset_failed")
			require.NotContains(t, recorder.Body.String(), "invalid_asset_request")
		})
	}
}

func TestBytePlusAssetBlankUpstreamKeepsPinnedReferenceSemantics(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	insertMiddlewareBytePlusAssetChannel(t, 132, "default", common.ChannelStatusEnabled, 1, 1)
	insertMiddlewareBytePlusAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", " \t\n ", model.BytePlusAssetStatusActive)
	model.InitChannelCache()

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		c.String(http.StatusInternalServerError, "handler should not run")
	})
	body := `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`

	conflict := performBytePlusAssetDistributorRequest(router, "132", body)
	require.Equal(t, http.StatusConflict, conflict.Code, conflict.Body.String())
	require.Contains(t, conflict.Body.String(), "asset_channel_conflict")
	require.NotContains(t, conflict.Body.String(), "asset_not_ready")

	notReady := performBytePlusAssetDistributorRequest(router, "", body)
	require.Equal(t, http.StatusConflict, notReady.Code, notReady.Body.String())
	require.Contains(t, notReady.Body.String(), "asset_not_ready")
}

func TestBytePlusAssetRealPersonProfileConflictStopsBeforeChannelSelection(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	insertMiddlewareBytePlusAssetChannel(t, 132, "default", common.ChannelStatusEnabled, 1000, 1000)
	first := insertMiddlewareBytePlusRealPersonProfile(t, 7, 131, "rph_first", model.BytePlusRealPersonProfileStatusActive)
	second := insertMiddlewareBytePlusRealPersonProfile(t, 7, 132, "rph_second", model.BytePlusRealPersonProfileStatusActive)
	insertMiddlewareBytePlusRealPersonAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusActive, "Image", first.Id)
	insertMiddlewareBytePlusRealPersonAsset(t, 7, 132, "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "upstream-audio", model.BytePlusAssetStatusActive, "Audio", second.Id)
	model.InitChannelCache()

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		c.String(http.StatusInternalServerError, "handler should not run")
	})
	recorder := performBytePlusAssetDistributorRequest(router, "", `{
		"model":"seedance-2.0",
		"content":[
			{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"},
			{"type":"audio_url","audio_url":{"url":"asset://ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"role":"reference_audio"}
		]
	}`)
	require.Equal(t, http.StatusConflict, recorder.Code, recorder.Body.String())
	require.Contains(t, recorder.Body.String(), "asset_profile_conflict")
	require.NotContains(t, recorder.Body.String(), "asset_channel_conflict")
}

func TestBytePlusAssetPinnedChannelRequiresEnabledBytePlusAbility(t *testing.T) {
	tests := []struct {
		name        string
		channel     model.Channel
		withAbility bool
		wantStatus  int
		wantCode    string
	}{
		{
			name:        "disabled channel",
			channel:     middlewareBytePlusAssetChannel(131, constant.ChannelTypeBytePlus, "default", common.ChannelStatusManuallyDisabled, 1, 1),
			withAbility: true,
			wantStatus:  http.StatusServiceUnavailable,
			wantCode:    string(constant.ContextKeyBytePlusAssetPinnedChannelID)[:0] + "asset_channel_unavailable",
		},
		{
			name:        "non byteplus channel",
			channel:     middlewareBytePlusAssetChannel(131, constant.ChannelTypeOpenAI, "default", common.ChannelStatusEnabled, 1, 1),
			withAbility: true,
			wantStatus:  http.StatusServiceUnavailable,
			wantCode:    "asset_channel_unavailable",
		},
		{
			name:       "missing model ability",
			channel:    middlewareBytePlusAssetChannel(131, constant.ChannelTypeBytePlus, "default", common.ChannelStatusEnabled, 1, 1),
			wantStatus: http.StatusServiceUnavailable,
			wantCode:   "asset_channel_unavailable",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
			defer restoreDB()
			require.NoError(t, model.DB.Create(&tt.channel).Error)
			if tt.withAbility {
				insertMiddlewareAbility(t, 131, "default", "seedance-2.0", true, 1, 1)
			}
			insertMiddlewareBytePlusAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusActive)
			model.InitChannelCache()

			router := newBytePlusAssetDistributorRouter(func(c *gin.Context) { c.Status(http.StatusOK) })
			recorder := performBytePlusAssetDistributorRequest(router, "", `{
				"model":"seedance-2.0",
				"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
			}`)
			require.Equal(t, tt.wantStatus, recorder.Code, recorder.Body.String())
			require.Contains(t, recorder.Body.String(), tt.wantCode)
		})
	}
}

func TestBytePlusAssetNoReferenceSpecificChannelKeepsHistoricalTokenModelBypass(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	model.InitChannelCache()

	router := gin.New()
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUserId, 7)
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		common.SetContextKey(c, constant.ContextKeyTokenSpecificChannelId, "131")
		common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
		common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{"gpt-4": true})
		c.Next()
	})
	router.Use(Distribute())
	router.POST("/v1/videos", func(c *gin.Context) {
		if got := common.GetContextKeyInt(c, constant.ContextKeyChannelId); got != 131 {
			c.String(http.StatusInternalServerError, "selected channel = %d, want specific 131", got)
			return
		}
		c.Status(http.StatusOK)
	})

	recorder := performBytePlusAssetDistributorRequest(router, "", `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"https://example.com/image.png"},"role":"reference_image"}]
	}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
}

func TestBytePlusAssetPinnedChannelHonorsTokenModelAccessBeforeSpecificChannel(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	insertMiddlewareBytePlusAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusActive)
	model.InitChannelCache()

	router := gin.New()
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUserId, 7)
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		common.SetContextKey(c, constant.ContextKeyTokenSpecificChannelId, "131")
		common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
		common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{"gpt-4": true})
		c.Next()
	})
	router.Use(Distribute())
	router.POST("/v1/videos", func(c *gin.Context) { c.Status(http.StatusOK) })

	recorder := performBytePlusAssetDistributorRequest(router, "", `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`)
	require.Equal(t, http.StatusForbidden, recorder.Code, recorder.Body.String())
}

func TestBytePlusAssetTokenModelLimitRejectsBeforeAssetLookup(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	model.InitChannelCache()

	router := gin.New()
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUserId, 7)
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
		common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{"gpt-4": true})
		c.Next()
	})
	router.Use(Distribute())
	router.POST("/v1/videos", func(c *gin.Context) {
		c.String(http.StatusInternalServerError, "handler should not run")
	})

	recorder := performBytePlusAssetDistributorRequest(router, "", `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`)
	require.Equal(t, http.StatusForbidden, recorder.Code, recorder.Body.String())
	require.Contains(t, recorder.Body.String(), "This token has no access to model seedance-2.0")
	require.NotContains(t, recorder.Body.String(), "asset_not_found")
	require.NotContains(t, recorder.Body.String(), "asset_not_ready")
}

func TestBytePlusAssetPinnedChannelUsesAuthorizedAutoGroup(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	restoreAuto := useMiddlewareAutoGroupsForTest(t, []string{"team-a", "team-b"})
	defer restoreAuto()
	insertMiddlewareBytePlusAssetChannel(t, 131, "team-b", common.ChannelStatusEnabled, 1, 1)
	insertMiddlewareBytePlusAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusActive)
	model.InitChannelCache()

	router := gin.New()
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUserId, 7)
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "auto")
		c.Next()
	})
	router.Use(Distribute())
	router.POST("/v1/videos", func(c *gin.Context) {
		if got := common.GetContextKeyString(c, constant.ContextKeyAutoGroup); got != "team-b" {
			c.String(http.StatusInternalServerError, "auto group = %q, want team-b", got)
			return
		}
		c.Status(http.StatusOK)
	})

	recorder := performBytePlusAssetDistributorRequest(router, "", `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
}

func TestBytePlusAssetPinnedChannelRequiresSupportedEndpoint(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	insertMiddlewareBytePlusAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusActive)
	model.InitChannelCache()

	router := gin.New()
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUserId, 7)
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		c.Set("relay_mode", relayconstant.RelayModeVideoSubmit)
		c.Next()
	})
	router.Use(Distribute())
	router.POST("/v1/responses", func(c *gin.Context) { c.Status(http.StatusOK) })

	recorder := performBytePlusAssetDistributorRequestForPath(router, "/v1/responses", "", `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`)
	require.Equal(t, http.StatusServiceUnavailable, recorder.Code, recorder.Body.String())
	require.Contains(t, recorder.Body.String(), "asset_channel_unavailable")
}

func TestBytePlusAssetResolverErrorsPropagateBeforeSelection(t *testing.T) {
	tests := []struct {
		name       string
		assetUser  int
		status     string
		wantStatus int
		wantCode   string
	}{
		{name: "wrong owner", assetUser: 8, status: model.BytePlusAssetStatusActive, wantStatus: http.StatusNotFound, wantCode: "asset_not_found"},
		{name: "processing", assetUser: 7, status: model.BytePlusAssetStatusProcessing, wantStatus: http.StatusConflict, wantCode: "asset_not_ready"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
			defer restoreDB()
			insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
			insertMiddlewareBytePlusAssetChannel(t, 132, "default", common.ChannelStatusEnabled, 1000, 1000)
			insertMiddlewareBytePlusAsset(t, tt.assetUser, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", tt.status)
			model.InitChannelCache()

			router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
				c.String(http.StatusInternalServerError, "handler should not run")
			})
			recorder := performBytePlusAssetDistributorRequest(router, "", `{
				"model":"seedance-2.0",
				"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
			}`)
			require.Equal(t, tt.wantStatus, recorder.Code, recorder.Body.String())
			require.Contains(t, recorder.Body.String(), tt.wantCode)
		})
	}
}

func TestBytePlusAssetMalformedMediaURIAbortsBeforeSelection(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	insertMiddlewareBytePlusAssetChannel(t, 132, "default", common.ChannelStatusEnabled, 1000, 1000)
	model.InitChannelCache()

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		c.String(http.StatusInternalServerError, "handler should not run")
	})
	recorder := performBytePlusAssetDistributorRequest(router, "", `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_short"},"role":"reference_image"}]
	}`)
	require.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
	require.Contains(t, recorder.Body.String(), "invalid_asset_request")
	require.NotContains(t, recorder.Body.String(), "131")
	require.NotContains(t, recorder.Body.String(), "132")
}

func TestBytePlusAssetPinnedChannelConcurrencyLimitDoesNotFallback(t *testing.T) {
	restoreRuntime := useMiddlewareMemoryChannelConcurrencyForTest(t)
	defer restoreRuntime()
	restoreSetting := useMiddlewareChannelConcurrencyWaitSettingForTest(t, 20*time.Millisecond, 5*time.Millisecond, 1)
	defer restoreSetting()
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	insertMiddlewareBytePlusAssetChannel(t, 132, "default", common.ChannelStatusEnabled, 1000, 1000)
	insertMiddlewareBytePlusAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusActive)
	model.InitChannelCache()

	pinned, err := model.GetChannelById(131, true)
	require.NoError(t, err)
	heldLease, ok, err := service.TryAcquireChannelConcurrency(context.Background(), pinned)
	require.NoError(t, err)
	require.True(t, ok)
	t.Cleanup(func() { _ = service.ReleaseChannelConcurrency(context.Background(), heldLease) })

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) { c.Status(http.StatusOK) })
	recorder := performBytePlusAssetDistributorRequest(router, "", `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`)
	require.Equal(t, http.StatusTooManyRequests, recorder.Code, recorder.Body.String())
	require.NotContains(t, recorder.Body.String(), "132")
}

func TestBytePlusAssetNoAssetReferenceKeepsExistingSelection(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	ch := middlewareBytePlusAssetChannel(131, constant.ChannelTypeBytePlus, "default", common.ChannelStatusEnabled, 1, 1)
	require.NoError(t, model.DB.Create(&ch).Error)
	insertMiddlewareBytePlusAssetChannel(t, 132, "default", common.ChannelStatusEnabled, 1000, 1000)
	model.InitChannelCache()

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		if got := common.GetContextKeyInt(c, constant.ContextKeyChannelId); got != 132 {
			c.String(http.StatusInternalServerError, "selected channel = %d, want weighted fallback 132", got)
			return
		}
		if _, ok := common.GetContextKey(c, constant.ContextKeyBytePlusAssetPinnedChannelID); ok {
			c.String(http.StatusInternalServerError, "unexpected pinned channel")
			return
		}
		c.Status(http.StatusOK)
	})
	recorder := performBytePlusAssetDistributorRequest(router, "", `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"https://example.com/image.png"},"role":"reference_image"}]
	}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
}

func TestAssetReferenceRecoverableGeneralizedAssetWithoutBindingMaterializesCompleteRewrite(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeBytePlus, middlewareAssetMaterializer{})
	defer restoreMaterializer()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	publicID := "ast_1234567890abcdefABCDEF1234567890"
	insertMiddlewareGeneralizedAsset(t, 7, publicID, "Image", model.AssetSourceStatusAvailable, time.Now().Add(time.Hour).Unix())
	model.InitChannelCache()

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyAssetMaterializeEnabled, true)
		channel, err := model.GetChannelById(common.GetContextKeyInt(c, constant.ContextKeyChannelId), true)
		require.NoError(t, err)
		require.Nil(t, RefreshAssetRewriteMapForSelectedChannel(c, channel))
		require.Equal(t, 131, common.GetContextKeyInt(c, constant.ContextKeyChannelId))
		rewriteMap, ok := common.GetContextKeyType[map[string]string](c, constant.ContextKeyAssetRewriteMap)
		if !ok || rewriteMap["asset://"+publicID] != "asset://upstream-"+publicID {
			c.String(http.StatusInternalServerError, "rewrite map = %#v ok=%v", rewriteMap, ok)
			return
		}
		c.Status(http.StatusOK)
	})

	recorder := performBytePlusAssetDistributorRequest(router, "", `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
}

func TestAssetReferenceExternalRequestDefersMaterializationUntilWorkerFlag(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	calls := 0
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeBytePlus, middlewareAssetMaterializer{calls: &calls})
	defer restoreMaterializer()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	publicID := "ast_1234567890abcdefABCDEF1234567890"
	insertMiddlewareGeneralizedAsset(t, 7, publicID, "Image", model.AssetSourceStatusAvailable, time.Now().Add(time.Hour).Unix())
	model.InitChannelCache()

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		require.Equal(t, 131, common.GetContextKeyInt(c, constant.ContextKeyChannelId))
		_, hasRewrite := common.GetContextKeyType[map[string]string](c, constant.ContextKeyAssetRewriteMap)
		require.False(t, hasRewrite, "external distributor must not materialize or rewrite recoverable assets")
		c.Status(http.StatusOK)
	})

	recorder := performBytePlusAssetDistributorRequest(router, "", `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.Equal(t, 0, calls)
}

func TestAssetReferenceStrictInitializingTargetKeepsRequestEligibleForQueue(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	originalStrict := service.AssetModelCoverageStrictEnabled
	service.AssetModelCoverageStrictEnabled = true
	defer func() { service.AssetModelCoverageStrictEnabled = originalStrict }()
	originalSelfUse := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = true
	defer func() { operation_setting.SelfUseModeEnabled = originalSelfUse }()

	calls := 0
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeBytePlus, middlewareAssetMaterializer{calls: &calls})
	defer restoreMaterializer()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	publicID := "ast_1234567890abcdefABCDEF1234567890"
	insertMiddlewareGeneralizedAsset(t, 7, publicID, "Image", model.AssetSourceStatusAvailable, time.Now().Add(time.Hour).Unix())
	model.InitChannelCache()

	scope, err := service.ResolveAssetModelScope(service.AssetModelScopeInput{IdentityGroup: "default", AcceptUnpriced: true})
	require.NoError(t, err)
	require.Contains(t, scope.ModelNames, "seedance-2.0")
	now := model.GetDBTimestamp()
	require.NoError(t, model.DB.Create(&model.AssetModelCoverageTarget{
		ScopeKey:        scope.ScopeKey,
		ModelName:       "seedance-2.0",
		Status:          model.AssetModelTargetStatusSelecting,
		Generation:      0,
		CandidateIndex:  -1,
		CredentialIndex: -1,
		LeaseOwner:      "other-node",
		LeaseExpiresAt:  now + 60,
		CreatedAt:       now,
		UpdatedAt:       now,
	}).Error)

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		require.Equal(t, 131, common.GetContextKeyInt(c, constant.ContextKeyChannelId))
		_, hasRewrite := common.GetContextKeyType[map[string]string](c, constant.ContextKeyAssetRewriteMap)
		require.False(t, hasRewrite, "initializing target may select a queueing candidate but must not rewrite or submit")
		c.Status(http.StatusOK)
	})
	recorder := performBytePlusAssetDistributorRequest(router, "", `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.Equal(t, 0, calls)
}

func TestAssetReferenceSeedanceProxyMaterializationBypassesSourceURLRewriteBranch(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()

	priority := int64(1)
	weight := uint(1)
	apiKey := "modelapi-seedance-key"
	channel := middlewareBytePlusAssetChannel(156, constant.ChannelTypeModelAPISeedance, "default", common.ChannelStatusEnabled, priority, weight)
	channel.Key = apiKey
	channel.Name = "modelapi-seedance-156"
	channel.OtherSettings = `{"asset_materialization":{"provider":"seedance_proxy","gateway_base_url":"https://asset-gateway.example.invalid/v1","group_id":"grp_shared_aigc"}}`
	require.NoError(t, model.DB.Create(&channel).Error)
	insertMiddlewareAbility(t, 156, "default", "seedance-2.0", true, priority, weight)

	publicID := "ast_15615615615615615615615615615615"
	asset := insertMiddlewareGeneralizedAsset(t, 7, publicID, "Image", model.AssetSourceStatusUnavailable, 0)
	insertMiddlewareSeedanceProxyAssetBinding(t, asset.Id, 156, "https://asset-gateway.example.invalid", "grp_shared_aigc", apiKey, "seedance-proxy-upstream", model.AssetStatusActive)
	model.InitChannelCache()

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		require.Equal(t, 156, common.GetContextKeyInt(c, constant.ContextKeyChannelId))
		rewriteMap, ok := common.GetContextKeyType[map[string]string](c, constant.ContextKeyAssetRewriteMap)
		require.True(t, ok)
		require.Equal(t, "asset://seedance-proxy-upstream", rewriteMap["asset://"+publicID])
		require.NotContains(t, rewriteMap["asset://"+publicID], "https://")
		c.Status(http.StatusOK)
	})

	recorder := performBytePlusAssetDistributorRequestWithMaterialize(router, "", `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_15615615615615615615615615615615"},"role":"reference_image"}]
	}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
}

func TestAssetReferenceMaterializationFailuresAbortBeforeHandler(t *testing.T) {
	tests := []struct {
		name         string
		materializer service.AssetMaterializer
		seedBinding  func(t *testing.T, asset model.Asset)
		wantStatus   int
		wantCode     string
	}{
		{
			name:         "no materializer",
			materializer: nil,
			wantStatus:   http.StatusServiceUnavailable,
			wantCode:     "asset_channel_unavailable",
		},
		{
			name:         "provider create fail",
			materializer: middlewareAssetMaterializer{createErr: errors.New("BytePlus secret sk-live signed=https://signed.example/?X-Goog-Signature=abc")},
			wantStatus:   http.StatusServiceUnavailable,
			wantCode:     "asset_channel_unavailable",
		},
		{
			name:         "poll timeout",
			materializer: middlewareAssetMaterializer{},
			wantStatus:   http.StatusConflict,
			wantCode:     "asset_not_ready",
			seedBinding: func(t *testing.T, asset model.Asset) {
				require.NoError(t, model.DB.Create(&model.AssetBinding{
					AssetId:        asset.Id,
					ChannelId:      131,
					Status:         model.AssetBindingStatusLeased,
					LeaseOwner:     "other-node",
					LeaseExpiresAt: time.Now().Add(time.Minute).Unix(),
					CreatedAt:      time.Now().Unix(),
					UpdatedAt:      time.Now().Unix(),
				}).Error)
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
			defer restoreDB()
			restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeBytePlus, tt.materializer)
			defer restoreMaterializer()
			insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
			publicID := "ast_1234567890abcdefABCDEF1234567890"
			asset := insertMiddlewareGeneralizedAsset(t, 7, publicID, "Image", model.AssetSourceStatusAvailable, time.Now().Add(time.Hour).Unix())
			if tt.seedBinding != nil {
				tt.seedBinding(t, asset)
			}
			model.InitChannelCache()

			router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
				c.String(http.StatusInternalServerError, "handler should not run")
			})
			recorder := performBytePlusAssetDistributorRequestWithMaterialize(router, "", `{
				"model":"seedance-2.0",
				"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
			}`)

			require.Equal(t, tt.wantStatus, recorder.Code, recorder.Body.String())
			require.Contains(t, recorder.Body.String(), tt.wantCode)
			require.NotContains(t, recorder.Body.String(), "BytePlus")
			require.NotContains(t, recorder.Body.String(), "sk-live")
			require.NotContains(t, recorder.Body.String(), "signed.example")
			require.NotContains(t, recorder.Body.String(), "other-node")
		})
	}
}

func TestAssetReferenceRewriteMapUsesSelectedChannelOnly(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	insertMiddlewareBytePlusAssetChannel(t, 132, "default", common.ChannelStatusEnabled, 100, 1000)
	asset := insertMiddlewareGeneralizedAsset(t, 7, "ast_1234567890abcdefABCDEF1234567890", "Image", model.AssetSourceStatusAvailable, time.Now().Add(time.Hour).Unix())
	insertMiddlewareGeneralizedAssetBinding(t, asset.Id, 131, "upstream-131", model.AssetStatusActive)
	insertMiddlewareGeneralizedAssetBinding(t, asset.Id, 132, "upstream-132", model.AssetStatusActive)
	model.InitChannelCache()

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		require.Equal(t, 132, common.GetContextKeyInt(c, constant.ContextKeyChannelId))
		rewriteMap, ok := common.GetContextKeyType[map[string]string](c, constant.ContextKeyAssetRewriteMap)
		if !ok || rewriteMap["asset://ast_1234567890abcdefABCDEF1234567890"] != "asset://upstream-132" {
			c.String(http.StatusInternalServerError, "rewrite map = %#v ok=%v", rewriteMap, ok)
			return
		}
		if strings.Contains(fmt.Sprintf("%#v", rewriteMap), "upstream-131") {
			c.String(http.StatusInternalServerError, "rewrite map contains non-selected channel: %#v", rewriteMap)
			return
		}
		legacyMap, ok := common.GetContextKeyType[map[string]string](c, constant.ContextKeyBytePlusAssetRewriteMap)
		if !ok || legacyMap["asset://ast_1234567890abcdefABCDEF1234567890"] != "asset://upstream-132" {
			c.String(http.StatusInternalServerError, "legacy rewrite map = %#v ok=%v", legacyMap, ok)
			return
		}
		c.Status(http.StatusOK)
	})

	recorder := performBytePlusAssetDistributorRequest(router, "", `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
}

func TestAssetReferenceGeneralizedRowOutranksCoexistingLegacyPin(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	insertMiddlewareBytePlusAssetChannel(t, 132, "default", common.ChannelStatusEnabled, 100, 1000)
	publicID := "ast_1234567890abcdefABCDEF1234567890"
	insertMiddlewareBytePlusAsset(t, 7, 131, publicID, "legacy-upstream", model.BytePlusAssetStatusActive)
	asset := insertMiddlewareGeneralizedAsset(t, 7, publicID, "Image", model.AssetSourceStatusUnavailable, 0)
	insertMiddlewareGeneralizedAssetBinding(t, asset.Id, 132, "generalized-upstream", model.AssetStatusActive)
	model.InitChannelCache()

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		require.Equal(t, 132, common.GetContextKeyInt(c, constant.ContextKeyChannelId))
		rewriteMap, ok := common.GetContextKeyType[map[string]string](c, constant.ContextKeyAssetRewriteMap)
		require.True(t, ok)
		require.Equal(t, "asset://generalized-upstream", rewriteMap["asset://"+publicID])
		require.NotContains(t, fmt.Sprintf("%#v", rewriteMap), "legacy-upstream")
		c.Status(http.StatusOK)
	})

	recorder := performBytePlusAssetDistributorRequest(router, "", `{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
}

func TestAssetReferenceMixedRecoverableGeneralizedAndLegacyBindingSelectsPartialChannel(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeBytePlus, middlewareAssetMaterializer{createErr: errors.New("provider failed")})
	defer restoreMaterializer()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	insertMiddlewareBytePlusAssetChannel(t, 132, "default", common.ChannelStatusEnabled, 100, 1000)
	recoverableID := "ast_1234567890abcdefABCDEF1234567890"
	legacyID := "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	insertMiddlewareGeneralizedAsset(t, 7, recoverableID, "Image", model.AssetSourceStatusAvailable, time.Now().Add(time.Hour).Unix())
	insertMiddlewareBytePlusAsset(t, 7, 131, legacyID, "legacy-upstream", model.BytePlusAssetStatusActive)
	model.InitChannelCache()

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		c.String(http.StatusInternalServerError, "handler should not run")
	})

	recorder := performBytePlusAssetDistributorRequestWithMaterialize(router, "", `{
		"model":"seedance-2.0",
		"content":[
			{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"},
			{"type":"image_url","image_url":{"url":"asset://ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"role":"reference_image"}
		]
	}`)
	require.Equal(t, http.StatusServiceUnavailable, recorder.Code, recorder.Body.String())
	require.Contains(t, recorder.Body.String(), "asset_channel_unavailable")
	require.NotContains(t, recorder.Body.String(), "legacy-upstream")
	require.NotContains(t, recorder.Body.String(), recoverableID)
}

func newBytePlusAssetDistributorRouter(handler gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUserId, 7)
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		if specific := c.GetHeader("X-Test-Specific-Channel"); specific != "" {
			common.SetContextKey(c, constant.ContextKeyTokenSpecificChannelId, specific)
		}
		if c.GetHeader("X-Test-Materialize-Assets") == "true" {
			common.SetContextKey(c, constant.ContextKeyAssetMaterializeEnabled, true)
		}
		c.Next()
	})
	router.Use(Distribute())
	router.POST("/v1/videos", handler)
	return router
}

func performBytePlusAssetDistributorRequest(router *gin.Engine, specific string, body string) *httptest.ResponseRecorder {
	return performBytePlusAssetDistributorRequestForPath(router, "/v1/videos", specific, body)
}

func performBytePlusAssetDistributorRequestWithMaterialize(router *gin.Engine, specific string, body string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Test-Materialize-Assets", "true")
	if specific != "" {
		request.Header.Set("X-Test-Specific-Channel", specific)
	}
	router.ServeHTTP(recorder, request)
	return recorder
}

func performBytePlusAssetDistributorRequestForPath(router *gin.Engine, path string, specific string, body string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	if specific != "" {
		request.Header.Set("X-Test-Specific-Channel", specific)
	}
	router.ServeHTTP(recorder, request)
	return recorder
}

func useMiddlewareBytePlusAssetDBForTest(t *testing.T) func() {
	t.Helper()
	require.NoError(t, backendi18n.Init())
	prevDB := model.DB
	prevMemoryCacheEnabled := common.MemoryCacheEnabled
	prevUsingSQLite := common.UsingSQLite
	prevUsingMySQL := common.UsingMySQL
	prevUsingPostgreSQL := common.UsingPostgreSQL
	prevCommonGroupCol := middlewareModelCommonGroupCol

	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.Model{}, &model.Vendor{}, &model.ModelAvailabilityState{}, &model.BytePlusRealPersonProfile{}, &model.BytePlusAsset{}, &model.Asset{}, &model.AssetBinding{}, &model.AssetModelCoverageTarget{}, &model.AssetModelReadiness{}))
	sqlDB, err := db.DB()
	require.NoError(t, err)
	model.DB = db
	common.MemoryCacheEnabled = true
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	middlewareModelCommonGroupCol = "`group`"

	return func() {
		model.DB = prevDB
		common.MemoryCacheEnabled = prevMemoryCacheEnabled
		common.UsingSQLite = prevUsingSQLite
		common.UsingMySQL = prevUsingMySQL
		common.UsingPostgreSQL = prevUsingPostgreSQL
		middlewareModelCommonGroupCol = prevCommonGroupCol
		model.InitChannelCache()
		_ = sqlDB.Close()
	}
}

func insertMiddlewareBytePlusAssetChannel(t *testing.T, id int, group string, status int, priority int64, weight uint) {
	t.Helper()
	ch := middlewareBytePlusAssetChannel(id, constant.ChannelTypeBytePlus, group, status, priority, weight)
	require.NoError(t, model.DB.Create(&ch).Error)
	insertMiddlewareAbility(t, id, group, "seedance-2.0", status == common.ChannelStatusEnabled, priority, weight)
}

func middlewareBytePlusAssetChannel(id int, typ int, group string, status int, priority int64, weight uint) model.Channel {
	return model.Channel{
		Id:             id,
		Type:           typ,
		Key:            structuredMiddlewareBytePlusKey(fmt.Sprintf("test-api-%d", id)),
		Status:         status,
		Name:           fmt.Sprintf("byteplus-%d", id),
		Group:          group,
		Models:         "seedance-2.0",
		Priority:       &priority,
		Weight:         &weight,
		MaxConcurrency: 1,
	}
}

func insertMiddlewareAbility(t *testing.T, channelID int, group string, modelName string, enabled bool, priority int64, weight uint) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     group,
		Model:     modelName,
		ChannelId: channelID,
		Enabled:   enabled,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
}

func insertMiddlewareBytePlusAsset(t *testing.T, userID int, channelID int, publicID string, upstreamID string, status string) {
	t.Helper()
	insertMiddlewareBytePlusAssetWithType(t, userID, channelID, publicID, upstreamID, status, "Image")
}

func insertMiddlewareBytePlusAssetWithType(t *testing.T, userID int, channelID int, publicID string, upstreamID string, status string, assetType string) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.BytePlusAsset{
		PublicId:        publicID,
		UserId:          userID,
		ChannelId:       channelID,
		UpstreamAssetId: upstreamID,
		AssetType:       assetType,
		Status:          status,
	}).Error)
}

func insertMiddlewareGeneralizedAsset(t *testing.T, userID int, publicID string, assetType string, sourceStatus string, sourceExpiresAt int64) model.Asset {
	t.Helper()
	asset := model.Asset{
		PublicId:        publicID,
		UserId:          userID,
		AssetType:       assetType,
		Status:          model.AssetStatusActive,
		SourceStatus:    sourceStatus,
		StorageBackend:  "gcs",
		StorageBucket:   "bucket",
		ObjectKey:       "assets/" + publicID,
		SourceExpiresAt: sourceExpiresAt,
		CreatedAt:       time.Now().Unix(),
		UpdatedAt:       time.Now().Unix(),
	}
	require.NoError(t, model.DB.Create(&asset).Error)
	return asset
}

func insertMiddlewareGeneralizedAssetBinding(t *testing.T, assetID int64, channelID int, upstreamID string, status string) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:         assetID,
		ChannelId:       channelID,
		UpstreamAssetId: upstreamID,
		Status:          status,
		CreatedAt:       time.Now().Unix(),
		UpdatedAt:       time.Now().Unix(),
	}).Error)
}

func insertMiddlewareSeedanceProxyAssetBinding(t *testing.T, assetID int64, channelID int, origin string, groupID string, apiKey string, upstreamID string, status string) {
	t.Helper()
	digest := sha256.Sum256([]byte(origin + "\x00" + groupID + "\x00" + apiKey))
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:         assetID,
		ChannelId:       channelID,
		BindingScope:    "seedance-proxy:v1:" + hex.EncodeToString(digest[:]),
		UpstreamAssetId: upstreamID,
		Status:          status,
		CreatedAt:       time.Now().Unix(),
		UpdatedAt:       time.Now().Unix(),
	}).Error)
}

func insertMiddlewareBytePlusRealPersonProfile(t *testing.T, userID int, channelID int, publicID string, status string) model.BytePlusRealPersonProfile {
	t.Helper()
	profile := model.BytePlusRealPersonProfile{
		PublicId:  publicID,
		UserId:    userID,
		Name:      publicID,
		ChannelId: channelID,
		Status:    status,
	}
	require.NoError(t, model.DB.Create(&profile).Error)
	return profile
}

func insertMiddlewareBytePlusRealPersonAsset(t *testing.T, userID int, channelID int, publicID string, upstreamID string, status string, assetType string, profileID int64) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.BytePlusAsset{
		PublicId:               publicID,
		UserId:                 userID,
		ChannelId:              channelID,
		UpstreamAssetId:        upstreamID,
		AssetType:              assetType,
		Status:                 status,
		RealPersonProfileId:    &profileID,
		ModerationStrategy:     "Default",
		CreatedTime:            100,
		UpdatedTime:            100,
		DeleteLeaseUpdatedTime: 0,
	}).Error)
}

func structuredMiddlewareBytePlusKey(apiKey string) string {
	return fmt.Sprintf(`{"api_key":%q,"access_key_id":"ak","secret_access_key":"sec","project_name":"test-project"}`, apiKey)
}

func useMiddlewareAutoGroupsForTest(t *testing.T, groups []string) func() {
	t.Helper()
	originalAutoGroups := setting.AutoGroups2JsonString()
	rawGroups := `["` + strings.Join(groups, `","`) + `"]`
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(rawGroups))
	groupRatioSetting := ratio_setting.GetGroupRatioSetting()
	originalSpecial := groupRatioSetting.GroupSpecialUsableGroup.ReadAll()
	groupRatioSetting.GroupSpecialUsableGroup.Clear()
	special := map[string]map[string]string{"default": {}}
	for _, group := range groups {
		special["default"][group] = group
	}
	groupRatioSetting.GroupSpecialUsableGroup.AddAll(special)
	return func() {
		_ = setting.UpdateAutoGroupsByJsonString(originalAutoGroups)
		groupRatioSetting.GroupSpecialUsableGroup.Clear()
		groupRatioSetting.GroupSpecialUsableGroup.AddAll(originalSpecial)
	}
}
