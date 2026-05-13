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

type DiscordResponse struct {
	AccessToken  string `json:"access_token"`
	IDToken      string `json:"id_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
}

type DiscordUser struct {
	UID  string `json:"id"`
	ID   string `json:"username"`
	Name string `json:"global_name"`
}

func getDiscordUserInfoByCode(c *gin.Context, code string) (*DiscordUser, error) {
	if code == "" {
		return nil, oauth.NewOAuthError(i18n.MsgOAuthInvalidCode, nil)
	}

	values := url.Values{}
	values.Set("client_id", system_setting.GetDiscordSettings().ClientId)
	values.Set("client_secret", system_setting.GetDiscordSettings().ClientSecret)
	values.Set("code", code)
	values.Set("grant_type", "authorization_code")
	values.Set("redirect_uri", fmt.Sprintf("%s/oauth/discord", system_setting.ServerAddress))
	formData := values.Encode()
	req, err := http.NewRequest("POST", "https://discord.com/api/v10/oauth2/token", strings.NewReader(formData))
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
		return nil, oauth.NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, providerParams("Discord"), err.Error())
	}
	defer res.Body.Close()
	var discordResponse DiscordResponse
	err = common.DecodeJson(res.Body, &discordResponse)
	if err != nil {
		return nil, err
	}

	if discordResponse.AccessToken == "" {
		common.SysError("Discord 获取 Token 失败，请检查设置！")
		return nil, oauth.NewOAuthError(i18n.MsgOAuthTokenFailed, providerParams("Discord"))
	}

	req, err = http.NewRequest("GET", "https://discord.com/api/v10/users/@me", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+discordResponse.AccessToken)
	res2, err := client.Do(req)
	if err != nil {
		common.SysLog(err.Error())
		return nil, oauth.NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, providerParams("Discord"), err.Error())
	}
	defer res2.Body.Close()
	if res2.StatusCode != http.StatusOK {
		common.SysError("Discord 获取用户信息失败！请检查设置！")
		return nil, oauth.NewOAuthError(i18n.MsgOAuthGetUserErr, nil)
	}

	var discordUser DiscordUser
	err = common.DecodeJson(res2.Body, &discordUser)
	if err != nil {
		return nil, err
	}
	if discordUser.UID == "" || discordUser.ID == "" {
		common.SysError("Discord 获取用户信息为空！请检查设置！")
		return nil, oauth.NewOAuthError(i18n.MsgOAuthUserInfoEmpty, providerParams("Discord"))
	}
	return &discordUser, nil
}

func DiscordOAuth(c *gin.Context) {
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
		DiscordBind(c)
		return
	}
	if !system_setting.GetDiscordSettings().Enabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams("Discord"))
		return
	}
	code := c.Query("code")
	discordUser, err := getDiscordUserInfoByCode(c, code)
	if err != nil {
		handleOAuthError(c, err)
		return
	}
	user := model.User{
		DiscordId: discordUser.UID,
	}
	if model.IsDiscordIdAlreadyTaken(user.DiscordId) {
		err := user.FillUserByDiscordId()
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	} else {
		if common.RegisterEnabled {
			if discordUser.ID != "" {
				user.Username = discordUser.ID
			} else {
				user.Username = "discord_" + strconv.Itoa(model.GetMaxUserId()+1)
			}
			if discordUser.Name != "" {
				user.DisplayName = discordUser.Name
			} else {
				user.DisplayName = "Discord User"
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

func DiscordBind(c *gin.Context) {
	if !system_setting.GetDiscordSettings().Enabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams("Discord"))
		return
	}
	code := c.Query("code")
	discordUser, err := getDiscordUserInfoByCode(c, code)
	if err != nil {
		handleOAuthError(c, err)
		return
	}
	user := model.User{
		DiscordId: discordUser.UID,
	}
	if model.IsDiscordIdAlreadyTaken(user.DiscordId) {
		common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams("Discord"))
		return
	}
	session := sessions.Default(c)
	id := session.Get("id")
	user.Id = id.(int)
	err = user.FillUserById()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user.DiscordId = discordUser.UID
	err = user.Update(false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "bind",
	})
}
