package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// QuotaOutbox 是批量额度更新的持久化中转表（outbox）。
//
// 内存批量累加器在刷新时先把待处理的增量写入本表（单事务批量插入），成功后才
// 从内存中移除；随后按行领取并应用。任何一次数据库故障或进程崩溃都不会丢增量：
// 行要么保持 pending 等待重试/启动恢复，要么在领取事务中原子地应用并标记
// processed，因此每个增量恰好应用一次。
//
// 缓存一致性：Redis 余额由原子预扣/增减路径实时维护，是扣费期间的权威值，
// 本表只负责把同一增量持久化到数据库。应用 outbox 行时绝不再次修改缓存，
// 否则会重复扣减；缓存 TTL 过期或进程重启后从已同步的数据库余额水合。
const (
	quotaOutboxStatusPending    = "pending"
	quotaOutboxStatusProcessing = "processing"
	quotaOutboxStatusProcessed  = "processed"

	quotaOutboxTargetUser    = "user"
	quotaOutboxTargetToken   = "token"
	quotaOutboxTargetChannel = "channel"

	// quotaOutboxProcessLimit 是每轮刷新最多尝试的行数，避免一次刷新华过久。
	quotaOutboxProcessLimit = 200
	// quotaOutboxRecoverLimit 是启动恢复每批读取的行数。
	quotaOutboxRecoverLimit = 500
	// quotaOutboxRetryBaseSeconds / quotaOutboxRetryMaxSeconds 定义失败重试的
	// 指数退避范围，防止数据库持续故障时打爆日志和连接池。
	quotaOutboxRetryBaseSeconds = 1
	quotaOutboxRetryMaxSeconds  = 60
	// quotaOutboxProcessedRetentionSeconds 限制已处理行的保留时间，便于排查
	// 问题又不会让表无限增长。pending 行不受影响。
	quotaOutboxProcessedRetentionSeconds = 24 * 60 * 60
)

// QuotaOutbox 一行代表一批需要应用到某个目标（用户/令牌/渠道）的额度增量。
type QuotaOutbox struct {
	Id                int64  `json:"id" gorm:"primary_key"`
	TargetType        string `json:"target_type" gorm:"type:varchar(16);not null;index:idx_quota_outbox_claim,priority:1;index:idx_quota_outbox_cleanup,priority:1"`
	TargetId          int    `json:"target_id" gorm:"not null;index:idx_quota_outbox_target,priority:1"`
	QuotaDelta        int64  `json:"quota_delta" gorm:"bigint;not null"`
	UsedQuotaDelta    int64  `json:"used_quota_delta" gorm:"bigint;not null"`
	RequestCountDelta int64  `json:"request_count_delta" gorm:"bigint;not null"`
	Status            string `json:"status" gorm:"type:varchar(16);not null"`
	Attempts          int    `json:"attempts" gorm:"not null"`
	LastError         string `json:"last_error" gorm:"type:text"`
	NextAttemptAt     int64  `json:"next_attempt_at" gorm:"bigint;not null;index:idx_quota_outbox_claim,priority:2"`
	CreatedAt         int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt         int64  `json:"updated_at" gorm:"bigint;index:idx_quota_outbox_cleanup,priority:2"`
}

func (QuotaOutbox) TableName() string {
	return "quota_outbox"
}

func (outbox *QuotaOutbox) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	if outbox.CreatedAt == 0 {
		outbox.CreatedAt = now
	}
	outbox.UpdatedAt = now
	return nil
}

func (outbox *QuotaOutbox) BeforeUpdate(tx *gorm.DB) error {
	outbox.UpdatedAt = common.GetTimestamp()
	return nil
}

// enqueueQuotaOutbox 把内存累加器的快照持久化为 outbox 行。所有行在同一个事务
// 中写入：要么全部持久化成功（调用方才可以清空内存），要么全部保留在内存中
// 等待下一轮刷新。
func enqueueQuotaOutbox(stores []map[int]int) error {
	rows := make([]QuotaOutbox, 0, len(stores[BatchUpdateTypeUserQuota]))

	userIDs := make(map[int]struct{}, len(stores[BatchUpdateTypeUserQuota])+len(stores[BatchUpdateTypeUsedQuota])+len(stores[BatchUpdateTypeRequestCount]))
	for id := range stores[BatchUpdateTypeUserQuota] {
		userIDs[id] = struct{}{}
	}
	for id := range stores[BatchUpdateTypeUsedQuota] {
		userIDs[id] = struct{}{}
	}
	for id := range stores[BatchUpdateTypeRequestCount] {
		userIDs[id] = struct{}{}
	}
	for id := range userIDs {
		row := QuotaOutbox{
			TargetType:        quotaOutboxTargetUser,
			TargetId:          id,
			QuotaDelta:        int64(stores[BatchUpdateTypeUserQuota][id]),
			UsedQuotaDelta:    int64(stores[BatchUpdateTypeUsedQuota][id]),
			RequestCountDelta: int64(stores[BatchUpdateTypeRequestCount][id]),
		}
		if row.QuotaDelta == 0 && row.UsedQuotaDelta == 0 && row.RequestCountDelta == 0 {
			continue
		}
		rows = append(rows, row)
	}

	for id, delta := range stores[BatchUpdateTypeTokenQuota] {
		if delta == 0 {
			continue
		}
		rows = append(rows, QuotaOutbox{
			TargetType: quotaOutboxTargetToken,
			TargetId:   id,
			QuotaDelta: int64(delta),
		})
	}
	for id, delta := range stores[BatchUpdateTypeChannelUsedQuota] {
		if delta == 0 {
			continue
		}
		rows = append(rows, QuotaOutbox{
			TargetType: quotaOutboxTargetChannel,
			TargetId:   id,
			QuotaDelta: int64(delta),
		})
	}

	if len(rows) == 0 {
		return nil
	}
	for i := range rows {
		rows[i].Status = quotaOutboxStatusPending
		rows[i].NextAttemptAt = 0
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		return tx.CreateInBatches(&rows, 100).Error
	})
}

// applyQuotaOutboxRow 领取并应用一行 outbox 增量。领取、应用到目标表、标记
// processed 在同一个事务中完成：
//   - 领取使用条件更新（status = pending），多节点/多 worker 并发时只有一个
//     能成功领取，其余直接跳过，因此每个增量恰好应用一次；
//   - 目标表更新失败时整个事务回滚，行保持 pending，等待重试；
//   - 进程在事务中途崩溃时事务同样回滚，启动恢复会重新处理该行。
func applyQuotaOutboxRow(row QuotaOutbox) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		claim := tx.Model(&QuotaOutbox{}).
			Where("id = ? AND status = ?", row.Id, quotaOutboxStatusPending).
			Update("status", quotaOutboxStatusProcessing)
		if claim.Error != nil {
			return claim.Error
		}
		if claim.RowsAffected == 0 {
			// 已被其他 worker/节点领取或处理，跳过。
			return nil
		}
		if err := applyQuotaOutboxDelta(tx, row); err != nil {
			return err
		}
		return tx.Model(&QuotaOutbox{}).Where("id = ?", row.Id).
			Updates(map[string]any{
				"status":     quotaOutboxStatusProcessed,
				"updated_at": common.GetTimestamp(),
			}).Error
	})
}

func applyQuotaOutboxDelta(tx *gorm.DB, row QuotaOutbox) error {
	switch row.TargetType {
	case quotaOutboxTargetUser:
		return updateUserQuotaUsedQuotaAndRequestCountTx(tx, row.TargetId,
			int(row.QuotaDelta), int(row.UsedQuotaDelta), int(row.RequestCountDelta))
	case quotaOutboxTargetToken:
		if row.QuotaDelta == 0 {
			return nil
		}
		return applyTokenQuotaDeltaTx(tx, row.TargetId, row.QuotaDelta)
	case quotaOutboxTargetChannel:
		if row.QuotaDelta == 0 {
			return nil
		}
		return tx.Model(&Channel{}).Where("id = ?", row.TargetId).
			Update("used_quota", gorm.Expr("used_quota + ?", row.QuotaDelta)).Error
	default:
		return fmt.Errorf("unknown quota outbox target type %q", row.TargetType)
	}
}

// applyTokenQuotaDeltaTx 与 increaseTokenQuota 语义一致：正 delta 增加剩余额度，
// 负 delta 扣减剩余额度并累加已用额度。
func applyTokenQuotaDeltaTx(tx *gorm.DB, id int, delta int64) error {
	return tx.Model(&Token{}).Where("id = ?", id).Updates(
		map[string]any{
			"remain_quota":  gorm.Expr("remain_quota + ?", delta),
			"used_quota":    gorm.Expr("used_quota - ?", delta),
			"accessed_time": common.GetTimestamp(),
		},
	).Error
}

// processPendingQuotaOutbox 重试所有到期未处理的行。失败的行保留 pending 并
// 记录指数退避，下一轮或下次启动恢复继续处理，增量不会丢失。
func processPendingQuotaOutbox(limit int) {
	var rows []QuotaOutbox
	err := DB.Where("status = ? AND next_attempt_at <= ?", quotaOutboxStatusPending, common.GetTimestamp()).
		Order("id asc").Limit(limit).Find(&rows).Error
	if err != nil {
		common.SysError(common.LogText("failed to load pending quota outbox rows: %s", err.Error()))
		return
	}
	for i := range rows {
		if err := applyQuotaOutboxRow(rows[i]); err != nil {
			recordQuotaOutboxFailure(&rows[i], err)
		}
	}
}

func recordQuotaOutboxFailure(row *QuotaOutbox, applyErr error) {
	attempts := row.Attempts + 1
	backoff := quotaOutboxRetryBaseSeconds
	for i := 1; i < attempts && backoff < quotaOutboxRetryMaxSeconds; i++ {
		backoff *= 2
	}
	if backoff > quotaOutboxRetryMaxSeconds {
		backoff = quotaOutboxRetryMaxSeconds
	}
	now := common.GetTimestamp()
	err := DB.Model(&QuotaOutbox{}).
		Where("id = ? AND status = ?", row.Id, quotaOutboxStatusPending).
		Updates(map[string]any{
			"attempts":        attempts,
			"last_error":      applyErr.Error(),
			"next_attempt_at": now + int64(backoff),
			"updated_at":      now,
		}).Error
	if err != nil {
		common.SysError(common.LogText("failed to record quota outbox retry (id=%d): %s", row.Id, err.Error()))
		return
	}
	common.SysError(common.LogText("quota outbox apply failed (id=%d target=%s/%d attempt=%d): %s",
		row.Id, row.TargetType, row.TargetId, attempts, applyErr.Error()))
}

// cleanupProcessedQuotaOutbox 删除超过保留期的已处理行，防止表无限增长。
func cleanupProcessedQuotaOutbox() {
	cutoff := common.GetTimestamp() - quotaOutboxProcessedRetentionSeconds
	if err := DB.Where("status = ? AND updated_at < ?", quotaOutboxStatusProcessed, cutoff).
		Delete(&QuotaOutbox{}).Error; err != nil {
		common.SysError(common.LogText("failed to clean up processed quota outbox rows: %s", err.Error()))
	}
}

// RecoverQuotaOutbox 在应用启动时重放所有未处理的 outbox 行。必须在数据库
// 初始化完成后、开始服务请求之前调用。任何节点都可以执行恢复；领取操作保证
// 多节点并发安全且每行只应用一次。
func RecoverQuotaOutbox() {
	if DB == nil || !DB.Migrator().HasTable(&QuotaOutbox{}) {
		return
	}
	// 领取、应用、标记在同一事务中完成，正常情况下不会存在 processing 行；
	// 若因异常的中断出现，重置为 pending 后按未应用处理（目标更新随事务回滚，
	// 重新应用不会重复扣减）。先处理它，即使当前没有 pending 行。
	if err := DB.Model(&QuotaOutbox{}).Where("status = ?", quotaOutboxStatusProcessing).
		Updates(map[string]any{"status": quotaOutboxStatusPending, "next_attempt_at": 0, "updated_at": common.GetTimestamp()}).Error; err != nil {
		common.SysError(common.LogText("failed to requeue interrupted quota outbox rows: %s", err.Error()))
	}
	var pendingCount int64
	if err := DB.Model(&QuotaOutbox{}).Where("status = ?", quotaOutboxStatusPending).Count(&pendingCount).Error; err != nil {
		common.SysError(common.LogText("failed to inspect the quota outbox for recovery: %s", err.Error()))
		return
	}
	if pendingCount == 0 {
		return
	}
	common.SysLog(common.LogText("quota outbox recovery started: pending=%d", pendingCount))
	applied := 0
	for {
		var rows []QuotaOutbox
		err := DB.Where("status = ?", quotaOutboxStatusPending).
			Order("id asc").Limit(quotaOutboxRecoverLimit).Find(&rows).Error
		if err != nil {
			common.SysError(common.LogText("failed to load quota outbox rows for recovery: %s", err.Error()))
			break
		}
		if len(rows) == 0 {
			break
		}
		failed := false
		for i := range rows {
			if err := applyQuotaOutboxRow(rows[i]); err != nil {
				recordQuotaOutboxFailure(&rows[i], err)
				failed = true
				break
			}
			applied++
		}
		if failed || len(rows) < quotaOutboxRecoverLimit {
			break
		}
	}
	common.SysLog(common.LogText("quota outbox recovery finished: applied=%d", applied))
}
