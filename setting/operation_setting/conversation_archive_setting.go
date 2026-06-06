package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type ConversationArchiveSetting struct {
	Enabled bool `json:"enabled"`
}

var conversationArchiveSetting = ConversationArchiveSetting{
	Enabled: true,
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
