package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func TelegramBind(c *gin.Context) {
	if !common.TelegramOAuthEnabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams("Telegram"))
		return
	}
	params := c.Request.URL.Query()
	if !checkTelegramAuthorization(params, common.TelegramBotToken) {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	telegramId := params["id"][0]
	if model.IsTelegramIdAlreadyTaken(telegramId) {
		common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams("Telegram"))
		return
	}

	session := sessions.Default(c)
	id := session.Get("id")
	user := model.User{Id: id.(int)}
	if err := user.FillUserById(); err != nil {
		common.ApiErrorI18n(c, i18n.MsgAuthUserInfoInvalid)
		return
	}
	if user.Id == 0 {
		common.ApiErrorI18n(c, i18n.MsgOAuthUserDeleted)
		return
	}
	user.TelegramId = telegramId
	if err := user.Update(false); err != nil {
		common.ApiError(c, err)
		return
	}

	c.Redirect(302, common.ThemeAwarePath("/console/personal"))
}

func TelegramLogin(c *gin.Context) {
	if !common.TelegramOAuthEnabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams("Telegram"))
		return
	}
	params := c.Request.URL.Query()
	if !checkTelegramAuthorization(params, common.TelegramBotToken) {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	telegramId := params["id"][0]
	if !model.IsTelegramIdAlreadyTaken(telegramId) {
		common.ApiErrorI18n(c, i18n.MsgUserTelegramNotBound)
		return
	}
	user := model.User{TelegramId: telegramId}
	if err := user.FillUserByTelegramId(); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorI18n(c, i18n.MsgOAuthUserDeleted)
			return
		}
		common.SysError("Telegram login failed to load user: " + err.Error())
		common.ApiError(c, err)
		return
	}
	setupLogin(&user, c)
}

func checkTelegramAuthorization(params map[string][]string, token string) bool {
	strs := []string{}
	var hash = ""
	for k, v := range params {
		if k == "hash" {
			hash = v[0]
			continue
		}
		strs = append(strs, k+"="+v[0])
	}
	sort.Strings(strs)
	var imploded = ""
	for _, s := range strs {
		if imploded != "" {
			imploded += "\n"
		}
		imploded += s
	}
	sha256hash := sha256.New()
	io.WriteString(sha256hash, token)
	hmachash := hmac.New(sha256.New, sha256hash.Sum(nil))
	io.WriteString(hmachash, imploded)
	ss := hex.EncodeToString(hmachash.Sum(nil))
	return hash == ss
}
