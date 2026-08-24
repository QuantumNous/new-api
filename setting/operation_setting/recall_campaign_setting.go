package operation_setting

import (
	"fmt"
	"net/mail"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/setting/config"
)

type RecallCampaignSetting struct {
	Enabled            bool   `json:"enabled"`
	BatchSize          int    `json:"batch_size"`
	TickSeconds        int    `json:"tick_seconds"`
	EmailHourlyLimit   int    `json:"email_hourly_limit"`
	SMTPServer         string `json:"smtp_server"`
	SMTPPort           int    `json:"smtp_port"`
	SMTPAccount        string `json:"smtp_account"`
	EmailFrom          string `json:"email_from"`
	SMTPToken          string `json:"smtp_token"`
	SMTPSSLEnabled     bool   `json:"smtp_ssl_enabled"`
	SMTPForceAuthLogin bool   `json:"smtp_force_auth_login"`
	// ReplyTo is the address recipients answer to. Marketing mail without a
	// reachable reply address scores worse with mailbox providers.
	ReplyTo string `json:"reply_to"`
	// UnsubscribeMailto is an optional mailto: fallback advertised alongside
	// the one-click HTTPS unsubscribe endpoint.
	UnsubscribeMailto string `json:"unsubscribe_mailto"`
}

var recallCampaignSetting = RecallCampaignSetting{
	Enabled:          false,
	BatchSize:        100,
	TickSeconds:      30,
	EmailHourlyLimit: 100,
}

var recallCampaignSettingMu sync.RWMutex

func init() {
	config.GlobalConfig.Register("recall_campaign_setting", &recallCampaignSetting)
	config.GlobalConfig.RegisterUpdateLock("recall_campaign_setting", &recallCampaignSettingMu)
}

func GetRecallCampaignSetting() RecallCampaignSetting {
	recallCampaignSettingMu.RLock()
	defer recallCampaignSettingMu.RUnlock()
	return recallCampaignSetting
}

func IsRecallCampaignEnabled() bool {
	return GetRecallCampaignSetting().Enabled
}

func (s *RecallCampaignSetting) NormalizeAndValidate() error {
	if s.BatchSize < 1 || s.BatchSize > 1000 {
		return fmt.Errorf("recall campaign batch size must be between 1 and 1000")
	}
	if s.TickSeconds < 5 || s.TickSeconds > 3600 {
		return fmt.Errorf("recall campaign tick seconds must be between 5 and 3600")
	}
	if s.EmailHourlyLimit < 1 || s.EmailHourlyLimit > 100000 {
		return fmt.Errorf("recall campaign email hourly limit must be between 1 and 100000")
	}
	s.ReplyTo = strings.TrimSpace(s.ReplyTo)
	if s.ReplyTo != "" {
		if _, err := mail.ParseAddress(s.ReplyTo); err != nil {
			return fmt.Errorf("recall campaign reply-to must be a valid email address")
		}
	}
	s.UnsubscribeMailto = strings.TrimSpace(s.UnsubscribeMailto)
	if s.UnsubscribeMailto != "" {
		if !strings.HasPrefix(s.UnsubscribeMailto, "mailto:") {
			return fmt.Errorf("recall campaign unsubscribe mailto must start with mailto:")
		}
		if _, err := mail.ParseAddress(strings.TrimPrefix(s.UnsubscribeMailto, "mailto:")); err != nil {
			return fmt.Errorf("recall campaign unsubscribe mailto must be a valid email address")
		}
	}
	return nil
}
