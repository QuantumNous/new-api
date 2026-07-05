package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// commissionService 全局返佣服务实例（使用单例）
var commissionService = service.GetCommissionService()

// ==================== 用户端 API ====================

// GetUserCommissionInfo 获取用户返佣信息
func GetUserCommissionInfo(c *gin.Context) {
	id := c.GetInt("id")
	user, err := model.GetUserById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 获取返佣统计
	summary, err := model.GetUserCommissionSummary(id)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"total_commission":    summary["total_commission"],
			"settled_commission":  summary["settled_commission"],
			"pending_commission":  summary["pending_commission"],
			"refunded_commission": summary["refunded_commission"],
			"aff_code":            user.AffCode,
			"aff_count":           user.AffCount,
			"aff_quota":           user.AffQuota,
			"aff_history_quota":   user.AffHistoryQuota,
		},
	})
}

// GetUserCommissionLogs 获取用户返佣明细
func GetUserCommissionLogs(c *gin.Context) {
	id := c.GetInt("id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// 获取返佣记录（作为邀请人）
	logs, total, err := model.GetUserCommissionLogs(id, status, page, pageSize)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	// 格式化输出（隐藏敏感信息）
	items := make([]map[string]interface{}, 0, len(logs))
	for _, log := range logs {
		// 获取消费用户信息（脱敏）
		var username string
		user, err := model.GetUserById(log.UserID, false)
		if err == nil {
			username = maskUsername(user.Username)
		}

		// D3: 去掉消费者数字ID，防止枚举用户
		items = append(items, map[string]interface{}{
			"id":                log.Id,
			"username":          username,
			"level":             log.Level,
			"model_name":        log.ModelName,
			"consumption_quota": log.ConsumptionQuota,
			"commission_rate":   log.CommissionRate,
			"commission_quota":  log.CommissionQuota,
			"status":            log.Status,
			"created_at":        log.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"items": items,
			"total": total,
			"page":  page,
			"limit": pageSize,
		},
	})
}

// GetUserCommissionStats 获取用户返佣统计
func GetUserCommissionStats(c *gin.Context) {
	id := c.GetInt("id")
	period := c.DefaultQuery("period", "all") // daily/weekly/monthly/all

	stats, err := model.GetUserCommissionStats(id, period)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"period": period,
			"stats":  stats,
		},
	})
}

// TransferCommissionToQuota 转移邀请额度到余额
func TransferCommissionToQuota(c *gin.Context) {
	id := c.GetInt("id")

	var req struct {
		Quota int `json:"quota" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	if req.Quota <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	// 执行转移
	err := commissionService.TransferAffQuotaToQuota(id, req.Quota)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgOperationFailed, map[string]any{"Error": err.Error()})
		return
	}

	// 获取更新后的用户信息
	user, err := model.GetUserById(id, true)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": i18n.T(c, i18n.MsgOperationSuccess),
		"data": map[string]interface{}{
			"transferred":         req.Quota,
			"remaining_aff_quota": user.AffQuota,
			"new_balance":         user.Quota,
		},
	})
}

// GetUserConsumptionLogs 获取用户消费返佣记录（作为被邀请人）
func GetUserConsumptionLogs(c *gin.Context) {
	id := c.GetInt("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// 获取消费记录
	logs, total, err := model.GetUserConsumptionLogs(id, page, pageSize)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	// 格式化输出
	items := make([]map[string]interface{}, 0, len(logs))
	for _, log := range logs {
		items = append(items, map[string]interface{}{
			"id":                log.Id,
			"inviter_id":        log.InviterID,
			"level":             log.Level,
			"model_name":        log.ModelName,
			"consumption_quota": log.ConsumptionQuota,
			"commission_rate":   log.CommissionRate,
			"commission_quota":  log.CommissionQuota,
			"status":            log.Status,
			"created_at":        log.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"items": items,
			"total": total,
			"page":  page,
			"limit": pageSize,
		},
	})
}

// ==================== 管理员 API ====================

// AdminGetCommissionRules 获取所有返佣规则
func AdminGetCommissionRules(c *gin.Context) {
	rules, err := model.GetAllCommissionRules(false)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    rules,
	})
}

// AdminCreateCommissionRule 创建返佣规则
func AdminCreateCommissionRule(c *gin.Context) {
	var rule model.CommissionRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	// 验证必填字段
	if rule.RuleName == "" || rule.RuleCode == "" || rule.RuleType == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	// 检查代码是否重复
	existing, _ := model.GetCommissionRuleByCode(rule.RuleCode)
	if existing != nil && existing.Id > 0 {
		common.ApiErrorI18n(c, i18n.MsgOperationFailed, map[string]any{"Error": "规则代码已存在"})
		return
	}

	if err := model.CreateCommissionRule(&rule); err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": i18n.T(c, i18n.MsgOperationSuccess),
		"data":    rule,
	})
}

// AdminUpdateCommissionRule 更新返佣规则
func AdminUpdateCommissionRule(c *gin.Context) {
	urlID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	// D1: DTO 白名单，防止篡改 id/rule_code
	var in struct {
		RuleName         *string  `json:"rule_name"`
		RuleType         *string  `json:"rule_type"`
		Level1Rate       *float64 `json:"level1_rate"`
		Level2Rate       *float64 `json:"level2_rate"`
		Level3Rate       *float64 `json:"level3_rate"`
		FixedAmount      *int     `json:"fixed_amount"`
		MinConsumption   *int     `json:"min_consumption"`
		MaxCommission    *int     `json:"max_commission"`
		DailyLimit       *int     `json:"daily_limit"`
		MonthlyLimit     *int     `json:"monthly_limit"`
		ApplicableModels *string  `json:"applicable_models"`
		ExcludedModels   *string  `json:"excluded_models"`
		IsActive         *bool    `json:"is_active"`
		Priority         *int     `json:"priority"`
	}

	if err := c.ShouldBindJSON(&in); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	// 数值校验
	if in.Level1Rate != nil && (*in.Level1Rate < 0 || *in.Level1Rate > 1) {
		common.ApiErrorMsg(c, "level1_rate 必须在 [0, 1] 范围内")
		return
	}
	if in.Level2Rate != nil && (*in.Level2Rate < 0 || *in.Level2Rate > 1) {
		common.ApiErrorMsg(c, "level2_rate 必须在 [0, 1] 范围内")
		return
	}
	if in.Level3Rate != nil && (*in.Level3Rate < 0 || *in.Level3Rate > 1) {
		common.ApiErrorMsg(c, "level3_rate 必须在 [0, 1] 范围内")
		return
	}
	if in.FixedAmount != nil && *in.FixedAmount < 0 {
		common.ApiErrorMsg(c, "fixed_amount 必须 >= 0")
		return
	}
	if in.DailyLimit != nil && *in.DailyLimit < 0 {
		common.ApiErrorMsg(c, "daily_limit 必须 >= 0")
		return
	}
	if in.MonthlyLimit != nil && *in.MonthlyLimit < 0 {
		common.ApiErrorMsg(c, "monthly_limit 必须 >= 0")
		return
	}
	if in.RuleType != nil && (*in.RuleType != "percentage" && *in.RuleType != "fixed" && *in.RuleType != "hybrid") {
		common.ApiErrorMsg(c, "rule_type 必须为 percentage/fixed/hybrid")
		return
	}

	// 组装 map，只放非 nil 字段
	updates := make(map[string]interface{})
	if in.RuleName != nil {
		updates["rule_name"] = *in.RuleName
	}
	if in.RuleType != nil {
		updates["rule_type"] = *in.RuleType
	}
	if in.Level1Rate != nil {
		updates["level1_rate"] = *in.Level1Rate
	}
	if in.Level2Rate != nil {
		updates["level2_rate"] = *in.Level2Rate
	}
	if in.Level3Rate != nil {
		updates["level3_rate"] = *in.Level3Rate
	}
	if in.FixedAmount != nil {
		updates["fixed_amount"] = *in.FixedAmount
	}
	if in.MinConsumption != nil {
		updates["min_consumption"] = *in.MinConsumption
	}
	if in.MaxCommission != nil {
		updates["max_commission"] = *in.MaxCommission
	}
	if in.DailyLimit != nil {
		updates["daily_limit"] = *in.DailyLimit
	}
	if in.MonthlyLimit != nil {
		updates["monthly_limit"] = *in.MonthlyLimit
	}
	if in.ApplicableModels != nil {
		updates["applicable_models"] = *in.ApplicableModels
	}
	if in.ExcludedModels != nil {
		updates["excluded_models"] = *in.ExcludedModels
	}
	if in.IsActive != nil {
		updates["is_active"] = *in.IsActive
	}
	if in.Priority != nil {
		updates["priority"] = *in.Priority
	}

	if err := model.DB.Model(&model.CommissionRule{}).
		Where("id = ?", urlID).
		Updates(updates).Error; err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	rule, _ := model.GetCommissionRuleById(urlID)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": i18n.T(c, i18n.MsgOperationSuccess),
		"data":    rule,
	})
}

// AdminDeleteCommissionRule 删除返佣规则
func AdminDeleteCommissionRule(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	if err := model.DeleteCommissionRule(id); err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": i18n.T(c, i18n.MsgOperationSuccess),
	})
}

// AdminToggleCommissionRule 切换返佣规则状态
func AdminToggleCommissionRule(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	if err := model.ToggleCommissionRule(id, req.IsActive); err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": i18n.T(c, i18n.MsgOperationSuccess),
	})
}

// AdminGetCommissionStatistics 获取返佣统计报表
func AdminGetCommissionStatistics(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	// 默认查询最近30天
	if startDate == "" {
		startDate = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	// 解析日期
	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	end = end.Add(24*time.Hour - time.Second) // 包含结束日期全天

	// 查询统计数据
	var summary struct {
		TotalCommission   int64   `json:"total_commission"`
		TotalUsers        int64   `json:"total_users"`
		ActiveInviters    int64   `json:"active_inviters"`
		AvgCommissionRate float64 `json:"avg_commission_rate"`
	}

	// 总返佣金额
	model.DB.Model(&model.CommissionLog{}).
		Where("status = ? AND created_at BETWEEN ? AND ?", "settled", start, end).
		Select("COALESCE(SUM(commission_quota), 0)").
		Scan(&summary.TotalCommission)

	// 参与用户数
	model.DB.Model(&model.CommissionLog{}).
		Where("created_at BETWEEN ? AND ?", start, end).
		Distinct("inviter_id").
		Count(&summary.TotalUsers)

	// 活跃邀请人数
	model.DB.Model(&model.CommissionLog{}).
		Where("status = ? AND created_at BETWEEN ? AND ?", "settled", start, end).
		Distinct("inviter_id").
		Count(&summary.ActiveInviters)

	// 平均返佣比例
	model.DB.Model(&model.CommissionLog{}).
		Where("created_at BETWEEN ? AND ?", start, end).
		Select("COALESCE(AVG(commission_rate), 0)").
		Scan(&summary.AvgCommissionRate)

	// 查询每日统计
	type DailyStats struct {
		Date         string `json:"date"`
		Commission   int64  `json:"commission"`
		Transactions int64  `json:"transactions"`
	}
	var dailyStats []DailyStats
	model.DB.Model(&model.CommissionLog{}).
		Where("status = ? AND created_at BETWEEN ? AND ?", "settled", start, end).
		Select("DATE(created_at) as date, SUM(commission_quota) as commission, COUNT(*) as transactions").
		Group("DATE(created_at)").
		Order("date ASC").
		Scan(&dailyStats)

	// 查询TOP邀请人
	type TopInviter struct {
		UserID          int    `json:"user_id"`
		Username        string `json:"username"`
		TotalCommission int64  `json:"total_commission"`
		InviteCount     int64  `json:"invite_count"`
	}
	var topInviters []TopInviter
	model.DB.Table("commission_logs cl").
		Select("cl.inviter_id as user_id, u.username, SUM(cl.commission_quota) as total_commission, COUNT(DISTINCT cl.user_id) as invite_count").
		Joins("LEFT JOIN users u ON cl.inviter_id = u.id").
		Where("cl.status = ? AND cl.created_at BETWEEN ? AND ?", "settled", start, end).
		Group("cl.inviter_id, u.username").
		Order("total_commission DESC").
		Limit(10).
		Scan(&topInviters)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"summary":       summary,
			"daily_stats":   dailyStats,
			"top_inviters":  topInviters,
			"start_date":    startDate,
			"end_date":      endDate,
		},
	})
}

// AdminGetCommissionLogs 获取所有返佣日志（管理员）
func AdminGetCommissionLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	userID, _ := strconv.Atoi(c.Query("user_id"))
	status := c.Query("status")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// 构建查询
	query := model.DB.Model(&model.CommissionLog{})
	if userID > 0 {
		query = query.Where("inviter_id = ?", userID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	// 统计总数
	var total int64
	query.Count(&total)

	// 分页查询
	var logs []model.CommissionLog
	offset := (page - 1) * pageSize
	query.Order("created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&logs)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"items": logs,
			"total": total,
			"page":  page,
			"limit": pageSize,
		},
	})
}

// AdminSettleCommission 手动结算返佣
// AdminSettleCommission 手动结算（管理员）- 事务内 pending → settled 并加钱
func AdminSettleCommission(c *gin.Context) {
	var req struct {
		UserIDs []int `json:"user_ids"` // 可选，空=全部
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		// 解析失败返回400（资金操作必须明确入参）
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	// 分批处理（每批 500 条，游标分页避免死循环）
	batchSize := 500
	totalSettled := 0
	lastId := int64(0)

	for {
		// 游标分页：查找待结算的返佣记录
		query := model.DB.Model(&model.CommissionLog{}).
			Where("status = ? AND id > ?", "pending", lastId).
			Order("id ASC").
			Limit(batchSize)

		if len(req.UserIDs) > 0 {
			query = query.Where("inviter_id IN ?", req.UserIDs)
		}

		var pendingLogs []model.CommissionLog
		if err := query.Find(&pendingLogs).Error; err != nil {
			common.ApiError(c, err)
			return
		}

		if len(pendingLogs) == 0 {
			break // 没有待结算记录了
		}

		// 事务内批量结算
		batchSettled := 0
		affectedInviterIds := make(map[int]struct{})
		err := model.DB.Transaction(func(tx *gorm.DB) error {
			for _, log := range pendingLogs {
				// 1. 行锁串行化邀请人
				var inviter model.User
				if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
					Select("id").First(&inviter, log.InviterID).Error; err != nil {
					continue
				}

				// 2. 更新状态 pending → settled（条件保护）
				now := time.Now()
				res := tx.Model(&model.CommissionLog{}).
					Where("id = ? AND status = ?", log.Id, "pending").
					Updates(map[string]interface{}{
						"status":     "settled",
						"settled_at": now,
					})

				if res.Error != nil {
					return res.Error
				}
				if res.RowsAffected == 0 {
					continue // 已被其他进程结算
				}

				// 3. 加钱（quota/aff_quota/aff_history 三列）
				if err := tx.Model(&model.User{}).
					Where("id = ?", log.InviterID).
					Updates(map[string]interface{}{
						"quota":       gorm.Expr("quota + ?", log.CommissionQuota),
						"aff_quota":   gorm.Expr("aff_quota + ?", log.CommissionQuota),
						"aff_history": gorm.Expr("aff_history + ?", log.CommissionQuota),
					}).Error; err != nil {
					return err
				}

				// 记录需要失效缓存的用户
				affectedInviterIds[log.InviterID] = struct{}{}
				batchSettled++
			}

			return nil
		})

		if err != nil {
			common.ApiError(c, err)
			return
		}

		// 事务成功后，失效受影响用户的缓存
		for inviterId := range affectedInviterIds {
			_ = model.InvalidateUserCache(inviterId)
		}

		totalSettled += batchSettled

		// 更新游标位置（最后一条记录的ID）
		lastId = pendingLogs[len(pendingLogs)-1].Id

		// 如果这批不足 batchSize，说明已经处理完
		if len(pendingLogs) < batchSize {
			break
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": i18n.T(c, i18n.MsgOperationSuccess),
		"data": map[string]interface{}{
			"settled_count": totalSettled,
		},
	})
}

// ==================== 辅助函数 ====================

// maskUsername 用户名脱敏（E2: rune安全，支持中文等多字节字符）
func maskUsername(username string) string {
	r := []rune(username)
	if len(r) <= 2 {
		return username + "***"
	}
	return string(r[:2]) + "***"
}

// AdminDetectSuspicious 管理员检测用户可疑活动（B4）
func AdminDetectSuspicious(c *gin.Context) {
	userIDStr := c.Param("user_id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		common.ApiErrorMsg(c, "无效的用户ID")
		return
	}

	suspicious, reasons := commissionService.Guard().DetectSuspiciousActivity(userID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"suspicious": suspicious,
			"reasons":    reasons,
		},
	})
}
