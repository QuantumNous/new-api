package admin

import (
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/order"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/store"
	"gorm.io/gorm"
)

var ErrRetryNotAllowed = errors.New("notification retry is not allowed for this order")

type OrderView struct {
	Order                 store.PaymentOrder
	NotificationTask      *store.NotificationTask
	WechatTransactionMask string
	LastError             string
}

type RetryResult struct {
	OrderView
	Resumed bool
}

type Service struct {
	store *store.Store
	now   func() time.Time
}

func New(database *store.Store) *Service {
	return &Service{store: database, now: func() time.Time { return time.Now().UTC() }}
}

func (s *Service) GetOrder(outTradeNo string) (OrderView, error) {
	paymentOrder, task, err := s.store.FindPaymentOrderWithNotificationTask(outTradeNo)
	if err != nil {
		return OrderView{}, err
	}
	return newOrderView(paymentOrder, task), nil
}

func (s *Service) RetryNotification(outTradeNo, reason, actorID, requestID string) (RetryResult, error) {
	result, err := s.store.RetryNotificationTask(store.RetryNotificationTaskInput{
		OutTradeNo: outTradeNo,
		Reason:     reason,
		ActorID:    actorID,
		RequestID:  requestID,
		Now:        s.now(),
	})
	if err != nil {
		return RetryResult{}, err
	}
	view := newOrderView(result.Order, result.Task)
	if result.NotAllowed {
		return RetryResult{OrderView: view}, ErrRetryNotAllowed
	}
	return RetryResult{OrderView: view, Resumed: result.Resumed}, nil
}

func newOrderView(paymentOrder store.PaymentOrder, task *store.NotificationTask) OrderView {
	view := OrderView{Order: paymentOrder, NotificationTask: task}
	if paymentOrder.WechatTransactionID != nil {
		view.WechatTransactionMask = maskIdentifier(*paymentOrder.WechatTransactionID)
	}
	if task != nil && task.LastError != nil {
		view.LastError = maskError(*task.LastError)
	}
	return view
}

func maskIdentifier(value string) string {
	if value == "" {
		return ""
	}
	if len(value) <= 4 {
		return "****"
	}
	return "****" + value[len(value)-4:]
}

func maskError(value string) string {
	value = strings.Map(func(r rune) rune {
		if r < 32 || r == 127 {
			return -1
		}
		return r
	}, value)
	if len(value) > 256 {
		return value[:256]
	}
	return value
}

func IsNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}

func IsRetryNotAllowed(err error) bool {
	return errors.Is(err, ErrRetryNotAllowed)
}

func IsPaidPendingNotification(paymentOrder store.PaymentOrder) bool {
	return paymentOrder.Status == order.StatusPaidPendingNotify
}
