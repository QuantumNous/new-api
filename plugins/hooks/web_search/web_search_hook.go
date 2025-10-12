package web_search

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/core/interfaces"
)

// WebSearchHook 联网搜索Hook插件
// 在请求发送前检测是否需要联网搜索，如果需要则调用搜索API并将结果注入到请求中
type WebSearchHook struct {
	enabled  bool
	priority int
	apiKey   string
	provider string // google, bing, etc
}

// NewWebSearchHook 创建WebSearchHook实例
func NewWebSearchHook(config map[string]interface{}) *WebSearchHook {
	hook := &WebSearchHook{
		enabled:  true,
		priority: 50, // 中等优先级
		provider: "google",
	}
	
	if apiKey, ok := config["api_key"].(string); ok {
		hook.apiKey = apiKey
	}
	
	if provider, ok := config["provider"].(string); ok {
		hook.provider = provider
	}
	
	if priority, ok := config["priority"].(int); ok {
		hook.priority = priority
	}
	
	if enabled, ok := config["enabled"].(bool); ok {
		hook.enabled = enabled
	}
	
	return hook
}

// Name 返回Hook名称
func (h *WebSearchHook) Name() string {
	return "web_search"
}

// Priority 返回优先级
func (h *WebSearchHook) Priority() int {
	return h.priority
}

// Enabled 返回是否启用
func (h *WebSearchHook) Enabled() bool {
	return h.enabled && h.apiKey != ""
}

// OnBeforeRequest 请求前处理
func (h *WebSearchHook) OnBeforeRequest(ctx *interfaces.HookContext) error {
	if !h.Enabled() {
		return nil
	}
	
	// 只处理chat completion请求
	if !strings.Contains(ctx.Request.URL.Path, "chat/completions") {
		return nil
	}
	
	// 检查请求体中是否包含搜索关键词
	if len(ctx.RequestBody) == 0 {
		return nil
	}
	
	// 解析请求体
	var requestData map[string]interface{}
	if err := json.Unmarshal(ctx.RequestBody, &requestData); err != nil {
		return nil // 忽略解析错误
	}
	
	// 检查是否需要搜索（简单示例：检查最后一条消息是否包含 [search] 标记）
	if !h.shouldSearch(requestData) {
		return nil
	}
	
	// 执行搜索
	searchQuery := h.extractSearchQuery(requestData)
	if searchQuery == "" {
		return nil
	}
	
	common.SysLog(fmt.Sprintf("Web search triggered for query: %s", searchQuery))
	
	// 调用搜索API
	searchResults, err := h.performSearch(searchQuery)
	if err != nil {
		common.SysError(fmt.Sprintf("Web search failed: %v", err))
		return nil // 不中断请求，只记录错误
	}
	
	// 将搜索结果注入到请求中
	h.injectSearchResults(requestData, searchResults)
	
	// 更新请求体
	modifiedBody, err := json.Marshal(requestData)
	if err != nil {
		return err
	}
	
	ctx.RequestBody = modifiedBody
	
	// 存储到Data中供后续使用
	ctx.Data["web_search_performed"] = true
	ctx.Data["web_search_query"] = searchQuery
	
	return nil
}

// OnAfterResponse 响应后处理
func (h *WebSearchHook) OnAfterResponse(ctx *interfaces.HookContext) error {
	// 可以在这里记录搜索使用情况等
	if performed, ok := ctx.Data["web_search_performed"].(bool); ok && performed {
		query := ctx.Data["web_search_query"].(string)
		common.SysLog(fmt.Sprintf("Web search completed for query: %s", query))
	}
	return nil
}

// OnError 错误处理
func (h *WebSearchHook) OnError(ctx *interfaces.HookContext, err error) error {
	// 记录错误但不影响主流程
	if performed, ok := ctx.Data["web_search_performed"].(bool); ok && performed {
		common.SysError(fmt.Sprintf("Request failed after web search: %v", err))
	}
	return nil
}

// shouldSearch 判断是否需要搜索
func (h *WebSearchHook) shouldSearch(requestData map[string]interface{}) bool {
	messages, ok := requestData["messages"].([]interface{})
	if !ok || len(messages) == 0 {
		return false
	}
	
	// 检查最后一条消息
	lastMessage, ok := messages[len(messages)-1].(map[string]interface{})
	if !ok {
		return false
	}
	
	content, ok := lastMessage["content"].(string)
	if !ok {
		return false
	}
	
	// 简单示例：检查是否包含 [search] 或 [联网] 标记
	return strings.Contains(content, "[search]") || 
	       strings.Contains(content, "[联网]") ||
	       strings.Contains(content, "[web]")
}

// extractSearchQuery 提取搜索查询
func (h *WebSearchHook) extractSearchQuery(requestData map[string]interface{}) string {
	messages, ok := requestData["messages"].([]interface{})
	if !ok || len(messages) == 0 {
		return ""
	}
	
	lastMessage, ok := messages[len(messages)-1].(map[string]interface{})
	if !ok {
		return ""
	}
	
	content, ok := lastMessage["content"].(string)
	if !ok {
		return ""
	}
	
	// 移除标记，保留实际查询内容
	query := strings.ReplaceAll(content, "[search]", "")
	query = strings.ReplaceAll(query, "[联网]", "")
	query = strings.ReplaceAll(query, "[web]", "")
	query = strings.TrimSpace(query)
	
	return query
}

// performSearch 执行搜索
func (h *WebSearchHook) performSearch(query string) (string, error) {
	// 这里是示例实现，实际应该调用真实的搜索API
	// 例如：Google Custom Search API, Bing Search API等
	
	if h.apiKey == "" {
		return "", fmt.Errorf("search API key not configured")
	}
	
	// 示例：返回模拟结果
	// 实际实现需要调用真实API
	return h.mockSearch(query)
}

// mockSearch 模拟搜索（示例）
func (h *WebSearchHook) mockSearch(query string) (string, error) {
	// 这只是一个示例实现
	// 实际应该调用真实的搜索API
	
	common.SysLog(fmt.Sprintf("[Mock] Searching for: %s", query))
	
	// 返回模拟的搜索结果
	return fmt.Sprintf("搜索结果 (模拟)：关于 '%s' 的最新信息...", query), nil
}

// realSearch 真实搜索实现示例（需要配置API）
func (h *WebSearchHook) realSearch(query string) (string, error) {
	// 示例：使用Google Custom Search API
	url := fmt.Sprintf("https://www.googleapis.com/customsearch/v1?key=%s&cx=YOUR_CX&q=%s", 
		h.apiKey, query)
	
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	
	// 解析搜索结果
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}
	
	// 提取搜索结果摘要
	// 这里需要根据实际API响应格式处理
	return string(body), nil
}

// injectSearchResults 将搜索结果注入到请求中
func (h *WebSearchHook) injectSearchResults(requestData map[string]interface{}, results string) {
	messages, ok := requestData["messages"].([]interface{})
	if !ok {
		return
	}
	
	// 在用户消息前插入系统消息，包含搜索结果
	systemMessage := map[string]interface{}{
		"role": "system",
		"content": fmt.Sprintf("以下是针对用户查询的最新搜索结果：\n\n%s\n\n请基于这些信息回答用户的问题。", results),
	}
	
	// 插入到消息列表的适当位置
	updatedMessages := make([]interface{}, 0, len(messages)+1)
	
	// 如果第一条是系统消息，在其后插入
	if len(messages) > 0 {
		if firstMsg, ok := messages[0].(map[string]interface{}); ok {
			if role, ok := firstMsg["role"].(string); ok && role == "system" {
				updatedMessages = append(updatedMessages, messages[0])
				updatedMessages = append(updatedMessages, systemMessage)
				updatedMessages = append(updatedMessages, messages[1:]...)
				requestData["messages"] = updatedMessages
				return
			}
		}
	}
	
	// 否则插入到开头
	updatedMessages = append(updatedMessages, systemMessage)
	updatedMessages = append(updatedMessages, messages...)
	requestData["messages"] = updatedMessages
}

