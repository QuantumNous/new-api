package middleware

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// contentTypeImageURL 对应 OpenAI 多模态 content part 的图片类型。
// contentTypeImage 对应 Claude API 的图片类型。
// 此处只用字符串字面值，避免在 middleware 层引入 dto 依赖。
const contentTypeImageURL = "image_url"
const contentTypeImage = "image"

// ApplyImageAwareRouting 实现「虚拟入口模型 -> 视觉/编程模型」的内容感知路由。
//
// 若 modelRequest.Model 是后台配置好的入口模型名，则解析请求体，检测最后一条
// role=user 的消息是否包含图片：含图片改写为 VisionModel，否则改写为 CodingModel。
// 非入口模型（含 mj/suno/embeddings/audio/video 等所有未配置模型）直接返回 false，零影响。
//
// 返回 true 表示发生了改写。本函数在 distributor 选渠道之前调用，因此改写后的
// 真实模型名会参与渠道选择、亲和性、计费与重试。
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
		// 解析失败时不阻断请求，按无图片处理，交给后续正常流程。
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
	// 保存被改写前的虚拟入口模型名和是否含图片，供日志、响应头和响应体注入使用。
	common.SetContextKey(c, constant.ContextKeyImageAwareEntryModel, entryModel)
	common.SetContextKey(c, constant.ContextKeyImageAwareHasImage, hasImage)
	return true
}

// detectImageInLastUserMessage 检测请求体 messages 中最后一条 role=user 的消息是否含图片。
//
// 仅看最后一条 user 消息（而非整个历史），这样后续纯文本轮次即使历史里残留图片，
// 也能正确回到编程模型。content 可以是纯字符串（无图）或多模态 part 数组。
func detectImageInLastUserMessage(c *gin.Context) (bool, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return false, err
	}
	requestBody, err := storage.Bytes()
	if err != nil {
		return false, err
	}
	// 复位读取指针，确保不影响后续 body 消费（与 common 中其它读取处保持一致）。
	if _, err := storage.Seek(0, 0); err != nil {
		return false, err
	}
	return hasImageInLastUserMessage(requestBody), nil
}

// hasImageInLastUserMessage 是 detectImageInLastUserMessage 的纯函数核心，
// 接受原始请求体字节，便于单测。仅看最后一条 role=user 的消息。
func hasImageInLastUserMessage(requestBody []byte) bool {
	if !gjson.ValidBytes(requestBody) {
		return false
	}

	messages := gjson.GetBytes(requestBody, "messages")
	if !messages.IsArray() {
		return false
	}

	// 找到最后一条 role=user 的消息。
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

	// content 为字符串时无图；为数组时检查是否存在 type=image_url 或 type=image 的 part。
	if !lastUserContent.IsArray() {
		return false
	}
	hasImage := false
	lastUserContent.ForEach(func(_, part gjson.Result) bool {
		partType := part.Get("type").String()
		if partType == contentTypeImageURL || partType == contentTypeImage {
			hasImage = true
			return false // 命中即停止遍历
		}
		return true
	})
	return hasImage
}
