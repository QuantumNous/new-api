package model

import (
	"errors"
	"strings"

	"gorm.io/gorm"
)

const (
	SubscriptionProviderLifecycleActionCancel      = "cancel"
	SubscriptionProviderLifecycleActionGraceCancel = "grace_cancel"
	SubscriptionProviderLifecycleActionResume      = "resume"

	subscriptionProviderLifecycleReservationMaxTTLSeconds int64 = 24 * 60 * 60
)

type SubscriptionProviderLifecycleReservation struct {
	BindingId              int64
	UserId                 int
	ContractId             int64
	ProviderSubscriptionId string
	Token                  string
	Action                 string
	LifecycleActionSeq     int64
	ExpiresAt              int64
}

func ReserveSubscriptionProviderLifecycle(
	bindingID int64,
	userID int,
	expectedProviderSubscriptionID string,
	expectedLifecycleActionSeq int64,
	action string,
	token string,
	ttlSeconds int64,
) (*SubscriptionProviderLifecycleReservation, *SubscriptionProviderBinding, error) {
	return reserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		expectedProviderSubscriptionID,
		expectedLifecycleActionSeq,
		action,
		token,
		ttlSeconds,
		false,
	)
}

func ReserveSubscriptionProviderLifecycleForAdministrativeTermination(
	bindingID int64,
	userID int,
	expectedProviderSubscriptionID string,
	expectedLifecycleActionSeq int64,
	token string,
	ttlSeconds int64,
) (*SubscriptionProviderLifecycleReservation, *SubscriptionProviderBinding, error) {
	return reserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		expectedProviderSubscriptionID,
		expectedLifecycleActionSeq,
		SubscriptionProviderLifecycleActionCancel,
		token,
		ttlSeconds,
		true,
	)
}

func reserveSubscriptionProviderLifecycle(
	bindingID int64,
	userID int,
	expectedProviderSubscriptionID string,
	expectedLifecycleActionSeq int64,
	action string,
	token string,
	ttlSeconds int64,
	allowNeedsAttention bool,
) (*SubscriptionProviderLifecycleReservation, *SubscriptionProviderBinding, error) {
	action = strings.ToLower(strings.TrimSpace(action))
	token = strings.TrimSpace(token)
	expectedProviderSubscriptionID = strings.TrimSpace(expectedProviderSubscriptionID)
	if bindingID <= 0 || userID <= 0 || expectedProviderSubscriptionID == "" || expectedLifecycleActionSeq < 0 {
		return nil, nil, errors.New("invalid subscription provider lifecycle reservation target")
	}
	if action != SubscriptionProviderLifecycleActionCancel &&
		action != SubscriptionProviderLifecycleActionGraceCancel &&
		action != SubscriptionProviderLifecycleActionResume {
		return nil, nil, errors.New("invalid subscription provider lifecycle reservation action")
	}
	if token == "" || len(token) > 128 || ttlSeconds <= 0 || ttlSeconds > subscriptionProviderLifecycleReservationMaxTTLSeconds {
		return nil, nil, errors.New("invalid subscription provider lifecycle reservation lease")
	}

	var reserved SubscriptionProviderBinding
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockQuery(tx).Where("id = ? AND user_id = ?", bindingID, userID).First(&reserved).Error; err != nil {
			return err
		}
		if reserved.Provider != PaymentProviderStripe {
			return ErrSubscriptionProviderLifecycleConflict
		}
		if reserved.ContractId > 0 {
			var contract UserSubscriptionContract
			if err := lockQuery(tx).Where("id = ? AND user_id = ?", reserved.ContractId, userID).First(&contract).Error; err != nil {
				return err
			}
			contractStatusAllowed := contract.Status == SubscriptionContractStatusActive ||
				contract.Status == SubscriptionContractStatusGrace ||
				(allowNeedsAttention && contract.Status == SubscriptionContractStatusNeedsAttention)
			if contract.Id != reserved.ContractId ||
				!contractStatusAllowed ||
				contract.PaymentMode != SubscriptionPaymentModeStripeRecurring ||
				contract.CurrentProviderBindingId != reserved.Id {
				return ErrSubscriptionProviderLifecycleConflict
			}
		}
		if strings.TrimSpace(reserved.ProviderSubscriptionId) != expectedProviderSubscriptionID ||
			reserved.EndedAt > 0 || isTerminalProviderSubscriptionStatus(reserved.ProviderStatus) {
			return ErrSubscriptionProviderLifecycleConflict
		}
		now, err := getDBTimestampTxStrict(tx)
		if err != nil {
			return err
		}
		if subscriptionProviderLifecycleReservationIsActive(&reserved, now) {
			if reserved.LifecycleActionSeq != expectedLifecycleActionSeq {
				return ErrSubscriptionProviderLifecycleConflict
			}
			if reserved.LifecycleReservationAction != action || reserved.LifecycleReservationToken != token {
				return ErrSubscriptionProviderLifecycleConflict
			}
			return nil
		}
		if reserved.LifecycleActionSeq != expectedLifecycleActionSeq {
			return ErrSubscriptionProviderLifecycleConflict
		}
		nextLifecycleActionSeq := reserved.LifecycleActionSeq + 1
		// An expired, unconsumed same-action lease is the same logical provider operation, so
		// it deliberately reuses the fencing sequence and Stripe idempotency key.
		// The new token still fences the live owner; explicit release advances the
		// sequence so abandoned work cannot be mistaken for a consumed operation.
		if reserved.LifecycleReservationAction == action && reserved.LifecycleReservationUntil > 0 {
			nextLifecycleActionSeq = reserved.LifecycleActionSeq
		}
		until := now + ttlSeconds
		update := tx.Model(&SubscriptionProviderBinding{}).
			Where("id = ? AND user_id = ? AND provider_subscription_id = ? AND lifecycle_action_seq = ? AND ended_at = ? AND provider_status NOT IN ? AND (lifecycle_reservation_token = ? OR lifecycle_reservation_until <= ?)",
				reserved.Id,
				reserved.UserId,
				reserved.ProviderSubscriptionId,
				reserved.LifecycleActionSeq,
				0,
				terminalProviderSubscriptionStatuses,
				"",
				now,
			).
			Updates(map[string]interface{}{
				"lifecycle_action_seq":         nextLifecycleActionSeq,
				"lifecycle_reservation_token":  token,
				"lifecycle_reservation_action": action,
				"lifecycle_reservation_until":  until,
			})
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != 1 {
			return ErrSubscriptionProviderLifecycleConflict
		}
		return tx.Where("id = ?", bindingID).First(&reserved).Error
	})
	if err != nil {
		return nil, nil, err
	}
	reservation := subscriptionProviderLifecycleReservationFromBinding(&reserved)
	if reservation == nil || reservation.Action != action {
		return nil, nil, ErrSubscriptionProviderLifecycleConflict
	}
	return reservation, &reserved, nil
}

func ReleaseSubscriptionProviderLifecycleReservation(reservation *SubscriptionProviderLifecycleReservation) error {
	if reservation == nil || reservation.BindingId <= 0 || reservation.LifecycleActionSeq < 0 ||
		reservation.UserId <= 0 ||
		strings.TrimSpace(reservation.Token) == "" || strings.TrimSpace(reservation.Action) == "" {
		return errors.New("invalid subscription provider lifecycle reservation")
	}
	result := DB.Model(&SubscriptionProviderBinding{}).
		Where(
			"id = ? AND provider = ? AND provider_subscription_id = ? AND lifecycle_action_seq = ? AND lifecycle_reservation_token = ? AND lifecycle_reservation_action = ? AND lifecycle_reservation_until = ? AND ended_at = ? AND provider_status NOT IN ?",
			reservation.BindingId,
			PaymentProviderStripe,
			strings.TrimSpace(reservation.ProviderSubscriptionId),
			reservation.LifecycleActionSeq,
			strings.TrimSpace(reservation.Token),
			strings.TrimSpace(reservation.Action),
			reservation.ExpiresAt,
			0,
			terminalProviderSubscriptionStatuses,
		).
		Where("user_id = ? AND contract_id = ?", reservation.UserId, reservation.ContractId).
		Updates(map[string]interface{}{
			"lifecycle_action_seq":         gorm.Expr("lifecycle_action_seq + ?", 1),
			"lifecycle_reservation_token":  "",
			"lifecycle_reservation_action": "",
			"lifecycle_reservation_until":  0,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrSubscriptionProviderLifecycleConflict
	}
	return nil
}

func consumeSubscriptionProviderLifecycleReservationTx(tx *gorm.DB, reservation *SubscriptionProviderLifecycleReservation) error {
	if tx == nil {
		return errors.New("tx is nil")
	}
	if reservation == nil || reservation.BindingId <= 0 || reservation.LifecycleActionSeq < 0 ||
		reservation.UserId <= 0 ||
		strings.TrimSpace(reservation.ProviderSubscriptionId) == "" ||
		strings.TrimSpace(reservation.Token) == "" || strings.TrimSpace(reservation.Action) == "" {
		return errors.New("invalid subscription provider lifecycle reservation")
	}
	// Keep token/action as an inactive consumed tombstone. Clearing only the
	// expiry preserves exact-owner proof without blocking the next reservation.
	result := tx.Model(&SubscriptionProviderBinding{}).
		Where(
			"id = ? AND provider_subscription_id = ? AND lifecycle_action_seq = ? AND lifecycle_reservation_token = ? AND lifecycle_reservation_action = ? AND lifecycle_reservation_until = ? AND ended_at = ? AND provider_status NOT IN ?",
			reservation.BindingId,
			strings.TrimSpace(reservation.ProviderSubscriptionId),
			reservation.LifecycleActionSeq,
			strings.TrimSpace(reservation.Token),
			strings.TrimSpace(reservation.Action),
			reservation.ExpiresAt,
			0,
			terminalProviderSubscriptionStatuses,
		).
		Where("user_id = ? AND contract_id = ?", reservation.UserId, reservation.ContractId).
		Updates(map[string]interface{}{
			"lifecycle_reservation_until": 0,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrSubscriptionProviderLifecycleConflict
	}
	return nil
}

func ConsumeCurrentSubscriptionProviderLifecycleReservationTx(tx *gorm.DB, contractID int64, reservation *SubscriptionProviderLifecycleReservation) error {
	return consumeCurrentSubscriptionProviderLifecycleReservationTx(tx, contractID, reservation, false)
}

func ConsumeCurrentSubscriptionProviderLifecycleReservationAfterAuthoritativeNoopTx(tx *gorm.DB, contractID int64, reservation *SubscriptionProviderLifecycleReservation) error {
	if reservation == nil ||
		(strings.TrimSpace(reservation.Action) != SubscriptionProviderLifecycleActionCancel &&
			strings.TrimSpace(reservation.Action) != SubscriptionProviderLifecycleActionGraceCancel) {
		return ErrSubscriptionProviderLifecycleConflict
	}
	return consumeCurrentSubscriptionProviderLifecycleReservationTx(tx, contractID, reservation, true)
}

func consumeCurrentSubscriptionProviderLifecycleReservationTx(tx *gorm.DB, contractID int64, reservation *SubscriptionProviderLifecycleReservation, allowNeedsAttention bool) error {
	if tx == nil || contractID <= 0 || reservation == nil {
		return errors.New("invalid subscription provider lifecycle reservation target")
	}
	var binding SubscriptionProviderBinding
	if err := lockQuery(tx).Where("id = ?", reservation.BindingId).First(&binding).Error; err != nil {
		return err
	}
	var contract UserSubscriptionContract
	if err := lockQuery(tx).Where("id = ?", contractID).First(&contract).Error; err != nil {
		return err
	}
	contractStatusAllowed := contract.Status == SubscriptionContractStatusActive ||
		contract.Status == SubscriptionContractStatusGrace ||
		(allowNeedsAttention && contract.Status == SubscriptionContractStatusNeedsAttention)
	if !contractStatusAllowed ||
		contract.PaymentMode != SubscriptionPaymentModeStripeRecurring ||
		contract.CurrentProviderBindingId != reservation.BindingId {
		return ErrSubscriptionProviderLifecycleConflict
	}
	if reservation.UserId <= 0 || reservation.UserId != binding.UserId ||
		reservation.ContractId <= 0 || reservation.ContractId != contract.Id ||
		binding.UserId != contract.UserId ||
		binding.ContractId != contract.Id ||
		binding.Provider != PaymentProviderStripe ||
		strings.TrimSpace(binding.ProviderSubscriptionId) != strings.TrimSpace(reservation.ProviderSubscriptionId) ||
		binding.EndedAt > 0 || isTerminalProviderSubscriptionStatus(binding.ProviderStatus) {
		return ErrSubscriptionProviderLifecycleConflict
	}
	if err := consumeSubscriptionProviderLifecycleReservationTx(tx, reservation); err != nil {
		if !errors.Is(err, ErrSubscriptionProviderLifecycleConflict) {
			return err
		}
		return ensureSubscriptionProviderLifecycleReservationConsumedTx(tx, reservation)
	}
	return nil
}

func ensureSubscriptionProviderLifecycleReservationConsumedTx(tx *gorm.DB, reservation *SubscriptionProviderLifecycleReservation) error {
	if tx == nil || reservation == nil {
		return errors.New("invalid subscription provider lifecycle reservation")
	}
	var binding SubscriptionProviderBinding
	if err := lockQuery(tx).Where(
		"id = ? AND provider_subscription_id = ?",
		reservation.BindingId,
		strings.TrimSpace(reservation.ProviderSubscriptionId),
	).First(&binding).Error; err != nil {
		return err
	}
	if binding.LifecycleActionSeq != reservation.LifecycleActionSeq ||
		reservation.UserId <= 0 ||
		reservation.UserId != binding.UserId ||
		reservation.ContractId != binding.ContractId ||
		strings.TrimSpace(binding.LifecycleReservationToken) != strings.TrimSpace(reservation.Token) ||
		strings.TrimSpace(binding.LifecycleReservationAction) != strings.TrimSpace(reservation.Action) ||
		binding.LifecycleReservationUntil != 0 {
		return ErrSubscriptionProviderLifecycleConflict
	}
	return nil
}

func GetActiveSubscriptionProviderLifecycleReservation(bindingID int64, action string) (*SubscriptionProviderLifecycleReservation, error) {
	reservation, err := GetSubscriptionProviderLifecycleReservation(bindingID, action)
	if err != nil {
		return nil, err
	}
	now, err := getDBTimestampTxStrict(DB)
	if err != nil {
		return nil, err
	}
	if reservation.ExpiresAt <= now {
		return nil, ErrSubscriptionProviderLifecycleConflict
	}
	return reservation, nil
}

func GetSubscriptionProviderLifecycleReservation(bindingID int64, action string) (*SubscriptionProviderLifecycleReservation, error) {
	if bindingID <= 0 {
		return nil, errors.New("invalid binding id")
	}
	action = strings.ToLower(strings.TrimSpace(action))
	var binding SubscriptionProviderBinding
	if err := DB.Where("id = ?", bindingID).First(&binding).Error; err != nil {
		return nil, err
	}
	if action != "" && strings.ToLower(strings.TrimSpace(binding.LifecycleReservationAction)) != action {
		return nil, ErrSubscriptionProviderLifecycleConflict
	}
	reservation := subscriptionProviderLifecycleReservationFromBinding(&binding)
	if reservation == nil {
		return nil, ErrSubscriptionProviderLifecycleConflict
	}
	return reservation, nil
}

func EnsureNoActiveSubscriptionProviderLifecycleReservationTx(tx *gorm.DB, bindingID int64) error {
	if tx == nil {
		return errors.New("tx is nil")
	}
	if bindingID <= 0 {
		return nil
	}
	var binding SubscriptionProviderBinding
	if err := lockQuery(tx).Where("id = ?", bindingID).First(&binding).Error; err != nil {
		return err
	}
	now, err := getDBTimestampTxStrict(tx)
	if err != nil {
		return err
	}
	if subscriptionProviderLifecycleReservationIsActive(&binding, now) {
		return ErrSubscriptionProviderLifecycleConflict
	}
	return nil
}

func subscriptionProviderLifecycleReservationIsActive(binding *SubscriptionProviderBinding, now int64) bool {
	return binding != nil &&
		strings.TrimSpace(binding.LifecycleReservationToken) != "" &&
		strings.TrimSpace(binding.LifecycleReservationAction) != "" &&
		binding.LifecycleReservationUntil > now
}

func subscriptionProviderLifecycleReservationMatches(binding *SubscriptionProviderBinding, reservation *SubscriptionProviderLifecycleReservation, now int64) bool {
	return subscriptionProviderLifecycleReservationFieldsMatch(binding, reservation) &&
		subscriptionProviderLifecycleReservationIsActive(binding, now)
}

func subscriptionProviderLifecycleReservationFieldsMatch(binding *SubscriptionProviderBinding, reservation *SubscriptionProviderLifecycleReservation) bool {
	// Expiry makes an exact lease reclaimable, not immediately invalid. This
	// lets an in-flight provider response finish until another owner replaces
	// the token/expiry; the full-field CAS rejects the old owner after reclaim.
	return binding != nil && reservation != nil &&
		reservation.BindingId == binding.Id &&
		strings.TrimSpace(reservation.ProviderSubscriptionId) == strings.TrimSpace(binding.ProviderSubscriptionId) &&
		strings.TrimSpace(reservation.Token) == strings.TrimSpace(binding.LifecycleReservationToken) &&
		strings.TrimSpace(reservation.Action) == strings.TrimSpace(binding.LifecycleReservationAction) &&
		reservation.UserId == binding.UserId &&
		reservation.ContractId == binding.ContractId &&
		reservation.LifecycleActionSeq == binding.LifecycleActionSeq &&
		reservation.ExpiresAt == binding.LifecycleReservationUntil
}

func subscriptionProviderLifecycleReservationFromBinding(binding *SubscriptionProviderBinding) *SubscriptionProviderLifecycleReservation {
	if binding == nil ||
		strings.TrimSpace(binding.ProviderSubscriptionId) == "" ||
		strings.TrimSpace(binding.LifecycleReservationToken) == "" ||
		strings.TrimSpace(binding.LifecycleReservationAction) == "" ||
		binding.LifecycleReservationUntil <= 0 {
		return nil
	}
	return &SubscriptionProviderLifecycleReservation{
		BindingId:              binding.Id,
		UserId:                 binding.UserId,
		ContractId:             binding.ContractId,
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		Token:                  binding.LifecycleReservationToken,
		Action:                 binding.LifecycleReservationAction,
		LifecycleActionSeq:     binding.LifecycleActionSeq,
		ExpiresAt:              binding.LifecycleReservationUntil,
	}
}
