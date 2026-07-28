package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

const (
	DataToolCallStatusPending   = "pending"
	DataToolCallStatusSucceeded = "succeeded"
	DataToolCallStatusFailed    = "failed"
)

var (
	ErrDataToolUserQuotaInsufficient  = errors.New("insufficient user quota")
	ErrDataToolTokenQuotaInsufficient = errors.New("insufficient token quota")
	ErrDataToolIdempotencyConflict    = errors.New("idempotency key was already used for a different request")
	ErrDataToolCallAlreadySucceeded   = errors.New("data tool call already succeeded")
)

// DataToolCall is Flatkey's authoritative ledger for VOC-backed data tools.
// VOC is an unlimited upstream for the partner service account; terminal-user
// charging and idempotency therefore live here, in Flatkey's own database.
type DataToolCall struct {
	ID             int    `json:"id"`
	UserID         int    `json:"user_id" gorm:"index;not null"`
	TokenID        int    `json:"token_id" gorm:"index;default:0"`
	IdempotencyKey string `json:"idempotency_key" gorm:"type:varchar(64);uniqueIndex;not null"`
	RequestHash    string `json:"request_hash" gorm:"type:varchar(64);not null"`
	ToolID         string `json:"tool_id" gorm:"type:varchar(512);index;not null"`
	Status         string `json:"status" gorm:"type:varchar(32);index;not null"`

	PriceMicroUSD int64 `json:"price_micro_usd" gorm:"not null;default:0"`
	ChargedQuota  int   `json:"charged_quota" gorm:"not null;default:0"`
	ResultCount   int   `json:"result_count" gorm:"not null;default:0"`
	LatencyMS     int   `json:"latency_ms" gorm:"not null;default:0"`

	ResponseBody []byte `json:"-"`
	ErrorMessage string `json:"error_message" gorm:"type:text"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type ReserveDataToolCallInput struct {
	UserID         int
	TokenID        int
	TokenKey       string
	TokenUnlimited bool
	IdempotencyKey string
	RequestHash    string
	ToolID         string
	PriceMicroUSD  int64
	Quota          int
}

func validateDataToolReplay(call *DataToolCall, input ReserveDataToolCallInput) error {
	if call.UserID != input.UserID || call.ToolID != input.ToolID || call.RequestHash != input.RequestHash {
		return ErrDataToolIdempotencyConflict
	}
	return nil
}

// ReserveDataToolCall creates the idempotency ledger row and atomically
// pre-consumes user/token quota in one database transaction. A competing node
// can either create the unique row or observe it; it can never charge twice.
func ReserveDataToolCall(input ReserveDataToolCallInput) (*DataToolCall, bool, error) {
	if input.UserID <= 0 || input.IdempotencyKey == "" || input.RequestHash == "" || input.ToolID == "" {
		return nil, false, errors.New("invalid data tool reservation")
	}
	if input.Quota < 0 || input.PriceMicroUSD < 0 {
		return nil, false, errors.New("data tool price cannot be negative")
	}

	var reserved DataToolCall
	created := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Where("idempotency_key = ?", input.IdempotencyKey).First(&reserved).Error
		if err == nil {
			return validateDataToolReplay(&reserved, input)
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		reserved = DataToolCall{
			UserID:         input.UserID,
			TokenID:        input.TokenID,
			IdempotencyKey: input.IdempotencyKey,
			RequestHash:    input.RequestHash,
			ToolID:         input.ToolID,
			Status:         DataToolCallStatusPending,
			PriceMicroUSD:  input.PriceMicroUSD,
			ChargedQuota:   input.Quota,
		}
		if err := tx.Create(&reserved).Error; err != nil {
			return err
		}

		if input.Quota > 0 {
			userUpdate := tx.Model(&User{}).
				Where("id = ? AND quota >= ?", input.UserID, input.Quota).
				Updates(map[string]any{
					"quota":      gorm.Expr("quota - ?", input.Quota),
					"used_quota": gorm.Expr("used_quota + ?", input.Quota),
				})
			if userUpdate.Error != nil {
				return userUpdate.Error
			}
			if userUpdate.RowsAffected == 0 {
				return ErrDataToolUserQuotaInsufficient
			}

			if input.TokenID > 0 && !input.TokenUnlimited {
				tokenUpdate := tx.Model(&Token{}).
					Where("id = ? AND user_id = ? AND remain_quota >= ?", input.TokenID, input.UserID, input.Quota).
					Updates(map[string]any{
						"remain_quota":  gorm.Expr("remain_quota - ?", input.Quota),
						"used_quota":    gorm.Expr("used_quota + ?", input.Quota),
						"accessed_time": common.GetTimestamp(),
					})
				if tokenUpdate.Error != nil {
					return tokenUpdate.Error
				}
				if tokenUpdate.RowsAffected == 0 {
					return ErrDataToolTokenQuotaInsufficient
				}
			}
		}
		created = true
		return nil
	})
	if err != nil {
		// Concurrent inserts race on the unique idempotency key. The losing
		// transaction rolled back its quota changes; return the winner as replay.
		var existing DataToolCall
		if findErr := DB.Where("idempotency_key = ?", input.IdempotencyKey).First(&existing).Error; findErr == nil {
			if replayErr := validateDataToolReplay(&existing, input); replayErr != nil {
				return nil, false, replayErr
			}
			return &existing, true, nil
		}
		return nil, false, err
	}
	if !created {
		return &reserved, true, nil
	}

	if input.Quota > 0 {
		gopool.Go(func() {
			if err := cacheDecrUserQuota(input.UserID, int64(input.Quota)); err != nil {
				common.SysLog("failed to sync user quota cache after data tool reservation: " + err.Error())
			}
			if common.RedisEnabled &&
				common.RDB != nil &&
				input.TokenID > 0 &&
				!input.TokenUnlimited &&
				input.TokenKey != "" {
				if err := cacheDecrTokenQuota(input.TokenKey, int64(input.Quota)); err != nil {
					common.SysLog("failed to sync token quota cache after data tool reservation: " + err.Error())
				}
			}
		})
	}
	return &reserved, false, nil
}

func CompleteDataToolCall(
	id int,
	responseBody []byte,
	resultCount int,
	latencyMS int,
) error {
	result := DB.Model(&DataToolCall{}).
		Where("id = ? AND status = ?", id, DataToolCallStatusPending).
		Updates(map[string]any{
			"status":        DataToolCallStatusSucceeded,
			"response_body": responseBody,
			"result_count":  resultCount,
			"latency_ms":    latencyMS,
			"error_message": "",
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		var call DataToolCall
		if err := DB.First(&call, id).Error; err != nil {
			return err
		}
		if call.Status == DataToolCallStatusSucceeded {
			return nil
		}
		return fmt.Errorf("cannot complete data tool call in %s state", call.Status)
	}
	return nil
}

type CompleteAndSettleDataToolCallInput struct {
	ID                 int
	FinalPriceMicroUSD int64
	FinalQuota         int
	ResultCount        int
	LatencyMS          int
	BuildResponse      func(remainingQuota int) ([]byte, error)
}

// CompleteAndSettleDataToolCall atomically reconciles a pre-authorization to
// the provider's actual metered price and persists the replay response. Keeping
// those operations in one transaction prevents another node from observing a
// succeeded ledger row without its response or a charge without a terminal
// ledger state.
func CompleteAndSettleDataToolCall(input CompleteAndSettleDataToolCallInput) (int, error) {
	if input.ID <= 0 || input.FinalPriceMicroUSD < 0 || input.FinalQuota < 0 || input.BuildResponse == nil {
		return 0, errors.New("invalid data tool settlement")
	}

	var remainingQuota int
	var quotaDelta int
	var userID int
	var tokenKey string
	var adjustTokenCache bool

	err := DB.Transaction(func(tx *gorm.DB) error {
		var call DataToolCall
		if err := tx.First(&call, input.ID).Error; err != nil {
			return err
		}
		if call.Status == DataToolCallStatusSucceeded {
			return ErrDataToolCallAlreadySucceeded
		}
		if call.Status != DataToolCallStatusPending {
			return fmt.Errorf("cannot settle data tool call in %s state", call.Status)
		}

		quotaDelta = input.FinalQuota - call.ChargedQuota
		userID = call.UserID
		if quotaDelta > 0 {
			userUpdate := tx.Model(&User{}).
				Where("id = ? AND quota >= ?", call.UserID, quotaDelta).
				Updates(map[string]any{
					"quota":      gorm.Expr("quota - ?", quotaDelta),
					"used_quota": gorm.Expr("used_quota + ?", quotaDelta),
				})
			if userUpdate.Error != nil {
				return userUpdate.Error
			}
			if userUpdate.RowsAffected == 0 {
				return ErrDataToolUserQuotaInsufficient
			}
		} else if quotaDelta < 0 {
			refund := -quotaDelta
			if err := tx.Model(&User{}).Where("id = ?", call.UserID).Updates(map[string]any{
				"quota":      gorm.Expr("quota + ?", refund),
				"used_quota": gorm.Expr("used_quota - ?", refund),
			}).Error; err != nil {
				return err
			}
		}

		if quotaDelta != 0 && call.TokenID > 0 {
			var token Token
			err := tx.Select("id", "key", "unlimited_quota").
				Where("id = ? AND user_id = ?", call.TokenID, call.UserID).
				First(&token).Error
			if err != nil {
				if !errors.Is(err, gorm.ErrRecordNotFound) || quotaDelta > 0 {
					return err
				}
			} else if !token.UnlimitedQuota {
				tokenKey = token.Key
				adjustTokenCache = true
				if quotaDelta > 0 {
					tokenUpdate := tx.Model(&Token{}).
						Where("id = ? AND user_id = ? AND remain_quota >= ?", token.Id, call.UserID, quotaDelta).
						Updates(map[string]any{
							"remain_quota":  gorm.Expr("remain_quota - ?", quotaDelta),
							"used_quota":    gorm.Expr("used_quota + ?", quotaDelta),
							"accessed_time": common.GetTimestamp(),
						})
					if tokenUpdate.Error != nil {
						return tokenUpdate.Error
					}
					if tokenUpdate.RowsAffected == 0 {
						return ErrDataToolTokenQuotaInsufficient
					}
				} else {
					refund := -quotaDelta
					if err := tx.Model(&Token{}).Where("id = ?", token.Id).Updates(map[string]any{
						"remain_quota": gorm.Expr("remain_quota + ?", refund),
						"used_quota":   gorm.Expr("used_quota - ?", refund),
					}).Error; err != nil {
						return err
					}
				}
			}
		}

		if err := tx.Model(&User{}).
			Select("quota").
			Where("id = ?", call.UserID).
			Scan(&remainingQuota).Error; err != nil {
			return err
		}
		responseBody, err := input.BuildResponse(remainingQuota)
		if err != nil {
			return err
		}
		result := tx.Model(&DataToolCall{}).
			Where("id = ? AND status = ?", call.ID, DataToolCallStatusPending).
			Updates(map[string]any{
				"status":          DataToolCallStatusSucceeded,
				"price_micro_usd": input.FinalPriceMicroUSD,
				"charged_quota":   input.FinalQuota,
				"response_body":   responseBody,
				"result_count":    input.ResultCount,
				"latency_ms":      input.LatencyMS,
				"error_message":   "",
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("data tool call changed while settling")
		}
		return nil
	})
	if err != nil {
		return 0, err
	}

	if quotaDelta != 0 {
		gopool.Go(func() {
			if quotaDelta > 0 {
				if err := cacheDecrUserQuota(userID, int64(quotaDelta)); err != nil {
					common.SysLog("failed to sync user quota cache after data tool settlement: " + err.Error())
				}
				if common.RedisEnabled && common.RDB != nil && adjustTokenCache && tokenKey != "" {
					if err := cacheDecrTokenQuota(tokenKey, int64(quotaDelta)); err != nil {
						common.SysLog("failed to sync token quota cache after data tool settlement: " + err.Error())
					}
				}
				return
			}
			refund := int64(-quotaDelta)
			if err := cacheIncrUserQuota(userID, refund); err != nil {
				common.SysLog("failed to sync user quota cache after data tool settlement refund: " + err.Error())
			}
			if common.RedisEnabled && common.RDB != nil && adjustTokenCache && tokenKey != "" {
				if err := cacheIncrTokenQuota(tokenKey, refund); err != nil {
					common.SysLog("failed to sync token quota cache after data tool settlement refund: " + err.Error())
				}
			}
		})
	}
	return remainingQuota, nil
}

// FailAndRefundDataToolCall marks a pending call failed and refunds the exact
// reservation in the same transaction. Repeating the operation is a no-op.
func FailAndRefundDataToolCall(id int, errorMessage string) error {
	var refundedQuota int
	var userID int
	var tokenKey string
	var refundToken bool
	var missingTokenID int

	err := DB.Transaction(func(tx *gorm.DB) error {
		var call DataToolCall
		if err := tx.First(&call, id).Error; err != nil {
			return err
		}
		if call.Status == DataToolCallStatusFailed {
			return nil
		}
		if call.Status == DataToolCallStatusSucceeded {
			return ErrDataToolCallAlreadySucceeded
		}

		refundedQuota = call.ChargedQuota
		userID = call.UserID
		if refundedQuota > 0 {
			if err := tx.Model(&User{}).Where("id = ?", call.UserID).Updates(map[string]any{
				"quota":      gorm.Expr("quota + ?", refundedQuota),
				"used_quota": gorm.Expr("used_quota - ?", refundedQuota),
			}).Error; err != nil {
				return err
			}
			if call.TokenID > 0 {
				var token Token
				if err := tx.Select("id", "key", "unlimited_quota").
					Where("id = ? AND user_id = ?", call.TokenID, call.UserID).
					First(&token).Error; err != nil {
					if !errors.Is(err, gorm.ErrRecordNotFound) {
						return err
					}
					// A token can be deleted after a reservation while the
					// upstream request is still running. The user's wallet is
					// authoritative, so a missing token must not roll back the
					// user refund or leave the call pending.
					missingTokenID = call.TokenID
				} else if !token.UnlimitedQuota {
					refundToken = true
					tokenKey = token.Key
					if err := tx.Model(&Token{}).Where("id = ?", token.Id).Updates(map[string]any{
						"remain_quota": gorm.Expr("remain_quota + ?", refundedQuota),
						"used_quota":   gorm.Expr("used_quota - ?", refundedQuota),
					}).Error; err != nil {
						return err
					}
				}
			}
		}
		return tx.Model(&DataToolCall{}).Where("id = ?", call.ID).Updates(map[string]any{
			"status":        DataToolCallStatusFailed,
			"error_message": truncateDataToolLedgerError(errorMessage),
		}).Error
	})
	if err != nil {
		return err
	}
	if missingTokenID > 0 {
		common.SysLog(fmt.Sprintf(
			"data tool call %d refunded user quota after token %d was deleted",
			id,
			missingTokenID,
		))
	}
	if refundedQuota > 0 {
		gopool.Go(func() {
			if err := cacheIncrUserQuota(userID, int64(refundedQuota)); err != nil {
				common.SysLog("failed to sync user quota cache after data tool refund: " + err.Error())
			}
			if common.RedisEnabled && common.RDB != nil && refundToken && tokenKey != "" {
				if err := cacheIncrTokenQuota(tokenKey, int64(refundedQuota)); err != nil {
					common.SysLog("failed to sync token quota cache after data tool refund: " + err.Error())
				}
			}
		})
	}
	return nil
}

func truncateDataToolLedgerError(message string) string {
	if len(message) <= 1000 {
		return message
	}
	return message[:1000]
}
