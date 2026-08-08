package controller

import (
	"bytes"
	"context"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	backendI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCreateAssetFromURLUsesCanonicalServiceUserIDAndPublicShape(t *testing.T) {
	originalCreate := createAssetFromURL
	restoreReconcile := installAssetControllerReconcileStub(t)
	t.Cleanup(func() {
		createAssetFromURL = originalCreate
		restoreReconcile()
	})

	var got service.AssetFromURLRequest
	createAssetFromURL = func(ctx context.Context, request service.AssetFromURLRequest) (*service.AssetResult, error) {
		got = request
		return &service.AssetResult{
			PublicID:        "ast_public",
			AssetType:       "Image",
			Status:          model.AssetStatusActive,
			CreatedAt:       1785678901,
			SourceExpiresAt: 1788270901,
		}, nil
	}

	ctx, recorder := newAssetJSONContext(http.MethodPost, "/v1/assets", `{"url":"https://cdn.example.com/public.png","asset_type":"Image"}`)
	setAssetTokenContext(ctx, 123)
	CreateAsset(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, service.AssetFromURLRequest{UserID: 123, AssetType: "Image", URL: "https://cdn.example.com/public.png"}, got)
	var response dto.AssetResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.Equal(t, "asset://ast_public", response.AssetURL)
	require.EqualValues(t, 1785678901, response.CreatedAt)
	requireAssetPublicBody(t, recorder.Body.String())
}

func TestCreateAssetOptionalModelAllowListAllowedDeniedAndOmitted(t *testing.T) {
	originalCreate := createAssetFromURL
	originalReconcile := reconcileAssetForScope
	t.Cleanup(func() {
		createAssetFromURL = originalCreate
		reconcileAssetForScope = originalReconcile
	})
	calls := 0
	createAssetFromURL = func(context.Context, service.AssetFromURLRequest) (*service.AssetResult, error) {
		calls++
		return &service.AssetResult{PublicID: "ast_public", AssetType: "Image", Status: model.AssetStatusActive}, nil
	}
	reconcileAssetForScope = func(ctx context.Context, userID int, publicID string, scope service.AssetModelScope) (*service.AssetResult, error) {
		return &service.AssetResult{PublicID: publicID, AssetType: "Image", Status: model.AssetStatusActive}, nil
	}

	omitted, omittedRecorder := newAssetJSONContext(http.MethodPost, "/v1/assets", `{"url":"https://cdn.example.com/public.png","asset_type":"Image"}`)
	setAssetTokenContext(omitted, 123)
	common.SetContextKey(omitted, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(omitted, constant.ContextKeyTokenModelLimit, map[string]bool{"gpt-4.1": true})
	CreateAsset(omitted)
	require.Equal(t, http.StatusOK, omittedRecorder.Code, omittedRecorder.Body.String())

	allowed, allowedRecorder := newAssetJSONContext(http.MethodPost, "/v1/assets", `{"url":"https://cdn.example.com/public.png","asset_type":"Image","model":"gpt-4.1"}`)
	setAssetTokenContext(allowed, 123)
	common.SetContextKey(allowed, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(allowed, constant.ContextKeyTokenModelLimit, map[string]bool{"gpt-4.1": true})
	CreateAsset(allowed)
	require.Equal(t, http.StatusOK, allowedRecorder.Code, allowedRecorder.Body.String())

	denied, deniedRecorder := newAssetJSONContext(http.MethodPost, "/v1/assets", `{"url":"https://cdn.example.com/public.png","asset_type":"Image","model":"gpt-5"}`)
	setAssetTokenContext(denied, 123)
	common.SetContextKey(denied, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(denied, constant.ContextKeyTokenModelLimit, map[string]bool{"gpt-4.1": true})
	CreateAsset(denied)
	require.Equal(t, http.StatusOK, deniedRecorder.Code)
	require.Equal(t, 3, calls)
}

func TestAssetControllerIgnoresClientModelAndReconcilesWithAuthenticatedScope(t *testing.T) {
	originalCreate := createAssetFromURL
	originalUpload := uploadAsset
	originalComplete := completeAssetUpload
	originalGet := getAsset
	originalReconcile := reconcileAssetForScope
	originalResolve := resolveAssetModelScopeForContext
	t.Cleanup(func() {
		createAssetFromURL = originalCreate
		uploadAsset = originalUpload
		completeAssetUpload = originalComplete
		getAsset = originalGet
		reconcileAssetForScope = originalReconcile
		resolveAssetModelScopeForContext = originalResolve
	})

	scope := service.AssetModelScope{ScopeKey: "scope-auth", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"}}
	resolveCalls := 0
	resolveAssetModelScopeForContext = func(c *gin.Context, userID int) (service.AssetModelScope, error) {
		resolveCalls++
		return scope, nil
	}
	reconcileCalls := 0
	reconcileAssetForScope = func(ctx context.Context, userID int, publicID string, gotScope service.AssetModelScope) (*service.AssetResult, error) {
		reconcileCalls++
		require.Equal(t, scope, gotScope)
		require.Equal(t, 123, userID)
		return &service.AssetResult{PublicID: publicID, AssetType: "Image", Status: model.AssetStatusProcessing}, nil
	}

	createAssetFromURL = func(ctx context.Context, request service.AssetFromURLRequest) (*service.AssetResult, error) {
		return &service.AssetResult{PublicID: "ast_json", AssetType: "Image", Status: model.AssetStatusActive}, nil
	}
	jsonCtx, jsonRecorder := newAssetJSONContext(http.MethodPost, "/v1/assets", `{"url":"https://cdn.example.com/public.png","asset_type":"Image","model":"client-value-must-not-select-readiness"}`)
	setBlockedAssetModelContext(jsonCtx)
	CreateAsset(jsonCtx)
	require.Equal(t, http.StatusOK, jsonRecorder.Code, jsonRecorder.Body.String())
	require.Contains(t, jsonRecorder.Body.String(), `"status":"Processing"`)

	uploadAsset = func(ctx context.Context, request service.AssetUploadRequest) (*service.AssetResult, error) {
		return &service.AssetResult{PublicID: "ast_upload", AssetType: "Image", Status: model.AssetStatusActive}, nil
	}
	uploadCtx, uploadRecorder := newAssetMultipartContext(t, map[string]string{"model": "client-value-must-not-select-readiness", "asset_type": "Image"}, "file", "image.png", "image/png", serviceTestTinyPNG())
	setBlockedAssetModelContext(uploadCtx)
	UploadAsset(uploadCtx)
	require.Equal(t, http.StatusOK, uploadRecorder.Code, uploadRecorder.Body.String())

	completeAssetUpload = func(ctx context.Context, request service.AssetCompleteUploadRequest) (*service.AssetResult, error) {
		return &service.AssetResult{PublicID: "ast_complete", AssetType: "Image", Status: model.AssetStatusActive}, nil
	}
	completeCtx, completeRecorder := newAssetJSONContext(http.MethodPost, "/v1/assets/uploads/upl_public/complete", `{}`)
	completeCtx.Params = gin.Params{{Key: "upload_id", Value: "upl_public"}}
	setBlockedAssetModelContext(completeCtx)
	CompleteAssetUpload(completeCtx)
	require.Equal(t, http.StatusOK, completeRecorder.Code, completeRecorder.Body.String())

	getAsset = func(ctx context.Context, userID int, assetID string) (*service.AssetResult, error) {
		return &service.AssetResult{PublicID: assetID, AssetType: "Image", Status: model.AssetStatusActive}, nil
	}
	getCtx, getRecorder := newAssetJSONContext(http.MethodGet, "/v1/assets/ast_get?model=client-value-must-not-select-readiness", "")
	getCtx.Params = gin.Params{{Key: "asset_id", Value: "ast_get"}}
	setBlockedAssetModelContext(getCtx)
	GetAsset(getCtx)
	require.Equal(t, http.StatusOK, getRecorder.Code, getRecorder.Body.String())

	require.Equal(t, 4, resolveCalls)
	require.Equal(t, 4, reconcileCalls)
}

func TestAssetControllerRejectsInvalidSpecificChannelBeforeReconcile(t *testing.T) {
	withSelfUseModeEnabled(t)
	db := setupModelListControllerTestDB(t)
	priority := int64(0)
	weight := uint(100)
	require.NoError(t, db.Create(&model.Channel{
		Id:       92021,
		Type:     constant.ChannelTypeTechMobiVideo,
		Status:   common.ChannelStatusEnabled,
		Models:   "seedance-2.0",
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "seedance-2.0", ChannelId: 92021,
		Enabled: true, Priority: &priority, Weight: weight,
	}).Error)

	originalCreate := createAssetFromURL
	originalReconcile := reconcileAssetForScope
	originalResolve := resolveAssetModelScopeForContext
	t.Cleanup(func() {
		createAssetFromURL = originalCreate
		reconcileAssetForScope = originalReconcile
		resolveAssetModelScopeForContext = originalResolve
	})
	createAssetFromURL = func(ctx context.Context, request service.AssetFromURLRequest) (*service.AssetResult, error) {
		return &service.AssetResult{PublicID: "ast_specific", AssetType: "Image", Status: model.AssetStatusActive}, nil
	}
	resolveAssetModelScopeForContext = service.ResolveAssetModelScopeForContext
	reconcileCalls := 0
	reconcileAssetForScope = func(ctx context.Context, userID int, publicID string, scope service.AssetModelScope) (*service.AssetResult, error) {
		reconcileCalls++
		return &service.AssetResult{PublicID: publicID, AssetType: "Image", Status: model.AssetStatusActive}, nil
	}

	for _, raw := range []string{"abc", "0", "-7"} {
		ctx, recorder := newAssetJSONContext(http.MethodPost, "/v1/assets", `{"url":"https://cdn.example.com/public.png","asset_type":"Image"}`)
		setAssetTokenContext(ctx, 123)
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenSpecificChannelId, raw)

		CreateAsset(ctx)

		require.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
		requireAssetError(t, recorder.Body.Bytes(), "invalid_asset_request")
	}

	missing, missingRecorder := newAssetJSONContext(http.MethodPost, "/v1/assets", `{"url":"https://cdn.example.com/public.png","asset_type":"Image"}`)
	setAssetTokenContext(missing, 123)
	common.SetContextKey(missing, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(missing, constant.ContextKeyTokenGroup, "default")
	CreateAsset(missing)
	require.Equal(t, http.StatusOK, missingRecorder.Code, missingRecorder.Body.String())
	require.Equal(t, 1, reconcileCalls)
}

func TestAssetControllerMapsReconcileBindingErrorToStorageError(t *testing.T) {
	originalCreate := createAssetFromURL
	originalReconcile := reconcileAssetForScope
	originalResolve := resolveAssetModelScopeForContext
	t.Cleanup(func() {
		createAssetFromURL = originalCreate
		reconcileAssetForScope = originalReconcile
		resolveAssetModelScopeForContext = originalResolve
	})
	createAssetFromURL = func(ctx context.Context, request service.AssetFromURLRequest) (*service.AssetResult, error) {
		return &service.AssetResult{PublicID: "ast_binding_error", AssetType: "Image", Status: model.AssetStatusActive}, nil
	}
	resolveAssetModelScopeForContext = func(c *gin.Context, userID int) (service.AssetModelScope, error) {
		return service.AssetModelScope{ScopeKey: "scope", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"}}, nil
	}
	reconcileAssetForScope = func(ctx context.Context, userID int, publicID string, scope service.AssetModelScope) (*service.AssetResult, error) {
		return nil, errors.New("asset binding lookup unavailable")
	}

	ctx, recorder := newAssetJSONContext(http.MethodPost, "/v1/assets", `{"url":"https://cdn.example.com/public.png","asset_type":"Image"}`)
	setAssetTokenContext(ctx, 123)
	CreateAsset(ctx)

	require.Equal(t, http.StatusInternalServerError, recorder.Code)
	requireAssetError(t, recorder.Body.Bytes(), "asset_storage_error")
	requireAssetPublicBody(t, recorder.Body.String())
}

func TestUploadAssetInfersTypeAndMapsMissingFile(t *testing.T) {
	originalUpload := uploadAsset
	restoreReconcile := installAssetControllerReconcileStub(t)
	t.Cleanup(func() {
		uploadAsset = originalUpload
		restoreReconcile()
	})

	var got service.AssetUploadRequest
	uploadAsset = func(ctx context.Context, request service.AssetUploadRequest) (*service.AssetResult, error) {
		got = request
		_, err := io.Copy(io.Discard, request.Body)
		require.NoError(t, err)
		return &service.AssetResult{PublicID: "ast_upload", AssetType: request.AssetType, Status: model.AssetStatusActive}, nil
	}

	ctx, recorder := newAssetMultipartContext(t, map[string]string{"model": "gpt-4.1"}, "file", "voice.mp3", "audio/mpeg", serviceTestTinyMP3())
	setAssetTokenContext(ctx, 123)
	UploadAsset(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.Equal(t, 123, got.UserID)
	require.Equal(t, "Audio", got.AssetType)
	require.Equal(t, "voice.mp3", got.Filename)
	requireAssetPublicBody(t, recorder.Body.String())

	missing, missingRecorder := newAssetMultipartContext(t, map[string]string{"asset_type": "Image"}, "", "", "", nil)
	setAssetTokenContext(missing, 123)
	UploadAsset(missing)
	require.Equal(t, http.StatusBadRequest, missingRecorder.Code)
	requireAssetError(t, missingRecorder.Body.Bytes(), "invalid_asset_request")
}

func TestUploadAssetAllowsMultipartEnvelopeAndUsesServiceFileCap(t *testing.T) {
	originalUpload := uploadAsset
	restoreReconcile := installAssetControllerReconcileStub(t)
	t.Cleanup(func() {
		uploadAsset = originalUpload
		restoreReconcile()
	})

	exactFile := serviceTestTinyMP3()
	t.Setenv("ASSET_MULTIPART_MAX_BYTES", strconv.Itoa(len(exactFile)))
	t.Setenv("ASSET_AUDIO_MAX_BYTES", strconv.Itoa(len(exactFile)+8))

	serviceCalls := 0
	uploadAsset = func(ctx context.Context, request service.AssetUploadRequest) (*service.AssetResult, error) {
		serviceCalls++
		if request.Filename == "exact.mp3" {
			body, err := io.ReadAll(request.Body)
			require.NoError(t, err)
			require.Equal(t, exactFile, body)
			return &service.AssetResult{PublicID: "ast_exact", AssetType: request.AssetType, Status: model.AssetStatusActive}, nil
		}
		return service.UploadAsset(ctx, request)
	}

	exact, exactRecorder := newAssetMultipartContext(t, nil, "file", "exact.mp3", "audio/mpeg", exactFile)
	setAssetTokenContext(exact, 123)
	UploadAsset(exact)
	require.Equal(t, http.StatusOK, exactRecorder.Code, exactRecorder.Body.String())
	require.Equal(t, 1, serviceCalls)

	overFile := append(append([]byte(nil), exactFile...), 'x')
	over, overRecorder := newAssetMultipartContext(t, nil, "file", "over.mp3", "audio/mpeg", overFile)
	setAssetTokenContext(over, 123)
	UploadAsset(over)
	require.Equal(t, http.StatusRequestEntityTooLarge, overRecorder.Code, overRecorder.Body.String())
	require.Equal(t, 2, serviceCalls, "over-limit file must reach service.UploadAsset validation")
	requireAssetError(t, overRecorder.Body.Bytes(), "invalid_asset_request")
}

func TestDirectUploadSessionDerivesOwnerAndReturnsRequiredHeadersOnly(t *testing.T) {
	originalSession := createAssetUploadSession
	t.Cleanup(func() { createAssetUploadSession = originalSession })

	var got service.AssetUploadSessionRequest
	createAssetUploadSession = func(ctx context.Context, request service.AssetUploadSessionRequest) (*service.AssetUploadSessionResult, error) {
		got = request
		return &service.AssetUploadSessionResult{
			UploadID:      "upl_public",
			PublicID:      "ast_public",
			ObjectKey:     "must/not/leak",
			SignedURL:     "https://signed.example/upload",
			UploadHeaders: map[string]string{"x-goog-if-generation-match": "0"},
			ExpiresAt:     1785682501,
		}, nil
	}

	ctx, recorder := newAssetJSONContext(http.MethodPost, "/v1/assets/uploads", `{"asset_type":"Image","content_type":"image/png","size_bytes":17}`)
	setAssetTokenContext(ctx, 123)
	CreateAssetUploadSession(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.Equal(t, service.AssetUploadSessionRequest{UserID: 123, Owner: "user-123", AssetType: "Image", ContentType: "image/png", SizeBytes: 17}, got)
	var response dto.AssetUploadSessionResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.Equal(t, "asset.upload", response.Object)
	require.Equal(t, "pending", response.Status)
	require.Equal(t, map[string]string{"x-goog-if-generation-match": "0"}, response.UploadHeaders)
	requireAssetPublicBody(t, recorder.Body.String())
	require.NotContains(t, recorder.Body.String(), "must/not/leak")
}

func TestUploadSessionIgnoresBlockedOptionalModelAndStaysPending(t *testing.T) {
	originalSession := createAssetUploadSession
	t.Cleanup(func() { createAssetUploadSession = originalSession })
	createAssetUploadSession = func(ctx context.Context, request service.AssetUploadSessionRequest) (*service.AssetUploadSessionResult, error) {
		return &service.AssetUploadSessionResult{
			UploadID:      "upl_public",
			PublicID:      "ast_public",
			SignedURL:     "https://signed.example/upload",
			UploadHeaders: map[string]string{"x-goog-if-generation-match": "0"},
			ExpiresAt:     1785682501,
		}, nil
	}

	ctx, recorder := newAssetJSONContext(http.MethodPost, "/v1/assets/uploads", `{"asset_type":"Image","content_type":"image/png","size_bytes":17,"model":"client-value-must-not-select-readiness"}`)
	setBlockedAssetModelContext(ctx)
	CreateAssetUploadSession(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.Contains(t, recorder.Body.String(), `"status":"pending"`)
}

func TestDirectUploadSessionOversizeReturnsStable413Envelope(t *testing.T) {
	originalSession := createAssetUploadSession
	t.Cleanup(func() { createAssetUploadSession = originalSession })
	createAssetUploadSession = func(context.Context, service.AssetUploadSessionRequest) (*service.AssetUploadSessionResult, error) {
		return nil, service.ErrAssetTooLarge
	}

	ctx, recorder := newAssetJSONContext(http.MethodPost, "/v1/assets/uploads", `{"asset_type":"Video","content_type":"video/mp4","size_bytes":999999999}`)
	setAssetTokenContext(ctx, 123)
	CreateAssetUploadSession(ctx)

	require.Equal(t, http.StatusRequestEntityTooLarge, recorder.Code)
	requireAssetError(t, recorder.Body.Bytes(), "invalid_asset_request")
}

func TestAssetControllerMapsExpiredAndTypeMismatchErrorsToStableOpenAIEnvelope(t *testing.T) {
	require.NoError(t, backendI18n.Init())

	originalSession := createAssetUploadSession
	originalComplete := completeAssetUpload
	t.Cleanup(func() {
		createAssetUploadSession = originalSession
		completeAssetUpload = originalComplete
	})

	createAssetUploadSession = func(context.Context, service.AssetUploadSessionRequest) (*service.AssetUploadSessionResult, error) {
		return nil, service.ErrAssetTypeMismatch
	}
	sessionCtx, sessionRecorder := newAssetJSONContext(http.MethodPost, "/v1/assets/uploads", `{"asset_type":"Image","content_type":"video/mp4","size_bytes":17}`)
	setAssetTokenContext(sessionCtx, 123)
	CreateAssetUploadSession(sessionCtx)
	require.Equal(t, http.StatusBadRequest, sessionRecorder.Code)
	requireAssetError(t, sessionRecorder.Body.Bytes(), "asset_type_mismatch")
	requireAssetErrorMessage(t, sessionRecorder.Body.Bytes(), "asset_type_mismatch", "Asset type does not match the uploaded media")

	completeAssetUpload = func(context.Context, service.AssetCompleteUploadRequest) (*service.AssetResult, error) {
		return nil, service.ErrAssetExpired
	}
	expiredCtx, expiredRecorder := newAssetJSONContext(http.MethodPost, "/v1/assets/uploads/upl_expired/complete", `{}`)
	expiredCtx.Request.Header.Set("Accept-Language", "pt")
	expiredCtx.Params = gin.Params{{Key: "upload_id", Value: "upl_expired"}}
	setAssetTokenContext(expiredCtx, 123)
	CompleteAssetUpload(expiredCtx)
	require.Equal(t, http.StatusGone, expiredRecorder.Code)
	requireAssetError(t, expiredRecorder.Body.Bytes(), "asset_expired")
	requireAssetErrorMessage(t, expiredRecorder.Body.Bytes(), "asset_expired", "O upload do ativo expirou")
}

func TestCompleteUploadAndOwnedGetUseUserScopedService(t *testing.T) {
	originalComplete := completeAssetUpload
	originalGet := getAsset
	restoreReconcile := installAssetControllerReconcileStub(t)
	t.Cleanup(func() {
		completeAssetUpload = originalComplete
		getAsset = originalGet
		restoreReconcile()
	})

	var completeReq service.AssetCompleteUploadRequest
	completeAssetUpload = func(ctx context.Context, request service.AssetCompleteUploadRequest) (*service.AssetResult, error) {
		completeReq = request
		return &service.AssetResult{PublicID: "ast_public", AssetType: "Image", Status: model.AssetStatusActive, CreatedAt: 1785678901}, nil
	}
	var getUserID int
	getAsset = func(ctx context.Context, userID int, assetID string) (*service.AssetResult, error) {
		getUserID = userID
		require.Equal(t, "ast_public", assetID)
		return &service.AssetResult{PublicID: assetID, AssetType: "Image", Status: model.AssetStatusProcessing, CreatedAt: 1785678901}, nil
	}

	completeCtx, completeRecorder := newAssetJSONContext(http.MethodPost, "/v1/assets/uploads/upl_public/complete", `{}`)
	completeCtx.Params = gin.Params{{Key: "upload_id", Value: "upl_public"}}
	setAssetTokenContext(completeCtx, 123)
	CompleteAssetUpload(completeCtx)
	require.Equal(t, http.StatusOK, completeRecorder.Code, completeRecorder.Body.String())
	require.Equal(t, service.AssetCompleteUploadRequest{UploadID: "upl_public", Owner: "user-123"}, completeReq)
	requireAssetPublicBody(t, completeRecorder.Body.String())

	getCtx, getRecorder := newAssetJSONContext(http.MethodGet, "/v1/assets/ast_public", "")
	getCtx.Params = gin.Params{{Key: "asset_id", Value: "ast_public"}}
	setAssetTokenContext(getCtx, 456)
	GetAsset(getCtx)
	require.Equal(t, http.StatusOK, getRecorder.Code, getRecorder.Body.String())
	require.Equal(t, 456, getUserID)
	require.Contains(t, getRecorder.Body.String(), `"status":"Active"`)
	requireAssetPublicBody(t, getRecorder.Body.String())
}

func TestAssetResponseAvailableModelsAlwaysPresentArray(t *testing.T) {
	emptyCtx, emptyRecorder := newAssetJSONContext(http.MethodGet, "/v1/assets/ast_empty", "")
	writeAssetResult(emptyCtx, &service.AssetResult{
		PublicID:        "ast_empty",
		AssetType:       "Image",
		Status:          model.AssetStatusProcessing,
		AvailableModels: nil,
		CreatedAt:       1785678901,
	}, nil)
	require.Equal(t, http.StatusOK, emptyRecorder.Code, emptyRecorder.Body.String())
	require.Contains(t, emptyRecorder.Body.String(), `"available_models":[]`)

	var emptyPayload map[string]any
	require.NoError(t, common.Unmarshal(emptyRecorder.Body.Bytes(), &emptyPayload))
	require.IsType(t, []any{}, emptyPayload["available_models"])

	nonEmptyCtx, nonEmptyRecorder := newAssetJSONContext(http.MethodGet, "/v1/assets/ast_ready", "")
	writeAssetResult(nonEmptyCtx, &service.AssetResult{
		PublicID:        "ast_ready",
		AssetType:       "Image",
		Status:          model.AssetStatusProcessing,
		AvailableModels: []string{"seedance-2.0-fast"},
		CreatedAt:       1785678901,
	}, nil)
	require.Equal(t, http.StatusOK, nonEmptyRecorder.Code, nonEmptyRecorder.Body.String())

	var response dto.AssetResponse
	require.NoError(t, common.Unmarshal(nonEmptyRecorder.Body.Bytes(), &response))
	require.Equal(t, []string{"seedance-2.0-fast"}, response.AvailableModels)
	requireAssetPublicBody(t, nonEmptyRecorder.Body.String())
}

func TestAssetResponseOpenAPIDeclaresRequiredAvailableModelsArray(t *testing.T) {
	body, err := os.ReadFile("../docs/openapi/relay.json")
	require.NoError(t, err)
	var spec map[string]any
	require.NoError(t, common.Unmarshal(body, &spec))

	components := spec["components"].(map[string]any)
	schemas := components["schemas"].(map[string]any)
	asset := schemas["Asset"].(map[string]any)
	required := asset["required"].([]any)
	require.Contains(t, required, "available_models")

	properties := asset["properties"].(map[string]any)
	availableModels := properties["available_models"].(map[string]any)
	require.Equal(t, "array", availableModels["type"])
	items := availableModels["items"].(map[string]any)
	require.Equal(t, "string", items["type"])
}

func TestAssetControllerMapsStorageAndNotFoundErrorsToStableOpenAIEnvelope(t *testing.T) {
	originalGet := getAsset
	t.Cleanup(func() { getAsset = originalGet })

	getAsset = func(context.Context, int, string) (*service.AssetResult, error) {
		return nil, service.ErrAssetUploadNotFound
	}
	notFoundCtx, notFoundRecorder := newAssetJSONContext(http.MethodGet, "/v1/assets/missing", "")
	notFoundCtx.Params = gin.Params{{Key: "asset_id", Value: "missing"}}
	setAssetTokenContext(notFoundCtx, 123)
	GetAsset(notFoundCtx)
	require.Equal(t, http.StatusNotFound, notFoundRecorder.Code)
	requireAssetError(t, notFoundRecorder.Body.Bytes(), "asset_not_found")

	getAsset = func(context.Context, int, string) (*service.AssetResult, error) {
		return nil, errors.New("gcs bucket secret signed URL https://storage.example/private")
	}
	storageCtx, storageRecorder := newAssetJSONContext(http.MethodGet, "/v1/assets/ast_public", "")
	storageCtx.Params = gin.Params{{Key: "asset_id", Value: "ast_public"}}
	setAssetTokenContext(storageCtx, 123)
	GetAsset(storageCtx)
	require.Equal(t, http.StatusInternalServerError, storageRecorder.Code)
	requireAssetError(t, storageRecorder.Body.Bytes(), "asset_storage_error")
	require.NotContains(t, storageRecorder.Body.String(), "storage.example")
	requireAssetPublicBody(t, storageRecorder.Body.String())
}

func newAssetJSONContext(method string, target string, body string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	return ctx, recorder
}

func newAssetMultipartContext(t *testing.T, fields map[string]string, fileField string, filename string, contentType string, body []byte) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	for key, value := range fields {
		require.NoError(t, writer.WriteField(key, value))
	}
	if fileField != "" {
		part, err := writer.CreatePart(map[string][]string{
			"Content-Disposition": {`form-data; name="` + fileField + `"; filename="` + filename + `"`},
			"Content-Type":        {contentType},
		})
		require.NoError(t, err)
		_, err = part.Write(body)
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/assets/upload", bytes.NewReader(buf.Bytes()))
	ctx.Request.Header.Set("Content-Type", writer.FormDataContentType())
	return ctx, recorder
}

func setAssetTokenContext(ctx *gin.Context, userID int) {
	common.SetContextKey(ctx, constant.ContextKeyUserId, userID)
}

func setBlockedAssetModelContext(ctx *gin.Context) {
	setAssetTokenContext(ctx, 123)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimit, map[string]bool{"seedance-2.0": true})
	common.SetContextKey(ctx, constant.ContextKeyTokenModelBlacklistEnabled, true)
	common.SetContextKey(ctx, constant.ContextKeyTokenModelBlacklist, map[string]bool{"client-value-must-not-select-readiness": true})
}

func installAssetControllerReconcileStub(t *testing.T) func() {
	t.Helper()
	originalReconcile := reconcileAssetForScope
	originalResolve := resolveAssetModelScopeForContext
	resolveAssetModelScopeForContext = func(c *gin.Context, userID int) (service.AssetModelScope, error) {
		return service.AssetModelScope{ScopeKey: "test-scope", Groups: []string{"default"}, ModelNames: []string{"seedance-2.0"}}, nil
	}
	reconcileAssetForScope = func(ctx context.Context, userID int, publicID string, scope service.AssetModelScope) (*service.AssetResult, error) {
		switch publicID {
		case "ast_public":
			return &service.AssetResult{PublicID: publicID, AssetType: "Image", Status: model.AssetStatusActive, CreatedAt: 1785678901, SourceExpiresAt: 1788270901}, nil
		case "ast_upload", "ast_exact":
			return &service.AssetResult{PublicID: publicID, AssetType: "Audio", Status: model.AssetStatusActive}, nil
		default:
			return &service.AssetResult{PublicID: publicID, AssetType: "Image", Status: model.AssetStatusProcessing, CreatedAt: 1785678901}, nil
		}
	}
	return func() {
		reconcileAssetForScope = originalReconcile
		resolveAssetModelScopeForContext = originalResolve
	}
}

func requireAssetError(t *testing.T, body []byte, code any) {
	t.Helper()
	var envelope struct {
		Error types.OpenAIError `json:"error"`
	}
	require.NoError(t, common.Unmarshal(body, &envelope))
	require.Equal(t, code, envelope.Error.Code)
	require.Equal(t, code, envelope.Error.Type)
	require.Empty(t, envelope.Error.Param)
	require.Empty(t, envelope.Error.Metadata)
}

func requireAssetErrorMessage(t *testing.T, body []byte, code any, message string) {
	t.Helper()
	var envelope struct {
		Error types.OpenAIError `json:"error"`
	}
	require.NoError(t, common.Unmarshal(body, &envelope))
	require.Equal(t, code, envelope.Error.Code)
	require.Equal(t, message, envelope.Error.Message)
	require.NotContains(t, strings.ToLower(envelope.Error.Message), "storage")
}

func requireAssetPublicBody(t *testing.T, body string) {
	t.Helper()
	for _, forbidden := range []string{"provider", "channel", "upstream", "bucket", "object_key", "hash", "sha256", "signed_get", "moderation", "credential", "service_account"} {
		require.NotContains(t, body, forbidden)
	}
}

func serviceTestTinyMP3() []byte {
	return []byte("ID3\x04\x00\x00\x00\x00\x00\x00payload")
}

func serviceTestTinyPNG() []byte {
	return []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 0, 'I', 'H', 'D', 'R'}
}
