package model

import "github.com/QuantumNous/new-api/common"

type SavingsLogRow struct {
	Id               int
	CreatedAt        int64
	ModelName        string
	PromptTokens     int
	CompletionTokens int
	Quota            int
	Other            string
}

type SavingsLifetimeLogRow struct {
	Id               int
	RequestId        string
	UserId           int
	CreatedAt        int64
	ModelName        string
	PromptTokens     int
	CompletionTokens int
	Quota            int
	Other            string
}

type SavingsLifetimeLogCursor struct {
	ID        int
	CreatedAt int64
	RequestID string
}

func GetSavingsLifetimeLogBoundary() (SavingsLifetimeLogCursor, int64, error) {
	var total int64
	if err := LOG_DB.Model(&Log{}).Where("type = ?", LogTypeConsume).Count(&total).Error; err != nil {
		return SavingsLifetimeLogCursor{}, 0, err
	}
	if total == 0 {
		return SavingsLifetimeLogCursor{}, 0, nil
	}
	var row SavingsLifetimeLogRow
	query := LOG_DB.Model(&Log{}).
		Select("id", "created_at", "request_id").
		Where("type = ?", LogTypeConsume)
	if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		query = query.Order("created_at desc, request_id desc")
	} else {
		query = query.Order("id desc")
	}
	if err := query.First(&row).Error; err != nil {
		return SavingsLifetimeLogCursor{}, 0, err
	}
	return SavingsLifetimeLogCursor{ID: row.Id, CreatedAt: row.CreatedAt, RequestID: row.RequestId}, total, nil
}

func GetSavingsLifetimeLogBatch(cursor SavingsLifetimeLogCursor, target SavingsLifetimeLogCursor, limit int) ([]SavingsLifetimeLogRow, error) {
	if limit <= 0 {
		return []SavingsLifetimeLogRow{}, nil
	}
	rows := make([]SavingsLifetimeLogRow, 0, limit)
	query := LOG_DB.Model(&Log{}).
		Select("id", "request_id", "user_id", "created_at", "model_name", "prompt_tokens", "completion_tokens", "quota", "other").
		Where("type = ?", LogTypeConsume)
	if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		query = query.
			Where("(created_at > ? OR (created_at = ? AND request_id > ?))", cursor.CreatedAt, cursor.CreatedAt, cursor.RequestID).
			Where("(created_at < ? OR (created_at = ? AND request_id <= ?))", target.CreatedAt, target.CreatedAt, target.RequestID).
			Order("created_at asc, request_id asc")
	} else {
		query = query.Where("id > ? AND id <= ?", cursor.ID, target.ID).Order("id asc")
	}
	if err := query.Limit(limit).Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func GetRecentSavingsLifetimeLogBatch(startTimestamp int64, cursor SavingsLifetimeLogCursor, target SavingsLifetimeLogCursor, limit int) ([]SavingsLifetimeLogRow, error) {
	if limit <= 0 {
		return []SavingsLifetimeLogRow{}, nil
	}
	rows := make([]SavingsLifetimeLogRow, 0, limit)
	query := LOG_DB.Model(&Log{}).
		Select("id", "request_id", "user_id", "created_at", "model_name", "prompt_tokens", "completion_tokens", "quota", "other").
		Where("type = ? AND created_at >= ?", LogTypeConsume, startTimestamp)
	if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		query = query.
			Where("(created_at > ? OR (created_at = ? AND request_id > ?))", cursor.CreatedAt, cursor.CreatedAt, cursor.RequestID).
			Where("(created_at < ? OR (created_at = ? AND request_id <= ?))", target.CreatedAt, target.CreatedAt, target.RequestID).
			Order("created_at asc, request_id asc")
	} else {
		query = query.Where("id > ? AND id <= ?", cursor.ID, target.ID).Order("id asc")
	}
	if err := query.Limit(limit).Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func CountSavingsLifetimeClickHouseCursorAmbiguity(rows []SavingsLifetimeLogRow) (int64, error) {
	if !common.UsingLogDatabase(common.DatabaseTypeClickHouse) || len(rows) == 0 {
		return 0, nil
	}
	last := rows[len(rows)-1]
	included := int64(0)
	for i := len(rows) - 1; i >= 0; i-- {
		if rows[i].CreatedAt != last.CreatedAt || rows[i].RequestId != last.RequestId {
			break
		}
		included++
	}
	var total int64
	if err := LOG_DB.Model(&Log{}).
		Where("type = ? AND created_at = ? AND request_id = ?", LogTypeConsume, last.CreatedAt, last.RequestId).
		Count(&total).Error; err != nil {
		return 0, err
	}
	if total <= included {
		return 0, nil
	}
	return total - included, nil
}

func CountUserSavingsConsumeLogs(userId int, startTimestamp int64, endTimestamp int64) (int64, error) {
	var total int64
	err := LOG_DB.Model(&Log{}).
		Where("user_id = ? AND type = ? AND created_at >= ? AND created_at < ?", userId, LogTypeConsume, startTimestamp, endTimestamp).
		Count(&total).Error
	return total, err
}

func GetUserSavingsConsumeLogs(userId int, startTimestamp int64, endTimestamp int64, limit int) ([]SavingsLogRow, error) {
	rows := make([]SavingsLogRow, 0)
	if limit <= 0 {
		return rows, nil
	}
	err := LOG_DB.Model(&Log{}).
		Select("id", "created_at", "model_name", "prompt_tokens", "completion_tokens", "quota", "other").
		Where("user_id = ? AND type = ? AND created_at >= ? AND created_at < ?", userId, LogTypeConsume, startTimestamp, endTimestamp).
		Order("created_at asc, id asc").
		Limit(limit).
		Find(&rows).Error
	return rows, err
}
