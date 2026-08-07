package controller

import (
	"errors"
	"mime"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const assetMultipartEnvelopeMaxBytes = int64(1 << 20)

var (
	createAssetFromURL               = service.CreateAssetFromURL
	uploadAsset                      = service.UploadAsset
	createAssetUploadSession         = service.CreateAssetUploadSession
	completeAssetUpload              = service.CompleteAssetUpload
	getAsset                         = service.GetAsset
	reconcileAssetForScope           = service.ReconcileAssetForScope
	resolveAssetModelScopeForContext = service.ResolveAssetModelScopeForContext
)

func CreateAsset(c *gin.Context) {
	var request dto.AssetCreateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		writeAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest))
		return
	}
	result, err := createAssetFromURL(c.Request.Context(), service.AssetFromURLRequest{
		UserID:    common.GetContextKeyInt(c, constant.ContextKeyUserId),
		AssetType: strings.TrimSpace(request.AssetType),
		URL:       strings.TrimSpace(request.URL),
	})
	writeReconciledAssetResult(c, result, err)
}

func UploadAsset(c *gin.Context) {
	cfg := service.CurrentAssetStorageConfig()
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, cfg.MultipartMaxBytes+assetMultipartEnvelopeMaxBytes)
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		status := http.StatusBadRequest
		if common.IsRequestBodyTooLargeError(err) {
			status = http.StatusRequestEntityTooLarge
		}
		writeAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, status))
		return
	}
	defer file.Close()

	assetType := strings.TrimSpace(c.Request.FormValue("asset_type"))
	if assetType == "" {
		assetType = assetTypeFromContentType(header.Header.Get("Content-Type"))
	}
	if assetType == "" {
		writeAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest))
		return
	}

	result, uploadErr := uploadAsset(c.Request.Context(), service.AssetUploadRequest{
		UserID:    common.GetContextKeyInt(c, constant.ContextKeyUserId),
		AssetType: assetType,
		Filename:  header.Filename,
		Body:      file,
	})
	writeReconciledAssetResult(c, result, uploadErr)
}

func CreateAssetUploadSession(c *gin.Context) {
	var request dto.AssetUploadSessionRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		writeAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest))
		return
	}
	userID := common.GetContextKeyInt(c, constant.ContextKeyUserId)
	result, err := createAssetUploadSession(c.Request.Context(), service.AssetUploadSessionRequest{
		UserID:      userID,
		Owner:       assetUploadOwner(userID),
		AssetType:   strings.TrimSpace(request.AssetType),
		ContentType: strings.TrimSpace(request.ContentType),
		SizeBytes:   request.SizeBytes,
	})
	if err != nil {
		writeAssetServiceError(c, err)
		return
	}
	if result == nil {
		writeAssetError(c, nil)
		return
	}
	c.JSON(http.StatusOK, dto.AssetUploadSessionResponse{
		UploadID:      result.UploadID,
		AssetID:       result.PublicID,
		Object:        "asset.upload",
		Status:        "pending",
		UploadURL:     result.SignedURL,
		UploadHeaders: result.UploadHeaders,
		ExpiresAt:     result.ExpiresAt,
	})
}

func CompleteAssetUpload(c *gin.Context) {
	uploadID := strings.TrimSpace(c.Param("upload_id"))
	if uploadID == "" {
		writeAssetError(c, types.InitOpenAIError(types.ErrorCodeAssetNotFound, http.StatusNotFound))
		return
	}
	userID := common.GetContextKeyInt(c, constant.ContextKeyUserId)
	result, err := completeAssetUpload(c.Request.Context(), service.AssetCompleteUploadRequest{
		UploadID: uploadID,
		Owner:    assetUploadOwner(userID),
	})
	writeReconciledAssetResult(c, result, err)
}

func GetAsset(c *gin.Context) {
	assetID := strings.TrimSpace(c.Param("asset_id"))
	if assetID == "" {
		writeAssetError(c, types.InitOpenAIError(types.ErrorCodeAssetNotFound, http.StatusNotFound))
		return
	}
	result, err := getAsset(c.Request.Context(), common.GetContextKeyInt(c, constant.ContextKeyUserId), assetID)
	writeReconciledAssetResult(c, result, err)
}

func writeReconciledAssetResult(c *gin.Context, result *service.AssetResult, err error) {
	if err != nil || result == nil {
		writeAssetResult(c, result, err)
		return
	}
	userID := common.GetContextKeyInt(c, constant.ContextKeyUserId)
	scope, scopeErr := resolveAssetModelScopeForContext(c, userID)
	if scopeErr != nil {
		writeAssetServiceError(c, scopeErr)
		return
	}
	reconciled, reconcileErr := reconcileAssetForScope(c.Request.Context(), userID, result.PublicID, scope)
	if reconcileErr != nil {
		writeAssetServiceError(c, reconcileErr)
		return
	}
	writeAssetResult(c, reconciled, nil)
}

func writeAssetResult(c *gin.Context, result *service.AssetResult, err error) {
	if err != nil {
		writeAssetServiceError(c, err)
		return
	}
	if result == nil {
		writeAssetError(c, nil)
		return
	}
	c.JSON(http.StatusOK, assetResponseFromResult(result))
}

func assetResponseFromResult(result *service.AssetResult) dto.AssetResponse {
	return dto.AssetResponse{
		ID:              result.PublicID,
		Object:          "asset",
		AssetType:       result.AssetType,
		Status:          result.Status,
		AssetURL:        "asset://" + result.PublicID,
		CreatedAt:       result.CreatedAt,
		SourceExpiresAt: result.SourceExpiresAt,
	}
}

func writeAssetServiceError(c *gin.Context, err error) {
	status := http.StatusInternalServerError
	code := types.ErrorCodeAssetStorageError
	switch {
	case errors.Is(err, service.ErrAssetInvalidSourceURL),
		errors.Is(err, service.ErrAssetUnsupportedMediaType),
		errors.Is(err, service.ErrAssetFileRequired),
		errors.Is(err, service.ErrAssetUploadValidation):
		status = http.StatusBadRequest
		code = types.ErrorCodeInvalidAssetRequest
	case errors.Is(err, service.ErrAssetTooLarge):
		status = http.StatusRequestEntityTooLarge
		code = types.ErrorCodeInvalidAssetRequest
	case errors.Is(err, service.ErrAssetExpired):
		status = http.StatusGone
		code = types.ErrorCodeAssetExpired
	case errors.Is(err, service.ErrAssetTypeMismatch):
		status = http.StatusBadRequest
		code = types.ErrorCodeAssetTypeMismatch
	case errors.Is(err, service.ErrAssetUploadNotFound):
		status = http.StatusNotFound
		code = types.ErrorCodeAssetNotFound
	case errors.Is(err, service.ErrAssetStorageDisabled):
		status = http.StatusInternalServerError
		code = types.ErrorCodeAssetStorageError
	}
	writeAssetError(c, types.InitOpenAIError(code, status))
}

func writeAssetError(c *gin.Context, apiErr *types.NewAPIError) {
	writeBytePlusAssetError(c, apiErr)
}

func assetTypeFromContentType(contentType string) string {
	mediaType := strings.ToLower(strings.TrimSpace(contentType))
	if parsed, _, err := mime.ParseMediaType(mediaType); err == nil {
		mediaType = parsed
	}
	switch {
	case strings.HasPrefix(mediaType, "image/"):
		return "Image"
	case strings.HasPrefix(mediaType, "video/"):
		return "Video"
	case strings.HasPrefix(mediaType, "audio/"):
		return "Audio"
	default:
		return ""
	}
}

func assetUploadOwner(userID int) string {
	return "user-" + strconv.Itoa(userID)
}
