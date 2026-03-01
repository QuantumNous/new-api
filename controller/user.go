package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"

	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"github.com/go-fuego/fuego"
)

// Login uses *gin.Context because setupLogin writes session + JSON directly
func Login(c *gin.Context) {
	if !common.PasswordLoginEnabled {
		common.ApiErrorI18n(c, i18n.MsgUserPasswordLoginDisabled)
		return
	}
	var loginRequest dto.LoginRequest
	err := json.NewDecoder(c.Request.Body).Decode(&loginRequest)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	username := loginRequest.Username
	password := loginRequest.Password
	if username == "" || password == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	user := model.User{
		Username: username,
		Password: password,
	}
	err = user.ValidateAndFill()
	if err != nil {
		c.JSON(http.StatusOK, dto.ApiResponse{Message: err.Error()})
		return
	}

	if model.IsTwoFAEnabled(user.Id) {
		session := sessions.Default(c)
		session.Set("pending_username", user.Username)
		session.Set("pending_user_id", user.Id)
		err := session.Save()
		if err != nil {
			common.ApiErrorI18n(c, i18n.MsgUserSessionSaveFailed)
			return
		}

		c.JSON(http.StatusOK, dto.ApiResponse{
			Success: true,
			Message: i18n.T(c, i18n.MsgUserRequire2FA),
			Data:    dto.Login2FAData{Require2FA: true},
		})
		return
	}

	setupLogin(&user, c)
}

// setupLogin sets session & cookies and returns user info
func setupLogin(user *model.User, c *gin.Context) {
	session := sessions.Default(c)
	session.Set("id", user.Id)
	session.Set("username", user.Username)
	session.Set("role", user.Role)
	session.Set("status", user.Status)
	session.Set("group", user.Group)
	err := session.Save()
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserSessionSaveFailed)
		return
	}
	c.JSON(http.StatusOK, dto.ApiResponse{
		Success: true,
		Message: "",
		Data: dto.LoginData{
			ID:          user.Id,
			Username:    user.Username,
			DisplayName: user.DisplayName,
			Role:        user.Role,
			Status:      user.Status,
			Group:       user.Group,
		},
	})
}

func Logout(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	session := sessions.Default(dto.GinCtx(c))
	session.Clear()
	if err := session.Save(); err != nil {
		return dto.FailMsg(err.Error())
	}
	return dto.Msg("")
}

func Register(c fuego.ContextWithBody[dto.RegisterRequest]) (dto.MessageResponse, error) {
	ginCtx := dto.GinCtx(c)
	if !common.RegisterEnabled {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUserRegisterDisabled))
	}
	if !common.PasswordRegisterEnabled {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUserPasswordRegisterDisabled))
	}
	req, err := c.Body()
	if err != nil {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgInvalidParams))
	}
	if err := common.Validate.Struct(&req); err != nil {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUserInputInvalid, map[string]any{"Error": err.Error()}))
	}
	if common.EmailVerificationEnabled {
		if req.Email == "" || req.VerificationCode == "" {
			return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUserEmailVerificationRequired))
		}
		if !common.VerifyCodeWithKey(req.Email, req.VerificationCode, common.EmailVerificationPurpose) {
			return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUserVerificationCodeError))
		}
	}
	exist, err := model.CheckUserExistOrDeleted(req.Username, req.Email)
	if err != nil {
		common.SysLog(fmt.Sprintf("CheckUserExistOrDeleted error: %v", err))
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgDatabaseError))
	}
	if exist {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUserExists))
	}
	affCode := req.AffCode
	inviterId, _ := model.GetUserIdByAffCode(affCode)
	cleanUser := model.User{
		Username:    req.Username,
		Password:    req.Password,
		DisplayName: req.Username,
		InviterId:   inviterId,
		Role:        common.RoleCommonUser,
	}
	if common.EmailVerificationEnabled {
		cleanUser.Email = req.Email
	}
	if err := cleanUser.Insert(inviterId); err != nil {
		return dto.FailMsg(err.Error())
	}

	var insertedUser model.User
	if err := model.DB.Where("username = ?", cleanUser.Username).First(&insertedUser).Error; err != nil {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUserRegisterFailed))
	}
	if constant.GenerateDefaultToken {
		key, err := common.GenerateKey()
		if err != nil {
			common.SysLog("failed to generate token key: " + err.Error())
			return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUserDefaultTokenFailed))
		}
		token := model.Token{
			UserId:             insertedUser.Id,
			Name:               cleanUser.Username + "的初始令牌",
			Key:                key,
			CreatedTime:        common.GetTimestamp(),
			AccessedTime:       common.GetTimestamp(),
			ExpiredTime:        -1,
			RemainQuota:        500000,
			UnlimitedQuota:     true,
			ModelLimitsEnabled: false,
		}
		if setting.DefaultUseAutoGroup {
			token.Group = "auto"
		}
		if err := token.Insert(); err != nil {
			return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgCreateDefaultTokenErr))
		}
	}

	return dto.Msg("")
}

func GetAllUsers(c fuego.ContextNoBody) (*dto.Response[dto.PageData[*model.User]], error) {
	pageInfo := dto.PageInfo(c)
	users, total, err := model.GetAllUsers(pageInfo)
	if err != nil {
		return dto.FailPage[*model.User](err.Error())
	}

	return dto.OkPage(pageInfo, users, int(total))
}

func SearchUsers(c fuego.ContextWithParams[dto.SearchUsersParams]) (*dto.Response[dto.PageData[*model.User]], error) {
	p, _ := dto.ParseParams[dto.SearchUsersParams](c)
	pageInfo := dto.PageInfo(c)
	users, total, err := model.SearchUsers(p.Keyword, p.Group, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		return dto.FailPage[*model.User](err.Error())
	}

	return dto.OkPage(pageInfo, users, int(total))
}

func GetUser(c fuego.ContextNoBody) (*dto.Response[model.User], error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.Fail[model.User](err.Error())
	}
	user, err := model.GetUserById(id, false)
	if err != nil {
		return dto.Fail[model.User](err.Error())
	}
	myRole := dto.UserRole(c)
	if myRole <= user.Role && myRole != common.RoleRootUser {
		return dto.Fail[model.User](common.TranslateMessage(dto.GinCtx(c), i18n.MsgUserNoPermissionSameLevel))
	}
	return dto.Ok(*user)
}

func GenerateAccessToken(c fuego.ContextNoBody) (*dto.Response[string], error) {
	id := dto.UserID(c)
	user, err := model.GetUserById(id, true)
	if err != nil {
		return dto.Fail[string](err.Error())
	}
	randI := common.GetRandomInt(4)
	key, err := common.GenerateRandomKey(29 + randI)
	if err != nil {
		common.SysLog("failed to generate key: " + err.Error())
		return dto.Fail[string](common.TranslateMessage(dto.GinCtx(c), i18n.MsgGenerateFailed))
	}
	user.SetAccessToken(key)

	if model.DB.Where("access_token = ?", user.AccessToken).First(user).RowsAffected != 0 {
		return dto.Fail[string](common.TranslateMessage(dto.GinCtx(c), i18n.MsgUuidDuplicate))
	}

	if err := user.Update(false); err != nil {
		return dto.Fail[string](err.Error())
	}

	return dto.Ok(user.GetAccessToken())
}

func TransferAffQuota(c fuego.ContextWithBody[dto.TransferAffQuotaRequest]) (dto.MessageResponse, error) {
	id := dto.UserID(c)
	user, err := model.GetUserById(id, true)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	tran, err := c.Body()
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	err = user.TransferAffQuotaToQuota(tran.Quota)
	if err != nil {
		return dto.FailMsg(common.TranslateMessage(dto.GinCtx(c), i18n.MsgUserTransferFailed, map[string]any{"Error": err.Error()}))
	}
	return dto.Msg(common.TranslateMessage(dto.GinCtx(c), i18n.MsgUserTransferSuccess))
}

func GetAffCode(c fuego.ContextNoBody) (*dto.Response[string], error) {
	id := dto.UserID(c)
	user, err := model.GetUserById(id, true)
	if err != nil {
		return dto.Fail[string](err.Error())
	}
	if user.AffCode == "" {
		user.AffCode = common.GetRandomString(4)
		if err := user.Update(false); err != nil {
			return dto.Fail[string](err.Error())
		}
	}
	return dto.Ok(user.AffCode)
}

func GetSelf(c fuego.ContextNoBody) (*dto.Response[dto.UserSelfData], error) {
	id := dto.UserID(c)
	userRole := dto.UserRole(c)
	user, err := model.GetUserById(id, false)
	if err != nil {
		return dto.Fail[dto.UserSelfData](err.Error())
	}
	user.Remark = ""

	permissions := calculateUserPermissions(userRole)
	userSetting := user.GetSetting()

	data := dto.UserSelfData{
		Id:              user.Id,
		Username:        user.Username,
		DisplayName:     user.DisplayName,
		Role:            user.Role,
		Status:          user.Status,
		Email:           user.Email,
		GitHubId:        user.GitHubId,
		DiscordId:       user.DiscordId,
		OidcId:          user.OidcId,
		WeChatId:        user.WeChatId,
		TelegramId:      user.TelegramId,
		Group:           user.Group,
		Quota:           user.Quota,
		UsedQuota:       user.UsedQuota,
		RequestCount:    user.RequestCount,
		AffCode:         user.AffCode,
		AffCount:        user.AffCount,
		AffQuota:        user.AffQuota,
		AffHistoryQuota: user.AffHistoryQuota,
		InviterId:       user.InviterId,
		LinuxDOId:       user.LinuxDOId,
		Setting:         user.Setting,
		StripeCustomer:  user.StripeCustomer,
		SidebarModules:  userSetting.SidebarModules,
		Permissions:     permissions,
	}

	return dto.Ok(data)
}

func calculateUserPermissions(userRole int) map[string]interface{} {
	permissions := map[string]interface{}{}

	if userRole == common.RoleRootUser {
		permissions["sidebar_settings"] = false
		permissions["sidebar_modules"] = map[string]interface{}{}
	} else if userRole == common.RoleAdminUser {
		permissions["sidebar_settings"] = true
		permissions["sidebar_modules"] = map[string]interface{}{
			"admin": map[string]interface{}{
				"setting": false,
			},
		}
	} else {
		permissions["sidebar_settings"] = true
		permissions["sidebar_modules"] = map[string]interface{}{
			"admin": false,
		}
	}

	return permissions
}

func generateDefaultSidebarConfig(userRole int) string {
	defaultConfig := map[string]interface{}{}

	defaultConfig["chat"] = map[string]interface{}{
		"enabled":    true,
		"playground": true,
		"chat":       true,
	}

	defaultConfig["console"] = map[string]interface{}{
		"enabled":    true,
		"detail":     true,
		"token":      true,
		"log":        true,
		"midjourney": true,
		"task":       true,
	}

	defaultConfig["personal"] = map[string]interface{}{
		"enabled":  true,
		"topup":    true,
		"personal": true,
	}

	if userRole == common.RoleAdminUser {
		defaultConfig["admin"] = map[string]interface{}{
			"enabled":    true,
			"channel":    true,
			"models":     true,
			"redemption": true,
			"user":       true,
			"setting":    false,
		}
	} else if userRole == common.RoleRootUser {
		defaultConfig["admin"] = map[string]interface{}{
			"enabled":    true,
			"channel":    true,
			"models":     true,
			"redemption": true,
			"user":       true,
			"setting":    true,
		}
	}

	configBytes, err := json.Marshal(defaultConfig)
	if err != nil {
		common.SysLog("生成默认边栏配置失败: " + err.Error())
		return ""
	}

	return string(configBytes)
}

func GetUserModels(c fuego.ContextNoBody) (*dto.Response[[]string], error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		id = dto.UserID(c)
	}
	user, err := model.GetUserCache(id)
	if err != nil {
		return dto.Fail[[]string](err.Error())
	}
	groups := service.GetUserUsableGroups(user.Group)
	var models []string
	for group := range groups {
		for _, g := range model.GetGroupEnabledModels(group) {
			if !common.StringsContains(models, g) {
				models = append(models, g)
			}
		}
	}
	return dto.Ok(models)
}

func UpdateUser(c fuego.ContextWithBody[model.User]) (dto.MessageResponse, error) {
	ginCtx := dto.GinCtx(c)
	updatedUser, err := c.Body()
	if err != nil || updatedUser.Id == 0 {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgInvalidParams))
	}
	if updatedUser.Password == "" {
		updatedUser.Password = "$I_LOVE_U"
	}
	if err := common.Validate.Struct(&updatedUser); err != nil {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUserInputInvalid, map[string]any{"Error": err.Error()}))
	}
	originUser, err := model.GetUserById(updatedUser.Id, false)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	myRole := dto.UserRole(c)
	if myRole <= originUser.Role && myRole != common.RoleRootUser {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUserNoPermissionHigherLevel))
	}
	if myRole <= updatedUser.Role && myRole != common.RoleRootUser {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUserCannotCreateHigherLevel))
	}
	if updatedUser.Password == "$I_LOVE_U" {
		updatedUser.Password = ""
	}
	updatePassword := updatedUser.Password != ""
	if err := updatedUser.Edit(updatePassword); err != nil {
		return dto.FailMsg(err.Error())
	}
	if originUser.Quota != updatedUser.Quota {
		model.RecordLog(originUser.Id, model.LogTypeManage, fmt.Sprintf("管理员将用户额度从 %s修改为 %s", logger.LogQuota(originUser.Quota), logger.LogQuota(updatedUser.Quota)))
	}
	return dto.Msg("")
}

func AdminClearUserBinding(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	ginCtx := dto.GinCtx(c)
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgInvalidParams))
	}

	bindingType := strings.ToLower(strings.TrimSpace(c.PathParam("binding_type")))
	if bindingType == "" {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgInvalidParams))
	}

	user, err := model.GetUserById(id, false)
	if err != nil {
		return dto.FailMsg(err.Error())
	}

	myRole := dto.UserRole(c)
	if myRole <= user.Role && myRole != common.RoleRootUser {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUserNoPermissionSameLevel))
	}

	if err := user.ClearBinding(bindingType); err != nil {
		return dto.FailMsg(err.Error())
	}

	model.RecordLog(user.Id, model.LogTypeManage, fmt.Sprintf("admin cleared %s binding for user %s", bindingType, user.Username))

	return dto.Msg("success")
}

func UpdateSelf(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	ginCtx := dto.GinCtx(c)
	var requestData map[string]interface{}
	err := dto.Decode(c, &requestData)
	if err != nil {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgInvalidParams))
	}

	if sidebarModules, sidebarExists := requestData["sidebar_modules"]; sidebarExists {
		userId := dto.UserID(c)
		user, err := model.GetUserById(userId, false)
		if err != nil {
			return dto.FailMsg(err.Error())
		}

		currentSetting := user.GetSetting()

		if sidebarModulesStr, ok := sidebarModules.(string); ok {
			currentSetting.SidebarModules = sidebarModulesStr
		}

		user.SetSetting(currentSetting)
		if err := user.Update(false); err != nil {
			return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUpdateFailed))
		}

		return dto.Msg(common.TranslateMessage(ginCtx, i18n.MsgUpdateSuccess))
	}

	if language, langExists := requestData["language"]; langExists {
		userId := dto.UserID(c)
		user, err := model.GetUserById(userId, false)
		if err != nil {
			return dto.FailMsg(err.Error())
		}

		currentSetting := user.GetSetting()

		if langStr, ok := language.(string); ok {
			currentSetting.Language = langStr
		}

		user.SetSetting(currentSetting)
		if err := user.Update(false); err != nil {
			return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUpdateFailed))
		}

		return dto.Msg(common.TranslateMessage(ginCtx, i18n.MsgUpdateSuccess))
	}

	var user model.User
	requestDataBytes, err := json.Marshal(requestData)
	if err != nil {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgInvalidParams))
	}
	err = json.Unmarshal(requestDataBytes, &user)
	if err != nil {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgInvalidParams))
	}

	if user.Password == "" {
		user.Password = "$I_LOVE_U"
	}
	if err := common.Validate.Struct(&user); err != nil {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgInvalidInput))
	}

	cleanUser := model.User{
		Id:          dto.UserID(c),
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.DisplayName,
	}
	if user.Password == "$I_LOVE_U" {
		user.Password = ""
		cleanUser.Password = ""
	}
	updatePassword, err := checkUpdatePassword(user.OriginalPassword, user.Password, cleanUser.Id)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	if err := cleanUser.Update(updatePassword); err != nil {
		return dto.FailMsg(err.Error())
	}

	return dto.Msg("")
}

func checkUpdatePassword(originalPassword string, newPassword string, userId int) (updatePassword bool, err error) {
	var currentUser *model.User
	currentUser, err = model.GetUserById(userId, true)
	if err != nil {
		return
	}

	if !common.ValidatePasswordAndHash(originalPassword, currentUser.Password) && currentUser.Password != "" {
		err = fmt.Errorf("原密码错误")
		return
	}
	if newPassword == "" {
		return
	}
	updatePassword = true
	return
}

func DeleteUser(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	originUser, err := model.GetUserById(id, false)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	myRole := dto.UserRole(c)
	if myRole <= originUser.Role {
		return dto.FailMsg(common.TranslateMessage(dto.GinCtx(c), i18n.MsgUserNoPermissionHigherLevel))
	}
	err = model.HardDeleteUserById(id)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	return dto.Msg("")
}

func DeleteSelf(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	id := dto.UserID(c)
	user, _ := model.GetUserById(id, false)

	if user.Role == common.RoleRootUser {
		return dto.FailMsg(common.TranslateMessage(dto.GinCtx(c), i18n.MsgUserCannotDeleteRootUser))
	}

	err := model.DeleteUserById(id)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	return dto.Msg("")
}

func CreateUser(c fuego.ContextWithBody[model.User]) (dto.MessageResponse, error) {
	ginCtx := dto.GinCtx(c)
	user, err := c.Body()
	user.Username = strings.TrimSpace(user.Username)
	if err != nil || user.Username == "" || user.Password == "" {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgInvalidParams))
	}
	if err := common.Validate.Struct(&user); err != nil {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUserInputInvalid, map[string]any{"Error": err.Error()}))
	}
	if user.DisplayName == "" {
		user.DisplayName = user.Username
	}
	myRole := dto.UserRole(c)
	if user.Role >= myRole {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUserCannotCreateHigherLevel))
	}
	cleanUser := model.User{
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.DisplayName,
		Role:        user.Role,
	}
	if err := cleanUser.Insert(0); err != nil {
		return dto.FailMsg(err.Error())
	}

	return dto.Msg("")
}

// ManageUser handles user management actions (enable/disable/delete/promote/demote)
func ManageUser(c fuego.ContextWithBody[dto.ManageRequest]) (*dto.Response[dto.ManageUserData], error) {
	ginCtx := dto.GinCtx(c)
	req, err := c.Body()

	if err != nil {
		return dto.Fail[dto.ManageUserData](common.TranslateMessage(ginCtx, i18n.MsgInvalidParams))
	}
	user := model.User{
		Id: req.Id,
	}
	model.DB.Unscoped().Where(&user).First(&user)
	if user.Id == 0 {
		return dto.Fail[dto.ManageUserData](common.TranslateMessage(ginCtx, i18n.MsgUserNotExists))
	}
	myRole := dto.UserRole(c)
	if myRole <= user.Role && myRole != common.RoleRootUser {
		return dto.Fail[dto.ManageUserData](common.TranslateMessage(ginCtx, i18n.MsgUserNoPermissionHigherLevel))
	}
	switch req.Action {
	case "disable":
		user.Status = common.UserStatusDisabled
		if user.Role == common.RoleRootUser {
			return dto.Fail[dto.ManageUserData](common.TranslateMessage(ginCtx, i18n.MsgUserCannotDisableRootUser))
		}
	case "enable":
		user.Status = common.UserStatusEnabled
	case "delete":
		if user.Role == common.RoleRootUser {
			return dto.Fail[dto.ManageUserData](common.TranslateMessage(ginCtx, i18n.MsgUserCannotDeleteRootUser))
		}
		if err := user.Delete(); err != nil {
			return dto.Fail[dto.ManageUserData](err.Error())
		}
	case "promote":
		if myRole != common.RoleRootUser {
			return dto.Fail[dto.ManageUserData](common.TranslateMessage(ginCtx, i18n.MsgUserAdminCannotPromote))
		}
		if user.Role >= common.RoleAdminUser {
			return dto.Fail[dto.ManageUserData](common.TranslateMessage(ginCtx, i18n.MsgUserAlreadyAdmin))
		}
		user.Role = common.RoleAdminUser
	case "demote":
		if user.Role == common.RoleRootUser {
			return dto.Fail[dto.ManageUserData](common.TranslateMessage(ginCtx, i18n.MsgUserCannotDemoteRootUser))
		}
		if user.Role == common.RoleCommonUser {
			return dto.Fail[dto.ManageUserData](common.TranslateMessage(ginCtx, i18n.MsgUserAlreadyCommon))
		}
		user.Role = common.RoleCommonUser
	}

	if err := user.Update(false); err != nil {
		return dto.Fail[dto.ManageUserData](err.Error())
	}
	return dto.Ok(dto.ManageUserData{Role: user.Role, Status: user.Status})
}

func EmailBind(c fuego.ContextWithParams[dto.EmailBindParams]) (dto.MessageResponse, error) {
	ginCtx := dto.GinCtx(c)
	p, _ := dto.ParseParams[dto.EmailBindParams](c)
	if !common.VerifyCodeWithKey(p.Email, p.Code, common.EmailVerificationPurpose) {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUserVerificationCodeError))
	}
	session := sessions.Default(ginCtx)
	id, ok := session.Get("id").(int)
	if !ok || id == 0 {
		return dto.FailMsg("未登录")
	}
	user := model.User{
		Id: id,
	}
	if err := user.FillUserById(); err != nil {
		return dto.FailMsg(err.Error())
	}
	user.Email = p.Email
	if err := user.Update(false); err != nil {
		return dto.FailMsg(err.Error())
	}
	return dto.Msg("")
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

func TopUp(c fuego.ContextWithBody[dto.TopUpRequest]) (*dto.Response[int], error) {
	ginCtx := dto.GinCtx(c)
	id := dto.UserID(c)
	lock := getTopUpLock(id)
	if !lock.TryLock() {
		return dto.Fail[int](common.TranslateMessage(ginCtx, i18n.MsgUserTopUpProcessing))
	}
	defer lock.Unlock()
	req, err := c.Body()
	if err != nil {
		return dto.Fail[int](err.Error())
	}
	quota, err := model.Redeem(req.Key, id)
	if err != nil {
		if errors.Is(err, model.ErrRedeemFailed) {
			return dto.Fail[int](common.TranslateMessage(ginCtx, i18n.MsgRedeemFailed))
		}
		return dto.Fail[int](err.Error())
	}
	return dto.Ok(quota)
}

func UpdateUserSetting(c fuego.ContextWithBody[dto.UpdateUserSettingRequest]) (dto.MessageResponse, error) {
	ginCtx := dto.GinCtx(c)
	req, err := c.Body()
	if err != nil {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgInvalidParams))
	}

	if req.QuotaWarningType != dto.NotifyTypeEmail && req.QuotaWarningType != dto.NotifyTypeWebhook && req.QuotaWarningType != dto.NotifyTypeBark && req.QuotaWarningType != dto.NotifyTypeGotify {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgSettingInvalidType))
	}

	if req.QuotaWarningThreshold <= 0 {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgQuotaThresholdGtZero))
	}

	if req.QuotaWarningType == dto.NotifyTypeWebhook {
		if req.WebhookUrl == "" {
			return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgSettingWebhookEmpty))
		}
		if _, err := url.ParseRequestURI(req.WebhookUrl); err != nil {
			return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgSettingWebhookInvalid))
		}
	}

	if req.QuotaWarningType == dto.NotifyTypeEmail && req.NotificationEmail != "" {
		if !strings.Contains(req.NotificationEmail, "@") {
			return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgSettingEmailInvalid))
		}
	}

	if req.QuotaWarningType == dto.NotifyTypeBark {
		if req.BarkUrl == "" {
			return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgSettingBarkUrlEmpty))
		}
		if _, err := url.ParseRequestURI(req.BarkUrl); err != nil {
			return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgSettingBarkUrlInvalid))
		}
		if !strings.HasPrefix(req.BarkUrl, "https://") && !strings.HasPrefix(req.BarkUrl, "http://") {
			return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgSettingUrlMustHttp))
		}
	}

	if req.QuotaWarningType == dto.NotifyTypeGotify {
		if req.GotifyUrl == "" {
			return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgSettingGotifyUrlEmpty))
		}
		if req.GotifyToken == "" {
			return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgSettingGotifyTokenEmpty))
		}
		if _, err := url.ParseRequestURI(req.GotifyUrl); err != nil {
			return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgSettingGotifyUrlInvalid))
		}
		if !strings.HasPrefix(req.GotifyUrl, "https://") && !strings.HasPrefix(req.GotifyUrl, "http://") {
			return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgSettingUrlMustHttp))
		}
	}

	userId := dto.UserID(c)
	user, err := model.GetUserById(userId, true)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	existingSettings := user.GetSetting()
	upstreamModelUpdateNotifyEnabled := existingSettings.UpstreamModelUpdateNotifyEnabled
	if user.Role >= common.RoleAdminUser && req.UpstreamModelUpdateNotifyEnabled != nil {
		upstreamModelUpdateNotifyEnabled = *req.UpstreamModelUpdateNotifyEnabled
	}

	settings := dto.UserSetting{
		NotifyType:                       req.QuotaWarningType,
		QuotaWarningThreshold:            req.QuotaWarningThreshold,
		UpstreamModelUpdateNotifyEnabled: upstreamModelUpdateNotifyEnabled,
		AcceptUnsetRatioModel:            req.AcceptUnsetModelRatioModel,
		RecordIpLog:                      req.RecordIpLog,
	}

	if req.QuotaWarningType == dto.NotifyTypeWebhook {
		settings.WebhookUrl = req.WebhookUrl
		if req.WebhookSecret != "" {
			settings.WebhookSecret = req.WebhookSecret
		}
	}

	if req.QuotaWarningType == dto.NotifyTypeEmail && req.NotificationEmail != "" {
		settings.NotificationEmail = req.NotificationEmail
	}

	if req.QuotaWarningType == dto.NotifyTypeBark {
		settings.BarkUrl = req.BarkUrl
	}

	if req.QuotaWarningType == dto.NotifyTypeGotify {
		settings.GotifyUrl = req.GotifyUrl
		settings.GotifyToken = req.GotifyToken
		if req.GotifyPriority < 0 || req.GotifyPriority > 10 {
			settings.GotifyPriority = 5
		} else {
			settings.GotifyPriority = req.GotifyPriority
		}
	}

	user.SetSetting(settings)
	if err := user.Update(false); err != nil {
		return dto.FailMsg(common.TranslateMessage(ginCtx, i18n.MsgUpdateFailed))
	}

	return dto.Msg(common.TranslateMessage(ginCtx, i18n.MsgSettingSaved))
}
