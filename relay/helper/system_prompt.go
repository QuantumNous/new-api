package helper

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
)

// ApplyResponsesSystemPrompt applies the channel prompt to a Responses request.
func ApplyResponsesSystemPrompt(c *gin.Context, channelSetting dto.ChannelSettings, request *dto.OpenAIResponsesRequest) error {
	if request == nil || channelSetting.SystemPrompt == "" {
		return nil
	}

	systemPrompt := channelSetting.SystemPrompt
	if len(request.Instructions) > 0 {
		var existing string
		if err := common.Unmarshal(request.Instructions, &existing); err == nil {
			// Treat null, empty, and whitespace-only instructions as missing, so the
			// channel prompt is applied regardless of the override setting.
			existing = strings.TrimSpace(existing)
			if existing != "" {
				// Preserve non-empty user instructions unless prompt concatenation is enabled.
				if !channelSetting.SystemPromptOverride {
					return nil
				}
				systemPrompt += "\n" + existing
				common.SetContextKey(c, constant.ContextKeySystemPromptOverride, true)
				instructions, err := common.Marshal(systemPrompt)
				if err != nil {
					return err
				}
				request.Instructions = instructions
				return nil
			}
		} else if !channelSetting.SystemPromptOverride {
			return nil
		}
	}

	instructions, err := common.Marshal(systemPrompt)
	if err != nil {
		return err
	}
	request.Instructions = instructions
	return nil
}
