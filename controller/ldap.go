package controller

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type LDAPLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LDAPBindingResponse struct {
	UserId          int      `json:"user_id"`
	LDAPUserId      string   `json:"ldap_user_id"`
	LDAPUsername    string   `json:"ldap_username"`
	LDAPDisplayName string   `json:"ldap_display_name"`
	LDAPEmail       string   `json:"ldap_email"`
	LDAPGroups      []string `json:"ldap_groups"`
	LastSyncTime    int64    `json:"last_sync_time"`
}

var authenticateLDAPUser = func(ctx context.Context, username, password string) (*service.LDAPAuthenticatedUser, error) {
	return service.AuthenticateLDAPUser(ctx, username, password)
}

func LDAPLogin(c *gin.Context) {
	settings := system_setting.GetLDAPSettings()
	if !settings.Enabled {
		common.ApiErrorMsg(c, "LDAP login is not enabled")
		return
	}

	var request LDAPLoginRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if request.Username == "" || request.Password == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	ldapUser, err := authenticateLDAPUser(c.Request.Context(), request.Username, request.Password)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if ldapUser == nil || ldapUser.LDAPUserID == "" {
		common.ApiErrorMsg(c, "LDAP user info is incomplete")
		return
	}

	user, err := findOrCreateLDAPUser(c, ldapUser)
	if err != nil {
		switch {
		case errors.Is(err, errLDAPRegistrationDisabled):
			common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
		default:
			common.ApiError(c, err)
		}
		return
	}
	if user.Status != common.UserStatusEnabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthUserBanned)
		return
	}

	setupLogin(user, c)
}

var errLDAPRegistrationDisabled = errors.New("registration is disabled")

func findOrCreateLDAPUser(c *gin.Context, ldapUser *service.LDAPAuthenticatedUser) (*model.User, error) {
	binding, err := model.GetUserLDAPBindingByLDAPUserId(ldapUser.LDAPUserID)
	if err == nil {
		if err := moveLDAPBindingToTrustedEmailOwner(binding, ldapUser); err != nil {
			return nil, err
		}
		if err := refreshLDAPBindingSnapshot(binding, ldapUser); err != nil {
			return nil, err
		}
		if err := syncLDAPUserProfile(binding.UserId, ldapUser); err != nil {
			return nil, err
		}
		return model.GetUserById(binding.UserId, false)
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	existingUser, err := findLDAPEmailMatchedUser(ldapUser)
	if err == nil {
		return bindLDAPToExistingUser(existingUser, ldapUser)
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if !common.RegisterEnabled {
		return nil, errLDAPRegistrationDisabled
	}

	newUser := &model.User{
		Username:    nextLDAPUsername(ldapUser.Username),
		DisplayName: ldapDisplayName(ldapUser),
		Email:       ldapUser.Email,
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
	}

	session := sessions.Default(c)
	affCode := session.Get("aff")
	inviterId := 0
	if affCode != nil {
		inviterId, _ = model.GetUserIdByAffCode(affCode.(string))
	}

	err = model.DB.Transaction(func(tx *gorm.DB) error {
		if err := newUser.InsertWithTx(tx, inviterId); err != nil {
			return err
		}
		binding, err := newLDAPBindingFromAuthenticatedUser(newUser.Id, ldapUser)
		if err != nil {
			return err
		}
		return model.CreateUserLDAPBindingWithTx(tx, binding)
	})
	if err != nil {
		return nil, err
	}
	newUser.FinalizeOAuthUserCreation(inviterId)
	return newUser, nil
}

func findLDAPEmailMatchedUser(ldapUser *service.LDAPAuthenticatedUser) (*model.User, error) {
	if ldapUser == nil {
		return nil, gorm.ErrRecordNotFound
	}
	return model.FindUniqueUserByEmail(ldapUser.Email)
}

func bindLDAPToExistingUser(user *model.User, ldapUser *service.LDAPAuthenticatedUser) (*model.User, error) {
	if user == nil || user.Id == 0 {
		return nil, errors.New("matched user is invalid")
	}
	existingByUser, err := model.GetUserLDAPBindingByUserId(user.Id)
	if err == nil {
		if existingByUser.LDAPUserId == ldapUser.LDAPUserID {
			if err := refreshLDAPBindingSnapshot(existingByUser, ldapUser); err != nil {
				return nil, err
			}
			if err := syncLDAPUserProfile(user.Id, ldapUser); err != nil {
				return nil, err
			}
			return model.GetUserById(user.Id, false)
		}
		return nil, errors.New("当前邮箱对应用户已绑定其他 LDAP 账户")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	binding, err := newLDAPBindingFromAuthenticatedUser(user.Id, ldapUser)
	if err != nil {
		return nil, err
	}
	if err := model.CreateUserLDAPBinding(binding); err != nil {
		return nil, err
	}
	if err := syncLDAPUserProfile(user.Id, ldapUser); err != nil {
		return nil, err
	}
	return model.GetUserById(user.Id, false)
}

func moveLDAPBindingToTrustedEmailOwner(binding *model.UserLDAPBinding, ldapUser *service.LDAPAuthenticatedUser) error {
	if binding == nil || ldapUser == nil {
		return nil
	}
	emailOwner, err := model.FindUniqueUserByEmail(ldapUser.Email)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if emailOwner.Id == binding.UserId {
		return nil
	}
	existingByUser, err := model.GetUserLDAPBindingByUserId(emailOwner.Id)
	if err == nil && existingByUser.Id != binding.Id {
		return errors.New("LDAP 邮箱对应用户已绑定其他 LDAP 账户")
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if err := model.UpdateUserLDAPBindingUserId(binding.Id, emailOwner.Id); err != nil {
		return err
	}
	binding.UserId = emailOwner.Id
	return nil
}

func ensureLDAPEmailAvailableForUser(userId int, ldapUser *service.LDAPAuthenticatedUser) error {
	if userId == 0 || ldapUser == nil {
		return nil
	}
	emailOwner, err := model.FindUniqueUserByEmail(ldapUser.Email)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if emailOwner.Id != userId {
		return errors.New("该 LDAP 邮箱已属于其他用户")
	}
	return nil
}

func syncLDAPUserProfile(userId int, ldapUser *service.LDAPAuthenticatedUser) error {
	if userId == 0 || ldapUser == nil {
		return nil
	}
	updates := make(map[string]interface{})
	if displayName := strings.TrimSpace(ldapDisplayName(ldapUser)); displayName != "" {
		updates["display_name"] = displayName
	}
	if email := strings.TrimSpace(ldapUser.Email); email != "" {
		updates["email"] = email
	}
	if len(updates) == 0 {
		return nil
	}
	return model.DB.Model(&model.User{}).Where("id = ?", userId).Updates(updates).Error
}

func ldapDisplayName(user *service.LDAPAuthenticatedUser) string {
	if user.DisplayName != "" {
		return user.DisplayName
	}
	if user.Username != "" {
		return user.Username
	}
	return "LDAP User"
}

func nextLDAPUsername(username string) string {
	if username != "" {
		if exists, err := model.CheckUserExistOrDeleted(username, ""); err == nil && !exists && len(username) <= model.UserNameMaxLength {
			return username
		}
	}
	return "ldap_" + strconv.Itoa(model.GetMaxUserId()+1)
}

func LDAPBind(c *gin.Context) {
	settings := system_setting.GetLDAPSettings()
	if !settings.Enabled {
		common.ApiErrorMsg(c, "LDAP login is not enabled")
		return
	}

	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}

	var request LDAPLoginRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if request.Username == "" || request.Password == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	ldapUser, err := authenticateLDAPUser(c.Request.Context(), request.Username, request.Password)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if ldapUser == nil || ldapUser.LDAPUserID == "" {
		common.ApiErrorMsg(c, "LDAP user info is incomplete")
		return
	}

	if err := ensureLDAPEmailAvailableForUser(userId, ldapUser); err != nil {
		common.ApiError(c, err)
		return
	}

	existingByLDAP, err := model.GetUserLDAPBindingByLDAPUserId(ldapUser.LDAPUserID)
	if err == nil && existingByLDAP.UserId != userId {
		common.ApiErrorMsg(c, "该 LDAP 账户已被绑定")
		return
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiError(c, err)
		return
	}

	existingByUser, err := model.GetUserLDAPBindingByUserId(userId)
	if err == nil && existingByUser.LDAPUserId != ldapUser.LDAPUserID {
		common.ApiErrorMsg(c, "当前用户已绑定其他 LDAP 账户")
		return
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiError(c, err)
		return
	}

	var binding *model.UserLDAPBinding
	if existingByUser != nil {
		binding = existingByUser
		if err := refreshLDAPBindingSnapshot(binding, ldapUser); err != nil {
			common.ApiError(c, err)
			return
		}
	} else {
		binding, err = newLDAPBindingFromAuthenticatedUser(userId, ldapUser)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if err := model.CreateUserLDAPBinding(binding); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if err := syncLDAPUserProfile(userId, ldapUser); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "bind",
		"data":    toLDAPBindingResponse(binding),
	})
}

func GetSelfLDAPBinding(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	respondLDAPBindingByUserId(c, userId)
}

func GetLDAPBindingByAdmin(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	targetUser, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	myRole := c.GetInt("role")
	if !canManageTargetRole(myRole, targetUser.Role) {
		common.ApiErrorMsg(c, "no permission")
		return
	}

	respondLDAPBindingByUserId(c, userId)
}

func respondLDAPBindingByUserId(c *gin.Context, userId int) {
	response, err := getLDAPBindingResponseForUser(userId)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    nil,
		})
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    response,
	})
}

func getLDAPBindingResponseForUser(userId int) (*LDAPBindingResponse, error) {
	binding, err := model.GetUserLDAPBindingByUserId(userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return toLDAPBindingResponse(binding), nil
}

func newLDAPBindingFromAuthenticatedUser(userId int, ldapUser *service.LDAPAuthenticatedUser) (*model.UserLDAPBinding, error) {
	binding := &model.UserLDAPBinding{
		UserId:          userId,
		LDAPUserId:      ldapUser.LDAPUserID,
		LDAPUsername:    ldapUser.Username,
		LDAPDisplayName: ldapUser.DisplayName,
		LDAPEmail:       ldapUser.Email,
	}
	if err := binding.SetGroups(ldapUser.Groups); err != nil {
		return nil, err
	}
	return binding, nil
}

func refreshLDAPBindingSnapshot(binding *model.UserLDAPBinding, ldapUser *service.LDAPAuthenticatedUser) error {
	binding.LDAPUserId = ldapUser.LDAPUserID
	if err := binding.UpdateSnapshot(ldapUser.Username, ldapUser.DisplayName, ldapUser.Email, ldapUser.Groups); err != nil {
		return err
	}
	return model.UpdateUserLDAPBindingSnapshot(binding)
}

func toLDAPBindingResponse(binding *model.UserLDAPBinding) *LDAPBindingResponse {
	if binding == nil {
		return nil
	}
	return &LDAPBindingResponse{
		UserId:          binding.UserId,
		LDAPUserId:      binding.LDAPUserId,
		LDAPUsername:    binding.LDAPUsername,
		LDAPDisplayName: binding.LDAPDisplayName,
		LDAPEmail:       binding.LDAPEmail,
		LDAPGroups:      binding.GroupList(),
		LastSyncTime:    binding.LastSyncTime,
	}
}
