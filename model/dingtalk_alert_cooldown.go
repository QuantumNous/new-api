package model

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type DingTalkAlertCooldownRecord struct {
	ChannelID        int    `gorm:"primaryKey"`
	LastAt           int64  `gorm:"not null;default:0"`
	PendingAt        int64  `gorm:"not null;default:0"`
	ReservationToken string `gorm:"type:varchar(64);not null;default:''"`
}

type DingTalkAlertCooldownReservation struct {
	ChannelID        int
	ReservedAt       int64
	ReservationToken string
}

func ReserveDingTalkAlertCooldown(channelID int, cooldown time.Duration, pendingTTL time.Duration, token string) (*DingTalkAlertCooldownReservation, bool, error) {
	if DB == nil {
		return nil, false, errors.New("database is not initialized")
	}
	if cooldown <= 0 {
		return nil, true, nil
	}
	if token == "" {
		return nil, false, errors.New("reservation token is empty")
	}
	if pendingTTL <= 0 {
		pendingTTL = cooldown
	}

	var reservation *DingTalkAlertCooldownReservation
	allowed := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		nowMilli, err := getDingTalkAlertCooldownDBNowMilli(tx)
		if err != nil {
			return err
		}

		var record DingTalkAlertCooldownRecord
		err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("channel_id = ?", channelID).
			First(&record).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			record = DingTalkAlertCooldownRecord{
				ChannelID:        channelID,
				PendingAt:        nowMilli,
				ReservationToken: token,
			}
			result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&record)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return reserveExistingDingTalkAlertCooldown(tx, channelID, cooldown, pendingTTL, token, nowMilli, &reservation, &allowed)
			}
			reservation = &DingTalkAlertCooldownReservation{
				ChannelID:        channelID,
				ReservedAt:       nowMilli,
				ReservationToken: token,
			}
			allowed = true
			return nil
		}
		if err != nil {
			return err
		}
		return reserveExistingDingTalkAlertCooldown(tx, channelID, cooldown, pendingTTL, token, nowMilli, &reservation, &allowed)
	})
	if err != nil {
		return nil, false, err
	}
	return reservation, allowed, nil
}

func reserveExistingDingTalkAlertCooldown(tx *gorm.DB, channelID int, cooldown time.Duration, pendingTTL time.Duration, token string, nowMilli int64, reservation **DingTalkAlertCooldownReservation, allowed *bool) error {
	var record DingTalkAlertCooldownRecord
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("channel_id = ?", channelID).
		First(&record).Error; err != nil {
		return err
	}

	cooldownMilli := cooldown.Milliseconds()
	if record.LastAt > 0 && nowMilli-record.LastAt < cooldownMilli {
		*allowed = false
		return nil
	}
	pendingTTLMilli := pendingTTL.Milliseconds()
	if record.PendingAt > 0 && nowMilli-record.PendingAt < pendingTTLMilli {
		*allowed = false
		return nil
	}

	result := tx.Model(&DingTalkAlertCooldownRecord{}).
		Where("channel_id = ?", channelID).
		Updates(map[string]any{
			"pending_at":        nowMilli,
			"reservation_token": token,
		})
	if result.Error != nil {
		return result.Error
	}

	*reservation = &DingTalkAlertCooldownReservation{
		ChannelID:        channelID,
		ReservedAt:       nowMilli,
		ReservationToken: token,
	}
	*allowed = true
	return nil
}

func CommitDingTalkAlertCooldown(reservation *DingTalkAlertCooldownReservation) error {
	if DB == nil || reservation == nil {
		return nil
	}
	result := DB.Model(&DingTalkAlertCooldownRecord{}).
		Where("channel_id = ? AND pending_at = ? AND reservation_token = ?", reservation.ChannelID, reservation.ReservedAt, reservation.ReservationToken).
		Updates(map[string]any{
			"last_at":           reservation.ReservedAt,
			"pending_at":        int64(0),
			"reservation_token": "",
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("dingtalk alert cooldown reservation was not found or no longer owned by token")
	}
	return nil
}

func RollbackDingTalkAlertCooldown(reservation *DingTalkAlertCooldownReservation) error {
	if DB == nil || reservation == nil {
		return nil
	}
	result := DB.Model(&DingTalkAlertCooldownRecord{}).
		Where("channel_id = ? AND pending_at = ? AND reservation_token = ?", reservation.ChannelID, reservation.ReservedAt, reservation.ReservationToken).
		Updates(map[string]any{
			"pending_at":        int64(0),
			"reservation_token": "",
		})
	return result.Error
}

func getDingTalkAlertCooldownDBNowMilli(tx *gorm.DB) (int64, error) {
	var nowMilli int64
	var err error
	switch tx.Dialector.Name() {
	case "sqlite":
		err = tx.Raw("SELECT CAST(strftime('%s', 'now') AS INTEGER) * 1000").Scan(&nowMilli).Error
	case "postgres", "postgresql":
		err = tx.Raw("SELECT CAST(EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000 AS BIGINT)").Scan(&nowMilli).Error
	default:
		err = tx.Raw("SELECT CAST(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000 AS SIGNED)").Scan(&nowMilli).Error
	}
	if err != nil {
		return 0, err
	}
	if nowMilli <= 0 {
		return 0, errors.New("database returned invalid current time")
	}
	return nowMilli, nil
}
