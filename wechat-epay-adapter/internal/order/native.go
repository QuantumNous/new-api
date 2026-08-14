package order

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/wechat"
)

const UnknownCreateObservationWindow = 15 * time.Minute

type NativeOrderRecord struct {
	ID         string
	OutTradeNo string
	Subject    string
	AmountFen  int64
	NotifyURL  string
	ExpiresAt  time.Time
	Status     Status
	Version    int64
	CreatedAt  time.Time
}

type NativeOrderUpdate struct {
	Status       Status
	CodeURL      *string
	ErrorCode    *string
	ErrorMessage *string
}

type NativeOrderRepository interface {
	UpdateNativeOrder(NativeOrderRecord, NativeOrderUpdate) (bool, error)
}

type NativeOrderService struct {
	repository NativeOrderRepository
	wechat     wechat.Client
	now        func() time.Time
}

func NewNativeOrderService(repository NativeOrderRepository, client wechat.Client) *NativeOrderService {
	return &NativeOrderService{repository: repository, wechat: client, now: func() time.Time { return time.Now().UTC() }}
}

func (service *NativeOrderService) Create(ctx context.Context, record NativeOrderRecord) error {
	if record.Status != StatusCreating {
		return nil
	}
	nativeOrder, err := service.wechat.CreateNativeOrder(ctx, wechat.NativeOrderRequest{
		MerchantOrderNo: record.OutTradeNo,
		Description:     record.Subject,
		AmountFen:       record.AmountFen,
		ExpireAt:        record.ExpiresAt,
		NotifyURL:       record.NotifyURL,
	})
	if err != nil {
		return service.persistFailure(record, err)
	}
	if err := ValidateCodeURL(nativeOrder.CodeURL); err != nil {
		return service.persistFailure(record, fmt.Errorf("%w: invalid code_url", wechat.ErrRequestRejected))
	}
	codeURL := nativeOrder.CodeURL
	_, err = service.repository.UpdateNativeOrder(record, NativeOrderUpdate{Status: StatusPayable, CodeURL: &codeURL})
	return err
}

func (service *NativeOrderService) RecoverUnknown(ctx context.Context, record NativeOrderRecord) error {
	if record.Status != StatusCreateUnknown {
		return nil
	}
	if !record.CreatedAt.IsZero() && !service.now().Before(record.CreatedAt.Add(UnknownCreateObservationWindow)) {
		_, err := service.repository.UpdateNativeOrder(record, NativeOrderUpdate{Status: StatusManualReview, ErrorCode: pointer("CREATE_UNKNOWN_TIMEOUT")})
		return err
	}
	query, err := service.wechat.QueryOrder(ctx, record.OutTradeNo)
	if err != nil {
		if errors.Is(err, wechat.ErrRequestRejected) {
			_, updateErr := service.repository.UpdateNativeOrder(record, NativeOrderUpdate{Status: StatusCreateFailed, ErrorCode: pointer("WECHAT_QUERY_REJECTED")})
			return updateErr
		}
		return nil
	}
	if query.MerchantOrderNo != record.OutTradeNo || query.AmountFen != record.AmountFen || query.Currency != wechat.CurrencyCNY {
		_, err := service.repository.UpdateNativeOrder(record, NativeOrderUpdate{Status: StatusManualReview, ErrorCode: pointer("WECHAT_QUERY_MISMATCH")})
		return err
	}
	// The official query response does not provide code_url. Keep observing until a
	// valid prepay result is available rather than claiming a payable QR code exists.
	return nil
}

func (service *NativeOrderService) persistFailure(record NativeOrderRecord, err error) error {
	update := NativeOrderUpdate{Status: StatusCreateFailed, ErrorCode: pointer("WECHAT_CREATE_REJECTED")}
	if errors.Is(err, wechat.ErrResultUnknown) {
		update.Status = StatusCreateUnknown
		update.ErrorCode = pointer("WECHAT_CREATE_UNKNOWN")
	}
	message := err.Error()
	if len(message) > 512 {
		message = message[:512]
	}
	update.ErrorMessage = &message
	_, updateErr := service.repository.UpdateNativeOrder(record, update)
	return updateErr
}

func ValidateCodeURL(value string) error {
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme != "weixin" || parsed.Host != "wxpay" || parsed.Path != "/bizpayurl" || parsed.User != nil {
		return errors.New("code_url must be a WeChat Native payment URL")
	}
	if strings.TrimSpace(parsed.Query().Get("pr")) == "" {
		return errors.New("code_url must contain a Native payment parameter")
	}
	return nil
}

func pointer(value string) *string { return &value }
