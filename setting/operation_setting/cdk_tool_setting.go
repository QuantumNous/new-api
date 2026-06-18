package operation_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

const CdkToolSettingName = "cdk_tool_setting"

type CdkToolSetting struct {
	Enabled         bool   `json:"enabled"`
	ServiceUserId   int    `json:"service_user_id"`
	TokenGroup      string `json:"token_group"`
	TokenNamePrefix string `json:"token_name_prefix"`
}

var cdkToolSetting = CdkToolSetting{
	Enabled:         false,
	ServiceUserId:   0,
	TokenGroup:      "",
	TokenNamePrefix: "cdk-tool",
}

func init() {
	config.GlobalConfig.Register(CdkToolSettingName, &cdkToolSetting)
}

func GetCdkToolSetting() *CdkToolSetting {
	cdkToolSetting.TokenGroup = strings.TrimSpace(cdkToolSetting.TokenGroup)
	cdkToolSetting.TokenNamePrefix = strings.TrimSpace(cdkToolSetting.TokenNamePrefix)
	if cdkToolSetting.TokenNamePrefix == "" {
		cdkToolSetting.TokenNamePrefix = "cdk-tool"
	}
	return &cdkToolSetting
}
