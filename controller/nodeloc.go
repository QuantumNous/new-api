package controller

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"one-api/common"
	"one-api/model"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

type NodeLocUser struct {
	Sub      string   `json:"sub"`      // 用户ID
	Username string   `json:"username"` // 用户名
	Email    string   `json:"email"`    // 邮箱地址
	Groups   []string `json:"groups"`   // 用户组列表
}

func NodeLocBind(c *gin.Context) {
	if !common.NodeLocOAuthEnabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "管理员未开启通过 NodeLoc 登录以及注册",
		})
		return
	}

	code := c.Query("code")
	nodeLocUser, err := getNodeLocUserInfoByCode(code, c)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	user := model.User{
		NodeLocId: nodeLocUser.Sub,
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
	user.Id = id.(int)

	err = user.FillUserById()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	user.NodeLocId = nodeLocUser.Sub
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

func getNodeLocUserInfoByCode(code string, c *gin.Context) (*NodeLocUser, error) {
	if code == "" {
		return nil, errors.New("invalid code")
	}

	// Get access token using Basic auth
	tokenEndpoint := "https://conn.nodeloc.cc/oauth2/token"
	credentials := common.NodeLocClientId + ":" + common.NodeLocClientSecret
	basicAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte(credentials))

	// Get redirect URI from request
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	redirectURI := fmt.Sprintf("%s://%s/api/oauth/nodeloc", scheme, c.Request.Host)

	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", redirectURI)

	req, err := http.NewRequest("POST", tokenEndpoint, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", basicAuth)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := http.Client{Timeout: 5 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return nil, errors.New("failed to connect to NodeLoc server")
	}
	defer res.Body.Close()

	var tokenRes struct {
		AccessToken string `json:"access_token"`
		Message     string `json:"message"`
	}
	if err := json.NewDecoder(res.Body).Decode(&tokenRes); err != nil {
		return nil, err
	}

	if tokenRes.AccessToken == "" {
		return nil, fmt.Errorf("failed to get access token: %s", tokenRes.Message)
	}

	// Get user info
	userEndpoint := "https://conn.nodeloc.cc/oauth2/userinfo"
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

	var nodeLocUser NodeLocUser
	if err := json.NewDecoder(res2.Body).Decode(&nodeLocUser); err != nil {
		return nil, err
	}

	if nodeLocUser.Sub == "" {
		return nil, errors.New("invalid user info returned")
	}

	return &nodeLocUser, nil
}

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
	if state == "" || session.Get("oauth_state") == nil || state != session.Get("oauth_state").(string) {
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
	nodeLocUser, err := getNodeLocUserInfoByCode(code, c)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	user := model.User{
		NodeLocId: nodeLocUser.Sub,
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
			user.Username = "nodeloc_" + strconv.Itoa(model.GetMaxUserId()+1)
			user.DisplayName = nodeLocUser.Username
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
