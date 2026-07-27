package controller

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

// agentOwnerBindRequest 组织类智能体账号负责人绑定请求
type agentOwnerBindRequest struct {
	Mobile        string `json:"mobile"`
	EmployeeNo    string `json:"employee_no"`
	Email         string `json:"email"`
	FeishuOpenId  string `json:"feishu_open_id"`
	FeishuUnionId string `json:"feishu_union_id"`
	FeishuUserId  string `json:"feishu_user_id"`
	Name          string `json:"name"`
}

// BindAgentOwner 为组织类智能体账号绑定负责人
// POST /api/user/:id/agent-owner/bind
func BindAgentOwner(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	var req agentOwnerBindRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	req.Mobile = strings.TrimSpace(req.Mobile)
	req.EmployeeNo = strings.TrimSpace(req.EmployeeNo)
	req.Email = strings.TrimSpace(req.Email)
	req.FeishuOpenId = strings.TrimSpace(req.FeishuOpenId)
	req.FeishuUnionId = strings.TrimSpace(req.FeishuUnionId)
	req.FeishuUserId = strings.TrimSpace(req.FeishuUserId)
	req.Name = strings.TrimSpace(req.Name)

	if req.Mobile == "" && req.EmployeeNo == "" && req.Email == "" && req.FeishuOpenId == "" && req.FeishuUnionId == "" && req.FeishuUserId == "" && req.Name == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	user, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if user.AccountType != common.AccountTypeOrganization {
		common.ApiErrorMsg(c, "只有组织类智能体账号才能绑定负责人")
		return
	}

	// 通过飞书通讯录查询补全信息
	openID, unionID, feishuUserID, name, orgName, _, employeeNo, resolveErr := resolveFeishuIdentifiersForAgentOwner(c, req)
	if resolveErr != nil {
		common.ApiErrorMsg(c, resolveErr.Error())
		return
	}

	if openID == "" && unionID == "" && feishuUserID == "" && req.FeishuOpenId == "" && req.FeishuUnionId == "" && req.FeishuUserId == "" {
		common.ApiErrorMsg(c, "无法通过提供的信息查询到飞书人员，请检查姓名/手机号/工号/邮箱是否正确")
		return
	}

	// 优先用查询到的信息，fallback 到请求里传入的
	finalOpenID := firstNonEmpty(openID, req.FeishuOpenId)
	finalUnionID := firstNonEmpty(unionID, req.FeishuUnionId)
	finalFeishuUserID := firstNonEmpty(feishuUserID, req.FeishuUserId)
	finalName := firstNonEmpty(name, req.Name)
	finalEmployeeNo := firstNonEmpty(employeeNo, req.EmployeeNo)

	updates := map[string]interface{}{
		"agent_owner_feishu_open_id":  finalOpenID,
		"agent_owner_feishu_union_id": finalUnionID,
		"agent_owner_feishu_user_id":  finalFeishuUserID,
		"agent_owner_name":            finalName,
		"agent_owner_mobile":          req.Mobile,
		"agent_owner_employee_no":     finalEmployeeNo,
		"agent_owner_department_name": orgName,
		"agent_owner_bound_at":        time.Now().Unix(),
	}

	if err := model.DB.Model(&model.User{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, gin.H{
		"user_id":                     id,
		"agent_owner_name":            finalName,
		"agent_owner_feishu_open_id":  finalOpenID,
		"agent_owner_feishu_union_id": finalUnionID,
		"agent_owner_feishu_user_id":  finalFeishuUserID,
		"agent_owner_mobile":          req.Mobile,
		"agent_owner_employee_no":     finalEmployeeNo,
	})
}

// UnbindAgentOwner 解绑组织类智能体账号负责人
// DELETE /api/user/:id/agent-owner
func UnbindAgentOwner(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	updates := map[string]interface{}{
		"agent_owner_name":            "",
		"agent_owner_mobile":          "",
		"agent_owner_employee_no":     "",
		"agent_owner_feishu_open_id":  "",
		"agent_owner_feishu_union_id": "",
		"agent_owner_feishu_user_id":  "",
		"agent_owner_department_id":   "",
		"agent_owner_department_name": "",
		"agent_owner_bound_at":        0,
	}

	if err := model.DB.Model(&model.User{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, nil)
}

// GetAgentOwner 查询组织类智能体账号负责人信息
// GET /api/user/:id/agent-owner
func GetAgentOwner(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	user, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, gin.H{
		"user_id":                     id,
		"agent_owner_name":            user.AgentOwnerName,
		"agent_owner_mobile":          user.AgentOwnerMobile,
		"agent_owner_employee_no":     user.AgentOwnerEmployeeNo,
		"agent_owner_feishu_open_id":  user.AgentOwnerFeishuOpenId,
		"agent_owner_feishu_union_id": user.AgentOwnerFeishuUnionId,
		"agent_owner_feishu_user_id":  user.AgentOwnerFeishuUserId,
		"agent_owner_department_name": user.AgentOwnerDepartmentName,
		"agent_owner_bound_at":        user.AgentOwnerBoundAt,
	})
}

func resolveFeishuIdentifiersForAgentOwner(c *gin.Context, req agentOwnerBindRequest) (openID, unionID, userID, name, orgName, jobTitle, employeeNo string, err error) {
	if req.FeishuOpenId != "" || req.FeishuUnionId != "" || req.FeishuUserId != "" {
		identity, validateErr := validateFeishuIdentity(c, req.FeishuOpenId, req.FeishuUnionId, req.FeishuUserId)
		if validateErr != nil {
			return "", "", "", "", "", "", "", validateErr
		}
		openID, unionID, userID = identity.OpenID, identity.UnionID, identity.UserID
		if openID != "" || unionID != "" || userID != "" {
			idType, idValue := pickFeishuIdType(openID, userID, unionID)
			if idType != "" {
				profileOpenID, profileUnionID, profileUserID, profileName, profileOrgName, profileJobTitle, profileEmployeeNo, _ := enrichFeishuOwnerProfile(c, idType, idValue)
				openID = firstNonEmpty(openID, profileOpenID)
				unionID = firstNonEmpty(unionID, profileUnionID)
				userID = firstNonEmpty(userID, profileUserID)
				name = profileName
				orgName = profileOrgName
				jobTitle = profileJobTitle
				employeeNo = profileEmployeeNo
			}
			return openID, unionID, userID, name, orgName, jobTitle, employeeNo, nil
		}
	}

	lookups := []struct {
		employeeNo string
		mobile     string
		email      string
		name       string
	}{
		{employeeNo: req.EmployeeNo},
		{mobile: req.Mobile},
		{email: req.Email},
		{name: req.Name},
	}
	for _, lookup := range lookups {
		openID, unionID, userID, name, orgName, jobTitle, employeeNo, err = resolveFeishuOwnerByReadable(c, lookup.employeeNo, lookup.mobile, lookup.email, lookup.name)
		if err != nil {
			return "", "", "", "", "", "", "", err
		}
		if openID != "" || unionID != "" || userID != "" {
			return openID, unionID, userID, name, orgName, jobTitle, employeeNo, nil
		}
	}
	return "", "", "", "", "", "", "", nil
}

func resolveFeishuOwnerByReadable(c *gin.Context, employeeNo, mobile, email, name string) (openID, unionID, userID, displayName, orgName, jobTitle, resolvedEmployeeNo string, err error) {
	employeeNo = strings.TrimSpace(employeeNo)
	mobile = strings.TrimSpace(mobile)
	email = strings.TrimSpace(email)
	name = strings.TrimSpace(name)
	if employeeNo == "" && mobile == "" && email == "" && name == "" {
		return "", "", "", "", "", "", "", nil
	}

	settings := system_setting.GetFeishuSettings()
	if settings.AppID == "" || settings.AppSecret == "" {
		return "", "", "", "", "", "", "", nil
	}
	token, tokenErr := getFeishuTenantAccessToken(c, settings.AppID, settings.AppSecret)
	if tokenErr != nil || token == "" {
		return "", "", "", "", "", "", "", nil
	}

	if employeeNo != "" {
		openID, unionID, userID, displayName, orgName, jobTitle, resolvedEmployeeNo, _ = getFeishuUserProfileByAnyID(c, token, "user_id", employeeNo)
		if openID != "" || unionID != "" || userID != "" {
			return openID, unionID, userID, displayName, orgName, jobTitle, resolvedEmployeeNo, nil
		}
	}

	reqBody := map[string]any{}
	if employeeNo != "" {
		reqBody["employee_ids"] = []string{employeeNo}
	}
	if mobile != "" {
		reqBody["mobiles"] = []string{mobile}
	}
	if email != "" {
		reqBody["emails"] = []string{email}
	}
	if name != "" {
		return resolveFeishuOwnerByNameSearch(c, token, name)
	}
	return resolveFeishuOwnerByBatchGetID(c, token, reqBody)
}

func resolveFeishuOwnerByNameSearch(c *gin.Context, token, keyword string) (openID, unionID, userID, name, orgName, jobTitle, employeeNo string, err error) {
	url := "https://open.feishu.cn/open-apis/contact/v3/users/search?user_id_type=open_id"
	reqBody := map[string]any{
		"query":     keyword,
		"page_size": 10,
	}
	bodyBytes, marshalErr := common.Marshal(reqBody)
	if marshalErr != nil {
		return "", "", "", "", "", "", "", nil
	}
	req, reqErr := http.NewRequestWithContext(c.Request.Context(), "POST", url, bytes.NewBuffer(bodyBytes))
	if reqErr != nil {
		return "", "", "", "", "", "", "", nil
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	client := http.Client{Timeout: 15 * time.Second}
	resp, httpErr := client.Do(req)
	if httpErr != nil {
		return "", "", "", "", "", "", "", nil
	}
	defer resp.Body.Close()
	raw, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return "", "", "", "", "", "", "", nil
	}

	parsed := map[string]any{}
	if unmarshalErr := common.Unmarshal(raw, &parsed); unmarshalErr != nil {
		return "", "", "", "", "", "", "", nil
	}
	codeNum, _ := parsed["code"].(float64)
	if int(codeNum) != 0 {
		return "", "", "", "", "", "", "", nil
	}
	data, _ := parsed["data"].(map[string]any)
	if data == nil {
		return "", "", "", "", "", "", "", nil
	}
	userList, _ := data["users"].([]any)
	if len(userList) == 0 {
		userList, _ = data["user_list"].([]any)
	}
	if len(userList) == 0 {
		return "", "", "", "", "", "", "", nil
	}
	matched := make([]map[string]any, 0, len(userList))
	for _, item := range userList {
		userMap, _ := item.(map[string]any)
		if userMap == nil {
			continue
		}
		itemName := getStringField(userMap, "name", "en_name")
		if itemName == keyword {
			matched = append(matched, userMap)
		}
	}
	if len(matched) == 0 && len(userList) == 1 {
		first, _ := userList[0].(map[string]any)
		if first != nil {
			matched = append(matched, first)
		}
	}
	if len(matched) > 1 {
		return "", "", "", "", "", "", "", fmt.Errorf("姓名匹配到多个飞书人员，请改用手机号、工号或邮箱绑定")
	}
	if len(matched) == 0 {
		return "", "", "", "", "", "", "", nil
	}
	openID = getStringField(matched[0], "open_id", "openId")
	unionID = getStringField(matched[0], "union_id", "unionId")
	userID = getStringField(matched[0], "user_id", "userId")
	name = getStringField(matched[0], "name", "en_name")
	orgName = getStringField(matched[0], "department_name")
	jobTitle = getStringField(matched[0], "job_title")
	employeeNo = getStringField(matched[0], "employee_no")
	idType, idValue := pickFeishuIdType(openID, userID, unionID)
	if idType != "" {
		profileOpenID, profileUnionID, profileUserID, profileName, profileOrgName, profileJobTitle, profileEmployeeNo, _ := getFeishuUserProfileByAnyID(c, token, idType, idValue)
		openID = firstNonEmpty(openID, profileOpenID)
		unionID = firstNonEmpty(unionID, profileUnionID)
		userID = firstNonEmpty(userID, profileUserID)
		name = firstNonEmpty(name, profileName)
		orgName = firstNonEmpty(orgName, profileOrgName)
		jobTitle = firstNonEmpty(jobTitle, profileJobTitle)
		employeeNo = firstNonEmpty(employeeNo, profileEmployeeNo)
	}
	return openID, unionID, userID, name, orgName, jobTitle, employeeNo, nil
}

func resolveFeishuOwnerByBatchGetID(c *gin.Context, token string, reqBody map[string]any) (openID, unionID, userID, name, orgName, jobTitle, employeeNo string, err error) {
	if len(reqBody) == 0 {
		return "", "", "", "", "", "", "", nil
	}
	bodyBytes, marshalErr := common.Marshal(reqBody)
	if marshalErr != nil {
		return "", "", "", "", "", "", "", nil
	}
	url := "https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id?user_id_type=open_id"
	req, reqErr := http.NewRequestWithContext(c.Request.Context(), "POST", url, bytes.NewBuffer(bodyBytes))
	if reqErr != nil {
		return "", "", "", "", "", "", "", nil
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	client := http.Client{Timeout: 15 * time.Second}
	resp, httpErr := client.Do(req)
	if httpErr != nil {
		return "", "", "", "", "", "", "", nil
	}
	defer resp.Body.Close()
	raw, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return "", "", "", "", "", "", "", nil
	}

	parsed := map[string]any{}
	if unmarshalErr := common.Unmarshal(raw, &parsed); unmarshalErr != nil {
		return "", "", "", "", "", "", "", nil
	}
	codeNum, _ := parsed["code"].(float64)
	if int(codeNum) != 0 {
		return "", "", "", "", "", "", "", nil
	}
	data, _ := parsed["data"].(map[string]any)
	if data == nil {
		return "", "", "", "", "", "", "", nil
	}
	userList, _ := data["user_list"].([]any)
	if len(userList) == 0 {
		return "", "", "", "", "", "", "", nil
	}
	first, _ := userList[0].(map[string]any)
	if first == nil {
		return "", "", "", "", "", "", "", nil
	}
	openID = getStringField(first, "open_id", "openId")
	unionID = getStringField(first, "union_id", "unionId")
	userID = getStringField(first, "user_id", "userId")
	name = getStringField(first, "name", "en_name")
	orgName = getStringField(first, "department_name")
	jobTitle = getStringField(first, "job_title")
	employeeNo = getStringField(first, "employee_no")
	if openID == "" && userID != "" {
		openID, unionID, userID, _ = getFeishuUserIdentifiersByAnyID(c, token, "user_id", userID)
	}
	if openID == "" && unionID != "" {
		openID, unionID, userID, _ = getFeishuUserIdentifiersByAnyID(c, token, "union_id", unionID)
	}
	if name == "" || orgName == "" || jobTitle == "" || employeeNo == "" {
		idType, idValue := pickFeishuIdType(openID, userID, unionID)
		if idType != "" {
			profileOpenID, profileUnionID, profileUserID, profileName, profileOrgName, profileJobTitle, profileEmployeeNo, _ := enrichFeishuOwnerProfile(c, idType, idValue)
			openID = firstNonEmpty(openID, profileOpenID)
			unionID = firstNonEmpty(unionID, profileUnionID)
			userID = firstNonEmpty(userID, profileUserID)
			name = firstNonEmpty(name, profileName)
			orgName = firstNonEmpty(orgName, profileOrgName)
			jobTitle = firstNonEmpty(jobTitle, profileJobTitle)
			employeeNo = firstNonEmpty(employeeNo, profileEmployeeNo)
		}
	}
	return openID, unionID, userID, name, orgName, jobTitle, employeeNo, nil
}

func enrichFeishuOwnerProfile(c *gin.Context, idType, idValue string) (string, string, string, string, string, string, string, error) {
	settings := system_setting.GetFeishuSettings()
	if settings.AppID == "" || settings.AppSecret == "" {
		return "", "", "", "", "", "", "", nil
	}
	token, err := getFeishuTenantAccessToken(c, settings.AppID, settings.AppSecret)
	if err != nil || token == "" {
		return "", "", "", "", "", "", "", nil
	}
	return getFeishuUserProfileByAnyID(c, token, idType, idValue)
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v = strings.TrimSpace(v); v != "" {
			return v
		}
	}
	return ""
}
