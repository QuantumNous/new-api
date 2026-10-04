package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

const (
	// The legacy Telegram widget has no nonce. Keep its signed assertion short-lived
	// so captured callbacks cannot be reused indefinitely.
	telegramAuthorizationMaxAge     = 5 * time.Minute
	telegramAuthorizationFutureSkew = 2 * time.Minute
)

func TelegramBind(c *gin.Context) {
	if !common.TelegramOAuthEnabled {
		c.JSON(200, gin.H{
			"message": "管理员未开启通过 Telegram 登录以及注册",
			"success": false,
		})
		return
	}
	params := c.Request.URL.Query()
	telegramId, err := verifyTelegramAuthorization(params, common.TelegramBotToken, time.Now())
	if err != nil {
		common.SysLog("TelegramBind authorization failed: " + err.Error())
		c.JSON(200, gin.H{
			"message": "无效的请求",
			"success": false,
		})
		return
	}
	if model.IsTelegramIdAlreadyTaken(telegramId) {
		c.JSON(200, gin.H{
			"message": "该 Telegram 账户已被绑定",
			"success": false,
		})
		return
	}

	session := sessions.Default(c)
	id := session.Get("id")
	user := model.User{Id: id.(int)}
	if err := user.FillUserById(); err != nil {
		c.JSON(200, gin.H{
			"message": err.Error(),
			"success": false,
		})
		return
	}
	if user.Id == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "用户已注销",
		})
		return
	}
	user.TelegramId = telegramId
	if err := user.Update(false); err != nil {
		c.JSON(200, gin.H{
			"message": err.Error(),
			"success": false,
		})
		return
	}

	c.Redirect(302, common.ThemeAwarePath("/console/personal"))
}

func TelegramLogin(c *gin.Context) {
	if !common.TelegramOAuthEnabled {
		c.JSON(200, gin.H{
			"message": "管理员未开启通过 Telegram 登录以及注册",
			"success": false,
		})
		return
	}
	params := c.Request.URL.Query()
	telegramId, err := verifyTelegramAuthorization(params, common.TelegramBotToken, time.Now())
	if err != nil {
		common.SysLog("TelegramLogin authorization failed: " + err.Error())
		c.JSON(200, gin.H{
			"message": "无效的请求",
			"success": false,
		})
		return
	}

	user := model.User{TelegramId: telegramId}
	if err := user.FillUserByTelegramId(); err != nil {
		c.JSON(200, gin.H{
			"message": err.Error(),
			"success": false,
		})
		return
	}
	setupLogin(&user, c)
}

func verifyTelegramAuthorization(params url.Values, token string, now time.Time) (string, error) {
	if token == "" {
		return "", errors.New("telegram bot token is empty")
	}
	for _, values := range params {
		if len(values) != 1 {
			return "", errors.New("telegram authorization contains duplicate parameters")
		}
	}

	telegramID := params.Get("id")
	hash := params.Get("hash")
	authDateText := params.Get("auth_date")
	if telegramID == "" || hash == "" || authDateText == "" {
		return "", errors.New("telegram authorization is incomplete")
	}
	authDate, err := strconv.ParseInt(authDateText, 10, 64)
	if err != nil {
		return "", errors.New("telegram authorization date is invalid")
	}
	if authDate < now.Add(-telegramAuthorizationMaxAge).Unix() ||
		authDate > now.Add(telegramAuthorizationFutureSkew).Unix() {
		return "", errors.New("telegram authorization has expired")
	}

	strs := make([]string, 0, len(params)-1)
	for k, v := range params {
		if k == "hash" {
			continue
		}
		strs = append(strs, k+"="+v[0])
	}
	sort.Strings(strs)
	secret := sha256.Sum256([]byte(token))
	mac := hmac.New(sha256.New, secret[:])
	_, _ = mac.Write([]byte(strings.Join(strs, "\n")))
	providedHash, err := hex.DecodeString(hash)
	if err != nil || !hmac.Equal(providedHash, mac.Sum(nil)) {
		return "", errors.New("telegram authorization signature is invalid")
	}

	return telegramID, nil
}
