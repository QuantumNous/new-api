package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/smartwalle/alipay/v3"
)

type AlipayAgreementPageSignRequest struct {
	ExternalAgreementNo string
	ReturnURL           string
	NotifyURL           string
	ExternalLogonId     string
	SingleAmount        string
	PeriodType          string
	Period              string
	ExecuteTime         string // yyyy-MM-dd
}

type AlipayAgreementTradePayRequest struct {
	OutTradeNo  string
	TotalAmount string
	Subject     string
	AgreementNo string
	NotifyURL   string
}

func IsAlipayCyclePayConfigured() bool {
	return setting.AlipayCyclePayEnabled &&
		strings.TrimSpace(setting.AlipayCyclePayPersonalProductCode) != "" &&
		strings.TrimSpace(setting.AlipayCyclePayProductCode) != "" &&
		strings.TrimSpace(setting.AlipayCyclePaySignScene) != "" &&
		strings.TrimSpace(setting.AlipayAppID) != "" &&
		strings.TrimSpace(setting.AlipayPrivateKey) != "" &&
		strings.TrimSpace(setting.AlipayPublicKey) != "" &&
		strings.TrimSpace(setting.AlipayGateway) != ""
}

// BuildAlipayPeriodRuleFromPlan maps subscription plan duration to Alipay period_rule_params.
// Hour/custom plans are rejected because Alipay cycle-pay only supports DAY/MONTH periods.
func BuildAlipayPeriodRuleFromPlan(plan *model.SubscriptionPlan, singleAmount string, executeTime time.Time) (*alipay.PeriodRuleParams, error) {
	if plan == nil {
		return nil, errors.New("plan is nil")
	}
	if strings.TrimSpace(singleAmount) == "" {
		return nil, errors.New("single amount is empty")
	}
	if plan.DurationValue <= 0 {
		return nil, errors.New("duration_value must be > 0")
	}

	periodType := ""
	period := strconv.Itoa(plan.DurationValue)
	switch plan.DurationUnit {
	case model.SubscriptionDurationDay:
		periodType = "DAY"
	case model.SubscriptionDurationMonth:
		periodType = "MONTH"
	case model.SubscriptionDurationYear:
		periodType = "MONTH"
		period = strconv.Itoa(plan.DurationValue * 12)
	default:
		return nil, fmt.Errorf("alipay cycle pay does not support duration_unit=%s", plan.DurationUnit)
	}

	return &alipay.PeriodRuleParams{
		PeriodType:   periodType,
		Period:       period,
		ExecuteTime:  executeTime.Format("2006-01-02"),
		SingleAmount: singleAmount,
	}, nil
}

func BuildAlipayAgreementPageSignURL(req AlipayAgreementPageSignRequest) (string, error) {
	if !IsAlipayCyclePayConfigured() {
		return "", errors.New("alipay cycle pay is not configured")
	}
	if strings.TrimSpace(req.ExternalAgreementNo) == "" {
		return "", errors.New("external_agreement_no is empty")
	}
	if strings.TrimSpace(req.SingleAmount) == "" {
		return "", errors.New("single amount is empty")
	}
	if strings.TrimSpace(req.PeriodType) == "" || strings.TrimSpace(req.Period) == "" {
		return "", errors.New("period rule is incomplete")
	}
	executeTime := strings.TrimSpace(req.ExecuteTime)
	if executeTime == "" {
		executeTime = time.Now().Format("2006-01-02")
	}

	client, err := newAlipayClient(setting.AlipayGateway, setting.AlipayAppID, setting.AlipayPrivateKey, setting.AlipayPublicKey)
	if err != nil {
		return "", err
	}

	param := alipay.AgreementPageSign{
		ReturnURL:           req.ReturnURL,
		NotifyURL:           req.NotifyURL,
		ProductCode:         setting.AlipayCyclePayProductCode,
		PersonalProductCode: setting.AlipayCyclePayPersonalProductCode,
		SignScene:           setting.AlipayCyclePaySignScene,
		ExternalAgreementNo: req.ExternalAgreementNo,
		ExternalLogonId:     req.ExternalLogonId,
		AccessParams: &alipay.AccessParams{
			Channel: "ALIPAYAPP",
		},
		PeriodRuleParams: &alipay.PeriodRuleParams{
			PeriodType:   req.PeriodType,
			Period:       req.Period,
			ExecuteTime:  executeTime,
			SingleAmount: req.SingleAmount,
		},
	}

	signURL, err := client.AgreementPageSign(param)
	if err != nil {
		return "", err
	}
	return signURL.String(), nil
}

// AlipayPayAndSignRequest is the first-period "支付并签约" checkout (pay + agreement in one redirect).
type AlipayPayAndSignRequest struct {
	Method              string // alipay.trade.page.pay or alipay.trade.wap.pay
	OutTradeNo          string
	TotalAmount         string
	Subject             string
	ReturnURL           string
	NotifyURL           string
	QuitURL             string
	ExternalAgreementNo string
	ExternalLogonId     string
	SingleAmount        string
	PeriodType          string
	Period              string
	ExecuteTime         string
}

// BuildAlipayPayAndSignURL builds a page/wap pay URL with agreement_sign_params so first payment
// and cycle-pay authorization complete in one user flow.
func BuildAlipayPayAndSignURL(req AlipayPayAndSignRequest) (string, error) {
	if !IsAlipayCyclePayConfigured() {
		return "", errors.New("alipay cycle pay is not configured")
	}
	if strings.TrimSpace(req.OutTradeNo) == "" {
		return "", errors.New("out_trade_no is empty")
	}
	if strings.TrimSpace(req.TotalAmount) == "" || strings.TrimSpace(req.SingleAmount) == "" {
		return "", errors.New("amount is empty")
	}
	if strings.TrimSpace(req.ExternalAgreementNo) == "" {
		return "", errors.New("external_agreement_no is empty")
	}
	if strings.TrimSpace(req.PeriodType) == "" || strings.TrimSpace(req.Period) == "" {
		return "", errors.New("period rule is incomplete")
	}
	method, err := normalizeAlipayPayMethod(req.Method)
	if err != nil {
		return "", err
	}
	executeTime := strings.TrimSpace(req.ExecuteTime)
	if executeTime == "" {
		executeTime = time.Now().Format("2006-01-02")
	}
	subject := strings.TrimSpace(req.Subject)
	if subject == "" {
		subject = "Subscription auto renew"
	}

	client, err := newAlipayClient(setting.AlipayGateway, setting.AlipayAppID, setting.AlipayPrivateKey, setting.AlipayPublicKey)
	if err != nil {
		return "", err
	}

	// SignParams.ProductCode is the withholding product; Trade.ProductCode is page/wap pay product.
	signProductCode := strings.TrimSpace(setting.AlipayCyclePayProductCode)
	if signProductCode == "" {
		signProductCode = "GENERAL_WITHHOLDING"
	}
	signParams := &alipay.SignParams{
		ProductCode:         signProductCode,
		PersonalProductCode: setting.AlipayCyclePayPersonalProductCode,
		SignScene:           setting.AlipayCyclePaySignScene,
		ExternalAgreementNo: req.ExternalAgreementNo,
		ExternalLogonId:     req.ExternalLogonId,
		AccessParams: &alipay.AccessParams{
			Channel: "ALIPAYAPP",
		},
		PeriodRuleParams: &alipay.PeriodRuleParams{
			PeriodType:   req.PeriodType,
			Period:       req.Period,
			ExecuteTime:  executeTime,
			SingleAmount: req.SingleAmount,
		},
		SignNotifyURL: req.NotifyURL,
	}

	trade := alipay.Trade{
		NotifyURL:           req.NotifyURL,
		ReturnURL:           req.ReturnURL,
		OutTradeNo:          req.OutTradeNo,
		TotalAmount:         req.TotalAmount,
		Subject:             subject,
		ProductCode:         GetAlipayProductCode(method),
		TimeoutExpress:      DefaultAlipayTimeoutExpress(),
		AgreementSignParams: signParams,
	}

	if method == "alipay.trade.wap.pay" {
		payURL, err := client.TradeWapPay(alipay.TradeWapPay{
			Trade:   trade,
			QuitURL: req.QuitURL,
		})
		if err != nil {
			return "", err
		}
		return payURL.String(), nil
	}

	payURL, err := client.TradePagePay(alipay.TradePagePay{Trade: trade})
	if err != nil {
		return "", err
	}
	return payURL.String(), nil
}

func UnsignAlipayAgreement(ctx context.Context, agreementNo string, notifyURL string) error {
	if strings.TrimSpace(agreementNo) == "" {
		return errors.New("agreement_no is empty")
	}
	client, err := newAlipayClient(setting.AlipayGateway, setting.AlipayAppID, setting.AlipayPrivateKey, setting.AlipayPublicKey)
	if err != nil {
		return err
	}
	rsp, err := client.AgreementUnsign(ctx, alipay.AgreementUnsign{
		AgreementNo: agreementNo,
		NotifyURL:   notifyURL,
	})
	if err != nil {
		return err
	}
	if rsp != nil && rsp.IsFailure() {
		return fmt.Errorf("alipay agreement unsign failed: %s %s", rsp.Msg, rsp.SubMsg)
	}
	return nil
}

func TradePayAlipayWithAgreement(ctx context.Context, req AlipayAgreementTradePayRequest) (*alipay.TradePayRsp, error) {
	if strings.TrimSpace(req.OutTradeNo) == "" || strings.TrimSpace(req.AgreementNo) == "" {
		return nil, errors.New("out_trade_no and agreement_no are required")
	}
	if strings.TrimSpace(req.TotalAmount) == "" {
		return nil, errors.New("total amount is empty")
	}
	client, err := newAlipayClient(setting.AlipayGateway, setting.AlipayAppID, setting.AlipayPrivateKey, setting.AlipayPublicKey)
	if err != nil {
		return nil, err
	}

	productCode := setting.AlipayCyclePayProductCode
	if productCode == "" {
		productCode = "GENERAL_WITHHOLDING"
	}
	subject := strings.TrimSpace(req.Subject)
	if subject == "" {
		subject = "Subscription auto renew"
	}

	rsp, err := client.TradePay(ctx, alipay.TradePay{
		Trade: alipay.Trade{
			NotifyURL:   req.NotifyURL,
			OutTradeNo:  req.OutTradeNo,
			TotalAmount: req.TotalAmount,
			Subject:     subject,
			ProductCode: productCode,
		},
		AgreementParams: &alipay.AgreementParams{
			AgreementNo: req.AgreementNo,
		},
	})
	if err != nil {
		return nil, err
	}
	if rsp != nil && rsp.IsFailure() {
		return rsp, fmt.Errorf("alipay trade pay failed: %s %s", rsp.Msg, rsp.SubMsg)
	}
	return rsp, nil
}
