package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// GrokAuthFlow 是 Grok 专用的一次性 PKCE 认证状态（设计 §7.1）。
// 独立于 Copilot 的 Redis+内存 fallback 与 Codex 的 gin session；跨节点、owner-token claim、10 分钟过期。
//
// 安全提示：EncryptedVerifier / OwnerToken 上的 `json:"-"` 只挡 JSON 序列化，不挡 fmt 的 %+v/%v。
// 调用方（Task 8/18）记录日志时切勿用 %+v/%v 打印整个 GrokAuthFlow，否则加密 verifier 与 owner-token 会外泄；
// 只打印非敏感字段（如 FlowID / ChannelID / ExpiresAt）。
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
		// 这个 WHERE 同时保证了跨-owner 一次性与过期拦截，正确无需改动。
		res := tx.Model(&GrokAuthFlow{}).
			Where("flow_id = ? AND expires_at > ? AND (owner_token = '' OR owner_token = ?)", flowID, now, ownerToken).
			Update("owner_token", ownerToken)
		if res.Error != nil {
			return res.Error
		}
		// 不能用 res.RowsAffected 判 claim 结果：同-owner 幂等重试是 no-op UPDATE（owner_token 被设为它已有的值），
		// 生产 MySQL（本仓库 DSN 未设 clientFoundRows，采用 changed-rows 语义）会返回 RowsAffected=0，
		// 而 SQLite 计 matched-rows 返回 1——依赖它会在 MySQL 上把幂等重试误判为失败（见 recall_recipient.go:1181）。
		// 改为读回：本 owner 且未过期的行存在即代表我们持有该 claim（首次抢占或幂等重入皆然）。
		// 读回 WHERE 必须带 expires_at > ?，否则一个已过期但仍属本 owner 的行会被误判为 claimed。
		var f GrokAuthFlow
		err := tx.Where("flow_id = ? AND owner_token = ? AND expires_at > ?", flowID, ownerToken, now).First(&f).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil // 未 claim 到（已过期，或被他人持有）
		}
		if err != nil {
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

// DeleteExpiredGrokAuthFlows 清掉已过期 flow（未完成的 PKCE 残留，含未认领 verifier 密文）。
// ConsumeGrokAuthFlow 只按 owner_token 删已认领的 flow；未完成授权（owner_token=”)的 flow
// 永不被消费，EncryptedVerifier 会超期滞留并无界增长。best-effort 机会式清理由调用方触发。
// expires_at 为 UNIX 秒（同 CreateGrokAuthFlow 写入约定），与 GetDBTimestamp() 同源比较。
func DeleteExpiredGrokAuthFlows() error {
	return DB.Where("expires_at <= ?", GetDBTimestamp()).Delete(&GrokAuthFlow{}).Error
}
