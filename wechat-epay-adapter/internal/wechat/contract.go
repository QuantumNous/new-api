package wechat

import (
	"context"
	"errors"
	"time"
)

const (
	VerifyModePublicKey = "public_key"
	TradeStateSuccess   = "SUCCESS"
	CurrencyCNY         = "CNY"
)

var (
	ErrRequestRejected = errors.New("wechat request rejected")
	ErrResultUnknown   = errors.New("wechat result unknown")
	ErrInvalidNotice   = errors.New("wechat notification invalid")
)

type NativeOrderRequest struct {
	MerchantOrderNo string
	Description     string
	AmountFen       int64
	ExpireAt        time.Time
	NotifyURL       string
}

type NativeOrder struct {
	CodeURL string
}

type OrderQuery struct {
	MerchantOrderNo string
	WechatOrderNo   string
	TradeState      string
	AmountFen       int64
	Currency        string
	PaidAt          *time.Time
}

type NotificationHeaders struct {
	Timestamp string
	Nonce     string
	Signature string
	Serial    string
}

type PaymentNotice struct {
	NotificationID  string
	MerchantOrderNo string
	WechatOrderNo   string
	MerchantID      string
	AppID           string
	TradeState      string
	AmountFen       int64
	Currency        string
	PaidAt          time.Time
}

// Client isolates the official SDK request and response types from domain code.
type Client interface {
	CreateNativeOrder(context.Context, NativeOrderRequest) (NativeOrder, error)
	QueryOrder(context.Context, string) (OrderQuery, error)
}

// NotificationVerifier validates the public-key signature and decrypts the resource.
type NotificationVerifier interface {
	VerifyAndDecrypt(context.Context, NotificationHeaders, []byte) (PaymentNotice, error)
}
