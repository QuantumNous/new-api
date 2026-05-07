package controller

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
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
	JobTitle      string `json:"job_title,omitempty"`
	Action        string `json:"action"`
	Error         string `json:"error,omitempty"`
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
		openId, unionId, userId := resolveFeishuIdentifiers(c, item.FeishuOpenId, item.FeishuUnionId, item.FeishuUserId)
		resolvedName := strings.TrimSpace(item.DisplayName)
		resolvedOrgName := strings.TrimSpace(item.OrgName)
		resolvedJobTitle := strings.TrimSpace(item.JobTitle)
		resolvedEmployeeNo := strings.TrimSpace(item.EmployeeID)
		if openId == "" && unionId == "" && userId == "" {
			openId, unionId, userId, resolvedName, resolvedOrgName, resolvedJobTitle, resolvedEmployeeNo = resolveFeishuIdentifiersFromReadable(c, item.EmployeeID, item.Mobile, item.Email)
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
				OrgName:       resolvedOrgName,
				JobTitle:      resolvedJobTitle,
				Username:      resolvedEmployeeNo,
				Action:        "preview_only",
				Error:         "请确认用户信息后再初始化（confirmed=true）",
			})
			continue
		}

		existingUser := model.User{}
		err := model.DB.Where("feishu_id = ?", openId).First(&existingUser).Error
		if err == nil && existingUser.Id > 0 {
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

		username := strings.TrimSpace(item.Username)
		if username == "" {
			if resolvedName != "" {
				username = resolvedName
			} else if displayName := strings.TrimSpace(item.DisplayName); displayName != "" {
				username = displayName
			} else {
				username = "feishu_user"
			}
		}
		if resolvedEmployeeNo != "" {
			username = username + "_" + resolvedEmployeeNo
		}

		username, err = allocateAvailableUsername(username)
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

		group := "default"
		if item.Group != "" {
			group = item.Group
		}

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

		if group != "" && group != "default" {
			_ = model.SyncUserBindGroupSubscriptions(newUser.Id, "", group)
		}

		model.RecordLog(newUser.Id, model.LogTypeSystem,
			fmt.Sprintf("管理员通过飞书OpenID批量创建用户，open_id=%s，分组=%s", openId, group))

		result.Success++
		result.Results = append(result.Results, FeishuUserInitResultItem{
			FeishuOpenId:  openId,
			FeishuUnionId: unionId,
			FeishuUserId:  userId,
			UserId:        newUser.Id,
			Username:      newUser.Username,
			Action:        "created",
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
			Key:          key,
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
			Key:          key,
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

		if item.Group != "" {
			updates["group"] = item.Group
			resultItem.NewGroup = item.Group
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
