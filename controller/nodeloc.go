package controller

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"one-api/common"
	"one-api/model"
	"one-api/setting"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

type NodelocUser struct {
	Id         int    `json:"sub"`
	Username   string `json:"username"`
	Name       string `json:"name"`
	Active     bool   `json:"active"`
	TrustLevel int    `json:"trust_level"`
	Silenced   bool   `json:"silenced"`
}

func NodelocBind(c *gin.Context) {
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
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	user := model.User{
		LinuxDOId: strconv.Itoa(nodeLocUser.Id),
	}

	if model.IsLinuxDOIdAlreadyTaken(user.LinuxDOId) {
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
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	user.LinuxDOId = strconv.Itoa(nodeLocUser.Id)
	err = user.Update(false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "bind",
	})
}

func getNodeLocUserInfoByCode(code string, c *gin.Context) (*NodelocUser, error) {
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
	redirectURI := fmt.Sprintf("%s://%s/oauth/nodeloc", scheme, c.Request.Host)

	// 打印响应体内容用于调试
	fmt.Printf("redirectURI: %s\n", redirectURI)

	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", setting.ServerAddress+"/oauth/nodeloc")

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

	// 读取响应体内容
	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	// 打印响应体内容用于调试
	fmt.Printf("Response Body: %s\n", string(bodyBytes))

	var tokenRes struct {
		AccessToken string `json:"access_token"`
		IdToken     string `json:"id_token"`
		ExpiresIn   int    `json:"expires_in"`
		Scope       string `json:"scope"`
		TokenType   string `json:"token_type"`
	}

	// 使用Unmarshal解析已读取的响应体
	if err := json.Unmarshal(bodyBytes, &tokenRes); err != nil {
		return nil, fmt.Errorf("NodeLoc 序列化失败: %v", err)
	}

	if tokenRes.AccessToken == "" {
		return nil, fmt.Errorf("NodeLoc 授权失败!")
	}

	// 如果存在ID令牌，尝试从中解析用户信息
	if tokenRes.IdToken != "" {
		nodeLocUser, err := parseUserInfoFromIdToken(tokenRes.IdToken)
		if err == nil && nodeLocUser.Id != 0 {
			return nodeLocUser, nil
		}
		// 如果解析失败，继续使用userinfo端点
		fmt.Printf("从ID令牌解析用户信息失败: %v\n", err)
	}

	// 使用userinfo端点获取用户信息
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

	// 读取响应体内容
	bodyBytes2, err := io.ReadAll(res2.Body)
	if err != nil {
		return nil, err
	}

	// 打印响应体内容用于调试
	fmt.Printf("UserInfo Response Body: %s\n", string(bodyBytes2))

	var nodeLocUser NodelocUser
	if err := json.Unmarshal(bodyBytes2, &nodeLocUser); err != nil {
		return nil, fmt.Errorf("解析用户信息失败: %v", err)
	}

	if nodeLocUser.Id == 0 {
		return nil, errors.New("invalid user info returned")
	}

	return &nodeLocUser, nil
}

// 从ID令牌中解析用户信息
func parseUserInfoFromIdToken(idToken string) (*NodelocUser, error) {
	// 分割JWT
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return nil, errors.New("invalid JWT format")
	}

	// 解码有效载荷部分（第二部分）
	// 需要处理base64url编码的填充问题
	payload := parts[1]
	if l := len(payload) % 4; l > 0 {
		payload += strings.Repeat("=", 4-l)
	}

	decoded, err := base64.URLEncoding.DecodeString(payload)
	if err != nil {
		return nil, fmt.Errorf("解码JWT payload失败: %v", err)
	}

	// 打印解码后的payload用于调试
	fmt.Printf("Decoded JWT payload: %s\n", string(decoded))

	// 解析JSON
	var claims struct {
		Sub               string   `json:"sub"`
		Name              string   `json:"name"`
		PreferredUsername string   `json:"preferred_username"`
		Email             string   `json:"email"`
		EmailVerified     bool     `json:"email_verified"`
		Groups            []string `json:"groups"`
		Picture           string   `json:"picture"`
	}

	if err := json.Unmarshal(decoded, &claims); err != nil {
		return nil, fmt.Errorf("解析JWT claims失败: %v", err)
	}

	// 将claims映射到NodelocUser
	userId, _ := strconv.ParseInt(claims.Sub, 10, 64)
	user := &NodelocUser{
		Id:       int(userId),
		Username: claims.PreferredUsername,
		// 根据需要添加其他字段
		Name: claims.Name,
	}

	return user, nil
}

func NodelocOAuth(c *gin.Context) {
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
	if state == "" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "state is empty or not same",
		})
		return
	}

	username := session.Get("username")
	if username != nil {
		NodelocBind(c)
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
	fmt.Printf("Code: %s\n", code)
	nodeLocUser, err := getNodeLocUserInfoByCode(code, c)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	user := model.User{
		LinuxDOId: strconv.Itoa(nodeLocUser.Id),
	}

	// Check if user exists
	if model.IsLinuxDOIdAlreadyTaken(user.LinuxDOId) {
		err := user.FillUserByLinuxDOId()
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
			user.Username = "NodeLoc_" + nodeLocUser.Username
			user.DisplayName = nodeLocUser.Name
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
