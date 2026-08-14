package wechat

import (
	"bytes"
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/config"
	"github.com/wechatpay-apiv3/wechatpay-go/core"
	"github.com/wechatpay-apiv3/wechatpay-go/core/auth"
	"github.com/wechatpay-apiv3/wechatpay-go/core/auth/verifiers"
	"github.com/wechatpay-apiv3/wechatpay-go/core/notify"
	"github.com/wechatpay-apiv3/wechatpay-go/core/option"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments/native"
	"github.com/wechatpay-apiv3/wechatpay-go/utils"
)

type SDKClient struct {
	appID      string
	merchantID string
	service    native.NativeApiService
	notifier   *notify.Handler
}

func NewSDKClient(ctx context.Context, appConfig config.Config) (*SDKClient, error) {
	privateKey, err := utils.LoadPrivateKeyWithPath(appConfig.WechatPrivateKey)
	if err != nil {
		return nil, fmt.Errorf("load WeChat merchant private key: %w", err)
	}
	publicKey, err := loadPublicKey(appConfig.WechatPublicKeyFile)
	if err != nil {
		return nil, fmt.Errorf("load WeChat public key: %w", err)
	}
	verifierList := []auth.Verifier{verifiers.NewSHA256WithRSAPubkeyVerifier(appConfig.WechatPublicKeyID, *publicKey)}
	if appConfig.WechatPreviousPublicKeyID != "" {
		previousPublicKey, err := loadPublicKey(appConfig.WechatPreviousPublicKeyFile)
		if err != nil {
			return nil, fmt.Errorf("load previous WeChat public key: %w", err)
		}
		verifierList = append(verifierList, verifiers.NewSHA256WithRSAPubkeyVerifier(appConfig.WechatPreviousPublicKeyID, *previousPublicKey))
	}
	verifier := multiVerifier{verifiers: verifierList}
	client, err := core.NewClient(ctx,
		option.WithMerchantCredential(appConfig.WechatMerchantID, appConfig.WechatCertSerial, privateKey),
		option.WithVerifier(verifier),
	)
	if err != nil {
		return nil, fmt.Errorf("create WeChat API client: %w", err)
	}
	notifier, err := notify.NewRSANotifyHandler(appConfig.WechatAPIV3Key, verifier)
	if err != nil {
		return nil, fmt.Errorf("create WeChat notification handler: %w", err)
	}
	return &SDKClient{
		appID:      appConfig.WechatAppID,
		merchantID: appConfig.WechatMerchantID,
		service:    native.NativeApiService{Client: client},
		notifier:   notifier,
	}, nil
}

type multiVerifier struct {
	verifiers []auth.Verifier
}

func (v multiVerifier) Verify(ctx context.Context, serial, message, signature string) error {
	var lastErr error
	for _, verifier := range v.verifiers {
		keyID, err := verifier.GetSerial(ctx)
		if err != nil || keyID != serial {
			continue
		}
		if err := verifier.Verify(ctx, serial, message, signature); err == nil {
			return nil
		} else {
			lastErr = err
		}
	}
	if lastErr != nil {
		return lastErr
	}
	return fmt.Errorf("unknown WeChat public key ID")
}

func (v multiVerifier) GetSerial(ctx context.Context) (string, error) {
	if len(v.verifiers) == 0 {
		return "", errors.New("no WeChat public key verifier configured")
	}
	return v.verifiers[0].GetSerial(ctx)
}

func (c *SDKClient) VerifyAndDecrypt(ctx context.Context, headers NotificationHeaders, body []byte) (PaymentNotice, error) {
	if c.notifier == nil || headers.Timestamp == "" || headers.Nonce == "" || headers.Signature == "" || headers.Serial == "" {
		return PaymentNotice{}, ErrInvalidNotice
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://wechatpay.local/notify", bytes.NewReader(body))
	if err != nil {
		return PaymentNotice{}, ErrInvalidNotice
	}
	request.Header.Set("Wechatpay-Timestamp", headers.Timestamp)
	request.Header.Set("Wechatpay-Nonce", headers.Nonce)
	request.Header.Set("Wechatpay-Signature", headers.Signature)
	request.Header.Set("Wechatpay-Serial", headers.Serial)
	var transaction payments.Transaction
	notification, err := c.notifier.ParseNotifyRequest(ctx, request, &transaction)
	if err != nil || notification == nil || notification.ID == "" || transaction.Amount == nil {
		return PaymentNotice{}, fmt.Errorf("%w: invalid signed notification", ErrInvalidNotice)
	}
	paidAt, err := parseSuccessTime(transaction.SuccessTime)
	if err != nil {
		return PaymentNotice{}, fmt.Errorf("%w: invalid success time", ErrInvalidNotice)
	}
	return PaymentNotice{
		NotificationID:  notification.ID,
		MerchantOrderNo: dereference(transaction.OutTradeNo),
		WechatOrderNo:   dereference(transaction.TransactionId),
		MerchantID:      dereference(transaction.Mchid),
		AppID:           dereference(transaction.Appid),
		TradeState:      dereference(transaction.TradeState),
		AmountFen:       dereferenceInt64(transaction.Amount.Total),
		Currency:        dereference(transaction.Amount.Currency),
		PaidAt:          paidAt,
	}, nil
}

func (c *SDKClient) CreateNativeOrder(ctx context.Context, request NativeOrderRequest) (NativeOrder, error) {
	response, _, err := c.service.Prepay(ctx, native.PrepayRequest{
		Appid:       core.String(c.appID),
		Mchid:       core.String(c.merchantID),
		Description: core.String(request.Description),
		OutTradeNo:  core.String(request.MerchantOrderNo),
		TimeExpire:  core.Time(request.ExpireAt.UTC()),
		NotifyUrl:   core.String(request.NotifyURL),
		Amount: &native.Amount{
			Total:    core.Int64(request.AmountFen),
			Currency: core.String(CurrencyCNY),
		},
	})
	if err != nil {
		return NativeOrder{}, classifyError(err)
	}
	if response == nil || response.CodeUrl == nil {
		return NativeOrder{}, ErrRequestRejected
	}
	return NativeOrder{CodeURL: *response.CodeUrl}, nil
}

func (c *SDKClient) QueryOrder(ctx context.Context, merchantOrderNo string) (OrderQuery, error) {
	response, _, err := c.service.QueryOrderByOutTradeNo(ctx, native.QueryOrderByOutTradeNoRequest{
		OutTradeNo: core.String(merchantOrderNo),
		Mchid:      core.String(c.merchantID),
	})
	if err != nil {
		return OrderQuery{}, classifyError(err)
	}
	if response == nil {
		return OrderQuery{}, ErrResultUnknown
	}
	result := OrderQuery{
		MerchantOrderNo: dereference(response.OutTradeNo),
		WechatOrderNo:   dereference(response.TransactionId),
		TradeState:      dereference(response.TradeState),
	}
	if response.Amount != nil {
		result.AmountFen = dereferenceInt64(response.Amount.Total)
		result.Currency = dereference(response.Amount.Currency)
	}
	if response.SuccessTime != nil {
		paidAt, parseErr := time.Parse(time.RFC3339, *response.SuccessTime)
		if parseErr != nil {
			return OrderQuery{}, ErrResultUnknown
		}
		result.PaidAt = &paidAt
	}
	return result, nil
}

func classifyError(err error) error {
	var apiError *core.APIError
	if errors.As(err, &apiError) {
		if apiError.StatusCode >= http.StatusInternalServerError {
			return fmt.Errorf("%w: WeChat API response status %d", ErrResultUnknown, apiError.StatusCode)
		}
		return fmt.Errorf("%w: WeChat API response status %d", ErrRequestRejected, apiError.StatusCode)
	}
	return fmt.Errorf("%w: %v", ErrResultUnknown, err)
}

func loadPublicKey(path string) (*rsa.PublicKey, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, errors.New("missing PEM data")
	}
	key, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	publicKey, ok := key.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("public key is not RSA")
	}
	return publicKey, nil
}

func dereference(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func dereferenceInt64(value *int64) int64 {
	if value == nil {
		return 0
	}
	return *value
}

func parseSuccessTime(value *string) (time.Time, error) {
	if value == nil {
		return time.Time{}, errors.New("missing success time")
	}
	return time.Parse(time.RFC3339, *value)
}
