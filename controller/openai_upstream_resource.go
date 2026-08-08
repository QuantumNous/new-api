package controller

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayhelper "github.com/QuantumNous/new-api/relay/helper"
	"github.com/gin-gonic/gin"
)

type openAIFileResourceResponse struct {
	Id string `json:"id"`
}

type openAIBatchResourceResponse struct {
	Id           string `json:"id"`
	OutputFileId string `json:"output_file_id"`
	ErrorFileId  string `json:"error_file_id"`
}

var hopByHopResponseHeaders = map[string]struct{}{
	"connection":          {},
	"keep-alive":          {},
	"proxy-authenticate":  {},
	"proxy-authorization": {},
	"te":                  {},
	"trailer":             {},
	"transfer-encoding":   {},
	"upgrade":             {},
}

func openAIUpstreamResourceError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{
		"error": gin.H{
			"message": message,
			"type":    "new_api_error",
			"code":    "openai_upstream_resource_error",
		},
	})
}

func copyOpenAIUpstreamResponseHeaders(dst http.Header, src http.Header) {
	skippedHeaders := make(map[string]struct{}, len(hopByHopResponseHeaders))
	for name := range hopByHopResponseHeaders {
		skippedHeaders[name] = struct{}{}
	}
	for _, connectionValue := range src.Values("Connection") {
		for _, name := range strings.Split(connectionValue, ",") {
			if name = strings.ToLower(strings.TrimSpace(name)); name != "" {
				skippedHeaders[name] = struct{}{}
			}
		}
	}
	for name, values := range src {
		if _, skip := skippedHeaders[strings.ToLower(name)]; skip {
			continue
		}
		for _, value := range values {
			dst.Add(name, value)
		}
	}
}

func bindOpenAIUpstreamResourceResponse(c *gin.Context, body []byte) error {
	userId := common.GetContextKeyInt(c, constant.ContextKeyUserId)
	channelId := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	modelName := common.GetContextKeyString(c, constant.ContextKeyOriginalModel)
	channelKeyIndex := common.GetContextKeyInt(c, constant.ContextKeyChannelMultiKeyIndex)
	channelKeyFingerprint := model.ChannelKeyFingerprint(common.GetContextKeyString(c, constant.ContextKeyChannelKey))
	path := c.Request.URL.Path

	resources := make([]model.OpenAIUpstreamResource, 0, 3)
	if c.Request.Method == http.MethodPost && path == "/v1/files" {
		var response openAIFileResourceResponse
		if err := common.Unmarshal(body, &response); err != nil {
			return fmt.Errorf("invalid upstream file response: %w", err)
		}
		if strings.TrimSpace(response.Id) == "" {
			return fmt.Errorf("invalid upstream file response: id is required")
		}
		resources = append(resources, model.OpenAIUpstreamResource{
			UserId:                userId,
			ChannelId:             channelId,
			ChannelKeyIndex:       channelKeyIndex,
			ChannelKeyFingerprint: channelKeyFingerprint,
			ResourceType:          model.OpenAIUpstreamResourceTypeFile,
			ResourceId:            response.Id,
			Model:                 modelName,
		})
	} else if strings.HasPrefix(path, "/v1/batches") {
		var response openAIBatchResourceResponse
		if err := common.Unmarshal(body, &response); err != nil {
			return fmt.Errorf("invalid upstream batch response: %w", err)
		}
		if strings.TrimSpace(response.Id) == "" {
			return fmt.Errorf("invalid upstream batch response: id is required")
		}
		resources = append(resources, model.OpenAIUpstreamResource{
			UserId:                userId,
			ChannelId:             channelId,
			ChannelKeyIndex:       channelKeyIndex,
			ChannelKeyFingerprint: channelKeyFingerprint,
			ResourceType:          model.OpenAIUpstreamResourceTypeBatch,
			ResourceId:            response.Id,
			Model:                 modelName,
		})
		for _, fileId := range []string{response.OutputFileId, response.ErrorFileId} {
			if strings.TrimSpace(fileId) == "" {
				continue
			}
			resources = append(resources, model.OpenAIUpstreamResource{
				UserId:                userId,
				ChannelId:             channelId,
				ChannelKeyIndex:       channelKeyIndex,
				ChannelKeyFingerprint: channelKeyFingerprint,
				ResourceType:          model.OpenAIUpstreamResourceTypeFile,
				ResourceId:            fileId,
				Model:                 modelName,
			})
		}
	}
	return model.SaveOpenAIUpstreamResources(resources)
}

// RelayOpenAIUpstreamResource proxies native OpenAI File and Batch APIs.
// Batch execution is owned by the upstream provider; this path intentionally
// does not estimate or settle quota because upstream batch usage is asynchronous.
func RelayOpenAIUpstreamResource(c *gin.Context) {
	info := relaycommon.GenRelayInfoOpenAI(c, nil)
	info.InitChannelMeta(c)
	if c.Request.Method == http.MethodPost && c.Request.URL.Path == "/v1/files" {
		if err := relayhelper.ModelMappedHelper(c, info, nil); err != nil {
			openAIUpstreamResourceError(c, http.StatusBadRequest, "invalid channel model mapping")
			return
		}
		if info.IsModelMapped && info.UpstreamModelName != info.OriginModelName {
			openAIUpstreamResourceError(c, http.StatusBadRequest, "Batch uploads do not support channel model mapping")
			return
		}
	}
	adaptor := relay.GetAdaptor(info.ApiType)
	if adaptor == nil {
		openAIUpstreamResourceError(c, http.StatusInternalServerError, "selected channel does not support OpenAI-compatible relay")
		return
	}
	adaptor.Init(info)

	var requestBody io.Reader = http.NoBody
	if c.Request.Method == http.MethodPost {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			openAIUpstreamResourceError(c, http.StatusBadRequest, "failed to read request body")
			return
		}
		requestBody = common.NewReplayableBodyReader(storage)
	}

	upstreamResponse, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		openAIUpstreamResourceError(c, http.StatusBadGateway, "upstream request failed")
		return
	}
	response, ok := upstreamResponse.(*http.Response)
	if !ok || response == nil {
		openAIUpstreamResourceError(c, http.StatusBadGateway, "upstream returned an unsupported response")
		return
	}
	defer response.Body.Close()
	isTerminalDeleteStatus := response.StatusCode >= http.StatusOK && response.StatusCode < http.StatusMultipleChoices ||
		response.StatusCode == http.StatusNotFound
	if isTerminalDeleteStatus && c.Request.Method == http.MethodDelete &&
		strings.HasPrefix(c.Request.URL.Path, "/v1/files/") {
		if deleteErr := model.DeleteOpenAIUpstreamResource(
			common.GetContextKeyInt(c, constant.ContextKeyUserId),
			model.OpenAIUpstreamResourceTypeFile,
			c.Param("id"),
		); deleteErr != nil {
			openAIUpstreamResourceError(c, http.StatusBadGateway, "failed to delete upstream resource binding")
			return
		}
	}

	shouldBind := response.StatusCode >= http.StatusOK && response.StatusCode < http.StatusMultipleChoices &&
		((c.Request.Method == http.MethodPost && c.Request.URL.Path == "/v1/files") || strings.HasPrefix(c.Request.URL.Path, "/v1/batches"))
	if shouldBind {
		body, readErr := io.ReadAll(response.Body)
		if readErr != nil {
			openAIUpstreamResourceError(c, http.StatusBadGateway, "failed to read upstream response")
			return
		}
		if bindErr := bindOpenAIUpstreamResourceResponse(c, body); bindErr != nil {
			openAIUpstreamResourceError(c, http.StatusBadGateway, "failed to persist upstream resource binding")
			return
		}
		copyOpenAIUpstreamResponseHeaders(c.Writer.Header(), response.Header)
		c.Status(response.StatusCode)
		_, _ = c.Writer.Write(body)
		return
	}

	copyOpenAIUpstreamResponseHeaders(c.Writer.Header(), response.Header)
	c.Status(response.StatusCode)
	_, _ = io.Copy(c.Writer, response.Body)
}
