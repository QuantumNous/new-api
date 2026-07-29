package controller

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	backendI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type bytePlusAssetErrorEnvelope struct {
	Error types.OpenAIError `json:"error"`
}

func TestCreateBytePlusAssetBindsTokenContextAndReturnsPublicAsset(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalCreate := createBytePlusAsset
	t.Cleanup(func() { createBytePlusAsset = originalCreate })

	createBytePlusAsset = func(ctx context.Context, userID int, userGroup string, usingGroup string, specificChannelID int, request dto.BytePlusAssetCreateRequest) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		require.NotNil(t, ctx)
		require.Equal(t, 123, userID)
		require.Equal(t, "identity-group", userGroup)
		require.Equal(t, "token-group", usingGroup)
		require.Equal(t, 456, specificChannelID)
		require.Equal(t, "https://cdn.example.com/public.png", request.URL)
		require.Equal(t, "Image", request.AssetType)
		require.NotNil(t, request.Moderation)
		require.Equal(t, "Skip", request.Moderation.Strategy)
		return &dto.BytePlusAssetResponse{
			ID:        "ast_1234567890abcdefABCDEF1234567890",
			Object:    "asset",
			AssetType: "Image",
			Status:    model.BytePlusAssetStatusProcessing,
			Moderation: dto.BytePlusAssetModeration{
				Strategy: "Skip",
			},
			CreatedAt: 1784990000,
		}, nil
	}

	ctx, recorder := newBytePlusAssetJSONContext(http.MethodPost, "/v1/assets", `{"url":"https://cdn.example.com/public.png","asset_type":"Image","moderation":{"strategy":"Skip"}}`)
	setBytePlusAssetTokenContext(ctx)
	CreateBytePlusAsset(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	requireBytePlusAssetPublicBody(t, recorder.Body.String())
	var response dto.BytePlusAssetResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.Equal(t, "ast_1234567890abcdefABCDEF1234567890", response.ID)
	require.Equal(t, "asset", response.Object)
	require.Equal(t, "Image", response.AssetType)
	require.Equal(t, model.BytePlusAssetStatusProcessing, response.Status)
	require.Equal(t, "Skip", response.Moderation.Strategy)
	require.Equal(t, int64(1784990000), response.CreatedAt)
}

func TestCreateBytePlusAssetRejectsInvalidBodyWithOpenAIEnvelope(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalCreate := createBytePlusAsset
	t.Cleanup(func() { createBytePlusAsset = originalCreate })
	createBytePlusAsset = func(context.Context, int, string, string, int, dto.BytePlusAssetCreateRequest) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		t.Fatalf("service must not be called for invalid JSON")
		return nil, nil
	}

	ctx, recorder := newBytePlusAssetJSONContext(http.MethodPost, "/v1/assets", `{"url":`)
	setBytePlusAssetTokenContext(ctx)
	CreateBytePlusAsset(ctx)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
	requireBytePlusAssetError(t, recorder.Body.Bytes(), "invalid_asset_request", "Invalid asset request")
	requireBytePlusAssetPublicBody(t, recorder.Body.String())
}

func TestCreateBytePlusAssetRejectsTokenWithoutSeedanceModelAccess(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalCreate := createBytePlusAsset
	t.Cleanup(func() { createBytePlusAsset = originalCreate })
	createBytePlusAsset = func(context.Context, int, string, string, int, dto.BytePlusAssetCreateRequest) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		t.Fatalf("service must not be called when token cannot access seedance-2.0")
		return nil, nil
	}

	ctx, recorder := newBytePlusAssetJSONContext(http.MethodPost, "/v1/assets", `{"url":"https://cdn.example.com/public.png","asset_type":"Image"}`)
	setBytePlusAssetTokenContext(ctx)
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimit, map[string]bool{"gpt-4": true})
	CreateBytePlusAsset(ctx)

	require.Equal(t, http.StatusForbidden, recorder.Code)
	requireBytePlusAssetError(t, recorder.Body.Bytes(), string(types.ErrorCodeAccessDenied), "This token has no access to model seedance-2.0")
	requireBytePlusAssetPublicBody(t, recorder.Body.String())
}

func TestCreateBytePlusAssetMapsNilServiceResponseToStorageError(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalCreate := createBytePlusAsset
	t.Cleanup(func() { createBytePlusAsset = originalCreate })
	createBytePlusAsset = func(context.Context, int, string, string, int, dto.BytePlusAssetCreateRequest) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		return nil, nil
	}

	ctx, recorder := newBytePlusAssetJSONContext(http.MethodPost, "/v1/assets", `{"url":"https://cdn.example.com/public.png","asset_type":"Image"}`)
	setBytePlusAssetTokenContext(ctx)
	CreateBytePlusAsset(ctx)

	require.Equal(t, http.StatusInternalServerError, recorder.Code)
	requireBytePlusAssetError(t, recorder.Body.Bytes(), "asset_storage_error", "Asset storage error, please try again later")
	requireBytePlusAssetPublicBody(t, recorder.Body.String())
}

func TestGetBytePlusAssetUsesPathIDAndAuthenticatedUser(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalGet := getBytePlusAsset
	t.Cleanup(func() { getBytePlusAsset = originalGet })

	getBytePlusAsset = func(ctx context.Context, userID int, assetID string) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		require.NotNil(t, ctx)
		require.Equal(t, 123, userID)
		require.Equal(t, "ast_1234567890abcdefABCDEF1234567890", assetID)
		return &dto.BytePlusAssetResponse{
			ID:        assetID,
			Object:    "asset",
			AssetType: "Video",
			Status:    model.BytePlusAssetStatusActive,
			Moderation: dto.BytePlusAssetModeration{
				Strategy: "Default",
			},
			CreatedAt: 1784990001,
		}, nil
	}

	ctx, recorder := newBytePlusAssetJSONContext(http.MethodGet, "/v1/assets/ast_1234567890abcdefABCDEF1234567890", "")
	ctx.Params = gin.Params{{Key: "asset_id", Value: "ast_1234567890abcdefABCDEF1234567890"}}
	setBytePlusAssetTokenContext(ctx)
	GetBytePlusAsset(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	requireBytePlusAssetPublicBody(t, recorder.Body.String())
	var response dto.BytePlusAssetResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.Equal(t, "ast_1234567890abcdefABCDEF1234567890", response.ID)
	require.Equal(t, "asset", response.Object)
	require.Equal(t, "Video", response.AssetType)
	require.Equal(t, model.BytePlusAssetStatusActive, response.Status)
}

func TestGetBytePlusAssetRejectsTokenWithoutSeedanceModelAccess(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalGet := getBytePlusAsset
	t.Cleanup(func() { getBytePlusAsset = originalGet })
	getBytePlusAsset = func(context.Context, int, string) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		t.Fatalf("service must not be called when token cannot access seedance-2.0")
		return nil, nil
	}

	ctx, recorder := newBytePlusAssetJSONContext(http.MethodGet, "/v1/assets/ast_1234567890abcdefABCDEF1234567890", "")
	ctx.Params = gin.Params{{Key: "asset_id", Value: "ast_1234567890abcdefABCDEF1234567890"}}
	setBytePlusAssetTokenContext(ctx)
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimit, map[string]bool{"gpt-4": true})
	GetBytePlusAsset(ctx)

	require.Equal(t, http.StatusForbidden, recorder.Code)
	requireBytePlusAssetError(t, recorder.Body.Bytes(), string(types.ErrorCodeAccessDenied), "This token has no access to model seedance-2.0")
	requireBytePlusAssetPublicBody(t, recorder.Body.String())
}

func TestGetBytePlusAssetMapsNilServiceResponseToStorageError(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalGet := getBytePlusAsset
	t.Cleanup(func() { getBytePlusAsset = originalGet })
	getBytePlusAsset = func(context.Context, int, string) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		return nil, nil
	}

	ctx, recorder := newBytePlusAssetJSONContext(http.MethodGet, "/v1/assets/ast_1234567890abcdefABCDEF1234567890", "")
	ctx.Params = gin.Params{{Key: "asset_id", Value: "ast_1234567890abcdefABCDEF1234567890"}}
	setBytePlusAssetTokenContext(ctx)
	GetBytePlusAsset(ctx)

	require.Equal(t, http.StatusInternalServerError, recorder.Code)
	requireBytePlusAssetError(t, recorder.Body.Bytes(), "asset_storage_error", "Asset storage error, please try again later")
	requireBytePlusAssetPublicBody(t, recorder.Body.String())
}

func TestGetBytePlusAssetMapsServiceErrorToI18nOpenAIEnvelopeWithoutLeaks(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalGet := getBytePlusAsset
	t.Cleanup(func() { getBytePlusAsset = originalGet })

	getBytePlusAsset = func(context.Context, int, string) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		return nil, types.NewOpenAIError(
			errors.New("raw db https://signed.example.com/private.png upstream-asset group-abc project3 sk-test"),
			types.ErrorCodeAssetNotFound,
			http.StatusNotFound,
			types.ErrOptionWithNoRecordErrorLog(),
		)
	}

	ctx, recorder := newBytePlusAssetJSONContext(http.MethodGet, "/v1/assets/ast_missing", "")
	ctx.Params = gin.Params{{Key: "asset_id", Value: "ast_missing"}}
	setBytePlusAssetTokenContext(ctx)
	GetBytePlusAsset(ctx)

	require.Equal(t, http.StatusNotFound, recorder.Code)
	requireBytePlusAssetError(t, recorder.Body.Bytes(), "asset_not_found", "Asset not found")
	requireBytePlusAssetPublicBody(t, recorder.Body.String())
}

func TestGetBytePlusAssetRejectsBlankPathID(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalGet := getBytePlusAsset
	t.Cleanup(func() { getBytePlusAsset = originalGet })
	getBytePlusAsset = func(context.Context, int, string) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		t.Fatalf("service must not be called for blank asset id")
		return nil, nil
	}

	ctx, recorder := newBytePlusAssetJSONContext(http.MethodGet, "/v1/assets/%20", "")
	ctx.Params = gin.Params{{Key: "asset_id", Value: " "}}
	setBytePlusAssetTokenContext(ctx)
	GetBytePlusAsset(ctx)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
	requireBytePlusAssetError(t, recorder.Body.Bytes(), "invalid_asset_request", "Invalid asset request")
}

func newBytePlusAssetJSONContext(method string, target string, body string) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Request.Header.Set("Accept-Language", "en")
	return ctx, recorder
}

func setBytePlusAssetTokenContext(ctx *gin.Context) {
	common.SetContextKey(ctx, constant.ContextKeyUserId, 123)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "identity-group")
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, "token-group")
	common.SetContextKey(ctx, constant.ContextKeyTokenSpecificChannelId, "456")
}

func requireBytePlusAssetError(t *testing.T, body []byte, code any, message string) {
	t.Helper()

	var envelope bytePlusAssetErrorEnvelope
	require.NoError(t, common.Unmarshal(body, &envelope))
	require.Equal(t, message, envelope.Error.Message)
	require.Equal(t, code, envelope.Error.Code)
	require.Equal(t, code, envelope.Error.Type)
	require.Empty(t, envelope.Error.Param)
}

func requireBytePlusAssetPublicBody(t *testing.T, body string) {
	t.Helper()

	for _, forbidden := range []string{
		"group-abc",
		"upstream-asset",
		"project3",
		"signed.example.com",
		"private.png",
		"sk-test",
		"Authorization",
		"channel_key",
		"source_url",
		"upstream_asset_id",
		"asset_group_id",
		"channel_id",
		"raw db",
	} {
		require.NotContains(t, body, forbidden)
	}
}
