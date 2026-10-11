package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/wechatpay-apiv3/wechatpay-go/core"
	"github.com/wechatpay-apiv3/wechatpay-go/core/auth/verifiers"
	"github.com/wechatpay-apiv3/wechatpay-go/core/notify"
	"github.com/wechatpay-apiv3/wechatpay-go/core/option"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments/native"
	"github.com/wechatpay-apiv3/wechatpay-go/utils"
)

var wechatAppIDPattern = regexp.MustCompile(`^wx[a-zA-Z0-9]{16}$`)
var wechatMchIDPattern = regexp.MustCompile(`^[0-9]{8,16}$`)
var wechatSerialPattern = regexp.MustCompile(`^[A-Fa-f0-9]{32,64}$`)
var wechatPublicKeyIDPattern = regexp.MustCompile(`^PUB_KEY_ID_[A-Za-z0-9]{16,52}$`)

func WechatPayClient(config *model.WechatPayConfig) (*core.Client, error) {
	key, err := utils.LoadPrivateKey(config.PrivateKey)
	if err != nil || key.N.BitLen() < 2048 {
		return nil, errors.New("微信支付商户私钥无效")
	}
	pub, err := utils.LoadPublicKey(config.PublicKey)
	if err != nil || pub.N.BitLen() < 2048 {
		return nil, errors.New("微信支付公钥无效")
	}
	return core.NewClient(context.Background(),
		option.WithWechatPayPublicKeyAuthCipher(config.MchID, config.SerialNo, key, config.PublicKeyID, pub),
		option.WithHTTPClient(&http.Client{Timeout: 15 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}))
}

func ValidateWechatPayConfig(config *model.WechatPayConfig) error {
	if !wechatAppIDPattern.MatchString(config.AppID) || !wechatMchIDPattern.MatchString(config.MchID) || !wechatSerialPattern.MatchString(config.SerialNo) || !wechatPublicKeyIDPattern.MatchString(config.PublicKeyID) {
		return errors.New("微信支付商户、应用或证书标识无效")
	}
	if len(config.APIv3Key) != 32 {
		return errors.New("API v3 密钥必须为 32 字节")
	}
	if config.MinTopUp < 1 || config.MinTopUp > 1000000 {
		return errors.New("最低充值数量无效")
	}
	u, err := url.Parse(config.NotifyBaseURL)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return errors.New("微信支付回调基础地址必须使用 HTTPS 且不包含查询参数")
	}
	config.NotifyBaseURL = strings.TrimRight(config.NotifyBaseURL, "/")
	_, err = WechatPayClient(config)
	return err
}

// CreateWechatPayCheckout sends the persisted order's frozen CNY amount to Native prepay.
func CreateWechatPayCheckout(ctx context.Context, config *model.WechatPayConfig, order *model.WechatPayOrder) (string, error) {
	client, err := WechatPayClient(config)
	if err != nil {
		return "", err
	}
	svc := native.NativeApiService{Client: client}
	description := "账户充值"
	if strings.HasPrefix(order.TradeNo, "SUBWX") {
		description = "订阅套餐"
	}
	rsp, _, err := svc.Prepay(ctx, native.PrepayRequest{Appid: core.String(config.AppID), Mchid: core.String(config.MchID), Description: core.String(description), OutTradeNo: core.String(order.TradeNo), TimeExpire: core.Time(time.Unix(order.ExpiresAt, 0)), NotifyUrl: core.String(fmt.Sprintf("%s/api/user/wechatpay/notify/%d", config.NotifyBaseURL, config.ID)), Amount: &native.Amount{Total: core.Int64(order.AmountFen), Currency: core.String("CNY")}})
	if err != nil || rsp == nil || rsp.CodeUrl == nil || !strings.HasPrefix(*rsp.CodeUrl, "weixin://wxpay/bizpayurl?") {
		return "", errors.New("WeChat Pay prepay failed")
	}
	return *rsp.CodeUrl, nil
}

// VerifyWechatPayNotification uses only the pinned revision's public key and API v3 key.
func VerifyWechatPayNotification(config *model.WechatPayConfig, request *http.Request) (*payments.Transaction, error) {
	// Reject malformed GCM nonces before calling the SDK (cipher.AEAD panics on an invalid nonce length).
	body, readErr := io.ReadAll(io.LimitReader(request.Body, 65537))
	if readErr != nil || len(body) > 65536 {
		return nil, errors.New("invalid notification body")
	}
	var envelope struct {
		Resource struct {
			Nonce string `json:"nonce"`
		} `json:"resource"`
	}
	if common.Unmarshal(body, &envelope) != nil || len(envelope.Resource.Nonce) != 12 {
		return nil, errors.New("invalid notification nonce")
	}
	request.Body = io.NopCloser(bytes.NewReader(body))
	for _, name := range []string{"Wechatpay-Serial", "Wechatpay-Signature", "Wechatpay-Timestamp", "Wechatpay-Nonce"} {
		if len(request.Header.Values(name)) != 1 {
			return nil, errors.New("invalid notification headers")
		}
	}
	pub, err := utils.LoadPublicKey(config.PublicKey)
	if err != nil || pub.N.BitLen() < 2048 || len(config.APIv3Key) != 32 {
		return nil, errors.New("invalid WeChat Pay verifier")
	}
	handler, err := notify.NewRSANotifyHandler(config.APIv3Key, verifiers.NewSHA256WithRSAPubkeyVerifier(config.PublicKeyID, *pub))
	if err != nil {
		return nil, errors.New("invalid WeChat Pay verifier")
	}
	tx := new(payments.Transaction)
	event, err := handler.ParseNotifyRequest(request.Context(), request, tx)
	if err != nil || event == nil || event.EventType != "TRANSACTION.SUCCESS" {
		return nil, errors.New("invalid WeChat Pay notification")
	}
	return tx, nil
}

// ValidateWechatPayTransaction binds verified evidence to the merchant and frozen order.
func ValidateWechatPayTransaction(config *model.WechatPayConfig, order *model.WechatPayOrder, tx *payments.Transaction) error {
	if tx == nil || tx.Appid == nil || *tx.Appid != config.AppID || tx.Mchid == nil || *tx.Mchid != config.MchID || tx.OutTradeNo == nil || *tx.OutTradeNo != order.TradeNo || tx.TradeType == nil || *tx.TradeType != "NATIVE" || tx.Amount == nil || tx.Amount.Total == nil || *tx.Amount.Total != order.AmountFen || tx.Amount.Currency == nil || *tx.Amount.Currency != "CNY" || tx.TradeState == nil {
		return errors.New("WeChat Pay transaction mismatch")
	}
	return nil
}

func ReconcileWechatPayOrder(ctx context.Context, tradeNo string) (resultErr error) {
	order, config, err := model.GetWechatPayOrder(tradeNo)
	if err != nil {
		return err
	}
	defer func() {
		resultErr = errors.Join(resultErr, model.RecordDirectOrderCheck(tradeNo, model.PaymentProviderWechatPay, resultErr))
	}()
	if common.GetTimestamp() >= order.ExpiresAt && order.CloseRequestedAt == 0 && order.Status == common.TopUpStatusPending {
		if err := model.DB.Model(&model.WechatPayOrder{}).Where("id = ? AND (close_requested_at = 0 OR close_requested_at IS NULL)", order.ID).Updates(map[string]any{"close_requested_at": common.GetTimestamp(), "close_reason": "expired"}).Error; err != nil {
			return err
		}
	}
	if order.Status == common.TopUpStatusSuccess {
		return model.SyncWechatPayQuotaCache(order)
	}
	if order.Status == "paid" {
		return model.CompleteWechatPayTopUp(tradeNo)
	}
	if order.Status != common.TopUpStatusPending && order.Status != common.TopUpStatusExpired {
		return nil
	}
	client, err := WechatPayClient(config)
	if err != nil {
		return err
	}
	svc := native.NativeApiService{Client: client}
	tx, _, err := svc.QueryOrderByOutTradeNo(ctx, native.QueryOrderByOutTradeNoRequest{Mchid: core.String(config.MchID), OutTradeNo: core.String(tradeNo)})
	if err != nil {
		if core.IsAPIError(err, "ORDER_NOT_EXIST") {
			if err := model.DB.Model(&model.WechatPayOrder{}).Where("id = ?", order.ID).Update("gateway_status", "NOT_FOUND").Error; err != nil {
				return err
			}
			if common.GetTimestamp() > order.ExpiresAt+30 {
				return model.ConfirmDirectOrderClosed(tradeNo, model.PaymentProviderWechatPay)
			}
			return nil
		}
		return errors.New("微信支付查单失败")
	}
	if err = ValidateWechatPayTransaction(config, order, tx); err != nil {
		return err
	}
	if len(*tx.TradeState) > 32 {
		return errors.New("invalid WeChat Pay state")
	}
	if err := model.DB.Model(&model.WechatPayOrder{}).Where("id = ?", order.ID).Update("gateway_status", *tx.TradeState).Error; err != nil {
		return err
	}
	switch *tx.TradeState {
	case "SUCCESS":
		if tx.TransactionId == nil {
			return errors.New("missing WeChat Pay transaction ID")
		}
		if err = model.RecordWechatPayPayment(tradeNo, *tx.TransactionId, *tx.Amount.Total); err != nil {
			return err
		}
		return model.CompleteWechatPayTopUp(tradeNo)
	case "CLOSED":
		if tx.SuccessTime != nil && *tx.SuccessTime != "" {
			if err := model.DB.Model(&model.WechatPayOrder{}).Where("id = ?", order.ID).Update("review_required", true).Error; err != nil {
				return err
			}
			return model.ErrPaymentReviewRequired
		}
		return model.ConfirmDirectOrderClosed(tradeNo, model.PaymentProviderWechatPay)
	case "REFUND", "REVOKED":
		if err := model.DB.Model(&model.WechatPayOrder{}).Where("id = ?", order.ID).Update("review_required", true).Error; err != nil {
			return err
		}
		return model.ErrPaymentReviewRequired
	case "NOTPAY":
		if common.GetTimestamp() < order.ExpiresAt && !order.CancelRequested && order.Status != common.TopUpStatusExpired {
			return nil
		}
		if _, err = svc.CloseOrder(ctx, native.CloseOrderRequest{Mchid: core.String(config.MchID), OutTradeNo: core.String(tradeNo)}); err != nil {
			return errors.New("微信支付关单尚未确认")
		}
		return model.ConfirmDirectOrderClosed(tradeNo, model.PaymentProviderWechatPay)
	}
	return errors.New("微信支付交易尚未确认")
}

func RunWechatPayReconciliation(ctx context.Context) error {
	var orders []model.WechatPayOrder
	if err := model.DB.Where("(status IN ? OR (status = ? AND (closed_at = 0 OR closed_at IS NULL)) OR cache_pending = ?) AND (review_required = ? OR review_required IS NULL) AND next_check_at <= ?", []string{common.TopUpStatusPending, "paid"}, common.TopUpStatusExpired, true, false, common.GetTimestamp()).Order("next_check_at, id").Limit(30).Find(&orders).Error; err != nil {
		return errors.New("WeChat Pay reconciliation database unavailable")
	}
	var failures []error
	for _, order := range orders {
		if err := ctx.Err(); err != nil {
			return err
		}
		claimed := model.DB.Model(&model.WechatPayOrder{}).Where("id = ? AND next_check_at = ?", order.ID, order.NextCheckAt).Update("next_check_at", common.GetTimestamp()+120)
		if claimed.Error != nil {
			failures = append(failures, errors.New("WeChat Pay claim failed"))
			continue
		}
		if claimed.RowsAffected != 1 {
			continue
		}
		if err := ReconcileWechatPayOrder(ctx, order.TradeNo); err != nil {
			failures = append(failures, fmt.Errorf("WeChat Pay order %s requires retry: %w", order.TradeNo, err))
		}
	}
	return errors.Join(failures...)
}
