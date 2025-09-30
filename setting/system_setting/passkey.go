package system_setting

import (
	"one-api/common"
	"one-api/setting/config"
)

type PasskeySettings struct {
	Enabled              bool     `json:"enabled"`
	RPDisplayName        string   `json:"rp_display_name"`
	RPID                 string   `json:"rp_id"`
	Origins              []string `json:"origins"`
	AllowInsecureOrigin  bool     `json:"allow_insecure_origin"`
	UserVerification     string   `json:"user_verification"`
	AttachmentPreference string   `json:"attachment_preference"`
}

var defaultPasskeySettings = PasskeySettings{
	Enabled:              false,
	RPDisplayName:        common.SystemName,
	RPID:                 "",
	Origins:              []string{},
	AllowInsecureOrigin:  false,
	UserVerification:     "preferred",
	AttachmentPreference: "",
}

func init() {
	config.GlobalConfig.Register("passkey", &defaultPasskeySettings)
}

func GetPasskeySettings() *PasskeySettings {
	return &defaultPasskeySettings
}
