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

	"github.com/gin-contrib/sessions"
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
		return "", errors.New(res.Message)
	}
	if res.Data == "" {
		return "", errors.New("验证码错误或已过期")
	}
	return res.Data, nil
}

func WeChatAuth(c *gin.Context) {
	if !common.WeChatAuthEnabled {
		c.JSON(http.StatusOK, gin.H{
			"message": "管理员未开启通过微信登录以及注册",
			"success": false,
		})
		return
	}
	request := dto.WeChatAuthRequest{}
	switch c.Request.Method {
	case http.MethodGet:
		if _, present := c.Request.URL.Query()["invitation_code"]; present {
			// Keep GET only for invitation-free legacy login. New registrations must
			// send invitation codes in the POST body so access logs and referrers do
			// not carry the plaintext code.
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
	wechatId, err := getWeChatIdByCode(request.Code)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"message": err.Error(),
			"success": false,
		})
		return
	}
	user := model.User{}
	boundUser, identityErr := model.GetUserByAuthIdentity(model.AuthIdentityProviderWeChat, wechatId)
	if identityErr == nil {
		user = *boundUser
		if user.Id == 0 || user.DeletedAt.Valid {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "用户已注销",
			})
			return
		}
	} else if !errors.Is(identityErr, gorm.ErrRecordNotFound) {
		common.ApiError(c, identityErr)
		return
	} else if model.IsWeChatIdAlreadyTaken(wechatId) {
		user.WeChatId = wechatId
		if err := user.FillUserByWeChatId(); err != nil || user.Id == 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "用户已注销",
			})
			return
		}
		if err := model.EnsureAuthIdentity(user.Id, model.AuthIdentityProviderWeChat, wechatId); err != nil {
			common.ApiError(c, err)
			return
		}
	} else {
		if common.RegisterEnabled {
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
					return model.CreateBuiltInAuthIdentityWithTx(tx, createdUser, model.AuthIdentityProviderWeChat, wechatId)
				},
			})
			if errors.Is(registrationErr, model.ErrAuthIdentityAlreadyBound) {
				winner, winnerErr := model.GetUserByAuthIdentity(model.AuthIdentityProviderWeChat, wechatId)
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
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": registrationErr.Error(),
				})
				return
			}
		} else {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "管理员关闭了新用户注册",
			})
			return
		}
	}

	if user.Status != common.UserStatusEnabled {
		c.JSON(http.StatusOK, gin.H{
			"message": "用户已被封禁",
			"success": false,
		})
		return
	}
	setupLogin(&user, c)
}

type wechatBindRequest struct {
	Code string `json:"code"`
}

func WeChatBind(c *gin.Context) {
	if !common.WeChatAuthEnabled {
		c.JSON(http.StatusOK, gin.H{
			"message": "管理员未开启通过微信登录以及注册",
			"success": false,
		})
		return
	}
	var req wechatBindRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的请求",
		})
		return
	}
	code := req.Code
	wechatId, err := getWeChatIdByCode(code)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"message": err.Error(),
			"success": false,
		})
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
	legacyOwner := model.User{WeChatId: wechatId}
	if model.IsWeChatIdAlreadyTaken(wechatId) {
		if fillErr := legacyOwner.FillUserByWeChatId(); fillErr == nil && legacyOwner.Id != 0 {
			if ensureErr := model.EnsureAuthIdentity(legacyOwner.Id, model.AuthIdentityProviderWeChat, wechatId); ensureErr != nil {
				common.ApiError(c, ensureErr)
				return
			}
		}
	}
	err = model.SetBuiltInAuthIdentity(&user, model.AuthIdentityProviderWeChat, wechatId)
	if err != nil {
		if errors.Is(err, model.ErrAuthIdentityAlreadyBound) {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "该微信账号已被绑定",
			})
			return
		}
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}
