package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

type GitHubOAuthResponse struct {
	AccessToken string `json:"access_token"`
	Scope       string `json:"scope"`
	TokenType   string `json:"token_type"`
}

type GitHubUser struct {
	Login string `json:"login"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

func getGitHubUserInfoByCode(c *gin.Context, code string) (*GitHubUser, error) {
	if code == "" {
		return nil, oauth.NewOAuthError(i18n.MsgOAuthInvalidCode, nil)
	}
	values := map[string]string{"client_id": common.GitHubClientId, "client_secret": common.GitHubClientSecret, "code": code}
	jsonData, err := common.Marshal(values)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest("POST", "https://github.com/login/oauth/access_token", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	client := http.Client{
		Timeout: 20 * time.Second,
	}
	res, err := client.Do(req)
	if err != nil {
		common.SysLog(err.Error())
		return nil, oauth.NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, providerParams("GitHub"), err.Error())
	}
	defer res.Body.Close()
	var oAuthResponse GitHubOAuthResponse
	err = common.DecodeJson(res.Body, &oAuthResponse)
	if err != nil {
		return nil, err
	}
	req, err = http.NewRequest("GET", "https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", oAuthResponse.AccessToken))
	res2, err := client.Do(req)
	if err != nil {
		common.SysLog(err.Error())
		return nil, oauth.NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, providerParams("GitHub"), err.Error())
	}
	defer res2.Body.Close()
	var githubUser GitHubUser
	err = common.DecodeJson(res2.Body, &githubUser)
	if err != nil {
		return nil, err
	}
	if githubUser.Login == "" {
		return nil, oauth.NewOAuthError(i18n.MsgOAuthUserInfoEmpty, providerParams("GitHub"))
	}
	return &githubUser, nil
}

func GitHubOAuth(c *gin.Context) {
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
		GitHubBind(c)
		return
	}

	if !common.GitHubOAuthEnabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams("GitHub"))
		return
	}
	code := c.Query("code")
	githubUser, err := getGitHubUserInfoByCode(c, code)
	if err != nil {
		handleOAuthError(c, err)
		return
	}
	user := model.User{
		GitHubId: githubUser.Login,
	}
	// IsGitHubIdAlreadyTaken is unscoped
	if model.IsGitHubIdAlreadyTaken(user.GitHubId) {
		// FillUserByGitHubId is scoped
		err := user.FillUserByGitHubId()
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
		// if user.Id == 0 , user has been deleted
		if user.Id == 0 {
			common.ApiErrorI18n(c, i18n.MsgOAuthUserDeleted)
			return
		}
	} else {
		if common.RegisterEnabled {
			user.Username = "github_" + strconv.Itoa(model.GetMaxUserId()+1)
			if githubUser.Name != "" {
				user.DisplayName = githubUser.Name
			} else {
				user.DisplayName = "GitHub User"
			}
			user.Email = githubUser.Email
			user.Role = common.RoleCommonUser
			user.Status = common.UserStatusEnabled
			affCode := session.Get("aff")
			inviterId := 0
			if affCode != nil {
				inviterId, _ = model.GetUserIdByAffCode(affCode.(string))
			}

			if err := user.Insert(inviterId); err != nil {
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

func GitHubBind(c *gin.Context) {
	if !common.GitHubOAuthEnabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams("GitHub"))
		return
	}
	code := c.Query("code")
	githubUser, err := getGitHubUserInfoByCode(c, code)
	if err != nil {
		handleOAuthError(c, err)
		return
	}
	user := model.User{
		GitHubId: githubUser.Login,
	}
	if model.IsGitHubIdAlreadyTaken(user.GitHubId) {
		common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams("GitHub"))
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
	user.GitHubId = githubUser.Login
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
