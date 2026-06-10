package controller

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
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

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "分组创建成功", "data": group})
}

func UpdateSecurityGroup(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req dto.SecurityGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	if err := security.UpdateSecurityGroup(id, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "分组更新成功"})
}

func DeleteSecurityGroup(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if err := security.DeleteSecurityGroup(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "分组删除成功"})
}

func CopySecurityGroup(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	group, err := security.CopySecurityGroup(id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

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

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "规则创建成功", "data": rule})
}

func UpdateSecurityRule(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req dto.SecurityRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	if err := security.UpdateSecurityRule(id, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "规则更新成功"})
}

func DeleteSecurityRule(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if err := security.DeleteSecurityRule(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

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

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "策略创建成功", "data": policy})
}

func UpdateSecurityPolicy(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req dto.SecurityPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	if err := security.UpdateSecurityPolicy(id, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "策略更新成功"})
}

func DeleteSecurityPolicy(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if err := security.DeleteSecurityPolicy(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

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

	var logs []*model.SecurityHitLogWithDetails
	var count int64

	db := model.DB.Model(&model.SecurityHitLog{}).
		Select("security_hit_logs.*, users.username as user_name, security_rules.name as rule_name, security_groups.name as group_name").
		Joins("LEFT JOIN users ON security_hit_logs.user_id = users.id").
		Joins("LEFT JOIN security_rules ON security_hit_logs.rule_id = security_rules.id").
		Joins("LEFT JOIN security_groups ON security_hit_logs.group_id = security_groups.id")

	if userID > 0 {
		db = db.Where("security_hit_logs.user_id = ?", userID)
	}
	if action > 0 {
		db = db.Where("security_hit_logs.action = ?", action)
	}
	if riskLevel > 0 {
		db = db.Where("security_hit_logs.risk_level = ?", riskLevel)
	}
	if contentType > 0 {
		db = db.Where("security_hit_logs.content_type = ?", contentType)
	}

	db.Count(&count)
	db.Order("security_hit_logs.id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&logs)

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

	var logs []*model.SecurityHitLogWithDetails

	db := model.DB.Model(&model.SecurityHitLog{}).
		Select("security_hit_logs.*, users.username as user_name, security_rules.name as rule_name, security_groups.name as group_name").
		Joins("LEFT JOIN users ON security_hit_logs.user_id = users.id").
		Joins("LEFT JOIN security_rules ON security_hit_logs.rule_id = security_rules.id").
		Joins("LEFT JOIN security_groups ON security_hit_logs.group_id = security_groups.id")

	if userID > 0 {
		db = db.Where("security_hit_logs.user_id = ?", userID)
	}
	if action > 0 {
		db = db.Where("security_hit_logs.action = ?", action)
	}
	if riskLevel > 0 {
		db = db.Where("security_hit_logs.risk_level = ?", riskLevel)
	}
	if contentType > 0 {
		db = db.Where("security_hit_logs.content_type = ?", contentType)
	}

	db.Order("security_hit_logs.id DESC").Find(&logs)

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

	actionMap := map[int]string{1: "Pass", 2: "Alert", 3: "Mask", 4: "Block", 5: "Review"}
	riskMap := map[int]string{1: "Low", 2: "Medium", 3: "High", 4: "Critical"}
	contentTypeMap := map[int]string{1: "Request", 2: "Response"}

	for _, log := range logs {
		row := []string{
			strconv.FormatInt(log.ID, 10),
			log.RequestID,
			log.CreatedAt.Format("2006-01-02 15:04:05"),
			log.UserName,
			log.ModelName,
			contentTypeMap[log.ContentType],
			actionMap[log.Action],
			riskMap[log.RiskLevel],
			strconv.Itoa(log.RiskScore),
			log.RuleName,
			log.GroupName,
			log.IP,
			log.MatchDetail,
		}
		if err := writer.Write(row); err != nil {
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