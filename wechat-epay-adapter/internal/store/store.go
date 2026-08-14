package store

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/order"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/wechat"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PaymentOrder struct {
	ID                    string       `gorm:"primaryKey;size:36"`
	OutTradeNo            string       `gorm:"size:255;not null;uniqueIndex"`
	GatewayTradeNo        string       `gorm:"size:64;not null;uniqueIndex"`
	RequestFingerprint    string       `gorm:"size:64;not null"`
	EpayPID               string       `gorm:"size:64;not null"`
	PaymentType           string       `gorm:"size:16;not null"`
	Subject               string       `gorm:"size:128;not null"`
	AmountText            string       `gorm:"size:32;not null"`
	AmountFen             int64        `gorm:"not null"`
	NotifyURL             string       `gorm:"size:2048;not null"`
	ReturnURL             *string      `gorm:"size:2048"`
	CashierTokenHash      string       `gorm:"size:64;not null;uniqueIndex"`
	Status                order.Status `gorm:"size:32;not null;index:idx_payment_orders_status_expires_at,priority:1;index:idx_payment_orders_status_updated_at,priority:1"`
	WechatCodeURL         *string      `gorm:"type:text"`
	WechatTransactionID   *string      `gorm:"size:64;uniqueIndex"`
	WechatNotificationID  *string      `gorm:"size:64;uniqueIndex"`
	WechatPayerOpenIDHash *string      `gorm:"size:64"`
	ExpiresAt             time.Time    `gorm:"not null;index:idx_payment_orders_status_expires_at,priority:2"`
	PaidAt                *time.Time
	NotifiedAt            *time.Time
	LastErrorCode         *string   `gorm:"size:64"`
	LastErrorMessage      *string   `gorm:"size:512"`
	Version               int64     `gorm:"not null"`
	CreatedAt             time.Time `gorm:"index:idx_payment_orders_status_updated_at,priority:2"`
	UpdatedAt             time.Time
}

func (PaymentOrder) TableName() string { return "payment_orders" }

type NotificationTask struct {
	ID              string                  `gorm:"primaryKey;size:36"`
	OrderID         string                  `gorm:"size:36;not null;uniqueIndex"`
	State           order.NotificationState `gorm:"size:16;not null;index:idx_notification_tasks_state_next_attempt_at,priority:1;index:idx_notification_tasks_state_lease_until,priority:1"`
	PayloadSnapshot string                  `gorm:"type:text;not null"`
	AttemptCount    int                     `gorm:"not null"`
	NextAttemptAt   time.Time               `gorm:"not null;index:idx_notification_tasks_state_next_attempt_at,priority:2"`
	LeaseOwner      *string                 `gorm:"size:64"`
	LeaseUntil      *time.Time              `gorm:"index:idx_notification_tasks_state_lease_until,priority:2"`
	LastHTTPStatus  *int
	LastError       *string `gorm:"size:512"`
	CompletedAt     *time.Time
	Version         int64 `gorm:"not null"`
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

func (NotificationTask) TableName() string { return "notification_tasks" }

type PaymentAuditEvent struct {
	ID        string    `gorm:"primaryKey;size:36"`
	OrderID   *string   `gorm:"size:36;index"`
	EventType string    `gorm:"size:64;not null;index"`
	ActorType string    `gorm:"size:16;not null"`
	ActorID   *string   `gorm:"size:128"`
	RequestID *string   `gorm:"size:64;index"`
	Result    string    `gorm:"size:16;not null"`
	Metadata  *string   `gorm:"type:text"`
	CreatedAt time.Time `gorm:"not null;index"`
}

func (PaymentAuditEvent) TableName() string { return "payment_audit_events" }

type Store struct {
	db                 *gorm.DB
	confirmPaymentHook func() error
}

type CreatePaymentOrderInput struct {
	ID                 string
	OutTradeNo         string
	GatewayTradeNo     string
	RequestFingerprint string
	EpayPID            string
	PaymentType        string
	Subject            string
	AmountText         string
	AmountFen          int64
	NotifyURL          string
	ReturnURL          string
	CashierTokenHash   string
	ExpiresAt          time.Time
	RequestID          string
}

type CreatePaymentOrderResult struct {
	Order    PaymentOrder
	Existing bool
	Conflict bool
}

type ConfirmWechatPaymentInput struct {
	Notice           wechat.PaymentNotice
	ExpectedMerchant string
	ExpectedAppID    string
}

type ConfirmWechatPaymentResult struct {
	UnknownOrder bool
	Invalid      bool
	Idempotent   bool
}

type RetryNotificationTaskInput struct {
	OutTradeNo string
	Reason     string
	ActorID    string
	RequestID  string
	Now        time.Time
}

type RetryNotificationTaskResult struct {
	Order      PaymentOrder
	Task       *NotificationTask
	Resumed    bool
	NotAllowed bool
}

type StateCount struct {
	State string
	Count int64
}

func New(db *gorm.DB) *Store {
	return &Store{db: db}
}

func (s *Store) DB() *gorm.DB {
	return s.db
}

func (s *Store) Transaction(fn func(*Store) error) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		return fn(&Store{db: tx, confirmPaymentHook: s.confirmPaymentHook})
	})
}

func (s *Store) CreatePaymentOrder(input CreatePaymentOrderInput) (CreatePaymentOrderResult, error) {
	created := PaymentOrder{
		ID: input.ID, OutTradeNo: input.OutTradeNo, GatewayTradeNo: input.GatewayTradeNo,
		RequestFingerprint: input.RequestFingerprint, EpayPID: input.EpayPID, PaymentType: input.PaymentType,
		Subject: input.Subject, AmountText: input.AmountText, AmountFen: input.AmountFen, NotifyURL: input.NotifyURL,
		CashierTokenHash: input.CashierTokenHash, Status: order.StatusCreating, ExpiresAt: input.ExpiresAt, Version: 1,
	}
	if input.ReturnURL != "" {
		created.ReturnURL = &input.ReturnURL
	}
	if err := s.db.Create(&created).Error; err == nil {
		return CreatePaymentOrderResult{Order: created}, nil
	}

	var existing PaymentOrder
	if err := s.db.Where("out_trade_no = ?", input.OutTradeNo).First(&existing).Error; err != nil {
		return CreatePaymentOrderResult{}, err
	}
	if existing.RequestFingerprint == input.RequestFingerprint {
		return CreatePaymentOrderResult{Order: existing, Existing: true}, nil
	}
	requestID := input.RequestID
	metadata := "out_trade_no conflict"
	_ = s.db.Create(&PaymentAuditEvent{
		ID: input.ID, OrderID: &existing.ID, EventType: "ORDER_CONFLICT", ActorType: "SYSTEM",
		RequestID: &requestID, Result: "REJECTED", Metadata: &metadata, CreatedAt: time.Now().UTC(),
	}).Error
	return CreatePaymentOrderResult{Order: existing, Existing: true, Conflict: true}, nil
}

func (s *Store) FindPaymentOrderByCashierTokenHash(tokenHash string) (PaymentOrder, error) {
	var paymentOrder PaymentOrder
	err := s.db.Where("cashier_token_hash = ?", tokenHash).First(&paymentOrder).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return PaymentOrder{}, gorm.ErrRecordNotFound
	}
	return paymentOrder, err
}

func (s *Store) FindPaymentOrderWithNotificationTask(outTradeNo string) (PaymentOrder, *NotificationTask, error) {
	var paymentOrder PaymentOrder
	if err := s.db.Where("out_trade_no = ?", outTradeNo).First(&paymentOrder).Error; err != nil {
		return PaymentOrder{}, nil, err
	}
	var task NotificationTask
	if err := s.db.Where("order_id = ?", paymentOrder.ID).First(&task).Error; errors.Is(err, gorm.ErrRecordNotFound) {
		return paymentOrder, nil, nil
	} else if err != nil {
		return PaymentOrder{}, nil, err
	}
	return paymentOrder, &task, nil
}

func (s *Store) ReadinessProbe() error {
	if err := s.db.Exec("SELECT 1").Error; err != nil {
		return err
	}
	probeRollback := errors.New("readiness probe rollback")
	err := s.db.Transaction(func(tx *gorm.DB) error {
		metadata := "readiness probe"
		if err := tx.Create(&PaymentAuditEvent{
			ID: uuid.NewString(), EventType: "READINESS_PROBE", ActorType: "SYSTEM", Result: "SUCCESS", Metadata: &metadata, CreatedAt: time.Now().UTC(),
		}).Error; err != nil {
			return err
		}
		return probeRollback
	})
	if errors.Is(err, probeRollback) {
		return nil
	}
	return err
}

func (s *Store) StateCounts() ([]StateCount, []StateCount, error) {
	orderCounts := make([]StateCount, 0)
	if err := s.db.Model(&PaymentOrder{}).Select("status AS state, COUNT(*) AS count").Group("status").Scan(&orderCounts).Error; err != nil {
		return nil, nil, err
	}
	taskCounts := make([]StateCount, 0)
	if err := s.db.Model(&NotificationTask{}).Select("state AS state, COUNT(*) AS count").Group("state").Scan(&taskCounts).Error; err != nil {
		return nil, nil, err
	}
	return orderCounts, taskCounts, nil
}

func (s *Store) RetryNotificationTask(input RetryNotificationTaskInput) (RetryNotificationTaskResult, error) {
	result := RetryNotificationTaskResult{}
	err := s.Transaction(func(tx *Store) error {
		var paymentOrder PaymentOrder
		if err := lockForUpdate(tx.db).Where("out_trade_no = ?", input.OutTradeNo).First(&paymentOrder).Error; err != nil {
			return err
		}
		result.Order = paymentOrder
		var task NotificationTask
		if err := lockForUpdate(tx.db).Where("order_id = ?", paymentOrder.ID).First(&task).Error; errors.Is(err, gorm.ErrRecordNotFound) {
			result.NotAllowed = true
			return tx.createAdminRetryAudit(paymentOrder.ID, input, "REJECTED", "notification task is unavailable")
		} else if err != nil {
			return err
		}
		result.Task = &task
		if paymentOrder.Status == order.StatusNotified {
			return tx.createAdminRetryAudit(paymentOrder.ID, input, "REJECTED", "order notification already succeeded")
		}
		if paymentOrder.Status != order.StatusPaidPendingNotify || (task.State != order.NotificationRetry && task.State != order.NotificationDead) {
			result.NotAllowed = true
			return tx.createAdminRetryAudit(paymentOrder.ID, input, "REJECTED", "order or notification task is not retryable")
		}
		updates := map[string]any{
			"state": order.NotificationPending, "next_attempt_at": input.Now, "lease_owner": nil, "lease_until": nil,
			"completed_at": nil, "version": task.Version + 1,
		}
		write := tx.db.Model(&NotificationTask{}).Where("id = ? AND state = ? AND version = ?", task.ID, task.State, task.Version).Updates(updates)
		if write.Error != nil {
			return write.Error
		}
		if write.RowsAffected != 1 {
			return errors.New("notification task changed while restarting")
		}
		task.State = order.NotificationPending
		task.NextAttemptAt = input.Now
		task.LeaseOwner = nil
		task.LeaseUntil = nil
		task.CompletedAt = nil
		task.Version++
		result.Task = &task
		result.Resumed = true
		return tx.createAdminRetryAudit(paymentOrder.ID, input, "SUCCESS", "notification task restarted")
	})
	return result, err
}

func (s *Store) createAdminRetryAudit(orderID string, input RetryNotificationTaskInput, result, outcome string) error {
	actorID := input.ActorID
	requestID := input.RequestID
	metadata := "reason=" + input.Reason + "; outcome=" + outcome
	return s.db.Create(&PaymentAuditEvent{
		ID: uuid.NewString(), OrderID: &orderID, EventType: "ADMIN_NOTIFICATION_RETRY", ActorType: "ADMIN", ActorID: &actorID,
		RequestID: &requestID, Result: result, Metadata: &metadata, CreatedAt: input.Now,
	}).Error
}

func (s *Store) ConfirmWechatPayment(input ConfirmWechatPaymentInput) (ConfirmWechatPaymentResult, error) {
	result := ConfirmWechatPaymentResult{}
	err := s.Transaction(func(tx *Store) error {
		var paymentOrder PaymentOrder
		err := lockForUpdate(tx.db).Where("out_trade_no = ?", input.Notice.MerchantOrderNo).First(&paymentOrder).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			result.UnknownOrder = true
			metadata := "unknown WeChat merchant order"
			return tx.db.Create(&PaymentAuditEvent{
				ID: uuid.NewString(), EventType: "WECHAT_UNKNOWN_ORDER", ActorType: "WECHAT", Result: "REJECTED", Metadata: &metadata, CreatedAt: time.Now().UTC(),
			}).Error
		}
		if err != nil {
			return err
		}
		if input.Notice.TradeState != wechat.TradeStateSuccess || input.Notice.MerchantID != input.ExpectedMerchant || input.Notice.AppID != input.ExpectedAppID || input.Notice.AmountFen != paymentOrder.AmountFen || input.Notice.Currency != wechat.CurrencyCNY || input.Notice.WechatOrderNo == "" || input.Notice.NotificationID == "" {
			return tx.markManualReview(&paymentOrder, "WECHAT_NOTICE_MISMATCH", "WeChat notice does not match the local order")
		}
		if order.IsPaid(paymentOrder.Status) {
			if paymentOrder.WechatTransactionID != nil && *paymentOrder.WechatTransactionID == input.Notice.WechatOrderNo {
				result.Idempotent = true
				return nil
			}
			return tx.markManualReview(&paymentOrder, "WECHAT_TRANSACTION_CONFLICT", "WeChat transaction conflicts with an already paid order")
		}
		if paymentOrder.Status != order.StatusPayable && paymentOrder.Status != order.StatusCreateUnknown {
			return tx.markManualReview(&paymentOrder, "WECHAT_UNEXPECTED_ORDER_STATE", "WeChat payment arrived in an unexpected order state")
		}
		if err := order.ValidateTransition(paymentOrder.Status, order.StatusPaidPendingNotify); err != nil {
			return err
		}
		notificationID := input.Notice.NotificationID
		transactionID := input.Notice.WechatOrderNo
		paidAt := input.Notice.PaidAt.UTC()
		updates := map[string]any{
			"status":                 order.StatusPaidPendingNotify,
			"wechat_transaction_id":  &transactionID,
			"wechat_notification_id": &notificationID,
			"paid_at":                &paidAt,
			"last_error_code":        nil,
			"last_error_message":     nil,
			"version":                paymentOrder.Version + 1,
		}
		write := tx.db.Model(&PaymentOrder{}).Where("id = ? AND status = ? AND version = ?", paymentOrder.ID, paymentOrder.Status, paymentOrder.Version).Updates(updates)
		if write.Error != nil {
			return write.Error
		}
		if write.RowsAffected != 1 {
			return errors.New("payment order changed while confirming WeChat payment")
		}
		payload, err := json.Marshal(NotificationPayload{
			PartnerID: paymentOrder.EpayPID, PaymentType: paymentOrder.PaymentType, MerchantOrderNo: paymentOrder.OutTradeNo,
			GatewayTradeNo: paymentOrder.GatewayTradeNo, Subject: paymentOrder.Subject, AmountText: paymentOrder.AmountText,
		})
		if err != nil {
			return err
		}
		if tx.confirmPaymentHook != nil {
			if err := tx.confirmPaymentHook(); err != nil {
				return err
			}
		}
		now := time.Now().UTC()
		if err := tx.db.Create(&NotificationTask{ID: uuid.NewString(), OrderID: paymentOrder.ID, State: order.NotificationPending, PayloadSnapshot: string(payload), NextAttemptAt: now, Version: 1}).Error; err != nil {
			return err
		}
		orderID := paymentOrder.ID
		metadata := "wechat payment confirmed"
		return tx.db.Create(&PaymentAuditEvent{ID: uuid.NewString(), OrderID: &orderID, EventType: "WECHAT_PAYMENT_CONFIRMED", ActorType: "WECHAT", Result: "SUCCESS", Metadata: &metadata, CreatedAt: now}).Error
	})
	return result, err
}

func (s *Store) markManualReview(paymentOrder *PaymentOrder, code, message string) error {
	if paymentOrder.Status != order.StatusManualReview {
		if err := order.ValidateTransition(paymentOrder.Status, order.StatusManualReview); err != nil {
			return err
		}
		updates := map[string]any{"status": order.StatusManualReview, "last_error_code": code, "last_error_message": message, "version": paymentOrder.Version + 1}
		write := s.db.Model(&PaymentOrder{}).Where("id = ? AND status = ? AND version = ?", paymentOrder.ID, paymentOrder.Status, paymentOrder.Version).Updates(updates)
		if write.Error != nil {
			return write.Error
		}
		if write.RowsAffected != 1 {
			return errors.New("payment order changed while moving to manual review")
		}
	}
	orderID := paymentOrder.ID
	return s.db.Create(&PaymentAuditEvent{ID: uuid.NewString(), OrderID: &orderID, EventType: "WECHAT_NOTICE_REVIEW", ActorType: "WECHAT", Result: "REJECTED", CreatedAt: time.Now().UTC()}).Error
}

// NotificationPayload is the immutable Epay callback input captured with the payment fact.
type NotificationPayload struct {
	PartnerID       string `json:"pid"`
	PaymentType     string `json:"type"`
	MerchantOrderNo string `json:"out_trade_no"`
	GatewayTradeNo  string `json:"trade_no"`
	Subject         string `json:"name"`
	AmountText      string `json:"money"`
}

type ClaimedNotificationTask struct {
	NotificationTask
	LeaseOwner string
}

func (s *Store) ClaimNotificationTask(now time.Time, leaseOwner string, leaseDuration time.Duration) (ClaimedNotificationTask, bool, error) {
	var claimed ClaimedNotificationTask
	err := s.Transaction(func(tx *Store) error {
		var task NotificationTask
		query := lockForUpdate(tx.db).Where("(state IN ? AND next_attempt_at <= ?) OR (state = ? AND lease_until <= ?)", []order.NotificationState{order.NotificationPending, order.NotificationRetry}, now, order.NotificationProcessing, now).Order("next_attempt_at ASC, created_at ASC")
		err := query.First(&task).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		leaseUntil := now.Add(leaseDuration)
		write := tx.db.Model(&NotificationTask{}).Where("id = ? AND version = ?", task.ID, task.Version).Updates(map[string]any{
			"state": order.NotificationProcessing, "lease_owner": leaseOwner, "lease_until": leaseUntil,
			"attempt_count": task.AttemptCount + 1, "version": task.Version + 1,
		})
		if write.Error != nil {
			return write.Error
		}
		if write.RowsAffected != 1 {
			return errors.New("notification task changed while claiming")
		}
		task.State = order.NotificationProcessing
		task.LeaseOwner = &leaseOwner
		task.LeaseUntil = &leaseUntil
		task.AttemptCount++
		task.Version++
		claimed = ClaimedNotificationTask{NotificationTask: task, LeaseOwner: leaseOwner}
		return nil
	})
	if err != nil {
		return ClaimedNotificationTask{}, false, err
	}
	return claimed, claimed.ID != "", nil
}

func (s *Store) CompleteNotificationTask(task ClaimedNotificationTask, now time.Time) error {
	return s.Transaction(func(tx *Store) error {
		var currentTask NotificationTask
		if err := lockForUpdate(tx.db).First(&currentTask, "id = ?", task.ID).Error; err != nil {
			return err
		}
		if currentTask.State != order.NotificationProcessing || currentTask.LeaseOwner == nil || *currentTask.LeaseOwner != task.LeaseOwner || currentTask.Version != task.Version {
			return errors.New("notification task lease is no longer owned")
		}
		var paymentOrder PaymentOrder
		if err := lockForUpdate(tx.db).First(&paymentOrder, "id = ?", currentTask.OrderID).Error; err != nil {
			return err
		}
		if paymentOrder.Status != order.StatusPaidPendingNotify {
			return errors.New("payment order is not pending notification")
		}
		if err := order.ValidateTransition(paymentOrder.Status, order.StatusNotified); err != nil {
			return err
		}
		if write := tx.db.Model(&NotificationTask{}).Where("id = ? AND state = ? AND version = ?", currentTask.ID, order.NotificationProcessing, currentTask.Version).Updates(map[string]any{
			"state": order.NotificationSucceeded, "lease_owner": nil, "lease_until": nil, "completed_at": now, "last_error": nil, "version": currentTask.Version + 1,
		}); write.Error != nil {
			return write.Error
		} else if write.RowsAffected != 1 {
			return errors.New("notification task changed while completing")
		}
		if write := tx.db.Model(&PaymentOrder{}).Where("id = ? AND status = ? AND version = ?", paymentOrder.ID, order.StatusPaidPendingNotify, paymentOrder.Version).Updates(map[string]any{
			"status": order.StatusNotified, "notified_at": now, "version": paymentOrder.Version + 1,
		}); write.Error != nil {
			return write.Error
		} else if write.RowsAffected != 1 {
			return errors.New("payment order changed while completing notification")
		}
		orderID := paymentOrder.ID
		metadata := "new-api notification accepted"
		return tx.db.Create(&PaymentAuditEvent{ID: uuid.NewString(), OrderID: &orderID, EventType: "EPAY_NOTIFICATION_SUCCEEDED", ActorType: "SYSTEM", Result: "SUCCESS", Metadata: &metadata, CreatedAt: now}).Error
	})
}

func (s *Store) RescheduleNotificationTask(task ClaimedNotificationTask, now time.Time, nextAttemptAt time.Time, failure string, statusCode *int, dead bool) error {
	return s.Transaction(func(tx *Store) error {
		state := order.NotificationRetry
		if dead {
			state = order.NotificationDead
		}
		write := tx.db.Model(&NotificationTask{}).Where("id = ? AND state = ? AND version = ? AND lease_owner = ?", task.ID, order.NotificationProcessing, task.Version, task.LeaseOwner).Updates(map[string]any{
			"state": state, "lease_owner": nil, "lease_until": nil, "next_attempt_at": nextAttemptAt, "last_error": failure, "last_http_status": statusCode, "version": task.Version + 1,
		})
		if write.Error != nil {
			return write.Error
		}
		if write.RowsAffected != 1 {
			return errors.New("notification task lease is no longer owned")
		}
		return nil
	})
}

func (s *Store) UpdateNativeOrder(record order.NativeOrderRecord, update order.NativeOrderUpdate) (bool, error) {
	if err := order.ValidateTransition(record.Status, update.Status); err != nil {
		return false, err
	}
	updates := map[string]any{
		"status":             update.Status,
		"version":            record.Version + 1,
		"wechat_code_url":    update.CodeURL,
		"last_error_code":    update.ErrorCode,
		"last_error_message": update.ErrorMessage,
	}
	result := s.db.Model(&PaymentOrder{}).
		Where("id = ? AND status = ? AND version = ?", record.ID, record.Status, record.Version).
		Updates(updates)
	return result.RowsAffected == 1, result.Error
}

func (s *Store) ExpirePayableOrders(now time.Time) (int64, error) {
	result := s.db.Model(&PaymentOrder{}).
		Where("status = ? AND expires_at <= ?", order.StatusPayable, now).
		Updates(map[string]any{"status": order.StatusExpired, "version": gorm.Expr("version + ?", 1)})
	return result.RowsAffected, result.Error
}

func (s *Store) FindCreateUnknownOrders(limit int) ([]order.NativeOrderRecord, error) {
	if limit < 1 {
		return nil, errors.New("create unknown order scan limit must be positive")
	}
	var paymentOrders []PaymentOrder
	if err := s.db.Where("status = ?", order.StatusCreateUnknown).Order("created_at ASC").Limit(limit).Find(&paymentOrders).Error; err != nil {
		return nil, err
	}
	records := make([]order.NativeOrderRecord, 0, len(paymentOrders))
	for _, paymentOrder := range paymentOrders {
		records = append(records, order.NativeOrderRecord{
			ID: paymentOrder.ID, OutTradeNo: paymentOrder.OutTradeNo, Subject: paymentOrder.Subject, AmountFen: paymentOrder.AmountFen,
			NotifyURL: paymentOrder.NotifyURL, ExpiresAt: paymentOrder.ExpiresAt, Status: paymentOrder.Status,
			Version: paymentOrder.Version, CreatedAt: paymentOrder.CreatedAt,
		})
	}
	return records, nil
}

func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(&PaymentOrder{}, &NotificationTask{}, &PaymentAuditEvent{})
}

// lockForUpdate emits row locks only on dialects that support the syntax.
func lockForUpdate(tx *gorm.DB) *gorm.DB {
	if tx.Dialector.Name() == "sqlite" {
		return tx
	}
	return tx.Clauses(clause.Locking{Strength: "UPDATE"})
}
