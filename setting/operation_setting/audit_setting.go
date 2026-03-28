package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

const (
	AuditModeDisabled = "disabled"
	AuditModeLocal    = "local"
	AuditModeRemote   = "remote"
)

type AuditSetting struct {
	Mode           string `json:"mode"`
	RemoteEndpoint string `json:"remote_endpoint"`
	RemoteTimeout  int    `json:"remote_timeout"`
	RemoteApiKey   string `json:"remote_api_key"`
	MaxFileSize    int64  `json:"max_file_size"`
	RetentionDays  int    `json:"retention_days"`
}

var auditSetting = AuditSetting{
	Mode:           AuditModeDisabled,
	RemoteEndpoint: "",
	RemoteTimeout:  30,
	RemoteApiKey:   "",
	MaxFileSize:    10,
	RetentionDays:  30,
}

func init() {
	config.GlobalConfig.Register("audit_setting", &auditSetting)
}

func GetAuditSetting() *AuditSetting {
	return &auditSetting
}

func IsAuditEnabled() bool {
	return auditSetting.Mode != AuditModeDisabled
}

func IsAuditLocalMode() bool {
	return auditSetting.Mode == AuditModeLocal
}

func IsAuditRemoteMode() bool {
	return auditSetting.Mode == AuditModeRemote
}
