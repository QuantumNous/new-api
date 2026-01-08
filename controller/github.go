package controller

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

type GitHubOAuthResponse struct {
	AccessToken string `json:"access_token"`
	Scope       string `json:"scope"`
	TokenType   string `json:"token_type"`
}

type GitHubUser struct {
	Id    int64  `json:"id"`
	Login string `json:"login"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

func getGitHubUserInfoByCode(code string) (*GitHubUser, error) {
	if code == "" {
		return nil, errors.New("无效的参数")
	}
	values := map[string]string{"client_id": common.GitHubClientId, "client_secret": common.GitHubClientSecret, "code": code}
	jsonData, err := json.Marshal(values)
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
		return nil, errors.New("无法连接至 GitHub 服务器，请稍后重试！")
	}
	defer res.Body.Close()
	var oAuthResponse GitHubOAuthResponse
	err = json.NewDecoder(res.Body).Decode(&oAuthResponse)
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
		return nil, errors.New("无法连接至 GitHub 服务器，请稍后重试！")
	}
	defer res2.Body.Close()
	var githubUser GitHubUser
	err = json.NewDecoder(res2.Body).Decode(&githubUser)
	if err != nil {
		return nil, err
	}
	if githubUser.Id == 0 {
		return nil, errors.New("返回值非法，用户字段为空，请稍后重试！")
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
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "管理员未开启通过 GitHub 登录以及注册",
		})
		return
	}
	code := c.Query("code")
	githubUser, err := getGitHubUserInfoByCode(code)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 只使用不可变的数字ID作为唯一标识（安全）
	numericId := strconv.FormatInt(githubUser.Id, 10)
	user := model.User{GitHubId: numericId}

	// 只通过数字ID查找用户，防止账户劫持风险
	if model.IsGitHubIdAlreadyTaken(numericId) {
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
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "用户已注销",
			})
			return
		}
	} else {
		if common.RegisterEnabled {
			// 创建新账号，使用数字ID作为GitHub ID
			user.GitHubId = numericId

			// 使用重试机制避免用户名竞态条件
			// 最多重试5次
			maxRetries := 5
			var insertErr error
			for retry := 0; retry < maxRetries; retry++ {
				// 生成唯一用户名
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

				insertErr = user.Insert(inviterId)
				// 如果不是唯一约束错误（用户名重复），直接返回错误
				if insertErr != nil && !isDuplicateKeyError(insertErr) {
					break
				}
				// 如果插入成功，跳出循环
				if insertErr == nil {
					break
				}
				// 用户名重复，重试
				common.SysLog(fmt.Sprintf("用户名 %s 已存在，重试第 %d 次", user.Username, retry+1))
			}

			if insertErr != nil {
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

func GitHubBind(c *gin.Context) {
	if !common.GitHubOAuthEnabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "管理员未开启通过 GitHub 登录以及注册",
		})
		return
	}
	code := c.Query("code")
	githubUser, err := getGitHubUserInfoByCode(code)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 只检查不可变的数字ID是否已被绑定
	numericId := strconv.FormatInt(githubUser.Id, 10)
	isAlreadyBound := model.IsGitHubIdAlreadyTaken(numericId)

	if isAlreadyBound {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "该 GitHub 账户已被绑定",
		})
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
	user.GitHubId = strconv.FormatInt(githubUser.Id, 10)
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

func GenerateOAuthCode(c *gin.Context) {
	session := sessions.Default(c)
	state := common.GetRandomString(12)
	affCode := c.Query("aff")
	if affCode != "" {
		session.Set("aff", affCode)
	}
	session.Set("oauth_state", state)
	err := session.Save()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    state,
	})
}

// isDuplicateKeyError 检查错误是否是数据库唯一约束冲突
// 通过检测数据库特定的错误码或消息来精确识别
func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}

	errMsg := strings.ToLower(err.Error())

	// MySQL: Error 1062: Duplicate entry
	// 检查 "Duplicate entry" 或 "ER_DUP_ENTRY"
	if strings.Contains(errMsg, "duplicate entry") || strings.Contains(errMsg, "er_dup_entry") {
		return true
	}

	// PostgreSQL: SQLSTATE 23505 - unique_violation
	// 检查 "duplicate key value violates unique constraint" 或 "23505"
	if strings.Contains(errMsg, "duplicate key value violates unique constraint") ||
		strings.Contains(errMsg, "sqlstate 23505") ||
		strings.Contains(errMsg, "23505") {
		return true
	}

	// SQLite: "UNIQUE constraint failed"
	// 精确匹配 "UNIQUE constraint failed"
	if strings.Contains(errMsg, "unique constraint failed") {
		return true
	}

	return false
}
