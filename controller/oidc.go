package controller

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

type OidcResponse struct {
	AccessToken  string `json:"access_token"`
	IDToken      string `json:"id_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
}

type OidcUser struct {
	OpenID            string `json:"sub"`
	Email             string `json:"email"`
	Name              string `json:"name"`
	PreferredUsername string `json:"preferred_username"`
	Picture           string `json:"picture"`
}

func getOidcUserInfoByCode(c *gin.Context, code string) (*OidcUser, error) {
	if code == "" {
		return nil, oauth.NewOAuthError(i18n.MsgOAuthInvalidCode, nil)
	}

	values := url.Values{}
	values.Set("client_id", system_setting.GetOIDCSettings().ClientId)
	values.Set("client_secret", system_setting.GetOIDCSettings().ClientSecret)
	values.Set("code", code)
	values.Set("grant_type", "authorization_code")
	values.Set("redirect_uri", fmt.Sprintf("%s/oauth/oidc", system_setting.ServerAddress))
	formData := values.Encode()
	req, err := http.NewRequest("POST", system_setting.GetOIDCSettings().TokenEndpoint, strings.NewReader(formData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	client := http.Client{
		Timeout: 5 * time.Second,
	}
	res, err := client.Do(req)
	if err != nil {
		common.SysLog(err.Error())
		return nil, oauth.NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, providerParams("OIDC"), err.Error())
	}
	defer res.Body.Close()
	var oidcResponse OidcResponse
	err = common.DecodeJson(res.Body, &oidcResponse)
	if err != nil {
		return nil, err
	}

	if oidcResponse.AccessToken == "" {
		common.SysLog("OIDC 获取 Token 失败，请检查设置！")
		return nil, oauth.NewOAuthError(i18n.MsgOAuthTokenFailed, providerParams("OIDC"))
	}

	req, err = http.NewRequest("GET", system_setting.GetOIDCSettings().UserInfoEndpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+oidcResponse.AccessToken)
	res2, err := client.Do(req)
	if err != nil {
		common.SysLog(err.Error())
		return nil, oauth.NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, providerParams("OIDC"), err.Error())
	}
	defer res2.Body.Close()
	if res2.StatusCode != http.StatusOK {
		common.SysLog("OIDC 获取用户信息失败！请检查设置！")
		return nil, oauth.NewOAuthError(i18n.MsgOAuthGetUserErr, nil)
	}

	var oidcUser OidcUser
	err = common.DecodeJson(res2.Body, &oidcUser)
	if err != nil {
		return nil, err
	}
	if oidcUser.OpenID == "" || oidcUser.Email == "" {
		common.SysLog("OIDC 获取用户信息为空！请检查设置！")
		return nil, oauth.NewOAuthError(i18n.MsgOAuthUserInfoEmpty, providerParams("OIDC"))
	}
	return &oidcUser, nil
}

func OidcAuth(c *gin.Context) {
	session := sessions.Default(c)
	state := c.Query("state")
	if state == "" || session.Get("oauth_state") == nil || state != session.Get("oauth_state").(string) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "state is empty or not same",
		})
		return
	}
	username := session.Get("username")
	if username != nil {
		OidcBind(c)
		return
	}
	if !system_setting.GetOIDCSettings().Enabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams("OIDC"))
		return
	}
	code := c.Query("code")
	oidcUser, err := getOidcUserInfoByCode(c, code)
	if err != nil {
		handleOAuthError(c, err)
		return
	}
	user := model.User{
		OidcId: oidcUser.OpenID,
	}
	if model.IsOidcIdAlreadyTaken(user.OidcId) {
		err := user.FillUserByOidcId()
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	} else {
		if common.RegisterEnabled {
			user.Email = oidcUser.Email
			if oidcUser.PreferredUsername != "" {
				user.Username = oidcUser.PreferredUsername
			} else {
				user.Username = "oidc_" + strconv.Itoa(model.GetMaxUserId()+1)
			}
			if oidcUser.Name != "" {
				user.DisplayName = oidcUser.Name
			} else {
				user.DisplayName = "OIDC User"
			}
			err := user.Insert(0)
			if err != nil {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": err.Error(),
				})
				return
			}
		} else {
			common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
			return
		}
	}

	if user.Status != common.UserStatusEnabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthUserBanned)
		return
	}
	setupLogin(&user, c)
}

func OidcBind(c *gin.Context) {
	if !system_setting.GetOIDCSettings().Enabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams("OIDC"))
		return
	}
	code := c.Query("code")
	oidcUser, err := getOidcUserInfoByCode(c, code)
	if err != nil {
		handleOAuthError(c, err)
		return
	}
	user := model.User{
		OidcId: oidcUser.OpenID,
	}
	if model.IsOidcIdAlreadyTaken(user.OidcId) {
		common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams("OIDC"))
		return
	}
	session := sessions.Default(c)
	id := session.Get("id")
	// id := c.GetInt("id")  // critical bug!
	user.Id = id.(int)
	err = user.FillUserById()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user.OidcId = oidcUser.OpenID
	err = user.Update(false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "bind",
	})
	return
}
