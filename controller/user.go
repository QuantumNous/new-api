package controller

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"one-api/common"
	"one-api/dto"
	"one-api/logger"
	"one-api/model"
	"one-api/setting"
	"one-api/setting/operation_setting"
	"strconv"
	"time"
	"strings"
	"sync"

	"one-api/constant"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// validateAvatar 验证头像数据
func validateAvatar(avatarData string) error {
	if avatarData == "" {
		return nil // 允许空头像
	}

	// 检查是否是有效的base64数据
	if !strings.HasPrefix(avatarData, "data:image/") {
		return fmt.Errorf("头像必须是有效的图片格式")
	}

	// 提取base64数据部分
	parts := strings.Split(avatarData, ",")
	if len(parts) != 2 {
		return fmt.Errorf("头像数据格式无效")
	}

	// 检查MIME类型
	mimeType := parts[0]
	allowedTypes := []string{
		"data:image/jpeg;base64",
		"data:image/jpg;base64",
		"data:image/png;base64",
		"data:image/gif;base64",
		"data:image/webp;base64",
	}

	isValidType := false
	for _, allowedType := range allowedTypes {
		if mimeType == allowedType {
			isValidType = true
			break
		}
	}

	if !isValidType {
		return fmt.Errorf("不支持的图片格式，仅支持 JPEG、PNG、GIF、WebP")
	}

	// 解码base64数据检查大小
	base64Data := parts[1]
	decodedData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return fmt.Errorf("头像数据解码失败")
	}

	// 检查文件大小（2MB限制）
	const maxSize = 2 * 1024 * 1024 // 2MB
	if len(decodedData) > maxSize {
		return fmt.Errorf("头像文件大小不能超过2MB")
	}

	return nil
}

func Login(c *gin.Context) {
	if !common.PasswordLoginEnabled {
		c.JSON(http.StatusOK, gin.H{
			"message": "管理员关闭了密码登录",
			"success": false,
		})
		return
	}
	var loginRequest LoginRequest
	err := json.NewDecoder(c.Request.Body).Decode(&loginRequest)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"message": "无效的参数",
			"success": false,
		})
		return
	}
	username := loginRequest.Username
	password := loginRequest.Password
	if username == "" || password == "" {
		c.JSON(http.StatusOK, gin.H{
			"message": "无效的参数",
			"success": false,
		})
		return
	}
	user := model.User{
		Username: username,
		Password: password,
	}
	err = user.ValidateAndFill()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"message": err.Error(),
			"success": false,
		})
		return
	}

	// 检查是否启用2FA
	if model.IsTwoFAEnabled(user.Id) {
		// 设置pending session，等待2FA验证
		session := sessions.Default(c)
		session.Set("pending_username", user.Username)
		session.Set("pending_user_id", user.Id)
		err := session.Save()
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"message": "无法保存会话信息，请重试",
				"success": false,
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "请输入两步验证码",
			"success": true,
			"data": map[string]interface{}{
				"require_2fa": true,
			},
		})
		return
	}

	setupLogin(&user, c)
}

// setup session & cookies and then return user info
func setupLogin(user *model.User, c *gin.Context) {
	session := sessions.Default(c)
	session.Set("id", user.Id)
	session.Set("username", user.Username)
	session.Set("role", user.Role)
	session.Set("status", user.Status)
	session.Set("group", user.Group)
	err := session.Save()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"message": "无法保存会话信息，请重试",
			"success": false,
		})
		return
	}
	cleanUser := model.User{
		Id:          user.Id,
		Username:    user.Username,
		DisplayName: user.DisplayName,
		Role:        user.Role,
		Status:      user.Status,
		Group:       user.Group,
		Avatar:      user.Avatar,
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "",
		"success": true,
		"data":    cleanUser,
	})
}

func Logout(c *gin.Context) {
	session := sessions.Default(c)
	session.Clear()
	err := session.Save()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"message": err.Error(),
			"success": false,
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "",
		"success": true,
	})
}

func Register(c *gin.Context) {
	if !common.RegisterEnabled {
		c.JSON(http.StatusOK, gin.H{
			"message": "管理员关闭了新用户注册",
			"success": false,
		})
		return
	}
	if !common.PasswordRegisterEnabled {
		c.JSON(http.StatusOK, gin.H{
			"message": "管理员关闭了通过密码进行注册，请使用第三方账户验证的形式进行注册",
			"success": false,
		})
		return
	}
	var user model.User
	err := json.NewDecoder(c.Request.Body).Decode(&user)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	if err := common.Validate.Struct(&user); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "输入不合法 " + err.Error(),
		})
		return
	}
	if common.EmailVerificationEnabled {
		if user.Email == "" || user.VerificationCode == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "管理员开启了邮箱验证，请输入邮箱地址和验证码",
			})
			return
		}
		if !common.VerifyCodeWithKey(user.Email, user.VerificationCode, common.EmailVerificationPurpose) {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "验证码错误或已过期",
			})
			return
		}
	}
	exist, err := model.CheckUserExistOrDeleted(user.Username, user.Email)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "数据库错误，请稍后重试",
		})
		common.SysLog(fmt.Sprintf("CheckUserExistOrDeleted error: %v", err))
		return
	}
	if exist {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "用户名已存在，或已注销",
		})
		return
	}
	affCode := user.AffCode // this code is the inviter's code, not the user's own code
	inviterId, _ := model.GetUserIdByAffCode(affCode)
	cleanUser := model.User{
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.Username,
		InviterId:   inviterId,
		Role:        common.RoleCommonUser, // 明确设置角色为普通用户
	}
	if common.EmailVerificationEnabled {
		cleanUser.Email = user.Email
	}
	if err := cleanUser.Insert(inviterId); err != nil {
		common.ApiError(c, err)
		return
	}

	// 获取插入后的用户ID
	var insertedUser model.User
	if err := model.DB.Where("username = ?", cleanUser.Username).First(&insertedUser).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "用户注册失败或用户ID获取失败",
		})
		return
	}
	// 生成默认令牌
	if constant.GenerateDefaultToken {
		key, err := common.GenerateKey()
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "生成默认令牌失败",
			})
			common.SysLog("failed to generate token key: " + err.Error())
			return
		}
		// 生成默认令牌
		token := model.Token{
			UserId:             insertedUser.Id, // 使用插入后的用户ID
			Name:               cleanUser.Username + "的初始令牌",
			Key:                key,
			CreatedTime:        common.GetTimestamp(),
			AccessedTime:       common.GetTimestamp(),
			ExpiredTime:        -1,     // 永不过期
			RemainQuota:        500000, // 示例额度
			UnlimitedQuota:     true,
			ModelLimitsEnabled: false,
		}
		if setting.DefaultUseAutoGroup {
			token.Group = "auto"
		}
		if err := token.Insert(); err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "创建默认令牌失败",
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func GetAllUsers(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	users, total, err := model.GetAllUsers(pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(users)

	common.ApiSuccess(c, pageInfo)
	return
}

func SearchUsers(c *gin.Context) {
	keyword := c.Query("keyword")
	group := c.Query("group")
	pageInfo := common.GetPageQuery(c)
	users, total, err := model.SearchUsers(keyword, group, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(users)
	common.ApiSuccess(c, pageInfo)
	return
}

func GetUser(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	myRole := c.GetInt("role")
	if myRole <= user.Role && myRole != common.RoleRootUser {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无权获取同级或更高等级用户的信息",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    user,
	})
	return
}

func GenerateAccessToken(c *gin.Context) {
	id := c.GetInt("id")
	user, err := model.GetUserById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// get rand int 28-32
	randI := common.GetRandomInt(4)
	key, err := common.GenerateRandomKey(29 + randI)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "生成失败",
		})
		common.SysLog("failed to generate key: " + err.Error())
		return
	}
	user.SetAccessToken(key)

	if model.DB.Where("access_token = ?", user.AccessToken).First(user).RowsAffected != 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "请重试，系统生成的 UUID 竟然重复了！",
		})
		return
	}

	if err := user.Update(false); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    user.AccessToken,
	})
	return
}

type TransferAffQuotaRequest struct {
	Quota int `json:"quota" binding:"required"`
}

func TransferAffQuota(c *gin.Context) {
	// 检查邀请功能是否启用
	generalSetting := operation_setting.GetGeneralSetting()
	if !generalSetting.InvitationEnabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "邀请功能已被管理员禁用",
		})
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	tran := TransferAffQuotaRequest{}
	if err := c.ShouldBindJSON(&tran); err != nil {
		common.ApiError(c, err)
		return
	}
	err = user.TransferAffQuotaToQuota(tran.Quota)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "划转失败 " + err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "划转成功",
	})
}

func GetAffCode(c *gin.Context) {
	// 检查邀请功能是否启用
	generalSetting := operation_setting.GetGeneralSetting()
	if !generalSetting.InvitationEnabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "邀请功能已被管理员禁用",
		})
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user.AffCode == "" {
		user.AffCode = common.GetRandomString(4)
		if err := user.Update(false); err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    user.AffCode,
	})
	return
}

func GetSelf(c *gin.Context) {
	id := c.GetInt("id")
	userRole := c.GetInt("role")
	user, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// Hide admin remarks: set to empty to trigger omitempty tag, ensuring the remark field is not included in JSON returned to regular users
	user.Remark = ""

	// 完全移除头像数据，头像通过专用端点获取
	user.Avatar = ""

	// 计算用户权限信息
	permissions := calculateUserPermissions(userRole)

	// 获取用户设置并提取sidebar_modules
	userSetting := user.GetSetting()

	// 计算系统允许的最大权限范围
	systemSidebarConfig := calculateFinalSidebarConfig(userRole, userSetting)

	// 提取并过滤用户的侧边栏偏好设置，确保与系统权限一致
	var userSidebarModules interface{}
	if userSetting.SidebarModules != "" {
		var userSidebarModulesMap map[string]interface{}
		if err := json.Unmarshal([]byte(userSetting.SidebarModules), &userSidebarModulesMap); err == nil {
			// 基于系统权限过滤用户偏好
			filteredUserModules := filterUserModulesBySystemConfig(userSidebarModulesMap, systemSidebarConfig)
			userSidebarModules = filteredUserModules
		} else {
			userSidebarModules = userSetting.SidebarModules
		}
	} else {
		userSidebarModules = map[string]interface{}{}
	}

	// 清理用户设置中的sidebar_modules，确保与最终配置一致
	cleanedSetting := cleanUserSettingForResponse(user.Setting, systemSidebarConfig)

	// 计算最终的显示配置（系统权限 ∩ 用户偏好）
	finalSidebarConfig := calculateFinalDisplayConfig(systemSidebarConfig, userSidebarModules)

	// 精简权限信息，只保留必要的权限标识
	simplifiedPermissions := map[string]interface{}{
		"sidebar_settings": permissions["sidebar_settings"], // 是否有侧边栏设置权限
	}

	// 构建响应数据，包含用户信息和精简的配置
	responseData := map[string]interface{}{
		"id":                user.Id,
		"username":          user.Username,
		"display_name":      user.DisplayName,
		"role":              user.Role,
		"status":            user.Status,
		"email":             user.Email,
		"group":             user.Group,
		"quota":             user.Quota,
		"used_quota":        user.UsedQuota,
		"request_count":     user.RequestCount,
		"aff_code":          user.AffCode,
		"aff_count":         user.AffCount,
		"aff_quota":         user.AffQuota,
		"aff_history_quota": user.AffHistoryQuota,
		"inviter_id":        user.InviterId,
		"linux_do_id":       user.LinuxDOId,
		"setting":           cleanedSetting,        // 完整用户设置（保持兼容性）
		"stripe_customer":   user.StripeCustomer,
		"avatar":            user.Avatar,
		"sidebar_config":    finalSidebarConfig,   // 最终的侧边栏配置
		"permissions":       simplifiedPermissions, // 精简的权限信息
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    responseData,
	})
	return
}

// 计算用户权限的辅助函数
func calculateUserPermissions(userRole int) map[string]interface{} {
	permissions := map[string]interface{}{}

	// 根据用户角色计算权限
	if userRole == common.RoleRootUser {
		// 超级管理员不需要边栏设置功能
		permissions["sidebar_settings"] = false
		permissions["sidebar_modules"] = map[string]interface{}{}
	} else if userRole == common.RoleAdminUser {
		// 管理员可以设置边栏，但不包含系统设置功能
		permissions["sidebar_settings"] = true
		permissions["sidebar_modules"] = map[string]interface{}{
			"admin": map[string]interface{}{
				"setting": false, // 管理员不能访问系统设置
			},
		}
	} else {
		// 普通用户只能设置个人功能，不包含管理员区域
		permissions["sidebar_settings"] = true
		permissions["sidebar_modules"] = map[string]interface{}{
			"admin": false, // 普通用户不能访问管理员区域
		}
	}

	return permissions
}

// 计算最终的侧边栏配置（系统配置 + 权限过滤，不包含用户偏好）
func calculateFinalSidebarConfig(userRole int, userSetting dto.UserSetting) map[string]interface{} {
	// 1. 获取系统的侧边栏管理配置
	common.OptionMapRWMutex.RLock()
	sidebarAdminConfigRaw := common.OptionMap["SidebarModulesAdmin"]
	common.OptionMapRWMutex.RUnlock()

	// 2. 解析系统配置
	var systemConfig map[string]interface{}
	if sidebarAdminConfigRaw != "" {
		if err := json.Unmarshal([]byte(sidebarAdminConfigRaw), &systemConfig); err != nil {
			// 解析失败时使用默认配置
			systemConfig = getDefaultSystemConfig()
		}
	} else {
		systemConfig = getDefaultSystemConfig()
	}

	// 3. 不再考虑用户个人偏好，sidebar_config只反映系统允许的最大权限范围

	// 4. 计算最终配置
	finalConfig := map[string]interface{}{}

	// 遍历系统配置的所有区域
	for sectionKey, sectionValue := range systemConfig {
		sectionObj, ok := sectionValue.(map[string]interface{})
		if !ok {
			continue
		}

		// 检查用户是否有权限访问这个区域
		if !hasUserPermissionForSection(userRole, sectionKey) {
			continue
		}

		// 检查系统是否启用了这个区域
		sectionEnabled := true
		if enabled, hasEnabled := sectionObj["enabled"]; hasEnabled {
			if enabledBool, ok := enabled.(bool); ok {
				sectionEnabled = enabledBool
			}
		}

		if !sectionEnabled {
			continue
		}

		// 计算区域的最终配置（只考虑系统配置和用户权限，不考虑用户偏好）
		sectionConfig := map[string]interface{}{}

		// 区域级别的enabled状态：只要系统启用就为true
		sectionConfig["enabled"] = sectionEnabled

		// 处理区域内的各个模块
		for moduleKey, moduleValue := range sectionObj {
			if moduleKey == "enabled" {
				continue
			}

			// 检查用户是否有权限访问这个模块
			modulePath := sectionKey + "." + moduleKey
			if !hasUserPermissionForModule(userRole, modulePath) {
				sectionConfig[moduleKey] = false
				continue
			}

			// 处理嵌套的模块配置（如 admin.user）
			switch v := moduleValue.(type) {
			case bool:
				// 简单的布尔值模块
				systemModuleEnabled := v
				finalModuleEnabled := systemModuleEnabled && sectionConfig["enabled"].(bool)
				sectionConfig[moduleKey] = finalModuleEnabled
			case map[string]interface{}:
				// 嵌套的对象模块（如 admin.user 包含 enabled 和 groupManagement）
				nestedModuleConfig := map[string]interface{}{}

				// 检查嵌套模块的enabled状态
				nestedEnabled := true
				if enabled, hasEnabled := v["enabled"]; hasEnabled {
					if enabledBool, ok := enabled.(bool); ok {
						nestedEnabled = enabledBool
					}
				}

				// 最终的enabled状态
				finalNestedEnabled := nestedEnabled && sectionConfig["enabled"].(bool)
				nestedModuleConfig["enabled"] = finalNestedEnabled

				// 处理嵌套模块的子功能
				for subModuleKey, subModuleValue := range v {
					if subModuleKey == "enabled" {
						continue
					}

					// 检查用户是否有权限访问这个子功能
					subModulePath := sectionKey + "." + moduleKey + "." + subModuleKey
					if !hasUserPermissionForModule(userRole, subModulePath) {
						nestedModuleConfig[subModuleKey] = false
						continue
					}

					// 检查系统是否启用了这个子功能
					subModuleEnabled := true
					if subModuleBool, ok := subModuleValue.(bool); ok {
						subModuleEnabled = subModuleBool
					}

					// 最终状态：系统启用 && 用户权限允许 && 父模块启用
					finalSubModuleEnabled := subModuleEnabled && finalNestedEnabled
					nestedModuleConfig[subModuleKey] = finalSubModuleEnabled
				}

				sectionConfig[moduleKey] = nestedModuleConfig
			default:
				// 其他类型，直接设置为false
				sectionConfig[moduleKey] = false
			}
		}

		finalConfig[sectionKey] = sectionConfig
	}

	return finalConfig
}

// 获取默认的系统配置
func getDefaultSystemConfig() map[string]interface{} {
	return map[string]interface{}{
		"chat": map[string]interface{}{
			"enabled":    true,
			"playground": true,
			"chat":       true,
		},
		"console": map[string]interface{}{
			"enabled":    true,
			"detail":     true,
			"token":      true,
			"log":        true,
			"midjourney": true,
			"task":       true,
		},
		"personal": map[string]interface{}{
			"enabled":  true,
			"topup":    true,
			"personal": true,
		},
		"admin": map[string]interface{}{
			"enabled":    true,
			"channel":    true,
			"models":     true,
			"redemption": true,
			"user": map[string]interface{}{
				"enabled":         true,
				"groupManagement": true, // 默认启用分组管理
			},
			"setting": true,
		},
	}
}

// 检查用户是否有权限访问指定区域
func hasUserPermissionForSection(userRole int, sectionKey string) bool {
	// 普通用户不能访问管理员区域
	if userRole < common.RoleAdminUser && sectionKey == "admin" {
		return false
	}
	return true
}

// 检查用户是否有权限访问指定模块
func hasUserPermissionForModule(userRole int, modulePath string) bool {
	// 数据看板始终允许访问
	if modulePath == "console.detail" {
		return true
	}

	// 管理员不能访问系统设置
	if userRole == common.RoleAdminUser && modulePath == "admin.setting" {
		return false
	}

	// 处理嵌套的模块路径（如 admin.user.groupManagement）
	pathParts := strings.Split(modulePath, ".")
	if len(pathParts) >= 2 {
		sectionKey := pathParts[0]

		// 普通用户不能访问管理员区域的任何模块
		if userRole < common.RoleAdminUser && sectionKey == "admin" {
			return false
		}

		// 对于三层路径（如 admin.user.groupManagement），检查特殊权限
		if len(pathParts) == 3 && sectionKey == "admin" && pathParts[1] == "user" && pathParts[2] == "groupManagement" {
			// 分组管理功能：管理员和超级管理员都可以访问
			return userRole >= common.RoleAdminUser
		}
	}

	return true
}

// 清理用户设置，添加系统权限信息供个人设置页面使用
func cleanUserSettingForResponse(originalSetting string, systemSidebarConfig map[string]interface{}) string {
	if originalSetting == "" {
		return ""
	}

	// 解析原始设置
	var userSetting dto.UserSetting
	if err := json.Unmarshal([]byte(originalSetting), &userSetting); err != nil {
		// 解析失败，返回原始设置
		return originalSetting
	}

	// 如果没有sidebar_modules配置，直接返回
	if userSetting.SidebarModules == "" {
		return originalSetting
	}

	// 解析用户的sidebar_modules配置
	var userSidebarModules map[string]interface{}
	if err := json.Unmarshal([]byte(userSetting.SidebarModules), &userSidebarModules); err != nil {
		// 解析失败，返回原始设置
		return originalSetting
	}

	// 基于系统配置过滤用户的sidebar_modules，同时保留系统权限信息
	filteredSidebarModules := map[string]interface{}{}
	for sectionKey, sectionValue := range systemSidebarConfig {
		sectionObj, ok := sectionValue.(map[string]interface{})
		if !ok {
			continue
		}

		// 检查系统是否允许这个区域
		systemSectionEnabled, hasEnabled := sectionObj["enabled"]
		if !hasEnabled || systemSectionEnabled != true {
			continue
		}

		// 获取用户对这个区域的配置
		userSection := map[string]interface{}{}
		if userSidebarModules[sectionKey] != nil {
			if userSectionObj, ok := userSidebarModules[sectionKey].(map[string]interface{}); ok {
				userSection = userSectionObj
			}
		}

		// 构建过滤后的区域配置
		filteredSection := map[string]interface{}{
			"enabled": userSection["enabled"], // 保持用户的enabled偏好
		}

		// 只保留最终配置中存在的模块（支持布尔与嵌套对象）
		for moduleKey, moduleValue := range sectionObj {
			if moduleKey == "enabled" {
				continue
			}

			// 判断系统是否允许该模块
			systemAllows := false
			switch v := moduleValue.(type) {
			case bool:
				systemAllows = v
			case map[string]interface{}:
				// 嵌套对象，检查其enabled状态，缺省视为true
				if enabled, hasEnabled := v["enabled"]; hasEnabled {
					if enabledBool, ok := enabled.(bool); ok {
						systemAllows = enabledBool
					} else {
						systemAllows = true
					}
				} else {
					systemAllows = true
				}
			default:
				systemAllows = false
			}

			if systemAllows {
				// 保持用户对这个模块的偏好（布尔或对象），若未设置则默认启用
				if userModuleValue, exists := userSection[moduleKey]; exists {
					filteredSection[moduleKey] = userModuleValue
				} else {
					filteredSection[moduleKey] = true // 默认启用
				}
			}
		}

		filteredSidebarModules[sectionKey] = filteredSection
	}

	// 更新用户设置中的sidebar_modules
	filteredSidebarModulesJSON, err := json.Marshal(filteredSidebarModules)
	if err != nil {
		// 序列化失败，返回原始设置
		return originalSetting
	}

	userSetting.SidebarModules = string(filteredSidebarModulesJSON)

	// 添加系统权限信息供个人设置页面使用
	systemConfigJSON, err := json.Marshal(systemSidebarConfig)
	if err == nil {
		// 创建一个扩展的用户设置结构
		extendedSetting := map[string]interface{}{
			"sidebar_modules":        userSetting.SidebarModules,
			"sidebar_system_config": string(systemConfigJSON), // 系统权限信息
		}

		// 添加其他用户设置字段（如果有的话）
		var originalSettingMap map[string]interface{}
		if err := json.Unmarshal([]byte(originalSetting), &originalSettingMap); err == nil {
			for key, value := range originalSettingMap {
				if key != "sidebar_modules" && key != "sidebar_system_config" {
					extendedSetting[key] = value
				}
			}
		}

		// 序列化扩展的设置
		if extendedSettingJSON, err := json.Marshal(extendedSetting); err == nil {
			return string(extendedSettingJSON)
		}
	}

	// 如果添加系统配置失败，使用原有逻辑
	cleanedSettingJSON, err := json.Marshal(userSetting)
	if err != nil {
		return originalSetting
	}

	return string(cleanedSettingJSON)
}

// 基于系统权限过滤用户偏好设置
func filterUserModulesBySystemConfig(userModules map[string]interface{}, systemConfig map[string]interface{}) map[string]interface{} {
	filteredModules := map[string]interface{}{}

	// 只保留系统允许的区域和模块
	for sectionKey, sectionValue := range systemConfig {
		systemSection, ok := sectionValue.(map[string]interface{})
		if !ok || systemSection["enabled"] != true {
			continue
		}

		// 获取用户对这个区域的偏好
		userSection := map[string]interface{}{}
		if userModules[sectionKey] != nil {
			if userSectionObj, ok := userModules[sectionKey].(map[string]interface{}); ok {
				userSection = userSectionObj
			}
		}

		// 构建过滤后的区域配置
		filteredSection := map[string]interface{}{
			"enabled": userSection["enabled"], // 保持用户的enabled偏好
		}

		// 只保留系统允许的模块（同时支持布尔模块与嵌套对象模块）
		for moduleKey, moduleValue := range systemSection {
			if moduleKey == "enabled" {
				continue
			}

			// 判断系统是否允许该模块
			systemAllows := false
			switch v := moduleValue.(type) {
			case bool:
				systemAllows = v
			case map[string]interface{}:
				// 嵌套对象，检查其enabled状态，缺省视为true
				if enabled, hasEnabled := v["enabled"]; hasEnabled {
					if enabledBool, ok := enabled.(bool); ok {
						systemAllows = enabledBool
					} else {
						systemAllows = true
					}
				} else {
					systemAllows = true
				}
			default:
				systemAllows = false
			}

			if systemAllows {
				// 保持用户对这个模块的偏好（支持布尔或对象），若未设置则默认启用
				if userModuleValue, exists := userSection[moduleKey]; exists {
					filteredSection[moduleKey] = userModuleValue
				} else {
					filteredSection[moduleKey] = true // 默认启用
				}
			}
		}

		filteredModules[sectionKey] = filteredSection
	}

	return filteredModules
}

// 计算最终的显示配置（系统权限 ∩ 用户偏好）
func calculateFinalDisplayConfig(systemConfig map[string]interface{}, userModules interface{}) map[string]interface{} {
	finalConfig := map[string]interface{}{}

	// 解析用户偏好设置
	var userPreferences map[string]interface{}
	switch v := userModules.(type) {
	case map[string]interface{}:
		userPreferences = v
	case string:
		if err := json.Unmarshal([]byte(v), &userPreferences); err != nil {
			userPreferences = map[string]interface{}{}
		}
	default:
		userPreferences = map[string]interface{}{}
	}

	// 遍历系统允许的所有区域
	for sectionKey, sectionValue := range systemConfig {
		systemSection, ok := sectionValue.(map[string]interface{})
		if !ok || systemSection["enabled"] != true {
			continue
		}

		// 获取用户对这个区域的偏好
		userSection := map[string]interface{}{}
		if userPreferences[sectionKey] != nil {
			if userSectionObj, ok := userPreferences[sectionKey].(map[string]interface{}); ok {
				userSection = userSectionObj
			}
		}

		// 计算区域的最终配置
		sectionConfig := map[string]interface{}{}

		// 区域级别：用户可以关闭系统允许的区域
		userSectionEnabled := userSection["enabled"] != false
		sectionConfig["enabled"] = userSectionEnabled

		// 处理区域内的模块
		for moduleKey, moduleValue := range systemSection {
			if moduleKey == "enabled" {
				continue
			}

			// 检查系统是否允许这个模块
			var systemModuleEnabled bool
			switch v := moduleValue.(type) {
			case bool:
				systemModuleEnabled = v
			case map[string]interface{}:
				// 对于嵌套对象，检查其enabled状态
				if enabled, hasEnabled := v["enabled"]; hasEnabled {
					if enabledBool, ok := enabled.(bool); ok {
						systemModuleEnabled = enabledBool
					} else {
						systemModuleEnabled = true // 默认启用
					}
				} else {
					systemModuleEnabled = true // 没有enabled字段时默认启用
				}
			default:
				systemModuleEnabled = false
			}

			if !systemModuleEnabled {
				sectionConfig[moduleKey] = false
				continue
			}

			// 对于嵌套对象，需要合并系统配置和用户偏好
			if nestedObj, isNested := moduleValue.(map[string]interface{}); isNested {
				// 获取用户对这个嵌套对象的偏好
				userNestedObj := map[string]interface{}{}
				if userSection[moduleKey] != nil {
					if userNestedMap, ok := userSection[moduleKey].(map[string]interface{}); ok {
						userNestedObj = userNestedMap
					}
				}

				// 计算有效的enabled：支持用户以布尔值直接覆盖嵌套对象（个人设置场景）
				var effectiveEnabled interface{}
				if userBool, ok := userSection[moduleKey].(bool); ok {
					effectiveEnabled = userBool
				} else if ue, exists := userNestedObj["enabled"]; exists {
					effectiveEnabled = ue
				} else if sysEnabled, has := nestedObj["enabled"]; has {
					effectiveEnabled = sysEnabled
				} else {
					effectiveEnabled = true
				}

				// 合并系统配置和用户偏好
				finalNestedObj := make(map[string]interface{})
				for k, v := range nestedObj {
					if k == "enabled" {
						finalNestedObj[k] = effectiveEnabled
					} else {
						// 其他字段保持系统配置
						finalNestedObj[k] = v
					}
				}

				// 如果区域被禁用，强制将嵌套对象的enabled设置为false
				if !userSectionEnabled {
					finalNestedObj["enabled"] = false
				}

				sectionConfig[moduleKey] = finalNestedObj
			} else {
				// 简单布尔值模块，用户可以关闭系统允许的模块
				userModuleEnabled := userSection[moduleKey] != false
				// 最终状态：系统允许 && 用户偏好 && 区域启用
				sectionConfig[moduleKey] = systemModuleEnabled && userModuleEnabled && userSectionEnabled
			}
		}

		finalConfig[sectionKey] = sectionConfig
	}

	return finalConfig
}

func GetUserModels(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		id = c.GetInt("id")
	}
	user, err := model.GetUserCache(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	groups := setting.GetUserUsableGroups(user.Group)
	var models []string
	for group := range groups {
		for _, g := range model.GetGroupEnabledModels(group) {
			if !common.StringsContains(models, g) {
				models = append(models, g)
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    models,
	})
	return
}

func UpdateUser(c *gin.Context) {
	var updatedUser model.User
	err := json.NewDecoder(c.Request.Body).Decode(&updatedUser)
	if err != nil || updatedUser.Id == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	if updatedUser.Password == "" {
		updatedUser.Password = "$I_LOVE_U" // make Validator happy :)
	}
	if err := common.Validate.Struct(&updatedUser); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "输入不合法 " + err.Error(),
		})
		return
	}
	originUser, err := model.GetUserById(updatedUser.Id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	myRole := c.GetInt("role")
	if myRole <= originUser.Role && myRole != common.RoleRootUser {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无权更新同权限等级或更高权限等级的用户信息",
		})
		return
	}
	if myRole <= updatedUser.Role && myRole != common.RoleRootUser {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无权将其他用户权限等级提升到大于等于自己的权限等级",
		})
		return
	}
	if updatedUser.Password == "$I_LOVE_U" {
		updatedUser.Password = "" // rollback to what it should be
	}
	updatePassword := updatedUser.Password != ""
	if err := updatedUser.Edit(updatePassword); err != nil {
		common.ApiError(c, err)
		return
	}
	if originUser.Quota != updatedUser.Quota {
		model.RecordLog(originUser.Id, model.LogTypeManage, fmt.Sprintf("管理员将用户额度从 %s修改为 %s", logger.LogQuota(originUser.Quota), logger.LogQuota(updatedUser.Quota)))
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func GetUserAvatar(c *gin.Context) {
	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 检查是否强制获取头像（用于上传后刷新）
	forceRefresh := c.Query("force_refresh") == "true"

	// 检查会话中是否已获取过头像
	sessionId := c.GetHeader("X-Session-ID")
	if sessionId == "" {
		// 如果没有会话ID，生成一个
		sessionId = fmt.Sprintf("session_%d_%d", id, time.Now().Unix())
	}

	// sessionKey := fmt.Sprintf("avatar_session_%s", sessionId) // 保留用于未来扩展

	// 如果不是强制刷新且会话中已获取过，返回空响应
	if !forceRefresh {
		if sessionValue := c.GetHeader("X-Avatar-Fetched"); sessionValue == "true" {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"message": "avatar_cached",
				"data": gin.H{
					"avatar": "",
					"cached": true,
				},
			})
			return
		}
	}

	// 返回头像数据
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"avatar": user.Avatar,
			"cached": false,
			"session_id": sessionId,
		},
	})
	return
}

func UpdateSelf(c *gin.Context) {
	var requestData map[string]interface{}
	err := json.NewDecoder(c.Request.Body).Decode(&requestData)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	// 检查是否是sidebar_modules更新请求
	if sidebarModules, exists := requestData["sidebar_modules"]; exists {
		userId := c.GetInt("id")
		user, err := model.GetUserById(userId, false)
		if err != nil {
			common.ApiError(c, err)
			return
		}

		// 获取当前用户设置
		currentSetting := user.GetSetting()

		// 更新sidebar_modules字段
		if sidebarModulesStr, ok := sidebarModules.(string); ok {
			currentSetting.SidebarModules = sidebarModulesStr
		}

		// 保存更新后的设置
		user.SetSetting(currentSetting)
		if err := user.Update(false); err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "更新设置失败: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "设置更新成功",
		})
		return
	}

	// 检查是否是纯头像更新请求
	if len(requestData) == 1 {
		if avatarData, exists := requestData["avatar"]; exists {
			userId := c.GetInt("id")

			// 验证头像数据
			avatarStr, ok := avatarData.(string)
			if !ok {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": "头像数据格式无效",
				})
				return
			}

			if err := validateAvatar(avatarStr); err != nil {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": err.Error(),
				})
				return
			}

			// 直接更新头像字段
			user := model.User{
				Id:     userId,
				Avatar: avatarStr,
			}

			if err := user.UpdateAvatar(); err != nil {
				common.ApiError(c, err)
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"message": "",
			})
			return
		}
	}

	// 原有的用户信息更新逻辑
	var user model.User
	requestDataBytes, err := json.Marshal(requestData)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	err = json.Unmarshal(requestDataBytes, &user)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	if user.Password == "" {
		user.Password = "$I_LOVE_U" // make Validator happy :)
	}
	if err := common.Validate.Struct(&user); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "输入不合法 " + err.Error(),
		})
		return
	}

	// 验证头像数据
	if err := validateAvatar(user.Avatar); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	cleanUser := model.User{
		Id:          c.GetInt("id"),
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.DisplayName,
		Avatar:      user.Avatar,
	}
	if user.Password == "$I_LOVE_U" {
		user.Password = "" // rollback to what it should be
		cleanUser.Password = ""
	}

	// 只有当明确提供了 original_password 或者要更新密码时才进行密码验证
	var updatePassword bool
	if _, hasOriginalPassword := requestData["original_password"]; hasOriginalPassword || user.Password != "" {
		updatePassword, err = checkUpdatePassword(user.OriginalPassword, user.Password, cleanUser.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if err := cleanUser.Update(updatePassword); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func checkUpdatePassword(originalPassword string, newPassword string, userId int) (updatePassword bool, err error) {
	var currentUser *model.User
	currentUser, err = model.GetUserById(userId, true)
	if err != nil {
		return
	}
	if !common.ValidatePasswordAndHash(originalPassword, currentUser.Password) {
		err = fmt.Errorf("原密码错误")
		return
	}
	if newPassword == "" {
		return
	}
	updatePassword = true
	return
}

func DeleteUser(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	originUser, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	myRole := c.GetInt("role")
	if myRole <= originUser.Role {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无权删除同权限等级或更高权限等级的用户",
		})
		return
	}
	err = model.HardDeleteUserById(id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
		})
		return
	}
}

func DeleteSelf(c *gin.Context) {
	id := c.GetInt("id")
	user, _ := model.GetUserById(id, false)

	if user.Role == common.RoleRootUser {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "不能删除超级管理员账户",
		})
		return
	}

	err := model.DeleteUserById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func CreateUser(c *gin.Context) {
	var user model.User
	err := json.NewDecoder(c.Request.Body).Decode(&user)
	user.Username = strings.TrimSpace(user.Username)
	if err != nil || user.Username == "" || user.Password == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	if err := common.Validate.Struct(&user); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "输入不合法 " + err.Error(),
		})
		return
	}
	if user.DisplayName == "" {
		user.DisplayName = user.Username
	}
	// 如果没有指定分组，设置为默认分组
	if user.Group == "" {
		user.Group = "default"
	}
	myRole := c.GetInt("role")
	if user.Role >= myRole {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无法创建权限大于等于自己的用户",
		})
		return
	}
	// Even for admin users, we cannot fully trust them!
	cleanUser := model.User{
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.DisplayName,
		Role:        user.Role, // 保持管理员设置的角色
		Group:       user.Group, // 保持管理员设置的分组
	}
	if err := cleanUser.Insert(0); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

type ManageRequest struct {
	Id     int    `json:"id"`
	Action string `json:"action"`
}

// ManageUser Only admin user can do this
func ManageUser(c *gin.Context) {
	var req ManageRequest
	err := json.NewDecoder(c.Request.Body).Decode(&req)

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	user := model.User{
		Id: req.Id,
	}
	// Fill attributes
	model.DB.Unscoped().Where(&user).First(&user)
	if user.Id == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "用户不存在",
		})
		return
	}
	myRole := c.GetInt("role")
	if myRole <= user.Role && myRole != common.RoleRootUser {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无权更新同权限等级或更高权限等级的用户信息",
		})
		return
	}
	switch req.Action {
	case "disable":
		user.Status = common.UserStatusDisabled
		if user.Role == common.RoleRootUser {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法禁用超级管理员用户",
			})
			return
		}
	case "enable":
		user.Status = common.UserStatusEnabled
	case "delete":
		if user.Role == common.RoleRootUser {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法删除超级管理员用户",
			})
			return
		}
		if err := user.Delete(); err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "promote":
		if myRole != common.RoleRootUser {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "普通管理员用户无法提升其他用户为管理员",
			})
			return
		}
		if user.Role >= common.RoleAdminUser {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "该用户已经是管理员",
			})
			return
		}
		user.Role = common.RoleAdminUser

		// 同步更新用户的sidebar_modules配置
		currentSetting := user.GetSetting()
		newSidebarConfig := model.GenerateDefaultSidebarConfigForRole(user.Role)
		if newSidebarConfig != "" {
			currentSetting.SidebarModules = newSidebarConfig
			user.SetSetting(currentSetting)
			common.SysLog(fmt.Sprintf("用户 %s 提升为管理员，已同步更新边栏配置", user.Username))
		}
	case "demote":
		if user.Role == common.RoleRootUser {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法降级超级管理员用户",
			})
			return
		}
		if user.Role == common.RoleCommonUser {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "该用户已经是普通用户",
			})
			return
		}
		user.Role = common.RoleCommonUser

		// 同步更新用户的sidebar_modules配置
		currentSetting := user.GetSetting()
		newSidebarConfig := model.GenerateDefaultSidebarConfigForRole(user.Role)
		if newSidebarConfig != "" {
			currentSetting.SidebarModules = newSidebarConfig
			user.SetSetting(currentSetting)
			common.SysLog(fmt.Sprintf("用户 %s 降级为普通用户，已同步更新边栏配置", user.Username))
		}
	}

	if err := user.Update(false); err != nil {
		common.ApiError(c, err)
		return
	}
	clearUser := model.User{
		Role:   user.Role,
		Status: user.Status,
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    clearUser,
	})
	return
}

func EmailBind(c *gin.Context) {
	email := c.Query("email")
	code := c.Query("code")
	if !common.VerifyCodeWithKey(email, code, common.EmailVerificationPurpose) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "验证码错误或已过期",
		})
		return
	}
	session := sessions.Default(c)
	id := session.Get("id")
	user := model.User{
		Id: id.(int),
	}
	err := user.FillUserById()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user.Email = email
	// no need to check if this email already taken, because we have used verification code to check it
	err = user.Update(false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

type topUpRequest struct {
	Key string `json:"key"`
}

var topUpLocks sync.Map
var topUpCreateLock sync.Mutex

type topUpTryLock struct {
	ch chan struct{}
}

func newTopUpTryLock() *topUpTryLock {
	return &topUpTryLock{ch: make(chan struct{}, 1)}
}

func (l *topUpTryLock) TryLock() bool {
	select {
	case l.ch <- struct{}{}:
		return true
	default:
		return false
	}
}

func (l *topUpTryLock) Unlock() {
	select {
	case <-l.ch:
	default:
	}
}

func getTopUpLock(userID int) *topUpTryLock {
	if v, ok := topUpLocks.Load(userID); ok {
		return v.(*topUpTryLock)
	}
	topUpCreateLock.Lock()
	defer topUpCreateLock.Unlock()
	if v, ok := topUpLocks.Load(userID); ok {
		return v.(*topUpTryLock)
	}
	l := newTopUpTryLock()
	topUpLocks.Store(userID, l)
	return l
}

func TopUp(c *gin.Context) {
	id := c.GetInt("id")
	lock := getTopUpLock(id)
	if !lock.TryLock() {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "充值处理中，请稍后重试",
		})
		return
	}
	defer lock.Unlock()
	req := topUpRequest{}
	err := c.ShouldBindJSON(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	quota, err := model.Redeem(req.Key, id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    quota,
	})
}

type UpdateUserSettingRequest struct {
	QuotaWarningType           string  `json:"notify_type"`
	QuotaWarningThreshold      float64 `json:"quota_warning_threshold"`
	WebhookUrl                 string  `json:"webhook_url,omitempty"`
	WebhookSecret              string  `json:"webhook_secret,omitempty"`
	NotificationEmail          string  `json:"notification_email,omitempty"`
	BarkUrl                    string  `json:"bark_url,omitempty"`
	AcceptUnsetModelRatioModel bool    `json:"accept_unset_model_ratio_model"`
	RecordIpLog                bool    `json:"record_ip_log"`
}

func UpdateUserSetting(c *gin.Context) {
	var req UpdateUserSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	// 验证预警类型
	if req.QuotaWarningType != dto.NotifyTypeEmail && req.QuotaWarningType != dto.NotifyTypeWebhook && req.QuotaWarningType != dto.NotifyTypeBark {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的预警类型",
		})
		return
	}

	// 验证预警阈值
	if req.QuotaWarningThreshold <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "预警阈值必须大于0",
		})
		return
	}

	// 如果是webhook类型,验证webhook地址
	if req.QuotaWarningType == dto.NotifyTypeWebhook {
		if req.WebhookUrl == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "Webhook地址不能为空",
			})
			return
		}
		// 验证URL格式
		if _, err := url.ParseRequestURI(req.WebhookUrl); err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无效的Webhook地址",
			})
			return
		}
	}

	// 如果是邮件类型，验证邮箱地址
	if req.QuotaWarningType == dto.NotifyTypeEmail && req.NotificationEmail != "" {
		// 验证邮箱格式
		if !strings.Contains(req.NotificationEmail, "@") {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无效的邮箱地址",
			})
			return
		}
	}

	// 如果是Bark类型，验证Bark URL
	if req.QuotaWarningType == dto.NotifyTypeBark {
		if req.BarkUrl == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "Bark推送URL不能为空",
			})
			return
		}
		// 验证URL格式
		if _, err := url.ParseRequestURI(req.BarkUrl); err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无效的Bark推送URL",
			})
			return
		}
		// 检查是否是HTTP或HTTPS
		if !strings.HasPrefix(req.BarkUrl, "https://") && !strings.HasPrefix(req.BarkUrl, "http://") {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "Bark推送URL必须以http://或https://开头",
			})
			return
		}
	}

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 构建设置
	settings := dto.UserSetting{
		NotifyType:            req.QuotaWarningType,
		QuotaWarningThreshold: req.QuotaWarningThreshold,
		AcceptUnsetRatioModel: req.AcceptUnsetModelRatioModel,
		RecordIpLog:           req.RecordIpLog,
	}

	// 如果是webhook类型,添加webhook相关设置
	if req.QuotaWarningType == dto.NotifyTypeWebhook {
		settings.WebhookUrl = req.WebhookUrl
		if req.WebhookSecret != "" {
			settings.WebhookSecret = req.WebhookSecret
		}
	}

	// 如果提供了通知邮箱，添加到设置中
	if req.QuotaWarningType == dto.NotifyTypeEmail && req.NotificationEmail != "" {
		settings.NotificationEmail = req.NotificationEmail
	}

	// 如果是Bark类型，添加Bark URL到设置中
	if req.QuotaWarningType == dto.NotifyTypeBark {
		settings.BarkUrl = req.BarkUrl
	}

	// 更新用户设置
	user.SetSetting(settings)
	if err := user.Update(false); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "更新设置失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "设置已更新",
	})
}
