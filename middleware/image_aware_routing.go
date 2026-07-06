package middleware

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

const contentTypeImageURL = "image_url"
const contentTypeImage = "image"

// ApplyImageAwareRouting 在选渠道前调用：入口模型按最后一条 user 消息是否含图片改写为视觉/编程模型，
// 改写后的真实模型名会参与渠道选择、亲和性、计费与重试。
func ApplyImageAwareRouting(c *gin.Context, modelRequest *ModelRequest) bool {
	if modelRequest == nil {
		return false
	}
	rule, ok := operation_setting.GetImageAwareRouteRule(modelRequest.Model)
	if !ok {
		return false
	}

	hasImage, err := detectImageInLastUserMessage(c)
	if err != nil {
		common.SysLog("image_aware_routing: failed to parse request body: " + err.Error())
		hasImage = false
	}

	entryModel := modelRequest.Model
	if hasImage {
		modelRequest.Model = rule.VisionModel
	} else {
		modelRequest.Model = rule.CodingModel
	}
	notify := common.GetContextKeyBool(c, constant.ContextKeyTokenModelRouteNotify)
	common.SysLog(fmt.Sprintf("image_aware_routing: entry=%s has_image=%v -> routed=%s notify=%v", entryModel, hasImage, modelRequest.Model, notify))
	common.SetContextKey(c, constant.ContextKeyImageAwareEntryModel, entryModel)
	common.SetContextKey(c, constant.ContextKeyImageAwareHasImage, hasImage)
	return true
}

// detectImageInLastUserMessage 仅看最后一条 user 消息，使后续纯文本轮即使历史残留图片也能回到编程模型。
func detectImageInLastUserMessage(c *gin.Context) (bool, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return false, err
	}
	requestBody, err := storage.Bytes()
	if err != nil {
		return false, err
	}
	if _, err := storage.Seek(0, 0); err != nil {
		return false, err
	}
	return hasImageInLastUserMessage(requestBody), nil
}

func hasImageInLastUserMessage(requestBody []byte) bool {
	if !gjson.ValidBytes(requestBody) {
		return false
	}

	messages := gjson.GetBytes(requestBody, "messages")
	if !messages.IsArray() {
		return false
	}

	var lastUserContent gjson.Result
	found := false
	messages.ForEach(func(_, message gjson.Result) bool {
		if message.Get("role").String() == "user" {
			lastUserContent = message.Get("content")
			found = true
		}
		return true
	})
	if !found {
		return false
	}

	if !lastUserContent.IsArray() {
		return false
	}
	hasImage := false
	lastUserContent.ForEach(func(_, part gjson.Result) bool {
		partType := part.Get("type").String()
		if partType == contentTypeImageURL || partType == contentTypeImage {
			hasImage = true
			return false
		}
		return true
	})
	return hasImage
}
