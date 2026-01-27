package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

// NodeLocUser represents the user information returned by NodeLoc OAuth API.
type NodeLocUser struct {
	Id         int    `json:"id"`
	Username   string `json:"username"`
	Name       string `json:"name"`
	AvatarUrl  string `json:"avatar_url"`
	TrustLevel int    `json:"trust_level"`
	Email      string `json:"email"`
}

// NodeLocBind handles binding a NodeLoc account to an existing user account.
// It requires the user to be logged in and will associate their NodeLoc ID with their account.
func NodeLocBind(c *gin.Context) {
	if !common.NodeLocOAuthEnabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "管理员未开启通过 NodeLoc 登录以及注册",
		})
		return
	}

	code := c.Query("code")
	nodelocUser, err := getNodeLocUserInfoByCode(code, c)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	user := model.User{
		NodeLocId: strconv.Itoa(nodelocUser.Id),
	}

	if model.IsNodeLocIdAlreadyTaken(user.NodeLocId) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "该 NodeLoc 账户已被绑定",
		})
		return
	}

	session := sessions.Default(c)
	id := session.Get("id")
	// Safe type assertion to avoid panic
	userId, ok := id.(int)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "用户未登录或会话无效",
		})
		return
	}
	user.Id = userId

	err = user.FillUserById()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	user.NodeLocId = strconv.Itoa(nodelocUser.Id)
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

// getNodeLocUserInfoByCode exchanges the OAuth authorization code for an access token
// and retrieves the user information from NodeLoc API.
func getNodeLocUserInfoByCode(code string, c *gin.Context) (*NodeLocUser, error) {
	if code == "" {
		return nil, errors.New("invalid code")
	}

	// Get access token
	tokenEndpoint := common.GetEnvOrDefaultString("NODELOC_TOKEN_ENDPOINT", "https://www.nodeloc.com/oauth-provider/token")

	// Get redirect URI from ServerAddress config
	redirectURI := strings.TrimSuffix(system_setting.ServerAddress, "/") + "/oauth/nodeloc"

	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", redirectURI)
	data.Set("client_id", common.NodeLocClientId)
	data.Set("client_secret", common.NodeLocClientSecret)

	req, err := http.NewRequest("POST", tokenEndpoint, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := http.Client{Timeout: 5 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return nil, errors.New("failed to connect to NodeLoc server")
	}
	defer res.Body.Close()

	// Validate HTTP status code for token exchange
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("NodeLoc token endpoint returned status %d", res.StatusCode)
	}

	var tokenRes struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		ExpiresIn   int    `json:"expires_in"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.NewDecoder(res.Body).Decode(&tokenRes); err != nil {
		return nil, err
	}

	if tokenRes.Error != "" {
		return nil, fmt.Errorf("failed to get access token: %s - %s", tokenRes.Error, tokenRes.ErrorDesc)
	}

	if tokenRes.AccessToken == "" {
		return nil, errors.New("failed to get access token")
	}

	// Get user info
	userEndpoint := common.GetEnvOrDefaultString("NODELOC_USER_ENDPOINT", "https://www.nodeloc.com/oauth-provider/userinfo")
	req, err = http.NewRequest("GET", userEndpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+tokenRes.AccessToken)
	req.Header.Set("Accept", "application/json")

	res2, err := client.Do(req)
	if err != nil {
		return nil, errors.New("failed to get user info from NodeLoc")
	}
	defer res2.Body.Close()

	// Validate HTTP status code for user info
	if res2.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("NodeLoc userinfo endpoint returned status %d", res2.StatusCode)
	}

	var nodelocUser NodeLocUser
	if err := json.NewDecoder(res2.Body).Decode(&nodelocUser); err != nil {
		return nil, err
	}

	if nodelocUser.Id == 0 {
		return nil, errors.New("invalid user info returned")
	}

	// If name is empty, use username
	if nodelocUser.Name == "" {
		nodelocUser.Name = nodelocUser.Username
	}

	return &nodelocUser, nil
}

// NodeLocOAuth handles the NodeLoc OAuth callback for login and registration.
// It validates the OAuth state, exchanges the code for user info, and either logs in
// an existing user or creates a new account.
func NodeLocOAuth(c *gin.Context) {
	session := sessions.Default(c)

	errorCode := c.Query("error")
	if errorCode != "" {
		errorDescription := c.Query("error_description")
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": errorDescription,
		})
		return
	}

	state := c.Query("state")
	// Safe type assertion for oauth_state validation
	sessionState := session.Get("oauth_state")
	expectedState, ok := sessionState.(string)
	if state == "" || sessionState == nil || !ok || state != expectedState {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "state is empty or not same",
		})
		return
	}

	username := session.Get("username")
	if username != nil {
		NodeLocBind(c)
		return
	}

	if !common.NodeLocOAuthEnabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "管理员未开启通过 NodeLoc 登录以及注册",
		})
		return
	}

	code := c.Query("code")
	nodelocUser, err := getNodeLocUserInfoByCode(code, c)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	user := model.User{
		NodeLocId: strconv.Itoa(nodelocUser.Id),
	}

	// Check if user exists
	if model.IsNodeLocIdAlreadyTaken(user.NodeLocId) {
		err := user.FillUserByNodeLocId()
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
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
	} else {
		if common.RegisterEnabled {
			if nodelocUser.TrustLevel >= common.NodeLocMinimumTrustLevel {
				// 使用 NodeLoc 用户名，如果已存在则添加唯一后缀
				// 使用时间戳和NodeLoc ID组合避免竞态条件
				username := nodelocUser.Username
				if model.IsUsernameExist(username) {
					username = fmt.Sprintf("%s_%d_%d", nodelocUser.Username, nodelocUser.Id, time.Now().UnixNano()%10000)
				}
				user.Username = username
				user.DisplayName = nodelocUser.Name
				user.Role = common.RoleCommonUser
				user.Status = common.UserStatusEnabled

				affCode := session.Get("aff")
				inviterId := 0
				// Safe type assertion for affCode
				if affCode != nil {
					if affCodeStr, ok := affCode.(string); ok {
						inviterId, _ = model.GetUserIdByAffCode(affCodeStr)
					}
				}

				if err := user.Insert(inviterId); err != nil {
					c.JSON(http.StatusOK, gin.H{
						"success": false,
						"message": err.Error(),
					})
					return
				}
				common.SysLog(fmt.Sprintf("NodeLoc user created: id=%d, username=%s, nodeloc_id=%s", user.Id, user.Username, user.NodeLocId))
			} else {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": "NodeLoc 信任等级未达到管理员设置的最低信任等级",
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
