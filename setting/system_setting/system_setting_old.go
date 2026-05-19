package system_setting

var ServerAddress = "http://localhost:3000"
var WorkerUrl = ""
var WorkerValidKey = ""
var WorkerAllowHttpImageRequestEnabled = false
var PromotionWebhookUrl = ""
var PromotionWebhookSecret = ""
var PartnershipPromoterApiBaseURL = ""
var InfistarPromoterBridgeSecret = ""
var PartnershipPromoterProxyTimeoutSeconds = 5

func EnableWorker() bool {
	return WorkerUrl != ""
}
