package httpserver

import (
	"net/http"
	"time"
)

const (
	RouteSubmit             = "/submit.php"
	RouteCashier            = "/cashier/{access_token}"
	RouteCashierStatus      = "/api/v1/cashier/{access_token}/status"
	RouteWechatNotification = "/api/v1/wechat/notify"
	RouteHealthLive         = "/health/live"
	RouteHealthReady        = "/health/ready"
	RouteMetrics            = "/metrics"
	RouteAdminOrder         = "/api/v1/admin/orders/{out_trade_no}"
	RouteAdminRetry         = "/api/v1/admin/orders/{out_trade_no}/retry-notification"
)

type RouteContract struct {
	Method         string
	Path           string
	Authentication string
}

var RouteContracts = []RouteContract{
	{Method: http.MethodPost, Path: RouteSubmit, Authentication: "epay_md5"},
	{Method: http.MethodGet, Path: RouteCashier, Authentication: "access_token"},
	{Method: http.MethodGet, Path: RouteCashierStatus, Authentication: "access_token"},
	{Method: http.MethodPost, Path: RouteWechatNotification, Authentication: "wechat_public_key"},
	{Method: http.MethodGet, Path: RouteHealthLive, Authentication: "none"},
	{Method: http.MethodGet, Path: RouteHealthReady, Authentication: "none"},
	{Method: http.MethodGet, Path: RouteMetrics, Authentication: "bearer_or_private_network"},
	{Method: http.MethodGet, Path: RouteAdminOrder, Authentication: "admin_bearer"},
	{Method: http.MethodPost, Path: RouteAdminRetry, Authentication: "admin_bearer"},
}

type SubmitRequest struct {
	PartnerID     string `form:"pid"`
	PaymentType   string `form:"type"`
	MerchantOrder string `form:"out_trade_no"`
	NotifyURL     string `form:"notify_url"`
	ReturnURL     string `form:"return_url"`
	Subject       string `form:"name"`
	Money         string `form:"money"`
	Device        string `form:"device"`
	SignType      string `form:"sign_type"`
	Signature     string `form:"sign"`
}

type CashierStatusResponse struct {
	MerchantOrder   string     `json:"out_trade_no"`
	Subject         string     `json:"subject"`
	Amount          string     `json:"amount"`
	Status          string     `json:"status"`
	ExpiresAt       time.Time  `json:"expires_at"`
	PaidAt          *time.Time `json:"paid_at"`
	NotifiedAt      *time.Time `json:"notified_at"`
	RedirectAllowed bool       `json:"redirect_allowed"`
	ReturnURL       *string    `json:"return_url"`
}

type AdminOrderResponse struct {
	MerchantOrder        string     `json:"out_trade_no"`
	Status               string     `json:"status"`
	Amount               string     `json:"amount"`
	WechatOrderMasked    string     `json:"wechat_trade_no"`
	CreatedAt            time.Time  `json:"created_at"`
	PaidAt               *time.Time `json:"paid_at"`
	NotifiedAt           *time.Time `json:"notified_at"`
	NotificationStatus   string     `json:"notification_status"`
	NotificationAttempts int        `json:"notification_attempts"`
	NextAttemptAt        *time.Time `json:"next_attempt_at"`
	LastError            string     `json:"last_error"`
}

type RetryNotificationRequest struct {
	Reason string `json:"reason"`
}

type WechatNotificationResult string

const (
	WechatNotificationPersisted    WechatNotificationResult = "persisted"
	WechatNotificationUnknownOrder WechatNotificationResult = "unknown_order"
	WechatNotificationInvalid      WechatNotificationResult = "invalid"
	WechatNotificationTemporary    WechatNotificationResult = "temporary_failure"
)

func StatusForWechatNotification(result WechatNotificationResult) int {
	switch result {
	case WechatNotificationPersisted:
		return http.StatusNoContent
	case WechatNotificationUnknownOrder:
		return http.StatusOK
	case WechatNotificationInvalid:
		return http.StatusBadRequest
	case WechatNotificationTemporary:
		return http.StatusInternalServerError
	default:
		return http.StatusInternalServerError
	}
}

const StatusNotificationRetryAccepted = http.StatusAccepted

type ErrorCode string

const (
	ErrorInvalidRequest  ErrorCode = "invalid_request"
	ErrorForbidden       ErrorCode = "forbidden"
	ErrorOrderConflict   ErrorCode = "order_conflict"
	ErrorNotFound        ErrorCode = "not_found"
	ErrorNotReady        ErrorCode = "not_ready"
	ErrorUpstreamFailure ErrorCode = "upstream_failure"
	ErrorTemporary       ErrorCode = "temporary_failure"
)

func StatusForError(code ErrorCode) int {
	switch code {
	case ErrorInvalidRequest:
		return http.StatusBadRequest
	case ErrorForbidden:
		return http.StatusForbidden
	case ErrorOrderConflict:
		return http.StatusConflict
	case ErrorNotFound:
		return http.StatusNotFound
	case ErrorNotReady:
		return http.StatusServiceUnavailable
	case ErrorUpstreamFailure:
		return http.StatusBadGateway
	case ErrorTemporary:
		return http.StatusInternalServerError
	default:
		return http.StatusInternalServerError
	}
}
