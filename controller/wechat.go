package controller

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

var (
	errWeChatInvalidCode        = errors.New("wechat code is empty")
	errWeChatVerificationFailed = errors.New("wechat verification failed")
)

type wechatLoginResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    string `json:"data"`
}

func getWeChatIdByCode(code string) (string, error) {
	if code == "" {
		return "", errWeChatInvalidCode
	}
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/api/wechat/user?code=%s", common.WeChatServerAddress, url.QueryEscape(code)), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", common.WeChatServerToken)
	client := http.Client{
		Timeout: 5 * time.Second,
	}
	httpResponse, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer httpResponse.Body.Close()
	var res wechatLoginResponse
	err = common.DecodeJson(httpResponse.Body, &res)
	if err != nil {
		return "", err
	}
	if !res.Success {
		return "", errWeChatVerificationFailed
	}
	if res.Data == "" {
		return "", errWeChatVerificationFailed
	}
	return res.Data, nil
}

func apiWeChatError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, errWeChatInvalidCode):
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
	case errors.Is(err, errWeChatVerificationFailed):
		common.ApiErrorI18n(c, i18n.MsgUserVerificationCodeError)
	default:
		common.SysError("wechat auth failed: " + err.Error())
		common.ApiErrorI18n(c, i18n.MsgOAuthConnectFailed, map[string]any{"Provider": "WeChat"})
	}
}

func WeChatAuth(c *gin.Context) {
	if !common.WeChatAuthEnabled {
		common.ApiErrorI18n(c, i18n.MsgWeChatNotEnabled)
		return
	}
	code := c.Query("code")
	wechatId, err := getWeChatIdByCode(code)
	if err != nil {
		apiWeChatError(c, err)
		return
	}
	user := model.User{
		WeChatId: wechatId,
	}
	if model.IsWeChatIdAlreadyTaken(wechatId) {
		err := user.FillUserByWeChatId()
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if user.Id == 0 {
			common.ApiErrorI18n(c, i18n.MsgOAuthUserDeleted)
			return
		}
	} else {
		if common.RegisterEnabled {
			user.Username = "wechat_" + strconv.Itoa(model.GetMaxUserId()+1)
			user.DisplayName = "WeChat User"
			user.Role = common.RoleCommonUser
			user.Status = common.UserStatusEnabled

			if err := user.Insert(0); err != nil {
				common.ApiError(c, err)
				return
			}
		} else {
			common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
			return
		}
	}

	if user.Status != common.UserStatusEnabled {
		common.ApiErrorI18n(c, i18n.MsgUserDisabled)
		return
	}
	setupLogin(&user, c)
}

type wechatBindRequest struct {
	Code string `json:"code"`
}

func WeChatBind(c *gin.Context) {
	if !common.WeChatAuthEnabled {
		common.ApiErrorI18n(c, i18n.MsgWeChatNotEnabled)
		return
	}
	var req wechatBindRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	code := req.Code
	wechatId, err := getWeChatIdByCode(code)
	if err != nil {
		apiWeChatError(c, err)
		return
	}
	if model.IsWeChatIdAlreadyTaken(wechatId) {
		common.ApiErrorI18n(c, i18n.MsgWeChatAccountUsed)
		return
	}
	session := sessions.Default(c)
	id := session.Get("id")
	user := model.User{
		Id: id.(int),
	}
	err = user.FillUserById()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user.WeChatId = wechatId
	err = user.Update(false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}
