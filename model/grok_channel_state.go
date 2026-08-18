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
// 秘密存放：Channel.Key 存凭证 JSON（明文，依赖 DB 访问控制，与全仓渠道 Key 一致）；
// PKCE verifier 走 authenticated encryption 存 GrokAuthFlow.EncryptedVerifier。
// 本表（grok_channel_states）不存任何秘密。
//
// 日志安全：本表虽为非秘密快照，但 LastError 会承载上游刷新失败的原始报文片段（Task 8 写入），
// 可能夹带上游返回的敏感字符串。调用方记录日志时切勿用 %+v/%v 打印整个 GrokChannelState，
// 只打印明确非敏感字段（如 ChannelID / AuthStatus / LastRefreshAt）。
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

// UpsertGrokChannelState 按 channel_id 插入或覆盖（created_at 除外，保持首次写入值；见测试 TestGrokChannelStateUpsertPreservesCreatedAt）。
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

// GrokAuthStateView 是 GrokChannelState 的非秘密子集（白名单投影，绝不含 LastError/lease/token/quota）。
// 仅用于 GetChannel detail 响应对管理员展示 113 渠道的认证状态。
// 新增字段前务必确认其非敏感——GrokChannelState.LastError 承载上游报文片段，绝不可投影进来。
type GrokAuthStateView struct {
	AuthStatus    string `json:"auth_status"`
	BillingPlan   string `json:"billing_plan,omitempty"`
	TierRaw       string `json:"tier_raw,omitempty"`
	LastRefreshAt int64  `json:"last_refresh_at,omitempty"`
}

// NewGrokAuthStateView 从 GrokChannelState 投影出非秘密视图（白名单逐字段挑选，
// 绝不含 LastError / RefreshLeaseOwner / RefreshLeaseExpiresAt / QuotaSnapshot / token）。
// 入参为 nil（state 行尚不存在）时返回 nil，使 detail 响应因 omitempty 省略该字段。
func NewGrokAuthStateView(st *GrokChannelState) *GrokAuthStateView {
	if st == nil {
		return nil
	}
	return &GrokAuthStateView{
		AuthStatus:    st.AuthStatus,
		BillingPlan:   st.BillingPlan,
		TierRaw:       st.TierRaw,
		LastRefreshAt: st.LastRefreshAt,
	}
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

// AcquireGrokRefreshLease 原子抢占 channel-scoped 刷新 lease。
// 条件：lease owner 为空 或 已过期（expires_at <= now）。ttlSeconds 单位秒。
// 返回是否抢到。now 应由调用方用 GetDBTimestampWithContext 传入以统一时钟。
func AcquireGrokRefreshLease(channelID int, owner string, now, ttlSeconds int64) (bool, error) {
	if channelID <= 0 || owner == "" || ttlSeconds <= 0 {
		return false, errors.New("grok refresh lease: invalid args")
	}
	// MySQL 默认返回 changed-rows（非 matched-rows），no-op UPDATE 返回 0。
	// 此处 RowsAffected==1 判定安全的前提是本 UPDATE 恒改动至少一列：
	// 过期分支下 WHERE 要求旧 expires_at<=now，而新值 now+ttlSeconds>now（ttlSeconds>0 已校验）必变；
	// 空 owner 分支下新 owner 非空（已校验）必变。
	// 切勿把 expires_at 改成条件写入，否则会在 MySQL 下无声破坏该判定。
	res := DB.Model(&GrokChannelState{}).
		Where("channel_id = ? AND (refresh_lease_owner = '' OR refresh_lease_owner IS NULL OR refresh_lease_expires_at <= ?)", channelID, now).
		Updates(map[string]any{
			"refresh_lease_owner":      owner,
			"refresh_lease_expires_at": now + ttlSeconds,
			"updated_at":               now,
		})
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected == 1, nil
}

// ReleaseGrokRefreshLease 仅当前 owner 可释放（清空 owner）。
func ReleaseGrokRefreshLease(channelID int, owner string) error {
	return DB.Model(&GrokChannelState{}).
		Where("channel_id = ? AND refresh_lease_owner = ?", channelID, owner).
		Updates(map[string]any{"refresh_lease_owner": "", "refresh_lease_expires_at": 0}).Error
}
