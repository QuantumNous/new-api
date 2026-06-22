package model

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type CodexModelGovernanceAlertCooldownRecord struct {
	ModelName        string `gorm:"primaryKey;type:varchar(255);autoIncrement:false"`
	LastAt           int64  `gorm:"not null;default:0"`
	PendingAt        int64  `gorm:"not null;default:0"`
	ReservationToken string `gorm:"type:varchar(64);not null;default:''"`
}

type CodexModelGovernanceAlertCooldownReservation struct {
	ModelName        string
	ReservedAt       int64
	ReservationToken string
}

func ReserveCodexModelGovernanceAlertCooldown(modelName string, cooldown time.Duration, pendingTTL time.Duration, token string) (*CodexModelGovernanceAlertCooldownReservation, bool, error) {
	modelName = strings.TrimSpace(modelName)
	if DB == nil {
		return nil, false, errors.New("database is not initialized")
	}
	if modelName == "" || cooldown <= 0 {
		return nil, true, nil
	}
	if token == "" {
		return nil, false, errors.New("reservation token is empty")
	}
	if pendingTTL <= 0 {
		pendingTTL = cooldown
	}

	var reservation *CodexModelGovernanceAlertCooldownReservation
	allowed := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		nowMilli, err := getDingTalkAlertCooldownDBNowMilli(tx)
		if err != nil {
			return err
		}

		var record CodexModelGovernanceAlertCooldownRecord
		err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("model_name = ?", modelName).
			First(&record).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			record = CodexModelGovernanceAlertCooldownRecord{
				ModelName:        modelName,
				PendingAt:        nowMilli,
				ReservationToken: token,
			}
			result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&record)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return reserveExistingCodexModelGovernanceAlertCooldown(tx, modelName, cooldown, pendingTTL, token, nowMilli, &reservation, &allowed)
			}
			reservation = &CodexModelGovernanceAlertCooldownReservation{
				ModelName:        modelName,
				ReservedAt:       nowMilli,
				ReservationToken: token,
			}
			allowed = true
			return nil
		}
		if err != nil {
			return err
		}
		return reserveExistingCodexModelGovernanceAlertCooldown(tx, modelName, cooldown, pendingTTL, token, nowMilli, &reservation, &allowed)
	})
	if err != nil {
		return nil, false, err
	}
	return reservation, allowed, nil
}

func reserveExistingCodexModelGovernanceAlertCooldown(tx *gorm.DB, modelName string, cooldown time.Duration, pendingTTL time.Duration, token string, nowMilli int64, reservation **CodexModelGovernanceAlertCooldownReservation, allowed *bool) error {
	var record CodexModelGovernanceAlertCooldownRecord
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("model_name = ?", modelName).
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

	result := tx.Model(&CodexModelGovernanceAlertCooldownRecord{}).
		Where("model_name = ?", modelName).
		Updates(map[string]any{
			"pending_at":        nowMilli,
			"reservation_token": token,
		})
	if result.Error != nil {
		return result.Error
	}

	*reservation = &CodexModelGovernanceAlertCooldownReservation{
		ModelName:        modelName,
		ReservedAt:       nowMilli,
		ReservationToken: token,
	}
	*allowed = true
	return nil
}

func CommitCodexModelGovernanceAlertCooldown(reservation *CodexModelGovernanceAlertCooldownReservation) error {
	if DB == nil || reservation == nil {
		return nil
	}
	result := DB.Model(&CodexModelGovernanceAlertCooldownRecord{}).
		Where("model_name = ? AND pending_at = ? AND reservation_token = ?", reservation.ModelName, reservation.ReservedAt, reservation.ReservationToken).
		Updates(map[string]any{
			"last_at":           reservation.ReservedAt,
			"pending_at":        int64(0),
			"reservation_token": "",
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("codex model governance alert cooldown reservation was not found or no longer owned by token")
	}
	return nil
}

func RollbackCodexModelGovernanceAlertCooldown(reservation *CodexModelGovernanceAlertCooldownReservation) error {
	if DB == nil || reservation == nil {
		return nil
	}
	result := DB.Model(&CodexModelGovernanceAlertCooldownRecord{}).
		Where("model_name = ? AND pending_at = ? AND reservation_token = ?", reservation.ModelName, reservation.ReservedAt, reservation.ReservationToken).
		Updates(map[string]any{
			"pending_at":        int64(0),
			"reservation_token": "",
		})
	return result.Error
}
