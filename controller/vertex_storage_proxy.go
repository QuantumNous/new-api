package controller

import (
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel/vertex"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

func RelayVertexStorageUpload(c *gin.Context) {
	relayVertexStorageProxy(c, vertex.StorageOperationUpload)
}

func RelayVertexStorageList(c *gin.Context) {
	relayVertexStorageProxy(c, vertex.StorageOperationList)
}

func RelayVertexStorageObject(c *gin.Context) {
	operation := vertex.StorageOperationGet
	if c.Request.Method == http.MethodDelete {
		operation = vertex.StorageOperationDelete
	}
	relayVertexStorageProxy(c, operation)
}

// relayVertexStorageProxy forwards one Cloud Storage object API call to
// storage.googleapis.com with the selected Vertex AI channel's service account.
// The client never learns the channel credentials, and the channel must declare
// the bucket as a "storage:gs:<bucket>" model to authorize the call.
func relayVertexStorageProxy(c *gin.Context, operation vertex.StorageOperation) {
	bucket, err := relayconstant.NormalizeVertexStorageBucket(c.Param("bucket"))
	if err != nil {
		respondVertexStorageProxyError(c, http.StatusBadRequest, "invalid_bucket", "invalid Cloud Storage bucket")
		return
	}
	if common.GetContextKeyInt(c, constant.ContextKeyChannelType) != constant.ChannelTypeVertexAi {
		respondVertexStorageProxyError(c, http.StatusInternalServerError, "channel_type_mismatch", "selected channel is not Vertex AI")
		return
	}
	if !relayconstant.VertexStorageChannelSupports(common.GetContextKeyStringSlice(c, constant.ContextKeyChannelModels), bucket) {
		respondVertexStorageProxyError(c, http.StatusForbidden, "bucket_not_allowed", "selected channel does not allow this Cloud Storage bucket")
		return
	}

	channelOtherSetting, _ := common.GetContextKeyType[dto.ChannelOtherSettings](c, constant.ContextKeyChannelOtherSetting)
	if channelOtherSetting.VertexKeyType == dto.VertexKeyTypeAPIKey {
		respondVertexStorageProxyError(c, http.StatusBadRequest, "unsupported_key_type", "Cloud Storage access requires Vertex AI service account JSON")
		return
	}

	credentials := vertex.Credentials{}
	if err = common.Unmarshal([]byte(common.GetContextKeyString(c, constant.ContextKeyChannelKey)), &credentials); err != nil {
		respondVertexStorageProxyError(c, http.StatusInternalServerError, "invalid_channel_credentials", "selected Vertex AI channel credentials are invalid")
		return
	}

	object := strings.TrimPrefix(c.Param("object"), "/")
	if operation == vertex.StorageOperationGet || operation == vertex.StorageOperationDelete {
		if object == "" {
			respondVertexStorageProxyError(c, http.StatusBadRequest, "object_required", "Cloud Storage object is required")
			return
		}
		if relayconstant.ValidateVertexStorageObjectName(object) != nil {
			respondVertexStorageProxyError(c, http.StatusBadRequest, "invalid_object", "Cloud Storage object contains an invalid path segment")
			return
		}
	}

	channelSetting, _ := common.GetContextKeyType[dto.ChannelSettings](c, constant.ContextKeyChannelSetting)
	accessToken, err := vertex.AcquireCachedAccessToken(vertex.CachedAccessTokenRequest{
		ChannelID:            common.GetContextKeyInt(c, constant.ContextKeyChannelId),
		ChannelIsMultiKey:    common.GetContextKeyBool(c, constant.ContextKeyChannelIsMultiKey),
		ChannelMultiKeyIndex: common.GetContextKeyInt(c, constant.ContextKeyChannelMultiKeyIndex),
		Credentials:          credentials,
		Proxy:                channelSetting.Proxy,
	})
	if err != nil {
		respondVertexStorageProxyError(c, http.StatusBadGateway, "access_token_failed", "failed to authorize with Vertex AI service account")
		return
	}

	response, err := vertex.DoStorageProxy(c.Request.Context(), vertex.StorageProxyRequest{
		Operation:     operation,
		Method:        c.Request.Method,
		Bucket:        bucket,
		Object:        object,
		RawQuery:      c.Request.URL.RawQuery,
		Header:        c.Request.Header,
		Body:          c.Request.Body,
		ContentLength: c.Request.ContentLength,
		AccessToken:   accessToken,
		Proxy:         channelSetting.Proxy,
	})
	if response != nil && response.Body != nil {
		defer service.CloseResponseBodyGracefully(response)
	}
	if err != nil || response == nil || response.Body == nil {
		respondVertexStorageProxyError(c, http.StatusBadGateway, "upstream_request_failed", "failed to request Google Cloud Storage")
		return
	}

	responseHeader := response.Header
	if operation == vertex.StorageOperationUpload && responseHeader.Get("Location") != "" {
		rewrittenLocation, rewriteErr := vertex.RewriteStorageResumableLocation(responseHeader.Get("Location"), system_setting.ServerAddress, bucket)
		if rewriteErr != nil {
			respondVertexStorageProxyError(c, http.StatusBadGateway, "invalid_resumable_location", "Google Cloud Storage returned an invalid resumable upload location")
			return
		}
		responseHeader.Set("Location", rewrittenLocation)
	}
	if response.StatusCode < http.StatusContinue || response.StatusCode > 599 {
		respondVertexStorageProxyError(c, http.StatusBadGateway, "invalid_upstream_status", "Google Cloud Storage returned an invalid response status")
		return
	}
	for name, values := range responseHeader {
		if !service.ShouldCopyUpstreamHeader(c, name, values) {
			continue
		}
		for _, value := range values {
			c.Writer.Header().Add(name, value)
		}
	}
	c.Status(response.StatusCode)
	if _, err = io.Copy(c.Writer, response.Body); err != nil {
		logger.LogError(c, "failed to stream Google Cloud Storage response")
	}
}

func respondVertexStorageProxyError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"error": gin.H{
		"message": message,
		"type":    "invalid_request_error",
		"code":    code,
	}})
}
