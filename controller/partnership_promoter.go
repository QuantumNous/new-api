package controller

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

const partnershipPromoterPrefix = "/api/partnership/promoter"

var partnershipPromoterPathMap = map[string]string{
	"GET /me":                    "/api/promoter/me",
	"POST /me/open":              "/api/promoter/me/open",
	"GET /center":                "/api/promoter/center",
	"PATCH /referral-credential": "/api/promoter/referral-credential",
	"PUT /payout-profile":        "/api/promoter/payout-profile",
	"POST /withdrawals":          "/api/promoter/withdrawals",
}

func BuildInfistarPromoterSignature(timestamp string, userID string, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "." + userID))
	return hex.EncodeToString(mac.Sum(nil))
}

func PartnershipPromoterProxy(c *gin.Context) {
	session := sessions.Default(c)
	userID, ok := session.Get("id").(int)
	if !ok || userID <= 0 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgAuthNotLoggedIn),
		})
		return
	}

	baseURL := strings.TrimRight(strings.TrimSpace(system_setting.PartnershipPromoterApiBaseURL), "/")
	secret := strings.TrimSpace(system_setting.InfistarPromoterBridgeSecret)
	if baseURL == "" || secret == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "推广中心暂时无法访问，请稍后再试。",
		})
		return
	}

	targetPath, allowed := partnershipPromoterTargetPath(c.Request.Method, c.Request.URL.Path)
	if !allowed {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "unsupported promoter proxy path",
		})
		return
	}

	targetURL, err := url.Parse(baseURL + targetPath)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "推广中心暂时无法访问，请稍后再试。",
		})
		return
	}
	targetURL.RawQuery = c.Request.URL.RawQuery
	proxyStart := time.Now()
	proxyStatus := 0
	proxyErr := ""
	defer func() {
		common.SysLog(fmt.Sprintf(
			"[partnership-promoter-proxy] user_id=%d method=%s path=%s target=%s status=%d duration_ms=%d error=%q",
			userID,
			c.Request.Method,
			c.Request.URL.RequestURI(),
			targetURL.String(),
			proxyStatus,
			time.Since(proxyStart).Milliseconds(),
			proxyErr,
		))
	}()

	timeout := system_setting.PartnershipPromoterProxyTimeoutSeconds
	if timeout <= 0 {
		timeout = 5
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Duration(timeout)*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, c.Request.Method, targetURL.String(), c.Request.Body)
	if err != nil {
		proxyStatus = http.StatusServiceUnavailable
		proxyErr = err.Error()
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "推广中心暂时无法访问，请稍后再试。",
		})
		return
	}
	copyPromoterProxyHeaders(req.Header, c.Request.Header)

	userIDText := strconv.Itoa(userID)
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	req.Header.Set("X-Infistar-User-Id", userIDText)
	req.Header.Set("X-Infistar-User-Status", infistarUserStatus(session.Get("status")))
	req.Header.Set("X-Infistar-User-Timestamp", timestamp)
	req.Header.Set("X-Infistar-User-Signature", BuildInfistarPromoterSignature(timestamp, userIDText, secret))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		proxyStatus = http.StatusBadGateway
		proxyErr = err.Error()
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": "推广中心暂时无法访问，请稍后再试。",
		})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		proxyStatus = http.StatusBadGateway
		proxyErr = err.Error()
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": "推广中心暂时无法访问，请稍后再试。",
		})
		return
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/json; charset=utf-8"
	}
	proxyStatus = resp.StatusCode
	c.Data(resp.StatusCode, contentType, body)
}

func partnershipPromoterTargetPath(method string, requestPath string) (string, bool) {
	relativePath := strings.TrimPrefix(requestPath, partnershipPromoterPrefix)
	if relativePath == "" {
		relativePath = "/"
	}
	targetPath, ok := partnershipPromoterPathMap[fmt.Sprintf("%s %s", method, relativePath)]
	return targetPath, ok
}

func copyPromoterProxyHeaders(dst http.Header, src http.Header) {
	for key, values := range src {
		lowerKey := strings.ToLower(key)
		if strings.HasPrefix(lowerKey, "x-infistar-") || lowerKey == "host" || lowerKey == "new-api-user" || lowerKey == "accept-encoding" || isHopByHopHeader(lowerKey) {
			continue
		}
		for _, value := range values {
			dst.Add(key, value)
		}
	}
}

func isHopByHopHeader(lowerKey string) bool {
	switch lowerKey {
	case "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade":
		return true
	default:
		return false
	}
}

func infistarUserStatus(status interface{}) string {
	if statusValue, ok := status.(int); ok && statusValue == common.UserStatusDisabled {
		return "disabled"
	}
	return "normal"
}
