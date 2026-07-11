package helper

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// modelSystemPromptMode values
const (
	ModelSystemPromptModeDisabled = iota // 0: 禁用
	ModelSystemPromptModeInject          // 1: 注入（只有无system消息时才注入）
	ModelSystemPromptModeOverride        // 2: 覆写（始终替换原有system消息）
	ModelSystemPromptModeAppend          // 3: 附加（拼接到原有system消息前面）
)

// resolveModelSystemPrompt 解析多语言系统提示词，按语言匹配
// systemPromptJSON 格式: {"en":"Hello", "zh":"你好"}
func resolveModelSystemPrompt(systemPromptJSON, language string) string {
	if systemPromptJSON == "" {
		return ""
	}
	// 尝试作为 JSON 解析多语言消息
	var jsonValue map[string]string
	if err := json.Unmarshal([]byte(systemPromptJSON), &jsonValue); err != nil || len(jsonValue) == 0 {
		// 不是 JSON，直接作为纯文本返回
		return systemPromptJSON
	}
	// 尝试匹配用户语言
	if text, ok := jsonValue[language]; ok && text != "" {
		return text
	}
	// 回退到 en
	if text, ok := jsonValue["en"]; ok && text != "" {
		return text
	}
	// 回退到 zh
	if text, ok := jsonValue["zh"]; ok && text != "" {
		return text
	}
	// 回退到第一个非空值
	for _, text := range jsonValue {
		if text != "" {
			return text
		}
	}
	return ""
}

// GetResolvedModelSystemPrompt 从请求上下文获取已解析的模型系统提示词
func GetResolvedModelSystemPrompt(c *gin.Context) string {
	systemPromptJSON := c.GetString(string(constant.ContextKeyModelSystemPrompt))
	if systemPromptJSON == "" {
		return ""
	}
	language := c.GetString(string(constant.ContextKeyLanguage))
	if language == "" {
		language = "en"
	}
	return resolveModelSystemPrompt(systemPromptJSON, language)
}

// getModelSystemPromptMode 获取模型系统提示词的匹配模式
func getModelSystemPromptMode(c *gin.Context) int {
	mode := c.GetInt(string(constant.ContextKeyModelSystemPromptMode))
	return mode
}

// SetupModelSystemPrompt 在分发阶段设置模型系统提示词上下文
func SetupModelSystemPrompt(c *gin.Context, modelName string) {
	systemPrompt, mode := model.GetModelSystemPrompt(modelName)
	if systemPrompt == "" || mode == ModelSystemPromptModeDisabled {
		return
	}
	c.Set(string(constant.ContextKeyModelSystemPrompt), systemPrompt)
	c.Set(string(constant.ContextKeyModelSystemPromptMode), mode)
}

// ApplyModelSystemPromptToOpenAI 对 OpenAI 格式请求应用模型级系统提示词
func ApplyModelSystemPromptToOpenAI(c *gin.Context, request *dto.GeneralOpenAIRequest) {
	mode := getModelSystemPromptMode(c)
	if mode == ModelSystemPromptModeDisabled {
		return
	}
	systemPrompt := GetResolvedModelSystemPrompt(c)
	if systemPrompt == "" {
		return
	}

	systemRole := request.GetSystemRoleName()
	containSystemPrompt := false
	for _, message := range request.Messages {
		if message.Role == systemRole {
			containSystemPrompt = true
			break
		}
	}

	if !containSystemPrompt {
		// 无 system 消息时，注入新的
		systemMessage := dto.Message{
			Role:    systemRole,
			Content: systemPrompt,
		}
		request.Messages = append([]dto.Message{systemMessage}, request.Messages...)
		return
	}

	// 已有 system 消息，根据模式处理
	switch mode {
	case ModelSystemPromptModeInject:
		// 注入模式：已有则不处理
		return
	case ModelSystemPromptModeOverride:
		// 覆写模式：替换原有内容
		for i, message := range request.Messages {
			if message.Role == systemRole {
				request.Messages[i].SetStringContent(systemPrompt)
				return
			}
		}
	case ModelSystemPromptModeAppend:
		// 附加模式：拼接到原有内容前面
		for i, message := range request.Messages {
			if message.Role == systemRole {
				if message.IsStringContent() {
					existing := strings.TrimSpace(message.StringContent())
					if existing == "" {
						request.Messages[i].SetStringContent(systemPrompt)
					} else {
						request.Messages[i].SetStringContent(systemPrompt + "\n" + existing)
					}
				} else {
					contents := message.ParseContent()
					contents = append([]dto.MediaContent{
						{Type: dto.ContentTypeText, Text: systemPrompt},
					}, contents...)
					request.Messages[i].Content = contents
				}
				return
			}
		}
	}
}

// ApplyModelSystemPromptToGemini 对 Gemini 格式请求应用模型级系统提示词
func ApplyModelSystemPromptToGemini(c *gin.Context, request *dto.GeminiChatRequest) {
	mode := getModelSystemPromptMode(c)
	if mode == ModelSystemPromptModeDisabled {
		return
	}
	systemPrompt := GetResolvedModelSystemPrompt(c)
	if systemPrompt == "" {
		return
	}

	switch mode {
	case ModelSystemPromptModeInject:
		if request.SystemInstructions == nil {
			request.SystemInstructions = &dto.GeminiChatContent{
				Parts: []dto.GeminiPart{{Text: systemPrompt}},
			}
		}
	case ModelSystemPromptModeOverride:
		request.SystemInstructions = &dto.GeminiChatContent{
			Parts: []dto.GeminiPart{{Text: systemPrompt}},
		}
	case ModelSystemPromptModeAppend:
		if request.SystemInstructions == nil || len(request.SystemInstructions.Parts) == 0 {
			request.SystemInstructions = &dto.GeminiChatContent{
				Parts: []dto.GeminiPart{{Text: systemPrompt}},
			}
		} else {
			merged := false
			for i := range request.SystemInstructions.Parts {
				if request.SystemInstructions.Parts[i].Text == "" {
					continue
				}
				request.SystemInstructions.Parts[i].Text = systemPrompt + "\n" + request.SystemInstructions.Parts[i].Text
				merged = true
				break
			}
			if !merged {
				request.SystemInstructions.Parts = append([]dto.GeminiPart{{Text: systemPrompt}}, request.SystemInstructions.Parts...)
			}
		}
	}
}

// ApplyModelSystemPromptToClaude 对 Claude 格式请求应用模型级系统提示词
func ApplyModelSystemPromptToClaude(c *gin.Context, request *dto.ClaudeRequest) {
	mode := getModelSystemPromptMode(c)
	if mode == ModelSystemPromptModeDisabled {
		return
	}
	systemPrompt := GetResolvedModelSystemPrompt(c)
	if systemPrompt == "" {
		return
	}

	switch mode {
	case ModelSystemPromptModeInject:
		// 注入模式：只在无 system 时注入
		if request.System == nil {
			request.SetStringSystem(systemPrompt)
		}
	case ModelSystemPromptModeOverride:
		// 覆写模式：始终替换
		request.SetStringSystem(systemPrompt)
	case ModelSystemPromptModeAppend:
		// 附加模式：拼接到原有内容前面
		if request.System == nil {
			request.SetStringSystem(systemPrompt)
		} else if request.IsStringSystem() {
			existing := strings.TrimSpace(request.GetStringSystem())
			if existing == "" {
				request.SetStringSystem(systemPrompt)
			} else {
				request.SetStringSystem(systemPrompt + "\n" + existing)
			}
		} else {
			systemContents := request.ParseSystem()
			newSystem := dto.ClaudeMediaMessage{Type: dto.ContentTypeText}
			newSystem.SetText(systemPrompt)
			if len(systemContents) == 0 {
				request.System = []dto.ClaudeMediaMessage{newSystem}
			} else {
				request.System = append([]dto.ClaudeMediaMessage{newSystem}, systemContents...)
			}
		}
	}
}
