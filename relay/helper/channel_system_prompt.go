package helper

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

func ApplyChannelSystemPromptVariables(systemPrompt string, info *relaycommon.RelayInfo) string {
	if systemPrompt == "" {
		return systemPrompt
	}
	result := systemPrompt
	result = strings.ReplaceAll(result, "{site_name}", common.SystemName)
	result = strings.ReplaceAll(result, "{site_url}", system_setting.ServerAddress)
	if info != nil && info.OriginModelName != "" {
		result = strings.ReplaceAll(result, "{model_name}", info.OriginModelName)
	}
	return result
}
