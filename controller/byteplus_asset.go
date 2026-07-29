package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

var (
	createBytePlusAsset = service.CreateBytePlusAsset
	getBytePlusAsset    = service.GetBytePlusAsset
)

func CreateBytePlusAsset(c *gin.Context) {
	var request dto.BytePlusAssetCreateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest))
		return
	}

	specificChannelID, ok := bytePlusAssetSpecificChannelID(c)
	if !ok {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest))
		return
	}

	response, apiErr := createBytePlusAsset(
		c.Request.Context(),
		common.GetContextKeyInt(c, constant.ContextKeyUserId),
		common.GetContextKeyString(c, constant.ContextKeyUserGroup),
		common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
		specificChannelID,
		request,
	)
	if apiErr != nil {
		writeBytePlusAssetError(c, apiErr)
		return
	}
	c.JSON(http.StatusOK, response)
}

func GetBytePlusAsset(c *gin.Context) {
	assetID := strings.TrimSpace(c.Param("asset_id"))
	if assetID == "" {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest))
		return
	}

	response, apiErr := getBytePlusAsset(c.Request.Context(), common.GetContextKeyInt(c, constant.ContextKeyUserId), assetID)
	if apiErr != nil {
		writeBytePlusAssetError(c, apiErr)
		return
	}
	c.JSON(http.StatusOK, response)
}

func bytePlusAssetSpecificChannelID(c *gin.Context) (int, bool) {
	raw := strings.TrimSpace(common.GetContextKeyString(c, constant.ContextKeyTokenSpecificChannelId))
	if raw == "" {
		return 0, true
	}
	id, err := strconv.Atoi(raw)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

func writeBytePlusAssetError(c *gin.Context, apiErr *types.NewAPIError) {
	if apiErr == nil {
		apiErr = types.NewOpenAIError(errors.New("asset storage error"), types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	statusCode := apiErr.StatusCode
	if statusCode == 0 {
		statusCode = http.StatusInternalServerError
	}

	openAIError := apiErr.ToOpenAIError()
	openAIError.Message = common.TranslateMessage(c, bytePlusAssetI18nKey(apiErr.GetErrorCode()))
	openAIError.Type = string(apiErr.GetErrorCode())
	openAIError.Code = string(apiErr.GetErrorCode())
	openAIError.Param = ""
	openAIError.Metadata = nil
	c.JSON(statusCode, gin.H{"error": openAIError})
}

func bytePlusAssetI18nKey(code types.ErrorCode) string {
	switch code {
	case types.ErrorCodeInvalidAssetRequest:
		return i18n.MsgAssetInvalidRequest
	case types.ErrorCodeAssetNotFound:
		return i18n.MsgAssetNotFound
	case types.ErrorCodeAssetNotReady:
		return i18n.MsgAssetNotReady
	case types.ErrorCodeAssetFailed:
		return i18n.MsgAssetFailed
	case types.ErrorCodeAssetChannelConflict:
		return i18n.MsgAssetChannelConflict
	case types.ErrorCodeAssetChannelUnavailable:
		return i18n.MsgAssetChannelUnavailable
	case types.ErrorCodeAssetGroupInitializing:
		return i18n.MsgAssetGroupInitializing
	case types.ErrorCodeAssetUpstreamError:
		return i18n.MsgAssetUpstreamError
	case types.ErrorCodeAssetStorageError:
		return i18n.MsgAssetStorageError
	default:
		return i18n.MsgAssetStorageError
	}
}
