package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	accountCenterSecretEnv    = "NEWAPI_ACCOUNT_CENTER_HMAC_SECRET"
	accountCenterPublicURLEnv = "NEWAPI_ACCOUNT_CENTER_PUBLIC_URL"
	accountCenterTimestamp    = "X-Meimaobing-Timestamp"
	accountCenterSignature    = "X-Meimaobing-Signature"
	accountCenterMaxBodyBytes = 16 << 10
	accountCenterMaxClockSkew = 5 * time.Minute
)

type accountCenterOverviewRequest struct {
	Subject string `json:"subject"`
}

// RedirectToAccountCenter lets the NewAPI dashboard link back to the
// Account Center without embedding a cross-origin destination in browser
// assets. The destination is a deployment-owned HTTPS URL, never a request
// parameter.
func RedirectToAccountCenter(c *gin.Context) {
	target, ok := accountCenterRedirectTarget()
	if !ok {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	c.Header("Cache-Control", "no-store")
	c.Redirect(http.StatusFound, target)
}

// GetAccountCenterOverview gives the trusted Account Center a minimal,
// subject-bound API Wallet summary. It is intentionally separate from the
// browser-authenticated dashboard API: the browser never receives this HMAC
// credential and the response contains no API key, session, or profile secret.
func GetAccountCenterOverview(c *gin.Context) {
	secret := strings.TrimSpace(os.Getenv(accountCenterSecretEnv))
	if len(secret) < 32 {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	if c.Request.URL.RawQuery != "" || c.Request.URL.ForceQuery {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid account center request"})
		return
	}
	mediaType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || mediaType != "application/json" {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{"success": false, "message": "content type must be json"})
		return
	}
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, accountCenterMaxBodyBytes+1))
	if err != nil || len(body) > accountCenterMaxBodyBytes {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid account center request"})
		return
	}
	if !validAccountCenterSignature(c, secret, body) {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "unauthorized"})
		return
	}
	var request accountCenterOverviewRequest
	if err := common.Unmarshal(body, &request); err != nil || strings.TrimSpace(request.Subject) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid account center request"})
		return
	}
	user, err := model.GetUserByOidcId(request.Subject)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    gin.H{"registered": false, "quota": 0, "used_quota": 0, "request_count": 0},
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "account center unavailable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"registered":    true,
			"quota":         user.Quota,
			"used_quota":    user.UsedQuota,
			"request_count": user.RequestCount,
		},
	})
}

func validAccountCenterSignature(c *gin.Context, secret string, body []byte) bool {
	timestamps := c.Request.Header.Values(accountCenterTimestamp)
	signatures := c.Request.Header.Values(accountCenterSignature)
	if len(timestamps) != 1 || len(signatures) != 1 {
		return false
	}
	timestamp := strings.TrimSpace(timestamps[0])
	signedAt, err := time.Parse(time.RFC3339Nano, timestamp)
	if err != nil || time.Since(signedAt) > accountCenterMaxClockSkew || signedAt.Sub(time.Now()) > accountCenterMaxClockSkew {
		return false
	}
	provided, err := hex.DecodeString(strings.TrimSpace(signatures[0]))
	if err != nil || len(provided) != sha256.Size {
		return false
	}
	digest := sha256.Sum256(body)
	payload := timestamp + "\n" + c.Request.Method + "\n" + c.Request.URL.EscapedPath() + "\n" + hex.EncodeToString(digest[:])
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(payload))
	return hmac.Equal(provided, mac.Sum(nil))
}

func accountCenterRedirectTarget() (string, bool) {
	target, err := url.Parse(strings.TrimSpace(os.Getenv(accountCenterPublicURLEnv)))
	if err != nil || target == nil || target.Scheme != "https" || target.Host == "" || target.User != nil || target.RawQuery != "" || target.Fragment != "" {
		return "", false
	}
	return target.String(), true
}
