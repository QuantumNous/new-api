package controller

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type FirebaseLoginRequest struct {
	IdToken string `json:"id_token"`
}

func FirebaseLogin(c *gin.Context) {
	var req FirebaseLoginRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	idToken := strings.TrimSpace(req.IdToken)
	if idToken == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	firebaseUser, err := service.VerifyFirebaseIDToken(c.Request.Context(), idToken)
	if err != nil {
		common.ApiErrorMsg(c, "Firebase 登录校验失败: "+err.Error())
		return
	}
	if firebaseUser.UID == "" {
		common.ApiErrorMsg(c, "Firebase 用户 ID 为空")
		return
	}

	user := &model.User{FirebaseBaseId: firebaseUser.UID}
	err = user.FillUserByFirebaseBaseId()
	if err == nil {
		if user.Id == 0 {
			common.ApiErrorI18n(c, i18n.MsgOAuthUserDeleted)
			return
		}
		if user.Status != common.UserStatusEnabled {
			common.ApiErrorI18n(c, i18n.MsgOAuthUserBanned)
			return
		}
		setupLogin(user, c)
		return
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiError(c, err)
		return
	}

	if !common.RegisterEnabled {
		common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
		return
	}

	newUser := buildFirebaseUser(firebaseUser)
	session := sessions.Default(c)
	inviterId := getOAuthInviterId(session)

	err = model.DB.Transaction(func(tx *gorm.DB) error {
		return newUser.InsertWithTx(tx, inviterId)
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}

	newUser.FinalizeOAuthUserCreation(inviterId)
	setupLogin(newUser, c)
}

func buildFirebaseUser(firebaseUser *service.FirebaseUserInfo) *model.User {
	username := firebaseFallbackUsername()
	if candidate := firebaseUsernameCandidate(firebaseUser); candidate != "" {
		if exists, err := model.CheckUserExistOrDeleted(candidate, ""); err == nil && !exists {
			username = candidate
		}
	}

	displayName := firebaseUser.Name
	if displayName == "" {
		displayName = username
	}
	displayName = trimUserText(displayName)

	return &model.User{
		Username:       username,
		DisplayName:    displayName,
		Email:          firebaseUser.Email,
		FirebaseBaseId: firebaseUser.UID,
		Role:           common.RoleCommonUser,
		Status:         common.UserStatusEnabled,
	}
}

func firebaseFallbackUsername() string {
	userID := strconv.Itoa(model.GetMaxUserId() + 1)
	username := "firebase_" + userID
	if len(username) <= model.UserNameMaxLength {
		return username
	}
	return trimUserText("fb_" + userID)
}

func firebaseUsernameCandidate(firebaseUser *service.FirebaseUserInfo) string {
	source := strings.TrimSpace(firebaseUser.Email)
	if source != "" {
		source = strings.Split(source, "@")[0]
	}
	if source == "" {
		source = strings.TrimSpace(firebaseUser.Name)
	}
	if source == "" {
		return ""
	}

	var builder strings.Builder
	for _, r := range strings.ToLower(source) {
		switch {
		case r >= 'a' && r <= 'z':
			builder.WriteRune(r)
		case r >= '0' && r <= '9':
			builder.WriteRune(r)
		case r == '_' || r == '-':
			builder.WriteRune(r)
		}
		if builder.Len() >= model.UserNameMaxLength {
			break
		}
	}
	return builder.String()
}

func trimUserText(text string) string {
	runes := []rune(text)
	if len(runes) <= model.UserNameMaxLength {
		return text
	}
	return string(runes[:model.UserNameMaxLength])
}

func getOAuthInviterId(session sessions.Session) int {
	affCode := session.Get("aff")
	if affCode == nil {
		return 0
	}
	code, ok := affCode.(string)
	if !ok || code == "" {
		return 0
	}
	inviterId, _ := model.GetUserIdByAffCode(code)
	return inviterId
}
