package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type ConversationArchiveSetting struct {
	Enabled                    bool `json:"enabled"`
	DumpEnabled                bool `json:"dump_enabled"`
	R2Enabled                  bool `json:"r2_enabled"`
	DeleteLocalDumpAfterUpload bool `json:"delete_local_dump_after_upload"`
	RetentionDays              int  `json:"retention_days"`
}

var conversationArchiveSetting = ConversationArchiveSetting{
	Enabled:                    true,
	DumpEnabled:                true,
	R2Enabled:                  true,
	DeleteLocalDumpAfterUpload: true,
	RetentionDays:              7,
}

func init() {
	config.GlobalConfig.Register("conversation_archive_setting", &conversationArchiveSetting)
}

func GetConversationArchiveSetting() *ConversationArchiveSetting {
	return &conversationArchiveSetting
}

func IsConversationArchiveEnabled() bool {
	return conversationArchiveSetting.Enabled
}

func IsConversationArchiveDumpEnabled() bool {
	return conversationArchiveSetting.DumpEnabled
}

func IsConversationArchiveR2Enabled() bool {
	return conversationArchiveSetting.R2Enabled
}

func ShouldDeleteConversationArchiveLocalDumpAfterUpload() bool {
	return conversationArchiveSetting.DeleteLocalDumpAfterUpload
}

func ConversationArchiveRetentionDays() int {
	if conversationArchiveSetting.RetentionDays < 0 {
		return 0
	}
	return conversationArchiveSetting.RetentionDays
}
