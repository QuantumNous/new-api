package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// GrokAuthFlow 是 Grok 专用的一次性 PKCE 认证状态（设计 §7.1）。
// 独立于 Copilot 的 Redis+内存 fallback 与 Codex 的 gin session；跨节点、owner-token claim、10 分钟过期。
type GrokAuthFlow struct {
	FlowID            string `json:"flow_id" gorm:"primaryKey;type:varchar(64)"`
	Provider          string `json:"provider" gorm:"type:varchar(32);index"`
	AdminID           int    `json:"admin_id" gorm:"index"`
	ChannelID         int    `json:"channel_id" gorm:"index"`
	StateHash         string `json:"state_hash" gorm:"type:varchar(128)"`
	EncryptedVerifier string `json:"-" gorm:"type:text"`
	RedirectURI       string `json:"redirect_uri" gorm:"type:varchar(512)"`
	OwnerToken        string `json:"-" gorm:"type:varchar(128)"`
	CreatedAt         int64  `json:"created_at"`
	ExpiresAt         int64  `json:"expires_at" gorm:"index"`
}

func (GrokAuthFlow) TableName() string { return "grok_auth_flows" }

// CreateGrokAuthFlow 生成 FlowID 并落库。
func CreateGrokAuthFlow(flow *GrokAuthFlow) error {
	if flow == nil {
		return errors.New("grok auth flow: nil")
	}
	if flow.FlowID == "" {
		flow.FlowID = common.GetUUID()
	}
	if flow.CreatedAt == 0 {
		flow.CreatedAt = GetDBTimestamp()
	}
	return DB.Create(flow).Error
}

// ClaimGrokAuthFlow 原子抢占未过期、未被 claim 的 flow。返回 (flow, claimed, err)。
// 一次性：成功 claim 后 owner_token 被写入，其他 owner 无法再 claim。
func ClaimGrokAuthFlow(flowID, ownerToken string) (*GrokAuthFlow, bool, error) {
	if flowID == "" || ownerToken == "" {
		return nil, false, errors.New("grok auth flow: empty flowID/ownerToken")
	}
	now := GetDBTimestamp()
	var claimed *GrokAuthFlow
	err := DB.Transaction(func(tx *gorm.DB) error {
		// 条件更新：仅当未过期且 owner_token 为空（或已是本 owner，幂等）时写入 owner。
		res := tx.Model(&GrokAuthFlow{}).
			Where("flow_id = ? AND expires_at > ? AND (owner_token = '' OR owner_token = ?)", flowID, now, ownerToken).
			Update("owner_token", ownerToken)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return nil // 未 claim 到
		}
		var f GrokAuthFlow
		if err := tx.Where("flow_id = ? AND owner_token = ?", flowID, ownerToken).First(&f).Error; err != nil {
			return err
		}
		claimed = &f
		return nil
	})
	if err != nil {
		return nil, false, err
	}
	return claimed, claimed != nil, nil
}

// ConsumeGrokAuthFlow 仅 owner 可删除（成功/失败终态/过期）。
func ConsumeGrokAuthFlow(flowID, ownerToken string) error {
	return DB.Where("flow_id = ? AND owner_token = ?", flowID, ownerToken).Delete(&GrokAuthFlow{}).Error
}
