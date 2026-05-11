package controller

import (
	"errors"
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

// GetInvitationRebateRecordDetail returns one rebate record and its settlement items for admins.
func GetInvitationRebateRecordDetail(c *gin.Context) {
	id, err := strconv.Atoi(strings.TrimSpace(c.Param("id")))
	if err != nil || id <= 0 {
		common.ApiError(c, errors.New("invalid invitation rebate record id"))
		return
	}

	var record model.InvitationRebateRecord
	if err := model.DB.Where("id = ?", id).First(&record).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	var items []*model.InvitationRebateSettlementItem
	if err := model.DB.
		Where("rebate_record_id = ?", id).
		Order("id asc").
		Find(&items).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, gin.H{
		"record": record,
		"items":  items,
		"legacy": len(items) == 0,
	})
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
