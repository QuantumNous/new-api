package model

import (
	"database/sql/driver"
	"fmt"

	"github.com/QuantumNous/new-api/common"
)

const (
	ChannelBalanceUnitMoney   = "money"
	ChannelBalanceUnitTokens  = "tokens"
	ChannelBalanceUnitCredits = "credits"
)

// ChannelBalanceInfo preserves the native unit returned by a New API upstream.
// The legacy Channel.Balance field remains USD-only.
type ChannelBalanceInfo struct {
	Remaining   string `json:"remaining,omitempty"`
	Unit        string `json:"unit,omitempty"`
	Currency    string `json:"currency,omitempty"`
	DisplayUnit string `json:"display_unit,omitempty"`
	Unlimited   bool   `json:"unlimited"`
	UpdatedAt   int64  `json:"updated_at"`
}

func (info ChannelBalanceInfo) Value() (driver.Value, error) {
	return common.Marshal(&info)
}

func (info *ChannelBalanceInfo) Scan(value any) error {
	if value == nil {
		*info = ChannelBalanceInfo{}
		return nil
	}
	var data []byte
	switch typed := value.(type) {
	case []byte:
		data = typed
	case string:
		data = []byte(typed)
	default:
		return fmt.Errorf("unsupported channel balance info value type %T", value)
	}
	if len(data) == 0 {
		*info = ChannelBalanceInfo{}
		return nil
	}
	return common.Unmarshal(data, info)
}

func (channel *Channel) UpdateBalanceInfo(info ChannelBalanceInfo, legacyBalanceUSD *float64) error {
	updates := map[string]any{"balance_info": info}
	if legacyBalanceUSD != nil {
		updates["balance"] = *legacyBalanceUSD
		updates["balance_updated_time"] = info.UpdatedAt
	}
	if err := DB.Model(channel).Updates(updates).Error; err != nil {
		return err
	}
	channel.BalanceInfo = &info
	if legacyBalanceUSD != nil {
		channel.Balance = *legacyBalanceUSD
		channel.BalanceUpdatedTime = info.UpdatedAt
	}
	return nil
}
