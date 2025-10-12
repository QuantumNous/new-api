package content_filter

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/core/interfaces"
)

// ContentFilterHook 内容过滤Hook
// 在响应返回前过滤敏感内容
type ContentFilterHook struct {
	enabled           bool
	priority          int
	sensitiveWords    []string
	filterNSFW        bool
	filterPolitical   bool
	replacementText   string
}

// NewContentFilterHook 创建ContentFilterHook实例
func NewContentFilterHook(config map[string]interface{}) *ContentFilterHook {
	hook := &ContentFilterHook{
		enabled:         true,
		priority:        100, // 高优先级，最后执行
		sensitiveWords:  []string{},
		filterNSFW:      true,
		filterPolitical: false,
		replacementText: "[已过滤]",
	}
	
	if enabled, ok := config["enabled"].(bool); ok {
		hook.enabled = enabled
	}
	
	if priority, ok := config["priority"].(int); ok {
		hook.priority = priority
	}
	
	if filterNSFW, ok := config["filter_nsfw"].(bool); ok {
		hook.filterNSFW = filterNSFW
	}
	
	if filterPolitical, ok := config["filter_political"].(bool); ok {
		hook.filterPolitical = filterPolitical
	}
	
	if words, ok := config["sensitive_words"].([]interface{}); ok {
		for _, word := range words {
			if w, ok := word.(string); ok {
				hook.sensitiveWords = append(hook.sensitiveWords, w)
			}
		}
	}
	
	return hook
}

// Name 返回Hook名称
func (h *ContentFilterHook) Name() string {
	return "content_filter"
}

// Priority 返回优先级
func (h *ContentFilterHook) Priority() int {
	return h.priority
}

// Enabled 返回是否启用
func (h *ContentFilterHook) Enabled() bool {
	return h.enabled
}

// OnBeforeRequest 请求前处理（不需要处理）
func (h *ContentFilterHook) OnBeforeRequest(ctx *interfaces.HookContext) error {
	return nil
}

// OnAfterResponse 响应后处理 - 过滤内容
func (h *ContentFilterHook) OnAfterResponse(ctx *interfaces.HookContext) error {
	if !h.Enabled() {
		return nil
	}
	
	// 只处理chat completion响应
	if !strings.Contains(ctx.Request.URL.Path, "chat/completions") {
		return nil
	}
	
	// 如果没有响应体，跳过
	if len(ctx.ResponseBody) == 0 {
		return nil
	}
	
	// 解析响应
	var response map[string]interface{}
	if err := json.Unmarshal(ctx.ResponseBody, &response); err != nil {
		return nil // 忽略解析错误
	}
	
	// 过滤内容
	filtered := h.filterResponse(response)
	
	// 如果内容被修改，更新响应体
	if filtered {
		modifiedBody, err := json.Marshal(response)
		if err != nil {
			return err
		}
		ctx.ResponseBody = modifiedBody
		
		// 记录过滤事件
		ctx.Data["content_filtered"] = true
		common.SysLog("Content filter applied to response")
	}
	
	return nil
}

// OnError 错误处理
func (h *ContentFilterHook) OnError(ctx *interfaces.HookContext, err error) error {
	return nil
}

// filterResponse 过滤响应内容
func (h *ContentFilterHook) filterResponse(response map[string]interface{}) bool {
	modified := false
	
	// 获取choices数组
	choices, ok := response["choices"].([]interface{})
	if !ok {
		return false
	}
	
	// 遍历每个choice
	for _, choice := range choices {
		choiceMap, ok := choice.(map[string]interface{})
		if !ok {
			continue
		}
		
		// 获取message
		message, ok := choiceMap["message"].(map[string]interface{})
		if !ok {
			continue
		}
		
		// 获取content
		content, ok := message["content"].(string)
		if !ok {
			continue
		}
		
		// 过滤内容
		filteredContent := h.filterText(content)
		
		// 如果内容被修改
		if filteredContent != content {
			message["content"] = filteredContent
			modified = true
		}
	}
	
	return modified
}

// filterText 过滤文本内容
func (h *ContentFilterHook) filterText(text string) string {
	filtered := text
	
	// 过滤敏感词
	for _, word := range h.sensitiveWords {
		if strings.Contains(filtered, word) {
			filtered = strings.ReplaceAll(filtered, word, h.replacementText)
		}
	}
	
	// TODO: 实现更复杂的过滤逻辑
	// - NSFW内容检测
	// - 政治敏感内容检测
	// - 使用AI模型进行内容分类
	
	return filtered
}

