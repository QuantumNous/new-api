package controller

import (
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// agentOwnerBindRequest 组织类智能体账号负责人绑定请求
type agentOwnerBindRequest struct {
	Mobile       string `json:"mobile"`
	EmployeeNo   string `json:"employee_no"`
	Email        string `json:"email"`
	FeishuOpenId string `json:"feishu_open_id"`
	FeishuUserId string `json:"feishu_user_id"`
	Name         string `json:"name"`
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
	req.FeishuUserId = strings.TrimSpace(req.FeishuUserId)
	req.Name = strings.TrimSpace(req.Name)

	if req.Mobile == "" && req.EmployeeNo == "" && req.Email == "" && req.FeishuOpenId == "" && req.FeishuUserId == "" {
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
	openID, _, feishuUserID, name, orgName, _, employeeNo := resolveFeishuIdentifiersForAgentOwner(c, req)

	if openID == "" && feishuUserID == "" && req.FeishuOpenId == "" && req.FeishuUserId == "" {
		common.ApiErrorMsg(c, "无法通过提供的信息查询到飞书人员，请检查手机号/工号/邮箱是否正确")
		return
	}

	// 优先用查询到的信息，fallback 到请求里传入的
	finalOpenID := firstNonEmpty(openID, req.FeishuOpenId)
	finalFeishuUserID := firstNonEmpty(feishuUserID, req.FeishuUserId)
	finalName := firstNonEmpty(name, req.Name)
	finalEmployeeNo := firstNonEmpty(employeeNo, req.EmployeeNo)

	updates := map[string]interface{}{
		"agent_owner_feishu_open_id":  finalOpenID,
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
		"user_id":                    id,
		"agent_owner_name":           finalName,
		"agent_owner_feishu_open_id": finalOpenID,
		"agent_owner_feishu_user_id": finalFeishuUserID,
		"agent_owner_mobile":         req.Mobile,
		"agent_owner_employee_no":    finalEmployeeNo,
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
		"agent_owner_feishu_user_id":  user.AgentOwnerFeishuUserId,
		"agent_owner_department_name": user.AgentOwnerDepartmentName,
		"agent_owner_bound_at":        user.AgentOwnerBoundAt,
	})
}

func resolveFeishuIdentifiersForAgentOwner(c *gin.Context, req agentOwnerBindRequest) (openID, unionID, userID, name, orgName, jobTitle, employeeNo string) {
	// 如果直接传了 open_id，优先用它查询补全
	if req.FeishuOpenId != "" {
		return resolveFeishuIdentifiersFromReadable(c, "", req.Mobile, req.Email)
	}
	// 用可读信息（手机号/工号/邮箱）查询
	return resolveFeishuIdentifiersFromReadable(c, req.EmployeeNo, req.Mobile, req.Email)
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v = strings.TrimSpace(v); v != "" {
			return v
		}
	}
	return ""
}
