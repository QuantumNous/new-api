package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetAllInvitationRebateRecords returns invitation rebate records for admins.
func GetAllInvitationRebateRecords(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)

	query := model.DB.Model(&model.InvitationRebateRecord{})

	if inviterUserId, ok := parsePositiveQueryInt(c, "inviter_user_id"); ok {
		query = query.Where("inviter_user_id = ?", inviterUserId)
	}
	if inviteeUserId, ok := parsePositiveQueryInt(c, "invitee_user_id"); ok {
		query = query.Where("invitee_user_id = ?", inviteeUserId)
	}
	if sourceType := strings.TrimSpace(c.Query("source_type")); sourceType != "" {
		query = query.Where("source_type = ?", sourceType)
	}
	if sourceKey := strings.TrimSpace(c.Query("source_key")); sourceKey != "" {
		query = query.Where("source_key = ?", sourceKey)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	var records []*model.InvitationRebateRecord
	if err := query.
		Order("created_at desc, id desc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&records).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(records)
	common.ApiSuccess(c, pageInfo)
}

func parsePositiveQueryInt(c *gin.Context, key string) (int, bool) {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return 0, false
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return 0, false
	}
	return value, true
}
