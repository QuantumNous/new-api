package security

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// CreateAuditLog 创建操作审计日志
func CreateAuditLog(userID int, actionType string, targetType string, targetID int64, oldValue interface{}, newValue interface{}) error {
	var oldJSON, newJSON string
	if oldValue != nil {
		data, _ := common.Marshal(oldValue)
		oldJSON = string(data)
	}
	if newValue != nil {
		data, _ := common.Marshal(newValue)
		newJSON = string(data)
	}

	log := &model.SecurityAuditLog{
		UserID:     userID,
		ActionType: actionType,
		TargetType: targetType,
		TargetID:   targetID,
		OldValue:   oldJSON,
		NewValue:   newJSON,
		OperatorID: userID,
		CreatedAt:  time.Now().Unix(),
	}

	return model.DB.Create(log).Error
}

// GetSecurityAuditLogs 获取操作审计日志
func GetSecurityAuditLogs(page, pageSize int, userID int, actionType string) ([]*model.SecurityAuditLog, int64, error) {
	var logs []*model.SecurityAuditLog
	var count int64

	db := model.DB.Model(&model.SecurityAuditLog{})
	if userID > 0 {
		db = db.Where("user_id = ?", userID)
	}
	if actionType != "" {
		db = db.Where("action_type = ?", actionType)
	}

	err := db.Count(&count).Error
	if err != nil {
		return nil, 0, err
	}

	err = db.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&logs).Error
	if err != nil {
		return nil, 0, err
	}

	return logs, count, nil
}
