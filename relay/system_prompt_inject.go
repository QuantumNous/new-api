package relay

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

// applySystemPromptToOpenAIRequest injects the channel-level system prompt into an
// OpenAI-format request. When the request already contains a system message and
// SystemPromptOverride is disabled, the existing system message is left untouched.
func applySystemPromptToOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) {
	if request == nil {
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
		systemMessage := dto.Message{
			Role:    systemRole,
			Content: info.ChannelSetting.SystemPrompt,
		}
		request.Messages = append([]dto.Message{systemMessage}, request.Messages...)
		return
	}
	if !info.ChannelSetting.SystemPromptOverride {
		return
	}
	common.SetContextKey(c, constant.ContextKeySystemPromptOverride, true)
	for i, message := range request.Messages {
		if message.Role != systemRole {
			continue
		}
		if message.IsStringContent() {
			request.Messages[i].SetStringContent(info.ChannelSetting.SystemPrompt + "\n" + message.StringContent())
		} else {
			contents := message.ParseContent()
			contents = append([]dto.MediaContent{
				{
					Type: dto.ContentTypeText,
					Text: info.ChannelSetting.SystemPrompt,
				},
			}, contents...)
			request.Messages[i].Content = contents
		}
		break
	}
}

// applySystemPromptToClaudeRequest injects the channel-level system prompt into a
// Claude-format request. Mirrors the behavior previously inlined in ClaudeHelper.
func applySystemPromptToClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) {
	if request == nil {
		return
	}
	if request.System == nil {
		request.SetStringSystem(info.ChannelSetting.SystemPrompt)
		return
	}
	if !info.ChannelSetting.SystemPromptOverride {
		return
	}
	common.SetContextKey(c, constant.ContextKeySystemPromptOverride, true)
	if request.IsStringSystem() {
		existing := strings.TrimSpace(request.GetStringSystem())
		if existing == "" {
			request.SetStringSystem(info.ChannelSetting.SystemPrompt)
		} else {
			request.SetStringSystem(info.ChannelSetting.SystemPrompt + "\n" + existing)
		}
		return
	}
	systemContents := request.ParseSystem()
	newSystem := dto.ClaudeMediaMessage{Type: dto.ContentTypeText}
	newSystem.SetText(info.ChannelSetting.SystemPrompt)
	if len(systemContents) == 0 {
		request.System = []dto.ClaudeMediaMessage{newSystem}
	} else {
		request.System = append([]dto.ClaudeMediaMessage{newSystem}, systemContents...)
	}
}

// applySystemPromptToGeminiRequest injects the channel-level system prompt into a
// Gemini-format request. Mirrors the behavior previously inlined in GeminiHelper.
func applySystemPromptToGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) {
	if request == nil {
		return
	}
	if request.SystemInstructions == nil {
		request.SystemInstructions = &dto.GeminiChatContent{
			Parts: []dto.GeminiPart{
				{Text: info.ChannelSetting.SystemPrompt},
			},
		}
		return
	}
	if len(request.SystemInstructions.Parts) == 0 {
		request.SystemInstructions.Parts = []dto.GeminiPart{{Text: info.ChannelSetting.SystemPrompt}}
		return
	}
	if !info.ChannelSetting.SystemPromptOverride {
		return
	}
	common.SetContextKey(c, constant.ContextKeySystemPromptOverride, true)
	merged := false
	for i := range request.SystemInstructions.Parts {
		if request.SystemInstructions.Parts[i].Text == "" {
			continue
		}
		request.SystemInstructions.Parts[i].Text = info.ChannelSetting.SystemPrompt + "\n" + request.SystemInstructions.Parts[i].Text
		merged = true
		break
	}
	if !merged {
		request.SystemInstructions.Parts = append([]dto.GeminiPart{{Text: info.ChannelSetting.SystemPrompt}}, request.SystemInstructions.Parts...)
	}
}
