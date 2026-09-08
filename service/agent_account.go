package service

import (
	"errors"
	"math"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const (
	AgentCreditDirectionCredit = "credit"
	AgentCreditDirectionDebit  = "debit"

	agentAccountMutationMaxAttempts = 3
	agentAdjustmentReasonMaxRunes   = 255
	agentIdempotencyKeyMaxBytes     = 96
)

var (
	ErrAgentAccountNotFound     = errors.New("agent account not found")
	ErrAgentAccountDisabled     = errors.New("agent account is disabled")
	ErrAgentUserNotFound        = errors.New("user not found")
	ErrAgentInvalidDailyLimit   = errors.New("agent daily code limit must be positive")
	ErrAgentInvalidAdjustment   = errors.New("invalid agent credit adjustment")
	ErrAgentInsufficientBalance = errors.New("insufficient agent balance")
	ErrAgentBalanceOverflow     = errors.New("agent balance overflow")
	ErrAgentIdempotencyConflict = errors.New("agent idempotency key conflicts with an existing request")
	ErrAgentAccountConflict     = errors.New("agent account was modified concurrently")

	errAgentAccountVersionConflict = errors.New("agent account version conflict")
	errAgentAdjustmentReplayRace   = errors.New("agent adjustment replay race")
)

type AgentCreditAdjustment struct {
	AgentUserID    int
	OperatorUserID int
	Amount         int64
	Direction      string
	Reason         string
	IdempotencyKey string
}

type AgentCreditAdjustmentResult struct {
	// Account is the stable balance snapshot produced by this adjustment. It is
	// reconstructed from the immutable ledger on idempotent replay and is not a
	// representation of the agent's current lifecycle or purchase-limit state.
	Account AgentCreditBalanceSnapshot
	Log     model.AgentCreditLog
}

type AgentCreditBalanceSnapshot struct {
	Balance int64
}

type AgentAccountRecord struct {
	Account     model.AgentAccount
	Username    string
	DisplayName string
}

func GetAgentAccount(userID int) (*model.AgentAccount, error) {
	if userID <= 0 {
		return nil, ErrAgentAccountNotFound
	}
	var account model.AgentAccount
	if err := model.DB.Where("user_id = ?", userID).First(&account).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAgentAccountNotFound
		}
		return nil, err
	}
	return &account, nil
}

// EnableAgent creates an active agent account or reactivates the existing
// account without changing its balance or daily purchase state.
func EnableAgent(userID int) (*model.AgentAccount, error) {
	if userID <= 0 {
		return nil, ErrAgentUserNotFound
	}

	for attempt := 0; attempt < agentAccountMutationMaxAttempts; attempt++ {
		var result model.AgentAccount
		createFailed := false
		err := model.DB.Transaction(func(tx *gorm.DB) error {
			var user model.User
			if err := tx.Select("id").Where("id = ?", userID).First(&user).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrAgentUserNotFound
				}
				return err
			}

			var account model.AgentAccount
			err := tx.Where("user_id = ?", userID).First(&account).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				account = model.AgentAccount{
					UserId:         userID,
					Status:         model.AgentAccountStatusActive,
					DailyCodeLimit: model.DefaultAgentDailyCodeLimit,
				}
				if err := tx.Create(&account).Error; err != nil {
					createFailed = true
					return err
				}
				result = account
				return nil
			}
			if err != nil {
				return err
			}
			if account.Status == model.AgentAccountStatusActive {
				result = account
				return nil
			}
			if account.Version == math.MaxInt64 {
				return ErrAgentAccountConflict
			}

			updatedVersion := account.Version + 1
			update := tx.Model(&model.AgentAccount{}).
				Where("id = ? AND version = ?", account.Id, account.Version).
				Updates(map[string]interface{}{
					"status":  model.AgentAccountStatusActive,
					"version": updatedVersion,
				})
			if update.Error != nil {
				return update.Error
			}
			if update.RowsAffected != 1 {
				return errAgentAccountVersionConflict
			}
			account.Status = model.AgentAccountStatusActive
			account.Version = updatedVersion
			if err := tx.First(&result, account.Id).Error; err != nil {
				return err
			}
			return nil
		})
		if errors.Is(err, errAgentAccountVersionConflict) {
			continue
		}
		if err != nil && createFailed {
			account, getErr := GetAgentAccount(userID)
			if getErr == nil {
				if account.Status == model.AgentAccountStatusActive {
					return account, nil
				}
				continue
			}
			return nil, err
		}
		if err != nil {
			return nil, err
		}
		return &result, nil
	}
	return nil, ErrAgentAccountConflict
}

func DisableAgent(userID int) (*model.AgentAccount, error) {
	return mutateAgentAccount(userID, false, func(account *model.AgentAccount) (bool, error) {
		if account.Status == model.AgentAccountStatusDisabled {
			return false, nil
		}
		account.Status = model.AgentAccountStatusDisabled
		return true, nil
	})
}

func UpdateAgentDailyLimit(userID int, dailyLimit int) (*model.AgentAccount, error) {
	if dailyLimit <= 0 || int64(dailyLimit) > math.MaxInt32 {
		return nil, ErrAgentInvalidDailyLimit
	}
	return mutateAgentAccount(userID, true, func(account *model.AgentAccount) (bool, error) {
		if account.DailyCodeLimit == dailyLimit {
			return false, nil
		}
		account.DailyCodeLimit = dailyLimit
		return true, nil
	})
}

func mutateAgentAccount(userID int, requireActive bool, mutate func(*model.AgentAccount) (bool, error)) (*model.AgentAccount, error) {
	if userID <= 0 {
		return nil, ErrAgentAccountNotFound
	}
	for attempt := 0; attempt < agentAccountMutationMaxAttempts; attempt++ {
		var result model.AgentAccount
		err := model.DB.Transaction(func(tx *gorm.DB) error {
			var account model.AgentAccount
			if err := tx.Where("user_id = ?", userID).First(&account).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrAgentAccountNotFound
				}
				return err
			}
			if requireActive && account.Status != model.AgentAccountStatusActive {
				return ErrAgentAccountDisabled
			}

			originalVersion := account.Version
			changed, err := mutate(&account)
			if err != nil {
				return err
			}
			if !changed {
				result = account
				return nil
			}
			if originalVersion == math.MaxInt64 {
				return ErrAgentAccountConflict
			}

			account.Version = originalVersion + 1
			update := tx.Model(&model.AgentAccount{}).
				Where("id = ? AND version = ?", account.Id, originalVersion).
				Updates(map[string]interface{}{
					"status":           account.Status,
					"daily_code_limit": account.DailyCodeLimit,
					"version":          account.Version,
				})
			if update.Error != nil {
				return update.Error
			}
			if update.RowsAffected != 1 {
				return errAgentAccountVersionConflict
			}
			if err := tx.First(&result, account.Id).Error; err != nil {
				return err
			}
			return nil
		})
		if errors.Is(err, errAgentAccountVersionConflict) {
			continue
		}
		if err != nil {
			return nil, err
		}
		return &result, nil
	}
	return nil, ErrAgentAccountConflict
}

func AdjustAgentCredit(input AgentCreditAdjustment) (*AgentCreditAdjustmentResult, error) {
	input.Direction = strings.TrimSpace(input.Direction)
	input.Reason = strings.TrimSpace(input.Reason)
	input.IdempotencyKey = strings.TrimSpace(input.IdempotencyKey)
	if input.AgentUserID <= 0 || input.OperatorUserID <= 0 || input.Amount <= 0 ||
		(input.Direction != AgentCreditDirectionCredit && input.Direction != AgentCreditDirectionDebit) ||
		input.Reason == "" || utf8.RuneCountInString(input.Reason) > agentAdjustmentReasonMaxRunes ||
		input.IdempotencyKey == "" || len(input.IdempotencyKey) > agentIdempotencyKeyMaxBytes {
		return nil, ErrAgentInvalidAdjustment
	}

	eventType := model.AgentCreditEventAdminCredit
	delta := input.Amount
	if input.Direction == AgentCreditDirectionDebit {
		eventType = model.AgentCreditEventAdminDebit
		delta = -input.Amount
	}
	businessKey := "agent:" + strconv.Itoa(input.AgentUserID) + ":" + input.IdempotencyKey
	if len(businessKey) > 128 {
		return nil, ErrAgentInvalidAdjustment
	}

	for attempt := 0; attempt < agentAccountMutationMaxAttempts; attempt++ {
		if existing, found, err := findAgentCreditAdjustment(model.DB, businessKey); err != nil {
			return nil, err
		} else if found {
			return replayAgentCreditAdjustment(existing, input.AgentUserID, eventType, delta, input.Reason)
		}

		var expectedAccount model.AgentAccount
		if err := model.DB.Where("user_id = ?", input.AgentUserID).First(&expectedAccount).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, ErrAgentAccountNotFound
			}
			return nil, err
		}
		if expectedAccount.Status != model.AgentAccountStatusActive {
			return nil, ErrAgentAccountDisabled
		}
		if expectedAccount.Balance < 0 {
			return nil, ErrAgentBalanceOverflow
		}
		if delta > 0 && expectedAccount.Balance > math.MaxInt64-delta {
			return nil, ErrAgentBalanceOverflow
		}
		if delta < 0 && expectedAccount.Balance < input.Amount {
			return nil, ErrAgentInsufficientBalance
		}
		if expectedAccount.Version == math.MaxInt64 {
			return nil, ErrAgentAccountConflict
		}

		var result AgentCreditAdjustmentResult
		err := model.DB.Transaction(func(tx *gorm.DB) error {
			guard := tx.Model(&model.AgentAccount{}).
				Where("id = ? AND version = ? AND status = ?", expectedAccount.Id, expectedAccount.Version, model.AgentAccountStatusActive).
				Updates(map[string]interface{}{
					"version":    expectedAccount.Version + 1,
					"updated_at": common.GetTimestamp(),
				})
			if guard.Error != nil {
				return guard.Error
			}
			if guard.RowsAffected != 1 {
				return errAgentAccountVersionConflict
			}

			if existing, found, err := findAgentCreditAdjustment(tx, businessKey); err != nil {
				return err
			} else if found {
				if _, err := replayAgentCreditAdjustment(existing, input.AgentUserID, eventType, delta, input.Reason); err != nil {
					return err
				}
				return errAgentAdjustmentReplayRace
			}

			var account model.AgentAccount
			if err := tx.Where("id = ?", expectedAccount.Id).First(&account).Error; err != nil {
				return err
			}
			if account.Status != model.AgentAccountStatusActive {
				return ErrAgentAccountDisabled
			}
			if account.Balance < 0 {
				return ErrAgentBalanceOverflow
			}
			if err := guardAgentLedgerConsistencyTx(tx, &account); err != nil {
				return err
			}

			balanceAfter := account.Balance
			if delta > 0 {
				if account.Balance > math.MaxInt64-delta {
					return ErrAgentBalanceOverflow
				}
				balanceAfter += delta
			} else {
				if account.Balance < input.Amount {
					return ErrAgentInsufficientBalance
				}
				balanceAfter -= input.Amount
			}
			update := tx.Model(&model.AgentAccount{}).
				Where("id = ? AND version = ?", account.Id, account.Version).
				UpdateColumn("balance", balanceAfter)
			if update.Error != nil {
				return update.Error
			}
			if update.RowsAffected != 1 {
				return errAgentAccountVersionConflict
			}

			log := model.AgentCreditLog{
				AgentUserId:    input.AgentUserID,
				Delta:          delta,
				BalanceBefore:  account.Balance,
				BalanceAfter:   balanceAfter,
				EventType:      eventType,
				BusinessKey:    businessKey,
				OperatorUserId: input.OperatorUserID,
				Remark:         input.Reason,
			}
			if err := tx.Create(&log).Error; err != nil {
				return err
			}
			result = AgentCreditAdjustmentResult{
				Account: AgentCreditBalanceSnapshot{Balance: balanceAfter},
				Log:     log,
			}
			return nil
		})
		if errors.Is(err, errAgentAccountVersionConflict) {
			continue
		}
		if errors.Is(err, errAgentAdjustmentReplayRace) {
			if existing, found, findErr := findAgentCreditAdjustment(model.DB, businessKey); findErr != nil {
				return nil, findErr
			} else if found {
				return replayAgentCreditAdjustment(existing, input.AgentUserID, eventType, delta, input.Reason)
			}
			continue
		}
		if err != nil {
			return nil, err
		}
		return &result, nil
	}
	return nil, ErrAgentAccountConflict
}

func findAgentCreditAdjustment(db *gorm.DB, businessKey string) (model.AgentCreditLog, bool, error) {
	var existing model.AgentCreditLog
	result := db.Where("event_type IN ? AND business_key = ?", []string{
		model.AgentCreditEventAdminCredit,
		model.AgentCreditEventAdminDebit,
	}, businessKey).Limit(1).Find(&existing)
	return existing, result.RowsAffected == 1, result.Error
}

func replayAgentCreditAdjustment(existing model.AgentCreditLog, agentUserID int, eventType string, delta int64, reason string) (*AgentCreditAdjustmentResult, error) {
	if existing.AgentUserId != agentUserID || existing.EventType != eventType ||
		existing.Delta != delta || existing.Remark != reason {
		return nil, ErrAgentIdempotencyConflict
	}
	return &AgentCreditAdjustmentResult{
		Account: AgentCreditBalanceSnapshot{Balance: existing.BalanceAfter},
		Log:     existing,
	}, nil
}

func ListAdminAgentAccounts(keyword string, status string, start int, limit int) ([]AgentAccountRecord, int64, error) {
	if start < 0 {
		start = 0
	}
	if limit <= 0 {
		limit = 10
	}

	query := model.DB.Model(&model.AgentAccount{}).
		Joins("JOIN users ON users.id = agent_accounts.user_id")
	if status != "" {
		query = query.Where("agent_accounts.status = ?", status)
	}
	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		like := "%" + keyword + "%"
		if userID, err := strconv.Atoi(keyword); err == nil {
			query = query.Where("agent_accounts.user_id = ? OR users.username LIKE ? OR users.display_name LIKE ?", userID, like, like)
		} else {
			query = query.Where("users.username LIKE ? OR users.display_name LIKE ?", like, like)
		}
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var accounts []model.AgentAccount
	if err := query.Select("agent_accounts.*").Order("agent_accounts.id DESC").Offset(start).Limit(limit).Find(&accounts).Error; err != nil {
		return nil, 0, err
	}
	if len(accounts) == 0 {
		return []AgentAccountRecord{}, total, nil
	}

	userIDs := make([]int, 0, len(accounts))
	for _, account := range accounts {
		userIDs = append(userIDs, account.UserId)
	}
	var users []model.User
	if err := model.DB.Select("id", "username", "display_name").Where("id IN ?", userIDs).Find(&users).Error; err != nil {
		return nil, 0, err
	}
	usersByID := make(map[int]model.User, len(users))
	for _, user := range users {
		usersByID[user.Id] = user
	}
	records := make([]AgentAccountRecord, 0, len(accounts))
	for _, account := range accounts {
		user := usersByID[account.UserId]
		records = append(records, AgentAccountRecord{
			Account:     account,
			Username:    user.Username,
			DisplayName: user.DisplayName,
		})
	}
	return records, total, nil
}

func ListAdminAgentCreditLogs(agentUserID int, start int, limit int) ([]model.AgentCreditLog, int64, error) {
	if agentUserID <= 0 {
		return nil, 0, ErrAgentAccountNotFound
	}
	if start < 0 {
		start = 0
	}
	if limit <= 0 {
		limit = 10
	}
	var account model.AgentAccount
	if err := model.DB.Select("id").Where("user_id = ?", agentUserID).First(&account).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, 0, ErrAgentAccountNotFound
		}
		return nil, 0, err
	}
	var total int64
	query := model.DB.Model(&model.AgentCreditLog{}).Where("agent_user_id = ?", agentUserID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var logs []model.AgentCreditLog
	if err := query.Order("id DESC").Offset(start).Limit(limit).Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}
