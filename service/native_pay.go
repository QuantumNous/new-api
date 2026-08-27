package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"sync"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"

	"github.com/go-pay/gopay"
	"github.com/go-pay/gopay/alipay"
	wechat "github.com/go-pay/gopay/wechat/v3"
	"github.com/shopspring/decimal"
)

// native_pay.go 封装微信支付 V3 Native 与支付宝 trade.precreate 原生扫码支付。
// 下单返回支付串（微信 code_url / 支付宝 qr_code），由前端渲染成二维码。
// 支付状态既可由前端轮询 NativeQuery 主动查询，也可由异步回调 VerifyXxxNotify 验证；
// 两条路径最终都汇聚到 model.RechargeNativeQR 完成幂等结算。

const alipayTradeStatusSuccess = "TRADE_SUCCESS"
const alipayTradeStatusFinished = "TRADE_FINISHED"

// ---- 支付宝客户端（密钥模式，构造开销小，按需创建）----

func newAlipayClient() (*alipay.Client, error) {
	if setting.AlipayAppID == "" || setting.AlipayPrivateKey == "" {
		return nil, errors.New("支付宝支付未配置")
	}
	client, err := alipay.NewClient(setting.AlipayAppID, setting.AlipayPrivateKey, setting.AlipayIsProd)
	if err != nil {
		return nil, err
	}
	client.SetSignType(alipay.RSA2)
	// 配置支付宝公钥后自动校验同步响应签名
	if setting.AlipayPublicKey != "" {
		client.AutoVerifySign([]byte(setting.AlipayPublicKey))
	}
	return client, nil
}

// ---- 微信 V3 客户端（AutoVerifySign 会拉取并自动刷新平台证书，故缓存复用）----

var (
	wechatClientMu  sync.Mutex
	wechatClient    *wechat.ClientV3
	wechatClientSig string
)

func configFingerprint(parts ...string) string {
	h := sha256.New()
	for _, p := range parts {
		h.Write([]byte(p))
		h.Write([]byte{0})
	}
	return hex.EncodeToString(h.Sum(nil))
}

func getWechatClient() (*wechat.ClientV3, error) {
	if setting.WechatPayMchID == "" || setting.WechatPaySerialNo == "" ||
		setting.WechatPayApiV3Key == "" || setting.WechatPayPrivateKey == "" {
		return nil, errors.New("微信支付未配置")
	}
	sig := configFingerprint(setting.WechatPayMchID, setting.WechatPaySerialNo,
		setting.WechatPayApiV3Key, setting.WechatPayPrivateKey)

	wechatClientMu.Lock()
	defer wechatClientMu.Unlock()
	if wechatClient != nil && wechatClientSig == sig {
		return wechatClient, nil
	}
	client, err := wechat.NewClientV3(setting.WechatPayMchID, setting.WechatPaySerialNo,
		setting.WechatPayApiV3Key, setting.WechatPayPrivateKey)
	if err != nil {
		return nil, err
	}
	// 下载并自动刷新微信平台证书，用于响应及回调验签
	if err := client.AutoVerifySign(); err != nil {
		return nil, err
	}
	wechatClient = client
	wechatClientSig = sig
	return client, nil
}

// NativePrecreate 统一下单，返回可生成二维码的支付串。
// moneyYuan 为实际支付金额（人民币元）。
func NativePrecreate(ctx context.Context, provider, tradeNo, subject string, moneyYuan float64, notifyURL string) (string, error) {
	switch provider {
	case model.PaymentProviderWechatNative:
		client, err := getWechatClient()
		if err != nil {
			return "", err
		}
		totalFen := decimal.NewFromFloat(moneyYuan).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
		if totalFen <= 0 {
			return "", errors.New("支付金额过低")
		}
		bm := make(gopay.BodyMap)
		bm.Set("appid", setting.WechatPayAppID).
			Set("mchid", setting.WechatPayMchID).
			Set("description", subject).
			Set("out_trade_no", tradeNo).
			Set("notify_url", notifyURL).
			SetBodyMap("amount", func(b gopay.BodyMap) {
				b.Set("total", totalFen).Set("currency", "CNY")
			})
		rsp, err := client.V3TransactionNative(ctx, bm)
		if err != nil {
			return "", err
		}
		if rsp.Code != wechat.Success || rsp.Response == nil || rsp.Response.CodeUrl == "" {
			return "", fmt.Errorf("微信下单失败: %s", rsp.Error)
		}
		return rsp.Response.CodeUrl, nil
	case model.PaymentProviderAlipayNative:
		client, err := newAlipayClient()
		if err != nil {
			return "", err
		}
		bm := make(gopay.BodyMap)
		bm.Set("out_trade_no", tradeNo).
			Set("total_amount", decimal.NewFromFloat(moneyYuan).Round(2).String()).
			Set("subject", subject).
			Set("notify_url", notifyURL)
		rsp, err := client.TradePrecreate(ctx, bm)
		if err != nil {
			return "", err
		}
		if rsp.Response == nil || rsp.Response.QrCode == "" {
			if rsp.Response != nil {
				return "", fmt.Errorf("支付宝下单失败: %s %s", rsp.Response.SubCode, rsp.Response.SubMsg)
			}
			return "", errors.New("支付宝下单失败")
		}
		return rsp.Response.QrCode, nil
	default:
		return "", fmt.Errorf("未知支付渠道: %s", provider)
	}
}

// NativeQuery 主动查询订单是否支付成功。
func NativeQuery(ctx context.Context, provider, tradeNo string) (bool, error) {
	switch provider {
	case model.PaymentProviderWechatNative:
		client, err := getWechatClient()
		if err != nil {
			return false, err
		}
		rsp, err := client.V3TransactionQueryOrder(ctx, wechat.OutTradeNo, tradeNo)
		if err != nil {
			return false, err
		}
		if rsp.Code != wechat.Success || rsp.Response == nil {
			return false, nil
		}
		return rsp.Response.TradeState == wechat.TradeStateSuccess, nil
	case model.PaymentProviderAlipayNative:
		client, err := newAlipayClient()
		if err != nil {
			return false, err
		}
		bm := make(gopay.BodyMap)
		bm.Set("out_trade_no", tradeNo)
		rsp, err := client.TradeQuery(ctx, bm)
		if err != nil {
			return false, err
		}
		if rsp.Response == nil {
			return false, nil
		}
		st := rsp.Response.TradeStatus
		return st == alipayTradeStatusSuccess || st == alipayTradeStatusFinished, nil
	default:
		return false, fmt.Errorf("未知支付渠道: %s", provider)
	}
}

// VerifyWechatNotify 验证微信支付异步回调：验签 + AES-GCM 解密，返回订单号与是否支付成功。
func VerifyWechatNotify(req *http.Request) (tradeNo string, paid bool, err error) {
	client, err := getWechatClient()
	if err != nil {
		return "", false, err
	}
	notifyReq, err := wechat.V3ParseNotify(req)
	if err != nil {
		return "", false, err
	}
	if err := notifyReq.VerifySignByPKMap(client.WxPublicKeyMap()); err != nil {
		return "", false, err
	}
	result, err := notifyReq.DecryptPayCipherText(setting.WechatPayApiV3Key)
	if err != nil {
		return "", false, err
	}
	return result.OutTradeNo, result.TradeState == wechat.TradeStateSuccess, nil
}

// VerifyAlipayNotify 验证支付宝异步回调（公钥模式验签），返回订单号与是否支付成功。
func VerifyAlipayNotify(req *http.Request) (tradeNo string, paid bool, err error) {
	if setting.AlipayPublicKey == "" {
		return "", false, errors.New("支付宝公钥未配置")
	}
	bm, err := alipay.ParseNotifyToBodyMap(req)
	if err != nil {
		return "", false, err
	}
	ok, err := alipay.VerifySign(setting.AlipayPublicKey, bm)
	if err != nil {
		return "", false, err
	}
	if !ok {
		return "", false, errors.New("支付宝回调验签失败")
	}
	status := bm.GetString("trade_status")
	return bm.GetString("out_trade_no"), status == alipayTradeStatusSuccess || status == alipayTradeStatusFinished, nil
}
