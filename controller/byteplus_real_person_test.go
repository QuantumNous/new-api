package controller

import (
	"bytes"
	"context"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
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

func TestCreateBytePlusRealPersonRequiresIdempotencyAndTokenModelAccess(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalCreate := createBytePlusRealPerson
	t.Cleanup(func() { createBytePlusRealPerson = originalCreate })
	createBytePlusRealPerson = func(context.Context, int, string, string, int, string, dto.BytePlusRealPersonCreateRequest) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
		t.Fatalf("service must not be called")
		return nil, nil
	}

	ctx, recorder := newBytePlusRealPersonJSONContext(http.MethodPost, "/v1/real-persons", `{"name":"Alice"}`)
	setBytePlusRealPersonTokenContext(ctx)
	CreateBytePlusRealPerson(ctx)
	require.Equal(t, http.StatusBadRequest, recorder.Code)
	requireBytePlusAssetError(t, recorder.Body.Bytes(), "invalid_real_person_request", "Invalid real-person request")

	ctx, recorder = newBytePlusRealPersonJSONContext(http.MethodPost, "/v1/real-persons", `{"name":"Alice"}`)
	ctx.Request.Header.Set("Idempotency-Key", "idem")
	setBytePlusRealPersonTokenContext(ctx)
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(ctx, constant.ContextKeyTokenModelLimit, map[string]bool{"gpt-4": true})
	CreateBytePlusRealPerson(ctx)
	require.Equal(t, http.StatusForbidden, recorder.Code)
	requireBytePlusAssetError(t, recorder.Body.Bytes(), string(types.ErrorCodeAccessDenied), "This token has no access to model seedance-2.0")
}

func TestCreateBytePlusRealPersonPassesTokenContextAndRejectsUnknownFields(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalCreate := createBytePlusRealPerson
	t.Cleanup(func() { createBytePlusRealPerson = originalCreate })
	called := false
	createBytePlusRealPerson = func(ctx context.Context, userID int, userGroup string, usingGroup string, specificChannelID int, idempotencyKey string, request dto.BytePlusRealPersonCreateRequest) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
		called = true
		require.NotNil(t, ctx)
		require.Equal(t, 123, userID)
		require.Equal(t, "identity-group", userGroup)
		require.Equal(t, "token-group", usingGroup)
		require.Equal(t, 456, specificChannelID)
		require.Equal(t, "idem-trimmed", idempotencyKey)
		require.Equal(t, "Alice", request.Name)
		return &dto.BytePlusRealPersonResponse{ID: "rph_123", Object: "real_person", Name: "Alice", Status: "pending_verification", CreatedAt: 2000}, nil
	}

	ctx, recorder := newBytePlusRealPersonJSONContext(http.MethodPost, "/v1/real-persons", `{"name":"Alice","extra":true}`)
	ctx.Request.Header.Set("Idempotency-Key", "idem")
	setBytePlusRealPersonTokenContext(ctx)
	CreateBytePlusRealPerson(ctx)
	require.Equal(t, http.StatusBadRequest, recorder.Code)
	require.False(t, called)

	ctx, recorder = newBytePlusRealPersonJSONContext(http.MethodPost, "/v1/real-persons", `{"name":"Alice"}`)
	ctx.Request.Header.Set("Idempotency-Key", "  idem-trimmed  ")
	setBytePlusRealPersonTokenContext(ctx)
	CreateBytePlusRealPerson(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.True(t, called)
}

func TestReverifyBlankPersonIDWritesExactlyOneErrorEnvelope(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalReverify := reverifyBytePlusRealPerson
	t.Cleanup(func() { reverifyBytePlusRealPerson = originalReverify })
	reverifyBytePlusRealPerson = func(context.Context, int, string, string) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
		t.Fatalf("service must not be called for blank person id")
		return nil, nil
	}

	ctx, recorder := newBytePlusRealPersonJSONContext(http.MethodPost, "/v1/real-persons/%20/verification-sessions", `{}`)
	ctx.Params = gin.Params{{Key: "person_id", Value: " "}}
	ctx.Request.Header.Set("Idempotency-Key", "idem")
	setBytePlusRealPersonTokenContext(ctx)
	ReverifyBytePlusRealPerson(ctx)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
	requireBytePlusAssetError(t, recorder.Body.Bytes(), "invalid_real_person_request", "Invalid real-person request")
	require.Equal(t, 1, strings.Count(recorder.Body.String(), `"error"`))
}

func TestGetRealPersonCrossUserNotFoundDoesNotLeakRawUserID(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalGet := getBytePlusRealPerson
	t.Cleanup(func() { getBytePlusRealPerson = originalGet })
	getBytePlusRealPerson = func(context.Context, int, string) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
		return nil, types.NewOpenAIError(errors.New("profile belongs to raw-user-98765"), types.ErrorCodeRealPersonNotFound, http.StatusNotFound)
	}

	ctx, recorder := newBytePlusRealPersonJSONContext(http.MethodGet, "/v1/real-persons/rph_other", "")
	ctx.Params = gin.Params{{Key: "person_id", Value: "rph_other"}}
	setBytePlusRealPersonTokenContext(ctx)
	GetBytePlusRealPerson(ctx)

	require.Equal(t, http.StatusNotFound, recorder.Code)
	requireBytePlusAssetError(t, recorder.Body.Bytes(), "real_person_not_found", "Real person not found")
	require.NotContains(t, recorder.Body.String(), "raw-user-98765")
}

func TestCreateRealPersonAssetDispatchesJSONAndMultipartWithoutParsingMultipartForm(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalURL := createBytePlusRealPersonAssetFromURL
	originalMultipart := createBytePlusRealPersonAssetFromMultipart
	t.Cleanup(func() {
		createBytePlusRealPersonAssetFromURL = originalURL
		createBytePlusRealPersonAssetFromMultipart = originalMultipart
	})

	createBytePlusRealPersonAssetFromURL = func(ctx context.Context, userID int, personID, idempotencyKey string, request dto.BytePlusRealPersonAssetCreateRequest) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		require.Equal(t, 123, userID)
		require.Equal(t, "rph_123", personID)
		require.Equal(t, "asset-idem", idempotencyKey)
		require.Equal(t, "https://cdn.example.com/face.png", request.URL)
		return &dto.BytePlusAssetResponse{ID: "ast_json", Object: "asset", AssetType: "Image", Status: model.BytePlusAssetStatusProcessing, CreatedAt: 2000}, nil
	}
	createBytePlusRealPersonAssetFromMultipart = func(ctx context.Context, userID int, personID, idempotencyKey string, request *http.Request) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		require.Equal(t, 123, userID)
		require.Equal(t, "rph_123", personID)
		require.Equal(t, "asset-idem", idempotencyKey)
		require.Nil(t, request.MultipartForm)
		return &dto.BytePlusAssetResponse{ID: "ast_multipart", Object: "asset", AssetType: "Image", Status: model.BytePlusAssetStatusProcessing, CreatedAt: 2000}, nil
	}

	ctx, recorder := newBytePlusRealPersonJSONContext(http.MethodPost, "/v1/real-persons/rph_123/assets", `{"url":"https://cdn.example.com/face.png","asset_type":"Image"}`)
	ctx.Params = gin.Params{{Key: "person_id", Value: "rph_123"}}
	ctx.Request.Header.Set("Idempotency-Key", "asset-idem")
	setBytePlusRealPersonTokenContext(ctx)
	CreateBytePlusRealPersonAsset(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "face.png")
	require.NoError(t, err)
	_, err = part.Write([]byte("image"))
	require.NoError(t, err)
	require.NoError(t, writer.WriteField("asset_type", "Image"))
	require.NoError(t, writer.Close())

	ctx, recorder = newBytePlusRealPersonJSONContext(http.MethodPost, "/v1/real-persons/rph_123/assets", body.String())
	ctx.Params = gin.Params{{Key: "person_id", Value: "rph_123"}}
	ctx.Request.Body = ioNopCloser{strings.NewReader(body.String())}
	ctx.Request.Header.Set("Content-Type", writer.FormDataContentType())
	ctx.Request.Header.Set("Idempotency-Key", "asset-idem")
	setBytePlusRealPersonTokenContext(ctx)
	CreateBytePlusRealPersonAsset(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	source, err := os.ReadFile("byteplus_real_person.go")
	require.NoError(t, err)
	require.NotContains(t, string(source), "FormFile")
	require.NotContains(t, string(source), "ShouldBind")
	require.NotContains(t, string(source), "ParseMultipartForm")
}

func TestCreateRealPersonAssetValidatesPersonAndIdempotencyBeforeDispatch(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalURL := createBytePlusRealPersonAssetFromURL
	t.Cleanup(func() { createBytePlusRealPersonAssetFromURL = originalURL })
	createBytePlusRealPersonAssetFromURL = func(context.Context, int, string, string, dto.BytePlusRealPersonAssetCreateRequest) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		t.Fatalf("service must not be called")
		return nil, nil
	}

	for _, tc := range []struct {
		name     string
		personID string
		key      string
	}{
		{name: "blank person", personID: " ", key: "idem"},
		{name: "blank key", personID: "rph_123", key: " "},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, recorder := newBytePlusRealPersonJSONContext(http.MethodPost, "/v1/real-persons/rph_123/assets", `{"url":"https://cdn.example.com/face.png","asset_type":"Image"}`)
			ctx.Params = gin.Params{{Key: "person_id", Value: tc.personID}}
			ctx.Request.Header.Set("Idempotency-Key", tc.key)
			setBytePlusRealPersonTokenContext(ctx)
			CreateBytePlusRealPersonAsset(ctx)
			require.Equal(t, http.StatusBadRequest, recorder.Code)
			requireBytePlusAssetError(t, recorder.Body.Bytes(), "invalid_asset_request", "Invalid asset request")
		})
	}
}

func TestCreateRealPersonAssetMapsMalformedAndUnsupportedContentTypes(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalURL := createBytePlusRealPersonAssetFromURL
	t.Cleanup(func() { createBytePlusRealPersonAssetFromURL = originalURL })
	createBytePlusRealPersonAssetFromURL = func(context.Context, int, string, string, dto.BytePlusRealPersonAssetCreateRequest) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		t.Fatalf("service must not be called")
		return nil, nil
	}

	for _, tc := range []struct {
		name        string
		contentType string
		status      int
		code        string
		message     string
	}{
		{name: "malformed", contentType: "multipart/form-data; boundary=\"unterminated", status: http.StatusBadRequest, code: "invalid_asset_request", message: "Invalid asset request"},
		{name: "unsupported", contentType: "text/plain", status: http.StatusUnsupportedMediaType, code: "asset_media_unsupported", message: "Unsupported asset upload media type"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, recorder := newBytePlusRealPersonJSONContext(http.MethodPost, "/v1/real-persons/rph_123/assets", "body")
			ctx.Params = gin.Params{{Key: "person_id", Value: "rph_123"}}
			ctx.Request.Header.Set("Content-Type", tc.contentType)
			ctx.Request.Header.Set("Idempotency-Key", "asset-idem")
			setBytePlusRealPersonTokenContext(ctx)
			CreateBytePlusRealPersonAsset(ctx)
			require.Equal(t, tc.status, recorder.Code)
			requireBytePlusAssetError(t, recorder.Body.Bytes(), tc.code, tc.message)
		})
	}
}

func TestListRealPersonAssetsInvalidPaginationUsesAssetErrorCode(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	ctx, recorder := newBytePlusRealPersonJSONContext(http.MethodGet, "/v1/real-persons/rph_123/assets?limit=bad", "")
	ctx.Params = gin.Params{{Key: "person_id", Value: "rph_123"}}
	setBytePlusRealPersonTokenContext(ctx)
	ListBytePlusRealPersonAssets(ctx)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
	requireBytePlusAssetError(t, recorder.Body.Bytes(), "invalid_asset_request", "Invalid asset request")
}

func TestRealPersonAssetMultipartHardLimitMapsToPublicTooLarge(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalMultipart := createBytePlusRealPersonAssetFromMultipart
	t.Cleanup(func() { createBytePlusRealPersonAssetFromMultipart = originalMultipart })
	createBytePlusRealPersonAssetFromMultipart = func(ctx context.Context, userID int, personID, idempotencyKey string, request *http.Request) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		_, err := request.Body.Read(make([]byte, bytePlusMultipartRequestMaxBytes+1))
		var maxErr *http.MaxBytesError
		require.ErrorAs(t, err, &maxErr)
		require.Equal(t, bytePlusMultipartRequestMaxBytes, maxErr.Limit)
		return nil, types.NewOpenAIError(err, types.ErrorCodeAssetFileTooLarge, http.StatusRequestEntityTooLarge)
	}

	ctx, recorder := newBytePlusRealPersonJSONContext(http.MethodPost, "/v1/real-persons/rph_123/assets", strings.Repeat("a", int(bytePlusMultipartRequestMaxBytes)+1))
	ctx.Params = gin.Params{{Key: "person_id", Value: "rph_123"}}
	ctx.Request.Header.Set("Content-Type", "multipart/form-data; boundary=x")
	ctx.Request.Header.Set("Idempotency-Key", "asset-idem")
	setBytePlusRealPersonTokenContext(ctx)
	CreateBytePlusRealPersonAsset(ctx)
	require.Equal(t, http.StatusRequestEntityTooLarge, recorder.Code)
	requireBytePlusAssetError(t, recorder.Body.Bytes(), "asset_file_too_large", "Asset file is too large")
}

func TestDeleteBytePlusAssetFirstAndRepeatedServiceSuccessReturnsEmpty204(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	originalDelete := deleteBytePlusAsset
	t.Cleanup(func() { deleteBytePlusAsset = originalDelete })
	calls := 0
	deleteBytePlusAsset = func(context.Context, int, string) *types.NewAPIError {
		calls++
		return nil
	}

	for range []int{0, 1} {
		ctx, recorder := newBytePlusRealPersonJSONContext(http.MethodDelete, "/v1/assets/ast_123", "")
		ctx.Params = gin.Params{{Key: "asset_id", Value: "ast_123"}}
		setBytePlusRealPersonTokenContext(ctx)
		DeleteBytePlusAsset(ctx)
		require.Equal(t, http.StatusNoContent, recorder.Code)
		require.Empty(t, recorder.Body.String())
	}
	require.Equal(t, 2, calls)
}

func TestBytePlusCallbackAlways204AndUsesPathTokenOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalNotify := notifyBytePlusRealPersonVerificationCallback
	t.Cleanup(func() { notifyBytePlusRealPersonVerificationCallback = originalNotify })
	var tokens []string
	notifyBytePlusRealPersonVerificationCallback = func(ctx context.Context, token string) {
		tokens = append(tokens, token)
	}

	for _, tc := range []struct {
		name  string
		token string
		body  string
		query string
		want  []string
	}{
		{name: "blank", token: " ", want: nil},
		{name: "valid", token: "valid-token", body: `{"resultCode":"client-win"}`, query: "?resultCode=client-win", want: []string{"valid-token"}},
		{name: "unknown", token: "unknown-token", want: []string{"valid-token", "unknown-token"}},
		{name: "expired", token: "expired-token", want: []string{"valid-token", "unknown-token", "expired-token"}},
		{name: "duplicate", token: "expired-token", want: []string{"valid-token", "unknown-token", "expired-token", "expired-token"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			requestToken := strings.ReplaceAll(tc.token, " ", "%20")
			ctx, recorder := newBytePlusRealPersonJSONContext(http.MethodPost, "/v1/real-person-verifications/callback/"+requestToken+tc.query, tc.body)
			ctx.Params = gin.Params{{Key: "callback_token", Value: tc.token}}
			BytePlusRealPersonVerificationCallback(ctx)
			require.Equal(t, http.StatusNoContent, recorder.Code)
			require.Empty(t, recorder.Body.String())
			require.Equal(t, tc.want, tokens)
		})
	}
}

type ioNopCloser struct {
	*strings.Reader
}

func (c ioNopCloser) Close() error { return nil }

func newBytePlusRealPersonJSONContext(method string, target string, body string) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Request.Header.Set("Accept-Language", "en")
	return ctx, recorder
}

func setBytePlusRealPersonTokenContext(ctx *gin.Context) {
	setBytePlusAssetTokenContext(ctx)
}
