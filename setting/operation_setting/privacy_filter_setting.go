package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type PrivacyFilterSetting struct {
	Enabled      bool   `json:"enabled"`
	GitleaksTOML string `json:"gitleaks_toml"`
}

var privacyFilterSetting = PrivacyFilterSetting{
	Enabled:      false,
	GitleaksTOML: "",
}

func init() {
	config.GlobalConfig.Register("privacy_filter_setting", &privacyFilterSetting)
}

func GetPrivacyFilterSetting() *PrivacyFilterSetting {
	return &privacyFilterSetting
}
