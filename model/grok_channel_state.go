package model

import (
	"errors"

	"gorm.io/gorm/clause"
)

// Grok 认证状态枚举（非秘密）。
const (
	GrokAuthStatusPending     = "pending"      // 空 Key 已建渠道，等待完成 OAuth
	GrokAuthStatusActive      = "active"       // 有可用 access_token
	GrokAuthStatusNeedsReauth = "needs_reauth" // 刷新失败/无 refresh_token，需人工重认证
)

// GrokChannelState 是按 channel_id 唯一的非秘密状态快照（设计 §6.3）。
// 严禁存放 access_token / refresh_token / pkce_verifier / 密码 / SSO cookie。
// 秘密只存在于加密后的 Channel.Key（凭证 JSON）与 GrokAuthFlow.EncryptedVerifier。
type GrokChannelState struct {
	ChannelID             int    `json:"channel_id" gorm:"primaryKey"`
	AuthStatus            string `json:"auth_status" gorm:"type:varchar(32);index"`
	BillingPlan           string `json:"billing_plan" gorm:"type:varchar(64)"`
	TierRaw               string `json:"tier_raw" gorm:"type:varchar(64)"`
	QuotaSnapshot         string `json:"quota_snapshot" gorm:"type:text"`
	RefreshLeaseOwner     string `json:"-" gorm:"type:varchar(128)"`
	RefreshLeaseExpiresAt int64  `json:"refresh_lease_expires_at"`
	LastRefreshAt         int64  `json:"last_refresh_at"`
	LastError             string `json:"last_error" gorm:"type:varchar(512)"`
	CreatedAt             int64  `json:"created_at"`
	UpdatedAt             int64  `json:"updated_at"`
}

func (GrokChannelState) TableName() string { return "grok_channel_states" }

// UpsertGrokChannelState 按 channel_id 插入或整体覆盖（保持唯一一行）。
func UpsertGrokChannelState(st *GrokChannelState) error {
	if st == nil || st.ChannelID <= 0 {
		return errors.New("grok channel state: invalid channel id")
	}
	if st.CreatedAt == 0 {
		st.CreatedAt = GetDBTimestamp()
	}
	st.UpdatedAt = GetDBTimestamp()
	return DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "channel_id"}},
		UpdateAll: true,
	}).Create(st).Error
}

// GetGrokChannelState 取单渠道状态；不存在返回 (nil, gorm.ErrRecordNotFound)。
func GetGrokChannelState(channelID int) (*GrokChannelState, error) {
	var st GrokChannelState
	if err := DB.Where("channel_id = ?", channelID).First(&st).Error; err != nil {
		return nil, err
	}
	return &st, nil
}

// DeleteGrokChannelState 渠道删除时级联清理。
func DeleteGrokChannelState(channelID int) error {
	return DB.Where("channel_id = ?", channelID).Delete(&GrokChannelState{}).Error
}
