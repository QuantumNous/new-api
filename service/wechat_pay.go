package service

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/wechatpay-apiv3/wechatpay-go/core"
	"github.com/wechatpay-apiv3/wechatpay-go/core/auth/verifiers"
	"github.com/wechatpay-apiv3/wechatpay-go/core/downloader"
	"github.com/wechatpay-apiv3/wechatpay-go/core/notify"
	"github.com/wechatpay-apiv3/wechatpay-go/core/option"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments/h5"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments/native"
	"github.com/wechatpay-apiv3/wechatpay-go/utils"
)

type WechatPayClient struct {
	client    *core.Client
	appID     string
	mchID     string
	notifyURL string
	handler   *notify.Handler
}

func NewWechatPayClient(config *model.PaymentConfig, notifyPath string) (*WechatPayClient, error) {
	if config == nil {
		return nil, fmt.Errorf("wechat config is nil")
	}
	if config.WechatAppID == "" || config.WechatMchID == "" || config.WechatAPIKey == "" || config.WechatSerialNo == "" || config.WechatPrivateKey == "" {
		return nil, fmt.Errorf("wechat pay config is incomplete")
	}

	privateKey, err := utils.LoadPrivateKeyWithPath(config.WechatPrivateKey)
	if err != nil {
		privateKey, err = utils.LoadPrivateKey(config.WechatPrivateKey)
		if err != nil {
			return nil, fmt.Errorf("load wechat private key failed: %w", err)
		}
	}

	ctx := context.Background()
	if err := downloader.MgrInstance().RegisterDownloaderWithPrivateKey(ctx, privateKey, config.WechatSerialNo, config.WechatMchID, config.WechatAPIKey); err != nil {
		return nil, fmt.Errorf("register wechat pay downloader failed: %w", err)
	}

	client, err := core.NewClient(ctx, option.WithWechatPayAutoAuthCipher(config.WechatMchID, config.WechatSerialNo, privateKey, config.WechatAPIKey))
	if err != nil {
		return nil, fmt.Errorf("init wechat pay client failed: %w", err)
	}

	certificateVisitor := downloader.MgrInstance().GetCertificateVisitor(config.WechatMchID)
	handler := notify.NewNotifyHandler(config.WechatAPIKey, verifiers.NewSHA256WithRSAVerifier(certificateVisitor))

	notifyURL := config.NotifyURL
	if notifyURL == "" {
		notifyURL = GetCallbackAddress() + notifyPath
	}

	return &WechatPayClient{client: client, appID: config.WechatAppID, mchID: config.WechatMchID, notifyURL: notifyURL, handler: handler}, nil
}

func (w *WechatPayClient) CreateNativeOrder(ctx context.Context, tradeNo string, description string, amountInFen int64, expireTime time.Time) (string, error) {
	svc := native.NativeApiService{Client: w.client}
	resp, _, err := svc.Prepay(ctx, native.PrepayRequest{
		Appid:       core.String(w.appID),
		Mchid:       core.String(w.mchID),
		Description: core.String(description),
		OutTradeNo:  core.String(tradeNo),
		TimeExpire:  &expireTime,
		NotifyUrl:   core.String(w.notifyURL),
		Amount: &native.Amount{
			Total:    core.Int64(amountInFen),
			Currency: core.String("CNY"),
		},
	})
	if err != nil {
		return "", fmt.Errorf("wechat native prepay failed: %w", err)
	}
	if resp.CodeUrl == nil {
		return "", fmt.Errorf("wechat native prepay response missing code_url")
	}
	return *resp.CodeUrl, nil
}

func (w *WechatPayClient) CreateH5Order(ctx context.Context, tradeNo string, description string, amountInFen int64, expireTime time.Time, payerClientIP string) (string, error) {
	svc := h5.H5ApiService{Client: w.client}
	resp, _, err := svc.Prepay(ctx, h5.PrepayRequest{
		Appid:       core.String(w.appID),
		Mchid:       core.String(w.mchID),
		Description: core.String(description),
		OutTradeNo:  core.String(tradeNo),
		TimeExpire:  &expireTime,
		NotifyUrl:   core.String(w.notifyURL),
		Amount: &h5.Amount{
			Total:    core.Int64(amountInFen),
			Currency: core.String("CNY"),
		},
		SceneInfo: &h5.SceneInfo{
			PayerClientIp: core.String(payerClientIP),
			H5Info: &h5.H5Info{
				Type: core.String("Wap"),
			},
		},
	})
	if err != nil {
		return "", fmt.Errorf("wechat h5 prepay failed: %w", err)
	}
	if resp.H5Url == nil {
		return "", fmt.Errorf("wechat h5 prepay response missing h5_url")
	}
	return *resp.H5Url, nil
}

func (w *WechatPayClient) ParseNotifyRequest(ctx context.Context, request *http.Request, content interface{}) (*notify.Request, error) {
	return w.handler.ParseNotifyRequest(ctx, request, content)
}
