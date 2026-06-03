package service

import (
	"context"
	"fmt"
	"net/url"

	"github.com/QuantumNous/new-api/model"
	"github.com/smartwalle/alipay/v3"
)

type AlipayPayClient struct {
	client    *alipay.Client
	notifyURL string
	returnURL string
}

func NewAlipayPayClient(config *model.PaymentConfig, notifyPath string, returnURL string) (*AlipayPayClient, error) {
	if config == nil {
		return nil, fmt.Errorf("alipay config is nil")
	}
	if config.AppID == "" || config.AppPrivateKey == "" {
		return nil, fmt.Errorf("alipay app id or private key not configured")
	}

	var opts []alipay.OptionFunc
	if config.GatewayURL != "" {
		opts = append(opts, alipay.WithProductionGateway(config.GatewayURL))
	}
	client, err := alipay.New(config.AppID, config.AppPrivateKey, true, opts...)
	if err != nil {
		return nil, fmt.Errorf("init alipay client failed: %w", err)
	}

	if config.AlipayAppPublicCert != "" || config.AlipayPublicCert != "" || config.AlipayRootCert != "" {
		if config.AlipayAppPublicCert == "" || config.AlipayPublicCert == "" || config.AlipayRootCert == "" {
			return nil, fmt.Errorf("alipay certificate mode requires app public cert, alipay public cert, and root cert")
		}
		if err := client.LoadAppCertPublicKey(config.AlipayAppPublicCert); err != nil {
			return nil, fmt.Errorf("load alipay app public cert failed: %w", err)
		}
		if err := client.LoadAlipayCertPublicKey(config.AlipayPublicCert); err != nil {
			return nil, fmt.Errorf("load alipay public cert failed: %w", err)
		}
		if err := client.LoadAliPayRootCert(config.AlipayRootCert); err != nil {
			return nil, fmt.Errorf("load alipay root cert failed: %w", err)
		}
	} else if config.AlipayPublicKey != "" {
		if err := client.LoadAliPayPublicKey(config.AlipayPublicKey); err != nil {
			return nil, fmt.Errorf("load alipay public key failed: %w", err)
		}
	} else {
		return nil, fmt.Errorf("alipay public key or certificates not configured")
	}

	notifyURL := config.NotifyURL
	if notifyURL == "" {
		notifyURL = GetCallbackAddress() + notifyPath
	}
	if returnURL == "" {
		returnURL = config.ReturnURL
	}

	return &AlipayPayClient{client: client, notifyURL: notifyURL, returnURL: returnURL}, nil
}

func (a *AlipayPayClient) CreatePagePay(tradeNo string, subject string, totalAmount string, expireTime string) (string, error) {
	var p alipay.TradePagePay
	p.NotifyURL = a.notifyURL
	p.ReturnURL = a.returnURL
	p.Subject = subject
	p.OutTradeNo = tradeNo
	p.TotalAmount = totalAmount
	p.ProductCode = "FAST_INSTANT_TRADE_PAY"
	if expireTime != "" {
		p.TimeExpire = expireTime
	}
	result, err := a.client.TradePagePay(p)
	if err != nil {
		return "", fmt.Errorf("alipay trade page pay failed: %w", err)
	}
	return result.String(), nil
}

func (a *AlipayPayClient) CreateWAPPay(tradeNo string, subject string, totalAmount string, expireTime string, quitURL string) (string, error) {
	var p alipay.TradeWapPay
	p.NotifyURL = a.notifyURL
	p.ReturnURL = a.returnURL
	p.Subject = subject
	p.OutTradeNo = tradeNo
	p.TotalAmount = totalAmount
	p.ProductCode = "QUICK_WAP_WAY"
	if expireTime != "" {
		p.TimeExpire = expireTime
	}
	if quitURL != "" {
		p.QuitURL = quitURL
	}
	result, err := a.client.TradeWapPay(p)
	if err != nil {
		return "", fmt.Errorf("alipay trade wap pay failed: %w", err)
	}
	return result.String(), nil
}

func (a *AlipayPayClient) VerifyNotification(ctx context.Context, params url.Values) error {
	return a.client.VerifySign(ctx, params)
}
