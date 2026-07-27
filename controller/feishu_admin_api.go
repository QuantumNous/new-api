package controller

import (
	"bytes"
	"crypto/subtle"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

type FeishuUserInitItem struct {
	FeishuOpenId  string `json:"feishu_open_id"`
	FeishuUnionId string `json:"feishu_union_id"`
	FeishuUserId  string `json:"feishu_user_id"`
	EmployeeID    string `json:"employee_id"`
	Mobile        string `json:"mobile"`
	Email         string `json:"email"`
	Username      string `json:"username"`
	DisplayName   string `json:"display_name"`
	Password      string `json:"password"`
	Group         string `json:"group"`
	Quota         *int   `json:"quota"`
	Role          *int   `json:"role"`
	Remark        string `json:"remark"`
	OrgName       string `json:"org_name"`
	OrgPath       string `json:"org_path"`
	JobTitle      string `json:"job_title"`
	Confirmed     bool   `json:"confirmed"`
}

type BatchCreateFeishuUsersRequest struct {
	PreviewOnly bool                 `json:"preview_only"`
	Users       []FeishuUserInitItem `json:"users" binding:"required,dive"`
}

type BatchCreateFeishuUsersResult struct {
	Total   int                        `json:"total"`
	Success int                        `json:"success"`
	Skipped int                        `json:"skipped"`
	Failed  int                        `json:"failed"`
	Results []FeishuUserInitResultItem `json:"results,omitempty"`
	Errors  []string                   `json:"errors,omitempty"`
}

type FeishuUserInitResultItem struct {
	FeishuOpenId  string `json:"feishu_open_id"`
	FeishuUnionId string `json:"feishu_union_id,omitempty"`
	FeishuUserId  string `json:"feishu_user_id,omitempty"`
	UserId        int    `json:"user_id,omitempty"`
	Username      string `json:"username,omitempty"`
	DisplayName   string `json:"display_name,omitempty"`
	OrgName       string `json:"org_name,omitempty"`
	OrgPath       string `json:"org_path,omitempty"`
	OrgLevel1Name string `json:"org_level1_name,omitempty"`
	OrgLevel2Name string `json:"org_level2_name,omitempty"`
	JobTitle      string `json:"job_title,omitempty"`
	TokenId       int    `json:"token_id,omitempty"`
	TokenName     string `json:"token_name,omitempty"`
	TokenKey      string `json:"token_key,omitempty"`
	Action        string `json:"action"`
	Error         string `json:"error,omitempty"`
	Warning       string `json:"warning,omitempty"`
}

type FeishuInitWebhookRequest struct {
	Users []FeishuUserInitItem `json:"users" binding:"required,dive"`
}

type createTokenOptions struct {
	Name               string
	RemainQuota        *int
	UnlimitedQuota     *bool
	ExpiredTime        *int64
	ModelLimitsEnabled *bool
	ModelLimits        string
	AllowIps           string
	Group              string
	CrossGroupRetry    *bool
}

type feishuTenantAccessTokenResp struct {
	Code              int    `json:"code"`
	Msg               string `json:"msg"`
	TenantAccessToken string `json:"tenant_access_token"`
}

type feishuContactUserResp struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		User struct {
			OpenID     string `json:"open_id"`
			UnionID    string `json:"union_id"`
			UserID     string `json:"user_id"`
			Name       string `json:"name"`
			EnName     string `json:"en_name"`
			EmployeeID string `json:"employee_no"`
			Mobile     string `json:"mobile"`
			Email      string `json:"email"`
			JobTitle   string `json:"job_title"`
			OrgPath    struct {
				Name string `json:"name"`
			} `json:"department_path_name"`
		} `json:"user"`
	} `json:"data"`
}

// findExistingFeishuUser 按 open_id / union_id / user_id 三重查重。
// 任一标识命中已存在用户即返回该用户，确保一个飞书账号只能创建一个 new-api 用户。
func findExistingFeishuUser(openID, unionID, userID string) (model.User, bool) {
	var user model.User
	openID = strings.TrimSpace(openID)
	unionID = strings.TrimSpace(unionID)
	userID = strings.TrimSpace(userID)
	if openID != "" {
		if err := model.DB.Where("feishu_id = ?", openID).First(&user).Error; err == nil && user.Id > 0 {
			return user, true
		}
	}
	if unionID != "" {
		if err := model.DB.Where("feishu_union_id = ?", unionID).First(&user).Error; err == nil && user.Id > 0 {
			return user, true
		}
	}
	if userID != "" {
		if err := model.DB.Where("feishu_user_id = ?", userID).First(&user).Error; err == nil && user.Id > 0 {
			return user, true
		}
	}
	return model.User{}, false
}

func resolveFeishuIdentifiers(ctx *gin.Context, openID, unionID, userID string) (string, string, string) {
	openID = strings.TrimSpace(openID)
	unionID = strings.TrimSpace(unionID)
	userID = strings.TrimSpace(userID)

	// 先走本地已存在映射补齐，减少外部调用。
	var user model.User
	if openID != "" {
		if err := model.DB.Where("feishu_id = ?", openID).First(&user).Error; err == nil {
			if unionID == "" {
				unionID = strings.TrimSpace(user.FeishuUnionId)
			}
			if userID == "" {
				userID = strings.TrimSpace(user.FeishuUserId)
			}
		}
	} else if unionID != "" {
		if err := model.DB.Where("feishu_union_id = ?", unionID).First(&user).Error; err == nil {
			openID = strings.TrimSpace(user.FeishuId)
			if userID == "" {
				userID = strings.TrimSpace(user.FeishuUserId)
			}
		}
	} else if userID != "" {
		if err := model.DB.Where("feishu_user_id = ?", userID).First(&user).Error; err == nil {
			openID = strings.TrimSpace(user.FeishuId)
			if unionID == "" {
				unionID = strings.TrimSpace(user.FeishuUnionId)
			}
		}
	}

	if openID != "" && unionID != "" && userID != "" {
		return openID, unionID, userID
	}

	// 再走飞书平台补齐（best-effort，不阻断主流程）。
	settings := system_setting.GetFeishuSettings()
	if settings.AppID == "" || settings.AppSecret == "" {
		return openID, unionID, userID
	}
	token, err := getFeishuTenantAccessToken(ctx, settings.AppID, settings.AppSecret)
	if err != nil || token == "" {
		return openID, unionID, userID
	}

	idType := ""
	lookupID := ""
	if openID != "" {
		idType = "open_id"
		lookupID = openID
	} else if unionID != "" {
		idType = "union_id"
		lookupID = unionID
	} else if userID != "" {
		idType = "user_id"
		lookupID = userID
	}
	if idType == "" || lookupID == "" {
		return openID, unionID, userID
	}

	gotOpenID, gotUnionID, gotUserID, err := getFeishuUserIdentifiersByAnyID(ctx, token, idType, lookupID)
	if err != nil {
		return openID, unionID, userID
	}
	if openID == "" {
		openID = gotOpenID
	}
	if unionID == "" {
		unionID = gotUnionID
	}
	if userID == "" {
		userID = gotUserID
	}
	return openID, unionID, userID
}

func getFeishuTenantAccessToken(ctx *gin.Context, appID, appSecret string) (string, error) {
	reqBody := map[string]string{
		"app_id":     appID,
		"app_secret": appSecret,
	}
	bodyBytes, err := common.Marshal(reqBody)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx.Request.Context(), "POST", "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	client := http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	var parsed feishuTenantAccessTokenResp
	if err = common.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	if parsed.Code != 0 || strings.TrimSpace(parsed.TenantAccessToken) == "" {
		return "", fmt.Errorf("feishu token failed: code=%d msg=%s", parsed.Code, parsed.Msg)
	}
	return parsed.TenantAccessToken, nil
}

func getFeishuUserProfileByAnyID(ctx *gin.Context, tenantToken, idType, idValue string) (string, string, string, string, string, string, string, error) {
	url := fmt.Sprintf("https://open.feishu.cn/open-apis/contact/v3/users/%s?user_id_type=%s", idValue, idType)
	req, err := http.NewRequestWithContext(ctx.Request.Context(), "GET", url, nil)
	if err != nil {
		return "", "", "", "", "", "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+tenantToken)
	client := http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", "", "", "", "", "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", "", "", "", "", "", err
	}
	var parsed feishuContactUserResp
	if err = common.Unmarshal(raw, &parsed); err != nil {
		return "", "", "", "", "", "", "", err
	}
	if parsed.Code != 0 {
		return "", "", "", "", "", "", "", fmt.Errorf("feishu contact failed: code=%d msg=%s", parsed.Code, parsed.Msg)
	}
	name := strings.TrimSpace(parsed.Data.User.Name)
	if name == "" {
		name = strings.TrimSpace(parsed.Data.User.EnName)
	}
	orgName := strings.TrimSpace(parsed.Data.User.OrgPath.Name)
	return strings.TrimSpace(parsed.Data.User.OpenID), strings.TrimSpace(parsed.Data.User.UnionID), strings.TrimSpace(parsed.Data.User.UserID), name, orgName, strings.TrimSpace(parsed.Data.User.JobTitle), strings.TrimSpace(parsed.Data.User.EmployeeID), nil
}

func getFeishuUserIdentifiersByAnyID(ctx *gin.Context, tenantToken, idType, idValue string) (string, string, string, error) {
	openID, unionID, userID, _, _, _, _, err := getFeishuUserProfileByAnyID(ctx, tenantToken, idType, idValue)
	if err != nil {
		return "", "", "", err
	}
	return openID, unionID, userID, nil
}

type feishuIdentity struct {
	OpenID  string
	UnionID string
	UserID  string
}

var lookupOfficialFeishuIdentity = func(ctx *gin.Context, idType, idValue string) (feishuIdentity, error) {
	settings := system_setting.GetFeishuSettings()
	if strings.TrimSpace(settings.AppID) == "" || strings.TrimSpace(settings.AppSecret) == "" {
		return feishuIdentity{}, fmt.Errorf("feishu app configuration is missing")
	}
	token, err := getFeishuTenantAccessToken(ctx, settings.AppID, settings.AppSecret)
	if err != nil {
		return feishuIdentity{}, err
	}
	openID, unionID, userID, err := getFeishuUserIdentifiersByAnyID(ctx, token, idType, idValue)
	if err != nil {
		return feishuIdentity{}, err
	}
	if openID == "" && unionID == "" && userID == "" {
		return feishuIdentity{}, fmt.Errorf("feishu user not found")
	}
	return feishuIdentity{OpenID: openID, UnionID: unionID, UserID: userID}, nil
}

func validateFeishuIdentity(ctx *gin.Context, openID, unionID, userID string) (feishuIdentity, error) {
	openID = strings.TrimSpace(openID)
	unionID = strings.TrimSpace(unionID)
	userID = strings.TrimSpace(userID)
	idType, idValue := pickFeishuIdType(openID, userID, unionID)
	if idType == "" {
		return feishuIdentity{}, fmt.Errorf("at least one feishu identifier is required")
	}
	official, err := lookupOfficialFeishuIdentity(ctx, idType, idValue)
	if err != nil {
		return feishuIdentity{}, fmt.Errorf("validate feishu identity: %w", err)
	}
	checks := []struct{ name, input, official string }{
		{"open_id", openID, official.OpenID},
		{"union_id", unionID, official.UnionID},
		{"user_id", userID, official.UserID},
	}
	for _, check := range checks {
		if check.input != "" && check.input != check.official {
			return feishuIdentity{}, fmt.Errorf("%s mismatch", check.name)
		}
	}
	return official, nil
}

// enrichFeishuNameAndEmployeeNo 在已有飞书标识后，补充查询用户的 name 和 employee_no。
// 用于调用方只传了 open_id/union_id/user_id 但没传 name 或工号的场景。
func enrichFeishuNameAndEmployeeNo(ctx *gin.Context, idType, idValue string) (string, string) {
	settings := system_setting.GetFeishuSettings()
	if settings.AppID == "" || settings.AppSecret == "" {
		return "", ""
	}
	token, err := getFeishuTenantAccessToken(ctx, settings.AppID, settings.AppSecret)
	if err != nil || token == "" {
		return "", ""
	}
	_, _, _, name, _, _, employeeNo, err := getFeishuUserProfileByAnyID(ctx, token, idType, idValue)
	if err != nil {
		return "", ""
	}
	return name, employeeNo
}

// pickFeishuIdType 从已有的飞书标识中选出优先用于查询的类型和值。
func pickFeishuIdType(openID, userID, unionID string) (string, string) {
	if openID = strings.TrimSpace(openID); openID != "" {
		return "open_id", openID
	}
	if userID = strings.TrimSpace(userID); userID != "" {
		return "user_id", userID
	}
	if unionID = strings.TrimSpace(unionID); unionID != "" {
		return "union_id", unionID
	}
	return "", ""
}

func getStringField(m map[string]any, keys ...string) string {
	for _, key := range keys {
		if v, ok := m[key]; ok {
			if s, ok := v.(string); ok {
				s = strings.TrimSpace(s)
				if s != "" {
					return s
				}
			}
		}
	}
	return ""
}

func resolveFeishuIdentifiersFromReadable(ctx *gin.Context, employeeID, mobile, email string) (string, string, string, string, string, string, string) {
	employeeID = strings.TrimSpace(employeeID)
	mobile = strings.TrimSpace(mobile)
	email = strings.TrimSpace(email)
	if employeeID == "" && mobile == "" && email == "" {
		return "", "", "", "", "", "", ""
	}

	settings := system_setting.GetFeishuSettings()
	if settings.AppID == "" || settings.AppSecret == "" {
		return "", "", "", "", "", "", ""
	}
	token, err := getFeishuTenantAccessToken(ctx, settings.AppID, settings.AppSecret)
	if err != nil || token == "" {
		return "", "", "", "", "", "", ""
	}

	reqBody := map[string]any{}
	if employeeID != "" {
		reqBody["employee_ids"] = []string{employeeID}
	}
	if mobile != "" {
		reqBody["mobiles"] = []string{mobile}
	}
	if email != "" {
		reqBody["emails"] = []string{email}
	}
	if len(reqBody) == 0 {
		return "", "", "", "", "", "", ""
	}

	bodyBytes, err := common.Marshal(reqBody)
	if err != nil {
		return "", "", "", "", "", "", ""
	}
	url := "https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id?user_id_type=open_id"
	req, err := http.NewRequestWithContext(ctx.Request.Context(), "POST", url, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", "", "", "", "", "", ""
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	client := http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", "", "", "", "", ""
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", "", "", "", "", ""
	}

	parsed := map[string]any{}
	if err := common.Unmarshal(raw, &parsed); err != nil {
		return "", "", "", "", "", "", ""
	}
	codeNum, _ := parsed["code"].(float64)
	if int(codeNum) != 0 {
		return "", "", "", "", "", "", ""
	}
	data, _ := parsed["data"].(map[string]any)
	if data == nil {
		return "", "", "", "", "", "", ""
	}
	userList, _ := data["user_list"].([]any)
	if len(userList) == 0 {
		if employeeID != "" {
			openID, unionID, userID, name, orgName, jobTitle, employeeNo, _ := getFeishuUserProfileByAnyID(ctx, token, "user_id", employeeID)
			return openID, unionID, userID, name, orgName, jobTitle, employeeNo
		}
		return "", "", "", "", "", "", ""
	}
	first, _ := userList[0].(map[string]any)
	if first == nil {
		return "", "", "", "", "", "", ""
	}
	openID := getStringField(first, "open_id", "openId")
	unionID := getStringField(first, "union_id", "unionId")
	userID := getStringField(first, "user_id", "userId")
	name := getStringField(first, "name", "en_name")
	orgName := getStringField(first, "department_name")
	jobTitle := getStringField(first, "job_title")
	employeeNo := getStringField(first, "employee_no")
	if openID == "" && userID != "" {
		openID, unionID, userID, _ = getFeishuUserIdentifiersByAnyID(ctx, token, "user_id", userID)
	}
	if openID == "" && unionID != "" {
		openID, unionID, userID, _ = getFeishuUserIdentifiersByAnyID(ctx, token, "union_id", unionID)
	}
	return openID, unionID, userID, name, orgName, jobTitle, employeeNo
}

func buildSafeFeishuUsername(base string) string {
	candidate := strings.TrimSpace(base)
	if candidate == "" {
		candidate = "feishu_user"
	}
	if utf8.RuneCountInString(candidate) <= model.UserNameMaxLength {
		return candidate
	}
	runes := []rune(candidate)
	return string(runes[:model.UserNameMaxLength])
}

func allocateAvailableUsername(base string) (string, error) {
	baseUsername := buildSafeFeishuUsername(base)
	exist, err := model.CheckUserExistOrDeleted(baseUsername, "")
	if err != nil {
		return "", err
	}
	if !exist {
		return baseUsername, nil
	}
	for suffix := 1; suffix <= 99999; suffix++ {
		suffixStr := "_" + strconv.Itoa(suffix)
		maxBaseRunes := model.UserNameMaxLength - utf8.RuneCountInString(suffixStr)
		if maxBaseRunes <= 0 {
			maxBaseRunes = 1
		}
		baseRunes := []rune(baseUsername)
		if len(baseRunes) > maxBaseRunes {
			baseRunes = baseRunes[:maxBaseRunes]
		}
		candidate := string(baseRunes) + suffixStr
		exists, checkErr := model.CheckUserExistOrDeleted(candidate, "")
		if checkErr != nil {
			return "", checkErr
		}
		if !exists {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("unable to allocate username")
}

func verifyFeishuInitWebhookSecret(c *gin.Context) bool {
	secret := strings.TrimSpace(system_setting.GetFeishuSettings().InitWebhookSecret)
	if secret == "" {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "feishu.init_webhook_secret is not configured"})
		return false
	}
	headerSecret := strings.TrimSpace(c.GetHeader("X-Feishu-Init-Secret"))
	if subtle.ConstantTimeCompare([]byte(headerSecret), []byte(secret)) != 1 {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "invalid webhook secret"})
		return false
	}
	return true
}

func formatTokenKeyForResponse(key string) string {
	trimmedKey := strings.TrimSpace(key)
	if trimmedKey == "" {
		return ""
	}
	if strings.HasPrefix(trimmedKey, "sk-") {
		return trimmedKey
	}
	return "sk-" + trimmedKey
}

func createTokenForUser(user *model.User, opts *createTokenOptions) (*model.Token, string, error) {
	maxTokens := operation_setting.GetMaxUserTokens()
	count, err := model.CountUserTokens(user.Id)
	if err != nil {
		return nil, "", err
	}
	if int(count) >= maxTokens {
		return nil, "", fmt.Errorf("user reached max tokens limit (%d)", maxTokens)
	}

	tokenName := "feishu-init"
	if opts != nil && strings.TrimSpace(opts.Name) != "" {
		tokenName = strings.TrimSpace(opts.Name)
	}

	key, err := common.GenerateKey()
	if err != nil {
		return nil, "", err
	}

	remainQuota := 0
	if opts != nil && opts.RemainQuota != nil {
		remainQuota = *opts.RemainQuota
	}
	unlimitedQuota := true
	if opts != nil && opts.UnlimitedQuota != nil {
		unlimitedQuota = *opts.UnlimitedQuota
	}
	expiredTime := int64(-1)
	if opts != nil && opts.ExpiredTime != nil {
		expiredTime = *opts.ExpiredTime
	}
	modelLimitsEnabled := false
	if opts != nil && opts.ModelLimitsEnabled != nil {
		modelLimitsEnabled = *opts.ModelLimitsEnabled
	}
	var allowIps *string
	if opts != nil && strings.TrimSpace(opts.AllowIps) != "" {
		allowIpsValue := strings.TrimSpace(opts.AllowIps)
		allowIps = &allowIpsValue
	}
	crossGroupRetry := false
	if opts != nil && opts.CrossGroupRetry != nil {
		crossGroupRetry = *opts.CrossGroupRetry
	}
	group := ""
	if opts != nil {
		group = strings.TrimSpace(opts.Group)
	}

	modelLimits := ""
	if opts != nil {
		modelLimits = opts.ModelLimits
	}

	token := &model.Token{
		UserId:             user.Id,
		Name:               tokenName,
		Key:                key,
		CreatedTime:        common.GetTimestamp(),
		AccessedTime:       common.GetTimestamp(),
		ExpiredTime:        expiredTime,
		RemainQuota:        remainQuota,
		UnlimitedQuota:     unlimitedQuota,
		ModelLimitsEnabled: modelLimitsEnabled,
		ModelLimits:        modelLimits,
		AllowIps:           allowIps,
		Group:              group,
		CrossGroupRetry:    crossGroupRetry,
	}
	if err = token.Insert(); err != nil {
		return nil, "", err
	}
	return token, formatTokenKeyForResponse(key), nil
}

func BatchCreateFeishuUsers(c *gin.Context) {
	var req BatchCreateFeishuUsersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	result := BatchCreateFeishuUsersResult{
		Total:   len(req.Users),
		Results: make([]FeishuUserInitResultItem, 0, len(req.Users)),
		Errors:  make([]string, 0),
	}

	adminRole := c.GetInt("role")

	for _, item := range req.Users {
		openId := strings.TrimSpace(item.FeishuOpenId)
		unionId := strings.TrimSpace(item.FeishuUnionId)
		userId := strings.TrimSpace(item.FeishuUserId)
		if openId != "" || unionId != "" || userId != "" {
			identity, err := validateFeishuIdentity(c, openId, unionId, userId)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, "invalid feishu identity: "+err.Error())
				result.Results = append(result.Results, FeishuUserInitResultItem{FeishuOpenId: openId, FeishuUnionId: unionId, FeishuUserId: userId, Action: "failed", Error: err.Error()})
				continue
			}
			openId, unionId, userId = identity.OpenID, identity.UnionID, identity.UserID
		}
		resolvedName := strings.TrimSpace(item.DisplayName)
		resolvedEmployeeNo := strings.TrimSpace(item.EmployeeID)
		if openId == "" && unionId == "" && userId == "" {
			openId, unionId, userId, resolvedName, _, _, resolvedEmployeeNo = resolveFeishuIdentifiersFromReadable(c, item.EmployeeID, item.Mobile, item.Email)
		}
		// 如果调用方传了飞书 ID 但没传 name 或工号，去飞书补查。
		if (resolvedName == "" || resolvedEmployeeNo == "") && (openId != "" || userId != "" || unionId != "") {
			idType, idValue := pickFeishuIdType(openId, userId, unionId)
			if idType != "" {
				name, empNo := enrichFeishuNameAndEmployeeNo(c, idType, idValue)
				if resolvedName == "" {
					resolvedName = name
				}
				if resolvedEmployeeNo == "" {
					resolvedEmployeeNo = empNo
				}
			}
		}
		if openId == "" && unionId == "" && userId == "" {
			result.Failed++
			result.Errors = append(result.Errors, "cannot resolve feishu identifiers from feishu ids/readable identifiers")
			result.Results = append(result.Results, FeishuUserInitResultItem{
				FeishuOpenId:  strings.TrimSpace(item.FeishuOpenId),
				FeishuUnionId: strings.TrimSpace(item.FeishuUnionId),
				FeishuUserId:  strings.TrimSpace(item.FeishuUserId),
				Action:        "failed",
				Error:         "no valid feishu identifier found",
			})
			continue
		}
		if !item.Confirmed {
			result.Skipped++
			result.Results = append(result.Results, FeishuUserInitResultItem{
				FeishuOpenId:  openId,
				FeishuUnionId: unionId,
				FeishuUserId:  userId,
				DisplayName:   resolvedName,
				Username:      resolvedEmployeeNo,
				Action:        "preview_only",
				Error:         "请确认用户信息后再初始化（confirmed=true）",
			})
			continue
		}

		existingUser, exists := findExistingFeishuUser(openId, unionId, userId)
		if exists {
			result.Skipped++
			result.Results = append(result.Results, FeishuUserInitResultItem{
				FeishuOpenId:  openId,
				FeishuUnionId: unionId,
				FeishuUserId:  userId,
				UserId:        existingUser.Id,
				Username:      existingUser.Username,
				Action:        "skipped_exists",
			})
			continue
		}

		// 用户名优先用飞书解析出的正确名称，避免调用方乱传。
		username := ""
		if resolvedName != "" {
			username = resolvedName
		} else if displayName := strings.TrimSpace(item.DisplayName); displayName != "" {
			username = displayName
		} else if u := strings.TrimSpace(item.Username); u != "" {
			username = u
		} else {
			username = "feishu_user"
		}
		if resolvedEmployeeNo != "" {
			username = username + "_" + resolvedEmployeeNo
		}

		username, err := allocateAvailableUsername(username)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: allocate username failed: %s", openId, err.Error()))
			result.Results = append(result.Results, FeishuUserInitResultItem{
				FeishuOpenId: openId,
				Action:       "failed",
				Error:        "allocate username failed: " + err.Error(),
			})
			continue
		}

		displayName := strings.TrimSpace(item.DisplayName)
		if displayName == "" {
			displayName = username
		}

		password := item.Password
		if password == "" {
			password = common.GetRandomString(12)
		}

		requestedGroup := strings.TrimSpace(item.Group)
		group, _ := service.ResolveAuthoritativeGroupForFeishuUser(0, "", requestedGroup, openId, item.JobTitle)

		role := common.RoleCommonUser
		if item.Role != nil {
			role = *item.Role
		}
		if role >= adminRole {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: cannot create user with role >= admin", openId))
			result.Results = append(result.Results, FeishuUserInitResultItem{
				FeishuOpenId: openId,
				Action:       "failed",
				Error:        "cannot create user with role >= admin",
			})
			continue
		}

		newUser := model.User{
			Username:      username,
			Password:      password,
			DisplayName:   displayName,
			FeishuId:      openId,
			FeishuUnionId: unionId,
			FeishuUserId:  userId,
			Role:          role,
			Status:        common.UserStatusEnabled,
			Group:         group,
			Remark:        item.Remark,
			OrgName:       strings.TrimSpace(item.OrgName),
			OrgPath:       strings.TrimSpace(item.OrgPath),
			JobTitle:      strings.TrimSpace(item.JobTitle),
		}

		if err := newUser.Insert(0); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: create user failed: %s", openId, err.Error()))
			result.Results = append(result.Results, FeishuUserInitResultItem{
				FeishuOpenId: openId,
				Action:       "failed",
				Error:        "create user failed: " + err.Error(),
			})
			continue
		}

		if item.Quota != nil {
			if err := model.DB.Model(&model.User{}).Where("id = ?", newUser.Id).Update("quota", *item.Quota).Error; err != nil {
				common.SysError(fmt.Sprintf("failed to set quota for feishu user %d: %s", newUser.Id, err.Error()))
			}
		}

		if group != "" {
			_ = model.SyncUserBindGroupSubscriptions(newUser.Id, "", group)
		}

		orgSyncWarning := ""
		if openId != "" {
			if syncErr := service.SyncOneFeishuUserInfoByOpenID(c.Request.Context(), &newUser, openId); syncErr != nil {
				orgSyncWarning = "sync feishu organization info failed: " + syncErr.Error()
				common.SysError(fmt.Sprintf("open_id=%s: %s", openId, orgSyncWarning))
			} else if err := model.DB.First(&newUser, newUser.Id).Error; err != nil {
				orgSyncWarning = "reload user after organization sync failed: " + err.Error()
				common.SysError(fmt.Sprintf("open_id=%s: %s", openId, orgSyncWarning))
			}
		}

		model.RecordLog(newUser.Id, model.LogTypeSystem,
			fmt.Sprintf("管理员通过飞书OpenID批量创建用户，open_id=%s，分组=%s", openId, group))

		result.Success++
		createdToken, tokenKey, tokenErr := createTokenForUser(&newUser, &createTokenOptions{
			Name: "feishu-init",
		})
		if tokenErr != nil {
			result.Failed++
			result.Success--
			result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: token create failed: %s", openId, tokenErr.Error()))
			result.Results = append(result.Results, FeishuUserInitResultItem{
				FeishuOpenId:  openId,
				FeishuUnionId: unionId,
				FeishuUserId:  userId,
				UserId:        newUser.Id,
				Username:      newUser.Username,
				Action:        "failed",
				Error:         "token create failed: " + tokenErr.Error(),
			})
			continue
		}

		result.Results = append(result.Results, FeishuUserInitResultItem{
			FeishuOpenId:  openId,
			FeishuUnionId: unionId,
			FeishuUserId:  userId,
			UserId:        newUser.Id,
			Username:      newUser.Username,
			DisplayName:   newUser.DisplayName,
			OrgName:       newUser.OrgName,
			OrgPath:       newUser.OrgPath,
			OrgLevel1Name: newUser.OrgLevel1Name,
			OrgLevel2Name: newUser.OrgLevel2Name,
			JobTitle:      newUser.JobTitle,
			TokenId:       createdToken.Id,
			TokenName:     createdToken.Name,
			TokenKey:      formatTokenKeyForResponse(tokenKey),
			Action:        "created",
			Warning:       orgSyncWarning,
		})
	}

	common.ApiSuccess(c, result)
}

type AdminCreateTokenByFeishuRequest struct {
	UserId             *int   `json:"user_id"`
	Username           string `json:"username"`
	FeishuOpenId       string `json:"feishu_open_id"`
	FeishuUserId       string `json:"feishu_user_id"`
	Name               string `json:"name"`
	RemainQuota        *int   `json:"remain_quota"`
	UnlimitedQuota     *bool  `json:"unlimited_quota"`
	ExpiredTime        *int64 `json:"expired_time"`
	ModelLimitsEnabled *bool  `json:"model_limits_enabled"`
	ModelLimits        string `json:"model_limits"`
	AllowIps           string `json:"allow_ips"`
	Group              string `json:"group"`
	CrossGroupRetry    *bool  `json:"cross_group_retry"`
}

type AdminCreateTokenByFeishuResult struct {
	FeishuOpenId string `json:"feishu_open_id"`
	UserId       int    `json:"user_id"`
	TokenId      int    `json:"token_id"`
	TokenName    string `json:"token_name"`
	Key          string `json:"key"`
}

func ensureFeishuPlaintextTokenPermission(c *gin.Context) bool {
	role := c.GetInt("role")
	if role == common.RoleRootUser {
		return true
	}
	if role >= common.RoleAdminUser && system_setting.GetFeishuSettings().AllowAdminManagePlaintextTokens {
		return true
	}
	c.JSON(http.StatusForbidden, gin.H{
		"success": false,
		"message": "permission denied: only root can manage plaintext token keys",
	})
	return false
}

func AdminCreateTokenByFeishu(c *gin.Context) {
	if !ensureFeishuPlaintextTokenPermission(c) {
		return
	}
	var req AdminCreateTokenByFeishuRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	openId := strings.TrimSpace(req.FeishuOpenId)
	feishuUserId := strings.TrimSpace(req.FeishuUserId)
	username := strings.TrimSpace(req.Username)

	var user model.User
	query := model.DB
	switch {
	case req.UserId != nil && *req.UserId > 0:
		query = query.Where("id = ?", *req.UserId)
	case username != "":
		query = query.Where("username = ?", username)
	case openId != "":
		query = query.Where("feishu_id = ?", openId)
	case feishuUserId != "":
		query = query.Where("feishu_user_id = ?", feishuUserId)
	default:
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "user_id or username is required"})
		return
	}
	if err := query.First(&user).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "用户不存在，请先确认用户ID或用户名",
		})
		return
	}

	maxTokens := operation_setting.GetMaxUserTokens()
	count, err := model.CountUserTokens(user.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if int(count) >= maxTokens {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("用户 %s 已达到最大令牌数量限制 (%d)", user.Username, maxTokens),
		})
		return
	}

	tokenName := req.Name
	if tokenName == "" {
		tokenName = "admin-created"
	}

	key, err := common.GenerateKey()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	remainQuota := 0
	if req.RemainQuota != nil {
		remainQuota = *req.RemainQuota
	}

	unlimitedQuota := true
	if req.UnlimitedQuota != nil {
		unlimitedQuota = *req.UnlimitedQuota
	}

	expiredTime := int64(-1)
	if req.ExpiredTime != nil {
		expiredTime = *req.ExpiredTime
	}

	modelLimitsEnabled := false
	if req.ModelLimitsEnabled != nil {
		modelLimitsEnabled = *req.ModelLimitsEnabled
	}

	var allowIps *string
	if req.AllowIps != "" {
		allowIps = &req.AllowIps
	}

	crossGroupRetry := false
	if req.CrossGroupRetry != nil {
		crossGroupRetry = *req.CrossGroupRetry
	}

	token := model.Token{
		UserId:             user.Id,
		Name:               tokenName,
		Key:                key,
		CreatedTime:        common.GetTimestamp(),
		AccessedTime:       common.GetTimestamp(),
		ExpiredTime:        expiredTime,
		RemainQuota:        remainQuota,
		UnlimitedQuota:     unlimitedQuota,
		ModelLimitsEnabled: modelLimitsEnabled,
		ModelLimits:        req.ModelLimits,
		AllowIps:           allowIps,
		Group:              req.Group,
		CrossGroupRetry:    crossGroupRetry,
	}

	if err := token.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}

	adminId := c.GetInt("id")
	userIdentifier := username
	if userIdentifier == "" {
		userIdentifier = openId
	}
	model.RecordLog(user.Id, model.LogTypeSystem,
		fmt.Sprintf("管理员(id=%d)创建令牌，user=%s，令牌名=%s", adminId, userIdentifier, tokenName))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": AdminCreateTokenByFeishuResult{
			FeishuOpenId: openId,
			UserId:       user.Id,
			TokenId:      token.Id,
			TokenName:    tokenName,
			Key:          formatTokenKeyForResponse(key),
		},
	})
}

type AdminBatchCreateTokensRequest struct {
	Items []AdminCreateTokenByFeishuRequest `json:"items" binding:"required,dive"`
}

type AdminBatchCreateTokensResult struct {
	Total   int                               `json:"total"`
	Success int                               `json:"success"`
	Failed  int                               `json:"failed"`
	Results []AdminBatchCreateTokenResultItem `json:"results,omitempty"`
}

type AdminBatchCreateTokenResultItem struct {
	FeishuOpenId string `json:"feishu_open_id"`
	UserId       int    `json:"user_id,omitempty"`
	TokenId      int    `json:"token_id,omitempty"`
	Key          string `json:"key,omitempty"`
	Error        string `json:"error,omitempty"`
}

func AdminBatchCreateTokensByFeishu(c *gin.Context) {
	if !ensureFeishuPlaintextTokenPermission(c) {
		return
	}
	var req AdminBatchCreateTokensRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	result := AdminBatchCreateTokensResult{
		Total:   len(req.Items),
		Results: make([]AdminBatchCreateTokenResultItem, 0, len(req.Items)),
	}

	for _, item := range req.Items {
		openId := strings.TrimSpace(item.FeishuOpenId)
		if openId == "" {
			result.Failed++
			result.Results = append(result.Results, AdminBatchCreateTokenResultItem{
				FeishuOpenId: openId,
				Error:        "feishu_open_id is empty",
			})
			continue
		}

		var user model.User
		if err := model.DB.Where("feishu_id = ?", openId).First(&user).Error; err != nil {
			result.Failed++
			result.Results = append(result.Results, AdminBatchCreateTokenResultItem{
				FeishuOpenId: openId,
				Error:        fmt.Sprintf("用户不存在: %s", err.Error()),
			})
			continue
		}

		maxTokens := operation_setting.GetMaxUserTokens()
		count, err := model.CountUserTokens(user.Id)
		if err != nil {
			result.Failed++
			result.Results = append(result.Results, AdminBatchCreateTokenResultItem{
				FeishuOpenId: openId,
				UserId:       user.Id,
				Error:        "查询令牌数量失败",
			})
			continue
		}
		if int(count) >= maxTokens {
			result.Failed++
			result.Results = append(result.Results, AdminBatchCreateTokenResultItem{
				FeishuOpenId: openId,
				UserId:       user.Id,
				Error:        fmt.Sprintf("已达到最大令牌数量限制 (%d)", maxTokens),
			})
			continue
		}

		tokenName := item.Name
		if tokenName == "" {
			tokenName = "admin-batch-created"
		}

		key, err := common.GenerateKey()
		if err != nil {
			result.Failed++
			result.Results = append(result.Results, AdminBatchCreateTokenResultItem{
				FeishuOpenId: openId,
				UserId:       user.Id,
				Error:        "生成密钥失败",
			})
			continue
		}

		remainQuota := 0
		if item.RemainQuota != nil {
			remainQuota = *item.RemainQuota
		}
		unlimitedQuota := true
		if item.UnlimitedQuota != nil {
			unlimitedQuota = *item.UnlimitedQuota
		}
		expiredTime := int64(-1)
		if item.ExpiredTime != nil {
			expiredTime = *item.ExpiredTime
		}
		modelLimitsEnabled := false
		if item.ModelLimitsEnabled != nil {
			modelLimitsEnabled = *item.ModelLimitsEnabled
		}
		var allowIps *string
		if item.AllowIps != "" {
			allowIps = &item.AllowIps
		}
		crossGroupRetry := false
		if item.CrossGroupRetry != nil {
			crossGroupRetry = *item.CrossGroupRetry
		}

		token := model.Token{
			UserId:             user.Id,
			Name:               tokenName,
			Key:                key,
			CreatedTime:        common.GetTimestamp(),
			AccessedTime:       common.GetTimestamp(),
			ExpiredTime:        expiredTime,
			RemainQuota:        remainQuota,
			UnlimitedQuota:     unlimitedQuota,
			ModelLimitsEnabled: modelLimitsEnabled,
			ModelLimits:        item.ModelLimits,
			AllowIps:           allowIps,
			Group:              item.Group,
			CrossGroupRetry:    crossGroupRetry,
		}

		if err := token.Insert(); err != nil {
			result.Failed++
			result.Results = append(result.Results, AdminBatchCreateTokenResultItem{
				FeishuOpenId: openId,
				UserId:       user.Id,
				Error:        "创建令牌失败: " + err.Error(),
			})
			continue
		}

		result.Success++
		result.Results = append(result.Results, AdminBatchCreateTokenResultItem{
			FeishuOpenId: openId,
			UserId:       user.Id,
			TokenId:      token.Id,
			Key:          formatTokenKeyForResponse(key),
		})
	}

	common.ApiSuccess(c, result)
}

func AdminGetTokensByFeishu(c *gin.Context) {
	if !ensureFeishuPlaintextTokenPermission(c) {
		return
	}

	userIdRaw := strings.TrimSpace(c.Query("user_id"))
	username := strings.TrimSpace(c.Query("username"))
	openId := strings.TrimSpace(c.Query("feishu_open_id"))
	feishuUserId := strings.TrimSpace(c.Query("feishu_user_id"))

	var user model.User
	query := model.DB
	switch {
	case userIdRaw != "":
		uid, err := strconv.Atoi(userIdRaw)
		if err != nil || uid <= 0 {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid user_id"})
			return
		}
		query = query.Where("id = ?", uid)
	case username != "":
		query = query.Where("username = ?", username)
	case openId != "":
		query = query.Where("feishu_id = ?", openId)
	case feishuUserId != "":
		query = query.Where("feishu_user_id = ?", feishuUserId)
	default:
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "user_id or username query parameter is required"})
		return
	}
	if err := query.First(&user).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "用户不存在",
		})
		return
	}

	pageInfo := common.GetPageQuery(c)
	tokens, err := model.GetAllUserTokens(user.Id, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	total, _ := model.CountUserTokens(user.Id)
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tokens)
	common.ApiSuccess(c, pageInfo)
}

func SyncFeishuUsersInfo(c *gin.Context) {
	result := service.SyncFeishuUserInfo(c.Request.Context())
	if len(result.Errors) > 0 && result.Success == 0 && result.Total == 0 {
		common.ApiError(c, fmt.Errorf("%s", strings.Join(result.Errors, "; ")))
		return
	}
	common.ApiSuccess(c, result)
}

func ExportUsers(c *gin.Context) {
	keyword := strings.TrimSpace(c.Query("keyword"))
	group := strings.TrimSpace(c.Query("group"))
	roleValue := strings.TrimSpace(c.Query("role"))
	statusValue := strings.TrimSpace(c.Query("status"))

	query := model.DB.Unscoped().Model(&model.User{})
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("username LIKE ? OR email LIKE ? OR display_name LIKE ?", like, like, like)
	}
	if group != "" {
		query = query.Where(model.CommonGroupColumnName()+" = ?", group)
	}
	if roleValue != "" {
		role, err := strconv.Atoi(roleValue)
		if err == nil {
			query = query.Where("role = ?", role)
		}
	}
	if statusValue != "" {
		status, err := strconv.Atoi(statusValue)
		if err == nil {
			query = query.Where("status = ?", status)
		}
	}

	var users []model.User
	if err := query.Order("id desc").Find(&users).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	filename := fmt.Sprintf("users-%s.csv", time.Now().Format("2006-01-02"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	_ = writer.Write([]string{"ID", "用户名", "显示名", "邮箱", "分组", "角色", "系统状态", "飞书OpenID", "飞书UnionID", "飞书UserID", "所在部门名称", "上级部门名称", "一级组织名称", "二级组织名称", "部门路径", "岗位", "飞书在职状态", "飞书工号", "最近同步时间"})
	for _, user := range users {
		syncedAt := ""
		if user.FeishuSyncedAt > 0 {
			syncedAt = time.Unix(user.FeishuSyncedAt, 0).Format("2006-01-02 15:04:05")
		}
		_ = writer.Write([]string{
			strconv.Itoa(user.Id),
			sanitizeCSVField(user.Username),
			sanitizeCSVField(user.DisplayName),
			sanitizeCSVField(user.Email),
			sanitizeCSVField(user.Group),
			strconv.Itoa(user.Role),
			strconv.Itoa(user.Status),
			sanitizeCSVField(user.FeishuId),
			sanitizeCSVField(user.FeishuUnionId),
			sanitizeCSVField(user.FeishuUserId),
			sanitizeCSVField(user.FeishuDepartmentName),
			sanitizeCSVField(user.FeishuParentDepartmentName),
			sanitizeCSVField(user.OrgLevel1Name),
			sanitizeCSVField(user.OrgLevel2Name),
			sanitizeCSVField(user.OrgPath),
			sanitizeCSVField(user.JobTitle),
			sanitizeCSVField(user.FeishuEmploymentStatus),
			sanitizeCSVField(user.FeishuEmployeeNo),
			syncedAt,
		})
	}
}

func FeishuInitWebhook(c *gin.Context) {
	if !verifyFeishuInitWebhookSecret(c) {
		return
	}

	var req FeishuInitWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	result := BatchCreateFeishuUsersResult{
		Total:   len(req.Users),
		Results: make([]FeishuUserInitResultItem, 0, len(req.Users)),
		Errors:  make([]string, 0),
	}

	for _, item := range req.Users {
		item.Confirmed = true
		openId := strings.TrimSpace(item.FeishuOpenId)
		unionId := strings.TrimSpace(item.FeishuUnionId)
		userId := strings.TrimSpace(item.FeishuUserId)
		if openId != "" || unionId != "" || userId != "" {
			identity, err := validateFeishuIdentity(c, openId, unionId, userId)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, "invalid feishu identity: "+err.Error())
				result.Results = append(result.Results, FeishuUserInitResultItem{FeishuOpenId: openId, FeishuUnionId: unionId, FeishuUserId: userId, Action: "failed", Error: err.Error()})
				continue
			}
			openId, unionId, userId = identity.OpenID, identity.UnionID, identity.UserID
		}
		resolvedName := strings.TrimSpace(item.DisplayName)
		resolvedEmployeeNo := strings.TrimSpace(item.EmployeeID)
		if openId == "" && unionId == "" && userId == "" {
			openId, unionId, userId, resolvedName, _, _, resolvedEmployeeNo = resolveFeishuIdentifiersFromReadable(c, item.EmployeeID, item.Mobile, item.Email)
		}
		// 如果调用方传了飞书 ID 但没传 name 或工号，去飞书补查。
		if (resolvedName == "" || resolvedEmployeeNo == "") && (openId != "" || userId != "" || unionId != "") {
			idType, idValue := pickFeishuIdType(openId, userId, unionId)
			if idType != "" {
				name, empNo := enrichFeishuNameAndEmployeeNo(c, idType, idValue)
				if resolvedName == "" {
					resolvedName = name
				}
				if resolvedEmployeeNo == "" {
					resolvedEmployeeNo = empNo
				}
			}
		}
		if openId == "" && unionId == "" && userId == "" {
			result.Failed++
			result.Errors = append(result.Errors, "cannot resolve feishu identifiers from feishu ids/readable identifiers")
			result.Results = append(result.Results, FeishuUserInitResultItem{FeishuOpenId: strings.TrimSpace(item.FeishuOpenId), Action: "failed", Error: "no valid feishu identifier found"})
			continue
		}

		existingUser, exists := findExistingFeishuUser(openId, unionId, userId)
		if exists {
			result.Skipped++
			existingTokens, tokenErr := model.GetAllUserTokens(existingUser.Id, 0, operation_setting.GetMaxUserTokens())
			if tokenErr == nil {
				now := common.GetTimestamp()
				selectedToken := (*model.Token)(nil)
				for _, token := range existingTokens {
					if token == nil {
						continue
					}
					if token.Status != common.TokenStatusEnabled {
						continue
					}
					if token.ExpiredTime != -1 && token.ExpiredTime < now {
						continue
					}
					if !token.UnlimitedQuota && token.RemainQuota <= 0 {
						continue
					}
					selectedToken = token
					break
				}
				if selectedToken != nil {
					result.Results = append(result.Results, FeishuUserInitResultItem{FeishuOpenId: openId, FeishuUnionId: unionId, FeishuUserId: userId, UserId: existingUser.Id, Username: existingUser.Username, TokenId: selectedToken.Id, TokenName: selectedToken.Name, TokenKey: formatTokenKeyForResponse(selectedToken.Key), Action: "skipped_exists"})
					continue
				}
			}
			// 用户已存在但无可用 Token，创建新 Token 并返回
			createdToken, tokenKey, tokenErr := createTokenForUser(&existingUser, &createTokenOptions{Name: "feishu-init"})
			if tokenErr != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: token create failed for existing user %d: %s", openId, existingUser.Id, tokenErr.Error()))
				result.Results = append(result.Results, FeishuUserInitResultItem{FeishuOpenId: openId, FeishuUnionId: unionId, FeishuUserId: userId, UserId: existingUser.Id, Username: existingUser.Username, Action: "failed", Error: "token create failed: " + tokenErr.Error()})
				continue
			}
			result.Skipped++
			result.Results = append(result.Results, FeishuUserInitResultItem{FeishuOpenId: openId, FeishuUnionId: unionId, FeishuUserId: userId, UserId: existingUser.Id, Username: existingUser.Username, TokenId: createdToken.Id, TokenName: createdToken.Name, TokenKey: formatTokenKeyForResponse(tokenKey), Action: "skipped_user_token_created"})
			continue
		}

		// 用户名优先用飞书解析出的正确名称，避免调用方乱传。
		username := ""
		if resolvedName != "" {
			username = resolvedName
		} else if displayName := strings.TrimSpace(item.DisplayName); displayName != "" {
			username = displayName
		} else if u := strings.TrimSpace(item.Username); u != "" {
			username = u
		} else {
			username = "feishu_user"
		}
		if resolvedEmployeeNo != "" {
			username = username + "_" + resolvedEmployeeNo
		}
		username, err := allocateAvailableUsername(username)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: allocate username failed: %s", openId, err.Error()))
			result.Results = append(result.Results, FeishuUserInitResultItem{FeishuOpenId: openId, Action: "failed", Error: "allocate username failed: " + err.Error()})
			continue
		}

		displayName := strings.TrimSpace(item.DisplayName)
		if displayName == "" {
			displayName = username
		}
		password := item.Password
		if password == "" {
			password = common.GetRandomString(12)
		}
		requestedGroup := strings.TrimSpace(item.Group)
		group, _ := service.ResolveAuthoritativeGroupForFeishuUser(0, "", requestedGroup, openId, item.JobTitle)
		role := common.RoleCommonUser
		if item.Role != nil {
			role = *item.Role
		}
		if role >= common.RoleAdminUser {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: cannot create user with role >= admin", openId))
			result.Results = append(result.Results, FeishuUserInitResultItem{FeishuOpenId: openId, Action: "failed", Error: "cannot create user with role >= admin"})
			continue
		}

		newUser := model.User{Username: username, Password: password, DisplayName: displayName, FeishuId: openId, FeishuUnionId: unionId, FeishuUserId: userId, Role: role, Status: common.UserStatusEnabled, Group: group, Remark: item.Remark, OrgName: strings.TrimSpace(item.OrgName), OrgPath: strings.TrimSpace(item.OrgPath), JobTitle: strings.TrimSpace(item.JobTitle)}
		if err := newUser.Insert(0); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: create user failed: %s", openId, err.Error()))
			result.Results = append(result.Results, FeishuUserInitResultItem{FeishuOpenId: openId, Action: "failed", Error: "create user failed: " + err.Error()})
			continue
		}

		if item.Quota != nil {
			if err := model.DB.Model(&model.User{}).Where("id = ?", newUser.Id).Update("quota", *item.Quota).Error; err != nil {
				common.SysError(fmt.Sprintf("failed to set quota for feishu user %d: %s", newUser.Id, err.Error()))
			}
		}
		if group != "" {
			_ = model.SyncUserBindGroupSubscriptions(newUser.Id, "", group)
		}
		if openId != "" {
			if syncErr := service.SyncOneFeishuUserInfoByOpenID(c.Request.Context(), &newUser, openId); syncErr != nil {
				common.SysError(fmt.Sprintf("open_id=%s: sync feishu organization info failed: %s", openId, syncErr.Error()))
			} else if err := model.DB.First(&newUser, newUser.Id).Error; err != nil {
				common.SysError(fmt.Sprintf("open_id=%s: reload user after organization sync failed: %s", openId, err.Error()))
			}
		}
		createdToken, tokenKey, tokenErr := createTokenForUser(&newUser, &createTokenOptions{Name: "feishu-init"})
		if tokenErr != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: token create failed: %s", openId, tokenErr.Error()))
			result.Results = append(result.Results, FeishuUserInitResultItem{FeishuOpenId: openId, FeishuUnionId: unionId, FeishuUserId: userId, UserId: newUser.Id, Username: newUser.Username, Action: "failed", Error: "token create failed: " + tokenErr.Error()})
			continue
		}

		result.Success++
		result.Results = append(result.Results, FeishuUserInitResultItem{FeishuOpenId: openId, FeishuUnionId: unionId, FeishuUserId: userId, UserId: newUser.Id, Username: newUser.Username, TokenId: createdToken.Id, TokenName: createdToken.Name, TokenKey: formatTokenKeyForResponse(tokenKey), Action: "created"})
	}

	common.ApiSuccess(c, result)
}

type FeishuUserUpdateItem struct {
	FeishuOpenId  string `json:"feishu_open_id"`
	FeishuUnionId string `json:"feishu_union_id"`
	FeishuUserId  string `json:"feishu_user_id"`
	UserId        *int   `json:"user_id"`
	Username      string `json:"username"`
	DisplayName   string `json:"display_name"`
	Password      string `json:"password"`
	Group         string `json:"group"`
	Quota         *int   `json:"quota"`
	Status        *int   `json:"status"`
	Remark        string `json:"remark"`
	OrgName       string `json:"org_name"`
	OrgPath       string `json:"org_path"`
	JobTitle      string `json:"job_title"`
}

type BatchUpdateFeishuUsersRequest struct {
	Users []FeishuUserUpdateItem `json:"users" binding:"required,dive"`
}

type BatchUpdateFeishuUsersResult struct {
	Total   int                          `json:"total"`
	Success int                          `json:"success"`
	Failed  int                          `json:"failed"`
	Skipped int                          `json:"skipped"`
	Results []FeishuUserUpdateResultItem `json:"results,omitempty"`
	Errors  []string                     `json:"errors,omitempty"`
}

type FeishuUserUpdateResultItem struct {
	FeishuOpenId string `json:"feishu_open_id"`
	UserId       int    `json:"user_id,omitempty"`
	Username     string `json:"username,omitempty"`
	OldGroup     string `json:"old_group,omitempty"`
	NewGroup     string `json:"new_group,omitempty"`
	SubSynced    bool   `json:"sub_synced,omitempty"`
	Action       string `json:"action"`
	Error        string `json:"error,omitempty"`
}

func BatchUpdateFeishuUsers(c *gin.Context) {
	var req BatchUpdateFeishuUsersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	result := BatchUpdateFeishuUsersResult{
		Total:   len(req.Users),
		Results: make([]FeishuUserUpdateResultItem, 0, len(req.Users)),
		Errors:  make([]string, 0),
	}

	adminId := c.GetInt("id")

	for _, item := range req.Users {
		openId := strings.TrimSpace(item.FeishuOpenId)

		feishuUserId := strings.TrimSpace(item.FeishuUserId)
		feishuUnionId := strings.TrimSpace(item.FeishuUnionId)
		if openId != "" || feishuUnionId != "" || feishuUserId != "" {
			identity, err := validateFeishuIdentity(c, openId, feishuUnionId, feishuUserId)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, "invalid feishu identity: "+err.Error())
				result.Results = append(result.Results, FeishuUserUpdateResultItem{FeishuOpenId: openId, Action: "failed", Error: err.Error()})
				continue
			}
			openId, feishuUnionId, feishuUserId = identity.OpenID, identity.UnionID, identity.UserID
		}
		if openId == "" && feishuUnionId == "" && feishuUserId == "" && item.UserId == nil && item.Username == "" {
			result.Failed++
			result.Errors = append(result.Errors, "at least one of feishu_open_id, feishu_union_id, feishu_user_id, user_id, username is required")
			result.Results = append(result.Results, FeishuUserUpdateResultItem{
				FeishuOpenId: openId,
				Action:       "failed",
				Error:        "至少需要提供 feishu_open_id, feishu_union_id, feishu_user_id, user_id 或 username 之一",
			})
			continue
		}

		var user model.User
		found := false

		if openId != "" {
			if err := model.DB.Where("feishu_id = ?", openId).First(&user).Error; err == nil {
				found = true
			}
		}
		if !found && feishuUserId != "" {
			if err := model.DB.Where("feishu_user_id = ?", feishuUserId).First(&user).Error; err == nil {
				found = true
			}
		}
		if !found && feishuUnionId != "" {
			if err := model.DB.Where("feishu_union_id = ?", feishuUnionId).First(&user).Error; err == nil {
				found = true
			}
		}
		if !found && item.UserId != nil {
			if err := model.DB.Where("id = ?", *item.UserId).First(&user).Error; err == nil {
				found = true
			}
		}
		if !found && item.Username != "" {
			if err := model.DB.Where("username = ?", item.Username).First(&user).Error; err == nil {
				found = true
			}
		}

		if !found {
			result.Failed++
			identifier := openId
			if identifier == "" && item.UserId != nil {
				identifier = fmt.Sprintf("user_id=%d", *item.UserId)
			}
			if identifier == "" {
				identifier = fmt.Sprintf("username=%s", item.Username)
			}
			result.Errors = append(result.Errors, fmt.Sprintf("%s: user not found", identifier))
			result.Results = append(result.Results, FeishuUserUpdateResultItem{
				FeishuOpenId: openId,
				Action:       "failed",
				Error:        "用户不存在",
			})
			continue
		}

		updates := map[string]interface{}{}
		resultItem := FeishuUserUpdateResultItem{
			FeishuOpenId: openId,
			UserId:       user.Id,
			Username:     user.Username,
			OldGroup:     user.Group,
			Action:       "updated",
		}

		if openId != "" && user.FeishuId != openId {
			updates["feishu_id"] = openId
		}
		if feishuUserId != "" && user.FeishuUserId != feishuUserId {
			updates["feishu_user_id"] = feishuUserId
		}
		if feishuUnionId != "" && user.FeishuUnionId != feishuUnionId {
			updates["feishu_union_id"] = feishuUnionId
		}

		if item.DisplayName != "" {
			updates["display_name"] = item.DisplayName
		}

		if item.Password != "" {
			hashedPassword, err := common.Password2Hash(item.Password)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: password hash failed: %s", openId, err.Error()))
				result.Results = append(result.Results, FeishuUserUpdateResultItem{
					FeishuOpenId: openId,
					UserId:       user.Id,
					Username:     user.Username,
					Action:       "failed",
					Error:        "密码哈希失败",
				})
				continue
			}
			updates["password"] = hashedPassword
		}

		finalOpenID := firstNonEmpty(openId, user.FeishuId)
		if item.Group != "" || finalOpenID != "" {
			requestedGroup := strings.TrimSpace(item.Group)
			finalGroup := requestedGroup
			if finalOpenID != "" {
				finalGroup, _ = service.ResolveAuthoritativeGroupForFeishuUser(user.Id, user.Group, requestedGroup, finalOpenID, item.JobTitle)
			}
			if finalGroup != "" && finalGroup != user.Group {
				updates["group"] = finalGroup
				resultItem.NewGroup = finalGroup
			}
		}

		if item.Quota != nil {
			updates["quota"] = *item.Quota
		}

		if item.Status != nil {
			if *item.Status == common.UserStatusEnabled || *item.Status == common.UserStatusDisabled {
				updates["status"] = *item.Status
			}
		}

		if item.Remark != "" {
			updates["remark"] = item.Remark
		}
		if item.OrgName != "" {
			updates["org_name"] = strings.TrimSpace(item.OrgName)
		}
		if item.OrgPath != "" {
			updates["org_path"] = strings.TrimSpace(item.OrgPath)
		}
		if item.JobTitle != "" {
			updates["job_title"] = strings.TrimSpace(item.JobTitle)
		}

		if len(updates) == 0 {
			result.Skipped++
			result.Results = append(result.Results, FeishuUserUpdateResultItem{
				FeishuOpenId: openId,
				UserId:       user.Id,
				Username:     user.Username,
				Action:       "skipped_no_changes",
			})
			continue
		}

		if err := model.DB.Model(&model.User{}).Where("id = ?", user.Id).Updates(updates).Error; err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("open_id=%s: update failed: %s", openId, err.Error()))
			result.Results = append(result.Results, FeishuUserUpdateResultItem{
				FeishuOpenId: openId,
				UserId:       user.Id,
				Username:     user.Username,
				Action:       "failed",
				Error:        "更新失败: " + err.Error(),
			})
			continue
		}

		if newGroup, ok := updates["group"]; ok {
			newGroupStr := newGroup.(string)
			oldGroup := user.Group
			if oldGroup != newGroupStr {
				_ = model.SyncUserBindGroupSubscriptions(user.Id, oldGroup, newGroupStr)
				resultItem.SubSynced = true
			}
			_ = model.InvalidateUserCache(user.Id)
		}

		model.RecordLog(user.Id, model.LogTypeManage,
			fmt.Sprintf("管理员(id=%d)通过飞书OpenID批量更新用户信息，open_id=%s", adminId, openId))

		result.Success++
		result.Results = append(result.Results, resultItem)
	}

	common.ApiSuccess(c, result)
}
