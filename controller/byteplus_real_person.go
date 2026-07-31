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

const bytePlusMultipartRequestMaxBytes int64 = (50 << 20) + (1 << 20)

var (
	createBytePlusRealPerson                     = service.CreateBytePlusRealPerson
	reverifyBytePlusRealPerson                   = service.ReverifyBytePlusRealPerson
	listBytePlusRealPersons                      = service.ListBytePlusRealPersons
	getBytePlusRealPerson                        = service.GetBytePlusRealPerson
	createBytePlusRealPersonAssetFromURL         = service.CreateBytePlusRealPersonAssetFromURL
	createBytePlusRealPersonAssetFromMultipart   = service.CreateBytePlusRealPersonAssetFromMultipart
	listBytePlusRealPersonAssets                 = service.ListBytePlusRealPersonAssets
	deleteBytePlusAsset                          = service.DeleteBytePlusAsset
	notifyBytePlusRealPersonVerificationCallback = service.NotifyBytePlusRealPersonVerificationCallback
)

func CreateBytePlusRealPerson(c *gin.Context) {
	if !bytePlusAssetTokenAllowsModel(c) {
		writeBytePlusAssetModelForbidden(c)
		return
	}
	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if idempotencyKey == "" {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest))
		return
	}
	var request dto.BytePlusRealPersonCreateRequest
	if !decodeStrictBytePlusJSON(c, &request, types.ErrorCodeInvalidRealPersonRequest) {
		return
	}
	specificChannelID, ok := bytePlusAssetSpecificChannelID(c)
	if !ok {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest))
		return
	}
	response, apiErr := createBytePlusRealPerson(c.Request.Context(), common.GetContextKeyInt(c, constant.ContextKeyUserId), common.GetContextKeyString(c, constant.ContextKeyUserGroup), common.GetContextKeyString(c, constant.ContextKeyUsingGroup), specificChannelID, idempotencyKey, request)
	writeBytePlusProfileResponse(c, response, apiErr)
}

func ReverifyBytePlusRealPerson(c *gin.Context) {
	if !bytePlusAssetTokenAllowsModel(c) {
		writeBytePlusAssetModelForbidden(c)
		return
	}
	personID := strings.TrimSpace(c.Param("person_id"))
	if personID == "" {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest))
		return
	}
	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if idempotencyKey == "" {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest))
		return
	}
	response, apiErr := reverifyBytePlusRealPerson(c.Request.Context(), common.GetContextKeyInt(c, constant.ContextKeyUserId), personID, idempotencyKey)
	writeBytePlusProfileResponse(c, response, apiErr)
}

func ListBytePlusRealPersons(c *gin.Context) {
	if !bytePlusAssetTokenAllowsModel(c) {
		writeBytePlusAssetModelForbidden(c)
		return
	}
	limit, after, ok := bytePlusPagination(c, types.ErrorCodeInvalidRealPersonRequest)
	if !ok {
		return
	}
	response, apiErr := listBytePlusRealPersons(c.Request.Context(), common.GetContextKeyInt(c, constant.ContextKeyUserId), limit, after)
	if apiErr != nil {
		writeBytePlusAssetError(c, apiErr)
		return
	}
	if response == nil {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError))
		return
	}
	c.JSON(http.StatusOK, response)
}

func GetBytePlusRealPerson(c *gin.Context) {
	if !bytePlusAssetTokenAllowsModel(c) {
		writeBytePlusAssetModelForbidden(c)
		return
	}
	personID := strings.TrimSpace(c.Param("person_id"))
	if personID == "" {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest))
		return
	}
	response, apiErr := getBytePlusRealPerson(c.Request.Context(), common.GetContextKeyInt(c, constant.ContextKeyUserId), personID)
	writeBytePlusProfileResponse(c, response, apiErr)
}

func CreateBytePlusRealPersonAsset(c *gin.Context) {
	if !bytePlusAssetTokenAllowsModel(c) {
		writeBytePlusAssetModelForbidden(c)
		return
	}
	personID := strings.TrimSpace(c.Param("person_id"))
	if personID == "" {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest))
		return
	}
	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if idempotencyKey == "" {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest))
		return
	}
	mediaType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest))
		return
	}
	switch mediaType {
	case "application/json":
		var request dto.BytePlusRealPersonAssetCreateRequest
		if !decodeStrictBytePlusJSON(c, &request, types.ErrorCodeInvalidAssetRequest) {
			return
		}
		response, apiErr := createBytePlusRealPersonAssetFromURL(c.Request.Context(), common.GetContextKeyInt(c, constant.ContextKeyUserId), personID, idempotencyKey, request)
		writeBytePlusAssetResponse(c, response, apiErr)
	case "multipart/form-data":
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, bytePlusMultipartRequestMaxBytes)
		response, apiErr := createBytePlusRealPersonAssetFromMultipart(c.Request.Context(), common.GetContextKeyInt(c, constant.ContextKeyUserId), personID, idempotencyKey, c.Request)
		writeBytePlusAssetResponse(c, response, apiErr)
	default:
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeAssetMediaUnsupported, http.StatusUnsupportedMediaType))
	}
}

func ListBytePlusRealPersonAssets(c *gin.Context) {
	if !bytePlusAssetTokenAllowsModel(c) {
		writeBytePlusAssetModelForbidden(c)
		return
	}
	personID := strings.TrimSpace(c.Param("person_id"))
	if personID == "" {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest))
		return
	}
	limit, after, ok := bytePlusPagination(c, types.ErrorCodeInvalidAssetRequest)
	if !ok {
		return
	}
	response, apiErr := listBytePlusRealPersonAssets(c.Request.Context(), common.GetContextKeyInt(c, constant.ContextKeyUserId), personID, limit, after)
	if apiErr != nil {
		writeBytePlusAssetError(c, apiErr)
		return
	}
	if response == nil {
		writeBytePlusAssetError(c, nil)
		return
	}
	c.JSON(http.StatusOK, response)
}

func DeleteBytePlusAsset(c *gin.Context) {
	if !bytePlusAssetTokenAllowsModel(c) {
		writeBytePlusAssetModelForbidden(c)
		return
	}
	assetID := strings.TrimSpace(c.Param("asset_id"))
	if assetID == "" {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest))
		return
	}
	if apiErr := deleteBytePlusAsset(c.Request.Context(), common.GetContextKeyInt(c, constant.ContextKeyUserId), assetID); apiErr != nil {
		writeBytePlusAssetError(c, apiErr)
		return
	}
	c.Status(http.StatusNoContent)
}

func BytePlusRealPersonVerificationCallback(c *gin.Context) {
	token := strings.TrimSpace(c.Param("callback_token"))
	if token != "" {
		notifyBytePlusRealPersonVerificationCallback(c.Request.Context(), token)
	}
	c.AbortWithStatus(http.StatusNoContent)
}

func decodeStrictBytePlusJSON(c *gin.Context, target any, code types.ErrorCode) bool {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 64<<10)
	if err := common.DecodeJsonDisallowUnknownFields(c.Request.Body, target); err != nil {
		writeBytePlusAssetError(c, types.InitOpenAIError(code, http.StatusBadRequest))
		return false
	}
	return true
}

func bytePlusPagination(c *gin.Context, code types.ErrorCode) (int, string, bool) {
	limit := 20
	rawLimit := strings.TrimSpace(c.Query("limit"))
	if rawLimit != "" {
		parsed, err := strconv.Atoi(rawLimit)
		if err != nil || parsed < 1 || parsed > 100 {
			writeBytePlusAssetError(c, types.InitOpenAIError(code, http.StatusBadRequest))
			return 0, "", false
		}
		limit = parsed
	}
	return limit, strings.TrimSpace(c.Query("after")), true
}

func writeBytePlusProfileResponse(c *gin.Context, response *dto.BytePlusRealPersonResponse, apiErr *types.NewAPIError) {
	if apiErr != nil {
		writeBytePlusAssetError(c, apiErr)
		return
	}
	if response == nil {
		writeBytePlusAssetError(c, types.NewOpenAIError(errors.New("real person storage error"), types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError))
		return
	}
	c.JSON(http.StatusOK, response)
}

func writeBytePlusAssetResponse(c *gin.Context, response *dto.BytePlusAssetResponse, apiErr *types.NewAPIError) {
	if apiErr != nil {
		writeBytePlusAssetError(c, apiErr)
		return
	}
	if response == nil {
		writeBytePlusAssetError(c, nil)
		return
	}
	c.JSON(http.StatusOK, response)
}
