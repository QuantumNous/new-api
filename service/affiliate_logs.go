package service

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type AffiliateScopedLogsInput struct {
	Scope                  AffiliateScope
	LogType                int
	RequestStatus          string
	StartTimestamp         int64
	EndTimestamp           int64
	ModelName              string
	Group                  string
	TokenName              string
	UserId                 int
	SecondLevelAffiliateId int
	StartIdx               int
	PageSize               int
}

func ListAffiliateScopedLogs(db *gorm.DB, logDB *gorm.DB, input AffiliateScopedLogsInput) ([]*model.Log, int64, error) {
	if logDB == nil {
		return nil, 0, errors.New("nil log db")
	}
	logType, err := resolveAffiliateScopedLogType(input.LogType, input.RequestStatus)
	if err != nil {
		return nil, 0, err
	}
	visible, err := resolveAffiliateScopedLogUsers(db, input.Scope, input.UserId, input.SecondLevelAffiliateId)
	if err != nil {
		return nil, 0, err
	}
	if !visible.Global && len(visible.UserIds) == 0 {
		return []*model.Log{}, 0, nil
	}

	tx := logDB.Model(&model.Log{})
	if logType != model.LogTypeUnknown {
		tx = tx.Where("logs.type = ?", logType)
	}
	if !visible.Global {
		tx = tx.Where("logs.user_id IN ?", visible.UserIds)
	}
	if strings.TrimSpace(input.ModelName) != "" {
		tx = tx.Where("logs.model_name = ?", strings.TrimSpace(input.ModelName))
	}
	if strings.TrimSpace(input.Group) != "" {
		tx = tx.Where("logs."+model.LogGroupColumn()+" = ?", strings.TrimSpace(input.Group))
	}
	if strings.TrimSpace(input.TokenName) != "" {
		tx = tx.Where("logs.token_name = ?", strings.TrimSpace(input.TokenName))
	}
	if input.StartTimestamp != 0 {
		tx = tx.Where("logs.created_at >= ?", input.StartTimestamp)
	}
	if input.EndTimestamp != 0 {
		tx = tx.Where("logs.created_at <= ?", input.EndTimestamp)
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	pageSize := input.PageSize
	if pageSize <= 0 {
		pageSize = common.ItemsPerPage
	}
	if pageSize > 100 {
		pageSize = 100
	}

	var logs []*model.Log
	if err := tx.Order("logs.created_at desc, logs.id desc").Limit(pageSize).Offset(input.StartIdx).Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	sanitizeAffiliateScopedLogs(logs, input.StartIdx)
	return logs, total, nil
}

func resolveAffiliateScopedLogType(logType int, requestStatus string) (int, error) {
	switch strings.ToLower(strings.TrimSpace(requestStatus)) {
	case "":
		return logType, nil
	case "all", "unknown":
		return model.LogTypeUnknown, nil
	case "success", "consume", "consumed":
		return model.LogTypeConsume, nil
	case "error", "failed", "failure":
		return model.LogTypeError, nil
	case "refund":
		return model.LogTypeRefund, nil
	default:
		return 0, errors.New("invalid request status")
	}
}

func resolveAffiliateScopedLogUsers(db *gorm.DB, scope AffiliateScope, userId int, secondLevelAffiliateId int) (AffiliateVisibleUserIds, error) {
	if scope.Kind == AffiliateScopeGlobal {
		return resolveGlobalScopedLogUsers(db, userId, secondLevelAffiliateId)
	}

	visible, err := ListAffiliateVisibleUserIds(db, scope)
	if err != nil {
		return AffiliateVisibleUserIds{}, err
	}
	if secondLevelAffiliateId > 0 {
		visible.UserIds, err = resolveSecondLevelScopedLogUsers(db, scope, visible.UserIds, secondLevelAffiliateId)
		if err != nil {
			return AffiliateVisibleUserIds{}, err
		}
	}
	if userId > 0 {
		if !containsInt(visible.UserIds, userId) {
			return AffiliateVisibleUserIds{}, errors.New("user outside affiliate scope")
		}
		visible.UserIds = []int{userId}
	}
	return visible, nil
}

func resolveGlobalScopedLogUsers(db *gorm.DB, userId int, secondLevelAffiliateId int) (AffiliateVisibleUserIds, error) {
	if userId > 0 {
		return AffiliateVisibleUserIds{UserIds: []int{userId}}, nil
	}
	if secondLevelAffiliateId <= 0 {
		return AffiliateVisibleUserIds{Global: true}, nil
	}
	return listSecondLevelScopedLogUsers(db, secondLevelAffiliateId, nil)
}

func resolveSecondLevelScopedLogUsers(db *gorm.DB, scope AffiliateScope, baseUserIds []int, secondLevelAffiliateId int) ([]int, error) {
	if scope.AffiliateLevel == 2 {
		if secondLevelAffiliateId != scope.UserId {
			return nil, errors.New("second level affiliate outside scope")
		}
		return baseUserIds, nil
	}
	if scope.AffiliateLevel != 1 {
		return nil, errors.New("invalid affiliate scope")
	}
	if db == nil {
		return nil, errors.New("nil db")
	}

	var count int64
	err := db.Model(&model.AffiliateRelation{}).
		Where(
			"ancestor_user_id = ? AND descendant_user_id = ? AND depth = ? AND status = ?",
			scope.UserId,
			secondLevelAffiliateId,
			1,
			model.AffiliateProfileStatusActive,
		).
		Count(&count).Error
	if err != nil {
		return nil, err
	}
	if count == 0 {
		directLegacy, err := hasLegacyDirectInviter(db, scope.UserId, secondLevelAffiliateId)
		if err != nil {
			return nil, err
		}
		if !directLegacy {
			return nil, errors.New("second level affiliate outside scope")
		}
	}

	visible, err := listSecondLevelScopedLogUsers(db, secondLevelAffiliateId, baseUserIds)
	if err != nil {
		return nil, err
	}
	return visible.UserIds, nil
}

func hasLegacyDirectInviter(db *gorm.DB, inviterUserId int, userId int) (bool, error) {
	if db == nil {
		return false, errors.New("nil db")
	}
	if inviterUserId <= 0 || userId <= 0 {
		return false, nil
	}
	var count int64
	err := db.Model(&model.User{}).
		Where("id = ? AND inviter_id = ?", userId, inviterUserId).
		Count(&count).Error
	return count > 0, err
}

func listSecondLevelScopedLogUsers(db *gorm.DB, secondLevelAffiliateId int, limitTo []int) (AffiliateVisibleUserIds, error) {
	if db == nil {
		return AffiliateVisibleUserIds{}, errors.New("nil db")
	}
	scope := AffiliateScope{
		Kind:           AffiliateScopeAffiliate,
		UserId:         secondLevelAffiliateId,
		AffiliateLevel: 2,
		MaxDepth:       1,
	}
	visible, err := ListAffiliateVisibleUserIds(db, scope)
	if err != nil {
		return AffiliateVisibleUserIds{}, err
	}
	candidates := append([]int{secondLevelAffiliateId}, visible.UserIds...)
	if len(limitTo) == 0 {
		return AffiliateVisibleUserIds{UserIds: dedupeInts(candidates)}, nil
	}
	limited := make([]int, 0, len(candidates))
	for _, userId := range candidates {
		if containsInt(limitTo, userId) {
			limited = append(limited, userId)
		}
	}
	return AffiliateVisibleUserIds{UserIds: dedupeInts(limited)}, nil
}

func sanitizeAffiliateScopedLogs(logs []*model.Log, startIdx int) {
	for i := range logs {
		logs[i].Id = startIdx + i + 1
		logs[i].ChannelId = 0
		logs[i].ChannelName = ""
		logs[i].TokenId = 0
		logs[i].TokenName = ""
		logs[i].Ip = ""
		logs[i].RequestId = ""
		logs[i].UpstreamRequestId = ""
		logs[i].Other = sanitizeAffiliateScopedLogOther(logs[i].Other)
	}
}

func sanitizeAffiliateScopedLogOther(other string) string {
	otherMap, err := common.StrToMap(other)
	if err != nil || otherMap == nil {
		return ""
	}
	delete(otherMap, "admin_info")
	delete(otherMap, "stream_status")
	return common.MapToJsonStr(otherMap)
}

func containsInt(values []int, target int) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func dedupeInts(values []int) []int {
	seen := make(map[int]bool, len(values))
	result := make([]int, 0, len(values))
	for _, value := range values {
		if value <= 0 || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	return result
}
