package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	backendi18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type middlewareAssetMaterializer struct {
	createErr error
	calls     *int
}

func (m middlewareAssetMaterializer) CreateAsset(ctx context.Context, input service.AssetMaterializeInput) (service.AssetMaterializeResult, error) {
	if m.calls != nil {
		*m.calls = *m.calls + 1
	}
	if m.createErr != nil {
		return service.AssetMaterializeResult{}, m.createErr
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

	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.BytePlusRealPersonProfile{}, &model.BytePlusAsset{}, &model.Asset{}, &model.AssetBinding{}))
	sqlDB, err := db.DB()
	require.NoError(t, err)
	model.DB = db
	common.MemoryCacheEnabled = true
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	return func() {
		model.DB = prevDB
		common.MemoryCacheEnabled = prevMemoryCacheEnabled
		common.UsingSQLite = prevUsingSQLite
		common.UsingMySQL = prevUsingMySQL
		common.UsingPostgreSQL = prevUsingPostgreSQL
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
