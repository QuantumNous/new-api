package controller

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type invitationRebateSelfSummary struct {
	PendingRebateQuota int `json:"pending_rebate_quota"`
	TotalRebateQuota   int `json:"total_rebate_quota"`
	ConvertedQuota     int `json:"converted_quota"`
	InviteCount        int `json:"invite_count"`
}

type invitationRebateSelfInvitee struct {
	InviteeUserId           int    `json:"invitee_user_id"`
	Username                string `json:"username"`
	DisplayName             string `json:"display_name"`
	CreatedAt               int64  `json:"created_at"`
	PendingSourceQuota      int    `json:"pending_source_quota"`
	TotalSourceQuota        int    `json:"total_source_quota"`
	TotalSettledSourceQuota int    `json:"total_settled_source_quota"`
	TotalRebateQuota        int    `json:"total_rebate_quota"`
}

type invitationRebateSelfRecord struct {
	Id             int    `json:"id"`
	InviteeUserId  int    `json:"invitee_user_id"`
	SourceType     string `json:"source_type"`
	SourceQuota    int    `json:"source_quota"`
	RebateQuota    int    `json:"rebate_quota"`
	RebateRatioBps int    `json:"rebate_ratio_bps"`
	Status         string `json:"status"`
	CreatedAt      int64  `json:"created_at"`
}

type invitationRebateSelfSettlementItem struct {
	Id                 int    `json:"id"`
	SourceType         string `json:"source_type"`
	SourceKey          string `json:"source_key"`
	SettledSourceQuota int    `json:"settled_source_quota"`
	RebateRatioBps     int    `json:"rebate_ratio_bps"`
	RebateQuota        int    `json:"rebate_quota"`
	RemainderBefore    int64  `json:"remainder_before"`
	RemainderAfter     int64  `json:"remainder_after"`
	CreatedAt          int64  `json:"created_at"`
}

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

// GetSelfInvitationRebateSummary returns invitation rebate totals for current user.
func GetSelfInvitationRebateSummary(c *gin.Context) {
	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	convertedQuota := user.AffHistoryQuota - user.AffQuota
	if convertedQuota < 0 {
		convertedQuota = 0
	}

	common.ApiSuccess(c, invitationRebateSelfSummary{
		PendingRebateQuota: user.AffQuota,
		TotalRebateQuota:   user.AffHistoryQuota,
		ConvertedQuota:     convertedQuota,
		InviteCount:        user.AffCount,
	})
}

// GetSelfInvitationRebateInvitees returns users invited by current user with rebate aggregates.
func GetSelfInvitationRebateInvitees(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)

	query := model.DB.Model(&model.User{}).Where("inviter_id = ?", userId)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	var invitees []*model.User
	if err := query.
		Select("id", "username", "display_name", "created_at").
		Order("created_at desc, id desc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&invitees).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	inviteeIds := make([]int, 0, len(invitees))
	for _, invitee := range invitees {
		inviteeIds = append(inviteeIds, invitee.Id)
	}

	accumulations := map[int]model.InvitationRebateAccumulation{}
	if len(inviteeIds) > 0 {
		var rows []model.InvitationRebateAccumulation
		if err := model.DB.
			Where("inviter_user_id = ? AND invitee_user_id IN ?", userId, inviteeIds).
			Find(&rows).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		for _, row := range rows {
			accumulations[row.InviteeUserId] = row
		}
	}

	items := make([]invitationRebateSelfInvitee, 0, len(invitees))
	for _, invitee := range invitees {
		item := invitationRebateSelfInvitee{
			InviteeUserId: invitee.Id,
			Username:      invitee.Username,
			DisplayName:   invitee.DisplayName,
			CreatedAt:     invitee.CreatedAt,
		}
		if accumulation, ok := accumulations[invitee.Id]; ok {
			item.PendingSourceQuota = accumulation.PendingSourceQuota
			item.TotalSourceQuota = accumulation.TotalSourceQuota
			item.TotalSettledSourceQuota = accumulation.TotalSettledSourceQuota
			item.TotalRebateQuota = accumulation.TotalRebateQuota
		}
		items = append(items, item)
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

// GetSelfInvitationRebateRecords returns rebate records for current user.
func GetSelfInvitationRebateRecords(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)

	query := model.DB.Model(&model.InvitationRebateRecord{}).
		Where("inviter_user_id = ?", userId)
	if inviteeUserId, ok := parsePositiveQueryInt(c, "invitee_user_id"); ok {
		query = query.Where("invitee_user_id = ?", inviteeUserId)
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

	items := make([]invitationRebateSelfRecord, 0, len(records))
	for _, record := range records {
		items = append(items, toSelfInvitationRebateRecord(record))
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

// GetSelfInvitationRebateRecordDetail returns one current user's rebate record and settlement items.
func GetSelfInvitationRebateRecordDetail(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(strings.TrimSpace(c.Param("id")))
	if err != nil || id <= 0 {
		common.ApiError(c, errors.New("invalid invitation rebate record id"))
		return
	}

	var record model.InvitationRebateRecord
	if err := model.DB.Where("id = ? AND inviter_user_id = ?", id, userId).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiError(c, errors.New("invitation rebate record not found"))
			return
		}
		common.ApiError(c, err)
		return
	}

	var items []*model.InvitationRebateSettlementItem
	if err := model.DB.
		Where("rebate_record_id = ? AND inviter_user_id = ?", id, userId).
		Order("id asc").
		Find(&items).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	selfItems := make([]invitationRebateSelfSettlementItem, 0, len(items))
	for _, item := range items {
		selfItems = append(selfItems, toSelfInvitationRebateSettlementItem(item))
	}

	common.ApiSuccess(c, gin.H{
		"record": toSelfInvitationRebateRecord(&record),
		"items":  selfItems,
		"legacy": len(selfItems) == 0,
	})
}

func toSelfInvitationRebateRecord(record *model.InvitationRebateRecord) invitationRebateSelfRecord {
	return invitationRebateSelfRecord{
		Id:             record.Id,
		InviteeUserId:  record.InviteeUserId,
		SourceType:     record.SourceType,
		SourceQuota:    record.SourceQuota,
		RebateQuota:    record.RebateQuota,
		RebateRatioBps: record.RebateRatioBps,
		Status:         record.Status,
		CreatedAt:      record.CreatedAt,
	}
}

func toSelfInvitationRebateSettlementItem(item *model.InvitationRebateSettlementItem) invitationRebateSelfSettlementItem {
	return invitationRebateSelfSettlementItem{
		Id:                 item.Id,
		SourceType:         item.SourceType,
		SourceKey:          maskInvitationRebateSourceKey(item.SourceKey),
		SettledSourceQuota: item.SettledSourceQuota,
		RebateRatioBps:     item.RebateRatioBps,
		RebateQuota:        item.RebateQuota,
		RemainderBefore:    item.RemainderBefore,
		RemainderAfter:     item.RemainderAfter,
		CreatedAt:          item.CreatedAt,
	}
}

func maskInvitationRebateSourceKey(sourceKey string) string {
	sourceKey = strings.TrimSpace(sourceKey)
	if sourceKey == "" {
		return ""
	}
	if len(sourceKey) <= 4 {
		return "***"
	}
	if len(sourceKey) <= 8 {
		return sourceKey[:2] + "***"
	}
	return sourceKey[:4] + "..." + sourceKey[len(sourceKey)-4:]
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
