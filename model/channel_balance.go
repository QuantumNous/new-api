package model

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
)

// channelBalanceDetailKey is the other_info member of the last balance query.
const channelBalanceDetailKey = "balance_detail"

// ChannelBalanceDetail is the last balance query of a channel, kept in
// other_info: the result in its own currency, the last failure, and for a
// multi-key plugin channel the result of each key by its 0-based index.
type ChannelBalanceDetail struct {
	jsplugin.BalanceResult
	Error string                          `json:"error,omitempty"`
	Keys  map[string]ChannelBalanceDetail `json:"keys,omitempty"`
}

// GetBalanceDetail returns the channel's last balance query, nil before the
// first one.
func (channel *Channel) GetBalanceDetail() *ChannelBalanceDetail {
	value, ok := channel.GetOtherInfo()[channelBalanceDetailKey]
	if !ok || value == nil {
		return nil
	}
	encoded, err := common.Marshal(value)
	if err != nil {
		return nil
	}
	var detail ChannelBalanceDetail
	if err = common.Unmarshal(encoded, &detail); err != nil {
		return nil
	}
	return &detail
}

// UpdateChannelBalanceDetail stores a balance query of a channel. update gets
// the stored detail, nil before the first query, and returns the detail to
// store, or nil to store nothing, and the new USD balance, if any.
// The update time moves when the stored detail has no error, so it is the
// time of the last query that returned a balance. It holds the channel's
// polling lock from the read through the write, as the other writers of
// other_info do.
func UpdateChannelBalanceDetail(channelID int, update func(stored *ChannelBalanceDetail) (*ChannelBalanceDetail, *float64)) (*ChannelBalanceDetail, error) {
	pollingLock := GetChannelPollingLock(channelID)
	pollingLock.Lock()
	defer pollingLock.Unlock()
	channel, err := GetChannelById(channelID, false)
	if err != nil {
		return nil, err
	}
	detail, balance := update(channel.GetBalanceDetail())
	if detail == nil {
		return nil, nil
	}
	if detail.Windows == nil {
		detail.Windows = []jsplugin.BalanceWindow{}
	}
	info := channel.GetOtherInfo()
	info[channelBalanceDetailKey] = detail
	channel.SetOtherInfo(info)
	updates := map[string]any{"other_info": channel.OtherInfo}
	if detail.Error == "" {
		updates["balance_updated_time"] = common.GetTimestamp()
	}
	if balance != nil {
		updates["balance"] = *balance
	}
	return detail, DB.Model(&Channel{}).Where("id = ?", channelID).Updates(updates).Error
}
