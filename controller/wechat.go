package controller

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type wechatLoginResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    string `json:"data"`
}

func getWeChatIdByCode(code string) (string, error) {
	if code == "" {
		return "", errors.New("无效的参数")
	}
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/api/wechat/user?code=%s", common.WeChatServerAddress, url.QueryEscape(code)), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", common.WeChatServerToken)
	client := http.Client{Timeout: 5 * time.Second}
	httpResponse, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer httpResponse.Body.Close()
	var res wechatLoginResponse
	if err := common.DecodeJson(httpResponse.Body, &res); err != nil {
		return "", err
	}
	if !res.Success {
		return "", errors.New(res.Message)
	}
	if res.Data == "" {
		return "", errors.New("验证码错误或已过期")
	}
	return res.Data, nil
}

func WeChatAuth(c *gin.Context) {
	if !common.WeChatAuthEnabled {
		c.JSON(http.StatusOK, gin.H{"message": "管理员未开启通过微信登录以及注册", "success": false})
		return
	}
	request := dto.WeChatAuthRequest{}
	switch c.Request.Method {
	case http.MethodGet:
		if _, present := c.Request.URL.Query()["invitation_code"]; present {
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			return
		}
		request.Code = c.Query("code")
	case http.MethodPost:
		query := c.Request.URL.Query()
		if _, present := query["code"]; present {
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			return
		}
		if _, present := query["invitation_code"]; present {
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			return
		}
		if err := common.DecodeJson(c.Request.Body, &request); err != nil {
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			return
		}
	default:
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	request.Code = strings.TrimSpace(request.Code)
	request.InvitationCode = strings.TrimSpace(request.InvitationCode)
	if request.Code == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	wechatID, err := getWeChatIdByCode(request.Code)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": err.Error(), "success": false})
		return
	}

	user := model.User{}
	boundUser, identityErr := model.GetUserByAuthIdentity(model.AuthIdentityProviderWeChat, wechatID)
	switch {
	case identityErr == nil:
		user = *boundUser
		if user.Id == 0 || user.DeletedAt.Valid {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "用户已注销"})
			return
		}
	case !errors.Is(identityErr, gorm.ErrRecordNotFound):
		common.ApiError(c, identityErr)
		return
	default:
		if !common.RegisterEnabled {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "管理员关闭了新用户注册"})
			return
		}
		if err := common.Validate.Struct(&request); err != nil {
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			return
		}
		user.Username, err = generateOAuthUsername("wechat_")
		if err != nil {
			common.ApiError(c, err)
			return
		}
		user.DisplayName = "WeChat User"
		user.Role = common.RoleCommonUser
		user.Status = common.UserStatusEnabled
		registrationErr := service.RegisterNewUser(service.NewUserRegistration{
			User:           &user,
			Method:         common.InvitationRegistrationMethodWeChat,
			InvitationCode: request.InvitationCode,
			CreateRelated: func(tx *gorm.DB, createdUser *model.User) error {
				return model.CreateBuiltInAuthIdentityWithTx(tx, createdUser, model.AuthIdentityProviderWeChat, wechatID)
			},
		})
		if errors.Is(registrationErr, model.ErrAuthIdentityAlreadyBound) {
			winner, winnerErr := model.GetUserByAuthIdentity(model.AuthIdentityProviderWeChat, wechatID)
			if winnerErr == nil && winner.Id != 0 && !winner.DeletedAt.Valid {
				user = *winner
				registrationErr = nil
			}
		}
		if registrationErr != nil {
			if errors.Is(registrationErr, service.ErrInvitationCodeRejected) {
				common.ApiErrorI18n(c, i18n.MsgInvitationInvalid)
				return
			}
			if errors.Is(registrationErr, service.ErrRegistrationTemporarilyUnavailable) {
				common.SysError("WeChat registration temporarily unavailable: " + registrationErr.Error())
				common.ApiErrorI18n(c, i18n.MsgRetryLater)
				return
			}
			c.JSON(http.StatusOK, gin.H{"success": false, "message": registrationErr.Error()})
			return
		}
	}

	if user.Status != common.UserStatusEnabled {
		c.JSON(http.StatusOK, gin.H{"message": "用户已被封禁", "success": false})
		return
	}
	setupLogin(&user, c)
}

type wechatBindRequest struct {
	Code string `json:"code"`
}

func WeChatBind(c *gin.Context) {
	if !common.WeChatAuthEnabled {
		c.JSON(http.StatusOK, gin.H{"message": "管理员未开启通过微信登录以及注册", "success": false})
		return
	}
	var request wechatBindRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的请求"})
		return
	}
	wechatID, err := getWeChatIdByCode(strings.TrimSpace(request.Code))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": err.Error(), "success": false})
		return
	}
	user := model.User{Id: c.GetInt("id")}
	if user.Id == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "未登录"})
		return
	}
	if err := user.FillUserById(); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SetBuiltInAuthIdentity(&user, model.AuthIdentityProviderWeChat, wechatID); err != nil {
		if errors.Is(err, model.ErrAuthIdentityAlreadyBound) || errors.Is(err, model.ErrAuthIdentityProviderAlreadyBound) {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "该微信账号已被绑定"})
			return
		}
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}
