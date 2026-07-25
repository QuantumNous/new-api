package operation_setting

import (
	"fmt"
	"sync"

	"github.com/QuantumNous/new-api/setting/config"
)

type RecallCampaignSetting struct {
	Enabled     bool `json:"enabled"`
	BatchSize   int  `json:"batch_size"`
	TickSeconds int  `json:"tick_seconds"`
}

var recallCampaignSetting = RecallCampaignSetting{
	Enabled:     false,
	BatchSize:   100,
	TickSeconds: 30,
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
	return nil
}
