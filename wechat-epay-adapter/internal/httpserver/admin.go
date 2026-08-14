package httpserver

import (
	"crypto/sha256"
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/admin"
	"github.com/gin-gonic/gin"
)

const adminActorID = "admin_bearer"

type AdminHandler struct {
	service *admin.Service
}

func NewAdminHandler(service *admin.Service) *AdminHandler {
	return &AdminHandler{service: service}
}

func AdminBearer(expectedToken string) gin.HandlerFunc {
	return bearerToken(expectedToken)
}

func MetricsBearer(expectedToken string) gin.HandlerFunc {
	return bearerToken(expectedToken)
}

func bearerToken(expectedToken string) gin.HandlerFunc {
	expectedHash := sha256.Sum256([]byte(expectedToken))
	return func(context *gin.Context) {
		authorization := context.GetHeader("Authorization")
		candidate, hasBearer := strings.CutPrefix(authorization, "Bearer ")
		candidateHash := sha256.Sum256([]byte(candidate))
		if !hasBearer || subtle.ConstantTimeCompare(expectedHash[:], candidateHash[:]) != 1 {
			context.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		context.Next()
	}
}

func (handler *AdminHandler) GetOrder(context *gin.Context) {
	view, err := handler.service.GetOrder(context.Param("out_trade_no"))
	if err != nil {
		if admin.IsNotFound(err) {
			context.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		context.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "temporary_failure"})
		return
	}
	context.JSON(http.StatusOK, adminOrderResponse(view))
}

func (handler *AdminHandler) RetryNotification(context *gin.Context) {
	var request RetryNotificationRequest
	if err := context.ShouldBindJSON(&request); err != nil {
		context.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	request.Reason = strings.TrimSpace(request.Reason)
	if request.Reason == "" || len(request.Reason) > 256 || strings.ContainsAny(request.Reason, "\r\n") || containsSensitiveAuditValue(request.Reason) {
		context.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	requestID, _ := context.Get(RequestIDHeader)
	view, err := handler.service.RetryNotification(context.Param("out_trade_no"), request.Reason, adminActorID, requestID.(string))
	if err != nil {
		if admin.IsNotFound(err) {
			context.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "not_found"})
			return
		}
		if admin.IsRetryNotAllowed(err) {
			context.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "not_ready"})
			return
		}
		context.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "temporary_failure"})
		return
	}
	status := http.StatusOK
	if view.Resumed {
		status = StatusNotificationRetryAccepted
	}
	context.JSON(status, adminOrderResponse(view.OrderView))
}

func containsSensitiveAuditValue(value string) bool {
	lower := strings.ToLower(value)
	return strings.Contains(lower, "://") || strings.Contains(lower, "token") || strings.Contains(lower, "secret") || strings.Contains(lower, "password") || strings.Contains(lower, "signature") || strings.Contains(lower, "code_url") || strings.Contains(lower, "epay_key") || strings.Contains(lower, "api_v3")
}

func adminOrderResponse(view admin.OrderView) AdminOrderResponse {
	response := AdminOrderResponse{
		MerchantOrder:     view.Order.OutTradeNo,
		Status:            string(view.Order.Status),
		Amount:            view.Order.AmountText,
		WechatOrderMasked: view.WechatTransactionMask,
		CreatedAt:         view.Order.CreatedAt,
		PaidAt:            view.Order.PaidAt,
		NotifiedAt:        view.Order.NotifiedAt,
		LastError:         view.LastError,
	}
	if view.NotificationTask != nil {
		response.NotificationStatus = string(view.NotificationTask.State)
		response.NotificationAttempts = view.NotificationTask.AttemptCount
		response.NextAttemptAt = &view.NotificationTask.NextAttemptAt
	}
	return response
}
