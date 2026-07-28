package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestConsumeCurrentSubscriptionProviderLifecycleReservationAllowsExpiredExactOwner(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	const (
		userID     = 9260
		planID     = 9360
		contractID = int64(9460)
		bindingID  = int64(9560)
	)
	createEntitlementTestUser(t, userID, "default")
	createEntitlementTestPlan(t, planID, 100, "")
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:                       contractID,
		UserId:                   userID,
		Status:                   SubscriptionContractStatusActive,
		PaymentMode:              SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            planID,
		CurrentProviderBindingId: bindingID,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 userID,
		PlanId:                 planID,
		ContractId:             contractID,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "sub_expired_exact_owner",
		ProviderStatus:         "active",
	}).Error)
	reservation, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"sub_expired_exact_owner",
		0,
		SubscriptionProviderLifecycleActionCancel,
		"expired-exact-owner-token",
		300,
	)
	require.NoError(t, err)
	expiredAt := GetDBTimestamp() - 10
	require.NoError(t, DB.Model(&SubscriptionProviderBinding{}).Where("id = ?", bindingID).
		Update("lifecycle_reservation_until", expiredAt).Error)
	reservation.ExpiresAt = expiredAt

	err = DB.Transaction(func(tx *gorm.DB) error {
		return ConsumeCurrentSubscriptionProviderLifecycleReservationTx(tx, contractID, reservation)
	})

	require.NoError(t, err)
	var binding SubscriptionProviderBinding
	require.NoError(t, DB.First(&binding, bindingID).Error)
	require.Equal(t, reservation.Token, binding.LifecycleReservationToken)
	require.Equal(t, reservation.Action, binding.LifecycleReservationAction)
	require.Zero(t, binding.LifecycleReservationUntil)
}

func TestReleaseSubscriptionProviderLifecycleReservationRejectsTerminalBindingWithoutClearingFence(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	const (
		userID     = 9268
		planID     = 9368
		contractID = int64(9468)
		bindingID  = int64(9568)
	)
	createEntitlementTestUser(t, userID, "default")
	createEntitlementTestPlan(t, planID, 100, "")
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:                       contractID,
		UserId:                   userID,
		Status:                   SubscriptionContractStatusActive,
		PaymentMode:              SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            planID,
		CurrentProviderBindingId: bindingID,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 userID,
		PlanId:                 planID,
		ContractId:             contractID,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "sub_release_terminal",
		ProviderStatus:         "active",
	}).Error)
	reservation, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"sub_release_terminal",
		0,
		SubscriptionProviderLifecycleActionCancel,
		"release-terminal-token",
		300,
	)
	require.NoError(t, err)
	require.NoError(t, DB.Model(&SubscriptionProviderBinding{}).Where("id = ?", bindingID).
		Updates(map[string]interface{}{
			"provider_status": "canceled",
			"ended_at":        GetDBTimestamp(),
		}).Error)

	err = ReleaseSubscriptionProviderLifecycleReservation(reservation)

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
	var binding SubscriptionProviderBinding
	require.NoError(t, DB.First(&binding, bindingID).Error)
	require.Equal(t, reservation.Token, binding.LifecycleReservationToken)
	require.Equal(t, reservation.Action, binding.LifecycleReservationAction)
	require.Equal(t, reservation.ExpiresAt, binding.LifecycleReservationUntil)
	require.Equal(t, reservation.LifecycleActionSeq, binding.LifecycleActionSeq)
}

func TestConsumeCurrentSubscriptionProviderLifecycleReservationRejectsExpiredOwnerAfterReclaim(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	const (
		userID     = 9261
		planID     = 9361
		contractID = int64(9461)
		bindingID  = int64(9561)
	)
	createEntitlementTestUser(t, userID, "default")
	createEntitlementTestPlan(t, planID, 100, "")
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:                       contractID,
		UserId:                   userID,
		Status:                   SubscriptionContractStatusActive,
		PaymentMode:              SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            planID,
		CurrentProviderBindingId: bindingID,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 userID,
		PlanId:                 planID,
		ContractId:             contractID,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "sub_reclaimed_old_owner",
		ProviderStatus:         "active",
	}).Error)
	original, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"sub_reclaimed_old_owner",
		0,
		SubscriptionProviderLifecycleActionCancel,
		"original-owner-token",
		300,
	)
	require.NoError(t, err)
	require.NoError(t, DB.Model(&SubscriptionProviderBinding{}).Where("id = ?", bindingID).
		Update("lifecycle_reservation_until", GetDBTimestamp()-10).Error)
	reclaimed, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"sub_reclaimed_old_owner",
		original.LifecycleActionSeq,
		SubscriptionProviderLifecycleActionCancel,
		"reclaimed-owner-token",
		600,
	)
	require.NoError(t, err)
	require.NotEqual(t, original.Token, reclaimed.Token)
	require.NotEqual(t, original.ExpiresAt, reclaimed.ExpiresAt)

	err = DB.Transaction(func(tx *gorm.DB) error {
		return ConsumeCurrentSubscriptionProviderLifecycleReservationTx(tx, contractID, original)
	})

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
	var binding SubscriptionProviderBinding
	require.NoError(t, DB.First(&binding, bindingID).Error)
	require.Equal(t, reclaimed.Token, binding.LifecycleReservationToken)
}

func TestConsumeCurrentSubscriptionProviderLifecycleReservationRejectsReclaimedOwnerAfterReplacementConsumed(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	const (
		userID     = 9267
		planID     = 9367
		contractID = int64(9467)
		bindingID  = int64(9567)
	)
	createEntitlementTestUser(t, userID, "default")
	createEntitlementTestPlan(t, planID, 100, "")
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:                       contractID,
		UserId:                   userID,
		Status:                   SubscriptionContractStatusActive,
		PaymentMode:              SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            planID,
		CurrentProviderBindingId: bindingID,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 userID,
		PlanId:                 planID,
		ContractId:             contractID,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "sub_reclaimed_consumed_old_owner",
		ProviderStatus:         "active",
	}).Error)
	original, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"sub_reclaimed_consumed_old_owner",
		0,
		SubscriptionProviderLifecycleActionCancel,
		"reclaimed-consumed-original-token",
		300,
	)
	require.NoError(t, err)
	expiredAt := GetDBTimestamp() - 10
	require.NoError(t, DB.Model(&SubscriptionProviderBinding{}).Where("id = ?", bindingID).
		Update("lifecycle_reservation_until", expiredAt).Error)
	original.ExpiresAt = expiredAt
	replacement, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"sub_reclaimed_consumed_old_owner",
		original.LifecycleActionSeq,
		SubscriptionProviderLifecycleActionCancel,
		"reclaimed-consumed-replacement-token",
		300,
	)
	require.NoError(t, err)
	require.Equal(t, original.LifecycleActionSeq, replacement.LifecycleActionSeq)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ConsumeCurrentSubscriptionProviderLifecycleReservationTx(tx, contractID, replacement)
	}))
	var consumed SubscriptionProviderBinding
	require.NoError(t, DB.First(&consumed, bindingID).Error)
	require.Equal(t, replacement.Token, consumed.LifecycleReservationToken)
	require.Equal(t, replacement.Action, consumed.LifecycleReservationAction)
	require.Zero(t, consumed.LifecycleReservationUntil)

	err = DB.Transaction(func(tx *gorm.DB) error {
		return ConsumeCurrentSubscriptionProviderLifecycleReservationTx(tx, contractID, original)
	})

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
}

func TestReserveSubscriptionProviderLifecycleAdvancesSequenceAfterConsumedTombstone(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	const (
		userID     = 9268
		planID     = 9368
		contractID = int64(9468)
		bindingID  = int64(9568)
	)
	createEntitlementTestUser(t, userID, "default")
	createEntitlementTestPlan(t, planID, 100, "")
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:                       contractID,
		UserId:                   userID,
		Status:                   SubscriptionContractStatusActive,
		PaymentMode:              SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            planID,
		CurrentProviderBindingId: bindingID,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 userID,
		PlanId:                 planID,
		ContractId:             contractID,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "sub_consumed_tombstone_sequence",
		ProviderStatus:         "active",
	}).Error)
	first, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"sub_consumed_tombstone_sequence",
		0,
		SubscriptionProviderLifecycleActionCancel,
		"consumed-tombstone-first-token",
		300,
	)
	require.NoError(t, err)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ConsumeCurrentSubscriptionProviderLifecycleReservationTx(tx, contractID, first)
	}))

	second, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"sub_consumed_tombstone_sequence",
		first.LifecycleActionSeq,
		SubscriptionProviderLifecycleActionCancel,
		"consumed-tombstone-second-token",
		300,
	)

	require.NoError(t, err)
	require.Equal(t, first.LifecycleActionSeq+1, second.LifecycleActionSeq)
}

func TestGetSubscriptionProviderLifecycleReservationReturnsExpiredReservation(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	const (
		userID    = 9262
		planID    = 9362
		bindingID = int64(9562)
	)
	createEntitlementTestUser(t, userID, "default")
	createEntitlementTestPlan(t, planID, 100, "")
	expiredAt := GetDBTimestamp() - 30
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                         bindingID,
		UserId:                     userID,
		PlanId:                     planID,
		ContractId:                 0,
		Provider:                   PaymentProviderStripe,
		ProviderSubscriptionId:     "sub_read_expired_reservation",
		ProviderStatus:             "active",
		LifecycleActionSeq:         7,
		LifecycleReservationToken:  "read-expired-token",
		LifecycleReservationAction: SubscriptionProviderLifecycleActionResume,
		LifecycleReservationUntil:  expiredAt,
	}).Error)

	reservation, err := GetSubscriptionProviderLifecycleReservation(bindingID, SubscriptionProviderLifecycleActionResume)

	require.NoError(t, err)
	require.Equal(t, bindingID, reservation.BindingId)
	require.Equal(t, "sub_read_expired_reservation", reservation.ProviderSubscriptionId)
	require.Equal(t, "read-expired-token", reservation.Token)
	require.Equal(t, SubscriptionProviderLifecycleActionResume, reservation.Action)
	require.Equal(t, int64(7), reservation.LifecycleActionSeq)
	require.Equal(t, expiredAt, reservation.ExpiresAt)
	_, err = GetActiveSubscriptionProviderLifecycleReservation(bindingID, SubscriptionProviderLifecycleActionResume)
	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
}

func TestReserveSubscriptionProviderLifecycleRejectsNonStripeContractlessBinding(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	const (
		userID    = 9263
		planID    = 9363
		bindingID = int64(9563)
	)
	createEntitlementTestUser(t, userID, "default")
	createEntitlementTestPlan(t, planID, 100, "")
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 userID,
		PlanId:                 planID,
		ContractId:             0,
		Provider:               PaymentProviderCreem,
		ProviderSubscriptionId: "creem_contractless",
		ProviderStatus:         "active",
	}).Error)

	_, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"creem_contractless",
		0,
		SubscriptionProviderLifecycleActionCancel,
		"creem-contractless-token",
		300,
	)

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
}

func TestReserveSubscriptionProviderLifecycleAllowsStripeContractlessBinding(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	const (
		userID    = 9264
		planID    = 9364
		bindingID = int64(9564)
	)
	createEntitlementTestUser(t, userID, "default")
	createEntitlementTestPlan(t, planID, 100, "")
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 userID,
		PlanId:                 planID,
		ContractId:             0,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "stripe_contractless",
		ProviderStatus:         "active",
	}).Error)

	reservation, binding, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"stripe_contractless",
		0,
		SubscriptionProviderLifecycleActionCancel,
		"stripe-contractless-token",
		300,
	)

	require.NoError(t, err)
	require.Equal(t, bindingID, reservation.BindingId)
	require.Equal(t, PaymentProviderStripe, binding.Provider)
}

func TestReserveSubscriptionProviderLifecyclePropagatesDBTimestampError(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	withDBTimestampQueryFailure(t)
	const (
		userID    = 9271
		planID    = 9371
		bindingID = int64(9571)
	)
	createEntitlementTestUser(t, userID, "default")
	createEntitlementTestPlan(t, planID, 100, "")
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 userID,
		PlanId:                 planID,
		ContractId:             0,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "stripe_timestamp_failure",
		ProviderStatus:         "active",
	}).Error)

	reservation, binding, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"stripe_timestamp_failure",
		0,
		SubscriptionProviderLifecycleActionCancel,
		"timestamp-failure-token",
		300,
	)

	require.ErrorContains(t, err, "UNIX_TIMESTAMP")
	require.Nil(t, reservation)
	require.Nil(t, binding)
	var stored SubscriptionProviderBinding
	require.NoError(t, DB.First(&stored, bindingID).Error)
	require.Empty(t, stored.LifecycleReservationToken)
	require.Zero(t, stored.LifecycleReservationUntil)
}

func TestContractlessLifecycleReservationReleaseAndConsumeRequireExactOwner(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	const (
		userID    = 9270
		planID    = 9370
		bindingID = int64(9570)
	)
	createEntitlementTestUser(t, userID, "default")
	createEntitlementTestPlan(t, planID, 100, "")
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 userID,
		PlanId:                 planID,
		ContractId:             0,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "stripe_contractless_exact_owner",
		ProviderStatus:         "active",
	}).Error)
	reservation, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"stripe_contractless_exact_owner",
		0,
		SubscriptionProviderLifecycleActionCancel,
		"stripe-contractless-exact-owner-token",
		300,
	)
	require.NoError(t, err)
	require.Zero(t, reservation.ContractId)

	mismatches := []struct {
		name   string
		mutate func(*SubscriptionProviderLifecycleReservation)
	}{
		{name: "token", mutate: func(candidate *SubscriptionProviderLifecycleReservation) { candidate.Token = "foreign-token" }},
		{name: "user", mutate: func(candidate *SubscriptionProviderLifecycleReservation) { candidate.UserId++ }},
		{name: "provider subscription", mutate: func(candidate *SubscriptionProviderLifecycleReservation) {
			candidate.ProviderSubscriptionId = "foreign-subscription"
		}},
		{name: "expires", mutate: func(candidate *SubscriptionProviderLifecycleReservation) { candidate.ExpiresAt++ }},
		{name: "action", mutate: func(candidate *SubscriptionProviderLifecycleReservation) {
			candidate.Action = SubscriptionProviderLifecycleActionResume
		}},
		{name: "sequence", mutate: func(candidate *SubscriptionProviderLifecycleReservation) { candidate.LifecycleActionSeq++ }},
		{name: "contract", mutate: func(candidate *SubscriptionProviderLifecycleReservation) { candidate.ContractId = 9470 }},
	}
	for _, testCase := range mismatches {
		t.Run("release rejects "+testCase.name+" mismatch", func(t *testing.T) {
			candidate := *reservation
			testCase.mutate(&candidate)
			require.ErrorIs(t, ReleaseSubscriptionProviderLifecycleReservation(&candidate), ErrSubscriptionProviderLifecycleConflict)
		})
	}

	require.NoError(t, ReleaseSubscriptionProviderLifecycleReservation(reservation))
	var released SubscriptionProviderBinding
	require.NoError(t, DB.First(&released, bindingID).Error)
	require.Equal(t, reservation.LifecycleActionSeq+1, released.LifecycleActionSeq)
	require.Empty(t, released.LifecycleReservationToken)
	require.Empty(t, released.LifecycleReservationAction)
	require.Zero(t, released.LifecycleReservationUntil)

	consumeReservation, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"stripe_contractless_exact_owner",
		released.LifecycleActionSeq,
		SubscriptionProviderLifecycleActionCancel,
		"stripe-contractless-consume-token",
		300,
	)
	require.NoError(t, err)
	require.Zero(t, consumeReservation.ContractId)
	for _, testCase := range mismatches {
		t.Run("consume rejects "+testCase.name+" mismatch", func(t *testing.T) {
			candidate := *consumeReservation
			testCase.mutate(&candidate)
			err := DB.Transaction(func(tx *gorm.DB) error {
				return consumeSubscriptionProviderLifecycleReservationTx(tx, &candidate)
			})
			require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
		})
	}

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return consumeSubscriptionProviderLifecycleReservationTx(tx, consumeReservation)
	}))

	var consumed SubscriptionProviderBinding
	require.NoError(t, DB.First(&consumed, bindingID).Error)
	require.Equal(t, consumeReservation.LifecycleActionSeq, consumed.LifecycleActionSeq)
	require.Equal(t, consumeReservation.Token, consumed.LifecycleReservationToken)
	require.Equal(t, consumeReservation.Action, consumed.LifecycleReservationAction)
	require.Zero(t, consumed.LifecycleReservationUntil)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ensureSubscriptionProviderLifecycleReservationConsumedTx(tx, consumeReservation)
	}))

	foreignContract := *consumeReservation
	foreignContract.ContractId = 9470
	require.NoError(t, DB.Model(&SubscriptionProviderBinding{}).Where("id = ?", bindingID).Update("contract_id", foreignContract.ContractId).Error)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ensureSubscriptionProviderLifecycleReservationConsumedTx(tx, &foreignContract)
	}))
	require.ErrorIs(t, DB.Transaction(func(tx *gorm.DB) error {
		return ensureSubscriptionProviderLifecycleReservationConsumedTx(tx, consumeReservation)
	}), ErrSubscriptionProviderLifecycleConflict)
}

func TestReserveSubscriptionProviderLifecycleRejectsActiveSameTokenWithStaleExpectedSeq(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	const (
		userID    = 9265
		planID    = 9365
		bindingID = int64(9565)
	)
	createEntitlementTestUser(t, userID, "default")
	createEntitlementTestPlan(t, planID, 100, "")
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 userID,
		PlanId:                 planID,
		ContractId:             0,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "stripe_active_same_token_stale_seq",
		ProviderStatus:         "active",
	}).Error)

	_, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"stripe_active_same_token_stale_seq",
		0,
		SubscriptionProviderLifecycleActionCancel,
		"same-token-stale-seq",
		300,
	)
	require.NoError(t, err)

	_, _, err = ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"stripe_active_same_token_stale_seq",
		0,
		SubscriptionProviderLifecycleActionCancel,
		"same-token-stale-seq",
		300,
	)

	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
}

func TestReserveSubscriptionProviderLifecycleAllowsActiveSameTokenWithFreshExpectedSeq(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	const (
		userID    = 9266
		planID    = 9366
		bindingID = int64(9566)
	)
	createEntitlementTestUser(t, userID, "default")
	createEntitlementTestPlan(t, planID, 100, "")
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 userID,
		PlanId:                 planID,
		ContractId:             0,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "stripe_active_same_token_fresh_seq",
		ProviderStatus:         "active",
	}).Error)

	first, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"stripe_active_same_token_fresh_seq",
		0,
		SubscriptionProviderLifecycleActionResume,
		"same-token-fresh-seq",
		300,
	)
	require.NoError(t, err)

	retry, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"stripe_active_same_token_fresh_seq",
		first.LifecycleActionSeq,
		SubscriptionProviderLifecycleActionResume,
		"same-token-fresh-seq",
		300,
	)

	require.NoError(t, err)
	require.Equal(t, first.BindingId, retry.BindingId)
	require.Equal(t, first.ProviderSubscriptionId, retry.ProviderSubscriptionId)
	require.Equal(t, first.Token, retry.Token)
	require.Equal(t, first.Action, retry.Action)
	require.Equal(t, first.LifecycleActionSeq, retry.LifecycleActionSeq)
	require.Equal(t, first.ExpiresAt, retry.ExpiresAt)
}

func TestReserveSubscriptionProviderLifecycleUpdateSQLKeepsReservationOrGrouped(t *testing.T) {
	tx := DB.Session(&gorm.Session{DryRun: true}).Model(&SubscriptionProviderBinding{}).
		Where("id = ? AND user_id = ? AND provider_subscription_id = ? AND lifecycle_action_seq = ? AND ended_at = ? AND provider_status NOT IN ? AND (lifecycle_reservation_token = ? OR lifecycle_reservation_until <= ?)",
			int64(1),
			2,
			"sub_sql_grouping",
			int64(3),
			0,
			terminalProviderSubscriptionStatuses,
			"",
			int64(4),
		).
		Updates(map[string]interface{}{
			"lifecycle_action_seq":         int64(3),
			"lifecycle_reservation_token":  "sql-token",
			"lifecycle_reservation_action": SubscriptionProviderLifecycleActionCancel,
			"lifecycle_reservation_until":  int64(304),
		})
	require.NoError(t, tx.Error)
	sql := tx.Statement.SQL.String()
	require.Contains(t, sql, "provider_status NOT IN")
	require.Contains(t, sql, "(lifecycle_reservation_token = ? OR lifecycle_reservation_until <= ?)")
	require.False(t, strings.Contains(sql, "provider_status NOT IN ? AND lifecycle_reservation_token = ? OR lifecycle_reservation_until <= ?"))
}

func TestReserveSubscriptionProviderLifecycleRejectsExcessiveTTL(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	const (
		userID     = 9269
		planID     = 9369
		contractID = int64(9469)
		bindingID  = int64(9569)
	)
	createEntitlementTestUser(t, userID, "default")
	createEntitlementTestPlan(t, planID, 100, "")
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:                       contractID,
		UserId:                   userID,
		Status:                   SubscriptionContractStatusActive,
		PaymentMode:              SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            planID,
		CurrentProviderBindingId: bindingID,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 userID,
		PlanId:                 planID,
		ContractId:             contractID,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "sub_excessive_ttl",
		ProviderStatus:         "active",
	}).Error)

	reservation, binding, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"sub_excessive_ttl",
		0,
		SubscriptionProviderLifecycleActionCancel,
		"excessive-ttl-token",
		subscriptionProviderLifecycleReservationMaxTTLSeconds+1,
	)

	require.ErrorContains(t, err, "invalid subscription provider lifecycle reservation lease")
	require.Nil(t, reservation)
	require.Nil(t, binding)
	var stored SubscriptionProviderBinding
	require.NoError(t, DB.First(&stored, bindingID).Error)
	require.Empty(t, stored.LifecycleReservationToken)
	require.Zero(t, stored.LifecycleReservationUntil)
}

func TestConsumeCurrentSubscriptionProviderLifecycleReservationRejectsInvalidOwnership(t *testing.T) {
	testCases := []struct {
		name   string
		mutate func(t *testing.T, contractID int64, bindingID int64)
	}{
		{
			name: "ended contract",
			mutate: func(t *testing.T, contractID int64, bindingID int64) {
				require.NoError(t, DB.Model(&UserSubscriptionContract{}).Where("id = ?", contractID).
					Update("status", SubscriptionContractStatusEnded).Error)
			},
		},
		{
			name: "non recurring payment mode",
			mutate: func(t *testing.T, contractID int64, bindingID int64) {
				require.NoError(t, DB.Model(&UserSubscriptionContract{}).Where("id = ?", contractID).
					Update("payment_mode", SubscriptionPaymentModePrepaid).Error)
			},
		},
		{
			name: "binding user mismatch",
			mutate: func(t *testing.T, contractID int64, bindingID int64) {
				require.NoError(t, DB.Model(&SubscriptionProviderBinding{}).Where("id = ?", bindingID).
					Update("user_id", 9999).Error)
			},
		},
		{
			name: "binding contract mismatch",
			mutate: func(t *testing.T, contractID int64, bindingID int64) {
				require.NoError(t, DB.Model(&SubscriptionProviderBinding{}).Where("id = ?", bindingID).
					Update("contract_id", contractID+1).Error)
			},
		},
		{
			name: "binding provider mismatch",
			mutate: func(t *testing.T, contractID int64, bindingID int64) {
				require.NoError(t, DB.Model(&SubscriptionProviderBinding{}).Where("id = ?", bindingID).
					Update("provider", PaymentProviderCreem).Error)
			},
		},
	}
	for index, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			setupSubscriptionEntitlementTestDB(t)
			userID := 9200 + index
			planID := 9300 + index
			contractID := int64(9400 + index)
			bindingID := int64(9500 + index)
			createEntitlementTestUser(t, userID, "default")
			createEntitlementTestPlan(t, planID, 100, "")
			require.NoError(t, DB.Create(&UserSubscriptionContract{
				Id:                       contractID,
				UserId:                   userID,
				Status:                   SubscriptionContractStatusActive,
				PaymentMode:              SubscriptionPaymentModeStripeRecurring,
				CurrentPlanId:            planID,
				CurrentProviderBindingId: bindingID,
			}).Error)
			require.NoError(t, DB.Create(&SubscriptionProviderBinding{
				Id:                     bindingID,
				UserId:                 userID,
				PlanId:                 planID,
				ContractId:             contractID,
				Provider:               PaymentProviderStripe,
				ProviderSubscriptionId: "sub_consume_ownership_" + testCase.name,
				ProviderStatus:         "active",
			}).Error)
			reservation, _, err := ReserveSubscriptionProviderLifecycle(
				bindingID,
				userID,
				"sub_consume_ownership_"+testCase.name,
				0,
				SubscriptionProviderLifecycleActionCancel,
				"consume-ownership-token-"+testCase.name,
				300,
			)
			require.NoError(t, err)
			testCase.mutate(t, contractID, bindingID)

			err = DB.Transaction(func(tx *gorm.DB) error {
				return ConsumeCurrentSubscriptionProviderLifecycleReservationTx(tx, contractID, reservation)
			})

			require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
			var binding SubscriptionProviderBinding
			require.NoError(t, DB.First(&binding, bindingID).Error)
			require.Equal(t, reservation.Token, binding.LifecycleReservationToken)
		})
	}
}

func TestReleasedSubscriptionProviderLifecycleReservationCannotBeConsumed(t *testing.T) {
	setupSubscriptionEntitlementTestDB(t)
	const (
		userID     = 9250
		planID     = 9350
		contractID = int64(9450)
		bindingID  = int64(9550)
	)
	createEntitlementTestUser(t, userID, "default")
	createEntitlementTestPlan(t, planID, 100, "")
	require.NoError(t, DB.Create(&UserSubscriptionContract{
		Id:                       contractID,
		UserId:                   userID,
		Status:                   SubscriptionContractStatusActive,
		PaymentMode:              SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            planID,
		CurrentProviderBindingId: bindingID,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionProviderBinding{
		Id:                     bindingID,
		UserId:                 userID,
		PlanId:                 planID,
		ContractId:             contractID,
		Provider:               PaymentProviderStripe,
		ProviderSubscriptionId: "sub_released_reservation",
		ProviderStatus:         "active",
	}).Error)
	reservation, _, err := ReserveSubscriptionProviderLifecycle(
		bindingID,
		userID,
		"sub_released_reservation",
		0,
		SubscriptionProviderLifecycleActionCancel,
		"released-reservation-token",
		300,
	)
	require.NoError(t, err)
	require.NoError(t, ReleaseSubscriptionProviderLifecycleReservation(reservation))

	var released SubscriptionProviderBinding
	require.NoError(t, DB.First(&released, bindingID).Error)
	require.Greater(t, released.LifecycleActionSeq, reservation.LifecycleActionSeq)
	require.Empty(t, released.LifecycleReservationToken)
	require.Empty(t, released.LifecycleReservationAction)
	require.Zero(t, released.LifecycleReservationUntil)

	err = DB.Transaction(func(tx *gorm.DB) error {
		return ConsumeCurrentSubscriptionProviderLifecycleReservationTx(tx, contractID, reservation)
	})
	require.ErrorIs(t, err, ErrSubscriptionProviderLifecycleConflict)
}
