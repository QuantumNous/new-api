package controller

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service/security"

	"github.com/gin-gonic/gin"
)

// ========== 安全分组管理 ==========

func GetSecurityGroups(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status, _ := strconv.Atoi(c.DefaultQuery("status", "-1"))
	parentID, _ := strconv.ParseInt(c.DefaultQuery("parent_id", "-1"), 10, 64)

	groups, total, err := security.GetSecurityGroups(page, pageSize, status, parentID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     groups,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

func CreateSecurityGroup(c *gin.Context) {
	var req dto.SecurityGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	group, err := security.CreateSecurityGroup(&req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	security.CreateAuditLog(c.GetInt("id"), "create", "security_group", group.ID, nil, group)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "分组创建成功", "data": group})
}

func UpdateSecurityGroup(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req dto.SecurityGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	oldGroup, _ := security.GetSecurityGroupById(id)
	if err := security.UpdateSecurityGroup(id, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	security.CreateAuditLog(c.GetInt("id"), "update", "security_group", id, oldGroup, req)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "分组更新成功"})
}

func DeleteSecurityGroup(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	oldGroup, _ := security.GetSecurityGroupById(id)
	if err := security.DeleteSecurityGroup(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	security.CreateAuditLog(c.GetInt("id"), "delete", "security_group", id, oldGroup, nil)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "分组删除成功"})
}

func CopySecurityGroup(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	group, err := security.CopySecurityGroup(id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	security.CreateAuditLog(c.GetInt("id"), "copy", "security_group", group.ID, nil, group)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "分组复制成功", "data": group})
}

// ========== 安全规则管理 ==========

func GetSecurityRules(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	groupID, _ := strconv.ParseInt(c.DefaultQuery("group_id", "0"), 10, 64)
	ruleType, _ := strconv.Atoi(c.DefaultQuery("type", "0"))
	status, _ := strconv.Atoi(c.DefaultQuery("status", "-1"))

	rules, total, err := security.GetSecurityRules(page, pageSize, groupID, ruleType, status)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     rules,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

func CreateSecurityRule(c *gin.Context) {
	var req dto.SecurityRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	rule, err := security.CreateSecurityRule(&req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	security.CreateAuditLog(c.GetInt("id"), "create", "security_rule", rule.ID, nil, rule)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "规则创建成功", "data": rule})
}

func UpdateSecurityRule(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req dto.SecurityRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	oldRule, _ := security.GetSecurityRuleById(id)
	if err := security.UpdateSecurityRule(id, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	security.CreateAuditLog(c.GetInt("id"), "update", "security_rule", id, oldRule, req)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "规则更新成功"})
}

func DeleteSecurityRule(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	oldRule, _ := security.GetSecurityRuleById(id)
	if err := security.DeleteSecurityRule(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	security.CreateAuditLog(c.GetInt("id"), "delete", "security_rule", id, oldRule, nil)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "规则删除成功"})
}

// ========== 用户策略管理 ==========

func GetSecurityPolicies(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	userID, _ := strconv.Atoi(c.DefaultQuery("user_id", "0"))
	status, _ := strconv.Atoi(c.DefaultQuery("status", "-1"))

	policies, total, err := security.GetSecurityPolicies(page, pageSize, userID, status)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     policies,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

func CreateSecurityPolicy(c *gin.Context) {
	var req dto.SecurityPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	policy, err := security.CreateSecurityPolicy(&req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	security.CreateAuditLog(c.GetInt("id"), "create", "security_policy", policy.ID, nil, policy)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "策略创建成功", "data": policy})
}

func UpdateSecurityPolicy(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req dto.SecurityPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	oldPolicy, _ := security.GetSecurityPolicyById(id)
	if err := security.UpdateSecurityPolicy(id, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	security.CreateAuditLog(c.GetInt("id"), "update", "security_policy", id, oldPolicy, req)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "策略更新成功"})
}

func DeleteSecurityPolicy(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	oldPolicy, _ := security.GetSecurityPolicyById(id)
	if err := security.DeleteSecurityPolicy(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	security.CreateAuditLog(c.GetInt("id"), "delete", "security_policy", id, oldPolicy, nil)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "策略删除成功"})
}

// ========== 审计日志 ==========

func GetSecurityLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	userID, _ := strconv.Atoi(c.DefaultQuery("user_id", "0"))
	action, _ := strconv.Atoi(c.DefaultQuery("action", "0"))
	riskLevel, _ := strconv.Atoi(c.DefaultQuery("risk_level", "0"))
	contentType, _ := strconv.Atoi(c.DefaultQuery("content_type", "0"))

	logs, count, err := security.GetSecurityLogs(security.SecurityLogQueryParams{
		Page:        page,
		PageSize:    pageSize,
		UserID:      userID,
		Action:      action,
		RiskLevel:   riskLevel,
		ContentType: contentType,
	})
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     logs,
			"total":     count,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

func ExportSecurityLogs(c *gin.Context) {
	format := c.DefaultQuery("format", "csv")
	userID, _ := strconv.Atoi(c.DefaultQuery("user_id", "0"))
	action, _ := strconv.Atoi(c.DefaultQuery("action", "0"))
	riskLevel, _ := strconv.Atoi(c.DefaultQuery("risk_level", "0"))
	contentType, _ := strconv.Atoi(c.DefaultQuery("content_type", "0"))

	logs, err := security.GetSecurityLogsForExport(security.ExportSecurityLogParams{
		Format:      format,
		UserID:      userID,
		Action:      action,
		RiskLevel:   riskLevel,
		ContentType: contentType,
	})
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	filename := fmt.Sprintf("security_logs_%s", time.Now().Format("20060102_150405"))

	switch format {
	case "excel":
		c.Header("Content-Type", "application/vnd.ms-excel; charset=utf-8")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s.xls", filename))
	default:
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s.csv", filename))
	}
	c.Header("Cache-Control", "no-cache")

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	// UTF-8 BOM for Excel compatibility
	if format == "excel" {
		c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})
	}

	headers := []string{"ID", "Request ID", "Time", "User", "Model", "Content Type", "Action", "Risk Level", "Risk Score", "Rule", "Group", "IP", "Match Detail"}
	if err := writer.Write(headers); err != nil {
		return
	}

	rows := security.FormatLogRows(logs)
	for _, row := range rows {
		record := []string{
			row.ID, row.RequestID, row.Time, row.UserName, row.ModelName,
			row.ContentType, row.Action, row.RiskLevel, row.RiskScore,
			row.RuleName, row.GroupName, row.IP, row.MatchDetail,
		}
		if err := writer.Write(record); err != nil {
			return
		}
	}
}

// ========== 统计看板 ==========

func GetSecurityDashboard(c *gin.Context) {
	startTime, _ := strconv.ParseInt(c.DefaultQuery("start_time", "0"), 10, 64)
	endTime, _ := strconv.ParseInt(c.DefaultQuery("end_time", "0"), 10, 64)

	response, err := security.GetSecurityDashboard(startTime, endTime)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": response})
}

// ========== 核心检测接口 ==========

func CheckSecurityRequest(c *gin.Context) {
	var req dto.SecurityCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	result, err := security.GetDetectionEngine().Detect(c.Request.Context(), req.UserID, req.Content, constant.SecurityContentTypeRequest, req.ModelName)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	actionName := "pass"
	switch result.Action {
	case constant.SecurityActionAlert:
		actionName = "alert"
	case constant.SecurityActionMask:
		actionName = "mask"
	case constant.SecurityActionBlock:
		actionName = "block"
	case constant.SecurityActionReview:
		actionName = "review"
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"detected":         result.Detected,
			"action":           result.Action,
			"action_name":      actionName,
			"risk_score":       result.RiskScore,
			"risk_level":       result.RiskLevel,
			"processed_content": result.ProcessedContent,
			"matches":          result.Matches,
		},
	})
}

func CheckSecurityResponse(c *gin.Context) {
	var req dto.SecurityCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	result, err := security.GetDetectionEngine().Detect(c.Request.Context(), req.UserID, req.Content, constant.SecurityContentTypeResponse, req.ModelName)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": result,
	})
}

// ========== 状态接口 ==========

func GetSecurityStatus(c *gin.Context) {
	status, err := security.GetSecurityStatus()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": status})
}