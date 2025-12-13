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

type OidcResponse struct {
	AccessToken  string `json:"access_token"`
	IDToken      string `json:"id_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
}

type OidcUser struct {
	OpenID            string   `json:"sub"`
	Email             string   `json:"email"`
	Name              string   `json:"name"`
	PreferredUsername string   `json:"preferred_username"`
	Picture           string   `json:"picture"`
	Roles             []string `json:"roles"` // 角色列表，直接从 JSON 中获取
}

func getOidcUserInfoByCode(code string) (*OidcUser, error) {
	if code == "" {
		return nil, errors.New("无效的参数")
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
		return nil, errors.New("无法连接至 OIDC 服务器，请稍后重试！")
	}
	defer res.Body.Close()
	var oidcResponse OidcResponse
	err = json.NewDecoder(res.Body).Decode(&oidcResponse)
	if err != nil {
		return nil, err
	}

	if oidcResponse.AccessToken == "" {
		common.SysLog("OIDC 获取 Token 失败，请检查设置！")
		return nil, errors.New("OIDC 获取 Token 失败，请检查设置！")
	}

	req, err = http.NewRequest("GET", system_setting.GetOIDCSettings().UserInfoEndpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+oidcResponse.AccessToken)
	res2, err := client.Do(req)
	if err != nil {
		common.SysLog(err.Error())
		return nil, errors.New("无法连接至 OIDC 服务器，请稍后重试！")
	}
	defer res2.Body.Close()
	if res2.StatusCode != http.StatusOK {
		common.SysLog("OIDC 获取用户信息失败！请检查设置！")
		return nil, errors.New("OIDC 获取用户信息失败！请检查设置！")
	}

	// 直接解析用户信息到结构体
	var oidcUser OidcUser
	err = json.NewDecoder(res2.Body).Decode(&oidcUser)
	if err != nil {
		return nil, err
	}

	if oidcUser.OpenID == "" || oidcUser.Email == "" {
		common.SysLog("OIDC 获取用户信息为空！请检查设置！")
		return nil, errors.New("OIDC 获取用户信息为空！请检查设置！")
	}
	return &oidcUser, nil
}

// getGroupAndRoleFromRoles 从角色列表中获取用户组和是否为管理员
// 规则：如果有 admin 角色，则提升为管理员；用户组设为第一个不为 admin 的角色
func getGroupAndRoleFromRoles(roles []string) (group string, isAdmin bool) {
	for _, role := range roles {
		if role == "admin" {
			isAdmin = true
		} else if group == "" {
			group = role
		}
	}
	return
}

// updateUserFromRoles 根据角色更新用户组和管理员状态
func updateUserFromRoles(user *model.User, roles []string) {
	if !system_setting.GetOIDCSettings().RoleClaimEnabled || len(roles) == 0 {
		return
	}
	group, isAdmin := getGroupAndRoleFromRoles(roles)
	needUpdate := false
	if group != "" && user.Group != group {
		user.Group = group
		needUpdate = true
	}
	if isAdmin && user.Role < common.RoleAdminUser {
		user.Role = common.RoleAdminUser
		needUpdate = true
	}
	if needUpdate {
		if err := user.Update(false); err != nil {
			common.SysLog("OIDC 更新用户信息失败: " + err.Error())
		}
	}
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
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "管理员未开启通过 OIDC 登录以及注册",
		})
		return
	}
	code := c.Query("code")
	oidcUser, err := getOidcUserInfoByCode(code)
	if err != nil {
		common.ApiError(c, err)
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
		// 如果启用了角色声明，更新用户组和管理员状态
		updateUserFromRoles(&user, oidcUser.Roles)
	} else {
		// 检查是否启用了邮箱自动合并功能
		if system_setting.GetOIDCSettings().AutoMergeEnabled && oidcUser.Email != "" {
			existingUser := model.User{Email: oidcUser.Email}
			err := existingUser.FillUserByEmail()
			// FillUserByEmail 返回 nil 时，检查 Id 是否非零来确认用户存在
			if err == nil && existingUser.Id != 0 {
				// 用户已存在，合并 OIDC ID
				existingUser.OidcId = oidcUser.OpenID
				if err := existingUser.Update(false); err != nil {
					c.JSON(http.StatusOK, gin.H{
						"success": false,
						"message": "自动合并用户失败: " + err.Error(),
					})
					return
				}
				common.SysLog(fmt.Sprintf("OIDC 自动合并用户成功，用户ID: %d", existingUser.Id))
				user = existingUser
				// 如果启用了角色声明，更新用户组和管理员状态
				updateUserFromRoles(&user, oidcUser.Roles)
				if user.Status != common.UserStatusEnabled {
					c.JSON(http.StatusOK, gin.H{
						"message": "用户已被封禁",
						"success": false,
					})
					return
				}
				setupLogin(&user, c)
				return
			}
		}

		// 新用户注册
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
			// 如果启用了角色声明，设置用户组和管理员状态（新用户直接设置）
			if system_setting.GetOIDCSettings().RoleClaimEnabled && len(oidcUser.Roles) > 0 {
				group, isAdmin := getGroupAndRoleFromRoles(oidcUser.Roles)
				if group != "" {
					user.Group = group
				}
				if isAdmin {
					user.Role = common.RoleAdminUser
				}
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

func OidcBind(c *gin.Context) {
	if !system_setting.GetOIDCSettings().Enabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "管理员未开启通过 OIDC 登录以及注册",
		})
		return
	}
	code := c.Query("code")
	oidcUser, err := getOidcUserInfoByCode(code)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user := model.User{
		OidcId: oidcUser.OpenID,
	}
	if model.IsOidcIdAlreadyTaken(user.OidcId) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "该 OIDC 账户已被绑定",
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
