package httpserver

import (
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/config"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/store"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/wechat"
	"github.com/gin-gonic/gin"
)

type WechatNotificationHandler struct {
	store      *store.Store
	verifier   wechat.NotificationVerifier
	merchantID string
	appID      string
}

func NewWechatNotificationHandler(database *store.Store, verifier wechat.NotificationVerifier, appConfig config.Config) *WechatNotificationHandler {
	return &WechatNotificationHandler{store: database, verifier: verifier, merchantID: appConfig.WechatMerchantID, appID: appConfig.WechatAppID}
}

func (handler *WechatNotificationHandler) Handle(context *gin.Context) {
	body, err := io.ReadAll(context.Request.Body)
	if err != nil {
		context.Status(http.StatusBadRequest)
		return
	}
	notice, err := handler.verifier.VerifyAndDecrypt(context.Request.Context(), wechat.NotificationHeaders{
		Timestamp: context.GetHeader("Wechatpay-Timestamp"), Nonce: context.GetHeader("Wechatpay-Nonce"),
		Signature: context.GetHeader("Wechatpay-Signature"), Serial: context.GetHeader("Wechatpay-Serial"),
	}, body)
	if err != nil {
		context.Status(http.StatusBadRequest)
		return
	}
	result, err := handler.store.ConfirmWechatPayment(store.ConfirmWechatPaymentInput{Notice: notice, ExpectedMerchant: handler.merchantID, ExpectedAppID: handler.appID})
	if err != nil {
		context.Status(http.StatusInternalServerError)
		return
	}
	if result.UnknownOrder {
		context.Status(http.StatusOK)
		return
	}
	context.Status(http.StatusNoContent)
}
